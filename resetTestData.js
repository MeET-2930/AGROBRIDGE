/*
 * resetTestData.js
 * ---------------------------------------------------------------
 * Wipes ALL test data in Firestore and creates a clean test team
 * for Gurugram Grain Market (Basai):
 *   5 officers (one per duty: gate, assay, weighbridge, accounts, admin)
 *   3 traders
 * Farmer accounts are NOT created - register them by hand in the app.
 *
 * HOW TO RUN (from the AGROBRIDGE folder):
 *     node resetTestData.js
 * Then answer "yes" when asked. Safe to run again any time.
 *
 * Deletes collections: users, bookings, centreQueues, auctions,
 * delays, feedback, ivrIdempotency.  Re-seeds the 5 centres so
 * mandi settings (lanes, fees) are exactly as in seedCentres.js.
 * ---------------------------------------------------------------
 */

const readline = require('readline');
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, doc, setDoc, writeBatch, serverTimestamp,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyA2wEZjWel4hl-DTQnvdYfn_w5cWsl-Jkg',
  authDomain: 'agrobridge-sih26.firebaseapp.com',
  projectId: 'agrobridge-sih26',
  storageBucket: 'agrobridge-sih26.firebasestorage.app',
  messagingSenderId: '857662235864',
  appId: '1:857662235864:web:67ebbe6f9474f0396d23ad',
};

const CENTRE_ID = 'centre_gurugram_01';
const CENTRE_NAME = 'गुरुग्राम अनाज मंडी (Gurugram Grain Market)';

const COLLECTIONS_TO_WIPE = [
  'users', 'bookings', 'centreQueues', 'auctions', 'delays', 'feedback', 'ivrIdempotency', 'notifications',
];

// ----- test accounts (phone = login id; OTP in the app is always 1234) -----
const OFFICERS = [
  { phone: '9000000001', name: 'Ramesh Kumar (Gate)',        employeeId: 'GGN-GATE-01', officerDuty: 'gate' },
  { phone: '9000000002', name: 'Sunita Yadav (Assay)',       employeeId: 'GGN-QC-01',   officerDuty: 'assay' },
  { phone: '9000000003', name: 'Mahesh Saini (Weighbridge)', employeeId: 'GGN-WB-01',   officerDuty: 'weighbridge' },
  { phone: '9000000004', name: 'Pooja Sharma (Cashier)',     employeeId: 'GGN-ACC-01',  officerDuty: 'accounts' },
  { phone: '9000000005', name: 'Vikram Singh (Admin)',       employeeId: 'GGN-ADM-01',  officerDuty: 'admin' },
];
const TRADERS = [
  { phone: '9100000001', name: 'Suresh Agarwal', businessName: 'Agarwal Grain Traders', licenseNumber: 'HR-GGN-T-1001' },
  { phone: '9100000002', name: 'Anil Gupta',     businessName: 'Gupta & Sons Arhtiya',  licenseNumber: 'HR-GGN-T-1002' },
  { phone: '9100000003', name: 'Kavita Jain',    businessName: 'Jain Agro Commission',  licenseNumber: 'HR-GGN-T-1003' },
];

function officerDoc(o) {
  return {
    phone: o.phone, role: 'officer', name: o.name,
    employeeId: o.employeeId, officerDuty: o.officerDuty,
    centreId: CENTRE_ID, centreName: CENTRE_NAME,
    govIdNumber: null, govIdType: null, licenseNumber: null, businessName: null,
    createdAt: serverTimestamp(), isVerified: true,
  };
}
function traderDoc(t) {
  return {
    phone: t.phone, role: 'trader', name: t.name,
    employeeId: null, officerDuty: null,
    centreId: CENTRE_ID, centreName: CENTRE_NAME,
    govIdNumber: null, govIdType: null,
    licenseNumber: t.licenseNumber, businessName: t.businessName,
    createdAt: serverTimestamp(), isVerified: true,
  };
}

async function wipe(db, name) {
  const snap = await getDocs(collection(db, name));
  let n = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {          // Firestore batch limit is 500
    const b = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => { b.delete(d.ref); n++; });
    await b.commit();
  }
  console.log(`  ${name.padEnd(16)} deleted ${n}`);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

async function main() {
  console.log('This will DELETE every user, booking, queue, auction, delay and feedback');
  console.log(`in project "${firebaseConfig.projectId}" and create fresh test accounts.`);
  const a = process.argv.includes('--yes') ? 'yes' : await ask('Type yes to continue: ');
  if (a.trim().toLowerCase() !== 'yes') { console.log('Cancelled.'); process.exit(0); }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('\n==> Wiping collections');
  for (const c of COLLECTIONS_TO_WIPE) await wipe(db, c);

  console.log('\n==> Re-seeding the 5 mandis (seedCentres.js data)');
  // run seedCentres.js in-process by requiring its centre list is not exported,
  // so we simply spawn it.
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, ['seedCentres.js'], { stdio: 'inherit' });
  if (r.status !== 0) { console.log('seedCentres.js failed - stopping.'); process.exit(1); }

  console.log('\n==> Creating officers');
  for (const o of OFFICERS) { await setDoc(doc(db, 'users', o.phone), officerDoc(o)); console.log(`  ${o.phone}  ${o.name}`); }
  console.log('\n==> Creating traders');
  for (const t of TRADERS) { await setDoc(doc(db, 'users', t.phone), traderDoc(t)); console.log(`  ${t.phone}  ${t.name}`); }

  console.log('\nDone. Login = role + phone number, OTP 1234. Farmers: register in the app.\n');
  process.exit(0);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
