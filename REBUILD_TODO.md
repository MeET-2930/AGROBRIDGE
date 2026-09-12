# REBUILD — triggered by install32 (phone notifications)

Run once: `bash install32.sh` then `eas build --profile preview --platform android`.
Bundled in this build: expo-notifications, new icon/splash, version 1.2.0.
Still pending for a later build: expo-av neural voice.

# Things that need ONE APK rebuild (`eas build --profile preview`)

Do all of these together, once, so testers reinstall the APK only one time.
Everything else ships with `eas update` (no reinstall).

| # | Feature | Native package | Why native |
|---|---------|----------------|------------|
| 1 | Notifications in the Android status bar (sound, works when app is closed) + scheduled slot reminders (evening before, 1 h before). **App code is already in place (install28)** — `services/deviceNotify.js` auto-detects the package. Until the rebuild, testers get the in-app banner + vibration instead. | `expo-notifications` | Native module must be in the binary; in-app banner works everywhere today |
| 2 | Natural neural voice inside the app (same Swara/Neerja voice as the phone simulator) instead of the phone's built-in TTS | `expo-av` (or `expo-audio`) | Plays MP3 streamed from the Render `/tts` endpoint; current voice help uses `expo-speech` (already native, works today) |
| 3 | (optional) App icon / splash / logo polish | – (assets only) | Icon & splash are baked into the binary |

## Procedure when the time comes
```bash
cd ~/projects/AGROBRIDGE
npx expo install expo-notifications expo-av     # ALWAYS npx expo install, never plain npm install
npx expo install --check                                     # fixes any version mismatch
eas build --profile preview --platform android               # ~15 min
eas build:list --limit 1                                     # share the artifact URL with testers
```
Remember: `.easignore` must stay (keeps `services/firebase.js` in the upload).
After the new APK is installed, `eas update` keeps working as before.

## After the rebuild: notifications checklist
1. First launch asks "Allow AgroBridge to send notifications" → Allow.
2. Book a token on phone A (farmer) while phone B (gate officer) is locked → B's status bar shows "New token".
3. Slot reminders are scheduled on the farmer's phone when the dashboard opens (19:00 the evening before, and 60 min before the slot).

- [ ] install37: push status box removed from Notifications screen (JS-only; phone shows it until next build)
- [ ] install38: translation fixes + KisanSetu removed (JS-only; web has it, APK after next build)
- [ ] Consider `eas update:configure` so JS-only changes reach installed APKs without reinstall
- [ ] Welcome screen: "Smart Procurement" line removed under logo (done in workspace, goes out with next installer)

## install39 (1.3.0) – batched into this build
- [x] status box removed, translations, welcome subtitle, KisanSetu, expo-updates enabled.
- After this build: JS-only fixes ship with `eas update --branch preview`; rebuild only when an installer says REBUILD APK REQUIRED.
