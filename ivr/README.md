# AGROBRIDGE phone service (IVR) – setup without a credit card

Farmers with a basic phone book a slot by **call**; the app/website can also
**ring the farmer** ("Book by phone call" card), and the service **calls the
next farmer** automatically when the gate officer admits a vehicle.

Runs on **Render.com free tier** now. Same code runs as a Firebase Cloud
Function once you have Blaze (see "Moving to Blaze" at the bottom).

---------------------------------------------------------------------------
## 0. What you need (all free, no card)
- Render.com account (sign in with GitHub)
- **Plivo** account – $10 free credit, no card, gives you a phone number
  (Twilio's 2026 trial no longer hands out a number without upgrading;
  the server still supports Twilio via `PROVIDER=twilio` if you ever
  upgrade there.)
- A Firebase **service-account key** (lets the server write Firestore)

## 1. Firebase service-account key  (2 min)
Firebase console → ⚙️ Project settings → **Service accounts** →
**Generate new private key** → a JSON file downloads.
```bash
base64 -w0 ~/Downloads/agrobridge-sih26-*.json > /tmp/sa.b64
cat /tmp/sa.b64        # copy this whole long string
```
Never commit the JSON. `ivr/.gitignore` already blocks it.

## 2. Plivo  (10 min)
1. https://console.plivo.com/accounts/register/ → sign up with your Gmail →
   verify email → verify your mobile (SMS OTP). Your mobile is now a
   *verified caller ID* (trial can only call verified numbers).
2. Console home → top-right shows **Auth ID** (`MA…`) and **Auth Token**
   (eye icon). Note both.
3. Rent a number: left menu **Phone Numbers → Buy Numbers** → Country
   **United States** → tick **Voice** → Search → **Buy** on any number
   (~$0.50/month from the free credit). It appears under *Your Numbers*
   as `+1…` → this is `PLIVO_FROM`.
   (Indian numbers need KYC + paid plan – later, same code.)
4. Verify teammates: **Phone Numbers → Verified Caller IDs → Add** → their
   +91 number → OTP. Do every phone you will test/demo with.
5. Create the answer application: **Voice → Applications → Add New Application**
   - Name: `agrobridge-ivr`
   - **Answer URL**: `https://agrobridge-ivr.onrender.com/voice?step=missedcall`
     Method **POST**
   - Hangup URL: leave empty → **Create**
6. Attach it to the number: **Phone Numbers → Your Numbers** → click the
   number → *Application Type* **XML Application** → *Plivo Application*
   `agrobridge-ivr` → **Update**.

   Answer-URL modes (pick one):
   - `/voice?step=missedcall` → farmer's call is cut (free for him), we
     ring back in 3 s and run the IVR. **Recommended.**
   - `/voice`                 → his call is answered directly (he pays airtime).

## 3. Push the code
```bash
cd ~/projects/AGROBRIDGE
git add -A && git commit -m "install16: phone service" && git push
```

## 4. Create the Render service  (5 min)
1. https://dashboard.render.com → **New +** → **Web Service** → connect
   `MeET-2930/AGROBRIDGE` (Only select repositories → AGROBRIDGE).
2. Settings: Name `agrobridge-ivr` · Root Directory `ivr` ·
   Build `npm install` · Start `npm start` · Instance **Free** ($0).
3. **Environment variables**:

   | Key | Value |
   |---|---|
   | `BASE_URL` | `https://agrobridge-ivr.onrender.com` |
   | `FIREBASE_SERVICE_ACCOUNT_B64` | the long string from step 1 |
   | `PROVIDER` | `plivo` |
   | `PLIVO_AUTH_ID` | `MA…` |
   | `PLIVO_AUTH_TOKEN` | the token |
   | `PLIVO_FROM` | `+1…` your rented number |
   | `APP_SHARED_KEY` | `agb-demo-2026` (= `IVR_APP_KEY` in `services/config.js`) |

4. **Deploy web service** → ~2 min → log shows
   `telephony provider: plivo (outbound enabled)` and `IVR listening`.
5. If Render gave a different URL, put it in Render `BASE_URL`, Plivo's
   Answer URL, and `IVR_BASE_URL` in `services/config.js`.
6. Open the URL → `AGROBRIDGE IVR up (plivo)`.

## 5. Trial rules
- Only **verified caller IDs** can call in / be called. Add them (step 2.4).
- $10 credit: India calls ≈ ₹0.6–1/min → 600+ minutes. Plenty.
- No "trial account" announcement on Plivo calls.

## 6. Keep it awake during demo hours
Free Render sleeps after 15 min idle; first call would take ~30 s.
https://uptimerobot.com (free) → New monitor → HTTP → URL
`https://agrobridge-ivr.onrender.com/health` → every 5 min.
(The app also pings /health when a farmer opens the call dialog.)

## 7. Test
- Verified phone → dial the Plivo number → it cuts → rings back in ~5 s →
  press 2 for Hindi → 1 to book → … → token spoken → on dashboard instantly.
- Farmer app → **Book by phone call** → phone rings → press 2 for Hindi →
  1 to book → … → token spoken → it appears on the dashboard instantly.
- Book a 2nd farmer; officer does **Gate entry** for the 1st → 2nd farmer's
  phone rings: "your token is next".
- Press 2 in the menu → hears token, tokens ahead, current token.

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
