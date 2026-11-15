import { chromium } from 'playwright-core';
const url = process.env.URL || 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [tag, w, h, touch] of [['desk', 1280, 720, false], ['phone', 667, 375, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url + '?debug=1'); await page.waitForTimeout(2500);
  await (touch ? page.tap('text=Play (7 sols)') : page.click('text=Play (7 sols)')); await page.waitForTimeout(400); await (touch ? page.tap('.pick[data-id="mei"]') : page.click('.pick[data-id="mei"]')); await page.waitForTimeout(500); await (touch ? page.tap('[data-go]') : page.click('[data-go]')); await page.waitForTimeout(500);
  const fps = async () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(+(n / 4).toFixed(1)); }; requestAnimationFrame(f); }));
  await page.evaluate(() => { const s = __redsol.G.state; s.sched[0] = []; s.evPtr = 0; const c = s.crew[s.playerIdx]; c.x = 2; c.z = 9; __redsol.world.yaw = 0.3; __redsol.world.pitch = 0.2; s.t = 40; });
  await page.waitForTimeout(1500); await page.screenshot({ path: `shots/w-${tag}-normal.png` }); console.log(tag, 'normal fps (software GL)', await fps(), 'stage', await page.evaluate(() => __redsol.world.stage));
  await page.evaluate(() => { const s = __redsol.G.state; s.sched[0] = [{ type: 'storm', at: s.t }]; s.evPtr = 0; }); await page.waitForTimeout(500);
  await page.evaluate(() => __redsol.fast(62)); await page.waitForTimeout(1800); await page.screenshot({ path: `shots/w-${tag}-storm.png` }); console.log(tag, 'storm fps (software GL)', await fps(), 'stage', await page.evaluate(() => __redsol.world.stage), JSON.stringify(await page.evaluate(() => __redsol.G.state.weather.storm)));
  await page.evaluate(() => __redsol.fast(45)); await page.waitForTimeout(1500); console.log(tag, 'storm after ease-back =', await page.evaluate(() => +__redsol.G.state.weather.storm.toFixed(2)));
  console.log(tag, 'errors:', errs.length ? errs.join('|') : 'none'); await ctx.close();
}
await browser.close();
