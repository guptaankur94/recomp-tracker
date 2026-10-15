# Recomp tracker

A single-page workout tracker installed on an iPhone home screen. Plain HTML, CSS and JavaScript with no build step, served as static files (GitHub Pages). Data lives in the browser's localStorage on the phone.

## Files

- `index.html`: the page structure (header, screens, sheets, tab bar), `APP_VERSION`, and the list of style and script files.
- `styles/`: the look, split by area. `themes/classic.css` holds the design tokens (colours, sizes) that themes override. Order in `index.html` matters (later files win).
- `js/`: the behaviour, one file per feature (workout, rest timer, history, progress, plan, AI plan, setup, settings…). `js/data/` holds the exercise library, ready-made plans and the creator's original plan. `js/app.js` starts the app and loads last.
  - These are classic scripts sharing one global scope (inline `onclick` handlers call their functions), loaded in the order listed in `index.html`. Code that runs at load time may only use things from its own file or files listed before it.
- `sw.js`: offline support. `manifest.json`: home-screen name and icons. `images/`: icons and launch screens. `plans/`: saved plan files (not loaded by the app).

## How changes go live

The owner wants every change in the app immediately:

- Test each change, then commit and push it straight to `main`. Don't open pull requests unless asked.
- The phone picks it up on next launch through the "Update ready · Reload" toast.
- Bump `APP_VERSION` in `index.html` (date-based, e.g. `2026.10.16` or `2026.10.16b`) with every pushed change. Settings shows it, and the app's update check compares it, so people can tell which version they're on.
- When a change adds, renames or removes a file the app needs (style, script, image), update `index.html` and `ASSETS` in `sw.js`, and bump `CACHE`.

## Before pushing

- Serve the folder (`python3 -m http.server`) and drive it at iPhone size (390×844) in headless Chromium with Playwright.
- Check there are no page errors and that no native `alert`, `confirm` or `prompt` popups appear. The app uses its own toasts and sheets.
- Keep existing localStorage keys and saved-history fields readable; old data must keep working.

## The new app (`mobile/`)

The iPhone/Android rebuild in Expo (React Native) + TypeScript, headed for the App Store and Google Play. See `mobile/README.md`.

- Logic lives in `mobile/src/core` with no screens or storage. `npm test` there runs parity tests that load the web app's own `js/` files and check the new core gives the same answers. Keep them passing; when web app logic changes, change the core to match.
- Data in `mobile/src/core/data` is generated from `js/data` with `npm run export-web-data`; don't edit it by hand.
- Expo changes every SDK: follow `mobile/AGENTS.md`. Install packages with `npx expo install` (add `EXPO_OFFLINE=1` here, since api.expo.dev is blocked). Run `npx tsc --noEmit` and `npx expo lint` before pushing.
- Preview: `npx expo export --platform web`, serve `mobile/dist`, and drive it at 390×844 in Playwright.
- Changes only inside `mobile/` don't touch the web app, so they don't bump `APP_VERSION`.
