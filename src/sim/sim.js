// RED SOL - pure game simulation. No DOM, no three. Plain JSON-serializable state.
import { rnd, rndInt, rndRange, shuffle, seedState } from './rng.js';
import { FLARE_VARIANTS } from '../data/archive.js';

export const C = {
  SOL_LEN: 150, DT_MAX: 0.05,
  WALK: 5, RUN: 8.5, AI_WALK: 3.8, AI_RUN: 6, ACT_R: 2.4, AI_SLOW: 1.7,
  PANEL_GEN: 0.55, BASE: 0.24, SHIELD: [0, 0.2, 0.5, 1.3], LIGHTS: 0.3, COMMS_IDLE: 0.1,
  PROT: [0, 0.45, 0.75, 0.93], SHELTER_MULT: 0.04, DOSE_NORM: 60, WORLD_R: 55, RAD_HP: 1.6, SHELTER_USE: 0.05,
};

// ---------- world layout ----------
export const MODULES = [
  { id: 'power', x: -14, z: -8, r: 3.6 },
  { id: 'med', x: -3, z: -8, r: 3.6 },
  { id: 'water', x: 6, z: -9, r: 3.6 },
  { id: 'green', x: 15, z: -8, r: 5 },
  { id: 'shelter', x: 24, z: -4, r: 3 },
];
export const COMMS_TOWER = { x: -8, z: -13.7 };
const MOD = Object.fromEntries(MODULES.map(m => [m.id, m]));
const LEAK_MODS = ['power', 'med', 'water', 'green'];

const S = (id, kind, x, z, extra) => Object.assign({ id, kind, x, z, ax: x, az: z }, extra || {});
export const STATIONS = [
  S('shield', 'shield', -15.5, -2.6, { moduleId: 'power' }),
  S('lowpower', 'lowpower', -12.5, -2.6, { moduleId: 'power' }),
  S('comms', 'comms', -8, -8.5),
  S('medbay', 'medbay', -3, -2.8, { moduleId: 'med' }),
  S('recycler', 'recycler', 6, -3.8, { moduleId: 'water' }),
  S('greenhouse', 'greenhouse', 15, -1.8, { moduleId: 'green' }),
  S('shelter', 'shelter', 24, 0.8, { moduleId: 'shelter' }),
  S('panel0', 'panel', -24, 4, { ax: -21.7, az: 4 }),
  S('panel1', 'panel', -24, 8, { ax: -21.7, az: 8 }),
  S('panel2', 'panel', -24, 12, { ax: -21.7, az: 12 }),
  S('storage', 'storage', 8, 5, { ax: 8, az: 7.2 }),
  S('leak_power', 'leak', -11, -3.4, { moduleId: 'power' }),
  S('leak_med', 'leak', -0.8, -3.4, { moduleId: 'med' }),
  S('leak_water', 'leak', 8.2, -4.0, { moduleId: 'water' }),
  S('leak_green', 'leak', 18, -2.2, { moduleId: 'green' }),
];
const STN = Object.fromEntries(STATIONS.map(s => [s.id, s]));
export const OBSTACLES = [
  ...MODULES.map(m => ({ x: m.x, z: m.z, r: m.r })),
  { x: COMMS_TOWER.x, z: COMMS_TOWER.z, r: 1 },
  { x: -24, z: 4, r: 1.6 }, { x: -24, z: 8, r: 1.6 }, { x: -24, z: 12, r: 1.6 },
  { x: 8, z: 5, r: 1.4 },
];

const IDS = ['mei', 'diego', 'asha'];
const SK = {
  mei: { fold: .6, unfold: .6, clean: .6, patch: .6, fix_recycler: .6, make_kit: .6, harvest: 1.4 },
  diego: { harvest: .6, patch: 1.4, fix_recycler: 1.4 },
  asha: { treat: .65 },
};
const DOSE_MULT = { mei: 1.3, diego: 1, asha: 0.5 };
const TYPE_NAME = { storm: 'a dust storm', flare: 'a solar flare', meteor: 'a space rock', clog: 'a water recycler problem', geomag: 'a radio storm', devil: 'a dust devil' };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- creation ----------
export function createGame({ seed = 1, crewId = 'mei', sols = 7, perkKits = 0, aiEnabled = true } = {}) {
  const playerIdx = Math.max(0, IDS.indexOf(crewId));
  const s = {
    v: 1, seed, rng: seedState(seed), sols, sol: 1, t: 0, totalT: 0, status: 'playing', hold: 'briefing',
    playerIdx, aiEnabled, power: 80, water: 85, food: 80, shield: 0, lowPower: false, kits: 3 + perkKits,
    panels: [{ folded: false, dust: 0.5 }, { folded: false, dust: 0.05 }, { folded: false, dust: 0.05 }],
    plots: [{ g: 0.6 }, { g: 0.6 }, { g: 0.4 }, { g: 0.2 }],
    recycler: { clogged: false },
    modules: { power: { hull: 100, leak: false }, med: { hull: 100, leak: false }, water: { hull: 100, leak: false }, green: { hull: 100, leak: false }, shelter: { hull: 100, leak: false } },
    crew: [],
    weather: { storm: 0, flare: 0, light: 0, devil: null },
    events: [], comms: { replies: [], calls: 0, lastCallT: -999 },
    stats: { harvested: 0, patched: 0, earthCalls: 0, minPower: 80, stormsFaced: 0, stormsFolded: 0, flaresFaced: 0, flareSmart: 0, flareDoses: [], meteors: 0, clogs: 0, maxDose: [0, 0, 0] },
    log: [], timeline: [], sched: [], evPtr: 0, uid: 0, manualLockT: 0, treatCd: 0, zeroPowerT: 0,
    failReason: '', cause: { rad: 0, hunger: 0, power: 0 }, solStats: null, pendingEvents: [{ type: 'sol_start', sol: 1 }],
  };
  const starts = [[-2, 4], [3, 5]];
  let k = 0;
  IDS.forEach((id, i) => {
    const isP = i === playerIdx;
    const [x, z] = isP ? [0, 7] : starts[k++];
    s.crew.push({
      id, x, z, heading: Math.PI, speed: 0, carry: null, inShelter: false, hp: 100, dose: 0, task: null, say: null, sayCd: 0, latch: false,
      ai: isP ? null : { job: null, next: 0, urgent: false, wp: null, wpT: 0, lx: x, lz: z, stuckT: 0, lastJob: null },
    });
  });
  s.sched = makeSchedule(s);
  resetSolStats(s);
  return s;
}

function pickVariant(s, intensity) {
  const v = FLARE_VARIANTS.filter(f => f.intensity === intensity);
  const f = v[rndInt(s, v.length)];
  return { id: f.id, title: f.title, date: f.date, source: f.source, blurb: f.blurb, real: f.real };
}

function makeSchedule(s) {
  const N = s.sols;
  const sched = Array.from({ length: N }, () => []);
  const flareDef = (idx, forced) => {
    let I;
    if (forced) I = forced; else {
      const f = N > 1 ? idx / (N - 1) : 0;
      I = f < 0.34 ? 1 : f < 0.67 ? 2 : 3;
      const r = rnd(s); if (r < 0.25) I--; else if (r > 0.8) I++;
      I = clamp(I, 1, 3);
    }
    return { type: 'flare', intensity: I, variant: pickVariant(s, I) };
  };
  sched[0].push({ type: 'devil', at: 70 });
  if (N >= 2) {
    sched[N - 1].push({ type: 'storm', at: 25 }, Object.assign(flareDef(N - 1, 3), { at: 70 }));
  }
  const mids = []; for (let i = 1; i < N - 1; i++) mids.push(i);
  if (mids.length) {
    const g = shuffle(s, ['storm', 'flare', 'meteor', 'clog']);
    const order = shuffle(s, mids);
    g.forEach((type, i) => {
      const idx = order[i % order.length];
      sched[idx].push(type === 'flare' ? flareDef(idx) : { type });
    });
    const pool = [['storm', 1], ['flare', 1], ['meteor', 1.5], ['clog', 1], ['geomag', 1], ['devil', 0.7]];
    for (const idx of mids) {
      if (sched[idx].length < 2 && rnd(s) < 0.5) {
        const have = new Set(sched[idx].map(e => e.type));
        const opts = pool.filter(p => !have.has(p[0]));
        const tot = opts.reduce((a, p) => a + p[1], 0);
        let r = rnd(s) * tot, ch = opts[0][0];
        for (const p of opts) { r -= p[1]; if (r <= 0) { ch = p[0]; break; } }
        sched[idx].push(ch === 'flare' ? flareDef(idx) : { type: ch });
      }
      const n = sched[idx].length;
      const sh = shuffle(s, sched[idx]);
      const t1 = rndRange(s, 22, 36);
      sh.forEach((e, j) => { e.at = j === 0 ? t1 : t1 + 36 + rnd(s) * 20; });
      sched[idx] = sh;
    }
  }
  for (const a of sched) a.sort((p, q) => p.at - q.at);
  return sched;
}

function resetSolStats(s) {
  s.solStats = { powerMin: s.power, dose0: s.crew[s.playerIdx].dose, harvested: 0, patched: 0, evTypes: [] };
}

// ---------- helpers ----------
const stormEv = s => s.events.find(e => e.type === 'storm') || null;
const stormActive = s => s.events.some(e => e.type === 'storm' && e.phase === 'active');
const geoActive = s => s.events.some(e => e.type === 'geomag');
const flareEv = s => s.events.find(e => e.type === 'flare') || null;
const leakCount = s => LEAK_MODS.reduce((n, m) => n + (s.modules[m].leak ? 1 : 0), 0);
const needs = s => leakCount(s) + (s.recycler.clogged ? 1 : 0);
const lightAt = p => p >= 0.9 ? 0 : Math.pow(Math.sin(Math.PI * p / 0.9), 0.6);
const oneWay = s => Math.round((6 + 1.5 * s.sol) * (geoActive(s) ? 2 : 1) * (stormActive(s) ? 1.6 : 1) * 10) / 10;
const cp = o => JSON.parse(JSON.stringify(o));

export function solInfo(s) {
  const p = clamp(s.t / C.SOL_LEN, 0, 1);
  const phase = p < 0.1 ? 'dawn' : p < 0.7 ? 'day' : p < 0.9 ? 'dusk' : 'night';
  const hrs = (6 + p * 24) % 24;
  const hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
  const d = oneWay(s);
  return {
    sol: s.sol, sols: s.sols, t: s.t, len: C.SOL_LEN, phase, progress: p, light: lightAt(p),
    clock: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), delayOneWay: d, delayMin: Math.round(d),
  };
}

export function meters(s) {
  const mods = ['power', 'med', 'water', 'green', 'shelter'];
  return {
    power: s.power, water: s.water, food: s.food, supplies: (s.water + s.food) / 2,
    hull: mods.reduce((a, m) => a + s.modules[m].hull, 0) / mods.length,
    health: s.crew.reduce((a, c) => a + c.hp, 0) / s.crew.length,
    dose: Math.min(100, s.crew[s.playerIdx].dose / C.DOSE_NORM * 100),
  };
}

function say(s, i, text, out) {
  const c = s.crew[i];
  if (c.sayCd > 0) return;
  c.say = { text, t: 3.5 }; c.sayCd = 8;
  out.push({ type: 'say', crew: i, text });
}
function sayNearestAI(s, text, out, x, z) {
  let best = -1, bd = 1e9;
  s.crew.forEach((c, i) => { if (c.ai && s.aiEnabled) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = i; } } });
  if (best >= 0) say(s, best, text, out);
}

// ---------- actions ----------
function skillMul(s, i, a) {
  const c = s.crew[i];
  return ((SK[c.id] && SK[c.id][a]) || 1) * (i === s.playerIdx ? 1 : C.AI_SLOW);
}

function actionFor(s, i, st) {
  const c = s.crew[i], id = st.id;
  if (c.inShelter && id !== 'shelter') return null;
  const mk = (actionId, label, dur, enabled = true, reason = '', urgent = false) =>
    ({ stationId: id, actionId, label, dur: dur * skillMul(s, i, actionId), enabled, reason, urgent });
  switch (st.kind) {
    case 'panel': {
      const p = s.panels[+id.slice(5)], storm = stormEv(s);
      if (storm && !p.folded) return mk('fold', 'Fold solar panel', 2.5, true, '', true);
      if (!storm && p.folded) return mk('unfold', 'Unfold solar panel', 2.5, true, '', true);
      if (p.dust > 0.2) return mk('clean', 'Clean dust off panel', 4, true, '', p.dust > 0.35);
      return null;
    }
    case 'shield': return mk('shield_cycle', `Shield Lv ${s.shield} -> Lv ${(s.shield + 1) % 4}`, 0.5);
    case 'lowpower': return mk('lowpower_toggle', s.lowPower ? 'Low-power mode: turn OFF' : 'Low-power mode: turn ON', 0.5);
    case 'greenhouse': {
      const n = s.plots.filter(p => p.g >= 1).length;
      return n > 0 ? mk('harvest', `Harvest crops (${n} ready)`, 3, true, '', true) : null;
    }
    case 'recycler':
      if (!s.recycler.clogged) return null;
      return c.carry ? mk('fix_recycler', 'Fix water recycler', 5, true, '', true)
        : mk('fix_recycler', 'Fix water recycler', 5, false, 'Need a repair kit', true);
    case 'storage':
      if (c.carry) return null;
      if (s.kits > 0) return mk('take_kit', `Take repair kit (${s.kits} left)`, 1.2, true, '', needs(s) > 0);
      return mk('make_kit', 'Make a repair kit (uses 6% power)', 8, s.power >= 6, 'Not enough power', needs(s) > 0);
    case 'leak':
      if (!s.modules[st.moduleId].leak) return null;
      return c.carry ? mk('patch', 'Patch the leak', 5, true, '', true) : mk('patch', 'Patch the leak', 5, false, 'Need a repair kit', true);
    case 'shelter': return c.inShelter ? mk('leave_shelter', 'Leave shelter', 0.8) : mk('enter_shelter', 'Enter shelter', 0.8);
    case 'medbay':
      if (s.treatCd > 0 || !s.crew.some(x => x.hp < 95)) return null;
      return mk('treat', 'Treat the crew', 4, true, '', s.crew.some(x => x.hp < 60));
    case 'comms': {
      const pending = s.comms.replies.some(r => r.kind === 'call');
      const fl = flareEv(s);
      if (s.lowPower) return mk('call_earth', 'Call Earth', 3, false, 'Comms are off in low-power mode');
      if (s.power < 2) return mk('call_earth', 'Call Earth', 3, false, 'Not enough power');
      if (pending) return mk('call_earth', 'Call Earth', 3, false, 'Waiting for Earth to answer');
      return mk('call_earth', `Call Earth (about ${Math.round(2 * oneWay(s))} min round trip)`, 3, true, '', !!(fl && !fl.known));
    }
  }
  return null;
}

export function getAction(s, i) {
  const c = s.crew[i];
  if (c.inShelter) return actionFor(s, i, STN.shelter);
  let best = null, bd = C.ACT_R + 1e-6;
  for (const st of STATIONS) {
    const d = Math.hypot(c.x - st.x, c.z - st.z);
    if (d > bd) continue;
    const a = actionFor(s, i, st);
    if (a) { best = a; bd = d; }
  }
  return best;
}

export function urgentStations(s) {
  const r = [], storm = stormEv(s), fl = flareEv(s);
  s.panels.forEach((p, i) => {
    if (storm && !p.folded) r.push('panel' + i);
    else if (!storm && (p.folded || p.dust > 0.35)) r.push('panel' + i);
  });
  if (s.plots.some(p => p.g >= 1)) r.push('greenhouse');
  if (s.recycler.clogged) r.push('recycler');
  for (const m of LEAK_MODS) if (s.modules[m].leak) r.push('leak_' + m);
  if (needs(s) > 0 && !s.crew.some(c => c.carry)) r.push('storage');
  if (fl) {
    if (s.shield < 2 && (fl.phase === 'active' || fl.warnDur - fl.t <= 20)) r.push('shield', 'shelter');
    if (!fl.known) r.push('comms');
  }
  if (s.crew.some(c => c.hp < 60) && s.treatCd <= 0) r.push('medbay');
  return r;
}

function complete(s, i, act, out) {
  const c = s.crew[i], a = act.actionId, sid = act.stationId;
  const isP = i === s.playerIdx;
  switch (a) {
    case 'fold': s.panels[+sid.slice(5)].folded = true; break;
    case 'unfold': s.panels[+sid.slice(5)].folded = false; break;
    case 'clean': s.panels[+sid.slice(5)].dust = 0; break;
    case 'shield_cycle': s.shield = (s.shield + 1) % 4; if (isP) s.manualLockT = 20; break;
    case 'lowpower_toggle': s.lowPower = !s.lowPower; if (isP) s.manualLockT = 20; break;
    case 'harvest': {
      let n = 0;
      for (const p of s.plots) if (p.g >= 1) { n++; p.g = 0; s.water = Math.max(0, s.water - 0.6); s.food = Math.min(100, s.food + 9 * (c.id === 'diego' ? 1.2 : 1)); }
      s.stats.harvested += n; s.solStats.harvested += n;
      out.push({ type: 'harvest', crew: i, n });
      break;
    }
    case 'fix_recycler':
      c.carry = null; s.recycler.clogged = false;
      for (let k = s.events.length - 1; k >= 0; k--) if (s.events[k].type === 'clog') { out.push({ type: 'event_end', ev: cp(s.events[k]), factId: 'clog', result: 'fixed' }); s.events.splice(k, 1); }
      out.push({ type: 'toast', text: 'The water recycler works again!' });
      break;
    case 'take_kit': s.kits--; c.carry = 'kit'; break;
    case 'make_kit': s.power = Math.max(0, s.power - 6); c.carry = 'kit'; break;
    case 'patch': {
      const m = STN[sid].moduleId;
      s.modules[m].leak = false; s.modules[m].hull = 100; c.carry = null;
      s.stats.patched++; s.solStats.patched++;
      out.push({ type: 'patched', crew: i, moduleId: m });
      break;
    }
    case 'enter_shelter': c.inShelter = true; c.x = MOD.shelter.x; c.z = MOD.shelter.z; c.task = null; break;
    case 'leave_shelter': c.inShelter = false; c.x = 24; c.z = 1.6; break;
    case 'treat': {
      const m = c.id === 'asha' ? 1.3 : 1;
      for (const x of s.crew) x.hp = Math.min(100, x.hp + 14 * m);
      s.treatCd = 25;
      break;
    }
    case 'call_earth': {
      s.power = Math.max(0, s.power - 1.5);
      s.comms.calls++; s.stats.earthCalls++; s.comms.lastCallT = s.totalT;
      const d = 2 * oneWay(s);
      s.comms.replies.push({ at: s.totalT + d, from: s.totalT, kind: 'call', text: '' });
      break;
    }
  }
  out.push({ type: 'task_done', crew: i, actionId: a, stationId: sid });
}

function work(s, i, dt, act, out) {
  const c = s.crew[i];
  if (!c.task || c.task.stationId !== act.stationId || c.task.actionId !== act.actionId)
    c.task = { stationId: act.stationId, actionId: act.actionId, t: 0, dur: act.dur };
  c.task.t += dt;
  if (c.task.t >= c.task.dur) { complete(s, i, act, out); c.task = null; return true; }
  return false;
}

// ---------- movement ----------
function collide(c) {
  for (const o of OBSTACLES) {
    const dx = c.x - o.x, dz = c.z - o.z, min = o.r + 0.6;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      c.x = o.x + dx / d * min; c.z = o.z + dz / d * min;
    }
  }
  const r = Math.hypot(c.x, c.z);
  if (r > C.WORLD_R) { c.x *= C.WORLD_R / r; c.z *= C.WORLD_R / r; }
}

function playerStep(s, i, dt, input, out) {
  const c = s.crew[i];
  let mx = input.mx || 0, mz = input.mz || 0, m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; m = 1; }
  const moving = m > 0.15 && !c.inShelter;
  c.speed = 0;
  if (moving) {
    const sp = (input.run ? C.RUN : C.WALK) * m;
    c.x += mx / m * sp * dt; c.z += mz / m * sp * dt;
    c.heading = Math.atan2(mx, mz); c.speed = sp;
    collide(c);
  }
  if (!input.use) c.latch = false;
  const act = (input.use && !c.latch) ? getAction(s, i) : null;
  if (act && act.enabled && !moving) {
    if (work(s, i, dt, act, out)) c.latch = true;
  } else c.task = null;
}

const AI_LINES = {
  fold: 'Folding the panels!', patch: 'Patching the leak!', harvest: 'Harvesting crops!', clean: 'Panels are dusty!',
  fix_recycler: 'Fixing the recycler!', enter_shelter: 'Taking cover!', shield_cycle: 'Raising the shield!',
  treat: 'Check-up time, everyone!', take_kit: 'Getting a repair kit!', make_kit: 'Making a repair kit!', unfold: 'Panels back out!',
};

function aiScore(s, c, act, fl, storm, needKit) {
  const a = act.actionId, id = c.id;
  switch (a) {
    case 'fold': return (storm && storm.phase === 'active') ? 45 : 0; // AI only reacts late: folding early is the player's call
    case 'unfold': return 60;
    case 'clean': { const d = s.panels[+act.stationId.slice(5)].dust; return (storm || d <= 0.35) ? 0 : (20 + d * 25) * (id === 'mei' ? 1.3 : 1); }
    case 'harvest': { const n = s.plots.filter(p => p.g >= 1).length; return (25 + 8 * n) * (id === 'diego' ? 1.5 : id === 'mei' ? 0.8 : 1); }
    case 'patch': return 90;
    case 'fix_recycler': return 80;
    case 'take_kit': return needKit ? 85 : 0;
    case 'make_kit': return needKit && s.power >= 15 ? 80 : 0;
    case 'treat': return id === 'asha' && s.crew.some(x => x.hp < 70) ? 70 : 0;
    case 'enter_shelter':
      if (!fl || s.shield >= 2) return 0;
      if (!(fl.phase === 'active' || (fl.known && fl.warnDur - fl.t <= 18))) return 0;
      return id === 'asha' ? 96 : id === 'diego' ? 90 : 75;
    case 'shield_cycle':
      return 0; // the shield is the player's decision
      if (id !== 'mei' || s.manualLockT > 0) return 0;
      if (fl) return (s.shield < 2 && (fl.phase === 'active' || fl.warnDur - fl.t <= 14)) ? 98 : 0;
      return (s.shield > 0 && !storm) ? 40 : 0;
  }
  return 0;
}

function aiThink(s, i, out) {
  const c = s.crew[i], ai = c.ai;
  const fl = flareEv(s), storm = stormEv(s);
  if (c.inShelter) { ai.job = (!fl || s.shield >= 2) ? 'shelter' : null; ai.urgent = false; return; }
  const claimed = new Set();
  s.crew.forEach((o, j) => { if (j !== i) { if (o.ai && o.ai.job) claimed.add(o.ai.job); if (o.task) claimed.add(o.task.stationId); } });
  const carrying = s.crew.filter(x => x.carry).length;
  const needKit = needs(s) > carrying;
  let best = null, bs = 8;
  for (const st of STATIONS) {
    if (claimed.has(st.id)) continue;
    const act = actionFor(s, i, st);
    if (!act || !act.enabled) continue;
    let sc = aiScore(s, c, act, fl, storm, needKit);
    if (sc <= 0) continue;
    sc -= Math.hypot(c.x - st.x, c.z - st.z) * 0.05;
    if (st.id === ai.job) sc += 6;
    if (sc > bs) { bs = sc; best = { id: st.id, act }; }
  }
  if (best) {
    if (best.id !== ai.job) {
      ai.job = best.id; c.task = null;
      const ln = AI_LINES[best.act.actionId];
      if (ln && bs >= 40) say(s, i, ln, out);
    }
    ai.urgent = bs >= 85;
  } else { ai.job = null; ai.urgent = false; }
}

function aiStep(s, i, dt, out) {
  const c = s.crew[i], ai = c.ai;
  ai.next -= dt;
  if (ai.next <= 0) { ai.next = 1.0; aiThink(s, i, out); }
  let st = ai.job ? STN[ai.job] : null, act = null;
  if (st) {
    act = actionFor(s, i, st);
    if (!act || !act.enabled) { ai.job = null; st = null; act = null; c.task = null; ai.next = 0.1; }
  }
  c.speed = 0;
  if (c.inShelter) { if (st && act) work(s, i, dt, act, out); else c.task = null; return; }
  let tx, tz, sp;
  if (st) { tx = st.ax; tz = st.az; sp = ai.urgent ? C.AI_RUN : C.AI_WALK; }
  else {
    const k = Math.floor(s.totalT / 9);
    tx = (hsh(i * 3 + k) - 0.5) * 12; tz = 4 + (hsh(i * 5 + k + 1) - 0.5) * 6; sp = 2.2;
  }
  if (ai.wp) {
    tx = ai.wp.x; tz = ai.wp.z; ai.wpT -= dt;
    if (ai.wpT <= 0 || Math.hypot(tx - c.x, tz - c.z) < 1.2) ai.wp = null;
  }
  const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
  if (d > (st ? 0.12 : 0.5)) {
    const step = Math.min(d, sp * dt);
    c.x += dx / d * step; c.z += dz / d * step;
    c.heading = Math.atan2(dx, dz); c.speed = sp;
    collide(c);
    c.task = null;
    ai.stuckT += dt;
    if (ai.stuckT >= 2) {
      if (Math.hypot(c.x - ai.lx, c.z - ai.lz) < 0.5) { ai.wp = { x: c.x + (hsh(s.totalT) - 0.5) * 6, z: 6.5 }; ai.wpT = 3; }
      ai.stuckT = 0; ai.lx = c.x; ai.lz = c.z;
    }
  } else {
    ai.stuckT = 0; ai.lx = c.x; ai.lz = c.z;
    if (st && act && Math.hypot(c.x - st.x, c.z - st.z) <= C.ACT_R - 0.02) work(s, i, dt, act, out);
    else c.task = null;
  }
}

// ---------- events ----------
function spawn(s, def, out) {
  const ev = { uid: ++s.uid, type: def.type, phase: 'warn', t: 0, warnDur: 0, dur: 0 };
  switch (def.type) {
    case 'storm': ev.warnDur = 45; ev.dur = 40; break;
    case 'flare': ev.warnDur = 45; ev.dur = 30; ev.variant = def.variant; ev.intensity = def.intensity; ev.known = false; ev.shieldPeak = 0; break;
    case 'meteor': ev.warnDur = 6; ev.target = LEAK_MODS[rndInt(s, 4)]; ev.x = MOD[ev.target].x; ev.z = MOD[ev.target].z; break;
    case 'clog':
      if (s.recycler.clogged) return;
      ev.open = true; s.recycler.clogged = true; s.stats.clogs++;
      s.timeline.push({ sol: s.sol, type: 'clog', note: 'The water recycler clogged.', factId: 'clog' });
      break;
    case 'geomag': ev.dur = 45; break;
    case 'devil': ev.dur = 20; ev.x = -30; ev.z = 8; s.weather.devil = { x: -30, z: 8, t: 0 }; break;
  }
  if (!s.solStats.evTypes.includes(def.type)) s.solStats.evTypes.push(def.type);
  s.events.push(ev);
  if (ev.warnDur === 0) { ev.phase = 'active'; startActive(s, ev, out); }
  else {
    out.push({ type: 'event_warn', ev: cp(ev), factId: def.type });
    if (def.type === 'storm') sayNearestAI(s, 'Dust storm! Fold the panels!', out, 0, 5);
    if (def.type === 'flare') {
      sayNearestAI(s, 'Solar flare! Get ready!', out, 0, 5);
      const v = ev.variant;
      s.comms.replies.push({ at: s.totalT + oneWay(s), from: s.totalT, kind: 'auto',
        text: `Earth sees a flare${v.real ? ' (' + v.title + ', ' + v.date + ')' : ''}. Strength unknown: call Earth for details.` });
    }
    if (def.type === 'meteor') sayNearestAI(s, 'Look out! A space rock!', out, ev.x, ev.z);
  }
}

function startActive(s, ev, out) {
  ev.t = 0; ev.phase = 'active';
  if (ev.type === 'storm') {
    const n = s.panels.filter(p => p.folded).length;
    ev.foldedAtHit = n; ev.powerStart = s.power; s.stats.stormsFaced++;
    if (n === 3) s.stats.stormsFolded++;
  }
  if (ev.type === 'flare') ev.doseStart = s.crew[s.playerIdx].dose;
  if (ev.type === 'clog') sayNearestAI(s, 'The recycler stopped!', out, 6, -3);
  out.push({ type: 'event_start', ev: cp(ev), factId: ev.type });
}

function endEvent(s, ev, out, result) {
  const me = s.crew[s.playerIdx];
  let note = '';
  switch (ev.type) {
    case 'storm': note = `${ev.foldedAtHit} of 3 panels were folded when it hit. Battery: ${Math.round(ev.powerStart)}% to ${Math.round(s.power)}%.`; break;
    case 'flare': {
      const dose = me.dose - ev.doseStart;
      s.stats.flaresFaced++; s.stats.flareDoses.push(Math.round(dose * 10) / 10);
      if (dose / C.DOSE_NORM * 100 < 25) s.stats.flareSmart++;
      note = `${ev.variant.title}: strength ${ev.intensity}. Shield peak Lv ${ev.shieldPeak}. Your dose: ${Math.round(dose / C.DOSE_NORM * 100)} out of 100.`;
      break;
    }
    case 'geomag': note = 'Radio messages to Earth were slow for a while.'; break;
    case 'devil': note = 'A dust devil swept across the base.'; s.weather.devil = null; break;
    case 'meteor': break;
  }
  if (note) s.timeline.push({ sol: s.sol, type: ev.type, note, factId: ev.type, variantId: ev.type === 'flare' && ev.variant ? ev.variant.id : undefined });
  out.push({ type: 'event_end', ev: cp(ev), factId: ev.type, result: result || 'done' });
}

function composeReply(s) {
  const fl = flareEv(s);
  if (fl) {
    fl.known = true;
    const v = fl.variant;
    return `Earth: this flare is strength ${fl.intensity} of 3${v.real ? ' (' + v.title + ', ' + v.date + ')' : ''}. Use shield Lv ${fl.intensity}, or hide in the shelter.`;
  }
  if (stormEv(s)) return 'Earth: a dust storm is here. Fold the solar panels, or use low-power mode to save the battery.';
  const nxt = s.sched[s.sol - 1] && s.sched[s.sol - 1][s.evPtr];
  if (nxt && nxt.at - s.t <= 80) return `Earth: watch out, ${TYPE_NAME[nxt.type]} may come in about ${Math.max(5, Math.round(nxt.at - s.t))} seconds.`;
  return 'Earth: all quiet right now. Keep up your chores!';
}

// ---------- main step ----------
function step(s, dt, input, out) {
  s.totalT += dt; s.t += dt;
  s.manualLockT = Math.max(0, s.manualLockT - dt);
  s.treatCd = Math.max(0, s.treatCd - dt);
  for (const c of s.crew) { c.sayCd = Math.max(0, c.sayCd - dt); if (c.say) { c.say.t -= dt; if (c.say.t <= 0) c.say = null; } }
  const p = clamp(s.t / C.SOL_LEN, 0, 1);
  const light = lightAt(p);
  s.weather.light = light;

  // director
  const sch = s.sched[s.sol - 1];
  while (sch && s.evPtr < sch.length && s.t >= sch[s.evPtr].at) { spawn(s, sch[s.evPtr], out); s.evPtr++; }

  // events
  for (let k = s.events.length - 1; k >= 0; k--) {
    const ev = s.events[k];
    ev.t += dt;
    if (ev.phase === 'warn' && ev.t >= ev.warnDur) {
      if (ev.type === 'meteor') {
        const m = s.modules[ev.target];
        m.leak = true; m.hull = Math.max(0, m.hull - 35); s.stats.meteors++;
        out.push({ type: 'meteor_strike', x: ev.x, z: ev.z, moduleId: ev.target });
        s.timeline.push({ sol: s.sol, type: 'meteor', note: `A space rock hit the ${ev.target} module and made a leak.`, factId: 'meteor' });
        sayNearestAI(s, 'Hull leak! Need a patch kit!', out, ev.x, ev.z);
        out.push({ type: 'event_end', ev: cp(ev), factId: 'meteor', result: 'strike' });
        s.events.splice(k, 1);
        continue;
      }
      startActive(s, ev, out);
    } else if (ev.phase === 'active') {
      if (ev.type === 'devil' && s.weather.devil) {
        const d = s.weather.devil; d.t = ev.t; d.x = -30 + 3 * ev.t; ev.x = d.x;
        s.panels.forEach((pp, pi) => {
          const st = STN['panel' + pi];
          if (Math.hypot(st.x - d.x, st.z - d.z) < 5 && pp.dust > 0) {
            if (pp.dust > 0.2 && !ev.cleaned) { ev.cleaned = true; out.push({ type: 'toast', text: 'A dust devil blew dust off the panels!' }); }
            pp.dust = 0;
          }
        });
      }
      if (ev.type === 'flare') ev.shieldPeak = Math.max(ev.shieldPeak || 0, s.power > 0 ? s.shield : 0);
      if (!ev.open && ev.t >= ev.dur) { endEvent(s, ev, out); s.events.splice(k, 1); }
    }
  }
  // weather visual
  const st = stormEv(s), fl = s.events.find(e => e.type === 'flare' && e.phase === 'active');
  const stT = !st ? 0 : st.phase === 'warn' ? 0.4 * st.t / st.warnDur : 1;
  s.weather.storm = clamp(s.weather.storm + clamp(stT - s.weather.storm, -0.25 * dt, 0.3 * dt), 0, 1);
  s.weather.flare = clamp(s.weather.flare + clamp((fl ? 1 : 0) - s.weather.flare, -0.5 * dt, 1.5 * dt), 0, 1);

  // Earth messages
  for (let k = s.comms.replies.length - 1; k >= 0; k--) {
    const r = s.comms.replies[k];
    if (r.at > s.totalT) continue;
    if (r.kind === 'auto' && s.lowPower) { r.at += 3; continue; }
    const text = r.kind === 'call' ? composeReply(s) : r.text;
    s.comms.replies.splice(k, 1);
    s.log.push({ sol: s.sol, t: Math.round(s.t), text });
    out.push({ type: 'earth_msg', text });
  }

  // crew movement/work
  for (let i = 0; i < s.crew.length; i++) {
    if (i === s.playerIdx) playerStep(s, i, dt, input || {}, out);
    else if (s.aiEnabled) aiStep(s, i, dt, out);
  }

  // power
  const sa = stormActive(s);
  let gen = 0;
  for (const pp of s.panels) {
    if (!pp.folded) gen += 1 - 0.6 * pp.dust;
    if (!pp.folded) pp.dust = Math.min(1, pp.dust + (sa ? 0.018 : 0.001) * dt);
  }
  gen *= C.PANEL_GEN * light * (sa ? 0.25 : 1);
  const lightsOn = !s.lowPower && s.power > 0;
  const effShield = s.power > 0 ? s.shield : 0;
  const drain = C.BASE * (s.lowPower ? 0.6 : 1) + C.SHIELD[effShield] + (lightsOn ? C.LIGHTS : 0) + (s.lowPower ? 0 : C.COMMS_IDLE);
  s.power = clamp(s.power + (gen - drain) * dt, 0, 100);
  s.stats.minPower = Math.min(s.stats.minPower, s.power);
  s.solStats.powerMin = Math.min(s.solStats.powerMin, s.power);
  s.zeroPowerT = s.power <= 0 ? s.zeroPowerT + dt : 0;

  // water / food / plots / hull
  let leaks = 0;
  for (const m of LEAK_MODS) if (s.modules[m].leak) { leaks++; s.modules[m].hull = Math.max(20, s.modules[m].hull - 0.6 * dt); }
  s.water = clamp(s.water + (-0.08 + (s.recycler.clogged ? 0 : 0.07) - 0.25 * leaks) * dt, 0, 100);
  const nSh = s.crew.reduce((a, c) => a + (c.inShelter ? 1 : 0), 0);
  s.water = clamp(s.water - C.SHELTER_USE * nSh * dt, 0, 100);
  s.food = clamp(s.food - (0.12 + C.SHELTER_USE * nSh) * dt, 0, 100);
  if (lightsOn && s.water > 5) for (const pl of s.plots) pl.g = Math.min(1, pl.g + dt / 70);

  // health / radiation
  const hungry = s.water <= 0 || s.food <= 0, dark = s.power <= 0;
  const flares = s.events.filter(e => e.type === 'flare' && e.phase === 'active');
  s.crew.forEach((c, i) => {
    let rad = 0;
    for (const ev of flares) {
      const base = 0.7 + 0.5 * ev.intensity;
      rad += base * (c.inShelter ? C.SHELTER_MULT : 1 - C.PROT[effShield]);
    }
    rad *= DOSE_MULT[c.id];
    let loss = 0;
    if (hungry) { loss += 0.4; s.cause.hunger += 0.4 * dt; }
    if (dark) { loss += 0.25; s.cause.power += 0.25 * dt; }
    if (rad > 0) { c.dose += rad * dt; loss += C.RAD_HP * rad; s.cause.rad += C.RAD_HP * rad * dt; }
    if (loss > 0) c.hp -= loss * dt;
    else if (!hungry && !dark) c.hp += 0.04 * dt;
    c.hp = clamp(c.hp, 0, 100);
    if (c.dose > s.stats.maxDose[i]) s.stats.maxDose[i] = c.dose;
  });

  // failure
  const avg = s.crew.reduce((a, c) => a + c.hp, 0) / s.crew.length;
  if (avg <= 30 || s.zeroPowerT > 20) {
    s.status = 'failed';
    if (s.zeroPowerT > 20 && s.cause.power >= s.cause.rad && s.cause.power >= s.cause.hunger) s.failReason = 'The battery ran out of power, so Mission Control called the crew home early. You learned how much power every job uses!';
    else if (s.cause.rad >= s.cause.hunger) s.failReason = 'The crew soaked up too much space radiation. Mission Control called an early return so everyone can rest safely. Next time, shield up or hide in the shelter before the surge.';
    else s.failReason = 'The crew ran low on food and water. Mission Control called an early return so everyone can rest. Next time, harvest crops and fix leaks and the recycler early.';
    s.timeline.push({ sol: s.sol, type: 'early_return', note: s.failReason, factId: null });
    out.push({ type: 'game_over', status: 'failed', reason: s.failReason });
    return;
  }

  // sol end
  if (s.t >= C.SOL_LEN) {
    const me = s.crew[s.playerIdx];
    const summary = {
      powerMin: Math.round(s.solStats.powerMin), dose: Math.round((me.dose - s.solStats.dose0) / C.DOSE_NORM * 100),
      harvested: s.solStats.harvested, patched: s.solStats.patched, eventsFaced: s.solStats.evTypes.slice(),
    };
    if (s.sol >= s.sols) {
      s.status = 'won'; s.hold = null;
      out.push({ type: 'sol_end', sol: s.sol, summary });
      out.push({ type: 'game_over', status: 'won' });
    } else {
      s.hold = 'tally';
      out.push({ type: 'sol_end', sol: s.sol, summary });
    }
  }
}

export function tick(s, dt, input) {
  const out = [];
  try {
    if (s.pendingEvents && s.pendingEvents.length) { for (const e of s.pendingEvents) out.push(e); s.pendingEvents = []; }
    if (s.hold || s.status !== 'playing') return out;
    let rem = dt;
    while (rem > 1e-9 && !s.hold && s.status === 'playing') {
      const h = Math.min(C.DT_MAX, rem);
      step(s, h, input, out);
      rem -= h;
    }
  } catch (e) { s.lastError = String(e && e.stack || e); }
  return out;
}

export function release(s) {
  if (s.hold === 'tally') {
    s.sol++; s.t = 0; s.evPtr = 0; s.hold = 'briefing';
    resetSolStats(s);
    s.pendingEvents.push({ type: 'sol_start', sol: s.sol });
  } else if (s.hold === 'briefing') s.hold = null;
}

export const serialize = s => JSON.stringify(s);
export function restore(str) { return typeof str === 'string' ? JSON.parse(str) : str; }

// ---------- debrief ----------
export function buildDebrief(s) {
  const st = s.stats, won = s.status === 'won';
  const m = meters(s);
  const solsSurvived = won ? s.sols : Math.max(0, s.sol - 1);
  const badges = [];
  const add = (id, name, desc) => badges.push({ id, name, desc });
  if (st.stormsFolded > 0) add('dust_master', 'Dust Master', 'You folded every panel before a dust storm hit.');
  if (st.flareSmart > 0) add('shield_smart', 'Shield Smart', 'You kept your radiation dose low during a flare.');
  if (st.harvested >= 10) add('green_thumb', 'Green Thumb', 'You harvested lots of food.');
  if (st.earthCalls >= 2) add('earth_caller', 'Earth Caller', 'You called Earth for help and waited for the answer.');
  if (st.patched >= 2) add('patch_pro', 'Patch Pro', 'You patched leaks and kept the air in.');
  if (won && m.health >= 70) add('calm', 'Calm Under Pressure', 'The crew finished the mission healthy.');
  let stars = 0;
  if (won) stars = 1 + (m.health >= 70 ? 1 : 0) + (m.power >= 35 && m.supplies >= 50 ? 1 : 0);
  const score = Math.round(solsSurvived * 100 + m.health + m.power + m.supplies + badges.length * 50);
  const maxFlareDose = st.flareDoses.length ? Math.max(...st.flareDoses) : 0;
  const lessons = [];
  if (st.flaresFaced > 0) {
    if (st.flareSmart > 0) lessons.push('Shields and shelters cost power or work time, but they protect astronauts from radiation. You made that trade well.');
    else lessons.push('Radiation can hurt astronauts. Raising the shield costs battery power and hiding in the shelter costs work time, so plan ahead.');
  } else lessons.push('Solar flares send out radiation. Mars has thin air, so crews need shields or shelters, and those cost power or time.');
  if (st.stormsFaced > 0) lessons.push(st.stormsFolded > 0
    ? 'You folded the panels before the dust arrived. That protects them, but then the battery has to carry the base alone.'
    : 'Dust blocks sunlight. In 2018 a giant dust storm stopped the Opportunity rover. Folding panels or using low-power mode helps.');
  else lessons.push('Dust on solar panels makes less power. Cleaning panels takes crew time, but it pays back in energy.');
  lessons.push(st.earthCalls > 0
    ? 'Earth\'s answers took minutes each way. Real crews cannot wait for Earth, so they must decide for themselves.'
    : 'You never called Earth. Radio messages need 3 to 22 minutes one way, so a Mars crew must often decide on its own.');
  return {
    status: s.status, solsSurvived, stars, score, badges, lessons, stats: Object.assign({}, st, { maxFlareDose }),
    timeline: s.timeline.slice(), failReason: s.failReason || '', meters: m,
  };
}
