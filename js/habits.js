/* Smart suggestions: the app notices your habits (on this phone only) and offers to make them the plan.
   Nothing changes on its own: each suggestion says why, takes one tap, and can be undone or turned off in
   Settings. It learns from your saved workouts, plus the order you start exercises in. */
const SMART_KEY = 'recomp_smart';
const HABITS_KEY = 'recomp_habits';
const ORDER_SESSIONS = 6;

function smartOn() {
  return localStorage.getItem(SMART_KEY) !== 'off';
}

function toggleSmart() {
  localStorage.setItem(SMART_KEY, smartOn() ? 'off' : 'on');
  haptic('light');
  renderSettings();
  showToast(smartOn() ? 'Smart suggestions on' : 'Smart suggestions off. Nothing more is noted.');
}

function getHabits() {
  const h = readJSON(HABITS_KEY, {});
  return h && typeof h === 'object' && !Array.isArray(h) ? h : {};
}

// The order you start a plan day's exercises in: noted when an exercise's first set is ticked
function noteExerciseStart(dayIdx, name) {
  if (!smartOn() || isCustomDay(dayIdx) || !dayAt(dayIdx)) return;
  const h = getHabits();
  const title = dayAt(dayIdx).title;
  const order = h.order && typeof h.order === 'object' ? h.order : {};
  const list = Array.isArray(order[title]) ? order[title] : [];
  const date = localDateStr(new Date());
  let entry = list.find(e => e.date === date);
  if (!entry) {
    entry = { date, names: [] };
    list.push(entry);
  }
  if (entry.names.includes(name)) return;
  entry.names.push(name);
  order[title] = list.slice(-ORDER_SESSIONS);
  localStorage.setItem(HABITS_KEY, JSON.stringify({ ...h, order }));
}

/* Suggestions: { id, title, why, actionLabel, apply() → undo() } */

// Rest you keep choosing: the last 4 sessions agree (within 20 s) and differ from the plan by 30 s or more.
// One suggestion per exercise; it changes the exercise on every day of the plan it's on.
function restSuggestions(history) {
  const out = [];
  planNames().forEach(name => {
    const spots = [];
    programData.forEach((day, d) => day.exercises.forEach((ex, i) => { if (ex.name === name) spots.push({ d, i, rest: ex.rest }); }));
    const rests = exerciseSessions(name, history).slice(-4).map(r => avgRest(r.ex.sets)).filter(v => v > 0);
    if (rests.length < 4) return;
    const sorted = [...rests].sort((a, b) => a - b);
    const median = (sorted[1] + sorted[2]) / 2;
    const usual = roundRest(median);
    const planRest = spots[0].rest;
    if (rests.some(v => Math.abs(v - median) > 20) || spots.every(x => Math.abs(usual - x.rest) < 30)) return;
    const setAll = value => spots.forEach(x => editPlanDay(x.d, exs => { exs[x.i] = { ...exs[x.i], rest: value(x) }; }));
    out.push({
      id: `rest:${name}:${usual}`,
      title: `Make ${fmtClock(usual)} your rest for ${escapeHtml(name)}?`,
      why: `Your last 4 sessions averaged ${rests.map(fmtClock).join(', ')}. The plan says ${fmtClock(planRest)}.`,
      actionLabel: `Use ${fmtClock(usual)}`,
      apply: () => {
        setAll(() => usual);
        return () => setAll(x => x.rest);
      }
    });
  });
  return out;
}

// The order you actually train a day in, when your last 3 sessions of it agree and it isn't the plan's
function orderSuggestions() {
  const order = getHabits().order || {};
  const out = [];
  programData.forEach((day, d) => {
    const recent = (Array.isArray(order[day.title]) ? order[day.title] : []).slice(-3);
    if (recent.length < 3) return;
    const names = day.exercises.map(e => e.name);
    if (new Set(names).size !== names.length) return;
    // Average position of each plan exercise across the sessions it was done in
    const rank = name => {
      const pos = recent.map(e => e.names.indexOf(name)).filter(p => p >= 0);
      return pos.length === recent.length ? pos.reduce((a, b) => a + b, 0) / pos.length : null;
    };
    const ranked = names.map((name, i) => ({ name, i, r: rank(name) }));
    // Exercises you skip keep their place; the ones you always do are put in your order
    const done = ranked.filter(x => x.r !== null);
    if (done.length < 2) return;
    const yours = [...done].sort((a, b) => a.r - b.r || a.i - b.i);
    // Every session must agree on each pair you swap
    const agrees = (a, b) => recent.every(e => e.names.indexOf(a.name) < e.names.indexOf(b.name));
    for (let x = 0; x < yours.length; x++) {
      for (let y = x + 1; y < yours.length; y++) if (!agrees(yours[x], yours[y])) return;
    }
    const slots = done.map(x => x.i);
    const perm = names.map((_, i) => i);
    slots.forEach((slot, k) => { perm[slot] = yours[k].i; });
    if (perm.every((p, i) => p === i)) return;
    const moved = yours.filter((x, k) => x.i !== slots[k]).map(x => x.name);
    out.push({
      id: `order:${day.title}:${perm.join(',')}`,
      title: `Reorder ${day.day} to match how you train?`,
      why: `Your last 3 ${escapeHtml(day.title)} sessions all went ${yours.map(x => escapeHtml(x.name)).join(' → ')}. Moves ${moved.length} exercise${moved.length === 1 ? '' : 's'}.`,
      actionLabel: 'Reorder',
      blocked: dayHasDraft(d) ? 'Finish today\'s sets first' : '',
      apply: () => {
        reorderPlanDay(d, perm);
        const inverse = [];
        perm.forEach((from, to) => { inverse[from] = to; });
        return () => reorderPlanDay(d, inverse);
      }
    });
  });
  return out;
}

function habitSuggestions(history = getHistory()) {
  if (!smartOn()) return [];
  return [...orderSuggestions(), ...restSuggestions(history)];
}

/* Changing the plan */
function editPlanDay(d, change) {
  const plan = getCustomPlan() || templatePlan(TEMPLATES[0]);
  const exs = plan.days[d].exercises.slice();
  change(exs);
  plan.days[d] = { ...plan.days[d], exercises: exs };
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  loadActivePlan();
}

// perm[to] = from. Saved state tied to positions (set counts, swaps, rest) moves with its exercise.
function reorderPlanDay(d, perm) {
  editPlanDay(d, exs => {
    const old = exs.slice();
    perm.forEach((from, to) => { exs[to] = old[from]; });
  });
  const posKey = new RegExp(`^((?:active_)?d${d}_e)(\\d+)(_.*)$|^(swap_d${d}_e)(\\d+)$`);
  const moves = Object.keys(localStorage).map(k => {
    const m = k.match(posKey);
    if (!m) return null;
    const from = Number(m[2] ?? m[5]);
    const to = perm.indexOf(from);
    if (to === -1 || to === from) return null;
    return { k, nk: m[1] ? `${m[1]}${to}${m[3]}` : `${m[4]}${to}`, v: localStorage.getItem(k) };
  }).filter(Boolean);
  moves.forEach(x => localStorage.removeItem(x.k));
  moves.forEach(x => localStorage.setItem(x.nk, x.v));
}

/* Calories at Finish: your usual burn per minute from past workouts, times today's minutes */
function usualCalories(minutes, history = getHistory()) {
  if (!smartOn()) return null;
  const rates = history.filter(s => s.calories > 0 && s.durationSec >= 600).slice(0, 8).map(s => s.calories / (s.durationSec / 60));
  if (rates.length < 3) return null;
  const sorted = rates.sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const rate = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(rate * minutes / 10) * 10;
}
