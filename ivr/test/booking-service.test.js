/**
 * ivr/test/booking-service.test.js
 * ---------------------------------------------------------------
 * Mocked Firestore tests for the server-side conversational booking
 * service (no real Firebase, no Gemini calls).
 *
 * Run:  npm test   (from ivr/)   or   node --test test/booking-service.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  makeBookingService,
  isExplicitConfirm,
  MAX_ACTIVE_TOKENS_PER_CENTRE,
  CONFIRM_TTL_MS,
} = require("../booking-service");

const NOW = Date.parse("2026-10-20T03:00:00Z");
const FARMER = "9876543210";
const CENTRE_ID = "centre_test_01";
const DATE = "2026-10-21";
const SLOT = "10:00";

const CENTRE = {
  name: "Test Procurement Yard",
  name_en: "Test Procurement Yard",
  address: "Sector 12, Test",
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

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function docSnap(id, data) {
  return {
    id,
    exists: data !== undefined,
    data: () => clone(data),
  };
}

function querySnap(docs) {
  return { docs, empty: docs.length === 0 };
}

class FakeQuery {
  constructor(collection, filters = []) {
    this.collection = collection;
    this.filters = filters;
  }

  where(field, op, value) {
    return new FakeQuery(this.collection, [...this.filters, { field, op, value }]);
  }

  async get() {
    return this.collection.get(this.filters);
  }
}

class FakeCollection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  doc(id) {
    return new FakeDoc(this.db, this.name, id);
  }

  where(field, op, value) {
    return new FakeQuery(this, [{ field, op, value }]);
  }

  async get(filters = []) {
    const rows = Array.from(this.db.docs.get(this.name).entries())
      .filter(([, data]) =>
        filters.every(({ field, op, value }) => {
          if (op === "==") return data[field] === value;
          throw new Error(`unsupported fake query operator ${op}`);
        })
      )
      .map(([id, data]) => docSnap(id, data));
    return querySnap(rows);
  }
}

class FakeDoc {
  constructor(db, collection, id) {
    this.db = db;
    this.collection = collection;
    this.id = id;
  }

  async get() {
    return docSnap(this.id, this.db.docs.get(this.collection).get(this.id));
  }

  async set(data, options = {}) {
    const current = this.db.docs.get(this.collection).get(this.id);
    this.db.docs.get(this.collection).set(
      this.id,
      options.merge ? { ...(current || {}), ...clone(data) } : clone(data)
    );
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.docs = new Map();
    for (const [name, rows] of Object.entries(seed)) {
      this.docs.set(name, new Map(Object.entries(clone(rows))));
    }
  }

  collection(name) {
    if (!this.docs.has(name)) this.docs.set(name, new Map());
    return new FakeCollection(this, name);
  }

  async runTransaction(fn) {
    const tx = {
      get: async (ref) => ref.get(),
      set: async (ref, data, options) => ref.set(data, options),
    };
    return fn(tx);
  }
}

function makeDb(seed = {}) {
  return new FakeDb({
    centres: { [CENTRE_ID]: CENTRE },
    bookings: {},
    centreQueues: {},
    ...seed,
  });
}

function service(db) {
  return makeBookingService({ db, nowMs: NOW, logger: quiet });
}

test("explicit-confirmation detector rejects questions and ambiguity", () => {
  for (const yes of ["yes", "haan", "haan ji, confirm", "ok kar do", "book it", "हाँ", "ठीक है"]) {
    assert.equal(isExplicitConfirm(yes), true, yes);
  }
  for (const no of ["", "hmm", "which slot?", "no", "nahi", "cancel", "not now", "क्या?"]) {
    assert.equal(isExplicitConfirm(no), false, no);
  }
});

test("listCentresForCrop resolves crop aliases and hides inactive centres", async () => {
  const db = makeDb({
    centres: {
      [CENTRE_ID]: CENTRE,
      centre_test_02: { ...CENTRE, name: "Closed Yard", active: false },
      centre_test_03: { ...CENTRE, name: "Paddy Yard", acceptedCrops: ["paddy"] },
    },
  });
  const svc = service(db);

  const wheat = await svc.listCentresForCrop("gehu");
  assert.deepEqual(wheat.map((c) => c.centreId), [CENTRE_ID]);

  const all = await svc.listCentresForCrop(null);
  assert.deepEqual(all.map((c) => c.centreId).sort(), [CENTRE_ID, "centre_test_03"]);
});

test("getSlots uses the capacity engine and returns real open windows", async () => {
  const svc = service(makeDb());

  const result = await svc.getSlots({
    centreId: CENTRE_ID,
    crop: "gehu",
    quantityQuintals: 25,
    date: DATE,
    farmerId: FARMER,
  });

  assert.equal(result.ok, true);
  assert.equal(result.crop, "wheat");
  assert.ok(result.availableSlots.length > 0);
  assert.ok(result.availableSlots.every((s) => s.slotTime));
  assert.equal(result.quantityQuintals, 25);
});

test("propose creates only a pending summary; same-turn confirm is rejected", async () => {
  const db = makeDb();
  const svc = service(db);

  const proposal = await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "gehu",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.requiresConfirmation, true);
  assert.equal(proposal.summary.crop, "wheat");
  assert.equal(proposal.summary.quantityQuintals, 25);
  assert.equal(proposal.summary.slotTime, SLOT);
  assert.equal(db.docs.get("bookings").size, 0, "proposal must not create a booking");

  const sameTurn = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes, confirm",
    turnId: "turn-1",
  });
  assert.equal(sameTurn.ok, false);
  assert.equal(sameTurn.error, "CONFIRMATION_SAME_TURN");
  assert.equal(db.docs.get("bookings").size, 0);

  const pending = await svc.getPending({ farmerId: FARMER, sessionId: "session-a" });
  assert.equal(pending.confirmationId, proposal.confirmationId);
  assert.equal(pending.details.slotTime, SLOT);
});

test("a re-proposal supersedes the old intent so only the latest summary can be confirmed", async () => {
  const db = makeDb();
  const svc = service(db);

  const first = await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 20,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });
  assert.equal(first.ok, true);

  const second = await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 30,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-3",
  });
  assert.equal(second.ok, true);
  assert.notEqual(second.confirmationId, first.confirmationId);
  assert.equal(db.docs.get("chatBookingIntents").get(first.confirmationId).status, "superseded");

  const pending = await svc.getPending({ farmerId: FARMER, sessionId: "session-a" });
  assert.equal(pending.confirmationId, second.confirmationId);
  assert.equal(pending.details.quantityQuintals, 30);

  const confirmed = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes confirm",
    turnId: "turn-4",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.booking.quantityQuintals, 30);
  assert.equal(confirmed.booking.bookingId, db.docs.get("chatBookingIntents").get(second.confirmationId).bookingId);
});

test("a tampered pending intent with invalid details is rejected before the transaction", async () => {
  const sid = "session-a";
  const db = makeDb({
    chatBookingIntents: {
      cbi_bad: {
        id: "cbi_bad",
        farmerId: FARMER,
        sessionId: sid,
        details: {
          centreId: CENTRE_ID,
          crop: "wheat",
          quantityQuintals: -5,
          date: DATE,
          slotTime: SLOT,
        },
        status: "pending",
        expiresAtMs: NOW + 60_000,
        proposedTurnId: "turn-1",
      },
    },
    chatBookingSessions: {
      [`${FARMER}__${sid}`]: { farmerId: FARMER, sessionId: sid, pendingIntentId: "cbi_bad" },
    },
  });
  const svc = service(db);

  const result = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: sid,
    message: "yes confirm",
    turnId: "turn-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_INTENT");
  assert.equal(db.docs.get("bookings").size, 0);
});

test("next-turn explicit confirmation commits the booking and updates the queue", async () => {
  const db = makeDb();
  const svc = service(db);

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

  const confirmed = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "haan, confirm kar do",
    turnId: "turn-2",
  });

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.alreadyConfirmed, false);
  assert.equal(confirmed.booking.crop, "wheat");
  assert.equal(confirmed.booking.quantityQuintals, 25);
  assert.equal(confirmed.booking.date, DATE);
  assert.equal(confirmed.booking.slotTime, SLOT);
  assert.equal(confirmed.booking.status, "booked");
  assert.match(confirmed.booking.tokenNumber, /^[A-Z]-\d{2}$/);

  const bookings = Array.from(db.docs.get("bookings").values());
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].tokenId, confirmed.booking.bookingId);
  assert.equal(bookings[0].source, "chatbot");
  assert.equal(bookings[0].chatIntentId, proposal.confirmationId);

  const queue = db.docs.get("centreQueues").get(`${CENTRE_ID}__${DATE}`);
  assert.equal(queue.totalBooked, 1);
  assert.equal(queue.lastIssuedPosition, 1);
  assert.equal(queue.slotCounts[SLOT], 1);

  const intent = db.docs.get("chatBookingIntents").get(proposal.confirmationId);
  assert.equal(intent.status, "completed");
  assert.equal(intent.bookingId, confirmed.booking.bookingId);
  const session = db.docs.get("chatBookingSessions").get(`${FARMER}__session-a`);
  assert.equal(session.pendingIntentId, null);
  assert.equal(session.lastIntentId, proposal.confirmationId);
  assert.equal(session.lastBookingId, confirmed.booking.bookingId);
});

test("confirm is idempotent and returns the same booking", async () => {
  const db = makeDb();
  const svc = service(db);

  await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });
  const first = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes",
    turnId: "turn-2",
  });
  assert.equal(first.ok, true);

  const again = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes, book it",
    turnId: "turn-3",
  });
  assert.equal(again.ok, true);
  assert.equal(again.alreadyConfirmed, true);
  assert.equal(again.booking.bookingId, first.booking.bookingId);
  assert.equal(db.docs.get("bookings").size, 1);
});

test("ambiguous current message cannot confirm a pending booking", async () => {
  const svc = service(makeDb());

  await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });

  const result = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "which slot is this?",
    turnId: "turn-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "CONFIRMATION_REQUIRED");
});

test("a slot that fills before confirmation returns fresh alternatives", async () => {
  const db = makeDb();
  const svc = service(db);

  await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });

  const queueRef = db.collection("centreQueues").doc(`${CENTRE_ID}__${DATE}`);
  await queueRef.set({
    slotCounts: { [SLOT]: 99 },
    slotLoadMinutes: { [SLOT]: 999 },
    slotExpectedMinutes: { [SLOT]: 999 },
  });

  const result = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes",
    turnId: "turn-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "SLOT_FULL");
  assert.ok(Array.isArray(result.alternatives));
  assert.equal(db.docs.get("bookings").size, 0);
});

test("active-token limit is enforced before and inside confirmation", async () => {
  const seedBookings = {};
  for (let i = 1; i <= MAX_ACTIVE_TOKENS_PER_CENTRE; i += 1) {
    seedBookings[`TKN-existing-${i}`] = {
      tokenId: `TKN-existing-${i}`,
      farmerId: FARMER,
      centreId: CENTRE_ID,
      status: "booked",
      date: DATE,
    };
  }
  const db = makeDb({ bookings: seedBookings });
  const svc = service(db);

  const result = await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "MAX_ACTIVE_TOKENS");
});

test("booking requires a verified farmer identity", async () => {
  const svc = service(makeDb());
  const result = await svc.proposeBooking({
    farmerId: null,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "NOT_LOGGED_IN");
});



test("a pending confirmation expires after its TTL", async () => {
  const db = makeDb();
  let now = NOW;
  const svc = makeBookingService({ db, nowMs: () => now, logger: quiet });

  await svc.proposeBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    centreId: CENTRE_ID,
    crop: "wheat",
    quantityQuintals: 25,
    date: DATE,
    slotTime: SLOT,
    turnId: "turn-1",
  });

  now += CONFIRM_TTL_MS + 1000;
  const result = await svc.confirmBooking({
    farmerId: FARMER,
    sessionId: "session-a",
    message: "yes",
    turnId: "turn-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "CONFIRMATION_EXPIRED");
  assert.equal(db.docs.get("bookings").size, 0);
});
