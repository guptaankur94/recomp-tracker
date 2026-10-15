/* Themes: Vitruvian Machine (default), Neon District, Codex and the original Classic look. The colours and type
   live in styles/themes/; this file remembers the choice and draws the picker in Settings → Appearance. */

const THEME_KEY = 'recomp_theme';

// sample: what the picker card shows in the theme's own colours and type
const THEMES = [
  { id: 'vitruvian', name: 'Vitruvian Machine', tagline: 'Default · ink and telemetry', bar: '#0B0C0E',
    sample: { bg: '#0B0C0E', ink: '#EDE6D6', accent: '#5EE7F0', record: '#D9B45A', display: "'Cormorant Garamond', serif", numbers: "'JetBrains Mono', monospace", grid: true } },
  { id: 'neon', name: 'Neon District', tagline: 'Cyberpunk', bar: '#07060D',
    sample: { bg: 'linear-gradient(135deg, #07060D 60%, rgba(255, 46, 136, 0.35))', ink: '#F2F0FF', accent: '#19F0FF', record: '#FF2E88', display: "'Chakra Petch', sans-serif", numbers: "'IBM Plex Mono', monospace", upper: true } },
  { id: 'codex', name: 'Codex', tagline: 'Renaissance notebook', bar: '#1A140D',
    sample: { bg: '#1A140D', ink: '#EAD9B4', accent: '#DB7552', record: '#D4AD52', display: "'Cinzel', serif", numbers: "'EB Garamond', serif", dropCap: true } },
  { id: 'classic', name: 'Classic', tagline: 'The original look', bar: '#000000',
    sample: { bg: '#000000', ink: '#FFFFFF', accent: '#30D158', record: '#FFD60A', display: '-apple-system, sans-serif', numbers: '-apple-system, sans-serif' } }
];

function currentThemeId() {
  const id = localStorage.getItem(THEME_KEY);
  return THEMES.some(t => t.id === id) ? id : 'vitruvian';
}

// Sets the theme on the page (the head script already did this before the first paint) and the browser bar colour
function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme.bar);
}

function themeCardHtml(t, selected) {
  const s = t.sample;
  const name = s.dropCap ? `<span style="color:${s.accent}">B</span>ench` : 'Bench';
  return `
    <button class="theme-card ${selected ? 'on' : ''}" role="radio" aria-checked="${selected}" onclick="pickTheme('${t.id}')" aria-label="${t.name} theme. ${t.tagline}">
      <span class="theme-sample ${s.grid ? 'grid' : ''}" style="background:${s.bg}">
        <span class="theme-sample-name" style="color:${s.ink}; font-family:${s.display}; ${s.upper ? 'text-transform:uppercase;' : ''}">${name}</span>
        <span class="theme-sample-set" style="color:${s.accent}; font-family:${s.numbers}">50 × 8 <span style="color:${s.record}">2:45</span></span>
      </span>
      <span class="theme-card-text"><span class="theme-card-name">${t.name}</span><span class="theme-card-sub">${t.tagline}</span></span>
    </button>`;
}

function renderThemeSheet() {
  const current = currentThemeId();
  document.getElementById('theme-list').innerHTML = THEMES.map(t => themeCardHtml(t, t.id === current)).join('');
}

function openThemeSheet() {
  renderThemeSheet();
  openSheet('theme-sheet');
}

function pickTheme(id) {
  localStorage.setItem(THEME_KEY, id);
  applyTheme(id);
  renderThemeSheet();
  haptic('light');
  if (!document.getElementById('view-settings').hidden) renderSettings();
  // The tab indicator's glass picks up the new colours
  if (typeof moveNavIndicator === 'function') moveNavIndicator(false);
}

function themeName() {
  return (THEMES.find(t => t.id === currentThemeId()) || THEMES[0]).name;
}

applyTheme(currentThemeId());
