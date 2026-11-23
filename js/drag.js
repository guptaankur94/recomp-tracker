/* Long-press an exercise and drag it to move it (today only, like Move… and Reorder): hold about half a second, it
   lifts with a buzz and follows your finger, the others slide aside, and it drops where you let go. Works on
   previews, Done rows, skipped rows and an open exercise's title; holding a set, a field or a button never starts
   it, so logging is untouched. Moving before the hold ends means you're scrolling: nothing happens. */
const LONG_PRESS_MS = 450;
let press = null; // { id, x, y, card, timer }
let drag = null;  // { card, cards, docTops, heights, from, to, y0, scroll0, lastY, step }
let suppressClickUntil = 0;

function dragCardFor(target) {
  if (!target || !target.closest) return null;
  const card = target.closest('#workout-content .ex-card');
  if (!card) return null;
  if (target.closest('input, textarea, .icon-btn, .set-swipe, .set-link, .wu-panel, .wu-line, .ex-complete, .ex-chips, .goal-panel, .ex-info, .add-set-btn, .ex-felt, .ex-note')) return null;
  const whole = card.classList.contains('preview') || card.classList.contains('collapsed') || card.classList.contains('skipped');
  return whole || target.closest('.ex-header') ? card : null;
}

function startDrag() {
  const card = press.card;
  const cards = [...document.querySelectorAll('#workout-content .ex-card')];
  const from = cards.indexOf(card);
  if (from === -1 || cards.length < 2) return;
  const rects = cards.map(c => c.getBoundingClientRect());
  const step = rects[1].top - rects[0].top - rects[0].height; // the gap between cards
  drag = { card, cards, docTops: rects.map(r => r.top + window.scrollY), heights: rects.map(r => r.height), from, to: from, y0: press.y, scroll0: window.scrollY, lastY: press.y, gap: step };
  document.body.classList.add('drag-active');
  card.classList.add('dragging');
  haptic('success');
  requestAnimationFrame(edgeScroll);
}

function moveDrag(y) {
  if (!drag) return;
  drag.lastY = y;
  const dy = y - drag.y0 + (window.scrollY - drag.scroll0);
  const { cards, docTops, heights, from, gap } = drag;
  drag.card.style.transform = `translateY(${dy}px) scale(1.02)`;
  // Where it would land: past the middle of each card it crosses
  const center = docTops[from] + heights[from] / 2 + dy;
  let to = 0;
  cards.forEach((c, i) => { if (i !== from && docTops[i] + heights[i] / 2 < center) to++; });
  if (to !== drag.to) { drag.to = to; haptic('light'); }
  const shift = heights[from] + gap;
  cards.forEach((c, i) => {
    if (i === from) return;
    const offset = from < to && i > from && i <= to ? -shift : to < from && i >= to && i < from ? shift : 0;
    c.style.transform = offset ? `translateY(${offset}px)` : '';
  });
}

// Near the top or bottom of the screen, the page scrolls so you can drag further
function edgeScroll() {
  if (!drag) return;
  const { top } = clearArea();
  const speed = drag.lastY < top + 40 ? -10 : drag.lastY > window.innerHeight - 130 ? 10 : 0;
  if (speed) {
    window.scrollBy(0, speed);
    moveDrag(drag.lastY);
  }
  requestAnimationFrame(edgeScroll);
}

function endDrag(cancelled) {
  const d = drag;
  drag = null;
  if (!d) return;
  const visualTop = d.card.getBoundingClientRect().top;
  d.cards.forEach(c => { c.style.transform = ''; });
  d.card.classList.remove('dragging');
  document.body.classList.remove('drag-active');
  suppressClickUntil = Date.now() + 500;
  if (cancelled || d.to === d.from) return;
  // The new order, from the cards as they sit now; a superset partner comes along
  const ids = d.cards.map(c => Number(c.id.replace('ex-card-', '')));
  const exIdx = ids[d.from];
  const before = todayBlocks();
  ids.splice(d.from, 1);
  ids.splice(d.to, 0, exIdx);
  const pair = supersetPartner(currentDayIdx, exIdx);
  if (pair) {
    ids.splice(ids.indexOf(pair.partner), 1);
    ids.splice(ids.indexOf(exIdx) + (pair.role === 1 ? 1 : 0), 0, pair.partner);
  }
  localStorage.setItem(todayOrderKey(currentDayIdx), JSON.stringify({ date: localDateStr(new Date()), order: ids }));
  haptic('success');
  tapAnchor = null;
  renderWorkout();
  // It lands where you let go
  const moved = document.getElementById(`ex-card-${exIdx}`);
  if (moved) window.scrollTo({ top: window.scrollY + moved.getBoundingClientRect().top - visualTop, behavior: 'instant' });
  const name = getAllExercisesForDay(currentDayIdx)[exIdx].name;
  showToast(`${name} moved, for today`, { actionLabel: 'Undo', onAction: () => { saveTodayBlocks(before); renderWorkout(); } });
}

(() => {
  const main = document.getElementById('workout-content');
  main.addEventListener('pointerdown', e => {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const card = dragCardFor(e.target);
    if (!card) return;
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, card };
    p.timer = setTimeout(() => { if (press === p) startDrag(); }, LONG_PRESS_MS);
    press = p;
  });
  document.addEventListener('pointermove', e => {
    if (drag) return moveDrag(e.clientY);
    // Moved before the hold ended: it's a scroll
    if (press && (Math.abs(e.clientX - press.x) > 10 || Math.abs(e.clientY - press.y) > 10)) {
      clearTimeout(press.timer);
      press = null;
    }
  });
  const release = cancelled => () => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag) endDrag(cancelled);
  };
  document.addEventListener('pointerup', release(false));
  document.addEventListener('pointercancel', release(true));
  // While dragging, the finger drags the card, not the page
  document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
  // The tap that ends a drag doesn't also open the card
  document.addEventListener('click', e => {
    if (Date.now() < suppressClickUntil && e.target.closest && e.target.closest('#workout-content .ex-card')) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  main.addEventListener('contextmenu', e => { if (dragCardFor(e.target)) e.preventDefault(); });
})();
