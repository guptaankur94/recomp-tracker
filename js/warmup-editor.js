/* Warm-up editor: set your own warm-up sets for an exercise (weight and reps), or go back to the automatic
   ramp that follows your working weight. Saved by exercise name, so it applies on every day the exercise appears. */
const MAX_WARMUP_SETS = 6;
let wuEdit = null;

function openWarmupEditor(exIdx) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  if (!ex) return;
  const suggestion = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, getHistory()), 1));
  // Start from what's shown now (your own sets, or the automatic ones worked out in kg)
  const rows = warmupSets(ex, exIdx, suggestion).map(w => ({ kg: w.kg > 0 ? String(w.kg) : '', reps: String(w.reps) }));
  wuEdit = { name: ex.name, own: !!customWarmup(ex.name), rows };
  document.getElementById('wu-sub').textContent = ex.name;
  renderWarmupRows();
  openSheet('warmup-sheet');
}

function renderWarmupRows() {
  const { rows, own } = wuEdit;
  document.getElementById('wu-rows').innerHTML = rows.length ? rows.map((r, i) => `
    <div class="wu-edit-row">
      <span class="wu-num">${i + 1}</span>
      <input type="number" step="0.5" inputmode="decimal" placeholder="Light" value="${escapeHtml(r.kg)}" aria-label="Warm-up ${i + 1} weight in kg" oninput="wuEdit.rows[${i}].kg = this.value">
      <span class="wu-unit">kg ×</span>
      <input type="number" inputmode="numeric" placeholder="reps" value="${escapeHtml(r.reps)}" aria-label="Warm-up ${i + 1} reps" oninput="wuEdit.rows[${i}].reps = this.value">
      <span class="wu-unit">reps</span>
      <button class="mini-del-btn" onclick="removeWarmupRow(${i})" aria-label="Remove warm-up ${i + 1}">${icon('x')}</button>
    </div>`).join('') : '<div class="wu-empty">No warm-up for this exercise.</div>';
  document.getElementById('wu-add').hidden = rows.length >= MAX_WARMUP_SETS;
  document.getElementById('wu-auto').hidden = !own;
}

function addWarmupRow() {
  const last = wuEdit.rows[wuEdit.rows.length - 1];
  wuEdit.rows.push({ kg: '', reps: last ? last.reps : '8' });
  renderWarmupRows();
  const inputs = document.querySelectorAll('#wu-rows input');
  if (inputs.length) inputs[inputs.length - 2].focus();
}

function removeWarmupRow(i) {
  wuEdit.rows.splice(i, 1);
  haptic('light');
  renderWarmupRows();
}

// The rows as warm-up sets, or a message saying what to fix. Rows left empty are dropped.
function parseWarmupRows(rows) {
  const sets = [];
  for (let i = 0; i < rows.length; i++) {
    const kgText = String(rows[i].kg).trim();
    const repsText = String(rows[i].reps).trim();
    if (!kgText && !repsText) continue;
    const reps = parseInt(repsText, 10);
    if (!(reps >= 1 && reps <= 50)) return { error: `Warm-up ${i + 1}: enter reps between 1 and 50` };
    const kg = kgText ? Math.round(parseFloat(kgText) * 100) / 100 : 0;
    if (kgText && !(kg >= 0 && kg <= 500)) return { error: `Warm-up ${i + 1}: enter a weight up to 500 kg, or leave it empty for a light set` };
    sets.push(kg > 0 ? { kg, reps } : { reps });
  }
  return { sets };
}

function saveWarmupEditor() {
  const { sets, error } = parseWarmupRows(wuEdit.rows);
  if (error) {
    haptic('error');
    showToast(error, { type: 'error' });
    return;
  }
  saveWarmup(wuEdit.name, sets);
  closeSheet('warmup-sheet');
  haptic('success');
  showToast(sets.length ? `Warm-up saved for ${wuEdit.name}` : `No warm-up for ${wuEdit.name}`);
  renderWorkout();
}

function useAutomaticWarmup() {
  saveWarmup(wuEdit.name, null);
  closeSheet('warmup-sheet');
  haptic('success');
  showToast(`${wuEdit.name} is back to the automatic warm-up`);
  renderWorkout();
}
