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

Rules:
- Never invent booking, queue, payment, slot, centre, or crop information.
- Only mention a token, queue position, payment amount, slot, timing, or booking if it appears in the LIVE context below. If the LIVE context is missing or null, say the information is not available instead of guessing.
- Clearly distinguish live personal information from general process information.
- If the booking status shows the farmer is already inside the yard (in-gate, assay, price-fixed, weighing, payment-processing) or paid, explain that stage; do not describe them as waiting in the queue.
- paid means payment is completed; payment-processing means it is being processed; weighing or earlier stages mean payment has not been reached yet.
- Do not make bookings, cancellations, payments, or other changes.
- You are currently a READ-ONLY assistant.
- Keep answers concise and practical.
- Respond in the farmer's language: English, Hindi, or Hinglish.
`,
  });

  // READ-ONLY context for one farmer. Only whitelisted fields are
  // exposed to Gemini. gatePassCode / gatePassQr are NEVER included.
  async function getContext(phone) {
    const farmerId = normalizePhone(phone);
    if (!farmerId) return {};

    let booking = null;

    try {
      booking = await store.activeBookingFor(farmerId);
    } catch (e) {
      console.error("chatbot booking lookup failed:", e.message);
    }

    if (!booking) return { booking: null };

    const bookingView = {
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

    const payment = {
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

    let queueView = null;

    if (booking.centreId && booking.date) {
      try {
        const queue = await store.queueFor(booking.centreId, booking.date);
        if (queue) {
          const position = Number(booking.positionAssigned) || 0;
          const inside = new Set(queue.insidePositions || []);
          const ahead = (queue.openPositions || []).filter(
            (p) => p < position && !inside.has(p)
          ).length;
          queueView = {
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
      } catch (e) {
        console.error("chatbot queue lookup failed:", e.message);
      }
    }

    let centre = null;

    if (booking.centreId) {
      try {
        const c = await store.fetchCentreById(booking.centreId);
        if (c) {
          centre = {
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
      } catch (e) {
        console.error("chatbot centre lookup failed:", e.message);
      }
    }

    return {
      booking: bookingView,
      queue: queueView,
      payment,
      centre,
    };
  }

  async function chat({ message, phone, history = [] }) {
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      throw new Error("Message is required");
    }

    if (cleanMessage.length > 2000) {
      throw new Error("Message is too long");
    }

    const context = await getContext(phone);

    const contextText = `
Farmer context (LIVE data from Firestore for this farmer; null means unavailable):

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

  return { chat };
}

module.exports = { createChatbot };