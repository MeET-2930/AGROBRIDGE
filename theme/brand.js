/*
 * theme/brand.js   (install29)
 * One place for every brand image so screens never hard-code paths.
 */
export const LOGO_FULL = require('../assets/brand/logo_full.png');   // emblem + wordmark + tagline
export const LOGO_MARK = require('../assets/brand/logo_mark.png');   // round emblem only
export const WATERMARK = require('../assets/brand/watermark.png');   // farmer -> officer -> trader cycle

export const ROLE_ICON = {
  farmer: require('../assets/brand/role_farmer.png'),
  officer: require('../assets/brand/role_officer.png'),
  trader: require('../assets/brand/role_trader.png'),
};

/* Opacity of the background watermark. 0.06 = "just exists there". */
export const WATERMARK_OPACITY = 0.06;
