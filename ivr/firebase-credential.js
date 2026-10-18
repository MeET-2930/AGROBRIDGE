"use strict";

/**
 * ivr/firebase-credential.js
 * ---------------------------------------------------------------
 * Parses the FIREBASE_SERVICE_ACCOUNT_B64 / FIREBASE_SERVICE_ACCOUNT_JSON
 * value into the service-account object that firebase-admin's cert()
 * needs. Pure and side-effect free: it NEVER logs or returns the raw
 * secret, so it is safe to unit-test with dummy payloads.
 *
 * Accepted inputs (both server.js and chatbot-local.js use this):
 *   - the raw service-account JSON:   {"type":"service_account", ...}
 *   - base64 of that JSON (with or without line breaks / spaces)
 *
 * Anything else throws, so a placeholder like "# paste here" fails
 * closed instead of being sent to Firebase as a bogus credential.
 */
function parseServiceAccount(raw) {
  // Keep single spaces; drop whitespace runs that contain a newline
  // (base64 wrapped by `base64 -w0` has none, but pasted blocks do).
  const v = String(raw)
    .trim()
    .replace(/\s+/g, (m) => (m.includes("\n") ? "" : m));

  if (v.startsWith("{")) return JSON.parse(v);

  const decoded = Buffer.from(v.replace(/\s/g, ""), "base64").toString("utf8");
  if (!decoded.trim().startsWith("{")) {
    throw new Error("not a service-account JSON payload");
  }
  return JSON.parse(decoded);
}

module.exports = { parseServiceAccount };
