const { GoogleGenerativeAI } = require("@google/generative-ai");

const {
  makeStore,
  normalizePhone,
} = require("./ivr-core");

function createChatbot({ db }) {
  const store = makeStore(db);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `
You are AgroBridge Assistant, a helpful assistant for farmers using AgroBridge.

Answer questions clearly and simply.
You can answer common AgroBridge FAQs and use the supplied farmer/mandi data when available.

The farmer context below has LIVE sections (BOOKING, QUEUE, PAYMENT, CENTRE) read from Firestore for THIS farmer only, plus your general AgroBridge knowledge.
- Use the LIVE sections for personal questions ("my token", "meri turn", "my payment", "mandi timings").
- Answer general process questions from general knowledge.
- BOOKINGS lists EVERY active booking for this farmer (the top-level BOOKING, QUEUE, PAYMENT, CENTRE describe only the most recent one). If BOOKINGS has more than one entry, answer about the booking the farmer means: use the entry matching any slot, date, token, or centre they mention; otherwise list the available bookings (token, centre, date, slot, status) or ask which one they mean. Do NOT silently answer only about the newest booking.

Rules:
- Never invent booking, queue, payment, slot, centre, or crop information.
- Only mention a token, queue position, payment amount, slot, timing, or booking if it appears in the LIVE context below. If the LIVE context is missing or null, say the information is not available instead of guessing.
- Clearly distinguish live personal information from general process information.
- If the booking status shows the farmer is already inside the yard (in-gate, assay, price-fixed, weighing, payment-processing) or paid, explain that stage; do not describe them as waiting in the queue.
- paid means payment is completed; payment-processing means it is being processed; weighing or earlier stages mean payment has not been reached yet.
- Do not make bookings, cancellations, payments, or other changes.
- You are currently a READ-ONLY assistant.
- Keep answers concise and practical.
- Response language: if the farmer context specifies a RESPONSE LANGUAGE, it is the farmer's selected app language and the DEFAULT response language - follow it. Otherwise match the farmer's message language (English, Hindi, or Hinglish).
`,
  });

  // READ-ONLY context for one farmer. Only whitelisted fields are
  // exposed to Gemini. gatePassCode / gatePassQr are NEVER included.
  function bookingViewOf(booking) {
    return {
      tokenNumber: booking.tokenNumber || null,
      positionAssigned: booking.positionAssigned ?? null,
      centreName: booking.centreName || null,
      centreAddress: booking.centreAddress || null,
      date: booking.date || null,
      slotTime: booking.slotTime || null,
      slotWindow: booking.slotWindow || null,
      crop: booking.crop || null,
      cropName: booking.cropName || null,
      quantityQuintals: booking.approxQuantityQuintals ?? null,
      status: booking.status || null,
      estimatedTurnTime: booking.estimatedTurnTime || booking.arriveAt || null,
    };
  }

  function paymentViewOf(booking) {
    return {
      status: booking.status || null,
      ratePerQuintal: booking.ratePerQuintal ?? null,
      actualQuantity: booking.actualQuantity ?? null,
      grossAmount: booking.grossAmount ?? null,
      mandiFee: booking.mandiFee ?? null,
      commission: booking.commission ?? null,
      hamali: booking.hamali ?? null,
      netPayable: booking.netPayable ?? null,
      receiptId: booking.receiptId || null,
      paidAt: booking.paidAt || null,
      paymentReference: booking.paymentReference || null,
      paymentBasis: booking.paymentBasis || null,
    };
  }

  function queueViewOf(booking, queue) {
    if (!queue) return null;
    const position = Number(booking.positionAssigned) || 0;
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
      openPositions: queue.openPositions || [],
      insidePositions: queue.insidePositions || [],
      myPosition: position || null,
      tokensAhead: ahead,
      isInside: inside.has(position),
    };
  }

  function centreViewOf(c) {
    if (!c) return null;
    return {
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

  async function queueViewFor(booking) {
    if (!booking.centreId || !booking.date) return null;
    try {
      const queue = await store.queueFor(booking.centreId, booking.date);
      return queueViewOf(booking, queue);
    } catch (e) {
      console.error("chatbot queue lookup failed:", e.message);
      return null;
    }
  }

  async function centreViewFor(centreId) {
    if (!centreId) return null;
    try {
      const c = await store.fetchCentreById(centreId);
      return centreViewOf(c);
    } catch (e) {
      console.error("chatbot centre lookup failed:", e.message);
      return null;
    }
  }

  async function getContext(phone) {
    const farmerId = normalizePhone(phone);
    if (!farmerId) return {};

    let all = [];

    try {
      all = await store.activeBookingsFor(farmerId);
    } catch (e) {
      console.error("chatbot booking lookup failed:", e.message);
    }

    if (!all.length) return { booking: null };

    const booking = all[0];
    const bookingView = bookingViewOf(booking);
    const payment = paymentViewOf(booking);
    const queueView = await queueViewFor(booking);
    const centre = await centreViewFor(booking.centreId);

    if (all.length === 1) {
      return {
        booking: bookingView,
        queue: queueView,
        payment,
        centre,
      };
    }

    const bookings = [];
    for (const b of all) {
      bookings.push({
        booking: bookingViewOf(b),
        payment: paymentViewOf(b),
        queue: await queueViewFor(b),
      });
    }

    const centres = {};
    const seen = new Set();
    for (const b of all) {
      if (b.centreId && !seen.has(b.centreId)) {
        seen.add(b.centreId);
        const c = await centreViewFor(b.centreId);
        if (c) centres[b.centreId] = c;
      }
    }

    return {
      booking: bookingView,
      queue: queueView,
      payment,
      centre,
      bookings,
      centres,
    };
  }

  async function chat({ message, phone, history = [], language = null }) {
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      throw new Error("Message is required");
    }

    if (cleanMessage.length > 2000) {
      throw new Error("Message is too long");
    }

    const langCode = String(language || "").toLowerCase();
    const langName = {
      en: "English",
      hi: "Hindi",
      pa: "Punjabi",
      mr: "Marathi",
    }[langCode] || null;
    const languageLine = langName
      ? `RESPONSE LANGUAGE: ${langName} (${langCode}).
The farmer's selected app language is ${langName}. Answer in ${langName} by default, writing naturally and conversationally like a helpful local assistant: fluent sentences, correct farming and procurement terms, no awkward word-for-word translation, no random mixing of other languages.
- If the farmer explicitly asks for a different response language, that explicit request may override this default.
- Otherwise always answer in ${langName}. The question's language alone must NOT change your response language.`
      : `No app language was supplied. Match the farmer's message language (English, Hindi, or Hinglish).`;

    const context = await getContext(phone);

    const contextText = `
Farmer context (LIVE data from Firestore for this farmer; null means unavailable):

LANGUAGE:
${languageLine}

BOOKING:
${JSON.stringify(context.booking ?? null, null, 2)}

QUEUE:
${JSON.stringify(context.queue ?? null, null, 2)}

PAYMENT:
${JSON.stringify(context.payment ?? null, null, 2)}

CENTRE:
${JSON.stringify(context.centre ?? null, null, 2)}

Use the LIVE data above only when relevant to the farmer's question.
Answer general AgroBridge questions from general knowledge.
`;

    const chatSession = model.startChat({
      history: Array.isArray(history)
        ? history.slice(-10)
        : [],
    });

    const result = await chatSession.sendMessage(
      `${contextText}

Farmer's question:
${cleanMessage}`
    );

    return {
      reply: result.response.text(),
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
    const result = await model.generateContent(prompt);
    const match = /\[[\s\S]*\]/.exec(String(result.response.text() || ""));
    if (!match) throw new Error("Translate failed");
    const parsed = JSON.parse(match[0]);
    const translations = (Array.isArray(parsed) ? parsed : [])
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
      .map((t) => ({ id: t.id, text: t.text }))
      .slice(0, items.length);
    return { translations };
  }

  return { chat, translateTexts, getContext };
}

module.exports = { createChatbot };