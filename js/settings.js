/* The Settings screen. */

/* Settings: an iOS-style grouped list; each row opens its own sheet */
function settingsRow({ iconName, color, title, sub = '', value = '', onclick, danger = false, warn = false, label }) {
  return `
    <button class="row ${danger ? 'danger' : ''}" onclick="${onclick}" ${label ? `aria-label="${escapeHtml(label)}"` : ''}>
      <span class="row-icon" style="background:${color}">${iconName}</span>
      <span class="row-main">
        <span class="row-title">${title}</span>
        ${sub ? `<span class="row-sub ${warn ? 'warn' : ''}">${sub}</span>` : ''}
      </span>
      ${value ? `<span class="row-value">${value}</span>` : ''}
      ${danger ? '' : `<span class="chevron">${icon('chevron')}</span>`}
    </button>`;
}

// An on/off row: a real switch (role="switch"), so its state is clear to see and to VoiceOver
function switchRow({ iconName, color, title, sub = '', on, onclick }) {
  return `
    <button class="row switch-row" role="switch" aria-checked="${on}" onclick="${onclick}">
      <span class="row-icon" style="background:${color}">${iconName}</span>
      <span class="row-main">
        <span class="row-title">${title}</span>
        ${sub ? `<span class="row-sub">${sub}</span>` : ''}
      </span>
      <span class="switch ${on ? 'on' : ''}" aria-hidden="true"><span></span></span>
    </button>`;
}

const ROW_ICONS = {
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 6.5h11M8 12h11M8 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 3.5l1.6 4.4L17 9.5l-4.4 1.6L11 15.5 9.4 11.1 5 9.5l4.4-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.3-3.8-7.6-8.5-7.6z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15" cy="7.8" r="1.2" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  vibrate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 9v6M19.5 9v6"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>'
};

function renderSettings() {
  const profile = getProfile();
  const goal = getGoalKg();
  const name = profile && profile.name ? profile.name : '';
  const t = profile && nutritionTargets(profile);
  const totalEx = programData.reduce((n, d) => n + d.exercises.length, 0);
  const age = backupAgeDays();
  const overdue = backupOverdue();
  const backupSub = age === null ? (getHistory().length ? 'Never backed up' : 'Nothing to back up yet')
    : age === 0 ? 'Last backup today' : `Last backup ${age} day${age === 1 ? '' : 's'} ago`;

  document.getElementById('settings-list').innerHTML = `
    <div class="group">
      <button class="row profile-row" onclick="openProfileSheet()">
        <span class="profile-avatar">${name ? escapeHtml(name[0].toUpperCase()) : document.getElementById('header-avatar').innerHTML}</span>
        <span class="row-main">
          <span class="row-title">${name ? escapeHtml(name) : 'Set up your profile'}</span>
          <span class="row-sub">${profile ? [goal ? `Goal ${fmtNum(goal)} kg` : '', (GOAL_TYPES[profile.goalType] || GOAL_TYPES.recomp).label].filter(Boolean).join(' · ') : 'Goal, body stats and nutrition targets'}</span>
        </span>
        <span class="chevron">${icon('chevron')}</span>
      </button>
    </div>

    <div class="group-label">Daily targets</div>
    ${t ? `
      <div class="group targets-group" onclick="openProfileSheet()" role="button" aria-label="Daily nutrition targets">
        <div class="targets-grid">
          <div class="target-tile"><div class="target-val">${t.calories.toLocaleString('en-US')}</div><div class="target-lbl">kcal</div></div>
          <div class="target-tile"><div class="target-val">${t.protein} g</div><div class="target-lbl">Protein</div></div>
          <div class="target-tile"><div class="target-val">${t.fat} g</div><div class="target-lbl">Fat</div></div>
          <div class="target-tile"><div class="target-val">${t.carbs} g</div><div class="target-lbl">Carbs</div></div>
        </div>
      </div>` : `
      <div class="group">${settingsRow({ iconName: icon('info', 2.6), color: '#636366', title: 'See your calorie and protein targets', sub: 'Add sex, birth date, height and weight', onclick: 'openProfileSheet()' })}</div>`}

    <div class="group-label">Training</div>
    <div class="group">
      ${settingsRow({ iconName: ROW_ICONS.plan, color: '#3987e5', title: 'Workout plan', sub: `${escapeHtml(getPlanName())} · ${programData.length} days · ${totalEx} exercises`, onclick: "switchView('plan')" })}
    </div>

    <div class="group-label">During a workout</div>
    <div class="group">
      ${switchRow({ iconName: icon('clock', 2.2), color: '#0a84ff', title: 'Start rest timer after each set', sub: 'Off: time your rest yourself', on: pref('autoRest'), onclick: "togglePref('autoRest')" })}
      ${settingsRow({ iconName: icon('clock', 2.2), color: '#5e5ce6', title: 'Default rest', sub: 'For exercises you add that have none', value: fmtClock(pref('defaultRest')), onclick: 'pickDefaultRest()' })}
      ${switchRow({ iconName: ROW_ICONS.sound, color: '#ff375f', title: 'Sounds', sub: 'Rest countdown, rest over, records', on: pref('sound'), onclick: "togglePref('sound')" })}
      ${switchRow({ iconName: ROW_ICONS.vibrate, color: '#ff9f0a', title: 'Vibration', sub: 'Taps, the 3-2-1 countdown and rest over', on: pref('vibration'), onclick: "togglePref('vibration')" })}
      ${switchRow({ iconName: ROW_ICONS.screen, color: '#30b0c7', title: 'Keep screen on', sub: 'While a workout is running', on: pref('keepAwake'), onclick: "togglePref('keepAwake')" })}
    </div>

    <div class="group-label">Smart</div>
    <div class="group">
      ${switchRow({ iconName: ROW_ICONS.ai, color: '#c47a1f', title: 'Smart suggestions', sub: 'Learns your habits on this phone and offers changes you can undo', on: smartOn(), onclick: 'toggleSmart()' })}
    </div>

    <div class="group-label">Appearance</div>
    <div class="group">
      ${settingsRow({ iconName: ROW_ICONS.theme, color: '#9085e9', title: 'Theme', sub: themeName(), onclick: 'openThemeSheet()' })}
    </div>

    <div class="group">
      ${settingsRow({ iconName: icon('infoCircle', 2.2), color: '#0a84ff', title: 'How Recomp works', sub: 'A quick guide to every feature', onclick: 'openGuide()' })}
    </div>

    <div class="group-label">Data</div>
    <div class="group">
      ${settingsRow({ iconName: ROW_ICONS.backup, color: '#199e70', title: 'Back up now', sub: backupSub, warn: overdue, onclick: 'exportData()' })}
      ${settingsRow({ iconName: ROW_ICONS.more, color: '#636366', title: 'More backup options', sub: 'Copy as text, import or restore', onclick: "openSheet('backup-sheet')" })}
      ${switchRow({ iconName: ROW_ICONS.backup, color: '#199e70', title: 'Weekly backup reminder', sub: 'On the home card when a week has passed', on: pref('backupWeekly'), onclick: "togglePref('backupWeekly')" })}
    </div>

    <div class="group-label">Danger zone</div>
    <div class="group">
      ${settingsRow({ iconName: ROW_ICONS.reset, color: 'var(--danger)', title: 'Reset all data', danger: true, onclick: 'clearAllData()' })}
    </div>

    <div class="group-label">App</div>
    <div class="group">
      ${settingsRow({ iconName: ROW_ICONS.backup, color: '#636366', title: 'Check for updates', sub: `Version ${APP_VERSION}`, onclick: 'checkForUpdate(true)' })}
    </div>

    <div class="settings-foot">Recomp keeps everything on this phone. Nothing is uploaded.<br>Version ${APP_VERSION}</div>`;
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    chartAnimate = false;
    if (!document.getElementById('view-progress').hidden) renderProgress();
  }, 200);
});
