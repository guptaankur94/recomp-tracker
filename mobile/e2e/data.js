const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SP = process.argv[2];
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('dialog', d => { errors.push('NATIVE DIALOG ' + d.message()); d.dismiss(); });
  const tab = name => p.getByRole('tab', { name, exact: true }).click();
  const shot = name => p.screenshot({ path: `${SP}/${name}.png` });
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await p.getByRole('button', { name: 'Skip for now' }).isVisible().catch(() => false)) { await p.getByRole('button', { name: 'Skip for now' }).click(); await p.waitForTimeout(1200); }
  check('opens on Workout with the default plan', await p.getByText('Full Body A').first().isVisible());
  await shot('d-workout-empty');

  // Import a web-app backup
  await tab('Settings');
  await p.waitForTimeout(400);
  const chooser = p.waitForEvent('filechooser');
  await p.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser).setFiles(`${SP}/backup.json`);
  await p.waitForTimeout(1500);
  const toastText = await p.getByRole('alert').innerText().catch(() => '');
  check('import toast', /Backup restored: 37 workouts and 26 weight entries added, plus your profile\./.test(toastText), toastText);
  check('settings counts', await p.getByText('37 workouts · 26 weigh-ins').isVisible());
  await shot('d-settings');

  // Import again: nothing doubled
  const chooser2 = p.waitForEvent('filechooser');
  await p.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser2).setFiles(`${SP}/backup.json`);
  await p.waitForTimeout(1200);
  const t2 = await p.getByRole('alert').innerText().catch(() => '');
  check('second import adds nothing', /0 workouts and 0 weight entries added\. 37 already here\./.test(t2), t2);

  // A broken file shows a message, no crash
  require('fs').writeFileSync(`${SP}/broken.json`, '{"hello": 1}');
  const chooser3 = p.waitForEvent('filechooser');
  await p.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser3).setFiles(`${SP}/broken.json`);
  await p.waitForTimeout(800);
  const t3 = await p.getByRole('alert').innerText().catch(() => '');
  check('bad file message', t3.includes("doesn't look like a Recomp backup"), t3);

  // History
  await tab('History');
  await p.waitForTimeout(600);
  check('history week groups', await p.getByText('Last week').isVisible());
  await shot('d-history');
  const rows = p.getByRole('button', { name: /^Day \d .*sets/ });
  check('history rows', (await rows.count()) === 37, String(await rows.count()));
  await rows.first().click();
  await p.waitForTimeout(800);
  check('session detail opens', await p.getByRole('button', { name: 'Delete workout' }).isVisible());
  await shot('d-session');
  await p.getByRole('button', { name: 'Delete workout' }).click();
  await p.waitForTimeout(800);
  check('deleted', (await p.getByRole('button', { name: /^Day \d .*sets/ }).count()) === 36);
  await p.getByRole('button', { name: 'Undo' }).click();
  await p.waitForTimeout(600);
  check('undo delete', (await p.getByRole('button', { name: /^Day \d .*sets/ }).count()) === 37);
  await p.getByRole('button', { name: 'Previous month' }).click();
  await p.waitForTimeout(300);

  // Progress
  await tab('Progress');
  await p.waitForTimeout(600);
  const input = p.getByLabel("Today's weight in kg");
  await input.fill('500');
  await p.getByRole('button', { name: 'Log today' }).click();
  check('weight validation', await p.getByText('Enter your weight in kg, between 20 and 300.').isVisible());
  await input.fill('81.3');
  await p.getByRole('button', { name: 'Log today' }).click();
  await p.waitForTimeout(600);
  check('weight logged', (await p.getByRole('alert').innerText().catch(() => '')).includes('81.3 kg logged for today'));
  check('main lifts shown', (await p.getByText(/kg est\. 1RM over/).count()) > 0);
  await shot('d-progress');

  // Plan: switch and undo
  await tab('Plan');
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Ready-made. Proven programmes' }).click();
  await p.waitForTimeout(500);
  await p.getByRole('heading', { name: 'Upper / Lower 4×', exact: true }).click();
  await p.getByRole('button', { name: 'Use Upper / Lower 4×', exact: true }).click();
  await p.waitForTimeout(500);
  check('plan switched', await p.getByRole('heading', { name: 'Upper / Lower', exact: true }).isVisible());
  await shot('d-plan');
  await tab('Workout');
  await p.waitForTimeout(500);
  check('workout uses new plan', (await p.getByText(/Workout · Upper \/ Lower/).count()) > 0);
  await tab('Plan');
  await p.getByRole('button', { name: 'Ready-made. Proven programmes' }).click();
  await p.waitForTimeout(500);
  await p.getByRole('heading', { name: 'Upper / Lower 4×', exact: true }).click();
  check('in-use plan offers restart', await p.getByRole('button', { name: 'Restart Upper / Lower 4×', exact: true }).isVisible());
  await p.getByRole('button', { name: 'Back' }).click();
  await p.waitForTimeout(400);

  // Theme + reload: everything persists
  await tab('Settings');
  await p.getByLabel('Codex theme', { exact: true }).click();
  await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  const radioAttrs = await p.getByRole('radio', { name: 'Codex theme' }).evaluate(el => [el.getAttribute('aria-checked'), el.getAttribute('aria-selected')].join(','));
  check('theme kept after reload', radioAttrs.includes('true'), radioAttrs);
  await tab('Workout');
  await p.waitForTimeout(500);
  check('plan kept after reload', (await p.getByText(/Workout · Upper \/ Lower/).count()) > 0);
  await shot('d-workout-after-reload');
  await tab('History');
  await p.waitForTimeout(500);
  check('history kept after reload', (await p.getByRole('button', { name: /^Day \d .*sets/ }).count()) === 37);
  // Nothing with text pokes past the screen edge on any tab
  for (const name of ['Workout', 'Plan', 'History', 'Progress', 'Settings']) {
    await tab(name);
    await p.waitForTimeout(500);
    const over = await p.evaluate(() => [...document.querySelectorAll('div,input')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && (r.right > 391 || r.left < -1) && (el.innerText || el.value || '').trim() && !(function inX(n) { for (let a = n.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; })(el); }).map(el => el.innerText.slice(0, 20)));
    const scroller = await p.evaluate(() => Math.max(...[...document.querySelectorAll('div')].filter(d => getComputedStyle(d).overflowY === 'auto' || getComputedStyle(d).overflowY === 'scroll').map(d => d.scrollWidth - d.clientWidth)));
    check(`${name}: fits the screen`, over.length === 0 && scroller <= 0, over.slice(0, 3).join(' | ') + ' scroll+' + scroller);
  }
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 400));
  check('no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
