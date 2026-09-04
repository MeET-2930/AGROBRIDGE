import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const SESSION_KEY = '@agrobridge_user_session';

let currentUserSession = null;

export const OFFICER_DUTIES = [
  {
    id: 'gate',
    name: 'गेट अधिकारी (Gate Entry)',
    desc: 'गेट आगमन और वाहन प्रविष्टि',
  },
  {
    id: 'weighbridge',
    name: 'तौल एवं ग्रेडिंग (Assay)',
    desc: 'वजन माप और गुणवत्ता',
  },
  {
    id: 'accounts',
    name: 'लेखा व भुगतान (Cashier)',
    desc: 'भुगतान और बैंक रसीद',
  },
  {
    id: 'admin',
    name: 'मंडी प्रशासक (Admin)',
    desc: 'समस्त नियंत्रण व विलंब प्रबंधन',
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
      throw new Error('कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।');
    }

    const userDocRef = doc(db, 'users', normalizedPhone);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      throw new Error(
        'इस मोबाइल नंबर से कोई खाता नहीं मिला। पहले पंजीकरण करें।'
      );
    }

    const userData = userSnap.data();

    if (userData.role !== role) {
      throw new Error(
        `यह मोबाइल नंबर ${userData.role} खाते के लिए पंजीकृत है।`
      );
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
  officerDuty = 'admin',
  centreId = '',
  centreName = '',
  licenseNumber = '',
  businessName = '',
}) {
  try {
    const normalizedPhone = normalizePhone(phone);

    if (!name?.trim()) {
      throw new Error('नाम दर्ज करें।');
    }

    if (normalizedPhone.length !== 10) {
      throw new Error('कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।');
    }

    const userDocRef = doc(db, 'users', normalizedPhone);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      throw new Error(
        'इस मोबाइल नंबर से खाता पहले से मौजूद है। कृपया लॉग इन करें।'
      );
    }

    if (role === 'officer') {
      if (!employeeId?.trim()) {
        throw new Error('कर्मचारी आईडी दर्ज करें।');
      }

      if (!centreId?.trim()) {
        throw new Error('कृपया अपनी मंडी चुनें।');
      }
    }

    if (role === 'trader' && (!licenseNumber?.trim() || !businessName?.trim())) {
      throw new Error('लाइसेंस नंबर और फर्म नाम दर्ज करें।');
    }

    const newUser = {
      phone: normalizedPhone,
      role,
      name: name.trim(),

      employeeId: role === 'officer' ? employeeId.trim() : null,
      officerDuty: role === 'officer' ? officerDuty : null,
      centreId: role === 'officer' ? centreId : null,
      centreName: role === 'officer' ? centreName : null,

      govIdNumber: null,
      govIdType: null,

      licenseNumber: role === 'trader' ? licenseNumber.trim() : null,
      businessName: role === 'trader' ? businessName.trim() : null,

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
 * Update the logged-in officer's posting (which mandi they work at)
 * and duty. Writes to Firestore and refreshes the local session.
 */
export async function updateOfficerPosting({
  centreId,
  centreName,
  officerDuty,
}) {
  if (!currentUserSession?.uid) {
    throw new Error('कृपया दोबारा लॉग इन करें।');
  }

  if (!centreId) {
    throw new Error('कृपया मंडी चुनें।');
  }

  const patch = { centreId, centreName: centreName || '' };

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
    throw new Error('कृपया दोबारा लॉग इन करें।');
  }

  const cleaned = String(govIdNumber || '').replace(/\s/g, '');

  if (govIdType === 'aadhaar' && cleaned.length !== 12) {
    throw new Error('आधार संख्या 12 अंकों की होनी चाहिए।');
  }

  if (!cleaned) {
    throw new Error('कृपया पहचान संख्या दर्ज करें।');
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
