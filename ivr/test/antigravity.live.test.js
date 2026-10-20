/**
 * ivr/test/antigravity.live.test.js
 * ---------------------------------------------------------------
 * LIVE Antigravity integration test with a MOCKED read store - no
 * Firebase data is touched. It is deliberately opt-in because agent
 * runs cost tokens and take tens of seconds.
 *
 * Run explicitly:
 *   ANTIGRAVITY_LIVE=1 npm run test:live:antigravity
 *
 * Skips unless ANTIGRAVITY_LIVE=1 and GEMINI_API_KEY are set.
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const { createAntigravityAgent } = require("../antigravity");

const live = process.env.ANTIGRAVITY_LIVE === "1" && !!process.env.GEMINI_API_KEY;

test("live Antigravity tool call returns verified centre data", { skip: !live }, async () => {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let reads = 0;
  const store = {
    async fetchCentreById(id) {
      reads += 1;
      return {
        id,
        name: "Live Test Mandi",
        address: "12 Test Road, Gurugram",
        acceptedCrops: ["wheat"],
        operatingHours: "08:00-18:00",
      };
    },
  };
  const agent = createAntigravityAgent({
    client,
    store,
    maxTotalTokens: 20000,
    timeoutMs: 90000,
    maxSteps: 2,
  });
  const out = await agent.chat({
    message:
      "Call getCentreInfo for centre_gurugram_01 and tell me the mandi name and address. Do not guess.",
    systemInstruction: "Use the provided tools for centre facts. Never invent data.",
  });

  assert.deepEqual(out.toolsUsed, ["getCentreInfo"]);
  assert.equal(reads, 1);
  assert.match(out.reply, /Live Test Mandi/);
  assert.match(out.reply, /12 Test Road/);
});
