/* Personal records, the workout summary and confetti. */

/* Personal records: compared with saved history plus the other finished sets of today's draft */
const PR_LABELS = { weight: 'Heaviest weight', e1rm: 'Best est. 1RM', reps: 'Most reps', rest: 'Less rest' };

function estOneRepMax(w, r) {
  return w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;
}

function detectPr(ex, exIdx, setNum, w, r) {
  const past = [];
  getHistory().forEach(s => s.exercises.forEach(e => {
    if (e.name === ex.name) e.sets.forEach(x => past.push({ w: x.weight || 0, r: x.reps || 0, rest: Number(x.restSec) || 0 }));
  }));

  // A first-ever session sets the baseline; it isn't a record yet.
  if (!past.length || !(r > 0)) return null;
  const count = getSetCount(currentDayIdx, exIdx, ex.sets);
  for (let s = 1; s <= count; s++) {
    if (s === setNum || localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) !== 'true') continue;
    past.push({ w: parseFloat(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'w'))) || 0, r: parseInt(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'r')), 10) || 0, rest: getSetRest(currentDayIdx, exIdx, s, ex) });
  }
  const valid = past.filter(x => x.r > 0);
  if (!valid.length) return null;
  if (w > 0 && w > Math.max(...valid.map(x => x.w))) return 'weight';
  if (w > 0 && estOneRepMax(w, r) > Math.max(...valid.map(x => estOneRepMax(x.w, x.r))) + 0.01) return 'e1rm';
  const sameOrHeavier = valid.filter(x => x.w >= w);
  if (sameOrHeavier.length && r > Math.max(...sameOrHeavier.map(x => x.r))) return 'reps';
  // Same work as a saved set (at least its weight and reps) on less rest than ever before
  const rest = getSetRest(currentDayIdx, exIdx, setNum, ex);
  const matched = valid.filter(x => x.rest > 0 && x.r > 0 && w >= x.w && r >= x.r);
  if (matched.length && rest < Math.min(...matched.map(x => x.rest))) return 'rest';
  return null;
}

/* Workout summary: shown after Finish */
function showSummary({ session, previous }) {
  const exercises = session.exercises;
  const durationSec = session.durationSec || 0;
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const volume = exercises.reduce((sum, e) => sum + e.sets.reduce((v, s) => v + setVolume(s), 0), 0);
  const prs = [];
  exercises.forEach(e => e.sets.forEach(s => { if (s.pr) prs.push({ name: e.name, set: s }); }));

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
      <div class="summary-row"><span class="summary-row-name">${escapeHtml(p.name)}</span><span class="summary-row-sub">${fmtSetLine(p.set)} · ${PR_LABELS[p.set.pr]}${p.set.pr === 'rest' && p.set.restSec ? ` (${fmtClock(p.set.restSec)})` : ''}</span></div>`).join('')}
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
