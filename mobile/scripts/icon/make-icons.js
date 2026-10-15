// Renders the app icons from mark.js with Chromium:
//   node scripts/icon/make-icons.js   (PLAYWRIGHT / CHROMIUM as for e2e)
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const mark = require('./mark');

const OUT = path.join(__dirname, '..', '..', 'assets', 'images');
// name, size, content scale (Android's adaptive icon keeps the art inside its safe zone), background
const ICONS = [
  ['icon.png', 1024, 1, true],
  ['adaptive-icon.png', 1024, 0.62, false],
  ['splash-icon.png', 512, 1, false],
  ['favicon.png', 192, 1, true]
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  for (const [name, size, scale, background] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inset = (512 * (1 - scale)) / 2;
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-inset / scale} ${-inset / scale} ${512 / scale} ${512 / scale}">${mark({ background })}</svg>
    </body></html>`);
    await page.screenshot({ path: path.join(OUT, name), omitBackground: !background, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(name, size);
  }
  await browser.close();
})();
