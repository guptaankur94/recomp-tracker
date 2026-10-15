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
  const toast = () => p.getByRole('alert').last().innerText().catch(() => '');
  const btn = name => p.getByRole('button', { name, exact: true });
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await p.getByRole('button', { name: 'Skip for now' }).isVisible().catch(() => false)) { await p.getByRole('button', { name: 'Skip for now' }).click(); await p.waitForTimeout(1200); }

  // Pin the test to Day 1 (Full Body A: Barbell Back Squat, then Barbell Bench Press)
  await p.getByRole('tab', { name: /^Day 1,/ }).click();
  await p.waitForTimeout(300);
  await p.getByLabel('Set 1 weight in kg').first().fill('60');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(400);
  const timer = await p.getByRole('timer').getAttribute('aria-label').catch(() => '');
  check('rest timer starts with the next set', /^Rest: 3:00 left\. Next: Set 2$/.test(timer || ''), timer);
  check('set 1 shows as done', await btn('Set 1: 60 kg times 8. Edit').first().isVisible());
  await btn('Rest 15 seconds more').click();
  await p.waitForTimeout(300);
  const t2 = await p.getByRole('timer').getAttribute('aria-label');
  check('+15 on the timer', /^Rest: 3:1\d left/.test(t2), t2);
  await shot('w-1-resting');
  await btn('Skip rest').click();
  await p.waitForTimeout(400);
  check('skip hides the timer', (await p.getByRole('timer').count()) === 0);

  // Ticking with no reps and no history is refused
  await btn('Done with set 2').first().click();
  await p.waitForTimeout(300);
  check('reps needed', (await toast()).includes('Enter the reps you did first'));

  // Per-set rest, drop set, then finish the exercise
  await btn('Rest after set 2: more 15 seconds').first().click();
  await p.getByLabel('Set 2 weight in kg').first().fill('62.5');
  await p.getByLabel('Set 2 reps').first().fill('7');
  await btn('Add a drop set to set 2').first().click();
  await p.getByLabel('Drop 1 weight').first().fill('40');
  await p.getByLabel('Drop 1 reps').first().fill('10');
  await btn('Done with set 2').first().click();
  await btn('Skip rest').click();
  await p.getByLabel('Set 3 weight in kg').first().fill('62.5');
  await p.getByLabel('Set 3 reps').first().fill('6');
  await shot('w-2-sets');
  await btn('Done with set 3').first().click();
  await p.waitForTimeout(400);
  check('finished exercise folds', await btn('Barbell Back Squat, done. Show sets').isVisible());
  const nextLabel = await p.getByRole('timer').getAttribute('aria-label');
  check('timer points to the next exercise', nextLabel.includes('Next: Barbell Bench Press · Set 1'), nextLabel);
  await btn('Skip rest').click();
  check('progress count', await p.getByText('3 / 18 sets').isVisible());

  // Swap the second exercise
  await btn('Swap to Dumbbell Bench Press').click();
  await p.waitForTimeout(300);
  check('swap shows the alternative', await p.getByRole('heading', { name: 'Dumbbell Bench Press' }).isVisible());
  await p.getByLabel('Set 1 weight in kg').first().fill('22');
  await p.getByLabel('Set 1 reps').first().fill('10');
  await btn('Done with set 1').first().click();
  await btn('Skip rest').click();

  // Add an exercise, remove it, undo
  await btn('+ Add exercise').click();
  await p.waitForTimeout(600);
  await p.getByLabel('Search exercises').fill('face pull');
  await p.waitForTimeout(200);
  await p.getByRole('button', { name: /^Add Face Pull\. Back/ }).click();
  await p.waitForTimeout(600);
  check('added exercise shows', await p.getByRole('heading', { name: 'Face Pull' }).isVisible());
  await btn('Remove').click();
  await p.waitForTimeout(300);
  check('removed', (await p.getByRole('heading', { name: 'Face Pull' }).count()) === 0);
  await btn('Undo').click();
  await p.waitForTimeout(300);
  check('undo remove', await p.getByRole('heading', { name: 'Face Pull' }).isVisible());

  // Reload mid-workout: everything is still there
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  check('draft kept after reload', await btn('Barbell Back Squat, done. Show sets').isVisible());
  check('swap kept after reload', await p.getByRole('heading', { name: 'Dumbbell Bench Press' }).isVisible());
  check('unsaved badge on the day', (await p.getByRole('tab', { name: /Unsaved/ }).count()) === 1);

  // Finish
  await btn('Finish workout').click();
  await p.waitForTimeout(1000);
  check('summary opens', await p.getByText('Workout complete').isVisible());
  check('summary counts sets', await p.getByLabel('Sets: 4').isVisible());
  await shot('w-3-summary');
  await btn('Done').click();
  await p.waitForTimeout(600);
  check('workout cleared after finishing', (await btn('Finish workout').count()) === 0);
  await tab('History');
  await p.waitForTimeout(500);
  const rows = p.getByRole('button', { name: /^Day 1 .*sets/ });
  check('history has the workout', (await rows.count()) === 1);
  await rows.first().click();
  await p.waitForTimeout(500);
  check('drop set saved', await p.getByText('↳ Drop 1: 40 kg × 10').isVisible());
  check('swapped exercise saved under its own name', await p.getByText('Dumbbell Bench Press').isVisible());
  check('per-set rest saved', (await p.getByText('3:15').count()) >= 1);
  await btn('Back').click();

  // A record: heavier squat on the custom day, then save and keep going
  await tab('Workout');
  await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /^Custom workout/ }).click();
  await btn('+ Add exercise').click();
  await p.waitForTimeout(500);
  await p.getByLabel('Search exercises').fill('back squat');
  await p.getByRole('button', { name: /^Add Barbell Back Squat\./ }).first().click();
  await p.waitForTimeout(500);
  const ph = await p.getByLabel('Set 1 weight in kg').first().getAttribute('placeholder');
  check('suggestion adds 2.5 kg after hitting the top of the range', ph === '62.5', ph);
  await p.getByLabel('Set 1 weight in kg').first().fill('65');
  await p.getByLabel('Set 1 reps').first().fill('8');
  await btn('Done with set 1').first().click();
  await p.waitForTimeout(400);
  check('PR toast', (await toast()).includes('New PR · Barbell Back Squat: 65 kg × 8'), await toast());
  await shot('w-4-pr');
  await btn('Skip rest').click();
  await btn('Save and keep going').click();
  await p.waitForTimeout(600);
  check('save and keep going', (await toast()).startsWith('Saved. Today:'), await toast());
  await tab('History');
  await p.waitForTimeout(400);
  check('same day merges into one workout', (await p.getByRole('button', { name: /sets/ }).filter({ hasText: 'PR' }).count()) === 1);

  // Clear with undo
  await tab('Workout');
  await p.getByRole('tab', { name: /^Day 2/ }).click();
  await p.getByLabel('Set 1 reps').first().fill('5');
  await p.waitForTimeout(200);
  await btn('Clear unsaved sets').click();
  await p.waitForTimeout(300);
  check('cleared', (await p.getByLabel('Set 1 reps').first().inputValue()) === '');
  await btn('Undo').click();
  await p.waitForTimeout(300);
  check('undo clear', (await p.getByLabel('Set 1 reps').first().inputValue()) === '5');

  for (const name of ['Workout', 'History']) {
    await tab(name);
    await p.waitForTimeout(400);
    const over = await p.evaluate(() => [...document.querySelectorAll('div,input')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && (r.right > 391 || r.left < -1) && (el.innerText || el.value || '').trim() && !(function inX(n) { for (let a = n.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; })(el); }).map(el => (el.innerText || el.value).slice(0, 20)));
    check(`${name}: fits the screen`, over.length === 0, over.slice(0, 3).join(' | '));
  }
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 600)); process.exit(1); });
