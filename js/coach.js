/* The Coach card (Progress tab): training advice worked out on this phone from your saved workouts and
   weigh-ins. Each tip is a plain rule with its reason and source, never a black box. Rules:
   stalled lifts → a lighter week; weekly sets per muscle; program goals on track or behind; a jump in
   training load; and weight change against your goal, with a calorie nudge. Smart suggestions (habits.js)
   are listed below the tips. */
const COACH_KEY = 'recomp_coach';
const TIP_SNOOZE_DAYS = 14;
const SUGGESTION_SNOOZE_DAYS = 30;
const DAY_MS = 864e5;

const COACH_SOURCES = {
  deload: 'Bell et al. 2023, deloading consensus (Sports Medicine – Open)',
  volume: 'Schoenfeld, Ogborn & Krieger 2017, weekly sets meta-analysis (J Sports Sciences)',
  load: 'Foster 2001 (session effort × minutes); Gabbett 2016; but see Impellizzeri 2020: a hint, not a verdict',
  cut: 'Ruiz-Castellano et al. 2021, fat loss in resistance-trained athletes (Nutrients)'
};

function coachDismissed() {
  const c = readJSON(COACH_KEY, {});
  return c && c.dismissed && typeof c.dismissed === 'object' ? c.dismissed : {};
}

function dismissCoach(id, days) {
  const dismissed = coachDismissed();
  const now = Date.now();
  Object.keys(dismissed).forEach(k => { if (dismissed[k] < now) delete dismissed[k]; });
  dismissed[id] = now + days * DAY_MS;
  localStorage.setItem(COACH_KEY, JSON.stringify({ dismissed }));
}

function planNames() {
  return [...new Set(programData.flatMap(d => d.exercises.map(e => e.name)))];
}

// Best estimated 1RM (or reps, without weight) per session of one exercise, oldest first
function liftSeries(name, history) {
  const rows = exerciseSessions(name, history);
  const weighted = rows.some(r => r.ex.sets.some(s => s.weight > 0));
  return { weighted, points: rows.map(r => ({ t: r.session.id, v: weighted ? METRICS.e1rm.calc(r.ex.sets) : METRICS.reps.calc(r.ex.sets) })) };
}

/* 1. Stalled lifts: no new best in the last 3 sessions (5+ sessions, trained in the last 3 weeks) */
function plateauTips(history, now) {
  const stalled = [];
  planNames().forEach(name => {
    const { weighted, points } = liftSeries(name, history);
    if (points.length < 5 || now - points[points.length - 1].t > 21 * DAY_MS) return;
    const before = Math.max(...points.slice(0, -3).map(p => p.v));
    const recent = points.slice(-3).map(p => p.v);
    if (Math.max(...recent) > before) return;
    const unit = weighted ? ' kg' : ' reps';
    const hasAlt = programData.some(d => d.exercises.some(e => e.name === name && e.alt && e.alt.name));
    stalled.push({ name, before, recent, unit, weighted, hasAlt });
  });
  if (!stalled.length) return [];
  const howTo = 'Train one lighter week: the same exercises with about half the sets and a little less weight, then build back up. Coaches use it to shed fatigue so progress can restart.';
  if (stalled.length >= 3) {
    return [{
      id: `plateau:many:${stalled.map(s => s.name).join('|')}`, tone: 'warn',
      title: `${stalled.length} lifts have stalled. Time for a lighter week?`,
      body: howTo,
      why: `No new best in 3 sessions: ${stalled.map(s => escapeHtml(s.name)).join(', ')}.`,
      source: COACH_SOURCES.deload
    }];
  }
  return stalled.map(s => ({
    id: `plateau:${s.name}:${Math.round(s.before)}`, tone: 'warn',
    title: `${escapeHtml(s.name)} has stalled`,
    body: s.weighted ? `${howTo}${s.hasAlt ? ' Or swap it for its alternative for a few weeks.' : ''}` : 'Try a harder variation, or add weight, to give it a new challenge.',
    why: `Best ${s.weighted ? 'est. 1RM' : ''} ${fmtNum(Math.round(s.before * 10) / 10)}${s.unit} before; the last 3 sessions: ${s.recent.map(v => fmtNum(Math.round(v * 10) / 10)).join(', ')}${s.unit}.`,
    source: COACH_SOURCES.deload
  }));
}

/* 2. Weekly sets per muscle over the last 2 weeks, for muscles the plan trains (core aside) */
function weeklySetsByMuscle(history, now) {
  const counts = {};
  history.filter(s => now - s.id < 14 * DAY_MS).forEach(s => s.exercises.forEach(e => {
    const lib = LIBRARY.get(e.name);
    if (lib) counts[lib.muscle] = (counts[lib.muscle] || 0) + e.sets.length / 2;
  }));
  return counts;
}

function volumeTips(history, now) {
  const oldest = history.length ? history[history.length - 1].id : now;
  const recent = history.filter(s => now - s.id < 14 * DAY_MS);
  if (now - oldest < 14 * DAY_MS || recent.length < 3) return [];
  const trained = new Set(planNames().map(n => LIBRARY.get(n)).filter(Boolean).map(l => l.muscle).filter(m => m !== 'Core'));
  const perWeek = weeklySetsByMuscle(history, now);
  const low = [...trained].map(m => ({ m, n: perWeek[m] || 0 })).filter(x => x.n < 10).sort((a, b) => a.n - b.n);
  if (!low.length) {
    return [{
      id: 'volume:ok', tone: 'good',
      title: 'Every muscle gets 10+ sets a week',
      body: 'That\'s the range linked with the most growth in the research. Keep it there.',
      why: `Sets a week, last 2 weeks: ${[...trained].map(m => `${m} ${fmtNum(Math.round((perWeek[m] || 0) * 2) / 2)}`).join(', ')}.`,
      source: COACH_SOURCES.volume
    }];
  }
  const shown = low.slice(0, 3);
  return [{
    id: `volume:${shown.map(x => x.m).join('|')}`, tone: 'info',
    title: `Few sets for ${shown.map(x => x.m.toLowerCase()).join(', ')}`,
    body: 'Research found more muscle growth with 10 or more sets per muscle a week than with fewer. If you recover well, add a set or two to an exercise for these.',
    why: `Sets a week, last 2 weeks: ${shown.map(x => `${x.m} ${fmtNum(Math.round(x.n * 2) / 2)}`).join(', ')}.`,
    source: COACH_SOURCES.volume
  }];
}

/* 3. Program goals: the trend in est. 1RM since the program started, projected to its last day */
function slopePerDay(points) {
  const xs = points.map(p => p.t / DAY_MS);
  const ys = points.map(p => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
}

function forecastTips(history, now) {
  const program = getProgram();
  const status = programStatus(program, new Date(now));
  if (!status || status.ended || status.week < 2) return [];
  const [y, m, d] = program.startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(`${status.endDate}T23:59:00`).getTime();
  const results = [];
  programData.forEach(day => day.exercises.forEach(ex => {
    const goal = exerciseGoal(ex);
    if (!goal || !goal.kg || results.some(r => r.name === ex.name)) return;
    const points = liftSeries(ex.name, history).points.filter(p => p.t >= start);
    if (points.length < 3) return;
    const target = estOneRepMax(goal.kg, goal.reps);
    const latest = points[points.length - 1].v;
    const projected = latest + slopePerDay(points) * Math.max(0, (end - points[points.length - 1].t) / DAY_MS);
    results.push({ name: ex.name, reached: latest >= target, onTrack: projected >= target, pct: Math.min(100, Math.round(projected / target * 100)) });
  }));
  if (!results.length) return [];
  const ok = results.filter(r => r.reached || r.onTrack);
  const behind = results.filter(r => !r.reached && !r.onTrack).sort((a, b) => a.pct - b.pct);
  return [{
    id: `forecast:${status.week}:${behind.map(r => r.name).join('|')}`, tone: behind.length ? 'info' : 'good',
    title: `Week ${status.week} of ${status.weeks}: on track for ${ok.length} of ${results.length} goal${results.length === 1 ? '' : 's'}`,
    body: behind.length
      ? 'For the ones behind, add a rep or a small step of weight whenever the last session felt easy.'
      : 'At your current pace you reach every goal you\'ve trained since the program started.',
    why: behind.length
      ? `At this pace by ${shortDate(end)}: ${behind.slice(0, 3).map(r => `${escapeHtml(r.name)} ~${r.pct}% of goal`).join(', ')}. From the trend in est. 1RM since week 1.`
      : `From the trend in est. 1RM since week 1 (${results.length} exercise${results.length === 1 ? '' : 's'} with 3+ sessions).`,
    source: ''
  }];
}

/* 4. Training load: effort (0–10) × minutes this week against the 4 weeks before */
function loadTips(history, now) {
  const load = (from, to) => history.filter(s => s.id >= from && s.id < to && s.effort > 0 && s.durationSec > 0)
    .reduce((sum, s) => sum + s.effort * s.durationSec / 60, 0);
  const thisWeek = load(now - 7 * DAY_MS, now + 1);
  const weeks = [1, 2, 3, 4].map(k => load(now - (k + 1) * 7 * DAY_MS, now - k * 7 * DAY_MS)).filter(v => v > 0);
  if (!thisWeek || weeks.length < 3) return [];
  const usual = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const ratio = thisWeek / usual;
  if (ratio < 1.5) return [];
  return [{
    id: `load:${localDateStr(startOfWeek(new Date(now)))}`, tone: 'warn',
    title: `This week's load is ${fmtNum(Math.round(ratio * 10) / 10)}× your usual`,
    body: 'A sudden jump brings more fatigue. Keep the next session easier, or sleep and eat well before it.',
    why: `Effort × minutes: ${Math.round(thisWeek)} in the last 7 days, against ${Math.round(usual)} a week on average before.`,
    source: COACH_SOURCES.load
  }];
}

/* 5. Weight change against the goal: kg a week as % of bodyweight, with a calorie nudge */
const WEIGHT_PACE = {
  lose: { lo: -1.0, hi: -0.5, label: 'lose 0.5–1% of your weight a week, the pace that best keeps muscle', source: COACH_SOURCES.cut },
  recomp: { lo: -0.5, hi: 0.1, label: 'hold your weight steady or lose slowly (up to 0.5% a week)', source: '' },
  gain: { lo: 0.1, hi: 0.5, label: 'gain slowly, up to about 0.5% of your weight a week, to limit fat gain', source: '' }
};

function weightTips(now) {
  const profile = getProfile();
  const entries = getBodyweight();
  const rate = weeklyRate(entries);
  if (!profile || rate == null) return [];
  const last = entries[entries.length - 1];
  if (now - bwDateMs(last.dateStr) > 14 * DAY_MS) return [];
  const goalType = GOAL_TYPES[profile.goalType] ? profile.goalType : 'recomp';
  const pace = WEIGHT_PACE[goalType];
  const trend = movingAverage(entries).pop().y;
  const pct = rate / trend * 100;
  if (pct >= pace.lo && pct <= pace.hi) {
    return [{
      id: `weight:ok:${goalType}`, tone: 'good',
      title: 'Your weight is moving at the right pace',
      body: `For ${GOAL_TYPES[goalType].label.toLowerCase()} the aim is to ${pace.label}.`,
      why: `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${fmtNum(Math.abs(Math.round(rate * 100) / 100))} kg a week (${fmtNum(Math.abs(Math.round(pct * 100) / 100))}%) over the last 4 weeks.`,
      source: pace.source
    }];
  }
  // About 7700 kcal per kg, spread over the week, towards the middle of the range
  const mid = (pace.lo + pace.hi) / 2 * trend / 100;
  const raw = (mid - rate) * 7700 / 7;
  const kcal = Math.sign(raw) * Math.min(400, Math.max(100, Math.round(Math.abs(raw) / 50) * 50));
  const t = nutritionTargets(profile);
  const low = pct < pace.lo;
  const title = {
    lose: low ? 'Losing faster than your goal pace' : 'Losing slower than your goal pace',
    recomp: low ? 'Losing faster than a recomp needs' : 'Gaining weight on a recomp',
    gain: low ? 'Gaining slower than your goal pace' : 'Gaining faster than your goal pace'
  }[goalType];
  // Too fast a loss risks muscle; too fast a gain adds fat
  const warn = goalType === 'gain' ? !low : low;
  return [{
    id: `weight:${kcal}:${localDateStr(startOfWeek(new Date(now)))}`, tone: warn ? 'warn' : 'info',
    title,
    body: `Try about ${kcal > 0 ? `${kcal} kcal more` : `${-kcal} kcal less`} a day${t ? ` (around ${(t.calories + kcal).toLocaleString('en-US')} instead of ${t.calories.toLocaleString('en-US')})` : ''}, then check again in 2 weeks. The aim is to ${pace.label}.`,
    why: `${rate > 0 ? '+' : '−'}${fmtNum(Math.abs(Math.round(rate * 100) / 100))} kg a week (${fmtNum(Math.abs(Math.round(pct * 100) / 100))}% of ${fmtNum(Math.round(trend * 10) / 10)} kg) over the last 4 weeks of weigh-ins.`,
    source: pace.source
  }];
}

function coachTips(history = getHistory(), now = Date.now()) {
  const dismissed = coachDismissed();
  const tips = [...plateauTips(history, now), ...loadTips(history, now), ...forecastTips(history, now), ...weightTips(now), ...volumeTips(history, now)];
  return tips.filter(t => !(dismissed[t.id] > now));
}

function coachSuggestions(history = getHistory(), now = Date.now()) {
  const dismissed = coachDismissed();
  return habitSuggestions(history).filter(s => !(dismissed[s.id] > now));
}

// Tips worth a look on the Workout tab (not the "all good" ones)
function coachAlertCount() {
  return coachTips().filter(t => t.tone !== 'good').length + coachSuggestions().length;
}

/* The card */
function coachItemHtml(item, i, kind) {
  const actions = kind === 'suggestion'
    ? `${item.blocked ? `<span class="cc-blocked">${item.blocked}</span>` : `<button class="btn btn-primary cc-act" onclick="acceptSuggestion(${i})">${item.actionLabel}</button>`}
       <button class="btn btn-plain cc-later" onclick="snoozeCoach('${kind}', ${i})">Not now</button>`
    : `<button class="btn btn-plain cc-later" onclick="snoozeCoach('${kind}', ${i})">${item.tone === 'good' ? 'Hide' : 'Got it'}</button>`;
  return `
    <div class="cc-item ${item.tone || 'habit'}">
      <div class="cc-title">${item.title}</div>
      ${item.body ? `<div class="cc-body">${item.body}</div>` : ''}
      <div class="cc-why"><b>Why:</b> ${item.why}</div>
      ${item.source ? `<div class="cc-src">${item.source}</div>` : ''}
      <div class="cc-actions">${actions}</div>
    </div>`;
}

let coachShown = { tips: [], suggestions: [] };

function renderCoach() {
  const box = document.getElementById('coach-list');
  if (!box) return;
  const history = getHistory();
  coachShown = { tips: coachTips(history), suggestions: coachSuggestions(history) };
  const { tips, suggestions } = coachShown;
  box.innerHTML = `
    ${tips.map((t, i) => coachItemHtml(t, i, 'tip')).join('')}
    ${suggestions.length ? `<div class="cc-group">From your habits</div>${suggestions.map((s, i) => coachItemHtml(s, i, 'suggestion')).join('')}` : ''}
    ${!tips.length && !suggestions.length ? `<div class="cc-empty">${history.length < 5
      ? 'Tips appear after about two weeks of workouts and a few weigh-ins.'
      : 'Nothing to change right now. Keep logging.'}</div>` : ''}`;
}

function snoozeCoach(kind, i) {
  const item = kind === 'tip' ? coachShown.tips[i] : coachShown.suggestions[i];
  if (!item) return;
  dismissCoach(item.id, kind === 'tip' ? TIP_SNOOZE_DAYS : SUGGESTION_SNOOZE_DAYS);
  haptic('light');
  renderCoach();
  updateStats();
}

function acceptSuggestion(i) {
  const s = coachShown.suggestions[i];
  if (!s || s.blocked) return;
  const undo = s.apply();
  const refresh = () => {
    renderCoach();
    renderWorkout();
    if (typeof renderPlanSummary === 'function') renderPlanSummary();
  };
  haptic('success');
  refresh();
  showToast('Plan updated', { actionLabel: 'Undo', onAction: () => { undo(); refresh(); showToast('Change undone'); } });
}
