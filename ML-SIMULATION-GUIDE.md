# AgroBridge — Capacity-engine ML: how to run the season simulation and SEE it learn

Everything below is done from your project folder (`~/projects/AGROBRIDGE`) and the web app.
Accounts: admin **9000000005**, gate **9000000001**, weighbridge **9000000003**, farmers **9100000001–09**, OTP **1234**.

---

## 0. What the three models are, in one line each

| Model | Question it answers | Method | Where you SEE it |
|---|---|---|---|
| **A** | "Farmer says 60 q — how much will really arrive?" | Bayesian shrinkage: blend *this farmer's* past actual/declared ratio with the *crowd's* ratio; the more visits he has, the more we trust him | Farmer's slot screen reserves e.g. 75 q for Balwant's "60"; admin **Model health → engine error vs declared error** |
| **B** | "How many quintals does this yard REALLY clear at 1 PM?" | EWMA per hour-of-day, learned from weighbridge timestamps, **only from hours that ran over** (see §5) | Admin **Capacity engine → Learned q/h** bars + **Use learned** switch; hour board `*` marks |
| **C** | "Will this booking show up?" | Logistic regression (7 features) | Admin **Model health → predicted vs real show %**; booking audit `engine.pShow` |

---

## 1. Erase ALL ML history (clean slate)

```bash
cd ~/projects/AGROBRIDGE
node simulate.js --reset
```
Deletes every booking + queue document of Gurugram Grain Market and the centre's learned memory (`centre.engine`). Other mandis untouched. Test accounts untouched.

---

## 2. Play a 10-day season into the database

```bash
node simulate.js --reset --days 10
```
(~1 minute.) What it does, day by day, using **the same `engine/` files the app bundles**:

1. ~150 farmers (your 9 test farmers + 140 anonymous) try to book. The planner (`engine/capacity.js`) accepts/rejects exactly as the app would, with Models A and C applied.
2. The "real" mandi day is then played with a **hidden truth the models never see**: the weighbridge is slow at 8 AM (600 q/h), drops at lunch (520 q/h), fades after 4 PM — while the admin believes a flat **800 q/h**. Farmers have hidden personalities (Balwant always brings +25 %, Jagdish misses half his slots…).
3. Weighbridge results and no-shows are written as normal `paid` / `no-show` bookings.
4. Days 1–5 run on the flat admin number. From day 6 the simulated admin switches **Use learned ON** — so the report shows before/after.

**Today's date is left empty** so your live demo starts clean.

You get `sim-report.txt`. The important lines look like this (real run):

```
BEFORE learning (flat 800)   vs   AFTER "Use learned":
  farmers finishing late:   11.6%  ->  1%
  quintals left after 6 PM: 146 q  ->  0 q
  1 PM hour booked at:      800 q/h -> 510 q/h   (truth 520)

Model B learned per hour:  08:00 639 (truth 600)  13:00 515 (520)  17:00 492 (520)  10–12: "-" (never proven busy → keeps 800)
Model A: Balwant truth ×1.25 learned ×1.25 · Harpal ×1.30 → ×1.28 · Sarita ×0.85 → ×0.87
Model A error: declared-only 9% → engine 3.4%
```

Try `node simulate.js --dry --days 10` to only print the report without writing anything, or `--learn-from 3` to switch learning on earlier.

---

## 3. See it in the app — click-through

**A. Admin retrains (Model A + B + C on this mandi's own data)**
1. Log in as **9000000005** → home → **Capacity engine**.
2. Section *Model health*: "Engine error" says *need data*; press **Retrain from history**.
3. After ~5 s: **Learned q/h** shows a bar per hour (blue = learned, grey `*` = not proven yet, keeps your set number); *Model health* fills in: **declared error ≈ 9 % vs engine error ≈ 3–4 %**, **predicted show ≈ 78 % vs real ≈ 78 %**.
4. Tap **Model card** to expand: Model A `k`, wheat prior ≈ 1.05; Model B `α` and MAE; Model C weights — all now say *trained on: this mandi*.

**B. The "Use learned" switch (Model B)**
1. Still in *Today's capacity*: the big number is your set **800**. Flip **Use learned** ON.
2. Home → **Hour-by-hour board**: every hour's q/h now shows the learned value with a `*` (13:00 ≈ 515, 08:00 ≈ 640…); hours with no proof stay 800.
3. Log in as farmer **9100000005** (Ramesh, 120 q) → book wheat today → the 1 PM slot now offers fewer quintals of room / needs 1+3 sooner than 10 AM. Flip the switch OFF → refresh farmer → 1 PM is as roomy as 10 AM again. **That is Model B changing what farmers are sold.**

**C. Model A on a real farmer**
1. Farmer **9100000001** (Balwant, habitually +25 %) → book wheat, declare **60 q**.
2. Open the pass; admin → Hour-by-hour board: that hour's *reserved* quintals rose by ≈ **75**, not 60 (60 × 1.25). Farmer **9100000003** (Sarita, −15 %) declaring 60 reserves ≈ 52.
3. Now weigh Balwant as weighbridge officer: record ≈ 74 q. His pass shows the polite over-declared note; his next booking will be corrected even more confidently (visits 9 → trust him over the crowd).

**D. Model C**
- Farmer **9100000004** (Jagdish, 7 no-shows of 9): his booking's `engine.pShow` ≈ 0.45 — his hour reserves only ~half his expected minutes, so the hour can take one extra small load into the buffer. Never past the buffer, never touching confirmed bookings.

**E. Reset in the app**: Capacity engine → **Reset learning** (forgets learned q/h and local retrain only; bookings stay). Full wipe: `node simulate.js --reset`.

---

## 4. How practical are A and B? (honest talking points for judges)

**Model A — practical, low-risk**
- Uses data the mandi already records (declared at booking, weighbridge actual). Zero extra work for anyone.
- Shrinkage means a farmer with 1 fluke visit is *not* punished; with 5+ visits his own ratio dominates. `k` is learned (0.5 in the sim → crowd is diverse, trust the individual quickly).
- Effect: reservation error drops from ~9 % (trusting declarations) to ~3–4 %. Over a 7,000 q day that is ~350 q of mis-planned labour → roughly one hour of the yard.
- Limits: needs ≥30 pairs before local params replace the shipped prior (`engineInputs` threshold); new farmers get the crowd ratio; can be gamed only by consistently mis-declaring, which then just becomes his known ratio.

**Model B — practical, but only with the censoring rule**
- First version averaged *all* hours and collapsed (learned 198 q/h for an hour that clears 600) because a quiet hour reveals demand, not capacity → booked less → saw less → death spiral. **Fixed:** an hour is a capacity sample only if it ran over (a farmer booked for it was weighed after it ended). Quiet hours can only *raise* the estimate.
- Result: 1 PM learned 515 vs truth 520; late finishes 11.6 % → 1 %; no work left after closing.
- Needs the weighbridge to actually be the bottleneck and timestamps to be honest (they are — the app stamps `weighedAt`). Hours never proven busy keep the admin number — the admin stays in control (switch).
- On the server: same file, run nightly; the "Retrain" button becomes a cron job.

**Model C** — trained on synthetic data until real no-show history exists; say so openly. It is deliberately capped: overbooking only into the 15 % buffer.

---

## 5. Where the code lives (for the architecture slide)

```
engine/capacity.js            planner (pure)          ← simulate.js and the app both import it
engine/models/correction.js   Model A  (+ trainCorrection)
engine/models/throughput.js   Model B  (+ censoring rule, install50)
engine/models/noshow.js       Model C  (+ trainNoShow in JS)
services/bookings.js          local adapter: Firestore ⇄ engine (retrainFromHistory, fetchEngineInsights)
screens/officer/EngineScreen  admin UI (switches, retrain, model card)
screens/officer/HourBoardScreen  per-hour board
simulate.js                   season generator / evaluator (Node, no app)
```
