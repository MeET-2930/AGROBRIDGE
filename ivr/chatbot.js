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
    model: "gemini-2.5-flash",
    systemInstruction: `
You are AgroBridge Assistant, a helpful assistant for farmers using AgroBridge.

Answer questions clearly and simply.
You can answer common AgroBridge FAQs and use the supplied farmer/mandi data when available.

Rules:
- Never invent booking, queue, payment, slot, centre, or crop information.
- If live data is unavailable, say so.
- Do not make bookings, cancellations, payments, or other changes.
- You are currently a READ-ONLY assistant.
- Keep answers concise and practical.
- You can respond in English or Hindi depending on the user's language.
`,
  });

  async function getContext(phone) {
    if (!phone) return {};

    const farmerId = normalizePhone(phone);

    let booking = null;

    try {
      booking = await store.activeBookingFor(farmerId);
    } catch (e) {
      console.error("chatbot booking lookup failed:", e.message);
    }

    let queue = null;

    if (booking?.centreId && booking?.date) {
      try {
        queue = await store.queueFor(
          booking.centreId,
          booking.date
        );
      } catch (e) {
        console.error("chatbot queue lookup failed:", e.message);
      }
    }

    return {
      booking: booking || null,
      queue: queue || null,
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
Current farmer context:

${JSON.stringify(context, null, 2)}

Use this data only when relevant.
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