import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './scene.js';
import { CrewView } from './characters.js';
import { FX } from './fx.js';
import { MOD, ST } from './layout.js';
import { makeCanvas, canvasTex, drawStatPanel, drawLeakPanel, drawSkyWarn, drawBubble, drawPrompt, drawIcon, rr, FONT, statColor, clamp, lerp } from './util.js';

export const QUALITY = {
  low:    { pr: 1,   shadows: false, shadowSize: 512,  bloom: false, terrainSeg: 70,  mesas: 8,  rocks: 50,  particles: 0.35, shieldSeg: 20, samples: 0 },
  medium: { pr: 1.5, shadows: true,  shadowSize: 1024, bloom: true,  terrainSeg: 100, mesas: 12, rocks: 100, particles: 0.65, shieldSeg: 28, samples: 0 },
  high:   { pr: 2,   shadows: true,  shadowSize: 2048, bloom: true,  terrainSeg: 130, mesas: 14, rocks: 150, particles: 1,    shieldSeg: 36, samples: 4 },
};
const ORDER = ['low', 'medium', 'high'];

function spriteFrom(w, h, sx, sy, opts = {}) {
  const c = makeCanvas(w, h); const t = canvasTex(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false, toneMapped: false, fog: false }));
  s.scale.set(sx, sy, 1); s.userData = { c, t, key: '' }; if (opts.order) s.renderOrder = opts.order; return s;
}
function redraw(s, key, fn) { if (s.userData.key === key) return; s.userData.key = key; fn(s.userData.c.getContext('2d')); s.userData.t.needsUpdate = true; }

export class World {
  constructor(canvas, qualityName, touch) {
    this.canvas = canvas; this.touch = touch; this.mode = 'auto' === qualityName ? 'auto' : qualityName;
    this.level = this.mode === 'auto' ? 'medium' : this.mode; this.geoLevel = this.level; const q = QUALITY[this.geoLevel];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.level !== 'low', powerPreference: 'high-performance', alpha: false });
    const r = this.renderer; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(touch ? 60 : 55, 1, 0.3, 1600); this.scene.add(this.camera);
    this.env = buildEnvironment(r, this.scene, q);
    this.fx = new FX(this.scene, this.camera, r, q, this.env);
    this.yaw = 0; this.pitch = 0.22; this.dist = touch ? 10.5 : 9.5; this.camPos = new THREE.Vector3(0, 5, 16); this.focus = new THREE.Vector3(0, 0, 6); this.look = new THREE.Vector3(0, 1.5, 0);
    this.crew = []; this.tm = 0; this.sunFlash = 0; this.perfT = 0; this.perfN = 0; this.perfAcc = 0; this.slowFor = 0; this.titleAngle = 0.4; this.mode2 = 'title';
    this.buildHolo();
    this.composer = null; this.bloom = null; this.applyLevel(this.level, true);
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  buildHolo() {
    const sc = this.scene, cam = this.camera;
    const mk = (kind, label, pos) => { const s = spriteFrom(320, 160, 5.2, 2.6); s.position.set(...pos); sc.add(s); s.userData.kind = kind; s.userData.label = label; return s; };
    this.stat = {
      power: mk('power', 'POWER', [MOD.power.x, 7.6, MOD.power.z + 1]), water: mk('water', 'WATER', [MOD.water.x, 7.4, MOD.water.z + 1]),
      food: mk('food', 'FOOD', [MOD.green.x, 9.2, MOD.green.z + 1]), hull: mk('hull', 'HULL', [MOD.med.x, 7.6, MOD.med.z + 1]),
    };
    this.leakS = {}; ['power', 'med', 'water', 'green'].forEach((id) => { const s = spriteFrom(320, 160, 4.4, 2.2, { order: 12 }); s.position.set(MOD[id].x + 1.2, 5.2, MOD[id].z + MOD[id].r - 0.5); s.visible = false; sc.add(s); this.leakS[id] = s; });
    this.clogS = spriteFrom(320, 160, 3.8, 1.9, { order: 12 }); this.clogS.position.set(ST.recycler[0], 4.2, ST.recycler[1] - 0.8); this.clogS.visible = false; sc.add(this.clogS);
    this.earthL = spriteFrom(320, 160, 4.4, 2.2); this.earthL.position.set(-8, 15.2, -13.7); sc.add(this.earthL);
    this.sky = [0, 1].map((i) => { const s = spriteFrom(1024, 256, 12, 3, { depthTest: false, order: 40 }); s.visible = false; cam.add(s); return s; });
    this.earthB = spriteFrom(512, 200, 6.6, 2.58, { depthTest: false, order: 41 }); this.earthB.visible = false; cam.add(this.earthB); this.earthT = 0;
    this.prompt = spriteFrom(512, 112, 5.2, 1.14, { depthTest: false, order: 35 }); this.prompt.visible = false; sc.add(this.prompt);
    this.floats = [];
  }
  floatText(text, color, x, y, z) {
    const c = makeCanvas(256, 64), g = c.getContext('2d'); g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 6; g.strokeText(text, 128, 44); g.fillText(text, 128, 44);
    const t = canvasTex(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); s.scale.set(4, 1, 1); s.position.set(x, y, z); s.renderOrder = 50; this.scene.add(s);
    this.floats.push({ s, t, life: 1.6 }); if (this.floats.length > 8) { const o = this.floats.shift(); this.scene.remove(o.s); o.t.dispose(); o.s.material.dispose(); }
  }
  showEarth(text) { drawBubble(this.earthB.userData.c.getContext('2d'), 'earth', 'earth', 'EARTH', text); this.earthB.userData.t.needsUpdate = true; this.earthB.userData.key = text; this.earthT = 9; }
  applyLevel(level, first) {
    this.level = level; const q = QUALITY[level], r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    const wantShadow = q.shadows && QUALITY[this.geoLevel].shadows; if (r.shadowMap.enabled !== wantShadow || first) { r.shadowMap.enabled = wantShadow; this.env.sunL.castShadow = wantShadow; this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { x.needsUpdate = true; }); } }); }
    if (q.bloom) { if (!this.composer) this.makeComposer(q); this.bloom.enabled = true; } else this.composer = null;
    this.resize(); this.fx.rs = q.particles >= 0.65 ? this.fx.rs : Math.min(this.fx.rs, 0.4);
  }
  makeComposer(q) {
    const r = this.renderer; const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.samples });
    this.composer = new EffectComposer(r, rt); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.65, 0.84); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  setQuality(name) { this.mode = name; this.slowFor = 0; this.applyLevel(name === 'auto' ? (this.level === 'low' ? 'low' : 'medium') : name); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2); }
    const asp = w / h, k = clamp(asp / 1.75, 0.55, 1); this.sky.forEach((s, i) => { s.scale.set(12 * k, 3 * k, 1); s.position.set(0, (asp < 1.5 ? 4.0 : 4.7) - i * 3.1 * k, -14); }); this.earthB.position.set(-4.5 * Math.min(1, asp / 1.6), -3.0 + 5.4, -14); this.earthB.scale.set(6.6 * k, 2.58 * k, 1);
    this.earthB.position.set(-(asp * 3.8) + 3.6 * k, 4.6 - 2.1 * k - 3.3, -14);
  }
  setState(state, playerIdx) {
    this.crew.forEach((c) => c.dispose(this.scene)); this.crew = state.crew.map((c, i) => new CrewView(this.scene, c.id, i === playerIdx, QUALITY[this.geoLevel]));
    this.playerIdx = playerIdx; this.fx.craters.forEach((c) => this.scene.remove(c)); this.fx.craters.length = 0;
  }
  perf(dt) { // adaptive quality (auto mode)
    if (this.mode !== 'auto' || this.mode2 === 'title') return; this.perfAcc += dt; this.perfN++;
    if (this.perfAcc > 2.5) { const fps = this.perfN / this.perfAcc; this.perfAcc = 0; this.perfN = 0; this.fps = fps;
      if (fps < 38) { this.slowFor++; if (this.slowFor >= 2) { this.slowFor = 0; const i = ORDER.indexOf(this.level); if (i > 0) this.applyLevel(ORDER[i - 1]); } } else this.slowFor = 0; }
  }
  update(state, dt, ctx) {
    this.tm += dt; const tm = this.tm; const info = ctx.info; const pc = state.crew[this.playerIdx]; const title = this.mode2 === 'title';
    // camera
    const tx = pc.x, tz = pc.z;
    if (title) { this.titleAngle += dt * 0.05; const R = 40, a = this.titleAngle; const des = new THREE.Vector3(Math.sin(a) * R * 0.9 + 2, 9 + Math.sin(tm * 0.2) * 1.2, Math.cos(a) * R * 0.5 + 24); this.camera.position.lerp(des, Math.min(1, dt * 2)); this.look.lerp(new THREE.Vector3(0, 4, -4), Math.min(1, dt * 3)); this.camera.lookAt(this.look); this.focus.set(0, 0, 0); }
    else {
      const cp = Math.cos(this.pitch), right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const tgt = new THREE.Vector3(tx, 2.6, tz).addScaledVector(right, 1.1);
      const des = new THREE.Vector3(tx, 1.7, tz).add(new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist));
      des.y = Math.max(des.y, 1.0); const k = 1 - Math.exp(-dt * 9); this.camera.position.lerp(des, k); this.look.lerp(tgt, 1 - Math.exp(-dt * 12));
      const sh = this.fx.shake; if (sh > 0) { this.camera.position.x += (Math.random() - 0.5) * sh * 0.5; this.camera.position.y += (Math.random() - 0.5) * sh * 0.5; }
      this.camera.lookAt(this.look); this.focus.set(tx, 0, tz);
    }
    this.camPos.copy(this.camera.position);
    this.camera.updateMatrixWorld();
    // sun flash on flare
    this.sunFlash = Math.max(0, this.sunFlash - dt * 0.35); const fw = state.events.find((e) => e.type === 'flare');
    const sf = fw && fw.phase === 'warn' ? 0.4 + 0.5 * Math.abs(Math.sin(tm * 3)) : 0; this.env.update(state, info, dt, tm, { camPos: this.camPos, focus: this.focus, sunFlash: Math.max(this.sunFlash, sf) });
    this.fx.update(state, dt, tm, { focus: this.focus, urgent: ctx.urgent }, this.crew);
    // crew
    const wrist = { sol: 'SOL ' + info.sol, time: info.clock, dose: ctx.meters.dose };
    this.crew.forEach((cv, i) => cv.update(state.crew[i], dt, tm, this.camera, wrist));
    // stat holo panels
    const S = this.stat; const M = ctx.meters; const pulse = 1 + 0.015 * Math.sin(tm * 2);
    const upd = (s, v) => { const r = Math.round(v); redraw(s, s.userData.kind + r, (g) => drawStatPanel(g, s.userData.kind, s.userData.label, r, r < 25)); s.scale.set(5.2 * pulse, 2.6 * pulse, 1); s.position.y = s.position.y; };
    upd(S.power, M.power); upd(S.water, M.water); upd(S.food, M.food); upd(S.hull, M.hull);
    ['power', 'med', 'water', 'green'].forEach((id) => { const m = state.modules[id], s = this.leakS[id]; s.visible = !!m.leak; if (m.leak) { redraw(s, 'leak', (g) => drawLeakPanel(g, 'HULL LEAK!')); const k = 1 + 0.07 * Math.sin(tm * 7); s.scale.set(4.4 * k, 2.2 * k, 1); } });
    this.clogS.visible = state.recycler.clogged; if (this.clogS.visible) { redraw(this.clogS, 'clog', (g) => drawLeakPanel(g, 'CLOGGED!')); const k = 1 + 0.07 * Math.sin(tm * 7); this.clogS.scale.set(3.8 * k, 1.9 * k, 1); }
    const dl = Math.round(info.delayMin); redraw(this.earthL, 'e' + dl + (state.lowPower ? 'x' : ''), (g) => { drawEarthPanel(g, dl, state.lowPower); });
    // sky warnings
    this.updateSky(state, tm);
    if (this.earthT > 0) { this.earthT -= dt; this.earthB.visible = this.earthT > 0; this.earthB.material.opacity = clamp(this.earthT / 0.6, 0, 1); } else this.earthB.visible = false;
    // prompt
    const pr = ctx.prompt;
    if (pr && !title) { const st = ST[pr.stationId]; if (st) { this.prompt.visible = true; const txt = (pr.enabled ? (this.touch ? 'USE: ' : '[E] Hold: ') : '') + pr.label + (pr.enabled ? '' : (pr.reason ? ' - ' + pr.reason : '')); redraw(this.prompt, txt + pr.enabled, (g) => drawPrompt(g, txt, pr.enabled)); this.prompt.position.set(st[0], 3.4, st[1]); } } else this.prompt.visible = false;
    // floating texts
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.life -= dt; f.s.position.y += dt * 1.8; f.s.material.opacity = clamp(f.life / 0.6, 0, 1); if (f.life <= 0) { this.scene.remove(f.s); f.t.dispose(); f.s.material.dispose(); this.floats.splice(i, 1); } }
    // flash overlay for radiation / storm handled in main via weather values
  }
  updateSky(state, tm) {
    const lines = [];
    for (const e of state.events) {
      const rem = Math.max(0, Math.ceil(e.warnDur - e.t)); const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (e.type === 'storm') lines.push(e.phase === 'warn' ? ['DUST STORM IN ' + mmss(rem), 'Fold the solar panels or save power'] : ['DUST STORM!', 'Panels make less power in dust']);
      else if (e.type === 'flare') lines.push(e.phase === 'warn' ? ['SOLAR FLARE IN ' + mmss(rem), e.known ? 'Strength ' + e.intensity + ' of 3. Use the shield or shelter' : 'Strength unknown. Call Earth or play safe'] : ['RADIATION SURGE!', 'Use the shield or go to the shelter']);
      else if (e.type === 'meteor' && e.phase === 'warn') lines.push(['SPACE ROCK INCOMING!', 'Impact in ' + rem + ' s']);
      else if (e.type === 'geomag') lines.push(['EARTH RADIO STORM', 'Messages from Earth are slower']);
      else if (e.type === 'clog' && e.t < 7) lines.push(['RECYCLER CLOGGED!', 'Get a repair kit and fix it']);
    }
    this.sky.forEach((s, i) => { const l = lines[i]; s.visible = !!l; if (l) { redraw(s, l[0] + l[1], (g) => drawSkyWarn(g, l[0], l[1])); s.material.opacity = 0.82 + 0.18 * Math.sin(tm * 5); } });
  }
  render() { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
}

function drawEarthPanel(ctx, delay, low) {
  const w = 320, h = 160; ctx.clearRect(0, 0, w, h); rr(ctx, 8, 8, w - 16, h - 16, 24);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(20,70,110,.78)'); g.addColorStop(1, 'rgba(8,34,60,.78)'); ctx.fillStyle = g; ctx.fill();
  const col = low ? '#ffb23a' : '#4fe3ff'; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke(); ctx.shadowBlur = 0;
  drawIcon(ctx, 'earth', 26, 38, 78, col); ctx.fillStyle = '#d8f6ff'; ctx.font = `800 26px ${FONT}`; ctx.fillText(low ? 'COMMS OFF' : 'EARTH LINK', 120, 60);
  ctx.fillStyle = '#fff'; ctx.font = `900 56px ${FONT}`; ctx.fillText(low ? '--' : delay + ' min', 118, 124); ctx.font = `700 20px ${FONT}`; ctx.fillStyle = '#b8e8f8'; if (!low) ctx.fillText('one-way delay', 122, 146);
}
