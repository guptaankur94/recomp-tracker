/* Adding exercises to a day: from your plan, the library or a custom one. */

/* Custom Exercises Logic */
function getCustomExercises(dayIdx) {
  return readJSON(`custom_ex_d${dayIdx}`, []);
}

/* Add exercise sheet: your plan grouped by day (an exercise brings its sets, reps, weight, rest, cue and
   alternative with it), then other exercises you've logged, or a custom one */
let addExMuscle = null;

function filterAddMuscle(m) {
  addExMuscle = addExMuscle === m ? null : m;
  haptic('light');
  renderAddExerciseList();
  document.querySelector('#add-ex-sheet .sheet').scrollTop = 0;
}

function addCustomExercise() {
  pickCallback = null;
  document.getElementById('add-ex-sheet').onSheetClose = null;
  addExMuscle = null;
  document.getElementById('add-ex-search').value = '';
  showAddExerciseForm(false);
  renderAddExerciseList();
  openSheet('add-ex-sheet');
}

function planExerciseSub(ex) {
  return `${ex.warmup ? `${ex.warmup} warm-up + ` : ''}${ex.sets} × ${ex.repTarget} · ${ex.weightTarget} · rest ${fmtClock(ex.rest)}`;
}

function renderAddExerciseList() {
  const query = document.getElementById('add-ex-search').value.trim();
  const q = query.toLowerCase();
  const inDay = new Set((pickCallback ? pickCallback.existing : getAllExercisesForDay(currentDayIdx)).map(e => e.name.toLowerCase()));
  const matches = name => !inDay.has(name.toLowerCase()) && (!q || name.toLowerCase().includes(q));
  const picks = [];
  const row = (pick, main, sub, alt) => {
    picks.push(pick);
    return `<button class="choice" data-idx="${picks.length - 1}"><span><span class="choice-main">${escapeHtml(main)}</span>${sub ? `<span class="choice-sub">${escapeHtml(sub)}</span>` : ''}${alt ? `<span class="choice-sub">Alt: ${escapeHtml(alt)}</span>` : ''}</span></button>`;
  };

  document.getElementById('add-ex-muscles').innerHTML = MUSCLES.map(m =>
    `<button class="chip ${m === addExMuscle ? 'on' : ''}" onclick="filterAddMuscle('${m}')" aria-pressed="${m === addExMuscle}">${m}</button>`).join('');

  let html = `<button class="choice add-new" data-custom="1"><span class="choice-main">+ ${query ? `Create “${escapeHtml(query)}”` : 'Custom exercise'}</span></button>`;
  let found = 0;
  const libSection = names => {
    const rows = names.map(e => row({ template: libExercise(e.name) }, e.name, `${e.equipment} · ${repLabel(e.reps)} · rest ${fmtClock(e.rest)}`, e.alt));
    found += rows.length;
    return rows.join('');
  };

  // A muscle filter shows just the library for that muscle
  if (addExMuscle) {
    const list = [...LIBRARY.values()].filter(e => e.muscle === addExMuscle && matches(e.name));
    html += `<div class="choice-section">${addExMuscle} · exercise library</div>` + libSection(list);
    if (!list.length) html += '<div class="empty-list">Nothing here matches your search.</div>';
    renderAddList(html, picks, query);
    return;
  }

  // From the plan, grouped by day; the current day's own exercises are already on screen
  const planNames = new Set();
  programData.forEach((d, i) => {
    const rows = [];
    d.exercises.forEach(ex => {
      planNames.add(ex.name.toLowerCase());
      if (ex.alt) planNames.add(ex.alt.name.toLowerCase());
      if (!pickCallback && i === currentDayIdx) return;
      if (matches(ex.name)) rows.push(row({ template: ex, fromDay: d.day }, ex.name, planExerciseSub(ex), ex.alt && ex.alt.name));
      else if (q && ex.alt && matches(ex.alt.name)) rows.push(row({ template: { ...ex.alt, alt: { ...ex, alt: undefined } }, fromDay: d.day }, ex.alt.name, planExerciseSub(ex.alt), ex.name));
    });
    if (rows.length) {
      found += rows.length;
      html += `<div class="choice-section"><span class="day-dot" style="background:${dayColor(d.day)}"></span>${escapeHtml(d.day)} · ${escapeHtml(d.title)}</div>${rows.join('')}`;
    }
  });

  // Logged before but not in the current plan, most recent first
  const recent = new Map();
  getHistory().forEach(s => s.exercises.forEach(e => {
    const k = e.name.toLowerCase();
    if (planNames.has(k) || !matches(e.name)) return;
    const item = recent.get(k) || { name: e.name, count: 0 };
    item.count++;
    recent.set(k, item);
  }));
  if (recent.size) {
    found += recent.size;
    html += '<div class="choice-section">Other exercises you\'ve logged</div>' +
      [...recent.values()].slice(0, 30).map(it => row({ template: { name: it.name } }, it.name, `done ${it.count}×`)).join('');
  }
  // The rest of the library, by muscle
  MUSCLES.forEach(m => {
    const list = [...LIBRARY.values()].filter(e => e.muscle === m && !planNames.has(e.name.toLowerCase()) && !recent.has(e.name.toLowerCase()) && matches(e.name));
    if (list.length) html += `<div class="choice-section">${m} · exercise library</div>` + libSection(list);
  });
  if (q && !found) html += '<div class="empty-list">Nothing matches. Create it as a custom exercise.</div>';
  renderAddList(html, picks, query);
}

function renderAddList(html, picks, query) {
  const list = document.getElementById('add-ex-list');
  list.innerHTML = html;
  list.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.custom) {
      document.getElementById('cx-name').value = query;
      showAddExerciseForm(true);
    } else {
      addExerciseToDay(picks[Number(btn.dataset.idx)]);
    }
  }));
}

document.getElementById('add-ex-search').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const first = document.querySelector('#add-ex-list .choice:not(.add-new)') || document.querySelector('#add-ex-list .choice');
  if (first) first.click();
});

function showAddExerciseForm(show) {
  document.getElementById('add-ex-browse').hidden = show;
  document.getElementById('add-ex-form').hidden = !show;
  document.getElementById('add-ex-title').textContent = show ? 'Custom Exercise' : 'Add Exercise';
  if (show) {
    document.getElementById('cx-rest').innerHTML = REST_CHOICES.map(sec => `<option value="${sec}" ${sec === 90 ? 'selected' : ''}>${fmtClock(sec)}</option>`).join('');
    setTimeout(() => document.getElementById('cx-name').focus(), 50);
  }
}

function submitCustomExercise() {
  const nameEl = document.getElementById('cx-name');
  const name = nameEl.value.trim();
  if (!name) {
    fieldError(nameEl, 'Give the exercise a name.');
    return;
  }
  const reps = document.getElementById('cx-reps').value.trim() || '8–12';
  addExerciseToDay({
    template: {
      name,
      sets: parseInt(document.getElementById('cx-sets').value, 10) || 3,
      repTarget: /reps|s\b|hold|failure/i.test(reps) ? reps : `${reps.replace('-', '–')} reps`,
      weightTarget: document.getElementById('cx-weight').value.trim() || 'Custom',
      rest: parseInt(document.getElementById('cx-rest').value, 10) || 90,
      warmup: parseInt(document.getElementById('cx-warmup').value, 10) || 0
    }
  });
}

function addExerciseToDay({ template, fromDay = null }) {
  const t = template || {};
  const name = String(t.name || '').trim();
  if (!name) return;
  // Picking for the plan editor
  if (pickCallback) {
    const cb = pickCallback;
    closeSheet('add-ex-sheet');
    document.activeElement && document.activeElement.blur();
    haptic('success');
    cb.onPick({ ...t, name });
    return;
  }
  const custom = {
    name,
    repTarget: t.repTarget || '8–12 reps',
    weightTarget: t.weightTarget || 'Custom',
    rest: t.rest || 90,
    sets: t.sets || 3,
    isCustom: true
  };
  if (t.cue) custom.cue = t.cue;
  if (t.warmup !== undefined) custom.warmup = t.warmup;
  if (t.alt && typeof t.alt === 'object' && t.alt.name) {
    custom.alt = { name: t.alt.name, repTarget: t.alt.repTarget, weightTarget: t.alt.weightTarget, rest: t.alt.rest, sets: t.alt.sets };
    if (t.alt.warmup !== undefined) custom.alt.warmup = t.alt.warmup;
    if (t.alt.cue) custom.alt.cue = t.alt.cue;
  }
  if (fromDay) custom.fromDay = fromDay;
  const customs = getCustomExercises(currentDayIdx);
  customs.push(custom);
  localStorage.setItem(`custom_ex_d${currentDayIdx}`, JSON.stringify(customs));
  closeSheet('add-ex-sheet');
  document.activeElement && document.activeElement.blur();
  renderWorkout();
  haptic('success');
  showToast(`${name} added${fromDay ? ` from ${fromDay}` : ''}`);
  // Bring the new card into view
  setTimeout(() => {
    const cards = document.querySelectorAll('#workout-content .ex-card');
    const last = cards[cards.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

async function openDayMenu() {
  const actions = [{ label: 'Add exercise for today', value: 'add' }];
  if (!isCustomDay()) actions.push({ label: 'Edit this day in the plan', value: 'edit' });
  if (dayHasDraft(currentDayIdx)) {
    actions.push({ label: 'Save to today\'s log', value: 'log' });
    actions.push({ label: 'Clear unsaved sets', value: 'clear', destructive: true });
  }
  const choice = await actionSheet(dayAt(currentDayIdx).day, dayAt(currentDayIdx).title, actions);
  if (choice === 'add') addCustomExercise();
  else if (choice === 'edit') openPlanEditor({ dayIdx: currentDayIdx });
  else if (choice === 'log') saveToTodaysLog();
  else if (choice === 'clear') discardDraft();
}

async function removeCustomExercise(exIdx) {
  const allExercises = getAllExercisesForDay(currentDayIdx);
  const ex = allExercises[exIdx];
  if (!ex || !ex.isCustom) return;
  if (!await confirmSheet(`Remove ${ex.name}?`, 'Any sets entered for it will be removed too.', 'Remove', true)) return;

  // Set data and swap choices are keyed by exercise position, so later extras shift down one slot.
  removeKeysMatching(new RegExp(`^(active_)?d${currentDayIdx}_e${exIdx}_`));
  localStorage.removeItem(swapKey(currentDayIdx, exIdx));
  for (let e = exIdx + 1; e < allExercises.length; e++) {
    moveExerciseKeys(currentDayIdx, e, e - 1);
  }

  const customs = getCustomExercises(currentDayIdx);
  customs.splice(exIdx - dayAt(currentDayIdx).exercises.length, 1);
  localStorage.setItem(`custom_ex_d${currentDayIdx}`, JSON.stringify(customs));
  renderWorkout();
}

function moveExerciseKeys(dayIdx, fromIdx, toIdx) {
  const regex = new RegExp(`^(active_)?d${dayIdx}_e${fromIdx}_(.+)$`);
  Object.keys(localStorage).forEach(key => {
    const m = key.match(regex);
    if (!m) return;
    localStorage.setItem(`${m[1] || ''}d${dayIdx}_e${toIdx}_${m[2]}`, localStorage.getItem(key));
    localStorage.removeItem(key);
  });
  const swap = localStorage.getItem(swapKey(dayIdx, fromIdx));
  localStorage.removeItem(swapKey(dayIdx, fromIdx));
  if (swap !== null) localStorage.setItem(swapKey(dayIdx, toIdx), swap);
}

function swapKey(dayIdx, exIdx) {
  return `swap_d${dayIdx}_e${exIdx}`;
}

// Plan exercises plus ones added for today; any exercise with an alternative can be swapped.
function getAllExercisesForDay(dayIdx) {
  const withSwap = (ex, exIdx, extra) => {
    const alt = ex.alt && typeof ex.alt === 'object' && ex.alt.name ? ex.alt : null;
    const swapped = alt && localStorage.getItem(swapKey(dayIdx, exIdx)) === 'true';
    return swapped
      ? { ...alt, ...extra, swapped: true, otherName: ex.name }
      : { ...ex, ...extra, swapped: false, otherName: alt ? alt.name : null };
  };
  const base = dayAt(dayIdx).exercises.map((ex, exIdx) => withSwap(ex, exIdx, {}));
  const customs = getCustomExercises(dayIdx).map((ex, j) =>
    withSwap(ex, base.length + j, { isCustom: true, ...(ex.fromDay ? { fromDay: ex.fromDay } : {}) }));
  return [...base, ...customs];
}
