# Recomp (app)

The iPhone and Android app, built with Expo (React Native) and TypeScript. It replaces the web app in
the repository root, which keeps running until this one reaches the stores.

- `src/core`: the app's logic (records, suggestions, warm-ups, rest, schedule, progress, nutrition,
  plan import, backups). No screens or storage, so it is easy to test.
- `src/core/data`: the exercise library, ready-made plans and the creator's plan, exported from the web
  app with `npm run export-web-data`.
- `src/theme`: themes (Vitruvian Machine by default, Neon District, Codex) and fonts.
- `src/ui`: shared pieces (text styles, screen, tab bar).
- `src/app`: the screens (Expo Router: one file per screen).

## Commands

```bash
npm install
npx expo start               # run on a phone with Expo Go, or press w for the browser
npm test                     # core tests, including parity with the web app
npx tsc --noEmit             # typecheck
npx expo lint                # lint
npx expo export --platform web   # browser build in dist/
```

`src/core/__tests__/parity.test.ts` runs the web app's own code (`../js`) on the same inputs as the new
core and checks they agree, so behaviour carries over exactly.
