/*
 * services/aadhaar.js   (install45)
 * ---------------------------------------------------------------
 * AADHAAR e-KYC  -  MOCK.
 * Real Aadhaar OTP verification goes through UIDAI's Authentication
 * API via a licensed AUA/KUA (or DigiLocker). That needs a server,
 * a licence and an audit trail - none of which a prototype may have.
 * So this file mimics the exact SHAPE of the real flow:
 *
 *    1. validate the 12-digit number (Verhoeff checksum, same as UIDAI)
 *    2. "send OTP" to the Aadhaar-linked mobile     -> mock: always 1234
 *    3. "verify OTP"                                 -> mock: 1234 accepted
 *    4. return the e-KYC name/address hash            -> mock: masked number
 *
 * The app stores ONLY the masked number (XXXX XXXX 1234) and a
 * verifiedAt time - never the full Aadhaar (the law forbids storing it
 * in plain text anyway). When the server exists, replace sendOtp /
 * verifyOtp bodies with API calls; every screen stays the same.
 */

/** Verhoeff checksum - the same algorithm UIDAI prints on every card. */
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

export function normalizeAadhaar(input) {
  return String(input || '').replace(/\D/g, '').slice(0, 12);
}

/** true if 12 digits, does not start with 0/1, and the Verhoeff check passes. */
export function isValidAadhaar(input) {
  const n = normalizeAadhaar(input);
  if (n.length !== 12 || /^[01]/.test(n)) return false;
  let c = 0;
  n.split('').reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
  return c === 0;
}

export function maskAadhaar(input) {
  const n = normalizeAadhaar(input);
  return n.length === 12 ? `XXXX XXXX ${n.slice(8)}` : '';
}

export function formatAadhaar(input) {
  const n = normalizeAadhaar(input);
  return n.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Demo numbers that pass the checksum (for testers). */
export const DEMO_AADHAAR = ['2345 6789 0124', '9999 8888 7779', '5432 1098 7652'];

export const MOCK_AADHAAR_OTP = '1234';

/** MOCK: pretend UIDAI sent an OTP to the linked mobile. */
export async function sendAadhaarOtp(aadhaar) {
  if (!isValidAadhaar(aadhaar)) throw new Error('aad.invalid');
  await new Promise((r) => setTimeout(r, 600));
  return { txnId: `MOCK-${Date.now()}`, maskedMobile: 'XXXXXX' + String(Math.floor(1000 + Math.random() * 9000)) };
}

/** MOCK: verify the OTP; returns what the app may store. */
export async function verifyAadhaarOtp(aadhaar, otp, txnId) {
  await new Promise((r) => setTimeout(r, 500));
  if (String(otp).trim() !== MOCK_AADHAAR_OTP) throw new Error('aad.wrongOtp');
  return {
    verified: true,
    govIdType: 'aadhaar',
    govIdNumber: maskAadhaar(aadhaar),   // masked ONLY - full number is never stored
    txnId,
    verifiedAt: new Date().toISOString(),
    provider: 'mock-uidai',
  };
}
