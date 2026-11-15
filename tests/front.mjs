import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
await page.goto(process.env.URL || 'http://localhost:4173/'); await page.waitForTimeout(2500);
await page.click('text=Play (7 sols)'); await page.click('.pick[data-id="diego"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(500);
await page.evaluate(() => { const s = __redsol.G.state; const c = s.crew[s.playerIdx]; c.x = 2; c.z = 9; __redsol.world.yaw = Math.PI; __redsol.world.dist = 5.5; __redsol.world.pitch = 0.12; });
await page.waitForTimeout(3500); await page.screenshot({ path: 'shots/front.png' }); await browser.close();
