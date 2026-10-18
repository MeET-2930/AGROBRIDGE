"use strict";

/**
 * ivr/key-guard.js
 * ---------------------------------------------------------------
 * Shared-secret guard for HTTP endpoints. The app sends the key in
 * the `x-agb-key` header; the server compares it with APP_SHARED_KEY
 * (the same mechanism already used by /call-me and /notify-next).
 *
 * NOT AUTHENTICATION: the key ships inside the client bundle, so it
 * only proves "the caller has the app", never *who the farmer is*.
 * The caller-supplied `phone` stays untrusted for personal data.
 * See ivr/README.md -> "Security limitations".
 *
 * Enforcement is OFF unless `CHATBOT_REQUIRE_KEY=true` (opt-in), so
 * the guard can never break clients that do not send the header yet.
 * Set `CHATBOT_REQUIRE_KEY=true` on the server once the app build that
 * sends x-agb-key is live. No secret value is ever logged.
 * ---------------------------------------------------------------
 */

const KEY_HEADER = "x-agb-key";

/** True only when CHATBOT_REQUIRE_KEY is explicitly "true". */
function requiredByEnv(env = process.env) {
  return String(env.CHATBOT_REQUIRE_KEY || "").trim().toLowerCase() === "true";
}

/**
 * Build an Express middleware requiring a matching key header.
 * @param {object}   opts
 * @param {string}   opts.key          expected shared key (APP_SHARED_KEY)
 * @param {boolean}  [opts.enabled]    enforce? (default true)
 * @param {string}   [opts.header]     header name (default x-agb-key)
 * @param {object}   [opts.logger]     warning sink (default console)
 * @returns {(req,res,next)=>void}
 */
function makeKeyGuard({ key, enabled = true, header = KEY_HEADER, logger = console } = {}) {
  return function keyGuard(req, res, next) {
    if (!enabled) return next();

    if (!key) {
      // Fail closed - never silently open the endpoint.
      if (logger) {
        logger.error("key-guard: APP_SHARED_KEY is not configured; refusing request");
      }
      return res.status(503).json({ error: "service not configured" });
    }

    const provided = typeof req.get === "function" ? req.get(header) : undefined;
    if (provided !== key) {
      return res.status(401).json({ error: "unauthorized" });
    }

    return next();
  };
}

module.exports = { makeKeyGuard, requiredByEnv, KEY_HEADER };
