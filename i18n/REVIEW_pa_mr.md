# Punjabi / Marathi review notes

All ~600 strings in `i18n/translations.js` have Hindi (hi), English (en),
Punjabi (pa, Gurmukhi) and Marathi (mr) versions. Hindi and English were
written by hand; Punjabi and Marathi were machine-assisted and then
read through once, so **please have a native speaker skim them before
the final SIH demo**. How to do that quickly:

1. Open `i18n/translations.js` in VS Code.
2. Every line looks like `key: r('hindi', 'english', 'punjabi', 'marathi')`.
3. Ask your reviewer to read only the 3rd (Punjabi) or 4th (Marathi) value
   and fix it in place. Nothing else needs to change - the app picks the
   text up automatically.

Strings most worth a second look (mandi jargon):
- `hamali`, `commission` (आढ़त), `mandiFee`  - local terms vary by state.
- `stg_*`, `duty_*` - officer job titles.
- `qv_*` - the farmer's live queue messages (must sound natural, they are
  read aloud by the speaker button).
- `audio_*` - the spoken help paragraphs.

Things that are deliberately NOT translated:
- Token numbers (A-12), vehicle numbers, ₹ amounts, dates - same everywhere.
- Mandi names come from Firestore. English users see the bracketed
  English part of the name, e.g. "Khanna Grain Market"; everyone else sees
  the Hindi name. Add a `name_en` field to a centre document to override.
