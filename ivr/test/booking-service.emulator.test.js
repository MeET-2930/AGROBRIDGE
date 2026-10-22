/*
 * A real Firestore-emulator smoke test for the booking write path.
 * Run with: npm run test:emulator
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { makeBookingService } = require("../booking-service");

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = "agrobridge-booking-emulator";
const FARMER = "9876543210";
const CENTRE_ID = "centre_test_01";
const DATE = "2026-10-21";
const SLOT = "10:00";
const NOW = Date.parse("2026-10-20T03:00:00Z");

const CENTRE = {
  name: "Test Procurement Yard",
  name_en: "Test Procurement Yard",
  address: "Sector 12, Test",
  active: true,
  acceptedCrops: ["wheat"],
  operatingStartTime: "08:00",
  operatingEndTime: "18:00",
  parallelLanes: 2,
  avgMinutesPerEntry: 15,
  closedDays: [0],
  throughputPerHour: { default: 400 },
};

test("emulator: proposal → explicit confirmation persists one token", { skip: !EMULATOR_HOST }, async () => {
  const app = initializeApp({ projectId: PROJECT_ID }, `booking-emulator-${Date.now()}`);
  const db = getFirestore(app);
  const service = makeBookingService({ db, nowMs: NOW, logger: { warn() {} } });

  try {
    await db.collection("users").doc(FARMER).set({ name: "Test Farmer", role: "farmer" });
    await db.collection("centres").doc(CENTRE_ID).set(CENTRE);

    const proposal = await service.proposeBooking({
      farmerId: FARMER,
      sessionId: "emulator-session",
      centreId: CENTRE_ID,
      crop: "wheat",
      quantityQuintals: 25,
      date: DATE,
      slotTime: SLOT,
      turnId: "turn-1",
    });
    assert.equal(proposal.ok, true);
    assert.equal(proposal.requiresConfirmation, true);

    const confirmation = await service.confirmBooking({
      farmerId: FARMER,
      sessionId: "emulator-session",
      message: "haan, confirm kar do",
      turnId: "turn-2",
    });
    assert.equal(confirmation.ok, true);
    assert.match(confirmation.booking.tokenNumber, /^[A-Z]-\d{2}$/);

    const booking = await db.collection("bookings").doc(confirmation.booking.bookingId).get();
    assert.equal(booking.exists, true);
    assert.equal(booking.data().farmerId, FARMER);
    assert.equal(booking.data().status, "booked");
    assert.equal(booking.data().tokenId, confirmation.booking.bookingId);
  } finally {
    await db.recursiveDelete(db.collection("bookings"));
    await db.recursiveDelete(db.collection("centres"));
    await db.recursiveDelete(db.collection("users"));
    await db.recursiveDelete(db.collection("centreQueues"));
    await db.recursiveDelete(db.collection("chatBookingIntents"));
    await db.recursiveDelete(db.collection("chatBookingSessions"));
    await deleteApp(app);
  }
});
