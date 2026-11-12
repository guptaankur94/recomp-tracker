// Settings switches: rest timer, default rest, sounds, vibration, keep screen on; weekly backup reminder
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');
const { sideScroll } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('batch4');
  const { page } = await openApp(browser, server.url);
  await seedHistory(page, [3, 6, 9].map(d => ({ daysAgo: d, day: 0, sets: { 0: [[50, 8]] } })));

  // 1. Switches in Settings
  await page.evaluate(() => switchView('settings')); await page.waitForTimeout(400);
  const switches = await page.$$eval('#settings-list [role="switch"]', els => els.map(e => `${e.querySelector('.row-title').textContent}=${e.getAttribute('aria-checked')}`));
  ok(switches.length === 6 && switches.every(s => s.endsWith('=true')), '1 six real switches, all on by default: ' + switches.join(' | '));
  const sw = t => `#settings-list [role="switch"]:has-text("${t}")`;
  await page.click(sw('Sounds')); await page.waitForTimeout(200);
  ok(await page.getAttribute(sw('Sounds'), 'aria-checked') === 'false' && await page.evaluate(() => pref('sound') === false), '1 tapping flips it and saves it');

  // 2. Sounds off: no tone is played
  ok(await page.evaluate(() => { window.__osc = 0; audioCtx = { currentTime: 0, destination: {}, createOscillator() { window.__osc++; return { type: '', frequency: { setValueAtTime() {} }, connect: () => ({ connect() {} }), start() {}, stop() {} }; }, createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) }; } };
    playChime(); const off = window.__osc; setPref('sound', true); playChime(); return off === 0 && window.__osc === 2; }), '2 sounds off: silent; on: plays');

  // 3. Vibration off: no vibration
  ok(await page.evaluate(() => { window.__v = 0; navigator.vibrate = () => { window.__v++; return true; }; setPref('vibration', false); haptic('success'); const off = window.__v; setPref('vibration', true); haptic('success'); return off === 0 && window.__v === 1; }), '3 vibration off: none; on: vibrates');

  // 4. Rest timer after each set: off → no timer
  await page.evaluate(() => { setPref('autoRest', false); switchView('workout'); selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  await logSet(page, 0, 1, 50, 8);
  ok(await page.evaluate(() => !restTimer && localStorage.getItem(setKey(0, 0, 1, 'done')) === 'true'), '4 rest timer off: set logged, no timer');
  await page.evaluate(() => setPref('autoRest', true));
  await logSet(page, 0, 2, 50, 8);
  ok(await page.evaluate(() => !!restTimer), '4 on: the timer starts');
  await page.evaluate(() => stopRestTimer());

  // 5. Keep screen on
  const lock = await page.evaluate(async () => {
    window.__locks = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__locks++; return { addEventListener() {}, release: async () => {} }; } } });
    wakeLock = null; setPref('keepAwake', false); await syncWakeLock(); const off = window.__locks;
    setPref('keepAwake', true); await syncWakeLock(); return [off, window.__locks];
  });
  ok(lock[0] === 0 && lock[1] === 1, '5 keep screen on: off asks for no lock, on asks for one: ' + lock);

  // 6. Default rest, used for exercises that bring none
  await page.evaluate(() => switchView('settings')); await page.waitForTimeout(300);
  await page.click('#settings-list >> text=Default rest'); await page.waitForTimeout(300);
  await page.click('#dialog-choices >> text=2:00'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => pref('defaultRest') === 120) && /2:00/.test(await page.textContent('#settings-list')), '6 default rest set to 2:00');
  await page.evaluate(() => { const h = getHistory(); h.unshift({ id: Date.now() - 3600e3, dateStr: localDateStr(new Date(Date.now() - 3600e3)), day: 'Custom', title: 'x', exercises: [{ name: 'Sled Push Made Up', sets: [{ set: 1, weight: 40, reps: 10 }] }] }); localStorage.setItem('recomp_history', JSON.stringify(h)); finishAndSaveWorkout; });
  await page.evaluate(() => { localStorage.removeItem('recomp_clock'); Object.keys(localStorage).filter(k => /^(active_)?d\d+_e\d+_|_meta$/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await page.evaluate(() => repeatWorkout(getHistory()[0].id)); await page.waitForTimeout(400);
  ok(await page.evaluate(() => getAllExercisesForDay(currentDayIdx)[0].rest === 120), '6 a repeated one-off exercise with no rest gets 2:00');

  // 7. Weekly backup reminder
  await page.evaluate(() => { localStorage.removeItem('recomp_last_backup'); switchView('workout'); localStorage.removeItem('recomp_clock'); updateStats(); });
  await page.waitForTimeout(300);
  ok(await page.isVisible('.backup-banner') && /Never backed up/.test(await page.textContent('.backup-banner')), '7 never backed up: banner on the home card');
  await page.click('.backup-banner >> text=Later'); await page.waitForTimeout(200);
  ok(!(await page.isVisible('.backup-banner')), '7 Later hides it (for 3 days)');
  await page.evaluate(() => { localStorage.removeItem('recomp_backup_snooze'); localStorage.setItem('recomp_last_backup', String(Date.now() - 8 * 864e5)); updateStats(); });
  ok(/Last backup 8 days ago/.test(await page.textContent('.backup-banner')), '7 a week after the last backup it comes back');
  await page.evaluate(() => markBackedUp()); await page.waitForTimeout(200);
  ok(!(await page.isVisible('.backup-banner')), '7 backing up clears it');
  await page.evaluate(() => { localStorage.setItem('recomp_last_backup', String(Date.now() - 30 * 864e5)); setPref('backupWeekly', false); updateStats(); renderBackupBadge(); });
  ok(!(await page.isVisible('.backup-banner')) && await page.evaluate(() => !document.getElementById('tab-nav-settings').classList.contains('badged')), '7 reminder off: no banner, no badge');

  // 8. Settings fits in all themes
  for (const t of ['vitruvian', 'neon', 'codex', 'classic']) {
    await page.evaluate(id => localStorage.setItem('recomp_theme', id), t);
    await page.reload(); await page.waitForTimeout(500);
    await page.evaluate(() => switchView('settings')); await page.waitForTimeout(300);
    const w = await sideScroll(page);
    if (w > 0) ok(false, `8 ${t}: page moves sideways by ${w} px`);
  }
  ok(true, '8 Settings fits in all themes');
  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
