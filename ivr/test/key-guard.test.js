/**
 * ivr/test/key-guard.test.js
 * ---------------------------------------------------------------
 * MOCKED tests for the shared-secret guard used by /chat and
 * /translate (no server, no network). Proves that requests without
 * the app key are refused and that the rollout kill-switch works.
 *
 * Run: node --test test/key-guard.test.js
 * ---------------------------------------------------------------
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { makeKeyGuard, requiredByEnv } = require("../key-guard");

const quiet = { error() {} };

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

function mockReq(headers = {}) {
  return { get: (h) => headers[String(h).toLowerCase()] };
}

test("rejects a missing key with 401", () => {
  const guard = makeKeyGuard({ key: "k", enabled: true, logger: quiet });
  const res = mockRes();
  let nexted = false;
  guard(mockReq({}), res, () => {
    nexted = true;
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nexted, false);
});

test("rejects a wrong key with 401", () => {
  const guard = makeKeyGuard({ key: "k", enabled: true, logger: quiet });
  const res = mockRes();
  let nexted = false;
  guard(mockReq({ "x-agb-key": "nope" }), res, () => {
    nexted = true;
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nexted, false);
});

test("calls next() for a matching key", () => {
  const guard = makeKeyGuard({ key: "k", enabled: true, logger: quiet });
  const res = mockRes();
  let nexted = false;
  guard(mockReq({ "x-agb-key": "k" }), res, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
  assert.equal(res.statusCode, 200);
});

test("disabled guard always passes through (kill-switch)", () => {
  const guard = makeKeyGuard({ key: "k", enabled: false });
  const res = mockRes();
  let nexted = false;
  guard(mockReq({}), res, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});

test("fails closed (503) when no key is configured", () => {
  const guard = makeKeyGuard({ key: "", enabled: true, logger: quiet });
  const res = mockRes();
  let nexted = false;
  guard(mockReq({ "x-agb-key": "anything" }), res, () => {
    nexted = true;
  });
  assert.equal(res.statusCode, 503);
  assert.equal(nexted, false);
});

test("requiredByEnv: enforced unless explicitly false", () => {
  assert.equal(requiredByEnv({}), true);
  assert.equal(requiredByEnv({ CHATBOT_REQUIRE_KEY: "true" }), true);
  assert.equal(requiredByEnv({ CHATBOT_REQUIRE_KEY: "false" }), false);
  assert.equal(requiredByEnv({ CHATBOT_REQUIRE_KEY: "FALSE" }), false);
  assert.equal(requiredByEnv({ CHATBOT_REQUIRE_KEY: " no " }), true);
});
