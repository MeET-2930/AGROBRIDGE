/*
 * services/bookings.js
 * ---------------------------------------------------------------
 * Booking + token + queue engine for AGROBRIDGE.
 *
 * Two collections are involved:
 *
 *   bookings/{tokenId}
 *       One document per farmer booking. Its `status` field
 *       drives every screen in the app.
 *
 *   centreQueues/{centreId}__{date}
 *       ONE small live document per centre per day.
 *       This is what farmers subscribe to. It holds:
 *         - which token is being served right now
 *         - how many tokens have been issued
 *         - per-window labour minutes + vehicle counts (capacity;
 *           see CAPACITY MODEL below, install41)
 *       Because it is a single document, a farmer needs exactly
 *       one realtime listener, and no farmer can see any other
 *       farmer's private data.
 * ---------------------------------------------------------------
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  arrayUnion,
  increment,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { fetchCentreById, fetchCentres, normalizePlate, cropClassOf } from './centres';
import {
  CAPACITY_DEFAULTS, centreCapacity, windowList, windowLabelFor, planLoad, applyPlan, releasePlan, planDay, round1, formatHour, loadMinutesFor,
} from '../engine/capacity';
import { correctionRatio, trainCorrection } from '../engine/models/correction';
import { showProbability, leadDaysBetween, trainNoShow } from '../engine/models/noshow';
import { effectiveThroughput, learnThroughput } from '../engine/models/throughput';
import {
  yardState, yardFactors, floorProjection, scaleCapacity, waitEstimate, shouldAutoDeclare, yardReasons, YARD_DEFAULTS,
} from '../engine/yard';
import { spareDay, canAdmitNow, transferOffer, distanceKm, utilisation, SPARE_DEFAULTS } from '../engine/spare';
import ENGINE_PARAMS from '../engine/models/params';
import { todayLocal, parseLocalDate, localDateString } from './dates';
import { tErr } from './i18nError';
import { requireOfficerDuty, DUTY_FOR_STAGE } from './auth';
import { TESTING_MODE } from './config';
import { notifyNextFarmer } from './ivr';
import {
  notifyUser, notifyCentreOfficers, notifyCentreTraders, notifyFarmersAtCentre, makeItem, routes,
} from './notifications';

/* ===============================================================
 * STATUS STATE MACHINE
 * =============================================================== */

export const STATUS = {
  BOOKED: 'booked',
  IN_GATE: 'in-gate',
  ASSAY: 'assay',
  PRICE_FIXED: 'price-fixed', // rate per quintal decided (MSP or auction)
  WEIGHING: 'weighing',
  PAYMENT_PENDING: 'payment-processing',
  PAID: 'paid',
  REJECTED: 'rejected',
  NO_SHOW: 'no-show',
  MISSED: 'missed',      // install42: slot hour passed without entry; room released
  CANCELLED: 'cancelled',
};

// Statuses that mean the farmer is physically inside the mandi.
export const INSIDE_STATUSES = [
  STATUS.IN_GATE,
  STATUS.ASSAY,
  STATUS.PRICE_FIXED,
  STATUS.WEIGHING,
  STATUS.PAYMENT_PENDING,
];

// Statuses that still occupy a place in today's queue.
export const ACTIVE_STATUSES = [
  STATUS.BOOKED,
  ...INSIDE_STATUSES,
];

// Statuses that are finished, one way or another.
export const CLOSED_STATUSES = [
  STATUS.PAID,
  STATUS.REJECTED,
  STATUS.NO_SHOW,
  STATUS.MISSED,
  STATUS.CANCELLED,
];

/* ===============================================================
 * SMALL HELPERS
 * =============================================================== */

/**
 * Today's date in the DEVICE's timezone, not UTC.
 * See services/dates.js for why this matters.
 */
export function todayString(d = null) {
  return d ? localDateString(d) : todayLocal();
}

export function queueDocId(centreId, dateStr) {
  return `${centreId}__${dateStr}`;
}

function queueRef(centreId, dateStr) {
  return doc(db, 'centreQueues', queueDocId(centreId, dateStr));
}


function clockTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/* ===============================================================
 * CAPACITY MODEL  -  install44: moved to engine/capacity.js
 * ---------------------------------------------------------------
 * The maths is now PURE code in /engine (no Firebase in it) so the very
 * same files run in the browser today and on the AgroBridge server
 * later. This file is the "local adapter": it reads Firestore, asks the
 * engine for a decision, and writes the result. Old names are re-
 * exported so no screen had to change.
 * =============================================================== */
export {
  CAPACITY_DEFAULTS,
  capacityPerWindow,
  throughputFor,
  centreCapacity,
  loadMinutesFor,
  windowList,
  windowLabelFor,
  planLoad,
} from '../engine/capacity';

/* ===============================================================
 * ENGINE INPUTS (install44)  -  what the ML models need
 * ---------------------------------------------------------------
 *  Model A  correctionRatio(crop, farmerHistory)  -> reserve expected q
 *  Model B  learnThroughput(weighings)            -> real q/h per hour
 *  Model C  showProbability(features)             -> P(farmer turns up)
 * All three are switchable per centre (centre.engine.{...}) and from the
 * admin's Engine screen. Defaults = ON for A and C, 'set' for B, so a
 * mandi that never touches the screen still benefits.
 * =============================================================== */
export const ENGINE_DEFAULTS = { useCorrection: true, useNoShow: true, throughputMode: 'set' };

export function engineSettings(centre) {
  return { ...ENGINE_DEFAULTS, ...(centre?.engine || {}) };
}

/** Farmer's past declared-vs-actual pairs and show record (for A and C). */
export async function fetchFarmerHistory(farmerId) {
  const empty = { pairs: [], pastBookings: 0, pastNoShows: 0 };
  if (!farmerId) return empty;
  try {
    const snap = await getDocs(query(collection(db, 'bookings'), where('farmerId', '==', farmerId)));
    const rows = snap.docs.map((d) => d.data()).filter((b) => (CLOSED_STATUSES.includes(b.status) || b.status === STATUS.PAID) && !b.yardIncidentCancel);
    const pairs = rows
      .filter((b) => Number(b.actualQuantity) > 0 && Number(b.declaredQuintals || b.approxQuantityQuintals) > 0)
      .sort((a, b) => String(b.weighedAt || '').localeCompare(String(a.weighedAt || '')))
      .map((b) => ({ declared: Number(b.declaredQuintals || b.approxQuantityQuintals), actual: Number(b.actualQuantity) }));
    const pastNoShows = rows.filter((b) => b.status === STATUS.NO_SHOW || b.status === STATUS.MISSED).length;
    return { pairs, pastBookings: rows.length, pastNoShows };
  } catch (e) {
    return empty;
  }
}

/** Model B input: this centre's weighings (last `days` days). */
export async function fetchWeighings(centreId, days = 30) {
  if (!centreId) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const snap = await getDocs(query(collection(db, 'bookings'), where('centreId', '==', centreId)));
    return snap.docs.map((d) => d.data()).filter((b) => b.weighedAt && b.weighedAt >= since && Number(b.actualQuantity) > 0);
  } catch (e) {
    return [];
  }
}

/**
 * Centre + crop capacity with Model B applied when the admin chose
 * "use learned". learned = centre.engine.learnedThroughput (saved by
 * the Engine screen), so the booking path needs no extra reads.
 */
export function effectiveCapacity(centre, crop, slotTime) {
  const cap = centreCapacity(centre, crop);
  const st = engineSettings(centre);
  const eff = effectiveThroughput(cap.throughput, st.learnedThroughput, slotTime, st.throughputMode);
  return { ...cap, throughput: eff.value, throughputSource: eff.source, setThroughput: cap.throughput };
}

/** Model inputs for one farmer/booking -> planLoad opts + audit record. */
export async function engineInputs({ centre, farmerId, crop, quintals, date, slotTime, bookedVia = 'app', nowMs = Date.now() }) {
  const st = engineSettings(centre);
  const hist = await fetchFarmerHistory(farmerId);
  const lp = st.localParams || {};
  const corrParams = lp.correction && lp.correction.samples >= 30 ? lp.correction : undefined;
  const nsParams = lp.noshow && lp.noshow.samples >= 100 ? lp.noshow : undefined;
  const corr = st.useCorrection ? correctionRatio(crop, hist.pairs, corrParams) : { ratio: 1, n: hist.pairs.length, source: 'off' };
  const show = st.useNoShow
    ? showProbability({ pastBookings: hist.pastBookings, pastNoShows: hist.pastNoShows, leadDays: leadDaysBetween(nowMs, date), hour: Number(String(slotTime || '9').split(':')[0]), quintals, bookedVia }, nsParams)
    : { pShow: 1, features: null, contrib: null };
  const leadDays = leadDaysBetween(nowMs, date);
  return {
    opts: { ratio: corr.ratio, pShow: show.pShow, cropClass: cropClassOf(crop), leadDays },
    audit: {
      cropClass: cropClassOf(crop), leadDays,
      ratio: corr.ratio, ratioSource: corr.source, farmerVisits: corr.n,
      pShow: show.pShow, pastBookings: hist.pastBookings, pastNoShows: hist.pastNoShows,
      useCorrection: st.useCorrection, useNoShow: st.useNoShow, throughputMode: st.throughputMode,
      modelVersion: ENGINE_PARAMS.version, trainedOn: nsParams || corrParams ? 'this-mandi' : ENGINE_PARAMS.trainedOn,
    },
  };
}

/* ===============================================================
 * SPARE CAPACITY  (install53)   walk-in "Now" + cross-centre transfer
 * ---------------------------------------------------------------
 * Planned capacity is sold days ahead and PROMISED. Spare is what turns
 * out free ON THE DAY (no-shows, pessimistic floor projection, fast
 * labour). It is never promised in advance; it is used, in order, by
 * farmers already inside, walk-ins at the gate ("Now"), and same-day
 * transfers from a congested mandi in the same cluster.
 *   centre.acceptTransfers (default true), centre.maxTransferSharePercent
 *   (default 30), centre.clusterId (default 'default').
 * =============================================================== */

function minutesSinceOpen(centre, now = new Date()) {
  const [h0] = String(centre?.operatingStartTime || '08:00').split(':').map(Number);
  return (now.getHours() - h0) * 60 + now.getMinutes();
}

/**
 * Live spare picture for a centre today. Uses only the queue document
 * (booked / expected minutes per hour) and today's rows (arrived loads).
 */
export async function fetchSpareNow(centreId, crop = '', now = new Date()) {
  const centre = await fetchCentreById(centreId);
  if (!centre) throw tErr('err.mandiNotFound');
  const date = todayString(now);
  const qSnap = await getDoc(queueRef(centreId, date));
  const queue = qSnap.exists() ? qSnap.data() : {};
  const rows = await fetchTodaysQueue(centreId, date);
  const yp = await yardPlan(centre, crop, centreId);
  const slots = windowList(centre);
  const hours = slots.map((slotTime) => {
    const cap = capacityWithYard(centre, crop, slotTime, yp, date);
    // arrived minutes = loads of this hour that have entered, at this hour's throughput
    const arrivedQ = rows.filter((b) => b.slotTime === slotTime && (INSIDE_STATUSES.includes(b.status) || b.status === STATUS.PAID))
      .reduce((s, b) => s + (Number(b.actualQuantity) || Number(b.engine?.reservedQuintals) || Number(b.declaredQuintals || b.approxQuantityQuintals) || 0), 0);
    return {
      slotTime, cap,
      bookedMinutes: Number(queue.slotLoadMinutes?.[slotTime]) || 0,
      expectedMinutes: queue.slotExpectedMinutes?.[slotTime] != null ? Number(queue.slotExpectedMinutes[slotTime]) : null,
      arrivedMinutes: loadMinutesFor(arrivedQ, cap.throughput),
    };
  });
  const day = spareDay(hours, minutesSinceOpen(centre, now));
  const gateWaiting = rows.filter((b) => b.status === STATUS.BOOKED && slotState(b, now) === 'open').length;
  const reservedTransferMinutes = rows.filter((b) => b.transferFrom && b.status === STATUS.BOOKED).reduce((s, b) => s + (Number(b.loadMinutes) || 0), 0);
  const offer = transferOffer(day, {
    reservedTransferMinutes, gateWaiting, yardLevel: yp.factors.incidentLevel,
    acceptTransfers: centre.acceptTransfers !== false, maxTransferSharePercent: centre.maxTransferSharePercent,
  });
  const used = {
    walkIns: rows.filter((b) => b.walkIn).length,
    transfersIn: rows.filter((b) => b.transferFrom).length,
    spareQuintals: Math.round(rows.filter((b) => b.spareUsed).reduce((s, b) => s + (Number(b.declaredQuintals || b.approxQuantityQuintals) || 0), 0)),
  };
  return { centre, date, day, gateWaiting, offer, used, utilisationPercent: utilisation(day), yardLevel: yp.factors.incidentLevel, throughput: hours[0]?.cap?.throughput || 0 };
}

/** Admin: transfer settings. */
export async function saveTransferSettings(centreId, { acceptTransfers, maxTransferSharePercent, clusterId }) {
  await requireOfficerDuty(centreId, ['admin']);
  const patch = {};
  if (acceptTransfers != null) patch.acceptTransfers = Boolean(acceptTransfers);
  if (maxTransferSharePercent != null) patch.maxTransferSharePercent = Math.max(0, Math.min(100, Math.round(Number(maxTransferSharePercent) || 0)));
  if (clusterId != null) patch.clusterId = String(clusterId || 'default');
  await updateDoc(doc(db, 'centres', centreId), patch);
  return patch;
}

/**
 * Other mandis in the same cluster that have spare TODAY for this load.
 * Returns [{ centre, km, offerMinutes, untilLabel }] sorted by distance.
 * Nothing is reserved by looking.
 */
export async function findTransferOptions(fromCentreId, crop, quintals, farmerLat = null, farmerLon = null) {
  const from = await fetchCentreById(fromCentreId);
  if (!from) return [];
  const all = await fetchCentres();
  const cluster = from.clusterId || 'default';
  const out = [];
  for (const c of all) {
    if (c.id === fromCentreId) continue;
    if ((c.clusterId || 'default') !== cluster) continue;
    if (Array.isArray(c.acceptedCrops) && c.acceptedCrops.length && crop && !c.acceptedCrops.includes(crop)) continue;
    try {
      const sp = await fetchSpareNow(c.id, crop);
      const need = loadMinutesFor(quintals, sp.throughput || 400);
      if (sp.offer.minutes < need) continue;
      const lat = farmerLat ?? from.latitude, lon = farmerLon ?? from.longitude;
      const lastSlot = windowList(c).slice(-1)[0] || '17:00';
      out.push({ centre: c, km: distanceKm(lat, lon, c.latitude, c.longitude), offerMinutes: sp.offer.minutes, needMinutes: need, untilLabel: windowLabelFor(lastSlot, 1).split(' - ')[1], gateWaiting: sp.gateWaiting });
    } catch (e) { /* skip centre */ }
  }
  return out.sort((a, b) => (a.km ?? 9e9) - (b.km ?? 9e9));
}

/**
 * Issue a same-day TRANSFER pass at `toCentreId`, valid for
 * SPARE_DEFAULTS.transferWindowMin minutes. Booked into the current
 * hour (or the next with room), consuming spare only. If the farmer
 * does not arrive in the window the pass expires with NO no-show mark.
 */
export async function bookTransfer({ farmerId, farmerName, farmerPhone, fromCentreId, toCentreId, crop, cropName, quintals }) {
  const to = await fetchCentreById(toCentreId);
  const from = await fetchCentreById(fromCentreId);
  if (!to || !from) throw tErr('err.mandiNotFound');
  const sp = await fetchSpareNow(toCentreId, crop);
  const q = Math.max(1, Number(quintals) || 1);
  const need = loadMinutesFor(q, sp.throughput || 400);
  if (sp.offer.minutes < need) throw tErr('err.transferGone');
  const now = new Date();
  const date = todayString(now);
  const slots = windowList(to);
  const nowH = now.getHours();
  const yp = await yardPlan(to, crop, toCentreId);
  const validUntil = new Date(now.getTime() + SPARE_DEFAULTS.transferWindowMin * 60000).toISOString();
  let start = slots.findIndex((t) => Number(t.split(':')[0]) >= nowH);
  if (start < 0) throw tErr('err.transferGone');
  const qSnap = await getDoc(queueRef(toCentreId, date));
  const queue = qSnap.exists() ? qSnap.data() : {};
  for (let i = Math.max(0, start - 1); i < slots.length; i += 1) {
    if (Number(slots[i].split(':')[0]) < nowH) continue;
    const cap = capacityWithYard(to, crop, slots[i], yp, date);
    const plan = planLoad(cap, slots, queue, i, q, { cropClass: cropClassOf(crop), leadDays: 0, pShow: 1, ratio: 1 });
    if (!plan.ok) continue;
    try {
      const booking = await createBooking({
        farmerId, farmerName, farmerPhone, centreId: toCentreId, crop, cropName, approxQuantityQuintals: q, date, slotTime: slots[i],
        slotWindow: windowLabelFor(slots[i], plan.needed), bookedVia: 'app',
        extra: { spareUsed: true, transferFrom: fromCentreId, transferFromName: from.name, transferValidUntil: validUntil },
      });
      notifyCentreOfficers(toCentreId, ['gate'], makeItem('nt_off_transfer_t', 'nt_off_transfer_b', { name: farmerName || farmerPhone, q, from: from.name }, routes.officerStage('gate')));
      return booking;
    } catch (e) {
      if (String(e?.message || '').includes('maxTokens')) throw e;
    }
  }
  throw tErr('err.transferGone');
}

/** Transfer pass: 'valid' | 'expired' (window over) | null (not a transfer). */
export function transferState(booking, now = new Date()) {
  if (!booking?.transferValidUntil) return null;
  return now.getTime() <= new Date(booking.transferValidUntil).getTime() ? 'valid' : 'expired';
}

/**
 * Gate: expire transfer passes whose window is over. Closed as CANCELLED
 * (reason transferExpired) - never a no-show. Room goes back to spare.
 */
export async function expireTransferPasses(rows, now = new Date()) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r.status === STATUS.BOOKED && transferState(r, now) === 'expired');
  let n = 0;
  for (const r of list) {
    try {
      await advanceStage(r.tokenId, { status: STATUS.MISSED, missedAt: now.toISOString() });
      await updateDoc(doc(db, 'bookings', r.tokenId), { status: STATUS.CANCELLED, cancelledAt: now.toISOString(), cancelReason: 'transferExpired', yardIncidentCancel: true });
      n += 1;
    } catch (e) { /* another device did it */ }
  }
  return n;
}

/* ===============================================================
 * YARD: FLOOR / BAGS / LABOUR  (install52)   root causes R6 + R7
 * ---------------------------------------------------------------
 * The weighbridge is not the only limit - the FLOOR is. Every quintal
 * weighed lies in bags on the floor until a lifting truck removes it.
 * centre.yard = { floorCapacityQ, floorUsedQ, bagsInStock, labourTeams,
 *                 labourTeamsNormal, liftedHistory[], incident{} }
 *   + weighing  -> floorUsedQ += actual (recordWeighing)
 *   - lifting   -> admin types "lifted today" (recordLifted)
 * The planner shrinks bookable minutes on days the floor is projected
 * to be full (engine/yard.js floorProjection). No booking is ever
 * moved: the farmer chooses wait / cancel & re-book (yard incident).
 * =============================================================== */

/** A normal day's intake in quintals (throughput x operating hours). */
export function normalDayIntake(centre, crop = '') {
  return Math.max(1, centreCapacity(centre, crop).throughput * windowList(centre).length);
}

/** Reserved quintals already booked per day from today for `days` days. */
export async function bookedQuintalsByDay(centreId, days = YARD_DEFAULTS.projectionDays, fromDate = null) {
  const out = [];
  const start = fromDate ? parseLocalDate(fromDate) : new Date();
  for (let d = 0; d < days; d += 1) {
    const dt = new Date(start.getTime()); dt.setDate(dt.getDate() + d);
    try {
      const snap = await getDoc(queueRef(centreId, todayString(dt)));
      const q = snap.exists() ? snap.data() : {};
      const res = q.slotReservedQuintals && Object.keys(q.slotReservedQuintals).length ? q.slotReservedQuintals : q.slotQuintals || {};
      out.push(Object.values(res).reduce((s, v) => s + (Number(v) || 0), 0));
    } catch (e) { out.push(0); }
  }
  return out;
}

/**
 * Everything the planner needs from the yard for one centre:
 *   factors      labour multiplier, bag cap, floor %, incident level
 *   projection   floor day by day -> factorByDay (1 = normal, 0 = closed)
 *   factorFor(dateStr)  bookable factor for that date
 * Bags cap TODAY only (tomorrow's bardana may arrive tonight).
 */
export async function yardPlan(centre, crop = '', centreId = null) {
  const y = yardState(centre?.yard);
  const factors = yardFactors(y);
  const normal = normalDayIntake(centre, crop);
  const cid = centreId || centre?.id;
  const booked = cid ? await bookedQuintalsByDay(cid, y.projectionDays) : [];
  const projection = floorProjection(y, booked, normal);
  const today = todayString();
  const bagFactor = factors.bagCapQ == null ? 1 : Math.min(1, factors.bagCapQ / normal);
  const factorFor = (dateStr) => {
    const off = leadDaysBetween(Date.now(), dateStr);
    const f = off >= 0 && off < projection.factorByDay.length ? projection.factorByDay[off] : 1;
    return dateStr === today ? Math.min(f, bagFactor) : f;
  };
  return { yard: y, factors, projection, normal, factorFor, incident: y.incident || null, reasons: yardReasons(y) };
}

/** Capacity for one hour on one date with the yard applied. */
export function capacityWithYard(centre, crop, slotTime, plan, dateStr) {
  const base = effectiveCapacity(centre, crop, slotTime);
  if (!plan) return base;
  return scaleCapacity(base, plan.factorFor(dateStr), plan.factors.labourFactor);
}

/** Admin: set yard numbers (floor capacity/used, bags, labour). */
export async function saveYardState(centreId, patch) {
  await requireOfficerDuty(centreId, ['admin']);
  const cur = (await fetchCentreById(centreId))?.yard || {};
  const clean = {};
  Object.entries(patch || {}).forEach(([k, v]) => { clean[k] = v === '' ? null : v; });
  const next = { ...cur, ...clean, updatedAt: new Date().toISOString() };
  await updateDoc(doc(db, 'centres', centreId), { yard: next });
  await syncYardIncident(centreId, next);
  return next;
}

/** Admin: "lifted today" - quintals that left the yard. Lowers the floor. */
export async function recordLifted(centreId, quintals) {
  await requireOfficerDuty(centreId, ['admin']);
  const q = Math.max(0, Math.round(Number(quintals) || 0));
  const cur = yardState((await fetchCentreById(centreId))?.yard);
  const today = todayString();
  const hist = [{ date: today, q }, ...cur.liftedHistory.filter((h) => h.date !== today)].slice(0, 10);
  const next = { ...cur, floorUsedQ: Math.max(0, Math.round(cur.floorUsedQ - q)), liftedTodayQ: q, liftedHistory: hist, updatedAt: new Date().toISOString() };
  await updateDoc(doc(db, 'centres', centreId), { yard: next });
  await syncYardIncident(centreId, next);
  return next;
}

/**
 * Declare / clear a yard incident (floor full, no bags, lifting stopped).
 * on = true  -> every farmer with a pass TODAY is told: wait (estimate)
 *               or cancel & re-book, no penalty. Day excluded from ML.
 * on = false -> back to normal; passes issued meanwhile lose the banner.
 */
export async function declareYardIncident(centreId, on, reason = 'floor', { auto = false } = {}) {
  if (!auto) await requireOfficerDuty(centreId, DUTY_FOR_STAGE.delay);
  const centre = await fetchCentreById(centreId);
  const cur = yardState(centre?.yard);
  const today = todayString();
  const incident = on
    ? { active: true, since: cur.incident?.active ? cur.incident.since : new Date().toISOString(), reason, auto, dates: Array.from(new Set([...(cur.incident?.dates || []), today])), dismissedAt: null }
    : { ...(cur.incident || {}), active: false, clearedAt: new Date().toISOString(), dismissedAt: auto ? null : new Date().toISOString() };
  await updateDoc(doc(db, 'centres', centreId), { 'yard.incident': incident, ...(on ? { engineExcludeDates: arrayUnion(today) } : {}) });
  const f = yardFactors(cur);
  const item = on
    ? makeItem('nt_yard_t', 'nt_yard_b', { p: Math.round(f.floorUsedPercent) }, routes.farmerHome())
    : makeItem('nt_yardOk_t', 'nt_yardOk_b', {}, routes.farmerHome());
  notifyFarmersAtCentre(centreId, today, item);
  notifyCentreOfficers(centreId, ['*'], { ...item, route: routes.officerQueue() });
  return incident;
}

/** Auto-declare when the arithmetic crosses the hard line (admin may clear). */
async function syncYardIncident(centreId, yard) {
  const y = yardState(yard);
  const f = yardFactors(y);
  const active = Boolean(y.incident?.active);
  if (!active && shouldAutoDeclare(y) && !y.incident?.dismissedAt) {
    await declareYardIncident(centreId, true, yardReasons(y)[0] || 'floor', { auto: true });
  } else if (active && y.incident?.auto && f.incidentLevel === 'ok') {
    await declareYardIncident(centreId, false, y.incident.reason, { auto: true });
  }
}

/** Live centre document (yard state changes while the farmer looks at his pass). */
export function subscribeToCentre(centreId, callback) {
  if (!centreId) return () => {};
  return onSnapshot(doc(db, 'centres', centreId), (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => callback(null));
}

/**
 * What the pass screen shows during an incident for THIS booking:
 * null when nothing applies, else { level, floorUsedPercent, estimate:{minMin,maxMin,stopped}, reasons }.
 * Pure given centre + booking + queue (all already on the screen).
 */
export function yardNoticeFor(centre, booking, queue, now = new Date()) {
  const y = yardState(centre?.yard);
  if (!y.incident?.active) return null;
  if (!booking || booking.status !== STATUS.BOOKED) return null;
  if (booking.date !== todayString(now)) return null;
  const f = yardFactors(y);
  const slots = windowList(centre);
  const idx = slots.indexOf(booking.slotTime);
  const exp = queue?.slotExpectedMinutes || queue?.slotLoadMinutes || {};
  const mine = Number(exp[booking.slotTime]) || 0;
  // backlog: earlier hours whose work is not finished yet (rough: expected - actual share)
  let backlog = 0;
  for (let i = 0; i < idx; i += 1) {
    const s = slots[i];
    const booked = Number(exp[s]) || 0;
    const doneQ = Number(queue?.slotActualQuintals?.[s]) || 0;
    const bookedQ = Number(queue?.slotReservedQuintals?.[s] || queue?.slotQuintals?.[s]) || 0;
    const doneShare = bookedQ > 0 ? Math.min(1, doneQ / bookedQ) : 1;
    backlog += booked * (1 - doneShare);
  }
  const estimate = waitEstimate({ minutesBookedInHour: mine, backlogMinutes: backlog, floorUsedPercent: f.floorUsedPercent, labourFactor: f.labourFactor });
  return { level: f.incidentLevel, floorUsedPercent: f.floorUsedPercent, estimate, reasons: yardReasons(y), reason: y.incident.reason, since: y.incident.since };
}

/** Farmer: "I'll wait" - recorded so the box collapses; nothing else changes. */
export async function markYardChoice(tokenId, choice) {
  if (!tokenId) throw new Error('Token ID is required');
  await updateDoc(doc(db, 'bookings', tokenId), { yardChoice: choice, yardChoiceAt: new Date().toISOString() });
  return choice;
}

/**
 * Farmer: "Cancel & re-book" during a yard incident. Bypasses the 48 h
 * window, releases the room, and is NOT a no-show: the row is flagged
 * yardIncidentCancel and ignored by Model C / farmer history.
 */
export async function cancelForYardIncident(tokenId) {
  if (!tokenId) throw new Error('Token ID is required');
  const bookingRef = doc(db, 'bookings', tokenId);
  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);
    if (!bSnap.exists()) throw tErr('err.tokenNotFound');
    const booking = bSnap.data();
    if (booking.status !== STATUS.BOOKED) throw tErr('err.cannotCancel');
    const qRef = queueRef(booking.centreId, booking.date);
    const qSnap = await tx.get(qRef);
    tx.update(bookingRef, {
      status: STATUS.CANCELLED, cancelledAt: new Date().toISOString(),
      cancelReason: 'yardIncident', yardIncidentCancel: true, yardChoice: 'rebook',
    });
    if (qSnap.exists()) {
      const data = qSnap.data();
      const position = Number(booking.positionAssigned) || 0;
      tx.update(qRef, {
        ...releaseLoad(data, booking),
        openPositions: (Array.isArray(data.openPositions) ? data.openPositions : []).filter((p) => p !== position),
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  });
}

/* ===============================================================
 * SLOT WINDOW STATE (install42)
 * ---------------------------------------------------------------
 * Outside the gate there is NO queue order. A pass is for an HOUR:
 * be there in that hour and you enter in order of arrival.
 *   before  -> not yet (grey)      open -> go to the gate (green)
 *   passed  -> hour over (orange): pass expires, room released,
 *              farmer is REBOOKED at the gate into the next hour
 *              with room for his load (same as a walk-in).
 * =============================================================== */
export const EARLY_GRACE_MIN = 10;   // gate may admit this many minutes early

export function slotBounds(booking) {
  if (!booking?.date || !booking?.slotTime) return null;
  const [h, m] = String(booking.slotTime).split(':').map(Number);
  const start = parseLocalDate(booking.date);
  start.setHours(h, m || 0, 0, 0);
  const hours = Array.isArray(booking.windows) && booking.windows.length ? booking.windows.length : 1;
  const end = new Date(start.getTime() + hours * 60 * 60000);
  return { start, end, hours };
}

/** 'before' | 'open' | 'passed' for a pass, at `now`. */
export function slotState(booking, now = new Date()) {
  const b = slotBounds(booking);
  if (!b) return 'open';
  if (now.getTime() < b.start.getTime() - EARLY_GRACE_MIN * 60000) return 'before';
  // The FIRST hour is the arrival hour; arriving after it is late even
  // if a multi-hour load is still "in progress" on paper.
  const arrivalEnd = new Date(b.start.getTime() + 60 * 60000);
  if (now.getTime() >= arrivalEnd.getTime()) return 'passed';
  return 'open';
}

/** install49: 'soon' = within SOON_MIN minutes of the hour opening (amber light). */
export const SOON_MIN = 15;
export function isSoon(booking, now = new Date()) {
  const b = slotBounds(booking);
  if (!b) return false;
  const ms = b.start.getTime() - EARLY_GRACE_MIN * 60000 - now.getTime();
  return ms > 0 && ms <= SOON_MIN * 60000;
}

/** install49: farmer may cancel only up to CANCEL_HOURS before the arrival hour. */
export const CANCEL_HOURS = 48;
export function canCancel(booking, now = new Date()) {
  // (deliberately NOT bypassed in TESTING_MODE so the rule can be demonstrated:
  //  a booking for today/tomorrow shows "window closed", one 3+ days ahead can cancel)
  const b = slotBounds(booking);
  if (!b) return true;
  return b.start.getTime() - now.getTime() >= CANCEL_HOURS * 3600000;
}

/** Minutes until the arrival hour opens (0 if open/passed). */
export function minutesUntilSlot(booking, now = new Date()) {
  const b = slotBounds(booking);
  if (!b) return 0;
  return Math.max(0, Math.round((b.start.getTime() - now.getTime()) / 60000));
}

/** What the farmer calls his pass: the hour (and day), never a number. */
export function passLabel(booking) {
  if (!booking) return '';
  return booking.slotWindow || windowLabelFor(booking.slotTime || '08:00', (booking.windows || []).length || 1);
}

/** Short reference officers call out inside the yard: last 4 of the gate code. */
export function yardRef(booking) {
  return gatePassCodeOf(booking).slice(-4);
}

function emptyQueue(centre, centreId, date) {
  const cap = centreCapacity(centre);
  return {
    centreId,
    date,
    centreName: centre.name,
    avgMinutesPerEntry: Number(centre.avgMinutesPerEntry) || 15,
    parallelLanes: Number(centre.parallelLanes) || 1,
    throughputPerHour: centre.throughputPerHour || CAPACITY_DEFAULTS.throughputPerHour,
    bufferPercent: cap.bufferPercent,
    maxSharePercent: cap.maxSharePercent,
    declaredTolerancePercent: cap.declaredTolerancePercent,
    nowServingPosition: null,
    nowServingToken: null,
    nowServingStatus: null,
    lastIssuedPosition: 0,
    totalBooked: 0,
    completedCount: 0,
    openPositions: [],
    insidePositions: [],
    slotCounts: {},        // vehicles per arrival window
    slotLoadMinutes: {},   // labour minutes booked per window
    slotQuintals: {},      // declared quintals per window
    slotActualQuintals: {},// weighbridge quintals per window
    loadByPosition: {},    // position -> { m: minutes, q: quintals }
  };
}

/**
 * Human token label from a numeric position. 1 -> A-01, 21 -> B-01
 */
function tokenLabel(position) {
  const letter = String.fromCharCode(
    65 + Math.floor((position - 1) / 20)
  );

  const num = String(((position - 1) % 20) + 1).padStart(2, '0');

  return `${letter}-${num}`;
}

/* ===============================================================
 * SLOT AVAILABILITY
 * =============================================================== */

/**
 * Build the list of windows for a centre on a date, evaluated FOR THIS
 * FARMER'S LOAD. Each row says whether his quantity fits starting at
 * that hour (and how many windows it spans). Data comes from the same
 * queue document the transaction checks.
 */
export async function fetchCentreSlots(centreId, dateStr, { crop = '', quintals = 10, farmerId = null } = {}) {
  const centre = await fetchCentreById(centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  const queueSnap = await getDoc(queueRef(centreId, dateStr));
  const queue = queueSnap.exists() ? queueSnap.data() : {};

  // install44: ask the engine with the ML inputs for THIS farmer
  const { opts, audit } = await engineInputs({ centre, farmerId, crop, quintals, date: dateStr, slotTime: null });
  const list = windowList(centre);
  // install52: the floor / bags / labour shrink what may be booked on this date
  const yp = await yardPlan(centre, crop, centreId);
  const dayFactor = yp.factorFor(dateStr);
  const slots = list.map((slotTime, idx) => {
    const cap = capacityWithYard(centre, crop, slotTime, yp, dateStr);
    const plan = planLoad(cap, list, queue, idx, quintals, opts);
    const hour = Number(slotTime.split(':')[0]);
    return {
      slotTime,
      windowLabel: windowLabelFor(slotTime, 1),
      runLabel: plan.ok ? windowLabelFor(slotTime, plan.needed) : null,
      needed: plan.needed || 1,
      fits: plan.ok,
      reason: !plan.ok && dayFactor <= 0.01 ? 'yard' : plan.reason,
      isFull: !plan.ok,
      closed: Boolean(queue.closedSlots?.[slotTime]),
      horizon: plan.horizon || null,
      windows: plan.ok ? plan.windows : [],
      arriveLabel: formatHour(hour),
      // legacy fields still read by older code paths
      totalCapacity: cap.vehicleCap,
      bookedCount: Number(queue.slotCounts?.[slotTime]) || 0,
      availableCapacity: Math.max(0, cap.vehicleCap - (Number(queue.slotCounts?.[slotTime]) || 0)),
    };
  });

  const tooBig = slots.length > 0 && slots.every((s) => s.reason === 'tooBig');
  const firstFit = slots.find((s) => s.fits) || null;

  return {
    centre, date: dateStr, slots, firstFit, tooBig, capacity: effectiveCapacity(centre, crop, list[0]), engine: audit,
    yard: { factor: Math.round(dayFactor * 100) / 100, floorUsedPercent: yp.factors.floorUsedPercent, labourFactor: yp.factors.labourFactor, incidentActive: Boolean(yp.incident?.active), recoveryDays: yp.projection.recoveryDays, reasons: yp.reasons },
  };
}

/* ===============================================================
 * CREATE BOOKING  (transactional)
 * =============================================================== */

/**
 * Book a slot and allocate a token atomically.
 *
 * The transaction guarantees that two farmers tapping "confirm"
 * at the same instant can never both take the last place, and can
 * never be given the same token number.
 */
/* ------------------------------------------------------------------ */
/*  Gate pass helpers                                                  */
/* ------------------------------------------------------------------ */

/** Text encoded inside the gate pass QR. */
export function buildGatePassQr(tokenId, gatePassCode) {
  return `AGB|${tokenId}|${gatePassCode}`;
}

/** Parse a scanned QR. Returns { tokenId, gatePassCode } or null. */
export function parseGatePassQr(text) {
  const parts = String(text || '').trim().split('|');
  if (parts.length !== 3 || parts[0] !== 'AGB') return null;
  return { tokenId: parts[1], gatePassCode: parts[2] };
}

/** Gate pass code for a booking (older bookings fall back to token digits). */
export function gatePassCodeOf(booking) {
  if (!booking) return '';
  if (booking.gatePassCode) return String(booking.gatePassCode);
  return String(booking.tokenId || '').replace(/\D/g, '').slice(-6);
}

/**
 * Find today's booking at this centre that matches a scanned QR
 * or a typed 6-digit code. `rows` is the officer's live list.
 */
export function findByGatePass(rows, input) {
  const list = Array.isArray(rows) ? rows : [];
  const raw = String(input || '').trim();
  if (!raw) return null;

  const parsed = parseGatePassQr(raw);
  if (parsed) {
    return (
      list.find(
        (r) =>
          r.tokenId === parsed.tokenId &&
          gatePassCodeOf(r) === String(parsed.gatePassCode)
      ) || null
    );
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) {
    const hit = list.find((r) => gatePassCodeOf(r) === digits);
    if (hit) return hit;
  }

  // Allow typing the token label too, e.g. A-03
  const label = raw.toUpperCase().replace(/\s/g, '');
  return list.find((r) => String(r.tokenNumber).toUpperCase() === label) || null;
}

export async function createBooking({
  farmerId,
  farmerName,
  farmerPhone,
  centreId,
  crop,
  cropName = '',
  vehicleNumber = '',
  approxQuantityQuintals = 0,
  date,
  slotTime,
  slotWindow,
  bookedVia = 'app', // 'app' | 'ivr' | 'gate'
  extra = {},        // install53: { walkIn, transferFrom, transferValidUntil, spareUsed }
}) {
  if (!farmerId) throw new Error('Farmer ID is required');
  if (!centreId) throw new Error('Mandi centre is required');
  if (!crop) throw new Error('Crop is required');
  if (!date || !slotTime) throw new Error('Date and slot are required');

  const quintals = Math.max(1, parseFloat(approxQuantityQuintals) || 0);

  // Centre master data is static, so read it outside the transaction.
  const centre = await fetchCentreById(centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  // install41: at most 2 live tokens per farmer per mandi.
  const active = await fetchActiveFarmerBookings(farmerId);
  if (active.filter((b) => b.centreId === centreId).length >= MAX_ACTIVE_TOKENS_PER_CENTRE) {
    throw tErr('err.maxTokens');
  }

  // install52: same yard-scaled capacity the slot screen showed
  const yp = await yardPlan(centre, crop, centreId);
  const cap = capacityWithYard(centre, crop, slotTime, yp, date);
  const slots = windowList(centre);
  const startIdx = slots.indexOf(slotTime);
  if (startIdx < 0) throw tErr('err.slotFull');

  // install44: ML inputs (Model A ratio, Model C P(show)) for this farmer.
  const eng = await engineInputs({ centre, farmerId, crop, quintals, date, slotTime, bookedVia });

  const qRef = queueRef(centreId, date);
  const tokenId = `TKN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingRef = doc(db, 'bookings', tokenId);

  /*
   * Gate pass code: 6 digits, easy to read out or send by SMS to
   * a keypad phone. The QR on the pass carries the same code.
   */
  const gatePassCode = String(Math.floor(100000 + Math.random() * 900000));

  const booking = await runTransaction(db, async (tx) => {
    const qSnap = await tx.get(qRef);
    const queue = qSnap.exists() ? { ...emptyQueue(centre, centreId, date), ...qSnap.data() } : emptyQueue(centre, centreId, date);

    // Re-plan against the LIVE queue inside the transaction. If another
    // farmer took the room a second ago, this throws and the slot screen
    // reloads with fresh ticks.
    const plan = planLoad(cap, slots, queue, startIdx, quintals, eng.opts);
    if (!plan.ok) {
      throw tErr(plan.reason === 'tooBig' ? 'err.tooBig' : plan.reason === 'closed' ? 'err.slotClosed' : plan.reason === 'horizon' ? 'err.horizon' : 'err.slotFull');
    }

    const counters = applyPlan(queue, plan, quintals);
    const loadByPosition = { ...(queue.loadByPosition || {}) };

    const position = (Number(queue.lastIssuedPosition) || 0) + 1;
    const tokenNumber = tokenLabel(position);
    loadByPosition[position] = { m: plan.loadMinutes, q: quintals };

    // Arrival = start of first window + work already booked before him.
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const turn = parseLocalDate(date);
    turn.setHours(slotHour, (slotMinute || 0) + plan.offsetMinutes, 0, 0);
    const finish = new Date(turn.getTime() + Math.ceil(plan.loadMinutes) * 60000);
    const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const record = {
      tokenId,
      tokenNumber,
      positionAssigned: position,

      farmerId,
      farmerName: farmerName || '',
      farmerPhone: farmerPhone || '',

      vehicleNumber: vehicleNumber
        ? String(vehicleNumber).toUpperCase().trim()
        : '',

      approxQuantityQuintals: quintals,
      declaredQuintals: quintals,

      centreId,
      centreName: centre.name,
      centreAddress: centre.address || '',

      crop,
      cropName: cropName || crop,

      date,
      slotTime,
      slotWindow: slotWindow || windowLabelFor(slotTime, plan.needed),
      windows: plan.windows,
      windowLoads: plan.windowLoads,
      loadMinutes: plan.loadMinutes,
      throughputUsed: cap.throughput,
      // install44: what the engine assumed for this booking (audit trail)
      engine: {
        ...eng.audit,
        reservedQuintals: plan.reservedQuintals,
        windowExpected: plan.windowExpected,
        throughputSource: cap.throughputSource,
        setThroughput: cap.setThroughput,
      },
      arriveAt: fmt(turn),
      expectedFinishAt: fmt(finish),
      bookedVia,
      // install53: spare-capacity passes
      walkIn: Boolean(extra.walkIn),
      spareUsed: Boolean(extra.spareUsed),
      transferFrom: extra.transferFrom || null,
      transferFromName: extra.transferFromName || null,
      transferValidUntil: extra.transferValidUntil || null,

      status: STATUS.BOOKED,

      // Gate pass (shown as QR + number to the farmer)
      gatePassCode,
      gatePassQr: buildGatePassQr(tokenId, gatePassCode),
      gatePassVerifiedBy: null,

      estimatedTurnTime: fmt(turn),

      // Stage timestamps, filled in by the officer as it progresses
      gateEntryAt: null,
      assayAt: null,
      weighedAt: null,
      paidAt: null,

      // Assay results
      moisturePercent: null,
      foreignMatterPercent: null,
      grade: null,
      assayNotes: '',

      // Weighing
      grossWeightQuintals: null,
      tareWeightQuintals: null,
      actualQuantity: null,
      quantityVariancePercent: null,
      overDeclaredTolerance: false,

      // Pricing (decided after assay, before weighing)
      priceMode: null, // 'msp' | 'auction'
      priceFixedAt: null,
      buyerId: null,
      buyerName: null,

      // Payment
      ratePerQuintal: null,
      grossAmount: null,
      mandiFee: null,
      commission: null,
      hamali: null,
      netPayable: null,
      receiptId: null,
      receiptGeneratedAt: null,
      paymentReference: null,

      delayOffsetMinutes: 0,
      delayReason: '',

      createdAt: new Date().toISOString(),
    };

    tx.set(bookingRef, record);

    tx.set(
      qRef,
      {
        ...queue,
        lastIssuedPosition: position,
        totalBooked: (Number(queue.totalBooked) || 0) + 1,
        openPositions: [...(queue.openPositions || []), position],
        insidePositions: queue.insidePositions || [],
        ...counters,
        loadByPosition,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return record;
  });

  // install28: tell the farmer and the gate staff (fire-and-forget).
  const bp = { token: booking.tokenNumber, mandi: booking.centreName, date: booking.date, time: booking.arriveAt || booking.slotWindow, crop: booking.crop || booking.cropName, qty: booking.approxQuantityQuintals, farmer: booking.farmerName || booking.farmerPhone };
  notifyUser(booking.farmerId, makeItem('nt_booked_t', 'nt_booked_b', bp, routes.farmerToken(booking.tokenId)));
  notifyCentreOfficers(booking.centreId, ['gate'], makeItem('nt_off_newToken_t', 'nt_off_newToken_b', bp, routes.officerStage('gate')));

  return booking;
}

export const MAX_ACTIVE_TOKENS_PER_CENTRE = 2;

/* ===============================================================
 * LIVE QUEUE  (what the farmer subscribes to)
 * =============================================================== */

/**
 * Subscribe to the one live queue document for a centre + date.
 * Returns an unsubscribe function.
 */
export function subscribeToQueue(centreId, dateStr, callback) {
  if (!centreId || !dateStr) return () => {};

  return onSnapshot(
    queueRef(centreId, dateStr),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error('Queue subscription error:', error);
      callback(null);
    }
  );
}

/**
 * Subscribe to a single booking document (the farmer's own token).
 */
export function subscribeToBooking(tokenId, callback) {
  if (!tokenId) return () => {};

  return onSnapshot(
    doc(db, 'bookings', tokenId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error('Booking subscription error:', error);
      callback(null);
    }
  );
}

/**
 * Turn (my booking + live queue) into the small amount of
 * information the farmer actually needs.
 *
 * Deliberately returns aggregates only - a token number and a
 * count - never another farmer's identity.
 */
export function buildQueueView(booking, queue) {
  /*
   * NOTE ON LANGUAGE
   * headline / detail are NOT sentences. They are { key, params }
   * objects, resolved on screen with tr(view.headline) so the
   * farmer sees them in the language he picked.
   */
  const myPosition = Number(booking?.positionAssigned) || 0;
  const status = booking?.status;
  const msg = (key, params) => ({ key, params: params || {} });

  // Assay done: the FARMER must now choose MSP or auction.
  if (status === STATUS.ASSAY) {
    return {
      level: 'action',
      tokensAhead: 0,
      nowServingToken: booking?.tokenNumber,
      etaMinutes: 0,
      headline: msg('qv_action_h'),
      detail: msg('qv_action_d', { grade: booking?.grade || 'FAQ' }),
    };
  }

  // Farmer is already inside the mandi.
  if (INSIDE_STATUSES.includes(status)) {
    const rate = booking?.ratePerQuintal;
    const buyer =
      booking?.priceMode === 'auction'
        ? booking?.buyerName || { key: 'tr_trader' }
        : { key: 'td_govBuyer' };

    let headline;
    let detail;

    if (status === STATUS.IN_GATE) {
      headline = msg('qv_inside_h');
      detail = booking?.laneAssigned
        ? msg('qv_inside_lane_d', { lane: booking.laneAssigned })
        : msg('qv_inside_d');
    } else if (status === STATUS.PRICE_FIXED) {
      headline = msg('qv_priceFixed_h', { rate });
      detail = msg('qv_priceFixed_d', { buyer });
    } else if (status === STATUS.WEIGHING) {
      headline = msg('qv_weighed_h');
      detail = msg('qv_weighed_d', { qty: booking?.actualQuantity || '', rate });
    } else {
      headline = msg('qv_payPending_h');
      detail = msg('qv_payPending_d');
    }

    return {
      level: 'inside',
      tokensAhead: 0,
      nowServingToken: null,
      etaMinutes: 0,
      lane: booking?.laneAssigned || null,
      headline,
      detail,
    };
  }

  if (CLOSED_STATUSES.includes(status)) {
    return {
      level: 'closed',
      tokensAhead: 0,
      nowServingToken: queue?.nowServingToken || null,
      etaMinutes: 0,
      headline:
        status === STATUS.PAID
          ? msg('qv_paid_h')
          : status === STATUS.NO_SHOW
          ? msg('qv_noShow_h')
          : status === STATUS.MISSED
          ? msg('qv_missed_h')
          : msg('qv_closed_h'),
      detail: '',
    };
  }

  /*
   * install42: OUTSIDE the gate the farmer only needs to know whether
   * his hour is open. No position, no "ahead of you" - order outside
   * is arrival order within the hour, decided at the gate.
   */
  const state = slotState(booking);
  const label = passLabel(booking);
  const arrive = booking?.arriveAt || label;

  if (state === 'before') {
    const mins = minutesUntilSlot(booking);
    return {
      level: isSoon(booking) ? 'soon' : 'waiting',
      slotState: state,
      tokensAhead: 0,
      nowServingToken: null,
      etaMinutes: mins,
      headline: isSoon(booking) ? msg('qv_soon_h') : msg('qv_slotBefore_h', { t: label }),
      detail: isSoon(booking)
        ? msg('qv_soon_d', { min: Math.max(1, mins) })
        : (mins <= 90 ? msg('qv_slotBefore_soon_d', { m: mins }) : msg('qv_slotBefore_d', { t: arrive })),
    };
  }

  if (state === 'passed' || status === STATUS.MISSED) {
    const choice = booking?.lateChoice || null;   // null | 'late' | 'notComing'
    return {
      level: 'ready',
      slotState: 'passed',
      lateChoice: choice,
      tokensAhead: 0,
      nowServingToken: null,
      etaMinutes: 0,
      headline: msg(choice === 'late' ? 'qv_lateRequested_h' : 'qv_slotPassed_h', { t: label }),
      detail: msg(choice === 'late' ? 'qv_lateRequested_d' : 'qv_slotPassed_d'),
    };
  }

  return {
    level: 'go',
    slotState: state,
    tokensAhead: 0,
    nowServingToken: null,
    etaMinutes: 0,
    headline: msg('qv_slotOpen_h', { t: label }),
    detail: msg('qv_slotOpen_d'),
  };
}

/**
 * install42: INSIDE the yard the order is real - vehicles in MY LANE
 * that entered before me. Returns { ahead, etaMinutes } or null.
 */
export function laneAhead(booking, queue, rows) {
  if (!booking || booking.status !== STATUS.IN_GATE) return null;
  const lane = Number(booking.laneAssigned) || 0;
  const perEntry = Number(queue?.avgMinutesPerEntry) || 15;
  const list = Array.isArray(rows) ? rows : [];
  const mine = new Date(booking.gateEntryAt || 0).getTime();
  const ahead = list.filter(
    (r) => r.tokenId !== booking.tokenId && INSIDE_STATUSES.includes(r.status) && Number(r.laneAssigned) === lane && new Date(r.gateEntryAt || 0).getTime() < mine
  );
  const minutes = ahead.reduce((sum, r) => sum + (Number(r.loadMinutes) || perEntry), 0);
  return { ahead: ahead.length, etaMinutes: Math.round(minutes), lane };
}

/* ===============================================================
 * OFFICER ACTIONS
 * =============================================================== */

/**
 * Shared helper: update a booking AND the live queue document in
 * one transaction, so the farmer's screen and the officer's screen
 * can never disagree.
 *
 * The queue document tracks two arrays instead of a single
 * "now serving" pointer:
 *
 *   openPositions   - every token not yet finished (waiting OR inside)
 *   insidePositions - tokens that have passed the gate
 *
 * Counting these is correct no matter how many lanes the mandi runs
 * in parallel, and no matter what order the officers work in.
 */
/**
 * Role guard used by every officer action: the caller must be an
 * officer posted at the token's mandi, holding one of `duties`
 * (or admin). Throws a translated error otherwise.
 */
async function assertOfficerFor(tokenId, duties) {
  if (!tokenId) throw new Error('Token ID is required');
  const snap = await getDoc(doc(db, 'bookings', tokenId));
  if (!snap.exists()) throw tErr('err.tokenNotFound');
  await requireOfficerDuty(snap.data().centreId, duties);
  return snap.data();
}

/**
 * install41: give a booking's labour minutes / vehicle place back to
 * the windows it occupied (cancel, no-show). Mutates and returns a
 * patch for the queue document.
 */
function releaseLoad(queueData, booking) {
  return releasePlan(queueData, booking);
}

async function advanceStage(tokenId, patch, { entering = false } = {}) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);

  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);

    if (!bSnap.exists()) {
      throw tErr('err.tokenNotFound');
    }

    const booking = bSnap.data();
    const qRef = queueRef(booking.centreId, booking.date);
    const qSnap = await tx.get(qRef);

    tx.update(bookingRef, patch);

    if (!qSnap.exists()) {
      return { ...booking, ...patch };
    }

    const data = qSnap.data();
    const position = Number(booking.positionAssigned) || 0;

    let openPositions = Array.isArray(data.openPositions)
      ? [...data.openPositions]
      : [];

    let insidePositions = Array.isArray(data.insidePositions)
      ? [...data.insidePositions]
      : [];

    const isClosing = CLOSED_STATUSES.includes(patch.status);

    /*
     * LANE GUIDANCE (install22)
     * The mandi has `parallelLanes` unloading lanes. When a vehicle is
     * admitted we send it to the lane with the fewest vehicles right now,
     * so the farmer is told "Lane 2" at the gate and does not wander.
     * laneCounts = { "1": 3, "2": 1 }  -> vehicles currently in each lane.
     */
    const lanes = Math.max(1, Number(data.parallelLanes) || 1);
    const laneCounts = { ...(data.laneCounts || {}) };
    let laneAssigned = Number(booking.laneAssigned) || null;

    if (entering && !insidePositions.includes(position)) {
      insidePositions.push(position);
      let best = 1;
      for (let l = 1; l <= lanes; l++) {
        if ((Number(laneCounts[l]) || 0) < (Number(laneCounts[best]) || 0)) best = l;
      }
      laneAssigned = best;
      laneCounts[best] = (Number(laneCounts[best]) || 0) + 1;
      patch.laneAssigned = best;
      tx.update(bookingRef, { laneAssigned: best });
    }

    if (isClosing) {
      openPositions = openPositions.filter((p) => p !== position);
      insidePositions = insidePositions.filter((p) => p !== position);
      if (laneAssigned && laneCounts[laneAssigned] > 0) {
        laneCounts[laneAssigned] = Number(laneCounts[laneAssigned]) - 1;
      }
    }

    insidePositions.sort((a, b) => a - b);
    openPositions.sort((a, b) => a - b);

    // install41: a no-show frees its window room for others.
    const released = (patch.status === STATUS.NO_SHOW || patch.status === STATUS.MISSED) ? releaseLoad(data, booking) : {};

    // install41: weighbridge result goes into the window's actuals so the
    // admin can compare declared vs actual per hour.
    const actuals = {};
    if (patch.actualQuantity != null && Number(patch.actualQuantity) > 0) {
      const slotActualQuintals = { ...(data.slotActualQuintals || {}) };
      const w = booking.slotTime;
      slotActualQuintals[w] = round1((Number(slotActualQuintals[w]) || 0) + Number(patch.actualQuantity));
      actuals.slotActualQuintals = slotActualQuintals;
    }

    // Display value only: the lowest token currently inside.
    const lowestInside = insidePositions.length ? insidePositions[0] : null;

    tx.update(qRef, {
      ...released,
      ...actuals,
      openPositions,
      insidePositions,
      insideCount: insidePositions.length,
      nowServingPosition: lowestInside,
      nowServingToken: lowestInside ? tokenLabel(lowestInside) : null,
      nowServingStatus: entering ? patch.status : data.nowServingStatus || null,
      laneCounts,
      completedCount: isClosing
        ? (Number(data.completedCount) || 0) + 1
        : Number(data.completedCount) || 0,
      updatedAt: serverTimestamp(),
    });

    return { ...booking, ...patch };
  }).then((result) => {
    afterStageNotify(result, patch).catch(() => {});
    return result;
  });
}

/*
 * install28: who is told what, after each stage.
 * Keys live in i18n/translations.js (nt_*). Never throws.
 */
async function afterStageNotify(b, patch) {
  const p = {
    token: b.tokenNumber, mandi: b.centreName, farmer: b.farmerName || b.farmerPhone || '',
    crop: b.crop || b.cropName, grade: b.grade || 'FAQ', rate: b.ratePerQuintal || '', qty: b.actualQuantity || b.approxQuantityQuintals || '',
    lane: b.laneAssigned || '', amount: b.netPayable || '', buyer: typeof b.buyerName === 'string' ? b.buyerName : '',
  };
  const farmer = (t, body, route) => notifyUser(b.farmerId, makeItem(t, body, p, route || routes.farmerToken(b.tokenId)));
  const officers = (duties, t, body, stage) => notifyCentreOfficers(b.centreId, duties, makeItem(t, body, p, routes.officerStage(stage)));

  switch (patch.status) {
    case STATUS.IN_GATE:
      await farmer('nt_gate_t', b.laneAssigned ? 'nt_gate_lane_b' : 'nt_gate_b');
      await officers(['assay'], 'nt_off_arrived_t', 'nt_off_arrived_b', 'assay');
      break;
    case STATUS.ASSAY:
      await farmer('nt_assay_t', 'nt_assay_b');
      break;
    case STATUS.REJECTED:
      await farmer('nt_rejected_t', 'nt_rejected_b');
      break;
    case STATUS.PRICE_FIXED:
      await farmer('nt_price_t', 'nt_price_b');
      await officers(['weighbridge'], 'nt_off_priceFixed_t', 'nt_off_priceFixed_b', 'weighing');
      break;
    case STATUS.PAYMENT_PENDING:
      await farmer('nt_weighed_t', 'nt_weighed_b');
      await officers(['accounts'], 'nt_off_weighed_t', 'nt_off_weighed_b', 'payment');
      break;
    case STATUS.PAID:
      await farmer('nt_paid_t', 'nt_paid_b', routes.farmerPayments());
      break;
    case STATUS.NO_SHOW:
      await farmer('nt_noShow_t', 'nt_noShow_b', routes.farmerHome());
      break;
    case STATUS.MISSED:
      await farmer('nt_missed_t', 'nt_missed_b', routes.farmerHome());
      break;
    default:
      break;
  }
}

/* "It is your turn" for the farmer whose token is next after a vehicle went in. */
export async function markGateEntry(
  tokenId,
  vehicleNumber = '',
  verifiedBy = 'manual', // 'qr' | 'code' | 'manual'
  vehicles = null        // install43: [{ serial: 1, plate: 'HR26AB1234' }, ...]
) {
  const booking = await assertOfficerFor(tokenId, DUTY_FOR_STAGE.gate);

  // install42: a pass is valid for its hour only. Too early -> wait;
  // hour over -> the pass is expired and the farmer must be REBOOKED
  // (rebookAtGate) into the next hour with room. No queue-jumping.
  if (booking.status === STATUS.BOOKED && !TESTING_MODE) {
    // install53: a transfer pass is valid for its window, not for an hour
    const ts = transferState(booking);
    if (ts === 'expired') throw tErr('err.transferExpired');
    if (ts !== 'valid') {
      const st = slotState(booking);
      if (st === 'before') throw tErr('err.slotNotOpen');
      if (st === 'passed') throw tErr('err.slotPassed');
    }
  }

  /*
   * install43: one token, N vehicles. Every plate must be a real Indian
   * registration, no duplicates on this token, and no plate that is
   * already inside the mandi today under another token.
   */
  let list = Array.isArray(vehicles) && vehicles.length
    ? vehicles
    : [{ serial: 1, plate: vehicleNumber }];
  list = list.map((v, i) => ({ serial: i + 1, plate: normalizePlate(v.plate ?? v) }));
  if (list.some((v) => !v.plate)) throw tErr('err.badPlate');
  const plates = list.map((v) => v.plate);
  if (new Set(plates).size !== plates.length) throw tErr('err.dupPlate');

  const insideSnap = await getDocs(
    query(collection(db, 'bookings'), where('centreId', '==', booking.centreId), where('status', 'in', INSIDE_STATUSES))
  );
  const insidePlates = new Set();
  insideSnap.docs.forEach((d) => {
    const b = d.data();
    if (b.tokenId === tokenId) return;
    (b.vehicles || []).forEach((v) => insidePlates.add(v.plate));
    if (b.vehicleNumber) insidePlates.add(normalizePlate(b.vehicleNumber) || b.vehicleNumber);
  });
  const clash = plates.find((p) => insidePlates.has(p));
  if (clash) throw tErr('err.plateInside', { plate: clash });

  const patch = {
    status: STATUS.IN_GATE,
    gateEntryAt: new Date().toISOString(),
    actualAppearedTime: clockTime(),
    gatePassVerifiedBy: verifiedBy,
    vehicleNumber: plates[0],
    vehicles: list.map((v) => ({ ...v, grossWeightQuintals: null, tareWeightQuintals: null, netQuintals: null })),
    vehicleCount: list.length,
  };

  const result = await advanceStage(tokenId, patch, { entering: true });
  // A vehicle just went in -> phone the next farmer in the queue.
  notifyNextFarmer(result.centreId, result.date);
  return result;
}


/**
 * install42: expire passes whose arrival hour has ended without entry.
 * Called by the gate screen and by the farmer app on load - no server
 * needed. Each expiry releases the hour's room for walk-ins / rebooking.
 * Never runs in TESTING_MODE (old test tokens would all expire).
 */
export async function expireMissedPasses(rows) {
  if (TESTING_MODE) return 0;
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r.status === STATUS.BOOKED && slotState(r) === 'passed');
  let n = 0;
  for (const r of list) {
    try {
      await advanceStage(r.tokenId, { status: STATUS.MISSED, missedAt: new Date().toISOString() });
      n += 1;
    } catch (e) { /* another device may have done it */ }
  }
  return n;
}

/**
 * install42: BOOK AT GATE. One path for both the walk-in and the farmer
 * whose hour has passed: find the earliest hour TODAY (from now) with
 * room for his load and issue a fresh pass. Nobody already booked is
 * moved. Returns { booking } or { booking: null, reason: 'noRoomToday' }.
 *
 * If `previousTokenId` is given (late farmer), that pass is closed as
 * missed first so its room is freed - which may be exactly the room
 * he now gets.
 */
export async function rebookAtGate({ centreId, farmerId, farmerName, farmerPhone, crop, cropName, quintals, previousTokenId = null }) {
  await requireOfficerDuty(centreId, DUTY_FOR_STAGE.gate);
  const centre = await fetchCentreById(centreId);
  if (!centre) throw tErr('err.mandiNotFound');

  if (previousTokenId) {
    try {
      const prev = await getDoc(doc(db, 'bookings', previousTokenId));
      if (prev.exists() && prev.data().status === STATUS.BOOKED) {
        await advanceStage(previousTokenId, { status: STATUS.MISSED, missedAt: new Date().toISOString(), rebookedAtGate: true });
      }
    } catch (e) { /* continue - a fresh pass is still the goal */ }
  }

  const date = todayString();
  const slots = windowList(centre);
  const now = new Date();
  const nowH = now.getHours();
  const q = Math.max(1, Number(quintals) || 1);
  const qSnap = await getDoc(queueRef(centreId, date));
  const queue = qSnap.exists() ? qSnap.data() : {};
  const yp = await yardPlan(centre, crop, centreId);

  // install53: is there SPARE right now (no-shows, fast day)? Then the
  // current hour gets a "Now" pass even if its planned minutes are sold.
  let nowPass = false;
  try {
    const sp = await fetchSpareNow(centreId, crop, now);
    const need = loadMinutesFor(q, sp.throughput || 400);
    nowPass = canAdmitNow(sp.day, need, Math.max(0, sp.gateWaiting - 1));
  } catch (e) { nowPass = false; }

  // Current hour first (gate is idle right now?), then later hours.
  let startIdx = slots.findIndex((t) => Number(t.split(':')[0]) >= nowH);
  if (startIdx < 0) return { booking: null, reason: 'noRoomToday' };
  const curIdx = slots.findIndex((t) => Number(t.split(':')[0]) === nowH);

  for (let i = startIdx; i < slots.length; i++) {
    const useSpare = nowPass && i === curIdx;
    const base = capacityWithYard(centre, crop, slots[i], yp, date);
    // spare pass: planner may use the whole hour incl. buffer, expected minutes only
    const cap = useSpare ? { ...base, bookableMinutes: base.fullMinutes, reserveMinutes: 0 } : base;
    const eng = await engineInputs({ centre, farmerId: farmerId || farmerPhone, crop, quintals: q, date, slotTime: slots[i], bookedVia: 'gate' });
    const plan = planLoad(cap, slots, queue, i, q, eng.opts);
    if (!plan.ok) continue;
    try {
      const booking = await createBooking({
        farmerId: farmerId || farmerPhone, farmerName, farmerPhone, centreId, crop, cropName,
        approxQuantityQuintals: q, date, slotTime: slots[i], slotWindow: windowLabelFor(slots[i], plan.needed), bookedVia: 'gate',
        extra: { walkIn: !previousTokenId, spareUsed: useSpare },
      });
      if (previousTokenId) updateDoc(doc(db, 'bookings', booking.tokenId), { rebookedFrom: previousTokenId }).catch(() => {});
      return { booking, reason: null, now: useSpare };
    } catch (e) {
      if (String(e?.message || '').includes('maxTokens')) throw e;
      // room went in the meantime - try the next hour
    }
  }
  return { booking: null, reason: 'noRoomToday' };
}

/** Backward-compatible alias for the old screen code. */
export const markAppeared = markGateEntry;

/**
 * Assay officer: record quality check.
 */
export async function recordAssay(
  tokenId,
  { moisturePercent, foreignMatterPercent, grade, notes = '', rejected = false }
) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.assay);
  const patch = {
    status: rejected ? STATUS.REJECTED : STATUS.ASSAY,
    assayAt: new Date().toISOString(),
    moisturePercent: parseFloat(moisturePercent) || 0,
    foreignMatterPercent: parseFloat(foreignMatterPercent) || 0,
    grade: grade || 'FAQ',
    assayNotes: notes || '',
  };

  return advanceStage(tokenId, patch);
}

/**
 * Fix the sale price per quintal. Happens AFTER assay and BEFORE
 * weighing (the e-NAM order): the weigh-man only weighs produce
 * whose buyer and rate are already settled.
 *
 * mode = 'msp'      -> government agency buys at MSP
 * mode = 'auction'  -> winning trader bid (wired in the trader build)
 */
export async function fixPrice(
  tokenId,
  { mode = 'msp', ratePerQuintal, buyerId = null, buyerName = null, pricing = null }
) {
  const rate = parseFloat(ratePerQuintal) || 0;
  if (rate <= 0) throw tErr('err.badRate');

  const bookingRef = doc(db, 'bookings', tokenId);
  const snap = await getDoc(bookingRef);
  if (!snap.exists()) throw tErr('err.tokenNotFound');

  const booking = snap.data();
  if (booking.status !== STATUS.ASSAY) {
    throw tErr('err.priceAfterAssay');
  }

  const patch = {
    status: STATUS.PRICE_FIXED,
    priceMode: mode,
    ratePerQuintal: rate,
    priceFixedAt: new Date().toISOString(),
    buyerId: buyerId || null,
    buyerName:
      buyerName || (mode === 'msp' ? 'सरकारी खरीद एजेंसी (MSP)' : null),
    // install43: why this rate (advertised MSP, grade deduction, reasons)
    pricing: pricing || null,
  };

  return advanceStage(tokenId, patch);
}

/**
 * Weighbridge officer: record gross and tare, derive net.
 * Refuses until the price has been fixed.
 */
export async function recordWeighing(
  tokenId,
  { grossWeightQuintals, tareWeightQuintals, vehicles = null }
) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.weighing);

  const preSnap = await getDoc(doc(db, 'bookings', tokenId));
  if (preSnap.exists() && preSnap.data().status !== STATUS.PRICE_FIXED) {
    throw tErr('err.weighBeforePrice');
  }
  const pre = preSnap.exists() ? preSnap.data() : {};

  /*
   * install43: a weighbridge takes ONE vehicle at a time, so each
   * vehicle gets its own gross/tare; the token total is the sum.
   * Old single-vehicle call still works (vehicles = null).
   */
  let weighed;
  if (Array.isArray(vehicles) && vehicles.length) {
    weighed = vehicles.map((v, i) => {
      const g = parseFloat(v.grossWeightQuintals) || 0;
      const t = parseFloat(v.tareWeightQuintals) || 0;
      const n = Math.round((g - t) * 100) / 100;
      if (n <= 0) throw tErr('wg_netZero');
      return { serial: v.serial || i + 1, plate: v.plate || '', grossWeightQuintals: g, tareWeightQuintals: t, netQuintals: n };
    });
  } else {
    const g = parseFloat(grossWeightQuintals) || 0;
    const t = parseFloat(tareWeightQuintals) || 0;
    const n = Math.round((g - t) * 100) / 100;
    if (n <= 0) throw tErr('wg_netZero');
    weighed = [{ serial: 1, plate: pre.vehicleNumber || '', grossWeightQuintals: g, tareWeightQuintals: t, netQuintals: n }];
  }
  const gross = Math.round(weighed.reduce((s, v) => s + v.grossWeightQuintals, 0) * 100) / 100;
  const tare = Math.round(weighed.reduce((s, v) => s + v.tareWeightQuintals, 0) * 100) / 100;
  const net = Math.round(weighed.reduce((s, v) => s + v.netQuintals, 0) * 100) / 100;

  // install41: declared vs actual. Never a penalty - a quiet note the
  // admin report uses to tune throughput/buffer, and the app uses to
  // suggest a better number to the farmer next time.
  const declared = Number(pre.declaredQuintals || pre.approxQuantityQuintals) || 0;
  const variance = declared > 0 ? Math.round(((net - declared) / declared) * 1000) / 10 : null;
  let tolerance = CAPACITY_DEFAULTS.declaredTolerancePercent;
  try {
    const c = pre.centreId ? await fetchCentreById(pre.centreId) : null;
    tolerance = centreCapacity(c || {}).declaredTolerancePercent;
  } catch (e) { /* keep default */ }

  const patch = {
    status: STATUS.PAYMENT_PENDING,
    weighedAt: new Date().toISOString(),
    grossWeightQuintals: gross,
    tareWeightQuintals: tare,
    actualQuantity: net,
    vehicles: weighed,
    vehicleCount: weighed.length,
    quantityVariancePercent: variance,
    overDeclaredTolerance: variance != null && variance > tolerance,
    // install44: how good was the engine's guess? (Model A accuracy trail)
    engineExpectedQuintals: pre.engine?.reservedQuintals ?? null,
    engineErrorPercent: pre.engine?.reservedQuintals && net > 0
      ? Math.round(((pre.engine.reservedQuintals - net) / net) * 1000) / 10
      : null,
  };

  const result = await advanceStage(tokenId, patch);
  // install52: every weighed quintal now lies on the FLOOR until lifted
  if (pre.centreId && net > 0) {
    try {
      await updateDoc(doc(db, 'centres', pre.centreId), { 'yard.floorUsedQ': increment(net) });
      const c = await fetchCentreById(pre.centreId);
      await syncYardIncident(pre.centreId, c?.yard);
    } catch (e) { /* non-fatal */ }
  }
  // install49: polite note (never a penalty) when actual differs a lot from declared
  if (variance != null && Math.abs(variance) > tolerance) {
    notifyUser(pre.farmerId, makeItem(variance > 0 ? 'nt_overDeclared_t' : 'nt_underDeclared_t', variance > 0 ? 'nt_overDeclared_b' : 'nt_underDeclared_b',
      { d: declared, a: net, p: Math.abs(Math.round(variance)) }, routes.farmerToken(tokenId)));
  }
  return result;
}

/**
 * Cashier: compute deductions, generate receipt, close the token.
 */
/*
 * paymentBasis: 'msp' | 'ebid' | 'offline'
 *   msp     - government agency at MSP
 *   ebid    - winning bid placed inside the app
 *   offline - bid held physically by the arhtiya; the munim's hand
 *             written PARCHI is the farmer's only proof of the rate,
 *             so the cashier MUST attach a photo of it (parchi.imageBase64).
 */
export async function markPaid(
  tokenId,
  { actualQuantity, ratePerQuintal, grade, paymentBasis, parchi, cashierName }
) {
  if (!tokenId) throw new Error('Token ID is required');
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.payment);

  const bookingRef = doc(db, 'bookings', tokenId);
  const snapshot = await getDoc(bookingRef);

  if (!snapshot.exists()) {
    throw tErr('err.tokenNotFound');
  }

  const booking = snapshot.data();
  const centre = await fetchCentreById(booking.centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  const quantity =
    parseFloat(actualQuantity) || parseFloat(booking.actualQuantity) || 0;

  // The rate was fixed before weighing; the cashier cannot change it.
  const rate =
    parseFloat(booking.ratePerQuintal) || parseFloat(ratePerQuintal) || 0;

  if (quantity <= 0) throw tErr('mp_badQty');
  if (rate <= 0) throw tErr('err.badRate');

  // Default the basis from what the app already knows.
  const basis =
    paymentBasis ||
    (booking.priceMode === 'auction' ? 'ebid' : 'msp');

  let parchiRecord = null;
  if (basis === 'offline') {
    if (!parchi?.imageBase64) throw tErr('pc_needPhoto');
    const parchiRate = parseFloat(parchi.rate) || 0;
    if (parchiRate <= 0) throw tErr('pc_needRate');
    parchiRecord = {
      imageBase64: parchi.imageBase64, // data URI, ~150 KB (compressed on device)
      rate: parchiRate,
      note: parchi.note || '',
      matchesFixedRate: Math.abs(parchiRate - rate) < 0.5,
      capturedAt: new Date().toISOString(),
      capturedBy: cashierName || null,
    };
  }

  const gross = quantity * rate;
  const mandiFee = gross * ((Number(centre.mandiFeePercent) || 0) / 100);
  const commission = gross * ((Number(centre.commissionPercent) || 0) / 100);
  const hamali = quantity * (Number(centre.hamaliPerQuintal) || 0);
  const netPayable = gross - mandiFee - commission - hamali;

  const round = (n) => Math.round(n * 100) / 100;

  const patch = {
    status: STATUS.PAID,
    paidAt: new Date().toISOString(),

    actualQuantity: quantity,
    ratePerQuintal: rate,
    grade: grade || booking.grade || 'FAQ',

    grossAmount: round(gross),
    mandiFee: round(mandiFee),
    commission: round(commission),
    hamali: round(hamali),
    netPayable: round(netPayable),

    receiptId: `RCP-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`,

    paymentReference: `SIM${Date.now().toString().slice(-10)}`,
    receiptGeneratedAt: new Date().toISOString(),

    paymentBasis: basis,
    cashierName: cashierName || null,
    parchi: parchiRecord,
  };

  return advanceStage(tokenId, patch);
}

/**
 * Officer: farmer never turned up.
 */
export async function markNoShow(tokenId) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.gate);
  return advanceStage(tokenId, {
    status: STATUS.NO_SHOW,
    noShowAt: new Date().toISOString(),
  });
}

/**
 * Farmer: cancel own booking (frees the slot back up).
 */
export async function cancelBooking(tokenId) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);

  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);

    if (!bSnap.exists()) throw tErr('err.tokenNotFound');

    const booking = bSnap.data();

    if (booking.status !== STATUS.BOOKED) {
      throw tErr('err.cannotCancel');
    }
    // install49: cancellation window closes 48 h before the arrival hour.
    // Inside that window the pass simply runs out -> MISSED (no-show).
    if (!canCancel(booking)) {
      throw tErr('err.cancelWindow', { h: CANCEL_HOURS });
    }

    const qRef = queueRef(booking.centreId, booking.date);
    const qSnap = await tx.get(qRef);

    tx.update(bookingRef, {
      status: STATUS.CANCELLED,
      cancelledAt: new Date().toISOString(),
    });

    if (qSnap.exists()) {
      const data = qSnap.data();
      const position = Number(booking.positionAssigned) || 0;

      tx.update(qRef, {
        ...releaseLoad(data, booking),
        openPositions: (Array.isArray(data.openPositions)
          ? data.openPositions
          : []
        ).filter((p) => p !== position),
        updatedAt: serverTimestamp(),
      });
    }

    return true;
  });
}

/* ===============================================================
 * QUERIES
 * =============================================================== */

export async function fetchMyBookings(farmerId) {
  if (!farmerId) return [];

  try {
    const snapshot = await getDocs(
      query(collection(db, 'bookings'), where('farmerId', '==', farmerId))
    );

    return snapshot.docs
      .map((item) => item.data())
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
  } catch (error) {
    console.error('Error fetching farmer bookings:', error);
    return [];
  }
}

/**
 * install33: EVERY active booking of a farmer (wheat today + mustard tomorrow,
 * or two trolleys). Sorted by nearest slot first.
 */
export async function fetchActiveFarmerBookings(farmerId) {
  if (!farmerId) return [];
  try {
    const snapshot = await getDocs(
      query(collection(db, 'bookings'), where('farmerId', '==', farmerId), where('status', 'in', ACTIVE_STATUSES))
    );
    const list = snapshot.docs.map((item) => item.data());
    // install42: a pass whose hour ended without entry is expired here too
    // (farmer opened the app late) so the room is freed even if no officer
    // has the gate screen open.
    const stale = TESTING_MODE ? [] : list.filter((b) => b.status === STATUS.BOOKED && slotState(b) === 'passed');
    if (stale.length) {
      await expireMissedPasses(stale);
      stale.forEach((b) => { b.status = STATUS.MISSED; });
    }
    return list
      .filter((b) => ACTIVE_STATUSES.includes(b.status))
      .sort((a, b) => `${a.date} ${a.slotTime}`.localeCompare(`${b.date} ${b.slotTime}`));
  } catch (error) {
    console.error('Error fetching active bookings:', error);
    return [];
  }
}

export async function fetchActiveFarmerBooking(farmerId) {
  if (!farmerId) return null;

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'bookings'),
        where('farmerId', '==', farmerId),
        where('status', 'in', ACTIVE_STATUSES)
      )
    );

    if (snapshot.empty) return null;

    return snapshot.docs
      .map((item) => item.data())
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )[0];
  } catch (error) {
    console.error('Error fetching active booking:', error);
    return null;
  }
}

export async function fetchTokenDetail(tokenId) {
  if (!tokenId) return null;

  try {
    const snapshot = await getDoc(doc(db, 'bookings', tokenId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

/**
 * TESTING_MODE: officers see tokens of every date (so a token booked for
 * tomorrow, or one that crossed midnight, can still be processed). An explicit
 * dateStr (reports) always wins. Production: today's tokens only.
 */
function officerQueueQuery(centreId, date, explicitDate) {
  if (TESTING_MODE && !explicitDate) {
    return query(collection(db, 'bookings'), where('centreId', '==', centreId));
  }
  return query(
    collection(db, 'bookings'),
    where('centreId', '==', centreId),
    where('date', '==', date)
  );
}

function sortQueueRows(rows, today) {
  return rows.sort((a, b) => {
    if (TESTING_MODE) {
      // today's first, then upcoming dates, then past; within a date by position
      const rank = (d) => (d === today ? 0 : d > today ? 1 : 2);
      const r = rank(a.date) - rank(b.date);
      if (r) return r;
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
    }
    // install42: group by arrival hour, then booking order inside the hour.
    const t = String(a.slotTime || '').localeCompare(String(b.slotTime || ''));
    if (t) return t;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

export async function fetchTodaysQueue(centreId, dateStr = null) {
  if (!centreId) return [];

  try {
    const date = dateStr || todayString();

    const snapshot = await getDocs(officerQueueQuery(centreId, date, dateStr));

    return sortQueueRows(snapshot.docs.map((item) => item.data()), date);
  } catch (error) {
    console.error('Error fetching queue:', error);
    return [];
  }
}

/**
 * Officer queue with live updates.
 */
export function subscribeToTodaysQueue(centreId, dateStr, callback) {
  if (!centreId) return () => {};

  const date = dateStr || todayString();

  return onSnapshot(
    officerQueueQuery(centreId, date, dateStr),
    (snap) => {
      callback(sortQueueRows(snap.docs.map((item) => item.data()), date));
    },
    (error) => {
      console.error('Officer queue subscription error:', error);
      callback([]);
    }
  );
}

export async function reportCentreDelay(centreId, delayMinutes, reason) {
  if (!centreId) throw new Error('Centre ID is required');
  await requireOfficerDuty(centreId, DUTY_FOR_STAGE.delay); // admin only

  await setDoc(
    doc(db, 'delays', centreId),
    {
      centreId,
      minutes: parseInt(delayMinutes, 10) || 0,
      reason: reason || 'Operational Delay',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // install51: a reported delay marks TODAY as an incident day - Model B
  // will not learn capacity from it (a breakdown is not the yard's speed).
  if ((parseInt(delayMinutes, 10) || 0) > 0) {
    try { await updateDoc(doc(db, 'centres', centreId), { engineExcludeDates: arrayUnion(todayString()) }); } catch (e) { /* non-fatal */ }
  }

  // install52: "yard full / lifting stopped" is a yard incident, not a delay
  if (String(reason || '').toLowerCase().startsWith('yard')) {
    await declareYardIncident(centreId, true, 'floor');
    return true;
  }

  // install28: everyone waiting today hears about it.
  const item = makeItem('nt_delay_t', 'nt_delay_b', { minutes: parseInt(delayMinutes, 10) || 0, reason: reason || '' }, routes.farmerHome());
  notifyFarmersAtCentre(centreId, todayString(), item);
  notifyCentreOfficers(centreId, ['*'], { ...item, route: routes.officerQueue() });

  return true;
}

export async function fetchOfficerSummary(centreId, dateStr = null) {
  const empty = {
    total: 0,
    pending: 0,
    inside: 0,
    appeared: 0,
    paid: 0,
    noShows: 0,
    totalProcuredQuintals: 0,
    totalDisbursedRs: 0,
    nowServingToken: null,
    centreDelay: { minutes: 0, reason: '' },
  };

  if (!centreId) return empty;

  try {
    const date = dateStr || todayString();
    const bookings = await fetchTodaysQueue(centreId, date);
    const qSnap = await getDoc(queueRef(centreId, date));

    const paid = bookings.filter((b) => b.status === STATUS.PAID);

    const inside = bookings.filter((b) =>
      INSIDE_STATUSES.includes(b.status)
    ).length;

    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === STATUS.BOOKED).length,
      inside,
      appeared: inside + paid.length,
      paid: paid.length,
      noShows: bookings.filter((b) => b.status === STATUS.NO_SHOW).length,

      totalProcuredQuintals:
        Math.round(
          paid.reduce((s, b) => s + (b.actualQuantity || 0), 0) * 10
        ) / 10,

      totalDisbursedRs: Math.round(
        paid.reduce((s, b) => s + (b.netPayable || 0), 0)
      ),

      nowServingToken: qSnap.exists()
        ? qSnap.data().nowServingToken || null
        : null,

      centreDelay: { minutes: 0, reason: '' },
    };
  } catch (error) {
    console.error('Error fetching officer summary:', error);
    return empty;
  }
}

/* ===============================================================
 * MISSED HOUR  (install49)
 * ---------------------------------------------------------------
 *  farmer:  markLateChoice(tokenId, 'late' | 'notComing')
 *           'late'      -> the gate officer sees him in the RE-BOOK box
 *           'notComing' -> pass closed as no-show, room stays released
 *  gate:    fetchRebookRequests(centreId)  -> tokens with lateChoice 'late'
 *           rebookLate(tokenId)            -> today first; if nothing today,
 *                                             returns { needsNextDay, nextDate }
 *           rebookLate(tokenId, { date })  -> book that day (farmer said yes)
 * =============================================================== */
export async function markLateChoice(tokenId, choice) {
  if (!tokenId) throw new Error('Token ID is required');
  const ref = doc(db, 'bookings', tokenId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw tErr('err.tokenNotFound');
  const b = snap.data();
  if (![STATUS.BOOKED, STATUS.MISSED].includes(b.status)) throw tErr('err.cannotCancel');

  if (choice === 'notComing') {
    // install52: on a yard-incident day "not coming" is NOT a no-show
    const c = await fetchCentreById(b.centreId).catch(() => null);
    if (c?.yard?.incident?.active && (c.yard.incident.dates || []).includes(b.date)) {
      if (b.status === STATUS.BOOKED) {
        await advanceStage(tokenId, { status: STATUS.MISSED, missedAt: new Date().toISOString() });
      }
      await updateDoc(ref, { status: STATUS.CANCELLED, cancelledAt: new Date().toISOString(), cancelReason: 'yardIncident', yardIncidentCancel: true, lateChoice: 'notComing' });
      return 'notComing';
    }
    // close it and release the room (if not already released by expiry)
    if (b.status === STATUS.BOOKED) {
      await advanceStage(tokenId, { status: STATUS.NO_SHOW, noShowAt: new Date().toISOString(), lateChoice: 'notComing' });
    } else {
      await updateDoc(ref, { status: STATUS.NO_SHOW, noShowAt: new Date().toISOString(), lateChoice: 'notComing' });
    }
    return 'notComing';
  }
  // 'late': expire the pass if still booked (frees room), flag for the gate
  if (b.status === STATUS.BOOKED) {
    await advanceStage(tokenId, { status: STATUS.MISSED, missedAt: new Date().toISOString(), lateChoice: 'late', lateRequestedAt: new Date().toISOString() });
  } else {
    await updateDoc(ref, { lateChoice: 'late', lateRequestedAt: new Date().toISOString() });
  }
  notifyCentreOfficers(b.centreId, ['gate'], makeItem('nt_off_lateReq_t', 'nt_off_lateReq_b', { name: b.farmerName || b.farmerPhone, q: b.approxQuantityQuintals, crop: b.crop }, routes.officerStage('gate')));
  return 'late';
}

/** Gate: farmers who said "I am late, please re-book me" and are not yet re-booked. */
export async function fetchRebookRequests(centreId) {
  if (!centreId) return [];
  const snap = await getDocs(query(collection(db, 'bookings'), where('centreId', '==', centreId), where('lateChoice', '==', 'late')));
  return snap.docs.map((d) => d.data()).filter((b) => b.status === STATUS.MISSED && !b.rebookedTo)
    .sort((a, b) => String(a.lateRequestedAt || '').localeCompare(String(b.lateRequestedAt || '')));
}

/** First date (today .. +7) that has room for this load; null if none. */
export async function findNextDateWithRoom(centreId, crop, quintals, fromOffset = 1) {
  const centre = await fetchCentreById(centreId);
  if (!centre) return null;
  const slots = windowList(centre);
  const yp = await yardPlan(centre, crop, centreId);
  for (let off = fromOffset; off <= 7; off += 1) {
    const d = new Date(); d.setDate(d.getDate() + off);
    const date = todayString(d);
    const qSnap = await getDoc(queueRef(centreId, date));
    const queue = qSnap.exists() ? qSnap.data() : {};
    for (let i = 0; i < slots.length; i += 1) {
      const cap = capacityWithYard(centre, crop, slots[i], yp, date);
      const plan = planLoad(cap, slots, queue, i, quintals, { cropClass: cropClassOf(crop), leadDays: off });
      if (plan.ok) return { date, slotTime: slots[i] };
    }
  }
  return null;
}

/**
 * Gate: re-book a late farmer. Whole day is considered (current hour
 * onward). Nothing today -> { booking: null, needsNextDay: true, next }.
 * Pass { date } to book a specific later day after the farmer agrees.
 */
export async function rebookLate(tokenId, { date = null } = {}) {
  const ref = doc(db, 'bookings', tokenId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw tErr('err.tokenNotFound');
  const prev = snap.data();
  await requireOfficerDuty(prev.centreId, DUTY_FOR_STAGE.gate);
  const q = Number(prev.declaredQuintals || prev.approxQuantityQuintals) || 1;
  const centre = await fetchCentreById(prev.centreId);
  const slots = windowList(centre);
  const yp = await yardPlan(centre, prev.crop, prev.centreId);

  const tryDay = async (day, fromHour) => {
    const qSnap = await getDoc(queueRef(prev.centreId, day));
    const queue = qSnap.exists() ? qSnap.data() : {};
    let start = slots.findIndex((t) => Number(t.split(':')[0]) >= fromHour);
    if (start < 0) return null;
    for (let i = start; i < slots.length; i += 1) {
      const cap = capacityWithYard(centre, prev.crop, slots[i], yp, day);
      const eng = await engineInputs({ centre, farmerId: prev.farmerId, crop: prev.crop, quintals: q, date: day, slotTime: slots[i], bookedVia: 'gate' });
      const plan = planLoad(cap, slots, queue, i, q, eng.opts);
      if (!plan.ok) continue;
      try {
        const booking = await createBooking({
          farmerId: prev.farmerId, farmerName: prev.farmerName, farmerPhone: prev.farmerPhone, centreId: prev.centreId,
          crop: prev.crop, cropName: prev.cropName, approxQuantityQuintals: q, date: day, slotTime: slots[i],
          slotWindow: windowLabelFor(slots[i], plan.needed), bookedVia: 'gate',
        });
        await updateDoc(ref, { rebookedTo: booking.tokenId, rebookedAtGate: true });
        updateDoc(doc(db, 'bookings', booking.tokenId), { rebookedFrom: tokenId }).catch(() => {});
        return booking;
      } catch (e) {
        if (String(e?.message || '').includes('maxTokens')) throw e;
      }
    }
    return null;
  };

  if (date) {
    const booking = await tryDay(date, 0);
    return booking ? { booking, needsNextDay: false, next: null } : { booking: null, needsNextDay: true, next: await findNextDateWithRoom(prev.centreId, prev.crop, q, 1) };
  }
  const today = todayString();
  const booking = await tryDay(today, new Date().getHours());
  if (booking) return { booking, needsNextDay: false, next: null };
  return { booking: null, needsNextDay: true, next: await findNextDateWithRoom(prev.centreId, prev.crop, q, 1) };
}

/* ===============================================================
 * ADMIN: ENGINE CONTROL + INSIGHTS  (install44)
 * =============================================================== */

/** Save engine switches / learned throughput on the centre document. */
export async function saveEngineSettings(centreId, patch) {
  await requireOfficerDuty(centreId, ['admin']);
  const cur = (await fetchCentreById(centreId))?.engine || {};
  await updateDoc(doc(db, 'centres', centreId), { engine: { ...cur, ...patch, updatedAt: new Date().toISOString() } });
  return { ...cur, ...patch };
}

/** Admin: forget everything this mandi learned (switches, learned throughput, local retrain). */
export async function resetEngineLearning(centreId) {
  await requireOfficerDuty(centreId, ['admin']);
  await updateDoc(doc(db, 'centres', centreId), { engine: deleteField() });
  return true;
}

/** Admin: share of every hour held for perishables (0-50 %). */
export async function setPerishableReserve(centreId, percent) {
  await requireOfficerDuty(centreId, ['admin']);
  const p = Math.max(0, Math.min(50, Math.round(Number(percent) || 0)));
  await updateDoc(doc(db, 'centres', centreId), { perishableReservePercent: p });
  return p;
}

/** Admin: change today's advertised throughput for a crop (q/h). */
export async function setTodayThroughput(centreId, crop, value) {
  await requireOfficerDuty(centreId, ['admin']);
  const centre = await fetchCentreById(centreId);
  const table = { ...(centre?.throughputPerHour || {}) };
  const key = String(crop || 'default').toLowerCase();
  table[key] = Math.max(50, Math.round(Number(value) || 0));
  await updateDoc(doc(db, 'centres', centreId), { throughputPerHour: table });
  return table;
}

/** Admin: close / reopen one hour window for new bookings (existing passes stay valid). */
export async function setSlotClosed(centreId, dateStr, slotTime, closed) {
  await requireOfficerDuty(centreId, ['admin']);
  const ref = queueRef(centreId, dateStr);
  const snap = await getDoc(ref);
  const cur = snap.exists() ? snap.data().closedSlots || {} : {};
  const next = { ...cur };
  if (closed) next[slotTime] = true; else delete next[slotTime];
  await setDoc(ref, { closedSlots: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

/**
 * Everything the Engine screen shows: per-hour board for today, learned
 * throughput (Model B), Model A/C accuracy on this centre's own data,
 * and the shipped model card.
 */
export async function fetchEngineInsights(centreId, dateStr = null, crop = '') {
  const date = dateStr || todayString();
  const centre = await fetchCentreById(centreId);
  if (!centre) throw tErr('err.mandiNotFound');
  const st = engineSettings(centre);
  const slots = windowList(centre);
  const qSnap = await getDoc(queueRef(centreId, date));
  const queue = qSnap.exists() ? qSnap.data() : {};
  const todays = await fetchTodaysQueue(centreId, date);
  const weighings = await fetchWeighings(centreId, 30);
  const learned = learnThroughput(weighings, { excludeDays: centre.engineExcludeDates || [] });
  const yp = await yardPlan(centre, crop, centreId);

  const hours = slots.map((slotTime) => {
    const cap = capacityWithYard(centre, crop, slotTime, yp, date);
    const rows = todays.filter((b) => b.slotTime === slotTime);
    const nominal = Number(queue.slotLoadMinutes?.[slotTime]) || 0;
    const expected = queue.slotExpectedMinutes?.[slotTime] != null ? Number(queue.slotExpectedMinutes[slotTime]) : nominal;
    return {
      slotTime,
      label: windowLabelFor(slotTime, 1),
      closed: Boolean(queue.closedSlots?.[slotTime]),
      throughput: cap.throughput,
      throughputSource: cap.throughputSource,
      bookableMinutes: cap.bookableMinutes,
      nominalMinutes: round1(nominal),
      expectedMinutes: round1(expected),
      usedPercent: Math.round((nominal / 60) * 100),
      expectedPercent: Math.round((expected / 60) * 100),
      declaredQuintals: round1(Number(queue.slotQuintals?.[slotTime]) || 0),
      reservedQuintals: round1(Number(queue.slotReservedQuintals?.[slotTime]) || Number(queue.slotQuintals?.[slotTime]) || 0),
      actualQuintals: round1(Number(queue.slotActualQuintals?.[slotTime]) || 0),
      vehicles: Number(queue.slotCounts?.[slotTime]) || 0,
      bookings: rows.length,
      inside: rows.filter((b) => INSIDE_STATUSES.includes(b.status)).length,
      paid: rows.filter((b) => b.status === STATUS.PAID).length,
      missed: rows.filter((b) => b.status === STATUS.MISSED || b.status === STATUS.NO_SHOW).length,
      rebooked: rows.filter((b) => b.bookedVia === 'gate').length,
    };
  });

  // Model A accuracy on this centre: engine guess vs weighbridge
  const graded = weighings.filter((b) => b.engineExpectedQuintals && b.actualQuantity);
  const declaredErr = weighings.length
    ? weighings.reduce((s, b) => s + Math.abs((Number(b.declaredQuintals || b.approxQuantityQuintals) || 0) - b.actualQuantity) / b.actualQuantity, 0) / weighings.length
    : null;
  const engineErr = graded.length
    ? graded.reduce((s, b) => s + Math.abs(b.engineExpectedQuintals - b.actualQuantity) / b.actualQuantity, 0) / graded.length
    : null;

  // Model C: predicted show rate vs real, on closed bookings with an engine record
  const closed = todays.concat([]).filter((b) => b.engine?.pShow != null && (CLOSED_STATUSES.includes(b.status) || b.status === STATUS.PAID || INSIDE_STATUSES.includes(b.status)));
  const predictedShow = closed.length ? closed.reduce((s, b) => s + b.engine.pShow, 0) / closed.length : null;
  const actualShow = closed.length ? closed.filter((b) => !(b.status === STATUS.MISSED || b.status === STATUS.NO_SHOW)).length / closed.length : null;

  return {
    centre, date, settings: st, hours, learned,
    setThroughput: centreCapacity(centre, crop).throughput,
    perishableReservePercent: centreCapacity(centre, crop).perishableReservePercent,
    accuracy: {
      declaredErrorPercent: declaredErr != null ? Math.round(declaredErr * 1000) / 10 : null,
      engineErrorPercent: engineErr != null ? Math.round(engineErr * 1000) / 10 : null,
      gradedCount: graded.length, weighedCount: weighings.length,
      predictedShowPercent: predictedShow != null ? Math.round(predictedShow * 100) : null,
      actualShowPercent: actualShow != null ? Math.round(actualShow * 100) : null,
      closedCount: closed.length,
    },
    model: ENGINE_PARAMS,
    yard: {
      state: yp.yard, factors: yp.factors, projection: yp.projection, normalDayIntake: yp.normal,
      todayFactor: Math.round(yp.factorFor(date) * 100) / 100, incident: yp.incident, reasons: yp.reasons,
    },
    spare: await fetchSpareNow(centreId, crop).catch(() => null),
    transfer: { acceptTransfers: centre.acceptTransfers !== false, maxTransferSharePercent: Number(centre.maxTransferSharePercent) || SPARE_DEFAULTS.maxTransferSharePercent, clusterId: centre.clusterId || 'default' },
  };
}

/**
 * "Retrain from history" - runs Model A + C training IN THE BROWSER on
 * this centre's real bookings and stores the result on the centre doc
 * (centre.engine.localParams). The planner prefers localParams when
 * they exist and have enough samples. Server later: nightly job.
 */
export async function retrainFromHistory(centreId) {
  await requireOfficerDuty(centreId, ['admin']);
  const snap = await getDocs(query(collection(db, 'bookings'), where('centreId', '==', centreId)));
  const rows = snap.docs.map((d) => d.data());
  const closedRows = rows.filter((b) => (CLOSED_STATUSES.includes(b.status) || b.status === STATUS.PAID) && !b.yardIncidentCancel);

  const corr = trainCorrection(closedRows.map((b) => ({ farmerId: b.farmerId, crop: b.crop, declared: b.declaredQuintals || b.approxQuantityQuintals, actual: b.actualQuantity })));

  const perFarmer = {};
  const ns = closedRows
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((b) => {
      const f = (perFarmer[b.farmerId] = perFarmer[b.farmerId] || { n: 0, miss: 0 });
      const showed = !(b.status === STATUS.MISSED || b.status === STATUS.NO_SHOW);
      const row = {
        pastBookings: f.n, pastNoShows: f.miss,
        leadDays: leadDaysBetween(new Date(b.createdAt || 0).getTime(), b.date),
        hour: Number(String(b.slotTime || '9').split(':')[0]),
        quintals: b.declaredQuintals || b.approxQuantityQuintals, bookedVia: b.bookedVia, showed,
      };
      f.n += 1; if (!showed) f.miss += 1;
      return row;
    });
  const noshow = trainNoShow(ns);

  const centreDoc = await fetchCentreById(centreId);
  const learned = learnThroughput(rows.filter((b) => b.weighedAt && Number(b.actualQuantity) > 0), { excludeDays: centreDoc?.engineExcludeDates || [] });
  const local = { correction: corr, noshow, learnedThroughput: learned, trainedAt: new Date().toISOString(), samples: closedRows.length };
  await saveEngineSettings(centreId, { localParams: local, learnedThroughput: learned });
  return local;
}

/* ===============================================================
 * OFFICER DUTY -> WORK STAGE MAPPING
 * =============================================================== */

/**
 * Which booking statuses each officer duty is responsible for,
 * and what the action button should say.
 *
 * Duty IDs come from OFFICER_DUTIES in services/auth.js:
 *   gate | weighbridge | accounts | admin
 */
export const DUTY_STAGES = {
  gate: [
    {
      id: 'gate',
      title: 'गेट प्रवेश',
      subtitle: 'वाहन को अंदर भेजें',
      titleKey: 'stg_gate_t',
      subtitleKey: 'stg_gate_s',
      actionKey: 'stg_gate_a',
      icon: 'enter-outline',
      statuses: [STATUS.BOOKED],
      action: 'gate',
      actionLabel: 'गेट प्रवेश',
    },
  ],

  assay: [
    {
      id: 'assay',
      title: 'गुणवत्ता जांच',
      subtitle: 'नमूना, नमी, ग्रेड और अन्य पदार्थ',
      titleKey: 'stg_assay_t',
      subtitleKey: 'stg_assay_s',
      actionKey: 'stg_assay_a',
      icon: 'flask-outline',
      statuses: [STATUS.IN_GATE],
      action: 'Assay',
      actionLabel: 'जांच करें',
    },
  ],

  weighbridge: [
    {
      id: 'weighing',
      title: 'तौल',
      subtitle: 'केवल भाव तय हो चुके वाहन',
      titleKey: 'stg_weighing_t',
      subtitleKey: 'stg_weighing_s',
      actionKey: 'stg_weighing_a',
      icon: 'scale-outline',
      statuses: [STATUS.PRICE_FIXED],
      action: 'Weighing',
      actionLabel: 'तौल करें',
    },
  ],

  accounts: [
    {
      id: 'payment',
      title: 'भुगतान',
      subtitle: 'कटौती और रसीद',
      titleKey: 'stg_payment_t',
      subtitleKey: 'stg_payment_s',
      actionKey: 'stg_payment_a',
      icon: 'cash-outline',
      statuses: [STATUS.WEIGHING, STATUS.PAYMENT_PENDING],
      action: 'MarkPaid',
      actionLabel: 'भुगतान करें',
    },
  ],
};

// Admin sees every stage.
DUTY_STAGES.admin = [
  ...DUTY_STAGES.gate,
  ...DUTY_STAGES.assay,
  ...DUTY_STAGES.weighbridge,
  ...DUTY_STAGES.accounts,
];

export function getStagesForDuty(duty) {
  // Unknown / missing duty falls back to the LEAST powerful role.
  return DUTY_STAGES[duty] || DUTY_STAGES.gate;
}

/** Duty that owns a given stage id (admin owns all). */
export function dutyOwnsStage(duty, stageId) {
  if (duty === 'admin') return true;
  return (DUTY_STAGES[duty] || []).some((s) => s.id === stageId);
}

export function getStageById(stageId) {
  return DUTY_STAGES.admin.find((s) => s.id === stageId) || null;
}
