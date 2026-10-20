/**
 * ivr/antigravity.js
 * ---------------------------------------------------------------
 * Optional Antigravity agent provider for the AgroBridge Assistant.
 *
 * Latency/cost note: an Antigravity interaction runs an agent loop
 * server-side. We use it only when CHATBOT_PROVIDER=antigravity, give
 * it the same trusted tool toolkit as the Gemini provider, and keep a
 * conservative token budget, a per-request timeout, a max tool-round
 * cap and a short circuit breaker.
 *
 * SECURITY MODEL
 * - Only custom function tools are exposed. Code execution, Google
 *   Search, URL context, browser and MCP tools are never enabled.
 * - The remote environment is declared explicitly because the API
 *   requires one, but no sources/files are mounted into it.
 * - Tool identity/session values come from the verified HTTP request,
 *   never from model arguments.
 * - Interaction ids are stored per farmer+session; nothing else is
 *   persisted.
 * ---------------------------------------------------------------
 */

const { createToolkit, buildChatInstructions } = require("./agent");

const DEFAULT_AGENT = "antigravity-preview-09-2026";
const DEFAULT_MAX_TOTAL_TOKENS = 50000;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_STEPS = 5;
const MAX_TOTAL_TOKENS = 200000;
const MAX_TIMEOUT_MS = 120000;
const CIRCUIT_COOLDOWN_MS = 30000;

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
}

function antigravityError(message, { cause = null, toolExecuted = false } = {}) {
  const err = new Error(message);
  err.code = "ANTIGRAVITY_FAILED";
  err.toolExecuted = Boolean(toolExecuted);
  if (cause) err.cause = cause;
  return err;
}

function envError(err) {
  const status =
    (err && (err.status || err.statusCode)) ||
    (err && err.response && err.response.status) ||
    null;
  if (status) return ` ("${status}")`;
  return "";
}

function toJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const out = { ...schema };
  if (typeof out.type === "string") out.type = out.type.toLowerCase();
  if (out.type === "object" && !out.properties) out.properties = {};
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toJsonSchema(v)])
    );
  }
  if (out.items) out.items = toJsonSchema(out.items);
  return out;
}

function toAntigravityTools(declarations) {
  return (Array.isArray(declarations) ? declarations : [])
    .filter((d) => d && d.name)
    .map((d) => ({
      type: "function",
      name: d.name,
      description: d.description || "",
      parameters: toJsonSchema(d.parameters || { type: "object", properties: {} }),
    }));
}

function textFromSteps(steps) {
  const parts = [];
  for (const step of Array.isArray(steps) ? steps : []) {
    if (!step) continue;
    if (step.type === "model_output" && Array.isArray(step.content)) {
      for (const c of step.content) {
        if (c && c.type === "text" && typeof c.text === "string") parts.push(c.text);
      }
    }
    if (typeof step.text === "string" && step.type === "text") parts.push(step.text);
  }
  return parts.join("").trim();
}

function historyTranscript(history, limit = 10) {
  const rows = [];
  for (const turn of Array.isArray(history) ? history : []) {
    if (!turn || (turn.role !== "user" && turn.role !== "model")) continue;
    const text = (Array.isArray(turn.parts) ? turn.parts : [])
      .map((p) => (p && typeof p.text === "string" ? p.text : ""))
      .join(" ")
      .trim();
    if (!text) continue;
    rows.push(`${turn.role === "user" ? "Farmer" : "Assistant"}: ${text}`);
  }
  return rows.slice(-limit).join("\n");
}

function makeInteractionRegistry({ db = null, logger = console } = {}) {
  const memory = new Map();
  const collection =
    db && typeof db.collection === "function" ? db.collection("chatInteractionSessions") : null;

  function keyOf(farmerId, sessionId) {
    if (!farmerId || !sessionId) return null;
    return encodeURIComponent(`${farmerId}__${sessionId}`).slice(0, 400);
  }

  async function get(farmerId, sessionId) {
    const key = keyOf(farmerId, sessionId);
    if (!key) return null;
    if (memory.has(key)) return memory.get(key);
    if (!collection) return null;
    try {
      const snap = await collection.doc(key).get();
      if (!snap || !snap.exists) return null;
      const data = snap.data() || {};
      const id = typeof data.interactionId === "string" ? data.interactionId : null;
      if (id) memory.set(key, id);
      return id;
    } catch (e) {
      logger.error("antigravity interaction lookup failed:", (e && e.message) || e);
      return null;
    }
  }

  async function set(farmerId, sessionId, interactionId) {
    const key = keyOf(farmerId, sessionId);
    if (!key || !interactionId) return;
    memory.set(key, interactionId);
    if (!collection) return;
    try {
      await collection.doc(key).set(
        { interactionId, updatedAt: new Date() },
        { merge: true }
      );
    } catch (e) {
      logger.error("antigravity interaction save failed:", (e && e.message) || e);
    }
  }

  return { get, set };
}

/**
 * @param {object} opts
 * @param {object} opts.client  @google/genai GoogleGenAI instance (injectable for tests)
 * @param {object} opts.store   Firestore-backed read store
 * @param {object} [opts.bookingService]
 * @param {object} [opts.db]    firebase-admin Firestore for interaction-id persistence
 */
function createAntigravityAgent({
  client,
  store,
  bookingService = null,
  db = null,
  agent = process.env.ANTIGRAVITY_AGENT || DEFAULT_AGENT,
  maxTotalTokens = process.env.ANTIGRAVITY_MAX_TOTAL_TOKENS,
  timeoutMs = process.env.ANTIGRAVITY_TIMEOUT_MS,
  maxSteps = process.env.ANTIGRAVITY_MAX_STEPS,
  model = process.env.ANTIGRAVITY_MODEL || null,
  logger = console,
} = {}) {
  if (!client || !client.interactions || typeof client.interactions.create !== "function") {
    throw new Error("createAntigravityAgent: client is required");
  }

  const toolkit = createToolkit({ store, bookingService, logger });
  const tools = toAntigravityTools(toolkit.declarations);
  const registry = makeInteractionRegistry({ db, logger });
  const steps = clampInt(maxSteps, DEFAULT_MAX_STEPS, 1, 8);
  const tokenBudget = clampInt(maxTotalTokens, DEFAULT_MAX_TOTAL_TOKENS, 1000, MAX_TOTAL_TOKENS);
  const requestTimeout = clampInt(timeoutMs, DEFAULT_TIMEOUT_MS, 5000, MAX_TIMEOUT_MS);
  const agentConfig = {
    type: "antigravity",
    max_total_tokens: String(tokenBudget),
  };
  if (model) agentConfig.model = String(model);

  let circuitOpenUntil = 0;

  function createInteraction(request) {
    return client.interactions.create(request, { timeout: requestTimeout });
  }

  function failure(message, cause, toolExecuted) {
    return antigravityError(`${message}${envError(cause)}`, { cause, toolExecuted });
  }

  async function chat({
    message,
    history = [],
    farmerId = null,
    sessionId = null,
    pendingBooking = null,
    language = null,
    systemInstruction = "",
  }) {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw new Error("Message is required");
    if (cleanMessage.length > 2000) throw new Error("Message is too long");

    if (Date.now() < circuitOpenUntil) {
      throw antigravityError("Antigravity is temporarily unavailable after a recent failure");
    }

    const instructions = `${String(systemInstruction || "").trim()}

${buildChatInstructions({
  farmerId,
  language,
  pendingBooking,
  toolsAvailable: toolkit.toolsAvailable,
  bookingAvailable: toolkit.bookingAvailable,
})}`.trim();

    const transcript = historyTranscript(history);
    const prompt = transcript
      ? `Recent conversation (oldest first):\n${transcript}\n\nFarmer's question:\n${cleanMessage}`
      : `Farmer's question:\n${cleanMessage}`;

    const ctx = {
      farmerId: farmerId || null,
      sessionId: sessionId || null,
      message: cleanMessage,
      language: String(language || "").toLowerCase() || null,
      turnId: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const toolsUsed = [];
    let round = 0;
    let previousInteractionId = await registry.get(farmerId, sessionId);
    let interaction = null;
    let input = prompt;

    try {
      for (;;) {
        const request = {
          agent,
          input,
          environment: "remote",
          store: true,
        };
        if (!previousInteractionId) {
          request.system_instruction = instructions;
          request.agent_config = agentConfig;
        }
        if (tools.length) request.tools = tools;
        if (previousInteractionId) request.previous_interaction_id = previousInteractionId;
        // Once tool rounds are exhausted, keep the final call tool-free so
        // the agent must answer from the results it already has.
        if (round >= steps) delete request.tools;

        try {
          interaction = await createInteraction(request);
        } catch (e) {
          if (previousInteractionId && toolsUsed.length === 0 && round === 0) {
            // A stored interaction can expire or be pruned. Retry once as a
            // fresh conversation before surfacing the failure.
            previousInteractionId = null;
            continue;
          }
          throw e;
        }

        if (!interaction || !interaction.id) {
          throw antigravityError("Antigravity returned no interaction id", { toolExecuted: toolsUsed.length > 0 });
        }
        previousInteractionId = interaction.id;

        const interactionSteps = Array.isArray(interaction.steps) ? interaction.steps : [];
        const calls = interactionSteps.filter((s) => s && s.type === "function_call");
        const status = String(interaction.status || "");

        if (calls.length) {
          if (round >= steps) {
            interaction = null;
            throw antigravityError("Antigravity exceeded the tool-call limit", {
              toolExecuted: toolsUsed.length > 0,
            });
          }
          round += 1;
          const results = [];
          for (const call of calls) {
            const name = String(call.name || "unknown");
            toolsUsed.push(name);
            const out = await toolkit.run(
              { name, args: call.arguments || {} },
              ctx
            );
            results.push({
              type: "function_result",
              name,
              call_id: call.id,
              is_error: out && out.ok === false,
              result: [{ type: "text", text: JSON.stringify(out) }],
            });
          }
          input = results;
          continue;
        }

        if (status === "failed" || status === "cancelled" || status === "budget_exceeded") {
          throw antigravityError(`Antigravity interaction ${status}`, {
            toolExecuted: toolsUsed.length > 0,
          });
        }

        const text =
          (typeof interaction.output_text === "string" && interaction.output_text.trim()) ||
          textFromSteps(interactionSteps);

        if (text) {
          await registry.set(farmerId, sessionId, interaction.id);
          return {
            reply: text,
            toolRounds: Math.min(round, steps),
            toolsUsed,
          };
        }

        if (status === "requires_action") {
          throw antigravityError("Antigravity requested an action but returned no function call", {
            toolExecuted: toolsUsed.length > 0,
          });
        }

        throw antigravityError(`Antigravity returned no answer (status: ${status || "unknown"})`, {
          toolExecuted: toolsUsed.length > 0,
        });
      }
    } catch (e) {
      if (!e.toolExecuted) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      logger.error("antigravity request failed:", (e && e.message) || e);
      if (e && e.code === "ANTIGRAVITY_FAILED") throw e;
      throw failure("Antigravity request failed", e, toolsUsed.length > 0);
    }
  }

  return {
    chat,
    toolsAvailable: toolkit.toolsAvailable,
    bookingAvailable: toolkit.bookingAvailable,
    maxSteps: steps,
  };
}

module.exports = {
  createAntigravityAgent,
  makeInteractionRegistry,
  toAntigravityTools,
  textFromSteps,
};
