/*
 * engine/models/throughput.js   (install44)   MODEL B
 * ---------------------------------------------------------------
 * "How many quintals does this weighbridge REALLY clear per hour?"
 *
 * Method: EXPONENTIALLY WEIGHTED MOVING AVERAGE (EWMA), one series per
 * hour-of-day (9 AM is not 3 PM).
 *     estimate_today = alpha * observed_today + (1 - alpha) * estimate_yesterday
 * alpha = how much the newest day counts. Learned by BACKTESTING: try
 * several alphas, keep the one that would have predicted past days best.
 *
 * Input rows: bookings with weighedAt (ISO string) and actualQuantity.
 * Output: { perHour: { 9: 312, 10: 340 ... }, overall, alpha, days, mae,
 *           samples, band }  - all quintals per hour.
 *
 * Pure function - no Firebase, no clock.
 */

export const ALPHAS = [0.15, 0.3, 0.5, 0.7];

/** Group weighed quintals by date and local hour. */
export function observedByDayHour(rows) {
  const out = {};                          // { '2026-04-11': { 9: 298, 10: 340 } }
  (rows || []).forEach((r) => {
    if (!r.weighedAt || !(Number(r.actualQuantity) > 0)) return;
    const d = new Date(r.weighedAt);
    if (Number.isNaN(d.getTime())) return;
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = d.getHours();
    out[day] = out[day] || {};
    out[day][h] = (out[day][h] || 0) + Number(r.actualQuantity);
  });
  return out;
}

/** Run EWMA over the day series for one hour; returns final estimate + MAE. */
function ewma(series, alpha) {
  let est = null, err = 0, cnt = 0;
  series.forEach((v) => {
    if (est != null) { err += Math.abs(est - v); cnt += 1; }
    est = est == null ? v : alpha * v + (1 - alpha) * est;
  });
  return { est, mae: cnt ? err / cnt : null, n: series.length };
}

/**
 * Learn throughput. `minDays` = how many observed days an hour needs
 * before we trust its own estimate (else the overall average is used).
 */
export function learnThroughput(rows, { minDays = 2 } = {}) {
  const byDay = observedByDayHour(rows);
  const days = Object.keys(byDay).sort();
  if (!days.length) return { perHour: {}, overall: null, alpha: 0.3, days: 0, samples: 0, mae: null, band: null };

  const hours = Array.from(new Set(days.flatMap((d) => Object.keys(byDay[d]).map(Number)))).sort((a, b) => a - b);

  // choose alpha by total backtest error across all hours
  let best = { alpha: 0.3, mae: Infinity };
  ALPHAS.forEach((a) => {
    let err = 0, cnt = 0;
    hours.forEach((h) => {
      const series = days.map((d) => byDay[d][h]).filter((v) => v != null);
      const r = ewma(series, a);
      if (r.mae != null) { err += r.mae * (r.n - 1); cnt += r.n - 1; }
    });
    const mae = cnt ? err / cnt : Infinity;
    if (mae < best.mae) best = { alpha: a, mae };
  });
  const alpha = best.alpha;

  const perHour = {};
  const all = [];
  hours.forEach((h) => {
    const series = days.map((d) => byDay[d][h]).filter((v) => v != null);
    const r = ewma(series, alpha);
    all.push(...series);
    if (series.length >= minDays) perHour[h] = Math.round(r.est);
  });
  const overall = all.length ? Math.round(all.reduce((s, v) => s + v, 0) / all.length) : null;
  const sd = all.length > 1 ? Math.sqrt(all.reduce((s, v) => s + (v - overall) ** 2, 0) / (all.length - 1)) : 0;

  return {
    perHour,
    overall,
    alpha,
    days: days.length,
    samples: (rows || []).filter((r) => r.weighedAt && Number(r.actualQuantity) > 0).length,
    mae: Number.isFinite(best.mae) ? Math.round(best.mae) : null,
    band: Math.round(sd),
    hours,
  };
}

/**
 * Throughput to use for a given hour: learned value if we have one,
 * otherwise the admin-set number. `mode` = 'set' | 'learned'.
 */
export function effectiveThroughput(setValue, learned, hour, mode = 'set') {
  if (mode !== 'learned' || !learned) return { value: setValue, source: 'set' };
  const h = Number(String(hour).split(':')[0]);
  if (learned.perHour && learned.perHour[h]) return { value: learned.perHour[h], source: 'learned-hour' };
  if (learned.overall) return { value: learned.overall, source: 'learned-overall' };
  return { value: setValue, source: 'set' };
}
