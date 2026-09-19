/*
 * engine/yard.js   (install52)   THE YARD MODEL  -  pure functions only
 * ---------------------------------------------------------------------
 * Same rules as engine/capacity.js: no Firebase, no React, no Date.now().
 * Runs unchanged in the browser today and on the AgroBridge server later.
 *
 * WHY THIS FILE EXISTS (root causes R6 + R7)
 *   A mandi does not only have a SPEED (quintals per hour, capacity.js),
 *   it has a FLOOR. Every quintal weighed sits on that floor in bags
 *   until a lifting truck takes it to the warehouse. When lifting stops
 *   (Karnal 2021: 78 % unlifted, gate passes stopped for 24 h; Haryana
 *   2025: 45 % lifted statewide) the yard fills, unloading crawls and
 *   finally stops - no matter how fast the weighbridge is.
 *
 *   Nobody's system counts the floor. e-Kharid keeps issuing quota passes
 *   until an officer physically shuts the gate. This file makes the floor
 *   an INPUT to the planner, so the app simply OFFERS FEWER SLOTS on days
 *   the arithmetic says the floor will be full - days in advance, not at
 *   7 AM when the tractors are already loaded.
 *
 * THREE INPUTS, ALL IN PLAIN UNITS THE ADMIN ALREADY KNOWS
 *   floorCapacityQ    how many quintals the yard can hold in bags (set once)
 *   floorUsedQ        quintals lying on the floor right now
 *                     (+ every weighing, - every "lifted today" entry)
 *   bagsInStock       empty bardana in stock; bagQuintals per bag (0.5)
 *   labourTeams       palledar teams on duty vs labourTeamsNormal
 *
 * WHAT COMES OUT
 *   yardFactors()       labour multiplier, bag cap, floor %, incident level
 *   floorProjection()   day-by-day: floor at start, booked intake, expected
 *                       lifting, floor at end -> bookable factor 0..1
 *   scaleCapacity()     shrink a capacity record by that factor (planner)
 *   waitEstimate()      honest minutes range for one farmer's hour today
 *   shouldAutoDeclare() when the app should tell farmers by itself
 *
 * NEVER DOES: move, cancel or penalise a confirmed booking. The farmer
 * decides (wait / cancel & re-book) - see services/bookings.js.
 */

export const YARD_DEFAULTS = {
  floorCapacityQ: 6000,     // ~1 day of a 400 q/h x 10 h yard, times 1.5
  floorUsedQ: 0,
  bagsInStock: null,        // null = not tracked (no cap applied)
  bagQuintals: 0.5,         // one 50 kg bag
  labourTeams: null,        // null = not tracked (factor 1)
  labourTeamsNormal: null,
  liftedTodayQ: 0,
  liftedHistory: [],        // [{ date, q }] last entries, newest first
  /* thresholds */
  floorSoftPercent: 60,     // above this future days start shrinking
  floorHardPercent: 85,     // above this = incident, farmers are told
  floorStopPercent: 95,     // unloading effectively stopped
  projectionDays: 7,
};

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp01 = (n) => Math.min(1, Math.max(0, n));
export const round0 = (n) => Math.round(n);
export const roundPct = (n) => Math.round(n * 10) / 10;

/** Normalised yard record (fills defaults, never mutates input). */
export function yardState(yard) {
  const y = { ...YARD_DEFAULTS, ...(yard || {}) };
  y.floorCapacityQ = Math.max(100, num(y.floorCapacityQ, YARD_DEFAULTS.floorCapacityQ));
  y.floorUsedQ = Math.max(0, num(y.floorUsedQ, 0));
  y.bagQuintals = Math.max(0.1, num(y.bagQuintals, 0.5));
  y.bagsInStock = yard && yard.bagsInStock != null && yard.bagsInStock !== '' ? Math.max(0, num(yard.bagsInStock, 0)) : null;
  y.labourTeams = yard && yard.labourTeams != null && yard.labourTeams !== '' ? Math.max(0, num(yard.labourTeams, 0)) : null;
  y.labourTeamsNormal = yard && yard.labourTeamsNormal != null && yard.labourTeamsNormal !== '' ? Math.max(1, num(yard.labourTeamsNormal, 1)) : null;
  y.liftedHistory = Array.isArray(y.liftedHistory) ? y.liftedHistory.slice(0, 10) : [];
  return y;
}

/**
 * The three multipliers the planner needs RIGHT NOW.
 *   labourFactor  teams on duty / normal   (0.25 .. 1.5) - half the palledars,
 *                 half the q/h. null teams -> 1 (not tracked).
 *   bagCapQ       quintals that can still be bagged today (null = not tracked)
 *   floorUsedPercent, floorFreeQ
 *   incidentLevel 'ok' | 'soft' | 'hard' | 'stop'
 */
export function yardFactors(yard) {
  const y = yardState(yard);
  const floorUsedPercent = roundPct((y.floorUsedQ / y.floorCapacityQ) * 100);
  const floorFreeQ = Math.max(0, round0(y.floorCapacityQ - y.floorUsedQ));
  let labourFactor = 1;
  if (y.labourTeams != null && y.labourTeamsNormal != null) {
    labourFactor = Math.min(1.5, Math.max(0.25, y.labourTeams / y.labourTeamsNormal));
  }
  const bagCapQ = y.bagsInStock == null ? null : round0(y.bagsInStock * y.bagQuintals);
  let incidentLevel = 'ok';
  if (floorUsedPercent >= y.floorStopPercent || bagCapQ === 0) incidentLevel = 'stop';
  else if (floorUsedPercent >= y.floorHardPercent) incidentLevel = 'hard';
  else if (floorUsedPercent >= y.floorSoftPercent) incidentLevel = 'soft';
  return { labourFactor: Math.round(labourFactor * 100) / 100, bagCapQ, floorUsedPercent, floorFreeQ, incidentLevel, floorCapacityQ: y.floorCapacityQ, floorUsedQ: y.floorUsedQ };
}

/**
 * How many quintals leave the yard per day. Average of the last entries
 * the admin typed ("lifted today"). With no history we assume lifting
 * keeps up with a NORMAL day's intake (steady state) - the floor then
 * only bites when it is ALREADY high, never on a made-up forecast.
 */
export function expectedLiftingPerDay(yard, normalDayIntakeQ) {
  const y = yardState(yard);
  const hist = y.liftedHistory.filter((h) => Number.isFinite(Number(h?.q))).slice(0, 5);
  if (!hist.length) return Math.max(0, num(normalDayIntakeQ, 0));
  return round0(hist.reduce((s, h) => s + Number(h.q), 0) / hist.length);
}

/**
 * THE FLOOR PROJECTION.
 *   bookedQByDay   [q for day 0 (today), day 1, ...] already booked intake
 *   normalDayIntakeQ  what a normal full day weighs (throughput x hours)
 * Returns rows { dayOffset, floorStartQ, floorStartPercent, bookedQ,
 *                liftQ, floorEndQ, roomQ, factor }.
 *   factor   share of a normal day's intake that may still be booked on
 *            that day, given the floor it will START with. 1 = normal,
 *            0 = nothing more. It shrinks between soft and hard %.
 * Intake for a day is min(booked, floor room) - you cannot unload onto
 * a full floor, so bookings above the room are carried as a queue that
 * spills into the next day (that is exactly the "wheat on the road").
 */
export function floorProjection(yard, bookedQByDay, normalDayIntakeQ, opts = {}) {
  const y = yardState(yard);
  const days = Math.max(1, num(opts.days, y.projectionDays));
  const liftPerDay = opts.liftPerDay != null ? Math.max(0, num(opts.liftPerDay, 0)) : expectedLiftingPerDay(y, normalDayIntakeQ);
  const cap = y.floorCapacityQ;
  const soft = cap * (y.floorSoftPercent / 100);
  const hard = cap * (y.floorHardPercent / 100);
  const normal = Math.max(1, num(normalDayIntakeQ, 1));
  const rows = [];
  let floor = y.floorUsedQ;
  let carry = 0;                       // intake that could not be unloaded yesterday
  for (let d = 0; d < days; d++) {
    const booked = Math.max(0, num(bookedQByDay?.[d], 0)) + carry;
    const floorStart = floor;
    // room for new bookings on this day = distance from the hard line, plus what lifting frees
    const roomQ = Math.max(0, hard - floorStart + liftPerDay - booked);
    let factor;
    if (floorStart <= soft) factor = 1;
    else if (floorStart >= hard) factor = 0;
    else factor = 1 - (floorStart - soft) / (hard - soft);
    // a day can never book more than its room, whatever the % says
    factor = clamp01(Math.min(factor, roomQ / normal));
    const intake = Math.min(booked, Math.max(0, cap - floorStart + liftPerDay));
    carry = Math.max(0, booked - intake);
    const floorEnd = Math.max(0, floorStart + intake - liftPerDay);
    rows.push({
      dayOffset: d,
      floorStartQ: round0(floorStart),
      floorStartPercent: roundPct((floorStart / cap) * 100),
      bookedQ: round0(booked),
      liftQ: round0(liftPerDay),
      floorEndQ: round0(floorEnd),
      roomQ: round0(roomQ),
      carryQ: round0(carry),
      factor: Math.round(factor * 100) / 100,
    });
    floor = floorEnd;
  }
  const firstNormal = rows.findIndex((r) => r.factor >= 0.99);
  return {
    rows,
    liftPerDay,
    recoveryDays: firstNormal < 0 ? days : firstNormal,   // days until slots are normal again
    factorByDay: rows.map((r) => r.factor),
  };
}

/**
 * Shrink a capacity record (engine/capacity.js centreCapacity) by the
 * day's floor factor and the labour factor. Both bookable and full
 * minutes shrink, so "if everyone shows" is also tested against the
 * smaller yard. Buffer share is preserved.
 */
export function scaleCapacity(cap, floorFactor = 1, labourFactor = 1) {
  const f = clamp01(num(floorFactor, 1));
  const l = Math.min(1.5, Math.max(0.25, num(labourFactor, 1)));
  const throughput = Math.max(1, Math.round(cap.throughput * l));
  return {
    ...cap,
    throughput,
    bookableMinutes: Math.round(cap.bookableMinutes * f),
    fullMinutes: Math.round(cap.fullMinutes * f),
    shareMinutes: Math.max(1, Math.round(cap.shareMinutes * f)),
    reserveMinutes: Math.round((cap.reserveMinutes || 0) * f),
    yardFloorFactor: f,
    yardLabourFactor: l,
  };
}

/**
 * Honest wait estimate for a farmer whose hour is TODAY, during a yard
 * incident. Inputs are what the queue document already holds.
 *   minutesBookedInHour  Σ expected minutes booked in his hour (work ahead of him within the hour)
 *   hoursAheadOpen       hours before his that have not finished (backlog carried forward)
 *   floorUsedPercent     yardFactors().floorUsedPercent
 *   labourFactor         yardFactors().labourFactor
 * Returns { minMin, maxMin, stopped } - a RANGE, never a promise.
 */
export function waitEstimate({ minutesBookedInHour = 0, backlogMinutes = 0, floorUsedPercent = 0, labourFactor = 1, stopPercent = YARD_DEFAULTS.floorStopPercent }) {
  if (floorUsedPercent >= stopPercent) return { minMin: null, maxMin: null, stopped: true };
  // unloading slows as space runs out: 60 % floor ~ normal, 85 % ~ half speed, 95 % ~ quarter
  const space = clamp01((stopPercent - floorUsedPercent) / (stopPercent - 60));
  const slow = 1 / Math.max(0.2, space * Math.max(0.25, labourFactor));
  const base = (Math.max(0, num(minutesBookedInHour, 0)) + Math.max(0, num(backlogMinutes, 0))) * slow;
  return { minMin: round0(base * 0.8), maxMin: round0(base * 1.4 + 15), stopped: false };
}

/** Should the app declare the incident by itself (admin may dismiss)? */
export function shouldAutoDeclare(yard) {
  const f = yardFactors(yard);
  return f.incidentLevel === 'hard' || f.incidentLevel === 'stop';
}

/** Plain-language reason list for the admin card / farmer notice. */
export function yardReasons(yard) {
  const f = yardFactors(yard);
  const out = [];
  if (f.floorUsedPercent >= YARD_DEFAULTS.floorHardPercent) out.push('floor');
  if (f.bagCapQ != null && f.bagCapQ <= 0) out.push('bags');
  if (f.labourFactor < 0.6) out.push('labour');
  return out;
}
