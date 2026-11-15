import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4173/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
const ev = (f, a) => page.evaluate(f, a);
const simWait = async (sec) => { const t0 = await ev(() => __redsol.G.state.totalT); await page.waitForFunction((a) => __redsol.G.state.totalT >= a, t0 + sec, { timeout: 90000, polling: 200 }); };
const view = () => ev(() => { const s = __redsol.G.state; const c = s.crew[0]; c.x = 2; c.z = 9; c.inShelter = false; __redsol.world.yaw = 0.35; __redsol.world.pitch = 0.2; });
const ok = (name, v) => console.log((v ? 'PASS ' : 'FAIL ') + name);
await page.goto(URL); await page.waitForTimeout(2500);
await page.click('text=Play (7 sols)'); await page.click('.pick[data-id="mei"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(500);
// A: walk to panel0 and clean it
await ev(() => { const s = __redsol.G.state; const c = s.crew[s.playerIdx]; c.x = -22.2; c.z = 4.2; });
const d0 = await ev(() => __redsol.G.state.panels[0].dust);
await page.keyboard.down('KeyE'); await simWait(4); await page.keyboard.up('KeyE');
const d1 = await ev(() => __redsol.G.state.panels[0].dust); ok(`clean panel (dust ${d0.toFixed(2)} -> ${d1.toFixed(2)})`, d1 < d0 - 0.1);
// B: walking with keyboard moves the player
const p0 = await ev(() => { const c = __redsol.G.state.crew[0]; return [c.x, c.z]; });
await page.keyboard.down('KeyW'); await simWait(1.5); await page.keyboard.up('KeyW');
const p1 = await ev(() => { const c = __redsol.G.state.crew[0]; return [c.x, c.z]; }); ok('W moves player', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 2);
// C: AI crew act on their own
const ai0 = await ev(() => __redsol.G.state.crew.slice(1).map((c) => [c.x, c.z])); await simWait(8);
const ai1 = await ev(() => __redsol.G.state.crew.slice(1).map((c) => [c.x, c.z, !!c.task]));
ok('AI crew move/work', ai1.some((a, i) => Math.hypot(a[0] - ai0[i][0], a[1] - ai0[i][1]) > 1 || a[2]));
// D: forced events with screenshots
const force = (def) => ev((d) => { const s = __redsol.G.state; s.sched[s.sol - 1] = [Object.assign({ at: s.t + 0.5 }, d)]; s.evPtr = 0; }, def);
await force({ type: 'storm' }); await page.waitForTimeout(500); await ev(() => __redsol.fast(32)); await page.waitForTimeout(600); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-storm-warn.png' });
await ev(() => __redsol.fast(34)); await page.waitForTimeout(800); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-storm-active.png' });
await ev(() => __redsol.fast(45)); await page.waitForTimeout(500);
await ev(() => { const s = __redsol.G.state; s.sched[s.sol - 1] = [{ type: 'flare', intensity: 3, variant: { id: 'x9_2024', title: 'X9.0 solar flare', date: '3 Oct 2024', source: 'NASA SDO', blurb: '', real: true }, at: s.t + 0.5 }]; s.evPtr = 0; s.shield = 2; });
await page.waitForTimeout(500); await ev(() => __redsol.fast(5)); await page.waitForTimeout(500); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-flare-warn.png' });
await ev(() => __redsol.fast(41)); await page.waitForTimeout(900); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-flare-active.png' });
const dose = await ev(() => __redsol.G.state.crew.map((c) => Math.round(c.dose))); console.log('doses', dose);
await ev(() => __redsol.fast(40)); await page.waitForTimeout(300);
await force({ type: 'meteor' }); await page.waitForTimeout(6500); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-meteor-warn.png' }); await page.waitForTimeout(6000); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-meteor-hit.png' });
await page.waitForTimeout(1500); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-meteor-leak.png' });
const leak = await ev(() => Object.entries(__redsol.G.state.modules).filter(([, m]) => m.leak).map(([k]) => k)); ok('meteor made a leak ' + leak, leak.length > 0);
await force({ type: 'clog' }); await page.waitForTimeout(1200); await view(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/ev-clog.png' });
console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
await browser.close();
