/*
 * ivr/server.js  -  AGROBRIDGE phone service on Render.com (free)
 *
 * Endpoints
 *   GET  /health                 -> "ok"   (used by the keep-awake ping)
 *   POST /voice                  -> answer URL for the phone simulator / Plivo / Twilio
 *   GET  /sim                    -> browser "phone" (PROVIDER=sim, no telecom account needed)
 *   GET  /sim/pending?phone=     -> the simulator asks "is AgroBridge calling me?"
 *   GET  /tts?lang=hi&text=       -> natural female voice (Microsoft neural, free) for the simulator
 *   POST /call-me    {phone}     -> ring the farmer, run the IVR   (app / website button)
 *   POST /notify-next {centreId,date} -> call the next waiting farmer (app calls this after gate entry)
 *
 * /call-me and /notify-next need header  x-agb-key: <APP_SHARED_KEY>
 *
 * Same core as functions/index.js can use on Blaze:
 *   exports.ivr = onRequest(app);
 */
require("dotenv").config();
const express = require("express");
const {initializeApp, cert} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const path = require("path");
const {makeIvr, makeCaller} = require("./ivr-core");

const {
  PORT = 3000,
  BASE_URL,
  FIREBASE_SERVICE_ACCOUNT_B64,
  PROVIDER = "sim",                         // "sim" (default, free) | "plivo" | "twilio"
  PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_FROM,
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM,
  APP_SHARED_KEY = "agb-dev-key",
} = process.env;

const creds = PROVIDER === "twilio" ?
  {accountSid: TWILIO_ACCOUNT_SID, authToken: TWILIO_AUTH_TOKEN, from: TWILIO_FROM} :
  PROVIDER === "plivo" ?
  {accountSid: PLIVO_AUTH_ID, authToken: PLIVO_AUTH_TOKEN, from: PLIVO_FROM} :
  {accountSid: "sim", authToken: "sim", from: "+10000000000"};   // simulator needs no account

if (!FIREBASE_SERVICE_ACCOUNT_B64) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_B64 (see README)"); process.exit(1);
}
/** Accepts the base64 string OR the raw service-account JSON pasted as-is. */
function readServiceAccount(raw) {
  const v = String(raw).trim().replace(/\s+/g, (m) => (m.includes("\n") ? "" : m));
  if (v.startsWith("{")) return JSON.parse(v);                       // raw JSON pasted
  const decoded = Buffer.from(v.replace(/\s/g, ""), "base64").toString("utf8");
  if (!decoded.trim().startsWith("{")) {
    console.error("FIREBASE_SERVICE_ACCOUNT_B64 is not valid. Paste EITHER the output of");
    console.error("  base64 -w0 your-service-account.json   OR the whole JSON file contents.");
    process.exit(1);
  }
  return JSON.parse(decoded);
}
initializeApp({credential: cert(readServiceAccount(FIREBASE_SERVICE_ACCOUNT_B64))});
const db = getFirestore();

const ivr = makeIvr({db, provider: PROVIDER, baseUrl: BASE_URL});
const caller = creds.accountSid ? makeCaller({provider: PROVIDER, baseUrl: BASE_URL, ...creds}) : null;
console.log(`telephony provider: ${PROVIDER} ${caller ? "(outbound enabled)" : "(outbound DISABLED - no credentials)"}`);

const app = express();
app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.get("/", (_, res) => res.send(`AGROBRIDGE IVR up (${PROVIDER})` +
    (PROVIDER === "sim" ? ` - open <a href="/sim">/sim</a> for the phone simulator` : "")));

// ---- phone simulator (PROVIDER=sim) --------------------------------
if (PROVIDER === "sim") {
  app.get("/sim", (_, res) => res.sendFile(path.join(__dirname, "sim.html")));
  app.get("/sim/pending", (req, res) => {
    const c = caller.takePending(String(req.query.phone || ""));
    res.json(c ? {url: c.url, sid: c.sid} : {});
  });

  // Natural voice for the simulator. Same neural voices Edge "Read aloud" uses; no key needed.
  // Cached in memory so every repeated prompt (menus) plays instantly.
  const TTS_VOICE = {hi: "hi-IN-SwaraNeural", en: "en-IN-NeerjaNeural"};
  const ttsCache = new Map();
  app.get("/tts", async (req, res) => {
    const lang = req.query.lang === "hi" ? "hi" : "en";
    const text = String(req.query.text || "").slice(0, 600);
    if (!text) return res.status(400).end();
    const key = `${lang}|${text}`;
    try {
      if (!ttsCache.has(key)) {
        const {MsEdgeTTS, OUTPUT_FORMAT} = require("msedge-tts");
        const tts = new MsEdgeTTS();
        await tts.setMetadata(TTS_VOICE[lang], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const {audioStream} = tts.toStream(text);
        const buf = await new Promise((ok, bad) => {
          const chunks = []; audioStream.on("data", (c) => chunks.push(c));
          audioStream.on("end", () => ok(Buffer.concat(chunks))); audioStream.on("error", bad);
        });
        if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
        ttsCache.set(key, buf);
      }
      res.set({"Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400"}).send(ttsCache.get(key));
    } catch (e) {
      console.error("tts failed:", e.message);
      res.status(503).end();          // simulator falls back to the browser voice
    }
  });
}
app.get("/health", (_, res) => res.send("ok"));

app.post("/voice", async (req, res, next) => {
  // Missed-call booking: reject the call, then ring back after 3 s.
  if (req.query.step === "missedcall" && caller) {
    const phone = String(req.body.From || "");
    setTimeout(() => caller.callMe(phone).catch((e) => console.error("callback failed", e.message)), 3000);
  }
  return ivr.handleVoice(req, res, next);
});

function auth(req, res, next) {
  if (req.get("x-agb-key") !== APP_SHARED_KEY) return res.status(401).json({error: "bad key"});
  if (!caller) return res.status(503).json({error: "telephony not configured"});
  next();
}

app.post("/call-me", auth, async (req, res) => {
  try {
    const call = await caller.callMe(req.body.phone, req.body.lang);
    res.json({ok: true, sid: call.sid});
  } catch (e) {
    console.error(e); res.status(500).json({error: e.message});
  }
});

app.post("/notify-next", auth, async (req, res) => {
  try {
    const {centreId, date} = req.body;
    const b = await ivr.store.nextWaitingBooking(centreId, date);
    if (!b) return res.json({ok: true, called: null});
    // don't call the same token twice
    const ref = db.collection("bookings").doc(b.tokenId);
    if (b.reminderCallAt) return res.json({ok: true, called: null, reason: "already"});
    const call = await caller.callReminder(b);
    await ref.set({reminderCallAt: new Date().toISOString(), reminderCallSid: call.sid}, {merge: true});
    res.json({ok: true, called: b.tokenNumber});
  } catch (e) {
    console.error(e); res.status(500).json({error: e.message});
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`IVR listening on ${PORT}`));
