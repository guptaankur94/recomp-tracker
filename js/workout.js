/* The Workout screen: home card, exercise cards, logging sets, swipe to delete, keeping the screen awake. */

// Hero card on the Workout tab: this week's sessions against the plan, streak, total and weight trend.
function updateStats() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const history = getHistory();
  const coachCount = getProfile() ? coachAlertCount() : 0;
  const profileLink = !getProfile()
    ? `<button class="hero-link" onclick="openProfileSheet()">Set up your profile for goal and nutrition targets ${icon('chevron', 2.6)}</button>`
    : coachCount ? `<button class="hero-link" onclick="switchView('progress')">Coach: ${coachCount} tip${coachCount === 1 ? '' : 's'} for you ${icon('chevron', 2.6)}</button>` : '';


  const weekStart = startOfWeek(new Date()).getTime();
  // Plan workouts only: a cardio-only day doesn't count toward the week's lifting
  const thisWeek = history.filter(s => s.id >= weekStart && s.exercises.length).length;
  const schedule = getSchedule();
  const target = schedule ? schedule.filter((_, w) => scheduledDay(w, schedule) !== null).length : programData.length;
  const streak = calcWeekStreak(history);
  const C = 207.35; // circumference of r=33

  const bw = getBodyweight();
  const latest = bw[bw.length - 1];
  let weightLbl = 'Log weight';
  let trendClass = '';
  if (latest) {
    // Compare with the closest entry at least 7 days older
    const cutoff = bwDateMs(latest.dateStr) - 7 * 864e5;
    const earlier = [...bw].reverse().find(e => bwDateMs(e.dateStr) <= cutoff);
    weightLbl = 'Weight';
    if (earlier) {
      const diff = Math.round((latest.kg - earlier.kg) * 10) / 10;
      const goal = getGoalKg();
      weightLbl = diff === 0 ? '±0 · 7d' : `${diff > 0 ? '↑' : '↓'}${fmtNum(Math.abs(diff))} · 7d`;
      if (goal && diff !== 0) trendClass = (goal < latest.kg) === (diff < 0) ? 'good' : 'bad';
    }
  }

  // During a workout the top panel is the live clock; before, it's the week with one Start button
  const clock = workoutClock();
  hero.classList.toggle('is-live', !!clock);
  syncHeaderVisibility();
  if (clock) {
    hero.innerHTML = livePanelHtml(clock);
    return;
  }
  hero.innerHTML = `
    <div class="hero">
      <div class="hero-ring">
        <svg viewBox="0 0 76 76" aria-hidden="true">
          <circle class="rest-ring-bg" cx="38" cy="38" r="33"/>
          <circle class="rest-ring-fg" cx="38" cy="38" r="33" stroke-dasharray="${C}" style="stroke-dashoffset: ${C * (1 - Math.min(1, thisWeek / target))}"/>
        </svg>
        <div class="hero-ring-text">
          <div class="hero-ring-num">${thisWeek}<span>/${target}</span></div>
          <div class="hero-ring-lbl">This week</div>
        </div>
      </div>
      <div class="hero-body">
        <div class="hero-heading">${thisWeek >= target ? 'Week complete. Nice work.' : `${target - thisWeek} workout${target - thisWeek === 1 ? '' : 's'} to go this week`}</div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hero-val">${streak}<small>wk</small></div><div class="hero-lbl">Streak</div></div>
          <div class="hero-stat"><div class="hero-val">${history.length}</div><div class="hero-lbl">Workouts</div></div>
          <div class="hero-stat tappable" onclick="switchView('progress')"><div class="hero-val">${latest ? `${fmtNum(latest.kg)}<small>kg</small>` : '—'}</div><div class="hero-lbl ${trendClass}">${weightLbl}</div></div>
        </div>
        ${profileLink}
      </div>
    </div>
    <button class="hero-start" onclick="startWorkout()">${icon('arrowUp', 2.6)}Start workout</button>
    <div class="hero-hint">Then log any day of your plan, and switch between days as you go. <button class="hero-cardio" onclick="openCardioSheet()">Log cardio</button></div>
    ${backupBannerHtml()}`;
}

// Today's ticked sets, by day of the plan (unsaved, started today)
function setsTodayByDay() {
  const today = localDateStr(new Date());
  return [...programData.keys(), programData.length].map(d => {
    const meta = readJSON(draftMetaKey(d), null);
    const n = meta && localDateStr(new Date(meta.startedAt)) === today ? dayProgress(d).done : 0;
    return { d, n };
  }).filter(x => x.n > 0);
}

function dayShortLabel(d) {
  return d === programData.length ? 'Custom' : `D${d + 1}`;
}

// The live panel: the clock, Pause, and each day you've trained so far (tap one to go to it)
// A week since the last backup: one tap saves it (to Files / iCloud Drive through the share sheet)
function backupBannerHtml() {
  if (typeof backupOverdue !== 'function' || !backupOverdue() || Number(localStorage.getItem('recomp_backup_snooze')) > Date.now()) return '';
  const age = backupAgeDays();
  return `
    <div class="backup-banner" role="note">
      <div class="backup-banner-text"><b>Back up your workouts</b><span>${age === null ? 'Never backed up yet' : `Last backup ${age} days ago`}. Everything lives on this phone only.</span></div>
      <div class="backup-banner-actions">
        <button class="btn btn-primary btn-sm" onclick="exportData()">Back up now</button>
        <button class="btn btn-plain btn-sm" onclick="snoozeBackup()">Later</button>
      </div>
    </div>`;
}

function snoozeBackup() {
  localStorage.setItem('recomp_backup_snooze', String(Date.now() + 3 * 864e5));
  haptic('light');
  updateStats();
}

// During a workout the live panel is the top of the Workout tab: the greeting steps aside
function syncHeaderVisibility() {
  const view = document.getElementById('view-workout');
  document.body.classList.toggle('in-workout', !!workoutClock() && !!view && !view.hidden);
}

function livePanelHtml(clock) {
  const paused = !!clock.pausedAt;
  const byDay = setsTodayByDay();
  const today = todaysSession();
  const saved = today ? sessionStats(today).sets : 0;
  const sets = byDay.reduce((n, x) => n + x.n, 0) + saved;
  // Every set on the days trained so far is done: Finish fills in green (until then it stays quiet)
  const cardioMin = cardioMinutes(getCardioDraft());
  const ready = byDay.length > 0 && byDay.every(x => { const p = dayProgress(x.d); return p.total > 0 && p.done >= p.total; });
  return `
    <div class="live ${paused ? 'paused' : ''}" role="region" aria-label="Workout in progress">
      <div class="live-row">
        <div class="live-main">
          <div class="live-time" id="session-elapsed">${fmtClock(sessionElapsedSec())}</div>
          <div class="live-sub">${paused ? 'Paused' : `Workout · ${sets} set${sets === 1 ? '' : 's'}${byDay.length ? ` · ${byDay.length} day${byDay.length === 1 ? '' : 's'}` : ''}${cardioMin ? ` · ${cardioMin} min cardio` : ''}`}</div>
        </div>
        <button class="btn btn-secondary live-pause" onclick="${paused ? 'resumeWorkout()' : 'pauseWorkout()'}">${paused ? 'Resume' : 'Pause'}</button>
        <button class="live-finish ${ready ? 'ready' : ''}" onclick="openFinishSheet()" aria-label="Finish workout">${ready ? icon('check', 3) : ''}Finish</button>
      </div>
      <div class="live-days">${byDay.map(x => `<button class="live-day" onclick="selectDay(${x.d})">${dayShortLabel(x.d)} · ${x.n} set${x.n === 1 ? '' : 's'}</button>`).join('')}<button class="live-day live-cardio" onclick="openCardioSheet()">+ Cardio</button></div>
    </div>`;
}

// The bottom: Finish, once a workout is under way (at the end of the list, so it isn't tapped by accident)
function finishSectionHtml(clockRunning) {
  const byDay = setsTodayByDay();
  if (!clockRunning && !byDay.length) return '';
  const days = byDay.map(x => dayShortLabel(x.d)).join(' + ');
  return `
    <button class="finish-btn" onclick="openFinishSheet()">${icon('check', 3)}Finish workout</button>
    <div class="finish-hint">${days ? `Saves today's sets from ${days}` : 'Nothing logged yet'}</div>`;
}

/* Workout progress across the selected day */
function dayProgress(dayIdx) {
  let done = 0;
  let total = 0;
  getAllExercisesForDay(dayIdx).forEach((ex, exIdx) => {
    // Skipped today: out of the count, so the day can still be complete
    if (isSkipped(dayIdx, exIdx)) return;
    const count = getSetCount(dayIdx, exIdx, ex.sets);
    total += count;
    for (let s = 1; s <= count; s++) {
      if (localStorage.getItem(setKey(dayIdx, exIdx, s, 'done')) === 'true') done++;
    }
  });
  return { done, total };
}

function sessionStartedToday(dayIdx) {
  const meta = readJSON(draftMetaKey(dayIdx), null);
  return meta && localDateStr(new Date(meta.startedAt)) === localDateStr(new Date()) ? meta : null;
}

// Time already saved to today's workout plus the clock's time since
function sessionElapsedSec() {
  const today = todaysSession();
  const clock = workoutClock();
  return (today && today.durationSec || 0) + (clock ? Math.max(0, clockActiveMs(clock, Date.now()) - (clock.creditedMs || 0)) / 1000 : 0);
}

function updateSessionBar() {
  const el = document.getElementById('session-elapsed');
  if (el) el.textContent = fmtClock(sessionElapsedSec());
}

setInterval(updateSessionBar, 1000);

// A finished exercise folds to one line with a tick; these are the ones the user opened again.
const openedDone = new Set();

let justCollapsedEx = null;

const infoOpen = new Set();

// Warm-up panels opened again after they folded away (all ticked, or the first working set done)
const warmupOpen = new Set();

function toggleWarmupPanel(exIdx) {
  const key = exStateKey(exIdx);
  if (warmupOpen.has(key)) warmupOpen.delete(key);
  else warmupOpen.add(key);
  haptic('light');
  renderWorkout();
}

/* Warm-up: a panel of rows to tick, like the working sets. Once every warm-up is ticked (or set 1 is done)
   it folds to one line; tap it to open again. With no warm-up, a quiet line offers to add one. */
function warmupPanelHtml(ex, exIdx, warmups, suggestion, set1Done) {
  if (!warmups.length) {
    return `<button class="wu-line wu-add-line" onclick="openWarmupEditor(${exIdx})" aria-label="Add a warm-up for ${escapeHtml(ex.name)}">${icon('plus', 2.4)}Add warm-up</button>`;
  }
  const isDone = i => localStorage.getItem(warmupKey(currentDayIdx, exIdx, i)) === 'true';
  const doneCount = warmups.filter((_, i) => isDone(i)).length;
  const allDone = doneCount === warmups.length;
  const key = exStateKey(exIdx);
  const foldable = allDone || set1Done;
  const summary = warmups.map(w => w.label.replace(/ kg × /, '×').replace(/ × /, '×')).join(' · ');
  if (foldable && !warmupOpen.has(key)) {
    return `
      <button class="wu-line ${allDone ? 'done' : ''}" onclick="toggleWarmupPanel(${exIdx})" aria-expanded="false" aria-label="Warm-up ${allDone ? 'done' : `${doneCount} of ${warmups.length} done`}. Show warm-up sets">
        <span class="wu-line-title">${allDone ? `${icon('check', 3)}Warm-up done` : `Warm-up · ${doneCount}/${warmups.length}`}</span>
        <span class="wu-line-sets">${escapeHtml(summary)}</span>
        <span class="wu-line-chev">${icon('chevron', 2.4)}</span>
      </button>`;
  }
  const work = workingWeight(ex, exIdx, suggestion);
  return `
    <div class="wu-panel" role="group" aria-label="Warm-up sets">
      <div class="wu-head">
        <span class="wu-title">Warm-up</span>
        <span class="wu-count">${doneCount}/${warmups.length}</span>
        <button class="wu-head-btn" onclick="openWarmupEditor(${exIdx})" aria-label="Edit warm-up for ${escapeHtml(ex.name)}">${icon('pencil', 2.2)}Edit</button>
        ${foldable ? `<button class="wu-head-btn icon-only" onclick="toggleWarmupPanel(${exIdx})" aria-expanded="true" aria-label="Hide warm-up sets">${icon('chevronUp', 2.4)}</button>` : ''}
      </div>
      ${warmups.map((w, i) => {
        const on = isDone(i);
        const hint = [w.label.startsWith('Bar') ? `${fmtNum(w.kg)} kg` : '', w.kg && work > 0 ? `~${Math.round(w.kg / work * 100)}%` : ''].filter(Boolean).join(' · ');
        return `
          <div class="wu-r ${on ? 'done' : ''}">
            <span class="wu-badge">W${i + 1}</span>
            <span class="wu-val">${escapeHtml(w.label)}</span>
            ${hint ? `<span class="wu-hint">${hint}</span>` : ''}
            <button class="wu-chk" onclick="toggleWarmup(${exIdx}, ${i})" aria-pressed="${on}" aria-label="Warm-up ${i + 1}: ${escapeHtml(w.label)}${on ? ', done' : ''}">${icon('check', 3)}</button>
          </div>`;
      }).join('')}
    </div>`;
}

/* Focus mode: one exercise open at a time. It's the one you're finishing, else one you opened, else the first
   with sets still to do; the others show as one-line previews (tap to open). Done ones fold to their Done row. */
const focusChoice = {}; // dayIdx → the exercise you opened

function exerciseAllDone(dayIdx, exIdx, ex) {
  const count = getSetCount(dayIdx, exIdx, ex.sets);
  for (let s = 1; s <= count; s++) if (localStorage.getItem(setKey(dayIdx, exIdx, s, 'done')) !== 'true') return false;
  return true;
}

function focusedExercise(exs) {
  const finishing = exs.findIndex((_, i) => finishingEx.has(exStateKey(i)));
  if (finishing !== -1) return finishing;
  const todo = i => exs[i] && !isSkipped(currentDayIdx, i) && !exerciseAllDone(currentDayIdx, i, exs[i]);
  const chosen = focusChoice[currentDayIdx];
  if (chosen != null && todo(chosen)) return chosen;
  delete focusChoice[currentDayIdx];
  const next = exerciseOrder(currentDayIdx, exs.length).find(todo);
  return next === undefined ? -1 : next;
}

// The exercises open together: the one in focus, and its superset partner
function openTogether(focusIdx) {
  const pair = focusIdx >= 0 ? supersetPartner(currentDayIdx, focusIdx) : null;
  return new Set(pair ? [focusIdx, pair.partner] : [focusIdx]);
}

function focusExercise(exIdx) {
  focusChoice[currentDayIdx] = exIdx;
  haptic('light');
  anchorOn(`ex-card-${exIdx}`);
  renderWorkout();
  // Opened near the bottom: bring its top part into view
  requestAnimationFrame(() => reveal(document.querySelector(`#ex-card-${exIdx} .ex-header`)));
}

function exStateKey(exIdx) {
  return `${currentDayIdx}:${exIdx}`;
}

function expandExercise(exIdx) {
  openedDone.add(exStateKey(exIdx));
  haptic('light');
  renderWorkout();
}

function collapseExercise(exIdx) {
  openedDone.delete(exStateKey(exIdx));
  haptic('light');
  justCollapsedEx = exIdx;
  renderWorkout();
  justCollapsedEx = null;
}


// Small confetti burst inside the exercise-complete banner
function celebrate(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#34c759', '#ffcc00', '#0a84ff', '#ff9f0a', '#ff375f'];
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement('span');
    bit.className = 'confetti';
    bit.style.left = `${10 + Math.random() * 80}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 120)}px`);
    bit.style.setProperty('--rot', `${Math.round(Math.random() * 540 - 270)}deg`);
    bit.style.animationDelay = `${Math.random() * 120}ms`;
    el.appendChild(bit);
    setTimeout(() => bit.remove(), 1400);
  }
}

function toggleExInfo(exIdx) {
  const key = exStateKey(exIdx);
  if (infoOpen.has(key)) infoOpen.delete(key);
  else infoOpen.add(key);
  renderWorkout();
}

function bestDraftSet(exIdx, totalSets) {
  let best = null;
  for (let s = 1; s <= totalSets; s++) {
    const w = parseFloat(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'w'))) || 0;
    const r = parseInt(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'r')), 10) || 0;
    if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r };
  }
  return best;
}


function renderWorkout() {
  const anchor = findAnchor();
  updateStats();
  const main = document.getElementById('workout-content');
  const data = dayAt(currentDayIdx);
  const allExercises = getAllExercisesForDay(currentDayIdx);
  const history = getHistory();
  const progress = dayProgress(currentDayIdx);

  // The workout clock lives in the top panel (see updateStats); this screen only needs to know if it's running
  const clockRunning = !!workoutClock();
  let html = '';

  html += `
    ${restDayCardHtml()}
    <div class="day-header">
      <div>
        <div class="day-kicker">${dayKicker()}</div>
        <div class="day-title">${escapeHtml(data.title)}</div>
      </div>
      <div class="day-actions">
        ${isCustomDay() ? '' : `<button class="icon-btn" onclick="openPlanEditor({ dayIdx: currentDayIdx })" aria-label="Edit this day">${icon('pencil', 2)}</button>`}
        <button class="icon-btn" onclick="openDayMenu()" aria-label="Workout options">${icon('more', 2)}</button>
      </div>
    </div>
    ${dayRecoveryHtml(currentDayIdx)}
  `;

  // Unsaved sets left over from an earlier date (e.g. forgot to tap Finish)
  const meta = readJSON(draftMetaKey(currentDayIdx), null);
  const hasDraft = dayHasDraft(currentDayIdx);
  if (hasDraft && (!meta || localDateStr(new Date(meta.startedAt)) !== localDateStr(new Date()))) {
    const started = meta ? new Date(meta.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    html += `
      <div class="draft-banner">
        <div class="draft-banner-title">Unfinished ${data.day} workout</div>
        <div class="draft-banner-text">${started
          ? `You have unsaved sets from ${started}.`
          : 'You have unsaved sets from an earlier visit.'}</div>
        <div class="draft-banner-actions">
          <button class="btn btn-primary" onclick="finishAndSaveWorkout()">${started ? `Save to ${started}` : 'Save as today'}</button>
          <button class="btn btn-secondary" onclick="discardDraft()">Discard</button>
        </div>
      </div>
    `;
  }

  if (isCustomDay() && !allExercises.length) {
    html += `
      <div class="empty-card">
        <div class="empty-title">Build today's workout</div>
        <div class="empty-text">Add exercises from your plan, the library or your history. It saves to your history like any workout and doesn't change your plan.</div>
        <button class="btn btn-primary btn-sm" onclick="addCustomExercise()">+ Add Exercise</button>
      </div>`;
  }

  html += cardioCardsHtml('before');

  let tipShown = false;
  const focusIdx = focusedExercise(allExercises);
  const openNow = openTogether(focusIdx);
  exerciseOrder(currentDayIdx, allExercises.length).forEach(exIdx => {
    const ex = allExercises[exIdx];
    const pair = supersetPartner(currentDayIdx, exIdx);
    const ssTag = pair ? `<span class="ss-tag" title="Superset">${supersetLetter(currentDayIdx, exIdx)}${pair.role}</span>` : '';
    const note = exerciseNote(ex.name);
    // Skipped today: a quiet row to bring it back
    if (isSkipped(currentDayIdx, exIdx)) {
      html += `
        <div class="card ex-card skipped" id="ex-card-${exIdx}" onclick="unskip(${exIdx})" role="button" aria-label="${escapeHtml(ex.name)}, skipped today. Bring back">
          <div class="collapsed-text"><div class="ex-name">${escapeHtml(ex.name)}</div><div class="ex-meta">Skipped today · tap to bring back</div></div>
        </div>`;
      return;
    }
    const totalSets = getSetCount(currentDayIdx, exIdx, ex.sets);
    const last = getLastPerformance(ex.name, history);
    let doneSets = 0;
    for (let s = 1; s <= totalSets; s++) {
      if (localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true') doneSets++;
    }
    const allDone = doneSets === totalSets;

    // Finished exercise: one line with a tick, tap to open
    if (allDone && !openedDone.has(exStateKey(exIdx)) && !finishingEx.has(exStateKey(exIdx))) {
      const best = bestDraftSet(exIdx, totalSets);
      html += `
        <div class="card ex-card collapsed ${justCollapsedEx === exIdx ? 'just-collapsed' : ''}" id="ex-card-${exIdx}" onclick="expandExercise(${exIdx})" role="button" aria-label="${escapeHtml(ex.name)}, done. Show sets">
          <span class="locked-num">${icon('check', 3)}</span>
          <div class="collapsed-text">
            <div class="ex-name">${escapeHtml(ex.name)}</div>
            <div class="ex-meta">${totalSets} set${totalSets === 1 ? '' : 's'}${best ? ` · best ${best.w > 0 ? `${fmtNum(best.w)} kg` : 'BW'} × ${best.r}` : ''}</div>
          </div>
          <span class="done-tag">Done</span>
          <span class="chevron">${icon('chevron')}</span>
        </div>
      `;
      return;
    }

    // Not in focus: a one-line preview (what's coming, and the goal), tap to open
    if (!openNow.has(exIdx) && !allDone) {
      const goal = exerciseGoal(ex);
      const lastTop = last ? last.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a) : null;
      html += `
        <div class="card ex-card preview" id="ex-card-${exIdx}" onclick="focusExercise(${exIdx})" role="button" aria-label="${escapeHtml(ex.name)}, ${doneSets} of ${totalSets} sets done. Open">
          <span class="preview-num ${doneSets ? 'started' : ''}">${doneSets ? `${doneSets}/${totalSets}` : exIdx + 1}</span>
          <div class="collapsed-text">
            <div class="ex-name">${ssTag}${escapeHtml(ex.name)}${ex.swapped ? '<span class="ex-tag">Alt</span>' : ''}</div>
            <div class="ex-meta">${pair ? `Superset with ${escapeHtml(allExercises[pair.partner].name)} · ` : ''}${totalSets} × ${escapeHtml(ex.repTarget)}${goal ? ` · <span class="preview-goal">goal ${goalLabel(goal)}</span>` : lastTop ? ` · last ${lastTop.weight > 0 ? fmtSetLine(lastTop) : `BW × ${lastTop.reps}`}` : ''}</div>
          </div>
          <span class="chevron">${icon('chevron')}</span>
        </div>`;
      return;
    }

    const rest = getExerciseRest(currentDayIdx, exIdx, ex);
    const lastBest = last ? last.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a) : null;
    const lastRest = last ? avgRest(last.sets) : 0;
    const tip = progressionTip(ex, lastSetFor(last, 1), lastRest || rest);
    // Rest chip: change vs last time (or vs the plan before there is a last time); shorter is progress
    const restRef = lastRest ? roundRest(lastRest) : ex.rest;
    const restDiff = restDelta(rest, restRef);
    const showInfo = infoOpen.has(exStateKey(exIdx));
    const suggestion1 = suggestSet(ex, lastSetFor(last, 1));
    const warmups = allDone ? [] : warmupSets(ex, exIdx, suggestion1);
    let firstOpenSet = 0;
    for (let s = 1; s <= totalSets && !firstOpenSet; s++) {
      if (localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) !== 'true') firstOpenSet = s;
    }

    html += `
      <div class="card ex-card ${allDone ? 'done' : ''} ${finishingEx.has(exStateKey(exIdx)) ? 'finishing' : ''} ${pair ? `ss ss-${pair.role}` : ''}" id="ex-card-${exIdx}">
        ${pair && pair.role === 1 ? `<div class="ss-banner">${icon('swap', 2.2)}Superset ${supersetLetter(currentDayIdx, exIdx)}: one set of each, then rest</div>` : ''}
        <div class="ex-header">
          <div class="ex-name">${ssTag}${escapeHtml(ex.name)}${ex.isCustom ? `<span class="ex-tag">${ex.fromDay && ex.fromDay !== data.day ? `From ${escapeHtml(ex.fromDay.replace('Day ', 'D'))}` : 'Extra'}</span>` : ''}${ex.swapped ? '<span class="ex-tag">Alt</span>' : ''}</div>
          <span class="ex-progress ${allDone ? 'all-done' : ''}">${doneSets}/${totalSets}</span>
          ${allDone ? `<button class="icon-btn plain" onclick="collapseExercise(${exIdx})" aria-label="Fold exercise">${icon('chevronUp')}</button>` : ''}
          <button class="icon-btn plain ${showInfo ? 'on' : ''}" onclick="toggleExInfo(${exIdx})" aria-label="Exercise details" aria-expanded="${showInfo}">${icon('infoCircle', 1.8)}</button>
          <button class="icon-btn plain" onclick="openExerciseMenu(${exIdx})" aria-label="${escapeHtml(ex.name)} options: note, superset, later, skip">${icon('more', 2)}</button>
        </div>
        <div class="ex-meta">${warmups.length ? `${warmups.length} warm-up + ` : ''}${totalSets} × ${escapeHtml(ex.repTarget)} · ${escapeHtml(ex.weightTarget)}</div>
        ${note ? `<button class="ex-note" onclick="editNote(${exIdx})" aria-label="Note: ${escapeHtml(note)}. Edit">${icon('pencil', 2)}<span>${escapeHtml(note)}</span></button>` : ''}
        ${allDone ? '' : goalPanelHtml(ex, last, exIdx)}
        <div class="ex-chips">
          <button class="chip ${restDiff.startsWith('−') ? 'faster' : ''}" onclick="pickRest(${exIdx})" aria-label="Rest ${fmtClock(rest)}, change">${icon('clock', 2)}Rest ${fmtClock(rest)}${restDiff ? `<span class="chip-delta">· ${restDiff}</span>` : ''}</button>
          ${tip ? `<span class="chip tip">${icon('arrowUp', 2.4)}${tip}</span>` : ''}
        </div>
        ${allDone ? '' : warmupPanelHtml(ex, exIdx, warmups, suggestion1, localStorage.getItem(setKey(currentDayIdx, exIdx, 1, 'done')) === 'true')}
        ${showInfo ? `
          <div class="ex-info">
            ${ex.cue ? `<div class="ex-info-row"><span class="ex-info-label">Cue</span><span>${escapeHtml(ex.cue)}</span></div>` : ''}
            ${last ? `<div class="ex-info-row"><span class="ex-info-label">Last</span><span>${shortDate(last.session.id)} · best ${fmtSetLine(lastBest)}</span></div>` : ''}
            ${ex.otherName && !ex.swapped && !tipSeen('swap') ? coachTip('swap', 'Machine taken?', `Swap to ${escapeHtml(ex.otherName)}. It has its own targets and history, and you can swap back any time.`) : ''}
            ${ex.otherName ? `
              <div class="ex-info-row"><span class="ex-info-label">${ex.swapped ? 'Original' : 'Alternative'}</span><span>${escapeHtml(ex.otherName)}</span></div>
              <button class="btn btn-secondary btn-sm" onclick="toggleSwap(${exIdx})">${icon('swap')}Swap to ${escapeHtml(ex.otherName)}</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="openWarmupEditor(${exIdx})">${icon('pencil', 2.2)}Edit warm-up</button>
            ${ex.isCustom ? `<button class="btn btn-danger btn-sm" onclick="removeCustomExercise(${exIdx})">Remove exercise</button>` : ''}
            ${!ex.cue && !last && !ex.otherName && !ex.isCustom ? '<div class="ex-info-row">No details for this exercise yet.</div>' : ''}
          </div>` : ''}
        <div class="set-container">
    `;

    // One coach tip at a time: rest after the first logged set, then drop sets once an exercise is done
    let tipAfterSet = 0;
    let tipHtml = '';
    if (!tipShown && doneSets && !tipSeen('rest')) {
      tipAfterSet = [...Array(totalSets).keys()].map(i => i + 1).find(s => localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true');
      tipHtml = coachTip('rest', 'Logged. Rest timer started.', 'Tap − or + to change the rest after this set. The same weight on less rest is progress too.');
    } else if (!tipShown && allDone && !tipSeen('drop')) {
      tipAfterSet = totalSets;
      tipHtml = coachTip('drop', 'One more push?', '+ Drop set adds a lighter set straight after any set, to squeeze out the last reps.', true);
    }
    if (tipHtml) tipShown = true;

    // The set you just ticked (the last done one before the next open set)
    const lastTicked = firstOpenSet ? firstOpenSet - 1 : totalSets;
    if (tipAfterSet && tipHtml.includes('Rest timer')) tipAfterSet = lastTicked;

    for (let s = 1; s <= totalSets; s++) {
      const wKey = setKey(currentDayIdx, exIdx, s, 'w');
      const rKey = setKey(currentDayIdx, exIdx, s, 'r');
      const blockId = `block_d${currentDayIdx}_e${exIdx}_s${s}`;
      const valW = localStorage.getItem(wKey) || '';
      const valR = localStorage.getItem(rKey) || '';
      const isDone = localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true';
      const drops = getDrops(currentDayIdx, exIdx, s);
      const suggestion = suggestSet(ex, lastSetFor(last, s));
      const canDelete = totalSets > 1;
      const swipe = canDelete ? `data-swipe="${exIdx},${s}"` : '';
      const moreBtn = `<button class="set-more-btn" onclick="event.stopPropagation(); openSetMenu(${exIdx}, ${s})" aria-label="Set ${s} options">${icon('more', 2)}</button>`;
      // Always-visible line under the set: add a drop set, and the rest that follows it
      const setRest = getSetRest(currentDayIdx, exIdx, s, ex);
      // Gold when the set after this rest was a rest record (the rest before a set is what counts)
      const restPr = isDone && localStorage.getItem(setKey(currentDayIdx, exIdx, s + 1, 'pr')) === 'rest';
      // Drop set + rest line: under every set, the same each time, so a drop set is always one tap away
      const showLink = true;
      const setLink = !showLink ? '' : `
        <div class="set-link">
          <button class="link-drop" onclick="addDrop(${exIdx}, ${s})" aria-label="Add drop set to set ${s}">${icon('plus', 2.6)}Drop set</button>
          <span class="set-link-line"></span>
          <span class="rs-label" aria-hidden="true">Rest</span>
          <div class="rest-stepper ${restPr ? 'record' : setRest < ex.rest ? 'faster' : ''}" role="group" aria-label="Rest after set ${s}">
            <button class="rs-btn" onclick="nudgeSetRest(${exIdx}, ${s}, -15)" ${setRest <= 15 ? 'disabled' : ''} aria-label="15 seconds less rest after set ${s}">${icon('minus', 2.6)}</button>
            <button class="rs-val ${restBump === `${exIdx}:${s}` ? 'bump' : ''}" onclick="pickSetRest(${exIdx}, ${s})" aria-label="Rest after set ${s}: ${fmtClock(setRest)}. Choose a time">${icon('clock', 2)}<span>${fmtClock(setRest)}</span></button>
            <button class="rs-btn" onclick="nudgeSetRest(${exIdx}, ${s}, 15)" ${setRest >= 600 ? 'disabled' : ''} aria-label="15 seconds more rest after set ${s}">${icon('plus', 2.6)}</button>
          </div>
        </div>`;

      if (isDone) {
        // Committed set: a solid, locked line. Tap to edit.
        const shownW = parseFloat(valW) > 0 ? fmtNum(parseFloat(valW)) : null;
        const prType = localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'pr'));
        html += `
          <div class="set-swipe" ${swipe}>
            <button class="swipe-delete" onclick="deleteSetWithUndo(${exIdx}, ${s})">Delete</button>
            <div class="set-block completed ${prType ? 'pr' : ''} ${blockId === justCompletedBlock ? 'just-completed' : ''}" id="${blockId}" onclick="openSetEdit(${exIdx}, ${s})" role="button" aria-label="Set ${s}, ${shownW ? `${shownW} kg` : 'bodyweight'} × ${escapeHtml(valR)}. Edit">
              <div class="locked-row">
                <span class="locked-num">${icon('check', 3)}</span>
                <span class="locked-set">Set ${s}</span>
                <span class="locked-val">${shownW ? `${shownW}<span class="locked-unit">kg</span>` : 'BW'}</span>
                <span class="locked-x">×</span>
                <span class="locked-val">${escapeHtml(valR || '–')}<span class="locked-unit">reps</span></span>
                ${prType ? `<span class="pr-badge" title="${PR_LABELS[prType] || 'Personal record'}">PR</span>` : ''}
                ${moreBtn}
              </div>
              ${drops.filter(d => d.r).map((drop, i) => `
                <div class="locked-drop">↳ Drop ${i + 1}: <strong>${parseFloat(drop.w) > 0 ? `${fmtNum(parseFloat(drop.w))} kg` : 'BW'} × ${escapeHtml(drop.r)}</strong></div>
              `).join('')}
            </div>
          </div>
          ${setLink}
          ${s === tipAfterSet ? tipHtml : ''}
        `;
        continue;
      }

      html += `
        <div class="set-swipe" ${swipe}>
          <button class="swipe-delete" onclick="deleteSetWithUndo(${exIdx}, ${s})">Delete</button>
          <div class="set-block" id="${blockId}">
            <div class="set-row">
              <span class="set-num">${s}</span>
              <label class="input-group">
                <input type="text" id="${wKey}" inputmode="none" autocomplete="off" data-pad="w" placeholder="${suggestion ? fmtNum(suggestion.w) : '–'}" value="${escapeHtml(valW)}" onclick="openPad(this)" onkeydown="padKeydown(event)" oninput="saveVal('${wKey}', this.value)" onchange="pulse(this)" aria-label="Set ${s} weight in kg">
                <span class="unit-label">kg</span>
              </label>
              <label class="input-group">
                <input type="text" id="${rKey}" inputmode="none" autocomplete="off" data-pad="r" placeholder="${suggestion ? suggestion.r : '–'}" value="${escapeHtml(valR)}" onclick="openPad(this)" onkeydown="padKeydown(event)" oninput="saveVal('${rKey}', this.value)" onchange="pulse(this)" aria-label="Set ${s} reps">
                <span class="unit-label">reps</span>
              </label>
              ${moreBtn}
              <button class="check-btn ${s === firstOpenSet ? 'next' : ''}" onclick="completeSet(${exIdx}, ${s})" aria-label="Complete set ${s}">${icon('check', 2.6)}</button>
            </div>
            ${s === firstOpenSet ? setHintHtml(ex, last, s, suggestion, valW, valR) : ''}
            ${drops.map((drop, i) => `
              <div class="drop-row">
                <span class="drop-label">↳ Drop ${i + 1}</span>
                <label class="input-group">
                  <input type="number" step="0.5" inputmode="decimal" placeholder="0" value="${escapeHtml(drop.w)}" onfocus="this.select()" onchange="saveDropVal(${exIdx}, ${s}, ${i}, 'w', this.value); pulse(this)">
                  <span class="unit-label">kg</span>
                </label>
                <label class="input-group">
                  <input type="number" inputmode="numeric" placeholder="0" value="${escapeHtml(drop.r)}" onfocus="this.select()" onchange="saveDropVal(${exIdx}, ${s}, ${i}, 'r', this.value); pulse(this)">
                  <span class="unit-label">reps</span>
                </label>
                <button class="delete-set-btn" onclick="removeDrop(${exIdx}, ${s}, ${i})" aria-label="Delete drop set">${icon('x')}</button>
              </div>
            `).join('')}
          </div>
        </div>
        ${setLink}
        ${s === tipAfterSet ? tipHtml : ''}
      `;
    }

    html += `
        </div>
        <button class="btn btn-plain add-set-btn" id="add-set-${exIdx}" onclick="addSet(${exIdx})">+ Add Set</button>
      </div>
    `;
  });

  html += `
    ${cardioCardsHtml('after')}
    <div class="add-row">
      <button class="btn btn-secondary add-custom-ex-btn" onclick="addCustomExercise()">+ Add Exercise</button>
      <button class="btn btn-secondary add-cardio-btn" onclick="openCardioSheet()">+ Cardio</button>
    </div>
    ${finishSectionHtml(clockRunning)}
  `;
  main.innerHTML = html;
  restoreAnchor(anchor);
  syncPad();
  syncWakeLock();
}

/* Keeping the screen still. Re-drawing the workout (after ticking a set, a warm-up, a rest change…) used to let
   the page jump when something above the tap grew or shrank, like a warm-up folding away. Now the thing you
   tapped, or failing that its exercise card, stays exactly where it was on screen. */
let tapAnchor = null; // { ids, at }

document.addEventListener('pointerdown', e => {
  const main = document.getElementById('workout-content');
  if (!main || !main.contains(e.target)) return;
  const ids = [];
  for (let el = e.target; el && el !== main; el = el.parentElement) if (el.id) ids.push(el.id);
  tapAnchor = { ids, at: Date.now() };
}, true);

function anchorOn(...ids) {
  tapAnchor = { ids, at: Date.now() };
}

function findAnchor() {
  if (!tapAnchor || Date.now() - tapAnchor.at > 1500 || document.getElementById('view-workout').hidden) return null;
  const tops = {};
  tapAnchor.ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) tops[id] = el.getBoundingClientRect().top;
  });
  return { ids: tapAnchor.ids, tops };
}

function restoreAnchor(anchor) {
  if (!anchor) return;
  const id = anchor.ids.find(i => anchor.tops[i] !== undefined && document.getElementById(i));
  if (!id) return;
  const delta = document.getElementById(id).getBoundingClientRect().top - anchor.tops[id];
  if (Math.abs(delta) >= 1) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The clear part of the screen: below the pinned workout panel, above the rest timer and the tab bar
function clearArea() {
  let top = 8;
  let bottom = window.innerHeight - 8;
  const live = document.querySelector('#hero.is-live');
  if (live && !document.getElementById('view-workout').hidden) top = Math.max(top, live.getBoundingClientRect().bottom + 8);
  document.querySelectorAll('.bottom-tab-bar, .rest-pill').forEach(bar => {
    const b = bar.getBoundingClientRect();
    if (b.height && getComputedStyle(bar).display !== 'none' && getComputedStyle(bar).visibility !== 'hidden') bottom = Math.min(bottom, b.top - 8);
  });
  return { top, bottom };
}

// Scroll gently, only as far as needed, so el is fully in the clear area (its top part, if it's tall)
function reveal(el) {
  if (!el) return;
  const { top, bottom } = clearArea();
  const r = el.getBoundingClientRect();
  let delta = 0;
  if (Math.min(r.bottom, r.top + (bottom - top)) > bottom) delta = Math.min(r.bottom, r.top + (bottom - top)) - bottom;
  if (r.top - delta < top) delta = r.top - top;
  if (Math.abs(delta) >= 2) window.scrollBy({ top: delta, behavior: reduceMotion() ? 'instant' : 'smooth' });
}

/* Finishing an exercise, in three beats: the last tick lands with the card still open (all sets ticked, a green
   glow); then, as one motion, the card folds to its one-line "Done" row while that row glides to just under the
   workout panel; the next exercise rises with it, ready for set 1. The fold and the scroll are driven together,
   frame by frame on one easing curve, so nothing moves one way and then back. */
const finishingEx = new Set();
const FINISH_BEAT_MS = 650;
const FOLD_MS = 420;

function finishExerciseSequence(exIdx) {
  const key = exStateKey(exIdx);
  finishingEx.add(key);
  setTimeout(() => {
    if (!finishingEx.delete(key) || openedDone.has(key) || exStateKey(exIdx) !== key) return;
    const before = document.getElementById(`ex-card-${exIdx}`);
    if (!before || document.getElementById('view-workout').hidden) return renderWorkout();
    const oldH = before.getBoundingClientRect().height;
    // Hold the page's height through the re-draw: near the bottom, a page suddenly 500 px shorter would make
    // the browser pull the scroll up before the fold could start
    // (and room for the card's old height, in case the next exercise to open is above and grows the page)
    const main = document.getElementById('workout-content');
    main.style.minHeight = `${main.offsetHeight}px`;
    main.style.paddingBottom = `${oldH}px`;
    anchorOn(`ex-card-${exIdx}`);
    renderWorkout();
    const card = document.getElementById(`ex-card-${exIdx}`);
    const release = () => { main.style.minHeight = ''; main.style.paddingBottom = ''; };
    if (!card) return release();
    const newH = card.getBoundingClientRect().height;
    if (!reduceMotion()) card.style.height = `${oldH}px`;
    release();
    foldInPlace(card, oldH, newH);
    celebrate(card);
  }, FINISH_BEAT_MS);
}

// card has just been re-drawn folded (held at oldH, newH when done), its top where the open card's top was. Shrink it while
// scrolling so its top ends just under the workout panel, or as near as the page can scroll. Both follow one
// curve, so everything below moves one way only.
function foldInPlace(card, oldH, newH) {
  const from = card.getBoundingClientRect().top;
  const cardDocTop = window.scrollY + from;
  const maxScrollAfter = document.documentElement.scrollHeight - (oldH - newH) - window.innerHeight;
  const to = cardDocTop - Math.max(0, Math.min(cardDocTop - clearArea().top, maxScrollAfter));
  const placeAt = top => {
    const delta = card.getBoundingClientRect().top - top;
    if (Math.abs(delta) >= 0.5) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
  };
  if (reduceMotion()) {
    card.style.height = '';
    return placeAt(to);
  }
  const ease = t => 1 - (1 - t) ** 3;
  card.style.overflow = 'hidden';
  let start = null;
  const step = now => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / FOLD_MS);
    const e = ease(t);
    card.style.height = `${oldH + (newH - oldH) * e}px`;
    placeAt(from + (to - from) * e);
    if (t < 1) return requestAnimationFrame(step);
    card.style.height = '';
    card.style.overflow = '';
    placeAt(to);
  };
  requestAnimationFrame(step);
}

function dayKicker() {
  if (isCustomDay()) return 'One-off workout · not part of your plan';
  const schedule = getSchedule();
  const wd = weekdaysFor(currentDayIdx, schedule).map(w => WEEKDAY_NAMES[WEEKDAYS.indexOf(w)]);
  const isToday = schedule && scheduledDay(weekdayIdx(), schedule) === currentDayIdx;
  const tag = isToday ? ' · Today' : currentDayIdx === upNextDayIdx() ? ' · Up next' : '';
  return `${wd.length ? wd.join(' & ') : dayAt(currentDayIdx).day}${tag}`;
}

// On a scheduled rest day, say so and point to the next session (training anyway is still one tap away)
function restDayCardHtml() {
  if (!isRestDayToday() || todaysSession() || dayHasDraft(currentDayIdx) || isCustomDay()) return '';
  const next = nextScheduled();
  return `
    <div class="rest-card">
      <div class="rest-card-title">Rest day</div>
      <div class="rest-card-text">Recovery is when muscle is built.${next ? ` Next up: <strong>${WEEKDAY_NAMES[next.w]} · ${escapeHtml(programData[next.dayIdx].title)}</strong>.` : ''} Training anyway? Pick any day above or start a custom workout.</div>
      <button class="btn btn-secondary btn-sm" onclick="startCustomWorkout()">Start Custom Workout</button>
    </div>`;
}

function saveVal(key, value) {
  localStorage.setItem(key, value);
  touchDraft();
  refreshDraftIndicators();
}

// Update the tab dot and Clear button without re-rendering inputs (which would close the iPhone keyboard)
function refreshDraftIndicators() {
  initNav();
}

/* The line under the next set: what you did last time, what to try, and that ✓ logs it as shown */
function setHintHtml(ex, last, s, suggestion, valW, valR) {
  const prev = lastSetFor(last, s);
  const fmt = x => `${Number(x.weight) > 0 ? `${fmtNum(Number(x.weight))} kg` : 'BW'} × ${x.reps}`;
  if (!prev) return `<div class="set-hint">First time: enter ${isBodyweightExercise(ex) ? 'your reps' : 'weight and reps'}, then ✓</div>`;
  const differs = suggestion && (suggestion.w !== Number(prev.weight) || suggestion.r !== Number(prev.reps));
  const empty = !valW && !valR;
  return `<div class="set-hint">Last time ${fmt(prev)}${differs ? ` · <b>try ${fmt({ weight: suggestion.w, reps: suggestion.r })}</b>` : ''}${empty && suggestion ? ' · ✓ logs it' : ''}</div>`;
}

/* Editing a ticked set: a small sheet; the set stays ticked (and keeps its place) */
let setEditing = null;

function openSetEdit(exIdx, setNum) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  if (!ex) return;
  setEditing = { exIdx, setNum };
  document.getElementById('set-edit-title').textContent = `Set ${setNum}`;
  document.getElementById('set-edit-sub').textContent = ex.name;
  document.getElementById('set-edit-w').value = localStorage.getItem(setKey(currentDayIdx, exIdx, setNum, 'w')) || '';
  document.getElementById('set-edit-r').value = localStorage.getItem(setKey(currentDayIdx, exIdx, setNum, 'r')) || '';
  haptic('light');
  openSheet('set-edit-sheet');
}

async function saveSetEdit() {
  if (!setEditing) return;
  const { exIdx, setNum } = setEditing;
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const wText = document.getElementById('set-edit-w').value.trim().replace(',', '.');
  const rText = document.getElementById('set-edit-r').value.trim();
  const w = parseFloat(wText) || 0;
  const r = parseInt(rText, 10) || 0;
  const fail = message => { haptic('error'); showToast(message, { type: 'error' }); };
  if (!(r > 0)) return fail('Enter the reps');
  if (wText === '' && !isBodyweightExercise(ex)) return fail('Add the weight (0 if none)');
  const problem = checkSetValues(ex, w, r);
  if (problem && problem.field) return fail(problem.message);
  if (problem && problem.confirm) {
    const ok = await actionSheet(`${fmtNum(w)} kg?`, problem.best ? `That's ${fmtNum(Math.round(w / problem.best * 10) / 10)}× your best of ${fmtNum(problem.best)} kg.` : 'That\'s a lot for a first time.',
      [{ label: `Save ${fmtNum(w)} kg`, value: 'yes' }, { label: 'Change it', value: 'no' }]);
    if (ok !== 'yes') return;
  }
  localStorage.setItem(setKey(currentDayIdx, exIdx, setNum, 'w'), wText === '' ? '' : String(w));
  localStorage.setItem(setKey(currentDayIdx, exIdx, setNum, 'r'), String(r));
  touchDraft();
  refreshPrs(currentDayIdx, exIdx);
  closeSheet('set-edit-sheet');
  haptic('success');
  anchorOn(`block_d${currentDayIdx}_e${exIdx}_s${setNum}`);
  renderWorkout();
  showToast(`Set ${setNum} updated`);
}

function untickSetFromEdit() {
  if (!setEditing) return;
  closeSheet('set-edit-sheet');
  editSet(setEditing.exIdx, setEditing.setNum);
}

/* Checks before a set is committed, so a slip never becomes a record. Returns null when the set is fine, or
   { field, message } for a value that can't be right, or { confirm } for one that is possible but unlikely. */
function isBodyweightExercise(ex) {
  const lib = LIBRARY.get(ex.name);
  return /\bBW\b|bodyweight/i.test(ex.weightTarget || '') || (lib && ['Bodyweight', 'Bar'].includes(lib.equipment)) || /\d\s*(s|sec|secs|seconds)\b/i.test(ex.repTarget || '');
}

function checkSetValues(ex, w, r) {
  const timed = /\d\s*(s|sec|secs|seconds)\b/i.test(ex.repTarget || '');
  if (w < 0) return { field: 'w', message: 'Weight can\'t be negative' };
  if (r > (timed ? 3600 : 100)) return { field: 'r', message: `${r} ${timed ? 'seconds' : 'reps'} looks like a typo` };
  if (w > 1000) return { field: 'w', message: `${fmtNum(w)} kg looks like a typo` };
  const best = Math.max(0, ...savedSetsFor(ex.name, getHistory()).map(x => x.w));
  // Much heavier than ever (more than 1.5× and 20 kg over your best), or very heavy with no history: ask
  if (best > 0 && w > best * 1.5 && w > best + 20) {
    const tenth = Math.round(w / 10 * 2) / 2;
    return { confirm: true, best, likely: tenth >= best * 0.5 && tenth <= best * 1.5 ? tenth : null };
  }
  if (!best && w > 250) return { confirm: true, best: 0, likely: null };
  return null;
}

function flagSetField(exIdx, setNum, field, message) {
  haptic('error');
  const block = document.getElementById(`block_d${currentDayIdx}_e${exIdx}_s${setNum}`);
  block.classList.remove('shake');
  void block.offsetWidth;
  block.classList.add('shake');
  if (message) showToast(message, { type: 'error' });
  const input = document.getElementById(setKey(currentDayIdx, exIdx, setNum, field));
  if (input) openPad(input);
}

async function confirmUnusualWeight(exIdx, setNum, w, check) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const choices = [
    ...(check.likely ? [{ label: `Log ${fmtNum(check.likely)} kg`, value: 'likely' }] : []),
    { label: `Log ${fmtNum(w)} kg`, value: 'as-typed' },
    { label: 'Change it', value: 'edit' }
  ];
  const pick = await actionSheet(`${fmtNum(w)} kg?`, check.best
    ? `${ex.name}: that's ${fmtNum(Math.round(w / check.best * 10) / 10)}× your best of ${fmtNum(check.best)} kg.`
    : `${ex.name}: that's a lot for a first time.`, choices);
  const wInput = document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'w'));
  if (pick === 'likely' && wInput) {
    wInput.value = String(check.likely);
    saveVal(wInput.id, wInput.value);
  }
  if (pick === 'likely' || pick === 'as-typed') completeSet(exIdx, setNum, true);
  else if (wInput) openPad(wInput);
}

// Commit a set: fill from the suggestion if left empty, lock the row, and start the rest timer the first time.
function completeSet(exIdx, setNum, confirmed = false) {
  const key = f => setKey(currentDayIdx, exIdx, setNum, f);
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const suggestion = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, getHistory()), setNum));

  const wInput = document.getElementById(key('w'));
  const rInput = document.getElementById(key('r'));
  let w = wInput.value.trim().replace(',', '.');
  let r = rInput.value.trim();
  if (!r && suggestion && suggestion.r) r = String(suggestion.r);
  if (!w && suggestion && suggestion.w) w = String(suggestion.w);

  if (!(parseInt(r, 10) > 0)) return flagSetField(exIdx, setNum, 'r');
  // A weighted exercise with no weight would be saved as bodyweight: ask for it (type 0 for none)
  if (w === '' && !isBodyweightExercise(ex)) return flagSetField(exIdx, setNum, 'w', 'Add the weight for this set (0 if none)');
  const problem = checkSetValues(ex, parseFloat(w) || 0, parseInt(r, 10));
  if (problem && problem.field) return flagSetField(exIdx, setNum, problem.field, problem.message);
  if (problem && problem.confirm && !confirmed) {
    confirmUnusualWeight(exIdx, setNum, parseFloat(w), problem);
    return;
  }

  const count = getSetCount(currentDayIdx, exIdx, ex.sets);
  let started = false;
  for (let s = 1; s <= count && !started; s++) started = localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true';
  if (!started) noteExerciseStart(currentDayIdx, ex.name);

  localStorage.setItem(key('w'), w);
  localStorage.setItem(key('r'), r);
  localStorage.setItem(key('done'), 'true');
  const pr = refreshPrs(currentDayIdx, exIdx)[setNum] || null;
  const firstCompletion = localStorage.getItem(key('rested')) !== 'true';
  localStorage.setItem(key('rested'), 'true');
  touchDraft();
  clockOnSet();

  // Was this the exercise's last open set?
  let finished = true;
  for (let s = 1; s <= count && finished; s++) finished = localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true';

  haptic('success');
  if (pr || finished) setTimeout(() => haptic('success'), 160);
  if (pr) {
    const restNote = pr === 'rest' ? ` after ${fmtClock(getSetRest(currentDayIdx, exIdx, setNum - 1, ex))} rest` : '';
    showToast(`New PR · ${ex.name}: ${parseFloat(w) > 0 ? `${fmtNum(parseFloat(w))} kg` : 'BW'} × ${r}${restNote} · ${PR_LABELS[pr].toLowerCase()}`, { type: 'pr' });
  }

  justCompletedBlock = `block_d${currentDayIdx}_e${exIdx}_s${setNum}`;
  anchorOn(justCompletedBlock, `ex-card-${exIdx}`);
  if (finished) {
    openedDone.delete(exStateKey(exIdx));
    finishExerciseSequence(exIdx);
  }
  initNav();
  renderWorkout();
  justCompletedBlock = null;

  // Superset: straight on to the partner's same set, no rest; the rest comes after the pair
  const pairNext = supersetNextSet(exIdx, setNum);
  if (pairNext) {
    const partner = getAllExercisesForDay(currentDayIdx)[pairNext.exIdx];
    if (!pr) showToast(`Superset · now ${partner.name}, set ${pairNext.setNum}`, { type: 'info', duration: 2200 });
    setTimeout(() => {
      const block = document.getElementById(`block_d${currentDayIdx}_e${pairNext.exIdx}_s${pairNext.setNum}`);
      reveal(block && block.closest('.set-swipe'));
    }, reduceMotion() ? 0 : 380);
    return;
  }
  if (firstCompletion && pref('autoRest')) startRestTimer(getSetRest(currentDayIdx, exIdx, setNum, ex), nextSetLabel(exIdx, setNum));
  // The next set to do comes into view (gently, only if it's hidden behind the rest timer or off screen)
  if (!finished) {
    const nextBlock = document.querySelector(`#ex-card-${exIdx} .set-block:not(.completed)`);
    setTimeout(() => reveal(nextBlock && nextBlock.closest('.set-swipe')), reduceMotion() ? 0 : 380);
  }
}

// In a superset, the partner's same set when it's still to do (that's where you go next, without rest)
function supersetNextSet(exIdx, setNum) {
  const pair = supersetPartner(currentDayIdx, exIdx);
  if (!pair || isSkipped(currentDayIdx, pair.partner)) return null;
  const partner = getAllExercisesForDay(currentDayIdx)[pair.partner];
  if (!partner || setNum > getSetCount(currentDayIdx, pair.partner, partner.sets)) return null;
  return localStorage.getItem(setKey(currentDayIdx, pair.partner, setNum, 'done')) === 'true' ? null : { exIdx: pair.partner, setNum };
}

// "Set 2 · 50 kg × 8", or the next exercise's first open set (in today's order, supersets set for set)
function nextSetLabel(exIdx, setNum) {
  const exercises = getAllExercisesForDay(currentDayIdx);
  const history = getHistory();
  const isDone = (e, s) => localStorage.getItem(setKey(currentDayIdx, e, s, 'done')) === 'true';
  const label = (e, s) => {
    const ex = exercises[e];
    const sug = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, history), s));
    const w = parseFloat(localStorage.getItem(setKey(currentDayIdx, e, s, 'w'))) || (sug ? sug.w : 0);
    const r = parseInt(localStorage.getItem(setKey(currentDayIdx, e, s, 'r')), 10) || (sug ? sug.r : 0);
    const target = r ? ` · ${w > 0 ? `${fmtNum(w)} kg` : 'BW'} × ${r}` : '';
    return `Next: ${e === exIdx ? '' : `${ex.name} · `}Set ${s}${target}`;
  };
  // A superset: the pair's sets in turn (A1, B1, A2, B2…)
  const pair = supersetPartner(currentDayIdx, exIdx);
  if (pair) {
    const [a, b] = pair.role === 1 ? [exIdx, pair.partner] : [pair.partner, exIdx];
    const most = Math.max(getSetCount(currentDayIdx, a, exercises[a].sets), getSetCount(currentDayIdx, b, exercises[b].sets));
    for (let s = 1; s <= most; s++) {
      for (const e of [a, b]) {
        if (s <= getSetCount(currentDayIdx, e, exercises[e].sets) && !isDone(e, s) && !isSkipped(currentDayIdx, e)) return label(e, s);
      }
    }
  }
  const order = exerciseOrder(currentDayIdx, exercises.length);
  const from = order.indexOf(exIdx);
  for (const e of [...order.slice(from), ...order.slice(0, from)]) {
    if (isSkipped(currentDayIdx, e)) continue;
    const count = getSetCount(currentDayIdx, e, exercises[e].sets);
    for (let s = e === exIdx ? setNum + 1 : 1; s <= count; s++) if (!isDone(e, s)) return label(e, s);
  }
  return 'All sets done. Finish when ready.';
}

function editSet(exIdx, setNum) {
  localStorage.setItem(setKey(currentDayIdx, exIdx, setNum, 'done'), 'false');
  refreshPrs(currentDayIdx, exIdx);
  haptic('light');
  renderWorkout();
  const input = document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'w'));
  if (input) openPad(input);
}

async function openSetMenu(exIdx, setNum) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const count = getSetCount(currentDayIdx, exIdx, ex.sets);
  // Drop set and rest are also on the line under every set; the menu has them too, with the warm-up and delete
  const choices = [{ label: 'Add a drop set', value: 'drop' }, { label: `Rest after this set (${fmtClock(getSetRest(currentDayIdx, exIdx, setNum, ex))})`, value: 'rest' }, { label: 'Edit warm-up', value: 'warmup' }];
  if (count > 1) choices.push({ label: 'Delete set', value: 'delete', destructive: true });
  const choice = await actionSheet(`Set ${setNum}`, ex.name, choices);
  if (choice === 'drop') addDrop(exIdx, setNum);
  if (choice === 'rest') pickSetRest(exIdx, setNum);
  if (choice === 'warmup') openWarmupEditor(exIdx);
  if (choice === 'delete') deleteSetWithUndo(exIdx, setNum);
}

// Brief green flash so a typed value visibly "lands"
function pulse(el) {
  el.classList.remove('saved-pulse');
  void el.offsetWidth;
  el.classList.add('saved-pulse');
}

// Haptics: Android uses vibrate(); iPhone (iOS 18+) ticks when a switch checkbox is toggled.
const hapticSwitch = (() => {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
})();

function haptic(type) {
  if (!pref('vibration')) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(type === 'error' ? [30, 60, 30] : type === 'success' ? 20 : 10);
      return;
    }
    hapticSwitch.click();
    if (type === 'error') setTimeout(() => hapticSwitch.click(), 120);
  } catch (e) {}
}

function addSet(exIdx) {
  const allExercises = getAllExercisesForDay(currentDayIdx);
  const currentCount = getSetCount(currentDayIdx, exIdx, allExercises[exIdx].sets);
  saveSetCount(currentDayIdx, exIdx, currentCount + 1);
  // The exercise you're adding to is the one you're on now (it would otherwise fold into a preview while
  // another one is open), and the button stays under your finger with the new set just above it
  focusChoice[currentDayIdx] = exIdx;
  haptic('light');
  anchorOn(`add-set-${exIdx}`, `ex-card-${exIdx}`);
  renderWorkout();
}

function removeSet(exIdx, setNum) {
  const allExercises = getAllExercisesForDay(currentDayIdx);
  const currentCount = getSetCount(currentDayIdx, exIdx, allExercises[exIdx].sets);
  if (currentCount <= 1) return;

  const fields = ['w', 'r', 'rest', 'done', 'drops', 'rested', 'pr'];
  const key = (s, f) => setKey(currentDayIdx, exIdx, s, f);

  // Shift later sets up one slot
  for (let s = setNum; s < currentCount; s++) {
    fields.forEach(f => {
      const next = localStorage.getItem(key(s + 1, f));
      if (next === null) localStorage.removeItem(key(s, f));
      else localStorage.setItem(key(s, f), next);
    });
  }
  fields.forEach(f => localStorage.removeItem(key(currentCount, f)));

  saveSetCount(currentDayIdx, exIdx, currentCount - 1);
  refreshPrs(currentDayIdx, exIdx);
  initNav();
  renderWorkout();
}

// Delete straight away; Undo puts every key for that exercise back as it was.
function deleteSetWithUndo(exIdx, setNum) {
  const dayIdx = currentDayIdx;
  const pattern = new RegExp(`^(active_)?d${dayIdx}_e${exIdx}_`);
  const snapshot = Object.keys(localStorage).filter(k => pattern.test(k)).map(k => [k, localStorage.getItem(k)]);
  removeSet(exIdx, setNum);
  haptic('light');
  showToast(`Set ${setNum} deleted`, {
    actionLabel: 'Undo',
    onAction: () => {
      removeKeysMatching(pattern);
      snapshot.forEach(([k, v]) => localStorage.setItem(k, v));
      if (currentDayIdx === dayIdx) {
        initNav();
        renderWorkout();
      }
    }
  });
}

/* Swipe a set left to reveal Delete; a long swipe deletes straight away */
const SWIPE_OPEN = 88;

let openSwipe = null;

function closeOpenSwipe() {
  if (!openSwipe) return;
  openSwipe.classList.remove('open');
  openSwipe.querySelector('.set-block').style.transform = '';
  openSwipe = null;
}

(() => {
  const content = document.getElementById('workout-content');
  let drag = null;
  let suppressClickUntil = 0;
  // The click that ends a drag must not edit or complete the set
  content.addEventListener('click', e => {
    if (Date.now() < suppressClickUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  content.addEventListener('pointerdown', e => {
    const row = e.target.closest('.set-swipe[data-swipe]');
    if (openSwipe && openSwipe !== row && !e.target.closest('.swipe-delete')) closeOpenSwipe();
    if (!row || e.target.closest('.swipe-delete') || e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { row, block: row.querySelector('.set-block'), x: e.clientX, y: e.clientY, dx: 0, active: false, base: row.classList.contains('open') ? -SWIPE_OPEN : 0 };
  });
  content.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.active = true;
      drag.block.classList.add('dragging');
      drag.row.setPointerCapture(e.pointerId);
      if (document.activeElement && drag.row.contains(document.activeElement)) document.activeElement.blur();
    }
    drag.dx = Math.min(0, drag.base + dx);
    drag.block.style.transform = `translateX(${drag.dx}px)`;
    drag.row.classList.toggle('armed', drag.dx < -drag.row.offsetWidth * 0.55);
  });
  const end = () => {
    if (!drag) return;
    const { row, block, dx, active } = drag;
    drag = null;
    if (!active) return;
    block.classList.remove('dragging');
    row.classList.remove('armed');
    suppressClickUntil = Date.now() + 350;
    if (dx < -row.offsetWidth * 0.55) {
      const [exIdx, setNum] = row.dataset.swipe.split(',').map(Number);
      openSwipe = null;
      deleteSetWithUndo(exIdx, setNum);
    } else if (dx < -SWIPE_OPEN / 2) {
      block.style.transform = `translateX(${-SWIPE_OPEN}px)`;
      row.classList.add('open');
      openSwipe = row;
    } else {
      block.style.transform = '';
      row.classList.remove('open');
      if (openSwipe === row) openSwipe = null;
    }
  };
  content.addEventListener('pointerup', end);
  content.addEventListener('pointercancel', end);
})();

/* Keep the screen on while a workout is in progress (Safari 16.4+, Chrome) */
let wakeLock = null;

function workoutInProgress() {
  return !!restTimer || !!workoutClock() || !!sessionStartedToday(currentDayIdx) && dayHasDraft(currentDayIdx);
}

async function syncWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden) return;
  try {
    const want = workoutInProgress() && pref('keepAwake');
    if (want && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch (e) {}
}
