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
