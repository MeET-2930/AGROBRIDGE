/**
 * ivr/agent.js
 * ---------------------------------------------------------------
 * Agentic AgroBridge Assistant core.
 *
 * Gemini (function calling) decides which READ-ONLY tools to run;
 * this module executes them against the injected Firestore store
 * (ivr-core makeStore), feeds the real results back to Gemini, and
 * loops until the model returns a final answer or `maxSteps`
 * tool rounds are used up.
 *
 * SECURITY MODEL
 * - Tools never accept a farmer ID argument. The verified farmer
 *   identity comes from the HTTP request (see chatbot.js) and is
 *   closed over per request, so the model cannot read another
 *   farmer's data even if it hallucinates parameters.
 * - All tool results are whitelisted field views; gate pass codes,
 *   QR payloads and centre admin codes are never exposed.
 * - Every tool validates its arguments and returns ok:false JSON
 *   (never throws into the loop); Firestore/Gemini failures are
 *   reported gracefully instead of invented around.
 * - No write tools exist: booking / cancel / payment actions are
 *   refused by the system instructions and simply have no tool.
 * ---------------------------------------------------------------
 */

const { SchemaType } = require("@google/generative-ai");

const DEFAULT_MAX_STEPS = 5;
// Per Gemini call. Without this a stalled API request can hang the
// HTTP request indefinitely (observed ~90s+ on a transient stall).
const DEFAULT_MODEL_TIMEOUT_MS = 30000;

const TOOL_NAMES = {
  GET_FARMER_BOOKINGS: "getFarmerBookings",
  GET_QUEUE_STATUS: "getQueueStatus",
  GET_AVAILABLE_SLOTS: "getAvailableSlots",
  GET_CENTRE_INFO: "getCentreInfo",
  GET_PAYMENT_STATUS: "getPaymentStatus",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CENTRE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

// ---------------------------------------------------------------
// Arg validation (shared by tools + tests)
// ---------------------------------------------------------------

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validateCentreId(raw) {
  const centreId = typeof raw === "string" ? raw.trim() : "";
  if (!CENTRE_ID_RE.test(centreId)) {
    return { ok: false, error: "INVALID_ARGUMENTS", message: "centreId must be a short id like 'centre_gurugram_01'" };
  }
  return { ok: true, value: centreId };
}

function validateDate(raw) {
  const date = typeof raw === "string" ? raw.trim() : "";
  if (!DATE_RE.test(date)) {
    return { ok: false, error: "INVALID_ARGUMENTS", message: "date must be in YYYY-MM-DD format" };
  }
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const real =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!real || y < 2020 || y > 2100) {
    return { ok: false, error: "INVALID_ARGUMENTS", message: "date is not a real calendar date" };
  }
  return { ok: true, value: date };
}

function validateToken(raw) {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length > 20) {
    return { ok: false, error: "INVALID_ARGUMENTS", message: "tokenNumber must be a short token like 'A-07'" };
  }
  return { ok: true, value: token };
}

// ---------------------------------------------------------------
// Whitelisted views (gatePassCode / gatePassQr / adminCode never
// leave the server)
// ---------------------------------------------------------------

function bookingViewOf(b) {
  return {
    tokenNumber: b.tokenNumber || null,
    positionAssigned: b.positionAssigned ?? null,
    centreId: b.centreId || null,
    centreName: b.centreName || null,
    centreAddress: b.centreAddress || null,
    date: b.date || null,
    slotTime: b.slotTime || null,
    slotWindow: b.slotWindow || null,
    crop: b.crop || null,
    cropName: b.cropName || null,
    quantityQuintals: b.approxQuantityQuintals ?? null,
    status: b.status || null,
    estimatedTurnTime: b.estimatedTurnTime || b.arriveAt || null,
  };
}

function paymentViewOf(b) {
  return {
    status: b.status || null,
    ratePerQuintal: b.ratePerQuintal ?? null,
    actualQuantity: b.actualQuantity ?? null,
    grossAmount: b.grossAmount ?? null,
    mandiFee: b.mandiFee ?? null,
    commission: b.commission ?? null,
    hamali: b.hamali ?? null,
    netPayable: b.netPayable ?? null,
    receiptId: b.receiptId || null,
    paidAt: b.paidAt || null,
    paymentReference: b.paymentReference || null,
    paymentBasis: b.paymentBasis || null,
  };
}

function queueViewOf(booking, queue) {
  if (!queue) return null;
  const position = Number(booking?.positionAssigned) || 0;
  const inside = new Set(queue.insidePositions || []);
  const ahead = (queue.openPositions || []).filter(
    (p) => p < position && !inside.has(p)
  ).length;
  return {
    nowServingPosition: queue.nowServingPosition ?? null,
    nowServingToken: queue.nowServingToken || null,
    nowServingStatus: queue.nowServingStatus || null,
    totalBooked: queue.totalBooked ?? null,
    completedCount: queue.completedCount ?? null,
    myPosition: position || null,
    tokensAhead: ahead,
    isInside: inside.has(position),
  };
}

function centreViewOf(c) {
  if (!c) return null;
  return {
    centreId: c.id || null,
    name: c.name || null,
    name_en: c.name_en || null,
    address: c.address || null,
    acceptedCrops: c.acceptedCrops || [],
    operatingStartTime: c.operatingStartTime || null,
    operatingEndTime: c.operatingEndTime || null,
    parallelLanes: c.parallelLanes ?? null,
    avgMinutesPerEntry: c.avgMinutesPerEntry ?? null,
  };
}

// ---------------------------------------------------------------
// Tool declarations for Gemini
// ---------------------------------------------------------------

const FUNCTION_DECLARATIONS = [
  {
    name: TOOL_NAMES.GET_FARMER_BOOKINGS,
    description:
      "List the logged-in farmer's own active AgroBridge bookings (token, centre, date, slot, crop, status). Takes no arguments - the server automatically uses the logged-in farmer's verified identity. Use for 'my booking', 'meri booking', 'mera token' style questions.",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
  },
  {
    name: TOOL_NAMES.GET_QUEUE_STATUS,
    description:
      "Get the live mandi queue for one centre and date: who is being served now, how many tokens booked/completed, and (if the logged-in farmer has a booking there that day) their position and tokens ahead. Use after you know the centreId and YYYY-MM-DD date (from getFarmerBookings or what the farmer said).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        centreId: {
          type: SchemaType.STRING,
          description: "Centre document id, e.g. 'centre_gurugram_01'",
        },
        date: {
          type: SchemaType.STRING,
          description: "Queue date in YYYY-MM-DD format",
        },
      },
      required: ["centreId", "date"],
    },
  },
  {
    name: TOOL_NAMES.GET_AVAILABLE_SLOTS,
    description:
      "List remaining bookable time slots (with free capacity) at a centre for a date. Use when the farmer asks which slots are open or when they can come.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        centreId: {
          type: SchemaType.STRING,
          description: "Centre document id, e.g. 'centre_gurugram_01'",
        },
        date: {
          type: SchemaType.STRING,
          description: "Slot date in YYYY-MM-DD format",
        },
      },
      required: ["centreId", "date"],
    },
  },
  {
    name: TOOL_NAMES.GET_CENTRE_INFO,
    description:
      "Get public information about one procurement centre (name, address, accepted crops, operating hours). Use for mandi address / timings / accepted crop questions when a centreId is known.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        centreId: {
          type: SchemaType.STRING,
          description: "Centre document id, e.g. 'centre_gurugram_01'",
        },
      },
      required: ["centreId"],
    },
  },
  {
    name: TOOL_NAMES.GET_PAYMENT_STATUS,
    description:
      "Get the payment details (rate, weights, gross/net payable, receipt) of the logged-in farmer's own active booking, optionally matching a specific token number. Takes the farmer's identity from the server - never invent a farmer id argument.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tokenNumber: {
          type: SchemaType.STRING,
          description: "Optional token number like 'A-07' to pick one of several bookings",
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------
// Agent
// ---------------------------------------------------------------

/**
 * @param {object} opts
 * @param {object} opts.model     Gemini model from GoogleGenerativeAI (with systemInstruction)
 * @param {object|null} opts.store  makeStore(db) result; null = no Firestore (FAQ-only mode)
 * @param {number} [opts.maxSteps]  max tool-call rounds per request
 * @param {object} [opts.logger]
 * @param {number} [opts.modelTimeoutMs]  per Gemini call timeout (default 30s; 0 disables)
 */
function createAgent({ model, store, maxSteps = DEFAULT_MAX_STEPS, logger = console, modelTimeoutMs } = {}) {
  if (!model) throw new Error("createAgent: model is required");

  const steps = Math.max(1, Math.min(Number(maxSteps) || DEFAULT_MAX_STEPS, 10));
  const toolsAvailable = !!store;
  const timeoutMs = Math.max(
    0,
    Number(modelTimeoutMs) || Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULT_MODEL_TIMEOUT_MS
  );
  // Native SDK request timeout so a stalled call fails fast instead of hanging.
  const requestOptions = timeoutMs > 0 ? { timeout: timeoutMs } : undefined;

  function callModel(request) {
    return model.generateContent(request, requestOptions);
  }

  // -------------------------------------------------------------
  // Tool executors. All return plain JSON; none throw.
  // `ctx.farmerId` is the verified requester, set per chat() call.
  // -------------------------------------------------------------

  async function myActiveBookings(ctx) {
    if (!ctx.farmerId) {
      return {
        ok: false,
        error: "NOT_LOGGED_IN",
        message: "No verified farmer is logged in, so personal booking data cannot be read. Answer from general knowledge and suggest logging in.",
      };
    }
    const rows = await store.activeBookingsFor(ctx.farmerId);
    return {
      ok: true,
      count: rows.length,
      bookings: rows.map((b) => ({ booking: bookingViewOf(b), payment: paymentViewOf(b) })),
    };
  }

  function pickBooking(rows, token) {
    if (!token) return rows[0] || null;
    const t = String(token).toLowerCase();
    return (
      rows.find(
        (b) =>
          String(b.tokenNumber || "").toLowerCase() === t ||
          String(b.tokenId || b.id || "").toLowerCase() === t
      ) || null
    );
  }

  const handlers = {
    async [TOOL_NAMES.GET_FARMER_BOOKINGS](args, ctx) {
      return myActiveBookings(ctx);
    },

    async [TOOL_NAMES.GET_PAYMENT_STATUS](args, ctx) {
      if (!ctx.farmerId) {
        return {
          ok: false,
          error: "NOT_LOGGED_IN",
          message: "No verified farmer is logged in, so payment data cannot be read. Suggest logging in.",
        };
      }
      const rows = await store.activeBookingsFor(ctx.farmerId);
      if (!rows.length) {
        return { ok: true, found: false, message: "This farmer has no active booking, so there is no pending payment record." };
      }
      const tokenArg = isPlainObject(args) ? args.tokenNumber : undefined;
      let booking = rows[0];
      if (tokenArg !== undefined && tokenArg !== null && String(tokenArg).trim() !== "") {
        const v = validateToken(tokenArg);
        if (!v.ok) return v;
        booking = pickBooking(rows, v.value);
        if (!booking) {
          return { ok: true, found: false, message: `No active booking with token ${v.value} belongs to this farmer.` };
        }
      }
      return { ok: true, found: true, tokenNumber: booking.tokenNumber || null, payment: paymentViewOf(booking) };
    },

    async [TOOL_NAMES.GET_QUEUE_STATUS](args, ctx) {
      if (!isPlainObject(args)) {
        return { ok: false, error: "INVALID_ARGUMENTS", message: "Arguments must be an object with centreId and date." };
      }
      const centre = validateCentreId(args.centreId);
      if (!centre.ok) return centre;
      const date = validateDate(args.date);
      if (!date.ok) return date;

      const centreDoc = await store.fetchCentreById(centre.value);
      if (!centreDoc) {
        return { ok: true, found: false, message: `No centre with id ${centre.value}. Use a known centreId.` };
      }
      const queue = await store.queueFor(centre.value, date.value);
      if (!queue) {
        return {
          ok: true,
          found: false,
          centreName: centreDoc.name || null,
          date: date.value,
          message: "No queue exists for this centre/date yet (no bookings that day).",
        };
      }

      let booking = null;
      if (ctx.farmerId) {
        const rows = await store.activeBookingsFor(ctx.farmerId);
        booking =
          rows.find((b) => b.centreId === centre.value && b.date === date.value) || null;
      }
      return {
        ok: true,
        found: true,
        centreName: queue.centreName || centreDoc.name || null,
        date: date.value,
        queue: queueViewOf(booking, queue),
        farmerHasBookingHere: !!booking,
      };
    },

    async [TOOL_NAMES.GET_AVAILABLE_SLOTS](args, ctx) {
      if (!isPlainObject(args)) {
        return { ok: false, error: "INVALID_ARGUMENTS", message: "Arguments must be an object with centreId and date." };
      }
      const centre = validateCentreId(args.centreId);
      if (!centre.ok) return centre;
      const date = validateDate(args.date);
      if (!date.ok) return date;

      const centreDoc = await store.fetchCentreById(centre.value);
      if (!centreDoc) {
        return { ok: true, found: false, message: `No centre with id ${centre.value}. Use a known centreId.` };
      }
      const slots = await store.fetchAvailableSlots(centreDoc, date.value);
      return {
        ok: true,
        found: true,
        centreName: centreDoc.name || null,
        date: date.value,
        slots,
        note: slots.length
          ? "These are remaining slots only - the assistant cannot book them."
          : "No open slots remain for that date.",
      };
    },

    async [TOOL_NAMES.GET_CENTRE_INFO](args, ctx) {
      if (!isPlainObject(args)) {
        return { ok: false, error: "INVALID_ARGUMENTS", message: "Arguments must be an object with centreId." };
      }
      const centre = validateCentreId(args.centreId);
      if (!centre.ok) return centre;
      const c = await store.fetchCentreById(centre.value);
      if (!c) {
        return { ok: true, found: false, message: `No centre with id ${centre.value}.` };
      }
      return { ok: true, found: true, centre: centreViewOf(c) };
    },
  };

  async function runTool(call, ctx) {
    const name = String((call && call.name) || "");
    const handler = handlers[name];
    if (!handler) {
      return { ok: false, error: "UNKNOWN_TOOL", message: `Unknown tool '${name}'. Use only the provided tools.` };
    }
    try {
      const out = await handler(isPlainObject(call.args) ? call.args : call.args, ctx);
      return isPlainObject(out) ? out : { ok: true, result: out };
    } catch (e) {
      logger.error(`agent tool ${name} failed:`, (e && e.message) || e);
      return {
        ok: false,
        error: "TOOL_FAILED",
        message: "The live data service is unavailable right now. Say you could not fetch the data - do not invent it.",
      };
    }
  }

  function safeText(response) {
    try {
      return String((response && response.text && response.text()) || "").trim();
    } catch (e) {
      return "";
    }
  }

  /**
   * Raw content parts of the first candidate. Unlike response.functionCalls()
   * this keeps `thoughtSignature` (and the call `id`), which gemini-3.x
   * requires us to echo back when the conversation continues.
   */
  function modelPartsOf(response) {
    try {
      const c = response && response.candidates && response.candidates[0];
      const parts = c && c.content && c.content.parts;
      return Array.isArray(parts) ? parts.filter((p) => p && typeof p === "object") : [];
    } catch (e) {
      return [];
    }
  }

  function todayIst() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function cleanHistory(history) {
    const turns = (Array.isArray(history) ? history : [])
      .slice(-10)
      .filter((t) => t && (t.role === "user" || t.role === "model") && Array.isArray(t.parts))
      .map((t) => ({
        role: t.role,
        parts: t.parts
          .filter((p) => p && typeof p.text === "string" && p.text.trim())
          .map((p) => ({ text: p.text.slice(0, 4000) })),
      }))
      .filter((t) => t.parts.length > 0);

    // Gemini rejects histories that do not start with a user turn,
    // contain consecutive same-role turns, or end with a dangling
    // user turn - normalise the same way the app client does.
    let i = 0;
    while (i < turns.length && turns[i].role !== "user") i += 1;
    const sliced = turns.slice(i);

    const alternated = [];
    for (const turn of sliced) {
      const last = alternated[alternated.length - 1];
      if (last && last.role === turn.role) continue;
      alternated.push(turn);
    }
    while (alternated.length && alternated[alternated.length - 1].role === "user") {
      alternated.pop();
    }
    return alternated;
  }

  /**
   * One agentic turn: farmer message -> (tool calls <-> Firestore)* -> final reply.
   * @param {object} req
   * @param {string} req.message
   * @param {Array}  [req.history]  Gemini-format turns ({role, parts})
   * @param {string|null} [req.farmerId]  verified 10-digit farmer phone (server-side only)
   * @param {string|null} [req.language]  en | hi | pa | mr
   * @returns {Promise<{reply: string, toolRounds: number, toolsUsed: string[]}>}
   */
  async function chat({ message, history, farmerId = null, language = null }) {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw new Error("Message is required");
    if (cleanMessage.length > 2000) throw new Error("Message is too long");

    const langCode = String(language || "").toLowerCase();
    const langName = { en: "English", hi: "Hindi", pa: "Punjabi", mr: "Marathi" }[langCode] || null;
    const languageLine = langName
      ? `RESPONSE LANGUAGE: ${langName} (${langCode}).
The farmer's selected app language is ${langName}. Answer in ${langName} by default, writing naturally and conversationally like a helpful local assistant: fluent sentences, correct farming and procurement terms, no awkward word-for-word translation, no random mixing of other languages.
- If the farmer explicitly asks for a different response language, that explicit request may override this default.
- Otherwise always answer in ${langName}. The question's language alone must NOT change your response language.`
      : `No app language was supplied. Match the farmer's message language (English, Hindi, or Hinglish).`;

    const identityLine = farmerId
      ? `FARMER IDENTITY: verified server-side. Tools automatically read THIS farmer's data. Never ask the farmer for their farmer ID/phone for tool calls, and never try to pass one - tools ignore such arguments.`
      : toolsAvailable
        ? `FARMER IDENTITY: not logged in. Personal tools (bookings, payment) will return NOT_LOGGED_IN - tell the farmer to log in to the app for personal data. Queue/slot/centre tools still work.`
        : `LIVE DATA: not connected on this server. Tools are unavailable; answer general AgroBridge FAQs only and say live account data cannot be checked right now.`;

    const prompt = `${languageLine}

Today's date (India): ${todayIst()}

${identityLine}

Farmer's question:
${cleanMessage}`;

    const ctx = { farmerId: farmerId || null };

    // Conversation is managed manually with generateContent({contents}).
    // The SDK's chatSession.sendMessage() wraps function responses in
    // role:"function", which the Gemini 3.x API rejects, and it strips
    // the thoughtSignature that gemini-3.x requires us to echo back on
    // continued tool turns. Keeping the raw parts here fixes both.
    const contents = [];
    for (const turn of cleanHistory(history)) contents.push(turn);
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const baseRequest = toolsAvailable
      ? { tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }] }
      : {};

    let finalText = "";
    let round = 0;
    const toolsUsed = [];

    for (;;) {
      const result = await callModel({ ...baseRequest, contents });
      const parts = modelPartsOf(result.response);
      const calls = parts.filter((p) => p && p.functionCall);

      if (!calls.length) {
        finalText = safeText(result.response);
        break;
      }

      round += 1;
      if (round > steps) {
        // Safety valve: never loop forever. One forced final answer
        // with the tools detached, based on whatever was retrieved.
        logger.error("agent: tool-call step limit reached; forcing final answer");
        contents.push({ role: "model", parts });
        contents.push({
          role: "user",
          parts: [{
            text: "You have reached the tool-call limit for this request. Give the best possible final answer now, using only the tool results above. If needed data is still missing, say so honestly instead of guessing.",
          }],
        });
        const forced = await callModel({ contents });
        finalText = safeText(forced.response);
        break;
      }

      const responseParts = [];
      for (const call of calls) {
        const name = String((call.functionCall && call.functionCall.name) || "unknown");
        toolsUsed.push(name);
        const out = await runTool(call.functionCall, ctx);
        const functionResponse = { name, response: out };
        if (call.functionCall.id) functionResponse.id = call.functionCall.id;
        responseParts.push({ functionResponse });
      }

      // Echo the model's raw parts (incl. thoughtSignature) and answer
      // the calls in a following user turn - the format Gemini 3.x wants.
      contents.push({ role: "model", parts });
      contents.push({ role: "user", parts: responseParts });
    }

    let reply = finalText;
    if (!reply) {
      reply =
        "I could not complete that just now - the assistant or the live data service had a problem. Please try again in a moment. / अभी पूरी तरह जवाब नहीं दे पाया, कृपया दोबारा कोशिश करें।";
    }

    return { reply, toolRounds: Math.min(round, steps), toolsUsed };
  }

  return { chat, maxSteps: steps, toolsAvailable };
}

module.exports = {
  createAgent,
  TOOL_NAMES,
  FUNCTION_DECLARATIONS,
  bookingViewOf,
  paymentViewOf,
  queueViewOf,
  centreViewOf,
  validateCentreId,
  validateDate,
  validateToken,
};
