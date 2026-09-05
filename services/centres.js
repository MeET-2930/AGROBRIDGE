import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { translate } from '../i18n/translations';

/*
 * `name` stays as the Hindi+English label (it is stored inside
 * bookings as cropName, so old documents keep working).
 * `nameKey` is what screens should show: tr(crop.nameKey).
 */
export const CROP_LIST = [
  { id: 'wheat', name: 'गेहूँ (Wheat)', nameKey: 'crop_wheat', msp: 2275, unit: 'क्विंटल' },
  { id: 'paddy', name: 'धान (Paddy)', nameKey: 'crop_paddy', msp: 2183, unit: 'क्विंटल' },
  { id: 'mustard', name: 'सरसों (Mustard)', nameKey: 'crop_mustard', msp: 5650, unit: 'क्विंटल' },
  { id: 'cotton', name: 'कपास (Cotton)', nameKey: 'crop_cotton', msp: 6620, unit: 'क्विंटल' },
  { id: 'maize', name: 'मक्का (Maize)', nameKey: 'crop_maize', msp: 2090, unit: 'क्विंटल' },
  { id: 'gram', name: 'चना (Gram)', nameKey: 'crop_gram', msp: 5440, unit: 'क्विंटल' },
];

export const QUALITY_GRADES = [
  { id: 'FAQ', name: 'FAQ', nameKey: 'grade_FAQ' },
  { id: 'GRADE_A', name: 'ग्रेड A', nameKey: 'grade_GRADE_A' },
  { id: 'GRADE_B', name: 'ग्रेड B', nameKey: 'grade_GRADE_B' },
  { id: 'REJECTED', name: 'अस्वीकृत', nameKey: 'grade_REJECTED' },
];

/** Crop label in the chosen language. Accepts a crop id or a booking. */
export function cropLabel(cropIdOrBooking, lang = 'hi') {
  const id =
    typeof cropIdOrBooking === 'string'
      ? cropIdOrBooking
      : cropIdOrBooking?.crop || cropIdOrBooking?.id;
  const hit = CROP_LIST.find((c) => c.id === id);
  if (hit) return translate(hit.nameKey, lang);
  if (typeof cropIdOrBooking === 'object' && cropIdOrBooking) {
    return cropIdOrBooking.cropName || cropIdOrBooking.crop || '';
  }
  return String(id || '');
}

/** Grade label in the chosen language. */
export function gradeLabel(gradeId, lang = 'hi') {
  const hit = QUALITY_GRADES.find((g) => g.id === gradeId);
  return hit ? translate(hit.nameKey, lang) : String(gradeId || '—');
}

/**
 * Mandi name in the chosen language. Centre docs may carry
 * `name_en`; English users see that, everyone else sees `name`.
 * Accepts a centre object OR a plain string (already a name).
 */
export function centreLabel(centreOrName, lang = 'hi') {
  if (!centreOrName) return '';
  const name =
    typeof centreOrName === 'string'
      ? centreOrName
      : centreOrName.name || centreOrName.centreName || '';
  if (lang === 'en') {
    if (typeof centreOrName === 'object' && centreOrName.name_en) return centreOrName.name_en;
    // Stored names look like "APMC अनाज मंडी खन्ना (Khanna Grain Market)":
    // for English readers show only the bracketed part.
    const m = /\(([^)]+)\)/.exec(name);
    if (m) return m[1];
  }
  return name;
}

const DEFAULT_CENTRES = [
  {
    id: 'centre-1',
    name: 'APMC अनाज मंडी खन्ना',
    name_en: 'APMC Grain Market Khanna',
    address: 'GT Road, Khanna, Ludhiana, Punjab',
    latitude: 30.7073,
    longitude: 76.2167,
    acceptedCrops: ['wheat', 'paddy', 'maize', 'mustard'],
    parallelLanes: 4,
    avgMinutesPerEntry: 15,
    operatingStartTime: '08:00',
    operatingEndTime: '18:00',
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 12.5,
    active: true,
  },
  {
    id: 'centre-2',
    name: 'APMC मंडी यार्ड करनाल',
    name_en: 'APMC Mandi Yard Karnal',
    address: 'Kunjpura Road, Karnal, Haryana',
    latitude: 29.6857,
    longitude: 76.9905,
    acceptedCrops: ['wheat', 'paddy', 'mustard', 'gram'],
    parallelLanes: 3,
    avgMinutesPerEntry: 18,
    operatingStartTime: '08:30',
    operatingEndTime: '17:30',
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 11,
    active: true,
  },
  {
    id: 'centre-3',
    name: 'APMC सब यार्ड राजपुरा',
    name_en: 'APMC Sub Yard Rajpura',
    address: 'Old Grain Market, Rajpura, Punjab',
    latitude: 30.4839,
    longitude: 76.5937,
    acceptedCrops: ['wheat', 'paddy', 'cotton'],
    parallelLanes: 2,
    avgMinutesPerEntry: 20,
    operatingStartTime: '09:00',
    operatingEndTime: '17:00',
    mandiFeePercent: 1.5,
    commissionPercent: 2,
    hamaliPerQuintal: 13,
    active: true,
  },
];

export async function seedCentres() {
  const centresRef = collection(db, 'centres');

  for (const centre of DEFAULT_CENTRES) {
    const centreRef = doc(centresRef, centre.id);
    const existing = await getDoc(centreRef);

    if (!existing.exists()) {
      await setDoc(centreRef, centre);
    }
  }

  return true;
}

export async function fetchCentres() {
  const snapshot = await getDocs(collection(db, 'centres'));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .filter((centre) => centre.active !== false);
}

export async function fetchCentreById(id) {
  if (!id) return null;

  const snapshot = await getDoc(doc(db, 'centres', id));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}
