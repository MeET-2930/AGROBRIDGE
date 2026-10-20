# AGROBRIDGE phone service (IVR)

Farmers with a basic phone book a slot by **call**; the app/website can also
**ring the farmer** ("Book by phone call" card), and the service **calls the
next farmer** automatically when the gate officer admits a vehicle.

Runs on **Render.com free tier**. Same code runs as a Firebase Cloud
Function once you have Blaze (see "Moving to Blaze" at the bottom).

 ---------------------------------------------------------------------------
## AI chatbot (agentic assistant)

The same service hosts the app's **AgroBridge Assistant** (`POST /chat`,
`POST /translate`) - now an agentic Gemini loop (`ivr/agent.js`):

- Gemini picks from live tools backed by real Firestore data via
  `ivr-core makeStore`: `getFarmerBookings`, `getQueueStatus`,
  `getAvailableSlots`, `getCentreInfo`, `getPaymentStatus`.
- Booking tools use the same capacity engine as the app:
  `getCentresForCrop`, `getBookingSlots`, `proposeBooking`, `confirmBooking`
  (`ivr/booking-service.js`). `proposeBooking` only creates a pending
  summary; `confirmBooking` commits in one transaction and only when the
  farmer's **current** message explicitly confirms. The pending intent is
  bound to the verified farmer + app `sessionId`, expires after 15 minutes,
  and is re-checked against live capacity. Cancel / reschedule / payment
  still have no tools.
- The trusted backend executes each tool, returns whitelisted results to
  Gemini, and loops (max 5 tool rounds; a tools-free forced answer ends a
  request that hits the limit).
- Identity: the request's `phone` (the app session uid) must be a
  registered `users/{phone}` document or personal tools return
  `NOT_LOGGED_IN`. Tools can never accept a farmer id from the model.
  Gate pass codes / QR / admin codes are never exposed to the model.
- The app client (`services/chatbot.js` + `screens/common/ChatbotScreen.js`)
  sends the `x-agb-key` header (same `IVR_APP_KEY` as the IVR calls), a
  persisted `sessionId`, and consumes the `/chat` contract `{reply}` (+ a
  `toolsUsed` extra it ignores).
- Booking writes use the Admin SDK collections
  `chatBookingIntents`, `chatBookingSessions`, `chatBookingLocks`. The
  chatbot creates the real `bookings` and `centreQueues` documents with the
  same fields as `services/bookings.js`. `CHATBOT_ALLOW_BOOKING=false` is a
  server-side kill switch (tools disappear; chat stays read-only).

**Run locally:** `npm run chatbot` (port 3001, `ivr/.env` with at least
`GEMINI_API_KEY`; Firebase credentials optional - without them it runs in
FAQ-only mode with live tools disabled). Point
`services/config.js CHATBOT_BASE_URL` at `http://localhost:3001` for local
app work (do not commit).

**Tests:** `npm test` (mocked Gemini/Antigravity + mocked Firestore, no
network), `npm run test:live` (real Gemini API, still-mocked Firestore;
needs `GEMINI_API_KEY`) and `ANTIGRAVITY_LIVE=1 npm run
test:live:antigravity` (real Antigravity call, mocked read store, opt-in
because it costs tokens).

### Optional Antigravity provider (opt-in)

`CHATBOT_PROVIDER=antigravity` routes `/chat` through Google Antigravity
(`@google/genai` Interactions API, `ivr/antigravity.js`) instead of the
Gemini loop. The default stays `gemini`; nothing changes unless you opt in.

- Both providers use the **same** trusted toolkit and prompts
  (`ivr/agent.js createToolkit` / `buildChatInstructions`), so identity,
  session binding, explicit confirmation and idempotency are unchanged.
- Only custom function tools are exposed. Code execution, Google Search,
  URL context, browser and MCP tools are never enabled. The required
  remote environment has no mounted sources.
- Interaction ids are persisted per farmer + session in the small
  `chatInteractionSessions` collection (`interactionId`, `updatedAt` only).
  Without Firestore the cache is in-memory.
- A conservative token budget, per-call timeout, max tool-round cap and a
  30-second circuit breaker limit latency/cost after a failure.
- Fallback is **off** by default. `CHATBOT_ANTIGRAVITY_FALLBACK=gemini`
  retries with Gemini only when Antigravity failed **before any tool ran**,
  never after a read/booking tool has executed.

| Env var | Default | Notes |
| --- | --- | --- |
| `CHATBOT_PROVIDER` | `gemini` | Set to `antigravity` to opt in |
| `CHATBOT_ANTIGRAVITY_FALLBACK` | empty | `gemini` enables pre-tool fallback |
| `ANTIGRAVITY_AGENT` | `antigravity-preview-09-2026` | Agent id |
| `ANTIGRAVITY_MAX_TOTAL_TOKENS` | `50000` | Clamped to 1,000-200,000 |
| `ANTIGRAVITY_TIMEOUT_MS` | `60000` | Per interaction call |
| `ANTIGRAVITY_MAX_STEPS` | `5` | Tool rounds, clamped to 1-8 |
| `ANTIGRAVITY_MODEL` | empty | Optional reasoning-model override |

### Security limitations (read before a public deploy)
`/chat` and `/translate` require the app's shared key (`x-agb-key`, the same
`APP_SHARED_KEY` the IVR endpoints use). This is **not authentication** - the
key ships inside the client bundle, so it only proves "the caller has the
app", never *who the farmer is*. The app still has **no Firebase Auth**
(sign-in is a client-side phone + Firestore `users/{phone}` lookup), so
`/chat` still trusts the caller-supplied `phone`:

- Anyone who has the key **and** knows (or guesses) a registered 10-digit
  number can read that farmer's bookings, queue and payment status, and can
  create tokens for that farmer until **explicit confirmation** (the server
  refuses unconfirmed or same-turn commits, but a malicious caller can still
  say "yes").
- The chatbot can write real bookings. Keep `CHATBOT_ALLOW_BOOKING=false`
  for any public/production deployment until Firebase Auth ID-token
  verification is in place. The verified session phone is the only farmer id
  the tools can use; gate-pass / QR / admin codes are never sent to the model.
- `firestore.rules` MODE A is fully open for the demo. The chatbot's Admin
  SDK bypasses those rules, so do not treat MODE A as safe just because the
  write path is server-side.

The real fix is Firebase Auth: enable the Phone provider, sign in
client-side, send the ID token, and verify it server-side
(`admin.auth().verifyIdToken()`), deriving the farmer from the token's
verified `phone_number` -> `users/{10 digits}`. That needs the Blaze plan -
see `BLAZE_LATER.md`. Until then, keep the shared key and treat this as a
**stopgap**, not a secure identity check.

The `x-agb-key` guard is **opt-in** (`CHATBOT_REQUIRE_KEY=true`) so it never
breaks a client that does not send the header yet. Roll it out in this order:

1. Ship the app build that sends `x-agb-key` (web rebuild + `firebase deploy
   --only hosting`; mobile testers update via `eas update`).
2. Set `CHATBOT_REQUIRE_KEY=true` in the Render dashboard (the service is
   created manually, so `render.yaml` is documentation - it does not apply
   env vars by itself).

A one-line value flip back to `false` (then a redeploy) is the kill-switch.

## Which "phone line" does it use?  (`PROVIDER` env var)

| PROVIDER | What it is | Cost | Needs |
|---|---|---|---|
| `sim` **(default)** | A phone **simulator web page** at `…/sim`. Same IVR code, real Firestore bookings; the "phone" is a browser on any laptop/phone. | ₹0 | nothing |
| `plivo` | Real US number via Plivo | ₹0 for 14 days | work/college email |
| `twilio` | Real US number via Twilio | ~₹1,700 one-time top-up | debit/credit card |

Every free telecom trial in 2026 either gives no number (Twilio), blocks Gmail
(Plivo), or can't call India (Vonage, SignalWire). So we demo with `sim` and
switch to a real number by changing **only env vars** when a card is available.

**How to present it to judges:** "The farmer calls or gives a missed call; our
IVR (this exact code) talks to him in Hindi and books the slot. Today the line
is a simulator because a real Indian number needs telecom KYC; the swap is one
config change."

---------------------------------------------------------------------------
## 1. Firebase service-account key  (2 min)
Firebase console → ⚙️ Project settings → **Service accounts** →
**Generate new private key** → a JSON file downloads.
```bash
base64 -w0 ~/Downloads/agrobridge-sih26-*.json > /tmp/sa.b64
cat /tmp/sa.b64        # copy this whole long string
```
Never commit the JSON. Heads-up: `ivr/.gitignore` only matches
`serviceAccount*.json`, so the Firebase download name
`agrobridge-sih26-*.json` is **not** covered — keep the key in
`~/Downloads`, outside this repo.

## 2. Push the code
```bash
cd ~/projects/AGROBRIDGE
git add -A && git commit -m "install19: phone service" && git push
```

## 3. Create the Render service  (5 min)
1. https://dashboard.render.com → **New +** → **Web Service** → connect
   `MeET-2930/AGROBRIDGE` (Only select repositories → AGROBRIDGE).
2. Settings: Name `agrobridge-ivr` · Root Directory `ivr` ·
   Build `npm install` · Start `npm start` · Instance **Free** ($0).
3. **Environment variables**:

   | Key | Value |
   |---|---|
   | `BASE_URL` | `https://agrobridge-ivr.onrender.com` |
   | `FIREBASE_SERVICE_ACCOUNT_B64` | the long string from step 1 |
   | `PROVIDER` | `sim` |
   | `APP_SHARED_KEY` | `agb-demo-2026` (= `IVR_APP_KEY` in `services/config.js`) |
   | `GEMINI_API_KEY` | Google AI Studio key (**required** - server won't boot without it) |
   | `GEMINI_MODEL` | optional, default `gemini-3.1-flash-lite` |
   | `CHATBOT_REQUIRE_KEY` | `true` (enforce `x-agb-key` on `/chat` + `/translate`; set `false` only as a rollout kill-switch) |
   | `CHATBOT_ALLOW_BOOKING` | `false` until Firebase Auth is wired; omit/`true` only for the controlled demo |

4. **Deploy web service** → ~2 min → log shows
   `telephony provider: sim (outbound enabled)` and `IVR listening`.
5. If Render gave a different URL, put it in Render `BASE_URL` **and** in
   `IVR_BASE_URL` in `services/config.js`.
6. Open the URL → `AGROBRIDGE IVR up (sim)` → click **/sim**.

## 4. Keep it awake during demo hours
Free Render sleeps after 15 min idle; first call would take ~30 s.
https://uptimerobot.com (free) → New monitor → HTTP → URL
`https://agrobridge-ivr.onrender.com/health` → every 5 min.
(The app also pings /health when a farmer opens the call dialog.)

## 5. Test with the simulator
Open `https://agrobridge-ivr.onrender.com/sim` (Chrome; speaker on – the page
speaks with the browser's Hindi/English voices).

- Type the farmer's 10-digit mobile (same number he registered with in the
  app) → **Give missed call to AgroBridge** → call is cut → "AgroBridge
  incoming call" → **Answer** → press 2 for Hindi → 1 to book → mandi → crop →
  day → slot → quantity + `#` → 1 confirm → token spoken → **it appears on his
  dashboard instantly** (same Firestore transaction as the app).
- New number → it asks the name (type it, press **Speak**) → account is
  created (`users/{phone}`, role farmer) → the app dashboard is pre-filled.
- Farmer app → **Book by phone call** → the simulator page for that number
  shows the incoming call within 2 s → Answer.
- Book a 2nd farmer; officer does **Gate entry** for the 1st → the 2nd
  farmer's simulator rings: "your token is next".
- Menu → 2 → hears token, tokens ahead, current token at gate.

Demo tip: keep `/sim` open on a second phone in Chrome, farmer app on the
first phone, officer screen on the laptop.

## 6. Later: switch to a real number (no code change)
- **Twilio** (card, ~$20): Console → Upgrade → buy a US number (Voice) →
  number → Voice config → *A call comes in* → Webhook
  `https://agrobridge-ivr.onrender.com/voice?step=missedcall` POST.
  Render env: `PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_FROM=+1…` → Save → redeploys.
- **Plivo** (work/college email, 14 days): Voice → Applications → Answer URL
  same as above → attach to the rented number → Render env: `PROVIDER=plivo`,
  `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_FROM`. Verify each test phone
  under *Verified Caller IDs*.
- Indian number: Exotel/Plivo India after company KYC – finals only.

---------------------------------------------------------------------------
## Moving to Blaze later (no rewrite)
`functions/index.js` becomes:
```js
const {onRequest} = require("firebase-functions/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const express = require("express");
const {makeIvr, makeCaller} = require("../ivr/ivr-core");  // or copy the file
initializeApp(); const db = getFirestore();
const app = express(); app.use(express.urlencoded({extended:false})); app.use(express.json());
const ivr = makeIvr({db}); app.post("/voice", ivr.handleVoice);
exports.ivr = onRequest(app);
```
and the reminder call becomes a Firestore trigger on `bookings` status →
`in-gate` instead of the app calling `/notify-next`. Set `IVR_BASE_URL` to
the function URL. Everything else stays.
