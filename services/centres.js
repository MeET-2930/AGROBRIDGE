import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const CROP_LIST = [
  { id: 'wheat', name: 'गेहूँ (Wheat)', msp: 2275, unit: 'क्विंटल' },
  { id: 'paddy', name: 'धान (Paddy)', msp: 2183, unit: 'क्विंटल' },
  { id: 'mustard', name: 'सरसों (Mustard)', msp: 5650, unit: 'क्विंटल' },
  { id: 'cotton', name: 'कपास (Cotton)', msp: 6620, unit: 'क्विंटल' },
  { id: 'maize', name: 'मक्का (Maize)', msp: 2090, unit: 'क्विंटल' },
  { id: 'gram', name: 'चना (Gram)', msp: 5440, unit: 'क्विंटल' },
];

export const QUALITY_GRADES = [
  { id: 'FAQ', name: 'FAQ' },
  { id: 'GRADE_A', name: 'ग्रेड A' },
  { id: 'GRADE_B', name: 'ग्रेड B' },
  { id: 'REJECTED', name: 'अस्वीकृत' },
];

const DEFAULT_CENTRES = [
  {
    id: 'centre-1',
    name: 'APMC अनाज मंडी खन्ना',
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