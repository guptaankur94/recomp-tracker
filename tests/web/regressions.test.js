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

  // Drop set on a finished exercise you opened again (with another exercise picked): stays open, stays put
  await page.tap('#ex-card-2'); await page.waitForTimeout(400);
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('block_d0_e0_s2').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const d0 = await page.evaluate(() => document.getElementById('block_d0_e0_s2').getBoundingClientRect().top);
  await page.evaluate(() => { openSetMenu(0, 2); }); await page.waitForTimeout(300);
  await page.click('#dialog-sheet >> text=Add a drop set'); await page.waitForTimeout(500);
  const d1 = await page.evaluate(() => { const c = document.getElementById('ex-card-0'); const b = document.getElementById('block_d0_e0_s2'); return { open: !c.classList.contains('preview') && !c.classList.contains('collapsed'), drop: !!b && !!b.querySelector('.drop-row'), top: b ? b.getBoundingClientRect().top : null }; });
  ok(d1.open && d1.drop, 'drop set on a reopened exercise: it stays open, with the drop row on that set');
  ok(d1.top !== null && Math.abs(d1.top - d0) < 2, `… and the set stays put (${Math.round(d0)} → ${Math.round(d1.top)})`);
  await page.evaluate(() => { const b = document.getElementById('block_d0_e0_s2'); const [w, r] = b.querySelectorAll('.drop-row input'); w.value = '35'; w.dispatchEvent(new Event('change')); r.value = '10'; r.dispatchEvent(new Event('change')); completeSet(0, 2); });
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => getDrops(0, 0, 2).some(d => d.w === '35' && d.r === '10')), '… and the drop is kept when the set is ticked again');

  // Fresh exercise: "+ Drop set" is there on the set you're about to do, including the last and an added one
  await page.evaluate(() => { focusExercise(1); }); await page.waitForTimeout(400);
  const n1 = await page.evaluate(() => getSetCount(0, 1, getAllExercisesForDay(0)[1].sets));
  for (let s = 1; s < n1; s++) await logSet(page, 1, s, 20, 12);
  await page.waitForTimeout(300);
  ok(await page.evaluate(n1 => { const row = document.getElementById(`block_d0_e1_s${n1}`).closest('.set-swipe'); const next = row.nextElementSibling; return !!next && next.classList.contains('set-link') && !!next.querySelector('.link-drop'); }, n1), `the last set (${n1}) shows "+ Drop set" before you tick it`);
  await page.tap('#add-set-1'); await page.waitForTimeout(400);
  await logSet(page, 1, n1, 20, 12);
  await page.waitForTimeout(300);
  const extra = await page.evaluate(n => { const row = document.getElementById(`block_d0_e1_s${n}`); const next = row && row.closest('.set-swipe').nextElementSibling; return { exists: !!row, drop: !!next && next.classList.contains('set-link') && !!next.querySelector('.link-drop') }; }, n1 + 1);
  ok(extra.exists && extra.drop, `the added set (${n1 + 1}) shows "+ Drop set" too`);
  await page.evaluate(n => document.getElementById(`block_d0_e1_s${n}`).closest('.set-swipe').nextElementSibling.querySelector('.link-drop').click(), n1 + 1);
  await page.waitForTimeout(400);
  ok(await page.evaluate(n => !!document.querySelector(`#block_d0_e1_s${n} .drop-row`), n1 + 1), '… and tapping it adds the drop row to that set');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
