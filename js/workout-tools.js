/* Tools for the workout in progress: supersets, exercise notes, plate maths, and today's own order (do an
   exercise later, or skip it today) without changing the plan. */

/* Supersets: two plan exercises done back to back, set for set, resting after the pair. Stored on the plan
   (superset: true on the first of the two), so the pairing comes back every time you do that day. */
function supersetPartner(dayIdx, exIdx) {
  if (isCustomDay(dayIdx)) return null;
  const exs = dayAt(dayIdx).exercises;
  if (exIdx >= exs.length) return null;
  // Pairs only: a first member pairs with the next one, unless it's itself the second of a pair
  const isFirst = i => i >= 0 && i < exs.length - 1 && exs[i].superset && !(i > 0 && isFirst(i - 1));
  if (isFirst(exIdx)) return { partner: exIdx + 1, role: 1 };
  if (isFirst(exIdx - 1)) return { partner: exIdx - 1, role: 2 };
  return null;
}

// "A", "B"… for each pair on the day, in plan order
function supersetLetter(dayIdx, exIdx) {
  let n = 0;
  for (let i = 0; i < dayAt(dayIdx).exercises.length; i++) {
    const p = supersetPartner(dayIdx, i);
    if (p && p.role === 1) {
      if (i === exIdx || i + 1 === exIdx) return String.fromCharCode(65 + n);
      n++;
    }
  }
  return '';
}

function toggleSuperset(exIdx) {
  const pair = supersetPartner(currentDayIdx, exIdx);
  const first = pair ? Math.min(exIdx, pair.partner) : exIdx;
  const exs = dayAt(currentDayIdx).exercises;
  if (!pair && (first >= exs.length - 1 || supersetPartner(currentDayIdx, first + 1))) {
    haptic('error');
    showToast('Supersets pair an exercise with the next one in the plan', { type: 'error' });
    return;
  }
  editPlanDay(currentDayIdx, list => { list[first] = { ...list[first], superset: !pair }; });
  haptic('success');
  renderWorkout();
  showToast(pair ? 'Superset removed' : `Superset: ${exs[first].name} + ${exs[first + 1].name}. Rest comes after both.`);
}

/* Exercise notes: one per exercise name ("seat 4", "cable on notch 6"), shown on the card every time */
const NOTES_KEY = 'recomp_notes';

function getNotes() {
  const n = readJSON(NOTES_KEY, {});
  return n && typeof n === 'object' && !Array.isArray(n) ? n : {};
}

function exerciseNote(name) {
  const n = getNotes()[name];
  return typeof n === 'string' ? n : '';
}

async function editNote(exIdx) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  if (!ex) return;
  const current = exerciseNote(ex.name);
  const text = await openDialog({
    title: `Note · ${ex.name}`,
    message: 'Shown on this exercise every time, on any day. E.g. seat height, grip, cable notch. Leave empty to remove.',
    input: { placeholder: 'e.g. Seat 4, handles at notch 6', value: current, allowEmpty: true },
    confirmLabel: 'Save note'
  });
  if (text === null || text === undefined) return;
  const notes = getNotes();
  const clean = String(text).trim().slice(0, 200);
  if (clean) notes[ex.name] = clean;
  else delete notes[ex.name];
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  haptic('success');
  renderWorkout();
}

/* Plate maths for a barbell: what goes on each side */
const BAR_KG = 20;
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

function isBarbellExercise(ex) {
  const lib = LIBRARY.get(ex.name);
  return (lib && lib.equipment === 'Barbell') || /\bbarbell\b/i.test(ex.name);
}

function platesPerSide(kg) {
  if (!(kg > 0)) return null;
  if (kg < BAR_KG) return { text: `Lighter than the ${BAR_KG} kg bar` };
  if (kg === BAR_KG) return { text: 'Just the bar' };
  let left = Math.round((kg - BAR_KG) / 2 * 1000) / 1000;
  const used = [];
  PLATES_KG.forEach(p => { while (left >= p - 1e-9) { used.push(p); left = Math.round((left - p) * 1000) / 1000; } });
  // Exact to the gram (plates come in 1.25 kg; the usual one-decimal rounding would say 1.3)
  const kgText = n => String(Math.round(n * 1000) / 1000);
  return { text: `Each side: ${used.map(kgText).join(' + ')}${left > 0 ? ` (${kgText(left)} kg short)` : ''}` };
}

/* Today's order: "do later" moves an exercise (with its superset partner) to the end, "skip today" sets it
   aside. Both are dated, so they only ever apply to today, and never change the plan. */
const todayOrderKey = d => `active_d${d}_order`;
const skipKey = (d, i) => `active_d${d}_e${i}_skip`;

function exerciseOrder(dayIdx, count) {
  const saved = readJSON(todayOrderKey(dayIdx), null);
  const list = saved && saved.date === localDateStr(new Date()) && Array.isArray(saved.order) ? saved.order : [];
  const order = [...new Set(list.filter(i => Number.isInteger(i) && i >= 0 && i < count))];
  for (let i = 0; i < count; i++) if (!order.includes(i)) order.push(i);
  return order;
}

function isSkipped(dayIdx, exIdx) {
  return localStorage.getItem(skipKey(dayIdx, exIdx)) === localDateStr(new Date());
}

function doLater(exIdx) {
  const count = getAllExercisesForDay(currentDayIdx).length;
  const pair = supersetPartner(currentDayIdx, exIdx);
  const moving = pair ? [Math.min(exIdx, pair.partner), Math.max(exIdx, pair.partner)] : [exIdx];
  const order = exerciseOrder(currentDayIdx, count).filter(i => !moving.includes(i)).concat(moving);
  localStorage.setItem(todayOrderKey(currentDayIdx), JSON.stringify({ date: localDateStr(new Date()), order }));
  delete focusChoice[currentDayIdx];
  haptic('light');
  renderWorkout();
  showToast('Moved to the end, for today only', { actionLabel: 'Undo', onAction: () => { localStorage.removeItem(todayOrderKey(currentDayIdx)); renderWorkout(); } });
}

function skipToday(exIdx) {
  localStorage.setItem(skipKey(currentDayIdx, exIdx), localDateStr(new Date()));
  if (focusChoice[currentDayIdx] === exIdx) delete focusChoice[currentDayIdx];
  haptic('light');
  initNav();
  renderWorkout();
  showToast('Skipped for today', { actionLabel: 'Undo', onAction: () => unskip(exIdx) });
}

function unskip(exIdx) {
  localStorage.removeItem(skipKey(currentDayIdx, exIdx));
  haptic('light');
  renderWorkout();
}

/* The exercise menu (⋯ in the card's header) */
async function openExerciseMenu(exIdx) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  if (!ex) return;
  const pair = supersetPartner(currentDayIdx, exIdx);
  const exs = dayAt(currentDayIdx).exercises;
  const canPair = !ex.isCustom && !isCustomDay() && exIdx < exs.length - 1 && !supersetPartner(currentDayIdx, exIdx + 1);
  const choices = [
    { label: exerciseNote(ex.name) ? 'Edit note' : 'Add a note', value: 'note' },
    ...(pair ? [{ label: 'Remove superset', value: 'superset' }] : canPair ? [{ label: `Superset with ${exs[exIdx + 1].name}`, value: 'superset' }] : []),
    { label: 'Do it later today', value: 'later' },
    { label: 'Skip today', value: 'skip' },
    { label: 'Edit warm-up', value: 'warmup' }
  ];
  const choice = await actionSheet(ex.name, 'Changes here are for today, except notes and supersets, which stay.', choices);
  if (choice === 'note') editNote(exIdx);
  if (choice === 'superset') toggleSuperset(exIdx);
  if (choice === 'later') doLater(exIdx);
  if (choice === 'skip') skipToday(exIdx);
  if (choice === 'warmup') openWarmupEditor(exIdx);
}
