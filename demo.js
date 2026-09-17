/*
 * demo.js - AGROBRIDGE test-database tool. ONE file, one command.
 *
 *   node demo.js                  wipe bookings/queues/auctions/notifications; re-seed 5 mandis
 *                                 + 8 test accounts; keep every other user
 *   node demo.js --users          same, but ALSO delete all users except the 8 test accounts
 *   node demo.js --farmers        same as plain, PLUS 4 fake farmers already holding tokens
 *                                 in today's next open window at Gurugram Grain Market
 *   node demo.js --users --farmers   full clean loop (recommended)
 *
 * Accounts (OTP 1234 for all):
 *   Officers 9000000001 gate | 02 assay | 03 weighbridge | 04 cashier | 05 admin (code AGB-ADMIN-2026)
 *   Traders  9100000001 / 02 / 03        Fake farmers (with --farmers) 9800000001..04
 *   Your own farmer: register in the app.
 * After running: log out and back in on every phone / browser tab.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, writeBatch, doc, setDoc, getDoc, serverTimestamp, runTransaction,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyA2wEZjWel4hl-DTQnvdYfn_w5cWsl-Jkg',
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
const centres = [
  {
    id: 'centre_gurugram_01',
    name: 'गुरुग्राम अनाज मंडी (Gurugram Grain Market)',
    address: 'Sector 37, Basai Road, Gurugram, Haryana 122001',
    latitude: 28.4421,
    longitude: 76.9905,
    parallelLanes: 4,
    avgMinutesPerEntry: 12,
    operatingStartTime: '08:00',
    operatingEndTime: '18:00',
    acceptedCrops: ['wheat', 'paddy', 'mustard'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12.5,
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
    operatingStartTime: '09:00',
    operatingEndTime: '17:00',
    acceptedCrops: ['wheat', 'paddy'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 11,
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
    operatingStartTime: '07:30',
    operatingEndTime: '19:00',
    acceptedCrops: ['wheat', 'paddy', 'mustard', 'bajra'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 13,
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
    operatingStartTime: '08:30',
    operatingEndTime: '16:30',
    acceptedCrops: ['paddy', 'wheat'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12,
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
    operatingStartTime: '08:00',
    operatingEndTime: '18:00',
    acceptedCrops: ['paddy', 'wheat', 'bajra'],
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12.5,
    active: true,
  },
];

async function seedCentres() {
  for (const c of centres) { const { id, ...data } = c; await setDoc(doc(db, 'centres', id), data); }
  console.log(`  centres: ${centres.length} mandis written`);
}

/* ============================ 2. wipe ============================ */
const WIPE = ['bookings', 'centreQueues', 'auctions', 'delays', 'notifications', 'feedback'];
const KEEP_PHONES = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005', '9100000001', '9100000002', '9100000003'];

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
const trader = (phone, name, businessName, licenseNumber) => ({
  phone, role: 'trader', name, employeeId: null, officerDuty: null, ...CENTRE,
  govIdNumber: null, govIdType: null, licenseNumber, businessName, isVerified: true, createdAt: serverTimestamp(),
});
const ACCOUNTS = [
  officer('9000000001', 'Ramesh Kumar', 'gate',        'GGN-GATE-01'),
  officer('9000000002', 'Sunita Yadav', 'assay',       'GGN-QC-01'),
  officer('9000000003', 'Mahesh Saini', 'weighbridge', 'GGN-WB-01'),
  officer('9000000004', 'Pooja Sharma', 'accounts',    'GGN-ACC-01'),
  officer('9000000005', 'Vikram Singh', 'admin',       'GGN-ADM-01'),
  trader('9100000001', 'Suresh Agarwal', 'Agarwal Grain Traders', 'HR-GGN-T-1001'),
  trader('9100000002', 'Anil Gupta',     'Gupta & Sons Arhtiya',  'HR-GGN-T-1002'),
  trader('9100000003', 'Kavita Jain',    'Jain Agro Commission',  'HR-GGN-T-1003'),
];

async function seedAccounts() {
  for (const u of ACCOUNTS) await setDoc(doc(db, 'users', u.phone), u);
  console.log('  accounts: 5 officers + 3 traders written');
}

/* ============================ 4. fake farmers in today's queue ============================ */
const CENTRE_ID = 'centre_gurugram_01';
const FARMERS = [
  { phone: '9800000001', name: 'Balwant Singh',  crop: 'wheat',   qty: 25, vehicle: 'HR26AB1234' },
  { phone: '9800000002', name: 'Om Prakash',     crop: 'wheat',   qty: 18, vehicle: 'HR55CD5678' },
  { phone: '9800000003', name: 'Sarita Devi',    crop: 'mustard', qty: 12, vehicle: 'HR26EF9012' },
  { phone: '9800000004', name: 'Jagdish Yadav',  crop: 'paddy',   qty: 30, vehicle: 'HR72GH3456' },
];
const CROP_NAME = { wheat: 'गेहूँ (Wheat)', mustard: 'सरसों (Mustard)', paddy: 'धान (Paddy)' };

function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtHour(h) { const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}:00 ${ap}`; }
function tokenLabel(pos) { return `${String.fromCharCode(65 + Math.floor((pos - 1) / 20))}-${String(((pos - 1) % 20) + 1).padStart(2, '0')}`; }


async function seedFarmers() {

  const cSnap = await getDoc(doc(db, 'centres', CENTRE_ID));
  if (!cSnap.exists()) { console.error('Centre missing - run: node seedCentres.js'); process.exit(1); }
  const centre = cSnap.data();
  const lanes = Number(centre.parallelLanes) || 1;
  const perEntry = Number(centre.avgMinutesPerEntry) || 15;
  const capacity = Math.max(1, Math.floor((60 / perEntry) * lanes));
  const [startH] = String(centre.operatingStartTime || '08:00').split(':').map(Number);
  const [endH] = String(centre.operatingEndTime || '18:00').split(':').map(Number);

  const date = localDate();
  const nowH = new Date().getHours();
  // first window still open today (the app hides past windows unless TESTING_MODE);
  // if the day is over, use the first window - the app's TESTING_MODE shows it anyway.
  let hour = Math.max(startH, nowH + 1);
  if (hour >= endH) hour = startH;
  const slotTime = `${String(hour).padStart(2, '0')}:00`;
  const slotWindow = `${fmtHour(hour)} - ${fmtHour(hour + 1)}`;
  if (FARMERS.length >= capacity) console.log(`  note: window capacity is ${capacity}; seeding ${FARMERS.length} leaves ${capacity - FARMERS.length} place(s) for you`);

  // farmer user docs (so officer screens can show names; OTP 1234 works for them too)
  for (const f of FARMERS) {
    await setDoc(doc(db, 'users', f.phone), {
      phone: f.phone, role: 'farmer', name: f.name, employeeId: null, officerDuty: null,
      centreId: null, centreName: null, govIdNumber: null, govIdType: null,
      licenseNumber: null, businessName: null, isVerified: false, createdAt: serverTimestamp(),
    }, { merge: true });
  }

  const qRef = doc(db, 'centreQueues', `${CENTRE_ID}__${date}`);
  for (let i = 0; i < FARMERS.length; i += 1) {
    const f = FARMERS[i];
    const tokenId = `TKN-${Date.now()}-${100 + i}`;
    const gatePassCode = String(100000 + Math.floor(Math.random() * 900000));
    await runTransaction(db, async (tx) => {
      const qs = await tx.get(qRef);
      const q = qs.exists() ? qs.data() : {
        centreId: CENTRE_ID, date, centreName: centre.name, avgMinutesPerEntry: perEntry, parallelLanes: lanes,
        nowServingPosition: null, nowServingToken: null, nowServingStatus: null,
        lastIssuedPosition: 0, totalBooked: 0, completedCount: 0, openPositions: [], insidePositions: [], slotCounts: {},
      };
      const slotCounts = { ...(q.slotCounts || {}) };
      const used = Number(slotCounts[slotTime]) || 0;
      if (used >= capacity) throw new Error('window full');
      const position = (Number(q.lastIssuedPosition) || 0) + 1;
      slotCounts[slotTime] = used + 1;
      const turn = new Date(); turn.setHours(hour, Math.round((used * perEntry) / lanes), 0, 0);
      tx.set(doc(db, 'bookings', tokenId), {
        tokenId, tokenNumber: tokenLabel(position), positionAssigned: position,
        farmerId: f.phone, farmerName: f.name, farmerPhone: f.phone, vehicleNumber: f.vehicle,
        approxQuantityQuintals: f.qty, centreId: CENTRE_ID, centreName: centre.name, centreAddress: centre.address || '',
        crop: f.crop, cropName: CROP_NAME[f.crop] || f.crop, date, slotTime, slotWindow, status: 'booked',
        gatePassCode, gatePassQr: `AGB|${tokenId}|${gatePassCode}`, gatePassVerifiedBy: null,
        estimatedTurnTime: turn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        gateEntryAt: null, assayAt: null, weighedAt: null, paidAt: null,
        moisturePercent: null, foreignMatterPercent: null, grade: null, assayNotes: '',
        grossWeightQuintals: null, tareWeightQuintals: null, actualQuantity: null,
        priceMode: null, priceFixedAt: null, buyerId: null, buyerName: null,
        ratePerQuintal: null, grossAmount: null, mandiFee: null, commission: null, hamali: null, netPayable: null,
        receiptId: null, receiptGeneratedAt: null, paymentReference: null,
        delayOffsetMinutes: 0, delayReason: '', createdAt: new Date(Date.now() - (FARMERS.length - i) * 60000).toISOString(),
      });
      tx.set(qRef, {
        ...q, centreId: CENTRE_ID, date, centreName: centre.name, avgMinutesPerEntry: perEntry, parallelLanes: lanes,
        lastIssuedPosition: position, totalBooked: (Number(q.totalBooked) || 0) + 1,
        openPositions: [...(q.openPositions || []), position], insidePositions: q.insidePositions || [],
        slotCounts, updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log(`  ${tokenLabel(position)}  ${f.name.padEnd(14)} ${f.crop.padEnd(8)} ${f.qty} q   window ${slotWindow}`);
    });
  }
  console.log(`Done: ${FARMERS.length} farmers waiting at Gurugram Grain Market, ${date} ${slotWindow}.`);
  console.log('Now register YOUR farmer in the app and book that same window -> you are next in line.');
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
