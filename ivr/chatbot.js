const { GoogleGenerativeAI } = require("@google/generative-ai");

const {
  makeStore,
  normalizePhone,
} = require("./ivr-core");
const { createAgent } = require("./agent");
const { makeBookingService } = require("./booking-service");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

/**
 * createChatbot({ db, model?, store?, bookingService?, maxSteps? })
 *
 * Agentic AgroBridge Assistant. Gemini picks tools (see ivr/agent.js);
 * the trusted backend executes them against Firestore and feeds real
 * results back until a final answer. Booking tools are enabled only
 * when a booking service can be built (or is injected) and
 * CHATBOT_ALLOW_BOOKING is not "false".
 *
 * `db` is the firebase-admin Firestore instance from server.js.
 * All dependencies are injectable for tests (model / store / booking).
 */
function createChatbot({ db, model = null, store = null, bookingService = null, maxSteps = undefined } = {}) {
  if (!store && db) store = makeStore(db);
  // Booking writes are disabled by default; must be explicitly enabled
  // (CHATBOT_ALLOW_BOOKING=true) in the demo / trusted environment.
  const bookingAllowed = String(process.env.CHATBOT_ALLOW_BOOKING || "false").toLowerCase() === "true";
  if (
    bookingAllowed &&
    !bookingService &&
    db &&
    typeof db.runTransaction === "function" &&
    typeof db.collection === "function"
  ) {
    try {
      bookingService = makeBookingService({ db });
    } catch (e) {
      console.error("chatbot booking service init failed:", e.message);
    }
  }
  const bookingEnabled = Boolean(bookingService && bookingService.enabled !== false);

  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const readToolsBrief = store
      ? `You have LIVE READ-ONLY TOOLS backed by the real AgroBridge database:
- getFarmerBookings: the logged-in farmer's own active bookings.
- getQueueStatus: live queue for a centre + date.
- getAvailableSlots: remaining bookable slots for a centre + date.
- getCentreInfo: centre address, hours, accepted crops.
- getPaymentStatus: payment details of the farmer's own booking.`
      : `Live account data is NOT connected on this server. Do not claim to know
anyone's booking, queue, payment or slot details. If asked for personal live
data, say it cannot be checked right now and suggest the app's dashboard.`;

    const bookingBrief = bookingEnabled
      ? `You also have LIVE BOOKING TOOLS; bookings are real and committed server-side:
- getCentresForCrop: eligible active mandis for a crop.
- getBookingSlots: actual open slots using the app's capacity engine and the farmer's quantity.
- proposeBooking: validates details and creates a pending summary. It does NOT book.
- confirmBooking: commits the pending booking ONLY when the farmer's current message explicitly confirms it.

Never skip proposeBooking, never call confirmBooking without explicit confirmation, and never say "booked" unless confirmBooking returns ok:true. If details change, propose again. If capacity is full or a limit is hit, explain the real reason and offer returned alternatives.`
      : `Live booking is NOT connected on this server. If asked to book, point to the app's booking flow; do not pretend to book.`;

    model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      systemInstruction: `
You are AgroBridge Assistant, a helpful agentic assistant for farmers using AgroBridge.

AgroBridge helps farmers manage mandi/procurement-yard visits: slots, queues,
tokens, gate entry, quality check (assay), weighing and payments.

${readToolsBrief}

${bookingBrief}

How to work:
1. Understand the farmer's whole goal, not just one keyword.
2. When the answer needs live data, call the right tool. Chain tools when
   needed (e.g. getFarmerBookings first to learn centreId/date, then
   getQueueStatus for the live queue).
3. Base the final answer ONLY on verified tool results. Never invent
   booking, queue, payment, slot, centre, crop or token data.
4. If a tool returns ok:false / found:false / NOT_LOGGED_IN / TOOL_FAILED,
   explain the limitation honestly (and suggest logging in or retrying)
   instead of guessing.

Rules:
- You can book slots through the booking tools above, but cannot cancel,
  reschedule or take payments in chat. Point those to the app/helpdesk.
- Never reveal or ask for gate pass codes, QR payloads, admin codes,
  booking ids or other farmers' data. The backend returns the real token.
- Farmer identity is verified server-side. Never ask for or pass a farmer
  id/phone to a tool.
- Answer general process FAQs (booking, assay, weighing, payment flow,
  documents, MSP vs auction) from knowledge without tools.
- Keep answers concise, practical and farmer-friendly.
- Stay on AgroBridge/mandi/farming topics; politely redirect otherwise.
`,
    });
  }

  const agent = createAgent({
    model,
    store,
    bookingService: bookingEnabled ? bookingService : null,
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
  async function chat({ message, phone, history = [], language = null, sessionId = null }) {
    const farmerId = await verifyFarmer(phone);
    let pendingBooking = null;
    if (bookingEnabled && farmerId && sessionId) {
      try {
        pendingBooking = await bookingService.getPending({ farmerId, sessionId });
      } catch (e) {
        console.error("chatbot pending booking lookup failed:", e.message);
      }
    }
    const result = await agent.chat({
      message,
      history,
      farmerId,
      sessionId,
      pendingBooking,
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
