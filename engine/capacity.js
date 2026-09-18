/*
 * engine/capacity.js   (install44)
 * ---------------------------------------------------------------
 * THE CAPACITY ENGINE - pure functions only.
 *
 *   RULES OF THIS FOLDER (read engine/README.md):
 *     - no Firebase, no React, no Date.now(), no imports from ../services
 *     - every function: plain inputs -> plain outputs
 *   Because of that the SAME file runs in the browser today and in
 *   Node.js on the AgroBridge server tomorrow. Nothing to rewrite.
 *
 * A mandi does not process "farmers", it processes WEIGHT. Every
 * hour-window has a labour budget of 60 minutes and a booking costs
 * (quintals / throughputPerHour[crop]) x 60 of it.
 *
 *   throughputPerHour        { default: 400, wheat: 400, paddy: 300 }
 *   bufferPercent            share of every window NOT bookable in advance
 *   maxSharePercent          one booking may take at most this share of a
 *                            window; bigger loads spread over consecutive
 *                            windows as ONE token (1+3 rule)
 *   smallLoadQuintals        loads up to this size may dip into the buffer
 *   declaredTolerancePercent actual may exceed declared by this much before
 *                            it is noted on the booking (note only)
 *
 * install44 adds two ML inputs to the planner (see planLoad opts):
 *   ratio   Model A  - declared -> expected quintals (farmer's habit)
 *   pShow   Model C  - probability the farmer turns up
 * and one more counter per window: slotExpectedMinutes.
 *
 *   Acceptance rule (first window, normal load):
 *     EXPECTED minutes (Σ reserved x pShow)  <= bookable part   (buffer kept
 *                                                for the average day)
 *     NOMINAL  minutes (Σ reserved)          <= full 60 minutes (if EVERY
 *                                                farmer shows, the buffer
 *                                                absorbs it - nobody is
 *                                                displaced, ever)
 *   With ratio = 1 and pShow = 1 this is exactly the install41 rule.
 */

export const CAPACITY_DEFAULTS = {
  throughputPerHour: { default: 400 },
  bufferPercent: 15,
  maxSharePercent: 25,
  smallLoadQuintals: 15,
  declaredTolerancePercent: 15,
  /*
   * install45 - perishables (tomato, onion...). NOT a priority lane:
   *   perishableReservePercent  share of every hour's bookable minutes
   *                             held for perishables until the day before
   *                             (like reserved seats, not queue-jumping)
   *   grainHorizonDays          how far ahead grain may be booked
   *   perishableHorizonDays     how far ahead perishables may be booked
   *                             (short, so grain booked a week ago cannot
   *                             eat the hours a tomato farmer needs today)
   */
  perishableReservePercent: 0,
  grainHorizonDays: 7,
  perishableHorizonDays: 1,
};

function pctOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : fallback;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function formatHour(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

/** Vehicles the gate can physically pass in one hour (hard ceiling). */
export function capacityPerWindow(centre) {
  const perEntry = Number(centre?.avgMinutesPerEntry) || 15;
  const lanes = Number(centre?.parallelLanes) || 1;
  return Math.max(1, Math.floor((60 / perEntry) * lanes));
}

/** Quintals per hour this centre processes for a crop (admin-set value). */
export function throughputFor(centre, crop) {
  const table = centre?.throughputPerHour || {};
  const key = String(crop || '').trim().toLowerCase();
  return (
    Number(table[key]) ||
    Number(table.default) ||
    CAPACITY_DEFAULTS.throughputPerHour.default
  );
}

/** Everything the planner needs about one centre + crop. */
export function centreCapacity(centre, crop) {
  const throughput = throughputFor(centre, crop);
  const bufferPercent = pctOr(centre?.bufferPercent, CAPACITY_DEFAULTS.bufferPercent);
  const maxSharePercent = pctOr(centre?.maxSharePercent, CAPACITY_DEFAULTS.maxSharePercent) || CAPACITY_DEFAULTS.maxSharePercent;
  const smallLoadQuintals = Number.isFinite(Number(centre?.smallLoadQuintals))
    ? Number(centre.smallLoadQuintals)
    : CAPACITY_DEFAULTS.smallLoadQuintals;
  const declaredTolerancePercent = pctOr(centre?.declaredTolerancePercent, CAPACITY_DEFAULTS.declaredTolerancePercent);
  const perishableReservePercent = pctOr(centre?.perishableReservePercent, CAPACITY_DEFAULTS.perishableReservePercent);
  const bookableMinutes = Math.round(60 * (1 - bufferPercent / 100));

  return {
    throughput,
    perishableReservePercent,
    reserveMinutes: Math.round((bookableMinutes * perishableReservePercent) / 100),
    grainHorizonDays: Number(centre?.grainHorizonDays) || CAPACITY_DEFAULTS.grainHorizonDays,
    perishableHorizonDays: Number(centre?.perishableHorizonDays) || CAPACITY_DEFAULTS.perishableHorizonDays,
    bufferPercent,
    maxSharePercent,
    smallLoadQuintals,
    declaredTolerancePercent,
    fullMinutes: 60,
    bookableMinutes,
    shareMinutes: Math.max(1, Math.round((60 * maxSharePercent) / 100)),
    vehicleCap: capacityPerWindow(centre),
  };
}

/** Labour minutes one load costs at this throughput. */
export function loadMinutesFor(quintals, throughput) {
  const q = Math.max(0, Number(quintals) || 0);
  const t = Math.max(1, Number(throughput) || 1);
  return Math.max(1, Math.round((q / t) * 60 * 10) / 10);
}

/** Hour windows of the day: ['08:00', '09:00', ...]. */
export function windowList(centre) {
  const [startHour] = String(centre?.operatingStartTime || '08:00').split(':').map(Number);
  const [endHour] = String(centre?.operatingEndTime || '18:00').split(':').map(Number);
  const out = [];
  for (let hour = startHour; hour < endHour; hour++) {
    out.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return out;
}

export function windowLabelFor(slotTime, hours = 1) {
  const h = Number(String(slotTime).split(':')[0]) || 0;
  return `${formatHour(h)} - ${formatHour(h + Math.max(1, hours))}`;
}

/** Expected minutes already booked in a window (falls back to nominal). */
function expectedUsed(queue, slot) {
  const exp = queue?.slotExpectedMinutes || {};
  if (exp[slot] != null) return Number(exp[slot]) || 0;
  return Number(queue?.slotLoadMinutes?.[slot]) || 0;
}

/**
 * THE PLANNER. Used by BOTH the slot screen and the booking transaction,
 * so what the farmer sees is exactly what the transaction enforces.
 *
 * opts.ratio      Model A correction (1 = trust declared)     default 1
 * opts.pShow      Model C show-up probability (1 = certain)   default 1
 * opts.cropClass  'grain' | 'perishable'                      default 'grain'
 * opts.leadDays   days between today and the slot date        default 0
 * opts.reserveOpen true when the reserve has been released (day before / same day)
 *
 * Returns { ok, reason, windows, windowLoads, windowExpected, loadMinutes,
 *           reservedQuintals, needed, offsetMinutes }
 *   reason: 'full' | 'vehicles' | 'tooLate' | 'tooBig' | 'closed' | 'horizon'
 */
export function planLoad(cap, slots, queue, startIdx, quintals, opts = {}) {
  const q = Math.max(0, Number(quintals) || 0);
  const ratio = clamp(Number(opts.ratio) || 1, 0.5, 2);
  const pShow = clamp(Number(opts.pShow) || 1, 0.05, 1);

  const cropClass = opts.cropClass === 'perishable' ? 'perishable' : 'grain';
  const leadDays = Math.max(0, Number(opts.leadDays) || 0);
  const horizon = cropClass === 'perishable' ? cap.perishableHorizonDays : cap.grainHorizonDays;
  if (horizon != null && leadDays > horizon) {
    return { ok: false, reason: 'horizon', needed: 1, loadMinutes: 0, reservedQuintals: q, horizon };
  }

  const reservedQuintals = round1(q * ratio);
  const loadMinutes = loadMinutesFor(reservedQuintals, cap.throughput);
  // perishables may use the buffer like a small load (time-critical, not a jump)
  const isSmall = q <= cap.smallLoadQuintals || cropClass === 'perishable';
  const needed = Math.max(1, Math.ceil(loadMinutes / cap.shareMinutes));
  // reserve: grain may not eat the perishable share until it is released (leadDays <= 1)
  const reserveOpen = opts.reserveOpen != null ? Boolean(opts.reserveOpen) : leadDays <= 1;
  const grainCeiling = cropClass === 'grain' && !reserveOpen ? cap.bookableMinutes - (cap.reserveMinutes || 0) : cap.bookableMinutes;

  if (needed > slots.length) {
    return { ok: false, reason: 'tooBig', needed, loadMinutes, reservedQuintals };
  }
  if (startIdx < 0 || startIdx + needed > slots.length) {
    return { ok: false, reason: 'tooLate', needed, loadMinutes, reservedQuintals };
  }

  const used = queue?.slotLoadMinutes || {};
  const vehicles = queue?.slotCounts || {};
  const closed = queue?.closedSlots || {};
  const per = loadMinutes / needed;
  const perExpected = per * pShow;
  const windowLoads = {};
  const windowExpected = {};

  for (let i = 0; i < needed; i++) {
    const s = slots[startIdx + i];
    if (closed[s]) return { ok: false, reason: 'closed', needed, loadMinutes, reservedQuintals };

    const nominalAlready = Number(used[s]) || 0;
    const expectedAlready = expectedUsed(queue, s);
    const bookable = i === 0 && !isSmall ? grainCeiling : cap.fullMinutes;

    // 1) on an average day the buffer must survive
    if (expectedAlready + perExpected > bookable + 1e-6) {
      return { ok: false, reason: 'full', needed, loadMinutes, reservedQuintals };
    }
    // 2) if everyone shows, the hour (incl. buffer) must still hold it
    if (nominalAlready + per > cap.fullMinutes + 1e-6) {
      return { ok: false, reason: 'full', needed, loadMinutes, reservedQuintals };
    }
    windowLoads[s] = round1(per);
    windowExpected[s] = round1(perExpected);
  }

  const first = slots[startIdx];
  if ((Number(vehicles[first]) || 0) >= cap.vehicleCap) {
    return { ok: false, reason: 'vehicles', needed, loadMinutes, reservedQuintals };
  }

  return {
    ok: true,
    reason: null,
    windows: slots.slice(startIdx, startIdx + needed),
    windowLoads,
    windowExpected,
    loadMinutes,
    reservedQuintals,
    needed,
    ratio,
    pShow,
    cropClass,
    // Work already booked in the arrival window = how far into the hour
    // this farmer's turn falls (throughput is whole-mandi).
    offsetMinutes: Math.round(expectedUsed(queue, first)),
  };
}

/** Add a plan to the queue counters (used inside the booking transaction). */
export function applyPlan(queue, plan, quintals) {
  const slotCounts = { ...(queue.slotCounts || {}) };
  const slotLoadMinutes = { ...(queue.slotLoadMinutes || {}) };
  const slotExpectedMinutes = { ...(queue.slotExpectedMinutes || {}) };
  const slotQuintals = { ...(queue.slotQuintals || {}) };
  const slotReservedQuintals = { ...(queue.slotReservedQuintals || {}) };

  plan.windows.forEach((w, i) => {
    slotLoadMinutes[w] = round1((Number(slotLoadMinutes[w]) || 0) + plan.windowLoads[w]);
    slotExpectedMinutes[w] = round1(expectedUsed({ ...queue, slotExpectedMinutes }, w) + (plan.windowExpected?.[w] ?? plan.windowLoads[w]));
    slotQuintals[w] = round1((Number(slotQuintals[w]) || 0) + quintals / plan.needed);
    slotReservedQuintals[w] = round1((Number(slotReservedQuintals[w]) || 0) + (plan.reservedQuintals || quintals) / plan.needed);
    if (i === 0) slotCounts[w] = (Number(slotCounts[w]) || 0) + 1;
  });
  return { slotCounts, slotLoadMinutes, slotExpectedMinutes, slotQuintals, slotReservedQuintals };
}

/** Remove a booking from the queue counters (cancel / missed / no-show). */
export function releasePlan(queue, booking) {
  const slotCounts = { ...(queue.slotCounts || {}) };
  const slotLoadMinutes = { ...(queue.slotLoadMinutes || {}) };
  const slotExpectedMinutes = { ...(queue.slotExpectedMinutes || {}) };
  const slotQuintals = { ...(queue.slotQuintals || {}) };
  const slotReservedQuintals = { ...(queue.slotReservedQuintals || {}) };
  const loadByPosition = { ...(queue.loadByPosition || {}) };

  const windows = Array.isArray(booking.windows) && booking.windows.length ? booking.windows : [booking.slotTime];
  const loads = booking.windowLoads || {};
  const expected = booking.engine?.windowExpected || {};
  const q = Number(booking.declaredQuintals || booking.approxQuantityQuintals) || 0;
  const rq = Number(booking.engine?.reservedQuintals) || q;

  windows.forEach((w, i) => {
    if (i === 0) slotCounts[w] = Math.max(0, (Number(slotCounts[w]) || 1) - 1);
    if (loads[w] != null) slotLoadMinutes[w] = Math.max(0, round1((Number(slotLoadMinutes[w]) || 0) - Number(loads[w])));
    const e = expected[w] != null ? Number(expected[w]) : Number(loads[w]) || 0;
    if (slotExpectedMinutes[w] != null) slotExpectedMinutes[w] = Math.max(0, round1(Number(slotExpectedMinutes[w]) - e));
    slotQuintals[w] = Math.max(0, round1((Number(slotQuintals[w]) || 0) - q / windows.length));
    if (slotReservedQuintals[w] != null) slotReservedQuintals[w] = Math.max(0, round1(Number(slotReservedQuintals[w]) - rq / windows.length));
  });
  delete loadByPosition[String(booking.positionAssigned)];
  return { slotCounts, slotLoadMinutes, slotExpectedMinutes, slotQuintals, slotReservedQuintals, loadByPosition };
}

/** Whole-day view for the slot screen. */
export function planDay(centre, queue, crop, quintals, opts = {}) {
  const cap = centreCapacity(centre, crop);
  const list = windowList(centre);
  const slots = list.map((slotTime, idx) => {
    const plan = planLoad(cap, list, queue, idx, quintals, opts);
    const hour = Number(slotTime.split(':')[0]);
    return {
      slotTime,
      windowLabel: windowLabelFor(slotTime, 1),
      runLabel: plan.ok ? windowLabelFor(slotTime, plan.needed) : null,
      needed: plan.needed || 1,
      fits: plan.ok,
      reason: plan.reason,
      isFull: !plan.ok,
      windows: plan.ok ? plan.windows : [],
      arriveLabel: formatHour(hour),
      totalCapacity: cap.vehicleCap,
      bookedCount: Number(queue?.slotCounts?.[slotTime]) || 0,
      availableCapacity: Math.max(0, cap.vehicleCap - (Number(queue?.slotCounts?.[slotTime]) || 0)),
    };
  });
  const tooBig = slots.length > 0 && slots.every((s) => s.reason === 'tooBig');
  const firstFit = slots.find((s) => s.fits) || null;
  return { slots, firstFit, tooBig, capacity: cap };
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
