/*
 * resetTestData.js - wipe test data, KEEP users and centres.
 * Run from the AGROBRIDGE folder: node resetTestData.js
 */

require('dotenv').config();

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'agrobridge-sih26.firebaseapp.com',
  projectId: 'agrobridge-sih26',
  storageBucket: 'agrobridge-sih26.firebasestorage.app',
  messagingSenderId: '857662235864',
  appId: '1:857662235864:web:67ebbe6f9474f0396d23ad',
  measurementId: 'G-8SV41RMRNY',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const WIPE = [
  'bookings',
  'centreQueues',
  'auctions',
  'delays',
  'notifications',
  'feedback',
];

async function wipe(name) {
  const snap = await getDocs(collection(db, name));
  let n = 0;

  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);

    snap.docs.slice(i, i + 400).forEach((d) => {
      batch.delete(d.ref);
      n++;
    });

    await batch.commit();
  }

  console.log(`  ${name}: deleted ${n}`);
}

(async () => {
  for (const c of WIPE) await wipe(c);

  console.log('  users and centres untouched.');
  console.log('Reset done. Log out and back in on every device/tab before testing.');
  process.exit(0);
})().catch((e) => {
  console.error('Reset failed:', e.message);
  process.exit(1);
});