# Recomp (app)

The iPhone and Android app, built with Expo (React Native) and TypeScript. It replaces the web app in
the repository root, which keeps running until this one reaches the stores.

- `src/core`: the app's logic (records, suggestions, warm-ups, rest, schedule, progress, nutrition,
  plan import, backups, and `draft.ts` for the workout in progress). No screens or storage, so it is easy to test.
- `src/core/data`: the exercise library, ready-made plans and the creator's plan, exported from the web
  app with `npm run export-web-data`.
- `src/data`: the on-device database (SQLite): workouts, weigh-ins, profile, plan and settings,
  plus backup import and export. Backups use the web app's format, so either app can read the other's.
- `src/theme`: themes (Vitruvian Machine by default, Neon District, Codex) and fonts.
- `src/ui`: shared pieces (text styles, screen, tab bar).
- `src/app`: the screens (Expo Router: one file per screen).
- `src/widgets`: the iPhone home-screen widget (this week's ring, the next workout, the streak). Its layout is
  compiled to text and runs inside the widget, so it may only use `@expo/ui/swift-ui` components and modifiers.
  `src/core/widget.ts` works out what it shows.
- Apple Health: `src/data/health.ios.ts` reads body weight into the app and saves weigh-ins logged here
  (Settings → Apple Health, iPhone only). `src/core/health.ts` decides which readings to add.

Files ending `.ios.ts` are used on iPhone only; the file without `.ios` is the stand-in for Android and the browser.
The widget and Health only work in a real iPhone build (TestFlight), not in Expo Go or the browser preview.

## Commands

```bash
npm install
npx expo start               # run on a phone with Expo Go, or press w for the browser
npm test                     # core tests, including parity with the web app
npx tsc --noEmit             # typecheck
npx expo lint                # lint
npx expo export --platform web   # browser build in dist/
python3 scripts/serve-web.py dist 8792   # serve it (adds the headers browser SQLite needs)
sh e2e/run.sh                # browser checks at iPhone size (after the export above)
npm run build-preview        # the browser preview for GitHub Pages, into ../preview
```

`e2e/` drives the browser build like a person would: setup, logging a workout, the workout clock and calories, your own warm-ups, backups, plans and charts
(about 180 checks, with screenshots). Set `PLAYWRIGHT` and `CHROMIUM` if Playwright isn't installed in the
usual place.

`src/core/__tests__/parity.test.ts` runs the web app's own code (`../js`) on the same inputs as the new
core and checks they agree, so behaviour carries over exactly.

Icons and sounds are generated: `node scripts/icon/make-icons.js` (Vitruvian mark in `scripts/icon/mark-vitruvian.js`) and
`python3 scripts/make-sounds.py`.

Getting the app onto phones (TestFlight, the stores): see `RELEASING.md`.
