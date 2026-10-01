// Run with: node tests/shorts-edge.mjs <path-to-playwright> [content-source]
// Browser APIs are real; WXT storage/runtime and YouTube's rate reset are simulated.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transformWithOxc } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const settings = (await readFile('shared/settings.ts', 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const content = (await readFile(process.argv[3] || 'entrypoints/content.ts', 'utf8'))
  .replace(/^import \{[\s\S]*?from '\.\.\/shared\/settings';\r?\n/, '')
  .replace(/^import type .*;\r?\n/gm, '').replace('export default ', '');
const compiled = (await transformWithOxc(settings + '\n' + content, 'fixture.ts')).code;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.route('https://www.youtube.com/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<video class="html5-main-video" style="width:315px;height:560px" loop></video><input>',
  }));
  await page.goto('https://www.youtube.com/shorts/regression');
  await page.evaluate(() => {
    window.storage = { defineItem: (_key, { fallback }) => ({
      getValue: async () => fallback, watch: () => () => {},
    }) };
    window.browser = { runtime: { onMessage: { addListener() {} } } };
    // Expose the otherwise closed controller only in this harness.
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function () { return attachShadow.call(this, { mode: 'open' }); };
    const cleanups = [];
    window.invalidate = () => cleanups.forEach(fn => fn());
    window.defineContentScript = ({ main }) => {
      window.started = main({
        requestAnimationFrame: fn => requestAnimationFrame(fn),
        addEventListener: (target, type, fn, options) => {
          target.addEventListener(type, fn, options);
          cleanups.push(() => target.removeEventListener(type, fn, options));
        },
        onInvalidated: fn => cleanups.push(fn),
      });
    };
  });
  await page.addScriptTag({ content: compiled });
  await page.evaluate(() => window.started);
  const readSpeed = () => page.locator('video').evaluate(video => video.playbackRate);
  const click = selector => page.evaluate(selector => {
    document.querySelector('[data-vsc-controlled]').shadowRoot.querySelector(selector).click();
    // Simulate the site overwriting the requested rate immediately after input.
    document.querySelector('video').playbackRate = 1;
  }, selector);
  const expectSpeed = async speed => {
    await page.waitForFunction(speed => document.querySelector('video').playbackRate === speed, speed, { timeout: 1500 });
    assert.equal(await readSpeed(), speed);
  };
  for (const speed of [1.25, 1.5, 1.75, 2]) {
    await click('.vsc-increase');
    await expectSpeed(speed);
  }
  for (const speed of [1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25]) {
    await click('.vsc-decrease');
    await expectSpeed(speed);
  }
  await click('.vsc-speed');
  await expectSpeed(0.5);
  await page.evaluate(() => {
    window.pageShortcutCalls = 0;
    window.addEventListener('keydown', () => { window.pageShortcutCalls++; }, true);
  });
  const key = code => page.evaluate(code => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, altKey: true, cancelable: true, bubbles: true }));
    document.querySelector('video').playbackRate = 1;
  }, code);
  await key('ArrowUp');
  await expectSpeed(0.75);
  await key('ArrowDown');
  await expectSpeed(0.5);
  await key('Digit0');
  await expectSpeed(1);
  assert.equal(await page.evaluate(() => window.pageShortcutCalls), 0);
  await page.locator('input').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', {
    code: 'ArrowUp', altKey: true, bubbles: true, cancelable: true,
  })));
  assert.equal(await readSpeed(), 1, 'Editable targets must keep their keyboard events');
  // Exhaust the retry budget; it must terminate even if another controller wins.
  await click('.vsc-increase');
  await expectSpeed(1.25);
  for (let i = 0; i < 4; i++) {
    await page.locator('video').evaluate(video => { video.playbackRate = 1; });
    await page.waitForTimeout(30);
  }
  assert.equal(await readSpeed(), 1, 'Retries must be bounded');
  await click('.vsc-increase');
  await expectSpeed(1.5);
  await page.evaluate(() => {
    history.pushState({}, '', '/watch?v=regression');
    document.dispatchEvent(new Event('yt-navigate-start'));
    document.dispatchEvent(new Event('yt-navigate-finish'));
    document.querySelector('video').playbackRate = 2;
  });
  await expectSpeed(2);
  await page.evaluate(() => window.invalidate());
  assert.equal(await page.locator('[data-vsc-controlled]').count(), 0);
  console.log('PASS: Edge Shorts buttons, presets, shortcuts, editable input, bounded retries, watch navigation, cleanup');
} finally {
  await browser.close();
}
