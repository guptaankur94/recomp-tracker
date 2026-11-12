/* Preferences set in Settings: sound, vibration, the rest timer, keeping the screen on, the backup reminder.
   One object in localStorage; anything missing takes its default, so older phones keep working as before. */
const PREFS_KEY = 'recomp_prefs';
const PREF_DEFAULTS = { sound: true, vibration: true, autoRest: true, defaultRest: 90, keepAwake: true, backupWeekly: true };

function pref(name) {
  const p = readJSON(PREFS_KEY, {});
  return p && Object.prototype.hasOwnProperty.call(p, name) ? p[name] : PREF_DEFAULTS[name];
}

function setPref(name, value) {
  const p = readJSON(PREFS_KEY, {}) || {};
  p[name] = value;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

function togglePref(name) {
  setPref(name, !pref(name));
  if (name === 'vibration' && pref('vibration')) haptic('success');
  if (name === 'sound' && pref('sound')) { unlockAudio(); playTick(); }
  if (name === 'keepAwake') syncWakeLock();
  if (name === 'backupWeekly') renderBackupBadge();
  renderSettings();
}

async function pickDefaultRest() {
  const current = pref('defaultRest');
  const choice = await actionSheet('Default rest', 'For exercises you add that have no rest of their own. Plan exercises keep theirs.',
    REST_CHOICES.map(sec => ({ label: fmtClock(sec), value: sec, selected: sec === current })), { grid: true });
  if (!choice) return;
  setPref('defaultRest', choice);
  haptic('light');
  renderSettings();
}
