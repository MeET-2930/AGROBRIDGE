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
  getDoc,
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
import { translate } from '../i18n/translations';

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

/* =====================================================================
 * install34: PUSH to phones whose app is closed.
 * Each phone stores { token, lang } under users/{uid}.pushTokens when the
 * app starts (see NotificationContext). The device that causes an event
 * posts directly to Expo's free push API - no server, nothing to keep awake.
 * ===================================================================== */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function pushToUsers(userDocs, item) {
  const messages = [];
  userDocs.forEach((u) => {
    const tokens = Array.isArray(u.pushTokens) ? u.pushTokens : [];
    tokens.forEach((pt) => {
      const token = typeof pt === 'string' ? pt : pt?.token;
      const lang = (typeof pt === 'object' && pt?.lang) || u.lang || 'hi';
      if (!token || !String(token).startsWith('ExponentPushToken')) return;
      messages.push({
        to: token,
        title: translate(item.titleKey, lang, item.params),
        body: translate(item.bodyKey, lang, item.params),
        sound: 'default',
        channelId: 'agrobridge',
        priority: 'high',
        data: { id: item.id, route: item.route || null },
      });
    });
  });
  if (!messages.length) return;
  try {
    for (let i = 0; i < messages.length; i += 90) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 90)),
      });
    }
  } catch (e) {
    console.log('push send skipped:', e?.message);
  }
}

async function pushToUid(uid, item) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) await pushToUsers([snap.data()], item);
  } catch (e) { /* ignore */ }
}

async function pushToCentre(centreId, role, item, duties) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('centreId', '==', centreId), where('role', '==', role)));
    let users = snap.docs.map((d) => d.data());
    if (role === 'officer' && duties && !duties.includes('*')) {
      users = users.filter((u) => u.officerDuty === 'admin' || duties.includes(u.officerDuty));
    }
    await pushToUsers(users, item);
  } catch (e) { /* ignore */ }
}

/** Called by the app on start-up / language change. */
export async function registerPushToken(uid, token, lang) {
  if (!uid || !token) return;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const prev = (snap.exists() && Array.isArray(snap.data().pushTokens)) ? snap.data().pushTokens : [];
    const rest = prev.filter((pt) => (typeof pt === 'string' ? pt : pt?.token) !== token).slice(-4); // max 5 phones
    await setDoc(ref, { pushTokens: [...rest, { token, lang: lang || 'hi', at: new Date().toISOString() }] }, { merge: true });
  } catch (e) {
    console.log('push token save skipped:', e?.message);
  }
}

/* ---------------- writers (all best-effort, never throw) ---------------- */

export function notifyUser(uid, item) {
  if (!uid || !item) return Promise.resolve();
  pushToUid(uid, item);
  return append(userDocRef(uid), item);
}

/** duties: ['gate'] | ['assay'] | ['*'] ... admin always sees everything. */
export function notifyCentreOfficers(centreId, duties, item) {
  if (!centreId || !item) return Promise.resolve();
  const d = duties && duties.length ? duties : ['*'];
  pushToCentre(centreId, 'officer', item, d);
  return append(centreDocRef(centreId), { ...item, duties: d });
}

export function notifyCentreTraders(centreId, item) {
  if (!centreId || !item) return Promise.resolve();
  pushToCentre(centreId, 'trader', item);
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
    await Promise.all([...uids].map((uid) => { pushToUid(uid, item); return append(userDocRef(uid), item); }));
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
