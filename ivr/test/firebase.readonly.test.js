/**
 * ivr/test/firebase.readonly.test.js
 * ---------------------------------------------------------------
 * MOCKED tests proving (a) the REAL ivr-core makeStore reads only the
 * intended collections with farmer scoping, and (b) the read-only
 * verifier redacts secrets, performs no writes, and detects scope
 * violations. No Firebase, no network.
 *
 * Run: node --test test/firebase.readonly.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { makeStore } = require("../ivr-core");
const {
  runChecks,
  assertNoSecrets,
  maskPhone,
} = require("../verify-firebase-readonly");

// ---------------------------------------------------------------
// Mock Firestore that records reads and refuses writes.
// ---------------------------------------------------------------

function mockDb({ bookings = [], centres = {}, queues = {} } = {}) {
  const reads = [];
  const writes = [];
  const snap = (id, data) => ({
    id,
    exists: data !== undefined,
    data: () => data,
  });

  function collection(name) {
    const state = { where: null };
    const api = {
      where(field, op, value) {
        state.where = { field, op, value };
        reads.push({ type: "where", name, field, op, value });
        return api;
      },
      doc(id) {
        reads.push({ type: "doc", name, id });
        return {
          get: async () => {
            reads.push({ type: "doc.get", name, id });
            if (name === "centres") return snap(id, centres[id]);
            if (name === "centreQueues") return snap(id, queues[id]);
            return snap(id, undefined);
          },
          set: () => {
            writes.push({ name, id });
            throw new Error("write attempted");
          },
          update: () => {
            writes.push({ name, id });
            throw new Error("write attempted");
          },
        };
      },
      async get() {
        reads.push({ type: "get", name, where: state.where });
        if (name === "centres") {
          return {
            docs: Object.entries(centres).map(([id, d]) => ({ id, data: () => d })),
          };
        }
        if (name === "bookings") {
          const w = state.where;
          const rows = bookings.filter((b) => !w || b[w.field] === w.value);
          return { docs: rows.map((b, i) => ({ id: `bk-${i}`, data: () => b })) };
        }
        return { docs: [] };
      },
      add: () => {
        writes.push({ name });
        throw new Error("write attempted");
      },
    };
    return api;
  }

  return { collection, _reads: reads, _writes: writes };
}

const CENTRE_DOC = {
  name: "Gurugram Procurement Yard",
  name_en: "Gurugram Procurement Yard",
  address: "Sector 12",
  acceptedCrops: ["wheat", "mustard"],
  operatingStartTime: "08:00",
  operatingEndTime: "18:00",
  parallelLanes: 2,
  avgMinutesPerEntry: 15,
  adminCode: "SECRET-ADMIN",
};

const BOOKING_DOC = {
  tokenId: "TKN-1",
  tokenNumber: "A-07",
  positionAssigned: 7,
  farmerId: "9876543210",
  centreId: "centre_gurugram_01",
  date: "2026-10-20",
  status: "booked",
  gatePassCode: "SECRET1",
  gatePassQr: "AGB|TKN-1|SECRET1",
};

const QUEUE_DOC = {
  nowServingPosition: 3,
  nowServingToken: "A-03",
  nowServingStatus: "assay",
  totalBooked: 12,
  completedCount: 2,
  openPositions: [1, 2, 3, 4, 5, 6, 7],
  insidePositions: [3],
  slotCounts: { "10:00": 1 },
};

// ---------------------------------------------------------------
// (a) Real makeStore uses the intended collections + farmer scope
// ---------------------------------------------------------------

test("makeStore reads centres / centreQueues / bookings and only the farmer's rows", async () => {
  const db = mockDb({
    bookings: [
      BOOKING_DOC,
      { ...BOOKING_DOC, tokenId: "TKN-2", tokenNumber: "B-02", farmerId: "1111111111" },
    ],
    centres: { centre_gurugram_01: CENTRE_DOC },
    queues: { "centre_gurugram_01__2026-10-20": QUEUE_DOC },
  });
  const store = makeStore(db);

  const rows = await store.activeBookingsFor("9876543210");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].farmerId, "9876543210");
  assert.equal(rows[0].tokenNumber, "A-07");

  const centre = await store.fetchCentreById("centre_gurugram_01");
  assert.equal(centre.id, "centre_gurugram_01");

  const queue = await store.queueFor("centre_gurugram_01", "2026-10-20");
  assert.equal(queue.nowServingToken, "A-03");

  const slots = await store.fetchAvailableSlots(centre, "2026-10-20");
  assert.ok(Array.isArray(slots));

  // intended collections only
  const collectionsRead = new Set(db._reads.map((r) => r.name));
  assert.deepEqual(
    [...collectionsRead].sort(),
    ["bookings", "centreQueues", "centres"]
  );

  // farmer-scoped query on bookings
  const bookingQuery = db._reads.find(
    (r) => r.name === "bookings" && r.type === "where"
  );
  assert.equal(bookingQuery.field, "farmerId");
  assert.equal(bookingQuery.op, "==");
  assert.equal(bookingQuery.value, "9876543210");

  // queue doc id convention {centreId}__{date}
  assert.ok(
    db._reads.some(
      (r) => r.name === "centreQueues" && r.id === "centre_gurugram_01__2026-10-20"
    ),
    "queue must be read from centreQueues/<centreId>__<date>"
  );

  // no writes anywhere
  assert.equal(db._writes.length, 0);
});

// ---------------------------------------------------------------
// (b) Verifier: redaction, read-only, scope enforcement
// ---------------------------------------------------------------

function fakeStore(overrides = {}) {
  return {
    fetchCentreById: async (id) =>
      id === "centre_gurugram_01" ? { id, ...CENTRE_DOC } : null,
    activeBookingsFor: async (phone) =>
      phone === "9876543210" ? [{ ...BOOKING_DOC }] : [],
    queueFor: async () => ({ ...QUEUE_DOC }),
    fetchAvailableSlots: async () => [{ slotTime: "10:00", availableCapacity: 4 }],
    // deliberately no fetchCentres/write methods: any call would TypeError
    ...overrides,
  };
}

test("runChecks reads all four paths, returns ok, and never leaks secrets", async () => {
  const logs = [];
  const res = await runChecks({
    store: fakeStore(),
    phone: "9876543210",
    centreId: "centre_gurugram_01",
    date: "2026-10-20",
    log: (m) => logs.push(m),
  });

  assert.equal(res.ok, true);
  const names = res.steps.map((s) => s.step);
  assert.ok(names.includes("centre"));
  assert.ok(names.includes("bookings"));
  assert.ok(names.includes("queue"));
  assert.ok(names.includes("slots"));

  const all = JSON.stringify(res.steps) + logs.join(" ");
  assert.ok(!all.includes("SECRET1"), "gate pass code must never appear");
  assert.ok(!all.includes("gatePass"), "gate pass keys must never appear");
  assert.ok(!all.includes("SECRET-ADMIN"), "admin code value must never appear");
  assert.ok(!all.includes("adminCode"), "admin code key must never appear");
  assert.ok(!all.includes("9876543210"), "full phone should be masked");
});

test("runChecks detects a farmer-scope violation", async () => {
  await assert.rejects(
    () =>
      runChecks({
        store: fakeStore({
          activeBookingsFor: async () => [
            { ...BOOKING_DOC, farmerId: "1111111111" },
          ],
        }),
        phone: "9876543210",
      }),
    /scope violation/
  );
});

test("assertNoSecrets rejects embedded forbidden keys", () => {
  assert.throws(() => assertNoSecrets("x", { gatePassCode: "s" }), /gatePassCode/);
  assert.throws(() => assertNoSecrets("x", { nested: { adminCode: "s" } }), /adminCode/);
  assert.equal(assertNoSecrets("x", { tokenNumber: "A-07" }), true);
});

test("maskPhone hides the middle digits", () => {
  assert.equal(maskPhone("9876543210"), "98******10");
  assert.equal(maskPhone(""), "******");
});
