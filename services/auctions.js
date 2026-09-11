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
import { tErr } from './i18nError';
import { notifyUser, notifyCentreTraders, makeItem, routes } from './notifications';

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

  // install28: every trader of this mandi sees the new lot.
  notifyCentreTraders(lot.centreId, makeItem('nt_tr_newLot_t', 'nt_tr_newLot_b',
    { token: lot.tokenNumber, crop: lot.cropName, qty: lot.approxQuantityQuintals, grade: lot.grade, msp: msp, minutes },
    routes.traderLot(lot.tokenId)));
  return lot;
}

/**
 * Trader places a bid. Atomic. Throws a Hindi message on failure.
 */
export async function placeBid(tokenId, { traderId, traderName, amount }) {
  const bid = Math.round(Number(amount));
  if (!traderId) throw tErr('loginAgain');
  if (!bid || bid <= 0) throw tErr('err.badBid');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(auctionRef(tokenId));
    if (!snap.exists()) throw tErr('err.lotGone');

    const lot = snap.data();

    if (lot.status !== AUCTION_STATUS.OPEN) {
      throw tErr('err.auctionClosed');
    }
    if (new Date(lot.closesAt).getTime() <= Date.now()) {
      throw tErr('err.timeOver');
    }
    if (bid < lot.reservePrice) {
      throw tErr('err.belowMsp', { n: lot.reservePrice });
    }
    const minNext = lot.highestBid > 0 ? lot.highestBid + BID_STEP : lot.reservePrice;
    if (bid < minNext) {
      throw tErr('err.bidMin', { n: minNext });
    }
    if (lot.highestBidderId === traderId) {
      throw tErr('err.alreadyHighest');
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
  }).then((res) => {
    // install28: previous highest bidder is outbid; farmer sees the new top bid.
    const prevBidder = res.bids?.[1]?.traderId;
    const p = { token: res.tokenNumber, crop: res.cropName, bid, bidder: traderName || '' };
    if (prevBidder && prevBidder !== traderId) {
      notifyUser(prevBidder, makeItem('nt_tr_outbid_t', 'nt_tr_outbid_b', p, routes.traderLot(tokenId)));
    }
    notifyUser(res.farmerId, makeItem('nt_auctionBid_t', 'nt_auctionBid_b', p, routes.farmerToken(tokenId)));
    return res;
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
    if (!snap.exists()) throw tErr('err.lotNotFound');
    const lot = snap.data();
    if (lot.farmerId !== farmerId) throw tErr('err.notYourLot');
    if (!lot.highestBid || !lot.highestBidderId) {
      throw tErr('err.noBids');
    }
    if (![AUCTION_STATUS.OPEN, AUCTION_STATUS.CLOSED].includes(lot.status)) {
      throw tErr('err.auctionDecided');
    }
    tx.update(auctionRef(tokenId), {
      status: AUCTION_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return { ...lot, status: AUCTION_STATUS.ACCEPTED };
  }).then((res) => {
    // install28: winner + everyone else who bid.
    const p = { token: res.tokenNumber, crop: res.cropName, bid: res.highestBid, qty: res.approxQuantityQuintals };
    notifyUser(res.highestBidderId, makeItem('nt_tr_won_t', 'nt_tr_won_b', p, routes.traderWins()));
    const losers = new Set((res.bids || []).map((x) => x.traderId).filter((id) => id && id !== res.highestBidderId));
    losers.forEach((id) => notifyUser(id, makeItem('nt_tr_lost_t', 'nt_tr_lost_b', p, routes.traderBoard())));
    return res;
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
    if (!snap.exists()) throw tErr('err.lotNotFound');
    const lot = snap.data();
    if (![AUCTION_STATUS.OPEN, AUCTION_STATUS.CLOSED].includes(lot.status)) {
      throw tErr('err.cannotReopen');
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
