/* Muscle recovery: a rough, explainable estimate of how fresh each muscle is, from your saved workouts.
   Each session leaves fatigue on the muscles it trained (sets, weighted by how hard it felt) that halves
   every 24 hours, so a hard 8-set session is ~50% recovered after a day, ~75% after two and ~90% after
   three, in line with the usual 48–72 hours. A guide, not a measurement: how you feel wins. */
const RECOVERY_HALF_LIFE_H = 24;
const RECOVERY_FULL_SETS = 8;

function muscleFatigue(history = getHistory(), now = Date.now()) {
  const out = {};
  history.filter(s => now - s.id < 7 * DAY_MS && s.id <= now).forEach(s => {
    // Effort 10 counts a set in full, effort 5 as 0.8; unknown effort as 0.85
    const weight = s.effort > 0 ? 0.6 + 0.04 * s.effort : 0.85;
    const hours = (now - (s.updatedAt || s.id)) / 3600e3;
    s.exercises.forEach(e => {
      const muscle = exerciseMuscle(e.name);
      if (!muscle) return;
      const m = out[muscle] || (out[muscle] = { left: 0, lastAt: 0, sets: 0 });
      m.left += e.sets.length * weight * 2 ** (-Math.max(0, hours) / RECOVERY_HALF_LIFE_H);
      if (s.id > m.lastAt) { m.lastAt = s.id; m.sets = 0; }
      if (s.id === m.lastAt) m.sets += e.sets.length;
    });
  });
  return out;
}

function recoveryPct(f) {
  return f ? Math.max(0, Math.min(100, Math.round(100 * (1 - f.left / RECOVERY_FULL_SETS)))) : 100;
}

function recoveryState(pct) {
  return pct >= 85 ? { key: 'ready', label: 'Ready' } : pct >= 50 ? { key: 'mid', label: 'Recovering' } : { key: 'low', label: 'Tired' };
}

function agoLabel(ms, now = Date.now()) {
  const h = Math.round((now - ms) / 3600e3);
  if (h < 1) return 'just now';
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function dayMuscles(dayIdx) {
  const muscles = getAllExercisesForDay(dayIdx).map(e => exerciseMuscle(e.name)).filter(Boolean);
  return [...new Set(muscles)];
}

function planMuscles() {
  return MUSCLES.filter(m => programData.some(d => d.exercises.some(e => exerciseMuscle(e.name) === m)));
}

/* Progress tab: one bar per muscle the plan trains, least recovered first */
function renderRecovery() {
  const box = document.getElementById('recovery-list');
  if (!box) return;
  const fatigue = muscleFatigue();
  const rows = planMuscles().map(m => ({ m, f: fatigue[m], pct: recoveryPct(fatigue[m]) })).sort((a, b) => a.pct - b.pct);
  document.getElementById('recovery-card').hidden = !rows.length;
  box.innerHTML = rows.map(({ m, f, pct }) => {
    const st = recoveryState(pct);
    return `
      <div class="rec-row ${st.key}">
        <span class="rec-name">${m}</span>
        <span class="rec-bar" role="img" aria-label="${m} ${pct}% recovered, ${st.label}"><span style="width:${pct}%"></span></span>
        <span class="rec-pct">${pct}%</span>
        <span class="rec-sub">${st.label}${f && f.lastAt ? ` · ${f.sets} set${f.sets === 1 ? '' : 's'} ${agoLabel(f.lastAt)}` : ' · not trained this week'}</span>
      </div>`;
  }).join('');
}

/* Workout tab: a line under the day's title when a muscle it trains isn't fresh yet */
function dayRecoveryHtml(dayIdx) {
  if (workoutClock()) return '';
  const fatigue = muscleFatigue();
  const tired = dayMuscles(dayIdx).map(m => ({ m, f: fatigue[m], pct: recoveryPct(fatigue[m]) })).filter(x => x.pct < 85).sort((a, b) => a.pct - b.pct);
  if (!tired.length) return '';
  const low = tired[0].pct < 50;
  return `
    <button class="day-recovery ${low ? 'low' : ''}" onclick="switchView('progress')" aria-label="Muscle recovery. Open Progress">
      <span class="day-recovery-title">${low ? `${tired[0].m} is still tired` : 'Still recovering'}</span>
      <span class="day-recovery-sub">${tired.slice(0, 3).map(x => `${x.m} ${x.pct}%`).join(' · ')}${low ? ` · trained ${agoLabel(tired[0].f.lastAt)}. Go lighter, or do another day first.` : ''}</span>
    </button>`;
}
