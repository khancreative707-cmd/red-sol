import './style.css';
import { World } from './world/world.js';
import { UI, T } from './ui/ui.js';
import { Input } from './systems/input.js';
import { Sound } from './systems/audio.js';
import { Save } from './systems/save.js';
import { createGame, tick, release, solInfo, meters, getAction, urgentStations, serialize, restore, buildDebrief } from './sim/sim.js';
import { FACTS } from './data/archive.js';

const $ = (s) => document.querySelector(s);
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const settings = Save.settings();
const G = { state: null, crewId: 'mei', sols: 7, paused: false, mode: 'title', lastEarth: '', saveT: 0, card: false, flashKey: '', over: false, hintsDone: new Set() };

function fatal(msg) { $('#boot').innerHTML = `<div class="boot-in"><div class="logo-sm">RED SOL</div><p style="max-width:420px;margin:14px auto">${msg}</p></div>`; }

let world, ui, input, sound;
try {
  sound = new Sound(); sound.muted = !settings.sound;
  world = new World($('#gl'), settings.quality, touch);
} catch (e) { console.error(e); fatal('Sorry, your browser could not start 3D graphics. Try Chrome, Edge, Firefox or Safari with hardware acceleration turned on.'); throw e; }
ui = new UI($('#ui'), sound);
input = new Input($('#gl'), $('#ui'), world, touch);

// ---------- pause button ----------
const pauseBtn = document.createElement('button'); pauseBtn.id = 'pause'; pauseBtn.setAttribute('aria-label', 'Pause'); pauseBtn.innerHTML = '<i></i><i></i>'; pauseBtn.style.display = 'none'; $('#ui').appendChild(pauseBtn);
pauseBtn.addEventListener('click', () => { if (G.card || G.over) return; sound.click(); doPause(); });
input.onPause = () => { if (G.mode === 'game' && !G.card && !G.over) { if (G.paused) doResume(); else doPause(); } };

const startAudio = () => { sound.start(); window.removeEventListener('pointerdown', startAudio); window.removeEventListener('keydown', startAudio); };
window.addEventListener('pointerdown', startAudio); window.addEventListener('keydown', startAudio);

// ---------- flow ----------
function showDemo() {
  const demo = createGame({ seed: 7, crewId: 'mei', sols: 7, aiEnabled: false }); demo.hold = 'briefing'; demo.t = 52; demo.power = 92; demo.water = 76; demo.food = 88;
  world.mode2 = 'title'; world.setState(demo, 0); G.state = demo; G.mode = 'title'; G.paused = false; G.over = false; input.setEnabled(false); pauseBtn.style.display = 'none';
}
function toTitle() {
  showDemo(); const hasSave = Save.hasGame();
  ui.title({ hasSave, onContinue: continueGame, onNew: () => toSelect(7), onQuick: () => toSelect(4), onHow: () => ui.howto(touch, toTitle), onCredits: () => ui.credits(toTitle), onSettings: openSettings });
}
function openSettings(back = toTitle) { ui.settings({ quality: settings.quality, sound: settings.sound, onQuality: (q) => { settings.quality = q; Save.setSettings(settings); world.setQuality(q); }, onSound: (v) => { settings.sound = v; Save.setSettings(settings); sound.setMuted(!v); } }, back); }
function toSelect(sols) { G.sols = sols; ui.select({ sols, onPick: (id) => startGame(id, sols), onBack: toTitle }); }

function startGame(crewId, sols) {
  const meta = Save.meta(); const seed = (Math.random() * 4294967295) >>> 0;
  G.crewId = crewId; G.sols = sols; G.state = createGame({ seed, crewId, sols, perkKits: meta.perkKits || 0 });
  if (meta.perkKits) { meta.perkKits = 0; Save.setMeta(meta); }
  G.hintsDone = new Set(); G.over = false; G.lastEarth = ''; G.paused = false; G.card = true;
  beginPlay();
}
function beginPlay() {
  G.mode = 'game'; world.mode2 = 'game'; world.setState(G.state, G.state.playerIdx); world.yaw = 0; world.pitch = 0.22; ui.clear(); pauseBtn.style.display = 'flex'; input.setEnabled(false);
  Save.write(serialize(G.state), G.crewId, G.sols);
}
function continueGame() {
  const s = Save.load(); if (!s) return toTitle();
  try { G.state = restore(s.json); } catch { Save.clear(); return toTitle(); }
  G.crewId = s.crewId; G.sols = s.sols; G.hintsDone = new Set(['1', '2', '3']); G.over = false; G.lastEarth = '';
  beginPlay(); const st = G.state;
  if (st.status !== 'playing') { Save.clear(); return toTitle(); }
  if (st.hold === 'briefing') showBriefing(st.sol); else if (st.hold === 'tally') showTally(st.solStats ? summaryFrom(st) : {}); else { G.paused = true; showPauseMenu(); }
}
function summaryFrom(st) { const ss = st.solStats || {}; return { powerMin: ss.powerMin, harvested: ss.harvested, patched: ss.patched, eventsFaced: ss.evTypes }; }

const TIPS = [
  () => `Solar flares send out radiation. Your ${T.shield} protects the crew but drains the battery. The shelter keeps people safe but stops their work.`,
  () => 'Dust on the solar panels means less power. Cleaning them takes crew time, but it pays back in energy.',
  () => `${T.delay}: when you call Earth, the answer takes minutes to come back. Sometimes you must decide on your own.`,
  () => `Your ${T.dose} shows on your wrist screen. Keep it low!`,
  () => 'Plants only grow inside the greenhouse, and they need light. Grow lights cost battery power.',
  () => 'Repair kits are limited. Making a new one costs power and crew time.',
];
function showBriefing(sol) {
  G.card = true; input.setEnabled(false);
  const tip = sol === 1 ? `Welcome to Mars! A ${T.sol} is one Mars day. Your crew must survive ${G.sols} of them. Every choice helps one thing and costs another.` : TIPS[(sol * 3 + G.state.seed) % TIPS.length]();
  ui.briefing({ sol, sols: G.sols, tip, first: sol === 1, touch, last: sol === G.sols && G.sols > 1, onGo: () => { release(G.state); ui.clear(); G.card = false; input.setEnabled(true); save(); } });
}
function showTally(summary) {
  G.card = true; input.setEnabled(false); const st = G.state;
  ui.tally({ sol: st.sol, sols: G.sols, summary, earth: G.lastEarth, onNext: () => { release(G.state); ui.clear(); G.card = true; } });
}
function showPauseMenu() {
  ui.pause({ log: G.state.log, onResume: doResume, onHow: () => ui.howto(touch, showPauseMenu), onSettings: () => openSettings(showPauseMenu), onCredits: () => ui.credits(showPauseMenu),
    onRestart: () => startGame(G.crewId, G.sols), onQuit: () => { save(); toTitle(); } });
}
function doPause() { if (G.paused || G.mode !== 'game') return; G.paused = true; input.setEnabled(false); showPauseMenu(); }
function doResume() { G.paused = false; ui.clear(); input.setEnabled(!G.card); }
function save() { if (G.state && G.mode === 'game' && G.state.status === 'playing') Save.write(serialize(G.state), G.crewId, G.sols); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (G.mode === 'game' && !G.card && !G.over) doPause(); } });
window.addEventListener('pagehide', save);

function gameOver(status) {
  if (G.over) return; G.over = true; input.setEnabled(false); pauseBtn.style.display = 'none';
  const d = buildDebrief(G.state); const meta = Save.meta(); meta.runs++; if (status === 'won') meta.wins++; meta.bestStars = Math.max(meta.bestStars, d.stars);
  meta.badges = Array.from(new Set([...(meta.badges || []), ...d.badges.map((b) => b.id)])); if (status !== 'won') meta.perkKits = Math.min(2, (meta.perkKits || 0) + 1); Save.setMeta(meta); Save.finish();
  if (status === 'won') sound.fanfare(); else sound.sad();
  setTimeout(() => { G.card = true; ui.debrief(d, { onAgain: () => startGame(G.crewId, G.sols), onChange: () => toSelect(G.sols), onCredits: () => ui.credits(() => gameOver2(d)) }); }, status === 'won' ? 600 : 1500);
}
function gameOver2(d) { ui.debrief(d, { onAgain: () => startGame(G.crewId, G.sols), onChange: () => toSelect(G.sols), onCredits: () => ui.credits(() => gameOver2(d)) }); }

// ---------- event handling ----------
function playerPos() { const c = G.state.crew[G.state.playerIdx]; return c; }
function handle(ev) {
  const st = G.state;
  switch (ev.type) {
    case 'sol_start': showBriefing(ev.sol); break;
    case 'sol_end': if (st.status === 'playing') { showTally(ev.summary || {}); save(); } break;
    case 'event_warn': { const t = ev.ev.type; if (t === 'flare') { world.sunFlash = 1; sound.alarm(); } else if (t === 'storm') { sound.alarm(); sound.whoosh(); } else if (t === 'meteor') sound.whoosh(); save(); break; }
    case 'event_start': { const t = ev.ev.type; if (t === 'flare' || t === 'storm') sound.alarm(); if (t === 'clog') sound.bad(); break; }
    case 'meteor_strike': world.fx.strike(ev.x, ev.z, 3); sound.impact(); break;
    case 'earth_msg': world.showEarth(ev.text); G.lastEarth = ev.text.replace(/^Earth: /, ''); sound.call(); break;
    case 'harvest': { const c = st.crew[ev.crew]; world.floatText('+' + (ev.n * 9 || 9) + ' food', '#7dff9a', c.x, 3.4, c.z); sound.done(); break; }
    case 'patched': { const c = st.crew[ev.crew]; world.floatText('Leak patched!', '#7aeaff', c.x, 3.4, c.z); sound.ok(); break; }
    case 'toast': { const c = playerPos(); world.floatText(ev.text, '#ffe9c8', c.x, 4.2, c.z); break; }
    case 'task_done': { if (ev.crew === st.playerIdx) sound.done(); break; }
    case 'say': sound.tone(900 + ev.crew * 120, 0.06, 'sine', 0.04); break;
    case 'game_over': gameOver(ev.status); break;
    default: break;
  }
}
function hints(st) {
  if (st.sol !== 1 || st.hold) return; const t = st.t; const H = [['1', 2, 0, touch ? 'Walk to a glowing ring and hold USE!' : 'Walk to a glowing ring and hold E!'], ['2', 20, 1, 'Ripe plants glow red. Harvest them!'], ['3', 44, 2, 'Watch the sky. Red signs warn of danger!']];
  for (const [k, at, who, text] of H) if (!G.hintsDone.has(k) && t >= at) { G.hintsDone.add(k); const c = st.crew[who]; if (!c.say) c.say = { text, t: 6 }; }
}

// ---------- main loop ----------
let last = performance.now(), first = true;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; const st = G.state; if (!st) return;
  try {
    if (G.mode === 'game' && !G.paused) {
      const inp = input.get(); const evs = tick(st, dt, inp); for (const e of evs) handle(e); hints(st);
      G.saveT += dt; if (G.saveT > 5) { G.saveT = 0; save(); }
    } else if (G.paused) dt = 0;
    const info = solInfo(st), m = meters(st);
    const prompt = G.mode === 'game' && !G.paused && !st.hold ? getAction(st, st.playerIdx) : null;
    world.update(st, G.mode === 'title' ? dt : dt, { info, meters: m, prompt, urgent: G.mode === 'game' && !st.hold ? urgentStations(st) : [] });
    world.perf(Math.max(dt, 0.001)); world.render();
    // screen tint for radiation / storm
    const fl = st.weather.flare > 0.3, sm = st.weather.storm > 0.7; const key = (fl ? 'f' : '') + (sm ? 's' : ''); if (key !== G.flashKey) { G.flashKey = key; const f = $('#flash'); f.className = fl ? 'on' : sm ? 'on dust' : ''; }
    const fr = st.events.find((e) => e.type === 'flare' && e.phase === 'active'); const dr = fr ? (0.7 + 0.5 * fr.intensity) * (1 - [0, 0.45, 0.75, 0.93][st.shield]) / 2.2 : 0;
    sound.update(dt, { storm: st.weather.storm, shield: st.shield, light: info.light, dose: dr });
    pauseBtn.style.visibility = G.card || G.over ? 'hidden' : 'visible';
    if (first) { first = false; const b = $('#boot'); b.classList.add('gone'); setTimeout(() => b.remove(), 800); }
  } catch (e) { console.error(e); }
}

toTitle();
requestAnimationFrame(frame);

// offline cache: tell the service worker which files this page used
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin)); urls.push(location.href);
      (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'cache', urls });
    }).catch(() => {});
  });
}
window.__redsol = { handle, play(n) { const st = G.state; for (let i = 0; i < n * 20 && !st.hold && st.status === 'playing'; i++) { const evs = tick(st, 0.05, { mx: 0, mz: 0, run: false, use: false }); evs.forEach(handle); } return st.status; }, G, world, tick, release, createGame, meters, solInfo, getAction, urgentStations, fast(n) { const st = G.state; const out = []; for (let i = 0; i < n * 20; i++) { if (st.hold === 'tally' || st.hold === 'briefing') { release(st); ui.clear(); G.card = false; input.setEnabled(true); } const evs = tick(st, 0.05, { mx: 0, mz: 0, run: false, use: false }); evs.forEach((e) => { out.push(e); }); } return out; } };
