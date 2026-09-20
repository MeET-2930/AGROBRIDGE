/*
 * engine/telemetry.js   (install56)   STAGE TELEMETRY  -  pure functions only
 * -----------------------------------------------------------------------------
 * Same rules as capacity.js / yard.js: no Firebase, no React, no Date.now().
 * Input = today's booking rows (already stamped by the officers). Output =
 * where the day is actually stuck, per stage, in minutes and vehicles.
 *
 * Every booking carries timestamps written by the officer screens:
 *   gateEntryAt -> heapedAt -> assayAt -> priceFixedAt -> baggedAt -> weighedAt -> paidAt -> liftedAt -> creditedAt
 * A stage's DWELL for one lot = minutes between the previous stamp and its own.
 * A stage's WAITING NOW = lots that have the previous stamp but not this one.
 *
 * The bottleneck is the stage with the most waiting lots weighted by how
 * long they have been waiting, compared to that stage's own median dwell.
 * -----------------------------------------------------------------------------
 */

export const STAGE_STEPS = [
  { key: 'gate',   from: null,          to: 'gateEntryAt',  waitStatus: ['booked'] },
  { key: 'heap',   from: 'gateEntryAt', to: 'heapedAt',     optional: true },
  { key: 'assay',  from: 'gateEntryAt', to: 'assayAt' },
  { key: 'price',  from: 'assayAt',     to: 'priceFixedAt' },
  { key: 'weigh',  from: 'priceFixedAt', to: 'weighedAt' },
  { key: 'pay',    from: 'weighedAt',   to: 'paidAt' },
  { key: 'lift',   from: 'paidAt',      to: 'liftedAt' },
  { key: 'credit', from: 'liftedAt',    to: 'creditedAt' },
];

const ms = (iso) => (iso ? new Date(iso).getTime() : NaN);
export function median(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function p90(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.9))];
}

/**
 * Per-stage numbers for one day.
 * @param rows   bookings (any status)
 * @param nowMs  clock (injected for tests / sim)
 * @returns { stages:[{key, done, waiting, medianMin, p90Min, oldestWaitMin, load}], bottleneck, totals }
 */
export function stageTelemetry(rows, nowMs) {
  const list = Array.isArray(rows) ? rows : [];
  const stages = STAGE_STEPS.map((st) => {
    const dwell = [];
    let waiting = 0, oldest = 0;
    list.forEach((b) => {
      if (b.status === 'cancelled' || b.status === 'missed' || b.status === 'no-show' || b.status === 'rejected' && st.key !== 'assay') {
        if (!(st.key === 'assay' && b.status === 'rejected')) return;
      }
      const start = st.from ? ms(b[st.from]) : ms(b.createdAt);
      const end = ms(b[st.to]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        if (st.key !== 'gate') dwell.push((end - start) / 60000);
      } else if (Number.isFinite(start) && !Number.isFinite(end)) {
        // waiting at this stage: previous stamp exists, this one does not
        if (st.optional) return;                                   // heap is informational
        if (st.key === 'gate') return;                             // gate waiting = "booked", counted below
        // the pass must not have skipped this stage via a later stamp
        const later = STAGE_STEPS.slice(STAGE_STEPS.findIndex((x) => x.key === st.key) + 1).some((x) => Number.isFinite(ms(b[x.to])));
        if (later) return;
        waiting += 1;
        oldest = Math.max(oldest, (nowMs - start) / 60000);
      }
    });
    const med = median(dwell);
    // load = waiting lots x sqrt(how long the oldest has waited vs normal dwell), ratio capped at 4x.
    // Vehicles count more than one unlucky lot: 3 lots waiting 2x normal beat 1 lot waiting 8x.
    const ratio = med ? Math.min(4, Math.max(1, oldest / Math.max(5, med))) : 1;
    const load = waiting * Math.sqrt(ratio);
    return { key: st.key, done: dwell.length, waiting, medianMin: med == null ? null : Math.round(med), p90Min: p90(dwell) == null ? null : Math.round(p90(dwell)), oldestWaitMin: Math.round(oldest), load: Math.round(load * 10) / 10, optional: Boolean(st.optional) };
  });

  // gate: waiting = booked passes whose hour is open or passed (still outside)
  const gate = stages.find((s) => s.key === 'gate');
  gate.waiting = list.filter((b) => b.status === 'booked').length;
  gate.done = list.filter((b) => Number.isFinite(ms(b.gateEntryAt))).length;

  const candidates = stages.filter((s) => !s.optional && s.key !== 'gate' && s.key !== 'lift' && s.key !== 'credit');
  const bottleneck = candidates.reduce((best, s) => (s.load > (best?.load || 0) ? s : best), null);

  const inside = list.filter((b) => ['in-gate', 'assay', 'price-fixed', 'weighing', 'payment-processing'].includes(b.status)).length;
  const doorToPay = list.filter((b) => Number.isFinite(ms(b.gateEntryAt)) && Number.isFinite(ms(b.paidAt))).map((b) => (ms(b.paidAt) - ms(b.gateEntryAt)) / 60000);
  const totals = {
    inside, paid: list.filter((b) => b.status === 'paid').length,
    doorToPayMedianMin: median(doorToPay) == null ? null : Math.round(median(doorToPay)),
    doorToPayP90Min: p90(doorToPay) == null ? null : Math.round(p90(doorToPay)),
    liftedPending: list.filter((b) => b.status === 'paid' && !b.liftedAt).length,
  };
  return { stages, bottleneck: bottleneck && bottleneck.waiting > 0 ? bottleneck.key : null, totals };
}

/**
 * Minutes per vehicle per stage from history (for Model B's per-stage view).
 * Returns { assay, price, weigh, pay } medians in minutes, or null where unknown.
 */
export function stageMedians(rows) {
  const t = stageTelemetry(rows, Date.parse('2100-01-01'));
  const out = {};
  t.stages.forEach((s) => { out[s.key] = s.medianMin; });
  return out;
}

/**
 * Public board (no login, no names, no token numbers). Pure text-ready facts.
 */
export function publicBoard(centre, rows, nowMs, dayStatus) {
  const t = stageTelemetry(rows, nowMs);
  const now = new Date(nowMs);
  const hh = `${String(now.getHours()).padStart(2, '0')}:00`;
  const booked = rows.filter((b) => b.status === 'booked');
  const thisHour = booked.filter((b) => b.slotTime === hh).length;
  const nextHour = booked.filter((b) => b.slotTime > hh).sort((a, b) => a.slotTime.localeCompare(b.slotTime))[0]?.slotTime || null;
  const floor = centre?.yard ? Math.round(((Number(centre.yard.floorUsedQ) || 0) / Math.max(1, Number(centre.yard.floorCapacityQ) || 1)) * 100) : null;
  return {
    open: dayStatus ? dayStatus.open : true,
    closedReason: dayStatus?.reason || null,
    hours: `${centre?.operatingStartTime || '08:00'} – ${centre?.operatingEndTime || '18:00'}`,
    inside: t.totals.inside,
    paidToday: t.totals.paid,
    doorToPayMedianMin: t.totals.doorToPayMedianMin,
    bottleneck: t.bottleneck,
    thisHourExpected: thisHour,
    nextHourWithPasses: nextHour,
    floorPercent: floor,
    incident: Boolean(centre?.yard?.incident?.active),
    assayRound: centre?.assayRound?.at || null,
    stages: t.stages.filter((s) => !s.optional && !['lift', 'credit'].includes(s.key)).map((s) => ({ key: s.key, waiting: s.waiting, medianMin: s.medianMin })),
  };
}
