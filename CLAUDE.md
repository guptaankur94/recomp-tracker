# Recomp tracker

A single-page workout tracker installed on an iPhone home screen. Plain HTML, CSS and JavaScript with no build step, served as static files (GitHub Pages). Data lives in the browser's localStorage on the phone.

## Files

- `index.html`: the page structure (header, screens, sheets, tab bar), `APP_VERSION`, and the list of style and script files.
- `styles/`: the look, split by area. `themes/classic.css` holds the design tokens (colours, type, sizes) with the original look; `themes/themes.css` overrides them for Vitruvian Machine (the default), Neon District and Codex, chosen in Settings → Appearance (`js/themes.js`, saved as `recomp_theme`). Use tokens (`var(--accent)`, `var(--on-fill)`, `color-mix(…)`), never fixed colours, so every theme works. Order in `index.html` matters (later files win).
- `fonts/`: the themes' fonts (licences in `fonts/LICENSE.md`). Only the default theme's fonts are in `ASSETS`; others are cached on first use.
- `js/`: the behaviour, one file per feature (workout, rest timer, history, progress, plan, AI plan, setup, settings…). `js/data/` holds the exercise library, ready-made plans and the creator's original plan. `js/app.js` starts the app and loads last.
  - These are classic scripts sharing one global scope (inline `onclick` handlers call their functions), loaded in the order listed in `index.html`. Code that runs at load time may only use things from its own file or files listed before it.
- `tests/web/`: browser checks for the web app (not loaded by the app, not in `ASSETS`).
- `sw.js`: offline support (it leaves `preview/` alone). `manifest.json`: home-screen name and icons. `images/`: icons and launch screens. `plans/`: saved plan files (not loaded by the app).
- `preview/`: the new app's browser build (generated, don't edit; see below). `404.html` sends reloaded `preview/…` addresses back into the preview. `.nojekyll` makes GitHub Pages serve its `_expo/` folder.

## What the owner wants (product principles)

The goal of every change: **log as seamlessly as possible, push for more work, keep rests strict.** Judge each change by it.

- **The screen never moves on its own when logging.** No automatic scrolling after a tick or when rest ends; what you tapped stays exactly where it was (re-draws are anchored on it). The only motion is the fold after the user calls an exercise done (fold and scroll as one eased motion).
- **One way to do a thing, everywhere.** Warm-ups log like working sets (inline fields, the same number pad, ✓); a done row taps open its menu. Consistency beats clever minimalism: hiding controls on some rows ("quieter rows") read as broken and was reverted.
- **Decisions are the user's.** Nothing ends or folds by itself: the last set shows "Exercise complete / + 1 more set"; complete asks to confirm, then effort. A finished exercise asks what to change (effort, a set, add a set, show, reopen).
- **Logic like a trainer.** Rest belongs to the set it follows: planned → live (its − / + are the timer) → taken (recorded, locked). Drop sets only straight after their set, lighter (≈20 % off, then 15 %), then the rest starts again; up to 3; not after the exercise is marked done. Effort is reps in reserve (easy 4+ = RPE 6, moderate 8, hard 9, all out 10); felt easy → next time a step heavier.
- **Slips never become records.** Values save on every keystroke; impossible values are refused; unusual jumps (e.g. 525 for 52.5) ask first; a weighted exercise needs a weight. PRs are re-judged whenever a set changes.
- **Explain, don't impose.** Every Coach tip says why; smart suggestions are one tap and undoable; nothing is uploaded.
- The owner writes in plain language and often from the gym: answer in short plain words, list what changed and what was found, say what couldn't be checked (real iPhone keyboard, Live Activities).

## Lessons from building it (how to work here)

- **Reproduce first.** Write the failing check in `tests/web/` (use the user's exact scenario: e.g. another exercise already open), see it fail, then fix; it stays as a regression check (`regressions.test.js`).
- **Check motion frame by frame**, not just the end state: `stillness.test.js` records every frame after each kind of logging tap; a "fold" once snapped in one frame and passed end-state checks. Measure scroll too, and row heights when an element changes state (every state the same height).
- **Global class names clash**: `.live` is the workout panel; a `rest-stepper live` inherited its padding. Name new state classes uniquely (`rest-live`).
- **Load order**: scripts share one scope; code running at load can only use earlier files (`currentView` lives in `navigation.js`, loaded after `workout.js`). Check the DOM instead, or call at runtime.
- **Number formatting**: `fmtNum` rounds to one decimal (1.25 → 1.3); use exact values where precision matters (plates).
- **Fresh sessions**: the container can start on an old branch with `CLAUDE.md` "missing": `git fetch origin main && git checkout -B main origin/main`. The scratchpad is wiped on restarts; keep tests in `tests/web/`.
- **Test-writing pitfalls**: seed history after the plan has loaded (names must match `getAllExercisesForDay`); don't `await` a function that waits on a dialog; stop an earlier frame-recording loop before starting the next; jump the fake clock with `setSystemTime` (not `runFor` over hours); `scrollWidth` counts clipped overflow, so test real sideways movement (`sideScroll`).
- Only one exercise is open at a time (focus mode): to type into another exercise in a test, `focusExercise(i)` first; `logSet()` and `completeExercise()` in `helpers.js` do the usual steps.

## How changes go live

The owner wants every change in the app immediately:

- Test each change, then commit and push it straight to `main`. Don't open pull requests unless asked.
- The phone picks it up on next launch through the "Update ready · Reload" toast.
- Bump `APP_VERSION` in `index.html` (date-based, e.g. `2026.10.16` or `2026.10.16b`) with every pushed change. Settings shows it, and the app's update check compares it, so people can tell which version they're on.
- When a change adds, renames or removes a file the app needs (style, script, image), update `index.html` and `ASSETS` in `sw.js`, and bump `CACHE`.

## Before pushing

- Run `sh tests/web/run.sh`: the web app's browser checks (`tests/web/*.test.js`, shared set-up in `helpers.js`) serve the folder and drive it at iPhone size (390×844) in headless Chromium with Playwright. Add checks there for new features, and keep them passing.
- For anything they don't cover yet, serve the folder (`python3 -m http.server`) and drive it at 390×844 yourself.
- Check there are no page errors and that no native `alert`, `confirm` or `prompt` popups appear. The app uses its own toasts and sheets.
- Keep existing localStorage keys and saved-history fields readable; old data must keep working.

## The new app (`mobile/`)

The iPhone/Android rebuild in Expo (React Native) + TypeScript, headed for the App Store and Google Play. See `mobile/README.md`.

**Paused (owner's decision, 2026-10-30): new features go into the web app only.** Don't change `mobile/` for new features; instead add a line for each web change the new app will need to `mobile/PORTING.md`. When the Apple Developer account is ready, port the list in one batch, bring the parity tests up to date, rebuild the preview, and put `'js/**'` back in the push paths of `.github/workflows/app-checks.yml` (taken out so web-only changes don't fail the parity tests meanwhile). Until then the parity tests may fail for logic that has moved on in `js/`; that's expected, and is fixed by the batch port.

- Logic lives in `mobile/src/core` with no screens or storage. `npm test` there runs parity tests that load the web app's own `js/` files and check the new core gives the same answers. Keep them passing; when web app logic changes, change the core to match.
- Data in `mobile/src/core/data` is generated from `js/data` with `npm run export-web-data`; don't edit it by hand.
- Expo changes every SDK: follow `mobile/AGENTS.md`. Install packages with `npx expo install` (add `EXPO_OFFLINE=1` here, since api.expo.dev is blocked). Run `npx tsc --noEmit` and `npx expo lint` before pushing.
- Browser checks: `npx expo export --platform web && sh e2e/run.sh` (here: `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Keep them passing and add checks for new screens.
- Preview: `npx expo export --platform web`, serve it with `python3 scripts/serve-web.py dist 8792` (plain `http.server` won't do: browser SQLite needs extra headers), and drive it at 390×844 in Playwright.
- Data lives in SQLite (`mobile/src/data`). Schema changes go in a new entry at the end of `MIGRATIONS` in `db.ts`; never edit one that has shipped.
- Use `aria-*` props (`aria-checked`, `aria-selected`, `aria-expanded`) rather than `accessibilityState`, which the web build ignores.
- Changes only inside `mobile/` don't touch the web app, so they don't bump `APP_VERSION`.
- Browser preview on GitHub Pages (`/recomp-tracker/preview/`): `npm run build-preview` in `mobile/` rebuilds `../preview`; commit it when the app changes. It works without special headers through `mobile/public/coi-sw.js`; test it with `e2e/preview.js` against a server that behaves like Pages (plain files, `404.html` for missing paths).
- GitHub runs `.github/workflows/app-checks.yml` (tests, typecheck, lint) on every push touching `mobile/` or `js/`. `ios-beta.yml` builds for TestFlight when started by hand (see `mobile/RELEASING.md`).
