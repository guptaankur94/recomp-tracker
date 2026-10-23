/* Backups: export, import, restore and reminders. */

/* Backup: export / import */
function buildBackupJson() {
  return JSON.stringify({
    app: 'recomp-tracker',
    version: 2,
    exportedAt: new Date().toISOString(),
    history: getHistory(),
    bodyweight: getBodyweight(),
    profile: getProfile(),
    plan: getCustomPlan(),
    warmups: getWarmups()
  }, null, 2);
}

async function exportData() {
  const json = buildBackupJson();
  const fileName = `recomp_backup_${localDateStr(new Date())}.json`;

  // On iPhone the share sheet ("Save to Files") is the only way a Home Screen app can save a file.
  // Some iOS versions refuse JSON files, so plain text is tried as well.
  if (navigator.canShare) {
    for (const type of ['application/json', 'text/plain']) {
      const file = new File([json], fileName, { type });
      if (!navigator.canShare({ files: [file] })) continue;
      try {
        await navigator.share({ files: [file], title: 'Recomp backup' });
        markBackedUp();
        showToast('Backup saved');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
  }

  // Home Screen apps on iPhone can't download files, so show the text to copy instead.
  if (navigator.standalone) {
    openTextModal({ title: 'Your Backup', help: 'Tap Select All, then Copy, and paste it into a note in the Notes app.', text: json, readOnly: true });
    markBackedUp();
    return;
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = fileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markBackedUp();
  showToast('Backup downloaded');
}

function copyBackup() {
  markBackedUp();
  copyText(buildBackupJson(),
    `Backup copied (${getHistory().length} workouts). Paste it into a note in Notes.`,
    'Your Backup');
}

function openBackupModal() {
  openTextModal({
    title: 'Paste Backup',
    help: 'Paste the backup text you saved (for example from Notes), then tap Restore.',
    submitLabel: 'Restore',
    onSubmit: restoreBackupText
  });
}

function closeBackupModal() {
  closeSheet('backup-modal');
}

function selectBackupText() {
  const text = document.getElementById('backup-text');
  text.focus();
  text.setSelectionRange(0, text.value.length);
}

function importData(inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => restoreBackupText(reader.result);
  reader.readAsText(file);
}

// Errors about pasted text show under the text box when the text sheet is open, otherwise as a toast.
function reportTextError(message) {
  const note = document.getElementById('backup-error');
  if (openSheets.includes(document.getElementById('backup-modal'))) {
    note.textContent = message;
    note.hidden = false;
    fieldError(document.getElementById('backup-text'));
  } else {
    haptic('error');
    showToast(message, { type: 'error', duration: 6000 });
  }
}

// Returns true when the text was a valid backup and was merged in.
function restoreBackupText(text) {
  let data;
  try {
    data = JSON.parse(String(text).trim());
  } catch (e) {
    reportTextError("That isn't a valid backup. Make sure you copied the whole text, from the first { or [ to the last } or ].");
    return false;
  }

  // Old backups are a plain array of sessions; new ones are { history, bodyweight }.
  const importedHistory = Array.isArray(data) ? data : (data && Array.isArray(data.history) ? data.history : null);
  const importedBw = data && Array.isArray(data.bodyweight) ? data.bodyweight : [];
  if (!importedHistory) {
    reportTextError("This doesn't look like a Recomp backup.");
    return false;
  }

  // Merge: entries already on this phone are kept, so importing the same backup twice is harmless.
  const history = getHistory();
  const knownIds = new Set(history.map(s => s.id));
  let added = 0;
  importedHistory
    .filter(s => s && typeof s.id === 'number' && Array.isArray(s.exercises) && !knownIds.has(s.id))
    .forEach(s => {
      history.push({
        ...s,
        dateStr: s.dateStr || localDateStr(new Date(s.id)),
        displayDate: s.displayDate || new Date(s.id).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        day: s.day || 'Day ?',
        title: s.title || 'Workout'
      });
      knownIds.add(s.id);
      added++;
    });

  const bw = getBodyweight();
  const knownDates = new Set(bw.map(e => e.dateStr));
  let addedBw = 0;
  importedBw
    .filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.dateStr) && typeof e.kg === 'number' && !knownDates.has(e.dateStr))
    .forEach(e => {
      bw.push({ dateStr: e.dateStr, kg: e.kg });
      knownDates.add(e.dateStr);
      addedBw++;
    });

  // Profile and plan are restored only when this phone doesn't have its own yet.
  const extras = [];
  if (data && data.profile && typeof data.profile === 'object' && !getProfile()) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
    extras.push('profile');
  }
  if (data && data.plan && !getCustomPlan() && !anyUnsavedSets()) {
    try {
      const plan = normalizePlan(data.plan);
      // Keep which ready-made plan it came from, so Plan → Starter plans still marks it as in use
      if (TEMPLATES.some(t => t.id === data.plan.templateId)) plan.templateId = data.plan.templateId;
      localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
      loadActivePlan();
      extras.push('workout plan');
    } catch (e) {}
  }

  // Your own warm-ups: added for exercises that don't have one here
  if (data && data.warmups && typeof data.warmups === 'object' && !Array.isArray(data.warmups)) {
    const map = getWarmups();
    let addedWu = 0;
    Object.entries(data.warmups).forEach(([name, list]) => {
      if (Object.prototype.hasOwnProperty.call(map, name) || !Array.isArray(list)) return;
      map[name] = list.filter(w => w && w.reps > 0).map(w => (w.kg > 0 ? { kg: Number(w.kg), reps: Number(w.reps) } : { reps: Number(w.reps) }));
      addedWu++;
    });
    if (addedWu) {
      localStorage.setItem(WARMUPS_KEY, JSON.stringify(map));
      extras.push('warm-ups');
    }
  }

  saveHistory(history.sort((a, b) => b.id - a.id));
  saveBodyweight(bw);
  initNav();
  renderWorkout();
  updateHeader();
  if (!document.getElementById('view-settings').hidden) renderSettings();
  haptic('success');
  showToast(`Backup restored: ${added} workout${added === 1 ? '' : 's'} and ${addedBw} weight entr${addedBw === 1 ? 'y' : 'ies'} added` +
    (extras.length ? `, plus your ${extras.join(' and ')}` : '') + '.' +
    (importedHistory.length - added > 0 ? ` ${importedHistory.length - added} already here.` : ''), { duration: 5000 });
  return true;
}

// Type RESET to confirm; nothing else on this screen can delete everything.
async function clearAllData() {
  const count = getHistory().length;
  const value = await openDialog({
    title: 'Reset all data?',
    message: `This permanently deletes ${count} workout${count === 1 ? '' : 's'}, every weight entry, your profile and your custom plan from this phone.${count ? ' Back up first if you want to keep them.' : ''}\n\nType RESET to confirm.`,
    confirmLabel: 'Delete Everything',
    destructive: true,
    input: { placeholder: 'Type RESET', match: 'RESET' }
  });
  if (value !== 'RESET') return;
  localStorage.clear();
  closeSheet('backup-sheet');
  loadActivePlan();
  currentDayIdx = 0;
  initNav();
  updateHeader();
  updateStats();
  renderCalendarAndHistory();
  renderWorkout();
  renderSettings();
  renderBackupBadge();
  if (needsOnboarding()) openOnboarding();
  else showToast('All local data has been reset', { type: 'info' });
}

/* Generic text modal (show text to copy, or paste text in) */
let textModalSubmit = null;

function openTextModal({ title, help, text = '', readOnly = false, submitLabel = 'Restore', onSubmit = null }) {
  const textEl = document.getElementById('backup-text');
  document.getElementById('backup-modal-title').innerText = title;
  document.getElementById('backup-modal-help').innerText = help;
  textEl.value = text;
  textEl.readOnly = readOnly;
  textModalSubmit = onSubmit;
  document.getElementById('backup-select-btn').hidden = !readOnly;
  document.getElementById('backup-error').hidden = true;
  textEl.classList.remove('invalid');
  const submitBtn = document.getElementById('backup-restore-btn');
  submitBtn.hidden = !onSubmit;
  submitBtn.innerText = submitLabel;
  openSheet('backup-modal');
}

async function submitTextModal() {
  if (textModalSubmit && await textModalSubmit(document.getElementById('backup-text').value)) closeBackupModal();
}

async function copyText(text, successMsg, fallbackTitle) {
  try {
    await navigator.clipboard.writeText(text);
    haptic('success');
    showToast(successMsg, { duration: 4000 });
    return true;
  } catch (e) {
    openTextModal({ title: fallbackTitle, help: 'Tap Select All, then Copy.', text, readOnly: true });
    return false;
  }
}

/* Backups: remember when the last one was made and nudge after two weeks */
const LAST_BACKUP_KEY = 'recomp_last_backup';

const BACKUP_NUDGE_DAYS = 14;

function markBackedUp() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  renderBackupBadge();
  if (!document.getElementById('view-settings').hidden) renderSettings();
}

function backupAgeDays() {
  const t = parseInt(localStorage.getItem(LAST_BACKUP_KEY), 10);
  return t > 0 ? Math.floor((Date.now() - t) / 864e5) : null;
}

function backupOverdue() {
  if (getHistory().length < 3) return false;
  const age = backupAgeDays();
  return age === null || age >= BACKUP_NUDGE_DAYS;
}

function renderBackupBadge() {
  document.getElementById('tab-nav-settings').classList.toggle('badged', backupOverdue());
}
