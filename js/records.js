/* Personal records, the workout summary and confetti. */

/* Personal records. One rule everywhere: a set is a record when it beats every set of that exercise before it,
   meaning your saved workouts plus today's earlier finished sets (in set order). It's re-judged whenever
   something it depends on changes (editing, deleting or re-timing a set, swapping the exercise), so a record
   can't outlive the set that beat it. Your first session of an exercise sets the baseline, so it has none.
   Kinds, the first that applies:
   - weight: heavier than ever (with at least 1 rep)
   - reps:   more reps at a weight you've done before than ever at that weight or heavier
   - e1rm:   a better estimated 1-rep max (Epley), counted only for sets of up to 12 reps, where the estimate holds
   - rest:   the same work or more (weight and reps) after a shorter rest than ever before it. The rest that counts
             is the one taken BEFORE the set (after the previous one), so a session's first set never qualifies. */
const PR_LABELS = { weight: 'Heaviest weight', reps: 'Most reps at this weight', e1rm: 'Best est. 1RM', rest: 'Same work, less rest' };
const E1RM_MAX_REPS = 12;

function estOneRepMax(w, r) {
  return w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;
}

// Saved sets of an exercise, each with the rest taken before it (none for a session's first set)
function savedSetsFor(name, history) {
  const out = [];
  history.forEach(s => s.exercises.forEach(e => {
    if (e.name !== name) return;
    e.sets.forEach((x, i) => out.push({ w: Number(x.weight) || 0, r: Number(x.reps) || 0, restBefore: i ? Number(e.sets[i - 1].restSec) || 0 : 0 }));
  }));
  return out.filter(x => x.r > 0);
}

// The kind of record set { w, r, restBefore } is against the sets before it, or null
function judgeSet(set, before) {
  const { w, r, restBefore } = set;
  if (!(r > 0) || !before.length) return null;
  if (w > 0 && w > Math.max(...before.map(x => x.w))) return 'weight';
  // Reps: you've done this weight before, and never this many reps at it or anything heavier
  if (before.some(x => x.w === w) && r > Math.max(...before.filter(x => x.w >= w).map(x => x.r))) return 'reps';
  const e1 = x => (x.r <= E1RM_MAX_REPS ? estOneRepMax(x.w, x.r) : 0);
  const bestE1 = Math.max(...before.map(e1));
  if (w > 0 && r <= E1RM_MAX_REPS && bestE1 > 0 && e1(set) > bestE1 + 0.01) return 'e1rm';
  const matched = before.filter(x => x.restBefore > 0 && w >= x.w && r >= x.r);
  if (restBefore > 0 && matched.length && restBefore < Math.min(...matched.map(x => x.restBefore))) return 'rest';
  return null;
}

// Re-judge every finished set of a draft exercise, in set order, and store each one's record (or none).
// Returns { setNum: kind } for the sets that are records.
function refreshPrs(dayIdx, exIdx) {
  const ex = getAllExercisesForDay(dayIdx)[exIdx];
  if (!ex) return {};
  const before = savedSetsFor(ex.name, getHistory());
  const baseline = !before.length;
  const found = {};
  let prevDone = false;
  for (let s = 1; s <= getSetCount(dayIdx, exIdx, ex.sets); s++) {
    const key = f => setKey(dayIdx, exIdx, s, f);
    const done = localStorage.getItem(key('done')) === 'true';
    if (!done) {
      localStorage.removeItem(key('pr'));
      prevDone = false;
      continue;
    }
    const set = {
      w: parseFloat(localStorage.getItem(key('w'))) || 0,
      r: parseInt(localStorage.getItem(key('r')), 10) || 0,
      restBefore: prevDone ? getSetRest(dayIdx, exIdx, s - 1, ex) : 0
    };
    const kind = baseline ? null : judgeSet(set, before);
    if (kind) {
      localStorage.setItem(key('pr'), kind);
      found[s] = kind;
    } else {
      localStorage.removeItem(key('pr'));
    }
    if (set.r > 0) before.push(set);
    prevDone = true;
  }
  return found;
}

// A session's records as shown in the summary and History: per exercise and kind, the last set standing
// (three rising sets in one workout are one weight record, the heaviest)
function sessionPrs(session) {
  const out = new Map();
  session.exercises.forEach(e => e.sets.forEach(s => {
    if (s.pr && PR_LABELS[s.pr]) out.set(`${e.name}|${s.pr}`, { name: e.name, set: s, restBefore: Number((e.sets[e.sets.indexOf(s) - 1] || {}).restSec) || 0 });
  }));
  return [...out.values()];
}

/* Workout summary: shown after Finish */
function showSummary({ session, previous }) {
  const exercises = session.exercises;
  const durationSec = session.durationSec || 0;
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const volume = exercises.reduce((sum, e) => sum + e.sets.reduce((v, s) => v + setVolume(s), 0), 0);
  const prs = sessionPrs(session);

  document.getElementById('summary-title').textContent = `${session.day} · ${session.title}`;
  document.getElementById('summary-date').textContent = new Date(session.id).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const tile = (val, lbl, cls = '') => `<div class="summary-tile ${cls}"><div class="summary-tile-val">${val}</div><div class="summary-tile-lbl">${lbl}</div></div>`;
  document.getElementById('summary-grid').innerHTML =
    tile(durationSec ? `${Math.max(1, Math.round(durationSec / 60))}<small>min</small>` : '—', 'Duration') +
    tile(sets, sets === 1 ? 'Set' : 'Sets') +
    tile(`${volume >= 10000 ? fmtNum(volume / 1000) + '<small>t</small>' : `${fmtNum(volume)}<small>kg</small>`}`, 'Volume') +
    tile(prs.length, prs.length === 1 ? 'Personal record' : 'Personal records', prs.length ? 'gold' : '');

  let compare = '';
  if (previous) {
    const prevVolume = previous.exercises.reduce((sum, e) => sum + e.sets.reduce((v, s) => v + setVolume(s), 0), 0);
    if (prevVolume > 0) {
      const pct = Math.round((volume - prevVolume) / prevVolume * 100);
      compare = pct === 0
        ? `Same volume as your last ${escapeHtml(session.day)} on ${shortDate(previous.id)}`
        : `<strong class="${pct > 0 ? 'up' : ''}">${pct > 0 ? '+' : ''}${pct}% volume</strong> vs your last ${escapeHtml(session.day)} on ${shortDate(previous.id)}`;
    }
  }
  document.getElementById('summary-compare').innerHTML = compare;
  document.getElementById('summary-calories').innerHTML = effortRowHtml(session) + caloriesRowHtml(session);

  document.getElementById('summary-prs').innerHTML = prs.length ? `
    <div class="summary-section">Personal records</div>
    <div class="summary-rows prs">${prs.map(p => `
      <div class="summary-row"><span class="summary-row-name">${escapeHtml(p.name)}</span><span class="summary-row-sub">${fmtSetLine(p.set)} · ${PR_LABELS[p.set.pr]}${p.set.pr === 'rest' && p.restBefore ? ` (${fmtClock(p.restBefore)} rest)` : ''}</span></div>`).join('')}
    </div>` : '';

  document.getElementById('summary-list').innerHTML = `
    <div class="summary-section">Exercises</div>
    <div class="summary-rows">${exercises.map(e => {
      const best = e.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
      return `<div class="summary-row"><span class="summary-row-name">${escapeHtml(e.name)}</span><span class="summary-row-sub">${e.sets.length} × · best ${best.weight > 0 ? fmtSetLine(best) : `BW × ${best.reps}`}${avgRest(e.sets) ? ` · rest ${fmtClock(avgRest(e.sets))}` : ''}</span></div>`;
    }).join('')}
    </div>`;

  const el = document.getElementById('summary');
  el.hidden = false;
  el.querySelector('.summary-scroll').scrollTop = 0;
  void el.offsetWidth;
  el.classList.add('open');
  launchConfetti(prs.length ? 70 : 44);
  haptic('success');
  setTimeout(() => haptic('success'), 180);
  if (prs.length) setTimeout(playChime, 150);
}

/* Effort: how hard the whole workout felt, asked at Finish. Stored on the 0–10 scale used for session RPE
   (effort × minutes is the session's training load); the four choices are the points people actually use. */
const EFFORT_LEVELS = [
  { value: 3, label: 'Easy', hint: 'could do lots more' },
  { value: 5, label: 'Moderate', hint: 'solid work' },
  { value: 7, label: 'Hard', hint: 'pushed it' },
  { value: 10, label: 'All out', hint: 'nothing left' }
];

// The closest level's name ("Hard"), or '' when none was given
function effortLabel(value) {
  if (!(value > 0)) return '';
  return EFFORT_LEVELS.reduce((a, l) => (Math.abs(l.value - value) < Math.abs(a.value - value) ? l : a)).label;
}

function effortButtonsHtml(selected, handler) {
  return EFFORT_LEVELS.map((l, i) => `
    <button aria-pressed="${l.value === selected}" onclick="${handler}(${l.value})">
      <span class="effort-bars" aria-hidden="true">${[6, 9, 12, 16].map((h, j) => `<span class="${j <= i ? 'on' : ''}" style="height:${h}px"></span>`).join('')}</span>
      ${l.label}<i>${l.hint}</i>
    </button>`).join('');
}

// On the summary and in a workout's details: change the effort later (tap the chosen one again to clear it)
function effortRowHtml(session) {
  return `
    <div class="effort-row">
      <div class="fin-label" id="effort-${session.id}">Effort</div>
      <div class="effort" role="group" aria-labelledby="effort-${session.id}">${effortButtonsHtml(session.effort || null, `setSessionEffort.bind(null, ${session.id})`)}</div>
    </div>`;
}

function setSessionEffort(sessionId, value) {
  const history = getHistory();
  const session = history.find(s => s.id === sessionId);
  if (!session) return;
  if (session.effort === value) delete session.effort;
  else session.effort = value;
  saveHistory(history);
  haptic('light');
  document.querySelectorAll(`[aria-labelledby="effort-${sessionId}"]`).forEach(el => { el.innerHTML = effortButtonsHtml(session.effort || null, `setSessionEffort.bind(null, ${sessionId})`); });
  if (typeof renderCalendarAndHistory === 'function') renderCalendarAndHistory();
}

/* Calories burned, typed from a fitness watch (the app can't measure them). Saved on the workout as whole kcal. */
const MAX_CALORIES = 5000;

function caloriesRowHtml(session) {
  return `
    <label class="cal-row">
      <span class="cal-text"><span class="cal-label">Calories burned</span><span class="cal-hint">Active calories from your watch · optional</span></span>
      <span class="cal-field"><input type="number" inputmode="numeric" min="0" max="${MAX_CALORIES}" placeholder="—" value="${session.calories || ''}" aria-label="Calories burned, kcal" onfocus="this.select()" onchange="setSessionCalories(${session.id}, this.value)"><span class="cal-unit">kcal</span></span>
    </label>`;
}

function setSessionCalories(sessionId, value) {
  const history = getHistory();
  const session = history.find(s => s.id === sessionId);
  if (!session) return;
  const text = String(value).trim();
  const kcal = Math.round(parseFloat(text));
  if (text && !(kcal > 0 && kcal <= MAX_CALORIES)) {
    haptic('error');
    showToast(`Enter calories between 1 and ${MAX_CALORIES}`, { type: 'error' });
    return;
  }
  if (text) session.calories = kcal;
  else delete session.calories;
  saveHistory(history);
  haptic('light');
  showToast(text ? `Saved ${kcal} kcal` : 'Calories cleared');
  if (typeof renderCalendarAndHistory === 'function') renderCalendarAndHistory();
}

function closeSummary(goTo) {
  const el = document.getElementById('summary');
  el.classList.remove('open');
  setTimeout(() => { el.hidden = true; document.getElementById('confetti').innerHTML = ''; }, 300);
  currentDayIdx = upNextDayIdx();
  initNav();
  scrollActiveTab();
  renderWorkout();
  updateStats();
  if (goTo === 'history') {
    calendarMonthOffset = 0;
    switchView('history');
  } else {
    switchView('workout');
  }
  window.scrollTo(0, 0);
}

function launchConfetti(count) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#30D158', '#FFD60A', '#0A84FF', '#FF9F0A', '#FFFFFF', '#BF5AF2'];
  document.getElementById('confetti').innerHTML = Array.from({ length: count }, () => {
    const left = Math.random() * 100;
    const dx = (Math.random() - 0.5) * 160;
    const rot = (Math.random() - 0.5) * 900;
    const delay = Math.random() * 0.5;
    const dur = 1.8 + Math.random() * 1.2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `<i style="left:${left}%; background:${color}; --dx:${dx}px; --rot:${rot}deg; animation-delay:${delay}s; animation-duration:${dur}s"></i>`;
  }).join('');
}
