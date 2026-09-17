/*
 * services/config.js
 * ---------------------------------------------------------------
 * One place to change project-wide settings.
 *
 * ACTIVE_CENTRE_ID is a temporary stand-in until officers get a
 * centre assigned to their account at registration. Every officer
 * screen reads this, so you only ever change it here.
 *
 * It must exactly match a document ID in your Firestore
 * "centres" collection.
 * ---------------------------------------------------------------
 */

export const ACTIVE_CENTRE_ID = 'centre_gurugram_01';

/*
 * MANDI_ADMIN_CODE
 * Needed to register as "Mandi Admin" or to change an officer's duty
 * after registration. A centre document may override it with its own
 * `adminCode` field; otherwise this project-wide code is used.
 * Change it before the final demo and tell only the mandi secretary.
 */
export const MANDI_ADMIN_CODE = 'AGB-ADMIN-2026';

/*
 * Phone service (IVR) - ivr/server.js hosted on Render.com.
 * Leave IVR_BASE_URL empty to hide the "Call me" card and skip
 * reminder calls. No trailing slash.
 * After moving to Firebase Blaze this becomes the Cloud Function URL.
 */
export const IVR_BASE_URL = 'https://agrobridge-ivr.onrender.com';
export const IVR_APP_KEY = 'agb-demo-2026';   // must equal APP_SHARED_KEY on the server

/**
 * TESTING_MODE (install39)
 *  true  = officer queues/scans show tokens of EVERY date (today first), and the
 *          farmer can book any of today's windows at any hour. Use while testing.
 *  false = real mandi behaviour: officers see only today's tokens, past windows hidden.
 */
export const TESTING_MODE = true;
