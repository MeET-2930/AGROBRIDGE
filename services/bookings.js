/*
 * services/bookings.js
 * ---------------------------------------------------------------
 * Booking + token + queue engine for AGROBRIDGE.
 *
 * Two collections are involved:
 *
 *   bookings/{tokenId}
 *       One document per farmer booking. Its `status` field
 *       drives every screen in the app.
 *
 *   centreQueues/{centreId}__{date}
 *       ONE small live document per centre per day.
 *       This is what farmers subscribe to. It holds:
 *         - which token is being served right now
 *         - how many tokens have been issued
 *         - per-slot booked counts (capacity control)
 *       Because it is a single document, a farmer needs exactly
 *       one realtime listener, and no farmer can see any other
 *       farmer's private data.
 * ---------------------------------------------------------------
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { fetchCentreById } from './centres';
import { todayLocal, parseLocalDate } from './dates';
import { tErr } from './i18nError';
import { requireOfficerDuty, DUTY_FOR_STAGE } from './auth';
import { notifyNextFarmer } from './ivr';
import {
  notifyUser, notifyCentreOfficers, notifyCentreTraders, notifyFarmersAtCentre, makeItem, routes,
} from './notifications';

/* ===============================================================
 * STATUS STATE MACHINE
 * =============================================================== */

export const STATUS = {
  BOOKED: 'booked',
  IN_GATE: 'in-gate',
  ASSAY: 'assay',
  PRICE_FIXED: 'price-fixed', // rate per quintal decided (MSP or auction)
  WEIGHING: 'weighing',
  PAYMENT_PENDING: 'payment-processing',
  PAID: 'paid',
  REJECTED: 'rejected',
  NO_SHOW: 'no-show',
  CANCELLED: 'cancelled',
};

// Statuses that mean the farmer is physically inside the mandi.
export const INSIDE_STATUSES = [
  STATUS.IN_GATE,
  STATUS.ASSAY,
  STATUS.PRICE_FIXED,
  STATUS.WEIGHING,
  STATUS.PAYMENT_PENDING,
];

// Statuses that still occupy a place in today's queue.
export const ACTIVE_STATUSES = [
  STATUS.BOOKED,
  ...INSIDE_STATUSES,
];

// Statuses that are finished, one way or another.
export const CLOSED_STATUSES = [
  STATUS.PAID,
  STATUS.REJECTED,
  STATUS.NO_SHOW,
  STATUS.CANCELLED,
];

/* ===============================================================
 * SMALL HELPERS
 * =============================================================== */

/**
 * Today's date in the DEVICE's timezone, not UTC.
 * See services/dates.js for why this matters.
 */
export function todayString() {
  return todayLocal();
}

export function queueDocId(centreId, dateStr) {
  return `${centreId}__${dateStr}`;
}

function queueRef(centreId, dateStr) {
  return doc(db, 'centreQueues', queueDocId(centreId, dateStr));
}

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${ampm}`;
}

function clockTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * How many vehicles a centre can process in one 60-minute window.
 */
export function capacityPerWindow(centre) {
  const perEntry = Number(centre?.avgMinutesPerEntry) || 15;
  const lanes = Number(centre?.parallelLanes) || 1;

  return Math.max(1, Math.floor((60 / perEntry) * lanes));
}

/**
 * Human token label from a numeric position. 1 -> A-01, 21 -> B-01
 */
function tokenLabel(position) {
  const letter = String.fromCharCode(
    65 + Math.floor((position - 1) / 20)
  );

  const num = String(((position - 1) % 20) + 1).padStart(2, '0');

  return `${letter}-${num}`;
}

/* ===============================================================
 * SLOT AVAILABILITY
 * =============================================================== */

/**
 * Build the list of bookable windows for a centre on a date.
 * Booked counts come from the queue document, which is the same
 * thing the booking transaction enforces, so what the farmer sees
 * is exactly what the transaction will check.
 */
export async function fetchCentreSlots(centreId, dateStr) {
  const centre = await fetchCentreById(centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  const capacity = capacityPerWindow(centre);

  const queueSnap = await getDoc(queueRef(centreId, dateStr));

  const slotCounts = queueSnap.exists()
    ? queueSnap.data().slotCounts || {}
    : {};

  const [startHour] = String(centre.operatingStartTime || '08:00')
    .split(':')
    .map(Number);

  const [endHour] = String(centre.operatingEndTime || '18:00')
    .split(':')
    .map(Number);

  const slots = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const slotTime = `${String(hour).padStart(2, '0')}:00`;
    const bookedCount = Number(slotCounts[slotTime]) || 0;
    const availableCapacity = Math.max(0, capacity - bookedCount);

    slots.push({
      slotTime,
      windowLabel: `${formatHour(hour)} - ${formatHour(hour + 1)}`,
      totalCapacity: capacity,
      bookedCount,
      availableCapacity,
      isFull: availableCapacity === 0,
    });
  }

  return { centre, date: dateStr, slots };
}

/* ===============================================================
 * CREATE BOOKING  (transactional)
 * =============================================================== */

/**
 * Book a slot and allocate a token atomically.
 *
 * The transaction guarantees that two farmers tapping "confirm"
 * at the same instant can never both take the last place, and can
 * never be given the same token number.
 */
/* ------------------------------------------------------------------ */
/*  Gate pass helpers                                                  */
/* ------------------------------------------------------------------ */

/** Text encoded inside the gate pass QR. */
export function buildGatePassQr(tokenId, gatePassCode) {
  return `AGB|${tokenId}|${gatePassCode}`;
}

/** Parse a scanned QR. Returns { tokenId, gatePassCode } or null. */
export function parseGatePassQr(text) {
  const parts = String(text || '').trim().split('|');
  if (parts.length !== 3 || parts[0] !== 'AGB') return null;
  return { tokenId: parts[1], gatePassCode: parts[2] };
}

/** Gate pass code for a booking (older bookings fall back to token digits). */
export function gatePassCodeOf(booking) {
  if (!booking) return '';
  if (booking.gatePassCode) return String(booking.gatePassCode);
  return String(booking.tokenId || '').replace(/\D/g, '').slice(-6);
}

/**
 * Find today's booking at this centre that matches a scanned QR
 * or a typed 6-digit code. `rows` is the officer's live list.
 */
export function findByGatePass(rows, input) {
  const list = Array.isArray(rows) ? rows : [];
  const raw = String(input || '').trim();
  if (!raw) return null;

  const parsed = parseGatePassQr(raw);
  if (parsed) {
    return (
      list.find(
        (r) =>
          r.tokenId === parsed.tokenId &&
          gatePassCodeOf(r) === String(parsed.gatePassCode)
      ) || null
    );
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) {
    const hit = list.find((r) => gatePassCodeOf(r) === digits);
    if (hit) return hit;
  }

  // Allow typing the token label too, e.g. A-03
  const label = raw.toUpperCase().replace(/\s/g, '');
  return list.find((r) => String(r.tokenNumber).toUpperCase() === label) || null;
}

export async function createBooking({
  farmerId,
  farmerName,
  farmerPhone,
  centreId,
  crop,
  cropName = '',
  vehicleNumber = '',
  approxQuantityQuintals = 0,
  date,
  slotTime,
  slotWindow,
}) {
  if (!farmerId) throw new Error('Farmer ID is required');
  if (!centreId) throw new Error('Mandi centre is required');
  if (!crop) throw new Error('Crop is required');
  if (!date || !slotTime) throw new Error('Date and slot are required');

  // Centre master data is static, so read it outside the transaction.
  const centre = await fetchCentreById(centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  const capacity = capacityPerWindow(centre);
  const qRef = queueRef(centreId, date);
  const tokenId = `TKN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingRef = doc(db, 'bookings', tokenId);

  /*
   * Gate pass code: 6 digits, easy to read out or send by SMS to
   * a keypad phone. The QR on the pass carries the same code.
   */
  const gatePassCode = String(Math.floor(100000 + Math.random() * 900000));

  const booking = await runTransaction(db, async (tx) => {
    const qSnap = await tx.get(qRef);

    const queue = qSnap.exists()
      ? qSnap.data()
      : {
          centreId,
          date,
          centreName: centre.name,
          avgMinutesPerEntry: Number(centre.avgMinutesPerEntry) || 15,
          parallelLanes: Number(centre.parallelLanes) || 1,
          nowServingPosition: null,
          nowServingToken: null,
          nowServingStatus: null,
          lastIssuedPosition: 0,
          totalBooked: 0,
          completedCount: 0,
          openPositions: [],
          insidePositions: [],
          slotCounts: {},
        };

    const slotCounts = { ...(queue.slotCounts || {}) };
    const usedInSlot = Number(slotCounts[slotTime]) || 0;

    if (usedInSlot >= capacity) {
      throw tErr('err.slotFull');
    }

    const position = (Number(queue.lastIssuedPosition) || 0) + 1;
    const tokenNumber = tokenLabel(position);

    slotCounts[slotTime] = usedInSlot + 1;

    // Estimated turn: start of the window plus the queue ahead,
    // divided across the centre's parallel lanes.
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const lanes = Number(centre.parallelLanes) || 1;
    const perEntry = Number(centre.avgMinutesPerEntry) || 15;
    const offsetMinutes = Math.round(((usedInSlot) * perEntry) / lanes);

    const turn = parseLocalDate(date);
    turn.setHours(slotHour, (slotMinute || 0) + offsetMinutes, 0, 0);

    const record = {
      tokenId,
      tokenNumber,
      positionAssigned: position,

      farmerId,
      farmerName: farmerName || '',
      farmerPhone: farmerPhone || '',

      vehicleNumber: vehicleNumber
        ? String(vehicleNumber).toUpperCase().trim()
        : '',

      approxQuantityQuintals: parseFloat(approxQuantityQuintals) || 0,

      centreId,
      centreName: centre.name,
      centreAddress: centre.address || '',

      crop,
      cropName: cropName || crop,

      date,
      slotTime,
      slotWindow: slotWindow || `${slotTime} Window`,

      status: STATUS.BOOKED,

      // Gate pass (shown as QR + number to the farmer)
      gatePassCode,
      gatePassQr: buildGatePassQr(tokenId, gatePassCode),
      gatePassVerifiedBy: null,

      estimatedTurnTime: turn.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),

      // Stage timestamps, filled in by the officer as it progresses
      gateEntryAt: null,
      assayAt: null,
      weighedAt: null,
      paidAt: null,

      // Assay results
      moisturePercent: null,
      foreignMatterPercent: null,
      grade: null,
      assayNotes: '',

      // Weighing
      grossWeightQuintals: null,
      tareWeightQuintals: null,
      actualQuantity: null,

      // Pricing (decided after assay, before weighing)
      priceMode: null, // 'msp' | 'auction'
      priceFixedAt: null,
      buyerId: null,
      buyerName: null,

      // Payment
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
      delayReason: '',

      createdAt: new Date().toISOString(),
    };

    tx.set(bookingRef, record);

    tx.set(
      qRef,
      {
        ...queue,
        centreId,
        date,
        centreName: centre.name,
        avgMinutesPerEntry: Number(centre.avgMinutesPerEntry) || 15,
        parallelLanes: lanes,
        lastIssuedPosition: position,
        totalBooked: (Number(queue.totalBooked) || 0) + 1,
        openPositions: [...(queue.openPositions || []), position],
        insidePositions: queue.insidePositions || [],
        slotCounts,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return record;
  });

  // install28: tell the farmer and the gate staff (fire-and-forget).
  const bp = { token: booking.tokenNumber, mandi: booking.centreName, date: booking.date, time: booking.slotWindow, crop: booking.cropName, qty: booking.approxQuantityQuintals, farmer: booking.farmerName || booking.farmerPhone };
  notifyUser(booking.farmerId, makeItem('nt_booked_t', 'nt_booked_b', bp, routes.farmerToken(booking.tokenId)));
  notifyCentreOfficers(booking.centreId, ['gate'], makeItem('nt_off_newToken_t', 'nt_off_newToken_b', bp, routes.officerStage('gate')));

  return booking;
}

/* ===============================================================
 * LIVE QUEUE  (what the farmer subscribes to)
 * =============================================================== */

/**
 * Subscribe to the one live queue document for a centre + date.
 * Returns an unsubscribe function.
 */
export function subscribeToQueue(centreId, dateStr, callback) {
  if (!centreId || !dateStr) return () => {};

  return onSnapshot(
    queueRef(centreId, dateStr),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error('Queue subscription error:', error);
      callback(null);
    }
  );
}

/**
 * Subscribe to a single booking document (the farmer's own token).
 */
export function subscribeToBooking(tokenId, callback) {
  if (!tokenId) return () => {};

  return onSnapshot(
    doc(db, 'bookings', tokenId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error('Booking subscription error:', error);
      callback(null);
    }
  );
}

/**
 * Turn (my booking + live queue) into the small amount of
 * information the farmer actually needs.
 *
 * Deliberately returns aggregates only - a token number and a
 * count - never another farmer's identity.
 */
export function buildQueueView(booking, queue) {
  /*
   * NOTE ON LANGUAGE
   * headline / detail are NOT sentences. They are { key, params }
   * objects, resolved on screen with tr(view.headline) so the
   * farmer sees them in the language he picked.
   */
  const myPosition = Number(booking?.positionAssigned) || 0;
  const status = booking?.status;
  const msg = (key, params) => ({ key, params: params || {} });

  // Assay done: the FARMER must now choose MSP or auction.
  if (status === STATUS.ASSAY) {
    return {
      level: 'action',
      tokensAhead: 0,
      nowServingToken: booking?.tokenNumber,
      etaMinutes: 0,
      headline: msg('qv_action_h'),
      detail: msg('qv_action_d', { grade: booking?.grade || 'FAQ' }),
    };
  }

  // Farmer is already inside the mandi.
  if (INSIDE_STATUSES.includes(status)) {
    const rate = booking?.ratePerQuintal;
    const buyer =
      booking?.priceMode === 'auction'
        ? booking?.buyerName || { key: 'tr_trader' }
        : { key: 'td_govBuyer' };

    let headline;
    let detail;

    if (status === STATUS.IN_GATE) {
      headline = msg('qv_inside_h');
      detail = booking?.laneAssigned
        ? msg('qv_inside_lane_d', { lane: booking.laneAssigned })
        : msg('qv_inside_d');
    } else if (status === STATUS.PRICE_FIXED) {
      headline = msg('qv_priceFixed_h', { rate });
      detail = msg('qv_priceFixed_d', { buyer });
    } else if (status === STATUS.WEIGHING) {
      headline = msg('qv_weighed_h');
      detail = msg('qv_weighed_d', { qty: booking?.actualQuantity || '', rate });
    } else {
      headline = msg('qv_payPending_h');
      detail = msg('qv_payPending_d');
    }

    return {
      level: 'inside',
      tokensAhead: 0,
      nowServingToken: queue?.nowServingToken || booking?.tokenNumber,
      etaMinutes: 0,
      headline,
      detail,
    };
  }

  if (CLOSED_STATUSES.includes(status)) {
    return {
      level: 'closed',
      tokensAhead: 0,
      nowServingToken: queue?.nowServingToken || null,
      etaMinutes: 0,
      headline:
        status === STATUS.PAID
          ? msg('qv_paid_h')
          : status === STATUS.NO_SHOW
          ? msg('qv_noShow_h')
          : msg('qv_closed_h'),
      detail: '',
    };
  }

  const openPositions = Array.isArray(queue?.openPositions)
    ? queue.openPositions
    : [];

  const insidePositions = Array.isArray(queue?.insidePositions)
    ? queue.insidePositions
    : [];

  const nowServingToken = queue?.nowServingToken || null;
  const insideCount = insidePositions.length;
  const lanes = Math.max(1, Number(queue?.parallelLanes) || 1);
  const perEntry = Number(queue?.avgMinutesPerEntry) || 15;

  /*
   * How many farmers are genuinely ahead of me: those still open,
   * positioned before me, and not already inside the mandi.
   */
  const waitingAhead = openPositions.filter(
    (p) => p < myPosition && !insidePositions.includes(p)
  ).length;

  const freeLanes = Math.max(0, lanes - insideCount);

  // Each lane clears roughly one vehicle per avgMinutesPerEntry.
  const etaMinutes = Math.round((waitingAhead * perEntry) / lanes);

  // Nothing has started at this centre today.
  if (openPositions.length === 0 && !nowServingToken) {
    return {
      level: 'waiting',
      tokensAhead: Math.max(0, myPosition - 1),
      nowServingToken: null,
      etaMinutes: Math.round(
        (Math.max(0, myPosition - 1) * perEntry) / lanes
      ),
      headline: msg('qv_notStarted_h'),
      detail: msg('qv_notStarted_d', { token: booking?.tokenNumber || '' }),
    };
  }

  // A lane is free and nobody is ahead of me in the waiting line.
  if (waitingAhead < freeLanes) {
    return {
      level: 'go',
      tokensAhead: waitingAhead,
      nowServingToken,
      etaMinutes: 0,
      headline: msg('qv_go_h'),
      detail: nowServingToken
        ? msg('qv_go_d', { token: nowServingToken, n: insideCount })
        : msg('qv_go_empty'),
    };
  }

  const aheadLine = msg('qv_aheadLine', { n: waitingAhead, inside: insideCount });

  if (waitingAhead <= 2) {
    return {
      level: 'ready',
      tokensAhead: waitingAhead,
      nowServingToken,
      etaMinutes,
      headline: msg('qv_ready_h'),
      detail: aheadLine,
    };
  }

  return {
    level: 'waiting',
    tokensAhead: waitingAhead,
    nowServingToken,
    etaMinutes,
    headline: msg('qv_wait_h'),
    detail: aheadLine,
  };
}

/* ===============================================================
 * OFFICER ACTIONS
 * =============================================================== */

/**
 * Shared helper: update a booking AND the live queue document in
 * one transaction, so the farmer's screen and the officer's screen
 * can never disagree.
 *
 * The queue document tracks two arrays instead of a single
 * "now serving" pointer:
 *
 *   openPositions   - every token not yet finished (waiting OR inside)
 *   insidePositions - tokens that have passed the gate
 *
 * Counting these is correct no matter how many lanes the mandi runs
 * in parallel, and no matter what order the officers work in.
 */
/**
 * Role guard used by every officer action: the caller must be an
 * officer posted at the token's mandi, holding one of `duties`
 * (or admin). Throws a translated error otherwise.
 */
async function assertOfficerFor(tokenId, duties) {
  if (!tokenId) throw new Error('Token ID is required');
  const snap = await getDoc(doc(db, 'bookings', tokenId));
  if (!snap.exists()) throw tErr('err.tokenNotFound');
  await requireOfficerDuty(snap.data().centreId, duties);
  return snap.data();
}

async function advanceStage(tokenId, patch, { entering = false } = {}) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);

  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);

    if (!bSnap.exists()) {
      throw tErr('err.tokenNotFound');
    }

    const booking = bSnap.data();
    const qRef = queueRef(booking.centreId, booking.date);
    const qSnap = await tx.get(qRef);

    tx.update(bookingRef, patch);

    if (!qSnap.exists()) {
      return { ...booking, ...patch };
    }

    const data = qSnap.data();
    const position = Number(booking.positionAssigned) || 0;

    let openPositions = Array.isArray(data.openPositions)
      ? [...data.openPositions]
      : [];

    let insidePositions = Array.isArray(data.insidePositions)
      ? [...data.insidePositions]
      : [];

    const isClosing = CLOSED_STATUSES.includes(patch.status);

    /*
     * LANE GUIDANCE (install22)
     * The mandi has `parallelLanes` unloading lanes. When a vehicle is
     * admitted we send it to the lane with the fewest vehicles right now,
     * so the farmer is told "Lane 2" at the gate and does not wander.
     * laneCounts = { "1": 3, "2": 1 }  -> vehicles currently in each lane.
     */
    const lanes = Math.max(1, Number(data.parallelLanes) || 1);
    const laneCounts = { ...(data.laneCounts || {}) };
    let laneAssigned = Number(booking.laneAssigned) || null;

    if (entering && !insidePositions.includes(position)) {
      insidePositions.push(position);
      let best = 1;
      for (let l = 1; l <= lanes; l++) {
        if ((Number(laneCounts[l]) || 0) < (Number(laneCounts[best]) || 0)) best = l;
      }
      laneAssigned = best;
      laneCounts[best] = (Number(laneCounts[best]) || 0) + 1;
      patch.laneAssigned = best;
      tx.update(bookingRef, { laneAssigned: best });
    }

    if (isClosing) {
      openPositions = openPositions.filter((p) => p !== position);
      insidePositions = insidePositions.filter((p) => p !== position);
      if (laneAssigned && laneCounts[laneAssigned] > 0) {
        laneCounts[laneAssigned] = Number(laneCounts[laneAssigned]) - 1;
      }
    }

    insidePositions.sort((a, b) => a - b);
    openPositions.sort((a, b) => a - b);

    // Display value only: the lowest token currently inside.
    const lowestInside = insidePositions.length ? insidePositions[0] : null;

    tx.update(qRef, {
      openPositions,
      insidePositions,
      insideCount: insidePositions.length,
      nowServingPosition: lowestInside,
      nowServingToken: lowestInside ? tokenLabel(lowestInside) : null,
      nowServingStatus: entering ? patch.status : data.nowServingStatus || null,
      laneCounts,
      completedCount: isClosing
        ? (Number(data.completedCount) || 0) + 1
        : Number(data.completedCount) || 0,
      updatedAt: serverTimestamp(),
    });

    return { ...booking, ...patch };
  }).then((result) => {
    afterStageNotify(result, patch).catch(() => {});
    return result;
  });
}

/*
 * install28: who is told what, after each stage.
 * Keys live in i18n/translations.js (nt_*). Never throws.
 */
async function afterStageNotify(b, patch) {
  const p = {
    token: b.tokenNumber, mandi: b.centreName, farmer: b.farmerName || b.farmerPhone || '',
    crop: b.cropName, grade: b.grade || 'FAQ', rate: b.ratePerQuintal || '', qty: b.actualQuantity || b.approxQuantityQuintals || '',
    lane: b.laneAssigned || '', amount: b.netPayable || '', buyer: typeof b.buyerName === 'string' ? b.buyerName : '',
  };
  const farmer = (t, body, route) => notifyUser(b.farmerId, makeItem(t, body, p, route || routes.farmerToken(b.tokenId)));
  const officers = (duties, t, body, stage) => notifyCentreOfficers(b.centreId, duties, makeItem(t, body, p, routes.officerStage(stage)));

  switch (patch.status) {
    case STATUS.IN_GATE:
      await farmer('nt_gate_t', b.laneAssigned ? 'nt_gate_lane_b' : 'nt_gate_b');
      await officers(['assay'], 'nt_off_arrived_t', 'nt_off_arrived_b', 'assay');
      await notifyNextInQueue(b);
      break;
    case STATUS.ASSAY:
      await farmer('nt_assay_t', 'nt_assay_b');
      break;
    case STATUS.REJECTED:
      await farmer('nt_rejected_t', 'nt_rejected_b');
      break;
    case STATUS.PRICE_FIXED:
      await farmer('nt_price_t', 'nt_price_b');
      await officers(['weighbridge'], 'nt_off_priceFixed_t', 'nt_off_priceFixed_b', 'weighing');
      break;
    case STATUS.PAYMENT_PENDING:
      await farmer('nt_weighed_t', 'nt_weighed_b');
      await officers(['accounts'], 'nt_off_weighed_t', 'nt_off_weighed_b', 'payment');
      break;
    case STATUS.PAID:
      await farmer('nt_paid_t', 'nt_paid_b', routes.farmerPayments());
      break;
    case STATUS.NO_SHOW:
      await farmer('nt_noShow_t', 'nt_noShow_b', routes.farmerHome());
      break;
    default:
      break;
  }
}

/* "It is your turn" for the farmer whose token is next after a vehicle went in. */
async function notifyNextInQueue(justEntered) {
  try {
    const qSnap = await getDoc(queueRef(justEntered.centreId, justEntered.date));
    if (!qSnap.exists()) return;
    const q = qSnap.data();
    const inside = new Set(q.insidePositions || []);
    const lanes = Math.max(1, Number(q.parallelLanes) || 1);
    const free = Math.max(0, lanes - inside.size);
    if (free <= 0) return;
    const waiting = (q.openPositions || []).filter((pos) => !inside.has(pos)).sort((a, c) => a - c).slice(0, free);
    if (!waiting.length) return;
    const snap = await getDocs(
      query(collection(db, 'bookings'), where('centreId', '==', justEntered.centreId), where('date', '==', justEntered.date), where('positionAssigned', 'in', waiting))
    );
    await Promise.all(snap.docs.map((d) => {
      const nb = d.data();
      if (nb.status !== STATUS.BOOKED || nb.turnNotifiedAt) return null;
      updateDoc(d.ref, { turnNotifiedAt: new Date().toISOString() }).catch(() => {});
      return notifyUser(nb.farmerId, makeItem('nt_yourTurn_t', 'nt_yourTurn_b', { token: nb.tokenNumber, mandi: nb.centreName, now: q.nowServingToken || '' }, routes.farmerToken(nb.tokenId)));
    }));
  } catch (e) {
    console.log('turn notify skipped:', e?.message);
  }
}

/**
 * Gate officer: let the vehicle in.
 * This is the action that frees a lane and moves the queue on.
 */
export async function markGateEntry(
  tokenId,
  vehicleNumber = '',
  verifiedBy = 'manual' // 'qr' | 'code' | 'manual'
) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.gate);
  const patch = {
    status: STATUS.IN_GATE,
    gateEntryAt: new Date().toISOString(),
    actualAppearedTime: clockTime(),
    gatePassVerifiedBy: verifiedBy,
  };

  if (String(vehicleNumber).trim()) {
    patch.vehicleNumber = String(vehicleNumber).toUpperCase().trim();
  }

  const result = await advanceStage(tokenId, patch, { entering: true });
  // A vehicle just went in -> phone the next farmer in the queue.
  notifyNextFarmer(result.centreId, result.date);
  return result;
}

/** Backward-compatible alias for the old screen code. */
export const markAppeared = markGateEntry;

/**
 * Assay officer: record quality check.
 */
export async function recordAssay(
  tokenId,
  { moisturePercent, foreignMatterPercent, grade, notes = '', rejected = false }
) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.assay);
  const patch = {
    status: rejected ? STATUS.REJECTED : STATUS.ASSAY,
    assayAt: new Date().toISOString(),
    moisturePercent: parseFloat(moisturePercent) || 0,
    foreignMatterPercent: parseFloat(foreignMatterPercent) || 0,
    grade: grade || 'FAQ',
    assayNotes: notes || '',
  };

  return advanceStage(tokenId, patch);
}

/**
 * Fix the sale price per quintal. Happens AFTER assay and BEFORE
 * weighing (the e-NAM order): the weigh-man only weighs produce
 * whose buyer and rate are already settled.
 *
 * mode = 'msp'      -> government agency buys at MSP
 * mode = 'auction'  -> winning trader bid (wired in the trader build)
 */
export async function fixPrice(
  tokenId,
  { mode = 'msp', ratePerQuintal, buyerId = null, buyerName = null }
) {
  const rate = parseFloat(ratePerQuintal) || 0;
  if (rate <= 0) throw tErr('err.badRate');

  const bookingRef = doc(db, 'bookings', tokenId);
  const snap = await getDoc(bookingRef);
  if (!snap.exists()) throw tErr('err.tokenNotFound');

  const booking = snap.data();
  if (booking.status !== STATUS.ASSAY) {
    throw tErr('err.priceAfterAssay');
  }

  const patch = {
    status: STATUS.PRICE_FIXED,
    priceMode: mode,
    ratePerQuintal: rate,
    priceFixedAt: new Date().toISOString(),
    buyerId: buyerId || null,
    buyerName:
      buyerName || (mode === 'msp' ? 'सरकारी खरीद एजेंसी (MSP)' : null),
  };

  return advanceStage(tokenId, patch);
}

/**
 * Weighbridge officer: record gross and tare, derive net.
 * Refuses until the price has been fixed.
 */
export async function recordWeighing(
  tokenId,
  { grossWeightQuintals, tareWeightQuintals }
) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.weighing);
  const gross = parseFloat(grossWeightQuintals) || 0;
  const tare = parseFloat(tareWeightQuintals) || 0;
  const net = Math.round((gross - tare) * 100) / 100;

  const preSnap = await getDoc(doc(db, 'bookings', tokenId));
  if (preSnap.exists() && preSnap.data().status !== STATUS.PRICE_FIXED) {
    throw tErr('err.weighBeforePrice');
  }

  if (net <= 0) {
    throw tErr('wg_netZero');
  }

  const patch = {
    status: STATUS.PAYMENT_PENDING,
    weighedAt: new Date().toISOString(),
    grossWeightQuintals: gross,
    tareWeightQuintals: tare,
    actualQuantity: net,
  };

  return advanceStage(tokenId, patch);
}

/**
 * Cashier: compute deductions, generate receipt, close the token.
 */
/*
 * paymentBasis: 'msp' | 'ebid' | 'offline'
 *   msp     - government agency at MSP
 *   ebid    - winning bid placed inside the app
 *   offline - bid held physically by the arhtiya; the munim's hand
 *             written PARCHI is the farmer's only proof of the rate,
 *             so the cashier MUST attach a photo of it (parchi.imageBase64).
 */
export async function markPaid(
  tokenId,
  { actualQuantity, ratePerQuintal, grade, paymentBasis, parchi, cashierName }
) {
  if (!tokenId) throw new Error('Token ID is required');
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.payment);

  const bookingRef = doc(db, 'bookings', tokenId);
  const snapshot = await getDoc(bookingRef);

  if (!snapshot.exists()) {
    throw tErr('err.tokenNotFound');
  }

  const booking = snapshot.data();
  const centre = await fetchCentreById(booking.centreId);

  if (!centre) {
    throw tErr('err.mandiNotFound');
  }

  const quantity =
    parseFloat(actualQuantity) || parseFloat(booking.actualQuantity) || 0;

  // The rate was fixed before weighing; the cashier cannot change it.
  const rate =
    parseFloat(booking.ratePerQuintal) || parseFloat(ratePerQuintal) || 0;

  if (quantity <= 0) throw tErr('mp_badQty');
  if (rate <= 0) throw tErr('err.badRate');

  // Default the basis from what the app already knows.
  const basis =
    paymentBasis ||
    (booking.priceMode === 'auction' ? 'ebid' : 'msp');

  let parchiRecord = null;
  if (basis === 'offline') {
    if (!parchi?.imageBase64) throw tErr('pc_needPhoto');
    const parchiRate = parseFloat(parchi.rate) || 0;
    if (parchiRate <= 0) throw tErr('pc_needRate');
    parchiRecord = {
      imageBase64: parchi.imageBase64, // data URI, ~150 KB (compressed on device)
      rate: parchiRate,
      note: parchi.note || '',
      matchesFixedRate: Math.abs(parchiRate - rate) < 0.5,
      capturedAt: new Date().toISOString(),
      capturedBy: cashierName || null,
    };
  }

  const gross = quantity * rate;
  const mandiFee = gross * ((Number(centre.mandiFeePercent) || 0) / 100);
  const commission = gross * ((Number(centre.commissionPercent) || 0) / 100);
  const hamali = quantity * (Number(centre.hamaliPerQuintal) || 0);
  const netPayable = gross - mandiFee - commission - hamali;

  const round = (n) => Math.round(n * 100) / 100;

  const patch = {
    status: STATUS.PAID,
    paidAt: new Date().toISOString(),

    actualQuantity: quantity,
    ratePerQuintal: rate,
    grade: grade || booking.grade || 'FAQ',

    grossAmount: round(gross),
    mandiFee: round(mandiFee),
    commission: round(commission),
    hamali: round(hamali),
    netPayable: round(netPayable),

    receiptId: `RCP-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`,

    paymentReference: `SIM${Date.now().toString().slice(-10)}`,
    receiptGeneratedAt: new Date().toISOString(),

    paymentBasis: basis,
    cashierName: cashierName || null,
    parchi: parchiRecord,
  };

  return advanceStage(tokenId, patch);
}

/**
 * Officer: farmer never turned up.
 */
export async function markNoShow(tokenId) {
  await assertOfficerFor(tokenId, DUTY_FOR_STAGE.gate);
  return advanceStage(tokenId, {
    status: STATUS.NO_SHOW,
    noShowAt: new Date().toISOString(),
  });
}

/**
 * Farmer: cancel own booking (frees the slot back up).
 */
export async function cancelBooking(tokenId) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);

  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);

    if (!bSnap.exists()) throw tErr('err.tokenNotFound');

    const booking = bSnap.data();

    if (booking.status !== STATUS.BOOKED) {
      throw tErr('err.cannotCancel');
    }

    const qRef = queueRef(booking.centreId, booking.date);
    const qSnap = await tx.get(qRef);

    tx.update(bookingRef, {
      status: STATUS.CANCELLED,
      cancelledAt: new Date().toISOString(),
    });

    if (qSnap.exists()) {
      const data = qSnap.data();
      const slotCounts = { ...(data.slotCounts || {}) };

      slotCounts[booking.slotTime] = Math.max(
        0,
        (Number(slotCounts[booking.slotTime]) || 1) - 1
      );

      const position = Number(booking.positionAssigned) || 0;

      tx.update(qRef, {
        slotCounts,
        openPositions: (Array.isArray(data.openPositions)
          ? data.openPositions
          : []
        ).filter((p) => p !== position),
        updatedAt: serverTimestamp(),
      });
    }

    return true;
  });
}

/* ===============================================================
 * QUERIES
 * =============================================================== */

export async function fetchMyBookings(farmerId) {
  if (!farmerId) return [];

  try {
    const snapshot = await getDocs(
      query(collection(db, 'bookings'), where('farmerId', '==', farmerId))
    );

    return snapshot.docs
      .map((item) => item.data())
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
  } catch (error) {
    console.error('Error fetching farmer bookings:', error);
    return [];
  }
}

export async function fetchActiveFarmerBooking(farmerId) {
  if (!farmerId) return null;

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'bookings'),
        where('farmerId', '==', farmerId),
        where('status', 'in', ACTIVE_STATUSES)
      )
    );

    if (snapshot.empty) return null;

    return snapshot.docs
      .map((item) => item.data())
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )[0];
  } catch (error) {
    console.error('Error fetching active booking:', error);
    return null;
  }
}

export async function fetchTokenDetail(tokenId) {
  if (!tokenId) return null;

  try {
    const snapshot = await getDoc(doc(db, 'bookings', tokenId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

export async function fetchTodaysQueue(centreId, dateStr = null) {
  if (!centreId) return [];

  try {
    const date = dateStr || todayString();

    const snapshot = await getDocs(
      query(
        collection(db, 'bookings'),
        where('centreId', '==', centreId),
        where('date', '==', date)
      )
    );

    return snapshot.docs
      .map((item) => item.data())
      .sort(
        (a, b) =>
          (a.positionAssigned || 0) - (b.positionAssigned || 0)
      );
  } catch (error) {
    console.error('Error fetching queue:', error);
    return [];
  }
}

/**
 * Officer queue with live updates.
 */
export function subscribeToTodaysQueue(centreId, dateStr, callback) {
  if (!centreId) return () => {};

  const date = dateStr || todayString();

  return onSnapshot(
    query(
      collection(db, 'bookings'),
      where('centreId', '==', centreId),
      where('date', '==', date)
    ),
    (snap) => {
      const rows = snap.docs
        .map((item) => item.data())
        .sort(
          (a, b) =>
            (a.positionAssigned || 0) - (b.positionAssigned || 0)
        );

      callback(rows);
    },
    (error) => {
      console.error('Officer queue subscription error:', error);
      callback([]);
    }
  );
}

export async function reportCentreDelay(centreId, delayMinutes, reason) {
  if (!centreId) throw new Error('Centre ID is required');
  await requireOfficerDuty(centreId, DUTY_FOR_STAGE.delay); // admin only

  await setDoc(
    doc(db, 'delays', centreId),
    {
      centreId,
      minutes: parseInt(delayMinutes, 10) || 0,
      reason: reason || 'Operational Delay',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // install28: everyone waiting today hears about it.
  const item = makeItem('nt_delay_t', 'nt_delay_b', { minutes: parseInt(delayMinutes, 10) || 0, reason: reason || '' }, routes.farmerHome());
  notifyFarmersAtCentre(centreId, todayString(), item);
  notifyCentreOfficers(centreId, ['*'], { ...item, route: routes.officerQueue() });

  return true;
}

export async function fetchOfficerSummary(centreId, dateStr = null) {
  const empty = {
    total: 0,
    pending: 0,
    inside: 0,
    appeared: 0,
    paid: 0,
    noShows: 0,
    totalProcuredQuintals: 0,
    totalDisbursedRs: 0,
    nowServingToken: null,
    centreDelay: { minutes: 0, reason: '' },
  };

  if (!centreId) return empty;

  try {
    const date = dateStr || todayString();
    const bookings = await fetchTodaysQueue(centreId, date);
    const qSnap = await getDoc(queueRef(centreId, date));

    const paid = bookings.filter((b) => b.status === STATUS.PAID);

    const inside = bookings.filter((b) =>
      INSIDE_STATUSES.includes(b.status)
    ).length;

    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === STATUS.BOOKED).length,
      inside,
      appeared: inside + paid.length,
      paid: paid.length,
      noShows: bookings.filter((b) => b.status === STATUS.NO_SHOW).length,

      totalProcuredQuintals:
        Math.round(
          paid.reduce((s, b) => s + (b.actualQuantity || 0), 0) * 10
        ) / 10,

      totalDisbursedRs: Math.round(
        paid.reduce((s, b) => s + (b.netPayable || 0), 0)
      ),

      nowServingToken: qSnap.exists()
        ? qSnap.data().nowServingToken || null
        : null,

      centreDelay: { minutes: 0, reason: '' },
    };
  } catch (error) {
    console.error('Error fetching officer summary:', error);
    return empty;
  }
}

/* ===============================================================
 * OFFICER DUTY -> WORK STAGE MAPPING
 * =============================================================== */

/**
 * Which booking statuses each officer duty is responsible for,
 * and what the action button should say.
 *
 * Duty IDs come from OFFICER_DUTIES in services/auth.js:
 *   gate | weighbridge | accounts | admin
 */
export const DUTY_STAGES = {
  gate: [
    {
      id: 'gate',
      title: 'गेट प्रवेश',
      subtitle: 'वाहन को अंदर भेजें',
      titleKey: 'stg_gate_t',
      subtitleKey: 'stg_gate_s',
      actionKey: 'stg_gate_a',
      icon: 'enter-outline',
      statuses: [STATUS.BOOKED],
      action: 'gate',
      actionLabel: 'गेट प्रवेश',
    },
  ],

  assay: [
    {
      id: 'assay',
      title: 'गुणवत्ता जांच',
      subtitle: 'नमूना, नमी, ग्रेड और अन्य पदार्थ',
      titleKey: 'stg_assay_t',
      subtitleKey: 'stg_assay_s',
      actionKey: 'stg_assay_a',
      icon: 'flask-outline',
      statuses: [STATUS.IN_GATE],
      action: 'Assay',
      actionLabel: 'जांच करें',
    },
  ],

  weighbridge: [
    {
      id: 'weighing',
      title: 'तौल',
      subtitle: 'केवल भाव तय हो चुके वाहन',
      titleKey: 'stg_weighing_t',
      subtitleKey: 'stg_weighing_s',
      actionKey: 'stg_weighing_a',
      icon: 'scale-outline',
      statuses: [STATUS.PRICE_FIXED],
      action: 'Weighing',
      actionLabel: 'तौल करें',
    },
  ],

  accounts: [
    {
      id: 'payment',
      title: 'भुगतान',
      subtitle: 'कटौती और रसीद',
      titleKey: 'stg_payment_t',
      subtitleKey: 'stg_payment_s',
      actionKey: 'stg_payment_a',
      icon: 'cash-outline',
      statuses: [STATUS.WEIGHING, STATUS.PAYMENT_PENDING],
      action: 'MarkPaid',
      actionLabel: 'भुगतान करें',
    },
  ],
};

// Admin sees every stage.
DUTY_STAGES.admin = [
  ...DUTY_STAGES.gate,
  ...DUTY_STAGES.assay,
  ...DUTY_STAGES.weighbridge,
  ...DUTY_STAGES.accounts,
];

export function getStagesForDuty(duty) {
  // Unknown / missing duty falls back to the LEAST powerful role.
  return DUTY_STAGES[duty] || DUTY_STAGES.gate;
}

/** Duty that owns a given stage id (admin owns all). */
export function dutyOwnsStage(duty, stageId) {
  if (duty === 'admin') return true;
  return (DUTY_STAGES[duty] || []).some((s) => s.id === stageId);
}

export function getStageById(stageId) {
  return DUTY_STAGES.admin.find((s) => s.id === stageId) || null;
}
