const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SP = process.argv[2];
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ` (${x})` : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:' + (process.env.PORT || 8793) + '' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss(); });
  const tab = n => p.getByRole('tab', { name: n, exact: true }).click();
  const btn = (n, exact = true) => p.getByRole('button', { name: n, exact });
  const toast = () => p.getByRole('alert').last().innerText().catch(() => '');
  const shot = n => p.screenshot({ path: `${SP}/${n}.png` });
  const wait = ms => p.waitForTimeout(ms);
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' });
  await wait(1200);
  if (await p.getByRole('button', { name: 'Skip for now' }).isVisible().catch(() => false)) { await p.getByRole('button', { name: 'Skip for now' }).click(); await p.waitForTimeout(1200); }
  await tab('Plan'); await wait(500);
  check('plan tab shows the default plan', await p.getByRole('heading', { name: 'Full Body', exact: true }).isVisible());
  await shot('p-1-plan');

  // Edit: rename, change an exercise, add a swap, add a day, set Sunday, save
  await btn('Edit plan').click(); await wait(500);
  await p.getByLabel('Plan name').fill('My Full Body');
  await btn(/^Day 1 · Full Body A\./, false).click(); await wait(300);
  await btn('Move down: Barbell Back Squat').click();
  check('exercise moved', (await p.getByRole('button', { name: /Edit$/ }).first().getAttribute('aria-label')).startsWith('Barbell Bench Press'));
  await btn(/^Barbell Back Squat\./, false).click(); await wait(300);
  await btn('Working sets: more').click();
  await btn('Rest: less').click();
  await p.getByRole('radio', { name: '3 heavy lift' }).click();
  await p.getByLabel('Technique cue').fill('Brace hard');
  await shot('p-2-exercise');
  await btn('Swap: Leg Press. Change').click(); await wait(300);
  await p.getByLabel('Search exercises').fill('goblet');
  await p.getByRole('button', { name: /^Add Goblet Squat\./ }).first().click(); await wait(300);
  check('swap changed', await btn('Swap: Goblet Squat. Change').isVisible());
  await btn('Done').click(); await wait(200);
  await btn('Done').click(); await wait(200);
  await btn('+ Add day').click(); await wait(300);
  await p.getByLabel('Day name').fill('Arms');
  await btn('+ Add exercise').click(); await wait(300);
  await p.getByLabel('Search exercises').fill('barbell curl');
  await p.getByRole('button', { name: /^Add Barbell Curl\./ }).first().click(); await wait(300);
  await btn('Done').click(); await wait(300);
  await p.getByRole('radiogroup', { name: 'Sunday' }).getByRole('radio', { name: 'Day 4' }).click();
  await shot('p-3-editor');
  await btn('Save plan').click(); await wait(700);
  check('saved', (await toast()).includes('Plan saved'), await toast());
  check('new name', await p.getByRole('heading', { name: 'My Full Body', exact: true }).isVisible());
  check('4 days', await p.getByText(/^4 days · 19 exercises/).isVisible(), await p.getByText(/days ·/).first().innerText());
  check('Sunday in the week strip', await p.getByLabel('Sunday: Arms').isVisible());
  await shot('p-4-saved');

  // Start a day from the plan
  await btn('Start').nth(3).click(); await wait(600);
  check('Start opens that day', await p.getByRole('heading', { name: 'Arms', exact: true }).isVisible());
  await tab('Plan'); await wait(400);

  // Delete a day with undo; empty day blocks saving; discard confirmation
  await btn('Edit plan').click(); await wait(400);
  await btn(/^Day 4 · Arms\./, false).click(); await wait(300);
  await btn('Delete this day').click(); await wait(300);
  check('day deleted', (await p.getByRole('button', { name: /^Day \d · .*Edit$/ }).count()) === 3);
  await btn('Undo').click(); await wait(300);
  check('undo delete day', (await p.getByRole('button', { name: /^Day \d · .*Edit$/ }).count()) === 4);
  await btn('+ Add day').click(); await wait(300);
  await btn('Done').click(); await wait(300);
  await btn('Save plan').click(); await wait(400);
  check('empty day blocks saving', (await toast()).includes('Day 5 needs at least one exercise'), await toast());
  check('jumps to the empty day', await p.getByLabel('Day name').isVisible());
  await btn('Back to Edit plan').click(); await wait(300);
  await btn('Cancel').first().click(); await wait(300);
  check('asks before discarding', await p.getByText('Discard your changes?').isVisible());
  await btn('Discard').click(); await wait(500);
  check('discarded', (await p.getByText(/^4 days · 19 exercises/).count()) === 1);

  // Ready-made with undo
  await btn('Ready-made. Proven programmes').click(); await wait(500);
  await p.getByRole('heading', { name: 'Strength 5×5', exact: true }).click(); await wait(300);
  await btn('Use Strength 5×5').click(); await wait(600);
  check('ready-made used', await p.getByRole('heading', { name: 'Strength 5×5', exact: true }).isVisible());
  await btn('Undo').click(); await wait(500);
  check('undo back to my plan', await p.getByRole('heading', { name: 'My Full Body', exact: true }).isVisible());

  // AI: form, copy prompt, paste reply, preview, use
  await btn('Create with AI. ChatGPT, Claude, Gemini').click(); await wait(500);
  await p.getByRole('radio', { name: 'Female' }).click();
  await p.getByLabel('Age').fill('29'); await p.getByLabel('Height cm').fill('165'); await p.getByLabel('Weight kg').fill('62');
  await p.getByRole('radiogroup', { name: 'Days a week' }).getByRole('radio', { name: '4' }).click();
  await btn('Copy prompt').click(); await wait(500);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  check('prompt copied with details', clip.includes('Create a 4-day-per-week workout plan') && clip.includes('- Sex: female') && clip.includes('- Height: 165 cm'), clip.slice(0, 80));
  await p.getByLabel('Chatbot reply').fill('Sure! ```json\n{"planName":"Glute Focus","days":[{"title":"Lower","exercises":[{"name":"Hip Thrust","sets":4,"reps":"8-10","weight":"60 kg","rest":120,"warmup":2}]},{"title":"Upper","exercises":[{"name":"Lat Pulldown"}]}]}\n```');
  await wait(300);
  check('reply read', await p.getByText('✓ Glute Focus').isVisible());
  await shot('p-5-ai');
  await btn('Use this plan').click(); await wait(600);
  check('AI plan used', await p.getByRole('heading', { name: 'Glute Focus', exact: true }).isVisible());
  await btn('Create with AI. ChatGPT, Claude, Gemini').click(); await wait(500);
  check('details remembered in profile', (await p.getByLabel('Height cm').inputValue()) === '165');
  await p.getByLabel('Chatbot reply').fill('no plan here');
  check('bad reply explained', await p.getByText(/Couldn't find a plan in that/).isVisible());
  await btn('Cancel').click(); await wait(400);

  // Import a file
  require('fs').writeFileSync(`${SP}/plan-file.json`, JSON.stringify({ planName: 'From File', days: [{ title: 'Only', exercises: [{ name: 'Push-ups' }] }] }));
  const chooser = p.waitForEvent('filechooser');
  await btn('Import a file. .json or .txt plan').click();
  await (await chooser).setFiles(`${SP}/plan-file.json`); await wait(600);
  check('file previewed', await p.getByRole('heading', { name: 'From File', exact: true }).isVisible());
  await btn('Use this plan').click(); await wait(600);
  check('file plan used', await p.getByRole('heading', { name: 'From File', exact: true }).isVisible());

  // Build my own
  await btn('Build my own. Pick days and exercises').click(); await wait(500);
  check('build starts on day 1', (await p.getByLabel('Day name').inputValue()) === 'Monday');
  await btn('+ Add exercise').click(); await wait(300);
  await p.getByLabel('Search exercises').fill('plank');
  await p.getByRole('button', { name: /^Add Plank\./ }).first().click(); await wait(300);
  await btn('Done').click(); await wait(300);
  await p.getByLabel('Plan name').fill('Core Only');
  await btn('Use this plan').click(); await wait(600);
  check('built plan used', await p.getByRole('heading', { name: 'Core Only', exact: true }).isVisible());

  await p.reload({ waitUntil: 'networkidle' }); await wait(1500);
  await tab('Plan'); await wait(400);
  check('plan kept after reload', await p.getByRole('heading', { name: 'Core Only', exact: true }).isVisible());
  for (const n of ['Plan']) {
    const over = await p.evaluate(() => [...document.querySelectorAll('div,input')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && (r.right > 391 || r.left < -1) && (el.innerText || el.value || '').trim(); }).map(el => (el.innerText || el.value).slice(0, 20)));
    check(`${n} fits the screen`, over.length === 0, over.slice(0, 3).join(' | '));
  }
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
