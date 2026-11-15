import { chromium } from 'playwright-core';
const url = process.env.URL || 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
const ok = (n, v, x = '') => console.log((v ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : ''));
await page.goto(url + '?debug=1'); await page.waitForTimeout(2500);
await page.click('text=Play (7 sols)'); await page.click('.pick[data-id="mei"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
ok('1 sol-1 schedule', await ev(() => { const s = __redsol.G.state.sched[0]; return JSON.stringify(s.map((e) => e.type + '@' + e.at)); }).then((x) => { console.log('   ', x); return /meteor@36/.test(x) && /storm@55/.test(x); }));
ok('4 board visible + guide target', await ev(() => __redsol.world.board.visible && __redsol.world.guideTop.visible));
await page.screenshot({ path: 'shots/a-sol1-guide.png' });
await ev(() => __redsol.play(42 - __redsol.G.state.t)); const leakT = await ev(() => ({ t: __redsol.G.state.t, leak: Object.values(__redsol.G.state.modules).some((m) => m.leak) }));
ok('1 hull leak by 45 s', leakT.leak && leakT.t <= 45, JSON.stringify(leakT));
await page.waitForTimeout(1500); await page.screenshot({ path: 'shots/a-sol1-leak.png' });
await ev(() => __redsol.play(101 - __redsol.G.state.t)); const st = await ev(() => ({ t: __redsol.G.state.t, ev: __redsol.G.state.events.map((e) => e.type + ':' + e.phase) }));
ok('1 dust storm active near 100 s', st.ev.some((e) => e === 'storm:active'), JSON.stringify(st));
// later sols: >=2 events, first within 20 s
const sch = await ev(() => { const out = []; for (let i = 0; i < 40; i++) { const g = __redsol.createGame({ seed: 1000 + i, crewId: 'mei', sols: 7 }); for (let k = 1; k < 7; k++) out.push(g.sched[k].map((e) => e.at)); } return out; });
ok('1 every later sol has 2+ events', sch.every((a) => a.length >= 2)); ok('1 first event within 20 s', sch.every((a) => Math.min(...a) <= 20), 'max first=' + Math.max(...sch.map((a) => Math.min(...a))).toFixed(1));
// debug keys
await ev(() => { const s = __redsol.G.state; s.events = []; s.sched[s.sol - 1] = []; s.evPtr = 0; s.t = 5; });
const res = {};
for (const [k, name] of [['1', 'storm'], ['2', 'flare'], ['3', 'meteor'], ['4', 'clog'], ['5', 'geomag'], ['6', 'devil']]) {
  await ev(() => { const s = __redsol.G.state; s.events = []; s.recycler.clogged = false; s.weather.devil = null; s.t = 5; s.evPtr = 0; s.sched[s.sol - 1] = []; });
  await page.keyboard.press(k); await page.waitForTimeout(600); await ev(() => __redsol.play(1));
  res[name] = await ev((n) => __redsol.G.state.events.some((e) => e.type === n), name);
}
ok('3 debug keys 1-6 each fire an event', Object.values(res).every(Boolean), JSON.stringify(res));
await page.screenshot({ path: 'shots/a-debug.png' });
// tally stars + fact
await ev(() => { const s = __redsol.G.state; s.events = []; s.sched[s.sol - 1] = []; s.t = 148; s.board.clean = 1; s.board.patch = 1; __redsol.play(5); }); await page.waitForTimeout(800);
const tt = await page.textContent('body'); ok('4 tally shows stars, objectives, real fact', /Real space fact/.test(tt) && /SOL \d COMPLETE/.test(tt) && /ARCHIVED/.test(tt)); await page.screenshot({ path: 'shots/a-tally.png' });
// final badge
await page.click('[data-go]'); await page.waitForTimeout(400); await page.click('[data-go]'); await page.waitForTimeout(300);
await ev(() => { const s = __redsol.G.state; s.sol = s.sols; s.sched[s.sols - 1] = []; s.events = []; s.t = 149; s.crew.forEach((c) => { c.hp = 100; }); __redsol.play(5); }); await page.waitForTimeout(1500);
const dt = await page.textContent('body'); ok('4 final rank badge on debrief', /Mars Commander|Mars Pilot|Junior Astronaut|Mars Trainee/.test(dt)); await page.screenshot({ path: 'shots/a-debrief.png' });
console.log('errors:', errs.length ? errs.join('|') : 'none'); await browser.close();
