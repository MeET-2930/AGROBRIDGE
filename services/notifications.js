/*
 * services/notifications.js   (install28)
 * ---------------------------------------------------------------
 * In-app + phone notifications without any paid backend.
 *
 * HOW IT WORKS
 *   Every event (booking, gate entry, assay, price, weighing, payment,
 *   delay, auction) appends a small item to ONE Firestore document per
 *   audience:
 *       notifications/u_<uid>        one farmer / one trader
 *       notifications/c_<centreId>   all officers of a mandi (item.duties says who)
 *       notifications/t_<centreId>   all traders of a mandi
 *   The app keeps a live listener on the document(s) for the logged-in
 *   user. A new item -> phone notification (expo-notifications, when the
 *   binary has it) or an in-app banner + vibration (Expo Go / web / old APK).
 *
 *   Items store translation KEYS, not sentences, so every reader sees
 *   them in his own language.  { titleKey, bodyKey, params, route }
 *
 *   Writes are fire-and-forget: a notification failure never breaks the
 *   real action (the stage change already happened).
 * ---------------------------------------------------------------
 */
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

export const MAX_ITEMS = 60; // kept per document (older ones trimmed by the reader)

export function userDocRef(uid) { return doc(db, 'notifications', `u_${uid}`); }
export function centreDocRef(centreId) { return doc(db, 'notifications', `c_${centreId}`); }
export function tradersDocRef(centreId) { return doc(db, 'notifications', `t_${centreId}`); }

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build one notification item.
 *   route = { stack: 'Farmer'|'Officer'|'Trader', screen: 'TokenDetail', params: {...} }
 */
export function makeItem(titleKey, bodyKey, params = {}, route = null, extra = {}) {
  return {
    id: newId(),
    at: new Date().toISOString(),
    titleKey,
    bodyKey,
    params: cleanParams(params),
    route: route || null,
    ...extra,
  };
}

// Firestore rejects `undefined`; keep params plain and small.
function cleanParams(p) {
  const out = {};
  Object.keys(p || {}).forEach((k) => {
    const v = p[k];
    if (v === undefined) return;
    out[k] = v === null ? '' : (typeof v === 'object' ? v : String(v));
  });
  return out;
}

async function append(ref, item) {
  try {
    await setDoc(ref, { items: arrayUnion(item), updatedAt: item.at }, { merge: true });
  } catch (e) {
    console.log('notification skipped:', e?.message);
  }
}

/* ---------------- writers (all best-effort, never throw) ---------------- */

export function notifyUser(uid, item) {
  if (!uid || !item) return Promise.resolve();
  return append(userDocRef(uid), item);
}

/** duties: ['gate'] | ['assay'] | ['*'] ... admin always sees everything. */
export function notifyCentreOfficers(centreId, duties, item) {
  if (!centreId || !item) return Promise.resolve();
  return append(centreDocRef(centreId), { ...item, duties: duties && duties.length ? duties : ['*'] });
}

export function notifyCentreTraders(centreId, item) {
  if (!centreId || !item) return Promise.resolve();
  return append(tradersDocRef(centreId), item);
}

/** Every farmer who holds a token at this mandi today (used for delay alerts). */
export async function notifyFarmersAtCentre(centreId, date, item) {
  if (!centreId || !date || !item) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'bookings'), where('centreId', '==', centreId), where('date', '==', date))
    );
    const uids = new Set();
    snap.docs.forEach((d) => {
      const b = d.data();
      if (b.farmerId && !['paid', 'rejected', 'no-show', 'cancelled'].includes(b.status)) uids.add(b.farmerId);
    });
    await Promise.all([...uids].map((uid) => append(userDocRef(uid), item)));
  } catch (e) {
    console.log('delay fan-out skipped:', e?.message);
  }
}

/* ---------------- readers ---------------- */

function subscribeDoc(ref, callback) {
  return onSnapshot(
    ref,
    (snap) => {
      const items = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
      items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      // Keep the document small: whoever reads an overgrown list trims it.
      if (items.length > MAX_ITEMS + 20) {
        updateDoc(ref, { items: items.slice(-MAX_ITEMS) }).catch(() => {});
      }
      callback(items.slice(-MAX_ITEMS));
    },
    (error) => {
      console.log('notification listener error:', error?.message);
      callback([]);
    }
  );
}

export function subscribeUser(uid, callback) {
  if (!uid) return () => {};
  return subscribeDoc(userDocRef(uid), callback);
}

export function subscribeCentreOfficers(centreId, duty, callback) {
  if (!centreId) return () => {};
  return subscribeDoc(centreDocRef(centreId), (items) => {
    const mine = items.filter((it) => {
      const d = Array.isArray(it.duties) ? it.duties : ['*'];
      return duty === 'admin' || d.includes('*') || d.includes(duty);
    });
    callback(mine);
  });
}

export function subscribeCentreTraders(centreId, callback) {
  if (!centreId) return () => {};
  return subscribeDoc(tradersDocRef(centreId), callback);
}

/* ---------------- route helpers used by services ---------------- */

export const routes = {
  farmerToken: (tokenId) => ({ stack: 'Farmer', screen: 'TokenDetail', params: { tokenId } }),
  farmerHome: () => ({ stack: 'Farmer', screen: 'FarmerDashboard', params: {} }),
  farmerPayments: () => ({ stack: 'Farmer', screen: 'Payments', params: {} }),
  officerStage: (stageId) => ({ stack: 'Officer', screen: 'StageQueue', params: { stageId } }),
  officerQueue: () => ({ stack: 'Officer', screen: 'TodaysQueue', params: {} }),
  traderLot: (tokenId) => ({ stack: 'Trader', screen: 'AuctionBidding', params: { tokenId } }),
  traderBoard: () => ({ stack: 'Trader', screen: 'AuctionBoard', params: {} }),
  traderWins: () => ({ stack: 'Trader', screen: 'MyPurchases', params: {} }),
};

/** "8:00 AM - 9:00 AM" -> "8:00 AM" (for short bodies) */
export function shortWindow(w) {
  return String(w || '').split(' - ')[0] || String(w || '');
}
