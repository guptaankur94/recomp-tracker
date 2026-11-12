// Supersets, notes, plate maths, rest countdown, do later / skip today
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('batch2');
  const { page } = await openApp(browser, server.url, { time: '2026-11-12T18:00:00' });
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[52.5, 8], [52.5, 8], [52.5, 8]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  const names = await page.evaluate(() => getAllExercisesForDay(0).map(e => e.name));
  const state = () => page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => `${c.id.replace('ex-card-', '')}:${c.classList.contains('preview') ? 'p' : c.classList.contains('collapsed') ? 'd' : c.classList.contains('skipped') ? 's' : 'open'}`).join(' '));

  // 1. Superset from the exercise menu
  await page.tap('#ex-card-0 [aria-label$="options: note, superset, later, skip"]'); await page.waitForTimeout(300);
  ok(new RegExp(`Superset with ${names[1]}`).test(await page.textContent('#dialog-sheet')), '1 menu offers "Superset with the next exercise"');
  await page.click(`#dialog-sheet >> text=Superset with ${names[1]}`); await page.waitForTimeout(400);
  ok(await page.evaluate(() => getCustomPlan().days[0].exercises[0].superset === true), '1 saved on the plan');
  ok((await state()).startsWith('0:open 1:open 2:p'), '1 both exercises of the pair are open: ' + await state());
  ok(/Superset A/.test(await page.textContent('#ex-card-0 .ss-banner')) && (await page.textContent('#ex-card-1 .ss-tag')) === 'A2', '1 banner and A1/A2 tags');
  ok(await page.evaluate(() => /"superset": true/.test(planToJson())), '1 kept in the plan file (copy plan / AI)');
  // Set for set, rest after the pair
  await logSet(page, 0, 1, 52.5, 8);
  ok(await page.evaluate(() => !restTimer), '1 after A1 set 1: no rest, straight on');
  ok(/now .*set 1/.test(await page.evaluate(() => document.getElementById('toast').textContent)), '1 says "Superset · now <B>, set 1"');
  await logSet(page, 1, 1, 20, 12);
  ok(await page.evaluate(() => !!restTimer && restTimer.next.startsWith(`Next: ${getAllExercisesForDay(0)[0].name} · Set 2`)), '1 after B set 1: rest starts, next is A set 2: ' + await page.evaluate(() => restTimer && restTimer.next));
  await page.evaluate(() => stopRestTimer());
  // Unlink
  await page.evaluate(() => toggleSuperset(1)); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !getCustomPlan().days[0].exercises[0].superset) && /0:open 1:p/.test(await state()), '1 remove superset: back to one open: ' + await state());

  // 2. Notes
  await page.evaluate(() => { editNote(0); }); await page.waitForTimeout(300);
  await page.fill('#dialog-input', 'Seat 4, grip just outside the rings');
  await page.click('#dialog-confirm-btn'); await page.waitForTimeout(300);
  ok((await page.textContent('#ex-card-0 .ex-note')).includes('Seat 4'), '2 note shows on the card');
  await page.evaluate(() => { editNote(0); }); await page.waitForTimeout(300);
  ok((await page.inputValue('#dialog-input')) === 'Seat 4, grip just outside the rings', '2 editing starts from the note');
  await page.fill('#dialog-input', ''); await page.click('#dialog-confirm-btn'); await page.waitForTimeout(300);
  ok(!(await page.$('#ex-card-0 .ex-note')), '2 empty removes it');
  await page.evaluate(() => { localStorage.setItem('recomp_notes', JSON.stringify({ X: 'kept' })); });
  ok(await page.evaluate(() => JSON.parse(buildBackupJson()).notes.X === 'kept'), '2 notes are in backups');

  // 3. Plate maths on the pad (barbell exercise)
  const bb = await page.evaluate(() => getAllExercisesForDay(0).findIndex(e => isBarbellExercise(e)));
  ok(bb >= 0, '3 day 1 has a barbell lift: ' + names[bb]);
  await page.evaluate(bb => focusExercise(bb), bb); await page.waitForTimeout(300);
  const field = await page.evaluate(bb => { for (let s = 1; s < 9; s++) { const el = document.getElementById(setKey(0, bb, s, 'w')); if (el) return '#' + el.id; } return null; }, bb);
  await page.tap(field); await page.waitForTimeout(300);
  for (const k of ['6', '1', 'dot', '2', '5']) await page.dispatchEvent(`#numpad [data-act="${k}"]`, 'pointerdown');
  ok((await page.textContent('#pad-plates')) === '61.25 kg · Each side: 20 (0.625 kg short)', '3 live plates, exact: ' + await page.textContent('#pad-plates'));
  await page.evaluate(() => { const i = padTarget(); i.value = ''; saveVal(i.id, ''); });
  for (const k of ['1', '0', '0']) await page.dispatchEvent(`#numpad [data-act="${k}"]`, 'pointerdown');
  ok((await page.textContent('#pad-plates')).includes('Each side: 25 + 15'), '3 100 kg → each side 25 + 15: ' + await page.textContent('#pad-plates'));
  ok(await page.evaluate(() => platesPerSide(20).text === 'Just the bar' && /Lighter/.test(platesPerSide(15).text) && platesPerSide(62.5).text === 'Each side: 20 + 1.25'), '3 bar only, lighter than the bar, 62.5 → 20 + 1.25');
  await page.evaluate(() => closePad());

  // 4. Rest countdown: buzz at 3-2-1, then the next set glows
  await page.evaluate(() => focusExercise(0)); await page.waitForTimeout(200);
  await logSet(page, 0, 2, 52.5, 8);
  await page.evaluate(() => { window.__h = 0; const h = window.haptic; window.haptic = t => { window.__h++; return h(t); }; });
  await page.clock.runFor(200 * 1000);
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__h >= 3), '4 three buzzes in the last 3 seconds (' + await page.evaluate(() => window.__h) + ' haptics)');
  ok(await page.evaluate(() => !!document.querySelector('#workout-content .check-btn.next.ready-pulse')), '4 when rest ends the next set glows');

  // 5. Do later / skip today
  await page.evaluate(() => doLater(0)); await page.waitForTimeout(300);
  const order = await page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => +c.id.replace('ex-card-', '')));
  ok(order[order.length - 1] === 0 && order[0] === 1, '5 do later moves it to the end: ' + order.join(','));
  ok((await state()).startsWith('1:open'), '5 the next exercise opens instead');
  ok(await page.evaluate(() => getCustomPlan().days[0].exercises[0].name) === names[0], '5 the plan is unchanged');
  await page.evaluate(() => skipToday(1)); await page.waitForTimeout(300);
  ok(/1:s/.test(await state()) && /2:open/.test(await state()), '5 skip today: a quiet row, next one opens: ' + await state());
  ok(await page.evaluate(() => /Skipped today/.test(document.getElementById('ex-card-1').textContent)), '5 says skipped today');
  // Tomorrow it's back to normal
  await page.clock.setSystemTime(new Date('2026-11-13T18:00:00'));
  await page.evaluate(() => renderWorkout()); await page.waitForTimeout(300);
  const tomorrow = await page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => +c.id.replace('ex-card-', '')));
  ok(tomorrow[0] === 0 && !(await state()).includes(':s'), '5 next day: plan order, nothing skipped');
  await page.clock.setSystemTime(new Date('2026-11-12T19:00:00'));
  await page.evaluate(() => renderWorkout());
  await page.tap('#ex-card-1'); await page.waitForTimeout(300);
  ok(!(await state()).includes('1:s'), '5 tapping a skipped row brings it back');

  // 6. Finish with a skipped exercise: the day still counts as complete
  await page.evaluate(() => { const n = getAllExercisesForDay(0).length; for (let i = 0; i < n; i++) if (i !== 2) localStorage.setItem(`active_d0_e${i}_skip`, localDateStr(new Date())); renderWorkout(); });
  ok(await page.evaluate(() => { const p = dayProgress(0); return p.total === getSetCount(0, 2, getAllExercisesForDay(0)[2].sets); }), '6 skipped exercises are out of the day\'s total');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
