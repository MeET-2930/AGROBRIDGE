/*
 * services/dates.js
 * ---------------------------------------------------------------
 * All date handling in one place.
 *
 * WHY THIS EXISTS
 * Earlier the app used new Date().toISOString().split('T')[0].
 * toISOString() returns UTC. India is UTC+5:30, so between
 * midnight and 5:30 AM IST that expression returns YESTERDAY.
 * A booking made at 6 AM would be filed under the previous day
 * and disappear from the officer's queue.
 *
 * Everything below works in the device's LOCAL timezone.
 * ---------------------------------------------------------------
 */

/** Local YYYY-MM-DD for a Date (defaults to now). */
export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Local YYYY-MM-DD for today. */
export function todayLocal() {
  return localDateString(new Date());
}

/** Local YYYY-MM-DD n days from today. */
export function dateOffsetLocal(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);

  return localDateString(d);
}

/** Turn YYYY-MM-DD into a Date at local midnight (never UTC). */
export function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map(Number);

  if (!y || !m || !d) return new Date();

  return new Date(y, m - 1, d);
}

/** Friendly label in the user's language: Today / Tomorrow / 5 Sep. */
const WORDS = {
  hi: { today: 'आज', tomorrow: 'कल', locale: 'hi-IN' },
  en: { today: 'Today', tomorrow: 'Tomorrow', locale: 'en-IN' },
  pa: { today: 'ਅੱਜ', tomorrow: 'ਕੱਲ੍ਹ', locale: 'pa-IN' },
  mr: { today: 'आज', tomorrow: 'उद्या', locale: 'mr-IN' },
};
export function friendlyDateLabel(dateStr, lang = 'hi') {
  const w = WORDS[lang] || WORDS.hi;
  if (dateStr === todayLocal()) return w.today;
  if (dateStr === dateOffsetLocal(1)) return w.tomorrow;
  const d = parseLocalDate(dateStr);
  try {
    return d.toLocaleDateString(w.locale, { day: 'numeric', month: 'short' });
  } catch (e) {
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }
}

/** Current local time as HH:MM (24h), used to hide past slots. */
export function currentLocalHour() {
  return new Date().getHours();
}
