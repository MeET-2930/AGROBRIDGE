/*
 * resetTestData.js - wipe test data.
 *   node resetTestData.js            keeps ALL users + centres
 *   node resetTestData.js --users    ALSO deletes every user except the 8 official
 *                                    test accounts (5 officers + 3 traders, Basai)
 * Always deletes: bookings, centreQueues, auctions, delays, notifications, feedback.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc, updateDoc, deleteField } = require('firebase/firestore');

// ===========================================================

const firebaseConfig = {
  apiKey: 'AIzaSyA2wEZjWel4hl-DTQnvdYfn_w5cWsl-Jkg',
  authDomain: 'agrobridge-sih26.firebaseapp.com',
  projectId: 'agrobridge-sih26',
  storageBucket: 'agrobridge-sih26.firebasestorage.app',
  messagingSenderId: '857662235864',
  appId: '1:857662235864:web:67ebbe6f9474f0396d23ad',
  measurementId: 'G-8SV41RMRNY',
};

// ===========================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const WIPE = ['bookings', 'centreQueues', 'auctions', 'delays', 'notifications', 'feedback'];
const KEEP_PHONES = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005', '9100000001', '9100000002', '9100000003', '9100000004', '9100000005', '9100000006', '9100000007', '9100000008', '9100000009', '9200000001', '9200000002', '9200000003', '9300000001', '9300000002'];
const ALSO_USERS = process.argv.includes('--users');

async function pruneUsers() {
  const snap = await getDocs(collection(db, 'users'));
  let kept = 0, gone = 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const u = d.data();
    const phone = String(u.phone || d.id).replace(/\D/g, '').slice(-10);
    if (KEEP_PHONES.includes(phone)) { kept += 1; }
    else { batch.delete(d.ref); gone += 1; }
  });
  if (gone) await batch.commit();
  console.log(`  users: kept ${kept} test accounts, deleted ${gone}`);
}

async function wipe(name) {
  const snap = await getDocs(collection(db, name));
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => { batch.delete(d.ref); n += 1; });
    await batch.commit();
  }
  console.log(`  ${name}: deleted ${n}`);
}

(async () => {
  for (const c of WIPE) await wipe(c);
  if (ALSO_USERS) await pruneUsers(); else console.log('  users untouched (add --users to prune to the 8 test accounts).');
  console.log('  centres untouched.');
  console.log('Reset done. Log out and back in on every device/tab before testing.');
  process.exit(0);
})().catch((e) => { console.error('Reset failed:', e.message); process.exit(1); });
