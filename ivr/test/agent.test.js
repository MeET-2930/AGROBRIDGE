/**
 * ivr/test/agent.test.js
 * ---------------------------------------------------------------
 * MOCKED tests for the agentic chatbot (no Gemini API calls, no
 * live Firestore). A scripted FakeModel simulates Gemini function
 * calling via generateContent({contents}); a FakeStore simulates
 * the ivr-core Firestore store.
 *
 * Run:  npm test   (from ivr/)   or   node --test test/agent.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgent, validateCentreId, validateDate, validateToken } = require("../agent");
const { createChatbot } = require("../chatbot");

// ---------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------

function fakeResult(parts) {
  return {
    response: {
      candidates: [{ content: { role: "model", parts } }],
      functionCalls() {
        return parts.filter((p) => p && p.functionCall).map((p) => p.functionCall);
      },
      text() {
        const t = parts
          .filter((p) => p && typeof p.text === "string")
          .map((p) => p.text)
          .join("");
        if (!t) throw new Error("No text in response");
        return t;
      },
    },
  };
}

function textTurn(text) {
  return [{ text }];
}

function fcPart(name, args = {}, id = "call_1") {
  return { functionCall: { name, args, id }, thoughtSignature: "fake-sig" };
}

function toolTurn(calls) {
  // calls: [[name, args], ...]
  return calls.map(([name, args], i) => fcPart(name, args, `call_${i + 1}`));
}

/**
 * Scripted model: each turn is an array of parts (or a function of
 * the request returning parts). Records every generateContent request.
 */
class FakeModel {
  constructor(turns) {
    this.turns = turns;
    this.i = 0;
    this.requests = [];
  }

  async generateContent(req) {
    this.requests.push(req);
    const spec = this.turns[Math.min(this.i, this.turns.length - 1)];
    this.i += 1;
    const parts = typeof spec === "function" ? spec(req) : spec;
    return fakeResult(parts);
  }

  /** Last contents array sent to the model. */
  lastContents() {
    return this.requests[this.requests.length - 1].contents;
  }

  /** functionResponse objects of the most recent function-result turn. */
  lastFunctionResponses() {
    const contents = this.lastContents();
    const turn = contents[contents.length - 1];
    return (turn.parts || []).filter((p) => p.functionResponse).map((p) => p.functionResponse);
  }
}

const BOOKING = {
  tokenId: "TKN-1-1",
  tokenNumber: "A-07",
  positionAssigned: 7,
  farmerId: "9876543210",
  farmerName: "Ramesh",
  centreId: "centre_gurugram_01",
  centreName: "Gurugram Mandi",
  centreAddress: "Sector 12, Gurugram",
  date: "2026-10-20",
  slotTime: "10:00",
  slotWindow: "10:00 AM - 11:00 AM",
  crop: "wheat",
  cropName: "Wheat",
  approxQuantityQuintals: 25,
  status: "booked",
  estimatedTurnTime: "10:30 AM",
  gatePassCode: "SECRET1",
  gatePassQr: "AGB|TKN-1-1|SECRET1",
  netPayable: null,
};

const OTHER_BOOKING = {
  ...BOOKING,
  tokenId: "TKN-2-2",
  tokenNumber: "B-02",
  positionAssigned: 12,
  farmerId: "1111111111",
  date: "2026-10-21",
};

const CENTRE = {
  id: "centre_gurugram_01",
  name: "Gurugram Procurement Yard",
  name_en: "Gurugram Procurement Yard",
  address: "Sector 12, Gurugram",
  acceptedCrops: ["wheat", "mustard"],
  operatingStartTime: "08:00",
  operatingEndTime: "18:00",
  parallelLanes: 2,
  avgMinutesPerEntry: 15,
  adminCode: "SECRET-ADMIN",
};

const QUEUE = {
  centreId: "centre_gurugram_01",
  date: "2026-10-20",
  centreName: "Gurugram Procurement Yard",
  nowServingPosition: 3,
  nowServingToken: "A-03",
  nowServingStatus: "assay",
  totalBooked: 20,
  completedCount: 2,
  openPositions: [1, 2, 3, 4, 5, 6, 7, 8],
  insidePositions: [3],
  slotCounts: {},
};

function makeStore(overrides = {}) {
  return {
    activeBookingsFor: async (phone) =>
      [BOOKING, OTHER_BOOKING].filter((b) => b.farmerId === phone),
    fetchCentreById: async (id) => (id === CENTRE.id ? CENTRE : null),
    queueFor: async (centreId, date) =>
      centreId === QUEUE.centreId && date === QUEUE.date ? QUEUE : null,
    fetchAvailableSlots: async () => [
      { slotTime: "10:00", windowLabel: "10:00 AM - 11:00 AM", availableCapacity: 4, isFull: false },
    ],
    ...overrides,
  };
}

const quiet = { error() {}, log() {}, warn() {} };

// ---------------------------------------------------------------
// Validators
// ---------------------------------------------------------------

test("validators reject malformed centreId / date / token", () => {
  assert.equal(validateCentreId("centre_gurugram_01").ok, true);
  assert.equal(validateCentreId("").ok, false);
  assert.equal(validateCentreId({ evil: 1 }).ok, false);
  assert.equal(validateCentreId("a/b").ok, false);

  assert.equal(validateDate("2026-10-20").ok, true);
  assert.equal(validateDate("tomorrow").ok, false);
  assert.equal(validateDate("2026-02-31").ok, false);
  assert.equal(validateDate("1999-01-01").ok, false);

  assert.equal(validateToken("A-07").ok, true);
  assert.equal(validateToken("").ok, false);
  assert.equal(validateToken("x".repeat(50)).ok, false);
});

// ---------------------------------------------------------------
// 1. General question - no tools
// ---------------------------------------------------------------

test("general farming question answers without any tool call", async () => {
  const model = new FakeModel([textTurn("You can book a slot from the Booking tab.")]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({ message: "How do I book a slot?", farmerId: "9876543210" });

  assert.match(out.reply, /book a slot/i);
  assert.equal(out.toolRounds, 0);
  assert.deepEqual(out.toolsUsed, []);
  assert.equal(model.requests.length, 1);
  // tools were declared for the request
  assert.ok(model.requests[0].tools[0].functionDeclarations.length >= 5);
  // the question went in as the last user turn
  const contents = model.requests[0].contents;
  assert.equal(contents[contents.length - 1].role, "user");
  assert.match(contents[contents.length - 1].parts[0].text, /How do I book a slot/);
});

test("with no store, tools are not offered to the model", async () => {
  const model = new FakeModel([textTurn("Live data is not connected right now.")]);
  const agent = createAgent({ model, store: null, logger: quiet });

  const out = await agent.chat({ message: "meri booking dikhao", farmerId: null });

  assert.equal(out.toolRounds, 0);
  assert.ok(!("tools" in model.requests[0]), "tools must be detached without a store");
  assert.match(model.requests[0].contents[0].parts[0].text, /LIVE DATA: not connected/);
});

// ---------------------------------------------------------------
// 2. Booking tool
// ---------------------------------------------------------------

test("booking request executes getFarmerBookings and returns verified data", async () => {
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    textTurn("Aapki booking A-07 hai, 20 October ko Gurugram Mandi mein."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({ message: "meri booking kya hai?", farmerId: "9876543210" });

  assert.equal(out.toolRounds, 1);
  assert.deepEqual(out.toolsUsed, ["getFarmerBookings"]);

  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.name, "getFarmerBookings");
  assert.equal(resp.id, "call_1", "function call id is echoed to the model");
  assert.equal(resp.response.ok, true);
  assert.equal(resp.response.count, 1);
  assert.equal(resp.response.bookings[0].booking.tokenNumber, "A-07");

  // the model's function-call parts are echoed with their thoughtSignature
  const modelTurn = model.lastContents()[model.lastContents().length - 2];
  assert.equal(modelTurn.role, "model");
  assert.equal(modelTurn.parts[0].thoughtSignature, "fake-sig");

  // secrets must never leak into tool results
  const raw = JSON.stringify(model.lastContents());
  assert.ok(!raw.includes("SECRET1"));
  assert.ok(!raw.includes("gatePass"));
  assert.match(out.reply, /A-07/);
});

test("spoofed farmerId argument cannot read another farmer's data", async () => {
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", { farmerId: "1111111111" }]]),
    textTurn("Here is your booking."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  await agent.chat({ message: "show my bookings", farmerId: "9876543210" });

  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.ok, true);
  assert.equal(resp.response.count, 1);
  assert.equal(resp.response.bookings[0].booking.tokenNumber, "A-07"); // NOT B-02
});

// ---------------------------------------------------------------
// 3. Queue tool + invalid arguments
// ---------------------------------------------------------------

test("queue status tool returns live queue for centre+date", async () => {
  const model = new FakeModel([
    toolTurn([["getQueueStatus", { centreId: "centre_gurugram_01", date: "2026-10-20" }]]),
    textTurn("Now serving A-03; 5 tokens are ahead of you."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({ message: "gate par queue status?", farmerId: "9876543210" });

  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.ok, true);
  assert.equal(resp.response.found, true);
  assert.equal(resp.response.queue.nowServingToken, "A-03");
  assert.equal(resp.response.queue.myPosition, 7);
  assert.equal(resp.response.queue.isInside, false);
  // open positions below 7 excluding the one already inside: 1,2,4,5,6
  assert.equal(resp.response.queue.tokensAhead, 5);
  assert.match(out.reply, /A-03/);
});

test("invalid tool arguments are rejected and reported to the model", async () => {
  const model = new FakeModel([
    toolTurn([["getQueueStatus", { centreId: "centre_gurugram_01", date: "tomorrow" }]]),
    toolTurn([["getAvailableSlots", { centreId: "bad/id", date: "2026-10-20" }]]),
    textTurn("Please tell me the date and centre."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({ message: "kitni slots bachi hain?", farmerId: null });

  assert.equal(out.toolRounds, 2);
  assert.equal(model.requests.length, 3);
  const firstResponses = model.requests[1].contents.at(-1).parts.filter((p) => p.functionResponse);
  assert.equal(firstResponses[0].functionResponse.response.error, "INVALID_ARGUMENTS");
  const secondResponses = model.requests[2].contents.at(-1).parts.filter((p) => p.functionResponse);
  assert.equal(secondResponses[0].functionResponse.response.error, "INVALID_ARGUMENTS");
});

test("unknown tool name is refused", async () => {
  const model = new FakeModel([
    toolTurn([["deleteAllBookings", {}]]),
    textTurn("I cannot do that."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  await agent.chat({ message: "cancel everything", farmerId: "9876543210" });

  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.error, "UNKNOWN_TOOL");
});

// ---------------------------------------------------------------
// 4. Multi-step chaining
// ---------------------------------------------------------------

test("multi-step: bookings first, then queue with data from step 1", async () => {
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    (req) => {
      // model inspects step-1 result and picks centre/date from it
      const turn = req.contents.at(-1);
      const resp = turn.parts.find((p) => p.functionResponse).functionResponse;
      const b = resp.response.bookings[0].booking;
      assert.equal(b.centreId, "centre_gurugram_01");
      return toolTurn([["getQueueStatus", { centreId: b.centreId, date: b.date }]]);
    },
    textTurn("Your token A-07 at Gurugram Mandi on 2026-10-20: now serving A-03, 5 tokens ahead."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({
    message: "meri booking aur us din kitni bari bachhi hai?",
    farmerId: "9876543210",
  });

  assert.equal(out.toolRounds, 2);
  assert.deepEqual(out.toolsUsed, ["getFarmerBookings", "getQueueStatus"]);
  assert.match(out.reply, /A-07/);
});

test("parallel tool calls in one round are all answered with their ids", async () => {
  const model = new FakeModel([
    toolTurn([
      ["getFarmerBookings", {}],
      ["getCentreInfo", { centreId: "centre_gurugram_01" }],
    ]),
    textTurn("Booking A-07 at Gurugram, which accepts wheat and mustard."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({
    message: "meri booking aur mandi ki jankari dono batao",
    farmerId: "9876543210",
  });

  assert.equal(out.toolRounds, 1);
  assert.equal(out.toolsUsed.length, 2);
  const responses = model.lastFunctionResponses();
  assert.equal(responses.length, 2);
  assert.equal(responses[0].id, "call_1");
  assert.equal(responses[1].id, "call_2");
  assert.equal(responses[0].response.ok, true);
  assert.equal(responses[1].response.centre.centreId, "centre_gurugram_01");
  // centre admin code must never be exposed
  assert.ok(!JSON.stringify(responses[1]).includes("SECRET-ADMIN"));
});

// ---------------------------------------------------------------
// 5. Missing / unauthenticated identity
// ---------------------------------------------------------------

test("not-logged-in farmer gets NOT_LOGGED_IN from personal tools", async () => {
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    toolTurn([["getPaymentStatus", {}]]),
    textTurn("Please log in to the AgroBridge app to see your booking."),
  ]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  const out = await agent.chat({ message: "mera payment status?", farmerId: null });

  const r1 = model.requests[1].contents.at(-1).parts.find((p) => p.functionResponse).functionResponse;
  const r2 = model.requests[2].contents.at(-1).parts.find((p) => p.functionResponse).functionResponse;
  assert.equal(r1.response.error, "NOT_LOGGED_IN");
  assert.equal(r2.response.error, "NOT_LOGGED_IN");
  assert.match(out.reply, /log in/i);
});

// ---------------------------------------------------------------
// 6. Firestore / service errors
// ---------------------------------------------------------------

test("Firestore failure inside a tool returns TOOL_FAILED, not invented data", async () => {
  const store = makeStore({
    activeBookingsFor: async () => {
      throw new Error("firestore down");
    },
  });
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    textTurn("I could not fetch your booking right now."),
  ]);
  const agent = createAgent({ model, store, logger: quiet });

  const out = await agent.chat({ message: "my booking", farmerId: "9876543210" });

  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.error, "TOOL_FAILED");
  assert.equal(out.toolRounds, 1);
});

test("Gemini API failure rejects so the server can return 500", async () => {
  const model = {
    async generateContent() {
      throw new Error("Gemini 503");
    },
  };
  const agent = createAgent({ model, store: makeStore(), logger: quiet });

  await assert.rejects(
    () => agent.chat({ message: "hello", farmerId: null }),
    /Gemini 503/
  );
});

// ---------------------------------------------------------------
// 7. Loop limit
// ---------------------------------------------------------------

test("tool-call loop stops at maxSteps and forces a tools-free final answer", async () => {
  const model = new FakeModel([
    toolTurn([["getCentreInfo", { centreId: "centre_gurugram_01" }]]),
    toolTurn([["getQueueStatus", { centreId: "centre_gurugram_01", date: "2026-10-20" }]]),
    toolTurn([["getFarmerBookings", {}]]), // would be round 3 - must never run
    textTurn("Final answer from the data gathered so far."),
  ]);
  const agent = createAgent({ model, store: makeStore(), maxSteps: 2, logger: quiet });

  const out = await agent.chat({ message: "sab kuch batao", farmerId: "9876543210" });

  assert.equal(out.toolRounds, 2);
  // 2 tool rounds + 1 limit-triggering response + 1 forced final answer
  assert.equal(model.requests.length, 4);
  assert.ok(model.requests[0].tools, "tool rounds have tools attached");
  assert.ok(model.requests[1].tools, "tool rounds have tools attached");
  assert.ok(!("tools" in model.requests[3]), "forced final answer must not have tools");
  assert.match(model.requests[3].contents.at(-1).parts[0].text, /tool-call limit/);
  assert.match(out.reply, /Final answer from the data/);
  assert.deepEqual(out.toolsUsed, ["getCentreInfo", "getQueueStatus"]);
});

// ---------------------------------------------------------------
// 8. createChatbot identity verification (mocked db)
// ---------------------------------------------------------------

function fakeDb(users = {}) {
  return {
    collection: (name) => {
      assert.equal(name, "users");
      return {
        doc: (id) => ({
          get: async () => ({ exists: Object.prototype.hasOwnProperty.call(users, id) }),
        }),
      };
    },
  };
}

test("createChatbot: registered phone is verified; unregistered is not", async () => {
  const db = fakeDb({ "9876543210": true });

  const modelA = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    textTurn("You have booking A-07."),
  ]);
  const chatbotA = createChatbot({ db, model: modelA, store: makeStore() });
  await chatbotA.chat({ message: "my booking", phone: "9876543210" });
  const rA = modelA.lastFunctionResponses()[0];
  assert.equal(rA.response.ok, true);
  assert.equal(rA.response.count, 1);

  const modelB = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    textTurn("Please log in to see your booking."),
  ]);
  const chatbotB = createChatbot({ db, model: modelB, store: makeStore() });
  await chatbotB.chat({ message: "my booking", phone: "1234567890" });
  const rB = modelB.lastFunctionResponses()[0];
  assert.equal(rB.response.error, "NOT_LOGGED_IN");
});

test("createChatbot: malformed phone never reaches personal tools", async () => {
  const db = fakeDb({ "9876543210": true });
  const model = new FakeModel([
    toolTurn([["getPaymentStatus", {}]]),
    textTurn("Please log in."),
  ]);
  const chatbot = createChatbot({ db, model, store: makeStore() });

  await chatbot.chat({ message: "payment", phone: "abc" });
  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.error, "NOT_LOGGED_IN");
});

test("createChatbot: Firestore identity read failure fails closed", async () => {
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => {
          throw new Error("permission denied");
        },
      }),
    }),
  };
  const model = new FakeModel([
    toolTurn([["getFarmerBookings", {}]]),
    textTurn("I cannot verify your account right now."),
  ]);
  const chatbot = createChatbot({ db, model, store: makeStore() });
  await chatbot.chat({ message: "my booking", phone: "9876543210" });
  const [resp] = model.lastFunctionResponses();
  assert.equal(resp.response.error, "NOT_LOGGED_IN");
});

test("empty message is rejected before any model call", async () => {
  const model = new FakeModel([textTurn("hi")]);
  const chatbot = createChatbot({ db: fakeDb(), model, store: makeStore() });
  await assert.rejects(() => chatbot.chat({ message: "   ", phone: "9876543210" }), /required/i);
  assert.equal(model.requests.length, 0);
});

test("messy chat history is normalised before the request", async () => {
  const model = new FakeModel([textTurn("namaste!")]);
  const agent = createAgent({ model, store: makeStore(), logger: quiet });
  await agent.chat({
    message: "namaste",
    farmerId: null,
    history: [
      { role: "model", parts: [{ text: "greeting (dropped)" }] },
      { role: "user", parts: [{ text: "q1" }] },
      { role: "user", parts: [{ text: "q1b consecutive" }] },
      { role: "model", parts: [{ text: "a1" }] },
      { role: "user", parts: [{ text: "dangling user" }] },
    ],
  });
  const contents = model.requests[0].contents;
  assert.equal(contents[0].role, "user");
  assert.match(contents[0].parts[0].text, /^q1/);
  for (let i = 1; i < contents.length; i++) {
    assert.notEqual(contents[i].role, contents[i - 1].role, "roles must alternate");
  }
  assert.equal(contents.at(-1).role, "user");
  assert.match(contents.at(-1).parts[0].text, /namaste/);
});
