/*
 * seedTestAccounts.js - (re)create the 8 official test accounts from
 * AGROBRIDGE_test_accounts.xlsx: 5 officers + 3 traders at Gurugram Grain
 * Market (centre_gurugram_01). Login: role -> phone -> OTP 1234.
 * Farmers are NOT seeded - register them by hand in the app.
 * Safe to run again: overwrites the same 8 documents.
 *
 *   node seedCentres.js        # first, if the centres are gone too
 *   node seedTestAccounts.js
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

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

const CENTRE = { centreId: 'centre_gurugram_01', centreName: 'गुरुग्राम अनाज मंडी (Gurugram Grain Market)' };

const officer = (phone, name, officerDuty, employeeId) => ({
  phone, role: 'officer', name, employeeId, officerDuty, ...CENTRE,
  govIdNumber: null, govIdType: null, licenseNumber: null, businessName: null,
  isVerified: true, createdAt: serverTimestamp(),
});
const trader = (phone, name, businessName, licenseNumber) => ({
  phone, role: 'trader', name, employeeId: null, officerDuty: null, ...CENTRE,
  govIdNumber: null, govIdType: null, licenseNumber, businessName,
  isVerified: true, createdAt: serverTimestamp(),
});

const USERS = [
  officer('9000000001', 'Ramesh Kumar', 'gate',        'GGN-GATE-01'),
  officer('9000000002', 'Sunita Yadav', 'assay',       'GGN-QC-01'),
  officer('9000000003', 'Mahesh Saini', 'weighbridge', 'GGN-WB-01'),
  officer('9000000004', 'Pooja Sharma', 'accounts',    'GGN-ACC-01'),
  officer('9000000005', 'Vikram Singh', 'admin',       'GGN-ADM-01'),
  trader('9100000001', 'Suresh Agarwal', 'Agarwal Grain Traders', 'HR-GGN-T-1001'),
  trader('9100000002', 'Anil Gupta',     'Gupta & Sons Arhtiya',  'HR-GGN-T-1002'),
  trader('9100000003', 'Kavita Jain',    'Jain Agro Commission',  'HR-GGN-T-1003'),
];

(async () => {
  for (const u of USERS) {
    await setDoc(doc(db, 'users', u.phone), u);
    console.log(`  ${u.role.padEnd(7)} ${u.phone}  ${u.name}  (${u.officerDuty || u.businessName})`);
  }
  console.log('Done: 8 test accounts. OTP for all: 1234. Admin code: AGB-ADMIN-2026.');
  process.exit(0);
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
