// The screen must not move when you log: every frame for 1.5 s after each kind of logging tap, in the places
// it happens (mid-screen, low on the screen, at the bottom of the page), with the number pad and without.
const { serve, counter, openApp, seedHistory, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('stillness');
  const verbose = process.env.VERBOSE;

  // Record the viewport top of an element (by id) on every frame while act() runs, plus scrollY
  async function watch(page, id, act, ms = 1500) {
    await page.evaluate(id => {
      // A new recording ends the one before (each loop checks it's still the current one)
      const token = {}; window.__watch = token;
      const frames = window.__f = []; const t0 = performance.now();
      const f = () => { if (window.__watch !== token) return; const el = document.getElementById(id); frames.push({ t: performance.now() - t0, top: el ? el.getBoundingClientRect().top : null, y: scrollY }); if (performance.now() - t0 < 1600) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }, id);
    await act();
    await page.waitForTimeout(ms);
    return page.evaluate(() => window.__f);
  }
  const drift = frames => { const tops = frames.filter(f => f.top !== null).map(f => f.top); return tops.length ? Math.max(...tops) - Math.min(...tops) : 0; };
  const scrolled = frames => Math.max(...frames.map(f => f.y)) - Math.min(...frames.map(f => f.y));

  async function fresh(theme) {
    const { page, ctx } = await openApp(browser, server.url, { theme });
    await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8], [50, 8], [50, 8]], 1: [[20, 12], [20, 12], [20, 12]] } }]);
    await page.evaluate(() => { selectDay(0); startWorkout(); });
    await page.waitForTimeout(400);
    return { page, ctx };
  }
  const place = (page, id, y) => page.evaluate(([id, y]) => { const el = document.getElementById(id); window.scrollBy(0, el.getBoundingClientRect().top - y); }, [id, y]);
  const fill = (page, e, s, w, r) => page.evaluate(([e, s, w, r]) => { for (const [f, v] of [['w', w], ['r', r]]) { const i = document.getElementById(setKey(0, e, s, f)); i.value = String(v); saveVal(i.id, i.value); } }, [e, s, w, r]);

  for (const theme of ['vitruvian', 'classic']) {
    const { page, ctx } = await fresh(theme);
    // 0. Warm-ups: ticking one keeps the screen still; tapping a row edits it (kept for next time)
    await page.evaluate(() => document.querySelector('#ex-card-0 .wu-chk').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    let fr = await watch(page, 'wu_d0_e0_0', () => page.tap('#ex-card-0 .wu-chk'));
    ok(drift(fr) < 2, `${theme} 0 tick warm-up 1: it moves ${drift(fr).toFixed(1)} px`);
    const wuTop = await page.evaluate(() => document.getElementById('wu_d0_e0_1').getBoundingClientRect().top);
    await page.tap('#wu_d0_e0_1 .wu-val'); await page.waitForTimeout(400);
    ok(await page.isVisible('#set-edit-sheet .sheet') && (await page.textContent('#set-edit-title')) === 'Warm-up 2', `${theme} 0 tapping warm-up 2 opens its editor`);
    await page.fill('#set-edit-w', '35'); await page.fill('#set-edit-r', '5');
    await page.click('#set-edit-sheet .btn-primary'); await page.waitForTimeout(500);
    const wuNow = await page.evaluate(() => ({ top: document.getElementById('wu_d0_e0_1').getBoundingClientRect().top, text: document.getElementById('wu_d0_e0_1').textContent, own: customWarmup(getAllExercisesForDay(0)[0].name) }));
    ok(/35 kg × 5/.test(wuNow.text) && wuNow.own && wuNow.own[1].kg === 35 && wuNow.own[1].reps === 5 && wuNow.own.length === 2, `${theme} 0 saved as this exercise's warm-up: ${JSON.stringify(wuNow.own)}`);
    ok(Math.abs(wuNow.top - wuTop) < 2, `${theme} 0 and the row stays put (${Math.round(wuTop)} → ${Math.round(wuNow.top)})`);
    await page.tap('#ex-card-0 .wu-chk >> nth=1'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => !document.getElementById('set-edit-sheet').classList.contains('open')), `${theme} 0 the ✓ on a warm-up still just ticks it`);

    // 1. Tick ✓ with the set in the middle of the screen (set 1: the warm-up panel above folds)
    await fill(page, 0, 1, 50, 8); await place(page, 'block_d0_e0_s1', 420);
    fr = await watch(page, 'block_d0_e0_s1', () => page.tap('#block_d0_e0_s1 .check-btn'));
    ok(drift(fr) < 2 && scrolled(fr) < 400, `${theme} 1 tick set 1 mid-screen (warm-up folds above): set moves ${drift(fr).toFixed(1)} px`);
    // 2. Tick set 2 sitting low, just above where the rest timer appears
    await fill(page, 0, 2, 50, 8); await place(page, 'block_d0_e0_s2', 660);
    fr = await watch(page, 'block_d0_e0_s2', () => page.tap('#block_d0_e0_s2 .check-btn'));
    ok(drift(fr) < 2 && scrolled(fr) < 1, `${theme} 2 tick set 2 low on screen: set moves ${drift(fr).toFixed(1)} px, page scrolls ${scrolled(fr).toFixed(0)} px`);
    if (verbose) console.log(fr.filter((f, i) => i % 6 === 0).map(f => `${Math.round(f.t)}:${Math.round(f.top)}`).join(' '));
    // 3. Number pad: open on set 3, type, Next, Log set
    await place(page, 'block_d0_e0_s3', 380);
    fr = await watch(page, 'block_d0_e0_s3', async () => {
      await page.tap('#active_d0_e0_s3_w'); await page.waitForTimeout(500);
      for (const k of ['5', '0', 'next', '8']) await page.dispatchEvent(`#numpad [data-act="${k}"]`, 'pointerdown');
    }, 600);
    const padOpenTop = fr.filter(f => f.top !== null).pop().top;
    fr = await watch(page, 'block_d0_e0_s3', () => page.dispatchEvent('#numpad [data-act="log"]', 'pointerdown'), 300);
    ok(Math.abs(fr[fr.length - 1].top - padOpenTop) < 2, `${theme} 3 Log set on the pad (pad closes): set moves ${(fr[fr.length - 1].top - padOpenTop).toFixed(1)} px`);
    await page.waitForTimeout(1500);
    // 5. Last set of a page near the bottom: pad closing must not pull the page
    const last = await page.evaluate(() => getAllExercisesForDay(0).length - 1);
    await page.evaluate(last => focusExercise(last), last); await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
    const lastSet = await page.evaluate(last => { for (let s = 1; s < 9; s++) if (document.getElementById(setKey(0, last, s, 'w'))) return s; }, last);
    await page.tap(`#active_d0_e${last}_s${lastSet}_w`); await page.waitForTimeout(600);
    for (const k of ['2', '0', 'next', '1', '0']) await page.dispatchEvent(`#numpad [data-act="${k}"]`, 'pointerdown');
    await page.waitForTimeout(200);
    const before = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top, `block_d0_e${last}_s${lastSet}`);
    fr = await watch(page, `block_d0_e${last}_s${lastSet}`, () => page.dispatchEvent('#numpad [data-act="log"]', 'pointerdown'), 400);
    ok(Math.abs(fr[fr.length - 1].top - before) < 2, `${theme} 5 Log set at the bottom of the page: set moves ${(fr[fr.length - 1].top - before).toFixed(1)} px`);
    ok(page.errors.length === 0, `${theme} no errors ${page.errors.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
