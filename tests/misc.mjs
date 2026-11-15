import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4173/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ok = (n, v, extra = '') => console.log((v ? 'PASS ' : 'FAIL ') + n + (extra ? ' ' + extra : ''));
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args });
// ---- offline
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errs = []; const ext = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) ext.push(r.url()); });
  await page.goto(URL); await page.waitForTimeout(5000);
  ok('service worker active', await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
  ok('no external network requests (no CDN)', ext.length === 0, ext.join(','));
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(3500);
  ok('works offline after first load (title visible)', (await page.textContent('body')).includes('REZONX ELITES'));
  await page.click('text=Play (7 sols)'); await page.click('.pick[data-id="mei"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(1500);
  ok('game starts offline', await page.evaluate(() => __redsol.G.state.status === 'playing' && !__redsol.G.state.hold));
  console.log('offline errors:', errs.length ? errs.join('|') : 'none'); await ctx.close();
}
// ---- phone portrait: rotate prompt
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(2500);
  ok('portrait phone shows rotate prompt', await page.evaluate(() => getComputedStyle(document.querySelector('#rotate')).display !== 'none')); await ctx.close();
}
// ---- small landscape phone + prompt + night + draw calls
{
  const ctx = await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(URL); await page.waitForTimeout(2500); await page.screenshot({ path: 'shots/sm-title.png' });
  await page.tap('text=Play (7 sols)'); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/sm-select.png' }); await page.tap('.pick[data-id="diego"]'); await page.waitForTimeout(800); await page.screenshot({ path: 'shots/sm-brief.png' });
  await page.tap('[data-go]'); await page.waitForTimeout(800);
  await page.evaluate(() => { const s = __redsol.G.state; const c = s.crew[s.playerIdx]; c.x = 14; c.z = 1.2; __redsol.world.yaw = -0.3; });
  await page.waitForTimeout(2500); await page.screenshot({ path: 'shots/sm-prompt.png' });
  const calls = await page.evaluate(() => { const i = __redsol.world.renderer.info.render; return { calls: i.calls, tris: i.triangles }; }); console.log('render info', JSON.stringify(calls));
  await page.evaluate(() => { const s = __redsol.G.state; s.t = 138; s.crew[s.playerIdx].x = 0; s.crew[s.playerIdx].z = 8; __redsol.world.yaw = 0.3; });
  await page.waitForTimeout(2500); await page.screenshot({ path: 'shots/sm-night.png' });
  await page.evaluate(() => { const s = __redsol.G.state; s.t = 3; }); await page.waitForTimeout(2500); await page.screenshot({ path: 'shots/sm-dawn.png' });
  console.log('small phone errors:', errs.length ? errs.join('|') : 'none'); await ctx.close();
}
await browser.close();
