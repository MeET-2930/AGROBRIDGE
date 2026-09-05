const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const twilio = require("twilio");

setGlobalOptions({maxInstances: 10});

initializeApp();

const db = getFirestore();

/**
 * Normalize phone number.
 */
function normalizePhone(phone) {
  return String(phone || "")
      .replace(/\D/g, "")
      .slice(-10);
}

/**
 * Crop list.
 */
const CROP_LIST = [
  {id: "wheat", name: "गेहूँ (Wheat)"},
  {id: "paddy", name: "धान (Paddy)"},
  {id: "mustard", name: "सरसों (Mustard)"},
  {id: "cotton", name: "कपास (Cotton)"},
  {id: "maize", name: "मक्का (Maize)"},
  {id: "gram", name: "चना (Gram)"},
];

/**
 * Fetch active mandi centres from Firestore.
 */
async function fetchCentres() {
  const snapshot =
    await db.collection("centres").get();

  const order = [
    "centre_farrukhnagar_05",
    "centre_gurugram_01",
    "centre_pataudi_04",
    "centre_rewari_03",
    "centre_sohna_02",
  ];

  return snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      .filter(
          (centre) =>
            centre.active !== false,
      )
      .sort((a, b) => {
        const aIndex = order.indexOf(a.id);
        const bIndex = order.indexOf(b.id);

        if (aIndex === -1 && bIndex === -1) {
          return String(a.name || "")
              .localeCompare(
                  String(b.name || ""),
              );
        }

        if (aIndex === -1) {
          return 1;
        }

        if (bIndex === -1) {
          return -1;
        }

        return aIndex - bIndex;
      });
}

/**
 * Fetch one mandi by ID.
 */
async function fetchCentreById(id) {
  if (!id) return null;

  const snapshot =
    await db
        .collection("centres")
        .doc(id)
        .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/**
 * Calculate capacity per 60-minute window.
 */
function capacityPerWindow(centre) {
  const perEntry =
    Number(
        centre?.avgMinutesPerEntry,
    ) || 15;

  const lanes =
    Number(
        centre?.parallelLanes,
    ) || 1;

  return Math.max(
      1,
      Math.floor(
          (60 / perEntry) * lanes,
      ),
  );
}

/**
 * Convert queue position into token number.
 *
 * 1  -> A-01
 * 20 -> A-20
 * 21 -> B-01
 */
function tokenLabel(position) {
  const letter =
    String.fromCharCode(
        65 +
        Math.floor(
            (position - 1) / 20,
        ),
    );

  const number =
    String(
        ((position - 1) % 20) + 1,
    ).padStart("0", 2);

  return `${letter}-${number}`;
}

/**
 * Format hour as 12-hour time.
 */
function formatHour(hour) {
  const ampm =
    hour >= 12 ? "PM" : "AM";

  const hour12 =
    hour % 12 === 0 ?
      12 :
      hour % 12;

  return `${hour12}:00 ${ampm}`;
}

/**
 * Fetch available slots.
 */
async function fetchAvailableSlots(
    centreId,
    dateStr,
) {
  const centre =
    await fetchCentreById(
        centreId,
    );

  if (!centre) {
    throw new Error(
        "Mandi centre not found",
    );
  }

  const capacity =
    capacityPerWindow(centre);

  const queueDocId =
    `${centreId}__${dateStr}`;

  const queueSnap =
    await db
        .collection("centreQueues")
        .doc(queueDocId)
        .get();

  const slotCounts =
    queueSnap.exists ?
      queueSnap.data().slotCounts || {} :
      {};

  const [startHour] =
    String(
        centre.operatingStartTime ||
        "08:00",
    )
        .split(":")
        .map(Number);

  const [endHour] =
    String(
        centre.operatingEndTime ||
        "18:00",
    )
        .split(":")
        .map(Number);

  const slots = [];

  for (
    let hour = startHour;
    hour < endHour;
    hour++
  ) {
    const slotTime =
      `${String(hour).padStart(2, "0")}:00`;

    const bookedCount =
      Number(
          slotCounts[slotTime],
      ) || 0;

    const availableCapacity =
      Math.max(
          0,
          capacity - bookedCount,
      );

    slots.push({
      slotTime,

      windowLabel:
        `${formatHour(hour)} - ${formatHour(hour + 1)}`,

      totalCapacity:
        capacity,

      bookedCount,

      availableCapacity,

      isFull:
        availableCapacity === 0,
    });
  }

  return {
    centre,
    date: dateStr,
    slots,
  };
}

/**
 * Create booking in Firestore.
 *
 * This is the server-side equivalent of
 * services/bookings.js.
 *
 * callSid is used as an idempotency key so
 * the same Twilio call cannot create the
 * same booking twice.
 */
async function createBookingFromIvr({
  farmerId,
  farmerName,
  farmerPhone,
  centreId,
  crop,
  cropName,
  quantity,
  date,
  slotTime,
  slotWindow,
  callSid,
}) {
  if (!farmerId) {
    throw new Error(
        "FARMER_REQUIRED",
    );
  }

  if (!centreId) {
    throw new Error(
        "CENTRE_REQUIRED",
    );
  }

  if (!crop) {
    throw new Error(
        "CROP_REQUIRED",
    );
  }

  if (!date || !slotTime) {
    throw new Error(
        "DATE_SLOT_REQUIRED",
    );
  }

  if (
    !Number.isSafeInteger(
        quantity,
    ) ||
    quantity <= 0 ||
    quantity > 999
  ) {
    throw new Error(
        "INVALID_QUANTITY",
    );
  }

  if (!callSid) {
    throw new Error(
        "CALL_SID_REQUIRED",
    );
  }

  const centre =
    await fetchCentreById(
        centreId,
    );

  if (!centre) {
    throw new Error(
        "CENTRE_NOT_FOUND",
    );
  }

  const capacity =
    capacityPerWindow(centre);

  const queueDocId =
    `${centreId}__${date}`;

  const queueRef =
    db
        .collection("centreQueues")
        .doc(queueDocId);

  /*
   * Twilio CallSid is stable for the entire
   * phone call, so it works as our idempotency key.
   */
  const idempotencyRef =
    db
        .collection("ivrIdempotency")
        .doc(callSid);

  const tokenId =
    `TKN-${Date.now()}-${Math.floor(
        Math.random() * 1000,
    )}`;

  const bookingRef =
    db
        .collection("bookings")
        .doc(tokenId);

  const gatePassCode =
    String(
        Math.floor(
            100000 +
            Math.random() * 900000,
        ),
    );

  const booking =
    await db.runTransaction(
        async (tx) => {
          /*
           * IMPORTANT:
           * Read idempotency first, inside the
           * same transaction as the booking.
           */
          const idempotencySnap =
            await tx.get(
                idempotencyRef,
            );

          if (idempotencySnap.exists) {
            const existing =
              idempotencySnap.data();

            if (existing.bookingId) {
              const existingBookingRef =
                db
                    .collection("bookings")
                    .doc(existing.bookingId);

              const existingBookingSnap =
                await tx.get(
                    existingBookingRef,
                );

              if (
                existingBookingSnap.exists
              ) {
                return existingBookingSnap.data();
              }
            }

            throw new Error(
                "DUPLICATE_CALL",
            );
          }

          const queueSnap =
            await tx.get(
                queueRef,
            );

          const queue =
            queueSnap.exists ?
              queueSnap.data() :
              {
                centreId,
                date,
                centreName:
                  centre.name,

                avgMinutesPerEntry:
                  Number(
                      centre.avgMinutesPerEntry,
                  ) || 15,

                parallelLanes:
                  Number(
                      centre.parallelLanes,
                  ) || 1,

                nowServingPosition:
                  null,

                nowServingToken:
                  null,

                nowServingStatus:
                  null,

                lastIssuedPosition:
                  0,

                totalBooked:
                  0,

                completedCount:
                  0,

                openPositions:
                  [],

                insidePositions:
                  [],

                slotCounts:
                  {},
              };

          const slotCounts = {
            ...(queue.slotCounts || {}),
          };

          const usedInSlot =
            Number(
                slotCounts[slotTime],
            ) || 0;

          /*
           * IMPORTANT:
           * Re-check capacity inside transaction.
           */
          if (
            usedInSlot >= capacity
          ) {
            throw new Error(
                "SLOT_FULL",
            );
          }

          const position =
            (Number(
                queue.lastIssuedPosition,
            ) || 0) + 1;

          const tokenNumber =
            tokenLabel(position);

          slotCounts[slotTime] =
            usedInSlot + 1;

          const [slotHour, slotMinute] =
            String(slotTime)
                .split(":")
                .map(Number);

          const lanes =
            Number(
                centre.parallelLanes,
            ) || 1;

          const perEntry =
            Number(
                centre.avgMinutesPerEntry,
            ) || 15;

          const offsetMinutes =
            Math.round(
                (usedInSlot * perEntry) /
                lanes,
            );

          const turn =
            new Date(
                `${date}T${String(
                    slotHour,
                ).padStart(2, "0")}:${String(
                    slotMinute || 0,
                ).padStart(2, "0")}:00+05:30`,
            );

          turn.setMinutes(
              turn.getMinutes() +
              offsetMinutes,
          );

          const estimatedTurnTime =
            turn.toLocaleTimeString(
                "en-IN",
                {
                  timeZone:
                    "Asia/Kolkata",

                  hour: "2-digit",

                  minute: "2-digit",

                  hour12: true,
                },
            );

          const record = {
            tokenId,

            tokenNumber,

            positionAssigned:
              position,

            farmerId,

            farmerName:
              farmerName || "",

            farmerPhone:
              farmerPhone || "",

            /*
             * Farmer does NOT enter vehicle number.
             * Gate officer handles this later.
             */
            vehicleNumber:
              "",

            approxQuantityQuintals:
              quantity,

            centreId,

            centreName:
              centre.name,

            centreAddress:
              centre.address || "",

            crop,

            cropName:
              cropName || crop,

            date,

            slotTime,

            slotWindow:
              slotWindow ||
              `${slotTime} Window`,

            status:
              "booked",

            gatePassCode,

            gatePassQr:
              `AGB|${tokenId}|${gatePassCode}`,

            gatePassVerifiedBy:
              null,

            estimatedTurnTime,

            gateEntryAt:
              null,

            assayAt:
              null,

            weighedAt:
              null,

            paidAt:
              null,

            moisturePercent:
              null,

            foreignMatterPercent:
              null,

            grade:
              null,

            assayNotes:
              "",

            grossWeightQuintals:
              null,

            tareWeightQuintals:
              null,

            actualQuantity:
              null,

            priceMode:
              null,

            priceFixedAt:
              null,

            buyerId:
              null,

            buyerName:
              null,

            ratePerQuintal:
              null,

            grossAmount:
              null,

            mandiFee:
              null,

            commission:
              null,

            hamali:
              null,

            netPayable:
              null,

            receiptId:
              null,

            receiptGeneratedAt:
              null,

            paymentReference:
              null,

            delayOffsetMinutes:
              0,

            delayReason:
              "",

            createdAt:
              new Date().toISOString(),

            /*
             * Store the originating Twilio call
             * for debugging/idempotency tracing.
             */
            callSid,
          };

          tx.set(
              bookingRef,
              record,
          );

          /*
           * Store the relationship between this
           * Twilio call and the booking.
           *
           * Because this is in the same transaction,
           * either both booking + idempotency record
           * are committed or neither is.
           */
          tx.set(
              idempotencyRef,
              {
                bookingId:
                  tokenId,

                callSid,

                farmerId,

                createdAt:
                  FieldValue.serverTimestamp(),
              },
          );

          tx.set(
              queueRef,
              {
                ...queue,

                centreId,

                date,

                centreName:
                  centre.name,

                avgMinutesPerEntry:
                  Number(
                      centre.avgMinutesPerEntry,
                  ) || 15,

                parallelLanes:
                  lanes,

                lastIssuedPosition:
                  position,

                totalBooked:
                  (Number(
                      queue.totalBooked,
                  ) || 0) + 1,

                openPositions: [
                  ...(queue.openPositions || []),
                  position,
                ],

                insidePositions:
                  queue.insidePositions ||
                  [],

                slotCounts,

                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              },
          );

          return record;
        },
    );

  return booking;
}

/**
 * IVR translations.
 */
const prompts = {
  en: {
    languageWelcome:
      "Welcome to AgroBridge. For English, press 1. For Hindi, press 2.",

    invalidLanguage:
      "Invalid selection. Please call again and press 1 for English or 2 for Hindi.",

    existingUser: (name) =>
      `Welcome back to AgroBridge, ${name || "farmer"}.`,

    newUser:
      "We could not find your account. We will register you now.",

    askName:
      "Please tell us your name after the beep.",

    mainMenu:
      "Press 1 to book a mandi slot. Press 2 to check your existing booking.",

    bookSelected:
      "You selected mandi slot booking.",

    selectMandi:
      "Please select your mandi.",

    selectedMandi: (name) =>
      `You selected ${name}.`,

    selectCrop:
      "Please select the crop you are bringing.",

    selectedCrop: (name) =>
      `You selected ${name}.`,

    selectDate:
      "Please select the day.",

    selectedDate: (date) =>
      `You selected ${date}.`,

    selectSlot:
      "Please select an available time slot.",

    selectedSlot: (slot) =>
      `You selected the ${slot} time slot.`,

    selectQuantity:
      "Please enter the approximate quantity of your crop in quintals, from 1 to 999, then press the hash key.",

    selectedQuantity: (quantity) =>
      `You entered ${quantity} quintals.`,

    invalidQuantity:
      "Sorry, please enter a whole number from 1 to 999, then press the hash key.",

    confirmation:
      (mandi, crop, date, slot, quantity) =>
        `You selected ${mandi}, ${crop}, ${date}, ${slot}, with a quantity of ${quantity} quintals. Press 1 to confirm or press 2 to cancel.`,

    bookingConfirmed:
      (token, turnTime) =>
        `Your booking is confirmed. Your token number is ${token}. Your estimated turn is at ${turnTime}.`,

    gatePass:
      (code) =>
        `Your gate pass code is ${code}. Please keep it safe.`,

    bookingCancelled:
      "Your booking has been cancelled. Goodbye.",

    invalidConfirmation:
      "Sorry, that was not a valid option. Press 1 to confirm or press 2 to cancel.",

    slotJustFilled:
      "Sorry, this slot was just filled. Please start a new booking and choose another time.",

    noSlots:
      "Sorry, there are no available time slots for this date. Please choose another date.",

    invalidDate:
      "Sorry, that was not a valid day option.",

    invalidSlot:
      "Sorry, that was not a valid or available time slot.",

    existingBooking:
      "You selected existing booking. Booking lookup will be added in the next step.",

    invalidMenu:
      "Sorry, that was not a valid option.",

    invalidMandi:
      "Sorry, that was not a valid mandi option.",

    invalidCrop:
      "Sorry, that was not a valid crop option.",

    noMandis:
      "Sorry, no mandis are currently available. Goodbye.",

    noCrops:
      "Sorry, no crops are currently accepted at this mandi. Goodbye.",

    mandiUnavailable:
      "Sorry, that mandi is no longer available.",

    error:
      "Sorry, something went wrong. Please try again later.",
  },

  hi: {
    languageWelcome:
      "एग्रोब्रिज में आपका स्वागत है। अंग्रेज़ी के लिए 1 दबाएं। हिंदी के लिए 2 दबाएं।",

    invalidLanguage:
      "गलत विकल्प। कृपया दोबारा कॉल करें और अंग्रेज़ी के लिए 1 या हिंदी के लिए 2 दबाएं।",

    existingUser: (name) =>
      `एग्रोब्रिज में आपका फिर से स्वागत है, ${name || "किसान"}।`,

    newUser:
      "हमें आपका खाता नहीं मिला। हम अभी आपका पंजीकरण करेंगे।",

    askName:
      "कृपया बीप के बाद अपना नाम बताएं।",

    mainMenu:
      "मंडी स्लॉट बुक करने के लिए 1 दबाएं। अपनी मौजूदा बुकिंग देखने के लिए 2 दबाएं।",

    bookSelected:
      "आपने मंडी स्लॉट बुकिंग चुनी है।",

    selectMandi:
      "कृपया अपनी मंडी चुनें।",

    selectedMandi: (name) =>
      `आपने ${name} चुनी है।`,

    selectCrop:
      "कृपया अपनी फसल चुनें।",

    selectedCrop: (name) =>
      `आपने ${name} चुनी है।`,

    selectDate:
      "कृपया दिन चुनें।",

    selectedDate: (date) =>
      `आपने ${date} चुना है।`,

    selectSlot:
      "कृपया उपलब्ध समय चुनें।",

    selectedSlot: (slot) =>
      `आपने ${slot} का समय चुना है।`,

    selectQuantity:
      "कृपया अपनी फसल की अनुमानित मात्रा क्विंटल में, 1 से 999 तक, दर्ज करें और फिर हैश दबाएं।",

    selectedQuantity: (quantity) =>
      `आपने ${quantity} क्विंटल दर्ज किए हैं।`,

    invalidQuantity:
      "क्षमा करें, कृपया 1 से 999 तक पूरी संख्या दर्ज करें और फिर हैश दबाएं।",

    confirmation:
      (mandi, crop, date, slot, quantity) =>
        `आपने ${mandi}, ${crop}, ${date}, ${slot} और ${quantity} क्विंटल मात्रा चुनी है। पुष्टि करने के लिए 1 दबाएं या रद्द करने के लिए 2 दबाएं।`,

    bookingConfirmed:
      (token, turnTime) =>
        `आपकी बुकिंग सफल हो गई है। आपका टोकन नंबर ${token} है। आपकी अनुमानित बारी ${turnTime} पर है।`,

    gatePass:
      (code) =>
        `आपका गेट पास कोड ${code} है। कृपया इसे संभालकर रखें।`,

    bookingCancelled:
      "आपकी बुकिंग रद्द कर दी गई है। अलविदा।",

    invalidConfirmation:
      "क्षमा करें, यह मान्य विकल्प नहीं है। पुष्टि करने के लिए 1 या रद्द करने के लिए 2 दबाएं।",

    slotJustFilled:
      "क्षमा करें, यह स्लॉट अभी-अभी भर गया है। कृपया दोबारा बुकिंग करके दूसरा समय चुनें।",

    noSlots:
      "क्षमा करें, इस दिन कोई समय उपलब्ध नहीं है। कृपया दूसरा दिन चुनें।",

    invalidDate:
      "क्षमा करें, यह मान्य दिन विकल्प नहीं है।",

    invalidSlot:
      "क्षमा करें, यह मान्य या उपलब्ध समय विकल्प नहीं है।",

    existingBooking:
      "आपने मौजूदा बुकिंग चुनी है। बुकिंग की जानकारी अगले चरण में जोड़ी जाएगी।",

    invalidMenu:
      "क्षमा करें, यह मान्य विकल्प नहीं है।",

    invalidMandi:
      "क्षमा करें, यह मान्य मंडी विकल्प नहीं है।",

    invalidCrop:
      "क्षमा करें, यह मान्य फसल विकल्प नहीं है।",

    noMandis:
      "क्षमा करें, अभी कोई मंडी उपलब्ध नहीं है। अलविदा।",

    noCrops:
      "क्षमा करें, इस मंडी में अभी कोई फसल स्वीकार नहीं की जा रही है। अलविदा।",

    mandiUnavailable:
      "क्षमा करें, यह मंडी अब उपलब्ध नहीं है।",

    error:
      "क्षमा करें, कुछ समस्या हो गई है। कृपया बाद में दोबारा प्रयास करें।",
  },
};

/**
 * Add mandi options.
 */
function addMandiOptions(
    gather,
    centres,
    language,
) {
  const t =
    prompts[language];

  gather.say(
      t.selectMandi,
  );

  centres
      .slice(0, 9)
      .forEach(
          (centre, index) => {
            gather.say(
                language === "hi" ?
                  `${index + 1} दबाएं ${centre.name} के लिए।` :
                  `Press ${index + 1} for ${centre.name}.`,
            );
          },
      );
}

/**
 * Add crop options.
 */
function addCropOptions(
    gather,
    crops,
    language,
) {
  const t =
    prompts[language];

  gather.say(
      t.selectCrop,
  );

  crops
      .slice(0, 9)
      .forEach(
          (crop, index) => {
            gather.say(
                language === "hi" ?
                  `${index + 1} दबाएं ${crop.name} के लिए।` :
                  `Press ${index + 1} for ${crop.name}.`,
            );
          },
      );
}

/**
 * Get next three date options.
 */
function getDateOptions(language) {
  const now =
    new Date();

  const istDate =
    new Date(
        now.toLocaleString(
            "en-US",
            {
              timeZone:
                "Asia/Kolkata",
            },
        ),
    );

  return [1, 2, 3].map(
      (daysAhead) => {
        const date =
          new Date(
              istDate,
          );

        date.setDate(
            date.getDate() +
            daysAhead,
        );

        const year =
          date.getFullYear();

        const month =
          String(
              date.getMonth() + 1,
          ).padStart(
              2,
              "0",
          );

        const day =
          String(
              date.getDate(),
          ).padStart(
              2,
              "0",
          );

        return {
          value:
            `${year}-${month}-${day}`,

          label:
            date.toLocaleDateString(
                language === "hi" ?
                  "hi-IN" :
                  "en-IN",
                {
                  weekday:
                    "long",

                  day:
                    "numeric",

                  month:
                    "long",
                },
            ),
        };
      },
  );
}

/**
 * Add date options.
 */
function addDateOptions(
    gather,
    language,
) {
  const t =
    prompts[language];

  const dateOptions =
    getDateOptions(
        language,
    );

  gather.say(
      t.selectDate,
  );

  dateOptions.forEach(
      (option, index) => {
        gather.say(
            language === "hi" ?
              `${index + 1} दबाएं, ${option.label} के लिए।` :
              `Press ${index + 1} for ${option.label}.`,
        );
      },
  );

  return dateOptions;
}

/**
 * Add available slot options.
 */
function addSlotOptions(
    gather,
    slots,
    language,
) {
  const t =
    prompts[language];

  gather.say(
      t.selectSlot,
  );

  const availableSlots =
    slots
        .filter(
            (slot) =>
              !slot.isFull &&
              slot.availableCapacity > 0,
        )
        .slice(0, 9);

  availableSlots.forEach(
      (slot, index) => {
        gather.say(
            language === "hi" ?
              `${index + 1} दबाएं, ${slot.windowLabel} के लिए।` :
              `Press ${index + 1} for ${slot.windowLabel}.`,
        );
      },
  );

  return availableSlots;
}

/**
 * AgroBridge IVR.
 */
exports.ivr = onRequest(
    async (req, res) => {
      const response =
        new twilio.twiml.VoiceResponse();

      try {
        const step =
          req.query.step ||
          "language";

        const language =
          req.query.lang === "hi" ?
            "hi" :
            "en";

        logger.info(
            "IVR request",
            {
              step,
              language,
              from:
                req.body.From,
              callSid:
                req.body.CallSid,
              digits:
                req.body.Digits,
              centreId:
                req.query.centreId,
              cropId:
                req.query.cropId,
              date:
                req.query.date,
              slotTime:
                req.query.slotTime,
            },
        );

        // -------------------------------------------------------
        // STEP 0: Language
        // -------------------------------------------------------

        if (
          step ===
          "language"
        ) {
          const gather =
            response.gather(
                {
                  input:
                    "dtmf",

                  numDigits:
                    1,

                  action:
                    "?step=languageSelection",

                  method:
                    "POST",
                },
            );

          gather.say(
              prompts.en.languageWelcome,
          );

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 1: Language result
        // -------------------------------------------------------

        if (
          step ===
          "languageSelection"
        ) {
          const digit =
            req.body.Digits;

          let selectedLanguage;

          if (
            digit === "1"
          ) {
            selectedLanguage =
              "en";
          } else if (
            digit === "2"
          ) {
            selectedLanguage =
              "hi";
          } else {
            response.say(
                prompts.en.invalidLanguage,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const t =
            prompts[
                selectedLanguage
            ];

          const callerPhone =
            normalizePhone(
                req.body.From,
            );

          if (!callerPhone) {
            response.say(
                t.error,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const userRef =
            db
                .collection("users")
                .doc(callerPhone);

          const userSnap =
            await userRef.get();

          if (
            userSnap.exists
          ) {
            const userData =
              userSnap.data();

            response.say(
                t.existingUser(
                    userData.name,
                ),
            );

            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=menu&lang=${selectedLanguage}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.mainMenu,
            );
          } else {
            response.say(
                t.newUser,
            );

            const gather =
              response.gather(
                  {
                    input:
                      "speech",

                    action:
                      `?step=newFarmerName&lang=${selectedLanguage}`,

                    method:
                      "POST",

                    speechTimeout:
                      "auto",

                    language:
                      selectedLanguage === "hi" ?
                        "hi-IN" :
                        "en-IN",
                  },
              );

            gather.say(
                t.askName,
            );
          }

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 1B: New farmer name registration
        // -------------------------------------------------------

        if (
          step ===
          "newFarmerName"
        ) {
          const callerPhone =
            normalizePhone(
                req.body.From,
            );

          const spokenName =
            String(
                req.body.SpeechResult ||
                "",
            ).trim();

          const t =
            prompts[language];

          if (
            !callerPhone ||
            !spokenName
          ) {
            const retry =
              response.gather(
                  {
                    input:
                      "speech",

                    action:
                      `?step=newFarmerName&lang=${language}`,

                    method:
                      "POST",

                    speechTimeout:
                      "auto",

                    language:
                      language === "hi" ?
                        "hi-IN" :
                        "en-IN",
                  },
              );

            retry.say(
                t.askName,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const userRef =
            db
                .collection("users")
                .doc(callerPhone);

          await userRef.set(
              {
                phone:
                  callerPhone,

                role:
                  "farmer",

                name:
                  spokenName,

                isVerified:
                  false,

                createdAt:
                  new Date().toISOString(),
              },
              {
                merge:
                  true,
              },
          );

          logger.info(
              "New farmer registered",
              {
                phone:
                  callerPhone,

                name:
                  spokenName,
              },
          );

          response.say(
              t.existingUser(
                  spokenName,
              ),
          );

          const gather =
            response.gather(
                {
                  input:
                    "dtmf",

                  numDigits:
                    1,

                  action:
                    `?step=menu&lang=${language}`,

                  method:
                    "POST",
                },
            );

          gather.say(
              t.mainMenu,
          );

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 2: Main menu
        // -------------------------------------------------------

        if (
          step ===
          "menu"
        ) {
          const digit =
            req.body.Digits;

          const t =
            prompts[language];

          if (
            digit === "1"
          ) {
            response.say(
                t.bookSelected,
            );

            const centres =
              await fetchCentres();

            if (
              centres.length ===
              0
            ) {
              response.say(
                  t.noMandis,
              );
            } else {
              const gather =
                response.gather(
                    {
                      input:
                        "dtmf",

                      numDigits:
                        1,

                      action:
                        `?step=mandiSelection&lang=${language}`,

                      method:
                        "POST",
                    },
                );

              addMandiOptions(
                  gather,
                  centres,
                  language,
              );
            }
          } else if (
            digit === "2"
          ) {
            response.say(
                t.existingBooking,
            );
          } else {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=menu&lang=${language}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidMenu,
            );

            gather.say(
                t.mainMenu,
            );
          }

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 3: Mandi
        // -------------------------------------------------------

        if (
          step ===
          "mandiSelection"
        ) {
          const digit =
            req.body.Digits;

          const selectedNumber =
            Number.parseInt(
                digit,
                10,
            );

          const t =
            prompts[language];

          const centres =
            await fetchCentres();

          if (
            !Number.isInteger(
                selectedNumber,
            ) ||
            selectedNumber < 1 ||
            selectedNumber >
              Math.min(
                  centres.length,
                  9,
              )
          ) {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=mandiSelection&lang=${language}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidMandi,
            );

            addMandiOptions(
                gather,
                centres,
                language,
            );
          } else {
            const selectedCentre =
              centres[
                  selectedNumber - 1
              ];

            response.say(
                t.selectedMandi(
                    selectedCentre.name,
                ),
            );

            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=cropSelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          selectedCentre.id,
                      )}`,

                    method:
                      "POST",
                  },
              );

            const acceptedCropIds =
              Array.isArray(
                  selectedCentre.acceptedCrops,
              ) ?
                selectedCentre.acceptedCrops :
                [];

            const acceptedCrops =
              acceptedCropIds
                  .map(
                      (cropId) =>
                        CROP_LIST.find(
                            (crop) =>
                              crop.id ===
                              cropId,
                        ),
                  )
                  .filter(Boolean);

            if (
              acceptedCrops.length ===
              0
            ) {
              response.say(
                  t.noCrops,
              );
            } else {
              addCropOptions(
                  gather,
                  acceptedCrops,
                  language,
              );
            }
          }

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 4: Crop
        // -------------------------------------------------------

        if (
          step ===
          "cropSelection"
        ) {
          const digit =
            req.body.Digits;

          const selectedNumber =
            Number.parseInt(
                digit,
                10,
            );

          const centreId =
            req.query.centreId;

          const t =
            prompts[language];

          const selectedCentre =
            await fetchCentreById(
                centreId,
            );

          if (
            !selectedCentre ||
            selectedCentre.active ===
              false
          ) {
            response.say(
                t.mandiUnavailable,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const acceptedCropIds =
            Array.isArray(
                selectedCentre.acceptedCrops,
            ) ?
              selectedCentre.acceptedCrops :
              [];

          const acceptedCrops =
            acceptedCropIds
                .map(
                    (cropId) =>
                      CROP_LIST.find(
                          (crop) =>
                            crop.id ===
                            cropId,
                      ),
                )
                .filter(Boolean);

          if (
            !Number.isInteger(
                selectedNumber,
            ) ||
            selectedNumber < 1 ||
            selectedNumber >
              Math.min(
                  acceptedCrops.length,
                  9,
              )
          ) {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=cropSelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidCrop,
            );

            addCropOptions(
                gather,
                acceptedCrops,
                language,
            );
          } else {
            const selectedCrop =
              acceptedCrops[
                  selectedNumber - 1
              ];

            response.say(
                t.selectedCrop(
                    selectedCrop.name,
                ),
            );

            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=dateSelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}` +
                      `&cropId=${encodeURIComponent(
                          selectedCrop.id,
                      )}`,

                    method:
                      "POST",
                  },
              );

            addDateOptions(
                gather,
                language,
            );
          }

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 5: Date
        // -------------------------------------------------------

        if (
          step ===
          "dateSelection"
        ) {
          const digit =
            req.body.Digits;

          const selectedNumber =
            Number.parseInt(
                digit,
                10,
            );

          const centreId =
            req.query.centreId;

          const cropId =
            req.query.cropId;

          const t =
            prompts[language];

          const selectedCentre =
            await fetchCentreById(
                centreId,
            );

          if (
            !selectedCentre ||
            selectedCentre.active ===
              false
          ) {
            response.say(
                t.mandiUnavailable,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const acceptedCropIds =
            Array.isArray(
                selectedCentre.acceptedCrops,
            ) ?
              selectedCentre.acceptedCrops :
              [];

          const selectedCrop =
            CROP_LIST.find(
                (crop) =>
                  crop.id ===
                    cropId &&
                  acceptedCropIds.includes(
                      crop.id,
                  ),
            );

          if (!selectedCrop) {
            response.say(
                t.invalidCrop,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const dateOptions =
            getDateOptions(
                language,
            );

          if (
            !Number.isInteger(
                selectedNumber,
            ) ||
            selectedNumber < 1 ||
            selectedNumber >
              dateOptions.length
          ) {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=dateSelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}` +
                      `&cropId=${encodeURIComponent(
                          cropId,
                      )}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidDate,
            );

            addDateOptions(
                gather,
                language,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const selectedDate =
            dateOptions[
                selectedNumber - 1
            ];

          response.say(
              t.selectedDate(
                  selectedDate.label,
              ),
          );

          const availableData =
            await fetchAvailableSlots(
                centreId,
                selectedDate.value,
            );

          const availableSlots =
            availableData.slots.filter(
                (slot) =>
                  !slot.isFull &&
                  slot.availableCapacity > 0,
            );

          if (
            availableSlots.length ===
            0
          ) {
            response.say(
                t.noSlots,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const gather =
            response.gather(
                {
                  input:
                    "dtmf",

                  numDigits:
                    1,

                  action:
                    `?step=slotSelection&lang=${language}` +
                    `&centreId=${encodeURIComponent(
                        centreId,
                    )}` +
                    `&cropId=${encodeURIComponent(
                        cropId,
                    )}` +
                    `&date=${encodeURIComponent(
                        selectedDate.value,
                    )}`,

                  method:
                    "POST",
                },
            );

          addSlotOptions(
              gather,
              availableSlots,
              language,
          );

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 6: Slot
        // -------------------------------------------------------

        if (
          step ===
          "slotSelection"
        ) {
          const digit =
            req.body.Digits;

          const selectedNumber =
            Number.parseInt(
                digit,
                10,
            );

          const centreId =
            req.query.centreId;

          const cropId =
            req.query.cropId;

          const date =
            req.query.date;

          const t =
            prompts[language];

          if (
            !centreId ||
            !cropId ||
            !date
          ) {
            response.say(
                t.error,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const selectedCentre =
            await fetchCentreById(
                centreId,
            );

          if (
            !selectedCentre ||
            selectedCentre.active ===
              false
          ) {
            response.say(
                t.mandiUnavailable,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const acceptedCropIds =
            Array.isArray(
                selectedCentre.acceptedCrops,
            ) ?
              selectedCentre.acceptedCrops :
              [];

          const selectedCrop =
            CROP_LIST.find(
                (crop) =>
                  crop.id ===
                    cropId &&
                  acceptedCropIds.includes(
                      crop.id,
                  ),
            );

          if (!selectedCrop) {
            response.say(
                t.invalidCrop,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const slotData =
            await fetchAvailableSlots(
                centreId,
                date,
            );

          const availableSlots =
            slotData.slots.filter(
                (slot) =>
                  !slot.isFull &&
                  slot.availableCapacity > 0,
            );

          if (
            !Number.isInteger(
                selectedNumber,
            ) ||
            selectedNumber < 1 ||
            selectedNumber >
              Math.min(
                  availableSlots.length,
                  9,
              )
          ) {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=slotSelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}` +
                      `&cropId=${encodeURIComponent(
                          cropId,
                      )}` +
                      `&date=${encodeURIComponent(
                          date,
                      )}`,

                    method:
                      "POST",
                  },
              );

            if (
              availableSlots.length ===
              0
            ) {
              gather.say(
                  t.noSlots,
              );
            } else {
              gather.say(
                  t.invalidSlot,
              );

              addSlotOptions(
                  gather,
                  availableSlots,
                  language,
              );
            }

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const selectedSlot =
            availableSlots[
                selectedNumber - 1
            ];

          if (
            selectedSlot.isFull ||
            selectedSlot.availableCapacity <=
              0
          ) {
            response.say(
                t.invalidSlot,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          response.say(
              t.selectedSlot(
                  selectedSlot.windowLabel,
              ),
          );

          const gather =
            response.gather(
                {
                  input:
                    "dtmf",

                  numDigits:
                    3,

                  finishOnKey:
                    "#",

                  action:
                    `?step=quantitySelection&lang=${language}` +
                    `&centreId=${encodeURIComponent(
                        centreId,
                    )}` +
                    `&cropId=${encodeURIComponent(
                        cropId,
                    )}` +
                    `&date=${encodeURIComponent(
                        date,
                    )}` +
                    `&slotTime=${encodeURIComponent(
                        selectedSlot.slotTime,
                    )}`,

                  method:
                    "POST",
                },
            );

          gather.say(
              t.selectQuantity,
          );

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 7: Quantity
        // -------------------------------------------------------

        if (
          step ===
          "quantitySelection"
        ) {
          const quantityInput =
            String(
                req.body.Digits || "",
            ).trim();

          const centreId =
            req.query.centreId;

          const cropId =
            req.query.cropId;

          const date =
            req.query.date;

          const slotTime =
            req.query.slotTime;

          const t =
            prompts[language];

          const isWholeNumber =
            /^\d+$/.test(
                quantityInput,
            );

          const quantity =
            Number.parseInt(
                quantityInput,
                10,
            );

          if (
            !isWholeNumber ||
            !Number.isSafeInteger(
                quantity,
            ) ||
            quantity <= 0 ||
            quantity > 999
          ) {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      3,

                    finishOnKey:
                      "#",

                    action:
                      `?step=quantitySelection&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}` +
                      `&cropId=${encodeURIComponent(
                          cropId,
                      )}` +
                      `&date=${encodeURIComponent(
                          date,
                      )}` +
                      `&slotTime=${encodeURIComponent(
                          slotTime,
                      )}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidQuantity,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          if (
            !centreId ||
            !cropId ||
            !date ||
            !slotTime
          ) {
            response.say(
                t.error,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const selectedCentre =
            await fetchCentreById(
                centreId,
            );

          if (
            !selectedCentre ||
            selectedCentre.active ===
              false
          ) {
            response.say(
                t.mandiUnavailable,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const acceptedCropIds =
            Array.isArray(
                selectedCentre.acceptedCrops,
            ) ?
              selectedCentre.acceptedCrops :
              [];

          const selectedCrop =
            CROP_LIST.find(
                (crop) =>
                  crop.id ===
                    cropId &&
                  acceptedCropIds.includes(
                      crop.id,
                  ),
            );

          if (!selectedCrop) {
            response.say(
                t.invalidCrop,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const dateOptions =
            getDateOptions(
                language,
            );

          const selectedDateOption =
            dateOptions.find(
                (option) =>
                  option.value ===
                  date,
            );

          if (
            !selectedDateOption
          ) {
            response.say(
                t.invalidDate,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          /*
           * Re-check slot before confirmation.
           */
          const slotData =
            await fetchAvailableSlots(
                centreId,
                date,
            );

          const selectedSlot =
            slotData.slots.find(
                (slot) =>
                  slot.slotTime ===
                  slotTime,
            );

          if (
            !selectedSlot ||
            selectedSlot.isFull ||
            selectedSlot.availableCapacity <=
              0
          ) {
            response.say(
                t.invalidSlot,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          response.say(
              t.selectedQuantity(
                  quantity,
              ),
          );

          const confirmationGather =
            response.gather(
                {
                  input:
                    "dtmf",

                  numDigits:
                    1,

                  action:
                    `?step=confirmation&lang=${language}` +
                    `&centreId=${encodeURIComponent(
                        centreId,
                    )}` +
                    `&cropId=${encodeURIComponent(
                        cropId,
                    )}` +
                    `&date=${encodeURIComponent(
                        date,
                    )}` +
                    `&slotTime=${encodeURIComponent(
                        slotTime,
                    )}` +
                    `&quantity=${encodeURIComponent(
                        quantity,
                    )}`,

                  method:
                    "POST",
                },
            );

          confirmationGather.say(
              t.confirmation(
                  selectedCentre.name,
                  selectedCrop.name,
                  selectedDateOption.label,
                  selectedSlot.windowLabel,
                  quantity,
              ),
          );

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // STEP 8: Confirmation + ACTUAL BOOKING
        // -------------------------------------------------------

        if (
          step ===
          "confirmation"
        ) {
          const digit =
            req.body.Digits;

          const centreId =
            req.query.centreId;

          const cropId =
            req.query.cropId;

          const date =
            req.query.date;

          const slotTime =
            req.query.slotTime;

          const quantityInput =
            String(
                req.query.quantity || "",
            ).trim();

          const t =
            prompts[language];

          const quantity =
            Number.parseInt(
                quantityInput,
                10,
            );

          const validQuantity =
            /^\d+$/.test(
                quantityInput,
            ) &&
            Number.isSafeInteger(
                quantity,
            ) &&
            quantity > 0 &&
            quantity <= 999;

          if (
            !centreId ||
            !cropId ||
            !date ||
            !slotTime ||
            !validQuantity
          ) {
            response.say(
                t.error,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const selectedCentre =
            await fetchCentreById(
                centreId,
            );

          if (
            !selectedCentre ||
            selectedCentre.active ===
              false
          ) {
            response.say(
                t.mandiUnavailable,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const acceptedCropIds =
            Array.isArray(
                selectedCentre.acceptedCrops,
            ) ?
              selectedCentre.acceptedCrops :
              [];

          const selectedCrop =
            CROP_LIST.find(
                (crop) =>
                  crop.id ===
                    cropId &&
                  acceptedCropIds.includes(
                      crop.id,
                  ),
            );

          if (!selectedCrop) {
            response.say(
                t.invalidCrop,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const dateOptions =
            getDateOptions(
                language,
            );

          const selectedDateOption =
            dateOptions.find(
                (option) =>
                  option.value ===
                  date,
            );

          if (
            !selectedDateOption
          ) {
            response.say(
                t.invalidDate,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          const slotData =
            await fetchAvailableSlots(
                centreId,
                date,
            );

          const selectedSlot =
            slotData.slots.find(
                (slot) =>
                  slot.slotTime ===
                  slotTime,
            );

          if (
            !selectedSlot ||
            selectedSlot.isFull ||
            selectedSlot.availableCapacity <=
              0
          ) {
            response.say(
                t.slotJustFilled,
            );

            res.type(
                "text/xml",
            );

            res.send(
                response.toString(),
            );

            return;
          }

          if (
            digit === "1"
          ) {
            const callerPhone =
              normalizePhone(
                  req.body.From,
              );

            const callSid =
              String(
                  req.body.CallSid ||
                  "",
              ).trim();

            if (
              !callerPhone ||
              !callSid
            ) {
              response.say(
                  t.error,
              );

              res.type(
                  "text/xml",
              );

              res.send(
                  response.toString(),
              );

              return;
            }

            /*
             * Find farmer using caller ID.
             */
            const farmerRef =
              db
                  .collection("users")
                  .doc(callerPhone);

            const farmerSnap =
              await farmerRef.get();

            if (
              !farmerSnap.exists
            ) {
              response.say(
                  t.error,
              );

              res.type(
                  "text/xml",
              );

              res.send(
                  response.toString(),
              );

              return;
            }

            const farmerData =
              farmerSnap.data();

            try {
              /*
               * ACTUALLY CREATE THE BOOKING.
               *
               * CallSid is passed as the idempotency
               * key so repeated confirmation requests
               * from the same call don't create
               * duplicate bookings.
               */
              const booking =
                await createBookingFromIvr({
                  farmerId:
                    callerPhone,

                  farmerName:
                    farmerData.name ||
                    "",

                  farmerPhone:
                    callerPhone,

                  centreId,

                  crop:
                    selectedCrop.id,

                  cropName:
                    selectedCrop.name,

                  quantity,

                  date,

                  slotTime:
                    selectedSlot.slotTime,

                  slotWindow:
                    selectedSlot.windowLabel,

                  callSid,
                });

              logger.info(
                  "IVR booking created",
                  {
                    tokenId:
                      booking.tokenId,

                    tokenNumber:
                      booking.tokenNumber,

                    farmerId:
                      booking.farmerId,

                    centreId:
                      booking.centreId,

                    crop:
                      booking.crop,

                    date:
                      booking.date,

                    slotTime:
                      booking.slotTime,

                    quantity:
                      booking.approxQuantityQuintals,

                    callSid,
                  },
              );

              response.say(
                  t.bookingConfirmed(
                      booking.tokenNumber,
                      booking.estimatedTurnTime,
                  ),
              );

              response.say(
                  t.gatePass(
                      booking.gatePassCode,
                  ),
              );
            } catch (error) {
              logger.error(
                  "IVR booking creation failed",
                  error,
              );

              if (
                error.message ===
                "SLOT_FULL"
              ) {
                response.say(
                    t.slotJustFilled,
                );
              } else if (
                error.message ===
                "DUPLICATE_CALL"
              ) {
                response.say(
                    t.error,
                );
              } else {
                response.say(
                    t.error,
                );
              }
            }
          } else if (
            digit === "2"
          ) {
            response.say(
                t.bookingCancelled,
            );
          } else {
            const gather =
              response.gather(
                  {
                    input:
                      "dtmf",

                    numDigits:
                      1,

                    action:
                      `?step=confirmation&lang=${language}` +
                      `&centreId=${encodeURIComponent(
                          centreId,
                      )}` +
                      `&cropId=${encodeURIComponent(
                          cropId,
                      )}` +
                      `&date=${encodeURIComponent(
                          date,
                      )}` +
                      `&slotTime=${encodeURIComponent(
                          slotTime,
                      )}` +
                      `&quantity=${encodeURIComponent(
                          quantity,
                      )}`,

                    method:
                      "POST",
                  },
              );

            gather.say(
                t.invalidConfirmation,
            );

            gather.say(
                t.confirmation(
                    selectedCentre.name,
                    selectedCrop.name,
                    selectedDateOption.label,
                    selectedSlot.windowLabel,
                    quantity,
                ),
            );
          }

          res.type(
              "text/xml",
          );

          res.send(
              response.toString(),
          );

          return;
        }

        // -------------------------------------------------------
        // UNKNOWN STEP
        // -------------------------------------------------------

        response.say(
            prompts[language].error,
        );

        res.type(
            "text/xml",
        );

        res.send(
            response.toString(),
        );
      } catch (error) {
        logger.error(
            "IVR error",
            error,
        );

        const language =
          req.query.lang === "hi" ?
            "hi" :
            "en";

        response.say(
            prompts[language].error,
        );

        res.type(
            "text/xml",
        );

        res.send(
            response.toString(),
        );
      }
    },
);
