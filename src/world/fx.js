import * as THREE from 'three';
import { clamp, lerp, smooth, groundH } from './util.js';
import { ST, MOD, SHIELD_C } from './layout.js';

const PROT = [0, 0.45, 0.75, 0.93];

class PointPool {
  constructor(scene, max, additive, uScale) {
    this.max = max; this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.col = new Float32Array(max * 4); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    this.size = new Float32Array(max); this.colOut = new Float32Array(max * 4); this.i = 0; this.hooks = new Array(max).fill(null);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.colOut, 4));
    this.uScale = uScale;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
      vertexShader: 'attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale; void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(aSize*uScale/max(0.1,-mv.z), 0.0, 600.0); }',
      fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.05,d)*vC.a; if(a<0.004) discard; gl_FragColor = vec4(vC.rgb*${additive ? '1.6' : '1.0'}, a); }`,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 8 : 6; scene.add(this.pts); this.g = g;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 0, grav = 0, hook = null) {
    const k = this.i; this.i = (this.i + 1) % this.max; const k3 = k * 3, k4 = k * 4;
    this.pos[k3] = x; this.pos[k3 + 1] = y; this.pos[k3 + 2] = z; this.vel[k3] = vx; this.vel[k3 + 1] = vy; this.vel[k3 + 2] = vz;
    this.life[k] = life; this.maxLife[k] = life; this.s0[k] = s0; this.s1[k] = s1; this.col[k4] = r; this.col[k4 + 1] = g; this.col[k4 + 2] = b; this.col[k4 + 3] = a; this.drag[k] = drag; this.grav[k] = grav; this.hooks[k] = hook;
  }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.size[k] = 0; continue; }
      this.life[k] -= dt; const k3 = k * 3, k4 = k * 4;
      if (this.life[k] <= 0) { this.size[k] = 0; if (this.hooks[k]) { this.hooks[k](this.pos[k3], this.pos[k3 + 1], this.pos[k3 + 2]); this.hooks[k] = null; } continue; }
      const dr = Math.max(0, 1 - this.drag[k] * dt); this.vel[k3] *= dr; this.vel[k3 + 1] = this.vel[k3 + 1] * dr - this.grav[k] * dt; this.vel[k3 + 2] *= dr;
      this.pos[k3] += this.vel[k3] * dt; this.pos[k3 + 1] += this.vel[k3 + 1] * dt; this.pos[k3 + 2] += this.vel[k3 + 2] * dt;
      const t = 1 - this.life[k] / this.maxLife[k]; this.size[k] = lerp(this.s0[k], this.s1[k], t);
      const fade = Math.min(1, t * 8) * (1 - t * t); this.colOut[k4] = this.col[k4]; this.colOut[k4 + 1] = this.col[k4 + 1]; this.colOut[k4 + 2] = this.col[k4 + 2]; this.colOut[k4 + 3] = this.col[k4 + 3] * fade;
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aSize.needsUpdate = true; this.g.attributes.aColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera, renderer, q, env) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.q = q; this.env = env; this.rs = q.particles;
    this.uScale = { value: 800 };
    this.dust = new PointPool(scene, Math.round(1400 * this.rs), false, this.uScale);
    this.glow = new PointPool(scene, Math.round(1800 * this.rs), true, this.uScale);
    // storm wall
    const N = Math.round(150 * this.rs) + 30; this.wallN = N; const wp = new Float32Array(N * 3), ws = new Float32Array(N), wc = new Float32Array(N * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wp, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(ws, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(wc, 4));
    this.wall = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false, fog: false,
      vertexShader: this.dust.mat.vertexShader, fragmentShader: this.dust.mat.fragmentShader }));
    this.wall.frustumCulled = false; this.wall.renderOrder = 4; scene.add(this.wall); this.wallData = Array.from({ length: N }, (_, i) => ({ th: (Math.random() - 0.5) * 2.5, h: Math.pow(Math.random(), 0.7) * 46, s: 55 + Math.random() * 70, ph: Math.random() * 6, r: Math.random() }));
    // meteor
    this.meteor = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.8), toneMapped: false })); this.meteor.visible = false; scene.add(this.meteor);
    this.impactLight = new THREE.PointLight(0xffa860, 0, 40, 1.6); scene.add(this.impactLight); this.impactT = 0;
    this.shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 0.6), transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); this.shock.rotation.x = -Math.PI / 2; this.shock.visible = false; scene.add(this.shock); this.shockT = 9;
    this.craterMat = new THREE.MeshBasicMaterial({ color: 0x2a0e06, transparent: true, opacity: 0.7, depthWrite: false }); this.craters = [];
    // dust devil
    this.devil = new THREE.Group(); const dm = new THREE.MeshBasicMaterial({ color: 0xb9743f, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.devil.add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 0.7, 11, 18, 1, true), dm), new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.5, 9, 14, 1, true), dm)); this.devil.visible = false; scene.add(this.devil);
    // task rings (urgent stations)
    this.rings = []; const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.3), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 36), rm.clone()); r.rotation.x = -Math.PI / 2; r.position.y = 0.09; r.visible = false; scene.add(r); this.rings.push(r); }
    this.leakRings = {}; ['power', 'med', 'water', 'green'].forEach((id) => { const r = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); r.rotation.x = -Math.PI / 2; r.position.set(ST['leak_' + id][0] - 1.0, 0.1, ST['leak_' + id][1] + 0.4); r.visible = false; scene.add(r); this.leakRings[id] = r; });
    this.acc = { smoke: 0, rad: 0, wind: 0, mote: 0, leak: 0, work: 0, steps: 0 }; this.shake = 0; this.lastRip = 0; this.flareAbsorbed = 0;
    for (let i = 0; i < 40 * this.rs; i++) this.glow.emit((Math.random() - 0.5) * 80, 1 + Math.random() * 8, (Math.random() - 0.5) * 60 - 4, 0.3, 0.1, 0.2, 99999, 0.18, 0.18, 1, 0.8, 0.5, 0.35, 0, 0);
  }
  puff(x, y, z, n = 3, s = 1, r = 0.86, g = 0.55, b = 0.34) { for (let i = 0; i < n; i++) this.dust.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 0.6, 0.35 * s, 1.5 * s, r, g, b, 0.55, 1.5, -0.2); }
  sparks(x, y, z, n, r, g, b, spd = 4) { for (let i = 0; i < n; i++) this.glow.emit(x, y, z, (Math.random() - 0.5) * spd, Math.random() * spd * 0.9, (Math.random() - 0.5) * spd, 0.4 + Math.random() * 0.5, 0.16, 0.04, r, g, b, 1, 1.0, 9); }
  strike(x, z, y = 2) {
    this.impactLight.position.set(x, y + 3, z); this.impactT = 1; this.shake = 1; this.shock.position.set(x, 0.15, z); this.shockT = 0; this.shock.visible = true;
    for (let i = 0; i < 70 * this.rs; i++) this.glow.emit(x, y, z, (Math.random() - 0.5) * 16, Math.random() * 12 + 2, (Math.random() - 0.5) * 16, 0.8 + Math.random() * 0.9, 0.35, 0.05, 1, 0.55 + Math.random() * 0.3, 0.2, 1, 0.3, 14);
    for (let i = 0; i < 28 * this.rs; i++) this.dust.emit(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 7, 1 + Math.random() * 5, (Math.random() - 0.5) * 7, 1.6 + Math.random() * 1.4, 1.2, 6, 0.35, 0.22, 0.16, 0.7, 1.2, 0.2);
    const c = new THREE.Mesh(new THREE.CircleGeometry(1.4 + Math.random() * 0.6, 14), this.craterMat); c.rotation.x = -Math.PI / 2; c.position.set(x + 2, 0.06, z + 5.5); this.scene.add(c); this.craters.push(c); if (this.craters.length > 8) this.scene.remove(this.craters.shift());
  }
  radHit(x, y, z) { this.sparks(x, y, z, 3, 0.8, 0.7, 1, 3); const now = performance.now(); if (now - this.lastRip > 120) { this.lastRip = now; this.env.addRipple(x, y, z); } }
  update(state, dt, tm, ctx, crewViews) {
    const cam = this.camera; this.uScale.value = this.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    const storm = state.weather.storm, flare = state.weather.flare || 0, A = this.acc, rs = this.rs; const cp = cam.position;
    // ---- storm wall
    const wp = this.wall.geometry.attributes.position.array, ws = this.wall.geometry.attributes.aSize.array, wc = this.wall.geometry.attributes.aColor.array;
    const u = clamp(storm, 0, 1); this.wall.visible = u > 0.01;
    if (this.wall.visible) {
      const D = lerp(210, 10, Math.pow(u, 1.2)); const inside = smooth(0.82, 1, u);
      for (let i = 0; i < this.wallN; i++) {
        const w = this.wallData[i]; const th = w.th + Math.sin(tm * 0.2 + w.ph) * 0.03; const d = D + Math.sin(tm * 0.5 + w.ph * 2) * 5 + w.r * 25;
        wp[i * 3] = Math.sin(th) * d * 1.3 + ctx.focus.x * 0.3; wp[i * 3 + 1] = w.h * (0.35 + 0.65 * u) + 2 + Math.sin(tm * 0.8 + w.ph) * 2; wp[i * 3 + 2] = -Math.cos(th) * d - 4 + ctx.focus.z * 0.3;
        ws[i] = w.s * 1.25 * (0.7 + 0.5 * u) * (1 - inside * 0.4); const a = (0.55 - w.r * 0.2) * Math.min(1, u * 3.5) * (1 - inside * 0.7);
        wc[i * 4] = 0.55 + w.r * 0.12; wc[i * 4 + 1] = 0.3 + w.r * 0.08; wc[i * 4 + 2] = 0.16; wc[i * 4 + 3] = Math.min(1, a * 1.35);
      }
      const g = this.wall.geometry.attributes; g.position.needsUpdate = g.aSize.needsUpdate = g.aColor.needsUpdate = true;
    }
    // wind streaks
    if (u > 0.5) { A.wind += dt * 420 * rs * (u - 0.4); while (A.wind > 1) { A.wind--; const x = cp.x + (Math.random() - 0.5) * 70 - 14, y = 0.5 + Math.random() * 16, z = cp.z - 40 + Math.random() * 60 - 30; this.dust.emit(x, y, z, 24 + Math.random() * 8, -0.3, 34 + Math.random() * 10, 1.3, 0.5, 0.9, 0.72, 0.45, 0.25, 0.5, 0, 0); } }
    // ambient motes (slow)
    // ---- flare / radiation
    const lv = state.shield; if (flare > 0.05) {
      A.rad += dt * 120 * rs * flare; const pr = PROT[lv] || 0;
      while (A.rad > 1) { A.rad--;
        const a = Math.random() * 6.28, rd = Math.sqrt(Math.random()) * 40; const x = SHIELD_C.x + Math.cos(a) * rd, z = SHIELD_C.z + Math.sin(a) * rd * 0.7; const y0 = 70; const vx = 14, vy = -62, vz = 9;
        const sd = Math.hypot(x - SHIELD_C.x, z - SHIELD_C.z); const hs = sd < SHIELD_C.r ? Math.sqrt(SHIELD_C.r * SHIELD_C.r - sd * sd) : -1;
        const absorbed = lv > 0 && hs > 0 && Math.random() < pr + 0.05; const endY = absorbed ? hs : 0; const life = (y0 - endY) / -vy; const hook = absorbed ? ((hx, hy, hz) => this.radHit(hx, hy, hz)) : null;
        const hue = Math.random(); const rr = hue < 0.5 ? 0.95 : 1, gg = hue < 0.5 ? 0.55 : 0.8, bb = hue < 0.5 ? 1 : 0.5;
        for (let k = 0; k < 5; k++) this.glow.emit(x - vx * 0.016 * k, y0 + 1.0 * k, z - vz * 0.016 * k, vx, vy, vz, life, 1.1 - k * 0.16, 0.7, rr, gg, bb, 0.95 - k * 0.17, 0, 0, k === 0 ? hook : null);
        if (!absorbed && Math.random() < 0.35) { /* ground hit glint */ }
      }
    }
    // ---- meteor
    let mev = null; for (const e of state.events) if (e.type === 'meteor' && e.phase === 'warn') mev = e;
    if (mev && mev.target) { const T = this.targetOf(mev); const pr = clamp(mev.t / mev.warnDur, 0, 1); const L = 230 * (1 - pr); const dir = this.dirV || (this.dirV = new THREE.Vector3(0.55, 0.85, -0.5).normalize());
      this.meteor.visible = true; this.meteor.position.set(T.x + dir.x * L, 3 + dir.y * L, T.z + dir.z * L);
      for (let i = 0; i < 3; i++) { const p = this.meteor.position; this.glow.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.9, 1.6, 0.2, 1, 0.6, 0.25, 0.9, 1, 0); this.dust.emit(p.x, p.y, p.z, 0, 0, 0, 1.4, 1.2, 3.2, 0.55, 0.45, 0.4, 0.5, 1, 0); }
    } else this.meteor.visible = false;
    if (this.impactT > 0) { this.impactT -= dt * 2.2; this.impactLight.intensity = Math.max(0, this.impactT) * 120; }
    if (this.shockT < 1) { this.shockT += dt * 1.1; const s = 1 + this.shockT * 22; this.shock.scale.setScalar(s); this.shock.material.opacity = (1 - this.shockT) * 0.8; if (this.shockT >= 1) this.shock.visible = false; }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    // ---- dust devil
    const dv = state.weather.devil; this.devil.visible = !!dv;
    if (dv) { this.devil.position.set(dv.x, 5.5, dv.z); this.devil.rotation.y = tm * 4; this.devil.children[1].rotation.y = -tm * 6; A.mote += dt * 90 * rs; while (A.mote > 1) { A.mote--; const a = Math.random() * 6.28, h = Math.random() * 10, rr = 0.6 + h * 0.28; this.dust.emit(dv.x + Math.cos(a) * rr, h, dv.z + Math.sin(a) * rr, -Math.sin(a) * 6, 2, Math.cos(a) * 6, 1.1, 0.5, 1.1, 0.8, 0.5, 0.3, 0.6, 0, 0); } }
    // ---- leaks
    let ri = 0; const urg = ctx.urgent || [];
    A.leak += dt * 30 * rs;
    ['power', 'med', 'water', 'green'].forEach((id) => { const m = state.modules[id]; const R = this.leakRings[id]; R.visible = !!m.leak; if (m.leak) { R.scale.setScalar(1 + 0.12 * Math.sin(tm * 6)); R.material.opacity = 0.55 + 0.4 * Math.sin(tm * 6);
      if (A.leak > 1) { const mm = MOD[id]; this.dust.emit(mm.x + 1 + (Math.random() - 0.5), 2.3, mm.z + mm.r - 0.6, 0.4 + Math.random() * 0.4, 2.2 + Math.random(), 0.3, 1.8, 0.7, 3.2, 0.9, 0.9, 0.92, 0.5, 0.4, 0);
        if (Math.random() < 0.3) this.glow.emit(mm.x + 1, 2.1, mm.z + mm.r - 0.5, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, 0.6, 0.5, 0.14, 0.03, 1, 0.7, 0.3, 1, 1, 9); } } });
    if (A.leak > 1) A.leak = 0;
    if (state.recycler.clogged && this.env.recPos && Math.random() < dt * 14) this.dust.emit(this.env.recPos.x, 1.9, this.env.recPos.z, 0.3, 1.8, 0.2, 1.4, 0.4, 2.0, 0.95, 0.95, 0.95, 0.4, 0.5, 0);
    // ---- urgent rings
    this.rings.forEach((r) => { r.visible = false; });
    urg.slice(0, 8).forEach((id, i) => { const p = ST[id]; if (!p) return; const r = this.rings[i]; r.visible = true; r.position.x = p[0]; r.position.z = p[1]; r.scale.setScalar(1 + 0.12 * Math.sin(tm * 5 + i)); r.material.opacity = 0.5 + 0.4 * Math.sin(tm * 5 + i); });
    // ---- crew: footsteps + work effects
    const cs = state.crew; A.work += dt; A.steps += dt;
    cs.forEach((c, i) => {
      if (c.inShelter) return;
      if (c.speed > 5.5 && A.steps > 0.12) this.puff(c.x, 0.15, c.z, 1, 0.8);
      if (c.task && A.work > 0.06) { const st = ST[c.task.stationId]; if (!st) return; const a = c.task.actionId; const wy = 1.0;
        if (a === 'patch' || a === 'fix_recycler' || a === 'make_kit') this.sparks(st[0], wy + 0.4, st[1] - 1, 2, 1, 0.75, 0.3, 4);
        else if (a === 'harvest') this.sparks(c.x, 1.6, c.z + 1, 1, 0.5, 1, 0.5, 2);
        else if (a === 'treat') this.sparks(c.x, 1.6, c.z, 1, 0.4, 0.95, 1, 2);
        else if (a === 'fold' || a === 'unfold' || a === 'clean') this.puff(c.x - 0.5, 0.9, c.z, 1, 1);
        else if (a === 'call_earth') this.sparks(ST.comms[0], 8 + Math.random() * 3, ST.comms[1] - 1.6, 1, 0.5, 0.9, 1, 3);
        else if (a === 'shield_cycle') this.sparks(ST.shield[0], 1.8, ST.shield[1] - 1, 2, 0.4, 0.9, 1, 3);
      } });
    if (A.work > 0.06) A.work = 0; if (A.steps > 0.12) A.steps = 0;
    this.dust.update(dt); this.glow.update(dt);
  }
  targetOf(ev) { const m = MOD[ev.target] || MOD.med; return { x: m.x, z: m.z }; }
}
