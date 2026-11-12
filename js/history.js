/* History: calendar, session details, deleting sessions. */

/* One colour per program day (validated categorical slots for the dark surface); a legend names them. */
const DAY_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];

function dayColor(dayLabel) {
  const m = String(dayLabel).match(/(\d+)/);
  return m ? DAY_COLORS[(parseInt(m[1], 10) - 1) % DAY_COLORS.length] : 'var(--text-2)';
}

function fmtVolume(kg) {
  return kg >= 10000 ? `${fmtNum(kg / 1000)} t` : `${fmtNum(Math.round(kg))} kg`;
}

function fmtDuration(sec) {
  const min = Math.max(1, Math.round(sec / 60));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

function sessionStats(session) {
  let sets = 0;
  let volume = 0;
  session.exercises.forEach(e => e.sets.forEach(s => {
    sets++;
    volume += setVolume(s);
  }));
  return { sets, volume, prs: sessionPrs(session).length, durationSec: session.durationSec || 0 };
}

function previousSameDay(session) {
  return getHistory().find(s => s.day === session.day && s.id < session.id) || null;
}

/* Search: by exercise (showing that exercise's sets in each workout), workout name or day */
let historyQuery = '';

function searchHistory(value) {
  historyQuery = value;
  renderCalendarAndHistory();
}

function historySearchHtml(history, query) {
  const rows = [];
  history.forEach(s => {
    const exs = s.exercises.filter(e => e.name.toLowerCase().includes(query));
    const named = `${s.day} ${s.title}`.toLowerCase().includes(query) || sessionCardio(s).some(c => cardioType(c.type).label.toLowerCase().includes(query));
    if (!exs.length && !named) return;
    const lines = exs.map(e => {
      const best = e.sets.reduce((a, b) => (Number(b.weight) > Number(a.weight) || (Number(b.weight) === Number(a.weight) && Number(b.reps) > Number(a.reps))) ? b : a);
      return `<div class="hs-line"><b>${escapeHtml(e.name)}</b> · ${e.sets.length} × · best ${Number(best.weight) > 0 ? `${fmtNum(Number(best.weight))} kg` : 'BW'} × ${best.reps}${e.sets.some(x => x.pr) ? ' <span class="pr-badge">PR</span>' : ''}</div>`;
    }).join('');
    rows.push(`
      <div class="history-card" onclick="openSessionModal(${s.id})">
        <span class="day-dots">${sessionDayLabels(s).map(d => `<span class="day-dot" style="background:${dayColor(d)}"></span>`).join('')}</span>
        <div class="history-main">
          <div class="history-info-title">${escapeHtml(s.day)} · ${escapeHtml(s.title)}</div>
          <div class="history-info-date">${new Date(s.id).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          ${lines}
        </div>
        <span class="chevron">${icon('chevron')}</span>
      </div>`);
  });
  return `
    <div class="week-head"><span>${rows.length} workout${rows.length === 1 ? '' : 's'} with “${escapeHtml(historyQuery.trim())}”</span></div>
    ${rows.length ? `<div class="history-group">${rows.join('')}</div>` : '<div class="empty-card"><div class="empty-text">Nothing found. Try part of an exercise name, like “bench” or “curl”.</div></div>'}`;
}

/* Repeat a workout: its plan day when one has all its exercises, else a one-off workout with the same ones */
function repeatWorkout(sessionId) {
  const s = getHistory().find(x => x.id === sessionId);
  if (!s || !s.exercises.length) return;
  const names = s.exercises.map(e => e.name);
  const has = (d, n) => d.exercises.some(e => e.name === n || (e.alt && e.alt.name === n));
  const dayIdx = programData.findIndex(d => names.every(n => has(d, n)));
  closeModal();
  if (dayIdx !== -1) {
    selectDay(dayIdx);
    switchView('workout');
    showToast(`${programData[dayIdx].day} ready. Hints show your last numbers.`);
    return;
  }
  const custom = programData.length;
  if (dayHasDraft(custom)) {
    selectDay(custom);
    switchView('workout');
    showToast('Finish or clear your one-off workout first', { type: 'error' });
    return;
  }
  const exercises = s.exercises.map(e => {
    let base = null;
    programData.some(d => d.exercises.some(x => {
      if (x.name === e.name) base = x;
      else if (x.alt && x.alt.name === e.name) base = x.alt;
      return base;
    }));
    if (!base && LIBRARY.get(e.name)) base = libExercise(e.name);
    const top = Math.max(...e.sets.map(x => Number(x.reps) || 0));
    const ex = { name: e.name, repTarget: base ? base.repTarget : `${top} reps`, weightTarget: base ? base.weightTarget : 'Moderate', rest: base ? base.rest : (avgRest(e.sets) || pref('defaultRest')), sets: e.sets.length, isCustom: true };
    if (base && base.cue) ex.cue = base.cue;
    return ex;
  });
  localStorage.setItem(`custom_ex_d${custom}`, JSON.stringify(exercises));
  selectDay(custom);
  switchView('workout');
  showToast(`${exercises.length} exercises ready as a one-off workout`);
}

function renderCalendarAndHistory() {
  const history = getHistory();
  const now = new Date();
  const shown = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const todayStr = localDateStr(now);

  const dateMap = {};
  history.forEach(h => {
    const key = sessionDateStr(h);
    (dateMap[key] = dateMap[key] || []).push(h);
  });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const monthCount = history.filter(h => sessionDateStr(h).startsWith(monthPrefix)).length;
  document.getElementById('calendar-month-title').innerHTML =
    `${shown.toLocaleString('en-US', { month: 'long' })} ${year}<span class="cal-month-sub">${monthCount ? `${monthCount} workout${monthCount === 1 ? '' : 's'}` : 'No workouts'}</span>`;

  // Monday-first, matching how week streaks are counted
  let calHtml = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="cal-day-head">${d}</div>`).join('');
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) calHtml += '<div></div>';
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${monthPrefix}${String(d).padStart(2, '0')}`;
    const sessions = dateMap[dStr];
    const label = sessions ? `${d}: ${sessions.map(s => `${s.day} ${s.title}`).join(', ')}` : '';
    calHtml += `
      <div class="cal-date ${sessions ? 'active-logged' : ''} ${dStr === todayStr ? 'today' : ''}" ${sessions ? `onclick="openDateSessions('${dStr}')" role="button" aria-label="${escapeHtml(label)}"` : ''}>
        <span>${d}</span>
        ${sessions ? `<span class="cal-dots">${sessions.flatMap(sessionDayLabels).slice(0, 3).map(d => `<i style="background:${dayColor(d)}"></i>`).join('')}</span>` : ''}
      </div>`;
  }
  document.getElementById('calendar-grid').innerHTML = calHtml;
  document.getElementById('cal-legend').innerHTML = programData.map(d =>
    `<span class="cal-legend-item"><i style="background:${dayColor(d.day)}"></i>${escapeHtml(d.day.replace('Day ', 'D'))} ${escapeHtml(shortDayTitle(d.title))}</span>`
  ).join('');

  // Session list, grouped by week (Monday to Sunday), newest first
  const container = document.getElementById('history-list-container');
  if (!history.length) {
    container.innerHTML = `
      <div class="empty-card">
        <div class="empty-title">Your workouts will appear here</div>
        <div class="empty-text">When you finish a workout it lands on the calendar with its sets, volume, duration and personal records.</div>
        <button class="btn btn-primary btn-sm" onclick="switchView('workout')">Go to Today's Workout</button>
      </div>`;
    return;
  }
  const query = historyQuery.trim().toLowerCase();
  if (query) {
    container.innerHTML = historySearchHtml(history, query);
    return;
  }
  const thisWeek = startOfWeek(now).getTime();
  const lastWeek = startOfWeek(new Date(now.getTime() - 7 * 864e5)).getTime();
  const groups = [];
  history.forEach(s => {
    const key = startOfWeek(new Date(s.id)).getTime();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push(g = { key, sessions: [] });
    g.sessions.push(s);
  });
  container.innerHTML = groups.map(g => {
    const end = new Date(g.key + 6 * 864e5);
    const label = g.key === thisWeek ? 'This week' : g.key === lastWeek ? 'Last week' : `${shortDate(g.key)} – ${shortDate(end.getTime())}`;
    const volume = g.sessions.reduce((v, s) => v + sessionStats(s).volume, 0);
    const kcal = g.sessions.reduce((n, s) => n + (s.calories || 0), 0);
    return `
      <div class="week-head">
        <span>${label}</span>
        <span class="week-meta">${g.sessions.length} workout${g.sessions.length === 1 ? '' : 's'} · ${fmtVolume(volume)}${kcal ? ` · ${fmtNum(kcal)} kcal` : ''}</span>
      </div>
      <div class="history-group">
        ${g.sessions.map(item => {
          const st = sessionStats(item);
          const meta = [
            new Date(item.id).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            st.durationSec ? fmtDuration(st.durationSec) : '',
            st.sets ? `${st.sets} set${st.sets === 1 ? '' : 's'}` : '',
            sessionCardio(item).length ? `${cardioMinutes(sessionCardio(item))} min cardio` : '',
            st.volume ? fmtVolume(st.volume) : '',
            item.calories ? `${fmtNum(item.calories)} kcal` : '',
            effortLabel(item.effort)
          ].filter(Boolean).join(' · ');
          return `
            <div class="history-card" onclick="openSessionModal(${item.id})">
              <span class="day-dots">${sessionDayLabels(item).map(d => `<span class="day-dot" style="background:${dayColor(d)}"></span>`).join('')}</span>
              <div class="history-main">
                <div class="history-info-title">${escapeHtml(item.day)} · ${escapeHtml(item.title)}</div>
                <div class="history-info-date">${meta}</div>
              </div>
              ${st.prs ? `<span class="pr-badge">${st.prs} PR</span>` : ''}
              <span class="chevron">${icon('chevron')}</span>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

// Swipe the calendar left/right to change month
(() => {
  const grid = document.getElementById('calendar-grid');
  let start = null;
  grid.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
  grid.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      haptic('light');
      shiftCalendarMonth(dx < 0 ? 1 : -1);
    }
  });
  grid.addEventListener('pointercancel', () => { start = null; });
})();

function openDateSessions(dStr) {
  const sessions = getHistory().filter(s => sessionDateStr(s) === dStr).reverse();
  if (sessions.length) openSessionsModal(sessions);
}

function openSessionModal(sessionId) {
  const session = getHistory().find(s => s.id === sessionId);
  if (session) openSessionsModal([session]);
}

function cardioDetailHtml(session, when) {
  const list = sessionCardio(session).filter(c => c.when === when);
  return list.length ? `<div class="detail-cardio"><div class="detail-cardio-head">Cardio ${when} lifting</div>${list.map(c => `<div class="detail-cardio-row">${cardioLine(c, { when: false })}</div>`).join('')}</div>` : '';
}

function sessionDetailHtml(session) {
  const st = sessionStats(session);
  const prev = previousSameDay(session);
  let compare = '';
  if (prev) {
    const prevVol = sessionStats(prev).volume;
    if (prevVol > 0 && st.volume > 0) {
      const pct = Math.round((st.volume - prevVol) / prevVol * 100);
      compare = `<div class="detail-compare">${pct === 0 ? 'Same volume as' : `<strong class="${pct > 0 ? 'up' : ''}">${pct > 0 ? '+' : ''}${pct}% volume</strong> vs`} the previous ${escapeHtml(session.day)} on ${shortDate(prev.id)}</div>`;
    }
  }
  const tile = (val, lbl, cls = '') => `<div class="detail-tile ${cls}"><div class="detail-tile-val">${val}</div><div class="detail-tile-lbl">${lbl}</div></div>`;
  return `
    <div class="detail-stats">
      ${tile(st.durationSec ? fmtDuration(st.durationSec) : '—', 'Duration')}
      ${tile(st.sets, 'Sets')}
      ${tile(fmtVolume(st.volume), 'Volume')}
      ${tile(st.prs, st.prs === 1 ? 'PR' : 'PRs', st.prs ? 'gold' : '')}
    </div>
    ${compare}
    ${effortRowHtml(session)}
    ${caloriesRowHtml(session)}
    ${cardioDetailHtml(session, 'before')}
    ${session.exercises.map(ex => `
      <div class="detail-ex">
        <div class="detail-ex-head">
          <span class="detail-ex-name">${escapeHtml(ex.name)}</span>
          <span class="detail-ex-vol">${fmtVolume(ex.sets.reduce((v, s) => v + setVolume(s), 0))}</span>
          ${avgRest(ex.sets) ? `<span class="detail-ex-rest">rest ${fmtClock(avgRest(ex.sets))} avg</span>` : ''}
        </div>
        ${ex.sets.map((s, i) => `
          <div class="detail-set">
            <span class="detail-set-num">${i + 1}</span>
            <span class="detail-set-val">${Number(s.weight) > 0 ? `${fmtNum(Number(s.weight))} kg` : 'BW'} × ${Number(s.reps) || 0}</span>
            ${s.pr ? `<span class="pr-badge" title="${PR_LABELS[s.pr] || 'Personal record'}">PR</span>` : ''}
            <span class="detail-set-rest">${s.restSec ? fmtClock(s.restSec) : ''}</span>
          </div>` +
          (s.drops || []).map((d, j) => `<div class="detail-drop">↳ Drop ${j + 1}: ${Number(d.weight) > 0 ? `${fmtNum(Number(d.weight))} kg` : 'BW'} × ${Number(d.reps) || 0}</div>`).join('')
        ).join('')}
      </div>
    `).join('')}
    ${cardioDetailHtml(session, 'after')}`;
}

// One session, or every session logged on a calendar date (e.g. Day 1 and Day 2 on the same day)
function openSessionsModal(sessions) {
  const deleteBtn = document.getElementById('modal-delete-action-btn');
  const when = s => new Date(s.id).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (sessions.length === 1) {
    const session = sessions[0];
    document.getElementById('modal-title').innerText = `${session.day} · ${session.title}`;
    document.getElementById('modal-date').innerText = `${when(session)} · ${new Date(session.id).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    document.getElementById('modal-body').innerHTML = sessionDetailHtml(session);
    deleteBtn.hidden = false;
    deleteBtn.onclick = () => deleteSession(session.id);
    const repeat = document.getElementById('modal-repeat-btn');
    repeat.hidden = !session.exercises.length;
    repeat.onclick = () => repeatWorkout(session.id);
  } else {
    document.getElementById('modal-title').innerText = `${sessions.length} Workouts`;
    document.getElementById('modal-date').innerText = when(sessions[0]);
    document.getElementById('modal-body').innerHTML = sessions.map(session => `
      <div class="session-block-head">
        <span><span class="day-dot" style="background:${dayColor(session.day)}"></span>${escapeHtml(session.day)} · ${escapeHtml(session.title)}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">Delete</button>
      </div>
      ${sessionDetailHtml(session)}
    `).join('');
    deleteBtn.hidden = true;
    document.getElementById('modal-repeat-btn').hidden = true;
  }

  openSheet('detail-modal');
}

// Deletes right away; the toast offers Undo instead of asking first.
function deleteSession(sessionId) {
  const history = getHistory();
  const removed = history.find(s => s.id === sessionId);
  if (!removed) return;
  saveHistory(history.filter(s => s.id !== sessionId));
  closeModal();
  renderCalendarAndHistory();
  haptic('light');
  showToast('Workout deleted', {
    actionLabel: 'Undo',
    onAction: () => {
      const current = getHistory();
      if (!current.some(s => s.id === removed.id)) current.push(removed);
      saveHistory(current.sort((a, b) => b.id - a.id));
      renderCalendarAndHistory();
    }
  });
}

function closeModal() {
  closeSheet('detail-modal');
}
