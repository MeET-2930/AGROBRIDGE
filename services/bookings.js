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

/* ===============================================================
 * STATUS STATE MACHINE
 * =============================================================== */

export const STATUS = {
  BOOKED: 'booked',
  IN_GATE: 'in-gate',
  ASSAY: 'assay',
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
    throw new Error('Mandi centre not found');
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
    throw new Error('Mandi centre not found');
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
      throw new Error(
        'यह स्लॉट अभी-अभी भर गया। कृपया दूसरा समय चुनें।'
      );
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
  const myPosition = Number(booking?.positionAssigned) || 0;
  const status = booking?.status;

  // Farmer is already inside the mandi.
  if (INSIDE_STATUSES.includes(status)) {
    return {
      level: 'inside',
      tokensAhead: 0,
      nowServingToken: queue?.nowServingToken || booking?.tokenNumber,
      etaMinutes: 0,
      headline: 'आप मंडी के अंदर हैं',
      detail:
        status === STATUS.IN_GATE
          ? 'गेट प्रवेश हो गया है'
          : status === STATUS.ASSAY
          ? 'गुणवत्ता जांच चल रही है'
          : status === STATUS.WEIGHING
          ? 'तौल हो रहा है'
          : 'भुगतान तैयार हो रहा है',
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
          ? 'भुगतान पूरा हुआ'
          : status === STATUS.NO_SHOW
          ? 'आप उपस्थित नहीं हुए'
          : 'यह टोकन बंद है',
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
   * Counting this way is correct with any number of lanes and
   * whatever order the officers actually work in.
   */
  const waitingAhead = openPositions.filter(
    (p) => p < myPosition && !insidePositions.includes(p)
  ).length;

  const freeLanes = Math.max(0, lanes - insideCount);

  // Each lane clears roughly one vehicle per avgMinutesPerEntry.
  const etaMinutes = Math.round((waitingAhead * perEntry) / lanes);

  const insideNote =
    insideCount > 0 ? `अंदर ${insideCount} वाहन` : '';

  // Nothing has started at this centre today.
  if (openPositions.length === 0 && !nowServingToken) {
    return {
      level: 'waiting',
      tokensAhead: Math.max(0, myPosition - 1),
      nowServingToken: null,
      etaMinutes: Math.round(
        (Math.max(0, myPosition - 1) * perEntry) / lanes
      ),
      headline: 'कतार अभी शुरू नहीं हुई',
      detail: `आपका टोकन ${booking?.tokenNumber || ''}`,
    };
  }

  // A lane is free and nobody is ahead of me in the waiting line.
  if (waitingAhead < freeLanes) {
    return {
      level: 'go',
      tokensAhead: waitingAhead,
      nowServingToken,
      etaMinutes: 0,
      headline: 'गेट पर पहुंचें - आपकी बारी है',
      detail: nowServingToken
        ? `अभी टोकन ${nowServingToken} चल रहा है • ${insideNote}`
        : 'गेट खाली है',
    };
  }

  if (waitingAhead <= 2) {
    return {
      level: 'ready',
      tokensAhead: waitingAhead,
      nowServingToken,
      etaMinutes,
      headline: 'तैयार हो जाइए',
      detail: `आपसे पहले ${waitingAhead} किसान${
        insideNote ? ' • ' + insideNote : ''
      }`,
    };
  }

  return {
    level: 'waiting',
    tokensAhead: waitingAhead,
    nowServingToken,
    etaMinutes,
    headline: 'अभी समय है',
    detail: `आपसे पहले ${waitingAhead} किसान${
      insideNote ? ' • ' + insideNote : ''
    }`,
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
async function advanceStage(tokenId, patch, { entering = false } = {}) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);

  return runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bookingRef);

    if (!bSnap.exists()) {
      throw new Error('Token not found');
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

    if (entering && !insidePositions.includes(position)) {
      insidePositions.push(position);
    }

    if (isClosing) {
      openPositions = openPositions.filter((p) => p !== position);
      insidePositions = insidePositions.filter((p) => p !== position);
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
      completedCount: isClosing
        ? (Number(data.completedCount) || 0) + 1
        : Number(data.completedCount) || 0,
      updatedAt: serverTimestamp(),
    });

    return { ...booking, ...patch };
  });
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
  const patch = {
    status: STATUS.IN_GATE,
    gateEntryAt: new Date().toISOString(),
    actualAppearedTime: clockTime(),
    gatePassVerifiedBy: verifiedBy,
  };

  if (String(vehicleNumber).trim()) {
    patch.vehicleNumber = String(vehicleNumber).toUpperCase().trim();
  }

  return advanceStage(tokenId, patch, { entering: true });
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
 * Weighbridge officer: record gross and tare, derive net.
 */
export async function recordWeighing(
  tokenId,
  { grossWeightQuintals, tareWeightQuintals }
) {
  const gross = parseFloat(grossWeightQuintals) || 0;
  const tare = parseFloat(tareWeightQuintals) || 0;
  const net = Math.round((gross - tare) * 100) / 100;

  if (net <= 0) {
    throw new Error('शुद्ध वजन शून्य से अधिक होना चाहिए।');
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
export async function markPaid(
  tokenId,
  { actualQuantity, ratePerQuintal, grade }
) {
  if (!tokenId) throw new Error('Token ID is required');

  const bookingRef = doc(db, 'bookings', tokenId);
  const snapshot = await getDoc(bookingRef);

  if (!snapshot.exists()) {
    throw new Error('Token not found');
  }

  const booking = snapshot.data();
  const centre = await fetchCentreById(booking.centreId);

  if (!centre) {
    throw new Error('Mandi centre not found');
  }

  const quantity =
    parseFloat(actualQuantity) || parseFloat(booking.actualQuantity) || 0;

  const rate = parseFloat(ratePerQuintal) || 0;

  if (quantity <= 0) throw new Error('Valid quantity is required');
  if (rate <= 0) throw new Error('Valid rate is required');

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
  };

  return advanceStage(tokenId, patch);
}

/**
 * Officer: farmer never turned up.
 */
export async function markNoShow(tokenId) {
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

    if (!bSnap.exists()) throw new Error('Token not found');

    const booking = bSnap.data();

    if (booking.status !== STATUS.BOOKED) {
      throw new Error('यह बुकिंग अब रद्द नहीं की जा सकती।');
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
      icon: 'enter-outline',
      statuses: [STATUS.BOOKED],
      action: 'gate',
      actionLabel: 'गेट प्रवेश',
    },
  ],

  weighbridge: [
    {
      id: 'assay',
      title: 'गुणवत्ता जांच',
      subtitle: 'नमी, ग्रेड और अन्य पदार्थ',
      icon: 'flask-outline',
      statuses: [STATUS.IN_GATE],
      action: 'Assay',
      actionLabel: 'जांच करें',
    },
    {
      id: 'weighing',
      title: 'तौल',
      subtitle: 'भरा और खाली वाहन का वजन',
      icon: 'scale-outline',
      statuses: [STATUS.ASSAY],
      action: 'Weighing',
      actionLabel: 'तौल करें',
    },
  ],

  accounts: [
    {
      id: 'payment',
      title: 'भुगतान',
      subtitle: 'कटौती और रसीद',
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
  ...DUTY_STAGES.weighbridge,
  ...DUTY_STAGES.accounts,
];

export function getStagesForDuty(duty) {
  return DUTY_STAGES[duty] || DUTY_STAGES.admin;
}

export function getStageById(stageId) {
  return DUTY_STAGES.admin.find((s) => s.id === stageId) || null;
}
