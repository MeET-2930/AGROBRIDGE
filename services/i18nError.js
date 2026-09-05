/*
 * services/i18nError.js
 * ---------------------------------------------------------------
 * Services cannot know which language the user picked, so instead
 * of throwing a Hindi sentence they throw an Error that carries a
 * translation KEY (and optional params). Screens show it with
 * `trError(error)` from useLang().
 *
 * `message` is still filled with the Hindi text, so any place that
 * still does `error.message` keeps working.
 * ---------------------------------------------------------------
 */
import { translate } from '../i18n/translations';

export function tErr(key, params) {
  const err = new Error(translate(key, 'hi', params));
  err.key = key;
  err.params = params || null;
  err.isUserFacing = true;
  return err;
}
