# Recomp tracker

A single-page workout tracker installed on an iPhone home screen. All code is in `index.html` (HTML, CSS and JavaScript, no build step), plus `sw.js` (offline service worker) and `manifest.json`. Data lives in the browser's localStorage on the phone.

## How changes go live

The owner wants every change in the app immediately:

- Test each change, then commit and push it straight to `main`. Don't open pull requests unless asked.
- The phone picks it up on next launch through the "Update ready · Reload" toast.
- Bump `APP_VERSION` in `index.html` (date-based, e.g. `2026.10.15` or `2026.10.15b`) with every pushed change. Settings shows it, and the app's update check compares it, so people can tell which version they're on.
- When a change adds or renames a file the app needs offline, add it to `ASSETS` in `sw.js` and bump `CACHE`.

## Before pushing

- Serve the folder (`python3 -m http.server`) and drive it at iPhone size (390×844) in headless Chromium with Playwright.
- Check there are no page errors and that no native `alert`, `confirm` or `prompt` popups appear. The app uses its own toasts and sheets.
- Keep existing localStorage keys and saved-history fields readable; old data must keep working.
