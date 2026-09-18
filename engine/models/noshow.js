/*
 * engine/models/noshow.js   (install44)   MODEL C
 * ---------------------------------------------------------------
 * "Will this booking actually turn up?"
 *
 * Method: LOGISTIC REGRESSION - the textbook binary classifier.
 *     z = w · x + b            (weights w, bias b are LEARNED)
 *     P(show) = 1 / (1 + e^-z) (sigmoid: squashes z into 0..1)
 *
 * Features x (all known at booking time, standardised with mean/sd
 * saved next to the weights):
 *   pastNoShowRate  farmer's no-shows / past bookings (0 if new)
 *   pastBookings    how many past bookings (log1p)
 *   leadDays        days between booking and slot date
 *   hour            slot hour (24h)
 *   quintals        declared size (log1p)
 *   bookedViaGate   1 if booked at the gate (already here -> shows)
 *   isSmall         1 if quintals <= 15 (trolley farmers)
 *
 * Weights come from ml/train_noshow.py (scikit-learn) -> params.js.
 * Until the app has real seasons of data they are trained on a
 * synthetic season (ml/make_dataset.py) - say so openly to judges.
 *
 * Pure function - no Firebase, no clock. `nowMs` is passed in.
 */
import PARAMS from './params.js';

export const FEATURES = ['pastNoShowRate', 'pastBookingsLog', 'leadDays', 'hour', 'quintalsLog', 'bookedViaGate', 'isSmall'];

/** Build the feature vector for one booking. */
export function noShowFeatures({ pastNoShows = 0, pastBookings = 0, leadDays = 0, hour = 9, quintals = 20, bookedVia = 'app' }) {
  const pb = Math.max(0, Number(pastBookings) || 0);
  const q = Math.max(1, Number(quintals) || 1);
  return {
    pastNoShowRate: pb ? Math.min(1, (Number(pastNoShows) || 0) / pb) : 0,
    pastBookingsLog: Math.log1p(pb),
    leadDays: Math.max(0, Math.min(14, Number(leadDays) || 0)),
    hour: Number(hour) || 9,
    quintalsLog: Math.log1p(q),
    bookedViaGate: bookedVia === 'gate' ? 1 : 0,
    isSmall: q <= 15 ? 1 : 0,
  };
}

/** P(show) in 0..1 plus the standardised contribution of each feature. */
export function showProbability(input, params = PARAMS.noshow) {
  const x = noShowFeatures(input);
  const w = params?.weights || {};
  const mu = params?.mean || {};
  const sd = params?.std || {};
  let z = Number(params?.bias) || 0;
  const contrib = {};
  FEATURES.forEach((f) => {
    const s = Number(sd[f]) || 1;
    const xs = (x[f] - (Number(mu[f]) || 0)) / s;
    const c = (Number(w[f]) || 0) * xs;
    contrib[f] = Math.round(c * 1000) / 1000;
    z += c;
  });
  const p = 1 / (1 + Math.exp(-z));
  return { pShow: Math.round(p * 1000) / 1000, z: Math.round(z * 1000) / 1000, features: x, contrib };
}

/** Days between two 'YYYY-MM-DD' strings (or a ms timestamp and a date). */
export function leadDaysBetween(bookedAtMs, slotDate) {
  const [y, m, d] = String(slotDate).split('-').map(Number);
  const slot = new Date(y, (m || 1) - 1, d || 1).getTime();
  return Math.max(0, Math.round((slot - bookedAtMs) / 86400000));
}

/**
 * TRAINING in JS (gradient descent) so "Retrain from history" works in
 * the browser without Python. Same maths as scikit-learn's solver,
 * just slower - fine for a few thousand rows.
 * rows = [{ ...featureInputs, showed: 0|1 }]
 */
export function trainNoShow(rows, { epochs = 400, lr = 0.1, l2 = 0.01 } = {}) {
  const X = rows.map((r) => noShowFeatures(r));
  const y = rows.map((r) => (r.showed ? 1 : 0));
  if (X.length < 20) return null;

  const mean = {}, std = {};
  FEATURES.forEach((f) => {
    const v = X.map((x) => x[f]);
    mean[f] = v.reduce((s, a) => s + a, 0) / v.length;
    const var_ = v.reduce((s, a) => s + (a - mean[f]) ** 2, 0) / v.length;
    std[f] = Math.sqrt(var_) || 1;
  });
  const Z = X.map((x) => FEATURES.map((f) => (x[f] - mean[f]) / std[f]));

  const w = FEATURES.map(() => 0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = FEATURES.map(() => 0);
    let gb = 0;
    Z.forEach((z, i) => {
      const p = 1 / (1 + Math.exp(-(z.reduce((s, v, k) => s + v * w[k], 0) + b)));
      const d = p - y[i];
      z.forEach((v, k) => { gw[k] += d * v; });
      gb += d;
    });
    w.forEach((_, k) => { w[k] -= lr * (gw[k] / Z.length + l2 * w[k]); });
    b -= lr * (gb / Z.length);
  }

  // accuracy + log-loss on the training set (report honestly)
  let correct = 0, ll = 0;
  Z.forEach((z, i) => {
    const p = 1 / (1 + Math.exp(-(z.reduce((s, v, k) => s + v * w[k], 0) + b)));
    if ((p >= 0.5 ? 1 : 0) === y[i]) correct += 1;
    ll -= y[i] * Math.log(p + 1e-9) + (1 - y[i]) * Math.log(1 - p + 1e-9);
  });
  const weights = {};
  FEATURES.forEach((f, k) => { weights[f] = Math.round(w[k] * 10000) / 10000; });
  return {
    weights,
    bias: Math.round(b * 10000) / 10000,
    mean,
    std,
    samples: rows.length,
    showRate: Math.round((y.reduce((s, a) => s + a, 0) / y.length) * 1000) / 1000,
    accuracy: Math.round((correct / rows.length) * 1000) / 1000,
    logLoss: Math.round((ll / rows.length) * 1000) / 1000,
    trainedBy: 'js-gd',
  };
}
