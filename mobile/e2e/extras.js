// Coach tips, the guide, the week summary, the rest ring and the sound setting.
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
  const btn = (n, exact = true) => p.getByRole('button', { name: n, exact });
  const tab = n => p.getByRole('tab', { name: n, exact: true }).click();
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await btn('Skip for now').click(); await p.waitForTimeout(800);
  // Week summary for a new user
  check('week summary', await p.getByLabel('0 of 3 workouts this week').isVisible() && await p.getByText('3 workouts to go this week').isVisible());
  check('profile prompt', await p.getByText(/Set up your profile for goal and nutrition targets/).isVisible());
  // First set: rest tip, then dismissed for good
  await p.getByRole('tab', { name: /^Day 1,/ }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Set 1 weight in kg').first().fill('40');
  await p.getByLabel('Set 1 reps').first().fill('10');
  await btn('Done with set 1').first().click(); await p.waitForTimeout(500);
  check('summary hides during a workout', (await p.getByLabel(/workouts this week$/).count()) === 0);
  check('rest tip after the first set', await p.getByText('Logged. Rest timer started.').isVisible());
  check('rest ring shows the time', await p.getByRole('timer').isVisible() && /^Rest: 3:00 left/.test(await p.getByRole('timer').getAttribute('aria-label')));
  await p.screenshot({ path: `${SP}/x-1-tip.png` });
  await btn('Got it').click(); await p.waitForTimeout(300);
  check('tip dismissed', (await p.getByText('Logged. Rest timer started.').count()) === 0);
  await btn('Skip rest').click();
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  check('dismissal remembered', (await p.getByText('Logged. Rest timer started.').count()) === 0);
  check('swap tip comes next', await p.getByText('Machine taken?').isVisible());
  // Guide, and showing tips again
  await tab('Settings'); await p.waitForTimeout(300);
  await btn('How Recomp works').click(); await p.waitForTimeout(400);
  check('guide opens', await p.getByRole('heading', { name: 'How Recomp works' }).isVisible() && await p.getByText('Logging a set', { exact: true }).isVisible());
  await p.screenshot({ path: `${SP}/x-2-guide.png` });
  await btn('Show the tips again').click(); await p.waitForTimeout(500);
  await tab('Workout'); await p.waitForTimeout(400);
  check('tips show again', await p.getByText('Logged. Rest timer started.').isVisible());
  // Sound setting
  await tab('Settings'); await p.waitForTimeout(300);
  await p.getByRole('radiogroup', { name: 'Rest timer sound' }).getByRole('radio', { name: 'Off' }).click(); await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await tab('Settings'); await p.waitForTimeout(300);
  check('sound setting kept', await p.getByRole('radiogroup', { name: 'Rest timer sound' }).getByRole('radio', { name: 'Off' }).getAttribute('aria-checked') === 'true');
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
