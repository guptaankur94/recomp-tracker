/* Cardio: a run, ride or row before or after lifting (or on its own). It belongs to the whole workout, like the
   clock, not to a plan day. While you train it's a draft; Finish saves it on that day's workout as
   session.cardio = [{ type, min, km?, intensity, when, hr? }].
   Smart parts: before/after is set from when you log it (no set ticked yet = before); one tap repeats what you
   did last time; calories are estimated from MET values (2024 Adult Compendium of Physical Activities) when
   your watch hasn't given a number; leg-heavy cardio counts toward leg recovery; and the Coach weighs weekly
   minutes against the WHO aim and the order of cardio and leg training. */
const CARDIO_DRAFT_KEY = 'recomp_cardio_draft';

// MET by intensity (easy / moderate / hard), legs: fatigue on leg muscles per 15 hard minutes (in sets)
const CARDIO_TYPES = {
  run: { label: 'Run', icon: '🏃', distance: true, met: [7.0, 9.3, 11.8], legs: { Legs: 1, Calves: 0.6, Hamstrings: 0.4 } },
  walk: { label: 'Incline walk', icon: '🚶', distance: true, met: [3.5, 5.9, 8.8], legs: { Legs: 0.5, Calves: 0.4, Glutes: 0.3 } },
  bike: { label: 'Bike', icon: '🚴', distance: true, met: [5.0, 7.0, 8.8], legs: { Legs: 1 } },
  row: { label: 'Rower', icon: '🚣', distance: true, met: [6.0, 7.5, 11.0], legs: { Legs: 0.6, Back: 0.6 } },
  elliptical: { label: 'Elliptical', icon: '⭕', distance: false, met: [4.5, 5.0, 9.0], legs: { Legs: 0.5 } },
  stairs: { label: 'Stair climber', icon: '🪜', distance: false, met: [7.5, 9.3, 11.0], legs: { Legs: 0.8, Glutes: 0.5, Calves: 0.4 } },
  other: { label: 'Other cardio', icon: '❤️', distance: false, met: [4.0, 6.0, 8.0], legs: {} }
};

// The talk test: a simple, well-used way to judge intensity without a heart-rate monitor
const CARDIO_INTENSITY = [
  { key: 'easy', label: 'Easy', hint: 'could sing' },
  { key: 'moderate', label: 'Moderate', hint: 'can talk, not sing' },
  { key: 'hard', label: 'Hard', hint: 'a few words at a time' }
];

const intensityIdx = key => Math.max(0, CARDIO_INTENSITY.findIndex(i => i.key === key));

function cardioType(type) {
  return CARDIO_TYPES[type] || CARDIO_TYPES.other;
}

/* The draft (today's cardio not yet saved) */
function getCardioDraft() {
  const d = readJSON(CARDIO_DRAFT_KEY, null);
  if (!d || !Array.isArray(d.items)) return [];
  // A draft from an earlier day is stale (Finish was missed); it's dropped, like a stale clock
  if (d.date !== localDateStr(new Date()) && !workoutClock()) return [];
  return d.items.filter(c => c && c.min > 0);
}

function saveCardioDraft(items) {
  if (items.length) localStorage.setItem(CARDIO_DRAFT_KEY, JSON.stringify({ date: localDateStr(new Date()), items }));
  else localStorage.removeItem(CARDIO_DRAFT_KEY);
}

/* Numbers */
function cardioKcal(c, kg) {
  const met = cardioType(c.type).met[intensityIdx(c.intensity)];
  return kg > 0 && c.min > 0 ? Math.round(met * kg * c.min / 60 / 5) * 5 : 0;
}

function bodyKg() {
  return currentWeightKg(getProfile()) || 0;
}

// Minutes per km, for types with a distance
function cardioPace(c) {
  return c.km > 0 && c.min > 0 ? c.min / c.km : null;
}

function fmtPace(minPerKm) {
  const s = Math.round(minPerKm * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

// Moderate-equivalent minutes: hard counts double, as in the WHO guidance (75 vigorous = 150 moderate)
function moderateMinutes(c) {
  return c.intensity === 'hard' ? c.min * 2 : c.intensity === 'easy' ? c.min * 0.5 : c.min;
}

function cardioLine(c, { when = true } = {}) {
  const t = cardioType(c.type);
  const parts = [`${c.min} min`, c.km > 0 ? `${fmtNum(c.km)} km` : '', cardioPace(c) && (c.type === 'run' || c.type === 'walk') ? fmtPace(cardioPace(c)) : '',
    CARDIO_INTENSITY[intensityIdx(c.intensity)].label, c.hr > 0 ? `${c.hr} bpm` : '', when ? (c.when === 'before' ? 'before lifting' : 'after lifting') : ''];
  return `${t.icon} ${escapeHtml(t.label)} · ${parts.filter(Boolean).join(' · ')}`;
}

function sessionCardio(s) {
  return Array.isArray(s.cardio) ? s.cardio.filter(c => c && c.min > 0) : [];
}

function cardioMinutes(list) {
  return list.reduce((n, c) => n + c.min, 0);
}

// The last time you did this kind of cardio (for "same as last time")
function lastCardio(type, history = getHistory()) {
  for (const s of history) {
    const c = sessionCardio(s).filter(x => x.type === type).pop();
    if (c) return c;
  }
  return null;
}

// Recent kinds, newest first, each with its last values
function recentCardio(history = getHistory()) {
  const seen = new Map();
  [...getCardioDraft().slice().reverse(), ...history.flatMap(s => sessionCardio(s).slice().reverse())].forEach(c => {
    if (!seen.has(c.type)) seen.set(c.type, c);
  });
  return [...seen.values()].slice(0, 3);
}

/* Workout screen: cardio cards above the exercises (before lifting) and below them (after) */
function cardioCardsHtml(when) {
  const items = getCardioDraft().map((c, i) => ({ c, i })).filter(x => x.c.when === when);
  return items.map(({ c, i }) => `
    <button class="cardio-card ${when}" onclick="openCardioSheet(${i})" aria-label="Cardio ${when} lifting: ${escapeHtml(cardioType(c.type).label)}, ${c.min} minutes. Edit">
      <span class="cardio-icon" aria-hidden="true">${cardioType(c.type).icon}</span>
      <span class="cardio-main">
        <span class="cardio-title">${escapeHtml(cardioType(c.type).label)} · ${c.min} min${c.km > 0 ? ` · ${fmtNum(c.km)} km` : ''}</span>
        <span class="cardio-sub">${when === 'before' ? 'Before lifting' : 'After lifting'} · ${CARDIO_INTENSITY[intensityIdx(c.intensity)].label}${cardioPace(c) && c.type === 'run' ? ` · ${fmtPace(cardioPace(c))}` : ''}</span>
      </span>
      <span class="chevron">${icon('chevron')}</span>
    </button>`).join('');
}

function setsDoneToday() {
  return setsTodayByDay().reduce((n, x) => n + x.n, 0) + (todaysSession() ? sessionStats(todaysSession()).sets : 0);
}

/* The cardio sheet */
let cardioEdit = null; // { idx (null = new), item }

function openCardioSheet(idx = null) {
  const items = getCardioDraft();
  const existing = idx !== null ? items[idx] : null;
  const recent = recentCardio();
  const base = existing || (recent[0] ? { ...recent[0] } : { type: 'run', min: 20, intensity: 'moderate' });
  // Logged before any set today: a warm-up; after: a finisher
  const when = existing ? existing.when : setsDoneToday() ? 'after' : 'before';
  cardioEdit = { idx, item: { type: base.type, min: base.min || '', km: base.km || '', intensity: base.intensity || 'moderate', hr: existing && existing.hr || '', when } };
  document.getElementById('cardio-title').textContent = existing ? 'Edit cardio' : 'Add cardio';
  document.getElementById('cardio-delete').hidden = !existing;
  renderCardioSheet();
  openSheet('cardio-sheet');
}

function renderCardioSheet() {
  const it = cardioEdit.item;
  const t = cardioType(it.type);
  const recent = cardioEdit.idx === null ? recentCardio() : [];
  const kcal = cardioKcal({ ...it, min: Number(it.min) || 0 }, bodyKg());
  document.getElementById('cardio-body').innerHTML = `
    ${recent.length ? `
      <div class="fin-label">Same as last time</div>
      <div class="cardio-recent">${recent.map(c => `
        <button class="cardio-chip" onclick="quickCardio('${c.type}')" aria-label="Add ${escapeHtml(cardioType(c.type).label)}, ${c.min} minutes, as last time">${cardioType(c.type).icon} ${escapeHtml(cardioType(c.type).label)} · ${c.min} min${c.km > 0 ? ` · ${fmtNum(c.km)} km` : ''}</button>`).join('')}
      </div>` : ''}
    <div class="fin-label">Type</div>
    <div class="cardio-types" role="radiogroup" aria-label="Type of cardio">${Object.entries(CARDIO_TYPES).map(([key, x]) => `
      <button role="radio" aria-checked="${key === it.type}" onclick="setCardioField('type', '${key}')"><span aria-hidden="true">${x.icon}</span>${escapeHtml(x.label)}</button>`).join('')}
    </div>
    <div class="cardio-fields">
      <label class="cardio-field"><span>Minutes</span><input type="number" inputmode="numeric" min="1" max="300" id="cardio-min" value="${escapeHtml(String(it.min))}" oninput="cardioEdit.item.min = this.value; updateCardioEstimate()" aria-label="Minutes"></label>
      ${t.distance ? `<label class="cardio-field"><span>Distance · optional</span><input type="number" inputmode="decimal" step="0.01" min="0" id="cardio-km" value="${escapeHtml(String(it.km))}" placeholder="km" oninput="cardioEdit.item.km = this.value" aria-label="Distance in km"></label>` : ''}
      <label class="cardio-field"><span>Avg heart rate · optional</span><input type="number" inputmode="numeric" min="40" max="230" id="cardio-hr" value="${escapeHtml(String(it.hr))}" placeholder="bpm" oninput="cardioEdit.item.hr = this.value" aria-label="Average heart rate"></label>
    </div>
    <div class="fin-label" id="cardio-int-label">How hard · the talk test</div>
    <div class="effort cardio-int" role="radiogroup" aria-labelledby="cardio-int-label">${CARDIO_INTENSITY.map(x => `
      <button role="radio" aria-pressed="${x.key === it.intensity}" aria-checked="${x.key === it.intensity}" onclick="setCardioField('intensity', '${x.key}')">${x.label}<i>${x.hint}</i></button>`).join('')}
    </div>
    <div class="fin-label">When</div>
    <div class="segmented cardio-when" role="radiogroup" aria-label="Before or after lifting">
      <button class="seg-btn ${it.when === 'before' ? 'active' : ''}" role="radio" aria-checked="${it.when === 'before'}" onclick="setCardioField('when', 'before')">Before lifting</button>
      <button class="seg-btn ${it.when === 'after' ? 'active' : ''}" role="radio" aria-checked="${it.when === 'after'}" onclick="setCardioField('when', 'after')">After lifting</button>
    </div>
    <div class="cardio-est" id="cardio-est">${kcal ? `About ${kcal} kcal (estimate). Your watch's number, entered at Finish, wins.` : bodyKg() ? '' : 'Log your weight to see a calorie estimate.'}</div>`;
}

function updateCardioEstimate() {
  const kcal = cardioKcal({ ...cardioEdit.item, min: Number(cardioEdit.item.min) || 0 }, bodyKg());
  const el = document.getElementById('cardio-est');
  if (el && kcal) el.textContent = `About ${kcal} kcal (estimate). Your watch's number, entered at Finish, wins.`;
}

function setCardioField(field, value) {
  cardioEdit.item[field] = value;
  if (field === 'type' && cardioEdit.idx === null) {
    // A new entry starts from what you did last time on this kind
    const last = lastCardio(value);
    if (last) Object.assign(cardioEdit.item, { min: last.min, km: last.km || '', intensity: last.intensity });
    else cardioEdit.item.km = '';
  }
  if (field === 'type' && !cardioType(value).distance) cardioEdit.item.km = '';
  haptic('light');
  renderCardioSheet();
}

function quickCardio(type) {
  const last = recentCardio().find(c => c.type === type);
  if (!last) return;
  Object.assign(cardioEdit.item, { type, min: last.min, km: last.km || '', intensity: last.intensity });
  saveCardioSheet();
}

function saveCardioSheet() {
  const it = cardioEdit.item;
  const min = Math.round(Number(it.min));
  if (!(min >= 1 && min <= 300)) {
    haptic('error');
    showToast('Enter the minutes (1 to 300)', { type: 'error' });
    return;
  }
  const km = Number(it.km);
  const hr = Math.round(Number(it.hr));
  const item = { type: it.type, min, intensity: it.intensity, when: it.when };
  if (cardioType(it.type).distance && km > 0 && km < 200) item.km = Math.round(km * 100) / 100;
  if (hr >= 40 && hr <= 230) item.hr = hr;
  const items = getCardioDraft();
  if (cardioEdit.idx !== null && items[cardioEdit.idx]) items[cardioEdit.idx] = item;
  else items.push(item);
  saveCardioDraft(items);
  // Cardio is part of the workout: logging it starts the clock if it isn't running
  if (!workoutClock()) startWorkout();
  closeSheet('cardio-sheet');
  haptic('success');
  initNav();
  renderWorkout();
  showToast(`${cardioType(item.type).label} · ${item.min} min ${item.when === 'before' ? 'before lifting' : 'after lifting'}`);
}

function deleteCardioEntry() {
  const items = getCardioDraft();
  if (cardioEdit.idx === null || !items[cardioEdit.idx]) return;
  const [removed] = items.splice(cardioEdit.idx, 1);
  saveCardioDraft(items);
  closeSheet('cardio-sheet');
  renderWorkout();
  showToast('Cardio removed', { actionLabel: 'Undo', onAction: () => { const now = getCardioDraft(); now.push(removed); saveCardioDraft(now); renderWorkout(); } });
}

/* Saving at Finish: the draft goes onto today's workout, or makes a cardio-only one */
function commitCardio(session) {
  const items = getCardioDraft();
  if (!items.length) return session;
  const history = getHistory();
  let s = session ? history.find(h => h.id === session.id) : null;
  if (!s) {
    const now = Date.now();
    const clock = workoutClock();
    const start = clock ? clock.startedAt : now - cardioMinutes(items) * 60e3;
    s = { id: start, dateStr: localDateStr(new Date(start)), displayDate: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      day: 'Cardio', title: [...new Set(items.map(c => cardioType(c.type).label))].join(' + '), exercises: [] };
    history.unshift(s);
  }
  s.cardio = [...sessionCardio(s), ...items];
  // A workout is at least as long as its cardio
  s.durationSec = Math.max(s.durationSec || 0, cardioMinutes(s.cardio) * 60);
  saveHistory(history);
  saveCardioDraft([]);
  return s;
}

/* Recovery: leg-heavy cardio leaves some fatigue on the legs (sets-equivalent per 15 hard minutes) */
function cardioFatigue(s) {
  const out = {};
  sessionCardio(s).forEach(c => {
    const factor = [0.3, 0.6, 1][intensityIdx(c.intensity)] * c.min / 15;
    Object.entries(cardioType(c.type).legs).forEach(([m, w]) => { out[m] = (out[m] || 0) + w * factor; });
  });
  return out;
}

/* Coach tips */
function cardioTips(history, now) {
  const tips = [];
  const recent = history.filter(s => now - s.id < 28 * DAY_MS && sessionCardio(s).length);
  if (!recent.length) return tips; // no cardio logged lately: no nagging
  // 1. Weekly minutes against the WHO aim of 150–300 moderate (or 75–150 hard) minutes
  const week = history.filter(s => now - s.id < 7 * DAY_MS).flatMap(sessionCardio);
  const eq = Math.round(week.reduce((n, c) => n + moderateMinutes(c), 0));
  tips.push(eq >= 150 ? {
    id: `cardio:ok:${localDateStr(startOfWeek(new Date(now)))}`, tone: 'good',
    title: `${eq} cardio minutes this week: aim met`,
    body: 'The WHO aim for adults is 150–300 moderate minutes a week (hard minutes count double). More cardio than that is fine; keep it from eating into leg recovery.',
    why: `${cardioMinutes(week)} min logged in the last 7 days, ${eq} moderate-equivalent.`,
    source: 'WHO 2020 guidelines on physical activity (Bull et al., BJSM)'
  } : {
    id: `cardio:low:${localDateStr(startOfWeek(new Date(now)))}`, tone: 'info',
    title: `${eq} of 150 cardio minutes this week`,
    body: `About ${150 - eq} moderate minutes to go for the WHO aim, e.g. ${Math.ceil((150 - eq) / 20)} × 20 min after lifting. Hard minutes count double.`,
    why: `${cardioMinutes(week)} min logged in the last 7 days, ${eq} moderate-equivalent (easy counts half, hard double).`,
    source: 'WHO 2020 guidelines on physical activity (Bull et al., BJSM)'
  });
  // 2. Order: hard or long leg-heavy cardio before leg training, twice in two weeks
  const legHeavy = c => ['run', 'bike', 'row', 'stairs'].includes(c.type) && (c.intensity === 'hard' || c.min >= 20);
  const trainsLegs = s => s.exercises.some(e => ['Legs', 'Hamstrings', 'Glutes'].includes(exerciseMuscle(e.name)));
  const before = history.filter(s => now - s.id < 14 * DAY_MS && trainsLegs(s) && sessionCardio(s).some(c => c.when === 'before' && legHeavy(c)));
  if (before.length >= 2) {
    tips.push({
      id: `cardio:order:${before.map(s => s.id).join('|')}`, tone: 'warn',
      title: 'Hard cardio before leg days: try it after',
      body: 'Lifting first, cardio after, gave bigger lower-body strength gains in a meta-analysis, with the same cardio fitness either way. Keep a short easy warm-up before if you like.',
      why: `${before.length} leg workouts in the last 2 weeks began with hard or 20+ min ${[...new Set(before.flatMap(s => sessionCardio(s).filter(c => c.when === 'before' && legHeavy(c)).map(c => cardioType(c.type).label.toLowerCase())))].join(' / ')}.`,
      source: 'Murlasits, Kneffel & Thalib 2018, training order meta-analysis (J Sports Sciences)'
    });
  }
  return tips;
}

/* Progress tab: this week against the aim, 8 weeks of minutes, and pace for runs and walks */
function renderCardioProgress() {
  const card = document.getElementById('cardio-progress-card');
  if (!card) return;
  const history = getHistory();
  const now = Date.now();
  const all = history.filter(s => sessionCardio(s).length);
  card.hidden = !all.length;
  if (!all.length) return;
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weeks = [7, 6, 5, 4, 3, 2, 1, 0].map(k => {
    const from = weekStart - k * 7 * DAY_MS;
    const list = history.filter(s => s.id >= from && s.id < from + 7 * DAY_MS).flatMap(sessionCardio);
    return { from, min: cardioMinutes(list), eq: list.reduce((n, c) => n + moderateMinutes(c), 0) };
  });
  const thisWeek = weeks[weeks.length - 1];
  const max = Math.max(150, ...weeks.map(w => w.eq));
  const paces = ['run', 'walk', 'bike', 'row'].map(type => {
    const list = history.flatMap(s => sessionCardio(s).filter(c => c.type === type && cardioPace(c)).map(c => ({ c, t: s.id })));
    if (!list.length) return null;
    const [latest, prev] = list;
    const diff = prev ? Math.round((cardioPace(latest.c) - cardioPace(prev.c)) * 60) : 0;
    return `<div class="cp-pace"><span>${cardioType(type).icon} ${cardioType(type).label}</span><b>${fmtPace(cardioPace(latest.c))}</b><span class="${diff < 0 ? 'up' : ''}">${prev ? (diff === 0 ? 'same as last time' : `${Math.abs(diff)} s ${diff < 0 ? 'faster' : 'slower'} than last time`) : 'first time'}</span></div>`;
  }).filter(Boolean);
  document.getElementById('cardio-progress').innerHTML = `
    <div class="cp-head"><b>${Math.round(thisWeek.eq)}</b> of 150 moderate minutes this week<span>${thisWeek.min} min logged</span></div>
    <div class="cp-bars" role="img" aria-label="Cardio minutes per week, last 8 weeks: ${weeks.map(w => Math.round(w.eq)).join(', ')}">
      <span class="cp-aim" style="bottom:${150 / max * 100}%"></span>
      ${weeks.map((w, i) => `<span class="cp-bar ${w.eq >= 150 ? 'met' : ''} ${i === weeks.length - 1 ? 'now' : ''}" style="height:${Math.max(2, w.eq / max * 100)}%"></span>`).join('')}
    </div>
    <div class="cp-axis"><span>8 weeks ago</span><span>Aim 150</span><span>This week</span></div>
    ${paces.join('')}`;
}
