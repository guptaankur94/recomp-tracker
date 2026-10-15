const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SP = process.argv[2];
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ` (${x})` : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss(); });
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  // Empty state first
  await p.getByRole('button', { name: 'Skip for now' }).click(); await p.waitForTimeout(800);
  await p.getByRole('tab', { name: 'Progress', exact: true }).click(); await p.waitForTimeout(500);
  check('empty bodyweight chart explains itself', await p.getByText(/Log your weight a few times a week/).first().isVisible());
  // Import the 37-workout backup
  await p.getByRole('tab', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(400);
  const chooser = p.waitForEvent('filechooser');
  await p.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser).setFiles(`${SP}/backup.json`); await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: 'Progress', exact: true }).click(); await p.waitForTimeout(800);
  const charts = p.locator('[data-testid="chart"]');
  check('two charts', (await charts.count()) === 2, String(await charts.count()));
  const bwLabel = await charts.first().getAttribute('aria-label');
  check('bodyweight chart described', /^Bodyweight, 7-day average [\d.]+ kg, changing -?[\d.]+ kg per week$/.test(bwLabel), bwLabel);
  const lines = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chart"] svg path')].filter(x => x.getAttribute('fill') === 'none').map(x => x.getAttribute('d').split('L').length));
  check('lines drawn', lines.length === 2 && lines.every(n => n > 5), lines.join(','));
  check('goal line labelled', (await p.locator('[data-testid="chart"] svg text', { hasText: 'Goal 80' }).count()) === 1);
  await p.screenshot({ path: `${SP}/c-1-bodyweight.png` });
  // Drag across the bodyweight chart: the readout follows
  const box = await charts.first().boundingBox();
  await p.mouse.move(box.x + box.width * 0.3, box.y + 120); await p.waitForTimeout(200);
  const r1 = await p.getByText(/· weighed/).first().innerText().catch(() => '');
  await p.mouse.move(box.x + box.width * 0.9, box.y + 120); await p.waitForTimeout(200);
  const r2 = await p.getByText(/· weighed/).first().innerText().catch(() => '');
  check('readout follows the pointer', r1 && r2 && r1 !== r2, `${r1} → ${r2}`);
  // Exercise chart: records marked, metric switch, range switch
  const ex = charts.nth(1);
  await ex.scrollIntoViewIfNeeded();
  const gold = () => p.evaluate(() => document.querySelectorAll('[data-testid="chart"] svg circle[r="5"]').length);
  check('records or best marked', (await gold()) >= 1, String(await gold()));
  const before = await ex.getAttribute('aria-label');
  await p.getByRole('radio', { name: 'Volume', exact: true }).click(); await p.waitForTimeout(300);
  const after = await ex.getAttribute('aria-label');
  check('metric switch', before !== after && after.includes('Volume'), `${before} → ${after}`);
  await p.getByRole('radio', { name: 'Rest', exact: true }).click(); await p.waitForTimeout(300);
  check('rest: lower is better', await p.getByText(/lower is better/i).first().isVisible());
  await p.screenshot({ path: `${SP}/c-2-exercise.png` });
  await p.getByRole('radio', { name: 'Volume', exact: true }).click();
  await p.getByRole('radio', { name: '1M', exact: true }).click(); await p.waitForTimeout(300);
  const one = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chart"] svg path')].filter(x => x.getAttribute('fill') === 'none').map(x => x.getAttribute('d').split('L').length));
  await p.getByRole('radio', { name: 'All', exact: true }).click(); await p.waitForTimeout(300);
  const all = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chart"] svg path')].filter(x => x.getAttribute('fill') === 'none').map(x => x.getAttribute('d').split('L').length));
  check('range narrows the data', one[0] < all[0] && one[1] <= all[1], `${one} vs ${all}`);
  // Tap a main lift to chart it
  await p.getByRole('button', { name: /^Leg Press Machine\. Chart it/ }).click(); await p.waitForTimeout(300);
  check('main lift opens in the chart', (await ex.getAttribute('aria-label')).startsWith('Leg Press Machine'));
  await p.getByRole('button', { name: /^Show all \d+ sessions/ }).click(); await p.waitForTimeout(200);
  check('session list expands', await p.getByRole('button', { name: 'Show fewer' }).isVisible());
  // Each theme
  for (const [name, file] of [['Neon District', 'neon'], ['Codex', 'codex']]) {
    await p.getByRole('tab', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(300);
    await p.getByLabel(`${name} theme`, { exact: true }).click(); await p.waitForTimeout(300);
    await p.getByRole('tab', { name: 'Progress', exact: true }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `${SP}/c-3-${file}.png` });
  }
  const over = await p.evaluate(() => [...document.querySelectorAll('div,input,svg')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && (r.right > 391 || r.left < -1) && !(function inX(n) { for (let a = n.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; })(el) && (el.tagName === 'svg' || (el.innerText || '').trim()); }).length);
  check('fits the screen', over === 0, String(over));
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
