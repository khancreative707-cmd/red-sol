import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:4173/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
const ev = (f, a) => page.evaluate(f, a); const ok = (n, v, extra = '') => console.log((v ? 'PASS ' : 'FAIL ') + n + (extra ? ' ' + extra : ''));
const has = (sel) => page.locator(sel).count().then((c) => c > 0);
await page.goto(URL); await page.waitForTimeout(2500);
ok('title shows RezonX Elites', (await page.textContent('body')).includes('REZONX ELITES'));
// ---- full WIN loop (7 sols) via real UI buttons
await page.click('text=Play (7 sols)'); await page.click('.pick[data-id="diego"]'); await page.waitForTimeout(400);
let sols = 0, guard = 0;
while (guard++ < 300) {
  if (await has('[data-go]')) { const t = await page.textContent('[data-go]'); if (/Start/.test(t)) sols++; await page.click('[data-go]'); await page.waitForTimeout(150); }
  else if (await has('[data-a="again"]')) break;
  else { const stt = await ev(() => { const s = __redsol.G.state; if (s.status === 'playing') { s.crew.forEach((c) => { c.hp = 100; }); s.power = 100; s.water = 100; s.food = 100; } return __redsol.play(200); }); if (stt !== "playing") await page.waitForTimeout(1800); else await page.waitForTimeout(250); }
}
ok('played through all sols via UI', sols === 7, 'sols started=' + sols);
ok('debrief shown', await has('[data-a="again"]'));
const txt = await page.textContent('body'); ok('debrief says MISSION COMPLETE or EARLY RETURN', /MISSION COMPLETE|EARLY RETURN/.test(txt), (/MISSION COMPLETE/.test(txt) ? 'WIN' : 'RETURN'));
ok('debrief has ARCHIVED sources', /ARCHIVED|GAME-MADE/.test(txt));
await page.screenshot({ path: 'shots/flow-debrief.png' });
await page.click('[data-a="cred"]'); await page.waitForTimeout(400); ok('credits show archived + AI credit', /ARCHIVED/.test(await page.textContent('body')) && /Built with AI assistance/.test(await page.textContent('body'))); await page.screenshot({ path: 'shots/flow-credits.png' }); await page.click('[data-back]'); await page.waitForTimeout(300);
// ---- win path: jump to the end of the last sol
await page.click('[data-a="again"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(300);
await ev(() => { const s = __redsol.G.state; s.sol = s.sols; s.sched[s.sols - 1] = []; s.events = []; s.t = 149; s.crew.forEach((c) => { c.hp = 100; }); s.power = 80; __redsol.play(5); });
await page.waitForTimeout(1500); const wt = await page.textContent('body'); ok('win path shows MISSION COMPLETE with stars', /MISSION COMPLETE/.test(wt)); await page.screenshot({ path: 'shots/flow-win.png' });
// ---- replay
await page.click('[data-a="again"]'); await page.waitForTimeout(600); ok('replay starts new briefing', await has('[data-go]') && /SOL 1/.test(await page.textContent('body')));
// ---- fail path
await page.click('[data-go]'); await page.waitForTimeout(300);
await ev(() => { const s = __redsol.G.state; s.crew.forEach((c) => { c.hp = 5; }); __redsol.play(2); });
await page.waitForTimeout(2500); const ft = await page.textContent('body'); ok('fail path shows gentle EARLY RETURN debrief', /EARLY RETURN/.test(ft) && /okay/i.test(ft)); await page.screenshot({ path: 'shots/flow-fail.png' });
ok('failure grants a Lesson Learned perk', await ev(() => JSON.parse(localStorage.getItem('redsol.meta.v1')).perkKits >= 1));
// ---- change crew + new game, then save/continue
await page.click('[data-a="change"]'); await page.waitForTimeout(300); await page.click('.pick[data-id="asha"]'); await page.waitForTimeout(500); await page.click('[data-go]'); await page.waitForTimeout(300);
ok('perk kit applied (kits=4)', (await ev(() => __redsol.G.state.kits)) === 4);
await ev(() => __redsol.play(30)); const t1 = await ev(() => __redsol.G.state.t);
await page.waitForTimeout(500); await page.reload(); await page.waitForTimeout(2500);
ok('Continue button after refresh', await has('text=Continue Mission'));
await page.click('text=Continue Mission'); await page.waitForTimeout(800);
const t2 = await ev(() => __redsol.G.state.t); ok('progress restored after refresh', Math.abs(t2 - t1) < 6, `t before=${t1.toFixed(1)} after=${t2.toFixed(1)}`);
ok('crew restored (asha)', (await ev(() => __redsol.G.state.crew[__redsol.G.state.playerIdx].id)) === 'asha');
await page.screenshot({ path: 'shots/flow-pause.png' }); await page.click('text=Resume'); await page.waitForTimeout(300);
// settings
await page.click('#pause'); await page.waitForTimeout(300); await page.click('text=Settings'); await page.waitForTimeout(300); await page.click('[data-q="low"]'); await page.waitForTimeout(800); await page.click('[data-q="high"]'); await page.waitForTimeout(800); await page.click('[data-back]'); await page.waitForTimeout(200);
await page.click('text=How to Play'); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/flow-howto.png' }); await page.click('[data-back]');
console.log('ERRORS:', errs.length ? [...new Set(errs)].join('\n') : 'none');
await browser.close();
