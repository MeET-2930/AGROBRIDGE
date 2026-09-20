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

---

## 6. install51 — bad-day guard and the Azadpur benchmark

### The problem you raised
A yard doing 400 q/h has a breakdown and does 200 q/h for three hours, one day only. That day must not drag Model B down.

### Two protections (both in `engine/models/throughput.js`)
1. **Reported delay → day excluded.** When the admin uses **Report delay** (any minutes > 0), today's date is added to `centre.engineExcludeDates`. Model B skips those days entirely (Retrain and the Engine screen both pass the list).
2. **Automatic outlier guard.** For an hour with ≥4 busy days, any reading below **60 % of that hour's median** is treated as an incident and skipped, and counted under "outliers skipped". So even an *unreported* breakdown cannot lower the estimate.
Plus the old rule: quiet hours can only raise an estimate, never lower it.

### Testing it
```bash
node simulate.js --dry --days 14 --learn-from 5 --incident 4,9
```
Day 4 breaks (capacity halves 10:00–13:00) **and is reported**; day 9 breaks and is **not reported**. In the report: day 4/9 rows show "BREAKDOWN", late % spikes that day, but the 13:00 learned value on day 10 does **not** drop, and the guard line says "1 day excluded, N observations auto-skipped".

In the app: admin → **Report delay** (e.g. 60 min, "weighbridge fault") → Capacity engine → Retrain. That date is now ignored by Model B. (Admin → Reset learning does not clear the date list; it is data, not learning.)

### Azadpur benchmark — are we at real scale?
Public figures for Azadpur APMC: 12–15 k tonnes/day, 1,000+ trucks, trading midnight–noon, 22 auction sheds. AgroBridge runs one *centre per shed* (as it runs one per mandi), so the benchmark simulates **one shed: ~6,000 q/day, 60–90 trucks of 35–200 q, 00:00–12:00**, with a hidden curve (gate jam till 1 AM, peak 3–7 AM, dead after 10).
```bash
node simulate.js --dry --mandi azadpur --days 14 --learn-from 5 --incident 6 --seed 5
```
Result (3 seeds): late finishes **31–35 % → 10–17 %**, leftover after close **400–490 q → 45–75 q**, 11:00 learned 263–308 vs truth 260. Model A error ~3–4 % vs ~9 % declared, same as Gurugram.

**Honest reading:** it works at that scale, and it does *not* reach ~1 % late like Gurugram. Why: Azadpur loads are 200 q trucks against a 260–760 q/h curve that swings 3× within the session, so a single truck spilling over costs 20–40 min; and 15 % buffer is thin for that variance. Two things would close the gap and are worth saying to judges: a **per-hour buffer** (bigger where Model B's MAE is bigger) and **arrival-time check-in** (the on-my-way feature) so the planner knows who is actually coming. Neither is built yet.

What the benchmark does **not** prove: real Azadpur numbers per hour (mine are assumptions shaped from public descriptions), multi-shed interaction, and gate congestion outside the yard. Say "calibrated to public Azadpur scale, not to Azadpur data".

### Simulator realism fix in this build
The mandi day is now one continuous clock: a truck spilling from 12:50 into 13:10 is weighed at 13:00's slower rate, and every farmer is served strictly in booked-hour order. Before-learning numbers are therefore worse (more honest) than the install50 report showed.

## 7. install52 — the YARD: floor, bags, labour (root causes R6 + R7)

### Why
The weighbridge is not the only limit — the **floor** is. Every weighed quintal lies in bags on the floor until a lifting truck removes it. When lifting stalls (Karnal 2021: 78 % unlifted, gate passes stopped 24 h; Haryana 2025: 45 % lifted statewide) the yard fills and unloading physically stops, however fast the weighbridge is. No state system counts the floor: e-Kharid keeps issuing quota passes until an officer shuts the gate and farmers find out at the gate.

### What the engine does now (`engine/yard.js`, pure)
* `centre.yard = { floorCapacityQ, floorUsedQ, bagsInStock, labourTeams, labourTeamsNormal, liftedHistory[], incident{} }`
* **+ every weighing** adds to `floorUsedQ` automatically. **− "Record lifting"** (admin types quintals that left) lowers it.
* `floorProjection()` runs the arithmetic forward day by day: `floor_tomorrow = floor_today + booked_intake − expected_lifting` (lifting = average of your last "Record lifting" entries; none → a normal day's intake is assumed, so the floor only bites when it is *already* high).
* Result per day: a **factor 0..1** — up to 60 % floor = 1 (normal), 60–85 % shrinks linearly, ≥ 85 % = 0 (no new slots). `scaleCapacity()` multiplies the hour's bookable minutes by it. Labour: `q/h × teams/normal`. Bags: today's cap = bags × 0.5 q.
* The slot screen, `createBooking`, gate re-book and "next date with room" all use the same scaled capacity, so what the farmer sees is what the transaction enforces.

### Yard incident (≥ 85 % floor, or no bags) — the farmer decides
* Declared automatically from the arithmetic (admin can clear it), or by the admin on **Report delay → "Yard full / lifting stopped"** or on the Engine screen.
* Every farmer with a pass **today** gets a notification. His pass shows an amber box: floor %, an **honest wait range** (or "unloading stopped — no estimate"), and two buttons: **I'll wait** (pass unchanged) or **Cancel & re-book** (cancelled with `yardIncidentCancel: true` — bypasses the 48 h rule, **not** a no-show, ignored by Model C and farmer history — then straight to the slot list, which is already thinned by the projection).
* Nothing is moved, nothing is guaranteed, nobody is penalised. The incident day is excluded from Model B (install51 guard).

### Admin click-through
Admin **9000000005 → Capacity engine → "Yard status"** card: floor % bar with 60 / 85 marks, four typed fields (floor capacity, on floor now, bags, labour today/normal) → **Save yard numbers**; "Lifted today" → **Record lifting**; the 7-day projection table (floor at start · booked · lift · slots open %); the incident box with **Declare yard full / Yard back to normal**.

### Testing it
```bash
node simulate.js --dry --days 12 --learn-from 4 --lifting-crisis 5,8 --seed 7            # yard model ON
node simulate.js --dry --days 12 --learn-from 4 --lifting-crisis 5,8 --seed 7 --no-yard  # blind baseline
```
Days 5–8 lifting trucks run at 15 %. Seed 7 result:

| | yard model ON | blind baseline (today's e-Kharid) |
|---|---|---|
| farmers who drove in and could not unload | **0** | **121** (days 6–8) |
| farmers told in advance, re-booked free | 66 | 0 |
| peak floor | 95 % | 100 % for 3 days |
| slots offered on day 7 | 0 (incident, announced) | 98 passes issued, 59 stranded |

Honest caveats: the engine cannot create floor space — if lifting stops for a week the yard is shut either way; it only makes that **orderly and announced days ahead**. The 60 % cancel rate on incident days is an assumption (depends on farmers reading the notice → SMS, install55). Floor capacity in quintals is one number the admin sets once.

## 8. install53 — SPARE capacity: walk-in "Now" and cross-centre transfer

### Why
Every safeguard (Model B buffer, floor projection, share cap, incident closures) makes the engine **offer less** — right for promises made days ahead, but it leaves room on the table: big no-shows, a floor projection that turned out pessimistic (trucks came overnight), a fast labour day. Spare is that room, discovered **on the day**, never booked in advance and never promised — so a wrong forecast costs nothing.

### Arithmetic (`engine/spare.js`, pure)
Per hour: `spare = fullMinutes − arrivedMinutes − (bookedNotArrived × P(still coming))`. P decays as the hour ages (35 min in ≈ 50 %, 50 min ≈ 10 %); a pass expires at H+60 anyway (install49). Spare from a closed hour is gone — time can't be stored.

### Who uses it, in order
1. Farmers already inside (nothing to do — they're there).
2. **Walk-ins at the gate**: *Book at gate* now returns a **"Send in NOW"** pass when the current hour has spare ≥ the load and fewer than 3 vehicles wait at the gate. Flag `walkIn`, `spareUsed`.
3. **Cross-centre transfers**: when a farmer's own mandi is thin today (yard incident re-book, or nothing fits today), the slot screen lists nearby mandis in the same `clusterId` that publish spare. He takes a **90-minute transfer pass** (`transferFrom`, `transferValidUntil`); it sits in the gate's green block while valid; if he doesn't arrive it expires as `cancelled/transferExpired` — never a no-show.

A centre publishes at most `maxTransferSharePercent` (default 30 %) of its spare, only when it has ≥ 20 min, no gate queue, and its own yard is below the hard line. Tomorrow's planned capacity is never given away.

### Admin click-through
Capacity engine → **"Spare room right now"** card: spare this hour / later, utilisation, per-hour table (booked · arrived · still expected · spare), what is published to other mandis and why not, the *Accept transfers* switch and the share %.

### Honest notes
Spare depends on `arrived` being stamped at gate scan — it is. Transfers assume the state allows selling at another mandi in the district (Haryana did during COVID; e-Kharid passes are otherwise mandi-bound — an integration point, not a technical limit). All seeded centres share the default cluster, so the demo works out of the box.

## 9. install55 — The real yard: stage chain, government rails (mock), calendar, sheds, arhtiya, SMS text

### Why
Everything up to install54 modelled the mandi as *gate → assay → weigh → pay*. A real procurement centre in Haryana/Punjab/MP is: MFMB/Anaaj-Kharid registration → schedule → gate (pass + plate + who came) → heap at a shed / arhtiya's dhera → inspector rounds (FAQ moisture wheat 12 / paddy 17 / mustard 8) → acceptance at MSP → bagging → weighing (I-form) → J-form → lifting (48–72 h) → DBT credited (held until lifted). Farmers wait longest in the steps we did not model — heap-to-assay and J-form-to-money. install55 records those steps and the state-system identifiers **without creating any government record or moving money**.

### What changed
| Area | Detail |
|---|---|
| Stage chain | `stageOf(booking)`: `booked → in-gate → [heaped] → assay → accepted → [bagged] → weighing → j-form → lifted → credited`; optional steps are flags (`heapedAt/shedId`, `baggedAt/bags`, `liftedAt`, `creditedAt`) so queue accounting on `status` is untouched. `rejected` carries `rejectReason ∈ {moisture, foreignMatter, quality, eligibility}` and the farmer's notice says *what to fix*. |
| Government rail adapter | `services/govRail.js` — mock today (`RAIL_MODE='demo'`, labelled DEMO everywhere, deterministic fake data). `getFarmerRecord(regNo)` (MFMB/Anaaj/e-Uparjan), `wrapInstrument()` (e-NAM gate/assay/weighment ids with `source:'manual'`), `getJFormStatus()`, `transferAllowed()`. Booking fields: `farmerRegNo, regSource, nomineeUsed, presentedBy, enamGateEntryId, enamAssayId, enamWeighmentId, shedId, bags, jformNo, jformAt, utr, liftedAt, creditedAt`. |
| Calendar | `closedDays` (default Sunday), `holidays[]`, `hoursOverride{date:{start,end}}` on the centre. `fetchCentreSlots` returns `closedDay` and no slots; `createBooking` throws `err.dayClosed`. Admin: Officer → *Yard setup*. |
| Sheds | `sheds[{id,name,floorCapacityQ}]` + `shedUsedQ{}`; `markHeaped` adds, reject/lift subtracts. Arhtiya's shed pre-fills. |
| R8 area ceiling | `areaCeilingQuintals = acres × yield(q/acre) × 1.2`; admin-editable `yieldTable`. **Warning only, never a block** (`ceilingWarned` stored for the inspector). |
| Pre-arrival | Per-crop checklist on the pass; evening-before local reminder (`scheduleAt`, 19:00 day-1, best-effort); *"grain still wet"* → `cancelWet` (free, no 48-h rule, no no-show). |
| Nominees | Up to 3 on the farmer profile; chosen at booking; gate taps who presented. |
| SMS | `smsText(item, lang)` ≤ 160 chars for every farmer notification → `smsOutbox` doc `status:'queued (no gateway)'`; admin *SMS outbox* screen shows length per message. Measured: booking SMS 105 (en) – 126 (hi/pa) chars. |
| Arhtiya role | `role:'arhtiya'` (licence, firm, mandi, shed). Farmer links by phone; arhtiya dashboard mirrors the farmer layout; *Book for farmer* runs the **same planner** with `bookedVia:'arhtiya'`; per-arhtiya cap **25 % of the day's normal intake** (`queue.arhtiyaQ`). |
| Lifting | install52 `recordLifted(q)` now also marks the oldest paid lots `liftedAt` FIFO (`autoLiftOldest`); cashier can mark manually; *credited* typed with UTR. |

### What it deliberately does NOT do
No real API calls (adapter only), no assay-round-as-capacity, no walk-in demand model (Model D), no offline gate (install57), no telemetry (install56). The 25 % arhtiya share and the ×1.2 tolerance are policy defaults an admin can revisit.

### Test accounts
Officers 9000000001–05, farmers 9100000001–09 (01–03 linked to arhtiya 9200000001), **arhtiyas 9200000001–03**, OTP 1234. `node demo.js --users` re-seeds them and gives Gurugram three sheds + Sunday off + 2 Oct holiday.

## 10. install56 — Offline gate (57), stage telemetry + public board (56), arhtiya bulk booking (58)

**Why together:** all three are "the day is already running" features; none changes the capacity model.

### 10.1 Offline gate — `services/offlineGate.js`
Root cause: the e-Kharid outage of 15 Apr 2026 (3–4 h queues, manual passes). Our gate must keep working with no internet.
- Every time the gate list loads, the day's slim rows (token, code, name, hour, quantity, status) are cached in the phone (`AsyncStorage`, key per centre + date).
- Admission write is wrapped in `withTimeout(8 s)`. If it fails or times out the entry is **queued locally** with the real clock time and a *provisional lane* (least-loaded lane in the cached list). The farmer walks in immediately.
- Banner on the gate list: "No internet – gate running offline (list saved at HH:MM)", count of pending entries, **Send now** button.
- `syncPending()` replays entries in order, passing the original time to `markGateEntry(..., at)`, so the hour check ("was he inside his booked hour?") is evaluated against the moment he *actually* arrived, not the moment the internet came back. Entries the server rejects (pass expired, already inside, duplicate plate) are listed as **conflicts** for information — the farmer is already inside, nothing is rolled back.
- No names or lists leave the phone; the cache is the same data the officer already sees.

### 10.2 Stage telemetry — `engine/telemetry.js` (pure), admin screen `Telemetry`
Every officer action already writes a timestamp (`gateEntryAt, assayedAt, pricedAt, weighedAt, paidAt, liftedAt, creditedAt`). The engine turns these into, per stage: lots waiting now, oldest wait, median and p90 dwell today. Bottleneck = among assay / price / weigh / pay, the stage with the highest *load* = waiting × √(today's median ÷ normal median), capped at 4×. (Square-root so one slow lot does not flip the answer; tested in `/tmp/tt.mjs`.) The admin screen says it in one sentence plus a suggested action.

### 10.3 Public board — `screens/common/PublicBoardScreen.js`, link on Welcome
No login. Traffic light (green normal / amber slow: door-to-pay > 120 min or floor > 90 % / red closed or incident), four numbers (inside, gate→pay, paid today, floor), advice for farmers, stage list. **Never shows names, tokens or "now serving"** — consistent with the farmer-side rule. Refreshes every 60 s. `publicBoard()` in the engine is the single place that decides what is public.

### 10.4 Arhtiya bulk — `bulkBookForFarmers()` + `screens/arhtiya/BulkBookScreen.js`
The arhtiya ticks farmers, types quintals, picks a day. Each farmer is booked through the **normal `createBooking`** (transaction, 2-token cap, 25 % arhtiya share, calendar, yard factor, no-show model), filled from the first hour with room. Result list says who got which hour and why anyone did not. Below: his day plan grouped by hour so he can tell each farmer when to come. Nothing is moved and no future slot is promised — same rules as everywhere else.

### 10.5 Test walk-through
1. Officer 9000000001 (admin) → Tools → **Where is today stuck?**; run `demo.js` first so there are timestamps.
2. Welcome screen → link at the bottom **Without login: see how the mandi is today**.
3. Officer gate duty → open gate list once online → switch off Wi-Fi/phone data → scan/enter a code → "Admitted (offline)" → switch data on → banner → **Send now**.
4. Arhtiya 9200000001 → tile **Book many farmers at once** → tick 3 farmers → Make passes.

## 11. install57 — Gate-conflict tab for the admin (57a) + "next open day" for bulk leftovers (58b)
- On sync, every rejected offline entry is written to `centres/{id}/gateConflicts/{entryId}` (`reportGateConflict`). Admin → Reports → **Gate conflicts** tab lists them with time, plates, lane, reason; **Reviewed** marks them resolved. The farmer is never removed — it is a review list.
- Bulk screen: after a bulk result with leftovers, **Try the next open day for the N left** runs `bulkBookNextOpenDay` — walks the following open days (max 7), normal `bulkBookForFarmers` each day, whoever fits is booked there. Still no promise; anyone left after 7 days is shown as such.
