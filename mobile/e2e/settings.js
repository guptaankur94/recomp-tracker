// Settings: profile (saves as you go, checks values, shows targets), backup reminder, reset.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SP = process.argv[2];
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ` (${x})` : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss(); });
  const btn = (n, exact = true) => p.getByRole('button', { name: n, exact });
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 8793) + (process.env.BASE || '') + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const chooser = p.waitForEvent('filechooser');
  await btn('I have a backup from the web app').click();
  await (await chooser).setFiles(`${SP}/backup.json`); await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(500);
  check('backup reminder when never backed up', await p.getByText('Never backed up · back up now').isVisible());
  check('profile from the backup', await btn(/^Test\. Goal 80 kg/, false).isVisible());
  check('no targets without an age', await p.getByText(/Add sex, birth date \(or age\)/).isVisible());
  // Profile: wrong values are explained and not saved; right ones save and targets appear
  await btn(/^Test\. Goal 80 kg/, false).click(); await p.waitForTimeout(400);
  await p.getByLabel('Height (cm)').fill('17');
  check('height checked', await p.getByText('Height should be 100–250 cm.').isVisible());
  await p.getByLabel('Height (cm)').fill('180');
  check('height accepted', (await p.getByText('Height should be 100–250 cm.').count()) === 0);
  await p.getByLabel('Birth day').fill('31'); await p.getByLabel('Month').fill('2'); await p.getByLabel('Year').fill('1990');
  check('impossible date explained', await p.getByText('Enter a real date: day, month, year.').isVisible());
  await p.getByLabel('Birth day').fill('15'); await p.getByLabel('Month').fill('6'); await p.waitForTimeout(400);
  check('age from birth date', await p.getByText(/^Age 3\d$/).isVisible());
  await p.getByRole('radio', { name: 'On my feet a lot + training' }).click();
  await p.waitForTimeout(300);
  // Settings stays loaded under Profile, so the last match is this screen's
  check('targets appear', await p.getByLabel(/^kcal: [\d,]+$/).last().isVisible() && await p.getByLabel(/^Protein: \d+ g$/).last().isVisible());
  check('saved as you go', await p.getByText('✓ Saved').isVisible());
  await p.screenshot({ path: `${SP}/st-1-profile.png` });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  check('profile kept after reload', (await p.getByLabel('Height (cm)').inputValue()) === '180' && (await p.getByLabel('Year').inputValue()) === '1990');
  await btn('Back to Settings').click(); await p.waitForTimeout(500);
  check('targets in Settings', await p.getByLabel(/^kcal: [\d,]+$/).first().isVisible());
  // Export clears the reminder
  const download = p.waitForEvent('download');
  await btn('Export backup').click();
  const file = await download;
  const text = require('fs').readFileSync(await file.path(), 'utf8');
  check('backup file is the web app format', JSON.parse(text).app === 'recomp-tracker' && JSON.parse(text).history.length === 37);
  await p.waitForTimeout(500);
  check('reminder cleared', await p.getByText('Last backup today').isVisible());
  await p.screenshot({ path: `${SP}/st-2-settings.png` });
  // Reset needs RESET typed
  await btn('Reset all data').click(); await p.waitForTimeout(300);
  check('reset waits for RESET', await btn('Delete everything').isDisabled());
  await p.getByLabel('Type RESET to confirm').fill('reset');
  await btn('Delete everything').click(); await p.waitForTimeout(1200);
  check('reset returns to setup', await p.getByRole('heading', { name: 'Welcome to Recomp' }).isVisible());
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  check('everything gone after reload', await p.getByRole('heading', { name: 'Welcome to Recomp' }).isVisible());
  check('no page errors or native dialogs', errors.length === 0, errors.join(' | ').slice(0, 500));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 700)); process.exit(1); });
