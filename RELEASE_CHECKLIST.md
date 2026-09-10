# Release Checklist

Run through this before cutting any release build. Keep it short — if a step
stops being useful, cut it rather than let the list rot.

## 1. Version

- [ ] Decide the release type (patch / minor / major).
- [ ] Bump `app.config.js`'s `expo.version` to match.
- [ ] Bump `package.json`'s `"version"` to the same value — the two have
      drifted before and nothing enforces they match.
- [ ] Note: `eas.json` has `"appVersionSource": "remote"` and
      `autoIncrement: true` on the production build profile — EAS manages the
      actual build number remotely at build time, not `app.config.js` alone.
      Don't assume the local file is the whole story; check
      `eas build:version:get` if the App Store version needs to be known
      precisely before bumping.
- [ ] Confirm whatever version you land on actually matches what's
      approved/live on the App Store right now — don't assume the last
      commit's number is still accurate.

## 2. Manual smoke test (no automated test/lint suite exists in this repo)

- [ ] `npm run ios` — launch in the iOS Simulator.
- [ ] Click through each main tab at least once: Home, Assets/Watchlist,
      Momentum, Market, Profile.
- [ ] For anything changed this cycle that reads from the backend, confirm
      the live endpoint's real response shape first (`curl`/quick script) —
      don't assume the UI is right just because it compiles.
- [ ] Check the displayed version on Profile (`ProfileSettingsHub.js`) and
      Profile → About Alphaclara (`AboutScreen.js`) — both read
      `Constants.expoConfig?.version` dynamically now, so they should always
      match `app.config.js` automatically with no manual editing needed.
      Just confirm both actually show the number you set in step 1.

## 3. Before committing

- [ ] `git status` — review the diff for unintended files before staging,
      especially anything that might carry secrets.
- [ ] Confirm no UI code calls a third-party API directly or does heavy
      computation client-side (the non-negotiable data-flow rule in
      `CLAUDE.md`) for anything touched this cycle.

## 4. Build and submit

- [ ] `eas build` for the target platform(s).
- [ ] `eas submit` / App Store Connect once the build passes.
- [ ] Don't delete the release branch until TestFlight/App Store approval
      actually clears — a rejected or pulled build may need that branch
      again.
