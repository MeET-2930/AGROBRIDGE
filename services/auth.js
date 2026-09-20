import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  collection,
  where,
} from 'firebase/firestore';
import { tErr } from './i18nError';
import { MANDI_ADMIN_CODE } from './config';

/* Which duties may act on which pipeline stage. Admin may do all. */
export const DUTY_FOR_STAGE = {
  gate: ['gate'],
  assay: ['assay'],
  weighing: ['weighbridge'],
  payment: ['accounts'],
  delay: [],            // admin only
};

/** Check a mandi-admin code against the centre's own code or the project code. */
export async function verifyAdminCode(centreId, code) {
  const typed = String(code || '').trim().toUpperCase();
  if (!typed) return false;
  let expected = MANDI_ADMIN_CODE;
  try {
    if (centreId) {
      const snap = await getDoc(doc(db, 'centres', centreId));
      if (snap.exists() && snap.data().adminCode) expected = snap.data().adminCode;
    }
  } catch (e) {
    // fall back to project-wide code
  }
  return typed === String(expected).trim().toUpperCase();
}

/**
 * Throw unless the logged-in user is an officer of `centreId` whose duty
 * is one of `duties` (or admin). Called by every stage action in
 * bookings.js so the rule cannot be bypassed from a screen.
 */
export async function requireOfficerDuty(centreId, duties = []) {
  const s = currentUserSession;
  if (!s?.uid || s.role !== 'officer') throw tErr('loginAgain');
  if (centreId && s.centreId && s.centreId !== centreId) throw tErr('err.notYourMandi');
  const duty = s.officerDuty || 'gate';
  if (duty === 'admin') return s;
  if (!duties.includes(duty)) throw tErr('err.notYourDuty');
  return s;
}

const SESSION_KEY = '@agrobridge_user_session';

let currentUserSession = null;

export const OFFICER_DUTIES = [
  {
    id: 'gate',
    name: 'गेट अधिकारी (Gate Entry)',
    desc: 'गेट आगमन और वाहन प्रविष्टि',
    nameKey: 'duty_gate',
    descKey: 'duty_gate_desc',
  },
  {
    id: 'assay',
    name: 'गुणवत्ता निरीक्षक (Assay / QC)',
    desc: 'नमूना, नमी, ग्रेड तय करना',
    nameKey: 'duty_assay',
    descKey: 'duty_assay_desc',
  },
  {
    id: 'weighbridge',
    name: 'तौल अधिकारी (Weighbridge)',
    desc: 'भाव तय होने के बाद वजन माप',
    nameKey: 'duty_weighbridge',
    descKey: 'duty_weighbridge_desc',
  },
  {
    id: 'accounts',
    name: 'लेखा व भुगतान (Cashier)',
    desc: 'भुगतान और बैंक रसीद',
    nameKey: 'duty_accounts',
    descKey: 'duty_accounts_desc',
  },
  {
    id: 'admin',
    name: 'मंडी प्रशासक (Admin)',
    desc: 'समस्त नियंत्रण व विलंब प्रबंधन',
    nameKey: 'duty_admin',
    descKey: 'duty_admin_desc',
  },
];

function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

function buildSession(uid, userData) {
  return {
    uid,
    phone: userData.phone || uid,
    role: userData.role || 'farmer',
    name: userData.name || '',

    employeeId: userData.employeeId || '',
    officerDuty: userData.officerDuty || '',

    // Which mandi this officer works at. Everything on the officer
    // side is scoped to this, so it must be set before they can work.
    centreId: userData.centreId || '',
    centreName: userData.centreName || '',

    // Reserved for the Aadhaar / government ID verification step.
    govIdNumber: userData.govIdNumber || '',
    govIdType: userData.govIdType || '',
    isVerified: userData.isVerified || false,

    licenseNumber: userData.licenseNumber || '',
    businessName: userData.businessName || '',

    // install55: farmer govt-rail profile (all optional, filled from the MFMB demo fetch)
    farmerRegNo: userData.farmerRegNo || '',
    regSource: userData.regSource || '',
    registeredAcres: userData.registeredAcres || {},
    nominees: Array.isArray(userData.nominees) ? userData.nominees : [],
    bankLast4: userData.bankLast4 || '',
    arhtiyaId: userData.arhtiyaId || '',
    arhtiyaName: userData.arhtiyaName || '',
    // install55: arhtiya (commission agent) - reuses licence/firm/centre + own shed
    shedId: userData.shedId || '',
  };
}

async function saveSession(session) {
  currentUserSession = session;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Login using the user's registered mobile number.
 * OTP is handled by the frontend test flow for now.
 */
export async function loginWithPhone(phone, role = 'farmer') {
  try {
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length !== 10) {
      throw tErr('err.badPhone');
    }

    const userDocRef = doc(db, 'users', normalizedPhone);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      throw tErr('err.notRegistered');
    }

    const userData = userSnap.data();

    if (userData.role !== role) {
      throw tErr('err.wrongRole', { role: userData.role });
    }

    return saveSession(buildSession(userSnap.id, userData));
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
}

/**
 * Register a new user in Firestore.
 */
export async function registerUser({
  role,
  name,
  phone,
  employeeId = '',
  officerDuty = 'gate',
  centreId = '',
  centreName = '',
  licenseNumber = '',
  businessName = '',
  adminCode = '',
  govIdType = null,
  govIdNumber = null,
  govIdVerifiedAt = null,
}) {
  try {
    const normalizedPhone = normalizePhone(phone);

    if (!name?.trim()) {
      throw tErr('err.enterName');
    }

    if (normalizedPhone.length !== 10) {
      throw tErr('err.badPhone');
    }

    const userDocRef = doc(db, 'users', normalizedPhone);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      throw tErr('err.exists');
    }

    if (role === 'officer') {
      if (!employeeId?.trim()) {
        throw tErr('err.enterEmpId');
      }

      if (!centreId?.trim()) {
        throw tErr('err.pickMandi');
      }

      // Admin is a protected duty: needs the mandi admin code.
      if (officerDuty === 'admin' && !(await verifyAdminCode(centreId, adminCode))) {
        throw tErr('err.badAdminCode');
      }
    }

    // install55: arhtiya = licensed commission agent at ONE mandi (same fields as the old trader role)
    const licensed = role === 'trader' || role === 'arhtiya';
    if (licensed && (!licenseNumber?.trim() || !businessName?.trim())) {
      throw tErr('err.traderFields');
    }

    if (licensed && !centreId?.trim()) {
      throw tErr('err.traderMandi');
    }

    const newUser = {
      phone: normalizedPhone,
      role,
      name: name.trim(),

      employeeId: role === 'officer' ? employeeId.trim() : null,
      officerDuty: role === 'officer' ? officerDuty : null,
      // Officers are posted at a mandi; traders hold a licence for one.
      centreId: role === 'officer' || licensed ? centreId || null : null,
      centreName:
        role === 'officer' || licensed ? centreName || null : null,

      // install45: Aadhaar e-KYC (mock) - masked number only
      govIdNumber: govIdNumber || null,
      govIdType: govIdType || null,
      govIdVerifiedAt: govIdVerifiedAt || null,

      licenseNumber: licensed ? licenseNumber.trim() : null,
      businessName: licensed ? businessName.trim() : null,
      shedId: null,

      createdAt: serverTimestamp(),
      isVerified: false,
    };

    await setDoc(userDocRef, newUser);

    return saveSession(
      buildSession(normalizedPhone, { ...newUser, createdAt: null })
    );
  } catch (error) {
    console.error('Registration Error:', error);
    throw error;
  }
}

/**
 * Trader: change the mandi they trade at (also used by profile screen).
 */
export async function updateTraderCentre({ centreId, centreName }) {
  if (!currentUserSession?.uid) throw tErr('loginAgain');
  if (!centreId) throw tErr('err.pickMandi');
  const patch = { centreId, centreName: centreName || '' };
  await updateDoc(doc(db, 'users', currentUserSession.uid), patch);
  return saveSession({ ...currentUserSession, ...patch });
}

/* ===============================================================
 * install55: farmer profile (govt rail) + arhtiya link
 * =============================================================== */

/** Save what the MFMB (demo) fetch returned, or a manually typed reg no. */
export async function updateFarmerProfile({ farmerRegNo, regSource = 'manual', registeredAcres = null, bankLast4 = '', nominees = null }) {
  if (!currentUserSession?.uid) throw tErr('loginAgain');
  const patch = {};
  if (farmerRegNo != null) patch.farmerRegNo = String(farmerRegNo).trim().toUpperCase();
  if (regSource) patch.regSource = regSource;
  if (registeredAcres) patch.registeredAcres = registeredAcres;
  if (bankLast4) patch.bankLast4 = String(bankLast4).slice(-4);
  if (Array.isArray(nominees)) patch.nominees = nominees.filter((n) => n && n.name).slice(0, 3).map((n) => ({ name: String(n.name).trim(), relation: n.relation || '', phone: String(n.phone || '').replace(/\D/g, '').slice(-10) }));
  await updateDoc(doc(db, 'users', currentUserSession.uid), patch);
  return saveSession({ ...currentUserSession, ...patch });
}

/** Farmer links (or unlinks) "my arhtiya" by the arhtiya's phone number. */
export async function linkArhtiya(arhtiyaPhone) {
  if (!currentUserSession?.uid) throw tErr('loginAgain');
  if (!arhtiyaPhone) {
    await updateDoc(doc(db, 'users', currentUserSession.uid), { arhtiyaId: null, arhtiyaName: null });
    return saveSession({ ...currentUserSession, arhtiyaId: '', arhtiyaName: '' });
  }
  const id = normalizePhone(arhtiyaPhone);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists() || snap.data().role !== 'arhtiya') throw tErr('err.noArhtiya');
  const a = snap.data();
  const patch = { arhtiyaId: id, arhtiyaName: a.businessName || a.name || id };
  await updateDoc(doc(db, 'users', currentUserSession.uid), patch);
  return saveSession({ ...currentUserSession, ...patch });
}

/** Arhtiya: every farmer who linked me. */
export async function fetchMyFarmers() {
  if (!currentUserSession?.uid || currentUserSession.role !== 'arhtiya') throw tErr('loginAgain');
  const snap = await getDocs(query(collection(db, 'users'), where('arhtiyaId', '==', currentUserSession.uid)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Arhtiya: link a farmer to myself by phone (the farmer sees it on his dashboard and may unlink). */
export async function addFarmerToArhtiya(farmerPhone) {
  if (!currentUserSession?.uid || currentUserSession.role !== 'arhtiya') throw tErr('loginAgain');
  const id = normalizePhone(farmerPhone);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists() || snap.data().role !== 'farmer') throw tErr('err.noFarmer');
  await updateDoc(doc(db, 'users', id), { arhtiyaId: currentUserSession.uid, arhtiyaName: currentUserSession.businessName || currentUserSession.name });
  return { uid: id, ...snap.data() };
}

/** Arhtiya: which shed / dhera is mine (heaps of my farmers go there). */
export async function updateArhtiyaShed(shedId) {
  if (!currentUserSession?.uid) throw tErr('loginAgain');
  await updateDoc(doc(db, 'users', currentUserSession.uid), { shedId: shedId || null });
  return saveSession({ ...currentUserSession, shedId: shedId || '' });
}

/**
 * Update the logged-in officer's posting (which mandi they work at)
 * and duty. Writes to Firestore and refreshes the local session.
 */
export async function updateOfficerPosting({
  centreId,
  centreName,
  officerDuty,
  adminCode = '',
}) {
  if (!currentUserSession?.uid) {
    throw tErr('loginAgain');
  }

  if (!centreId) {
    throw tErr('err.pickMandi');
  }

  const patch = { centreId, centreName: centreName || '' };

  // Duty is locked after registration. Changing it (or moving to
  // another mandi) needs the mandi admin code - otherwise any officer
  // could promote themselves to admin.
  const currentDuty = currentUserSession.officerDuty || 'gate';
  const dutyChanged = officerDuty && officerDuty !== currentDuty;
  const mandiChanged = !!currentUserSession.centreId && currentUserSession.centreId !== centreId;

  if (dutyChanged || mandiChanged) {
    if (!(await verifyAdminCode(centreId, adminCode))) {
      throw tErr('err.badAdminCode');
    }
  }

  if (officerDuty) patch.officerDuty = officerDuty;

  await updateDoc(doc(db, 'users', currentUserSession.uid), patch);

  return saveSession({ ...currentUserSession, ...patch });
}

/**
 * Store a government ID against the account.
 * Currently just recorded; real Aadhaar verification comes later.
 */
export async function updateGovId({ govIdType, govIdNumber }) {
  if (!currentUserSession?.uid) {
    throw tErr('loginAgain');
  }

  const cleaned = String(govIdNumber || '').replace(/\s/g, '');

  if (govIdType === 'aadhaar' && cleaned.length !== 12) {
    throw tErr('err.aadhaar12');
  }

  if (!cleaned) {
    throw tErr('err.enterId');
  }

  const patch = {
    govIdType: govIdType || 'aadhaar',
    govIdNumber: cleaned,
  };

  await updateDoc(doc(db, 'users', currentUserSession.uid), patch);

  return saveSession({ ...currentUserSession, ...patch });
}

/**
 * Restore the previous login when the app starts.
 */
export async function restoreUserSession() {
  try {
    const stored = await AsyncStorage.getItem(SESSION_KEY);

    if (!stored) {
      currentUserSession = null;
      return null;
    }

    const session = JSON.parse(stored);

    if (!session?.uid || !session?.role) {
      await AsyncStorage.removeItem(SESSION_KEY);
      currentUserSession = null;
      return null;
    }

    /*
     * Re-read the user document so that a posting changed on
     * another device shows up here too.
     */
    try {
      const snap = await getDoc(doc(db, 'users', session.uid));

      if (snap.exists()) {
        currentUserSession = buildSession(snap.id, snap.data());
        await AsyncStorage.setItem(
          SESSION_KEY,
          JSON.stringify(currentUserSession)
        );
        return currentUserSession;
      }
    } catch (error) {
      // Offline is fine - fall back to the cached session.
      console.log('Session refresh skipped:', error?.message);
    }

    currentUserSession = session;
    return session;
  } catch (error) {
    console.error('Session restore error:', error);
    currentUserSession = null;
    return null;
  }
}

export async function getCurrentUserSession() {
  return currentUserSession;
}

export async function logoutUserSession() {
  currentUserSession = null;
  await AsyncStorage.removeItem(SESSION_KEY);
  return true;
}
