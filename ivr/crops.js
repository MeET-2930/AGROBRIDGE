/*
 * ivr/crops.js
 * ---------------------------------------------------------------
 * Crop metadata shared by the server-side booking tools.
 *
 * This mirrors the ids and cropClass values in services/centres.js,
 * but it is deliberately dependency-free: the backend must not import
 * a React Native module (or the Firebase client SDK).
 * ---------------------------------------------------------------
 */

const CROP_LIST = [
  { id: "wheat", nameEn: "Wheat", nameHi: "गेहूं", cropClass: "grain", aliases: ["gehun", "gehu", "गेहूं", "गेहूँ"] },
  { id: "paddy", nameEn: "Paddy", nameHi: "धान", cropClass: "grain", aliases: ["dhan", "rice", "धान"] },
  { id: "mustard", nameEn: "Mustard", nameHi: "सरसों", cropClass: "grain", aliases: ["sarson", "सरसों"] },
  { id: "cotton", nameEn: "Cotton", nameHi: "कपास", cropClass: "grain", aliases: ["kapas", "कपास"] },
  { id: "maize", nameEn: "Maize", nameHi: "मक्का", cropClass: "grain", aliases: ["makai", "corn", "मक्का"] },
  { id: "gram", nameEn: "Gram", nameHi: "चना", cropClass: "grain", aliases: ["chana", "channa", "चना"] },
  { id: "tomato", nameEn: "Tomato", nameHi: "टमाटर", cropClass: "perishable", aliases: ["tamatar", "टमाटर"] },
  { id: "onion", nameEn: "Onion", nameHi: "प्याज", cropClass: "perishable", aliases: ["pyaz", "प्याज"] },
];

const BY_ID = new Map(CROP_LIST.map((c) => [c.id, c]));

const ALIASES = new Map();
for (const crop of CROP_LIST) {
  ALIASES.set(crop.id, crop.id);
  ALIASES.set(crop.nameEn.toLowerCase(), crop.id);
  ALIASES.set(crop.nameHi, crop.id);
  for (const alias of crop.aliases) ALIASES.set(String(alias).toLowerCase(), crop.id);
}

/** Canonical crop id, or null when the crop is unknown. */
function normalizeCrop(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  return ALIASES.get(value.toLowerCase()) || ALIASES.get(value) || null;
}

function cropMeta(cropId) {
  return BY_ID.get(String(cropId || "").toLowerCase()) || null;
}

function cropClassOf(cropId) {
  return cropMeta(cropId)?.cropClass || "grain";
}

function cropName(cropId, language = "en") {
  const meta = cropMeta(cropId);
  if (!meta) return String(cropId || "");
  return language === "hi" ? meta.nameHi : meta.nameEn;
}

/** True when the centre document accepts the crop. */
function centreAcceptsCrop(centre, cropId) {
  const accepted = Array.isArray(centre?.acceptedCrops) ? centre.acceptedCrops : [];
  return accepted.map((c) => String(c).toLowerCase()).includes(String(cropId).toLowerCase());
}

module.exports = {
  CROP_LIST,
  normalizeCrop,
  cropMeta,
  cropClassOf,
  cropName,
  centreAcceptsCrop,
};
