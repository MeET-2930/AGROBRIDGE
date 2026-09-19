/*
 * services/chatbot.js
 * ---------------------------------------------------------------
 * Client for the AgroBridge Assistant (read-only Gemini chatbot).
 * Talks to ivr/chatbot-local.js  ->  POST http://localhost:3001/chat
 *
 *   in:  { message, history }          out:  { reply }
 *
 * `history` is the list of prior chat messages in Gemini turn
 * format ({ role: 'user' | 'model', parts: [{ text }] }), built
 * from the same message objects the screen keeps.
 *
 * Best-effort: network/app errors throw a ChatError with a `.code`
 * the screen can show. No live Firebase data is read yet.
 * ---------------------------------------------------------------
 */

const CHATBOT_URL = 'http://localhost:3001/chat';
const MAX_HISTORY = 10;

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
 * @returns {Promise<string>}     the assistant's reply text
 */
export async function sendChatMessage(message, history = []) {
  const text = String(message || '').trim();
  if (!text) throw new ChatError('EMPTY_MESSAGE', 'Empty message');
  if (text.length > 2000) throw new ChatError('TOO_LONG', 'Message is too long');

  let res;
  try {
    res = await fetch(CHATBOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: buildHistory(history),
      }),
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