/*
 * services/offlineGate.js   (install56 / "57 offline gate")
 * ---------------------------------------------------------------
 * THE GATE MUST NEVER STOP.  15 Apr 2026: the e-Kharid portal went
 * down for a morning and Haryana mandis had 3-4 hour queues and
 * highway jams because nobody could issue or check a pass.
 *
 * This file makes the gate screen work with NO internet:
 *   1. CACHE   - every time today's list arrives from Firestore we keep
 *                a copy on the device (AsyncStorage) per centre + date.
 *                Pass codes are in it, so a QR / 6-digit code can still
 *                be checked against the real list.
 *   2. QUEUE   - a gate entry that cannot be written (offline, or the
 *                write takes > WRITE_TIMEOUT_MS) is stored locally as
 *                "pending" with the REAL time it happened and a
 *                provisional lane. The farmer goes in immediately.
 *   3. SYNC    - when the network is back (or the officer taps Sync)
 *                pending entries are written in order with their
 *                original timestamps. If a pass turned out invalid
 *                meanwhile (cancelled elsewhere) it is flagged as a
 *                conflict for the officer - the vehicle is already
 *                inside, so this is information, not a rollback.
 *
 * Nothing here talks to Firestore directly except through
 * services/bookings.js (markGateEntry), so the same rules apply
 * online and offline (plate checks, hour validity, who came).
 * ---------------------------------------------------------------
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const WRITE_TIMEOUT_MS = 8000;   // slower than this = treat as offline
const CACHE_KEY = (centreId, date) => `@agb_gate_cache_${centreId}_${date}`;
const PENDING_KEY = (centreId) => `@agb_gate_pending_${centreId}`;
const STATE_KEY = (centreId) => `@agb_gate_state_${centreId}`;

let listeners = new Set();
function emit(state) { listeners.forEach((fn) => { try { fn(state); } catch (e) { /* ignore */ } }); }
export function onOfflineState(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ------------------------------------------------------------------ */
/*  connectivity                                                       */
/* ------------------------------------------------------------------ */
let lastKnownOnline = true;
let offlineSince = null;

export function isBrowserOnline() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) return navigator.onLine;
  return lastKnownOnline;
}

export function markOnline(on) {
  const was = lastKnownOnline;
  lastKnownOnline = Boolean(on);
  if (!lastKnownOnline && !offlineSince) offlineSince = new Date().toISOString();
  if (lastKnownOnline) offlineSince = null;
  if (was !== lastKnownOnline) emit(getState());
}

export function getState() {
  return { online: isBrowserOnline() && lastKnownOnline, offlineSince };
}

/** Run a Firestore write with a timeout. Resolves { ok, result } or { ok:false, timeout:true } */
export async function withTimeout(promise, ms = WRITE_TIMEOUT_MS) {
  let timer;
  const t = new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { timeout: true })), ms); });
  try {
    const result = await Promise.race([promise, t]);
    clearTimeout(timer);
    markOnline(true);
    return { ok: true, result };
  } catch (e) {
    clearTimeout(timer);
    const offline = e?.timeout || /unavailable|network|offline|failed to get document/i.test(String(e?.message || e?.code || ''));
    if (offline) markOnline(false);
    return { ok: false, error: e, offline };
  }
}

/* ------------------------------------------------------------------ */
/*  cache of today's list                                              */
/* ------------------------------------------------------------------ */
export async function cacheRows(centreId, date, rows) {
  if (!centreId || !date || !Array.isArray(rows)) return;
  try {
    // keep only what the gate needs - small and fast
    const slim = rows.map((r) => ({
      tokenId: r.tokenId, tokenNumber: r.tokenNumber, gatePassCode: r.gatePassCode, gatePassQr: r.gatePassQr,
      farmerId: r.farmerId, farmerName: r.farmerName, farmerPhone: r.farmerPhone, crop: r.crop, cropName: r.cropName,
      approxQuantityQuintals: r.approxQuantityQuintals, date: r.date, slotTime: r.slotTime, slotWindow: r.slotWindow,
      arriveAt: r.arriveAt, status: r.status, vehicleNumber: r.vehicleNumber || '', vehicles: r.vehicles || null,
      nomineeUsed: r.nomineeUsed || null, arhtiyaId: r.arhtiyaId || null, arhtiyaName: r.arhtiyaName || null,
      transferFrom: r.transferFrom || null, transferValidUntil: r.transferValidUntil || null, walkIn: Boolean(r.walkIn),
      laneAssigned: r.laneAssigned || null, positionAssigned: r.positionAssigned || null, centreId: r.centreId, centreName: r.centreName,
    }));
    await AsyncStorage.setItem(CACHE_KEY(centreId, date), JSON.stringify({ at: new Date().toISOString(), rows: slim }));
  } catch (e) { /* storage full etc. - never break the gate */ }
}

export async function loadCachedRows(centreId, date) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(centreId, date));
    if (!raw) return { at: null, rows: [] };
    const parsed = JSON.parse(raw);
    return { at: parsed.at || null, rows: Array.isArray(parsed.rows) ? parsed.rows : [] };
  } catch (e) { return { at: null, rows: [] }; }
}

/* ------------------------------------------------------------------ */
/*  pending gate entries                                               */
/* ------------------------------------------------------------------ */
export async function loadPending(centreId) {
  try { const raw = await AsyncStorage.getItem(PENDING_KEY(centreId)); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
async function savePending(centreId, list) {
  await AsyncStorage.setItem(PENDING_KEY(centreId), JSON.stringify(list));
  emit({ ...getState(), pending: list.length });
}

/**
 * Store an entry that could not be written. `lane` is provisional:
 * round-robin over the centre's lanes using what we know locally.
 */
export async function queueEntry(centreId, entry) {
  const list = await loadPending(centreId);
  const rec = {
    id: `${entry.tokenId}_${Date.now()}`,
    tokenId: entry.tokenId, plates: entry.plates, presentedBy: entry.presentedBy || 'self', verifiedBy: entry.verifiedBy || 'manual',
    unverified: Boolean(entry.unverified),     // pass not in the cache (booked after we went offline)
    lane: entry.lane || null,
    at: new Date().toISOString(),
    status: 'pending', error: null,
  };
  list.push(rec);
  await savePending(centreId, list);
  return rec;
}

/** Provisional lane: the lane with the fewest vehicles among cached rows + pending. */
export function provisionalLane(cachedRows, pending, lanes = 2) {
  const counts = {};
  for (let l = 1; l <= Math.max(1, lanes); l++) counts[l] = 0;
  cachedRows.forEach((r) => { if (r.laneAssigned && r.status !== 'booked' && r.status !== 'paid' && counts[r.laneAssigned] != null) counts[r.laneAssigned] += 1; });
  pending.forEach((p) => { if (p.lane && counts[p.lane] != null) counts[p.lane] += 1; });
  let best = 1;
  Object.keys(counts).forEach((l) => { if (counts[l] < counts[best]) best = Number(l); });
  return best;
}

/**
 * Write pending entries in order. `writer(rec)` = the real markGateEntry call.
 * Returns { synced, conflicts, left }.
 */
export async function syncPending(centreId, writer) {
  const list = await loadPending(centreId);
  let synced = 0, conflicts = 0;
  for (const rec of list) {
    if (rec.status !== 'pending') continue;
    const res = await withTimeout(writer(rec));
    if (res.ok) { rec.status = 'synced'; rec.syncedAt = new Date().toISOString(); synced += 1; }
    else if (res.offline) { break; }                              // still offline - stop, keep order
    else { rec.status = 'conflict'; rec.error = String(res.error?.key || res.error?.message || 'error'); conflicts += 1; }
  }
  // keep conflicts (officer must see them) and pendings; drop synced older than the list
  const keep = list.filter((r) => r.status !== 'synced');
  await savePending(centreId, keep);
  return { synced, conflicts, left: keep.filter((r) => r.status === 'pending').length, conflictRows: keep.filter((r) => r.status === 'conflict') };
}

export async function dismissConflict(centreId, id) {
  const list = (await loadPending(centreId)).filter((r) => r.id !== id);
  await savePending(centreId, list);
}

/** Remember when we last synced (shown on the banner). */
export async function saveGateState(centreId, patch) {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY(centreId));
    const cur = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(STATE_KEY(centreId), JSON.stringify({ ...cur, ...patch }));
  } catch (e) { /* ignore */ }
}
export async function loadGateState(centreId) {
  try { const raw = await AsyncStorage.getItem(STATE_KEY(centreId)); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
