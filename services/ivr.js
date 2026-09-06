/*
 * services/ivr.js
 * ---------------------------------------------------------------
 * Talks to the AGROBRIDGE phone service (ivr/server.js on Render).
 * Everything here is best-effort: if the server is asleep or
 * Twilio is not configured, the app keeps working.
 * ---------------------------------------------------------------
 */
import { IVR_BASE_URL, IVR_APP_KEY } from './config';

async function post(path, body) {
  if (!IVR_BASE_URL) throw new Error('IVR_NOT_CONFIGURED');
  const res = await fetch(`${IVR_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agb-key': IVR_APP_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Ring the farmer's phone and run the booking / status IVR. */
export function requestCallback(phone, lang) {
  return post('/call-me', { phone, lang });
}

/**
 * After a gate entry, ask the server to phone the next waiting farmer.
 * Fire-and-forget: never blocks or fails the officer's action.
 */
export function notifyNextFarmer(centreId, date) {
  if (!IVR_BASE_URL) return;
  post('/notify-next', { centreId, date }).catch((e) =>
    console.log('notify-next skipped:', e.message)
  );
}

/** Wake the Render free instance so the first call is not slow. */
export function warmUpIvr() {
  if (!IVR_BASE_URL) return;
  fetch(`${IVR_BASE_URL}/health`).catch(() => {});
}
