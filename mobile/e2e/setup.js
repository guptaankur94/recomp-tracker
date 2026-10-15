const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SP = process.argv[2];
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ` (${x})` : ''}`);
const URL = 'http://127.0.0.1:' + (process.env.PORT || 8793) + '/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss(); });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    return p;
  };
  const btn = (p, n, exact = true) => p.getByRole('button', { name: n, exact });
  const radio = (p, group, n) => p.getByRole('radiogroup', { name: group }).getByRole('radio', { name: n });
  const toast = p => p.getByRole('alert').last().innerText().catch(() => '');
  const about = async (p, { name = 'Priya', sex = 'Female' } = {}) => {
    await btn(p, 'Get started').click(); await p.waitForTimeout(300);
    await p.getByLabel('Your name').fill(name);
    await radio(p, 'Sex', sex).click();
    await p.getByLabel('Age').fill('29'); await p.getByLabel('Height (cm)').fill('165'); await p.getByLabel('Weight (kg)').fill('62');
    await btn(p, 'Continue').click(); await p.waitForTimeout(300);
  };

  // 1. Ready-made route
  let p = await fresh();
  check('first launch opens setup', await p.getByRole('heading', { name: 'Welcome to Recomp' }).isVisible());
  await p.screenshot({ path: `${SP}/s-1-welcome.png` });
  await btn(p, 'Get started').click(); await p.waitForTimeout(300);
  await btn(p, 'Continue').click(); await p.waitForTimeout(200);
  check('sex is required', await p.getByText('Pick one so your targets are right.').isVisible());
  await radio(p, 'Sex', 'Female').click();
  await p.getByLabel('Age').fill('9');
  await p.getByLabel('Height (cm)').fill('165'); await p.getByLabel('Weight (kg)').fill('62');
  await btn(p, 'Continue').click(); await p.waitForTimeout(200);
  check('age checked', await p.getByText('Age should be 13–90.').isVisible());
  await p.getByLabel('Age').fill('29');
  await p.getByLabel('Your name').fill('Priya');
  await p.screenshot({ path: `${SP}/s-2-about.png` });
  await btn(p, 'Continue').click(); await p.waitForTimeout(300);
  check('training step', await p.getByRole('heading', { name: 'Your training' }).isVisible());
  await radio(p, 'Days per week', '4').click();
  await radio(p, 'Where do you train?', /^Full gym/).click();
  await p.screenshot({ path: `${SP}/s-3-training.png` });
  await btn(p, 'Continue').click(); await p.waitForTimeout(300);
  check('suggests a plan by name', await p.getByText(/We suggest Upper \/ Lower 4× for you/).isVisible());
  await btn(p, /^Pick a ready-made plan/, false).click(); await p.waitForTimeout(300);
  check('recommended plan picked', await p.getByRole('button', { name: 'Use Upper / Lower 4×' }).isVisible());
  await radio(p, undefined, 'Home').click().catch(async () => p.getByRole('radio', { name: 'Home', exact: true }).click());
  await p.waitForTimeout(200);
  check('filter switches the pick', await btn(p, /^Use (Dumbbell|Bodyweight)/, false).isVisible());
  await p.getByRole('radio', { name: 'All', exact: true }).click();
  await p.getByRole('radio', { name: /^Strength 5×5/ }).click();
  await p.screenshot({ path: `${SP}/s-4-plans.png` });
  await btn(p, 'Use Strength 5×5').click(); await p.waitForTimeout(500);
  check('finish screen', await p.getByRole('heading', { name: "You're all set" }).isVisible());
  check('greets by name', await p.getByText('Priya, your plan is ready.').isVisible());
  await p.screenshot({ path: `${SP}/s-5-finish.png` });
  await btn(p, 'Start training').click(); await p.waitForTimeout(800);
  check('lands on Workout with the plan', (await p.getByText(/Workout · Strength 5×5/).count()) > 0);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  check('setup not shown again', (await p.getByRole('heading', { name: 'Welcome to Recomp' }).count()) === 0);
  await p.getByRole('tab', { name: 'Plan', exact: true }).click(); await p.waitForTimeout(300);
  await btn(p, 'Create with AI. ChatGPT, Claude, Gemini').click(); await p.waitForTimeout(400);
  check('answers prefill the AI form', (await p.getByLabel('Height cm').inputValue()) === '165' && await radio(p, 'Days a week', '4').getAttribute('aria-checked') === 'true');
  await p.context().close();

  // 2. Build your own, saved
  p = await fresh();
  await about(p);
  await btn(p, 'Continue').click(); await p.waitForTimeout(300);
  await btn(p, /^Create your own plan/, false).click(); await p.waitForTimeout(600);
  check('builder opens on day 1', (await p.getByLabel('Day name').inputValue()) === 'Monday');
  for (const day of [0, 1, 2]) {
    if (day > 0) { await btn(p, `Back to Edit plan`).click().catch(() => {}); await p.waitForTimeout(200); await btn(p, new RegExp(`^Day ${day + 1} · `), false).click(); await p.waitForTimeout(200); }
    await btn(p, '+ Add exercise').click(); await p.waitForTimeout(200);
    await p.getByLabel('Search exercises').fill('push-ups');
    await p.getByRole('button', { name: /^Add Push-ups\./ }).first().click(); await p.waitForTimeout(200);
    await btn(p, 'Done').click(); await p.waitForTimeout(200);
  }
  await btn(p, 'Use this plan').click(); await p.waitForTimeout(600);
  check('builder returns to the finish screen', await p.getByRole('heading', { name: "You're all set" }).isVisible());
  await p.context().close();

  // 3. AI, backed out: falls back to the suggested plan
  p = await fresh();
  await about(p);
  await btn(p, 'Continue').click(); await p.waitForTimeout(300);
  await btn(p, /^Create your plan with AI/, false).click(); await p.waitForTimeout(600);
  check('AI screen prefilled from setup', (await p.getByLabel('Age').inputValue()) === '29');
  await btn(p, 'Skip').click(); await p.waitForTimeout(600);
  check('backing out still leaves a plan', await p.getByRole('heading', { name: 'Ready when you are' }).isVisible() && await p.getByText(/started you on Full Body/).isVisible());
  await p.context().close();

  // 4. Restore a backup from the welcome screen
  p = await fresh();
  const chooser = p.waitForEvent('filechooser');
  await btn(p, 'I have a backup from the web app').click();
  await (await chooser).setFiles(`${SP}/backup.json`); await p.waitForTimeout(1500);
  check('backup restored from welcome', (await toast(p)).includes('37 workouts'), await toast(p));
  await p.getByRole('tab', { name: 'History', exact: true }).click(); await p.waitForTimeout(500);
  check('history is there', (await p.getByRole('button', { name: /^Day \d .*sets/ }).count()) === 37);
  await p.context().close();

  // 5. Skip
  p = await fresh();
  await btn(p, 'Skip for now').click(); await p.waitForTimeout(800);
  check('skip starts on Full Body 3×', (await toast(p)).includes('Starting you on Full Body 3×'));
  await p.context().close();

  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
