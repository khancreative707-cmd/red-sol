// Headless tests + bots for the RED SOL sim.  Run: node tests/sim.test.js
import { createGame, tick, release, getAction, STATIONS, serialize, restore, buildDebrief, meters, solInfo } from '../src/sim/sim.js';

const STN = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const CREW = ['mei', 'diego', 'asha'];
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ test: name, result: ok ? 'PASS' : 'FAIL', detail: detail || '' });
  if (!ok) failed++;
}

// ---------- bots (drive input through the same API a human uses) ----------
function brain(kind, s) {
  const i = s.playerIdx, c = s.crew[i];
  if (kind === 'idle') return {};
  const storm = s.events.find(e => e.type === 'storm'), fl = s.events.find(e => e.type === 'flare');
  const flAct = fl && (fl.phase === 'active' || fl.warnDur - fl.t <= 16);
  let target = null;
  if (kind === 'greedy') { if (s.shield !== 3) target = 'shield'; }
  else {
    if (storm && (storm.phase === 'active' || storm.warnDur - storm.t <= 24)) { const p = s.panels.findIndex(x => !x.folded); if (p >= 0) target = 'panel' + p; }
    if (!target && kind === 'shield2' && flAct && s.shield < 2) target = 'shield';
    if (c.inShelter) { target = fl ? null : 'shelter'; if (!target) return { mx: 0, mz: 0, use: false }; }
    else if (!target && kind === 'good' && flAct) target = 'shelter';
    if (!target) {
      for (const m of ['power', 'med', 'water', 'green']) {
        if (s.modules[m].leak) { target = c.carry ? 'leak_' + m : 'storage'; break; }
      }
    }
    if (!target && s.recycler.clogged) target = c.carry ? 'recycler' : 'storage';
    if (!target && s.plots.some(p => p.g >= 1)) target = 'greenhouse';
    if (!target && !storm) { const p = s.panels.findIndex(x => x.folded); if (p >= 0) target = 'panel' + p; }
    if (!target && !storm) { const p = s.panels.findIndex(x => x.dust > 0.35); if (p >= 0) target = 'panel' + p; }
    if (!target && s.treatCd <= 0 && s.crew.some(x => x.hp < 85)) target = 'medbay';
    if (!target && kind === 'shield2' && !fl && s.shield > 0) target = 'shield';
  }
  if (!target) return { mx: 0, mz: 0 };
  const st = STN[target];
  const dx = st.ax - c.x, dz = st.az - c.z, d = Math.hypot(dx, dz);
  if (d > 0.8) return { mx: dx / d, mz: dz / d, run: true, use: false };
  const a = getAction(s, i);
  return { mx: 0, mz: 0, use: !!(a && a.enabled && a.stationId === target) };
}

function run(kind, seed, crewId, opts = {}) {
  const s = createGame({ seed, crewId, sols: opts.sols || 7, aiEnabled: opts.aiEnabled !== false });
  let n = 0;
  while (s.status === 'playing' && n++ < 40000) {
    if (s.hold) release(s);
    tick(s, 0.1, brain(kind, s));
  }
  return s;
}

const hasNaN = (o) => {
  if (typeof o === 'number') return !Number.isFinite(o);
  if (o && typeof o === 'object') { for (const k in o) if (hasNaN(o[k])) return true; }
  return false;
};

const t0 = Date.now();

// (1) determinism
{
  const a = serialize(run('good', 7, 'diego')), b = serialize(run('good', 7, 'diego'));
  check('1 determinism (same seed + inputs -> same state)', a === b);
}

// (2) serialize/restore continues identically
{
  const A = createGame({ seed: 11, crewId: 'asha' });
  for (let k = 0; k < 900; k++) { if (A.hold) release(A); tick(A, 0.1, brain('good', A)); }
  const B = restore(serialize(A));
  for (let k = 0; k < 900; k++) {
    if (A.hold) release(A); if (B.hold) release(B);
    tick(A, 0.1, brain('good', A)); tick(B, 0.1, brain('good', B));
  }
  check('2 serialize/restore mid-game continues identically', serialize(A) === serialize(B));
}

// (3) event variety
{
  const seqs = new Set(); let allGuar = true;
  for (let seed = 1; seed <= 30; seed++) {
    const g = createGame({ seed });
    const flat = g.sched.flat().map(e => e.type);
    seqs.add(g.sched.map(a => a.map(e => e.type + '@' + Math.round(e.at)).join(',')).join('|'));
    for (const t of ['storm', 'flare', 'meteor', 'clog']) if (!flat.includes(t)) allGuar = false;
  }
  check('3a event schedules differ across seeds', seqs.size >= 10, seqs.size + ' distinct of 30');
  check('3b every 7-sol schedule has storm, flare, meteor, clog', allGuar);
  const g4 = createGame({ seed: 5, sols: 4 }); const f4 = g4.sched.flat().map(e => e.type);
  check('3c 4-sol mission also has all four guaranteed events', ['storm', 'flare', 'meteor', 'clog'].every(t => f4.includes(t)));
}

// (4) bots
const SEEDS = 40;
const stat = {};
function batch(name, kind, opts = {}, crewFixed) {
  let win = 0, fail = 0, scoreSum = 0, starSum = 0, solsSum = 0, doseSum = 0, doseN = 0, nan = false, err = false;
  const ends = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = run(kind, seed, crewFixed || CREW[seed % 3], opts);
    if (s.status === 'won') win++; else fail++;
    if (hasNaN(s)) nan = true;
    if (s.lastError) { err = s.lastError; }
    const d = buildDebrief(s);
    solsSum += d.solsSurvived; scoreSum += d.score; starSum += d.stars;
    ends.push(meters(s));
    for (const x of s.stats.flareDoses) { doseSum += x; doseN++; }
  }
  const avgHealth = ends.reduce((a, m) => a + m.health, 0) / ends.length;
  const avgPower = ends.reduce((a, m) => a + m.power, 0) / ends.length;
  stat[name] = { win, fail, score: Math.round(scoreSum / SEEDS), stars: (starSum / SEEDS).toFixed(2), avgSols: (solsSum / SEEDS).toFixed(1), avgHealth: avgHealth.toFixed(0), avgPower: avgPower.toFixed(0), flareDose: doseN ? (doseSum / doseN).toFixed(1) : '-', nan, err };
  return stat[name];
}

const idleOff = batch('idle (nobody acts, AI off)', 'idle', { aiEnabled: false });
check('4a idle with NO crew action fails or ends weak in >=90% of seeds',
  (idleOff.fail + (SEEDS - idleOff.fail - 0)) >= 0 && idleOff.fail / SEEDS >= 0.9, `fail ${idleOff.fail}/${SEEDS}`);
const idleAI = batch('idle player (AI crew on)', 'idle');
const good = batch('GOOD bot (AI crew on)', 'good');
check('4b GOOD bot wins >=70%', good.win / SEEDS >= 0.7, `win ${good.win}/${SEEDS}`);
check('4c GOOD bot beats an idle player (avg score) and is not a 100% trivial win', good.score > idleAI.score && good.win < SEEDS, `score good ${good.score} vs idle-player ${idleAI.score}; wins ${good.win} vs ${idleAI.win}`);
const greedy = batch('GREEDY-SHIELD bot (shield 3, no chores)', 'greedy');
check('4d greedy shield bot (max shield, no chores) fails clearly more than the good bot', greedy.fail > good.fail, `greedy fail ${greedy.fail}/${SEEDS} vs good ${good.fail}/${SEEDS}`);
const noSh = batch('NO-SHIELD works (player=Mei)', 'noshield', {}, 'mei');
const sh2 = batch('SHIELD-2 works (player=Mei)', 'shield2', {}, 'mei');
check('4e no-shield bot takes clearly more flare dose than shield-2 bot',
  Number(noSh.flareDose) > Number(sh2.flareDose) * 1.5, `no-shield ${noSh.flareDose} vs shield-2 ${sh2.flareDose} (raw dose per flare)`);

// (5) NaN / errors
check('5 no NaN and no thrown errors for any bot', Object.values(stat).every(x => !x.nan && !x.err), Object.values(stat).map(x => x.err || '').join(''));

// extra: AI really acts (positions change, tasks complete) with an idle player
{
  const s = createGame({ seed: 3, crewId: 'mei' });
  const start = s.crew.map(c => [c.x, c.z]);
  let moved = 0, done = 0;
  for (let k = 0; k < 3000; k++) {
    if (s.hold) release(s);
    for (const e of tick(s, 0.1, {})) if (e.type === 'task_done' && e.crew !== 0) done++;
    s.crew.forEach((c, i) => { if (i !== 0 && Math.hypot(c.x - start[i][0], c.z - start[i][1]) > 3) moved++; });
  }
  check('6 AI crew move and finish jobs on their own', moved > 100 && done >= 5, `AI tasks done in 5 sols: ${done}`);
}

console.log('\nBot results (' + SEEDS + ' seeds each, 7 sols):');
console.table(Object.fromEntries(Object.entries(stat).map(([k, v]) => [k, { win: v.win, fail: v.fail, avgSolsSurvived: v.avgSols, endHealth: v.avgHealth, avgScore: v.score, avgStars: v.stars, endPower: v.avgPower, flareDose: v.flareDose }])));
console.log('\nTests:');
console.table(results);
console.log(`Elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('ALL PASSED');
