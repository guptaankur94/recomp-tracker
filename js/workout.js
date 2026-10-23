/* The Workout screen: home card, exercise cards, logging sets, swipe to delete, keeping the screen awake. */

// Hero card on the Workout tab: this week's sessions against the plan, streak, total and weight trend.
function updateStats() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const history = getHistory();
  const profileLink = getProfile() ? '' : `<button class="hero-link" onclick="openProfileSheet()">Set up your profile for goal and nutrition targets ${icon('chevron', 2.6)}</button>`;


  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = history.filter(s => s.id >= weekStart).length;
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
    </div>`;
}

/* Workout progress across the selected day */
function dayProgress(dayIdx) {
  let done = 0;
  let total = 0;
  getAllExercisesForDay(dayIdx).forEach((ex, exIdx) => {
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

// Time already saved to today's workout plus time on the current tab
function sessionElapsedSec() {
  const today = todaysSession();
  const meta = sessionStartedToday(currentDayIdx);
  return (today && today.durationSec || 0) + draftActiveMs(meta, Date.now()) / 1000;
}

function updateSessionBar() {
  const el = document.getElementById('session-elapsed');
  if (el) el.textContent = fmtClock(sessionElapsedSec());
}

setInterval(updateSessionBar, 1000);

// Finished exercises stay open with a summary banner; these are the ones the user folded away.
const collapsedByUser = new Set();

let justFinishedEx = null;

const infoOpen = new Set();

function exStateKey(exIdx) {
  return `${currentDayIdx}:${exIdx}`;
}

function expandExercise(exIdx) {
  collapsedByUser.delete(exStateKey(exIdx));
  haptic('light');
  renderWorkout();
}

function collapseExercise(exIdx) {
  collapsedByUser.add(exStateKey(exIdx));
  haptic('light');
  renderWorkout();
}

// "Next exercise →" on a finished card: bring the next unfinished exercise into view
function goToNextExercise(exIdx) {
  const exercises = getAllExercisesForDay(currentDayIdx);
  let target = exIdx + 1;
  for (let e = exIdx + 1; e < exercises.length; e++) {
    const count = getSetCount(currentDayIdx, e, exercises[e].sets);
    let open = false;
    for (let s = 1; s <= count && !open; s++) open = localStorage.getItem(setKey(currentDayIdx, e, s, 'done')) !== 'true';
    if (open) { target = e; break; }
  }
  const card = document.getElementById(`ex-card-${target}`);
  if (!card) return;
  haptic('light');
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// Sets, best set, volume and average rest of a finished exercise in today's draft
function exerciseDoneStats(exIdx, ex, totalSets) {
  let volume = 0;
  let restSum = 0;
  for (let s = 1; s <= totalSets; s++) {
    const w = parseFloat(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'w'))) || 0;
    const r = parseInt(localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'r')), 10) || 0;
    const drops = getDrops(currentDayIdx, exIdx, s).map(d => ({ weight: parseFloat(d.w) || 0, reps: parseInt(d.r, 10) || 0 }));
    volume += setVolume({ weight: w, reps: r, drops });
    restSum += getSetRest(currentDayIdx, exIdx, s, ex);
  }
  return { best: bestDraftSet(exIdx, totalSets), volume, avgRest: Math.round(restSum / Math.max(1, totalSets)) };
}

function renderWorkout() {
  const main = document.getElementById('workout-content');
  const data = dayAt(currentDayIdx);
  const allExercises = getAllExercisesForDay(currentDayIdx);
  const history = getHistory();
  const progress = dayProgress(currentDayIdx);

  // Sticky bar while a workout is under way today (this tab, or parts already saved to today's log)
  const todayMeta = sessionStartedToday(currentDayIdx);
  const today = todaysSession();
  const loggedSets = today ? sessionStats(today).sets : 0;
  let html = '';
  // The clock runs from Start or the first ticked set; the bar also stays up for what's already saved today
  const clockRunning = !!(todayMeta && (progress.done > 0 || todayMeta.started));
  const underWay = clockRunning || today;
  if (underWay) {
    const paused = !!(todayMeta && todayMeta.pausedAt);
    html += `
      <div class="session-bar${paused ? ' paused' : ''}">
        <div class="session-stat">
          <span class="session-time" id="session-elapsed">${fmtClock(sessionElapsedSec())}</span>
          <span class="session-sets">${paused ? 'Paused' : `${progress.done}/${progress.total} sets${loggedSets ? ` · ${loggedSets} saved` : ''}`}</span>
        </div>
        <div class="session-track"><div class="session-fill" style="width: ${Math.round(progress.done / Math.max(1, progress.total) * 100)}%"></div></div>
        ${clockRunning ? `<button class="btn btn-secondary btn-sm session-pause" onclick="${paused ? 'resumeWorkout()' : 'pauseWorkout()'}">${paused ? 'Resume' : 'Pause'}</button>` : ''}
        <button class="btn btn-positive btn-sm" onclick="finishAndSaveWorkout()">Finish</button>
      </div>
    `;
  }

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

  const staleDraft = hasDraft && (!meta || localDateStr(new Date(meta.startedAt)) !== localDateStr(new Date()));
  if (!clockRunning && !staleDraft && allExercises.length) {
    html += `
      <div class="start-card">
        <button class="btn btn-primary start-workout-btn" onclick="startWorkout()">Start workout</button>
        <div class="start-hint">Starts the clock. Ticking your first set starts it too.</div>
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

  let tipShown = false;
  allExercises.forEach((ex, exIdx) => {
    const totalSets = getSetCount(currentDayIdx, exIdx, ex.sets);
    const last = getLastPerformance(ex.name, history);
    let doneSets = 0;
    for (let s = 1; s <= totalSets; s++) {
      if (localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true') doneSets++;
    }
    const allDone = doneSets === totalSets;

    // Finished exercise the user folded away: one summary line, tap to open
    if (allDone && collapsedByUser.has(exStateKey(exIdx))) {
      const best = bestDraftSet(exIdx, totalSets);
      html += `
        <div class="card ex-card collapsed just-collapsed" id="ex-card-${exIdx}" onclick="expandExercise(${exIdx})">
          <span class="locked-num">${icon('check', 3)}</span>
          <div class="collapsed-text">
            <div class="ex-name">${escapeHtml(ex.name)}</div>
            <div class="ex-meta">${totalSets} set${totalSets === 1 ? '' : 's'}${best ? ` · best ${best.w > 0 ? `${fmtNum(best.w)} kg` : 'BW'} × ${best.r}` : ''}</div>
          </div>
          <span class="chevron">${icon('chevron')}</span>
        </div>
      `;
      return;
    }

    const rest = getExerciseRest(currentDayIdx, exIdx, ex);
    const lastBest = last ? last.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a) : null;
    const lastRest = last ? avgRest(last.sets) : 0;
    const tip = progressionTip(ex, lastSetFor(last, 1), lastRest || rest);
    // Rest chip: change vs last time (or vs the plan before there is a last time); shorter is progress
    const restRef = lastRest ? roundRest(lastRest) : ex.rest;
    const restDiff = restDelta(rest, restRef);
    const doneStats = allDone ? exerciseDoneStats(exIdx, ex, totalSets) : null;
    const nextEx = exIdx + 1 < allExercises.length;
    const showInfo = infoOpen.has(exStateKey(exIdx));
    const warmups = allDone ? [] : warmupSets(ex, exIdx, suggestSet(ex, lastSetFor(last, 1)));
    let firstOpenSet = 0;
    for (let s = 1; s <= totalSets && !firstOpenSet; s++) {
      if (localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) !== 'true') firstOpenSet = s;
    }

    html += `
      <div class="card ex-card ${allDone ? 'done' : ''}" id="ex-card-${exIdx}">
        <div class="ex-header">
          <div class="ex-name">${escapeHtml(ex.name)}${ex.isCustom ? `<span class="ex-tag">${ex.fromDay && ex.fromDay !== data.day ? `From ${escapeHtml(ex.fromDay.replace('Day ', 'D'))}` : 'Extra'}</span>` : ''}${ex.swapped ? '<span class="ex-tag">Alt</span>' : ''}</div>
          <span class="ex-progress ${allDone ? 'all-done' : ''}">${doneSets}/${totalSets}</span>
          ${allDone ? `<button class="icon-btn plain" onclick="collapseExercise(${exIdx})" aria-label="Fold exercise">${icon('chevronUp')}</button>` : ''}
          <button class="icon-btn plain ${showInfo ? 'on' : ''}" onclick="toggleExInfo(${exIdx})" aria-label="Exercise details" aria-expanded="${showInfo}">${icon('infoCircle', 1.8)}</button>
        </div>
        <div class="ex-meta">${warmups.length ? `${warmups.length} warm-up + ` : ''}${totalSets} × ${escapeHtml(ex.repTarget)} · ${escapeHtml(ex.weightTarget)}</div>
        ${lastBest ? `<div class="ex-last">Last: <strong>${lastBest.weight > 0 ? fmtSetLine(lastBest) : `BW × ${lastBest.reps}`}</strong>${lastRest ? ` · rest ${fmtClock(roundRest(lastRest))}` : ''}</div>` : ''}
        ${doneStats ? `
          <div class="ex-complete ${justFinishedEx === exIdx ? 'pop' : ''}" id="ex-complete-${exIdx}">
            <div class="ex-complete-title">${icon('check', 3)}Exercise complete</div>
            <div class="ex-complete-stats">
              <span><strong>${totalSets}</strong> set${totalSets === 1 ? '' : 's'}</span>
              ${doneStats.best ? `<span>best <strong>${doneStats.best.w > 0 ? `${fmtNum(doneStats.best.w)} kg` : 'BW'} × ${doneStats.best.r}</strong></span>` : ''}
              ${doneStats.volume > 0 ? `<span><strong>${fmtVolume(doneStats.volume)}</strong></span>` : ''}
              <span>rest <strong>${fmtClock(doneStats.avgRest)}</strong> avg</span>
            </div>
            ${nextEx ? `<button class="btn btn-positive btn-sm ex-next-btn" onclick="goToNextExercise(${exIdx})">Next exercise →</button>` : ''}
          </div>` : ''}
        <div class="ex-chips">
          <button class="chip ${restDiff.startsWith('−') ? 'faster' : ''}" onclick="pickRest(${exIdx})" aria-label="Rest ${fmtClock(rest)}, change">${icon('clock', 2)}Rest ${fmtClock(rest)}${restDiff ? `<span class="chip-delta">· ${restDiff}</span>` : ''}</button>
          ${tip ? `<span class="chip tip">${icon('arrowUp', 2.4)}${tip}</span>` : ''}
        </div>
        ${warmups.length ? `
          <div class="warmup-row" role="group" aria-label="Warm-up sets">
            <span class="warmup-label">Warm-up</span>
            ${warmups.map((w, i) => {
              const wDone = localStorage.getItem(warmupKey(currentDayIdx, exIdx, i)) === 'true';
              return `<button class="warmup-chip ${wDone ? 'done' : ''}" onclick="toggleWarmup(${exIdx}, ${i})" aria-pressed="${wDone}">${wDone ? icon('check', 3) : ''}${escapeHtml(w.label)}</button>`;
            }).join('')}
            <button class="warmup-chip warmup-edit" onclick="openWarmupEditor(${exIdx})" aria-label="Edit warm-up for ${escapeHtml(ex.name)}">${icon('pencil', 2.2)}Edit</button>
          </div>` : ''}
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
      const restPr = isDone && localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'pr')) === 'rest';
      const setLink = `
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
            <div class="set-block completed ${prType ? 'pr' : ''} ${blockId === justCompletedBlock ? 'just-completed' : ''}" id="${blockId}" onclick="editSet(${exIdx}, ${s})">
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
                <input type="number" id="${wKey}" step="0.5" inputmode="decimal" placeholder="${suggestion ? fmtNum(suggestion.w) : '0'}" value="${escapeHtml(valW)}" onfocus="this.select()" onchange="saveVal('${wKey}', this.value); pulse(this)">
                <span class="unit-label">kg</span>
              </label>
              <label class="input-group">
                <input type="number" id="${rKey}" inputmode="numeric" placeholder="${suggestion ? suggestion.r : '0'}" value="${escapeHtml(valR)}" onfocus="this.select()" onchange="saveVal('${rKey}', this.value); pulse(this)">
                <span class="unit-label">reps</span>
              </label>
              ${moreBtn}
              <button class="check-btn ${s === firstOpenSet ? 'next' : ''}" onclick="completeSet(${exIdx}, ${s})" aria-label="Complete set ${s}">${icon('check', 2.6)}</button>
            </div>
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
        <button class="btn btn-plain add-set-btn" onclick="addSet(${exIdx})">+ Add Set</button>
      </div>
    `;
  });

  html += `
    <button class="btn btn-secondary add-custom-ex-btn" onclick="addCustomExercise()">+ Add Exercise</button>
    ${hasDraft ? `<button class="btn btn-secondary save-log-btn" onclick="saveToTodaysLog()">Save to Today's Log</button>
    <div class="save-log-hint">Saves these sets and keeps your workout going, so you can add exercises from another day.</div>` : ''}
    <button class="btn btn-positive finish-workout-btn" onclick="finishAndSaveWorkout()">Finish Workout</button>
  `;
  main.innerHTML = html;
  syncWakeLock();
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

// Commit a set: fill from the suggestion if left empty, lock the row, and start the rest timer the first time.
function completeSet(exIdx, setNum) {
  const key = f => setKey(currentDayIdx, exIdx, setNum, f);
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const suggestion = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, getHistory()), setNum));

  const wInput = document.getElementById(key('w'));
  const rInput = document.getElementById(key('r'));
  let w = wInput.value.trim();
  let r = rInput.value.trim();
  if (!r && suggestion && suggestion.r) r = String(suggestion.r);
  if (!w && suggestion && suggestion.w) w = String(suggestion.w);

  if (!(parseInt(r, 10) > 0)) {
    haptic('error');
    const block = document.getElementById(`block_d${currentDayIdx}_e${exIdx}_s${setNum}`);
    block.classList.remove('shake');
    void block.offsetWidth;
    block.classList.add('shake');
    rInput.focus();
    return;
  }

  localStorage.setItem(key('w'), w);
  localStorage.setItem(key('r'), r);
  localStorage.setItem(key('done'), 'true');
  const pr = detectPr(ex, exIdx, setNum, parseFloat(w) || 0, parseInt(r, 10));
  if (pr) localStorage.setItem(key('pr'), pr);
  else localStorage.removeItem(key('pr'));
  const firstCompletion = localStorage.getItem(key('rested')) !== 'true';
  localStorage.setItem(key('rested'), 'true');
  touchDraft();
  resumeWorkout(true);

  // Was this the exercise's last open set?
  const count = getSetCount(currentDayIdx, exIdx, ex.sets);
  let finished = true;
  for (let s = 1; s <= count && finished; s++) finished = localStorage.getItem(setKey(currentDayIdx, exIdx, s, 'done')) === 'true';

  haptic('success');
  if (pr || finished) setTimeout(() => haptic('success'), 160);
  if (pr) {
    const restNote = pr === 'rest' ? ` · rest ${fmtClock(getSetRest(currentDayIdx, exIdx, setNum, ex))}` : '';
    showToast(`New PR · ${ex.name}: ${parseFloat(w) > 0 ? `${fmtNum(parseFloat(w))} kg` : 'BW'} × ${r}${restNote}`, { type: 'pr' });
  }
  justCompletedBlock = `block_d${currentDayIdx}_e${exIdx}_s${setNum}`;
  if (finished) {
    collapsedByUser.delete(exStateKey(exIdx));
    justFinishedEx = exIdx;
  }
  initNav();
  renderWorkout();
  justCompletedBlock = null;
  if (finished) {
    justFinishedEx = null;
    celebrate(document.getElementById(`ex-complete-${exIdx}`));
  }

  if (firstCompletion) startRestTimer(getSetRest(currentDayIdx, exIdx, setNum, ex), nextSetLabel(exIdx, setNum));
}

// "Set 2 · 50 kg × 8", or the next exercise's first open set
function nextSetLabel(exIdx, setNum) {
  const exercises = getAllExercisesForDay(currentDayIdx);
  const history = getHistory();
  for (let e = exIdx; e < exercises.length; e++) {
    const ex = exercises[e];
    const count = getSetCount(currentDayIdx, e, ex.sets);
    for (let s = e === exIdx ? setNum + 1 : 1; s <= count; s++) {
      if (localStorage.getItem(setKey(currentDayIdx, e, s, 'done')) === 'true') continue;
      const sug = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, history), s));
      const w = parseFloat(localStorage.getItem(setKey(currentDayIdx, e, s, 'w'))) || (sug ? sug.w : 0);
      const r = parseInt(localStorage.getItem(setKey(currentDayIdx, e, s, 'r')), 10) || (sug ? sug.r : 0);
      const target = r ? ` · ${w > 0 ? `${fmtNum(w)} kg` : 'BW'} × ${r}` : '';
      return `Next: ${e === exIdx ? '' : `${ex.name} · `}Set ${s}${target}`;
    }
  }
  return 'All sets done. Finish when ready.';
}

function editSet(exIdx, setNum) {
  localStorage.setItem(setKey(currentDayIdx, exIdx, setNum, 'done'), 'false');
  localStorage.removeItem(setKey(currentDayIdx, exIdx, setNum, 'pr'));
  haptic('light');
  renderWorkout();
  const input = document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'w'));
  if (input) input.focus();
}

async function openSetMenu(exIdx, setNum) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  const count = getSetCount(currentDayIdx, exIdx, ex.sets);
  // Drop sets and rest have their own line under each set; the menu edits the warm-up and deletes sets
  const choices = [{ label: 'Edit warm-up', value: 'warmup' }];
  if (count > 1) choices.push({ label: 'Delete set', value: 'delete', destructive: true });
  const choice = await actionSheet(`Set ${setNum}`, ex.name, choices);
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
  collapsedByUser.delete(exStateKey(exIdx));
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
  return !!restTimer || !!sessionStartedToday(currentDayIdx) && dayHasDraft(currentDayIdx);
}

async function syncWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden) return;
  try {
    if (workoutInProgress() && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!workoutInProgress() && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch (e) {}
}
