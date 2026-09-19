/*
 * engine/spare.js   (install53)   SPARE CAPACITY  -  pure functions only
 * ---------------------------------------------------------------------
 * Same rules as capacity.js / yard.js: no Firebase, no React, no Date.now().
 *
 * WHY
 *   Every safeguard in the engine (Model B buffer, floor projection,
 *   25 % share cap, incident closures) errs on the side of OFFERING LESS.
 *   That is right for promises made days ahead - but it means capacity
 *   is regularly left on the table: big no-shows, a floor projection that
 *   turned out pessimistic (trucks came overnight), a good labour day.
 *
 *   SPARE is that room, discovered ON THE DAY, minute by minute. It is
 *   never booked in advance and never promised, so a wrong forecast
 *   costs nothing. It is consumed in this order:
 *     1. farmers already waiting inside (physically there)
 *     2. walk-ins at the gate  -> pass "NOW" instead of a later hour
 *     3. cross-centre transfers from a congested / yard-full mandi
 *        (same-day, short validity window, spare only)
 *
 * ARITHMETIC (per hour, all in labour-minutes like the planner)
 *   expectedStill(hour)  = booked-but-not-arrived minutes x P(still coming)
 *                          P decays as the hour ages: at H+40 a no-arrival is
 *                          ~90 % a no-show (install49: pass expires at H+60)
 *   spare(hour)          = fullMinutes - arrivedMinutes - expectedStill
 *   A negative number is a backlog, not spare.
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const r1 = (n) => Math.round(n * 10) / 10;

export const SPARE_DEFAULTS = {
  publishMinMinutes: 20,        // a centre publishes spare only when >= this (one real load)
  maxTransferSharePercent: 30,  // at most this share of spare goes to other mandis
  transferWindowMin: 90,        // a transfer pass is valid this long after issue
  gateQueueBlocksTransfers: 3,  // if >= this many vehicles wait at the gate, no transfers
  minutesForNow: 8,             // "Now" pass needs at least this much spare in the current hour
};

/**
 * Probability a booked farmer who has NOT arrived yet will still come,
 * `elapsedMin` minutes into his hour. Before the hour: 1 x pShow.
 * 0..15 min: almost certain; 40 min: ~0.35; 55 min: ~0.1.
 */
export function stillComingProb(elapsedMin, pShow = 1) {
  const e = Math.max(0, num(elapsedMin, 0));
  const p = clamp01(num(pShow, 1));
  if (e <= 0) return p;
  if (e >= 60) return 0;
  // smooth S-curve centred at 35 min
  const decay = 1 / (1 + Math.exp((e - 35) / 7));
  return r1(p * decay * 100) / 100;
}

/**
 * Spare minutes in ONE hour window.
 *   cap             capacity record for that hour (fullMinutes, throughput)
 *   bookedMinutes   Σ nominal minutes booked in the window (queue.slotLoadMinutes)
 *   expectedMinutes Σ expected minutes booked (queue.slotExpectedMinutes) - used for pShow
 *   arrivedMinutes  Σ minutes of loads that have ENTERED (from arrived quintals)
 *   elapsedMin      minutes since the window opened (negative = not yet)
 * Returns { spareMinutes, spareQuintals, expectedStillMinutes, state }
 *   state: 'future' | 'open' | 'closed'
 */
export function spareForHour(cap, { bookedMinutes = 0, expectedMinutes = null, arrivedMinutes = 0, elapsedMin = -1 }) {
  const full = Math.max(1, num(cap?.fullMinutes, 60));
  const tp = Math.max(1, num(cap?.throughput, 400));
  const booked = Math.max(0, num(bookedMinutes, 0));
  const expected = expectedMinutes != null ? Math.max(0, num(expectedMinutes, 0)) : booked;
  const arrived = Math.max(0, num(arrivedMinutes, 0));
  const pShowAvg = booked > 0 ? clamp01(expected / booked) : 1;
  const notArrived = Math.max(0, booked - arrived);
  const state = elapsedMin < 0 ? 'future' : elapsedMin >= 60 ? 'closed' : 'open';
  const still = state === 'closed' ? 0 : notArrived * stillComingProb(Math.max(0, elapsedMin), pShowAvg);
  const spare = full - arrived - still;
  return {
    spareMinutes: r1(spare),
    spareQuintals: Math.round((Math.max(0, spare) / 60) * tp),
    expectedStillMinutes: r1(still),
    arrivedMinutes: r1(arrived),
    bookedMinutes: r1(booked),
    state,
  };
}

/**
 * Whole-day spare picture at time `nowMin` (minutes since the first
 * window opened). `hours` = [{ slotTime, cap, bookedMinutes, expectedMinutes, arrivedMinutes }]
 * in order. Returns { nowIdx, hours:[...spare], nowSpareMinutes, laterSpareMinutes }.
 * Spare from a CLOSED hour is gone (time cannot be stored) - only the
 * current and future hours count.
 */
export function spareDay(hours, nowMin) {
  const out = hours.map((h, i) => {
    const elapsed = nowMin - i * 60;
    return { slotTime: h.slotTime, ...spareForHour(h.cap, { ...h, elapsedMin: elapsed }) };
  });
  const nowIdx = Math.min(hours.length - 1, Math.max(0, Math.floor(nowMin / 60)));
  const nowH = out[nowIdx];
  const later = out.slice(nowIdx + 1).reduce((s, h) => s + Math.max(0, h.spareMinutes), 0);
  return {
    nowIdx,
    hours: out,
    nowSpareMinutes: nowMin < 0 || nowMin >= hours.length * 60 ? 0 : Math.max(0, nowH?.spareMinutes || 0),
    laterSpareMinutes: r1(later),
    totalSpareMinutes: r1((nowMin < 0 ? 0 : Math.max(0, nowH?.spareMinutes || 0)) + later),
  };
}

/**
 * Can this load go in NOW (walk-in at the gate)? Needs enough spare in the
 * current hour, and the gate must not already have a physical queue.
 */
export function canAdmitNow(day, loadMinutes, gateWaiting = 0, opts = {}) {
  const need = Math.max(SPARE_DEFAULTS.minutesForNow, num(loadMinutes, 0));
  const maxQueue = num(opts.gateQueueBlocksTransfers, SPARE_DEFAULTS.gateQueueBlocksTransfers);
  return day.nowSpareMinutes >= need && gateWaiting < maxQueue;
}

/**
 * What a centre publishes to its cluster: transferable minutes right now.
 *   day            spareDay() result
 *   reservedTransferMinutes   already promised to transfer passes still valid
 *   gateWaiting    vehicles physically waiting at the gate
 *   yardLevel      'ok' | 'soft' | 'hard' | 'stop'  (a yard-full centre never publishes)
 */
export function transferOffer(day, { reservedTransferMinutes = 0, gateWaiting = 0, yardLevel = 'ok', acceptTransfers = true, maxTransferSharePercent = SPARE_DEFAULTS.maxTransferSharePercent } = {}) {
  if (!acceptTransfers || yardLevel === 'hard' || yardLevel === 'stop') return { minutes: 0, reason: !acceptTransfers ? 'off' : 'yard' };
  if (gateWaiting >= SPARE_DEFAULTS.gateQueueBlocksTransfers) return { minutes: 0, reason: 'gateQueue' };
  const usable = day.nowSpareMinutes + day.laterSpareMinutes;
  const share = Math.max(0, Math.min(100, num(maxTransferSharePercent, 30))) / 100;
  const minutes = Math.max(0, Math.floor(usable * share - Math.max(0, num(reservedTransferMinutes, 0))));
  if (minutes < SPARE_DEFAULTS.publishMinMinutes) return { minutes: 0, reason: 'tooLittle', raw: minutes };
  return { minutes, reason: null, untilIdx: day.hours.length - 1 };
}

/** Great-circle distance in km (for "18 km away"). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = [lat1, lon1, lat2, lon2].map(Number);
  if (a.some((x) => !Number.isFinite(x))) return null;
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(a[2] - a[0]), dLon = toR(a[3] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(a[2])) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/** Utilisation = (arrived + expected still) / full, over hours up to now. */
export function utilisation(day) {
  const done = day.hours.slice(0, day.nowIdx + 1);
  if (!done.length) return null;
  const used = done.reduce((s, h) => s + h.arrivedMinutes + h.expectedStillMinutes, 0);
  const full = done.length * 60;
  return Math.round((used / full) * 100);
}
