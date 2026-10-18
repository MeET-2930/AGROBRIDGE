/**
 * ivr/test/firebase-credential.test.js
 * ---------------------------------------------------------------
 * MOCKED tests for the service-account parser (no real credential,
 * no network). Confirms the exact accepted formats for
 * FIREBASE_SERVICE_ACCOUNT_B64 / _JSON and that placeholders fail closed.
 *
 * Run: node --test test/firebase-credential.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseServiceAccount } = require("../firebase-credential");

// A harmless DUMMY service-account shape (fake key material - never used).
const DUMMY = {
  type: "service_account",
  project_id: "demo-agrobridge",
  private_key_id: "dummy-key-id",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nDUMMY-KEY-DO-NOT-USE\n-----END PRIVATE KEY-----\n",
  client_email: "demo@demo-agrobridge.iam.gserviceaccount.com",
  client_id: "000000000000000000000",
  token_uri: "https://oauth2.googleapis.com/token",
};

test("accepts the raw service-account JSON", () => {
  const parsed = parseServiceAccount(JSON.stringify(DUMMY));
  assert.equal(parsed.project_id, "demo-agrobridge");
  assert.equal(parsed.client_email, DUMMY.client_email);
});

test("accepts raw JSON with surrounding whitespace / newlines", () => {
  const pretty = `\n  ${JSON.stringify(DUMMY, null, 2)}\n`;
  assert.equal(parseServiceAccount(pretty).project_id, "demo-agrobridge");
});

test("accepts base64 with no whitespace (base64 -w0)", () => {
  const b64 = Buffer.from(JSON.stringify(DUMMY), "utf8").toString("base64");
  assert.equal(parseServiceAccount(b64).project_id, "demo-agrobridge");
});

test("accepts base64 wrapped across lines", () => {
  const b64 = Buffer.from(JSON.stringify(DUMMY), "utf8").toString("base64");
  const wrapped = b64.replace(/(.{40})/g, "$1\n");
  assert.equal(parseServiceAccount(wrapped).project_id, "demo-agrobridge");
});

test("rejects a placeholder value (fails closed)", () => {
  assert.throws(() => parseServiceAccount("# paste the base64 here"), /service-account/);
});

test("rejects base64 that does not decode to JSON", () => {
  const notJson = Buffer.from("hello world", "utf8").toString("base64");
  assert.throws(() => parseServiceAccount(notJson), /service-account/);
});

test("rejects empty / undefined input", () => {
  assert.throws(() => parseServiceAccount(""));
  assert.throws(() => parseServiceAccount(undefined));
});
