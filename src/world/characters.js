import * as THREE from 'three';
import { CREW_LOOK, makeCanvas, canvasTex, drawWrist, drawBubble, clamp } from './util.js';

const mat = (c, r = 0.55, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const lit = (c, k = 0.9) => { const m = mat(c, 0.5); m.emissive = new THREE.Color(0x5a5048); m.emissiveIntensity = k; return m; };
const WHITE = lit(0xffffff), WHITE2 = lit(0xf0ebe4, 0.8), ORANGE = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5, emissive: 0x6a2a00, emissiveIntensity: 0.5 }), BOOT = mat(0x3a3430, 0.7, 0.2);
const DARK = mat(0x2a2624, 0.7, 0.2), GREY = mat(0x9a918a, 0.5, 0.4);

let blobTex = null;
function blob() {
  if (!blobTex) { const c = makeCanvas(64, 64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(30,8,0,.55)'); g.addColorStop(1, 'rgba(30,8,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTex = canvasTex(c); }
  return blobTex;
}

function part(geo, m, x, y, z, shadow = true) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; return o; }

export class CrewView {
  constructor(scene, id, isPlayer, q) {
    this.id = id; this.isPlayer = isPlayer; const L = CREW_LOOK[id]; this.look = L;
    this.root = new THREE.Group(); scene.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    const accent = mat(L.accent, 0.5), body = this.body;
    // ---- torso (white, rounded) with orange panels ----
    body.add(part(new THREE.CapsuleGeometry(0.43, 0.5, 6, 16), WHITE, 0, 1.0, 0));
    const belt = part(new THREE.TorusGeometry(0.43, 0.075, 8, 22), ORANGE, 0, 0.72, 0, false); belt.rotation.x = Math.PI / 2; body.add(belt);
    [-1, 1].forEach((sd) => { body.add(part(new THREE.BoxGeometry(0.1, 0.42, 0.34), ORANGE, sd * 0.4, 1.05, 0.12, false)); }); // side panels
    const chest = part(new THREE.BoxGeometry(0.34, 0.26, 0.07), DARK, 0, 1.12, 0.42, false); body.add(chest);
    this.chestLed = part(new THREE.BoxGeometry(0.22, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35e6ff, emissiveIntensity: 1.6 }), 0, 1.14, 0.46, false); body.add(this.chestLed);
    body.add(part(new THREE.BoxGeometry(0.34, 0.07, 0.07), accent, 0, 1.03, 0.43, false));
    body.add(part(new THREE.SphereGeometry(0.34, 12, 10), WHITE2, 0, 0.66, 0, false));
    // ---- legs: white with orange thigh panel, boots ----
    this.legs = [-1, 1].map((sd) => { const g = new THREE.Group(); g.position.set(sd * 0.21, 0.62, 0); body.add(g);
      g.add(part(new THREE.CapsuleGeometry(0.18, 0.3, 4, 10), WHITE, 0, -0.3, 0));
      g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 12), ORANGE, 0, -0.18, 0, false));
      const k = part(new THREE.SphereGeometry(0.16, 8, 6), ORANGE, 0, -0.5, 0.1, false); k.scale.set(1, 0.7, 0.6); g.add(k);
      g.add(part(new THREE.BoxGeometry(0.34, 0.2, 0.5), BOOT, 0, -0.64, 0.07)); g.add(part(new THREE.BoxGeometry(0.34, 0.1, 0.2), ORANGE, 0, -0.62, 0.26, false)); return g; });
    // ---- arms: orange shoulder pad, white sleeve, orange cuff, dark glove ----
    this.arms = [-1, 1].map((sd) => { const g = new THREE.Group(); g.position.set(sd * 0.58, 1.3, 0); body.add(g);
      g.add(part(new THREE.CapsuleGeometry(0.15, 0.34, 4, 10), WHITE, 0, -0.28, 0)); g.add(part(new THREE.SphereGeometry(0.24, 12, 8), ORANGE, 0, 0.02, 0));
      const c = part(new THREE.CylinderGeometry(0.165, 0.165, 0.12, 12), ORANGE, 0, -0.46, 0, false); g.add(c); g.add(part(new THREE.SphereGeometry(0.18, 10, 8), BOOT, 0, -0.64, 0.02));
      if (sd > 0) g.add(part(new THREE.BoxGeometry(0.2, 0.14, 0.16), DARK, 0, -0.34, 0.14, false)), g.add(part(new THREE.BoxGeometry(0.15, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35e6ff, emissiveIntensity: 1.4 }), 0, -0.34, 0.225, false)); // small wrist screen (AI)
      return g; });
    // ---- helmet: big round, glossy dark-gold visor, orange band, accent ear pads ----
    body.add(part(new THREE.SphereGeometry(0.57, 24, 18), WHITE, 0, 1.8, 0));
    const neck = part(new THREE.TorusGeometry(0.34, 0.08, 8, 20), GREY, 0, 1.42, 0, false); neck.rotation.x = Math.PI / 2; body.add(neck);
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x3a2406, roughness: 0.05, metalness: 0.95, emissive: 0x8a5a14, emissiveIntensity: 0.35 });
    const visor = part(new THREE.SphereGeometry(0.46, 24, 16), this.visorMat, 0, 1.8, 0.3, false); visor.scale.set(1.0, 0.8, 0.8); body.add(visor);
    const glint = part(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.75 }), -0.2, 1.94, 0.66, false); glint.scale.set(1.8, 0.7, 0.4); body.add(glint);
    const band = part(new THREE.TorusGeometry(0.575, 0.045, 8, 28, Math.PI), ORANGE, 0, 1.8, 0, false); body.add(band);
    [-1, 1].forEach((sd) => { const ear = part(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), accent, sd * 0.57, 1.8, 0, false); ear.rotation.z = Math.PI / 2; body.add(ear); });
    // ---- backpack: white with 5 glowing cyan bars on a dark plate ----
    body.add(part(new THREE.BoxGeometry(0.8, 1.0, 0.4), WHITE2, 0, 1.1, -0.52));
    body.add(part(new THREE.BoxGeometry(0.84, 0.14, 0.44), ORANGE, 0, 1.62, -0.52, false));
    [-1, 1].forEach((sd) => body.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 10), accent, sd * 0.46, 1.05, -0.52, false)));
    body.add(part(new THREE.BoxGeometry(0.56, 0.76, 0.03), DARK, 0, 1.08, -0.725, false));
    this.bars = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35e6ff, emissiveIntensity: 1.6 }); const bb = part(new THREE.BoxGeometry(0.44, 0.1, 0.05), m, 0, 0.78 + i * 0.15, -0.75, false); body.add(bb); this.bars.push(m); }
    // carried kit
    this.kit = new THREE.Group(); this.kit.add(part(new THREE.BoxGeometry(0.55, 0.34, 0.38), mat(0xff7a2b), 0, 0, 0, false), part(new THREE.BoxGeometry(0.18, 0.08, 0.4), WHITE, 0, 0.2, 0, false)); this.kit.position.set(0, 1.0, 0.62); this.kit.visible = false; body.add(this.kit);
    // blob + markers
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: q.shadows ? 0.5 : 1 })); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.05; this.root.add(this.blob);
    if (isPlayer) {
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 36), new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.07; this.root.add(this.ring);
      this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.6), toneMapped: false })); this.arrow.rotation.x = Math.PI; this.root.add(this.arrow);
      // wrist hologram (right arm, readable from behind)
      this.wc = makeCanvas(192, 128); this.wt = canvasTex(this.wc); this.wkey = '';
      this.wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ map: this.wt, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
      this.wrist.position.set(-0.12, -0.5, -0.2); this.wrist.rotation.set(-0.9, Math.PI + 0.45, 0.1); this.arms[0].add(this.wrist);
    }
    // progress bar
    this.bar = new THREE.Group(); this.bar.visible = false; this.root.add(this.bar);
    const bgM = new THREE.MeshBasicMaterial({ color: 0x0a1c2a, transparent: true, opacity: 0.8, depthTest: false, toneMapped: false }), fgM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 2.8), depthTest: false, toneMapped: false });
    this.barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), bgM); this.barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), fgM); this.barFg.position.z = 0.01; this.barBg.renderOrder = 20; this.barFg.renderOrder = 21; this.bar.add(this.barBg, this.barFg); this.bar.position.y = 2.7;
    // speech bubble
    this.bc = makeCanvas(512, 200); this.bt = canvasTex(this.bc);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bt, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); this.bubble.scale.set(4.9, 1.92, 1); this.bubble.renderOrder = 30; this.bubble.visible = false; this.bubble.center.set(0.16, 0); scene.add(this.bubble);
    this.bkey = ''; this.phase = Math.random() * 6; this.hd = 0; this.fade = 1;
  }
  setPlayer() {}
  update(c, dt, tm, cam, wrist) {
    const r = this.root; r.visible = !c.inShelter; const x = c.x, z = c.z;
    r.position.set(x, 0, z);
    // heading (smooth)
    let d = c.heading - this.hd; d = Math.atan2(Math.sin(d), Math.cos(d)); this.hd += d * Math.min(1, dt * 12); r.rotation.y = this.hd;
    const sp = c.speed || 0, swing = clamp(sp / 5, 0, 1.5); this.phase += dt * (3 + sp * 1.7);
    const working = !!c.task, carry = !!c.carry; this.kit.visible = carry;
    const s = Math.sin(this.phase);
    this.legs[0].rotation.x = s * 0.85 * swing; this.legs[1].rotation.x = -s * 0.85 * swing;
    let a0 = -s * 0.7 * swing, a1 = s * 0.7 * swing;
    if (carry) { a0 = a1 = -1.0 + s * 0.08 * swing; }
    if (working) { const p = Math.sin(tm * 13); a0 = -1.25 + p * 0.35; a1 = -0.8 + Math.sin(tm * 13 + 1) * 0.15; }
    this.arms[0].rotation.x += (a0 - this.arms[0].rotation.x) * Math.min(1, dt * 14); this.arms[1].rotation.x += (a1 - this.arms[1].rotation.x) * Math.min(1, dt * 14);
    const idle = Math.sin(tm * 2 + this.phase) * 0.018; this.body.scale.y = 1 + Math.sin(tm * 2 + this.phase) * 0.012 * (1 - clamp(sp / 2, 0, 1));
    this.body.position.y = Math.abs(s) * 0.07 * swing + idle;
    const lean = working ? 0.28 : sp > 6 ? 0.2 : 0; this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 8);
    this.body.rotation.z = Math.sin(this.phase * 0.5) * 0.04 * swing;
    // vitals bars
    const lit = Math.ceil(clamp(c.hp, 0, 100) / 20); const colr = c.hp > 50 ? 0x35e6ff : c.hp > 25 ? 0xffb23a : 0xff4030; const flick = c.hp < 25 ? (0.5 + 0.5 * Math.sin(tm * 10)) : 1;
    this.bars.forEach((m, i) => { const on = i < lit; m.emissive.setHex(on ? colr : 0x0a2030); m.emissiveIntensity = on ? 1.5 * flick : 0.15; });
    // markers
    if (this.isPlayer) { this.ring.scale.setScalar(1 + Math.sin(tm * 4) * 0.06); this.arrow.position.y = 2.75 + Math.sin(tm * 4) * 0.12; this.arrow.rotation.y = tm * 2;
      const key = wrist.sol + wrist.time + Math.round(wrist.dose / 4); if (key !== this.wkey) { this.wkey = key; drawWrist(this.wc.getContext('2d'), wrist.sol, wrist.time, wrist.dose); this.wt.needsUpdate = true; } }
    // work bar
    if (c.task && c.task.dur > 0.6) { this.bar.visible = true; const p = clamp(c.task.t / c.task.dur, 0, 1); this.barFg.scale.x = Math.max(0.001, p); this.barFg.position.x = -0.6 * (1 - p); this.bar.quaternion.copy(cam.quaternion); } else this.bar.visible = false;
    // bubble
    const sy = c.say; if (sy && sy.t > 0 && !c.inShelter) {
      const key = sy.text; if (key !== this.bkey) { this.bkey = key; drawBubble(this.bc.getContext('2d'), 'crew', this.id, this.look.name, sy.text); this.bt.needsUpdate = true; }
      this.bubble.visible = true; this.bubble.position.set(x, 3.3 + Math.sin(tm * 2) * 0.05, z); const dd = cam.position.distanceTo(this.bubble.position), bw = clamp(dd * 0.4, 2.4, 5.2); this.bubble.scale.set(bw, bw * 0.39, 1); this.bubble.material.opacity = clamp(Math.min(sy.t / 0.6, (7 - sy.t) / 0.25 + 0.2), 0, 1);
    } else this.bubble.visible = false;
  }
  dispose(scene) { scene.remove(this.root); scene.remove(this.bubble); }
}
