// Goals: set an exercise's goal, see how close you are after a workout, and start a 12-week program.
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
  const shot = name => p.screenshot({ path: `${SP}/${name}.png` });
  const toast = () => p.getByRole('alert').last().innerText().catch(() => '');
  const btn = name => p.getByRole('button', { name, exact: true });
  const url = 'http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/';
  const goal = () => p.getByRole('button', { name: /^(your goal|goal by week \d+|program goal): / }).first().getAttribute('aria-label').catch(() => '');
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await btn('Skip for now').isVisible().catch(() => false)) { await btn('Skip for now').click(); await p.waitForTimeout(1200); }
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);

  // The starter plan targets effort ("2 reps in reserve"), so there's no number yet: you set it
  check('no made-up goal: Set your goal', await btn('Set your goal for Barbell Back Squat').isVisible());
  await btn('Set your goal for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  await p.getByLabel('Goal', { exact: true }).fill('abc');
  await btn('Save goal').click();
  await p.waitForTimeout(300);
  check('a typo is refused', (await toast()).includes('Type it like 60 kg × 8'));
  await p.getByLabel('Goal', { exact: true }).fill('100 x 5');
  await btn('Save goal').click();
  await p.waitForTimeout(800);
  check('goal saved', (await toast()).includes('Goal set: 100 kg × 5'));
  check('the goal shows big on the card', (await goal()) === 'your goal: 100 kg × 5. First time: build towards it. Change goal', await goal());
  await shot('g-1-goal');

  // After a set: where you are and what's left
  await p.getByLabel('Set 1 weight in kg').first().fill('80');
  await p.getByLabel('Set 1 reps').first().fill('5');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  await btn('Finish workout').click();
  await p.waitForTimeout(1000);
  await btn('Done').click();
  await p.waitForTimeout(600);
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  check('progress from your last workout', (await goal()) === 'your goal: 100 kg × 5. Now 80 kg × 5 · 20 kg to go. Change goal', await goal());

  // Start a 12-week program
  await p.getByRole('tab', { name: 'Plan', exact: true }).click();
  await p.waitForTimeout(500);
  await btn('Start a program').click();
  await btn('12 weeks').click();
  await p.waitForTimeout(500);
  check('Plan: week 1 of 12', await p.getByText('Week 1 of 12', { exact: true }).last().isVisible());
  await shot('g-2-program');
  await p.getByRole('tab', { name: 'Workout', exact: true }).click().catch(() => {});
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  check('kept after a reload; the card says goal by week 12', (await goal()).startsWith('goal by week 12: 100 kg × 5'), await goal());
  check('week chip on the card', await p.getByText('Week 1 of 12').first().isVisible());
  await shot('g-3-card');
  // Changing the goal keeps the program
  await p.getByRole('button', { name: /^goal by week 12: / }).first().click();
  await p.waitForTimeout(800);
  await p.getByLabel('Goal', { exact: true }).fill('105 kg × 5');
  await btn('Save goal').click();
  await p.waitForTimeout(800);
  check('goal changed, program kept', (await goal()).startsWith('goal by week 12: 105 kg × 5'), await goal());

  check('no page errors or native dialogs', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
