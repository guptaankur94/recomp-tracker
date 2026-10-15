/* Starts the app, home-screen shortcuts, update checks and offline support. */

// Init App
requestAnimationFrame(() => moveNavIndicator(false));

migrateExistingUserPlan();

initTips();

loadActivePlan();

currentDayIdx = initialDayIdx();

initNav();

renderWorkout();

scrollActiveTab();

restoreRestTimer();

updateStats();

renderBackupBadge();

// Home-screen shortcuts: ?action=log-weight opens the weight log, ?view=plan|history|progress|settings a tab
(() => {
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  if (params.get('action') === 'log-weight') {
    switchView('progress');
    setTimeout(() => document.getElementById('bw-input').focus(), 300);
  } else if (['plan', 'history', 'progress', 'settings'].includes(view)) {
    switchView(view);
  }
})();

setInterval(() => { if (currentView === 'workout') updateHeader(); }, 60000);

updateHeader();

if (needsOnboarding()) openOnboarding();

/* Updates. A Home Screen app is usually resumed rather than relaunched, so besides the service
   worker's check on launch, the app asks for the latest page whenever it comes back to the front.
   A newer version is stored for offline use straight away and offered with Reload. */
let lastUpdateCheck = 0;

async function checkForUpdate(manual = false) {
  if (!location.protocol.startsWith('http')) return;
  if (!manual && Date.now() - lastUpdateCheck < 10 * 60 * 1000) return;
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch('./index.html', { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/const APP_VERSION = '([^']+)'/);
    if (!res.ok || !m) throw new Error('bad response');
    if (m[1] === APP_VERSION) {
      if (manual) showToast(`You're up to date · version ${APP_VERSION}`);
      return;
    }
    // The app is several files: the service worker fetches all of them, then says the update is ready
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: 'refresh' });
    else showToast(`Update ready · version ${m[1]}`, { type: 'info', actionLabel: 'Reload', onAction: () => location.reload(), duration: 0 });
  } catch (e) {
    if (manual) showToast("Couldn't check for updates. Are you online?", { type: 'error' });
  }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  // The app opens from cache; the service worker says when a newer version has been downloaded.
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'update-available') {
      showToast('Update ready', { type: 'info', actionLabel: 'Reload', onAction: () => location.reload(), duration: 0 });
    }
  });
}
