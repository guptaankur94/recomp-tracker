/* Shared interface pieces: icons, toasts, bottom sheets, dialogs, keyboard handling, field errors. */

/* Icons (inline SVG, drawn with currentColor) */
const ICON_PATHS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  swap: '<path d="M7 4L4 7l3 3M4 7h12M17 20l3-3-3-3M20 17H8"/>',
  info: '<path d="M12 11v6M12 7.5v.01"/>',
  infoCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3.2"/>'
};

function icon(name, strokeWidth = 2.2) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/* Toast: short confirmation at the top of the screen, optionally with an action such as Undo */
let toastTimer = null;

let toastAction = null;

function showToast(message, { type = 'success', actionLabel = null, onAction = null, duration } = {}) {
  const toast = document.getElementById('toast');
  const actionBtn = document.getElementById('toast-action');
  document.getElementById('toast-icon').innerHTML = type === 'pr'
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>'
    : icon(type === 'error' ? 'x' : type === 'info' ? 'info' : 'check', 3);
  document.getElementById('toast-msg').textContent = message;
  toast.className = `toast ${type}`;
  toastAction = onAction;
  actionBtn.hidden = !actionLabel;
  actionBtn.textContent = actionLabel || '';
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  const ms = duration ?? (actionLabel ? 5000 : type === 'error' ? 4000 : 2600);
  if (ms > 0) toastTimer = setTimeout(hideToast, ms);
}

function hideToast() {
  clearTimeout(toastTimer);
  document.getElementById('toast').classList.remove('show');
  toastAction = null;
}

document.getElementById('toast-action').addEventListener('click', () => {
  const action = toastAction;
  hideToast();
  if (action) action();
});

/* Bottom sheets: slide up, dim the page, close on backdrop tap, Escape or a downward drag */
const openSheets = [];

function openSheet(id) {
  const overlay = document.getElementById(id);
  if (openSheets.includes(overlay)) return;
  overlay.style.display = 'flex';
  overlay.querySelector('.sheet').scrollTop = 0;
  void overlay.offsetWidth;
  overlay.classList.add('open');
  openSheets.push(overlay);
  fitSheetsToKeyboard();
}

function closeSheet(id) {
  const overlay = document.getElementById(id);
  const idx = openSheets.indexOf(overlay);
  if (idx === -1) return;
  openSheets.splice(idx, 1);
  const sheet = overlay.querySelector('.sheet');
  sheet.style.transform = '';
  overlay.style.top = overlay.style.height = overlay.style.bottom = '';
  overlay.classList.remove('open');
  if (overlay.onSheetClose) overlay.onSheetClose();
  if (typeof introSheetClosed === 'function') introSheetClosed(id, overlay.dataset.saved === '1');
  delete overlay.dataset.saved;
  const done = () => { if (!overlay.classList.contains('open')) overlay.style.display = 'none'; };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
  else setTimeout(done, 320);
}

/* iPhone keyboard. The keyboard shrinks only the visible area (visualViewport), not the page, so
   full-screen layers (sheets, setup) are pinned to the visible area and sized to it, the floating
   bars step aside, and the field being typed in is scrolled clear of the keyboard and any sticky header. */
function visibleBox() {
  const vv = window.visualViewport;
  return vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight };
}

let keyboardOpen = false;

let scrollBeforeKeyboard = 0;

function fitSheetsToKeyboard() {
  const { top, height } = visibleBox();
  const open = window.innerHeight - height > 120;
  if (open && !keyboardOpen) scrollBeforeKeyboard = window.scrollY;
  // Keyboard closed while a full-screen layer is up: undo any page scroll iOS made to reach the field
  if (!open && keyboardOpen && (openSheets.length || !document.getElementById('onboarding').hidden)) window.scrollTo(0, scrollBeforeKeyboard);
  keyboardOpen = open;
  document.body.classList.toggle('kb-open', open);
  document.documentElement.style.setProperty('--vvh', `${Math.round(height)}px`);
  [...openSheets, document.getElementById('onboarding')].forEach(layer => {
    layer.style.top = open ? `${top}px` : '';
    layer.style.height = open ? `${height}px` : '';
    layer.style.bottom = open ? 'auto' : '';
  });
  if (open && isTypingField(document.activeElement)) keepFieldInView(document.activeElement);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitSheetsToKeyboard);
  window.visualViewport.addEventListener('scroll', fitSheetsToKeyboard);
}

function isTypingField(el) {
  return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'submit'].includes(el.type)));
}

// Scroll the field's own container (a sheet, the setup screen, or the page) so it sits in the clear area
function keepFieldInView(el) {
  if (!el || document.activeElement !== el) return;
  const { top, height } = visibleBox();
  const scroller = el.closest('.sheet, .onb-scroll');
  let minTop = 12;
  let maxBottom = height - 12;
  if (scroller && scroller.classList.contains('sheet')) {
    const head = scroller.querySelector('.sheet-head');
    if (head) minTop = head.getBoundingClientRect().bottom - top + 8;
    const foot = scroller.querySelector('#templates-sheet .sheet-actions, #ai-sheet .sheet-actions');
    if (foot) maxBottom = Math.min(maxBottom, foot.getBoundingClientRect().top - top - 8);
  } else if (!scroller) {
    document.querySelectorAll('.live, .app-header').forEach(bar => {
      const b = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position !== 'static' && b.top <= 1) minTop = Math.max(minTop, b.bottom - top + 8);
    });
    if (!keyboardOpen) {
      // No keyboard (yet): stay above the tab bar and the rest timer
      document.querySelectorAll('.bottom-tab-bar, .rest-pill').forEach(bar => {
        const b = bar.getBoundingClientRect();
        if (b.height && getComputedStyle(bar).display !== 'none') maxBottom = Math.min(maxBottom, b.top - top - 8);
      });
    }
  }
  const r = el.getBoundingClientRect();
  const elTop = r.top - top;
  const elBottom = Math.min(r.bottom, r.top + 140) - top; // tall text boxes: keep their top part in view
  let delta = 0;
  if (elBottom > maxBottom) delta = elBottom - maxBottom;
  if (elTop - delta < minTop) delta = elTop - minTop;
  if (Math.abs(delta) < 2) return;
  (scroller || window).scrollBy({ top: delta, behavior: 'smooth' });
}

document.addEventListener('focusin', e => {
  if (!isTypingField(e.target)) return;
  const el = e.target;
  // Once now for hardware keyboards, again after the iPhone keyboard has slid up
  requestAnimationFrame(() => keepFieldInView(el));
  setTimeout(() => keepFieldInView(el), 400);
});

document.querySelectorAll('.sheet-overlay').forEach(overlay => {
  const sheet = overlay.querySelector('.sheet');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(overlay.id); });

  // Drag the sheet's header down to dismiss
  const head = sheet.querySelector('.sheet-head');
  let startY = null;
  let dy = 0;
  head.addEventListener('pointerdown', e => {
    startY = e.clientY;
    dy = 0;
    sheet.classList.add('dragging');
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY === null) return;
    startY = null;
    sheet.classList.remove('dragging');
    if (dy > Math.min(120, sheet.offsetHeight * 0.25)) closeSheet(overlay.id);
    else sheet.style.transform = '';
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && openSheets.length) closeSheet(openSheets[openSheets.length - 1].id);
});

/* Confirm and text-input dialogs, shown as a bottom sheet. Both return a Promise. */
let dialogResolve = null;

let dialogMatch = null;

function openDialog({ title, message = '', confirmLabel = 'OK', destructive = false, input = null, choices = null, grid = false }) {
  if (dialogResolve) dialogResolve(null);
  document.getElementById('dialog-title').textContent = title;
  const msg = document.getElementById('dialog-message');
  msg.textContent = message;
  msg.hidden = !message;
  const confirmBtn = document.getElementById('dialog-confirm-btn');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = `btn ${destructive ? 'btn-danger' : 'btn-primary'}`;
  const field = document.getElementById('dialog-input');
  field.hidden = !input;
  field.value = '';
  dialogMatch = input && input.match ? input.match : null;
  field.autocapitalize = dialogMatch ? 'characters' : 'sentences';
  field.placeholder = input ? input.placeholder || '' : '';
  field.classList.remove('invalid');
  const list = document.getElementById('dialog-choices');
  list.hidden = !choices;
  list.classList.toggle('grid', grid);
  confirmBtn.hidden = !!choices;
  list.innerHTML = '';
  (choices || []).forEach(choice => {
    const btn = document.createElement('button');
    btn.className = `choice ${choice.destructive ? 'destructive' : ''} ${choice.selected ? 'selected' : ''}`;
    btn.innerHTML = grid
      ? `<span>${escapeHtml(choice.label)}</span>${choice.tag ? `<span class="choice-tag">${escapeHtml(choice.tag)}</span>` : ''}`
      : `<span>${escapeHtml(choice.label)}</span>${choice.selected ? icon('check', 2.6) : ''}`;
    btn.addEventListener('click', () => {
      finishDialog(choice.value);
      closeSheet('dialog-sheet');
    });
    list.appendChild(btn);
  });
  const overlay = document.getElementById('dialog-sheet');
  overlay.onSheetClose = () => finishDialog(null);
  openSheet('dialog-sheet');
  if (input) setTimeout(() => field.focus(), 50);
  return new Promise(resolve => { dialogResolve = resolve; });
}

function finishDialog(value) {
  const resolve = dialogResolve;
  dialogResolve = null;
  if (resolve) resolve(value);
}

function submitDialog() {
  const field = document.getElementById('dialog-input');
  if (!field.hidden) {
    const value = field.value.trim();
    if (!value || (dialogMatch && value.toUpperCase() !== dialogMatch)) {
      fieldError(field);
      return;
    }
    finishDialog(dialogMatch ? value.toUpperCase() : value);
  } else {
    finishDialog(true);
  }
  closeSheet('dialog-sheet');
}

document.getElementById('dialog-confirm-btn').addEventListener('click', submitDialog);

document.getElementById('dialog-cancel-btn').addEventListener('click', () => closeSheet('dialog-sheet'));

document.getElementById('dialog-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitDialog(); });

function confirmSheet(title, message, confirmLabel = 'Confirm', destructive = false) {
  return openDialog({ title, message, confirmLabel, destructive }).then(v => v === true);
}

// Resolves to the chosen action's value, or null when dismissed
function actionSheet(title, message, choices, opts = {}) {
  return openDialog({ title, message, choices, ...opts });
}

/* Inline validation: shake the field, outline it red and show a short message under it */
// `after` is where the message goes when the field sits in a row (e.g. the bodyweight form).
function fieldError(el, message = '', after = el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake', 'invalid');
  haptic('error');
  const next = after.nextElementSibling;
  let note = next && next.classList.contains('field-error') ? next : null;
  if (message) {
    if (!note) {
      note = document.createElement('div');
      note.className = 'field-error';
      after.insertAdjacentElement('afterend', note);
    }
    note.textContent = message;
    note.hidden = false;
  }
  const clear = () => {
    el.classList.remove('invalid');
    if (note) note.hidden = true;
    el.removeEventListener('input', clear);
  };
  el.addEventListener('input', clear);
  el.focus();
}
