# When college funds Blaze – what to switch on (no APK rebuild needed)

All four items are server-side or JS-only. After each, run `eas update --branch preview --message "..."` and testers get it on next app open.

## 1. Enable billing (5 min)
Firebase console → gear → Usage and billing → Modify plan → Blaze → add card. Set a **budget alert at ₹500**.

## 2. Real SMS OTP (30 min, ~₹0.5/SMS after 10 free per day)
- Console → Authentication → Sign-in method → **Phone** → Enable. Add your testers' numbers under "Phone numbers for testing" with a fixed code so demo never costs SMS.
- Ask me for `installNN` "phone auth": it replaces the 1234 check in `screens/auth/OtpScreen.js` and `services/auth.js` with `signInWithPhoneNumber` + reCAPTCHA (web) / Play Integrity (Android – needs SHA-256 of the EAS keystore added in Firebase → Project settings → Your apps; get it with `eas credentials -p android`).

## 3. IVR on a real number (1–2 h)
- Deploy `ivr/` to Render (free tier, `ivr/render.yaml` is ready) → you get `https://<name>.onrender.com`.
- Twilio trial: buy a US number, set Voice webhook to `https://<name>.onrender.com/voice`. Trial can only call/receive from numbers you verify – verify the team's phones.
- Put the Render URL + Twilio SID/token in `ivr/.env` (see `ivr/README.md`).
- Reminder calls ("your token is 3 away") need a Cloud Function on a 5-minute schedule – ask me for it once IVR works manually.

## 4. Slot reminders by SMS
Same Cloud Function as above; sends SMS at 19:00 the day before and 60 min before the slot. Push notifications already do this for smartphone users.

## Not needed for Blaze
- Push notifications (already live, free).
- Security rules deploy: `firebase deploy --only firestore:rules` after switching Mode A → Mode B in `firestore.rules`. **Do this only after internals.**
