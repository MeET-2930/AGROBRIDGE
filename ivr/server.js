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
const { makeRetellWebhook } = require("./retell");
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
const retellWebhook = makeRetellWebhook({ db });
const bookingAgent = makeAiAgent({ db });

// ---------------------------------------------------------------
// Express
// ---------------------------------------------------------------

const app = express();

app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

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

    // Try Sarvam first if key set (best Hindi voice)
    const SARVAM_KEY = process.env.SARVAM_API_KEY || process.env.SARVAM_API_SUBSCRIPTION_KEY || "";
    if (SARVAM_KEY) {
      try {
        if (!ttsCache.has(key)) {
          const resp = await fetch("https://api.sarvam.ai/text-to-speech", {
            method: "POST",
            headers: {
              "api-subscription-key": SARVAM_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: text,
              target_language_code: lang === "hi" ? "hi-IN" : "en-IN",
              model: "bulbul:v3",
              speaker: lang === "hi" ? "meera" : "anushka",
              pace: 1,
              speech_sample_rate: 22050,
            }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const b64 = j.audios && j.audios[0];
            if (b64) {
              const buf = Buffer.from(b64, "base64");
              if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
              ttsCache.set(key, buf);
            }
          }
        }
        if (ttsCache.has(key)) {
          return res
            .set({
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400",
              "X-TTS": "sarvam",
            })
            .send(ttsCache.get(key));
        }
      } catch (e) {
        console.error("sarvam tts failed, falling back to Edge:", e.message);
      }
    }

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
          "X-TTS": "edge",
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
  res.json({ ok: true, provider: process.env.PROVIDER||"sim", gemini: !!(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY), openrouter: !!process.env.OPENROUTER_API_KEY, openrouterModel: process.env.OPENROUTER_MODEL||"meta-llama/llama-3.1-8b-instruct:free" })
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
app.get("/agent-simple", (_, res) => res.sendFile(path.join(__dirname, "agent-simple.html")));
app.get("/gemini-voice", (_, res) => res.sendFile(path.join(__dirname, "gemini-voice.html")));
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
    res.status(500).json({ error: "Booking agent failed", reply: "क्षमा कीजिए जी, थोड़ी तकनीकी दिक्कत आ गई। कृपया फिर से बताइए।" });
  }
});

// Retell AI webhook (booking capable) — free, no key, talk like human
app.get("/open-router-call", (_, res) => res.sendFile(path.join(__dirname, "open-router-call.html")));
app.get("/booking-sim", (_, res) => res.sendFile(path.join(__dirname, "booking-sim.html")));
app.get("/sim-openrouter", (_, res) => res.sendFile(path.join(__dirname, "sim-openrouter.html")));
app.get("/sim-agent", (_, res) => res.sendFile(path.join(__dirname, "sim-agent.html")));
app.get("/test-booking", (_, res) => res.sendFile(require("path").join(__dirname, "test-booking.html")));
app.get("/11labs", (_, res) => res.sendFile(path.join(__dirname, "11labs.html")));
app.get("/live", (_, res) => res.sendFile(path.join(__dirname, "live.html")));

app.post("/live/audio", chatGuard, async (req, res) => {
  try {
    const { audioBase64, mimeType, phone, lang, messages } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audio" });
    const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    let transcript = "";
    if (GEMINI_KEY) {
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
          { text: "Transcribe this farmer audio exactly in the language spoken (Hindi/English). Output ONLY the transcription, no extra words. If silence, output empty string." },
          { inlineData: { data: audioBase64, mimeType: mimeType || "audio/webm" } }
        ]);
        transcript = (result.response.text() || "").trim();
      } catch (e) {
        console.error("gemini transcribe failed", e.message);
      }
    }
    if (!transcript) {
      return res.json({ transcript: "", reply: lang==="hi" ? "सुनाई नहीं दिया जी, फिर से बोलिए या type कर दीजिए।" : "Didn't catch that, please speak again or type.", done: false });
    }
    let msgs = Array.isArray(messages) ? [...messages] : [];
    msgs.push({ role: "user", content: transcript });
    const result2 = await bookingAgent.handleChat({ messages: msgs, phone: phone || "9100000001", lang: lang || "hi" });
    res.json({ transcript, reply: result2.reply, done: result2.done });
  } catch (e) {
    console.error("live/audio error", e);
    res.status(500).json({ error: "Live audio failed", reply: "क्षमा कीजिए जी, दिक्कत आ गई। type करके भेजिए।" });
  }
});

app.post("/retell/webhook", async (req,res)=> retellWebhook.handleWebhook(req,res));
app.get("/retell/test", (_,res)=> res.json({ok:true, message:"Retell webhook is live. POST /retell/webhook with {function_name, arguments}"}));

// ---------------------------------------------------------------

// 11labs signed URL for private agents (fixes 400 conversation token error)
app.get("/11labs/token", async (req,res)=>{
  try{
    const agentId = String(req.query.agent_id||"").trim();
    if(!agentId) return res.status(400).json({error:"missing agent_id"});
    const key = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || "";
    if(!key) return res.status(500).json({error:"ELEVENLABS_API_KEY not set on Render"});
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,{
      headers: {"xi-api-key": key}
    });
    const j = await r.json().catch(()=>({}));
    if(!r.ok) return res.status(r.status).json({error: j?.detail||j?.message||"elevenlabs error", raw:j});
    // j.signed_url
    return res.json(j);
  }catch(e){ console.error("/11labs/token",e); res.status(500).json({error:e.message}) }
});

// ELEVENLABS WEBHOOK - direct booking for 11labs agent
// POST /api/book  {centreId,crop,quantity,date,slot,farmerName,phone}
// Also supports GET query params for ElevenLabs GET tools
// ---------------------------------------------------------------

// 11labs: check if farmer exists by phone (for Hindi orb name flow)
app.get("/api/farmer", async (req,res)=>{
  try{
    const phone = String(req.query.phone||req.query.phoneNumber||"").replace(/\D/g,"").slice(-10);
    if(!phone || phone.length<10) return res.status(400).json({ok:false, error:"missing phone 10 digits"});
    const full = "91"+phone;
    // try full, then last10
    let doc = await db.collection("farmers").doc(full).get();
    if(!doc.exists) doc = await db.collection("farmers").doc(phone).get();
    if(!doc.exists){
      // also try query by phone field
      const q = await db.collection("farmers").where("phone","==",full).limit(1).get();
      if(!q.empty) doc = q.docs[0];
      else {
        const q2 = await db.collection("farmers").where("phone","==",phone).limit(1).get();
        if(!q2.empty) doc = q2.docs[0];
      }
    }
    if(doc && doc.exists){
      const d=doc.data();
      return res.json({ok:true, exists:true, phone: d.phone||full, name: d.name||"", farmerId: doc.id});
    }
    return res.json({ok:true, exists:false});
  }catch(e){ console.error("/api/farmer",e); res.status(500).json({ok:false, error:e.message})}
});
app.post("/api/farmer", async (req,res)=>{
  try{
    const phoneRaw = String(req.body.phone||req.query.phone||"").replace(/\D/g,"").slice(-10);
    const name = String(req.body.name||req.body.farmerName||"").trim().slice(0,30);
    if(!phoneRaw || phoneRaw.length<10) return res.status(400).json({ok:false, error:"phone required"});
    if(!name || name.length<2) return res.status(400).json({ok:false, error:"name required"});
    const phone="91"+phoneRaw;
    await db.collection("farmers").doc(phone).set({phone, name, createdAt:new Date().toISOString(), source:"11labs-orb", registeredVia:"voice"}, {merge:true});
    return res.json({ok:true, phone, name});
  }catch(e){ console.error("POST /api/farmer",e); res.status(500).json({ok:false, error:e.message})}
});


// Verify bookings for a phone — proves Firebase connection
app.get("/api/bookings", async (req,res)=>{
  try{
    const phone = String(req.query.phone||"").replace(/\D/g,"").slice(-10);
    if(!phone) return res.status(400).json({ok:false, error:"phone query required"});
    const full="91"+phone;
    const snaps = await Promise.all([
      db.collection("bookings").where("farmerId","==",full).limit(10).get(),
      db.collection("bookings").where("farmerId","==",phone).limit(10).get()
    ]);
    const all = [...snaps[0].docs, ...snaps[1].docs].map(d=>({id:d.id, ...d.data()}));
    return res.json({ok:true, count: all.length, bookings: all.sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)))});
  }catch(e){ console.error("/api/bookings",e); res.status(500).json({ok:false, error:e.message})}
});
app.get("/api/slots", async (req,res)=>{
  try{
    const {centreId, date} = req.query;
    if(!centreId || !date) return res.status(400).json({ok:false, error:"centreId and date required"});
    const centre = await bookingAgent.store.fetchCentreById(centreId);
    if(!centre) return res.status(404).json({ok:false, error:"centre not found"});
    const slots = await bookingAgent.store.fetchAvailableSlots(centre, date);
    return res.json({ok:true, centre: centre.name, date, slots});
  }catch(e){ res.status(500).json({ok:false, error:e.message}) }
});

app.all("/api/book", async (req, res) => {
  try {
    const src = { ...(req.query||{}), ...(req.body||{}) };
    let { centreId, crop, quantity, date, slot, farmerName, phone } = src;
    quantity = Number(quantity);
    // fuzzy centre resolve: accept "Gurugram" or id
    if (centreId && !String(centreId).startsWith("centre_")) {
      const centres = await bookingAgent.store.fetchCentres();
      const q = String(centreId).toLowerCase();
      const hit = centres.find(c => c.name?.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || q.includes(c.name?.toLowerCase().slice(0,4)));
      if (hit) centreId = hit.id;
    }
    if (!centreId || !crop || !quantity || !date || !slot) {
      return res.status(400).json({ ok:false, error:"Missing required: centreId, crop, quantity, date, slot", received: src });
    }
    const centre = await bookingAgent.store.fetchCentreById(centreId);
    if (!centre) return res.status(404).json({ ok:false, error:"Mandi not found: "+centreId });
    const slots = await bookingAgent.store.fetchAvailableSlots(centre, date);
    if (!slots.find(s=>s.slotTime===slot)) {
      return res.status(400).json({ ok:false, error:"Slot not available", availableSlots: slots.map(s=>s.slotTime) });
    }
    const bPhone = String(phone||"919999999999");
    const bName = String(farmerName||bPhone);
    await bookingAgent.store.ensureFarmer(bPhone, bName);
    const booking = await bookingAgent.store.createBooking({ farmerId:bPhone, farmerName:bName, centre, crop:String(crop).toLowerCase(), quantity, date, slot });
    console.log(`✅ Firebase booking created: ${booking.tokenNumber} ${booking.centreName} ${booking.date} ${booking.slot} for ${bPhone} (${bName})`);
    return res.json({ ok:true, tokenNumber: booking.tokenNumber, gatePassCode: booking.gatePassCode, centreName: booking.centreName, date: booking.date, slot: booking.slot, phone: bPhone, smsSent: false, firebase: true, message: `Booked ${booking.tokenNumber} at ${booking.centreName} ${booking.date} ${booking.slot} — SMS will be sent to ${bPhone}` });
  } catch(e){
    console.error("/api/book error", e);
    const msg = String(e.message||"");
    if(msg.includes("SLOT_FULL")) return res.status(409).json({ ok:false, error:"Slot full, try another time" });
    return res.status(500).json({ ok:false, error: msg||"Booking failed" });
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