/* The rest timer: counts to an end time so it stays right in the background. */

/* Rest timer: counts to an end time, so it stays right while the phone is locked or the app is in the background */
const REST_TIMER_KEY = 'recomp_rest_timer';

let restTimer = null; // { endAt, total, next }

let restTicker = null;

let lastTickSecond = null;

function startRestTimer(seconds, next = '') {
  restTimer = { endAt: Date.now() + seconds * 1000, total: seconds, next };
  localStorage.setItem(REST_TIMER_KEY, JSON.stringify(restTimer));
  lastTickSecond = null;
  document.getElementById('rest-pill').hidden = false;
  document.body.classList.add('resting');
  clearInterval(restTicker);
  restTicker = setInterval(tickRestTimer, 250);
  tickRestTimer();
  syncWakeLock();
}

function restRemainingMs() {
  return restTimer ? Math.max(0, restTimer.endAt - Date.now()) : 0;
}

function setRing(el, fraction) {
  const c = parseFloat(el.getAttribute('data-c'));
  el.style.strokeDashoffset = String(c * (1 - Math.max(0, Math.min(1, fraction))));
}

function tickRestTimer() {
  if (!restTimer) return;
  const ms = restRemainingMs();
  const sec = Math.ceil(ms / 1000);
  const fraction = ms / (restTimer.total * 1000);
  document.getElementById('rest-time').textContent = fmtClock(sec);
  document.getElementById('rest-time-full').textContent = fmtClock(sec);
  document.getElementById('rest-next').textContent = restTimer.next;
  document.getElementById('rest-next-full').textContent = restTimer.next;
  document.querySelectorAll('#rest-pill .rest-ring-fg, #rest-full .rest-ring-fg').forEach(el => setRing(el, fraction));
  document.getElementById('rest-pill').classList.toggle('ending', sec <= 3);
  if (sec <= 3 && sec > 0 && sec !== lastTickSecond && !document.hidden) {
    lastTickSecond = sec;
    playTick();
  }
  if (ms <= 0) finishRestTimer();
}

function adjustRestTimer(delta) {
  if (!restTimer) return;
  restTimer.endAt += delta * 1000;
  const remaining = restRemainingMs() / 1000;
  restTimer.total = Math.max(restTimer.total, remaining);
  localStorage.setItem(REST_TIMER_KEY, JSON.stringify(restTimer));
  haptic('light');
  if (remaining <= 0) finishRestTimer();
  else tickRestTimer();
}

function finishRestTimer() {
  const wasVisible = !document.hidden;
  stopRestTimer(true);
  if (!wasVisible) return;
  playChime();
  haptic('success');
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  showToast('Rest over. Time for your next set.', { type: 'info' });
}

function stopRestTimer() {
  clearInterval(restTicker);
  restTicker = null;
  restTimer = null;
  localStorage.removeItem(REST_TIMER_KEY);
  document.getElementById('rest-pill').hidden = true;
  document.body.classList.remove('resting');
  collapseRestTimer();
  syncWakeLock();
}

function expandRestTimer() {
  if (!restTimer) return;
  const full = document.getElementById('rest-full');
  full.hidden = false;
  void full.offsetWidth;
  full.classList.add('open');
  haptic('light');
}

function collapseRestTimer() {
  const full = document.getElementById('rest-full');
  full.classList.remove('open');
  setTimeout(() => { if (!full.classList.contains('open')) full.hidden = true; }, 250);
}

// Pick a running timer back up after the app was closed; a timer that ran out meanwhile is dropped quietly.
function restoreRestTimer() {
  const saved = readJSON(REST_TIMER_KEY, null);
  if (saved && saved.endAt > Date.now()) {
    restTimer = saved;
    document.getElementById('rest-pill').hidden = false;
    document.body.classList.add('resting');
    restTicker = setInterval(tickRestTimer, 250);
    tickRestTimer();
  } else {
    localStorage.removeItem(REST_TIMER_KEY);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (restTimer) {
    if (restRemainingMs() <= 0) stopRestTimer(); // ran out while away; the phone already showed nothing, so stay quiet
    else tickRestTimer();
  }
  syncWakeLock();
  updateSessionBar();
});
