// Bugs found in use, so they stay fixed
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('regressions');
  const { page } = await openApp(browser, server.url);
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8], [50, 8], [50, 8]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);

  // Finish an exercise, open its Done row again, tap + Add Set: it must stay open, on the new set, without moving
  const n = await page.evaluate(() => getSetCount(0, 0, getAllExercisesForDay(0)[0].sets));
  for (let s = 1; s <= n; s++) await logSet(page, 0, s, 50, 8);
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.getElementById('ex-card-0').classList.contains('collapsed')), 'finished exercise folds to its Done row');
  // You've moved on: you tapped the third exercise's preview to open it
  await page.tap('#ex-card-2'); await page.waitForTimeout(400);
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.getElementById('ex-card-0').classList.contains('collapsed')), 'tapping the Done row opens it');
  await page.evaluate(() => document.querySelector('#ex-card-0 .add-set-btn').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => document.querySelector('#ex-card-0 .add-set-btn').getBoundingClientRect().top);
  await page.tap('#ex-card-0 .add-set-btn'); await page.waitForTimeout(500);
  const st = await page.evaluate(n => {
    const card = document.getElementById('ex-card-0');
    const newSet = document.getElementById(`block_d0_e0_s${n + 1}`);
    return { open: !card.classList.contains('preview') && !card.classList.contains('collapsed'), hasNew: !!newSet, newTop: newSet ? newSet.getBoundingClientRect().top : null, others: [...document.querySelectorAll('#workout-content .ex-card')].filter(c => !c.classList.contains('preview') && !c.classList.contains('collapsed')).map(c => c.id) };
  }, n);
  ok(st.open && st.hasNew, `+ Add Set keeps the exercise open with set ${n + 1} ready (open: ${st.others.join(', ')})`);
  const after = await page.evaluate(() => document.querySelector('#ex-card-0 .add-set-btn').getBoundingClientRect().top);
  ok(Math.abs(after - before) < 2, `+ Add Set stays under your finger (${Math.round(before)} → ${Math.round(after)})`);
  ok(st.newTop !== null && st.newTop < after && after - st.newTop < 200, `the new set appears just above it (at ${Math.round(st.newTop)})`);
  await logSet(page, 0, n + 1, 50, 8);
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.getElementById('ex-card-0').classList.contains('collapsed')), 'logging the extra set folds it again');

  // Same again with no other exercise picked: still open, still under your finger
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#ex-card-0 .add-set-btn').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const b2 = await page.evaluate(() => document.querySelector('#ex-card-0 .add-set-btn').getBoundingClientRect().top);
  await page.tap('#ex-card-0 .add-set-btn'); await page.waitForTimeout(500);
  const a2 = await page.evaluate(() => ({ top: document.querySelector('#ex-card-0 .add-set-btn').getBoundingClientRect().top, open: !document.getElementById('ex-card-0').classList.contains('preview') && !document.getElementById('ex-card-0').classList.contains('collapsed') }));
  ok(a2.open && Math.abs(a2.top - b2) < 2, `second time: open, button stays put (${Math.round(b2)} → ${Math.round(a2.top)})`);

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
