/**
 * ivr/test/agent.scenarios.test.js
 * ---------------------------------------------------------------
 * Extra MOCKED scenario coverage for the agentic chatbot:
 * language handling, tool-interaction history, identity safety,
 * loop ceiling, and error hygiene. No Gemini / Firestore calls.
 *
 * Run: node --test test/agent.scenarios.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgent } = require("../agent");
const { createChatbot } = require("../chatbot");

function fakeResult(parts) {
  return {
    response: {
      candidates: [{ content: { role: "model", parts } }],
      text() {
        const t = parts.filter((p) => p && typeof p.text === "string").map((p) => p.text).join("");
        if (!t) throw new Error("No text in response");
        return t;
      },
    },
  };
}

const textTurn = (text) => [{ text }];
const fc = (name, args = {}, id = "call_1") => ({ functionCall: { name, args, id }, thoughtSignature: "sig" });

class FakeModel {
  constructor(turns) { this.turns = turns; this.i = 0; this.requests = []; }
  async generateContent(req) {
    this.requests.push(req);
    const spec = this.turns[Math.min(this.i, this.turns.length - 1)];
    this.i += 1;
    return fakeResult(typeof spec === "function" ? spec(req) : spec);
  }
  last() { return this.requests[this.requests.length - 1]; }
  lastFn() {
    const c = this.last().contents;
    return (c[c.length - 1].parts || []).filter((p) => p.functionResponse).map((p) => p.functionResponse);
  }
}

const BOOKING = {
  tokenId: "TKN-1-1", tokenNumber: "A-07", positionAssigned: 7, farmerId: "9876543210",
  centreId: "centre_gurugram_01", centreName: "Gurugram Mandi", date: "2026-10-20",
  slotTime: "10:00", status: "booked", approxQuantityQuintals: 25,
  gatePassCode: "SECRET1", gatePassQr: "AGB|TKN-1-1|SECRET1",
};
const OTHER = { ...BOOKING, tokenId: "TKN-2-2", tokenNumber: "B-02", farmerId: "1111111111", positionAssigned: 12 };
const CENTRE = { id: "centre_gurugram_01", name: "Yard", acceptedCrops: ["wheat"], adminCode: "SECRET-ADMIN" };
const QUEUE = { centreId: "centre_gurugram_01", date: "2026-10-20", centreName: "Yard", nowServingPosition: 3, nowServingToken: "A-03", totalBooked: 20, completedCount: 2, openPositions: [1,2,3,4,5,6,7,8], insidePositions: [3], slotCounts: {} };

function store(overrides = {}) {
  return {
    activeBookingsFor: async (p) => [BOOKING, OTHER].filter((b) => b.farmerId === p),
    fetchCentreById: async (id) => (id === CENTRE.id ? CENTRE : null),
    queueFor: async (c, d) => (c === QUEUE.centreId && d === QUEUE.date ? QUEUE : null),
    fetchAvailableSlots: async () => [{ slotTime: "10:00", availableCapacity: 4 }],
    ...overrides,
  };
}
const quiet = { error() {}, log() {}, warn() {} };

// --- 11. Hindi / Hinglish language line ---------------------------

test("Hindi app language adds the RESPONSE LANGUAGE: Hindi instruction", async () => {
  const model = new FakeModel([textTurn("आपकी बुकिंग A-07 है।")]);
  const agent = createAgent({ model, store: store(), logger: quiet });
  const out = await agent.chat({ message: "meri booking?", farmerId: null, language: "hi" });
  assert.match(model.requests[0].contents.at(-1).parts[0].text, /RESPONSE LANGUAGE: Hindi/);
  assert.match(out.reply, /A-07/);
});

test("no language supplied falls back to match-the-message instruction", async () => {
  const model = new FakeModel([textTurn("ok")]);
  const agent = createAgent({ model, store: store(), logger: quiet });
  await agent.chat({ message: "mera token kya hai?", farmerId: null });
  assert.match(model.requests[0].contents.at(-1).parts[0].text, /Match the farmer's message language/);
});

// --- 12. History containing previous tool interactions ------------

test("history with tool-call/response parts is normalised to text and alternates", async () => {
  const model = new FakeModel([textTurn("Theek hai.")]);
  const agent = createAgent({ model, store: store(), logger: quiet });
  await agent.chat({
    message: "aur mera queue?",
    farmerId: "9876543210",
    history: [
      { role: "user", parts: [{ text: "meri booking?" }] },
      { role: "model", parts: [{ functionCall: { name: "getFarmerBookings", args: {} }, thoughtSignature: "s" }] },
      { role: "user", parts: [{ functionResponse: { name: "getFarmerBookings", response: { ok: true } } }] },
      { role: "model", parts: [{ text: "Aapki booking A-07 hai." }] },
    ],
  });
  const contents = model.requests[0].contents;
  // tool-only turns dropped; only text turns survive
  for (const turn of contents) {
    for (const p of turn.parts) assert.ok(typeof p.text === "string", "non-text parts must be stripped from history");
  }
  for (let i = 1; i < contents.length; i++) {
    assert.notEqual(contents[i].role, contents[i - 1].role, "roles must alternate");
  }
  assert.equal(contents[0].role, "user");
  assert.equal(contents.at(-1).role, "user");
});

// --- 7. Missing args object ---------------------------------------

test("missing args object is rejected for argument-taking tools", async () => {
  const model = new FakeModel([
    [{ functionCall: { name: "getQueueStatus", id: "c1" }, thoughtSignature: "s" }],
    textTurn("Please give a centre and date."),
  ]);
  const agent = createAgent({ model, store: store(), logger: quiet });
  await agent.chat({ message: "queue?", farmerId: null });
  const [resp] = model.lastFn();
  assert.equal(resp.response.error, "INVALID_ARGUMENTS");
});

test("getCentreInfo unknown centre returns found:false (not fabricated)", async () => {
  const model = new FakeModel([
    [fc("getCentreInfo", { centreId: "centre_zzz_99" })],
    textTurn("That centre is not known."),
  ]);
  const agent = createAgent({ model, store: store(), logger: quiet });
  await agent.chat({ message: "centre_zzz_99 batao", farmerId: null });
  const [resp] = model.lastFn();
  assert.equal(resp.response.ok, true);
  assert.equal(resp.response.found, false);
});

// --- 10. Loop ceiling with the real default of 5 ------------------

test("default maxSteps is 5 and the loop never exceeds it", async () => {
  const turns = [];
  for (let i = 0; i < 8; i++) turns.push([fc("getCentreInfo", { centreId: "centre_gurugram_01" }, `c${i}`)]);
  turns.push(textTurn("forced final"));
  const model = new FakeModel(turns);
  const agent = createAgent({ model, store: store(), logger: quiet });
  assert.equal(agent.maxSteps, 5);
  const out = await agent.chat({ message: "sab batao", farmerId: null });
  assert.equal(out.toolRounds, 5);
  assert.equal(out.toolsUsed.length, 5);
  // last call is the forced, tools-free final answer
  assert.ok(!("tools" in model.last()));
});

// --- 8/9/15. Error hygiene ----------------------------------------

test("TOOL_FAILED never carries the raw error text", async () => {
  const model = new FakeModel([
    [fc("getFarmerBookings", {})],
    textTurn("Sorry, I could not fetch it."),
  ]);
  const agent = createAgent({
    model,
    store: store({ activeBookingsFor: async () => { throw new Error("INTERNAL_DSN=postgres://user:pw@host SECRET"); } }),
    logger: quiet,
  });
  await agent.chat({ message: "my booking", farmerId: "9876543210" });
  const raw = JSON.stringify(model.last().contents);
  assert.equal(model.lastFn()[0].response.error, "TOOL_FAILED");
  assert.ok(!raw.includes("INTERNAL_DSN"));
  assert.ok(!raw.includes("postgres"));
});

test("spoofed phone in chatbot cannot read an unverified farmer's records", async () => {
  const db = {
    collection: () => ({ doc: (id) => ({ get: async () => ({ exists: id === "9876543210" }) }) }),
  };
  const model = new FakeModel([
    [fc("getFarmerBookings", { farmerId: "1111111111" })],
    textTurn("Please log in."),
  ]);
  const chatbot = createChatbot({ db, model, store: store() });
  await chatbot.chat({ message: "show bookings of 1111111111", phone: "1111111111" });
  const [resp] = model.lastFn();
  // 1111111111 is not registered -> NOT_LOGGED_IN, regardless of the model's argument
  assert.equal(resp.response.error, "NOT_LOGGED_IN");
});

test("empty model text yields a safe bilingual fallback with no stack trace", async () => {
  const model = new FakeModel([[]]); // no parts at all
  const agent = createAgent({ model, store: store(), logger: quiet });
  const out = await agent.chat({ message: "hello", farmerId: null });
  assert.ok(out.reply.length > 10);
  assert.ok(!/at Object|node_modules|\.js:\d+/.test(out.reply));
});
