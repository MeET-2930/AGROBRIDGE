# AGROBRIDGE – giving the team an APK (one-time) and updating it (1 minute)

## Why two different commands
- **`eas build`** compiles the *native shell* (camera, image picker, Firebase SDK).
  Takes ~15 min on Expo's servers. Needed ONCE, and again only when an
  installer adds a new native package (the installer will say so).
- **`eas update`** pushes only the *JavaScript* (all screens, services,
  translations). Takes ~1 min. Testers get it the next time they open the app.
  No reinstall.

## One-time setup (you or your friend, once)
```
cd ~/projects/AGROBRIDGE
npm install -g eas-cli
eas login                      # free account at https://expo.dev  (create it in the browser first)
eas init                       # links this folder to a project on expo.dev  → answer Y
eas update:configure           # adds the updates URL + runtimeVersion to app.json → answer Y to everything
```
Then commit what it changed:  `git add -A && git commit -m "eas config" && git push`

## Build the APK (once)
```
eas build -p android --profile preview
```
- "Generate a new Android Keystore?" → **Y**
- Wait ~15 min. It prints a link like `https://expo.dev/accounts/.../builds/...`
- Open the link on any Android phone → **Install** → allow "unknown sources" if asked.
- Share that link in the team group. Everyone installs once.

## Update the team after a fix (every time)
```
bash installNN.sh              # apply the fix as usual
npx expo start -c              # test yourself in Expo Go
eas update --branch preview --message "installNN: what changed"
```
Testers: close the app fully and open it again → they have the fix.

## When do I need a NEW build instead of an update?
Only when a new package with native code was added. I will write
**"REBUILD APK REQUIRED"** at the top of any installer that needs it.
If unsure: `eas build` again – it is free (30 builds/month).

## Where bug reports go
Help card → "Report a problem" → Firestore collection **feedback**
(Firebase console → Firestore → feedback). Each report has the tester's
role, phone, screen, language and app version.

## Firestore rules
`firestore.rules` is committed with **MODE A (open, no expiry)** active.
Deploy it once now so test-mode cannot expire mid-demo:
```
firebase deploy --only firestore:rules
```
MODE B (real security) is written in the same file, commented out.
It goes live with install15 after the internal round.
