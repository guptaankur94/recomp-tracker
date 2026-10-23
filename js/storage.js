/* Saved workouts and bodyweight, set counts and last performance. */

/* History & bodyweight storage */
function getHistory() {
  const history = readJSON(HISTORY_KEY, []);
  return Array.isArray(history) ? history.sort((a, b) => b.id - a.id) : [];
}

function saveHistory(historyArr) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyArr));
  updateStats();
  if (typeof renderBackupBadge === 'function') renderBackupBadge();
}

function getBodyweight() {
  const entries = readJSON(BODYWEIGHT_KEY, []);
  return Array.isArray(entries) ? entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr)) : [];
}

function saveBodyweight(entries) {
  localStorage.setItem(BODYWEIGHT_KEY, JSON.stringify(entries));
  updateStats();
}

/* Your own warm-ups, by exercise name (missing: the automatic ramp; an empty list: no warm-up) */
function getWarmups() {
  const map = readJSON(WARMUPS_KEY, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function customWarmup(name) {
  const list = getWarmups()[name];
  return Array.isArray(list) ? list.filter(w => w && w.reps > 0) : null;
}

function saveWarmup(name, list) {
  const map = getWarmups();
  if (list) map[name] = list;
  else delete map[name];
  localStorage.setItem(WARMUPS_KEY, JSON.stringify(map));
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

// Consecutive weeks (Mon–Sun) with at least one logged workout. The current week
// doesn't break the streak until it ends without a session.
function calcWeekStreak(history) {
  const weeks = new Set(history.map(s => startOfWeek(new Date(s.id)).getTime()));
  const cursor = startOfWeek(new Date());
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function getSetCount(dayIdx, exIdx, defaultSets) {
  const stored = localStorage.getItem(`d${dayIdx}_e${exIdx}_setcount`);
  return stored ? parseInt(stored, 10) : defaultSets;
}

function saveSetCount(dayIdx, exIdx, count) {
  localStorage.setItem(`d${dayIdx}_e${exIdx}_setcount`, count);
}

// Most recent logged sets for an exercise (matched by name, across all days).
function getLastPerformance(exName, history) {
  for (const session of history) {
    const ex = session.exercises.find(e => e.name === exName);
    if (ex) return { session, sets: ex.sets };
  }
  return null;
}
