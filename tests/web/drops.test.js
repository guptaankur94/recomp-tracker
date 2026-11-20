// Drop sets as a trainer runs them: only straight after the set, lighter each time, part of the set, rest after all
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('drops');
  const { page } = await openApp(browser, server.url, { time: '2026-11-20T18:00:00' });
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8], [50, 8], [50, 8]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  const dropBtns = () => page.evaluate(() => [...document.querySelectorAll('#ex-card-0 .set-link')].map((l, i) => l.querySelector('.link-drop') ? `${i + 1}:${l.querySelector('.link-drop').textContent.trim()}` : null).filter(Boolean).join(' '));
  const drops = s => page.evaluate(s => getDrops(0, 0, s).filter(d => Number(d.r) > 0), s);

  // 1. Not before the set
  ok(await dropBtns() === '', '1 before any set is ticked: no "Drop set" anywhere');
  // 2. Straight after the set: offered on that set only
  await logSet(page, 0, 1, 50, 8);
  ok(await dropBtns() === '1:Drop set', '2 after set 1: "Drop set" on set 1 only: ' + await dropBtns());
  ok(await page.evaluate(() => new Set([...document.querySelectorAll('#ex-card-0 .set-link')].map(l => Math.round(l.getBoundingClientRect().height))).size === 1), '2 rows with and without the button are the same height');
  // 3. The sheet: ~20% lighter, same reps
  await page.click('#ex-card-0 .link-drop'); await page.waitForTimeout(400);
  ok((await page.textContent('#drop-title')) === 'Drop 1 · Set 1' && await page.inputValue('#drop-w') === '40' && await page.getAttribute('#drop-r', 'placeholder') === '8', '3 "Drop 1 · Set 1", suggested 40 kg (20% off 50), reps 8');
  await page.fill('#drop-w', '55'); await page.click('#drop-sheet .finish-btn'); await page.waitForTimeout(300);
  ok(await page.isVisible('#drop-sheet .sheet') && /lighter than the set \(50 kg\)/.test(await page.textContent('#toast')), '3 a drop heavier than the set is refused');
  await page.fill('#drop-w', '40'); await page.fill('#drop-r', '6');
  await page.clock.runFor(30000);
  await page.click('#drop-sheet .finish-btn'); await page.waitForTimeout(400);
  ok(JSON.stringify(await drops(1)) === JSON.stringify([{ w: '40', r: '6' }]) && /Drop 1/.test(await page.textContent('#block_d0_e0_s1')), '3 logged inside set 1: Drop 1 40 kg × 6');
  ok(await page.evaluate(() => restIsLive(0, 0, 1) && Date.now() - restTimer.startAt < 2000 && restLengthSec() === getSetRest(0, 0, 1, getAllExercisesForDay(0)[0])), '3 the set\'s rest starts again from the top');
  ok(await page.evaluate(() => localStorage.getItem(setKey(0, 0, 1, 'done')) === 'true'), '3 the set stays ticked');
  // 4. Another drop: 15% off the last, up to 3
  ok(await dropBtns() === '1:Another drop', '4 then "Another drop"');
  await page.evaluate(() => addDrop(0, 1)); await page.waitForTimeout(300);
  ok((await page.textContent('#drop-title')) === 'Drop 2 · Set 1' && await page.inputValue('#drop-w') === '35', '4 drop 2 suggested 35 kg (15% off 40)');
  await page.fill('#drop-r', '5'); await page.click('#drop-sheet .finish-btn'); await page.waitForTimeout(300);
  await page.evaluate(() => addDrop(0, 1)); await page.waitForTimeout(300);
  await page.click('#drop-sheet .finish-btn'); await page.waitForTimeout(300);
  ok((await drops(1)).length === 3 && await dropBtns() === '', '4 three drops, then no more');
  // 5. After the next set, the moment has passed
  await logSet(page, 0, 2, 50, 8);
  ok(await dropBtns() === '2:Drop set', '5 after set 2: offered on set 2, gone from set 1');
  await page.evaluate(() => addDrop(0, 1)); await page.waitForTimeout(200);
  ok(!(await page.isVisible('#drop-sheet .sheet')) && /rest is over/.test(await page.textContent('#toast')), '5 a late drop on set 1 is refused with the reason');
  await page.evaluate(() => { openSetMenu(0, 1); }); await page.waitForTimeout(300);
  const menu = await page.textContent('#dialog-sheet');
  ok(!/Drop set now|Another drop/.test(menu) && /Remove drop 3/.test(menu), '5 set 1\'s menu: no drop, but "Remove drop 3"');
  await page.click('#dialog-sheet >> text=Remove drop 3'); await page.waitForTimeout(300);
  ok((await drops(1)).length === 2, '5 removing the last drop');
  // 6. Saved with the set, counted in volume, never a PR
  await page.evaluate(() => { stopRestTimer(); openFinishSheet(); }); await page.waitForTimeout(300);
  await page.evaluate(() => confirmFinish()); await page.waitForTimeout(500);
  const s1 = await page.evaluate(() => getHistory()[0].exercises[0].sets[0]);
  ok(JSON.stringify(s1.drops) === JSON.stringify([{ weight: 40, reps: 6 }, { weight: 35, reps: 5 }]), '6 saved with set 1: ' + JSON.stringify(s1.drops));
  ok(await page.evaluate(s => setVolume(s) === 50 * 8 + 40 * 6 + 35 * 5, s1), '6 counted in the set\'s volume');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
