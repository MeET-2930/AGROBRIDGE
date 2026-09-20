/*
 * services/govRail.js   (install55)
 * ---------------------------------------------------------------
 * THE GOVERNMENT-RAIL ADAPTER  -  mock today, real API later.
 *
 * AgroBridge does not replace the state systems; it sits on them:
 *   MFMB / Anaaj Kharid / e-Uparjan   who may sell (farmer, land, crop, bank)
 *   e-NAM                              yard instruments (gate entry, e-assay,
 *                                      e-weighment, e-payment)
 *   e-Kharid / Anaaj Kharid            H-form, I-form, J-form, DBT status
 *   District cluster rule              may a pass be used at another mandi?
 *
 * Every function here returns OUR shapes. Screens call these and never
 * touch a government API directly, so switching MOCK -> real is one
 * file. Just like the Aadhaar e-KYC mock (services/aadhaar.js): the
 * demo data is obviously fake and always labelled `source: 'demo'`.
 * ---------------------------------------------------------------
 */
export const RAIL_MODE = 'demo';   // 'demo' | 'live'  (live needs state API keys - see BLAZE_LATER.md)

export const RAILS = {
  mfmb:    { id: 'mfmb',    name: 'Meri Fasal Mera Byora (Haryana)', kind: 'registration', portal: 'fasal.haryana.gov.in' },
  anaaj:   { id: 'anaaj',   name: 'Anaaj Kharid (Punjab)',            kind: 'registration', portal: 'anaajkharid.in' },
  uparjan: { id: 'uparjan', name: 'e-Uparjan (MP)',                   kind: 'registration', portal: 'mpeuparjan.nic.in' },
  enam:    { id: 'enam',    name: 'e-NAM',                            kind: 'instruments',  portal: 'enam.gov.in' },
  ekharid: { id: 'ekharid', name: 'e-Kharid (Haryana)',               kind: 'purchase',     portal: 'ekharid.haryana.gov.in' },
};

/** Typical yield used for the area-based quantity ceiling (q/acre). Admin may override per centre. */
export const YIELD_Q_PER_ACRE = { wheat: 20, paddy: 25, mustard: 8, bajra: 10, maize: 12, gram: 6, cotton: 8, default: 15 };
export const CEILING_TOLERANCE = 1.2;   // 20 % over the area estimate before we warn

/** FAQ limits the inspector applies (GoI uniform specifications). */
export const FAQ_LIMITS = {
  wheat:   { moistureMax: 12, foreignMax: 0.75, label: 'FAQ wheat: moisture ≤ 12 %, foreign matter ≤ 0.75 %' },
  paddy:   { moistureMax: 17, foreignMax: 1,    label: 'FAQ paddy: moisture ≤ 17 %, foreign matter ≤ 1 %' },
  mustard: { moistureMax: 8,  foreignMax: 2,    label: 'FAQ mustard: moisture ≤ 8 %, foreign matter ≤ 2 %' },
  bajra:   { moistureMax: 12, foreignMax: 1,    label: 'FAQ bajra: moisture ≤ 12 %, foreign matter ≤ 1 %' },
  maize:   { moistureMax: 14, foreignMax: 1,    label: 'FAQ maize: moisture ≤ 14 %, foreign matter ≤ 1 %' },
  default: { moistureMax: 12, foreignMax: 1,    label: 'FAQ: moisture ≤ 12 %, foreign matter ≤ 1 %' },
};
export function faqFor(crop) { return FAQ_LIMITS[String(crop || '').toLowerCase()] || FAQ_LIMITS.default; }

/* ------------------------------------------------------------------ */
/*  deterministic fake data (same reg no. -> same farmer, every time)  */
/* ------------------------------------------------------------------ */
function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
const VILLAGES = ['Basai', 'Daultabad', 'Garhi Harsaru', 'Kadipur', 'Wazirpur', 'Sultanpur', 'Farrukhnagar', 'Pataudi'];
const CROPS = [['wheat', 'mustard'], ['wheat'], ['paddy', 'wheat'], ['wheat', 'bajra'], ['paddy']];

/** Accepts "MFMB-XXXXXXXX", "HR-1234-5678", 8-14 alphanumerics. Family-ID (PPP) also 8 digits. */
export function isValidRegNo(regNo) {
  const s = String(regNo || '').trim().toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{8,14}$/.test(s);
}

/**
 * Registration rail: farmer record for this season.
 * Real: GET /api/farmer/{regNo} on the state portal (needs department key).
 */
export async function getFarmerRecord(regNo, { name = '', rail = 'mfmb' } = {}) {
  await new Promise((r) => setTimeout(r, 600));                  // feels like a network call
  if (!isValidRegNo(regNo)) { const e = new Error('Invalid registration number'); e.key = 'err.badRegNo'; throw e; }
  const h = hash(regNo);
  const crops = CROPS[h % CROPS.length];
  const acres = {};
  crops.forEach((c, i) => { acres[c] = 1 + ((h >> (i * 4)) % 9); });     // 1..9 acres per crop
  return {
    source: 'demo', rail, regNo: String(regNo).trim().toUpperCase(),
    name: name || null,
    village: VILLAGES[h % VILLAGES.length], district: 'Gurugram', state: 'Haryana',
    season: 'Rabi 2026-27',
    crops, registeredAcres: acres,
    assignedCentreId: 'centre_gurugram_01',
    bankVerified: h % 7 !== 0,             // 1 in 7 demo farmers has an unverified bank -> J-form will stall
    bankLast4: String(1000 + (h % 9000)),
    fetchedAt: new Date().toISOString(),
  };
}

/** Quantity the registered area supports, for the ceiling warning. */
export function areaCeilingQuintals(registeredAcres, crop, yields = YIELD_Q_PER_ACRE) {
  const acres = Number(registeredAcres?.[crop]) || 0;
  if (!acres) return null;
  const y = Number(yields?.[crop]) || Number(yields?.default) || YIELD_Q_PER_ACRE.default;
  return Math.round(acres * y * CEILING_TOLERANCE);
}

/**
 * e-NAM instruments. In a connected yard these arrive by webhook
 * (POST /rail/enam/weighment -> recordWeighing). Today the officer types
 * the value and we WRAP it so the record looks identical either way.
 */
export function wrapInstrument(kind, value) {
  return { kind, source: RAIL_MODE === 'live' ? 'enam' : 'manual', at: new Date().toISOString(), ...value };
}
export function newLotId(centreId, date) {
  return `LOT-${String(centreId || 'C').slice(-4).toUpperCase()}-${String(date || '').replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Purchase rail: J-form / payment status timeline.
 * Real: e-Kharid farmer ledger. Demo: plausible timeline from the J-form time.
 */
export async function getJFormStatus(jformNo, jformAt) {
  await new Promise((r) => setTimeout(r, 400));
  const t0 = jformAt ? new Date(jformAt).getTime() : Date.now();
  const h = hash(jformNo || 'x');
  return {
    source: 'demo', jformNo,
    steps: [
      { key: 'jform',   at: new Date(t0).toISOString(), done: true },
      { key: 'lifted',  at: new Date(t0 + (24 + (h % 48)) * 3600000).toISOString(), done: false },
      { key: 'pfms',    at: null, done: false },
      { key: 'credited', at: null, done: false },
    ],
    note: 'DBT is released after the lot reaches the warehouse (lifting).',
  };
}

/**
 * install59: PAYMENT rail (mock PFMS / bank).
 * Real: PFMS/bank sends a credit confirmation (webhook) with a UTR after the
 * DBT batch clears (48-72 h). Demo: the confirmation is "due" MOCK_CREDIT_MS
 * after Mark paid, and settleDueCredits() (bookings.js) applies it lazily
 * whenever a screen loads paid lots. Nobody in the mandi presses a button.
 * Swap point: replace bankConfirm() with the webhook handler on our server.
 */
export const MOCK_CREDIT_MS = 2 * 60 * 1000;      // demo: 2 minutes (real DBT: 48-72 h)
export function bankConfirm(booking, nowMs = Date.now()) {
  const due = booking.creditDueAt ? new Date(booking.creditDueAt).getTime() : NaN;
  if (!Number.isFinite(due) || nowMs < due) return null;
  const h = hash(String(booking.tokenId || booking.jformNo || 'x'));
  return { creditedAt: new Date(due).toISOString(), utr: booking.utr || `PFMS${String(h).padStart(6, '0')}${String(due).slice(-6)}`, creditSource: 'mock-pfms' };
}

/** District cluster rule: may a pass from A be honoured at B? Demo: same clusterId. */
export function transferAllowed(fromCentre, toCentre) {
  const ok = (fromCentre?.clusterId || 'default') === (toCentre?.clusterId || 'default');
  return { allowed: ok, source: 'demo', rule: 'same district cluster (Haryana allowed any centre in district during 2020 season)' };
}
