/*
 * services/chatbot.js
 * ---------------------------------------------------------------
 * Client for the AgroBridge Assistant (agentic Gemini chatbot with
 * live read-only Firestore tools on the backend).
 * Talks to the Render backend  ->  POST ${CHATBOT_BASE_URL}/chat
 * (services/config.js; production: https://agrobridge-ivr.onrender.com/chat)
 *
 *   in:  { message, history, phone, language }   out:  { reply, toolsUsed? }
 *
 * `phone` is the logged-in farmer's 10-digit phone (session uid).
 * It is optional: without it the assistant answers general FAQs.
 * The backend verifies it against Firestore and uses it as the ONLY
 * farmer identity for live tool calls (bookings, queue, payment).
 *
 * `history` is the list of prior chat messages in Gemini turn
 * format ({ role: 'user' | 'model', parts: [{ text }] }), built
 * from the same message objects the screen keeps.
 *
 * Best-effort: network/app errors throw a ChatError with a `.code`
 * the screen can show.
 * ---------------------------------------------------------------
 */

import { CHATBOT_BASE_URL, IVR_APP_KEY } from './config';

const CHATBOT_URL = `${CHATBOT_BASE_URL}/chat`;
const TRANSLATE_URL = `${CHATBOT_BASE_URL}/translate`;
const MAX_HISTORY = 10;

// Server-side shared-secret guard (same key as the IVR endpoints).
// Not strong auth - it only proves the caller has the app.
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'x-agb-key': IVR_APP_KEY };

export class ChatError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/**
 * Turn the screen's message list (role: 'user' | 'bot', optional
 * isGreeting) into a Gemini-style history that survives the API's
 * validation rules (must start with a user turn, alternate, and
 * the last turn must be complete - never a dangling user turn).
 */
export function buildHistory(messages = []) {
  const turns = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && !m.isGreeting && typeof m.text === 'string')
    .map((m) => ({
      role: m.role === 'bot' ? 'model' : 'user',
      parts: [{ text: m.text.trim() }],
    }))
    .filter((t) => t.parts[0].text.length > 0);

  // Drop any leading model turns (e.g. the greeting) so history starts with a user turn.
  let i = 0;
  while (i < turns.length && turns[i].role !== 'user') i += 1;
  const sliced = turns.slice(i);

  // Collapse accidental consecutive same-role turns into one.
  const alternated = [];
  for (const turn of sliced) {
    const last = alternated[alternated.length - 1];
    if (last && last.role === turn.role) continue;
    alternated.push(turn);
  }

  // Gemini expects the history to end with the model's complete reply;
  // a trailing unmatched user turn is invalid, so trim it.
  while (alternated.length && alternated[alternated.length - 1].role === 'user') {
    alternated.pop();
  }

  return alternated.slice(-MAX_HISTORY);
}

/**
 * Send one farmer message to the AgroBridge Assistant.
 * @param {string} message        farmer text (Hindi/Hinglish/English)
 * @param {Array}  history        prior messages (screen format)
 * @param {string} [phone]        logged-in farmer's phone/uid (optional)
 * @param {string} [language]     selected app language: en | hi | pa | mr
 * @returns {Promise<string>}     the assistant's reply text
 */
export async function sendChatMessage(message, history = [], phone = null, language = null) {
  const text = String(message || '').trim();
  if (!text) throw new ChatError('EMPTY_MESSAGE', 'Empty message');
  if (text.length > 2000) throw new ChatError('TOO_LONG', 'Message is too long');

  const body = {
    message: text,
    history: buildHistory(history),
  };
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone) body.phone = cleanPhone;
  const cleanLang = String(language || '').toLowerCase();
  if (['en', 'hi', 'pa', 'mr'].includes(cleanLang)) body.language = cleanLang;

  let res;
  try {
    res = await fetch(CHATBOT_URL, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ChatError('NETWORK', 'Cannot reach the Assistant server');
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (!res.ok) {
    throw new ChatError('SERVER', String(data.error || `HTTP ${res.status}`));
  }

  const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
  if (!reply) throw new ChatError('EMPTY_REPLY', 'Empty reply from the Assistant');

  return reply;
}

/**
 * IDs of stored messages still missing a display translation.
 * Pure helper so the screen translates only on language switch with
 * uncached history - never on plain re-renders or new messages.
 */
export function missingTranslations(messages, entries) {
  const have = new Set((Array.isArray(entries) ? entries : []).map((e) => e && e.id));
  return (Array.isArray(messages) ? messages : []).filter(
    (m) => m && !m.isGreeting && !m.typing && typeof m.text === 'string' && m.text.trim() && !have.has(m.id)
  );
}

/**
 * Translate already-stored chat messages for the translated-history
 * display cache. One batched backend call per invocation - callers
 * must cache results per language and never call this on every render.
 * @param {Array<{id:string, text:string}>} texts  messages to translate
 * @param {string} language                        en | hi | pa | mr
 * @returns {Promise<Array<{id:string, text:string}>>}
 */
export async function translateTexts(texts, language) {
  const cleanLang = String(language || '').toLowerCase();
  if (!['en', 'hi', 'pa', 'mr'].includes(cleanLang)) {
    throw new ChatError('BAD_LANGUAGE', 'Valid target language is required');
  }
  const items = (Array.isArray(texts) ? texts : [])
    .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({ id: t.id, text: t.text.trim() }));
  if (!items.length) return [];

  let res;
  try {
    res = await fetch(TRANSLATE_URL, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ texts: items, language: cleanLang }),
    });
  } catch (e) {
    throw new ChatError('NETWORK', 'Cannot reach the Assistant server');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ChatError('SERVER', String(data.error || `HTTP ${res.status}`));
  }

  const out = Array.isArray(data.translations) ? data.translations : [];
  return out
    .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
    .map((t) => ({ id: t.id, text: t.text }));
}
