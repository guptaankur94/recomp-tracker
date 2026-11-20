// Finishing an exercise is your call: Exercise complete → confirm (or one more set) → effort → fold
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');
const { showDoneSets } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('complete');
  const { page } = await openApp(browser, server.url);
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[52.5, 8], [52.5, 8], [52.5, 8]], 1: [[20, 12], [20, 12], [20, 12]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  const n = await page.evaluate(() => getSetCount(0, 0, getAllExercisesForDay(0)[0].sets));
  const state = () => page.evaluate(() => { const c = document.getElementById('ex-card-0'); return c.classList.contains('collapsed') ? 'folded' : c.classList.contains('preview') ? 'preview' : 'open'; });

  // 1. The last set doesn't fold the exercise: the choice appears
  for (let s = 1; s <= n; s++) await logSet(page, 0, s, 52.5, 8);
  await page.waitForTimeout(1500);
  ok(await state() === 'open', '1 after the last set the exercise stays open');
  ok(await page.isVisible('#complete-0') && /All 3 sets done/.test(await page.textContent('#complete-0')), '1 "All 3 sets done" with "Exercise complete" and "+ One more set"');

  // 2. "+ One more set" from the panel: set 4, still open, the panel goes until it's ticked
  const before = await page.evaluate(() => document.getElementById('add-set-0').getBoundingClientRect().top);
  await page.tap('#add-set-0'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !!document.getElementById('block_d0_e0_s4')) && !(await page.isVisible('#complete-0')), '2 one more set: set 4 to do, panel gone');
  await logSet(page, 0, 4, 52.5, 6);
  await page.waitForTimeout(400);
  ok(await page.isVisible('#complete-0') && /All 4 sets done/.test(await page.textContent('#complete-0')), '2 after set 4: the choice again');

  // 3. Exercise complete → confirm sheet → "Add one more set" also works from there
  await page.click('#complete-0 .ex-complete-btn'); await page.waitForTimeout(400);
  ok(/Mark .* as done\?/.test(await page.textContent('#complete-title')) && /4 sets · best 52.5 kg × 8/.test(await page.textContent('#complete-sub')), '3 asks "Mark … as done?" with the sets and best');
  await page.click('#complete-sheet >> text=+ Add one more set'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !!document.getElementById('block_d0_e0_s5')) && await state() === 'open', '3 "Add one more set" from the sheet adds set 5');
  await logSet(page, 0, 5, 50, 8);
  await page.waitForTimeout(300);

  // 4. Yes → effort → fold, next exercise opens; effort saved
  await page.click('#complete-0 .ex-complete-btn'); await page.waitForTimeout(400);
  await page.click('#complete-sheet >> text=Yes, it\'s done'); await page.waitForTimeout(300);
  ok(/How hard was/.test(await page.textContent('#complete-title')) && (await page.locator('#complete-body .ex-effort button').count()) === 4, '4 then: how hard was it (4 choices)');
  await page.click('#complete-body .ex-effort button:has-text("Hard")'); await page.waitForTimeout(1300);
  ok(await state() === 'folded', '4 rating it folds the exercise');
  ok(await page.evaluate(() => !document.getElementById('ex-card-1').classList.contains('preview')), '4 and the next exercise opens');
  ok(await page.evaluate(() => localStorage.getItem('active_d0_e0_effort')) === '9', '4 effort stored (Hard = 9)');

  // 5. Opening it again shows how it felt; adding a set reopens the choice
  await showDoneSets(page, 0);
  ok(/Felt hard/.test(await page.textContent('#ex-card-0 .ex-felt')), '5 reopened: "Felt hard · change"');
  await page.evaluate(() => collapseExercise(0)); await page.waitForTimeout(300);

  // 6. Skip effort; saving keeps per-exercise effort; summary and history show it
  for (let s = 1; s <= 3; s++) await logSet(page, 1, s, 20, 12);
  await page.evaluate(() => { askCompleteExercise(1); confirmCompleteExercise(); rateExercise(null); });
  await page.waitForTimeout(1200);
  ok(await page.evaluate(() => document.getElementById('ex-card-1').classList.contains('collapsed') && !localStorage.getItem('active_d0_e1_effort')), '6 skipping the rating still folds it, no effort saved');
  await page.evaluate(() => { openFinishSheet(); }); await page.waitForTimeout(300);
  await page.evaluate(() => confirmFinish()); await page.waitForTimeout(600);
  const saved = await page.evaluate(() => getHistory()[0].exercises.map(e => [e.name, e.sets.length, e.effort || null]));
  ok(saved[0][1] === 5 && saved[0][2] === 9 && saved[1][2] === null, '6 saved: 5 sets with effort 9, the other without: ' + JSON.stringify(saved));
  ok(/hard/.test(await page.textContent('#summary-list')), '6 summary shows how it felt');
  await page.evaluate(() => closeSummary()); await page.waitForTimeout(300);

  // 7. Next time: the hint says how it felt; felt easy → a step heavier
  await page.evaluate(() => { const h = getHistory(); h[0].exercises[0].effort = 6; h[0].id -= 864e5 * 3; h[0].dateStr = localDateStr(new Date(h[0].id)); localStorage.setItem('recomp_history', JSON.stringify(h)); selectDay(0); renderWorkout(); });
  await page.waitForTimeout(300);
  const hint = await page.textContent('#block_d0_e0_s1 .set-hint');
  ok(/felt easy/.test(hint) && /try 55 kg × 8/.test(hint), '7 felt easy last time → "try 55 kg × 8": ' + hint.trim());

  // 8. A finished exercise: tap its Done row, the app asks what to change
  await page.evaluate(() => { localStorage.setItem('active_d0_e0_closed', 'true'); for (let s = 1; s <= 3; s++) { localStorage.setItem(setKey(0, 0, s, 'w'), '55'); localStorage.setItem(setKey(0, 0, s, 'r'), '8'); localStorage.setItem(setKey(0, 0, s, 'done'), 'true'); } localStorage.setItem('active_d0_e0_effort', '8'); renderWorkout(); });
  await page.waitForTimeout(300);
  ok(/felt moderate/.test(await page.textContent('#ex-card-0')), '8 the Done row says how it felt');
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  const menu = await page.textContent('#dialog-sheet');
  ok(/What would you like to change/.test(menu) && /How hard it felt \(moderate\)/.test(menu) && /Edit a set/.test(menu) && /Add another set/.test(menu) && /reopen/.test(menu), '8 tapping it asks what to change');
  await page.click('#dialog-sheet >> text=How hard it felt (moderate)'); await page.waitForTimeout(400);
  await page.click('#complete-body .ex-effort button:has-text("All out")'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => localStorage.getItem('active_d0_e0_effort')) === '10' && await page.evaluate(() => document.getElementById('ex-card-0').classList.contains('collapsed')), '8 effort changed to all out; it stays done and folded');
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  await page.click('#dialog-sheet >> text=Edit a set'); await page.waitForTimeout(400);
  await page.click('#dialog-sheet >> text=Set 2 · 55 kg × 8'); await page.waitForTimeout(400);
  ok(await page.isVisible('#set-edit-sheet .sheet') && (await page.textContent('#set-edit-title')) === 'Set 2', '8 "Edit a set" → which set → its edit sheet');
  await page.fill('#set-edit-r', '9'); await page.click('#set-edit-sheet .btn-primary'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => localStorage.getItem(setKey(0, 0, 2, 'r'))) === '9' && await page.evaluate(() => document.getElementById('ex-card-0').classList.contains('collapsed')), '8 set 2 changed to 9 reps, still done');
  await page.tap('#ex-card-0'); await page.waitForTimeout(400);
  await page.click('#dialog-sheet >> text=Not done yet: reopen it'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !document.getElementById('ex-card-0').classList.contains('collapsed') && !!document.getElementById('complete-0')), '8 reopen: open again, with "Exercise complete" to call it later');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
