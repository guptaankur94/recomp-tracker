// The workout screen's three parts: Start at the top (then a pinned live panel), any day in the middle, Finish at
// the bottom, which asks how hard it was and for calories.
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
  const btn = name => p.getByRole('button', { name, exact: true });
  const url = 'http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/';
  const skipRest = async () => { if (await btn('Skip rest').isVisible().catch(() => false)) await btn('Skip rest').click(); };
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await btn('Skip for now').isVisible().catch(() => false)) { await btn('Skip for now').click(); await p.waitForTimeout(1200); }
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);

  check('top: Start, no Finish yet', await btn('Start workout').isVisible() && !(await btn('Finish workout').isVisible()));
  await shot('s-1-before');
  await btn('Start workout').click();
  await p.waitForTimeout(400);
  check('Start turns the top into the live panel', await p.getByLabel(/^Workout time/).isVisible() && !(await btn('Start workout').isVisible()));
  // Log on Day 1 and Day 2
  await p.getByLabel('Set 1 weight in kg').first().fill('60');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  await skipRest();
  await p.getByRole('tab', { name: /^Day 2,/ }).click();
  await p.waitForTimeout(300);
  await p.getByLabel('Set 1 weight in kg').first().fill('100');
  await p.getByLabel('Set 1 reps').first().fill('10');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(300);
  await skipRest();
  check('day tabs count logged sets', (await p.getByRole('tab', { name: /^Day 1, .*1 sets logged$/ }).count()) === 1);
  check('the live panel lists each day', await btn('D1, 1 sets. Go to this day').isVisible() && await btn('D2, 1 sets. Go to this day').isVisible());
  await btn('D1, 1 sets. Go to this day').click();
  await p.waitForTimeout(300);
  check('a day chip goes to that day', (await p.getByRole('tab', { name: /^Day 1,/ }).getAttribute('aria-selected')) === 'true');
  // The live panel stays put while the list scrolls
  await p.mouse.wheel(0, 2500);
  await p.waitForTimeout(500);
  const box = await p.getByLabel(/^Workout time/).boundingBox();
  check('the live panel stays at the top while scrolling', box && box.y < 80, JSON.stringify(box));
  check('Finish sits at the end of the list, and in the pinned panel', (await btn('Finish workout').count()) === 2 && await p.getByText("Saves today's sets from D1 + D2").isVisible());
  const fb = await btn('Finish workout').first().boundingBox();
  check('the panel Finish stays at the top right while scrolling', fb && fb.y >= 0 && fb.y < 80 && fb.x > 250, JSON.stringify(fb));
  check('it stays quiet until every set is done', (await p.getByRole('button', { name: 'Finish workout, every set done' }).count()) === 0);
  await shot('s-2-bottom');
  // Finish: effort and calories
  await btn('Finish workout').first().click();
  await p.waitForTimeout(900);
  check('Finish asks how hard it was', await p.getByRole('radio', { name: /^Hard/ }).isVisible());
  await btn('Keep training').click();
  await p.waitForTimeout(700);
  check('Keep training goes back', await p.getByLabel(/^Workout time/).isVisible());
  await btn('Finish workout').first().click();
  await p.waitForTimeout(900);
  await p.getByRole('radio', { name: /^Hard/ }).click();
  check('effort picked', (await p.getByRole('radio', { name: /^Hard/ }).getAttribute('aria-checked')) === 'true');
  await p.getByLabel('Calories burned, kcal').last().fill('350');
  await shot('s-3-finish');
  await btn('Finish workout').last().click();
  await p.waitForTimeout(1200);
  check('the summary shows the effort', (await p.getByRole('radio', { name: /^Hard/ }).last().getAttribute('aria-checked')) === 'true');
  await p.getByRole('radio', { name: /^All out/ }).last().click();
  await p.waitForTimeout(400);
  check('and it can be changed there', (await p.getByRole('radio', { name: /^All out/ }).last().getAttribute('aria-checked')) === 'true');
  await btn('See it in History').click();
  await p.waitForTimeout(1000);
  check('History shows the effort', await p.getByText(/All out/).first().isVisible());

  check('no page errors or native dialogs', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
