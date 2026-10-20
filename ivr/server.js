/**
 * ivr/server.js - AGROBRIDGE phone service on Render.com (free)
 *
 * Endpoints
 * GET  /health                 -> "ok"
 * POST /voice                  -> answer URL for phone simulator / Plivo / Twilio
 * GET  /sim                    -> browser "phone"
 * GET  /sim/pending?phone=     -> simulator checks for incoming call
 * GET  /tts?lang=hi&text=      -> natural female voice
 * POST /call-me    {phone}     -> ring the farmer, run the IVR
 * POST /notify-next {centreId,date} -> call the next waiting farmer
 *
 * CHATBOT
 * POST /chat {message, phone, history} -> AgroBridge AI assistant
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const { makeIvr, makeCaller } = require("./ivr-core");
const { createChatbot } = require("./chatbot");
const { makeAiAgent } = require("./ai-agent");
const { parseServiceAccount } = require("./firebase-credential");
const { makeKeyGuard, requiredByEnv } = require("./key-guard");

const {
  PORT = 3000,
  BASE_URL,
  FIREBASE_SERVICE_ACCOUNT_B64,
  PROVIDER = "sim",

  PLIVO_AUTH_ID,
  PLIVO_AUTH_TOKEN,
  PLIVO_FROM,

  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM,

  APP_SHARED_KEY = "agb-dev-key",
} = process.env;

// ---------------------------------------------------------------
// Telephony credentials
// ---------------------------------------------------------------

const creds =
  PROVIDER === "twilio"
    ? {
        accountSid: TWILIO_ACCOUNT_SID,
        authToken: TWILIO_AUTH_TOKEN,
        from: TWILIO_FROM,
      }
    : PROVIDER === "plivo"
      ? {
          accountSid: PLIVO_AUTH_ID,
          authToken: PLIVO_AUTH_TOKEN,
          from: PLIVO_FROM,
        }
      : {
          accountSid: "sim",
          authToken: "sim",
          from: "+10000000000",
        };

// ---------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------

if (!FIREBASE_SERVICE_ACCOUNT_B64) {
  console.error(
    "Missing FIREBASE_SERVICE_ACCOUNT_B64 (see README)"
  );
  process.exit(1);
}

/**
 * Accepts the base64 string OR the raw service-account JSON.
 * Fails closed with a clear message; the value is never printed.
 */
function readServiceAccount(raw) {
  try {
    return parseServiceAccount(raw);
  } catch (e) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is not valid."
    );
    console.error(
      "Paste either the base64 service-account JSON or the whole JSON file."
    );
    process.exit(1);
  }
}

initializeApp({
  credential: cert(
    readServiceAccount(FIREBASE_SERVICE_ACCOUNT_B64)
  ),
});

const db = getFirestore();

// ---------------------------------------------------------------
// Existing IVR
// ---------------------------------------------------------------

const ivr = makeIvr({
  db,
  provider: PROVIDER,
  baseUrl: BASE_URL,
});

const caller = creds.accountSid
  ? makeCaller({
      provider: PROVIDER,
      baseUrl: BASE_URL,
      ...creds,
    })
  : null;

console.log(
  `telephony provider: ${PROVIDER} ${
    caller
      ? "(outbound enabled)"
      : "(outbound DISABLED - no credentials)"
  }`
);

// ---------------------------------------------------------------
// AI CHATBOT
// ---------------------------------------------------------------

const chatbot = createChatbot({ db });
const bookingAgent = makeAiAgent({ db });

// ---------------------------------------------------------------
// Express
// ---------------------------------------------------------------

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Production web app (Firebase Hosting) calls /chat (and /call-me)
// from the browser. Allow only that origin; preflight OPTIONS is
// handled automatically. IVR routes and behavior are unchanged.
app.use(
  cors({
    origin: "https://agrobridge-sih26.web.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-agb-key"],
  })
);

// ---------------------------------------------------------------
// Home
// ---------------------------------------------------------------

app.get("/", (_, res) =>
  res.send(
    `AgroBridge IVR up (${PROVIDER})` +
      (PROVIDER === "sim"
        ? ` - open <a href="/sim">/sim</a> for the phone simulator`
        : "")
  )
);

// ---------------------------------------------------------------
// Phone simulator
// ---------------------------------------------------------------

if (PROVIDER === "sim") {
  app.get("/sim", (_, res) =>
    res.sendFile(path.join(__dirname, "sim.html"))
  );

  app.get("/sim/pending", (req, res) => {
    const c = caller.takePending(
      String(req.query.phone || "")
    );

    res.json(
      c
        ? {
            url: c.url,
            sid: c.sid,
          }
        : {}
    );
  });

  // Natural voice for simulator
  const TTS_VOICE = {
    hi: "hi-IN-SwaraNeural",
    en: "en-IN-NeerjaNeural",
  };

  const ttsCache = new Map();

  app.get("/tts", async (req, res) => {
    const lang =
      req.query.lang === "hi" ? "hi" : "en";

    const text = String(
      req.query.text || ""
    ).slice(0, 600);

    if (!text) {
      return res.status(400).end();
    }

    const key = `${lang}|${text}`;

    try {
      if (!ttsCache.has(key)) {
        const {
          MsEdgeTTS,
          OUTPUT_FORMAT,
        } = require("msedge-tts");

        const tts = new MsEdgeTTS();

        await tts.setMetadata(
          TTS_VOICE[lang],
          OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
        );

        const { audioStream } =
          tts.toStream(text);

        const buf = await new Promise(
          (resolve, reject) => {
            const chunks = [];

            audioStream.on(
              "data",
              (c) => chunks.push(c)
            );

            audioStream.on(
              "end",
              () => resolve(Buffer.concat(chunks))
            );

            audioStream.on(
              "error",
              reject
            );
          }
        );

        if (ttsCache.size > 300) {
          ttsCache.delete(
            ttsCache.keys().next().value
          );
        }

        ttsCache.set(key, buf);
      }

      res
        .set({
          "Content-Type": "audio/mpeg",
          "Cache-Control":
            "public, max-age=86400",
        })
        .send(ttsCache.get(key));
    } catch (e) {
      console.error(
        "tts failed:",
        e.message
      );

      res.status(503).end();
    }
  });
}

// ---------------------------------------------------------------
// Health
// ---------------------------------------------------------------

app.get("/health", (_, res) =>
  res.send("ok")
);

// ---------------------------------------------------------------
// Voice
// ---------------------------------------------------------------

app.post(
  "/voice",
  async (req, res, next) => {
    // Missed-call booking:
    // reject the call, then ring back after 3 seconds.
    if (
      req.query.step === "missedcall" &&
      caller
    ) {
      const phone = String(
        req.body.From || ""
      );

      setTimeout(
        () =>
          caller
            .callMe(phone)
            .catch((e) =>
              console.error(
                "callback failed",
                e.message
              )
            ),
        3000
      );
    }

    return ivr.handleVoice(
      req,
      res,
      next
    );
  }
);

// ---------------------------------------------------------------
// Existing API authentication
// ---------------------------------------------------------------

function auth(req, res, next) {
  if (
    req.get("x-agb-key") !==
    APP_SHARED_KEY
  ) {
    return res
      .status(401)
      .json({ error: "bad key" });
  }

  if (!caller) {
    return res
      .status(503)
      .json({
        error:
          "telephony not configured",
      });
  }

  next();
}

// Same shared-secret check as `auth`, but without the telephony
// requirement - used by the chatbot endpoints. NOT strong
// auth (the key ships in the client bundle). Opt-in: set
// CHATBOT_REQUIRE_KEY=true once the app sends the header.
// See README "Security limitations".
const chatGuard = makeKeyGuard({
  key: APP_SHARED_KEY,
  enabled: requiredByEnv(),
});

// ---------------------------------------------------------------
// Call farmer
// ---------------------------------------------------------------

app.post(
  "/call-me",
  auth,
  async (req, res) => {
    try {
      const call = await caller.callMe(
        req.body.phone,
        req.body.lang
      );

      res.json({
        ok: true,
        sid: call.sid,
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: e.message,
      });
    }
  }
);

// ---------------------------------------------------------------
// Notify next farmer
// ---------------------------------------------------------------

app.post(
  "/notify-next",
  auth,
  async (req, res) => {
    try {
      const {
        centreId,
        date,
      } = req.body;

      const b =
        await ivr.store.nextWaitingBooking(
          centreId,
          date
        );

      if (!b) {
        return res.json({
          ok: true,
          called: null,
        });
      }

      // Don't call the same token twice
      const ref = db
        .collection("bookings")
        .doc(b.tokenId);

      if (b.reminderCallAt) {
        return res.json({
          ok: true,
          called: null,
          reason: "already",
        });
      }

      const call =
        await caller.callReminder(b);

      await ref.set(
        {
          reminderCallAt:
            new Date().toISOString(),
          reminderCallSid:
            call.sid,
        },
        { merge: true }
      );

      res.json({
        ok: true,
        called: b.tokenNumber,
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: e.message,
      });
    }
  }
);

// ---------------------------------------------------------------
// AI CHATBOT
// ---------------------------------------------------------------

app.post("/chat", chatGuard, async (req, res) => {
  try {
    const {
      message,
      phone,
      history,
      language,
      sessionId,
    } = req.body;

    const result =
      await chatbot.chat({
        message,
        phone,
        history,
        language,
        sessionId,
      });

    res.json(result);
  } catch (e) {
    console.error(
      "chatbot error:",
      e
    );

    // Never echo internal error details (Gemini/SDK messages) to the client.
    res.status(500).json({
      error:
        "Unable to get a response from AgroBridge Assistant",
    });
  }
});

// ---------------------------------------------------------------
// TRANSLATE (display cache for the app's translated chat history)
// ---------------------------------------------------------------

app.post("/translate", chatGuard, async (req, res) => {
  try {
    const {
      texts,
      language,
    } = req.body;

    const result =
      await chatbot.translateTexts({
        texts,
        language,
      });

    res.json(result);
  } catch (e) {
    console.error(
      "translate error:",
      e
    );

    // Never echo internal error details (Gemini/SDK messages) to the client.
    res.status(500).json({
      error:
        "Unable to translate right now",
    });
  }
});

// ---------------------------------------------------------------
// AI BOOKING AGENT (natural talk + books slot, keeps IVR)
// ---------------------------------------------------------------
app.get("/agent", (_, res) => res.sendFile(path.join(__dirname, "agent.html")));
app.post("/agent/chat", chatGuard, async (req, res) => {
  try {
    const { messages, phone, lang, language } = req.body;
    // support both {messages:[...]} from agent.html and {message,history} from old callers
    let msgs = Array.isArray(messages) ? messages : [];
    if (!msgs.length && req.body.message) {
      const hist = Array.isArray(req.body.history) ? req.body.history : [];
      // convert old Gemini history format if needed
      msgs = [...hist.flatMap(h => h.parts?.map(p=>({role: h.role==="model"?"assistant":"user", content:p.text}))||[]), {role:"user", content:req.body.message}];
    }
    const useLang = lang || language || "hi";
    const result = await bookingAgent.handleChat({ messages: msgs, phone: phone || req.body.phone, lang: useLang });
    res.json(result);
  } catch (e) {
    console.error("booking agent error:", e);
    res.status(500).json({ error: "Booking agent failed", reply: "Sorry ji, thodi dikkat aa gayi." });
  }
});

// A malformed JSON body must not surface an Express stack trace.
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  next(err);
});

// ---------------------------------------------------------------
// Start server
// ---------------------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () =>
    console.log(
      `IVR listening on ${PORT}`
    )
);