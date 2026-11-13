/* One-time coach tips and the How Recomp works guide. */

/* Coach tips: one short hint at the moment a feature becomes useful, each shown once.
   People who already have workouts saved start with all of them marked seen. */
const TIPS_KEY = 'recomp_tips_seen';

const TIP_IDS = ['rest', 'drop', 'swap', 'records'];

function tipsSeen() {
  return readJSON(TIPS_KEY, []);
}

function tipSeen(id) {
  return tipsSeen().includes(id);
}

function dismissTip(id) {
  localStorage.setItem(TIPS_KEY, JSON.stringify([...new Set([...tipsSeen(), id])]));
  haptic('light');
  if (id === 'records') renderExerciseProgress();
  else renderWorkout();
}

function coachTip(id, title, text, pointLeft = false) {
  return `
    <div class="coach ${pointLeft ? 'left' : ''}" role="note">
      <div class="coach-text"><strong>${title}</strong> ${text}</div>
      <button class="coach-ok" onclick="event.stopPropagation(); dismissTip('${id}')">Got it</button>
    </div>`;
}

function initTips() {
  if (localStorage.getItem(TIPS_KEY) === null && getHistory().length) localStorage.setItem(TIPS_KEY, JSON.stringify(TIP_IDS));
}

function replayTips() {
  localStorage.setItem(TIPS_KEY, '[]');
  closeSheet('guide-sheet');
  renderWorkout();
  showToast('Tips will show again as you train');
}

const GUIDE = [
  ['plan', 'Your plan', 'The <strong>Plan</strong> tab holds your training days. Tap a day to change its exercises, sets, reps, rest or warm-ups, or tap <strong>Start</strong> to train it. You can build your own plan, pick a starter plan or create one with AI at any time. Your history is always kept.'],
  ['check', 'Logging a set', 'Type the weight and reps, then tap <strong>✓</strong>. Grey numbers are suggestions from last time; tap ✓ with them empty to accept them. Tap a logged set to edit it, or swipe it left to delete it.'],
  ['clock', 'Rest', 'The rest timer starts on its own after each set. Use <strong>− / +</strong> under a set to change the rest after it, or the rest chip to change it for every set. Doing the same weight and reps after a shorter rest than ever is progress too, and earns a <strong>Less rest</strong> record on the set that follows it.'],
  ['plus', 'Drop sets, warm-ups and swaps', 'Tap <strong>+ Drop set</strong> under any set to add a lighter set straight after it. Warm-up chips show suggested ramp-up sets; tap <strong>Edit</strong> (or a set\'s <strong>⋯</strong>) to set your own. Machine taken? Open <strong>ⓘ</strong> on an exercise and swap to its alternative.'],
  ['check', 'Logging a set', 'One exercise is open at a time; the others are one-line previews (tap to open one). Tap a weight or reps box for the number pad: <strong>±2.5</strong>, <strong>Next</strong> and <strong>Log set</strong>. The line under the next set shows last time; with nothing typed, ✓ logs that. Tap a ticked set to edit it; it stays ticked. Tap a warm-up to change its weight or reps (kept for next time). The screen never scrolls on its own when you log.'],
  ['swap', 'Supersets, notes and today\'s order', 'The <strong>⋯</strong> on an open exercise: <strong>Superset</strong> it with the next one (one set of each, then rest), add a <strong>note</strong> (seat height, grip…), <strong>do it later</strong> or <strong>skip it today</strong>. Later and skip only change today. For barbell lifts the number pad shows the plates for each side.'],
  ['arrowUp', 'Body and photos', 'On Progress, <strong>Body</strong>: log your waist (and chest, hips, arm, thigh, body fat) every week or two. On a recomp the waist often drops while weight holds, and the Coach says so. Progress photos stay on this phone (not in backups); tap one to compare two dates side by side. The chips at the top jump to any section.'],
  ['clock', 'History', 'Search by exercise to see every workout with it and its best set. Open a workout and tap <strong>Repeat this workout</strong> to start it again.'],
  ['infoCircle', 'Settings', 'Switch the rest timer, sounds, vibration and keep-screen-on on or off, and set a default rest for exercises you add. A week after your last backup, the home card offers <strong>Back up now</strong> (save it to Files or iCloud Drive).'],
  ['clock', 'Cardio', 'Tap <strong>+ Cardio</strong> (or <strong>Log cardio</strong> on the home card) to add a run, ride, row and more. Logged before any set it counts as before lifting, otherwise after. One tap repeats last time. It\'s saved with the workout at Finish, or on its own, and the Coach tracks your weekly minutes.'],
  ['arrowUp', 'Getting stronger', 'When you hit the top of the rep range, the green tip suggests adding weight or cutting rest. Gold <strong>PR</strong> badges mark sets that beat every set of that exercise before them: heavier than ever, more reps at a weight you\'ve done, a better estimated 1RM (sets of up to 12 reps), or the same work after less rest. Your first session of an exercise sets the baseline.'],
  ['chevronUp', 'Start and finish', 'Tap <strong>Start workout</strong> at the top, then log any day of your plan and switch days as you go. A finished exercise turns green with a ✓. <strong>Finish workout</strong> at the bottom saves every day you trained and asks how hard it was.'],
  ['infoCircle', 'History and Progress', '<strong>History</strong> shows every workout on a calendar. <strong>Progress</strong> charts each exercise (top set, 1RM, volume, reps and rest) and your bodyweight trend.'],
  ['check', 'Your data', 'Everything stays on this phone. Back up from <strong>Settings</strong> now and then, especially before deleting the app.']
];

function openGuide() {
  document.getElementById('guide-body').innerHTML = GUIDE.map(([ic, title, text]) => `
    <div class="guide-item">
      <span class="guide-ico">${ic === 'plan' ? ROW_ICONS.plan : icon(ic, 2.4)}</span>
      <div><div class="guide-title">${title}</div><div class="guide-text">${text}</div></div>
    </div>`).join('');
  openSheet('guide-sheet');
}
