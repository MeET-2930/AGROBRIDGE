/*
 * engine/models/correction.js   (install44)   MODEL A
 * ---------------------------------------------------------------
 * "Farmer says 80 quintals - how much will actually arrive?"
 *
 * Method: BAYESIAN SHRINKAGE (empirical Bayes).
 *   ratio = (n * farmerAvg + k * cropPrior) / (n + k)
 *     n          visits of this farmer where we know declared AND actual
 *     farmerAvg  his average actual/declared over those visits
 *     cropPrior  the crowd's average ratio for this crop (learned)
 *     k          "visits needed before we trust him over the crowd" (learned)
 *
 * With 0 visits he gets the crowd ratio; with many visits he gets his
 * own. One fluke visit cannot swing the estimate - same idea as a
 * batting average early in the season.
 *
 * Learned numbers live in ./params.js (cropPrior per crop, k).
 * Pure function: same code in browser today, on the server tomorrow.
 */
import PARAMS from './params.js';

export const RATIO_MIN = 0.85;
export const RATIO_MAX = 1.30;

/**
 * history = [{ declared, actual }] for THIS farmer (any crop, most recent first)
 * Returns { ratio, n, farmerAvg, prior, k, source }
 */
export function correctionRatio(cropId, history = [], params = PARAMS.correction) {
  const key = String(cropId || '').toLowerCase();
  const prior = Number(params?.cropPrior?.[key]) || Number(params?.cropPrior?.default) || 1;
  const k = Math.max(0.1, Number(params?.k) || 3);

  const rows = (history || [])
    .map((h) => ({ d: Number(h.declared) || 0, a: Number(h.actual) || 0 }))
    .filter((h) => h.d > 0 && h.a > 0)
    .slice(0, 20);                                   // only the last 20 visits matter
  const n = rows.length;
  const farmerAvg = n ? rows.reduce((s, r) => s + r.a / r.d, 0) / n : prior;

  const raw = (n * farmerAvg + k * prior) / (n + k);
  const ratio = Math.round(Math.min(RATIO_MAX, Math.max(RATIO_MIN, raw)) * 1000) / 1000;

  return { ratio, n, farmerAvg: Math.round(farmerAvg * 1000) / 1000, prior, k, source: n ? 'farmer+crowd' : 'crowd' };
}

/** Expected quintals for one booking. */
export function expectedQuintals(declared, cropId, history, params) {
  const { ratio } = correctionRatio(cropId, history, params);
  return Math.round(Number(declared) * ratio * 10) / 10;
}

/**
 * TRAINING (Model A). Given all bookings with declared+actual, learn
 * cropPrior per crop and k by leave-one-out: pick the k that best
 * predicts each farmer's next visit from his previous ones.
 * Runs in the browser ("Retrain from history") or in Node.
 */
export function trainCorrection(rows) {
  const clean = rows
    .map((r) => ({ farmer: r.farmerId, crop: String(r.crop || '').toLowerCase(), d: Number(r.declared) || 0, a: Number(r.actual) || 0 }))
    .filter((r) => r.d > 0 && r.a > 0 && r.farmer);
  if (!clean.length) return { cropPrior: { default: 1.05 }, k: 3, samples: 0, mae: null };

  const byCrop = {};
  clean.forEach((r) => { (byCrop[r.crop] = byCrop[r.crop] || []).push(r.a / r.d); });
  const cropPrior = { default: mean(clean.map((r) => r.a / r.d)) };
  Object.keys(byCrop).forEach((c) => { if (byCrop[c].length >= 5) cropPrior[c] = round3(mean(byCrop[c])); });
  cropPrior.default = round3(cropPrior.default);

  // choose k in {0.5,1,2,3,5,8,12} by sequential prediction error
  const byFarmer = {};
  clean.forEach((r) => { (byFarmer[r.farmer] = byFarmer[r.farmer] || []).push(r); });
  let best = { k: 3, mae: Infinity };
  [0.5, 1, 2, 3, 5, 8, 12].forEach((k) => {
    let err = 0, cnt = 0;
    Object.values(byFarmer).forEach((visits) => {
      for (let i = 1; i < visits.length; i++) {
        const hist = visits.slice(0, i).map((v) => ({ declared: v.d, actual: v.a }));
        const { ratio } = correctionRatio(visits[i].crop, hist, { cropPrior, k });
        err += Math.abs(visits[i].d * ratio - visits[i].a) / visits[i].a;
        cnt += 1;
      }
    });
    const mae = cnt ? err / cnt : Infinity;
    if (mae < best.mae) best = { k, mae };
  });
  return { cropPrior, k: best.k, samples: clean.length, mae: Number.isFinite(best.mae) ? round3(best.mae) : null };
}

function mean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
function round3(n) { return Math.round(n * 1000) / 1000; }
