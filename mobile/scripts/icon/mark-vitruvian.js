// The Vitruvian Machine app mark, in a 512 × 512 box: obsidian with a faint blueprint grid, Leonardo's circle
// and square in fine ink, a telemetry-cyan progress ring and the dumbbell in warm ink.
module.exports = function mark({ background = true } = {}) {
  const r = 150;
  const c = 2 * Math.PI * r;
  const grid = [];
  for (let i = 0; i <= 512; i += 32) {
    grid.push(`<line x1="${i}" y1="0" x2="${i}" y2="512"/><line x1="0" y1="${i}" x2="512" y2="${i}"/>`);
  }
  return `
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0" stop-color="#15181c"/><stop offset="1" stop-color="#08090b"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4eee0"/><stop offset="1" stop-color="#d8cfbb"/>
    </linearGradient>
    <linearGradient id="cyan" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3fd3de"/><stop offset="1" stop-color="#8af2f7"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="512" height="512" fill="url(#bg)"/>
  <g stroke="rgba(94,231,240,0.07)" stroke-width="1.5">${grid.join('')}</g>` : ''}
  <!-- Leonardo's square and circle -->
  <rect x="116" y="116" width="280" height="280" fill="none" stroke="rgba(237,230,214,0.22)" stroke-width="3"/>
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="rgba(237,230,214,0.14)" stroke-width="18"/>
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="url(#cyan)" stroke-width="18" stroke-linecap="round"
    stroke-dasharray="${c * 0.75} ${c}" transform="rotate(-90 256 256)"/>
  <!-- a gold tick where the ring ends -->
  <circle cx="${256 - r}" cy="256" r="13" fill="#D9B45A"/>
  <g fill="url(#ink)">
    <rect x="196" y="246" width="120" height="20" rx="10"/>
    <rect x="170" y="206" width="29" height="100" rx="8"/>
    <rect x="313" y="206" width="29" height="100" rx="8"/>
    <rect x="149" y="228" width="19" height="56" rx="6"/>
    <rect x="344" y="228" width="19" height="56" rx="6"/>
  </g>`;
};
