/* The number pad for logging sets, used instead of the iPhone keyboard: digits, ± a step (2.5 kg or 1 rep),
   Next (weight → reps) and ✓ Log set. It covers less of the screen than the keyboard, has the Next key the
   iPhone number pad lacks, and never makes the page jump as a keyboard slides in and out. The set's fields
   stay real inputs (inputmode="none"), so a hardware keyboard still types into them. */
let pad = null; // { id, exIdx, setNum, field, fresh }

const PAD_STEP = { w: 2.5, r: 1 };

function padTarget() {
  return pad ? document.getElementById(pad.id) : null;
}

function openPad(input) {
  if (!input) return;
  const m = input.id.match(/^active_d(\d+)_e(\d+)_s(\d+)_(w|r)$/);
  if (!m) return;
  document.querySelectorAll('.pad-on').forEach(el => el.classList.remove('pad-on'));
  pad = { id: input.id, exIdx: Number(m[2]), setNum: Number(m[3]), field: m[4], fresh: true };
  input.classList.add('pad-on');
  if (document.activeElement !== input) input.focus({ preventScroll: true });
  const el = document.getElementById('numpad');
  renderPad();
  const wasHidden = el.hidden;
  el.hidden = false;
  document.body.classList.add('pad-open');
  if (wasHidden) {
    void el.offsetWidth;
    el.classList.add('open');
    haptic('light');
  }
  // Keep the set in view above the pad
  requestAnimationFrame(() => {
    const block = input.closest('.set-block');
    if (!block) return;
    const padTop = window.innerHeight - el.getBoundingClientRect().height;
    const r = block.getBoundingClientRect();
    const hint = block.querySelector('.set-hint');
    const bottom = (hint || block).getBoundingClientRect().bottom;
    const { top } = clearArea();
    let delta = 0;
    if (bottom > padTop - 12) delta = bottom - (padTop - 12);
    if (r.top - delta < top) delta = r.top - top;
    if (Math.abs(delta) >= 2) window.scrollBy({ top: delta, behavior: reduceMotion() ? 'instant' : 'smooth' });
  });
}

function closePad() {
  if (!pad) return;
  const input = padTarget();
  if (input) {
    input.classList.remove('pad-on');
    input.blur();
    if (input.value) pulse(input);
  }
  pad = null;
  const el = document.getElementById('numpad');
  el.classList.remove('open');
  document.body.classList.remove('pad-open');
  setTimeout(() => { if (!pad) el.hidden = true; }, reduceMotion() ? 0 : 220);
}

function renderPad() {
  const input = padTarget();
  if (!pad || !input) return;
  const ex = getAllExercisesForDay(currentDayIdx)[pad.exIdx];
  const isW = pad.field === 'w';
  const step = PAD_STEP[pad.field];
  const key = (label, action, cls = '', aria = label) => `<button class="pad-key ${cls}" data-act="${action}" aria-label="${aria}">${label}</button>`;
  document.getElementById('numpad').innerHTML = `
    <div class="pad-head">
      <span class="pad-label">Set ${pad.setNum} · <b>${isW ? 'Weight, kg' : 'Reps'}</b></span>
      <span class="pad-ex">${ex ? escapeHtml(ex.name) : ''}</span>
      <button class="pad-hide" data-act="hide" aria-label="Hide number pad">${icon('chevron', 2.4)}</button>
    </div>
    <div class="pad-grid">
      ${key('1', '1')}${key('2', '2')}${key('3', '3')}${key(`−${fmtNum(step)}`, 'minus', 'pad-fn', `Minus ${fmtNum(step)}`)}
      ${key('4', '4')}${key('5', '5')}${key('6', '6')}${key(`+${fmtNum(step)}`, 'plus', 'pad-fn', `Plus ${fmtNum(step)}`)}
      ${key('7', '7')}${key('8', '8')}${key('9', '9')}${key('⌫', 'back', 'pad-fn', 'Delete')}
      ${isW ? key('.', 'dot', '', 'Decimal point') : key('', 'none', 'pad-blank', '')}${key('0', '0')}
      ${isW ? key('Next', 'next', 'pad-next', 'Next: reps') : key(`${icon('check', 3)}Log set`, 'log', 'pad-log', `Log set ${pad.setNum}`)}
    </div>`;
}

function setPadValue(value) {
  const input = padTarget();
  if (!input) return;
  input.value = value;
  saveVal(input.id, value);
  pad.fresh = false;
}

function padPress(act) {
  const input = padTarget();
  if (!pad || !input) return closePad();
  const isW = pad.field === 'w';
  const v = pad.fresh ? '' : input.value;
  if (/^\d$/.test(act)) {
    // The first key replaces what was there (like selecting the field); then it types on
    const next = v === '0' ? act : v + act;
    if (next.replace('.', '').length <= (isW ? 5 : 4)) setPadValue(next);
  } else if (act === 'dot') {
    if (isW && !v.includes('.')) setPadValue(v ? `${v}.` : '0.');
  } else if (act === 'back') {
    setPadValue(input.value.slice(0, -1));
  } else if (act === 'minus' || act === 'plus') {
    // From what's typed, else the hint shown in the field
    const base = parseFloat(input.value) || parseFloat(input.placeholder) || 0;
    const n = Math.max(0, Math.round((base + (act === 'plus' ? 1 : -1) * PAD_STEP[pad.field]) * 100) / 100);
    setPadValue(String(n));
  } else if (act === 'next') {
    const reps = document.getElementById(setKey(currentDayIdx, pad.exIdx, pad.setNum, 'r'));
    if (reps) openPad(reps);
    else closePad();
  } else if (act === 'log') {
    const { exIdx, setNum } = pad;
    closePad();
    completeSet(exIdx, setNum);
    return;
  } else if (act === 'hide') {
    closePad();
    return;
  }
  haptic('light');
}

// Hardware keyboard: Enter works like Next / Log set
function padKeydown(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const m = e.target.id.match(/_(w|r)$/);
  if (!pad || pad.id !== e.target.id) openPad(e.target);
  padPress(m && m[1] === 'w' ? 'next' : 'log');
}

(() => {
  const el = document.getElementById('numpad');
  // Keys act on pointerdown and keep focus in the field (no blur, no flicker)
  el.addEventListener('pointerdown', e => {
    const btn = e.target.closest('[data-act]');
    e.preventDefault();
    if (btn && btn.dataset.act !== 'none') padPress(btn.dataset.act);
  });
  el.addEventListener('click', e => e.preventDefault());
  // A tap anywhere else closes the pad (a tap on another set's field moves it there instead)
  document.addEventListener('pointerdown', e => {
    if (!pad || el.contains(e.target)) return;
    if (e.target.closest && e.target.closest('[data-pad]')) return;
    closePad();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pad) closePad(); });
})();

// After the workout is re-drawn, the pad follows its field, or closes if the field is gone
function syncPad() {
  if (!pad) return;
  const input = padTarget();
  if (!input || document.getElementById('view-workout').hidden) return closePad();
  input.classList.add('pad-on');
}
