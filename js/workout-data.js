/* Workout logic: drafts, drop sets, warm-ups, rest choices, progression, saving to the log, weekly schedule. */

/* Unsaved workout ("draft") tracking: the workout is dated by when you started logging it */
function draftMetaKey(dayIdx) {
  return `active_d${dayIdx}_meta`;
}

// Each day's unsaved sets remember when they were started, so they're saved to that date
function touchDraft() {
  const now = Date.now();
  const meta = readJSON(draftMetaKey(currentDayIdx), null);
  const isStale = !meta || now - meta.lastEditAt > DRAFT_STALE_MS;
  localStorage.setItem(draftMetaKey(currentDayIdx), JSON.stringify(isStale ? { startedAt: now, lastEditAt: now } : { startedAt: meta.startedAt, lastEditAt: now }));
}

/* The workout clock: one for the whole app, started by Start (or the first ticked set) on any day and stopped by
   Finish. pausedMs is time already paused and pausedAt is set while paused; only the time in between counts.
   creditedMs is the part already added to today's saved workout (from an earlier Finish today). */
function clockActiveMs(clock, nowMs) {
  if (!clock) return 0;
  const paused = (clock.pausedMs || 0) + (clock.pausedAt ? Math.max(0, nowMs - clock.pausedAt) : 0);
  return Math.max(0, nowMs - clock.startedAt - paused);
}

// The running clock, or null (none, or left running for 12 hours: a new workout starts over)
function workoutClock(nowMs = Date.now()) {
  const clock = readJSON(CLOCK_KEY, null);
  return clock && typeof clock.startedAt === 'number' && nowMs - clock.lastEditAt <= DRAFT_STALE_MS ? clock : null;
}

function saveClock(clock) {
  if (clock) localStorage.setItem(CLOCK_KEY, JSON.stringify(clock));
  else localStorage.removeItem(CLOCK_KEY);
}

function resumedClock(clock, now) {
  if (!clock.pausedAt) return { ...clock, lastEditAt: now };
  const { pausedAt, ...rest } = clock;
  return { ...rest, pausedMs: (clock.pausedMs || 0) + Math.max(0, now - pausedAt), lastEditAt: now };
}

function startWorkout() {
  const now = Date.now();
  saveClock({ startedAt: now, lastEditAt: now });
  haptic('success');
  renderWorkout();
}

// Ticking a set starts the clock if it isn't running, and carries on a paused one
function clockOnSet() {
  const now = Date.now();
  const clock = workoutClock(now);
  saveClock(clock ? resumedClock(clock, now) : { startedAt: now, lastEditAt: now });
}

function pauseWorkout() {
  const clock = workoutClock();
  if (!clock || clock.pausedAt) return;
  const now = Date.now();
  saveClock({ ...clock, pausedAt: now, lastEditAt: now });
  haptic('light');
  renderWorkout();
}

function resumeWorkout() {
  const clock = workoutClock();
  if (!clock || !clock.pausedAt) return;
  saveClock(resumedClock(clock, Date.now()));
  haptic('light');
  renderWorkout();
}

function dayHasDraft(dayIdx) {
  if (getCustomExercises(dayIdx).length) return true;
  const regex = new RegExp(`^active_d${dayIdx}_e\\d+_s\\d+_(w|r|drops|done)$`);
  return Object.keys(localStorage).some(k => {
    if (!regex.test(k)) return false;
    const val = localStorage.getItem(k);
    if (k.endsWith('_drops')) return readJSON(k, []).some(d => d.w || d.r);
    if (k.endsWith('_done')) return val === 'true';
    return !!val;
  });
}

function clearDayDraft(dayIdx) {
  removeKeysMatching(new RegExp(`^(active_)?d${dayIdx}_e\\d+_`));
  localStorage.removeItem(draftMetaKey(dayIdx));
  localStorage.removeItem(`custom_ex_d${dayIdx}`);
}

async function discardDraft() {
  const dayIdx = currentDayIdx;
  if (!await confirmSheet('Clear unsaved sets?',
    `All unsaved sets, drop sets and extra exercises for ${dayAt(dayIdx).day === 'Custom' ? 'your custom workout' : dayAt(dayIdx).day} will be removed. Saved workouts are not affected.`,
    'Clear Sets', true)) return;
  clearDayDraft(dayIdx);
  initNav();
  renderWorkout();
  showToast('Unsaved sets cleared');
}

/* Drop sets: extra lighter rows attached to a set, stored as [{ w, r }] */
function dropsKey(dayIdx, exIdx, setNum) {
  return `active_d${dayIdx}_e${exIdx}_s${setNum}_drops`;
}

function getDrops(dayIdx, exIdx, setNum) {
  const drops = readJSON(dropsKey(dayIdx, exIdx, setNum), []);
  return Array.isArray(drops) ? drops : [];
}

function saveDrops(exIdx, setNum, drops) {
  localStorage.setItem(dropsKey(currentDayIdx, exIdx, setNum), JSON.stringify(drops));
}

function addDrop(exIdx, setNum) {
  const drops = getDrops(currentDayIdx, exIdx, setNum);
  drops.push({ w: '', r: '' });
  saveDrops(exIdx, setNum, drops);
  localStorage.setItem(`active_d${currentDayIdx}_e${exIdx}_s${setNum}_done`, 'false');
  renderWorkout();
}

function removeDrop(exIdx, setNum, dropIdx) {
  const drops = getDrops(currentDayIdx, exIdx, setNum);
  drops.splice(dropIdx, 1);
  if (drops.length) saveDrops(exIdx, setNum, drops);
  else localStorage.removeItem(dropsKey(currentDayIdx, exIdx, setNum));
  renderWorkout();
}

function saveDropVal(exIdx, setNum, dropIdx, field, value) {
  const drops = getDrops(currentDayIdx, exIdx, setNum);
  if (!drops[dropIdx]) return;
  drops[dropIdx][field] = value;
  saveDrops(exIdx, setNum, drops);
  touchDraft();
  refreshDraftIndicators();
}

// Total kg moved in a set, including its drop sets
function setVolume(set) {
  return set.weight * set.reps + (set.drops || []).reduce((sum, d) => sum + d.weight * d.reps, 0);
}

function fmtSetLine(set) {
  return `${fmtNum(set.weight)} kg × ${set.reps}`;
}

/* Warm-up sets: a short ramp to the working weight before the working sets. They are ticked off, not
   logged: they never count toward history, volume or PRs. */
const WARMUP_RAMPS = {
  1: [{ pct: 0.5, reps: 8 }],
  2: [{ pct: 0.5, reps: 8 }, { pct: 0.75, reps: 4 }],
  3: [{ pct: 0.4, reps: 8 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 2 }]
};

const COMPOUND_RE = /press|squat|deadlift|\bRDL|row|pull-?down|pull-?up|chin-?up|dip|lunge|leg press|hip thrust/i;

// Plans without warm-up counts (older or imported ones): 2 before the day's first exercise,
// 1 before a later compound lift, none for isolation work.
function defaultWarmup(ex, exIdx) {
  if (exIdx === 0) return 2;
  return COMPOUND_RE.test(ex.name) ? 1 : 0;
}

function warmupCount(ex, exIdx) {
  const n = parseInt(ex.warmup, 10);
  return Math.min(3, Number.isNaN(n) ? defaultWarmup(ex, exIdx) : Math.max(0, n));
}

function warmupKey(dayIdx, exIdx, i) {
  return `active_d${dayIdx}_e${exIdx}_wu${i}`;
}

// The working weight the ramp builds to: what's typed in set 1, else the suggestion, else the plan's target.
function workingWeight(ex, exIdx, suggestion) {
  const typed = parseFloat(localStorage.getItem(setKey(currentDayIdx, exIdx, 1, 'w')));
  if (typed > 0) return typed;
  if (suggestion && suggestion.w > 0) return suggestion.w;
  if (/\bBW\b|bodyweight/i.test(ex.weightTarget)) return 0;
  // Only a target with a weight in it counts ("40–55 kg", "12.5 kg DBs"), not "2 reps in reserve"
  const m = String(ex.weightTarget).match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*\d+(?:\.\d+)?\s*)?kg/i);
  return m ? parseFloat(m[1]) : 0;
}

// A warm-up set you set yourself: a weight (or none, for a light set) and reps
function ownWarmupSet(w) {
  return w.kg > 0 ? { label: `${fmtNum(w.kg)} kg × ${w.reps}`, kg: w.kg, reps: w.reps } : { label: `Light × ${w.reps}`, reps: w.reps };
}

function warmupSets(ex, exIdx, suggestion) {
  const own = customWarmup(ex.name);
  if (own) return own.map(ownWarmupSet);
  const n = warmupCount(ex, exIdx);
  if (!n) return [];
  const work = workingWeight(ex, exIdx, suggestion);
  const barbell = /barbell|\bbar\b|bench press|squat|deadlift|\bRDL/i.test(`${ex.name} ${ex.weightTarget}`) && !/\bDBs?\b/.test(ex.name);
  const dumbbell = /\bDBs?\b/.test(`${ex.name} ${ex.weightTarget}`);
  return WARMUP_RAMPS[n].map(({ pct, reps }) => {
    // No number to work from (machines "Moderate", bodyweight): name the effort instead
    if (!work) return { label: `${pct < 0.55 ? 'Light' : pct < 0.7 ? 'Moderate' : 'Heavier'} × ${reps}`, reps };
    let kg = work * pct;
    kg = dumbbell ? Math.max(1, Math.round(kg)) : Math.max(barbell ? 20 : 2.5, Math.round(kg / 2.5) * 2.5);
    // Too close to the working weight to be a warm-up (e.g. a 20 kg curl): just go light
    if (kg >= work * 0.85) return { label: `Light × ${reps}`, reps };
    if (barbell && kg <= 20) return { label: `Bar × ${reps}`, kg: 20, reps };
    return { label: `${fmtNum(kg)} kg × ${reps}`, kg, reps };
  });
}

// Tick a warm-up set; the next one (or set 1) is suggested after a short rest.
function toggleWarmup(exIdx, i) {
  const key = warmupKey(currentDayIdx, exIdx, i);
  const done = localStorage.getItem(key) === 'true';
  if (done) localStorage.removeItem(key);
  else localStorage.setItem(key, 'true');
  haptic(done ? 'light' : 'success');
  renderWorkout();
  if (done) return;
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const suggestion = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, getHistory()), 1));
  const ramp = warmupSets(ex, exIdx, suggestion);
  const nextIdx = ramp.findIndex((_, j) => j > i && localStorage.getItem(warmupKey(currentDayIdx, exIdx, j)) !== 'true');
  startRestTimer(60, nextIdx !== -1 ? `Next: warm-up ${nextIdx + 1} · ${ramp[nextIdx].label}` : nextSetLabel(exIdx, 0));
}

// The swap choice is remembered (equipment rarely changes); entered values stay in place.
function toggleSwap(exIdx) {
  const key = swapKey(currentDayIdx, exIdx);
  if (localStorage.getItem(key) === 'true') localStorage.removeItem(key);
  else localStorage.setItem(key, 'true');
  haptic('light');
  renderWorkout();
}

function setKey(dayIdx, exIdx, setNum, field) {
  return `active_d${dayIdx}_e${exIdx}_s${setNum}_${field}`;
}

/* Rest is a chosen setting, not a stopwatch: one value per exercise, which any set can override.
   Cutting it while keeping weight and reps is a form of progressive overload. */
function exRestKey(dayIdx, exIdx) {
  return `active_d${dayIdx}_e${exIdx}_rest`;
}

function getExerciseRest(dayIdx, exIdx, ex) {
  const v = parseInt(localStorage.getItem(exRestKey(dayIdx, exIdx)), 10);
  return v > 0 ? v : ex.rest;
}

function getSetRest(dayIdx, exIdx, setNum, ex) {
  const v = parseInt(localStorage.getItem(setKey(dayIdx, exIdx, setNum, 'rest')), 10);
  return v > 0 ? v : getExerciseRest(dayIdx, exIdx, ex);
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 0:30 to 5:00 in 15-second steps
const REST_CHOICES = Array.from({ length: 19 }, (_, i) => 30 + i * 15);

function roundRest(sec) {
  return Math.round(sec / 15) * 15;
}

// Average rest chosen across a list of saved sets (sets from before rest was logged are skipped)
function avgRest(sets) {
  const rests = (sets || []).map(x => Number(x.restSec)).filter(v => v > 0);
  return rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : 0;
}

function restDelta(sec, ref) {
  const d = sec - ref;
  return d === 0 ? '' : `${d < 0 ? '−' : '+'}${fmtClock(Math.abs(d))}`;
}

function restChoices(ex, current, lastRest, extra = []) {
  const values = [...new Set([...REST_CHOICES, current, ex.rest, lastRest, ...extra].filter(v => v > 0))].sort((a, b) => a - b);
  return values.map(sec => ({
    label: fmtClock(sec),
    value: sec,
    selected: sec === current,
    tag: sec === ex.rest && sec === lastRest ? 'Plan·Last' : sec === ex.rest ? 'Plan' : sec === lastRest ? 'Last' : ''
  }));
}

async function pickRest(exIdx) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const current = getExerciseRest(currentDayIdx, exIdx, ex);
  const last = getLastPerformance(ex.name, getHistory());
  const lastRest = last ? roundRest(avgRest(last.sets)) : 0;
  const choice = await actionSheet('Rest between sets', `${ex.name} · applies to every set`,
    restChoices(ex, current, lastRest), { grid: true });
  if (!choice) return;
  localStorage.setItem(exRestKey(currentDayIdx, exIdx), String(choice));
  removeKeysMatching(new RegExp(`^active_d${currentDayIdx}_e${exIdx}_s\\d+_rest$`));
  haptic('light');
  renderWorkout();
}

async function pickSetRest(exIdx, setNum) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const current = getSetRest(currentDayIdx, exIdx, setNum, ex);
  const lastSet = lastSetFor(getLastPerformance(ex.name, getHistory()), setNum);
  const lastRest = lastSet && lastSet.restSec > 0 ? Number(lastSet.restSec) : 0;
  const choice = await actionSheet(`Rest after set ${setNum}`, ex.name, restChoices(ex, current, lastRest), { grid: true });
  if (choice) setSetRest(exIdx, setNum, choice);
}

// − / + on the rest stepper under a set: 15 s at a time
let restBump = null;

function nudgeSetRest(exIdx, setNum, delta) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const next = Math.min(600, Math.max(15, getSetRest(currentDayIdx, exIdx, setNum, ex) + delta));
  restBump = `${exIdx}:${setNum}`;
  setSetRest(exIdx, setNum, next);
  restBump = null;
}

function setSetRest(exIdx, setNum, choice) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const key = f => setKey(currentDayIdx, exIdx, setNum, f);
  if (choice === getExerciseRest(currentDayIdx, exIdx, ex)) localStorage.removeItem(key('rest'));
  else localStorage.setItem(key('rest'), String(choice));
  // A finished set's record can change with its rest
  if (localStorage.getItem(key('done')) === 'true') {
    const pr = detectPr(ex, exIdx, setNum, parseFloat(localStorage.getItem(key('w'))) || 0, parseInt(localStorage.getItem(key('r')), 10) || 0);
    if (pr) localStorage.setItem(key('pr'), pr);
    else localStorage.removeItem(key('pr'));
  }
  touchDraft();
  haptic('light');
  renderWorkout();
}

/* Double progression: once the top of the rep range is hit, add load (or slow the tempo when the DB is maxed). */
function repRange(ex) {
  const m = String(ex.repTarget).match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

function isDumbbellExercise(ex) {
  return /\bDBs?\b/.test(ex.name) || /\bDBs?\b/.test(ex.weightTarget);
}

function lastSetFor(last, setNum) {
  return last ? (last.sets.find(x => x.set === setNum) || last.sets[setNum - 1] || null) : null;
}

// What to aim for in a set, based on the same set last time. Used for the placeholders and
// as the values a set takes when ✓ is tapped with empty fields.
function suggestSet(ex, lastSet) {
  if (!lastSet) return null;
  const range = repRange(ex);
  if (range && lastSet.weight > 0 && lastSet.reps >= range[1] && !isDumbbellExercise(ex)) {
    return { w: lastSet.weight + 2.5, r: range[0] };
  }
  return { w: lastSet.weight, r: lastSet.reps };
}

// At the top of the rep range: add load, or keep it and cut 15 s of rest
function progressionTip(ex, lastSet, lastRest) {
  const range = repRange(ex);
  if (!range || !lastSet || !lastSet.weight || lastSet.reps < range[1]) return '';
  const cut = lastRest - 15 >= 30 ? ` or cut rest to ${fmtClock(roundRest(lastRest) - 15)}` : '';
  return isDumbbellExercise(ex) ? `Go heavier, slower${cut}` : `Try ${fmtNum(lastSet.weight + 2.5)} kg${cut}`;
}

/* Day tabs: short names, done-this-week ticks and the next day in the rotation */
function shortDayTitle(title) {
  const t = String(title).replace(/\bfocus\b/i, '').split(/\s*[&,–—+/]\s*|\s+-\s+/)[0].trim();
  return t.length > 16 ? `${t.slice(0, 15)}…` : t;
}

/* One workout per date. Everything saved on a date goes into that date's session, whichever day tab it
   came from; each exercise remembers its plan day, and the session is named after those days. */
function dayNumber(label) {
  const m = String(label).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 99;
}

function sessionDayLabels(s) {
  return s.days && s.days.length ? s.days : [s.day];
}

// The plan day this session mostly trained (by sets); drives "Up next"
function mainDayLabel(s) {
  const counts = {};
  s.exercises.forEach(e => { const d = e.day || s.day; counts[d] = (counts[d] || 0) + e.sets.length; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || dayNumber(a[0]) - dayNumber(b[0]))[0];
  return top ? top[0] : s.day;
}

function applySessionDays(session) {
  session.exercises.forEach(e => { if (!e.day) e.day = sessionDayLabels(session)[0]; });
  const days = [...new Set(session.exercises.map(e => e.day))].sort((a, b) => dayNumber(a) - dayNumber(b));
  const titleOf = label => (programData.find(d => d.day === label) || {}).title || '';
  session.days = days;
  if (days.length === 1) {
    session.day = days[0];
    session.title = titleOf(days[0]) || session.title;
  } else {
    session.day = days.join(' + ');
    session.title = days.map(d => shortDayTitle(titleOf(d) || d)).join(' + ');
  }
}

// Collect the logged sets on a day tab, as saved-history exercises
function collectDaySets(dayIdx) {
  const dayData = dayAt(dayIdx);
  const logged = [];
  getAllExercisesForDay(dayIdx).forEach((ex, exIdx) => {
    const performedSets = [];
    for (let s = 1; s <= getSetCount(dayIdx, exIdx, ex.sets); s++) {
      const weightVal = parseFloat(localStorage.getItem(setKey(dayIdx, exIdx, s, 'w')) || '0');
      const repsVal = parseInt(localStorage.getItem(setKey(dayIdx, exIdx, s, 'r')) || '0', 10);
      const drops = getDrops(dayIdx, exIdx, s)
        .map(d => ({ weight: parseFloat(d.w) || 0, reps: parseInt(d.r, 10) || 0 }))
        .filter(d => d.reps > 0);
      if (repsVal > 0 || weightVal > 0 || drops.length > 0) {
        const setObj = { set: s, weight: weightVal, reps: repsVal, restSec: getSetRest(dayIdx, exIdx, s, ex) };
        if (drops.length) setObj.drops = drops;
        const pr = localStorage.getItem(setKey(dayIdx, exIdx, s, 'pr'));
        if (pr && localStorage.getItem(setKey(dayIdx, exIdx, s, 'done')) === 'true') setObj.pr = pr;
        performedSets.push(setObj);
      }
    }
    // A custom workout stays custom: its exercises never count toward a plan day or the rotation
    if (performedSets.length) logged.push({ name: ex.name, day: isCustomDay(dayIdx) ? dayData.day : (ex.fromDay || dayData.day), sets: performedSets });
  });
  return logged;
}

// Save a day tab's sets into the session for the date they were started on. Returns that session, or null.
function saveDayToLog(dayIdx) {
  const loggedExercises = collectDaySets(dayIdx);
  if (!loggedExercises.length) return null;

  // Date the workout by when logging started, so late sessions and next-morning saves land on the right day.
  const nowMs = Date.now();
  const meta = readJSON(draftMetaKey(dayIdx), null);
  const startedAt = meta && meta.startedAt <= nowMs ? meta.startedAt : nowMs;
  const workoutDate = localDateStr(new Date(startedAt));
  // The clock's time since it was last added to today's workout (parts add up), when logged today. A clock left
  // running 5 hours was forgotten, so it adds nothing.
  let durationSec = 0;
  const clock = workoutClock(nowMs);
  if (clock && workoutDate === localDateStr(new Date(nowMs))) {
    const active = clockActiveMs(clock, nowMs);
    if (active < 5 * 3600e3) durationSec = Math.max(0, Math.round((active - (clock.creditedMs || 0)) / 1000));
    saveClock({ ...clock, creditedMs: active });
  }

  const history = getHistory();
  let session = history.find(s => sessionDateStr(s) === workoutDate);
  if (session) {
    loggedExercises.forEach(ex => {
      const target = session.exercises.find(e => e.name === ex.name);
      if (target) {
        const offset = Math.max(0, ...target.sets.map(s => s.set));
        ex.sets.forEach((s, i) => target.sets.push({ ...s, set: offset + i + 1 }));
      } else {
        session.exercises.push(ex);
      }
    });
    session.updatedAt = nowMs;
    if (durationSec) session.durationSec = (session.durationSec || 0) + durationSec;
  } else {
    session = {
      id: startedAt,
      dateStr: workoutDate,
      displayDate: new Date(startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      day: dayAt(dayIdx).day,
      title: dayAt(dayIdx).title,
      exercises: loggedExercises,
      ...(durationSec ? { durationSec } : {})
    };
    history.unshift(session);
  }
  applySessionDays(session);
  saveHistory(history);
  clearDayDraft(dayIdx);
  return session;
}

function todaysSession() {
  const today = localDateStr(new Date());
  return getHistory().find(s => sessionDateStr(s) === today) || null;
}

// The days (plan days and the custom workout) with unsaved sets started today
function daysWithSetsToday() {
  const today = localDateStr(new Date());
  return [...programData.keys(), programData.length].filter(d => {
    const meta = readJSON(draftMetaKey(d), null);
    return dayHasDraft(d) && meta && localDateStr(new Date(meta.startedAt)) === today;
  });
}

// Finish: save today's sets from every day you trained (this tab first), stop the clock, show the summary.
// Unsaved sets from an earlier date (the "Save to Tue" banner) are saved on their own, to that date.
// opts: { effort, calories } from the Finish sheet, saved on the workout
function finishAndSaveWorkout(opts = {}) {
  const hadDraft = dayHasDraft(currentDayIdx);
  const meta = readJSON(draftMetaKey(currentDayIdx), null);
  const fromEarlier = hadDraft && (!meta || localDateStr(new Date(meta.startedAt)) !== localDateStr(new Date()));
  const days = fromEarlier ? [currentDayIdx] : [currentDayIdx, ...daysWithSetsToday().filter(d => d !== currentDayIdx)];
  let saved = null;
  days.forEach(d => { saved = saveDayToLog(d) || saved; });
  if (!hadDraft) localStorage.removeItem(draftMetaKey(currentDayIdx));
  const clockWas = workoutClock();
  if (!fromEarlier) {
    // Time since the last save still belongs to today's workout
    const today = todaysSession();
    if (clockWas && today) {
      const active = clockActiveMs(clockWas, Date.now());
      const extra = active < 5 * 3600e3 ? Math.max(0, Math.round((active - (clockWas.creditedMs || 0)) / 1000)) : 0;
      if (extra) {
        const history = getHistory();
        const s = history.find(h => h.id === today.id);
        s.durationSec = (s.durationSec || 0) + extra;
        saveHistory(history);
      }
    }
    saveClock(null);
  }
  const session = saved || todaysSession();
  if (!session) {
    if (clockWas) {
      renderWorkout();
      showToast('Workout ended. Nothing was logged, so nothing was saved.');
      return;
    }
    haptic('error');
    showToast('Log at least one set before saving', { type: 'error' });
    return;
  }
  if (hadDraft && !saved) clearDayDraft(currentDayIdx);
  let finished = session;
  if (opts.effort || opts.calories) {
    const history = getHistory();
    finished = history.find(h => h.id === session.id) || session;
    if (opts.effort) finished.effort = opts.effort;
    if (opts.calories) finished.calories = opts.calories;
    saveHistory(history);
  }
  haptic('success');
  stopRestTimer();
  openedDone.clear();
  initNav();
  renderWorkout();
  const previous = getHistory().find(s => s.day === finished.day && s.id < finished.id) || null;
  showSummary({ session: finished, previous });
}

/* The Finish sheet: what's being saved, how hard it was (one tap, optional) and calories, then the summary */
let finishEffort = null;

function openFinishSheet() {
  const byDay = setsTodayByDay();
  const today = todaysSession();
  // Nothing new to save: Finish just ends the workout (or says there's nothing to save)
  if (!byDay.length && !(today && workoutClock())) return finishAndSaveWorkout();
  let sets = today ? sessionStats(today).sets : 0;
  let volume = today ? sessionStats(today).volume : 0;
  byDay.forEach(({ d }) => collectDaySets(d).forEach(ex => ex.sets.forEach(s => { sets++; volume += setVolume(s); })));
  const minutes = Math.max(1, Math.round(sessionElapsedSec() / 60));
  finishEffort = today && today.effort || null;
  document.getElementById('finish-stats').innerHTML = `
    <span><b>${minutes}</b> min</span><span><b>${sets}</b> set${sets === 1 ? '' : 's'}</span>
    ${volume ? `<span><b>${fmtVolume(volume)}</b></span>` : ''}
    ${byDay.length ? `<span>${byDay.map(x => dayShortLabel(x.d)).join(' + ')}</span>` : ''}`;
  document.getElementById('finish-body').innerHTML = `
    <div class="fin-label" id="effort-label">How hard was today?</div>
    <div class="effort" role="group" aria-labelledby="effort-label" id="finish-effort">${effortButtonsHtml(finishEffort, 'pickFinishEffort')}</div>
    <div class="fin-label">Calories burned · optional</div>
    <label class="cal-field fin-cal"><input type="number" id="finish-cal" inputmode="numeric" min="0" max="${MAX_CALORIES}" placeholder="—" value="${today && today.calories || ''}" aria-label="Calories burned, kcal"><span class="cal-unit">kcal, active, from your watch</span></label>
    <div class="fin-actions">
      <button class="finish-btn" onclick="confirmFinish()">${icon('check', 3)}Finish workout</button>
      <button class="btn btn-plain" onclick="closeSheet('finish-sheet')">Keep training</button>
    </div>`;
  openSheet('finish-sheet');
}

function pickFinishEffort(value) {
  finishEffort = finishEffort === value ? null : value;
  haptic('light');
  document.getElementById('finish-effort').innerHTML = effortButtonsHtml(finishEffort, 'pickFinishEffort');
}

function confirmFinish() {
  const text = document.getElementById('finish-cal').value.trim();
  const kcal = Math.round(parseFloat(text));
  if (text && !(kcal > 0 && kcal <= MAX_CALORIES)) {
    haptic('error');
    showToast(`Enter calories between 1 and ${MAX_CALORIES}, or leave it empty`, { type: 'error' });
    return;
  }
  closeSheet('finish-sheet');
  finishAndSaveWorkout({ effort: finishEffort, calories: text ? kcal : null });
}

// A plan day counts as done this week once at least half of its exercises have been logged.
function daysDoneThisWeek() {
  const weekStart = startOfWeek(new Date()).getTime();
  const logged = {};
  getHistory().filter(s => s.id >= weekStart).forEach(s => s.exercises.forEach(e => {
    const d = e.day || sessionDayLabels(s)[0];
    (logged[d] = logged[d] || new Set()).add(e.name);
  }));
  const done = new Set();
  programData.forEach(d => {
    if (logged[d.day] && logged[d.day].size >= Math.ceil(d.exercises.length / 2)) done.add(d.day);
  });
  return done;
}

/* Weekly schedule: a plan can pin its days to weekdays (Mon = 0 … Sun = 6); the others are rest days.
   Without a schedule the plan rotates through its days in order. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_WEEKDAYS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

function defaultSchedule(dayCount) {
  const schedule = Array(7).fill(null);
  (DEFAULT_WEEKDAYS[dayCount] || []).forEach((w, i) => { schedule[w] = i; });
  return schedule;
}

function weekdayIdx(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

function getSchedule() {
  const plan = getCustomPlan();
  const s = plan && plan.schedule;
  return Array.isArray(s) && s.length === 7 && s.some(v => Number.isInteger(v) && v < programData.length) ? s : null;
}

function scheduledDay(w, schedule = getSchedule()) {
  const v = schedule ? schedule[w] : null;
  return Number.isInteger(v) && v < programData.length ? v : null;
}

function weekdaysFor(dayIdx, schedule = getSchedule()) {
  return schedule ? WEEKDAYS.filter((_, w) => scheduledDay(w, schedule) === dayIdx) : [];
}

function isRestDayToday() {
  const schedule = getSchedule();
  return !!schedule && scheduledDay(weekdayIdx(), schedule) === null;
}

// The next scheduled training weekday after today: { w, dayIdx }
function nextScheduled() {
  const schedule = getSchedule();
  if (!schedule) return null;
  for (let k = 1; k <= 7; k++) {
    const w = (weekdayIdx() + k) % 7;
    const d = scheduledDay(w, schedule);
    if (d !== null) return { w, dayIdx: d };
  }
  return null;
}

/* Custom workout: a one-off day after the plan's days, built from scratch and saved to history
   without touching the plan */
const CUSTOM_DAY = { day: 'Custom', title: 'Custom workout', exercises: [] };

function isCustomDay(i = currentDayIdx) {
  return i === programData.length;
}

function dayAt(i) {
  return isCustomDay(i) ? CUSTOM_DAY : programData[i];
}

function startCustomWorkout() {
  selectDay(programData.length);
  if (!getAllExercisesForDay(programData.length).length) setTimeout(addCustomExercise, 150);
}

function upNextDayIdx() {
  const schedule = getSchedule();
  if (schedule) {
    // Today's planned day until today's workout is saved, then the next scheduled one
    const start = todaysSession() ? 1 : 0;
    for (let k = start; k < start + 7; k++) {
      const d = scheduledDay((weekdayIdx() + k) % 7, schedule);
      if (d !== null) return d;
    }
  }
  // Rotation: the day after the one most recently trained (custom workouts don't move it)
  const last = getHistory().find(s => programData.some(d => d.day === mainDayLabel(s)));
  if (!last) return 0;
  const idx = programData.findIndex(d => d.day === mainDayLabel(last));
  return (idx + 1) % programData.length;
}

function initNav() {
  const navContainer = document.getElementById('day-nav-tabs');
  const done = daysDoneThisWeek();
  const next = upNextDayIdx();
  const schedule = getSchedule();
  const today = scheduledDay(weekdayIdx(), schedule);
  const customIdx = programData.length;
  navContainer.innerHTML = programData.map((d, i) => {
    const wd = weekdaysFor(i, schedule);
    const doneSets = dayHasDraft(i) ? dayProgress(i).done : 0;
    const badge = doneSets ? `<span class="tab-badge" aria-label="${doneSets} sets logged">${doneSets}</span>`
      : dayHasDraft(i) ? '<span class="tab-dot" aria-label="unsaved sets"></span>'
      : i === today && !todaysSession() ? '<span class="tab-next">Today</span>'
      : i === next && !done.has(d.day) ? '<span class="tab-next">Next</span>' : '';
    return `
    <button class="tab-btn ${i === currentDayIdx ? 'active' : ''}" onclick="selectDay(${i})">
      ${done.has(d.day) ? `<span class="tab-check">${icon('check', 3)}</span>` : ''}
      <span>${wd.length ? wd.join('/') : `D${i + 1}`}</span><span class="tab-title">${escapeHtml(shortDayTitle(d.title))}</span>
      ${badge}
    </button>`;
  }).join('') + `
    <button class="tab-btn custom ${currentDayIdx === customIdx ? 'active' : ''}" onclick="selectDay(${customIdx})">
      ${dayHasDraft(customIdx) ? '<span class="tab-dot" aria-label="unsaved sets"></span>' : ''}<span>+ Custom</span>
    </button>`;
}

// Scroll the day tabs sideways (only) so the selected one is fully visible
function scrollActiveTab() {
  const nav = document.getElementById('day-nav-tabs');
  const active = nav.querySelector('.tab-btn.active');
  if (!active) return;
  const left = active.offsetLeft - nav.offsetLeft - 16;
  const right = left + active.offsetWidth + 32;
  if (left < nav.scrollLeft) nav.scrollLeft = left;
  else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
}

function selectDay(idx) {
  currentDayIdx = idx;
  haptic('light');
  initNav();
  scrollActiveTab();
  renderWorkout();
}

// Open on the day with unsaved sets, otherwise the next one in the rotation.
function initialDayIdx() {
  for (let i = 0; i <= programData.length; i++) if (dayHasDraft(i)) return i;
  return upNextDayIdx();
}
