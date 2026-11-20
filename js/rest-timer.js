/* The rest timer: counts to an end time so it stays right in the background. */

/* Rest timer: counts to an end time, so it stays right while the phone is locked or the app is in the background */
const REST_TIMER_KEY = 'recomp_rest_timer';

/* The rest belongs to the set it follows. Before the set is ticked its rest is a plan; while its timer runs the set's
   rest control IS the timer (− / + and the timer's own +15 / −15 change the same thing); once the rest is over
   (ran out, skipped, or the next set was ticked) the rest actually taken is recorded on the set and locked.
   owner: { d, e, s } of that set (none for warm-up rests). */
let restTimer = null; // { startAt, endAt, total, next, owner }

let restTicker = null;

let lastTickSecond = null;

function startRestTimer(seconds, next = '', owner = null) {
  // A rest still running ends here: it lasted until now
  if (restTimer) closeRest(Math.round((Date.now() - restTimer.startAt) / 1000));
  const now = Date.now();
  restTimer = { startAt: now, endAt: now + seconds * 1000, total: seconds, next, owner };
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
  const live = document.getElementById('rest-live');
  if (live) live.textContent = fmtClock(sec);
  if (sec <= 3 && sec > 0 && sec !== lastTickSecond && !document.hidden) {
    lastTickSecond = sec;
    playTick();
    haptic('light');
  }
  if (ms <= 0) finishRestTimer();
}

// The rest's planned length so far (start to end, after any +/−)
function restLengthSec() {
  return restTimer ? Math.max(0, Math.round((restTimer.endAt - restTimer.startAt) / 1000)) : 0;
}

const restOwnerKey = (o, f) => `active_d${o.d}_e${o.e}_s${o.s}_${f}`;

// Is this set's rest the one running now?
function restIsLive(d, e, s) {
  const o = restTimer && restTimer.owner;
  return !!o && o.d === d && o.e === e && o.s === s;
}

// Record the rest taken on its set and lock it
function closeRest(seconds) {
  const o = restTimer && restTimer.owner;
  if (!o) return;
  localStorage.setItem(restOwnerKey(o, 'rest'), String(Math.max(0, seconds)));
  localStorage.setItem(restOwnerKey(o, 'restOver'), 'true');
  restTimer.owner = null;
  if (typeof refreshPrs === 'function') refreshPrs(o.d, o.e);
}

// Change the running rest: the timer, and the set's rest with it
function adjustRestTimer(delta) {
  if (!restTimer) return;
  restTimer.endAt = Math.max(Date.now(), restTimer.endAt + delta * 1000);
  restTimer.total = Math.max(1, restLengthSec());
  if (restTimer.owner) localStorage.setItem(restOwnerKey(restTimer.owner, 'rest'), String(restLengthSec()));
  localStorage.setItem(REST_TIMER_KEY, JSON.stringify(restTimer));
  haptic('light');
  if (restRemainingMs() <= 0) finishRestTimer();
  else {
    tickRestTimer();
    refreshRestControl();
  }
}

// Set the running rest to a length (from the time picker)
function setRestLength(seconds) {
  if (!restTimer) return;
  adjustRestTimer(seconds - restLengthSec());
}

// Skip: the rest lasted until now
function skipRestTimer() {
  if (!restTimer) return;
  closeRest(Math.round((Date.now() - restTimer.startAt) / 1000));
  stopRestTimer();
  refreshRestControl();
}

// The set's rest control on the Workout screen shows the new state
function refreshRestControl() {
  if (!document.getElementById('view-workout').hidden && !pad) renderWorkout();
}

function finishRestTimer() {
  const wasVisible = !document.hidden;
  closeRest(restLengthSec());
  stopRestTimer(true);
  refreshRestControl();
  if (!wasVisible) return;
  playChime();
  haptic('success');
  if (navigator.vibrate && pref('vibration')) navigator.vibrate([200, 100, 200]);
  showToast('Rest over. Time for your next set.', { type: 'info' });
  // The next set to do glows, ready to tick
  const next = document.querySelector('#workout-content .check-btn.next');
  if (next && !document.getElementById('view-workout').hidden) {
    next.classList.remove('ready-pulse');
    void next.offsetWidth;
    next.classList.add('ready-pulse');
  }
}

function stopRestTimer() {
  // Stopped some other way (Finish, a new timer): the rest lasted until now
  if (restTimer && restTimer.owner) closeRest(Math.min(restLengthSec(), Math.round((Date.now() - restTimer.startAt) / 1000)));
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
  if (saved && saved.owner && saved.endAt <= Date.now()) {
    // Ran out while the app was closed: the full rest was taken
    restTimer = saved;
    closeRest(restLengthSec());
    restTimer = null;
  }
  if (saved && saved.endAt > Date.now()) {
    if (!saved.startAt) saved.startAt = saved.endAt - saved.total * 1000;
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
    if (restRemainingMs() <= 0) { // ran out while away; the phone already showed nothing, so stay quiet
      closeRest(restLengthSec());
      stopRestTimer();
      refreshRestControl();
    }
    else tickRestTimer();
  }
  syncWakeLock();
  updateSessionBar();
});
