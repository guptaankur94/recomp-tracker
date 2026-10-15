// The browser preview as GitHub Pages serves it: no special headers, under /recomp-tracker/preview/, next to the
// web app. The isolation service worker must take over so the database works, and the web app's own service
// worker must leave the preview alone.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ` (${x})` : ''}`);
const ORIGIN = 'http://127.0.0.1:' + (process.env.PORT || 8796);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss(); });
  // The web app first, so its service worker is installed on the site
  await p.goto(`${ORIGIN}/recomp-tracker/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  check('web app runs', await p.evaluate(() => typeof APP_VERSION === 'string' && !!navigator.serviceWorker.controller));
  // Then the preview
  await p.goto(`${ORIGIN}/recomp-tracker/preview/`, { waitUntil: 'networkidle' });
  // The page reloads itself once when the isolation service worker takes over
  await p.waitForFunction(() => window.crossOriginIsolated, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  check('preview is not the web app', await p.evaluate(() => typeof APP_VERSION === 'undefined'));
  check('isolated after one reload', await p.evaluate(() => window.crossOriginIsolated));
  check('preview opens on setup', await p.getByRole('heading', { name: 'Welcome to Recomp' }).isVisible());
  await p.getByRole('button', { name: 'Skip for now', exact: true }).click(); await p.waitForTimeout(1000);
  await p.getByLabel('Set 1 weight in kg').first().fill('50');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await p.getByRole('button', { name: 'Done with set 1', exact: true }).first().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Finish workout', exact: true }).click(); await p.waitForTimeout(1200);
  check('a workout saves', await p.getByText('Workout complete').isVisible());
  // Reloading on the summary (an inner address) brings it back, via the site's 404 page
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  check('summary survives a reload', await p.getByText('Workout complete').isVisible(), p.url());
  await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(800);
  await p.getByRole('tab', { name: 'History', exact: true }).click(); await p.waitForTimeout(600);
  const rows = await p.getByRole('button', { name: /^Day \d .*sets?/ }).count();
  check('data kept after reload', rows === 1, String(rows));
  await p.getByRole('tab', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(400);
  check('preview note in Settings', await p.getByText('Browser preview', { exact: true }).isVisible());
  // A deep link opens too, and an inner page survives a reload (via the site's 404 page)
  await p.goto(`${ORIGIN}/recomp-tracker/preview/guide`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  check('inner page after reload', await p.getByRole('heading', { name: 'How Recomp works' }).isVisible(), p.url());

  await p.goto(`${ORIGIN}/recomp-tracker/preview/progress`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  check('deep link to Progress', await p.getByRole('heading', { name: "How you're doing" }).isVisible());
  // The web app is unaffected, and its data is separate
  await p.goto(`${ORIGIN}/recomp-tracker/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  check('web app still runs, its own history', await p.evaluate(() => typeof APP_VERSION === 'string' && getHistory().length === 0));
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
