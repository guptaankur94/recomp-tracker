// The app mark (a 3/4 progress ring around a dumbbell), as SVG, in a 512 × 512 box. Used by make-icons.js.
module.exports = function mark({ background = true } = {}) {
  const r = 145;
  const c = 2 * Math.PI * r;
  return `
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#1b2b20"/><stop offset="1" stop-color="#060907"/>
    </radialGradient>
    <linearGradient id="arc" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#27b356"/><stop offset="1" stop-color="#4fdc7f"/>
    </linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde0"/>
    </linearGradient>
  </defs>
  ${background ? '<rect width="512" height="512" fill="url(#bg)"/>' : ''}
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="22"/>
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="url(#arc)" stroke-width="22" stroke-linecap="round"
    stroke-dasharray="${c * 0.75} ${c}" transform="rotate(-90 256 256)"/>
  <g fill="url(#metal)">
    <rect x="196" y="245" width="120" height="22" rx="11"/>
    <rect x="168" y="203" width="31" height="106" rx="9"/>
    <rect x="313" y="203" width="31" height="106" rx="9"/>
    <rect x="146" y="226" width="20" height="60" rx="7"/>
    <rect x="346" y="226" width="20" height="60" rx="7"/>
  </g>`;
};
