/*
 * demo.js - AGROBRIDGE test-database tool. ONE file, one command.
 *
 *   node demo.js                  wipe bookings/queues/auctions/notifications; re-seed 5 mandis
 *                                 + 14 test accounts (5 officers + 9 farmers); keep every other user
 *   node demo.js --users          same, but ALSO delete all users except the 14 test accounts
 *   node demo.js --farmers        same as plain, PLUS the first 4 farmers already holding tokens
 *                                 in today's next open window at Gurugram Grain Market
 *   node demo.js --users --farmers   full clean loop (recommended)
 *
 * Accounts (OTP 1234 for all)  -  install45 team-test set, NO traders:
 *   Officers 9000000001 gate | 02 assay | 03 weighbridge | 04 cashier | 05 admin (code AGB-ADMIN-2026)
 *   Farmers  9100000001 .. 9100000009   (already registered + Aadhaar-verified mock, no tokens)
 *   Need a trader for the auction test? Register one in the app.
 * After running: log out and back in on every phone / browser tab.
 *
 * install41 - capacity is QUINTALS PER HOUR per crop (throughputPerHour), with a
 * 15% buffer, 25% max share per booking, small loads <=15 q may use the buffer.
 * Gurugram wheat 800 q/h is derived from Haryana 2025-26 state figures
 * (74.95 LMT / 44 days / 416 mandis ~ 400 q/h season average; peak day
 * 7.71 LMT ~ 1,850 q/h); Gurugram sits between as a mid-size district yard.
 * Replace with a real figure from a Basai arhtiya when you have one.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, writeBatch, doc, setDoc, getDoc, serverTimestamp, runTransaction,
} = require('firebase/firestore');

// install41: read the key from a local .env file when present (idea from the
// "Remove hardcoded Firebase API key" commit); fall back to the built-in one
// so the script still works on a fresh clone. `.env` is git-ignored.
try { require('dotenv').config(); } catch (e) { /* dotenv not installed - fine */ }
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyA2wEZjWel4hl-DTQnvdYfn_w5cWsl-Jkg',
  authDomain: 'agrobridge-sih26.firebaseapp.com',
  projectId: 'agrobridge-sih26',
  storageBucket: 'agrobridge-sih26.firebasestorage.app',
  messagingSenderId: '857662235864',
  appId: '1:857662235864:web:67ebbe6f9474f0396d23ad',
  measurementId: 'G-8SV41RMRNY',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ARGS = process.argv.slice(2);
const PRUNE_USERS = ARGS.includes('--users');
const SEED_FARMERS = ARGS.includes('--farmers');

/* ============================ 1. mandis ============================ */
// TEAM-TEST SETTING: every mandi runs 00:00-24:00 so the hour-pass rules
// (open / passed / rebook) can be tested at any time of day, even with
// TESTING_MODE=false. Real mandis: set 08:00-18:00 before the final demo.
const centres = [
  {
    id: 'centre_gurugram_01',
    name: 'गुरुग्राम अनाज मंडी (Gurugram Grain Market)',
    address: 'Sector 37, Basai Road, Gurugram, Haryana 122001',
    latitude: 28.4421,
    longitude: 76.9905,
    parallelLanes: 4,
    avgMinutesPerEntry: 12,
    operatingStartTime: '00:00',
    operatingEndTime: '24:00',
    acceptedCrops: ['wheat', 'paddy', 'mustard'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12.5,
    throughputPerHour: { default: 600, wheat: 800, paddy: 600, mustard: 480 },
    bufferPercent: 15,
    maxSharePercent: 25,
    smallLoadQuintals: 15,
    declaredTolerancePercent: 15,
    active: true,
  },
  {
    id: 'centre_sohna_02',
    name: 'सोहना मंडी (Sohna Mandi)',
    address: 'Sohna Road, Sohna, Gurugram, Haryana 122103',
    latitude: 28.2472,
    longitude: 77.0654,
    parallelLanes: 2,
    avgMinutesPerEntry: 15,
    operatingStartTime: '00:00',
    operatingEndTime: '24:00',
    acceptedCrops: ['wheat', 'paddy'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 11,
    throughputPerHour: { default: 300, wheat: 400, paddy: 300 },
    bufferPercent: 15,
    maxSharePercent: 25,
    smallLoadQuintals: 15,
    declaredTolerancePercent: 15,
    active: true,
  },
  {
    id: 'centre_rewari_03',
    name: 'रेवाड़ी नई अनाज मंडी (Rewari New Grain Market)',
    address: 'Circular Road, Rewari, Haryana 123401',
    latitude: 28.1892,
    longitude: 76.6167,
    parallelLanes: 3,
    avgMinutesPerEntry: 10,
    operatingStartTime: '00:00',
    operatingEndTime: '24:00',
    acceptedCrops: ['wheat', 'paddy', 'mustard', 'bajra'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 13,
    throughputPerHour: { default: 400, wheat: 500, paddy: 375, mustard: 300, bajra: 300 },
    bufferPercent: 15,
    maxSharePercent: 25,
    smallLoadQuintals: 15,
    declaredTolerancePercent: 15,
    active: true,
  },
  {
    id: 'centre_pataudi_04',
    name: 'पटौदी मंडी (Pataudi Mandi)',
    address: 'Main Bazaar Road, Pataudi, Gurugram, Haryana 122503',
    latitude: 28.3242,
    longitude: 76.7784,
    parallelLanes: 2,
    avgMinutesPerEntry: 18,
    operatingStartTime: '00:00',
    operatingEndTime: '24:00',
    acceptedCrops: ['paddy', 'wheat'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12,
    throughputPerHour: { default: 150, wheat: 200, paddy: 150 },
    bufferPercent: 15,
    maxSharePercent: 25,
    smallLoadQuintals: 15,
    declaredTolerancePercent: 15,
    active: true,
  },
  {
    id: 'centre_farrukhnagar_05',
    name: 'फर्रुखनगर खरीद केंद्र (Farrukhnagar Procurement Centre)',
    address: 'Jhajjar Road, Farrukhnagar, Gurugram, Haryana 122506',
    latitude: 28.4444,
    longitude: 76.8261,
    parallelLanes: 3,
    avgMinutesPerEntry: 14,
    operatingStartTime: '00:00',
    operatingEndTime: '24:00',
    acceptedCrops: ['paddy', 'wheat', 'bajra'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12.5,
    throughputPerHour: { default: 150, wheat: 200, paddy: 150, bajra: 120 },
    bufferPercent: 15,
    maxSharePercent: 25,
    smallLoadQuintals: 15,
    declaredTolerancePercent: 15,
    active: true,
  },
];

async function seedCentres() {
  for (const c of centres) { const { id, ...data } = c; await setDoc(doc(db, 'centres', id), data); }
  console.log(`  centres: ${centres.length} mandis written`);
}

/* ============================ 2. wipe ============================ */
const WIPE = ['bookings', 'centreQueues', 'auctions', 'delays', 'notifications', 'feedback'];
const KEEP_PHONES = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005', '9100000001', '9100000002', '9100000003', '9100000004', '9100000005', '9100000006', '9100000007', '9100000008', '9100000009'];

async function wipe(name) {
  const snap = await getDocs(collection(db, name));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  ${name}: deleted ${snap.docs.length}`);
}

async function pruneUsers() {
  const snap = await getDocs(collection(db, 'users'));
  const batch = writeBatch(db);
  let kept = 0, gone = 0;
  snap.docs.forEach((d) => {
    const phone = String(d.data().phone || d.id).replace(/\D/g, '').slice(-10);
    if (KEEP_PHONES.includes(phone)) kept += 1; else { batch.delete(d.ref); gone += 1; }
  });
  if (gone) await batch.commit();
  console.log(`  users: kept ${kept}, deleted ${gone}`);
}

/* ============================ 3. test accounts ============================ */
const CENTRE = { centreId: 'centre_gurugram_01', centreName: 'गुरुग्राम अनाज मंडी (Gurugram Grain Market)' };
const officer = (phone, name, officerDuty, employeeId) => ({
  phone, role: 'officer', name, employeeId, officerDuty, ...CENTRE,
  govIdNumber: null, govIdType: null, licenseNumber: null, businessName: null, isVerified: true, createdAt: serverTimestamp(),
});
const farmer = (phone, name) => ({
  phone, role: 'farmer', name, employeeId: null, officerDuty: null, centreId: null, centreName: null,
  // install45: looks exactly like a farmer who passed the Aadhaar e-KYC mock at registration
  govIdType: 'aadhaar', govIdNumber: `XXXX XXXX ${phone.slice(-4)}`, govIdVerifiedAt: new Date().toISOString(),
  licenseNumber: null, businessName: null, isVerified: true, createdAt: serverTimestamp(),
});
const ACCOUNTS = [
  officer('9000000001', 'Ramesh Kumar', 'gate',        'GGN-GATE-01'),
  officer('9000000002', 'Sunita Yadav', 'assay',       'GGN-QC-01'),
  officer('9000000003', 'Mahesh Saini', 'weighbridge', 'GGN-WB-01'),
  officer('9000000004', 'Pooja Sharma', 'accounts',    'GGN-ACC-01'),
  officer('9000000005', 'Vikram Singh', 'admin',       'GGN-ADM-01'),
  farmer('9100000001', 'Balwant Singh'),
  farmer('9100000002', 'Om Prakash'),
  farmer('9100000003', 'Sarita Devi'),
  farmer('9100000004', 'Jagdish Yadav'),
  farmer('9100000005', 'Meena Kumari'),
  farmer('9100000006', 'Harpreet Kaur'),
  farmer('9100000007', 'Rajender Malik'),
  farmer('9100000008', 'Kamla Devi'),
  farmer('9100000009', 'Surender Rathi'),
];

async function seedAccounts() {
  for (const u of ACCOUNTS) await setDoc(doc(db, 'users', u.phone), u);
  console.log('  accounts: 5 officers + 9 farmers written (no traders)');
}

/* ============================ 4. fake farmers in today's queue ============================ */
const CENTRE_ID = 'centre_gurugram_01';
const FARMERS = [
  { phone: '9100000001', name: 'Balwant Singh',  crop: 'wheat',   qty: 25, vehicle: 'HR26AB1234' },
  { phone: '9100000002', name: 'Om Prakash',     crop: 'wheat',   qty: 18, vehicle: 'HR55CD5678' },
  { phone: '9100000003', name: 'Sarita Devi',    crop: 'mustard', qty: 12, vehicle: 'HR26EF9012' },
  { phone: '9100000004', name: 'Jagdish Yadav',  crop: 'paddy',   qty: 30, vehicle: 'HR72GH3456' },
];
const CROP_NAME = { wheat: 'गेहूँ (Wheat)', mustard: 'सरसों (Mustard)', paddy: 'धान (Paddy)' };

function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtHour(h) { const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}:00 ${ap}`; }
function tokenLabel(pos) { return `${String.fromCharCode(65 + Math.floor((pos - 1) / 20))}-${String(((pos - 1) % 20) + 1).padStart(2, '0')}`; }


function capOf(centre, crop) {
  const t = centre.throughputPerHour || {};
  const throughput = Number(t[crop]) || Number(t.default) || 400;
  const buffer = Number.isFinite(Number(centre.bufferPercent)) ? Number(centre.bufferPercent) : 15;
  const share = Number(centre.maxSharePercent) || 25;
  return {
    throughput, bookableMinutes: Math.round(60 * (1 - buffer / 100)), shareMinutes: Math.max(1, Math.round(60 * share / 100)),
    small: Number.isFinite(Number(centre.smallLoadQuintals)) ? Number(centre.smallLoadQuintals) : 15,
    vehicleCap: Math.max(1, Math.floor((60 / (Number(centre.avgMinutesPerEntry) || 15)) * (Number(centre.parallelLanes) || 1))),
  };
}
const r1 = (n) => Math.round(n * 10) / 10;

async function seedFarmers() {
  const cSnap = await getDoc(doc(db, 'centres', CENTRE_ID));
  if (!cSnap.exists()) { console.error('Centre missing'); process.exit(1); }
  const centre = cSnap.data();
  const lanes = Number(centre.parallelLanes) || 1;
  const perEntry = Number(centre.avgMinutesPerEntry) || 15;
  const [startH] = String(centre.operatingStartTime || '08:00').split(':').map(Number);
  const [endH] = String(centre.operatingEndTime || '18:00').split(':').map(Number);

  const date = localDate();
  const nowH = new Date().getHours();
  let hour = Math.max(startH, nowH + 1);
  if (hour >= endH) hour = startH;
  const slotTime = `${String(hour).padStart(2, '0')}:00`;
  const slotWindow = `${fmtHour(hour)} - ${fmtHour(hour + 1)}`;

  // farmer accounts are already written by seedAccounts() (with Aadhaar mock) - nothing to do here

  const qRef = doc(db, 'centreQueues', `${CENTRE_ID}__${date}`);
  for (let i = 0; i < FARMERS.length; i += 1) {
    const f = FARMERS[i];
    const tokenId = `TKN-${Date.now()}-${100 + i}`;
    const gatePassCode = String(100000 + Math.floor(Math.random() * 900000));
    const cap = capOf(centre, f.crop);
    const loadMinutes = Math.max(1, r1((f.qty / cap.throughput) * 60));
    await runTransaction(db, async (tx) => {
      const qs = await tx.get(qRef);
      const q = qs.exists() ? qs.data() : {
        centreId: CENTRE_ID, date, centreName: centre.name, avgMinutesPerEntry: perEntry, parallelLanes: lanes,
        throughputPerHour: centre.throughputPerHour || { default: 400 }, bufferPercent: 15, maxSharePercent: 25, declaredTolerancePercent: 15,
        nowServingPosition: null, nowServingToken: null, nowServingStatus: null,
        lastIssuedPosition: 0, totalBooked: 0, completedCount: 0, openPositions: [], insidePositions: [],
        slotCounts: {}, slotLoadMinutes: {}, slotQuintals: {}, slotActualQuintals: {}, loadByPosition: {},
      };
      const slotCounts = { ...(q.slotCounts || {}) };
      const slotLoadMinutes = { ...(q.slotLoadMinutes || {}) };
      const slotQuintals = { ...(q.slotQuintals || {}) };
      const loadByPosition = { ...(q.loadByPosition || {}) };
      const usedMin = Number(slotLoadMinutes[slotTime]) || 0;
      const limit = f.qty <= cap.small ? 60 : cap.bookableMinutes;
      if (usedMin + loadMinutes > limit || (Number(slotCounts[slotTime]) || 0) >= cap.vehicleCap) throw new Error('window full');
      const position = (Number(q.lastIssuedPosition) || 0) + 1;
      slotCounts[slotTime] = (Number(slotCounts[slotTime]) || 0) + 1;
      slotLoadMinutes[slotTime] = r1(usedMin + loadMinutes);
      slotQuintals[slotTime] = r1((Number(slotQuintals[slotTime]) || 0) + f.qty);
      loadByPosition[position] = { m: loadMinutes, q: f.qty };
      const turn = new Date(); turn.setHours(hour, Math.round(usedMin), 0, 0);
      const finish = new Date(turn.getTime() + Math.ceil(loadMinutes) * 60000);
      const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      tx.set(doc(db, 'bookings', tokenId), {
        tokenId, tokenNumber: tokenLabel(position), positionAssigned: position,
        farmerId: f.phone, farmerName: f.name, farmerPhone: f.phone, vehicleNumber: f.vehicle,
        approxQuantityQuintals: f.qty, declaredQuintals: f.qty, centreId: CENTRE_ID, centreName: centre.name, centreAddress: centre.address || '',
        crop: f.crop, cropName: CROP_NAME[f.crop] || f.crop, date, slotTime, slotWindow, status: 'booked',
        windows: [slotTime], windowLoads: { [slotTime]: loadMinutes }, loadMinutes, throughputUsed: cap.throughput,
        arriveAt: fmt(turn), expectedFinishAt: fmt(finish), bookedVia: 'demo',
        gatePassCode, gatePassQr: `AGB|${tokenId}|${gatePassCode}`, gatePassVerifiedBy: null,
        estimatedTurnTime: fmt(turn),
        gateEntryAt: null, assayAt: null, weighedAt: null, paidAt: null,
        moisturePercent: null, foreignMatterPercent: null, grade: null, assayNotes: '',
        grossWeightQuintals: null, tareWeightQuintals: null, actualQuantity: null, quantityVariancePercent: null, overDeclaredTolerance: false,
        priceMode: null, priceFixedAt: null, buyerId: null, buyerName: null,
        ratePerQuintal: null, grossAmount: null, mandiFee: null, commission: null, hamali: null, netPayable: null,
        receiptId: null, receiptGeneratedAt: null, paymentReference: null,
        delayOffsetMinutes: 0, delayReason: '', createdAt: new Date(Date.now() - (FARMERS.length - i) * 60000).toISOString(),
      });
      tx.set(qRef, {
        ...q, lastIssuedPosition: position, totalBooked: (Number(q.totalBooked) || 0) + 1,
        openPositions: [...(q.openPositions || []), position], insidePositions: q.insidePositions || [],
        slotCounts, slotLoadMinutes, slotQuintals, loadByPosition, updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log(`  ${tokenLabel(position)}  ${f.name.padEnd(14)} ${f.crop.padEnd(8)} ${String(f.qty).padStart(3)} q  ${loadMinutes} min  arrive ${fmt(turn)}`);
    });
  }
  console.log(`Done: ${FARMERS.length} farmers waiting at Gurugram Grain Market, ${date} ${slotWindow}.`);
  console.log('Now register YOUR farmer in the app and book that same hour -> you are next in line.');
}

/* ============================ run ============================ */
(async () => {
  console.log('==> mandis');        await seedCentres();
  console.log('==> clearing');      for (const c of WIPE) await wipe(c);
  if (PRUNE_USERS) await pruneUsers(); else console.log('  users: untouched (add --users to prune)');
  console.log('==> test accounts'); await seedAccounts();
  if (SEED_FARMERS) { console.log("==> fake farmers in today's queue"); await seedFarmers(); }
  console.log('');
  console.log('READY. Log out + back in on the phone and in every browser tab.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
