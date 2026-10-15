/* Switching sections, the gliding tab highlight and the header. */

const VIEW_ORDER = ['plan', 'history', 'workout', 'progress', 'settings'];

/* Glide the glass pill under the current tab (instantly the first time).
   Speed stays even: the time grows with the distance travelled, so a one-tab hop and a
   four-tab jump move at the same pace. Under Workout the pill becomes a ring sized from
   the green button (button × 1.18), never taller than the bar's inner height. */
let navPillX = null;

function moveNavIndicator(animate = true) {
  const bar = document.querySelector('.bottom-tab-bar');
  const pill = bar.querySelector('.nav-indicator');
  const tab = document.getElementById(`tab-nav-${currentView}`);
  if (!tab || !bar.offsetWidth) return;
  const inner = bar.clientHeight - 12; // 6px padding top and bottom
  const barBox = bar.getBoundingClientRect();
  const isCenter = tab.classList.contains('center');
  const target = (isCenter ? tab.querySelector('.nav-ico') : tab).getBoundingClientRect();
  const w = isCenter ? Math.min(inner, Math.round(target.width * 1.18)) : Math.min(68, target.width);
  const h = isCenter ? w : inner;
  const x = target.left - barBox.left - bar.clientLeft + (target.width - w) / 2;
  const y = (bar.clientHeight - h) / 2;
  const ms = animate && navPillX !== null ? Math.round(Math.min(560, 220 + Math.abs(x - navPillX) * 1.1)) : 0;
  navPillX = x;
  if (!animate) pill.classList.remove('ready');
  pill.style.setProperty('--nav-ms', `${ms}ms`);
  pill.style.width = `${w}px`;
  pill.style.height = `${h}px`;
  pill.style.transform = `translate(${x}px, ${y}px)`;
  if (animate) {
    pill.classList.remove('moving');
    void pill.offsetWidth;
    pill.classList.add('moving');
  } else {
    void pill.offsetWidth;
    pill.classList.add('ready');
  }
}

window.addEventListener('resize', () => moveNavIndicator(false));

function switchView(viewName) {
  const from = currentView;
  if (viewName !== currentView) window.scrollTo(0, 0);
  currentView = viewName;
  if (from !== viewName) {
    const view = document.getElementById(`view-${viewName}`);
    const dir = VIEW_ORDER.indexOf(viewName) > VIEW_ORDER.indexOf(from) ? 'enter-right' : 'enter-left';
    view.classList.remove('enter-right', 'enter-left');
    void view.offsetWidth;
    view.classList.add(dir);
    view.addEventListener('animationend', () => view.classList.remove(dir), { once: true });
  }
  updateHeader();
  ['workout', 'plan', 'history', 'progress', 'settings'].forEach(name => {
    document.getElementById(`view-${name}`).hidden = viewName !== name;
    const tab = document.getElementById(`tab-nav-${name}`);
    tab.classList.toggle('active', viewName === name);
    if (viewName === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  moveNavIndicator(from !== viewName);
  // Fill the section once the pill is moving, so building it can't stall the first frames
  if (from !== viewName) return requestAnimationFrame(() => requestAnimationFrame(() => renderViewContent(viewName)));
  renderViewContent(viewName);
}

function renderViewContent(viewName) {

  if (viewName === 'history') {
    renderCalendarAndHistory();
  } else if (viewName === 'progress') {
    renderProgress();
  } else if (viewName === 'settings') {
    renderSettings();
  } else if (viewName === 'plan') {
    renderPlanView();
  }
}

function shiftCalendarMonth(delta) {
  calendarMonthOffset += delta;
  renderCalendarAndHistory();
}

let currentView = 'workout';

// Large title per tab; the Workout tab greets you with the date.
function updateHeader() {
  const profile = getProfile();
  const goal = getGoalKg();
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = profile && profile.name ? profile.name.split(' ')[0] : '';
  const views = {
    workout: { kicker: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), title: `Good ${part}${name ? `, ${name}` : ''}` },
    plan: { kicker: 'Yours to change', title: 'Your Plan' },
    history: { kicker: getPlanName(), title: 'History' },
    progress: { kicker: goal ? `Goal ${fmtNum(goal)} kg` : 'Your trends', title: 'Progress' },
    settings: { kicker: getPlanName(), title: 'Settings' }
  };
  const v = views[currentView] || views.workout;
  document.getElementById('header-kicker').textContent = v.kicker;
  document.getElementById('header-title').textContent = v.title;
  const avatar = document.getElementById('header-avatar');
  avatar.hidden = currentView === 'settings';
  avatar.innerHTML = name
    ? escapeHtml(name[0].toUpperCase())
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.4-3.6 4.2-5.2 7.5-5.2s6.1 1.6 7.5 5.2"/></svg>';
}
