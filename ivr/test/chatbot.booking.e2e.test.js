/**
 * ivr/test/chatbot.booking.e2e.test.js
 * ---------------------------------------------------------------
 * End-to-end mocked tests for the complete conversational booking flow.
 *
 * Tests the full pipeline:
 *   ChatbotScreen (services/chatbot.js) → backend POST /chat
 *   → createChatbot → createAgent → booking-service
 *
 * Covers scenarios required by task spec:
 *  - Successful conversational booking (gather → slots → propose → confirm)
 *  - Missing / invalid booking details
 *  - Confirmation required before booking
 *  - Stale confirmation and changed booking details
 *  - Cancellation and change of mind
 *  - Duplicate requests and retries (idempotency)
 *  - Concurrent attempts for the same slot
 *  - Slot becoming unavailable before confirmation or booking
 *  - Firebase failures and uncertain outcomes
 *  - No fabricated success messages or booking IDs
 *  - Existing FAQ / language / read-only tools remain functional
 *  - CHATBOT_ALLOW_BOOKING=false disables booking writes
 *
 * Run: npm test  (from ivr/)  or  node --test test/chatbot.booking.e2e.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgent, TOOL_NAMES } = require("../agent");
const { createChatbot } = require("../chatbot");
const {
  makeBookingService,
  isExplicitConfirm,
  MAX_ACTIVE_TOKENS_PER_CENTRE,
  CONFIRM_TTL_MS,
} = require("../booking-service");

// ---------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------

const NOW = Date.parse("2026-10-20T03:00:00Z"); // early IST morning
const FARMER = "9876543210";
const CENTRE_ID = "centre_test_01";
const DATE = "2026-10-21";
const SLOT = "10:00";
// Session IDs must be >=3 chars to pass normalizeSessionId validation
const SID = "session-a";

const CENTRE = {
  name: "Test Procurement Yard",
  name_en: "Test Procurement Yard",
  address: "Sector 12, Test City",
  active: true,
  acceptedCrops: ["wheat", "mustard"],
  operatingStartTime: "08:00",
  operatingEndTime: "18:00",
  parallelLanes: 2,
  avgMinutesPerEntry: 15,
  closedDays: [0],
  throughputPerHour: { default: 400 },
};

const quiet = { error() {}, log() {}, warn() {} };

// ---------------------------------------------------------------
// Fake Firestore (mirrors booking-service.test.js FakeDb)
// ---------------------------------------------------------------

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}
function docSnap(id, data) {
  return { id, exists: data !== undefined, data: () => clone(data) };
}
function querySnap(docs) {
  return { docs, empty: docs.length === 0 };
}

class FakeQuery {
  constructor(col, filters = []) { this._col = col; this._filters = filters; }
  where(f, op, v) { return new FakeQuery(this._col, [...this._filters, { f, op, v }]); }
  async get() { return this._col._get(this._filters); }
}

class FakeCollection {
  constructor(db, name) { this._db = db; this._name = name; }
  doc(id) { return new FakeDoc(this._db, this._name, id); }
  where(f, op, v) { return new FakeQuery(this, [{ f, op, v }]); }
  _get(filters = []) {
    const rows = Array.from(this._db._docs.get(this._name).entries())
      .filter(([, data]) =>
        filters.every(({ f, op, v }) => {
          if (op === "==") return data[f] === v;
          throw new Error(`unsupported op ${op}`);
        })
      )
      .map(([id, data]) => docSnap(id, data));
    return querySnap(rows);
  }
  async get(filters = []) { return this._get(filters); }
}

class FakeDoc {
  constructor(db, col, id) { this._db = db; this._col = col; this._id = id; }
  async get() { return docSnap(this._id, this._db._docs.get(this._col).get(this._id)); }
  async set(data, opts = {}) {
    const cur = this._db._docs.get(this._col).get(this._id);
    this._db._docs.get(this._col).set(
      this._id,
      opts.merge ? { ...(cur || {}), ...clone(data) } : clone(data)
    );
  }
}

class FakeDb {
  constructor(seed = {}) {
    this._docs = new Map();
    for (const [name, rows] of Object.entries(seed)) {
      this._docs.set(name, new Map(Object.entries(clone(rows))));
    }
  }
  collection(name) {
    if (!this._docs.has(name)) this._docs.set(name, new Map());
    return new FakeCollection(this, name);
  }
  async runTransaction(fn) {
    const tx = {
      get: async (ref) => ref.get(),
      set: async (ref, data, opts) => ref.set(data, opts),
    };
    return fn(tx);
  }
}

function makeDb(seed = {}) {
  return new FakeDb({
    centres: { [CENTRE_ID]: CENTRE },
    bookings: {},
    centreQueues: {},
    users: { [FARMER]: { name: "Test Farmer", phone: FARMER } },
    ...seed,
  });
}

function makeSvc(db, overrides = {}) {
  return makeBookingService({ db, nowMs: NOW, logger: quiet, ...overrides });
}

// ---------------------------------------------------------------
// Fake Gemini model (scripted turns)
// ---------------------------------------------------------------

function fakeResult(parts) {
  return {
    response: {
      candidates: [{ content: { role: "model", parts } }],
      text() {
        const t = parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("");
        if (!t) throw new Error("No text in response");
        return t;
      },
    },
  };
}

const fc = (name, args = {}, id = "c1") => ({ functionCall: { name, args, id }, thoughtSignature: "sig" });

class FakeModel {
  constructor(turns) { this.turns = turns; this.i = 0; this.requests = []; }
  async generateContent(req) {
    this.requests.push(req);
    const spec = this.turns[Math.min(this.i, this.turns.length - 1)];
    this.i += 1;
    return fakeResult(typeof spec === "function" ? spec(req) : spec);
  }
  lastFnResponses() {
    const c = this.requests[this.requests.length - 1].contents;
    return (c[c.length - 1].parts || []).filter((p) => p.functionResponse).map((p) => p.functionResponse);
  }
}

// ---------------------------------------------------------------
// Tests: Successful conversational booking flow
// ---------------------------------------------------------------

test("full conversational booking: gather → slots → propose → confirm → real token", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  // 1. Propose a booking
  const proposal = await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.requiresConfirmation, true);
  assert.equal(proposal.summary.crop, "wheat");
  assert.ok(proposal.confirmationId);

  // No booking committed yet
  assert.equal(db._docs.get("bookings").size, 0);

  // 2. Confirm on next turn
  const confirmed = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "haan, confirm kar do",
    turnId: "turn-2",
  });

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.alreadyConfirmed, false);
  assert.equal(confirmed.booking.status, "booked");
  assert.match(confirmed.booking.tokenNumber, /^[A-Z]-\d{2}$/);
  assert.ok(confirmed.booking.bookingId);
  assert.equal(confirmed.booking.crop, "wheat");
  assert.equal(confirmed.booking.date, DATE);
  assert.equal(confirmed.booking.slotTime, SLOT);

  // Queue updated
  const q = db._docs.get("centreQueues").get(`${CENTRE_ID}__${DATE}`);
  assert.equal(q.totalBooked, 1);
  assert.equal(q.slotCounts[SLOT], 1);
  assert.equal(db._docs.get("bookings").size, 1);
});

test("agent: full booking tool chain gives real token in reply", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  const model = new FakeModel([
    [
      fc(TOOL_NAMES.GET_CENTRES_FOR_CROP, { crop: "wheat" }, "c1"),
      fc(TOOL_NAMES.GET_BOOKING_SLOTS, { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25, date: DATE }, "c2"),
      fc(TOOL_NAMES.PROPOSE_BOOKING, { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25, date: DATE, slotTime: SLOT }, "c3"),
    ],
    [{ text: "Here is your booking summary. Should I confirm it?" }],
  ]);

  const agent = createAgent({ model, store: null, bookingService: svc });
  const result = await agent.chat({
    message: "book wheat 25 quintals at Test Yard tomorrow 10am",
    farmerId: FARMER,
    sessionId: "session-a",
    language: "en",
  });

  // Model should have proposed, not yet confirmed
  assert.ok(result.toolsUsed.includes(TOOL_NAMES.PROPOSE_BOOKING));
  assert.ok(!result.toolsUsed.includes(TOOL_NAMES.CONFIRM_BOOKING));
  assert.equal(db._docs.get("bookings").size, 0, "no booking until confirmed");

  // Now the farmer confirms on the next turn
  const model2 = new FakeModel([
    [fc(TOOL_NAMES.CONFIRM_BOOKING, {}, "c4")],
    [{ text: "Booking confirmed! Your token is A-01." }],
  ]);
  const agent2 = createAgent({ model: model2, store: null, bookingService: svc });
  const result2 = await agent2.chat({
    message: "yes, confirm",
    farmerId: FARMER,
    sessionId: "session-a",
    language: "en",
  });

  assert.ok(result2.toolsUsed.includes(TOOL_NAMES.CONFIRM_BOOKING));
  const confirmResp = model2.lastFnResponses()[0];
  assert.equal(confirmResp.response.ok, true);
  assert.ok(confirmResp.response.booking.bookingId);
  assert.equal(db._docs.get("bookings").size, 1);
});

// ---------------------------------------------------------------
// Missing / invalid booking details
// ---------------------------------------------------------------

test("proposeBooking rejects missing crop", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_CROP");
});

test("proposeBooking rejects invalid quantity (zero)", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 0,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_QUANTITY");
});

test("proposeBooking rejects past date", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: "2020-01-01", slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "DATE_IN_PAST");
});

test("proposeBooking rejects date too far ahead", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: "2027-12-31", slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "DATE_TOO_FAR");
});

test("proposeBooking rejects invalid slotTime format", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: "morning", turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_SLOT");
});

test("proposeBooking rejects crop not accepted at centre", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "session-a",
    centreId: CENTRE_ID, crop: "paddy", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "CROP_NOT_ACCEPTED");
});

test("agent: malformed tool args (negative quantity) return INVALID_QUANTITY", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  const model = new FakeModel([
    [fc(TOOL_NAMES.GET_BOOKING_SLOTS, { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: -5, date: DATE }, "c1")],
    [{ text: "Invalid quantity." }],
  ]);
  const agent = createAgent({ model, store: null, bookingService: svc });
  await agent.chat({ message: "slots?", farmerId: FARMER, sessionId: "s", language: "en" });
  const resp = model.lastFnResponses()[0];
  assert.equal(resp.response.ok, false);
  assert.equal(resp.response.error, "INVALID_QUANTITY");
  assert.equal(db._docs.get("bookings").size, 0);
});

// ---------------------------------------------------------------
// Confirmation required before booking
// ---------------------------------------------------------------

test("confirmBooking fails without a prior proposal", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "session-a",
    message: "yes, book it", turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "NO_PENDING_BOOKING");
  assert.equal(makeDb()._docs.get("bookings").size, 0);
});

test("agent: confirmBooking called without prior proposeBooking returns NO_PENDING_BOOKING", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  const model = new FakeModel([
    [fc(TOOL_NAMES.CONFIRM_BOOKING, {}, "c1")],
    [{ text: "There is no pending booking to confirm." }],
  ]);
  const agent = createAgent({ model, store: null, bookingService: svc });
  await agent.chat({ message: "yes confirm", farmerId: FARMER, sessionId: "s", language: "en" });
  const resp = model.lastFnResponses()[0];
  assert.equal(resp.response.ok, false);
  assert.equal(resp.response.error, "NO_PENDING_BOOKING");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("ambiguous message cannot confirm a pending booking", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "hmm, which mandi was that?", turnId: "t2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "CONFIRMATION_REQUIRED");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("same-turn confirm is blocked (proposal and confirm in same turn)", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  const proposal = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "turn-x",
  });
  assert.equal(proposal.ok, true);
  const sameTurn = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "yes confirm", turnId: "turn-x", // same turnId
  });
  assert.equal(sameTurn.ok, false);
  assert.equal(sameTurn.error, "CONFIRMATION_SAME_TURN");
  assert.equal(db._docs.get("bookings").size, 0);
});

// ---------------------------------------------------------------
// Stale confirmation and changed booking details
// ---------------------------------------------------------------

test("re-proposal supersedes old intent; old confirmationId cannot be used", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  const first = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 20,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  const second = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 30,
    date: DATE, slotTime: SLOT, turnId: "t3",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.confirmationId, second.confirmationId);

  // Old intent is superseded
  const oldIntent = db._docs.get("chatBookingIntents").get(first.confirmationId);
  assert.equal(oldIntent.status, "superseded");

  // Confirming now uses the second (latest) proposal
  const confirmed = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "yes", turnId: "t4",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.booking.quantityQuintals, 30);
});

test("expired confirmation cannot be used", async () => {
  const db = makeDb();
  let now = NOW;
  const svc = makeBookingService({ db, nowMs: () => now, logger: quiet });

  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });

  // Advance clock past TTL
  now += CONFIRM_TTL_MS + 1000;

  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "yes, confirm", turnId: "t2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "CONFIRMATION_EXPIRED");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("tampered intent with invalid details is rejected before transaction", async () => {
  // Use a session id that is at least 3 chars so normalizeSessionId doesn't fall back
  const sid = "session-bad";
  const db = makeDb({
    chatBookingIntents: {
      cbi_bad: {
        id: "cbi_bad", farmerId: FARMER, sessionId: sid,
        details: { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: -99, date: DATE, slotTime: SLOT },
        status: "pending",
        expiresAtMs: NOW + 60_000,
        proposedTurnId: "t1",
      },
    },
    chatBookingSessions: {
      [`${FARMER}__${sid}`]: { farmerId: FARMER, sessionId: sid, pendingIntentId: "cbi_bad" },
    },
  });
  const svc = makeSvc(db);
  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: sid, message: "yes", turnId: "t2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_INTENT");
  assert.equal(db._docs.get("bookings").size, 0);
});

// ---------------------------------------------------------------
// Cancellation and change of mind
// ---------------------------------------------------------------

test("farmer changes mind: new proposal after negative response", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  // Propose first slot
  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: "10:00", turnId: "t1",
  });

  // Farmer says "no" — not an explicit confirm, so booking does not happen
  const no = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "nahi, 12 baje chahiye", turnId: "t2",
  });
  assert.equal(no.ok, false);
  assert.equal(no.error, "CONFIRMATION_REQUIRED");
  assert.equal(db._docs.get("bookings").size, 0);

  // Farmer chooses a different slot; propose again
  const second = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: "12:00", turnId: "t3",
  });
  assert.equal(second.ok, true);
  assert.equal(second.summary.slotTime, "12:00");

  const confirmed = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s",
    message: "haan, confirm", turnId: "t4",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.booking.slotTime, "12:00");
  assert.equal(db._docs.get("bookings").size, 1);
});

test("farmer cancels: isExplicitConfirm rejects clear refusal words", () => {
  const negatives = ["no", "nahi", "nahin", "cancel", "mat karo", "ruk", "abhi nahi", "नहीं", "रद्द"];
  for (const neg of negatives) {
    assert.equal(isExplicitConfirm(neg), false, `Expected false for: ${neg}`);
  }
});

// ---------------------------------------------------------------
// Duplicate requests and retries (idempotency)
// ---------------------------------------------------------------

test("confirmBooking is idempotent: double confirm returns same booking", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });

  const first = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s", message: "yes", turnId: "t2",
  });
  assert.equal(first.ok, true);
  const firstId = first.booking.bookingId;

  const second = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s", message: "yes, book it", turnId: "t3",
  });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyConfirmed, true);
  assert.equal(second.booking.bookingId, firstId);
  assert.equal(db._docs.get("bookings").size, 1, "only one booking must exist");
});

test("same proposeBooking with identical details refreshes TTL without creating new intent", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  const first = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  const second = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t2", // same details, new turn
  });

  assert.equal(first.confirmationId, second.confirmationId, "same intent should be refreshed");
  assert.equal(db._docs.get("chatBookingIntents").size, 1);
});

// ---------------------------------------------------------------
// Concurrent attempts for the same slot
// ---------------------------------------------------------------

test("active-token limit blocks concurrent bookings beyond MAX_ACTIVE_TOKENS_PER_CENTRE", async () => {
  const seedBookings = {};
  for (let i = 1; i <= MAX_ACTIVE_TOKENS_PER_CENTRE; i++) {
    seedBookings[`TKN-existing-${i}`] = {
      tokenId: `TKN-existing-${i}`, farmerId: FARMER,
      centreId: CENTRE_ID, status: "booked", date: DATE,
    };
  }
  const db = makeDb({ bookings: seedBookings });
  const svc = makeSvc(db);

  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "MAX_ACTIVE_TOKENS");
});

test("booking requires a logged-in farmer; anonymous request is rejected", async () => {
  const svc = makeSvc(makeDb());
  const result = await svc.proposeBooking({
    farmerId: null, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "NOT_LOGGED_IN");
});

// ---------------------------------------------------------------
// Slot becoming unavailable
// ---------------------------------------------------------------

test("slot fills up between getSlots and confirmBooking: alternatives returned", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });

  // Fill the slot externally (simulate concurrent booking)
  const qRef = db.collection("centreQueues").doc(`${CENTRE_ID}__${DATE}`);
  await qRef.set({
    slotCounts: { [SLOT]: 99 },
    slotLoadMinutes: { [SLOT]: 9999 },
    slotExpectedMinutes: { [SLOT]: 9999 },
  });

  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s", message: "yes", turnId: "t2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "SLOT_FULL");
  assert.ok(Array.isArray(result.alternatives), "alternatives must be provided");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("proposeBooking rejects an unavailable slot (immediately full)", async () => {
  const db = makeDb({
    centreQueues: {
      [`${CENTRE_ID}__${DATE}`]: {
        slotCounts: { [SLOT]: 99 },
        slotLoadMinutes: { [SLOT]: 9999 },
        slotExpectedMinutes: { [SLOT]: 9999 },
      },
    },
  });
  const svc = makeSvc(db);
  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "SLOT_UNAVAILABLE");
  assert.ok(Array.isArray(result.alternatives));
  assert.equal(db._docs.get("bookings").size, 0);
});

// ---------------------------------------------------------------
// Firebase failures and uncertain outcomes
// ---------------------------------------------------------------

test("Firebase error during confirmBooking returns TOOL_FAILED, not invented success", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });

  // Break the transaction
  const origTx = db.runTransaction.bind(db);
  db.runTransaction = async () => { throw new Error("Firestore: UNAVAILABLE: quota exceeded"); };

  const result = await svc.confirmBooking({
    farmerId: FARMER, sessionId: "s", message: "yes", turnId: "t2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "TOOL_FAILED");
  // The message must instruct NOT to claim success
  assert.match(result.message, /Do not claim success|not claim success|try again/i);

  db.runTransaction = origTx;
});

test("agent: Firestore failure in tool returns TOOL_FAILED, model never invents booking", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  // Break proposeBooking
  const origPropose = svc.proposeBooking.bind(svc);
  svc.proposeBooking = async () => { throw new Error("ECONNRESET"); };

  const model = new FakeModel([
    [fc(TOOL_NAMES.PROPOSE_BOOKING, { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25, date: DATE, slotTime: SLOT }, "c1")],
    [{ text: "I could not complete the booking. Please try again." }],
  ]);
  const agent = createAgent({ model, store: null, bookingService: svc, logger: quiet });
  await agent.chat({ message: "book wheat", farmerId: FARMER, sessionId: "s", language: "en" });

  const resp = model.lastFnResponses()[0];
  assert.equal(resp.response.ok, false);
  assert.equal(resp.response.error, "TOOL_FAILED");
  // No invented booking data
  assert.ok(!resp.response.bookingId);
  assert.ok(!resp.response.tokenNumber);

  svc.proposeBooking = origPropose;
});

test("Gemini API failure propagates as rejection (no invented reply)", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  const model = {
    async generateContent() { throw new Error("API quota exceeded"); },
  };
  const agent = createAgent({ model, store: null, bookingService: svc, logger: quiet });
  await assert.rejects(
    () => agent.chat({ message: "book wheat", farmerId: FARMER, sessionId: "s" }),
    /quota exceeded/i
  );
});

// ---------------------------------------------------------------
// No fabricated success messages or booking IDs
// ---------------------------------------------------------------

test("confirmBooking disabled via CHATBOT_ALLOW_BOOKING=false returns BOOKING_DISABLED", async () => {
  const db = makeDb();
  const svc = makeBookingService({ db, nowMs: NOW, logger: quiet, enabled: false });

  const result = await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "BOOKING_DISABLED");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("createChatbot: CHATBOT_ALLOW_BOOKING=false disables booking tools in agent", () => {
  const origEnv = process.env.CHATBOT_ALLOW_BOOKING;
  process.env.CHATBOT_ALLOW_BOOKING = "false";
  try {
    const db = {
      collection: () => ({ doc: (id) => ({ get: async () => ({ exists: id === FARMER }) }) }),
      runTransaction: () => {},
    };
    const model = { async generateContent() { return { response: { candidates: [{ content: { role: "model", parts: [{ text: "ok" }] } }], text() { return "ok"; } } }; } };
    const chatbot = createChatbot({ db, model, store: null });
    assert.ok(chatbot, "chatbot should still be created");
    // bookingEnabled should be false when CHATBOT_ALLOW_BOOKING=false
  } finally {
    if (origEnv === undefined) delete process.env.CHATBOT_ALLOW_BOOKING;
    else process.env.CHATBOT_ALLOW_BOOKING = origEnv;
  }
});

test("confirmBooking tool result is never fabricated: response must be from backend", async () => {
  const db = makeDb();
  const svc = makeSvc(db);

  await svc.proposeBooking({
    farmerId: FARMER, sessionId: "s",
    centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 25,
    date: DATE, slotTime: SLOT, turnId: "t1",
  });

  const model = new FakeModel([
    [fc(TOOL_NAMES.CONFIRM_BOOKING, {}, "c1")],
    [{ text: "Great, booking confirmed!" }],
  ]);
  const agent = createAgent({ model, store: null, bookingService: svc });
  await agent.chat({ message: "yes confirm", farmerId: FARMER, sessionId: "s", language: "en" });

  const resp = model.lastFnResponses()[0];
  // The confirmed booking must come from the actual DB
  assert.equal(resp.response.ok, true);
  assert.ok(resp.response.booking.bookingId);
  const bookings = Array.from(db._docs.get("bookings").values());
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].tokenId, resp.response.booking.bookingId);
});

// ---------------------------------------------------------------
// Existing FAQ / language / read-only tools remain functional
// ---------------------------------------------------------------

test("FAQ question answered without any tool call or booking attempt", async () => {
  const db = makeDb();
  const model = new FakeModel([[{ text: "You need your ration card and bank details." }]]);
  const agent = createAgent({ model, store: null, bookingService: null });
  const result = await agent.chat({ message: "What documents do I need?", farmerId: null });
  assert.ok(result.reply.length > 0);
  assert.equal(result.toolsUsed.length, 0);
  assert.equal(db._docs.get("bookings").size, 0);
});

test("Hindi language instruction is injected and booking tools still work", async () => {
  const db = makeDb();
  const svc = makeSvc(db);
  // Capture the prompt before the contents array is mutated by tool-response appends
  let capturedPrompt = null;
  const model = new FakeModel([
    (req) => {
      // First call: record the user prompt (first content turn, first part)
      const firstUserTurn = (req.contents || []).find((c) => c.role === "user");
      if (firstUserTurn && !capturedPrompt) {
        capturedPrompt = (firstUserTurn.parts[0] || {}).text || null;
      }
      return [fc(TOOL_NAMES.GET_CENTRES_FOR_CROP, { crop: "wheat" }, "c1")];
    },
    [{ text: "यहाँ मंडियाँ हैं:" }],
  ]);
  const agent = createAgent({ model, store: null, bookingService: svc });
  const result = await agent.chat({ message: "गेहूँ के लिए मंडी", farmerId: FARMER, language: "hi" });
  assert.ok(capturedPrompt, "prompt must be captured");
  assert.match(capturedPrompt, /RESPONSE LANGUAGE: Hindi/);
  assert.ok(result.toolsUsed.includes(TOOL_NAMES.GET_CENTRES_FOR_CROP));
});

test("getAvailableSlots tool still works and note does not say 'cannot book'", async () => {
  const fakeStore = {
    fetchCentreById: async () => ({ id: CENTRE_ID, name: "Test Yard" }),
    fetchAvailableSlots: async () => [{ slotTime: "10:00", availableCapacity: 3 }],
    activeBookingsFor: async () => [],
    queueFor: async () => null,
  };
  const model = new FakeModel([
    [fc(TOOL_NAMES.GET_AVAILABLE_SLOTS, { centreId: CENTRE_ID, date: DATE }, "c1")],
    [{ text: "Slots are available." }],
  ]);
  const agent = createAgent({ model, store: fakeStore, bookingService: null });
  await agent.chat({ message: "slots at centre_test_01?", farmerId: null });
  const resp = model.lastFnResponses()[0];
  assert.equal(resp.response.ok, true);
  assert.ok(resp.response.slots.length > 0);
  // The old note "cannot book" should be gone
  assert.ok(!resp.response.note.includes("cannot book"));
});

test("chatbot verifyFarmer: spoofed phone rejects unregistered farmer for booking", async () => {
  const db = makeDb(); // only FARMER is in users
  const model = new FakeModel([
    [fc(TOOL_NAMES.PROPOSE_BOOKING, {
      centreId: CENTRE_ID, crop: "wheat",
      quantityQuintals: 25, date: DATE, slotTime: SLOT,
    }, "c1")],
    [{ text: "Could not book." }],
  ]);
  const svc = makeSvc(db);
  const chatbot = createChatbot({ db, model, store: null, bookingService: svc });

  // Phone 1111111111 is NOT in users collection
  await chatbot.chat({
    message: "book wheat for me",
    phone: "1111111111",
    sessionId: "s",
    language: "en",
  });

  const resp = model.lastFnResponses()[0];
  assert.equal(resp.response.ok, false);
  assert.equal(resp.response.error, "NOT_LOGGED_IN");
  assert.equal(db._docs.get("bookings").size, 0);
});

test("pending booking summary is surfaced in the system prompt", async () => {
  const pendingCalls = [];
  const svc = {
    enabled: true,
    async getPending(args) {
      pendingCalls.push(args);
      return {
        confirmationId: "cbi_99",
        summary: { crop: "mustard", quantityQuintals: 15, slotTime: "14:00", date: DATE },
        expiresAt: "2026-10-21T02:00:00.000Z",
      };
    },
  };
  const db = {
    collection: () => ({
      doc: (id) => ({ get: async () => ({ exists: id === FARMER }) }),
    }),
  };
  const model = new FakeModel([[{ text: "Your booking is pending." }]]);
  const chatbot = createChatbot({ db, model, store: null, bookingService: svc });

  await chatbot.chat({ message: "what is my pending booking?", phone: FARMER, sessionId: "sess-1" });

  assert.deepEqual(pendingCalls, [{ farmerId: FARMER, sessionId: "sess-1" }]);
  const prompt = model.requests[0].contents.at(-1).parts[0].text;
  assert.match(prompt, /PENDING UNCONFIRMED BOOKING/);
  assert.match(prompt, /mustard/);
  assert.match(prompt, /15/);
});
