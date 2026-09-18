import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { translate } from '../i18n/translations';

/*
 * `name` stays as the Hindi+English label (it is stored inside
 * bookings as cropName, so old documents keep working).
 * `nameKey` is what screens should show: tr(crop.nameKey).
 */
/*
 * cropClass (install45):
 *   'grain'      - storable; bookable up to 7 days ahead
 *   'perishable' - loses value within days; bookable only today/tomorrow,
 *                  gets a RESERVED share of every hour (never a queue-jump),
 *                  and may use the buffer like a small load.
 * Perishables are auction-priced (no MSP) - msp: null.
 */
export const CROP_LIST = [
  { id: 'wheat', name: 'गेहूँ (Wheat)', nameKey: 'crop_wheat', msp: 2275, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'paddy', name: 'धान (Paddy)', nameKey: 'crop_paddy', msp: 2183, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'mustard', name: 'सरसों (Mustard)', nameKey: 'crop_mustard', msp: 5650, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'cotton', name: 'कपास (Cotton)', nameKey: 'crop_cotton', msp: 6620, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'maize', name: 'मक्का (Maize)', nameKey: 'crop_maize', msp: 2090, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'gram', name: 'चना (Gram)', nameKey: 'crop_gram', msp: 5440, unit: 'क्विंटल', cropClass: 'grain' },
  { id: 'tomato', name: 'टमाटर (Tomato)', nameKey: 'crop_tomato', msp: null, unit: 'क्विंटल', cropClass: 'perishable' },
  { id: 'onion', name: 'प्याज़ (Onion)', nameKey: 'crop_onion', msp: null, unit: 'क्विंटल', cropClass: 'perishable' },
];

export function cropClassOf(cropId) {
  return CROP_LIST.find((c) => c.id === cropId)?.cropClass || 'grain';
}

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

/* ===============================================================
 * GRADE-WISE MSP (install43)
 * ---------------------------------------------------------------
 * FAQ (Fair Average Quality) gets the full MSP. Lower grades get a
 * deduction per quintal with a REASON the farmer can read. Values
 * follow the FCI/Haryana uniform-specification practice for value
 * cuts (moisture above the 12% limit, foreign matter, shrivelled /
 * broken grain). A centre document may override with `mspDeductions`.
 * =============================================================== */
export const MSP_DEDUCTIONS = {
  FAQ:      { perQuintal: 0,   reasonKey: 'msp_reason_faq' },
  GRADE_A:  { perQuintal: 25,  reasonKey: 'msp_reason_a' },   // slight moisture / foreign matter
  GRADE_B:  { perQuintal: 60,  reasonKey: 'msp_reason_b' },   // moisture > limit or shrivelled grain
  REJECTED: { perQuintal: null, reasonKey: 'msp_reason_rejected' },
};

/**
 * Price the farmer actually gets at MSP for his crop + grade.
 * Returns { advertised, deduction, rate, reasonKey, factors[] }.
 * `factors` are the measured reasons (moisture 14.2% > 12%, FM 2.1% > 1%).
 */
export function gradedMsp(cropId, grade = 'FAQ', assay = {}, centre = null) {
  const crop = CROP_LIST.find((c) => c.id === cropId);
  const advertised = Number(crop?.msp) || 0;
  const table = { ...MSP_DEDUCTIONS, ...((centre && centre.mspDeductions) || {}) };
  const row = table[grade] || table.FAQ;
  const deduction = Number(row.perQuintal) || 0;
  const factors = [];
  const m = Number(assay.moisturePercent);
  const fm = Number(assay.foreignMatterPercent);
  if (Number.isFinite(m) && m > 12) factors.push({ key: 'msp_factor_moisture', params: { v: m, limit: 12 } });
  if (Number.isFinite(fm) && fm > 1) factors.push({ key: 'msp_factor_fm', params: { v: fm, limit: 1 } });
  return { advertised, deduction, rate: Math.max(0, advertised - deduction), reasonKey: row.reasonKey, factors };
}

/* ===============================================================
 * VEHICLE PLATES (install43)
 * ---------------------------------------------------------------
 * Accepts the standard Indian format (HR26AB1234, HR26A1234,
 * DL1CAB1234) and the BH series (22BH1234AB). Spaces/dashes are
 * ignored, letters uppercased. Returns the clean plate or null.
 * =============================================================== */
export function normalizePlate(input) {
  const p = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!p) return null;
  const standard = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
  const bh = /^\d{2}BH\d{4}[A-Z]{1,2}$/;
  return standard.test(p) || bh.test(p) ? p : null;
}
