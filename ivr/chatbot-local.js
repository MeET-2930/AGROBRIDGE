require("dotenv").config();

/**
 * ivr/chatbot-local.js
 * ---------------------------------------------------------------
 * Local AgroBridge Assistant server (port 3001) for app development.
 * Runs the SAME agentic chatbot as production (ivr/agent.js via
 * ivr/chatbot.js):
 *
 * - With FIREBASE_SERVICE_ACCOUNT_B64 (or _JSON / application default
 *   credentials) it connects to Firestore and all live read-only tools
 *   work (bookings, queue, slots, centre, payment).
 * - Without Firebase credentials it still runs, in FAQ-only mode:
 *   Gemini answers general AgroBridge questions, personal live data
 *   is reported as unavailable (tools are not offered to the model).
 *
 * Endpoints: GET /health, POST /chat, POST /translate
 * Point services/config.js CHATBOT_BASE_URL at
 * 'http://localhost:3001' for local work (do not commit).
 * ---------------------------------------------------------------
 */

const express = require("express");
const cors = require("cors");
const { createChatbot } = require("./chatbot");
const { parseServiceAccount } = require("./firebase-credential");
const { makeKeyGuard, requiredByEnv } = require("./key-guard");

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
    allowedHeaders: ["Content-Type", "x-agb-key"],
  })
);

const PORT = 3001;

// Mirror production: /chat and /translate can require the app's shared
// key (services/config.js IVR_APP_KEY === APP_SHARED_KEY here) when
// CHATBOT_REQUIRE_KEY=true. Opt-in, so it never breaks a local app that
// hasn't been rebuilt. Not strong auth - see README "Security limitations".
const guard = makeKeyGuard({
  key: process.env.APP_SHARED_KEY || "agb-dev-key",
  enabled: requiredByEnv(),
});

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

// ---------------------------------------------------------------
// Optional Firebase (live tools). Safe to run without it.
// ---------------------------------------------------------------

// Accepts base64 or raw JSON; throws on anything else (see the module).
function readServiceAccount(raw) {
  return parseServiceAccount(raw);
}

async function initFirebase() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    const { initializeApp, cert, applicationDefault, getApps } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");

    if (getApps().length) return await probeFirestore(getFirestore());

    if (raw && String(raw).trim().startsWith("#")) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is a placeholder, not credentials");
    }

    if (raw) {
      initializeApp({ credential: cert(readServiceAccount(raw)) });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
    return await probeFirestore(getFirestore());
  } catch (e) {
    console.warn(`chatbot-local: Firestore unavailable (${e.message}); running in FAQ-only mode (no live tools).`);
    return null;
  }
}

/** Confirm credentials really work (lazy ADC would otherwise fail later). */
async function probeFirestore(db) {
  const probe = db.collection("centres").limit(1).get();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Firestore probe timed out")), 8000)
  );
  await Promise.race([probe, timeout]);
  return db;
}

(async () => {
  const db = await initFirebase();
  const chatbot = createChatbot({ db });

  console.log(
    db
      ? "chatbot-local: live Firestore tools ENABLED"
      : "chatbot-local: FAQ-only mode (no Firebase credentials)"
  );

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "agrobridge-chatbot", liveData: !!db });
  });

  app.post("/chat", guard, async (req, res) => {
    try {
      const message = String(req.body.message || "").trim();
      const history = Array.isArray(req.body.history) ? req.body.history : [];

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (message.length > 2000) {
        return res.status(400).json({ error: "Message is too long" });
      }

      const result = await chatbot.chat({
        message,
        history,
        phone: req.body.phone,
        language: req.body.language,
      });

      res.json(result);
    } catch (error) {
      console.error("Chatbot error:", error);
      res.status(500).json({
        error: "Unable to get a response from AgroBridge Assistant",
      });
    }
  });

  app.post("/translate", guard, async (req, res) => {
    try {
      const result = await chatbot.translateTexts({
        texts: req.body.texts,
        language: req.body.language,
      });
      res.json(result);
    } catch (error) {
      console.error("Translate error:", error);
      res.status(500).json({
        error: "Unable to translate right now",
      });
    }
  });

  // A malformed JSON body must not surface an Express stack trace.
  app.use((err, req, res, next) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    next(err);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgroBridge chatbot running on http://localhost:${PORT}`);
  });
})();
