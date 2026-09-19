/*
 * simulate.js  -  AGROBRIDGE mandi SEASON SIMULATOR  (install52)
 * =====================================================================
 * Plays a realistic wheat season at Gurugram Grain Market into your real
 * Firestore, day by day, using the SAME engine files the app uses
 * (engine/capacity.js + engine/models/*). Nothing here is faked inside
 * the models - they only see what a real mandi would record: bookings,
 * weighbridge results and no-shows.
 *
 * Hidden "ground truth" the models do NOT know and must discover:
 *   * the weighbridge does NOT clear a flat 800 q/h all day: it is slower
 *     at opening, drops at lunch (1 PM) and again after 4 PM         -> Model B
 *   * some farmers always bring more (or less) than they declare        -> Model A
 *   * some farmers are flaky; bookings made many days ahead flop more   -> Model C
 *
 * Usage (run inside ~/projects/AGROBRIDGE):
 *   node simulate.js --reset --days 10          wipe ALL bookings/queues/ML memory of
 *                                               Gurugram, then simulate the last 10 days
 *   node simulate.js --days 10                  same without wiping first
 *   node simulate.js --reset                    ONLY wipe (erase all ML history)
 *   node simulate.js --dry --days 10            simulate in memory, print the report,
 *                                               write NOTHING to Firestore
 * Options: --mandi gurugram|azadpur   (default gurugram)
 *            azadpur = Azadpur APMC Delhi scale (potato/onion/tomato, 12-15k t/day,
 *            ~1,000+ trucks, midnight-noon trading). Dry-run only (no centre doc).
 *          --incident 4,7    day numbers on which the yard BREAKS for 3 hours
 *            (bridge fault: capacity halves 10:00-13:00). Day 4 is also
 *            "reported" by the admin (Report delay) -> excluded from learning;
 *            day 7 is NOT reported -> the automatic outlier guard must catch it.
 *          --lifting-crisis 5,8   lifting trucks drop to 15 % on days 5..8 (Karnal
 *            2021 / Panchkula 2025 style). Every weighed quintal lies on the
 *            FLOOR until lifted; a full floor physically stops unloading.
 *            With the yard model (default) the engine shrinks slots and tells
 *            today's farmers (some cancel & re-book, no penalty). Add
 *            --no-yard to see the blind baseline: same passes issued, farmers
 *            stranded at a full yard ("wheat on the road").
 *          --learn-from 6   day number from which the sim admin switches
 *                           "Use learned" ON (default: half way). Days before
 *                           that run on the flat admin-set q/h, so the report
 *                           shows BEFORE vs AFTER learning side by side.
 *
 * What you get:
 *   1. a day-by-day table in the terminal (and sim-report.txt)
 *   2. real documents in Firestore, so in the app:
 *        Admin (9000000005) -> Capacity engine -> "Retrain from history"
 *        shows learned q/h per hour, Model A error vs declared error, etc.
 *        Farmers 9100000001..09 each have a personality (see FARMER_TRAITS)
 *        so their next booking in the app is corrected by Model A.
 *
 * Today's date is left EMPTY on purpose so your live demo starts clean.
 * Never run this against a production project.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, writeBatch, doc, getDoc, updateDoc, deleteField, query, where,
} = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (e) { /* optional */ }
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyA2wEZjWel4hl-DTQnvdYfn_w5cWsl-Jkg',
  authDomain: 'agrobridge-sih26.firebaseapp.com',
  projectId: 'agrobridge-sih26',
  storageBucket: 'agrobridge-sih26.firebasestorage.app',
  messagingSenderId: '857662235864',
  appId: '1:857662235864:web:67ebbe6f9474f0396d23ad',
  measurementId: 'G-8SV41RMRNY',
};

/* ------------------------------ args ------------------------------ */
const ARGS = process.argv.slice(2);
const flag = (n) => ARGS.includes(n);
const opt = (n, d) => { const i = ARGS.indexOf(n); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : d; };
const RESET = flag('--reset');
const DRY = flag('--dry');
const DAYS = Number(opt('--days', RESET && ARGS.length === 1 ? 0 : 10));
const LEARN_FROM = Number(opt('--learn-from', Math.floor(DAYS / 2) + 1));
const SEED = Number(opt('--seed', 2026));
const MANDI = opt('--mandi', 'gurugram');
const INCIDENTS = String(opt('--incident', '')).split(',').filter(Boolean).map(Number);
const REPORTED_INCIDENTS = INCIDENTS.slice(0, 1);          // first one the admin reports; the rest go unreported
const CRISIS = String(opt('--lifting-crisis', '')).split(',').filter(Boolean).map(Number);   // [from, to]
const CRISIS_FROM = CRISIS[0] || 0, CRISIS_TO = CRISIS[1] || CRISIS[0] || 0;
const NO_YARD = flag('--no-yard');
const inCrisis = (day) => CRISIS_FROM > 0 && day >= CRISIS_FROM && day <= CRISIS_TO;

/* ------------------------------ mandi profiles ------------------------------ */
const PROFILES = {
  gurugram: {
    centreId: 'centre_gurugram_01', crop: 'wheat', cropName: 'गेहूँ (Wheat)',
    hours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    // Real quintals/hour the yard clears (admin believes a flat 800).
    // Shape from Haryana yard practice: slow start, lunch dip, evening fade.
    truth: { 8: 600, 9: 730, 10: 860, 11: 860, 12: 790, 13: 520, 14: 810, 15: 830, 16: 700, 17: 520 },
    setQh: 800, nSynthetic: 140, loads: [15, 20, 25, 30, 40, 45, 50, 60, 60, 80, 100, 120, 150], preferred: [9, 10, 11, 12, 13, 14, 15],
    centre: null,   // read from Firestore
  },
  azadpur: {
    // Azadpur APMC, Delhi - Asia's largest F&V yard. Public figures: 12,000-15,000 t
    // (1.2-1.5 lakh q) arrive per day, ~1,000+ loaded trucks, trading midnight to noon,
    // 22 auction sheds. One AgroBridge "centre" = ONE shed block (the app would run
    // one centre per shed, as it does per mandi). So: 1/22 of the yard ~ 6,000 q/day,
    // 60-70 trucks, 3.5 t (35 q) to 20 t (200 q) each, 00:00-12:00.
    centreId: 'sim_azadpur_shedA', crop: 'potato', cropName: 'आलू (Potato)',
    hours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // truth: unloading crawls till 1 AM (gate jam on GT Karnal Rd), peaks 3-7 AM, dies after 10
    truth: { 0: 350, 1: 450, 2: 620, 3: 720, 4: 760, 5: 760, 6: 720, 7: 640, 8: 560, 9: 480, 10: 360, 11: 260 },
    setQh: 650, nSynthetic: 90, loads: [35, 35, 50, 70, 90, 90, 110, 140, 160, 200], preferred: [1, 2, 3, 4, 5, 6, 7],
    centre: {
      name: 'आज़ादपुर मंडी शेड-A (Azadpur APMC, Shed A)', address: 'GT Karnal Road, Azadpur, Delhi 110033',
      throughputPerHour: { default: 650, potato: 650 }, bufferPercent: 15, maxSharePercent: 25, smallLoadQuintals: 35,
      declaredTolerancePercent: 15, parallelLanes: 6, avgMinutesPerEntry: 10, operatingStartTime: '00:00', operatingEndTime: '12:00',
    },
  },
};
const PROFILE = PROFILES[MANDI];
if (!PROFILE) { console.error(`Unknown --mandi ${MANDI}. Use gurugram or azadpur.`); process.exit(1); }
const CENTRE_ID = PROFILE.centreId;
const CROP = PROFILE.crop;
const CROP_NAME = PROFILE.cropName;
const MANDI_HOURS = PROFILE.hours;
const TRUE_THROUGHPUT = PROFILE.truth;

// The 9 real test farmers get fixed personalities so the app demo is repeatable.
//  ratio  = actual / declared they habitually bring (Model A must learn it)
//  flaky  = base chance of not turning up (Model C)
const FARMER_TRAITS = {
  '9100000001': { name: 'Balwant Singh', ratio: 1.25, flaky: 0.05, qty: 60, note: 'always brings ~25% MORE than declared' },
  '9100000002': { name: 'Om Prakash', ratio: 1.00, flaky: 0.05, qty: 40, note: 'honest declarer' },
  '9100000003': { name: 'Sarita Devi', ratio: 0.85, flaky: 0.08, qty: 30, note: 'brings ~15% LESS' },
  '9100000004': { name: 'Jagdish Yadav', ratio: 1.10, flaky: 0.45, qty: 80, note: 'flaky - misses almost half his slots' },
  '9100000005': { name: 'Ramesh Kumar', ratio: 1.05, flaky: 0.05, qty: 120, note: 'big trolley, reliable' },
  '9100000006': { name: 'Sunita Rani', ratio: 1.15, flaky: 0.10, qty: 25, note: 'small load, slight over' },
  '9100000007': { name: 'Harpal Singh', ratio: 1.30, flaky: 0.05, qty: 50, note: 'heavy over-declarer (+30%)' },
  '9100000008': { name: 'Mahesh Chand', ratio: 0.95, flaky: 0.20, qty: 45, note: 'sometimes flaky' },
  '9100000009': { name: 'Kamla Devi', ratio: 1.00, flaky: 0.05, qty: 20, note: 'small honest load' },
};
const N_SYNTHETIC = PROFILE.nSynthetic;     // extra anonymous farmers to fill the yard

/* ------------------------------ RNG ------------------------------ */
let seed = SEED >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function gauss(mu = 0, sd = 1) { const u = 1 - rnd(), v = rnd(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
const r1 = (n) => Math.round(n * 10) / 10;
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHour = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const tokenLabel = (pos) => `${String.fromCharCode(65 + Math.floor((pos - 1) / 20))}-${pad(((pos - 1) % 20) + 1)}`;

/* ------------------------------ farmers ------------------------------ */
function buildFarmers() {
  const list = Object.entries(FARMER_TRAITS).map(([phone, t]) => ({ id: phone, phone, ...t, real: true }));
  const first = ['Rajender', 'Suresh', 'Dharambir', 'Krishan', 'Satpal', 'Bhagwan', 'Naresh', 'Anil', 'Vinod', 'Jai', 'Ravi', 'Sombir', 'Ishwar', 'Rohtash', 'Mukesh', 'Savitri', 'Santosh', 'Bimla', 'Kavita', 'Rekha'];
  const last = ['Singh', 'Kumar', 'Yadav', 'Devi', 'Sharma', 'Chauhan', 'Rathi', 'Dahiya', 'Saini', 'Malik'];
  for (let i = 0; i < N_SYNTHETIC; i++) {
    // population: 55% honest (0.97-1.05), 30% over-declare (1.08-1.30), 15% under (0.85-0.95)
    const u = rnd();
    const ratio = u < 0.55 ? 0.97 + rnd() * 0.08 : u < 0.85 ? 1.08 + rnd() * 0.22 : 0.85 + rnd() * 0.10;
    const flaky = rnd() < 0.15 ? 0.3 + rnd() * 0.3 : 0.03 + rnd() * 0.09;
    const qty = pick(PROFILE.loads);
    const id = `sim-${pad(i + 1)}`;
    list.push({ id, phone: `98${String(10000000 + i).padStart(8, '0')}`, name: `${pick(first)} ${pick(last)}`, ratio: r1(ratio * 100) / 100, flaky: Math.round(flaky * 100) / 100, qty, real: false });
  }
  return list;
}

/* ------------------------------ main ------------------------------ */
(async () => {
  // engine files are ES modules -> dynamic import (same files the app bundles)
  const cap = await import('./engine/capacity.js');
  const { correctionRatio, trainCorrection } = await import('./engine/models/correction.js');
  const { showProbability, leadDaysBetween, trainNoShow } = await import('./engine/models/noshow.js');
  const { learnThroughput, effectiveThroughput } = await import('./engine/models/throughput.js');
  const yardMod = await import('./engine/yard.js');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let centre = PROFILE.centre;
  if (!centre) {
    const cSnap = await getDoc(doc(db, 'centres', CENTRE_ID));
    if (!cSnap.exists()) { console.error('Gurugram centre missing - run `node demo.js` first.'); process.exit(1); }
    centre = cSnap.data();
  } else if (!DRY) {
    console.error('The azadpur profile is a dry-run benchmark (no such centre in your DB). Add --dry.'); process.exit(1);
  }
  const setQh = cap.throughputFor(centre, CROP);
  console.log(`\nAGROBRIDGE season simulator  ·  ${centre.name}  ·  profile ${MANDI}\n  admin-set throughput ${setQh} q/h (flat)  ·  hidden truth per hour:`, TRUE_THROUGHPUT, INCIDENTS.length ? `\n  breakdown days: ${INCIDENTS.join(', ')} (reported: ${REPORTED_INCIDENTS.join(', ') || 'none'})` : '');

  /* ---- 1. reset (erase ALL ML history for this mandi) ---- */
  if (RESET && !DRY) {
    let n = 0;
    for (const coll of ['bookings', 'centreQueues']) {
      const snap = await getDocs(query(collection(db, coll), where('centreId', '==', CENTRE_ID)));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const b = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      n += docs.length;
    }
    await updateDoc(doc(db, 'centres', CENTRE_ID), { engine: deleteField() });
    console.log(`\n  RESET: deleted ${n} booking/queue documents and the centre's learned memory (centre.engine).`);
  }
  if (!DAYS) { console.log('  No --days given, done.\n'); process.exit(0); }

  /* ---- 2. simulate ---- */
  const farmers = buildFarmers();
  const hist = {};                 // farmerId -> { pairs:[{declared,actual}], n, miss }
  farmers.forEach((f) => { hist[f.id] = { pairs: [], n: 0, miss: 0 }; });
  const allRows = [];              // every booking (for models + Firestore)
  const report = [];
  const slots = MANDI_HOURS.map((h) => `${pad(h)}:00`);
  const baseCap = cap.centreCapacity(centre, CROP);
  let learned = null;              // Model B memory (what "Retrain" would give)
  let localCorr = null;            // Model A memory (this mandi's own prior/k)
  // install52: the FLOOR. Capacity = 1 normal day. Lifting normally clears
  // yesterday's intake; in a crisis only 15 % of it.
  const normalDayQ = baseCap.throughput * MANDI_HOURS.length;
  const yard = { floorCapacityQ: Math.round(normalDayQ * 1.0), floorUsedQ: 0, liftedHistory: [] };
  const LIFT_NORMAL = Math.round(normalDayQ * 0.95);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  // the hour with the deepest true dip - the headline number in the report
  const DIP_HOUR = MANDI_HOURS.reduce((a, h) => (TRUE_THROUGHPUT[h] < TRUE_THROUGHPUT[a] ? h : a), MANDI_HOURS[Math.floor(MANDI_HOURS.length / 2)]);
  const DIP_SLOT = `${pad(DIP_HOUR)}:00`;

  for (let day = 1; day <= DAYS; day++) {
    const d = new Date(today.getTime() - (DAYS - day + 1) * 86400000);
    const ds = dateStr(d);
    const mode = day >= LEARN_FROM && learned?.overall ? 'learned' : 'set';

    // --- install52: what the yard allows today (floor projection made the day before)
    const yf = yardMod.yardFactors(yard);
    const yardFactor = NO_YARD ? 1 : yardMod.floorProjection(yard, [0], normalDayQ).factorByDay[0];
    const incidentToday = !NO_YARD && (yf.incidentLevel === 'hard' || yf.incidentLevel === 'stop');

    // --- booking phase: farmers book until the planner says full (season = saturated yard)
    let queue = {};
    const bookings = [];
    const order = [...farmers].sort(() => rnd() - 0.5);
    let pos = 0;
    for (const f of order) {
      const declared = Math.max(10, Math.round(f.qty * (0.85 + rnd() * 0.3) / 5) * 5);
      const leadDays = pick([0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 6]);
      const createdAt = new Date(d.getTime() - leadDays * 86400000 + (6 + rnd() * 14) * 3600000);
      const fh = hist[f.id];
      const corr = correctionRatio(CROP, fh.pairs, localCorr && localCorr.samples >= 30 ? localCorr : undefined);
      const preferred = pick(PROFILE.preferred);
      let plan = null, chosen = null;
      const startIdx = MANDI_HOURS.indexOf(preferred);
      const tryOrder = [...slots.slice(startIdx), ...slots.slice(0, startIdx)];
      for (const s of tryOrder) {
        const idx = slots.indexOf(s);
        const hour = MANDI_HOURS[idx];
        const show = showProbability({ pastBookings: fh.n, pastNoShows: fh.miss, leadDays, hour, quintals: declared });
        const eff = effectiveThroughput(baseCap.throughput, learned, s, mode);
        const c = yardMod.scaleCapacity({ ...baseCap, throughput: eff.value, throughputSource: eff.source }, yardFactor, 1);
        const p = cap.planLoad(c, slots, queue, idx, declared, { ratio: corr.ratio, pShow: show.pShow, cropClass: 'grain', leadDays });
        if (p.ok) { plan = p; chosen = { s, hour, pShow: show.pShow, ratio: corr.ratio, tp: eff, corrN: corr.n }; break; }
      }
      if (!plan) continue;   // yard full for the day - farmer books another day (not simulated)
      queue = { ...queue, ...cap.applyPlan(queue, plan, declared) };
      pos += 1;
      bookings.push({ f, declared, leadDays, createdAt, plan, ...chosen, position: pos });
    }

    // --- mandi day: ONE continuous clock. Each truck is weighed at the speed of
    // the hour the clock is currently in (a truck spilling from 12:50 into 13:10
    // is finished at 13:00's slower rate). Farmers are served in booked-hour order,
    // and within the hour in arrival order; nobody is served before his hour.
    const hourStat = {};
    MANDI_HOURS.forEach((h) => { hourStat[h] = { booked: 0, arrived: 0, cleared: 0, waitMin: [] }; });
    const byHour = {};
    bookings.forEach((b) => { (byHour[b.hour] = byHour[b.hour] || []).push(b); });
    const midIdx = Math.floor(MANDI_HOURS.length / 2) - 1;
    const rateAt = (clockMin) => {                 // q per minute at this moment (hidden truth + noise + incident)
      const idx = Math.min(MANDI_HOURS.length - 1, Math.floor(clockMin / 60));
      const h = MANDI_HOURS[idx];
      const broken = INCIDENTS.includes(day) && idx >= midIdx && idx < midIdx + 3;
      return (TRUE_THROUGHPUT[h] * dayNoise[idx] * (broken ? 0.5 : 1)) / 60;
    };
    const dayNoise = MANDI_HOURS.map(() => 0.92 + rnd() * 0.16);
    let clock = 0;                                 // minutes since first window opened
    let overtimeQ = 0;
    // install52: physical floor room today = free floor + what trucks lift during the day
    const liftToday = inCrisis(day) ? Math.round(LIFT_NORMAL * 0.15) : LIFT_NORMAL;
    let floorRoom = Math.max(0, yard.floorCapacityQ - yard.floorUsedQ) + liftToday;
    let strandedN = 0, strandedQ = 0, yardCancelN = 0;
    MANDI_HOURS.forEach((h, hi) => {
      const rows = (byHour[h] || []).sort((a, b) => a.plan.offsetMinutes - b.plan.offsetMinutes);
      const hourStart = hi * 60, hourEnd = hourStart + 60;
      if (clock < hourStart) clock = hourStart;    // bridge idle until this hour's farmers may enter
      for (const b of rows) {
        hourStat[h].booked += b.declared;
        // install52: told "yard full - wait or cancel & re-book": 60 % cancel (no penalty, no history mark)
        if (incidentToday && rnd() < 0.6) { b.yardCancel = true; yardCancelN += 1; continue; }
        const pNo = Math.min(0.9, b.f.flaky + 0.04 * b.leadDays);
        b.showed = rnd() > pNo;
        if (!b.showed) { hist[b.f.id].n += 1; hist[b.f.id].miss += 1; continue; }
        b.actual = r1(Math.max(5, b.declared * b.f.ratio * (1 + gauss(0, 0.04))));
        // install52: no floor left -> cannot unload; farmer is STRANDED (sleeps in the mandi, not a no-show)
        if (b.actual > floorRoom) { b.showed = false; b.stranded = true; strandedN += 1; strandedQ += b.actual; continue; }
        floorRoom -= b.actual;
        hourStat[h].arrived += b.actual;
        // weigh this load minute by minute at the current hour's rate
        let left = b.actual;
        while (left > 0) {
          const r = rateAt(clock);
          const step = Math.min(left, r);          // one minute of work
          left -= step; clock += 1;
          const ci = Math.min(MANDI_HOURS.length - 1, Math.floor((clock - 1) / 60));
          hourStat[MANDI_HOURS[ci]].cleared += step;
          if (clock > MANDI_HOURS.length * 60 + 180) break;   // safety: 3 h overtime max
        }
        b.finishedAt = new Date(d);
        b.finishedAt.setHours(MANDI_HOURS[0], 0, 0, 0);
        b.finishedAt = new Date(b.finishedAt.getTime() + clock * 60000 + Math.floor(rnd() * 50) * 1000);
        const over = Math.max(0, clock - hourEnd);
        hourStat[h].waitMin.push(Math.round(over));
        hist[b.f.id].n += 1;
        hist[b.f.id].pairs.unshift({ declared: b.declared, actual: b.actual });
      }
    });
    // whatever is still on the clock past closing = overtime work
    const closeMin = MANDI_HOURS.length * 60;
    overtimeQ = clock > closeMin ? Math.round(rateAt(closeMin - 1) * (clock - closeMin)) : 0;
    MANDI_HOURS.forEach((h) => { hourStat[h].cleared = r1(hourStat[h].cleared); });
    // install52: floor bookkeeping (what the admin's "Record lifting" does)
    const weighedQ = Math.round(bookings.reduce((s, b) => s + (b.actual && !b.stranded ? b.actual : 0), 0));
    const liftedQ = Math.min(yard.floorUsedQ + weighedQ, liftToday);
    const floorStartPct = Math.round((yard.floorUsedQ / yard.floorCapacityQ) * 100);
    yard.floorUsedQ = Math.max(0, yard.floorUsedQ + weighedQ - liftedQ);
    yard.liftedHistory.unshift({ date: ds, q: liftedQ }); yard.liftedHistory = yard.liftedHistory.slice(0, 5);

    // --- rows for Firestore + models
    let declErr = 0, engErr = 0, nW = 0;
    for (const b of bookings) {
      if (b.showed) {
        declErr += Math.abs(b.declared - b.actual) / b.actual;
        engErr += Math.abs(b.plan.reservedQuintals - b.actual) / b.actual;
        nW += 1;
      }
      allRows.push(rowFor(b, ds, centre));
    }
    const waits = Object.values(hourStat).flatMap((s) => s.waitMin);
    const late = waits.filter((w) => w > 0).length;
    const avgWait = waits.length ? Math.round(waits.reduce((a, c) => a + c, 0) / waits.length) : 0;
    const shown = bookings.filter((b) => b.showed).length;
    report.push({
      day, date: ds, mode, booked: bookings.length, showed: shown, noShow: bookings.length - shown,
      declaredQ: Math.round(bookings.reduce((s, b) => s + b.declared, 0)),
      actualQ: Math.round(bookings.reduce((s, b) => s + (b.actual || 0), 0)),
      latePct: shown ? Math.round((late / shown) * 100) : 0, avgWait, overtimeQ: Math.round(overtimeQ),
      declErr: nW ? Math.round((declErr / nW) * 1000) / 10 : null, engErr: nW ? Math.round((engErr / nW) * 1000) / 10 : null,
      predShow: bookings.length ? Math.round((bookings.reduce((s, b) => s + b.pShow, 0) / bookings.length) * 100) : 0,
      realShow: bookings.length ? Math.round((shown / bookings.length) * 100) : 0,
      lunchTp: mode === 'learned' ? effectiveThroughput(setQh, learned, DIP_SLOT, 'learned').value : setQh,
      incident: [INCIDENTS.includes(day) ? (REPORTED_INCIDENTS.includes(day) ? 'BREAKDOWN (reported)' : 'BREAKDOWN (not reported)') : '', inCrisis(day) ? 'LIFTING 15%' : '', incidentToday ? 'yard incident' : ''].filter(Boolean).join(' · '),
      floorPct: floorStartPct, yardFactor: Math.round(yardFactor * 100), stranded: strandedN, strandedQ: Math.round(strandedQ), yardCancel: yardCancelN, liftedQ,
    });

    // --- "nightly retrain" (what the server will do; today the admin presses the button)
    const excludeDays = REPORTED_INCIDENTS.filter((n) => n <= day).map((n) => dateStr(new Date(today.getTime() - (DAYS - n + 1) * 86400000)));
    learned = learnThroughput(allRows.filter((r) => r.weighedAt && r.actualQuantity > 0), { excludeDays });
    localCorr = trainCorrection(allRows.filter((r) => r.actualQuantity > 0).map((r) => ({ farmerId: r.farmerId, crop: r.crop, declared: r.declaredQuintals, actual: r.actualQuantity })));
  }

  /* ---- 3. report ---- */
  const lines = [];
  const P = (s = '') => { lines.push(s); console.log(s); };
  P('\n================= SEASON REPORT =================');
  P(`Days simulated: ${DAYS}  ·  "Use learned" switched ON from day ${LEARN_FROM}  ·  bookings written: ${allRows.length}`);
  P('');
  P(`day  date        mode     booked show  no-show | declared→actual q | farmers late  avg wait  overtime | Model A err: declared / engine | Model C show: predicted / real | ${DIP_SLOT} q/h used${CRISIS_FROM ? ' | floor%  slots  stranded  cancelled' : ''}`);
  report.forEach((r) => {
    const yardCols = CRISIS_FROM ? ` | ${String(r.floorPct + '%').padStart(5)}  ${String(r.yardFactor + '%').padStart(5)}  ${String(r.stranded).padStart(8)}  ${String(r.yardCancel).padStart(9)}` : '';
    P(`${String(r.day).padStart(3)}  ${r.date}  ${r.mode.padEnd(7)}  ${String(r.booked).padStart(5)} ${String(r.showed).padStart(4)}  ${String(r.noShow).padStart(6)} | ${String(r.declaredQ).padStart(6)} → ${String(r.actualQ).padStart(6)}   | ${String(r.latePct + '%').padStart(11)}  ${String(r.avgWait + ' min').padStart(8)}  ${String(r.overtimeQ + ' q').padStart(8)} | ${String(r.declErr + '%').padStart(12)} / ${String(r.engErr + '%').padStart(6)}      | ${String(r.predShow + '%').padStart(12)} / ${String(r.realShow + '%').padStart(4)}    | ${r.lunchTp}${yardCols}  ${r.incident}`);
  });
  if (CRISIS_FROM) {
    const sum = (k) => report.reduce((s, r) => s + (r[k] || 0), 0);
    const peak = Math.max(...report.map((r) => r.floorPct));
    P('');
    P(`LIFTING CRISIS days ${CRISIS_FROM}-${CRISIS_TO} (trucks at 15 %)  ·  yard model ${NO_YARD ? 'OFF (blind baseline)' : 'ON'}`);
    P(`  farmers who drove in and could NOT unload (stranded at a full yard): ${sum('stranded')}  (${sum('strandedQ')} q)`);
    P(`  farmers told in advance and re-booked without penalty:            ${sum('yardCancel')}`);
    P(`  peak floor: ${peak}%  ·  days with slots reduced: ${report.filter((r) => r.yardFactor < 100).length}  ·  floor at end: ${Math.round((yard.floorUsedQ / yard.floorCapacityQ) * 100)}%`);
    P(NO_YARD
      ? '  (Baseline = today\'s e-Kharid: passes keep coming until someone shuts the gate. Run again without --no-yard.)'
      : '  (Engine counted unlifted stock as occupied capacity, sold fewer passes days ahead, and told today\'s farmers the truth. Compare with --no-yard.)');
  }
  const avg = (rows, k) => rows.length ? Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length * 10) / 10 : 0;
  const before = report.filter((r) => r.mode === 'set'), after = report.filter((r) => r.mode === 'learned');
  P('');
  P('BEFORE learning (flat admin number)   vs   AFTER "Use learned" (Model B per-hour q/h):');
  P(`  farmers finishing late:   ${avg(before, 'latePct')}%   ->   ${avg(after, 'latePct')}%`);
  P(`  average extra wait:       ${avg(before, 'avgWait')} min ->   ${avg(after, 'avgWait')} min`);
  P(`  quintals left after 6 PM: ${avg(before, 'overtimeQ')} q  ->   ${avg(after, 'overtimeQ')} q`);
  P(`  ${DIP_SLOT} hour booked at:    ${setQh} q/h  ->   ${after[after.length - 1]?.lunchTp ?? '-'} q/h on the last day  (truth ${TRUE_THROUGHPUT[DIP_HOUR]})`);
  P('');
  P('Model B - what it learned about each hour (q/h):');
  P('  hour    admin-set   learned   truth   busy days  outliers skipped');
  MANDI_HOURS.forEach((h) => P(`  ${pad(h)}:00     ${String(setQh).padStart(5)}     ${String(learned.perHour[h] ?? '-').padStart(5)}    ${String(TRUE_THROUGHPUT[h]).padStart(4)}      ${String(learned.busyDays?.[h] ?? 0).padStart(3)}         ${learned.incidents?.[h] || 0}`));
  if (INCIDENTS.length) {
    P(`  bad-day guard: ${learned.excludedDays} day(s) excluded because the admin reported a delay; ${Object.values(learned.incidents || {}).reduce((a, b) => a + b, 0)} hour-observations auto-skipped as outliers (< 60% of that hour's usual busy value).`);
  }
  P(`  alpha chosen by backtest: ${learned.alpha}   ·   MAE ${learned.mae} q/h   ·   ${learned.days} days, ${learned.samples} weighings`);
  const lh = MANDI_HOURS.filter((h) => learned.perHour[h]);
  const bias = lh.length ? Math.round(lh.reduce((s, h) => s + (learned.perHour[h] - TRUE_THROUGHPUT[h]) / TRUE_THROUGHPUT[h], 0) / lh.length * 1000) / 10 : 0;
  P(`  average bias of learned vs truth: ${bias}%  (slightly negative is expected: a load finishing at 13:58 is stamped 13:00, one finishing 14:02 is stamped 14:00 - completion-hour counting under-credits busy hours by about one load)`);
  P(`  hours shown "-" never ran over at ${setQh} q/h, so there is no evidence they can do MORE - the admin number stays. Model B only trims DOWN from the admin number; it never books beyond it.`);
  P('');
  P(`Model A - crowd prior for wheat: ${localCorr.cropPrior.wheat ?? localCorr.cropPrior.default}  ·  k = ${localCorr.k}  ·  ${localCorr.samples} declared/actual pairs`);
  P('  test farmers the app will now correct:');
  Object.entries(FARMER_TRAITS).forEach(([ph, t]) => {
    const c = correctionRatio(CROP, hist[ph].pairs, localCorr);
    P(`   ${ph} ${t.name.padEnd(15)} truth ×${t.ratio.toFixed(2)}  learned ×${c.ratio.toFixed(2)} (${c.n} visits)   no-shows ${hist[ph].miss}/${hist[ph].n}   - ${t.note}`);
  });
  P('');
  P('Model A error trend (engine reserved vs actual, per day): ' + report.map((r) => `${r.engErr}%`).join(' → '));
  P('Declared-only error for comparison:                     ' + report.map((r) => `${r.declErr}%`).join(' → '));
  P('=================================================\n');
  const repName = `sim-report-${MANDI}${INCIDENTS.length ? '-incidents' : ''}${CRISIS_FROM ? (NO_YARD ? '-crisis-noyard' : '-crisis') : ''}.txt`;
  fs.writeFileSync(path.join(process.cwd(), repName), lines.join('\n'));
  console.log(`Report saved to ${repName}`);

  /* ---- 4. write to Firestore ---- */
  if (DRY) { console.log('DRY run - nothing written.\n'); process.exit(0); }
  for (let i = 0; i < allRows.length; i += 400) {
    const b = writeBatch(db);
    allRows.slice(i, i + 400).forEach((r) => b.set(doc(db, 'bookings', r.tokenId), r));
    await b.commit();
    process.stdout.write(`  wrote ${Math.min(i + 400, allRows.length)}/${allRows.length}\r`);
  }
  // Leave the centre's learned memory EMPTY: you press "Retrain from history"
  // and "Use learned" yourself in the app, and watch the numbers appear.
  await updateDoc(doc(db, 'centres', CENTRE_ID), { engine: deleteField() });
  console.log(`\n  Done. ${allRows.length} bookings written for ${DAYS} past days. Today is untouched.`);
  console.log('  Next: log in as admin 9000000005 -> Capacity engine -> Retrain from history -> Use learned.\n');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

/* ------------------------------ helpers ------------------------------ */
function rowFor(b, ds, centre) {
  const tokenId = `SIM-${ds.replace(/-/g, '')}-${String(b.position).padStart(3, '0')}`;
  const slotTime = b.s;
  const finished = b.showed ? b.finishedAt : null;
  const iso = (x) => (x ? x.toISOString() : null);
  const entry = b.showed ? new Date(finished.getTime() - (20 + Math.random() * 25) * 60000) : null;
  const rate = CROP === 'wheat' ? 2425 : 1200;   // MSP wheat 2025-26 / potato modal ₹/q
  const gross = b.showed ? Math.round(b.actual * rate) : null;
  return {
    tokenId, tokenNumber: tokenLabel(b.position), positionAssigned: b.position,
    farmerId: b.f.id, farmerName: b.f.name, farmerPhone: b.f.phone, vehicleNumber: null,
    approxQuantityQuintals: b.declared, declaredQuintals: b.declared,
    centreId: CENTRE_ID, centreName: centre.name, centreAddress: centre.address || '',
    crop: CROP, cropName: CROP_NAME, date: ds, slotTime, slotWindow: `${fmtHour(b.hour)} - ${fmtHour(b.hour + 1)}`,
    windows: b.plan.windows, windowLoads: b.plan.windowLoads, loadMinutes: b.plan.loadMinutes, throughputUsed: b.tp.value,
    engine: {
      cropClass: 'grain', leadDays: b.leadDays, ratio: b.ratio, ratioSource: b.corrN ? 'farmer+crowd' : 'crowd', farmerVisits: b.corrN,
      pShow: b.pShow, reservedQuintals: b.plan.reservedQuintals, windowExpected: b.plan.windowExpected,
      throughputSource: b.tp.source, setThroughput: PROFILE.setQh, useCorrection: true, useNoShow: true, throughputMode: b.tp.source === 'set' ? 'set' : 'learned',
      modelVersion: 1, trainedOn: 'simulation',
    },
    arriveAt: fmtHour(b.hour), expectedFinishAt: null, bookedVia: 'app', simulated: true,
    status: b.showed ? 'paid' : b.yardCancel ? 'cancelled' : b.stranded ? 'booked' : 'no-show',
    yardIncidentCancel: Boolean(b.yardCancel), stranded: Boolean(b.stranded),
    gatePassCode: String(100000 + Math.floor(Math.random() * 900000)), gatePassQr: `AGB|${tokenId}|000000`,
    gateEntryAt: iso(entry), assayAt: iso(entry && new Date(entry.getTime() + 8 * 60000)), weighedAt: iso(finished), paidAt: iso(finished && new Date(finished.getTime() + 15 * 60000)),
    noShowAt: b.showed ? null : new Date(`${ds}T${pad(b.hour + 1)}:05:00`).toISOString(),
    moisturePercent: b.showed ? r1(10 + Math.random() * 3) : null, foreignMatterPercent: b.showed ? r1(0.3 + Math.random() * 0.6) : null,
    grade: b.showed ? (CROP === 'wheat' ? 'FAQ' : 'A') : null, assayNotes: '',
    grossWeightQuintals: b.showed ? r1(b.actual + 35) : null, tareWeightQuintals: b.showed ? 35 : null, actualQuantity: b.showed ? b.actual : null,
    vehicleCount: 1,
    quantityVariancePercent: b.showed ? r1(((b.actual - b.declared) / b.declared) * 100) : null,
    overDeclaredTolerance: b.showed ? (b.actual - b.declared) / b.declared > 0.15 : false,
    engineExpectedQuintals: b.plan.reservedQuintals,
    engineErrorPercent: b.showed ? r1(((b.plan.reservedQuintals - b.actual) / b.actual) * 100) : null,
    priceMode: b.showed ? 'msp' : null, ratePerQuintal: b.showed ? rate : null, grossAmount: gross,
    mandiFee: gross ? Math.round(gross * 0.02) : null, commission: gross ? Math.round(gross * 0.025) : null, hamali: gross ? Math.round(b.actual * 12) : null,
    netPayable: gross ? gross - Math.round(gross * 0.02) - Math.round(gross * 0.025) - Math.round(b.actual * 12) : null,
    paymentBasis: b.showed ? 'msp' : null, receiptId: b.showed ? `RCPT-${tokenId}` : null,
    delayOffsetMinutes: 0, delayReason: '', createdAt: b.createdAt.toISOString(),
  };
}
