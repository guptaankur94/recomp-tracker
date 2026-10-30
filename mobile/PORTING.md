# Waiting to be ported to the new app

The new app is paused (see `CLAUDE.md`): new features go into the web app first. Add a line here for every web
app change the new app will need, newest last, and port the whole list in one batch when the Apple Developer
account is ready. Clear each line once it's ported and its parity test passes.

Caught up to the web app as of version 2026.10.30 (commit 7338f88). Changes since then are listed below.

| Web version | Change | Files in the web app |
|---|---|---|
| 2026.10.30b | Coach card on Progress (stalled lifts → lighter week, weekly sets per muscle, program goal forecast, training-load jump, weight pace with calorie nudge; each with why and source; "Got it" snoozes 14 days) and a "Coach: N tips" link on the Workout home. Smart suggestions (Settings toggle, on by default): make your usual rest the plan's, reorder a day to the order you start exercises in (position-tied state moves with them; undo), usual calories as the Finish placeholder. New keys `recomp_smart`, `recomp_habits`, `recomp_coach`. | `js/coach.js`, `js/habits.js`, `js/progress.js`, `js/workout.js` (hero link, `noteExerciseStart` in `completeSet`), `js/workout-data.js` (calories placeholder), `js/settings.js`, `styles/history-progress.css`, `index.html` |
