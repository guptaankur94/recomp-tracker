/* The line chart drawing used across Progress. */

/* Single-series line chart (inline SVG): area fill, draw-in, optional faint raw dots, gold record
   markers, a dashed target line and a tap/hover crosshair with tooltip */
function niceStep(range, count) {
  const raw = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function fmtAxis(v) {
  return Math.abs(v) >= 10000 ? `${fmtNum(v / 1000)}k` : fmtNum(v);
}

// Date ticks: weekly for short spans, month starts otherwise, at most five
function dateTicks(x0, x1) {
  const ticks = [];
  if (x1 - x0 <= 45 * 864e5) {
    const d = startOfWeek(new Date(x0));
    while (d.getTime() <= x1) {
      if (d.getTime() >= x0) ticks.push({ x: d.getTime(), label: shortDate(d.getTime()) });
      d.setDate(d.getDate() + 7);
    }
  } else {
    const d = new Date(new Date(x0).getFullYear(), new Date(x0).getMonth() + 1, 1);
    while (d.getTime() <= x1) {
      ticks.push({ x: d.getTime(), label: d.toLocaleDateString('en-US', { month: 'short' }) });
      d.setMonth(d.getMonth() + 1);
    }
  }
  const step = Math.ceil(ticks.length / 5);
  return ticks.filter((_, i) => i % step === 0);
}

function renderLineChart(containerId, points, opts) {
  const box = document.getElementById(containerId);
  if (!points.length) {
    box.innerHTML = `<div class="chart-empty">${opts.emptyText}</div>`;
    return;
  }
  const W = Math.max(260, box.clientWidth || 320);
  const H = 200;
  const pad = { l: 36, r: 10, t: 16, b: 26 };
  const raw = opts.raw || [];
  const ys = points.map(p => p.y).concat(raw.map(p => p.y));
  if (opts.target != null) ys.push(opts.target);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) {
    const d = Math.max(1, Math.abs(lo) * 0.05);
    lo -= d;
    hi += d;
  }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  const sx = x => x1 === x0 ? (pad.l + W - pad.r) / 2 : pad.l + (x - x0) / (x1 - x0) * (W - pad.l - pad.r);
  const sy = y => pad.t + (hi - y) / (hi - lo) * (H - pad.t - pad.b);
  const gid = `${containerId}-fill`;

  let svg = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; lo + i * step <= hi + step / 1000; i++) {
    const v = lo + i * step;
    svg += `<line class="chart-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(v)}" y2="${sy(v)}"/>`;
    svg += `<text class="chart-axis-label" x="${pad.l - 6}" y="${sy(v) + 3}" text-anchor="end">${(opts.fmtY || fmtAxis)(v)}</text>`;
  }
  const ticks = x1 > x0 ? dateTicks(x0, x1) : [{ x: x0, label: shortDate(x0) }];
  ticks.forEach(t => {
    const x = sx(t.x);
    const anchor = x < pad.l + 20 ? 'start' : x > W - pad.r - 20 ? 'end' : 'middle';
    svg += `<text class="chart-axis-label" x="${x}" y="${H - 8}" text-anchor="${anchor}">${t.label}</text>`;
  });
  if (opts.target != null) {
    svg += `<line class="chart-target" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(opts.target)}" y2="${sy(opts.target)}"/>`;
    svg += `<text class="chart-axis-label" x="${W - pad.r}" y="${sy(opts.target) - 5}" text-anchor="end">${opts.targetLabel}</text>`;
  }
  raw.forEach(p => { svg += `<circle class="chart-raw" cx="${sx(p.x)}" cy="${sy(p.y)}" r="2.5"/>`; });

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  if (points.length > 1) {
    svg += `<path class="chart-area ${chartAnimate ? 'fade' : ''}" fill="url(#${gid})" d="${line} L${sx(x1).toFixed(1)},${H - pad.b} L${sx(x0).toFixed(1)},${H - pad.b} Z"/>`;
    svg += `<path class="chart-line ${chartAnimate ? 'draw' : ''}" pathLength="1" d="${line}"/>`;
  }
  // Dots only where they help: few points, the last point, and records
  points.forEach((p, i) => {
    if (p.record) svg += `<circle class="chart-dot record" cx="${sx(p.x)}" cy="${sy(p.y)}" r="5"/>`;
    else if (points.length <= 24 || i === points.length - 1) svg += `<circle class="chart-dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${raw.length ? 0 : 3.5}"/>`;
  });
  const last = points[points.length - 1];
  if (raw.length) svg += `<circle class="chart-dot" cx="${sx(last.x)}" cy="${sy(last.y)}" r="4"/>`;
  svg += `<line class="chart-cross" id="${containerId}-cross" y1="${pad.t}" y2="${H - pad.b}" style="display:none"/>`;
  svg += `<circle class="chart-dot focus" id="${containerId}-focus" r="6" style="display:none"/>`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;

  box.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || 'Line chart')}">${svg}</svg>
      <div class="chart-tip"></div>
    </div>
    ${opts.key ? `<div class="chart-key">${opts.key}</div>` : ''}`;

  const svgEl = box.querySelector('svg');
  const tip = box.querySelector('.chart-tip');
  const cross = document.getElementById(`${containerId}-cross`);
  const focus = document.getElementById(`${containerId}-focus`);
  const show = ev => {
    const rect = svgEl.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * (W / rect.width);
    let best = points[0];
    points.forEach(p => { if (Math.abs(sx(p.x) - px) < Math.abs(sx(best.x) - px)) best = p; });
    const cx = sx(best.x);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.style.display = '';
    focus.setAttribute('cx', cx);
    focus.setAttribute('cy', sy(best.y));
    focus.classList.toggle('record', !!best.record);
    focus.style.display = '';
    tip.innerHTML = opts.tip(best);
    tip.style.display = 'block';
    const cssX = cx * (rect.width / W);
    const left = Math.min(Math.max(0, cssX - tip.offsetWidth / 2), rect.width - tip.offsetWidth);
    tip.style.left = `${left}px`;
  };
  const hide = () => {
    tip.style.display = 'none';
    cross.style.display = 'none';
    focus.style.display = 'none';
  };
  svgEl.addEventListener('pointerdown', show);
  svgEl.addEventListener('pointermove', show);
  // On touch, keep the tooltip after lifting the finger; on mouse, hide when leaving.
  svgEl.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hide(); });
}
