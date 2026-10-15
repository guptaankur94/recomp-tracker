/* Progress tab: bodyweight, main lifts and exercise charts. */

/* Progress: bodyweight log */
function logBodyweight() {
  const input = document.getElementById('bw-input');
  const kg = parseFloat(input.value);
  const dateStr = document.getElementById('bw-date').value || localDateStr(new Date());
  if (isNaN(kg) || kg < 20 || kg > 300) {
    fieldError(input, 'Enter your weight in kg, between 20 and 300.', input.parentElement);
    return;
  }
  // One entry per day; logging again on the same date replaces it.
  const entries = getBodyweight().filter(e => e.dateStr !== dateStr);
  entries.push({ dateStr, kg: Math.round(kg * 10) / 10 });
  saveBodyweight(entries);
  input.value = '';
  input.blur();
  renderProgress();
  haptic('success');
  showToast(`${fmtNum(kg)} kg logged for ${shortDate(bwDateMs(dateStr))}`);
}

function deleteBodyweight(dateStr) {
  const removed = getBodyweight().find(e => e.dateStr === dateStr);
  if (!removed) return;
  saveBodyweight(getBodyweight().filter(e => e.dateStr !== dateStr));
  renderProgress();
  haptic('light');
  showToast('Weight entry deleted', {
    actionLabel: 'Undo',
    onAction: () => {
      saveBodyweight([...getBodyweight().filter(e => e.dateStr !== dateStr), removed]);
      renderProgress();
    }
  });
}

function bwDateMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/* Progress: one time range for every chart on the tab */
const RANGES = { '1m': { label: '1M', days: 31 }, '3m': { label: '3M', days: 92 }, '6m': { label: '6M', days: 183 }, all: { label: 'All', days: null } };

let progressRange = '3m';

let chartAnimate = true;

let showBwEntries = false;

let showExEntries = false;

function rangeStartMs() {
  const days = RANGES[progressRange].days;
  return days ? Date.now() - days * 864e5 : -Infinity;
}

function selectRange(key) {
  progressRange = key;
  haptic('light');
  renderProgress();
}

function toggleEntries(which) {
  if (which === 'bw') showBwEntries = !showBwEntries;
  else showExEntries = !showExEntries;
  chartAnimate = false;
  renderProgress();
}

/* Bodyweight: daily weigh-ins swing 1–2 kg, so the 7-day average is the line to watch */
function movingAverage(entries) {
  return entries.map((e, i) => {
    const t = bwDateMs(e.dateStr);
    const win = entries.slice(0, i + 1).filter(x => t - bwDateMs(x.dateStr) < 7 * 864e5);
    return { x: t, y: win.reduce((sum, x) => sum + x.kg, 0) / win.length, raw: e.kg };
  });
}

// Least-squares slope of the last 28 days of weigh-ins, in kg per week
function weeklyRate(entries) {
  if (!entries.length) return null;
  const lastT = bwDateMs(entries[entries.length - 1].dateStr);
  const recent = entries.filter(e => lastT - bwDateMs(e.dateStr) <= 28 * 864e5);
  if (recent.length < 3) return null;
  const xs = recent.map(e => bwDateMs(e.dateStr) / 864e5);
  if (xs[xs.length - 1] - xs[0] < 7) return null;
  const ys = recent.map(e => e.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}

function renderBodyweight() {
  const entries = getBodyweight();
  const dateInput = document.getElementById('bw-date');
  if (!dateInput.value) dateInput.value = localDateStr(new Date());
  const input = document.getElementById('bw-input');
  if (!input.value && entries.length) input.placeholder = fmtNum(entries[entries.length - 1].kg);
  const goalKg = getGoalKg();
  const avg = movingAverage(entries);
  const trend = avg.length ? avg[avg.length - 1].y : null;
  const rate = weeklyRate(entries);

  // Trend, weekly rate and projected goal date
  const towardGoal = r => goalKg && trend != null && r !== 0 && Math.sign(goalKg - trend) === Math.sign(r);
  let goalVal = goalKg ? `${fmtNum(goalKg)}<small>kg</small>` : '—';
  let goalLbl = goalKg ? 'Goal' : 'Set a goal in Settings';
  if (goalKg && trend != null) {
    const left = Math.round((goalKg - trend) * 10) / 10;
    if (Math.abs(left) <= 0.2) {
      goalLbl = 'At goal';
    } else if (rate && towardGoal(rate)) {
      const weeks = (goalKg - trend) / rate;
      goalLbl = weeks < 104
        ? `~${new Date(Date.now() + weeks * 7 * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at this rate`
        : `${fmtNum(Math.abs(left))} kg to go`;
    } else {
      goalLbl = `${fmtNum(Math.abs(left))} kg to go`;
    }
  }
  const rateCls = rate == null || Math.abs(rate) < 0.05 ? '' : towardGoal(rate) ? 'good' : goalKg ? 'bad' : '';
  document.getElementById('bw-stats').innerHTML = trend == null ? '' : `
    <div class="stat-tile"><div class="stat-tile-val">${fmtNum(trend)}<small>kg</small></div><div class="stat-tile-lbl">7-day average</div></div>
    <div class="stat-tile"><div class="stat-tile-val ${rateCls}">${rate == null ? '—' : `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${fmtNum(Math.abs(rate))}`}<small>kg/wk</small></div><div class="stat-tile-lbl">${rate == null ? 'Need 1 week of data' : rateCls === 'good' ? '↗ Toward goal' : rateCls === 'bad' ? '↘ Away from goal' : 'Last 4 weeks'}</div></div>
    <div class="stat-tile"><div class="stat-tile-val">${goalVal}</div><div class="stat-tile-lbl">${goalLbl}</div></div>`;

  const start = rangeStartMs();
  renderLineChart('bw-chart', avg.filter(p => p.x >= start), {
    raw: avg.filter(p => p.x >= start).map(p => ({ x: p.x, y: p.raw })),
    target: goalKg,
    targetLabel: `Goal ${fmtNum(goalKg)} kg`,
    label: trend != null ? `Bodyweight, 7-day average ${fmtNum(trend)} kg${rate != null ? `, changing ${fmtNum(rate)} kg per week` : ''}` : 'Bodyweight',
    emptyText: entries.length ? 'No weigh-ins in this range.' : 'Log your weight a few times a week. The app averages it, so day-to-day swings don\'t mislead you.',
    key: entries.length ? '<span class="key-line"></span>7-day average<span class="key-dot"></span>Weigh-ins' : '',
    tip: p => `${shortDate(p.x)} · avg <strong>${fmtNum(p.y)} kg</strong> · weighed ${fmtNum(p.raw)}`
  });

  const recent = entries.slice().reverse();
  document.getElementById('bw-entries-btn').hidden = !entries.length;
  document.getElementById('bw-entries-btn').textContent = showBwEntries ? 'Hide entries' : `Show all entries (${entries.length})`;
  document.getElementById('bw-list').innerHTML = showBwEntries && recent.length ? `
    <table class="data-table">
      <tr><th>Date</th><th class="num">Weight</th><th></th></tr>
      ${recent.map(e => `
        <tr>
          <td>${shortDate(bwDateMs(e.dateStr))}</td>
          <td class="num">${fmtNum(e.kg)} kg</td>
          <td class="num"><button class="mini-del-btn" onclick="deleteBodyweight('${e.dateStr}')" aria-label="Delete entry">${icon('x')}</button></td>
        </tr>`).join('')}
    </table>` : '';
}

/* Exercise charts */
const METRICS = {
  top: { label: 'Top Set', unit: 'kg', calc: sets => Math.max(...sets.map(s => s.weight)) },
  e1rm: {
    label: '1RM', unit: 'kg',
    // Epley estimate from the best set
    calc: sets => Math.max(...sets.map(s => estOneRepMax(s.weight, s.reps)))
  },
  volume: { label: 'Volume', unit: 'kg', calc: sets => sets.reduce((sum, s) => sum + setVolume(s), 0) },
  reps: { label: 'Reps', unit: 'reps', calc: sets => Math.max(...sets.map(s => s.reps)) },
  // Average rest chosen between sets; going down at the same load is progress
  rest: { label: 'Rest', unit: '', lowerBetter: true, fmt: v => fmtClock(v), calc: sets => avgRest(sets) || null }
};

function selectProgressExercise(name) {
  progressExercise = name;
  showExEntries = false;
  renderExerciseProgress();
  renderLiftCards();
}

function selectProgressMetric(key) {
  progressMetric = key;
  haptic('light');
  renderExerciseProgress();
}

// Sessions for one exercise, oldest first
function exerciseSessions(name, history = getHistory()) {
  return history
    .map(s => ({ session: s, ex: s.exercises.find(e => e.name === name) }))
    .filter(r => r.ex && r.ex.sets.length)
    .reverse();
}

// Gold markers: sessions that logged a PR, plus the all-time best on this metric.
// (Marking every new high would turn steady progress into a row of gold dots.)
function markRecords(points, lowerBetter = false) {
  const bestIdx = points.reduce((bi, p, i) => ((lowerBetter ? p.y <= points[bi].y : p.y >= points[bi].y) ? i : bi), 0);
  return points.map((p, i) => ({ ...p, record: p.pr || (points.length > 1 && i === bestIdx), best: points.length > 1 && i === bestIdx }));
}

/* Main lifts: the six most-logged exercises, each with a sparkline of estimated 1RM */
function renderLiftCards() {
  const history = getHistory();
  const counts = new Map();
  history.forEach(s => s.exercises.forEach(e => counts.set(e.name, (counts.get(e.name) || 0) + 1)));
  const top = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  const box = document.getElementById('lift-cards');
  document.getElementById('lifts-card').hidden = !top.length;
  if (!top.length) return;
  box.innerHTML = top.map(name => {
    const rows = exerciseSessions(name, history);
    const usesWeight = rows.some(r => r.ex.sets.some(s => s.weight > 0));
    const vals = rows.map(r => usesWeight ? METRICS.e1rm.calc(r.ex.sets) : METRICS.reps.calc(r.ex.sets));
    const latest = rows[rows.length - 1].ex.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
    const change = vals[vals.length - 1] - vals[0];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1) * 96 + 2).toFixed(1)},${(hi === lo ? 14 : 26 - (v - lo) / (hi - lo) * 22).toFixed(1)}`).join(' ');
    return `
      <button class="lift-card ${name === progressExercise ? 'active' : ''}" onclick="selectProgressExercise(${escapeHtml(JSON.stringify(name))}); document.getElementById('ex-card').scrollIntoView({ behavior: 'smooth', block: 'start' })">
        <span class="lift-name">${escapeHtml(name)}</span>
        <svg class="lift-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>
        <span class="lift-val">${latest.weight > 0 ? `${fmtNum(latest.weight)}<small>kg</small> × ${latest.reps}` : `${latest.reps}<small>reps</small>`}</span>
        <span class="lift-change ${change > 0.05 ? 'up' : ''}">${Math.abs(change) < 0.05 ? 'No change yet' : `${change > 0 ? '↑' : '↓'} ${fmtNum(Math.abs(change))} ${usesWeight ? 'kg est. 1RM' : 'reps'}`}</span>
      </button>`;
  }).join('');
}

function renderExerciseProgress() {
  const history = getHistory();
  const names = [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))].sort((a, b) => a.localeCompare(b));
  const select = document.getElementById('progress-ex-select');
  if (!names.includes(progressExercise)) {
    progressExercise = history.length ? history[0].exercises[0].name : null;
  }
  select.innerHTML = names.map(n => `<option value="${escapeHtml(n)}" ${n === progressExercise ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
  select.style.display = names.length ? 'block' : 'none';
  document.getElementById('metric-seg').innerHTML = Object.entries(METRICS).map(([key, m]) =>
    `<button class="seg-btn ${key === progressMetric ? 'active' : ''}" onclick="selectProgressMetric('${key}')">${m.label}</button>`
  ).join('');

  document.getElementById('progress-tip').innerHTML = names.length && !tipSeen('records')
    ? coachTip('records', 'Reading the chart.', 'Gold dots mark records: heavier weight, more reps, or the same work on less rest. Switch to Rest to see your rest times trend down.')
    : '';
  const metric = METRICS[progressMetric];
  const fmtVal = v => metric.fmt ? metric.fmt(v) : `${fmtNum(v)} ${metric.unit}`;
  const rows = exerciseSessions(progressExercise, history);
  const points = markRecords(rows
    .map(r => ({ x: r.session.id, y: metric.calc(r.ex.sets), day: r.session.day, pr: r.ex.sets.some(s => s.pr) }))
    .filter(p => p.y != null), metric.lowerBetter);
  const start = rangeStartMs();
  const shown = points.filter(p => p.x >= start);
  const bestShown = shown.length ? (metric.lowerBetter ? Math.min : Math.max)(...shown.map(p => p.y)) : 0;
  renderLineChart('ex-chart', shown, {
    emptyText: !rows.length ? 'Finish your first workout and your lifts will be charted here, with personal records marked.'
      : !points.length ? 'No rest times logged for this exercise yet.' : 'No sessions in this range.',
    label: shown.length ? `${progressExercise} ${metric.label}: latest ${fmtVal(shown[shown.length - 1].y)}, best ${fmtVal(bestShown)}` : '',
    key: shown.some(p => p.record) ? `<span class="key-dot gold"></span>PR session or all-time best${metric.lowerBetter ? ' · lower is better' : ''}` : metric.lowerBetter && shown.length ? 'Lower is better' : '',
    fmtY: metric.fmt,
    tip: p => `${shortDate(p.x)} · ${escapeHtml(p.day)} · <strong>${fmtVal(p.y)}</strong>${p.best ? ' · <span class="tip-pr">Best</span>' : p.pr ? ' · <span class="tip-pr">PR</span>' : ''}`
  });

  const recent = rows.slice().reverse();
  document.getElementById('ex-entries-btn').hidden = !rows.length;
  document.getElementById('ex-entries-btn').textContent = showExEntries ? 'Hide sessions' : `Show all sessions (${rows.length})`;
  document.getElementById('ex-table').innerHTML = showExEntries && recent.length ? `
    <table class="data-table">
      <tr><th>Date</th><th>Best Set</th><th class="num">Volume</th></tr>
      ${recent.map(r => {
        const best = r.ex.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
        return `
        <tr>
          <td>${shortDate(r.session.id)}</td>
          <td>${fmtSetLine(best)}${best.drops ? ` +${best.drops.length} drop` : ''}${r.ex.sets.some(s => s.pr) ? ' <span class="pr-badge">PR</span>' : ''}</td>
          <td class="num">${fmtVolume(METRICS.volume.calc(r.ex.sets))}</td>
        </tr>`;
      }).join('')}
    </table>` : '';
}

function renderProgress() {
  document.getElementById('range-seg').innerHTML = Object.entries(RANGES).map(([key, r]) =>
    `<button class="seg-btn ${key === progressRange ? 'active' : ''}" onclick="selectRange('${key}')">${r.label}</button>`
  ).join('');
  renderBodyweight();
  renderLiftCards();
  renderExerciseProgress();
  chartAnimate = true;
}

let resizeTimer = null;
