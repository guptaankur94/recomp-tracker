// Your own warm-ups: edit an exercise's warm-up sets, refuse bad reps, choose none, add one back, return to
// the automatic ramp, and keep it after a reload.
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
  const chips = () => p.getByRole('checkbox', { name: /^Warm-up \d/ }).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  const first = async () => (await chips()).filter((_, i, a) => i < 3 || true);
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await btn('Skip for now').isVisible().catch(() => false)) { await btn('Skip for now').click(); await p.waitForTimeout(1200); }
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  const auto = (await chips()).slice(0, 3).join(' | ');
  check('automatic warm-up first', auto === 'Warm-up 1: Light × 8 | Warm-up 2: Moderate × 5 | Warm-up 3: Heavier × 2', auto);

  await btn('Edit warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  check('editor opens with the warm-up shown', (await p.getByLabel(/^Warm-up \d reps$/).count()) === 3);
  check('no "automatic" button before you change it', !(await btn('Use automatic warm-up').isVisible()));
  await p.getByLabel('Warm-up 1 weight in kg').fill('20');
  await p.getByLabel('Warm-up 2 weight in kg').fill('40');
  await p.getByLabel('Warm-up 3 weight in kg').fill('60');
  await p.getByLabel('Warm-up 3 reps').fill('0');
  await btn('Save warm-up').click();
  await p.waitForTimeout(300);
  check('bad reps are refused', (await toast()).includes('Warm-up 3: enter reps between 1 and 50'));
  await p.getByLabel('Warm-up 3 reps').fill('3');
  await shot('wu-1-editor');
  await btn('Save warm-up').click();
  await p.waitForTimeout(800);
  check('saved', (await toast()).includes('Warm-up saved for Barbell Back Squat'));
  const mine = (await chips()).slice(0, 3).join(' | ');
  check('your own warm-up shows', mine === 'Warm-up 1: 20 kg × 8 | Warm-up 2: 40 kg × 5 | Warm-up 3: 60 kg × 3', mine);
  await shot('wu-2-own');

  // None at all, then add one back from the card
  await btn('Edit warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  check('"automatic" button once you have your own', await btn('Use automatic warm-up').isVisible());
  for (let i = 0; i < 3; i++) await btn('Remove warm-up 1').click();
  check('every row can go', await p.getByText('No warm-up for this exercise.').isVisible());
  await btn('Save warm-up').click();
  await p.waitForTimeout(800);
  check('no warm-up when you choose none', (await toast()).includes('No warm-up for Barbell Back Squat') && await btn('Add a warm-up for Barbell Back Squat').isVisible());
  await btn('Add a warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  await btn('+ Add warm-up set').click();
  await btn('Save warm-up').click();
  await p.waitForTimeout(800);
  check('a light set needs no weight', (await chips())[0] === 'Warm-up 1: Light × 8', (await chips())[0]);

  // Ticking every warm-up folds the panel to one line; tap to open, Hide to fold
  await btn('Edit warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  await btn('+ Add warm-up set').click();
  await btn('Save warm-up').click();
  await p.waitForTimeout(800);
  check('panel shows its rows', (await chips()).slice(0, 2).join(' | ') === 'Warm-up 1: Light × 8 | Warm-up 2: Light × 8');
  await p.getByRole('checkbox', { name: 'Warm-up 1: Light × 8' }).first().click();
  await p.waitForTimeout(300);
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  check('still open after one', await p.getByRole('checkbox', { name: /^Warm-up 2/ }).first().isVisible());
  await p.getByRole('checkbox', { name: /^Warm-up 2/ }).first().click();
  await p.waitForTimeout(400);
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  const folded = p.getByRole('button', { name: 'Warm-up done. Show warm-up sets' });
  check('all ticked folds to "Warm-up done"', await folded.isVisible());
  await shot('wu-3-folded');
  await folded.click();
  await p.waitForTimeout(300);
  check('tap opens it again', await p.getByRole('checkbox', { name: /^Warm-up 1/ }).first().isVisible());
  await btn('Hide warm-up sets').click();
  await p.waitForTimeout(300);
  check('Hide folds it', await folded.isVisible());
  // Back to one light set for the checks below
  await folded.click();
  await btn('Edit warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  await btn('Remove warm-up 2').click();
  await btn('Save warm-up').click();
  await p.waitForTimeout(800);

  // Kept after a reload, then back to automatic
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  // Its tick is kept too, so the panel comes back folded
  const foldedAgain = p.getByRole('button', { name: 'Warm-up done. Show warm-up sets' });
  check('kept after a reload, ticks and all', await foldedAgain.isVisible());
  await foldedAgain.click();
  await p.waitForTimeout(300);
  check('your warm-up after a reload', (await p.getByRole('checkbox', { name: /^Warm-up/ }).first().getAttribute('aria-label')) === 'Warm-up 1: Light × 8');
  await btn('Edit warm-up for Barbell Back Squat').click();
  await p.waitForTimeout(800);
  await btn('Use automatic warm-up').click();
  await p.waitForTimeout(800);
  const back = (await chips()).slice(0, 3).join(' | ');
  check('back to automatic', back === auto, back);

  check('no page errors or native dialogs', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
