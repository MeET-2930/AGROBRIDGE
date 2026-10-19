/**
 * ivr/test/agent.booking.test.js
 * ---------------------------------------------------------------
 * Mocked tests for the booking tool wiring in the agent loop.
 * Verifies declarations, identity/session context and that the
 * confirmation tool always receives the current farmer message.
 *
 * Run:  npm test   (from ivr/)   or   node --test test/agent.booking.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgent, TOOL_NAMES } = require("../agent");
const { createChatbot } = require("../chatbot");

function fakeResult(parts) {
  return {
    response: {
      candidates: [{ content: { role: "model", parts } }],
      text() {
        const text = parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("");
        if (!text) throw new Error("No text in response");
        return text;
      },
    },
  };
}

function fcPart(name, args = {}, id = "call_1") {
  return { functionCall: { name, args, id }, thoughtSignature: "fake-sig" };
}

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
    return fakeResult(typeof spec === "function" ? spec(req) : spec);
  }
}

function functionResponse(contents) {
  const turn = contents[contents.length - 1];
  return (turn.parts || []).filter((p) => p.functionResponse).map((p) => p.functionResponse);
}

test("booking declarations are offered only when a booking service exists", async () => {
  const model = new FakeModel([[{ text: "hello" }]]);
  const noBooking = createAgent({ model, store: null });
  assert.equal(noBooking.bookingAvailable, false);
  await noBooking.chat({ message: "hi" });
  assert.equal(model.requests[0].tools, undefined);

  const bookingService = {
    async listCentresForCrop() {
      return [];
    },
    async getSlots() {
      return { ok: true, availableSlots: [] };
    },
    async proposeBooking() {
      return { ok: true, requiresConfirmation: true };
    },
    async confirmBooking() {
      return { ok: false, error: "NO_PENDING_BOOKING" };
    },
  };
  const withBooking = createAgent({ model, store: null, bookingService });
  assert.equal(withBooking.bookingAvailable, true);
  await withBooking.chat({ message: "book wheat" });
  const names = model.requests[1].tools[0].functionDeclarations.map((d) => d.name);
  assert.deepEqual(names, [
    TOOL_NAMES.GET_CENTRES_FOR_CROP,
    TOOL_NAMES.GET_BOOKING_SLOTS,
    TOOL_NAMES.PROPOSE_BOOKING,
    TOOL_NAMES.CONFIRM_BOOKING,
  ]);
});

test("booking tools receive verified identity, session and current message", async () => {
  const calls = [];
  const bookingService = {
    async listCentresForCrop(crop) {
      calls.push(["centres", crop]);
      return [{ centreId: "centre_x", name: "X Mandi" }];
    },
    async getSlots(args) {
      calls.push(["slots", args]);
      return { ok: true, availableSlots: [{ slotTime: "10:00" }] };
    },
    async proposeBooking(args) {
      calls.push(["propose", args]);
      return {
        ok: true,
        requiresConfirmation: true,
        confirmationId: "cbi_1",
        summary: { crop: "wheat", quantityQuintals: 10, slotTime: "10:00" },
      };
    },
    async confirmBooking(args) {
      calls.push(["confirm", args]);
      return {
        ok: true,
        booking: { bookingId: "TKN-1", tokenNumber: "A-01" },
        message: "Booking committed successfully.",
      };
    },
  };

  const model = new FakeModel([
    [
      fcPart(TOOL_NAMES.GET_CENTRES_FOR_CROP, { crop: "wheat" }, "c1"),
      fcPart(
        TOOL_NAMES.GET_BOOKING_SLOTS,
        {
          centreId: "centre_x",
          crop: "wheat",
          quantityQuintals: 10,
          date: "2026-10-21",
        },
        "c2"
      ),
      fcPart(
        TOOL_NAMES.PROPOSE_BOOKING,
        {
          centreId: "centre_x",
          crop: "wheat",
          quantityQuintals: 10,
          date: "2026-10-21",
          slotTime: "10:00",
        },
        "c3"
      ),
      fcPart(TOOL_NAMES.CONFIRM_BOOKING, {}, "c4"),
    ],
    [{ text: "Your token is A-01." }],
  ]);

  const agent = createAgent({ model, store: null, bookingService });
  const result = await agent.chat({
    message: "yes, confirm the booking",
    farmerId: "9876543210",
    sessionId: "session-a",
    language: "hi",
  });

  assert.equal(result.reply, "Your token is A-01.");
  assert.equal(calls.length, 4);

  const [, slots] = calls[1];
  assert.equal(slots.farmerId, "9876543210");
  assert.equal(slots.language, "hi");

  const [, propose] = calls[2];
  assert.equal(propose.farmerId, "9876543210");
  assert.equal(propose.sessionId, "session-a");
  assert.ok(propose.turnId);

  const [, confirm] = calls[3];
  assert.equal(confirm.farmerId, "9876543210");
  assert.equal(confirm.sessionId, "session-a");
  assert.equal(confirm.message, "yes, confirm the booking");
  assert.equal(confirm.turnId, propose.turnId);

  const responses = functionResponse(model.requests[1].contents);
  assert.equal(responses.length, 4);
  assert.equal(responses[3].response.booking.tokenNumber, "A-01");
});

test("a model-supplied farmer id cannot override the verified identity", async () => {
  let seen = null;
  const bookingService = {
    async listCentresForCrop() {
      return [];
    },
    async getSlots(args) {
      seen = args;
      return { ok: true, availableSlots: [] };
    },
    async proposeBooking() {
      return { ok: false, error: "NOT_LOGGED_IN" };
    },
    async confirmBooking() {
      return { ok: false, error: "NOT_LOGGED_IN" };
    },
  };

  const model = new FakeModel([
    [
      fcPart(
        TOOL_NAMES.GET_BOOKING_SLOTS,
        {
          centreId: "centre_x",
          crop: "wheat",
          quantityQuintals: 10,
          date: "2026-10-21",
          farmerId: "1111111111",
        },
        "c1"
      ),
    ],
    [{ text: "Done" }],
  ]);

  const agent = createAgent({ model, store: null, bookingService });
  await agent.chat({
    message: "slots?",
    farmerId: "9876543210",
    sessionId: "s",
    language: "en",
  });

  assert.equal(seen.farmerId, "9876543210");
});


test("createChatbot loads the session pending booking and includes it in the prompt", async () => {
  const pendingCalls = [];
  const bookingService = {
    enabled: true,
    async getPending(args) {
      pendingCalls.push(args);
      return {
        confirmationId: "cbi_1",
        summary: { crop: "wheat", quantityQuintals: 10, slotTime: "10:00" },
        expiresAt: "2026-10-20T04:00:00.000Z",
      };
    },
  };
  const db = {
    collection() {
      return {
        doc(id) {
          return { get: async () => ({ exists: id === "9876543210" }) };
        },
      };
    },
  };
  const model = new FakeModel([[{ text: "Please confirm." }]]);

  const chatbot = createChatbot({
    db,
    model,
    store: { activeBookingsFor: async () => [] },
    bookingService,
  });

  await chatbot.chat({
    message: "what is pending?",
    phone: "9876543210",
    sessionId: "session-a",
    language: "en",
  });

  assert.deepEqual(pendingCalls, [{ farmerId: "9876543210", sessionId: "session-a" }]);
  const prompt = model.requests[0].contents[model.requests[0].contents.length - 1].parts[0].text;
  assert.match(prompt, /PENDING UNCONFIRMED BOOKING/);
  assert.match(prompt, /"quantityQuintals":10/);
});
