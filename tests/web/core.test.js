// The core loop: focus mode, number pad, set checks, PR rules, edit sheet, Finish, and every tab in every theme
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('core');
  const { page } = await openApp(browser, server.url);
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[52.5, 8, 150], [52.5, 8, 150], [52.5, 8, 150]] } }]);
  await page.evaluate(() => selectDay(0)); await page.waitForTimeout(300);
  const key = k => page.dispatchEvent(`#numpad [data-act="${k}"]`, 'pointerdown');
  const val = (e, s, f) => page.evaluate(([e, s, f]) => localStorage.getItem(setKey(0, e, s, f)), [e, s, f]);

  // Focus mode and hints
  const kinds = await page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => c.classList.contains('preview') ? 'p' : 'open').join(''));
  ok(/^openp+$/.test(kinds), 'one exercise open, the rest previews: ' + kinds);
  ok(await page.evaluate(() => document.getElementById('workout-content').offsetHeight) < 2000, 'the day fits in ~1.5 screens');
  ok(/Last time 52.5 kg × 8 · ✓ logs it/.test(await page.textContent('#block_d0_e0_s1 .set-hint')), 'hint under the next set');
  ok(await page.getAttribute('#active_d0_e1_s1_w', 'placeholder').catch(() => null) === null, 'previews have no inputs');

  // Pad
  await page.evaluate(() => startWorkout()); await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.body.classList.contains('in-workout')), 'greeting hidden during a workout');
  await page.tap('#active_d0_e0_s1_w'); await page.waitForTimeout(300);
  ok(await page.isVisible('#numpad.open'), 'tap weight → number pad');
  await key('5'); await key('5'); await key('plus');
  ok(await page.inputValue('#active_d0_e0_s1_w') === '57.5' && await val(0, 1, 'w') === '57.5', '5 5 +2.5 → 57.5, saved while typing');
  await key('next'); await key('8'); await key('log'); await page.waitForTimeout(500);
  ok(await val(0, 1, 'done') === 'true' && await val(0, 1, 'pr') === 'weight', 'Log set → logged, a weight PR');
  ok(!(await page.isVisible('#numpad.open')) && await page.evaluate(() => !!restTimer), 'pad closes, rest starts');
  const links = await page.evaluate(() => document.querySelectorAll('#ex-card-0 .set-link').length);
  ok(links === 1, 'one drop/rest line, under the set just ticked');

  // Set checks
  await logSet(page, 0, 2, 525, 8); await page.waitForTimeout(300);
  ok(await val(0, 2, 'done') !== 'true' && /525 kg\?/.test(await page.textContent('#dialog-sheet')), '525 kg asks first');
  await page.click('#dialog-sheet >> text=Log 52.5 kg'); await page.waitForTimeout(400);
  ok(await val(0, 2, 'w') === '52.5' && await val(0, 2, 'done') === 'true', '… and "Log 52.5 kg" logs 52.5');
  await logSet(page, 0, 3, -5, 8);
  ok(await val(0, 3, 'done') !== 'true', 'negative weight refused');
  await page.evaluate(() => closePad());

  // PR rules
  ok(await page.evaluate(() => {
    const b = [{ w: 60, r: 5, restBefore: 0 }];
    return judgeSet({ w: 45, r: 20, restBefore: 0 }, b) === null       // light high reps: no 1RM record
      && judgeSet({ w: 57.5, r: 8, restBefore: 0 }, b) === 'e1rm'      // better est. 1RM
      && judgeSet({ w: 60, r: 6, restBefore: 0 }, b) === 'reps'        // more reps at a weight done before
      && judgeSet({ w: 20, r: 6, restBefore: 0 }, b) === null          // a weight never done: no rep record
      && judgeSet({ w: 60, r: 5, restBefore: 90 }, [{ w: 60, r: 5, restBefore: 120 }]) === 'rest';
  }), 'PR rules: weight / reps / 1RM (≤12 reps) / rest before the set');

  // Edit sheet keeps the set ticked
  await page.tap('#block_d0_e0_s1'); await page.waitForTimeout(300);
  await page.fill('#set-edit-w', '60'); await page.click('#set-edit-sheet .btn-primary'); await page.waitForTimeout(400);
  ok(await val(0, 1, 'w') === '60' && await val(0, 1, 'done') === 'true', 'edit sheet: saved, still ticked');

  // Finish exercise: one smooth fold, the next opens below the Done row
  await logSet(page, 0, 3, 52.5, 8);
  const rec = await page.evaluate(() => new Promise(res => {
    const out = []; const t0 = performance.now();
    const f = () => { const c = document.getElementById('ex-card-0'); out.push({ t: performance.now() - t0, h: c.getBoundingClientRect().height, top: c.getBoundingClientRect().top, folded: c.classList.contains('collapsed') }); if (performance.now() - t0 < 1800) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  const post = rec.filter(r => r.folded);
  const steps = post.slice(1).map((r, i) => post[i].h - r.h);
  ok(post.length > 10 && steps.every(s => s >= -0.5) && Math.max(...steps) < 150, `fold is gradual (${post.length} frames, biggest step ${Math.round(Math.max(...steps))} px)`);
  const pos = await page.evaluate(() => ({ live: document.querySelector('#hero.is-live').getBoundingClientRect().bottom, done: document.getElementById('ex-card-0').getBoundingClientRect().top, next: document.getElementById('ex-card-1').classList.contains('preview') }));
  ok(Math.abs(pos.done - pos.live - 8) <= 3 && !pos.next, 'Done row under the panel; next exercise open');

  // Finish workout (with cardio) → saved session, summary, history
  await page.evaluate(() => { saveCardioDraft([{ type: 'run', min: 10, intensity: 'easy', when: 'after' }]); });
  await page.evaluate(() => openFinishSheet()); await page.waitForTimeout(300);
  await page.evaluate(() => confirmFinish()); await page.waitForTimeout(600);
  const s = await page.evaluate(() => getHistory()[0]);
  ok(s.exercises[0].sets.length === 3 && s.cardio && s.cardio.length === 1 && !(await page.evaluate(() => !!workoutClock())), 'Finish saves sets and cardio, stops the clock');
  ok(await page.isVisible('#summary'), 'summary shows');
  await page.evaluate(() => closeSummary()); await page.waitForTimeout(300);

  // Every tab in every theme: no errors, no sideways scroll
  for (const t of ['vitruvian', 'neon', 'codex', 'classic']) {
    await page.evaluate(id => localStorage.setItem('recomp_theme', id), t);
    await page.reload(); await page.waitForTimeout(500);
    for (const v of ['workout', 'plan', 'history', 'progress', 'settings']) {
      await page.evaluate(v => switchView(v), v); await page.waitForTimeout(250);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > 390) ok(false, `${t} ${v}: sideways scroll ${w}`);
    }
  }
  ok(true, 'all tabs × 4 themes render');
  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
