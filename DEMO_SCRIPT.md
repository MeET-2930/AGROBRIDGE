# AGROBRIDGE – 6-minute demo script (SIH internals)

Setup: **1 Android phone** with the AgroBridge APK + **1 laptop** with the website open in Chrome.
Phone = the farmer (he must receive notifications with the app closed). Laptop = mandi officers and trader.
Do a full dry run the evening before. Every step lists what the judge should see.

## 0. Before you walk in (5 min)
```
cd ~/projects/AGROBRIDGE
node resetTestData.js          # wipes bookings/queues/auctions/notifications, keeps users + mandis
```
- Phone: open app → log in as the **farmer** (test farmer account, OTP 1234) → language Hindi or English as you prefer → tap your name → Notifications → then press Home. Do NOT force-close yet.
- Laptop tab 1: log in as **Gate officer** (Gurugram Basai). Tab 2 (incognito): **Assay officer**. Tab 3 (another profile/incognito): **Trader 1**. Log in now so you never type during the demo.
- Phone battery > 50 %, volume up, Do-Not-Disturb off, Wi-Fi/4G on.

## 1. The problem (30 s) – say it, don't show it
"Farmers wait 6–14 hours in unmanaged mandi queues. eNAM digitised the auction, not the gate. AgroBridge gives every farmer a timed token and tells them when to come – even without a smartphone, by phone call."

## 2. Farmer books (60 s) – PHONE
Home → **Book slot** → Crop: Wheat → Mandi: Gurugram Basai → Quantity 20 → Date: **Today** → pick an open time window → Confirm.
Judge sees: token number + gate-pass QR. Point at "tokens ahead of you: 0".
Say: "This is a Firestore transaction – two farmers can't take the last place in a window."
**Now force-close the app** (Recents → swipe away). Say: "App is closed. Watch the phone."

## 3. Officer lets him in (45 s) – LAPTOP tab 1 (Gate)
Gate officer dashboard already shows **New token** with his name. Open **Today's queue** → his token → **Gate entry**.
Judge sees: **the phone rings/vibrates** with "Your turn – gate open" while the app is dead. (This is the moment. Pause.)
Say: "Pushed through Google's messaging – no server of ours, free tier."

## 4. Quality + price (60 s) – LAPTOP tab 2 (Assay), then PHONE
Assay officer → Stage queue → his token → moisture 11, grade **Grade A** → Save.
Phone (open the app now): token detail shows grade. Farmer chooses **Start auction** (or MSP – say "MSP is always the floor").
LAPTOP tab 3 (Trader): Auction board shows the lot → Bid ₹2,400 → Bid ₹2,450.
Phone: farmer sees bids live → **Accept bid**.

## 5. Weigh + pay (45 s) – LAPTOP tab 1 or 2 (any officer with weighbridge/cashier duty; admin has all)
Weighing → actual quantity 19.6 → Save. Mark paid → deductions → **Issue receipt**.
Phone: **Payments** shows receipt; **History** shows the completed token. Show the PDF receipt button.

## 6. Inclusion (30 s) – LAPTOP
Open the website `/sim` page: the IVR simulator. Press 1 for Hindi, book a slot by voice/keypad, hear the token number spoken.
Say: "Same booking function, same database. On a real number when we go live – provider account is the only missing piece."

## 7. Close (20 s)
"Four languages, offline-tolerant token, officer roles per counter, live auction with MSP floor, and a phone-call path for farmers without smartphones. All of it is running right now on the free tier."

## Likely judge questions
- **How is this different from eNAM?** eNAM starts inside the mandi (lot entry, e-auction). We start at the farmer's home: timed gate slot, live queue, and notifications. Our auction can plug into eNAM later; we don't replace it.
- **What stops two farmers booking the same slot?** Firestore transaction on the per-day queue document – the second one is rejected and shown the next free window.
- **Security – can a farmer edit another farmer's token?** Rules file is in the repo (firestore.rules, Mode B): farmers read/write only their own bookings, officers only at their posted mandi, nothing deletable. Kept open during evaluation so testers aren't blocked.
- **What if there's no network at the gate?** Gate pass QR is on the phone already; the officer's scan works from the token number typed by hand too.
- **Cost at scale?** Firestore + Expo push are free at this volume; SMS/IVR is the only per-use cost (~₹0.5/SMS, ~₹1/min call).
- **Mandi data is fake?** Yes, 5 seeded Haryana mandis; the document shape is frozen so the real APMC list is a one-time import.

## If something goes wrong
- Phone didn't ring in step 3: open the app – the notification is in the list anyway; say "the in-app list is the fallback" and move on.
- Slot window shows "no slots": today's windows already passed – pick tomorrow (booking still works; the queue will show tokens ahead as 0).
- Auction timer: it is 10 minutes; you don't need to wait – accept the highest bid whenever you like.
