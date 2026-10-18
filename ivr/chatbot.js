const { GoogleGenerativeAI } = require("@google/generative-ai");

const {
  makeStore,
  normalizePhone,
} = require("./ivr-core");
const { createAgent } = require("./agent");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

/**
 * createChatbot({ db, model?, store?, maxSteps? })
 *
 * Agentic AgroBridge Assistant. Gemini picks read-only tools
 * (see ivr/agent.js); the trusted backend executes them against
 * Firestore and feeds real results back until a final answer.
 *
 * `db` is the firebase-admin Firestore instance from server.js.
 * All dependencies are injectable for tests (model / store).
 */
function createChatbot({ db, model = null, store = null, maxSteps = undefined } = {}) {
  if (!store && db) store = makeStore(db);

  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const liveToolsBrief = store
      ? `You have LIVE READ-ONLY TOOLS backed by the real AgroBridge database:
- getFarmerBookings: the logged-in farmer's own active bookings.
- getQueueStatus: live queue for a centre + date.
- getAvailableSlots: remaining bookable slots for a centre + date.
- getCentreInfo: centre address, hours, accepted crops.
- getPaymentStatus: payment details of the farmer's own booking.

How to work:
1. Understand the farmer's goal (their whole request, not just one keyword).
2. When the answer needs live data, call the right tool. Chain tools when
   needed (e.g. getFarmerBookings first to learn centreId/date, then
   getQueueStatus for the live queue).
3. Base the final answer ONLY on verified tool results. Never invent
   booking, queue, payment, slot, centre, crop or token data.
4. If a tool returns ok:false / found:false / NOT_LOGGED_IN / TOOL_FAILED,
   explain the limitation honestly (and suggest logging in or retrying)
   instead of guessing.`
      : `Live account data is NOT connected on this server. Do not claim to know
anyone's booking, queue, payment or slot details. If asked for personal live
data, say it cannot be checked right now and suggest the app's dashboard.`;

    model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      systemInstruction: `
You are AgroBridge Assistant, a helpful agentic assistant for farmers using AgroBridge.

AgroBridge helps farmers manage mandi/procurement-yard visits: slots, queues,
tokens, gate entry, quality check (assay), weighing and payments.

${liveToolsBrief}

Rules:
- You are strictly READ-ONLY. There are no booking/cancel/pay tools.
  If asked to book, cancel, reschedule or pay, say you cannot do that in
  chat and point to the app's booking flow or the helpdesk.
- Never reveal or ask for gate pass codes, QR payloads, admin codes or
  other farmers' data.
- Answer general process FAQs (how booking works, assay, weighing,
  payment flow, documents, MSP vs auction) from knowledge without tools.
- Keep answers concise, practical and farmer-friendly.
- Stay on AgroBridge/mandi/farming topics; politely redirect otherwise.
`,
    });
  }

  const agent = createAgent({
    model,
    store,
    maxSteps,
  });

  /**
   * Validate the requester's claimed phone against Firestore:
   * exactly 10 digits AND a registered users/{phone} document must
   * exist. Returns the verified farmer id, or null which disables
   * every personal tool for this request.
   *
   * LIMITATION (existing app auth): the app signs farmers in with a
   * phone number + Firestore users doc - there is no Firebase Auth
   * ID token to verify yet (see firestore.rules MODE B). Until that
   * is wired, this check is the strongest identity verification the
   * platform supports. The model can never supply this id itself.
   */
  async function verifyFarmer(claimedPhone) {
    const farmerId = normalizePhone(claimedPhone);
    if (!farmerId || farmerId.length !== 10) return null;
    if (!db) return null;
    try {
      const snap = await db.collection("users").doc(farmerId).get();
      return snap.exists ? farmerId : null;
    } catch (e) {
      console.error("chatbot identity check failed:", e.message);
      return null;
    }
  }

  /**
   * One farmer message -> agentic reply.
   * `phone` is the requester's claimed identity from the app session;
   * it is verified above and the verified result is the ONLY farmer id
   * the tools can use.
   */
  async function chat({ message, phone, history = [], language = null }) {
    const farmerId = await verifyFarmer(phone);
    const result = await agent.chat({
      message,
      history,
      farmerId,
      language,
    });
    return {
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      toolRounds: result.toolRounds,
    };
  }

  // Batched translation for the app's translated-history display cache.
  // READ-ONLY: one Gemini request per call, never one per message.
  async function translateTexts({ texts, language }) {
    const code = String(language || "").toLowerCase();
    const target = {
      en: "English",
      hi: "Hindi",
      pa: "Punjabi",
      mr: "Marathi",
    }[code] || null;
    if (!target) throw new Error("Valid target language is required");
    const items = (Array.isArray(texts) ? texts : [])
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string" && t.text.trim())
      .map((t) => ({ id: t.id, text: t.text.trim() }))
      .slice(0, 50);
    if (!items.length) return { translations: [] };
    const prompt = `Translate each chat message below into natural, fluent ${target} (conversational, farmer-friendly; keep names, numbers, dates and token codes unchanged). Return ONLY a JSON array like [{"id": "...", "text": "..."}] with the same ids in the same order, no other text:\n${JSON.stringify(items)}`;
    const result = await model.generateContent(prompt, { timeout: MODEL_TIMEOUT_MS });
    const match = /\[[\s\S]*\]/.exec(String(result.response.text() || ""));
    if (!match) throw new Error("Translate failed");
    const parsed = JSON.parse(match[0]);
    const translations = (Array.isArray(parsed) ? parsed : [])
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
      .map((t) => ({ id: t.id, text: t.text }))
      .slice(0, items.length);
    return { translations };
  }

  return { chat, translateTexts };
}

module.exports = { createChatbot };
