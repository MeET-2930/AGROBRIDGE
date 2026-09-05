/*
 * services/auctions.js
 * ---------------------------------------------------------------
 * e-NAM style live bidding.
 *
 * One Firestore doc per lot:   auctions/{tokenId}
 *
 *   status:      'open' | 'closed' | 'accepted' | 'rejected' | 'cancelled'
 *   opensAt / closesAt (ISO)        bidding window
 *   highestBid, highestBidderId, highestBidderName, bidCount
 *   bids: [ { traderId, traderName, amount, at } ]   (latest first, max 50)
 *
 * Every bid is a transaction: read the lot, check it is open, check
 * the time, check the amount beats the current highest by at least
 * BID_STEP, then write. Two traders tapping at once can never both win.
 *
 * Nothing runs on a server. When closesAt passes, bids are refused
 * inside the transaction; the farmer (or admin) then declares the result
 * by accepting / rejecting.
 * ---------------------------------------------------------------
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { CROP_LIST } from './centres';

export const BID_STEP = 5; // minimum increment, Rs per quintal
export const DEFAULT_AUCTION_MINUTES = 10;

export const AUCTION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed', // time over, waiting for farmer decision
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export function mspFor(cropId) {
  return CROP_LIST.find((c) => c.id === cropId)?.msp || 0;
}

export function auctionRef(tokenId) {
  return doc(db, 'auctions', tokenId);
}

/** True if the bidding window is still open right now. */
export function isBiddingOpen(auction) {
  if (!auction || auction.status !== AUCTION_STATUS.OPEN) return false;
  return new Date(auction.closesAt).getTime() > Date.now();
}

/** Seconds remaining (0 when over). */
export function secondsLeft(auction) {
  if (!auction?.closesAt) return 0;
  return Math.max(
    0,
    Math.floor((new Date(auction.closesAt).getTime() - Date.now()) / 1000)
  );
}

export function formatCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Farmer opens the lot for bidding (only after assay).
 * Reserve price = MSP; traders must bid at or above it.
 */
export async function openAuction(booking, minutes = DEFAULT_AUCTION_MINUTES) {
  if (!booking?.tokenId) throw new Error('Token required');

  const now = Date.now();
  const msp = mspFor(booking.crop);

  const lot = {
    tokenId: booking.tokenId,
    tokenNumber: booking.tokenNumber,
    centreId: booking.centreId,
    centreName: booking.centreName || '',
    date: booking.date,

    farmerId: booking.farmerId,
    farmerName: booking.farmerName || '',

    crop: booking.crop,
    cropName: booking.cropName || booking.crop,
    approxQuantityQuintals: Number(booking.approxQuantityQuintals) || 0,

    grade: booking.grade || 'FAQ',
    moisturePercent: booking.moisturePercent ?? null,
    foreignMatterPercent: booking.foreignMatterPercent ?? null,
    assayNotes: booking.assayNotes || '',

    reservePrice: msp,
    msp,

    status: AUCTION_STATUS.OPEN,
    opensAt: new Date(now).toISOString(),
    closesAt: new Date(now + minutes * 60 * 1000).toISOString(),

    highestBid: 0,
    highestBidderId: null,
    highestBidderName: null,
    bidCount: 0,
    bids: [],

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(auctionRef(booking.tokenId), lot);
  return lot;
}

/**
 * Trader places a bid. Atomic. Throws a Hindi message on failure.
 */
export async function placeBid(tokenId, { traderId, traderName, amount }) {
  const bid = Math.round(Number(amount));
  if (!traderId) throw new Error('कृपया दोबारा लॉग इन करें।');
  if (!bid || bid <= 0) throw new Error('सही बोली राशि दर्ज करें।');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(auctionRef(tokenId));
    if (!snap.exists()) throw new Error('यह लॉट अब उपलब्ध नहीं है।');

    const lot = snap.data();

    if (lot.status !== AUCTION_STATUS.OPEN) {
      throw new Error('यह नीलामी बंद हो चुकी है।');
    }
    if (new Date(lot.closesAt).getTime() <= Date.now()) {
      throw new Error('समय समाप्त — बोली स्वीकार नहीं।');
    }
    if (bid < lot.reservePrice) {
      throw new Error(`बोली MSP ₹${lot.reservePrice} से कम नहीं हो सकती।`);
    }
    const minNext = lot.highestBid > 0 ? lot.highestBid + BID_STEP : lot.reservePrice;
    if (bid < minNext) {
      throw new Error(`बोली कम से कम ₹${minNext} होनी चाहिए।`);
    }
    if (lot.highestBidderId === traderId) {
      throw new Error('आपकी बोली पहले से सबसे ऊँची है।');
    }

    const entry = {
      traderId,
      traderName: traderName || '',
      amount: bid,
      at: new Date().toISOString(),
    };

    const bids = [entry, ...(Array.isArray(lot.bids) ? lot.bids : [])].slice(0, 50);

    tx.update(auctionRef(tokenId), {
      highestBid: bid,
      highestBidderId: traderId,
      highestBidderName: traderName || '',
      bidCount: (Number(lot.bidCount) || 0) + 1,
      bids,
      updatedAt: serverTimestamp(),
    });

    return { ...lot, highestBid: bid, highestBidderId: traderId, bids };
  });
}

/** Mark the window closed (idempotent). Called from UI when timer hits 0. */
export async function closeAuctionIfDue(tokenId) {
  const snap = await getDoc(auctionRef(tokenId));
  if (!snap.exists()) return null;
  const lot = snap.data();
  if (lot.status === AUCTION_STATUS.OPEN && new Date(lot.closesAt).getTime() <= Date.now()) {
    await updateDoc(auctionRef(tokenId), {
      status: AUCTION_STATUS.CLOSED,
      updatedAt: serverTimestamp(),
    });
    return { ...lot, status: AUCTION_STATUS.CLOSED };
  }
  return lot;
}

/** Farmer accepts the highest bid. Returns the lot; caller fixes the price. */
export async function acceptHighestBid(tokenId, farmerId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(auctionRef(tokenId));
    if (!snap.exists()) throw new Error('लॉट नहीं मिला।');
    const lot = snap.data();
    if (lot.farmerId !== farmerId) throw new Error('यह आपका लॉट नहीं है।');
    if (!lot.highestBid || !lot.highestBidderId) {
      throw new Error('कोई बोली नहीं आई।');
    }
    if (![AUCTION_STATUS.OPEN, AUCTION_STATUS.CLOSED].includes(lot.status)) {
      throw new Error('यह नीलामी पहले ही तय हो चुकी है।');
    }
    tx.update(auctionRef(tokenId), {
      status: AUCTION_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return { ...lot, status: AUCTION_STATUS.ACCEPTED };
  });
}

/** Farmer rejects bids (falls back to MSP or re-auction). */
export async function rejectAuction(tokenId, reason = 'farmer-rejected') {
  await updateDoc(auctionRef(tokenId), {
    status: AUCTION_STATUS.REJECTED,
    rejectReason: reason,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reopen a CLOSED (timed-out, undecided) lot for N more minutes.
 * Refuses if the lot was already accepted/rejected.
 */
export async function extendAuction(tokenId, minutes = 5) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(auctionRef(tokenId));
    if (!snap.exists()) throw new Error('लॉट नहीं मिला।');
    const lot = snap.data();
    if (![AUCTION_STATUS.OPEN, AUCTION_STATUS.CLOSED].includes(lot.status)) {
      throw new Error('यह नीलामी तय हो चुकी है, दोबारा नहीं खुल सकती।');
    }
    tx.update(auctionRef(tokenId), {
      status: AUCTION_STATUS.OPEN,
      closesAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      updatedAt: serverTimestamp(),
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Live subscriptions                                                 */
/* ------------------------------------------------------------------ */

export function subscribeToAuction(tokenId, callback) {
  if (!tokenId) return () => {};
  return onSnapshot(
    auctionRef(tokenId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error('Auction subscription error:', error);
      callback(null);
    }
  );
}

/** All lots at a centre for a date (trader board). Sorted: open first, newest first. */
export function subscribeToCentreAuctions(centreId, dateStr, callback) {
  if (!centreId) return () => {};
  return onSnapshot(
    query(
      collection(db, 'auctions'),
      where('centreId', '==', centreId),
      where('date', '==', dateStr)
    ),
    (snap) => {
      const rows = snap.docs.map((d) => d.data());
      const rank = { open: 0, closed: 1, accepted: 2, rejected: 3, cancelled: 4 };
      rows.sort((a, b) => {
        const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (r !== 0) return r;
        return String(b.opensAt).localeCompare(String(a.opensAt));
      });
      callback(rows);
    },
    (error) => {
      console.error('Centre auctions subscription error:', error);
      callback([]);
    }
  );
}

/** Lots this trader has won (accepted). */
export function subscribeToTraderWins(traderId, callback) {
  if (!traderId) return () => {};
  return onSnapshot(
    // Single-field query (no composite index needed); filter status here.
    query(collection(db, 'auctions'), where('highestBidderId', '==', traderId)),
    (snap) => {
      const rows = snap.docs
        .map((d) => d.data())
        .filter((r) => r.status === AUCTION_STATUS.ACCEPTED);
      rows.sort((a, b) => String(b.acceptedAt || '').localeCompare(String(a.acceptedAt || '')));
      callback(rows);
    },
    (error) => {
      console.error('Trader wins subscription error:', error);
      callback([]);
    }
  );
}
