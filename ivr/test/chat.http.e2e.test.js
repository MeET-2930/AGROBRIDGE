const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { generateKeyPairSync } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const IVR = path.resolve(__dirname, "..");
const PROJECT = "demo-agrobridge-e2e";
const PHONE = "9000000001";
const SESSION = "http-antigravity-session";
const ERROR_SESSION = "http-antigravity-error";
const CENTRE_ID = "centre_http_e2e";
const SLOT = "08:00";
const SHARED_KEY = "http-e2e-key";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required; refusing to use production Firebase");
}
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(EMULATOR_HOST)) {
  throw new Error(`Refusing non-local Firestore emulator host: ${EMULATOR_HOST}`);
}

const CENTRE = {
  name: "HTTP E2E Procurement Yard",
  name_en: "HTTP E2E Procurement Yard",
  address: "Sector 12, HTTP Test City",
  active: true,
  acceptedCrops: ["wheat", "mustard"],
  operatingStartTime: "08:00",
  operatingEndTime: "18:00",
  parallelLanes: 2,
  avgMinutesPerEntry: 15,
  closedDays: [0],
  throughputPerHour: { default: 400 },
};

function futureBookingDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const DATE = futureBookingDate();

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function interaction(id, status, steps, outputText = "") {
  return {
    id,
    status,
    steps,
    ...(outputText ? { output_text: outputText } : {}),
  };
}

function functionCall(id, callId, name, args) {
  return interaction(id, "requires_action", [
    { type: "function_call", id: callId, name, arguments: args },
  ]);
}

function completed(id, text) {
  return interaction(id, "completed", [
    { type: "model_output", content: [{ type: "text", text }] },
  ], text);
}

function resultOf(body) {
  const items = Array.isArray(body.input) ? body.input : [];
  return items.find((item) => item && item.type === "function_result") || null;
}

function startMock() {
  const requests = [];
  let nextId = 1;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");

    if (req.method !== "POST" || !String(req.url || "").includes("/interactions")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "invalid json" } }));
      return;
    }

    requests.push(body);
    const inputText = typeof body.input === "string" ? body.input : "";
    if (inputText.includes("__FAIL_ANTIGRAVITY_HTTP__")) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "simulated antigravity outage" } }));
      return;
    }

    const toolResult = resultOf(body);
    let payload;
    if (toolResult) {
      const parsed = JSON.parse(toolResult.result?.[0]?.text || "{}");
      if (toolResult.name === "getCentreInfo") {
        payload = completed(`mock_${nextId++}`, "The centre is HTTP E2E Procurement Yard.");
      } else if (toolResult.name === "getBookingSlots") {
        payload = completed(`mock_${nextId++}`, `The ${SLOT} slot is available.`);
      } else if (toolResult.name === "proposeBooking") {
        payload = completed(`mock_${nextId++}`, "Booking proposed. Please confirm.");
      } else if (toolResult.name === "confirmBooking") {
        assert.equal(parsed.ok, true);
        payload = completed(
          `mock_${nextId++}`,
          `Booking confirmed. Token ${parsed.booking.tokenNumber}.`
        );
      } else {
        payload = completed(`mock_${nextId++}`, "Tool completed.");
      }
    } else if (inputText.includes("centre information")) {
      payload = functionCall(
        `mock_${nextId++}`,
        `call_${nextId}`,
        "getCentreInfo",
        { centreId: CENTRE_ID }
      );
    } else if (inputText.includes("Which slots are available")) {
      payload = functionCall(
        `mock_${nextId++}`,
        `call_${nextId}`,
        "getBookingSlots",
        { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 10, date: DATE }
      );
    } else if (inputText.includes("Propose that booking")) {
      payload = functionCall(
        `mock_${nextId++}`,
        `call_${nextId}`,
        "proposeBooking",
        { centreId: CENTRE_ID, crop: "wheat", quantityQuintals: 10, date: DATE, slotTime: SLOT }
      );
    } else if (inputText.includes("Yes, confirm that booking")) {
      payload = functionCall(`mock_${nextId++}`, `call_${nextId}`, "confirmBooking", {});
    } else {
      payload = completed(`mock_${nextId++}`, "No scripted response.");
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, requests, port: server.address().port });
    });
  });
}

function serviceAccount() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return {
    type: "service_account",
    project_id: PROJECT,
    private_key_id: "http-e2e",
    private_key: privateKey,
    client_email: `http-e2e@${PROJECT}.iam.gserviceaccount.com`,
    client_id: "1",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/http-e2e%40${PROJECT}.iam.gserviceaccount.com`,
  };
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early (${child.exitCode})\n${output()}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not become healthy\n${output()}`);
}

async function postChat(baseUrl, body, key = SHARED_KEY) {
  const headers = { "content-type": "application/json" };
  if (key !== null) headers["x-agb-key"] = key;
  const res = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, body: await res.json() };
}

test("HTTP /chat runs the Antigravity booking flow against Firestore Emulator", { timeout: 120000 }, async (t) => {
  const mock = await startMock();
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let stdout = "";
  let stderr = "";

  const child = spawn(process.execPath, ["server.js"], {
    cwd: IVR,
    env: {
      ...process.env,
      PORT: String(port),
      PROVIDER: "sim",
      FIREBASE_SERVICE_ACCOUNT_B64: Buffer.from(JSON.stringify(serviceAccount())).toString("base64"),
      FIRESTORE_EMULATOR_HOST: EMULATOR_HOST,
      GCLOUD_PROJECT: PROJECT,
      GOOGLE_CLOUD_PROJECT: PROJECT,
      GEMINI_API_KEY: "http-e2e-not-used",
      GOOGLE_GEMINI_BASE_URL: `http://127.0.0.1:${mock.port}`,
      CHATBOT_PROVIDER: "antigravity",
      CHATBOT_ALLOW_BOOKING: "true",
      CHATBOT_REQUIRE_KEY: "true",
      APP_SHARED_KEY: SHARED_KEY,
      ANTIGRAVITY_MAX_TOTAL_TOKENS: "60000",
      ANTIGRAVITY_TIMEOUT_MS: "10000",
      ANTIGRAVITY_MAX_STEPS: "5",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  t.after(async () => {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await new Promise((resolve) => mock.server.close(resolve));
  });

  initializeApp({ projectId: PROJECT });
  const db = getFirestore();

  for (const name of [
    "users",
    "centres",
    "bookings",
    "centreQueues",
    "chatBookingIntents",
    "chatBookingSessions",
    "chatBookingLocks",
    "chatInteractionSessions",
  ]) {
    for (;;) {
      const snap = await db.collection(name).limit(100).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    }
  }

  await db.collection("users").doc(PHONE).set({ name: "HTTP E2E Farmer", phone: PHONE });
  await db.collection("centres").doc(CENTRE_ID).set(CENTRE);

  await waitForHealth(baseUrl, child, () => `${stdout}\n${stderr}`);

  const unauthorized = await postChat(baseUrl, { message: "hello", phone: PHONE }, null);
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(unauthorized.body, { error: "unauthorized" });

  const base = { phone: PHONE, sessionId: SESSION, history: [], language: "en" };

  const centre = await postChat(baseUrl, {
    ...base,
    message: "Show the centre information for centre_http_e2e.",
  });
  assert.equal(centre.status, 200);
  assert.deepEqual(Object.keys(centre.body).sort(), ["reply", "toolRounds", "toolsUsed"]);
  assert.deepEqual(centre.body.toolsUsed, ["getCentreInfo"]);
  assert.equal(centre.body.toolRounds, 1);
  assert.match(centre.body.reply, /HTTP E2E Procurement Yard/);

  const slots = await postChat(baseUrl, {
    ...base,
    message: `Which slots are available on ${DATE} for 10 quintals of wheat?`,
  });
  assert.equal(slots.status, 200);
  assert.deepEqual(slots.body.toolsUsed, ["getBookingSlots"]);
  assert.equal(slots.body.toolRounds, 1);
  assert.match(slots.body.reply, /08:00/);

  const beforeProposal = await db.collection("bookings").get();
  assert.equal(beforeProposal.size, 0);

  const proposal = await postChat(baseUrl, {
    ...base,
    message: `Propose that booking at ${SLOT}.`,
  });
  assert.equal(proposal.status, 200);
  assert.deepEqual(proposal.body.toolsUsed, ["proposeBooking"]);
  assert.equal(proposal.body.toolRounds, 1);
  assert.match(proposal.body.reply, /confirm/i);

  const beforeConfirmation = await db.collection("bookings").get();
  assert.equal(beforeConfirmation.size, 0);

  const confirmation = await postChat(baseUrl, {
    ...base,
    message: "Yes, confirm that booking.",
  });
  assert.equal(confirmation.status, 200);
  assert.deepEqual(confirmation.body.toolsUsed, ["confirmBooking"]);
  assert.equal(confirmation.body.toolRounds, 1);
  const tokenMatch = /Token\s+([A-Z]-\d{2})/.exec(confirmation.body.reply);
  assert.ok(tokenMatch, confirmation.body.reply);

  const bookings = await db.collection("bookings").get();
  assert.equal(bookings.size, 1);
  const booking = bookings.docs[0].data();
  assert.equal(booking.farmerId, PHONE);
  assert.equal(booking.centreId, CENTRE_ID);
  assert.equal(booking.date, DATE);
  assert.equal(booking.slotTime, SLOT);
  assert.equal(booking.tokenNumber, tokenMatch[1]);
  assert.equal(booking.status, "booked");

  const queueSnap = await db.collection("centreQueues").doc(`${CENTRE_ID}__${DATE}`).get();
  assert.equal(queueSnap.exists, true);
  const queue = queueSnap.data();
  assert.equal(queue.totalBooked, 1);
  assert.equal(queue.lastIssuedPosition, 1);

  const sessionSnap = await db.collection("chatBookingSessions").doc(`${PHONE}__${SESSION}`).get();
  assert.equal(sessionSnap.exists, true);
  assert.equal(sessionSnap.data().pendingIntentId, null);
  assert.equal(sessionSnap.data().lastBookingId, booking.tokenId);

  const interactionSnap = await db
    .collection("chatInteractionSessions")
    .doc(encodeURIComponent(`${PHONE}__${SESSION}`))
    .get();
  assert.equal(interactionSnap.exists, true);
  assert.match(interactionSnap.data().interactionId, /^mock_\d+$/);

  assert.equal(mock.requests.length, 8);
  assert.match(mock.requests[0].system_instruction, /AgroBridge Assistant/);
  assert.equal(mock.requests[0].previous_interaction_id, undefined);
  assert.equal(mock.requests[1].previous_interaction_id, "mock_1");
  assert.equal(mock.requests[2].previous_interaction_id, "mock_2");
  assert.equal(mock.requests[4].previous_interaction_id, "mock_4");
  assert.equal(mock.requests[6].previous_interaction_id, "mock_6");
  assert.equal(mock.requests[0].environment, "remote");
  assert.equal(mock.requests[0].agent_config.type, "antigravity");
  assert.ok(mock.requests[0].tools.every((tool) => tool.type === "function"));

  const failure = await postChat(baseUrl, {
    phone: PHONE,
    sessionId: ERROR_SESSION,
    history: [],
    language: "en",
    message: "__FAIL_ANTIGRAVITY_HTTP__",
  });
  assert.equal(failure.status, 500);
  assert.deepEqual(failure.body, {
    error: "Unable to get a response from AgroBridge Assistant",
  });
  assert.doesNotMatch(JSON.stringify(failure.body), /simulated|antigravity|ANTIGRAVITY/i);
});
