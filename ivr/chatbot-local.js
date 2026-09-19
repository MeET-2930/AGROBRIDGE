require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// Allow the Expo web app (any localhost dev port, e.g. 8081) to call this API.
app.use(
  cors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

const PORT = 3001;

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash",
  systemInstruction: `
You are the AgroBridge Assistant.

AgroBridge is a smart procurement platform that helps farmers manage
mandi/procurement-yard visits, slots, queues, tokens, payments and
procurement information.

Answer farmers clearly and simply.

You can answer common FAQs such as:

1. How do I book a slot?
2. How does the procurement yard work?
3. What is a token?
4. How does the queue work?
5. What happens after gate entry?
6. What is quality/assay checking?
7. What happens during weighing?
8. How does payment work?
9. How can I use phone-call booking?
10. What can I do if I have a problem?
11. What crops can be accepted?
12. How can I check my booking?
13. How can I check my payment status?

Rules:
- Do not invent live booking, queue, payment, slot, mandi or farmer data.
- You are currently a read-only assistant.
- Do not claim that an action was completed.
- Do not book, cancel, reschedule or modify anything.
- If the farmer asks for live personal information, explain that
  live account data is not connected yet.
- Keep answers concise and practical.
- Respond in Hindi when the farmer writes in Hindi/Hinglish.
- Respond in English when the farmer writes in English.
- If the question is unrelated to AgroBridge, politely redirect
  the farmer to AgroBridge-related help.
`,
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "agrobridge-chatbot" });
});

app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        error: "Message is too long",
      });
    }

    const chat = model.startChat({
      history: history.slice(-10),
    });

    const result = await chat.sendMessage(message);

    res.json({
      reply: result.response.text(),
    });
  } catch (error) {
    console.error("Chatbot error:", error);

    res.status(500).json({
      error: "Unable to get a response from AgroBridge Assistant",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AgroBridge chatbot running on http://localhost:${PORT}`);
});
