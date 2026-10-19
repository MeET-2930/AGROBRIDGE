/*
 * ivr/booking-service.js
 * ---------------------------------------------------------------
 * Server-side conversational booking service for the AgroBridge
 * Assistant (MVP/demo).
 *
 * It deliberately mirrors the booking rules in services/bookings.js:
 *   - engine/capacity.js planLoad, not the simplified IVR slot maths
 *   - engine/yard.js floor / labour scaling
 *   - Model A quantity correction and Model C show probability
 *   - 2 active tokens per farmer per centre
 *   - one Firestore transaction for capacity re-check + queue update
 *
 * It uses the Firebase Admin SDK, never the React Native client SDK.
 * Farmer identity is always passed in by the verified chatbot layer;
 * it is never a Gemini tool argument.
 *
 * Confirmation is enforced here, not just in the prompt:
 *   proposeBooking() stores a pending intent for this session
 *   confirmBooking() only commits when (a) the session has a pending
 *   intent, (b) its details still match, and (c) the farmer's CURRENT
 *   message is an explicit confirmation.
 * ---------------------------------------------------------------
 */

const crypto = require("crypto");

const capacityEngine = require("../engine/capacity.js");
const yardEngine = require("../engine/yard.js");
const throughputEngine = require("../engine/models/throughput.js");
const correctionModel = require("../engine/models/correction.js");
const noshowModel = require("../engine/models/noshow.js");

const { normalizeCrop, cropMeta, cropClassOf, cropName } = require("./crops");

const ACTIVE_STATUSES = [
  "booked",
  "in-gate",
  "assay",
  "price-fixed",
  "weighing",
  "payment-processing",
];
const CLOSED_STATUSES = ["paid", "rejected", "no-show", "missed", "cancelled"];

const MAX_ACTIVE_TOKENS_PER_CENTRE = 2;
const CONFIRM_TTL_MS = 15 * 60 * 1000;
const MAX_BOOKING_DAYS = 14;
const MAX_QUINTALS = 999;

const CHECKLIST = {
  wheat: ["ck_dry", "ck_clean", "ck_regNo", "ck_bank", "ck_plate", "ck_tarp"],
  paddy: ["ck_dryPaddy", "ck_clean", "ck_regNo", "ck_bank", "ck_plate", "ck_tarp"],
  mustard: ["ck_dryMustard", "ck_clean", "ck_regNo", "ck_bank", "ck_plate", "ck_tarp"],
  default: ["ck_dry", "ck_clean", "ck_regNo", "ck_bank", "ck_plate"],
};

const COL = {
  intents: "chatBookingIntents",
  sessions: "chatBookingSessions",
  locks: "chatBookingLocks",
  centres: "centres",
  queues: "centreQueues",
  bookings: "bookings",
};

class BookingError extends Error {
  constructor(code, message, extra = null) {
    super(message || code);
    this.code = code;
    this.extra = extra;
  }
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function dateOnlyIst(nowMs) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
}

function istHour(nowMs) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(nowMs))
  );
}

function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

function parseDate(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function dayStatus(centre, dateStr) {
  const d = parseDate(dateStr);
  if (!d) return { open: false, reason: "invalid", label: "", hours: null };
  const closedDays = Array.isArray(centre?.closedDays) ? centre.closedDays : [0];
  const holidays = Array.isArray(centre?.holidays) ? centre.holidays : [];
  const hol = holidays.find((h) => (typeof h === "string" ? h : h?.date) === dateStr);
  if (hol) {
    return {
      open: false,
      reason: "holiday",
      label: typeof hol === "object" ? hol.label || "" : "",
      hours: null,
    };
  }
  if (closedDays.map(Number).includes(d.getUTCDay())) {
    return { open: false, reason: "weekly", label: "", hours: null };
  }
  const ov = centre?.hoursOverride?.[dateStr];
  return {
    open: true,
    reason: null,
    label: "",
    hours: ov ? { start: ov.start, end: ov.end } : null,
  };
}

function centreForDay(centre, dateStr) {
  const st = dayStatus(centre, dateStr);
  if (!st.hours) return centre;
  return {
    ...centre,
    operatingStartTime: st.hours.start || centre.operatingStartTime,
    operatingEndTime: st.hours.end || centre.operatingEndTime,
  };
}

function engineSettings(centre) {
  return {
    useCorrection: true,
    useNoShow: true,
    throughputMode: "set",
    ...(centre?.engine || {}),
  };
}

function formatClockIst(date) {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function slotDate(dateStr, slotTime) {
  const [h, m] = String(slotTime || "00:00").split(":").map(Number);
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00+05:30`
  );
}

function dateLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeQuantity(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const q = round1(n);
  if (q < 1 || q > MAX_QUINTALS) return null;
  return q;
}

function normalizeDateInput(raw, nowMs) {
  const date = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "INVALID_DATE" };
  if (!parseDate(date)) return { ok: false, error: "INVALID_DATE" };
  const today = dateOnlyIst(nowMs);
  if (date < today) return { ok: false, error: "DATE_IN_PAST" };
  if (date > addDays(today, MAX_BOOKING_DAYS)) return { ok: false, error: "DATE_TOO_FAR" };
  return { ok: true, value: date };
}

function normalizeSessionId(raw, farmerId) {
  const value = String(raw || "").trim();
  if (value && /^[A-Za-z0-9_-]{3,80}$/.test(value)) return value;
  return `phone-${String(farmerId || "anon")}`;
}

function intentId() {
  return `cbi_${crypto.randomBytes(12).toString("hex")}`;
}

function sessionDocId(farmerId, sessionId) {
  return `${farmerId}__${sessionId}`;
}

function isExplicitConfirm(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const t = raw
    .toLowerCase()
    .replace(/[.,!?;:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\b(no|not|nahi|nahin|cancel|mat|dont|don't|stop|ruko|ruk|abhi nahi|baad mein)\b/.test(t) ||
    /नहीं|मत|रद्द/.test(t)
  ) {
    return false;
  }
  if (
    /^(yes|y|ok|okay|sure|confirm|confirmed|go ahead|book it|do it|haan|han|ha|haanji|theek hai|thik hai|thik|karo|kar do|kar|pakka)\b/.test(
      t
    )
  ) {
    return true;
  }
  return /\b(confirm|book it|go ahead|kar do|kardo)\b/.test(t) || /हाँ|हां|ठीक है|कर दो|पक्का/.test(t);
}

function emptyQueue(centre, centreId, date) {
  const cap = capacityEngine.centreCapacity(centre);
  return {
    centreId,
    date,
    centreName: centre.name,
    avgMinutesPerEntry: Number(centre.avgMinutesPerEntry) || 15,
    parallelLanes: Number(centre.parallelLanes) || 1,
    throughputPerHour: centre.throughputPerHour || { default: 400 },
    bufferPercent: cap.bufferPercent,
    maxSharePercent: cap.maxSharePercent,
    declaredTolerancePercent: cap.declaredTolerancePercent,
    nowServingPosition: null,
    nowServingToken: null,
    nowServingStatus: null,
    lastIssuedPosition: 0,
    totalBooked: 0,
    completedCount: 0,
    openPositions: [],
    insidePositions: [],
    slotCounts: {},
    slotLoadMinutes: {},
    slotExpectedMinutes: {},
    slotQuintals: {},
    slotReservedQuintals: {},
    slotActualQuintals: {},
    loadByPosition: {},
  };
}

function tokenLabel(position) {
  const letter = String.fromCharCode(65 + Math.floor((position - 1) / 20));
  const num = String(((position - 1) % 20) + 1).padStart(2, "0");
  return `${letter}-${num}`;
}

function bookingView(b) {
  return {
    bookingId: b.tokenId || null,
    tokenNumber: b.tokenNumber || null,
    positionAssigned: b.positionAssigned ?? null,
    centreId: b.centreId || null,
    centreName: b.centreName || null,
    centreAddress: b.centreAddress || null,
    crop: b.crop || null,
    cropName: b.cropName || null,
    quantityQuintals: b.approxQuantityQuintals ?? null,
    date: b.date || null,
    slotTime: b.slotTime || null,
    slotWindow: b.slotWindow || null,
    arriveAt: b.arriveAt || null,
    estimatedTurnTime: b.estimatedTurnTime || null,
    status: b.status || null,
    source: b.source || null,
  };
}

/**
 * @param {object} opts
 * @param {object} opts.db        Firebase Admin Firestore instance
 * @param {object} [opts.logger]
 * @param {number} [opts.nowMs]   fixed clock for tests
 * @param {boolean} [opts.enabled]
 */
function makeBookingService({ db, logger = console, nowMs = null, enabled = true } = {}) {
  if (!db) throw new Error("makeBookingService: db is required");

  const clock = () => (typeof nowMs === "function" ? nowMs() : nowMs || Date.now());

  async function fetchCentre(centreId) {
    const snap = await db.collection(COL.centres).doc(centreId).get();
    return snap.exists ? { ...snap.data(), id: snap.id } : null;
  }

  async function fetchCentres() {
    const snap = await db.collection(COL.centres).get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((c) => c.active !== false)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  async function fetchQueue(centreId, date) {
    const snap = await db.collection(COL.queues).doc(`${centreId}__${date}`).get();
    return snap.exists ? snap.data() : null;
  }

  async function fetchFarmer(farmerId) {
    try {
      const snap = await db.collection("users").doc(farmerId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      logger.warn?.("booking-service: farmer profile unavailable", e?.message || e);
      return null;
    }
  }

  async function fetchActiveBookings(farmerId) {
    const snap = await db.collection(COL.bookings).where("farmerId", "==", farmerId).get();
    return snap.docs
      .map((d) => d.data())
      .filter((b) => ACTIVE_STATUSES.includes(b.status));
  }

  async function fetchFarmerHistory(farmerId) {
    const empty = { pairs: [], pastBookings: 0, pastNoShows: 0 };
    if (!farmerId) return empty;
    try {
      const snap = await db.collection(COL.bookings).where("farmerId", "==", farmerId).get();
      const rows = snap.docs
        .map((d) => d.data())
        .filter((b) => (CLOSED_STATUSES.includes(b.status) || b.status === "paid") && !b.yardIncidentCancel);
      const pairs = rows
        .filter(
          (b) =>
            Number(b.actualQuantity) > 0 &&
            Number(b.declaredQuintals || b.approxQuantityQuintals) > 0
        )
        .sort((a, b) => String(b.weighedAt || "").localeCompare(String(a.weighedAt || "")))
        .map((b) => ({
          declared: Number(b.declaredQuintals || b.approxQuantityQuintals),
          actual: Number(b.actualQuantity),
        }));
      const pastNoShows = rows.filter((b) => b.status === "no-show" || b.status === "missed").length;
      return { pairs, pastBookings: rows.length, pastNoShows };
    } catch (e) {
      logger.warn?.("booking-service: farmer history unavailable", e?.message || e);
      return empty;
    }
  }

  function effectiveCapacity(centre, crop, slotTime) {
    const cap = capacityEngine.centreCapacity(centre, crop);
    const st = engineSettings(centre);
    const eff = throughputEngine.effectiveThroughput(
      cap.throughput,
      st.learnedThroughput,
      slotTime,
      st.throughputMode
    );
    return {
      ...cap,
      throughput: eff.value,
      throughputSource: eff.source,
      setThroughput: cap.throughput,
    };
  }

  async function engineInputs({ centre, farmerId, crop, quintals, date, slotTime, bookedVia = "app" }) {
    const st = engineSettings(centre);
    const hist = await fetchFarmerHistory(farmerId);
    const lp = st.localParams || {};
    const corrParams =
      lp.correction && lp.correction.samples >= 30 ? lp.correction : undefined;
    const nsParams = lp.noshow && lp.noshow.samples >= 100 ? lp.noshow : undefined;
    const corr = st.useCorrection
      ? correctionModel.correctionRatio(crop, hist.pairs, corrParams)
      : { ratio: 1, n: hist.pairs.length, source: "off" };
    const show = st.useNoShow
      ? noshowModel.showProbability(
          {
            pastBookings: hist.pastBookings,
            pastNoShows: hist.pastNoShows,
            leadDays: noshowModel.leadDaysBetween(clock(), date),
            hour: Number(String(slotTime || "9").split(":")[0]),
            quintals,
            bookedVia,
          },
          nsParams
        )
      : { pShow: 1, features: null, contrib: null };
    const leadDays = noshowModel.leadDaysBetween(clock(), date);
    return {
      opts: { ratio: corr.ratio, pShow: show.pShow, cropClass: cropClassOf(crop), leadDays },
      audit: {
        cropClass: cropClassOf(crop),
        leadDays,
        ratio: corr.ratio,
        ratioSource: corr.source,
        farmerVisits: corr.n,
        pShow: show.pShow,
        pastBookings: hist.pastBookings,
        pastNoShows: hist.pastNoShows,
        useCorrection: st.useCorrection,
        useNoShow: st.useNoShow,
        throughputMode: st.throughputMode,
        modelVersion: 1,
      },
    };
  }

  function normalDayIntake(centre, crop) {
    return Math.max(
      1,
      capacityEngine.centreCapacity(centre, crop).throughput *
        capacityEngine.windowList(centre).length
    );
  }

  async function bookedQuintalsByDay(centreId, days = 7, fromDate = null) {
    const start = fromDate || dateOnlyIst(clock());
    const out = [];
    for (let d = 0; d < days; d += 1) {
      const date = addDays(start, d);
      try {
        const q = await fetchQueue(centreId, date);
        const res =
          q?.slotReservedQuintals && Object.keys(q.slotReservedQuintals).length
            ? q.slotReservedQuintals
            : q?.slotQuintals || {};
        out.push(Object.values(res).reduce((s, v) => s + (Number(v) || 0), 0));
      } catch (e) {
        out.push(0);
      }
    }
    return out;
  }

  async function yardPlan(centre, crop, centreId) {
    const y = yardEngine.yardState(centre?.yard);
    const factors = yardEngine.yardFactors(y);
    const normal = normalDayIntake(centre, crop);
    const booked = centreId ? await bookedQuintalsByDay(centreId, y.projectionDays) : [];
    const projection = yardEngine.floorProjection(y, booked, normal);
    const today = dateOnlyIst(clock());
    const bagFactor = factors.bagCapQ == null ? 1 : Math.min(1, factors.bagCapQ / normal);
    const factorFor = (dateStr) => {
      const off = noshowModel.leadDaysBetween(clock(), dateStr);
      const f =
        off >= 0 && off < projection.factorByDay.length
          ? projection.factorByDay[off]
          : 1;
      return dateStr === today ? Math.min(f, bagFactor) : f;
    };
    return {
      yard: y,
      factors,
      projection,
      normal,
      factorFor,
      incident: y.incident || null,
      reasons: yardEngine.yardReasons(y),
    };
  }

  function capacityWithYard(centre, crop, slotTime, plan, dateStr) {
    const base = effectiveCapacity(centre, crop, slotTime);
    if (!plan) return base;
    return yardEngine.scaleCapacity(
      base,
      plan.factorFor(dateStr),
      plan.factors.labourFactor
    );
  }

  async function computeSlots({ centreId, crop, quintals, date, farmerId }) {
    const centreRaw = await fetchCentre(centreId);
    if (!centreRaw) return { ok: false, error: "CENTRE_NOT_FOUND" };
    if (centreRaw.active === false) return { ok: false, error: "CENTRE_INACTIVE" };
    if (!centreRaw.acceptedCrops?.map((c) => String(c).toLowerCase()).includes(crop)) {
      return { ok: false, error: "CROP_NOT_ACCEPTED" };
    }

    const day = dayStatus(centreRaw, date);
    if (!day.open) {
      return {
        ok: true,
        centre: centreRaw,
        date,
        crop,
        quantityQuintals: quintals,
        closedDay: day,
        slots: [],
        availableSlots: [],
        tooBig: false,
        capacity: null,
        yard: null,
        engine: null,
      };
    }

    const centre = centreForDay(centreRaw, date);
    const queue = (await fetchQueue(centreId, date)) || {};
    const eng = await engineInputs({
      centre,
      farmerId,
      crop,
      quintals,
      date,
      slotTime: null,
    });
    const yp = await yardPlan(centre, crop, centreId);
    const dayFactor = yp.factorFor(date);
    const list = capacityEngine.windowList(centre);
    const today = dateOnlyIst(clock());
    const currentHour = istHour(clock());

    const slots = list.map((slotTime, idx) => {
      const cap = capacityWithYard(centre, crop, slotTime, yp, date);
      const plan = capacityEngine.planLoad(cap, list, queue, idx, quintals, eng.opts);
      const hour = Number(slotTime.split(":")[0]);
      return {
        slotTime,
        windowLabel: capacityEngine.windowLabelFor(slotTime, 1),
        runLabel: plan.ok ? capacityEngine.windowLabelFor(slotTime, plan.needed) : null,
        needed: plan.needed || 1,
        fits: plan.ok,
        reason: !plan.ok && dayFactor <= 0.01 ? "yard" : plan.reason,
        isFull: !plan.ok,
        closed: Boolean(queue.closedSlots?.[slotTime]),
        horizon: plan.horizon || null,
        windows: plan.ok ? plan.windows : [],
        arriveLabel: capacityEngine.formatHour(hour),
        past: date === today && hour <= currentHour,
        totalCapacity: cap.vehicleCap,
        bookedCount: Number(queue.slotCounts?.[slotTime]) || 0,
        availableCapacity: Math.max(
          0,
          cap.vehicleCap - (Number(queue.slotCounts?.[slotTime]) || 0)
        ),
      };
    });

    const availableSlots = slots.filter((s) => s.fits && !s.past && !s.closed);
    const tooBig =
      slots.length > 0 && slots.every((s) => s.reason === "tooBig" || s.reason === "tooLate");

    return {
      ok: true,
      centre: centreRaw,
      date,
      crop,
      quantityQuintals: quintals,
      closedDay: null,
      slots,
      availableSlots,
      tooBig,
      capacity: effectiveCapacity(centre, crop, list[0]),
      engine: eng.audit,
      yard: {
        factor: Math.round(dayFactor * 100) / 100,
        floorUsedPercent: yp.factors.floorUsedPercent,
        labourFactor: yp.factors.labourFactor,
        incidentActive: Boolean(yp.incident?.active),
        recoveryDays: yp.projection.recoveryDays,
        reasons: yp.reasons,
      },
    };
  }

  async function findAlternatives({
    centreId,
    crop,
    quintals,
    farmerId,
    fromDate,
    excludeSlot = null,
  }) {
    const out = [];
    for (let offset = 0; offset < 4 && out.length < 6; offset += 1) {
      const date = addDays(fromDate, offset);
      const result = await computeSlots({ centreId, crop, quintals, date, farmerId });
      if (!result.ok) break;
      for (const slot of result.availableSlots) {
        if (offset === 0 && excludeSlot && slot.slotTime === excludeSlot) continue;
        out.push({
          date,
          slotTime: slot.slotTime,
          windowLabel: slot.windowLabel,
          runLabel: slot.runLabel,
          needed: slot.needed,
        });
        if (out.length >= 6) break;
      }
    }
    return out;
  }

  async function listCentresForCrop(crop) {
    const centres = await fetchCentres();
    const cleanCrop = crop ? normalizeCrop(crop) : null;
    const filtered = cleanCrop
      ? centres.filter((c) =>
          (c.acceptedCrops || [])
            .map((x) => String(x).toLowerCase())
            .includes(cleanCrop)
        )
      : centres;
    return filtered.map((c) => ({
      centreId: c.id,
      name: c.name || c.name_en || c.id,
      nameEn: c.name_en || c.name || c.id,
      address: c.address || "",
      acceptedCrops: c.acceptedCrops || [],
      operatingStartTime: c.operatingStartTime || null,
      operatingEndTime: c.operatingEndTime || null,
    }));
  }

  async function getSlots({ centreId, crop, quantityQuintals, date, farmerId, language = "en" }) {
    const cleanCrop = normalizeCrop(crop);
    if (!cleanCrop) return { ok: false, error: "INVALID_CROP", message: "Unknown crop. Use a crop id from the centre's acceptedCrops." };
    const qty = normalizeQuantity(quantityQuintals);
    if (!qty) {
      return {
        ok: false,
        error: "INVALID_QUANTITY",
        message: "Quantity must be between 1 and 999 quintals.",
      };
    }
    const dateCheck = normalizeDateInput(date, clock());
    if (!dateCheck.ok) {
      return {
        ok: false,
        error: dateCheck.error,
        message:
          dateCheck.error === "DATE_IN_PAST"
            ? "That date is in the past."
            : dateCheck.error === "DATE_TOO_FAR"
              ? `Bookings are open up to ${MAX_BOOKING_DAYS} days ahead.`
              : "Date must be YYYY-MM-DD.",
      };
    }

    const result = await computeSlots({
      centreId,
      crop: cleanCrop,
      quintals: qty,
      date: dateCheck.value,
      farmerId,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        message:
          result.error === "CENTRE_NOT_FOUND"
            ? "That mandi does not exist."
            : result.error === "CROP_NOT_ACCEPTED"
              ? "That mandi does not accept this crop."
              : "That mandi is not available.",
      };
    }

    const available = result.availableSlots.map((s) => ({
      slotTime: s.slotTime,
      windowLabel: s.windowLabel,
      runLabel: s.runLabel,
      needed: s.needed,
      arriveLabel: s.arriveLabel,
    }));

    return {
      ok: true,
      centreId,
      centreName: language === 'en' ? result.centre.name_en || result.centre.name : result.centre.name,
      centreAddress: result.centre.address || "",
      crop: cleanCrop,
      cropName: cropName(cleanCrop, language),
      quantityQuintals: qty,
      date: dateCheck.value,
      dateLabel: dateLabel(dateCheck.value),
      closedDay: result.closedDay,
      availableSlots: available,
      tooBig: result.tooBig,
      yard: result.yard,
      note: result.closedDay
        ? `Closed: ${result.closedDay.reason}${result.closedDay.label ? ` (${result.closedDay.label})` : ""}.`
        : available.length
          ? `${available.length} slot(s) fit this load. These are live estimates, rechecked again at confirmation.`
          : result.tooBig
            ? "This load is too large for the remaining windows that day. Try a smaller quantity or another date."
            : "No open slot fits this load on that date.",
    };
  }

  async function getPending({ farmerId, sessionId }) {
    if (!farmerId) return null;
    const sid = normalizeSessionId(sessionId, farmerId);
    const sessionSnap = await db
      .collection(COL.sessions)
      .doc(sessionDocId(farmerId, sid))
      .get();
    if (!sessionSnap.exists) return null;
    const pendingId = sessionSnap.data().pendingIntentId;
    if (!pendingId) return null;
    const intentSnap = await db.collection(COL.intents).doc(pendingId).get();
    if (!intentSnap.exists) return null;
    const intent = intentSnap.data();
    if (intent.farmerId !== farmerId || intent.sessionId !== sid) return null;
    if (intent.status !== "pending") return null;
    if (Number(intent.expiresAtMs) < clock()) {
      await db
        .collection(COL.intents)
        .doc(pendingId)
        .set({ status: "expired" }, { merge: true });
      return null;
    }
    return {
      confirmationId: pendingId,
      summary: intent.summary,
      details: intent.details,
      expiresAt: new Date(Number(intent.expiresAtMs)).toISOString(),
    };
  }

  async function proposeBooking({
    farmerId,
    sessionId,
    centreId,
    crop,
    quantityQuintals,
    date,
    slotTime,
    language = "en",
    turnId = null,
  }) {
    if (!enabled) {
      return { ok: false, error: "BOOKING_DISABLED", message: "Booking is disabled on this server." };
    }
    if (!farmerId) {
      return {
        ok: false,
        error: "NOT_LOGGED_IN",
        message: "The farmer must be logged in to book. Ask them to log in or use the booking screens.",
      };
    }
    const sid = normalizeSessionId(sessionId, farmerId);
    const cleanCrop = normalizeCrop(crop);
    if (!cleanCrop) return { ok: false, error: "INVALID_CROP", message: "Unknown crop." };
    const qty = normalizeQuantity(quantityQuintals);
    if (!qty) {
      return { ok: false, error: "INVALID_QUANTITY", message: "Quantity must be between 1 and 999 quintals." };
    }
    const dateCheck = normalizeDateInput(date, clock());
    if (!dateCheck.ok) {
      return { ok: false, error: dateCheck.error, message: "Invalid or out-of-range booking date." };
    }
    const slot = String(slotTime || "").trim();
    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return { ok: false, error: "INVALID_SLOT", message: "slotTime must look like '10:00'." };
    }

    const centre = await fetchCentre(centreId);
    if (!centre) return { ok: false, error: "CENTRE_NOT_FOUND", message: "That mandi does not exist." };
    if (centre.active === false) return { ok: false, error: "CENTRE_INACTIVE", message: "That mandi is not active." };
    if (!centre.acceptedCrops?.map((c) => String(c).toLowerCase()).includes(cleanCrop)) {
      return { ok: false, error: "CROP_NOT_ACCEPTED", message: "That mandi does not accept this crop." };
    }
    const day = dayStatus(centre, dateCheck.value);
    if (!day.open) {
      return {
        ok: false,
        error: "CLOSED_DAY",
        message: `The mandi is closed on ${dateCheck.value}${day.reason ? ` (${day.reason})` : ""}.`,
        closedDay: day,
      };
    }
    const centreDay = centreForDay(centre, dateCheck.value);
    const slots = capacityEngine.windowList(centreDay);
    if (!slots.includes(slot)) {
      return {
        ok: false,
        error: "INVALID_SLOT",
        message: `That slot is not an operating window. Open windows: ${slots.join(", ")}.`,
      };
    }
    if (dateCheck.value === dateOnlyIst(clock()) && Number(slot.split(":")[0]) <= istHour(clock())) {
      return { ok: false, error: "SLOT_PAST", message: "That window has already started or passed today." };
    }

    const slotsResult = await computeSlots({
      centreId,
      crop: cleanCrop,
      quintals: qty,
      date: dateCheck.value,
      farmerId,
    });
    if (!slotsResult.ok) {
      return { ok: false, error: slotsResult.error, message: "Could not check that mandi." };
    }
    const chosen = slotsResult.slots.find((s) => s.slotTime === slot);
    if (!chosen || !chosen.fits || chosen.past || chosen.closed) {
      const alternatives = await findAlternatives({
        centreId,
        crop: cleanCrop,
        quintals: qty,
        farmerId,
        fromDate: dateCheck.value,
        excludeSlot: slot,
      });
      return {
        ok: false,
        error: "SLOT_UNAVAILABLE",
        message: chosen?.past
          ? "That window has already started."
          : chosen?.closed
            ? "That window is closed for new bookings."
            : "That slot does not fit the live capacity for this load.",
        alternatives,
      };
    }

    const active = await fetchActiveBookings(farmerId);
    if (active.filter((b) => b.centreId === centreId).length >= MAX_ACTIVE_TOKENS_PER_CENTRE) {
      return {
        ok: false,
        error: "MAX_ACTIVE_TOKENS",
        message: `This farmer already has ${MAX_ACTIVE_TOKENS_PER_CENTRE} active tokens at this mandi.`,
      };
    }

    const details = {
      centreId,
      centreName:
        language === "en" ? centre.name_en || centre.name || centreId : centre.name || centre.name_en || centreId,
      crop: cleanCrop,
      cropName: cropName(cleanCrop, language),
      quantityQuintals: qty,
      date: dateCheck.value,
      slotTime: slot,
      slotWindow: chosen.windowLabel,
      runLabel: chosen.runLabel,
    };
    const summary = {
      crop: details.crop,
      cropName: details.cropName,
      quantityQuintals: qty,
      centreId,
      centreName: details.centreName,
      date: details.date,
      dateLabel: dateLabel(details.date),
      slotTime: slot,
      slotWindow: chosen.windowLabel,
      runLabel: chosen.runLabel,
    };

    const sidKey = sessionDocId(farmerId, sid);
    const sessionSnap = await db.collection(COL.sessions).doc(sidKey).get();
    const existingPendingId = sessionSnap.exists ? sessionSnap.data().pendingIntentId : null;
    let supersedeId = null;
    if (existingPendingId) {
      const oldSnap = await db.collection(COL.intents).doc(existingPendingId).get();
      if (oldSnap.exists) {
        const old = oldSnap.data();
        const same =
          old.status === "pending" &&
          old.farmerId === farmerId &&
          old.sessionId === sid &&
          JSON.stringify(old.details) === JSON.stringify(details);
        const stillValid = Number(old.expiresAtMs) >= clock();
        if (same && stillValid) {
          const refreshed = clock() + CONFIRM_TTL_MS;
          await db
            .collection(COL.intents)
            .doc(existingPendingId)
            .set(
              {
                expiresAtMs: refreshed,
                updatedAtMs: clock(),
                ...(turnId ? { proposedTurnId: turnId } : {}),
              },
              { merge: true }
            );
          return {
            ok: true,
            requiresConfirmation: true,
            confirmationId: existingPendingId,
            summary,
            message: "Ask the farmer exactly: Should I confirm this booking?",
          };
        }
        if (old.status === "pending") supersedeId = existingPendingId;
      }
    }

    if (supersedeId) {
      await db
        .collection(COL.intents)
        .doc(supersedeId)
        .set({ status: "superseded", updatedAtMs: clock() }, { merge: true });
    }

    const id = intentId();
    const expiresAtMs = clock() + CONFIRM_TTL_MS;
    await db.collection(COL.intents).doc(id).set({
      id,
      farmerId,
      sessionId: sid,
      details,
      summary,
      status: "pending",
      createdAtMs: clock(),
      updatedAtMs: clock(),
      expiresAtMs,
      proposedTurnId: turnId || null,
      source: "chatbot",
    });
    await db
      .collection(COL.sessions)
      .doc(sidKey)
      .set(
        {
          farmerId,
          sessionId: sid,
          pendingIntentId: id,
          updatedAtMs: clock(),
        },
        { merge: true }
      );

    return {
      ok: true,
      requiresConfirmation: true,
      confirmationId: id,
      summary,
      message: "Ask the farmer exactly: Should I confirm this booking?",
    };
  }

  async function markStale(id) {
    try {
      await db.collection(COL.intents).doc(id).set({ status: "stale", updatedAtMs: clock() }, { merge: true });
    } catch (e) {
      logger.warn?.("booking-service: could not mark intent stale", e?.message || e);
    }
  }

  function buildRecord({
    tokenId,
    position,
    farmerId,
    farmerName,
    centre,
    crop,
    quantity,
    date,
    slotTime,
    slotWindow,
    plan,
    cap,
    eng,
    gatePassCode,
    intentIdValue,
  }) {
    const turn = slotDate(date, slotTime);
    turn.setMinutes(turn.getMinutes() + plan.offsetMinutes);
    const finish = new Date(turn.getTime() + Math.ceil(plan.loadMinutes) * 60000);
    return {
      tokenId,
      tokenNumber: tokenLabel(position),
      positionAssigned: position,
      farmerId,
      farmerName: farmerName || "",
      farmerPhone: farmerId,
      vehicleNumber: "",
      approxQuantityQuintals: quantity,
      declaredQuintals: quantity,
      centreId: centre.id,
      centreName: centre.name,
      centreAddress: centre.address || "",
      crop,
      cropName: cropName(crop, "en"),
      date,
      slotTime,
      slotWindow: slotWindow || capacityEngine.windowLabelFor(slotTime, plan.needed),
      windows: plan.windows,
      windowLoads: plan.windowLoads,
      loadMinutes: plan.loadMinutes,
      throughputUsed: cap.throughput,
      engine: {
        ...eng.audit,
        reservedQuintals: plan.reservedQuintals,
        windowExpected: plan.windowExpected,
        throughputSource: cap.throughputSource,
        setThroughput: cap.setThroughput,
      },
      arriveAt: formatClockIst(turn),
      expectedFinishAt: formatClockIst(finish),
      bookedVia: "app",
      source: "chatbot",
      chatIntentId: intentIdValue,
      walkIn: false,
      spareUsed: false,
      transferFrom: null,
      transferFromName: null,
      transferValidUntil: null,
      farmerRegNo: null,
      regSource: null,
      ceilingQ: null,
      ceilingWarned: false,
      nomineeUsed: null,
      presentedBy: null,
      arhtiyaId: null,
      arhtiyaName: null,
      arhtiyaShedId: null,
      enamLotId: null,
      enamGateEntryId: null,
      enamAssayId: null,
      enamWeighmentId: null,
      shedId: null,
      heapedAt: null,
      bags: null,
      baggedAt: null,
      rejectReason: null,
      jformNo: null,
      jformAt: null,
      utr: null,
      liftedAt: null,
      creditedAt: null,
      checklist: CHECKLIST[String(crop).toLowerCase()] || CHECKLIST.default,
      status: "booked",
      gatePassCode,
      gatePassQr: `AGB|${tokenId}|${gatePassCode}`,
      gatePassVerifiedBy: null,
      estimatedTurnTime: formatClockIst(turn),
      gateEntryAt: null,
      assayAt: null,
      weighedAt: null,
      paidAt: null,
      moisturePercent: null,
      foreignMatterPercent: null,
      grade: null,
      assayNotes: "",
      grossWeightQuintals: null,
      tareWeightQuintals: null,
      actualQuantity: null,
      quantityVariancePercent: null,
      overDeclaredTolerance: false,
      priceMode: null,
      priceFixedAt: null,
      buyerId: null,
      buyerName: null,
      ratePerQuintal: null,
      grossAmount: null,
      mandiFee: null,
      commission: null,
      hamali: null,
      netPayable: null,
      receiptId: null,
      receiptGeneratedAt: null,
      paymentReference: null,
      delayOffsetMinutes: 0,
      delayReason: "",
      createdAt: new Date(clock()).toISOString(),
    };
  }

  async function confirmBooking({ farmerId, sessionId, message, turnId = null }) {
    if (!enabled) {
      return { ok: false, error: "BOOKING_DISABLED", message: "Booking is disabled on this server." };
    }
    if (!farmerId) {
      return {
        ok: false,
        error: "NOT_LOGGED_IN",
        message: "The farmer must be logged in to confirm a booking.",
      };
    }
    if (!isExplicitConfirm(message)) {
      return {
        ok: false,
        error: "CONFIRMATION_REQUIRED",
        message:
          "The farmer has not explicitly confirmed. Show the exact summary and ask: Should I confirm this booking?",
      };
    }

    const sid = normalizeSessionId(sessionId, farmerId);
    const sidKey = sessionDocId(farmerId, sid);
    const sessionSnap = await db.collection(COL.sessions).doc(sidKey).get();
    const sessionData = sessionSnap.exists ? sessionSnap.data() : {};
    const pendingId = sessionData.pendingIntentId || sessionData.lastIntentId || null;
    if (!pendingId) {
      return {
        ok: false,
        error: "NO_PENDING_BOOKING",
        message: "There is no pending booking to confirm. Collect the details and propose the booking first.",
      };
    }

    const intentSnap = await db.collection(COL.intents).doc(pendingId).get();
    if (!intentSnap.exists) {
      return { ok: false, error: "NO_PENDING_BOOKING", message: "The pending booking no longer exists." };
    }
    const intent = intentSnap.data();
    if (intent.farmerId !== farmerId || intent.sessionId !== sid) {
      return {
        ok: false,
        error: "CONFIRMATION_MISMATCH",
        message: "This confirmation belongs to a different farmer or conversation.",
      };
    }
    if (intent.status === "completed" && intent.bookingId) {
      const existing = await db.collection(COL.bookings).doc(intent.bookingId).get();
      if (existing.exists) {
        return {
          ok: true,
          alreadyConfirmed: true,
          booking: bookingView(existing.data()),
          message: "This booking was already confirmed earlier; returning the same booking.",
        };
      }
    }
    if (intent.status === "superseded") {
      return {
        ok: false,
        error: "CONFIRMATION_SUPERSEDED",
        message: "The details changed after this confirmation was prepared. Propose the booking again and re-confirm.",
      };
    }
    if (intent.status === "stale") {
      return { ok: false, error: "SLOT_UNAVAILABLE", message: "That slot is no longer available. Check fresh slots." };
    }
    if (intent.status !== "pending") {
      return { ok: false, error: "CONFIRMATION_EXPIRED", message: "That confirmation is no longer valid." };
    }
    if (Number(intent.expiresAtMs) < clock()) {
      await markStale(pendingId);
      return { ok: false, error: "CONFIRMATION_EXPIRED", message: "That confirmation expired. Propose the booking again." };
    }
    if (turnId && intent.proposedTurnId && intent.proposedTurnId === turnId) {
      return {
        ok: false,
        error: "CONFIRMATION_SAME_TURN",
        message:
          "The summary has not been shown to the farmer yet. Show the exact details and wait for their next explicit confirmation.",
      };
    }

    const details = intent.details || {};
    const detailsCrop = normalizeCrop(details.crop);
    const detailsQty = normalizeQuantity(details.quantityQuintals);
    const detailsDate = normalizeDateInput(details.date, clock());
    if (!detailsCrop || !detailsQty || !detailsDate.ok) {
      return { ok: false, error: "INVALID_INTENT", message: "The pending booking details are invalid. Propose it again." };
    }
    const centre = await fetchCentre(details.centreId);
    if (!centre) return { ok: false, error: "CENTRE_NOT_FOUND", message: "That mandi no longer exists." };
    if (!centre.acceptedCrops?.map((c) => String(c).toLowerCase()).includes(detailsCrop)) {
      return { ok: false, error: "CROP_NOT_ACCEPTED", message: "That mandi no longer accepts this crop." };
    }
    const day = dayStatus(centre, detailsDate.value);
    if (!day.open) {
      return { ok: false, error: "CLOSED_DAY", message: "The mandi is closed on that date." };
    }
    const centreDay = centreForDay(centre, detailsDate.value);
    const slots = capacityEngine.windowList(centreDay);
    const startIdx = slots.indexOf(details.slotTime);
    if (startIdx < 0) return { ok: false, error: "INVALID_SLOT", message: "That slot is not an operating window." };
    if (detailsDate.value === dateOnlyIst(clock()) && Number(String(details.slotTime).split(":")[0]) <= istHour(clock())) {
      return { ok: false, error: "SLOT_PAST", message: "That window has already started." };
    }

    const farmer = await fetchFarmer(farmerId);
    const yp = await yardPlan(centreDay, detailsCrop, details.centreId);
    const cap = capacityWithYard(centreDay, detailsCrop, details.slotTime, yp, detailsDate.value);
    const eng = await engineInputs({
      centre: centreDay,
      farmerId,
      crop: detailsCrop,
      quintals: detailsQty,
      date: detailsDate.value,
      slotTime: details.slotTime,
    });

    const tokenId = `TKN-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
    const bookingRef = db.collection(COL.bookings).doc(tokenId);
    const qRef = db.collection(COL.queues).doc(`${details.centreId}__${detailsDate.value}`);
    const intentRef = db.collection(COL.intents).doc(pendingId);
    const sessionRef = db.collection(COL.sessions).doc(sidKey);
    const lockRef = db.collection(COL.locks).doc(farmerId);

    try {
      const record = await db.runTransaction(async (tx) => {
        const [lockSnap, intentTx, sessionTx, existingSnap, activeSnap, qSnap] = await Promise.all([
          tx.get(lockRef),
          tx.get(intentRef),
          tx.get(sessionRef),
          tx.get(db.collection(COL.bookings).where("chatIntentId", "==", pendingId)),
          tx.get(db.collection(COL.bookings).where("farmerId", "==", farmerId)),
          tx.get(qRef),
        ]);

        if (!intentTx.exists) throw new BookingError("NO_PENDING_BOOKING", "The pending booking no longer exists.");
        const liveIntent = intentTx.data();
        const liveSession = sessionTx.exists ? sessionTx.data() : {};
        if (liveIntent.status === "completed" && liveIntent.bookingId) {
          if (liveSession.lastIntentId !== pendingId) {
            throw new BookingError("CONFIRMATION_SUPERSEDED", "The pending booking changed.");
          }
          const b = await tx.get(db.collection(COL.bookings).doc(liveIntent.bookingId));
          if (b.exists) return { record: b.data(), already: true };
        }
        if (liveIntent.status !== "pending") {
          throw new BookingError("CONFIRMATION_SUPERSEDED", "The pending booking changed.");
        }
        if (liveIntent.farmerId !== farmerId || liveIntent.sessionId !== sid) {
          throw new BookingError("CONFIRMATION_MISMATCH", "The pending booking belongs to another session.");
        }
        if (liveSession.pendingIntentId !== pendingId) {
          throw new BookingError("CONFIRMATION_SUPERSEDED", "The pending booking changed.");
        }
        if (turnId && liveIntent.proposedTurnId && liveIntent.proposedTurnId === turnId) {
          throw new BookingError(
            "CONFIRMATION_SAME_TURN",
            "Show the summary and wait for the farmer's next explicit confirmation."
          );
        }
        if (Number(liveIntent.expiresAtMs) < clock()) {
          throw new BookingError("CONFIRMATION_EXPIRED", "The confirmation expired.");
        }

        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0].data();
          tx.set(intentRef, { status: "completed", bookingId: existing.tokenId, updatedAtMs: clock() }, { merge: true });
          tx.set(
            sessionRef,
            {
              pendingIntentId: null,
              lastIntentId: pendingId,
              lastBookingId: existing.tokenId,
              updatedAtMs: clock(),
            },
            { merge: true }
          );
          return { record: existing, already: true };
        }

        const active = activeSnap.docs
          .map((d) => d.data())
          .filter((b) => ACTIVE_STATUSES.includes(b.status));
        if (active.filter((b) => b.centreId === details.centreId).length >= MAX_ACTIVE_TOKENS_PER_CENTRE) {
          throw new BookingError(
            "MAX_ACTIVE_TOKENS",
            `This farmer already has ${MAX_ACTIVE_TOKENS_PER_CENTRE} active tokens at this mandi.`
          );
        }

        const queue = qSnap.exists
          ? { ...emptyQueue(centreDay, details.centreId, detailsDate.value), ...qSnap.data() }
          : emptyQueue(centreDay, details.centreId, detailsDate.value);
        const plan = capacityEngine.planLoad(
          cap,
          slots,
          queue,
          startIdx,
          detailsQty,
          eng.opts
        );
        if (!plan.ok) {
          throw new BookingError(
            "SLOT_FULL",
            plan.reason === "tooBig"
              ? "That load is too large for the remaining windows."
              : "That slot filled up before confirmation."
          );
        }

        const counters = capacityEngine.applyPlan(queue, plan, detailsQty);
        const loadByPosition = { ...(queue.loadByPosition || {}) };
        const position = (Number(queue.lastIssuedPosition) || 0) + 1;
        loadByPosition[position] = { m: plan.loadMinutes, q: detailsQty };

        const gatePassCode = String(Math.floor(100000 + Math.random() * 900000));
        const record = buildRecord({
          tokenId,
          position,
          farmerId,
          farmerName: farmer?.name || farmer?.farmerName || "",
          centre: centreDay,
          crop: detailsCrop,
          quantity: detailsQty,
          date: detailsDate.value,
          slotTime: details.slotTime,
          slotWindow: capacityEngine.windowLabelFor(details.slotTime, 1),
          plan,
          cap,
          eng,
          gatePassCode,
          intentIdValue: pendingId,
        });

        tx.set(bookingRef, record);
        tx.set(
          qRef,
          {
            ...queue,
            lastIssuedPosition: position,
            totalBooked: (Number(queue.totalBooked) || 0) + 1,
            openPositions: [...(queue.openPositions || []), position],
            insidePositions: queue.insidePositions || [],
            ...counters,
            loadByPosition,
            updatedAt: new Date(clock()).toISOString(),
          },
          { merge: true }
        );
        tx.set(
          intentRef,
          {
            status: "completed",
            bookingId: tokenId,
            booking: bookingView(record),
            updatedAtMs: clock(),
          },
          { merge: true }
        );
        tx.set(
          sessionRef,
          {
            pendingIntentId: null,
            lastIntentId: pendingId,
            lastBookingId: tokenId,
            updatedAtMs: clock(),
          },
          { merge: true }
        );
        tx.set(
          lockRef,
          { farmerId, lastBookingId: tokenId, updatedAt: new Date(clock()).toISOString() },
          { merge: true }
        );
        return { record, already: false };
      });

      return {
        ok: true,
        alreadyConfirmed: Boolean(record.already),
        booking: bookingView(record.record),
        message: record.already
          ? "This booking was already confirmed earlier; returning the same booking."
          : "Booking committed successfully.",
      };
    } catch (e) {
      if (e instanceof BookingError) {
        if (e.code === "SLOT_FULL") {
          await markStale(pendingId);
          const alternatives = await findAlternatives({
            centreId: details.centreId,
            crop: detailsCrop,
            quintals: detailsQty,
            farmerId,
            fromDate: detailsDate.value,
            excludeSlot: details.slotTime,
          });
          return {
            ok: false,
            error: "SLOT_FULL",
            message: "That slot filled up before the booking was committed. Offer these fresh options.",
            alternatives,
          };
        }
        return { ok: false, error: e.code, message: e.message };
      }
      logger.error?.("booking-service: confirmation failed", e?.message || e);
      return {
        ok: false,
        error: "TOOL_FAILED",
        message: "The booking transaction failed. Do not claim success; ask the farmer to try again.",
      };
    }
  }

  return {
    enabled: Boolean(enabled),
    listCentresForCrop,
    getSlots,
    proposeBooking,
    confirmBooking,
    getPending,
    fetchCentre,
    isExplicitConfirm,
  };
}

module.exports = {
  makeBookingService,
  BookingError,
  isExplicitConfirm,
  normalizeQuantity,
  normalizeDateInput,
  MAX_ACTIVE_TOKENS_PER_CENTRE,
  CONFIRM_TTL_MS,
};

