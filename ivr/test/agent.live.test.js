/**
 * ivr/test/agent.live.test.js
 * ---------------------------------------------------------------
 * LIVE Gemini integration test (real function calling against the
 * @google/generative-ai SDK) with a MOCKED Firestore store - no
 * Firebase credentials needed, no live Firebase data is touched.
 *
 * Skips itself when GEMINI_API_KEY is not set. Run explicitly:
 *   npm run test:live   (from ivr/)
 *   node --test test/agent.live.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createAgent } = require("../agent");
const { createChatbot } = require("../chatbot");

const apiKey = process.env.GEMINI_API_KEY;
const live = !!apiKey;

function istDate(offsetDays = 0) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  now.setDate(now.getDate() + offsetDays);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const TODAY = istDate(0);
const BOOKING_DATE = istDate(2); // a valid future date for the fixture

const PHONE = "9876543210";
const CENTRE_ID = "centre_gurugram_01";

function fixture() {
  const booking = {
    tokenId: "TKN-1-1",
    tokenNumber: "A-07",
    positionAssigned: 7,
    farmerId: PHONE,
    centreId: CENTRE_ID,
    centreName: "Gurugram Procurement Yard",
    centreAddress: "Sector 12, Gurugram",
    date: BOOKING_DATE,
    slotTime: "10:00",
    slotWindow: "10:00 AM - 11:00 AM",
    crop: "wheat",
    cropName: "Wheat",
    approxQuantityQuintals: 25,
    status: "booked",
    estimatedTurnTime: "10:30 AM",
    gatePassCode: "SECRET1",
  };
  return {
    booking,
    centre: {
      id: CENTRE_ID,
      name: "Gurugram Procurement Yard",
      name_en: "Gurugram Procurement Yard",
      address: "Sector 12, Gurugram",
      acceptedCrops: ["wheat", "mustard"],
      operatingStartTime: "08:00",
      operatingEndTime: "18:00",
      parallelLanes: 2,
      avgMinutesPerEntry: 15,
      adminCode: "SECRET-ADMIN",
    },
    queue: {
      centreId: CENTRE_ID,
      date: BOOKING_DATE,
      centreName: "Gurugram Procurement Yard",
      nowServingPosition: 3,
      nowServingToken: "A-03",
      nowServingStatus: "assay",
      totalBooked: 20,
      completedCount: 2,
      openPositions: [1, 2, 3, 4, 5, 6, 7, 8],
      insidePositions: [3],
      slotCounts: {},
    },
  };
}

function makeStore() {
  const f = fixture();
  return {
    activeBookingsFor: async (phone) => (phone === f.booking.farmerId ? [f.booking] : []),
    fetchCentreById: async (id) => (id === f.centre.id ? f.centre : null),
    queueFor: async (centreId, date) =>
      centreId === f.queue.centreId && date === f.queue.date ? f.queue : null,
    fetchAvailableSlots: async () => [
      { slotTime: "10:00", windowLabel: "10:00 AM - 11:00 AM", availableCapacity: 4, isFull: false },
      { slotTime: "14:00", windowLabel: "2:00 PM - 3:00 PM", availableCapacity: 2, isFull: false },
    ],
  };
}

function fakeDb() {
  return {
    collection: (name) => {
      assert.equal(name, "users");
      return {
        doc: (id) => ({
          get: async () => ({ exists: id === PHONE }),
        }),
      };
    },
  };
}

function buildAgent(maxSteps) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    systemInstruction: `
You are AgroBridge Assistant. You have READ-ONLY live tools (getFarmerBookings,
getQueueStatus, getAvailableSlots, getCentreInfo, getPaymentStatus).
Use tools for live data; never invent data; refuse write actions honestly.
Answer in the requested RESPONSE LANGUAGE.
`,
  });
  return createAgent({ model, store: makeStore(), maxSteps, logger: console });
}

function buildChatbot() {
  return createChatbot({ db: fakeDb(), store: makeStore() });
}

test("LIVE: general question needs no tools", { skip: !live, timeout: 60000 }, async () => {
  const agent = buildAgent(3);
  const out = await agent.chat({
    message: "How does quality check (assay) work at the mandi? Answer in English.",
    farmerId: null,
    language: "en",
  });
  assert.ok(out.reply.length > 40);
  assert.equal(out.toolRounds, 0);
});

test("LIVE: booking question triggers getFarmerBookings with real data", { skip: !live, timeout: 60000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: "What is my current booking status? Answer in English.",
    phone: PHONE,
    language: "en",
  });
  assert.ok(out.toolsUsed.includes("getFarmerBookings"), `toolsUsed=${JSON.stringify(out.toolsUsed)}`);
  assert.match(out.reply, /A-07/);
  assert.ok(!out.reply.includes("SECRET1"));
});

test("LIVE: queue request chains booking -> queue tools", { skip: !live, timeout: 90000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: `How many farmers are ahead of me in the queue at my mandi on ${BOOKING_DATE} for my booking? Answer in English.`,
    phone: PHONE,
    language: "en",
  });
  assert.ok(out.toolsUsed.includes("getQueueStatus"), `toolsUsed=${JSON.stringify(out.toolsUsed)}`);
  assert.ok(out.toolRounds >= 1, `toolRounds=${out.toolRounds}`);
  assert.ok(out.reply.length > 20);
  assert.ok(!out.reply.includes("SECRET1"));
});

test("LIVE: slots question triggers getAvailableSlots", { skip: !live, timeout: 90000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: `Which time slots are still open at ${CENTRE_ID} on ${istDate(1)}? Answer in English.`,
    language: "en",
  });
  assert.ok(out.toolsUsed.includes("getAvailableSlots"), `toolsUsed=${JSON.stringify(out.toolsUsed)}`);
  assert.match(out.reply, /10:00|2:00|PM|AM/i);
});

test("LIVE: not-logged-in gets honest login guidance, no invented data", { skip: !live, timeout: 60000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: "mera token number kya hai?",
    language: "hi",
  });
  assert.ok(out.reply.length > 20);
  // must not invent a token number
  assert.doesNotMatch(out.reply, /A-0\d/);
});

test("LIVE: Hindi language setting yields a Hindi reply", { skip: !live, timeout: 60000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: "Mera booking status kya hai?",
    phone: PHONE,
    language: "hi",
  });
  assert.match(out.reply, /[\u0900-\u097F]/);
});

test("LIVE: invalid centre id is reported, not fabricated", { skip: !live, timeout: 60000 }, async () => {
  const chatbot = buildChatbot();
  const out = await chatbot.chat({
    message: "centre_zzz_99 mandi ki queue status batao",
    phone: PHONE,
    language: "hi",
  });
  assert.ok(out.reply.length > 10);
  assert.doesNotMatch(out.reply, /A-07/);
});

// TODAY is referenced to keep the fixture dates anchored to real time.
void TODAY;
