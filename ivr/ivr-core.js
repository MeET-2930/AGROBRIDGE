/*
 * ivr/ivr-core.js
 * ---------------------------------------------------------------
 * AGROBRIDGE phone service (IVR) - platform independent core.
 *
 * Runs unchanged on:
 *   • Render.com free tier  (ivr/server.js)         <- now, no card
 *   Telephony: Plivo (default, $10 free, no card) or Twilio - env PROVIDER
 *   • Firebase Cloud Functions (functions/index.js) <- after Blaze
 *
 * Ported from functions/index.js (original IVR by the team) with:
 *   - inbound AND outbound calls (caller = From or To)
 *   - status lookup on menu option 2
 *   - "your turn is next" reminder call
 *   - token number padding fix (A-01, not A-1)
 *   - Hindi prompts spoken by a Hindi voice
 *
 * Writes the SAME Firestore documents as services/bookings.js in
 * the app, so IVR bookings appear on the farmer dashboard and the
 * officer queue immediately.
 * ---------------------------------------------------------------
 */
const {FieldValue} = require("firebase-admin/firestore");

// ---------------------------------------------------------------
// PROVIDER LAYER - "sim" (default: browser phone at /sim, no telecom account),
// "plivo" or "twilio". "sim" speaks Twilio-style XML which the /sim page reads.
// Both speak almost the same XML; this tiny builder hides the gaps.
// ---------------------------------------------------------------
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function makeXml(provider) {
  const isPlivo = provider === "plivo";          // sim + twilio share the Twilio dialect
  class Node {
    constructor(tag, attrs = {}, text = null) { this.tag = tag; this.attrs = attrs; this.text = text; this.kids = []; }
    add(n) { this.kids.push(n); return n; }
    say(v, text) {
      return this.add(isPlivo ?
        new Node("Speak", {language: v.language, voice: "WOMAN"}, text) :
        new Node("Say", {voice: v.voice, language: v.language}, text));
    }
    toString() {
      const a = Object.entries(this.attrs).filter(([, x]) => x !== undefined && x !== null)
          .map(([k, x]) => ` ${k}="${esc(x)}"`).join("");
      if (this.text !== null) return `<${this.tag}${a}>${esc(this.text)}</${this.tag}>`;
      if (!this.kids.length) return `<${this.tag}${a}/>`;
      return `<${this.tag}${a}>${this.kids.map(String).join("")}</${this.tag}>`;
    }
  }
  class Response extends Node {
    constructor() { super("Response"); }
    /** digits menu */
    gather(action, {numDigits = 1, finishOnKey, timeout = 6} = {}) {
      return this.add(isPlivo ?
        new Node("GetDigits", {action, method: "POST", numDigits, finishOnKey, timeout, retries: 1, redirect: "true"}) :
        new Node("Gather", {input: "dtmf", action, method: "POST", numDigits, finishOnKey, timeout}));
    }
    /** speech capture */
    listen(action, language) {
      return this.add(isPlivo ?
        new Node("GetInput", {action, method: "POST", inputType: "speech", language, executionTimeout: 8}) :
        new Node("Gather", {input: "speech", action, method: "POST", language, speechTimeout: "auto"}));
    }
    /** missed-call: refuse the call so the farmer is not charged */
    reject() {
      return this.add(isPlivo ? new Node("Hangup", {reason: "busy"}) : new Node("Reject", {reason: "busy"}));
    }
    toString() { return `<?xml version="1.0" encoding="UTF-8"?>${super.toString()}`; }
  }
  Response.Node = Node;
  return {Response};
}

/** Normalise the webhook body of either provider into one shape. */
function readCall(req, provider) {
  const b = req.body || {};
  const dir = String(b.Direction || "");
  const outbound = dir.startsWith("outbound");
  return {
    from: b.From, to: b.To,
    farmerRaw: outbound ? b.To : b.From,
    digits: String(b.Digits || "").trim(),
    speech: String(provider === "plivo" ? b.Speech || "" : b.SpeechResult || "").trim(),
    callId: String(b.CallUUID || b.CallSid || ""),
  };
}

const CROP_LIST = [
  {id: "wheat", name: "गेहूँ (Wheat)", en: "Wheat", hi: "गेहूँ"},
  {id: "paddy", name: "धान (Paddy)", en: "Paddy", hi: "धान"},
  {id: "mustard", name: "सरसों (Mustard)", en: "Mustard", hi: "सरसों"},
  {id: "cotton", name: "कपास (Cotton)", en: "Cotton", hi: "कपास"},
  {id: "maize", name: "मक्का (Maize)", en: "Maize", hi: "मक्का"},
  {id: "gram", name: "चना (Gram)", en: "Gram", hi: "चना"},
];

const ACTIVE_STATUSES = ["booked", "in-gate", "assay", "price-fixed", "weighing", "payment-processing"];

const VOICE = {
  en: {voice: "Polly.Aditi", language: "en-IN"},
  hi: {voice: "Polly.Aditi", language: "hi-IN"},
};

// ---------------------------------------------------------------
// Prompts (en / hi)
// ---------------------------------------------------------------
const P = {
  en: {
    languageWelcome: "Welcome to AgroBridge. For English, press 1. For Hindi, press 2.",
    invalidLanguage: "Invalid selection. Please call again and press 1 for English or 2 for Hindi.",
    existingUser: (n) => `Welcome back to AgroBridge, ${n || "farmer"}.`,
    newUser: "We could not find your account. We will register you now.",
    askName: "Please tell us your name after the beep.",
    mainMenu: "Press 1 to book a mandi slot. Press 2 to hear your token status.",
    bookSelected: "You selected mandi slot booking.",
    selectMandi: "Please select your mandi.",
    selected: (n) => `You selected ${n}.`,
    selectCrop: "Please select the crop you are bringing.",
    selectDate: "Please select the day.",
    selectSlot: "Please select an available time slot.",
    selectQuantity: "Enter the approximate quantity in quintals, from 1 to 999, then press the hash key.",
    selectedQuantity: (q) => `You entered ${q} quintals.`,
    invalidQuantity: "Please enter a whole number from 1 to 999, then press the hash key.",
    confirmation: (m, c, d, s, q) => `You selected ${m}, ${c}, ${d}, ${s}, quantity ${q} quintals. Press 1 to confirm or 2 to cancel.`,
    bookingConfirmed: (t, tt) => `Your booking is confirmed. Your token number is ${spell(t)}. Your estimated turn is at ${tt}.`,
    gatePass: (c) => `Your gate pass code is ${spell(c)}. Please keep it safe. We will call you when your turn is near. Goodbye.`,
    bookingCancelled: "Your booking has been cancelled. Goodbye.",
    invalidChoice: "Sorry, that was not a valid option.",
    slotJustFilled: "Sorry, this slot was just filled. Please call again and choose another time.",
    noSlots: "Sorry, there are no available time slots for this date.",
    noMandis: "Sorry, no mandis are currently available. Goodbye.",
    noCrops: "Sorry, no crops are currently accepted at this mandi. Goodbye.",
    error: "Sorry, something went wrong. Please try again later.",
    pressFor: (i, n) => `Press ${i} for ${n}.`,
    noBooking: "You have no active booking. Press 1 to book a slot now.",
    status: (t, m, d, s) => `Your token is ${spell(t)} at ${m}, on ${d}, ${s} slot.`,
    ahead: (n, cur) => n === 0 ?
      `It is your turn now. Please go to the gate.` :
      `${n} ${n === 1 ? "token is" : "tokens are"} ahead of you. The gate is currently serving token ${cur ? spell(cur) : "none"}.`,
    inside: (st) => `Your vehicle is inside the mandi. Current stage: ${st}. Goodbye.`,
    reminder: (n, t, m) => `Namaste ${n || "farmer"}. This is AgroBridge. Your token ${spell(t)} at ${m} is next. Please bring your vehicle to the gate now. Thank you.`,
    stage: {"in-gate": "gate entry done, quality check next", "assay": "quality check done", "price-fixed": "price fixed, weighing next", "weighing": "weighing done, payment next", "payment-processing": "payment in progress"},
  },
  hi: {
    languageWelcome: "एग्रोब्रिज में आपका स्वागत है। अंग्रेज़ी के लिए 1 दबाएं। हिंदी के लिए 2 दबाएं।",
    invalidLanguage: "गलत विकल्प। कृपया दोबारा कॉल करें।",
    existingUser: (n) => `एग्रोब्रिज में आपका फिर से स्वागत है, ${n || "किसान"} जी।`,
    newUser: "हमें आपका खाता नहीं मिला। हम अभी आपका पंजीकरण करेंगे।",
    askName: "कृपया बीप के बाद अपना नाम बताएं।",
    mainMenu: "मंडी स्लॉट बुक करने के लिए 1 दबाएं। अपने टोकन की स्थिति सुनने के लिए 2 दबाएं।",
    bookSelected: "आपने मंडी स्लॉट बुकिंग चुनी है।",
    selectMandi: "कृपया अपनी मंडी चुनें।",
    selected: (n) => `आपने ${n} चुना है।`,
    selectCrop: "कृपया अपनी फसल चुनें।",
    selectDate: "कृपया दिन चुनें।",
    selectSlot: "कृपया उपलब्ध समय चुनें।",
    selectQuantity: "फसल की अनुमानित मात्रा क्विंटल में, 1 से 999 तक, दर्ज करें और फिर हैश दबाएं।",
    selectedQuantity: (q) => `आपने ${q} क्विंटल दर्ज किए हैं।`,
    invalidQuantity: "कृपया 1 से 999 तक पूरी संख्या दर्ज करें और फिर हैश दबाएं।",
    confirmation: (m, c, d, s, q) => `आपने ${m}, ${c}, ${d}, ${s}, और ${q} क्विंटल चुना है। पुष्टि के लिए 1 दबाएं, रद्द करने के लिए 2 दबाएं।`,
    bookingConfirmed: (t, tt) => `आपकी बुकिंग हो गई है। आपका टोकन नंबर ${spell(t)} है। आपकी अनुमानित बारी ${tt} पर है।`,
    gatePass: (c) => `आपका गेट पास कोड ${spell(c)} है। इसे संभालकर रखें। बारी आने पर हम आपको फ़ोन करेंगे। धन्यवाद।`,
    bookingCancelled: "आपकी बुकिंग रद्द कर दी गई है। धन्यवाद।",
    invalidChoice: "क्षमा करें, यह मान्य विकल्प नहीं है।",
    slotJustFilled: "क्षमा करें, यह स्लॉट अभी-अभी भर गया। कृपया दोबारा कॉल करके दूसरा समय चुनें।",
    noSlots: "क्षमा करें, इस दिन कोई समय उपलब्ध नहीं है।",
    noMandis: "क्षमा करें, अभी कोई मंडी उपलब्ध नहीं है।",
    noCrops: "क्षमा करें, इस मंडी में अभी कोई फसल स्वीकार नहीं हो रही।",
    error: "क्षमा करें, कुछ समस्या हो गई। कृपया बाद में प्रयास करें।",
    pressFor: (i, n) => `${n} के लिए ${i} दबाएं।`,
    noBooking: "आपकी कोई बुकिंग नहीं है। अभी बुक करने के लिए 1 दबाएं।",
    status: (t, m, d, s) => `आपका टोकन ${spell(t)} है, ${m} में, ${d}, ${s} के समय।`,
    ahead: (n, cur) => n === 0 ?
      `अब आपकी बारी है। कृपया गेट पर जाएं।` :
      `आपसे आगे ${n} टोकन हैं। गेट पर अभी टोकन ${cur ? spell(cur) : "कोई नहीं"} चल रहा है।`,
    inside: (st) => `आपका वाहन मंडी के अंदर है। वर्तमान चरण: ${st}। धन्यवाद।`,
    reminder: (n, t, m) => `नमस्ते ${n || "किसान"} जी। एग्रोब्रिज से बोल रहे हैं। ${m} में आपका टोकन ${spell(t)} अगला है। कृपया अभी अपना वाहन गेट पर लाएं। धन्यवाद।`,
    stage: {"in-gate": "गेट प्रवेश हो गया, अब गुणवत्ता जांच", "assay": "जांच हो गई", "price-fixed": "भाव तय, अब तौल", "weighing": "तौल हो गई, अब भुगतान", "payment-processing": "भुगतान चल रहा है"},
  },
};

/** "A-07" -> "A, 0, 7" so the voice reads each character. */
function spell(s) {
  return String(s || "").replace(/-/g, " ").split("").join(" ").replace(/\s+/g, " ").trim();
}

function normalizePhone(p) {
  return String(p || "").replace(/\D/g, "").slice(-10);
}


function formatHour(h) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ampm}`;
}

function tokenLabel(position) {
  const letter = String.fromCharCode(65 + Math.floor((position - 1) / 20));
  const num = String(((position - 1) % 20) + 1).padStart(2, "0");
  return `${letter}-${num}`;
}

function capacityPerWindow(c) {
  const per = Number(c?.avgMinutesPerEntry) || 15;
  const lanes = Number(c?.parallelLanes) || 1;
  return Math.max(1, Math.floor((60 / per) * lanes));
}

function centreName(c, lang) {
  return (lang === "en" && c.nameEn) || c.name || c.id;
}

function cropName(c, lang) {
  return lang === "hi" ? c.hi : c.en;
}

function getDateOptions(lang) {
  const ist = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  return [0, 1, 2, 3].map((d) => {
    const dt = new Date(ist); dt.setDate(dt.getDate() + d);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    let label = dt.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {weekday: "long", day: "numeric", month: "long"});
    if (d === 0) label = (lang === "hi" ? "आज, " : "Today, ") + label;
    if (d === 1) label = (lang === "hi" ? "कल, " : "Tomorrow, ") + label;
    return {value, label};
  });
}

// ---------------------------------------------------------------
// Firestore helpers (Admin SDK). `db` is injected.
// ---------------------------------------------------------------
function makeStore(db) {
  async function fetchCentres() {
    const snap = await db.collection("centres").get();
    return snap.docs.map((d) => ({id: d.id, ...d.data()}))
        .filter((c) => c.active !== false)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
  async function fetchCentreById(id) {
    if (!id) return null;
    const s = await db.collection("centres").doc(id).get();
    return s.exists ? {id: s.id, ...s.data()} : null;
  }
  async function fetchAvailableSlots(centre, dateStr) {
    const capacity = capacityPerWindow(centre);
    const q = await db.collection("centreQueues").doc(`${centre.id}__${dateStr}`).get();
    const counts = q.exists ? (q.data().slotCounts || {}) : {};
    const [sh] = String(centre.operatingStartTime || "08:00").split(":").map(Number);
    const [eh] = String(centre.operatingEndTime || "18:00").split(":").map(Number);
    const slots = [];
    const nowIst = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayStr = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, "0")}-${String(nowIst.getDate()).padStart(2, "0")}`;
    for (let h = sh; h < eh; h++) {
      if (dateStr === todayStr && h <= nowIst.getHours()) continue; // past windows today
      const slotTime = `${String(h).padStart(2, "0")}:00`;
      const booked = Number(counts[slotTime]) || 0;
      const avail = Math.max(0, capacity - booked);
      slots.push({slotTime, windowLabel: `${formatHour(h)} - ${formatHour(h + 1)}`, availableCapacity: avail, isFull: avail === 0});
    }
    return slots.filter((s) => !s.isFull);
  }
  async function activeBookingsFor(phone) {
    const snap = await db.collection("bookings").where("farmerId", "==", phone).get();
    const rows = snap.docs.map((d) => d.data()).filter((b) => ACTIVE_STATUSES.includes(b.status));
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows;
  }
  async function activeBookingFor(phone) {
    const rows = await activeBookingsFor(phone);
    return rows[0] || null;
  }
  async function queueFor(centreId, date) {
    const s = await db.collection("centreQueues").doc(`${centreId}__${date}`).get();
    return s.exists ? s.data() : null;
  }
  /** Next farmer to call after a gate entry: lowest open position not inside. */
  async function nextWaitingBooking(centreId, date) {
    const q = await queueFor(centreId, date);
    if (!q) return null;
    const inside = new Set(q.insidePositions || []);
    const open = (q.openPositions || []).filter((p) => !inside.has(p)).sort((a, b) => a - b);
    if (!open.length) return null;
    const snap = await db.collection("bookings")
        .where("centreId", "==", centreId).where("date", "==", date)
        .where("positionAssigned", "==", open[0]).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  }

  async function createBookingFromIvr({farmerId, farmerName, centre, crop, quantity, date, slot, callSid, lang}) {
    const capacity = capacityPerWindow(centre);
    const queueRef = db.collection("centreQueues").doc(`${centre.id}__${date}`);
    const idemRef = db.collection("ivrIdempotency").doc(callSid);
    const tokenId = `TKN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bookingRef = db.collection("bookings").doc(tokenId);
    const gatePassCode = String(Math.floor(100000 + Math.random() * 900000));

    return db.runTransaction(async (tx) => {
      const idem = await tx.get(idemRef);
      if (idem.exists && idem.data().bookingId) {
        const ex = await tx.get(db.collection("bookings").doc(idem.data().bookingId));
        if (ex.exists) return ex.data();
      }
      const qs = await tx.get(queueRef);
      const queue = qs.exists ? qs.data() : {
        centreId: centre.id, date, centreName: centre.name,
        avgMinutesPerEntry: Number(centre.avgMinutesPerEntry) || 15,
        parallelLanes: Number(centre.parallelLanes) || 1,
        nowServingPosition: null, nowServingToken: null, nowServingStatus: null,
        lastIssuedPosition: 0, totalBooked: 0, completedCount: 0,
        openPositions: [], insidePositions: [], slotCounts: {},
      };
      const slotCounts = {...(queue.slotCounts || {})};
      const used = Number(slotCounts[slot.slotTime]) || 0;
      if (used >= capacity) throw new Error("SLOT_FULL");

      const position = (Number(queue.lastIssuedPosition) || 0) + 1;
      slotCounts[slot.slotTime] = used + 1;
      const lanes = Number(centre.parallelLanes) || 1;
      const per = Number(centre.avgMinutesPerEntry) || 15;
      const [sh, sm] = slot.slotTime.split(":").map(Number);
      const turn = new Date(`${date}T${String(sh).padStart(2, "0")}:${String(sm || 0).padStart(2, "0")}:00+05:30`);
      turn.setMinutes(turn.getMinutes() + Math.round((used * per) / lanes));
      const estimatedTurnTime = turn.toLocaleTimeString("en-IN", {timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true});

      const record = {
        tokenId, tokenNumber: tokenLabel(position), positionAssigned: position,
        farmerId, farmerName: farmerName || "", farmerPhone: farmerId, vehicleNumber: "",
        approxQuantityQuintals: quantity,
        centreId: centre.id, centreName: centre.name, centreAddress: centre.address || "",
        crop: crop.id, cropName: crop.name, date, slotTime: slot.slotTime, slotWindow: slot.windowLabel,
        status: "booked", gatePassCode, gatePassQr: `AGB|${tokenId}|${gatePassCode}`, gatePassVerifiedBy: null,
        estimatedTurnTime, gateEntryAt: null, assayAt: null, weighedAt: null, paidAt: null,
        moisturePercent: null, foreignMatterPercent: null, grade: null, assayNotes: "",
        grossWeightQuintals: null, tareWeightQuintals: null, actualQuantity: null,
        priceMode: null, priceFixedAt: null, buyerId: null, buyerName: null, ratePerQuintal: null,
        grossAmount: null, mandiFee: null, commission: null, hamali: null, netPayable: null,
        receiptId: null, receiptGeneratedAt: null, paymentReference: null,
        delayOffsetMinutes: 0, delayReason: "", createdAt: new Date().toISOString(),
        source: "ivr", callSid, ivrLang: lang,
      };
      tx.set(bookingRef, record);
      tx.set(idemRef, {bookingId: tokenId, callSid, farmerId, createdAt: FieldValue.serverTimestamp()});
      tx.set(queueRef, {
        ...queue, centreId: centre.id, date, centreName: centre.name,
        avgMinutesPerEntry: per, parallelLanes: lanes,
        lastIssuedPosition: position, totalBooked: (Number(queue.totalBooked) || 0) + 1,
        openPositions: [...(queue.openPositions || []), position],
        insidePositions: queue.insidePositions || [], slotCounts,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      return record;
    });
  }

  return {fetchCentres, fetchCentreById, fetchAvailableSlots, activeBookingFor, activeBookingsFor, queueFor, nextWaitingBooking, createBookingFromIvr};
}

// ---------------------------------------------------------------
// The IVR state machine. Each step is a URL ?step=... (Twilio
// posts the pressed digits back to it).
// ---------------------------------------------------------------
function makeIvr({db, logger = console, provider = "sim", baseUrl = ""}) {
  const voiceUrl = `${String(baseUrl).replace(/\/$/, "")}/voice`;
  const store = makeStore(db);
  const {Response} = makeXml(provider);

  function qs(obj) {
    return Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }

  function say(node, lang, text) {
    node.say(VOICE[lang], text);
  }

  function gather(vr, lang, action, opts = {}) {
    return vr.gather(`${voiceUrl}?${action}`, opts);
  }

  function listen(vr, lang, action) {
    return vr.listen(`${voiceUrl}?${action}`, lang === "hi" ? "hi-IN" : "en-IN");
  }

  async function menu(vr, lang, name) {
    say(vr, lang, P[lang].existingUser(name));
    const g = gather(vr, lang, qs({step: "menu", lang}));
    say(g, lang, P[lang].mainMenu);
  }

  async function listMandis(vr, lang, prefixInvalid) {
    const centres = await store.fetchCentres();
    if (!centres.length) return say(vr, lang, P[lang].noMandis);
    const g = gather(vr, lang, qs({step: "mandi", lang}));
    if (prefixInvalid) say(g, lang, P[lang].invalidChoice);
    say(g, lang, P[lang].selectMandi);
    centres.slice(0, 9).forEach((c, i) => say(g, lang, P[lang].pressFor(i + 1, centreName(c, lang))));
  }

  function cropsOf(centre) {
    const ids = Array.isArray(centre.acceptedCrops) ? centre.acceptedCrops : [];
    return ids.map((id) => CROP_LIST.find((c) => c.id === id)).filter(Boolean);
  }

  async function listCrops(vr, lang, centre, prefixInvalid) {
    const crops = cropsOf(centre);
    if (!crops.length) return say(vr, lang, P[lang].noCrops);
    const g = gather(vr, lang, qs({step: "crop", lang, centreId: centre.id}));
    if (prefixInvalid) say(g, lang, P[lang].invalidChoice);
    say(g, lang, P[lang].selectCrop);
    crops.slice(0, 9).forEach((c, i) => say(g, lang, P[lang].pressFor(i + 1, cropName(c, lang))));
  }

  function listDates(vr, lang, ctx, prefixInvalid) {
    const g = gather(vr, lang, qs({step: "date", lang, ...ctx}));
    if (prefixInvalid) say(g, lang, P[lang].invalidChoice);
    say(g, lang, P[lang].selectDate);
    getDateOptions(lang).forEach((d, i) => say(g, lang, P[lang].pressFor(i + 1, d.label)));
  }

  async function listSlots(vr, lang, centre, ctx, prefixInvalid) {
    const slots = await store.fetchAvailableSlots(centre, ctx.date);
    if (!slots.length) {
      say(vr, lang, P[lang].noSlots);
      return listDates(vr, lang, {centreId: ctx.centreId, cropId: ctx.cropId});
    }
    const g = gather(vr, lang, qs({step: "slot", lang, ...ctx}));
    if (prefixInvalid) say(g, lang, P[lang].invalidChoice);
    say(g, lang, P[lang].selectSlot);
    slots.slice(0, 9).forEach((s, i) => say(g, lang, P[lang].pressFor(i + 1, s.windowLabel)));
  }

  function askQuantity(vr, lang, ctx, invalid) {
    const g = gather(vr, lang, qs({step: "qty", lang, ...ctx}), {numDigits: 3, finishOnKey: "#", timeout: 8});
    say(g, lang, invalid ? P[lang].invalidQuantity : P[lang].selectQuantity);
  }

  async function speakStatus(vr, lang, phone) {
    const b = await store.activeBookingFor(phone);
    if (!b) {
      const g = gather(vr, lang, qs({step: "menu", lang}));
      return say(g, lang, P[lang].noBooking);
    }
    // server runs in UTC: force IST when turning "2026-09-07" into "Monday, 7 September"
    const dateLabel = new Date(`${b.date}T12:00:00+05:30`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN",
        {weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata"});
    say(vr, lang, P[lang].status(b.tokenNumber, b.centreName, dateLabel, b.slotWindow));
    if (b.status !== "booked") return say(vr, lang, P[lang].inside(P[lang].stage[b.status] || b.status));
    const q = await store.queueFor(b.centreId, b.date);
    const inside = new Set(q?.insidePositions || []);
    const ahead = (q?.openPositions || []).filter((p) => p < b.positionAssigned && !inside.has(p)).length;
    say(vr, lang, P[lang].ahead(ahead, q?.nowServingToken));
  }

  /** Express/Functions handler for POST /voice */
  async function handleVoice(req, res) {
    const vr = new Response();
    const send = () => res.type("text/xml").send(vr.toString());
    const step = req.query.step || "language";
    const lang = req.query.lang === "hi" ? "hi" : "en";
    const call = readCall(req, provider);
    const d = call.digits;
    const n = Number.parseInt(d, 10);
    const phone = normalizePhone(call.farmerRaw);
    const t = P[lang];

    try {
      logger.info(`IVR ${step} lang=${lang} phone=${phone} digits=${d}`);

      // ---- reminder call (outbound only) -------------------------
      if (step === "reminder") {
        const snap = await db.collection("bookings").doc(req.query.tokenId || "").get();
        if (!snap.exists) { say(vr, lang, t.error); return send(); }
        const b = snap.data();
        const L = req.query.lang === "hi" ? "hi" : (b.ivrLang || "hi");
        say(vr, L, P[L].reminder(b.farmerName, b.tokenNumber, b.centreName));
        say(vr, L, P[L].reminder(b.farmerName, b.tokenNumber, b.centreName)); // repeat once
        return send();
      }

      // ---- missed-call mode: hang up, ring the farmer back ----------
      // Twilio number -> Voice webhook  ?step=missedcall
      // The farmer pays nothing; we call him and start the IVR.
      if (step === "missedcall") {
        vr.reject();                     // no answer = free for the farmer
        return send();
      }

      if (step === "language") {
        const g = gather(vr, "en", qs({step: "langsel"}));
        say(g, "en", P.en.languageWelcome);
        say(g, "hi", P.hi.languageWelcome);
        return send();
      }

      if (step === "langsel") {
        const L = d === "1" ? "en" : d === "2" ? "hi" : null;
        if (!L) { say(vr, "en", P.en.invalidLanguage); return send(); }
        if (!phone) { say(vr, L, P[L].error); return send(); }
        const u = await db.collection("users").doc(phone).get();
        if (u.exists) { await menu(vr, L, u.data().name); return send(); }
        say(vr, L, P[L].newUser);
        const g = listen(vr, L, qs({step: "name", lang: L}));
        say(g, L, P[L].askName);
        // if speech capture yields nothing, register anyway
        vr.add(new Response.Node("Redirect", {method: "POST"}, `${voiceUrl}?${qs({step: "name", lang: L, skip: 1})}`));
        return send();
      }

      if (step === "name") {
        const spoken = call.speech || (req.query.skip ? (lang === "hi" ? "किसान" : "Farmer") : "");
        if (!spoken) {
          const g = listen(vr, lang, qs({step: "name", lang}));
          say(g, lang, t.askName);
          return send();
        }
        await db.collection("users").doc(phone).set({
          phone, role: "farmer", name: spoken, isVerified: false, source: "ivr", language: lang,
          createdAt: new Date().toISOString(),
        }, {merge: true});
        await menu(vr, lang, spoken);
        return send();
      }

      if (step === "menu") {
        if (d === "1") { say(vr, lang, t.bookSelected); await listMandis(vr, lang); return send(); }
        if (d === "2") { await speakStatus(vr, lang, phone); return send(); }
        const g = gather(vr, lang, qs({step: "menu", lang}));
        say(g, lang, t.invalidChoice); say(g, lang, t.mainMenu); return send();
      }

      if (step === "mandi") {
        const centres = await store.fetchCentres();
        const c = centres[n - 1];
        if (!c || n > 9) { await listMandis(vr, lang, true); return send(); }
        say(vr, lang, t.selected(centreName(c, lang)));
        await listCrops(vr, lang, c);
        return send();
      }

      const centre = await store.fetchCentreById(req.query.centreId);
      if (!centre) { say(vr, lang, t.error); return send(); }

      if (step === "crop") {
        const crop = cropsOf(centre)[n - 1];
        if (!crop) { await listCrops(vr, lang, centre, true); return send(); }
        say(vr, lang, t.selected(cropName(crop, lang)));
        listDates(vr, lang, {centreId: centre.id, cropId: crop.id});
        return send();
      }

      const crop = CROP_LIST.find((c) => c.id === req.query.cropId);
      if (!crop) { say(vr, lang, t.error); return send(); }

      if (step === "date") {
        const opt = getDateOptions(lang)[n - 1];
        if (!opt) { listDates(vr, lang, {centreId: centre.id, cropId: crop.id}, true); return send(); }
        say(vr, lang, t.selected(opt.label));
        await listSlots(vr, lang, centre, {centreId: centre.id, cropId: crop.id, date: opt.value});
        return send();
      }

      const date = req.query.date;
      if (step === "slot") {
        const slots = await store.fetchAvailableSlots(centre, date);
        const s = slots[n - 1];
        if (!s) { await listSlots(vr, lang, centre, {centreId: centre.id, cropId: crop.id, date}, true); return send(); }
        say(vr, lang, t.selected(s.windowLabel));
        askQuantity(vr, lang, {centreId: centre.id, cropId: crop.id, date, slotTime: s.slotTime});
        return send();
      }

      const slotTime = req.query.slotTime;
      if (step === "qty") {
        const ok = /^\d{1,3}$/.test(d) && n >= 1 && n <= 999;
        if (!ok) { askQuantity(vr, lang, {centreId: centre.id, cropId: crop.id, date, slotTime}, true); return send(); }
        const dateLabel = getDateOptions(lang).find((o) => o.value === date)?.label || date;
        const [h] = slotTime.split(":").map(Number);
        say(vr, lang, t.selectedQuantity(n));
        const g = gather(vr, lang, qs({step: "confirm", lang, centreId: centre.id, cropId: crop.id, date, slotTime, quantity: n}));
        say(g, lang, t.confirmation(centreName(centre, lang), cropName(crop, lang), dateLabel, `${formatHour(h)} - ${formatHour(h + 1)}`, n));
        return send();
      }

      if (step === "confirm") {
        const quantity = Number.parseInt(req.query.quantity, 10);
        if (d === "2") { say(vr, lang, t.bookingCancelled); return send(); }
        if (d !== "1") {
          const g = gather(vr, lang, qs({step: "confirm", lang, centreId: centre.id, cropId: crop.id, date, slotTime, quantity}));
          say(g, lang, t.invalidChoice);
          const [h] = slotTime.split(":").map(Number);
          say(g, lang, t.confirmation(centreName(centre, lang), cropName(crop, lang), date, `${formatHour(h)} - ${formatHour(h + 1)}`, quantity));
          return send();
        }
        const u = await db.collection("users").doc(phone).get();
        const [h] = slotTime.split(":").map(Number);
        const slot = {slotTime, windowLabel: `${formatHour(h)} - ${formatHour(h + 1)}`};
        try {
          const b = await store.createBookingFromIvr({
            farmerId: phone, farmerName: u.exists ? u.data().name : "", centre, crop, quantity, date, slot,
            callSid: call.callId || `nosid-${Date.now()}`, lang,
          });
          logger.info(`IVR booking ${b.tokenNumber} ${b.tokenId} for ${phone}`);
          say(vr, lang, t.bookingConfirmed(b.tokenNumber, b.estimatedTurnTime));
          say(vr, lang, t.gatePass(b.gatePassCode));
        } catch (e) {
          logger.error("IVR booking failed", e);
          say(vr, lang, e.message === "SLOT_FULL" ? t.slotJustFilled : t.error);
        }
        return send();
      }

      say(vr, lang, t.error); return send();
    } catch (e) {
      logger.error("IVR error", e);
      say(vr, lang, t.error); return send();
    }
  }

  return {handleVoice, store};
}

// ---------------------------------------------------------------
// Outbound calls (Twilio REST). Needs TWILIO_* env.
// ---------------------------------------------------------------
function makeCaller({provider = "sim", baseUrl, accountSid, authToken, from}) {
  const toE164 = (p) => `+91${normalizePhone(p)}`;
  let dial;
  /** sim: "ringing" = an entry the /sim page picks up by polling /sim/pending */
  const pending = new Map();
  if (provider === "sim") {
    dial = async (to, url) => {
      const sid = `sim-${Date.now()}`;
      pending.set(normalizePhone(to), {url, sid, at: Date.now()});
      return {sid};
    };
  } else if (provider === "plivo") {
    const plivo = require("plivo");
    const client = new plivo.Client(accountSid, authToken);
    dial = async (to, url) => {
      const r = await client.calls.create(from, to, url, {answerMethod: "POST"});
      return {sid: r.requestUuid || r.request_uuid || "plivo"};
    };
  } else {
    const twilio = require("twilio");
    const client = twilio(accountSid, authToken);
    dial = (to, url) => client.calls.create({to, from, url, method: "POST"});
  }

  /** Ring the farmer and run the full IVR (booking / status). */
  function callMe(phone) {
    return dial(toE164(phone), `${baseUrl}/voice?step=language`);
  }

  /** "Your token is next" call. */
  function callReminder(booking) {
    if (!booking?.farmerPhone && !booking?.farmerId) return null;
    const lang = booking.ivrLang || "hi";
    return dial(toE164(booking.farmerPhone || booking.farmerId),
        `${baseUrl}/voice?step=reminder&lang=${lang}&tokenId=${encodeURIComponent(booking.tokenId)}`);
  }
  /** sim only: hand the waiting call to the browser phone (one-shot) */
  function takePending(phone) {
    const k = normalizePhone(phone);
    const c = pending.get(k);
    if (!c) return null;
    pending.delete(k);
    if (Date.now() - c.at > 10 * 60 * 1000) return null;   // stale
    return c;
  }
  return {callMe, callReminder, takePending};
}

module.exports = {makeIvr, makeCaller, makeStore, makeXml, readCall, normalizePhone, CROP_LIST};
