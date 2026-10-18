"use strict";

/**
 * ivr/verify-firebase-readonly.js
 * ---------------------------------------------------------------
 * READ-ONLY verification of the agentic chatbot's Firestore tools.
 *
 * It runs the SAME ivr-core makeStore read paths the five agent tools
 * use (activeBookingsFor / fetchCentreById / queueFor /
 * fetchAvailableSlots) against a real project and prints REDACTED
 * diagnostics:
 *   - it never writes anything (no set/add/update/delete/transaction);
 *   - it never prints the credential;
 *   - it maps every row through the agent's whitelisted views, so
 *     gate-pass codes / QR payloads / admin codes are never shown,
 *     and it fails loudly if any of those keys ever appear.
 *
 * Credentials (identical to the servers):
 *   FIREBASE_SERVICE_ACCOUNT_B64, or FIREBASE_SERVICE_ACCOUNT_JSON,
 *   or Application Default Credentials.
 *
 * Usage (from ivr/, after a real credential is placed in ivr/.env):
 *   node verify-firebase-readonly.js --list-centres
 *   node verify-firebase-readonly.js --phone 9876543210
 *   node verify-firebase-readonly.js --phone 9876543210 --centre centre_gurugram_01 --date 2026-10-20
 *
 * Exit codes: 0 pass, 1 check failed, 2 credential/init failed.
 * ---------------------------------------------------------------
 */

require("dotenv").config();

const {
  initializeApp,
  cert,
  applicationDefault,
  getApps,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const { makeStore } = require("./ivr-core");
const {
  bookingViewOf,
  paymentViewOf,
  queueViewOf,
  centreViewOf,
} = require("./agent");
const { parseServiceAccount } = require("./firebase-credential");

// Keys that must never reach a model, a log, or a client.
const FORBIDDEN_KEYS = [
  "gatePassCode",
  "gatePassQr",
  "gatePassVerifiedBy",
  "adminCode",
  "private_key",
  "privateKey",
  "client_email",
];

function maskPhone(p) {
  const s = String(p || "").replace(/\D/g, "");
  if (s.length < 6) return "******";
  return `${s.slice(0, 2)}******${s.slice(-2)}`;
}

/** Throws if any object key (at any depth) is a forbidden field name. */
function assertNoSecrets(label, value) {
  const seen = new Set();
  (function walk(v) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);
    for (const k of Object.keys(v)) {
      if (FORBIDDEN_KEYS.includes(k)) {
        throw new Error(`${label} leaked forbidden key "${k}"`);
      }
      walk(v[k]);
    }
  })(value);
  return true;
}

/** Build a Firestore handle from env, mirroring the two servers. */
function initDb() {
  if (getApps().length) return getFirestore();

  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (raw && String(raw).trim().startsWith("#")) {
    throw new Error(
      "credential env var is a placeholder (starts with #), not credentials"
    );
  }
  if (raw) {
    initializeApp({ credential: cert(parseServiceAccount(raw)) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
  return getFirestore();
}

function parseArgs(argv) {
  const out = { listCentres: false, phone: null, centre: null, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--list-centres") out.listCentres = true;
    else if (a === "--phone") out.phone = argv[++i] || null;
    else if (a === "--centre") out.centre = argv[++i] || null;
    else if (a === "--date") out.date = argv[++i] || null;
  }
  return out;
}

/**
 * Run the read-only checks against an injected store (so it is
 * unit-testable without Firebase). All reads; no writes anywhere.
 * @returns {Promise<{ok:boolean, steps:Array, findings:Array}>}
 */
async function runChecks({
  store,
  phone = null,
  centreId = null,
  date = null,
  limit = 25,
  log = () => {},
}) {
  if (!store) throw new Error("runChecks: store is required");
  const steps = [];
  const findings = [];
  const record = (step, data) => {
    assertNoSecrets(step, data);
    steps.push({ step, ...data });
    log(`${step}: ${JSON.stringify(data)}`);
  };

  // 1) Public centre (fetchCentreById + centreViewOf)
  let centre = null;
  if (centreId) {
    centre = await store.fetchCentreById(centreId);
    if (centre) {
      const view = centreViewOf(centre);
      assertNoSecrets("centreView", view);
      record("centre", {
        centreId: view.centreId,
        name: view.name,
        acceptedCrops: view.acceptedCrops,
      });
    } else {
      record("centre", { centreId, found: false });
      findings.push(`centre ${centreId} does not exist`);
    }
  }

  // 2) Farmer-scoped bookings (activeBookingsFor)
  let bookings = [];
  if (phone) {
    bookings = await store.activeBookingsFor(phone);
    const foreign = bookings.filter(
      (b) => String(b.farmerId ?? b.farmerPhone ?? "") !== String(phone)
    );
    if (foreign.length) {
      throw new Error(
        `scope violation: activeBookingsFor(${maskPhone(phone)}) returned ${foreign.length} row(s) for another farmer`
      );
    }
    const views = bookings.map((b) => ({
      booking: bookingViewOf(b),
      payment: paymentViewOf(b),
    }));
    assertNoSecrets("bookingViews", views);
    record("bookings", {
      phone: maskPhone(phone),
      count: bookings.length,
      tokens: views.map((v) => v.booking.tokenNumber).slice(0, limit),
    });
    if (!bookings.length) {
      findings.push(
        `no active booking for ${maskPhone(phone)} (or not a registered farmer)`
      );
    }
  }

  const first = bookings[0] || null;
  const cid = centreId || (first && first.centreId) || null;
  const qdate = date || (first && first.date) || null;

  // 3) Live queue (queueFor + queueViewOf)
  if (cid && qdate) {
    const queue = await store.queueFor(cid, qdate);
    const qv = queueViewOf(
      bookings.find((b) => b.centreId === cid && b.date === qdate) || null,
      queue
    );
    assertNoSecrets("queueView", qv);
    record("queue", {
      centreId: cid,
      date: qdate,
      found: Boolean(queue),
      nowServingToken: qv ? qv.nowServingToken : null,
      totalBooked: qv ? qv.totalBooked : null,
      myPosition: qv ? qv.myPosition : null,
      tokensAhead: qv ? qv.tokensAhead : null,
    });
    if (!queue) findings.push(`no queue document for ${cid} on ${qdate}`);
  }

  // 4) Open slots (fetchAvailableSlots)
  if (centre && qdate) {
    const slots = await store.fetchAvailableSlots(centre, qdate);
    record("slots", { centreId: cid, date: qdate, openSlots: slots.length });
  }

  return { ok: true, steps, findings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let db;
  try {
    db = initDb();
  } catch (e) {
    console.error(`Firebase init failed: ${e.message}`);
    console.error(
      "Set FIREBASE_SERVICE_ACCOUNT_B64 (or _JSON, or ADC) - see README."
    );
    process.exit(2);
  }

  const store = makeStore(db);

  try {
    if (args.listCentres) {
      const centres = await store.fetchCentres();
      console.log(`centres: ${centres.length}`);
      for (const c of centres) console.log(`  - ${c.id} :: ${c.name || ""}`);
      return;
    }

    if (!args.phone && !args.centre) {
      console.log(
        "Nothing to check. Pass --phone <10digits> and/or --centre <id> [--date YYYY-MM-DD], or --list-centres."
      );
      return;
    }

    const res = await runChecks({
      store,
      phone: args.phone,
      centreId: args.centre,
      date: args.date,
      log: (m) => console.log(`  ${m}`),
    });

    if (res.findings.length) {
      console.log("Findings:");
      for (const f of res.findings) console.log(`  - ${f}`);
    }
    console.log("READ-ONLY FIREBASE CHECK PASSED");
  } catch (e) {
    console.error(`CHECK FAILED: ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  runChecks,
  maskPhone,
  assertNoSecrets,
  initDb,
  parseArgs,
  FORBIDDEN_KEYS,
};
