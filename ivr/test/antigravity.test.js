/**
 * ivr/test/antigravity.test.js
 * ---------------------------------------------------------------
 * Mocked tests for the optional Antigravity provider. No network is
 * used: the GoogleGenAI client is replaced with a scripted fake.
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAntigravityAgent, toAntigravityTools, textFromSteps } = require("../antigravity");
const { createChatbot } = require("../chatbot");
const { TOOL_NAMES } = require("../agent");

function fakeClient(turns) {
  const requests = [];
  return {
    requests,
    interactions: {
      async create(request) {
        requests.push(request);
        const turn = turns[Math.min(requests.length - 1, turns.length - 1)];
        return typeof turn === "function" ? turn(request, requests.length) : turn;
      },
    },
  };
}

function completed(text, id = "int_1") {
  return {
    id,
    status: "completed",
    output_text: text,
    steps: [{ type: "model_output", content: [{ type: "text", text }] }],
  };
}

function requiresCall(name, args, id = "int_1", callId = "call_1") {
  return {
    id,
    status: "requires_action",
    steps: [{ type: "function_call", id: callId, name, arguments: args }],
  };
}

function fakeDb() {
  const saved = [];
  return {
    saved,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { exists: false, data: () => ({}) };
            },
            async set(data, options) {
              saved.push({ name, id, data, options });
            },
          };
        },
      };
    },
  };
}

const store = {
  async activeBookingsFor() {
    return [
      {
        tokenNumber: "A-07",
        centreId: "centre_1",
        date: "2026-10-21",
        status: "booked",
        approxQuantityQuintals: 10,
      },
    ];
  },
};

test("only custom function tools are exposed, with explicit remote environment", async () => {
  const client = fakeClient([completed("Hello")]);
  const agent = createAntigravityAgent({ client, store });
  const result = await agent.chat({
    message: "hi",
    language: "hi",
    systemInstruction: "BASE RULES",
  });

  assert.equal(result.reply, "Hello");
  const req = client.requests[0];
  assert.equal(req.agent, "antigravity-preview-09-2026");
  assert.equal(req.environment, "remote");
  assert.equal(req.agent_config.type, "antigravity");
  assert.equal(req.store, true);
  assert.match(req.system_instruction, /BASE RULES/);
  assert.match(req.system_instruction, /RESPONSE LANGUAGE: Hindi/);
  assert.ok(req.tools.length > 0);
  for (const tool of req.tools) {
    assert.equal(tool.type, "function");
    assert.ok(tool.parameters && tool.parameters.type === "object");
  }
  const names = req.tools.map((t) => t.name);
  assert.ok(names.includes(TOOL_NAMES.GET_FARMER_BOOKINGS));
  assert.ok(!names.includes("code_execution"));
  assert.ok(!names.includes("google_search"));
  assert.ok(!names.includes("url_context"));
});

test("function calls run the shared trusted toolkit and continue the interaction", async () => {
  const client = fakeClient([
    requiresCall(TOOL_NAMES.GET_FARMER_BOOKINGS, {}),
    (req) => {
      const result = req.input[0];
      assert.equal(result.type, "function_result");
      assert.equal(result.call_id, "call_1");
      assert.equal(result.name, TOOL_NAMES.GET_FARMER_BOOKINGS);
      assert.match(result.result[0].text, /A-07/);
      return completed("You have one booking.", "int_2");
    },
  ]);
  const db = fakeDb();
  const agent = createAntigravityAgent({ client, store, db });
  const result = await agent.chat({
    message: "my bookings",
    farmerId: "9876543210",
    sessionId: "sess-1",
  });

  assert.equal(result.reply, "You have one booking.");
  assert.equal(result.toolRounds, 1);
  assert.deepEqual(result.toolsUsed, [TOOL_NAMES.GET_FARMER_BOOKINGS]);
  assert.equal(client.requests.length, 2);
  assert.equal(client.requests[1].previous_interaction_id, "int_1");

  assert.equal(db.saved.length, 1);
  assert.equal(db.saved[0].name, "chatInteractionSessions");
  assert.deepEqual(Object.keys(db.saved[0].data).sort(), ["interactionId", "updatedAt"]);
  assert.equal(db.saved[0].data.interactionId, "int_2");
});

test("a failure after a tool ran is marked so the caller must not fall back", async () => {
  const client = fakeClient([
    requiresCall(TOOL_NAMES.GET_FARMER_BOOKINGS, {}),
    () => {
      throw Object.assign(new Error("upstream failed"), { status: 500 });
    },
  ]);
  const agent = createAntigravityAgent({ client, store });
  await assert.rejects(
    agent.chat({ message: "my bookings", farmerId: "9876543210", sessionId: "s1" }),
    (err) => {
      assert.equal(err.code, "ANTIGRAVITY_FAILED");
      assert.equal(err.toolExecuted, true);
      return true;
    }
  );
});

test("fallback to Gemini happens only before any tool runs", async () => {
  const previous = process.env.CHATBOT_ANTIGRAVITY_FALLBACK;
  process.env.CHATBOT_ANTIGRAVITY_FALLBACK = "gemini";
  try {
    let geminiCalls = 0;
    const model = {
      async generateContent() {
        geminiCalls += 1;
        return {
          response: {
            candidates: [{ content: { role: "model", parts: [{ text: "gemini answer" }] } }],
            text: () => "gemini answer",
          },
        };
      },
    };
    const client = fakeClient([() => {
      throw Object.assign(new Error("unavailable"), { status: 503 });
    }]);
    const bot = createChatbot({ model, provider: "antigravity", antigravityClient: client });
    const out = await bot.chat({ message: "hello" });
    assert.equal(out.reply, "gemini answer");
    assert.equal(geminiCalls, 1);
  } finally {
    if (previous === undefined) delete process.env.CHATBOT_ANTIGRAVITY_FALLBACK;
    else process.env.CHATBOT_ANTIGRAVITY_FALLBACK = previous;
  }
});

test("no fallback after a booking/read tool has executed", async () => {
  const previous = process.env.CHATBOT_ANTIGRAVITY_FALLBACK;
  process.env.CHATBOT_ANTIGRAVITY_FALLBACK = "gemini";
  try {
    let geminiCalls = 0;
    const model = {
      async generateContent() {
        geminiCalls += 1;
        return {
          response: {
            candidates: [{ content: { role: "model", parts: [{ text: "should not run" }] } }],
            text: () => "should not run",
          },
        };
      },
    };
    const client = fakeClient([
      requiresCall(TOOL_NAMES.GET_FARMER_BOOKINGS, {}),
      () => {
        throw Object.assign(new Error("unavailable"), { status: 503 });
      },
    ]);
    const bot = createChatbot({
      model,
      store,
      provider: "antigravity",
      antigravityClient: client,
    });
    await assert.rejects(bot.chat({ message: "my bookings" }));
    assert.equal(geminiCalls, 0);
  } finally {
    if (previous === undefined) delete process.env.CHATBOT_ANTIGRAVITY_FALLBACK;
    else process.env.CHATBOT_ANTIGRAVITY_FALLBACK = previous;
  }
});

test("repeated calls short-circuit after a pre-tool failure", async () => {
  const client = fakeClient([
    () => {
      throw Object.assign(new Error("denied"), { status: 403 });
    },
  ]);
  const agent = createAntigravityAgent({ client, store });
  await assert.rejects(agent.chat({ message: "one" }), /ANTIGRAVITY|Antigravity/);
  await assert.rejects(agent.chat({ message: "two" }), /temporarily unavailable/);
  assert.equal(client.requests.length, 1);
});

test("schema conversion lowercases types and text extraction ignores non-text steps", () => {
  const tools = toAntigravityTools([
    {
      name: "x",
      description: "d",
      parameters: {
        type: "OBJECT",
        properties: { n: { type: "NUMBER" }, nested: { type: "OBJECT", properties: { s: { type: "STRING" } } } },
        required: ["n"],
      },
    },
  ]);
  assert.equal(tools[0].parameters.type, "object");
  assert.equal(tools[0].parameters.properties.n.type, "number");
  assert.equal(tools[0].parameters.properties.nested.properties.s.type, "string");
  assert.equal(tools[0].parameters.required[0], "n");

  assert.equal(
    textFromSteps([
      { type: "function_call", name: "x" },
      { type: "model_output", content: [{ type: "text", text: "answer" }] },
    ]),
    "answer"
  );
});
