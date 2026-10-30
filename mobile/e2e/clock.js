// The workout clock and calories: Start, Pause / Resume (paused time doesn't count), Finish, then calories
// burned on the summary, in History and in the workout's details.
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
  const finishAll = async () => { await p.getByRole('button', { name: 'Finish workout', exact: true }).first().click(); await p.waitForTimeout(900); await p.getByRole('button', { name: 'Finish workout', exact: true }).last().click(); await p.waitForTimeout(1200); };
  const clock = () => p.getByLabel(/^Workout time/).getAttribute('aria-label').catch(() => '');
  await p.clock.install({ time: new Date('2026-10-22T18:00:00') });
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await btn('Skip for now').isVisible().catch(() => false)) { await btn('Skip for now').click(); await p.waitForTimeout(1200); }
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);

  check('Start shows before a workout', await btn('Start workout').isVisible());
  await shot('c-1-start');
  await btn('Start workout').click();
  await p.waitForTimeout(300);
  check('Start shows the clock with Pause and Finish, and Finish at the bottom', await btn('Pause').isVisible() && (await btn('Finish workout').count()) === 2);
  check('Start is gone once started', !(await btn('Start workout').isVisible()));
  await p.clock.fastForward('10:00');
  check('the clock runs', /^Workout time 10:0\d$/.test(await clock()), await clock());
  await btn('Pause').click();
  await p.waitForTimeout(300);
  await p.clock.fastForward('20:00');
  check('a paused clock holds', /^Workout time 10:0\d, paused$/.test(await clock()), await clock());
  await shot('c-2-paused');
  await btn('Resume').click();
  await p.waitForTimeout(300);
  await p.clock.fastForward('05:00');
  check('paused time is left out', /^Workout time 15:0\d$/.test(await clock()), await clock());

  // Pausing, then ticking a set, carries the clock on
  await btn('Pause').click();
  await p.waitForTimeout(300);
  await p.getByLabel('Set 1 weight in kg').first().fill('60');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  check('ticking a set resumes', await btn('Pause').isVisible());
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  await p.clock.fastForward('01:00');
  await finishAll();
  check('Finish shows the summary', await p.getByText('Workout complete', { exact: false }).first().isVisible());
  // 10 + 5 + 1 minutes on the clock, with 20 paused: about 16 (rounding and the seconds the test itself takes can
  // move it a minute either way), where counting the pause would give 36
  const total = await p.getByText(/^Total time \d+ min$/).innerText().catch(() => '');
  check('duration leaves out pauses', /^Total time 1[5-7] min$/.test(total), total);
  const kcal = p.getByLabel('Calories burned, kcal');
  check('the summary asks for calories', await kcal.isVisible());
  await kcal.fill('9999');
  await btn('Save calories').click();
  await p.waitForTimeout(300);
  check('too many calories are refused', (await toast()).includes('Enter calories between 1 and 5000'));
  await kcal.fill('342');
  await btn('Save calories').click();
  await p.waitForTimeout(400);
  check('calories saved', (await toast()).includes('Saved 342 kcal'));
  check('Save goes once saved', !(await btn('Save calories').isVisible()));
  await shot('c-3-summary');
  await btn('See it in History').click();
  await p.waitForTimeout(1000);
  check('History shows the calories', await p.getByText(/342 kcal/).first().isVisible());
  await p.getByRole('button', { name: /^Day 1 / }).first().click();
  await p.waitForTimeout(800);
  check('the workout keeps its calories', (await p.getByLabel('Calories burned, kcal').inputValue()) === '342');
  await shot('c-4-details');
  await p.getByLabel('Calories burned, kcal').fill('');
  await btn('Save calories').click();
  await p.waitForTimeout(400);
  check('calories can be cleared', (await toast()).includes('Calories cleared'));

  // Start, then Finish with nothing logged (on a fresh day with nothing saved)
  await p.clock.fastForward('24:00:00');
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /^Day 2,/ }).click();
  await btn('Start workout').click();
  await p.waitForTimeout(300);
  await btn('Finish workout').first().click();
  await p.waitForTimeout(800);
  check('nothing logged: asks before ending', await p.getByText('End this workout?').isVisible());
  await btn('Keep training').click();
  await p.waitForTimeout(600);
  check('Keep training keeps it running', await p.getByLabel(/^Workout time/).isVisible());
  await btn('Finish workout').first().click();
  await p.waitForTimeout(800);
  await btn('End workout').click();
  await p.waitForTimeout(800);
  check('Finish with nothing logged stops the clock', (await toast()).includes('Nothing was logged') && await btn('Start workout').isVisible());

  // One clock for the whole app: Start on one day, go to another, then Finish saves both days' sets
  await p.clock.fastForward('24:00:00');
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /^Day 3,/ }).click();
  await btn('Start workout').click();
  await p.waitForTimeout(300);
  await p.clock.fastForward('05:00');
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  check('another day: no second Start', !(await btn('Start workout').isVisible()));
  check('another day: the same clock', /^Workout time 5:0\d$/.test(await clock()), await clock());
  check('one clock on screen', (await p.getByLabel(/^Workout time/).count()) === 1);
  await p.getByLabel('Set 1 weight in kg').first().fill('60');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  await p.getByRole('tab', { name: /^Day 3,/ }).click();
  await p.waitForTimeout(300);
  await p.getByLabel('Set 1 weight in kg').first().fill('40');
  await p.getByLabel('Set 1 reps').first().fill('10');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click();
  // Kept across a reload
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  check('the clock survives a reload', /^Workout time 5:\d\d/.test(await clock()), await clock());
  await finishAll();
  check('Finish saves both days in one workout', (await p.getByLabel('Sets: 2').isVisible()) || (await p.getByText(/^2$/).first().isVisible()));
  await shot('c-5-both-days');
  await btn('Done').click();
  await p.waitForTimeout(600);
  check('clock stopped, nothing left unsaved', await btn('Start workout').isVisible() && (await p.getByRole('tab', { name: /Unsaved/ }).count()) === 0);

  check('no page errors or native dialogs', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
