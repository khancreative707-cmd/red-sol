import * as THREE from 'three';
import { groundH, fbm, mulberry, lerp, clamp, smooth, makeCanvas, canvasTex, drawSign } from './util.js';
import { MOD, ST, SHIELD_C } from './layout.js';

const col = (h) => new THREE.Color(h);
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xf4efe9, roughness: 0.55, metalness: 0.05 }),
  white2: new THREE.MeshStandardMaterial({ color: 0xe6dfd6, roughness: 0.6, metalness: 0.05 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff7a2b, roughness: 0.5, metalness: 0.05 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3a312c, roughness: 0.7, metalness: 0.2 }),
  mid: new THREE.MeshStandardMaterial({ color: 0x7a706a, roughness: 0.6, metalness: 0.3 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x35e6ff, emissiveIntensity: 2.2, roughness: 0.4 }),
  amber: new THREE.MeshStandardMaterial({ color: 0x3a2308, emissive: 0xffb347, emissiveIntensity: 2.0, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0x300808, emissive: 0xff3a2a, emissiveIntensity: 2.4 }),
  tank: new THREE.MeshStandardMaterial({ color: 0xcfd8de, roughness: 0.35, metalness: 0.4 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3a8fe0, roughness: 0.4, metalness: 0.3 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (shadow) { m.castShadow = true; m.receiveShadow = true; } return m;
}

function makeDome(r, withDoor = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.05, 1.6, 22), M.white, 0, 0.8, 0));
  const top = mesh(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 0, 1.6, 0); top.scale.y = 0.82; g.add(top);
  const band = mesh(new THREE.TorusGeometry(r * 1.01, 0.12, 6, 32), M.orange, 0, 1.55, 0); band.rotation.x = Math.PI / 2; g.add(band);
  const band2 = mesh(new THREE.TorusGeometry(r * 1.045, 0.1, 6, 32), M.orange, 0, 0.35, 0); band2.rotation.x = Math.PI / 2; g.add(band2);
  const ring = mesh(new THREE.TorusGeometry(r * 0.55, 0.1, 6, 24), M.mid, 0, 1.6 + r * 0.82 - 0.2, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), M.dark, r * 0.3, 1.6 + r * 0.8 - 0.1, -r * 0.2)); // vent
  // greebles: antenna, roof plates, pipes, ladder, glow ring
  { const top = 1.6 + r * 0.82; const mast = mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 6), M.mid, -r * 0.35, top + 0.9, -r * 0.1); g.add(mast);
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M.red, -r * 0.35, top + 2.05, -r * 0.1, false));
    const dsh = mesh(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.white, -r * 0.35, top + 1.4, -r * 0.1, false); dsh.rotation.x = 0.9; g.add(dsh);
    for (let i = 0; i < 3; i++) { const pl = mesh(new THREE.BoxGeometry(1.1, 0.12, 0.8), M.mid, Math.cos(i * 2.1) * r * 0.45, top - 0.35 - Math.abs(Math.cos(i * 2.1)) * 0.15, Math.sin(i * 2.1) * r * 0.45, false); pl.rotation.y = i * 2.1; pl.rotation.z = Math.cos(i * 2.1) * 0.2; g.add(pl); }
    const p1 = mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8), M.mid, r + 0.15, 0.9, -r * 0.2); g.add(p1); const p2 = mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 8), M.mid, r - 0.35, 2.15, -r * 0.2); p2.rotation.z = Math.PI / 2; g.add(p2);
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), M.dark, -r * 0.85, 0.5 + i * 0.5, r * 0.45, false));
    const glow = mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 6, 40), M.cyan, 0, 1.05, 0, false); glow.rotation.x = Math.PI / 2; g.add(glow);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.1), i % 2 ? M.orange : M.dark, Math.cos(a) * r * 1.07, 0.1, Math.sin(a) * r * 1.07, false)).rotation.y = -a; } }
  if (withDoor) {
    const dz = r - 0.1;
    g.add(mesh(new THREE.BoxGeometry(1.9, 2.5, 0.5), M.orange, 0, 1.25, dz));
    g.add(mesh(new THREE.BoxGeometry(1.35, 2.15, 0.55), M.dark, 0, 1.15, dz + 0.04));
    g.add(mesh(new THREE.BoxGeometry(0.08, 1.5, 0.58), M.cyan, 0, 1.15, dz + 0.06, false));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), M.cyan, -1.35, 2.0, dz - 0.05, false));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), M.cyan, 1.35, 2.0, dz - 0.05, false));
    // steps
    g.add(mesh(new THREE.BoxGeometry(2.4, 0.2, 1.0), M.mid, 0, 0.1, dz + 0.6));
  }
  for (let i = 0; i < 3; i++) { // warm windows
    const a = -0.9 + i * 0.9 + Math.PI / 2 - 1.6; const w = mesh(new THREE.BoxGeometry(0.7, 0.4, 0.2), M.amber, Math.cos(a) * (r + 0.02) * 0.98, 1.1, Math.sin(a) * (r + 0.02) * 0.98, false);
    w.rotation.y = -a + Math.PI / 2; g.add(w);
  }
  return g;
}

function signSprite(text, color) {
  const c = makeCanvas(256, 80); drawSign(c.getContext('2d'), text, color);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  s.scale.set(2.3, 0.72, 1); return s;
}

export function buildEnvironment(renderer, scene, q) {
  const E = { update: null, signs: [], q };
  const rnd = mulberry(1234);
  scene.fog = new THREE.FogExp2(0xf0a068, 0.0075);

  // ---------- sky ----------
  const skyU = {
    top: { value: col(0xd96a4a) }, mid: { value: col(0xf0955a) }, hor: { value: col(0xffc888) },
    sunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, sunCol: { value: col(0xffd9a0) },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 top,mid,hor,sunDir,sunCol;
      void main(){ vec3 d = normalize(vD); float h = clamp(d.y,0.0,1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0,0.22,h)); c = mix(c, top, smoothstep(0.18,0.85,h));
        float s = max(dot(d, sunDir),0.0); c += sunCol*(pow(s,6.0)*0.28 + pow(s,60.0)*0.35);
        // soft cloud-like banding
        c *= 1.0 + 0.03*sin(d.x*14.0+d.y*30.0)*smoothstep(0.1,0.5,h);
        if(d.y<0.0) c = hor*0.9;
        gl_FragColor = vec4(c,1.0); }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); E.sky = sky;

  // sun + glow
  const sun = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2.0), fog: false, toneMapped: false }));
  scene.add(sun); E.sun = sun;
  const glowC = makeCanvas(128, 128); { const x = glowC.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,230,170,1)'); g.addColorStop(0.3, 'rgba(255,170,90,.45)'); g.addColorStop(1, 'rgba(255,120,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  sunGlow.scale.set(240, 240, 1); scene.add(sunGlow); E.sunGlow = sunGlow;
  // tiny moons (real Phobos/Deimos look like dots from Mars)
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xd8c8b8, fog: false });
  E.phobos = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), moonMat); E.deimos = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), moonMat);
  scene.add(E.phobos, E.deimos);
  // stars
  { const n = 380, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, e = Math.acos(rnd() * 0.95 + 0.04); p[i * 3] = Math.sin(e) * Math.cos(a) * 800; p[i * 3 + 1] = Math.cos(e) * 800; p[i * 3 + 2] = Math.sin(e) * Math.sin(a) * 800; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    E.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(E.stars); }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffc49a, 0x8a4326, 1.15); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xffdcae, 3.0); sunL.position.set(-20, 30, -20); scene.add(sunL, sunL.target);
  sunL.castShadow = q.shadows; sunL.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  const sc = sunL.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 140; sunL.shadow.bias = -0.0006; sunL.shadow.normalBias = 0.04; sunL.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xffb98a, 0.55); fill.position.set(10, 14, 30); scene.add(fill);
  E.hemi = hemi; E.sunL = sunL; E.fill = fill;

  // ---------- terrain ----------
  {
    const seg = q.terrainSeg, size = 560; const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position; const colors = new Float32Array(p.count * 3); const c = new THREE.Color();
    const lo = col(0xc9632f), hi = col(0x8a3a20), dust = col(0xe38d52), pale = col(0xefa665);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); const h = groundH(x, z); p.setY(i, h);
      const n = fbm(x * 0.08, z * 0.08), n2 = fbm(x * 0.3 + 9, z * 0.3);
      c.copy(lo).lerp(dust, Math.min(1, n * 1.5)).lerp(hi, smooth(2, 22, h) * 0.75).lerp(pale, n2 * 0.3);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true }));
    t.receiveShadow = true; scene.add(t); E.terrain = t;
    // worn dirt pads under buildings
    const padMat = new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 1 });
    Object.values(MOD).forEach((m) => { const pad = new THREE.Mesh(new THREE.CircleGeometry(m.r + 2.6, 28), padMat); pad.rotation.x = -Math.PI / 2; pad.position.set(m.x, 0.02, m.z + 1); pad.receiveShadow = true; scene.add(pad); });
    // path
    const path = new THREE.Mesh(new THREE.PlaneGeometry(64, 5), new THREE.MeshStandardMaterial({ color: 0xc46a38, roughness: 1 })); path.rotation.x = -Math.PI / 2; path.position.set(1, 0.025, 2); path.receiveShadow = true; scene.add(path);
  }
  // mesas / cliffs ring
  {
    const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const n = q.mesas;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.5; const rad = 62 + rnd() * 26; const x = Math.cos(a) * rad * 1.1, z = Math.sin(a) * rad * 0.75 - 6; if (Math.abs(x) < 38 && z > -14) continue; const hh = 9 + rnd() * 16, rt2 = 3.5 + rnd() * 4; const geo = new THREE.CylinderGeometry(rt2, rt2 + 4 + rnd() * 4, hh, 7, 3); const p = geo.attributes.position; const cc = new Float32Array(p.count * 3); const c = new THREE.Color(); for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setX(k, p.getX(k) * (0.8 + rnd() * 0.4)); p.setZ(k, p.getZ(k) * (0.8 + rnd() * 0.4)); c.set([0x8a3a20, 0xb4552d, 0xd0703a][Math.floor((y + hh / 2) / (hh / 3)) % 3] || 0xb4552d); cc[k * 3] = c.r; cc[k * 3 + 1] = c.g; cc[k * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geo.computeVertexNormals(); const mm = new THREE.Mesh(geo, rock); mm.position.set(x, groundH(x, z) + hh / 2 - 1.5, z); mm.rotation.y = rnd() * 6; mm.castShadow = q.shadows; mm.receiveShadow = true; scene.add(mm); }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3; const rad = 125 + rnd() * 55; const x = Math.cos(a) * rad * 1.25, z = Math.sin(a) * rad * 0.9;
      const hgt = 22 + rnd() * 34, rt = 9 + rnd() * 10, rb = rt + 8 + rnd() * 10;
      const geo = new THREE.CylinderGeometry(rt, rb, hgt, 8, 4); const p = geo.attributes.position; const cc = new Float32Array(p.count * 3); const c = new THREE.Color();
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k); const band = Math.floor((y + hgt / 2) / (hgt / 4));
        if (y < hgt / 2 - 0.1 && y > -hgt / 2 + 0.1) { p.setX(k, p.getX(k) * (0.85 + rnd() * 0.3)); p.setZ(k, p.getZ(k) * (0.85 + rnd() * 0.3)); }
        c.set([0x7a2f1c, 0xa9482a, 0xc2602f, 0xd9753a, 0xe28a4c][band % 5]).offsetHSL(0, 0, (rnd() - 0.5) * 0.04); cc[k * 3] = c.r; cc[k * 3 + 1] = c.g; cc[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rock); m.position.set(x, groundH(x, z) + hgt / 2 - 6, z); m.rotation.y = rnd() * 6; m.castShadow = false; scene.add(m);
    }
  }
  // pebbles near the base for ground detail
  { const n = Math.round(q.rocks * 3); const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), n); const d = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * 90, z = -14 + rnd() * 40; const s = 0.07 + rnd() * 0.22; d.position.set(x, s * 0.2, z); d.scale.set(s * 1.3, s * 0.7, s); d.rotation.set(rnd() * 3, rnd() * 6, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); c.set(0xa84a28).lerp(col(0xd98a55), rnd()); im.setColorAt(i, c); }
    im.receiveShadow = true; scene.add(im); }
  // rocks (instanced)
  {
    const n = q.rocks; const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), n);
    const d = new THREE.Object3D(); const c = new THREE.Color(); let placed = 0, tries = 0;
    while (placed < n && tries++ < n * 20) {
      const x = (rnd() - 0.5) * 150, z = (rnd() - 0.45) * 100;
      if (Math.abs(x) < 34 && z > -16 && z < 17) { if (rnd() < 0.93) continue; }
      const s = 0.3 + Math.pow(rnd(), 2.2) * 2.4; d.position.set(x, groundH(x, z) + s * 0.25, z); d.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.4), s * (0.8 + rnd() * 0.6)); d.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); d.updateMatrix(); im.setMatrixAt(placed, d.matrix);
      c.set(0xb04e2a).lerp(col(0x7c3720), rnd()).offsetHSL(0, 0, (rnd() - 0.5) * 0.06); im.setColorAt(placed, c); placed++;
    }
    im.count = placed; im.castShadow = q.shadows; im.receiveShadow = true; scene.add(im);
  }

  // ---------- buildings ----------
  const bGroup = new THREE.Group(); scene.add(bGroup); E.mods = {};
  // power hab
  { const g = makeDome(MOD.power.r); g.position.set(MOD.power.x, 0, MOD.power.z); bGroup.add(g); E.mods.power = g;
    for (let i = 0; i < 3; i++) { const b = mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 12), M.tank, MOD.power.x - 4.9, 0.7, MOD.power.z - 1.4 + i * 1.5); b.rotation.z = Math.PI / 2; g.parent.add(b); b.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.3, 12), M.orange, 0, 0, 0, false)); }
  }
  { const g = makeDome(MOD.med.r); g.position.set(MOD.med.x, 0, MOD.med.z); bGroup.add(g); E.mods.med = g;
    const cross = new THREE.Group(); cross.add(mesh(new THREE.BoxGeometry(1.3, 0.4, 0.15), M.red, 0, 0, 0, false), mesh(new THREE.BoxGeometry(0.4, 1.3, 0.15), M.red, 0, 0, 0, false)); cross.position.set(MOD.med.x + 2.5, 2.4, MOD.med.z + 2.6); cross.rotation.y = 0.8; bGroup.add(cross); }
  { const g = makeDome(MOD.water.r); g.position.set(MOD.water.x, 0, MOD.water.z); bGroup.add(g); E.mods.water = g;
    [[-4.6, -1], [-4.6, 1.2]].forEach(([dx, dz]) => { const t = mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.8, 14), M.tank, MOD.water.x + dx + 9.6, 1.4, MOD.water.z + dz); bGroup.add(t); t.add(mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.4, 14), M.blue, 0, 0.3, 0, false)); });
    bGroup.add(mesh(new THREE.SphereGeometry(1.0, 12, 8), M.tank, MOD.water.x + 5.6, 1.0, MOD.water.z + 3)); }
  // greenhouse
  {
    const g = new THREE.Group(); g.position.set(MOD.green.x, 0, MOD.green.z); bGroup.add(g); E.mods.green = g;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(MOD.green.r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfffe8, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, emissive: 0x2a6a40, emissiveIntensity: 0.3 }));
    glass.scale.y = 0.85; g.add(glass);
    const ribs = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(MOD.green.r * 1.005, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 })); ribs.scale.y = 0.85; g.add(ribs);
    const base = mesh(new THREE.CylinderGeometry(MOD.green.r + 0.2, MOD.green.r + 0.5, 0.7, 28), M.white, 0, 0.35, 0); g.add(base);
    const rim = mesh(new THREE.TorusGeometry(MOD.green.r + 0.25, 0.14, 6, 40), M.orange, 0, 0.72, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
    g.add(mesh(new THREE.BoxGeometry(2.0, 2.4, 0.6), M.orange, 0, 1.2, MOD.green.r - 0.2)); g.add(mesh(new THREE.BoxGeometry(1.4, 2.0, 0.65), M.dark, 0, 1.1, MOD.green.r - 0.15));
    g.add(mesh(new THREE.BoxGeometry(0.08, 1.4, 0.7), M.cyan, 0, 1.1, MOD.green.r - 0.12, false));
    g.add(mesh(new THREE.BoxGeometry(2.6, 0.2, 1.2), M.mid, 0, 0.1, MOD.green.r + 0.5));
    g.add(mesh(new THREE.CircleGeometry(MOD.green.r - 0.3, 26), new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 1 }), 0, 0.72, 0, false).rotateX(-Math.PI / 2));
    const gl = new THREE.PointLight(0x8aff9a, q.shadows ? 14 : 8, 14, 1.6); gl.position.set(0, 3.2, 0); g.add(gl); E.greenLight = gl;
    // plots
    E.plots = [];
    const pm = new THREE.MeshStandardMaterial({ color: 0x2f9a4a, emissive: 0x2dff6a, emissiveIntensity: 0.55, roughness: 0.6, flatShading: true });
    const tm = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xff3a2a, emissiveIntensity: 1.4 });
    [[-2, -1.4], [2, -1.4], [-2, 1.8], [2, 1.8]].forEach(([x, z]) => {
      const pg = new THREE.Group(); pg.position.set(x, 0.72, z); g.add(pg);
      pg.add(mesh(new THREE.BoxGeometry(2.1, 0.35, 2.1), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1 }), 0, 0.17, 0));
      const plant = new THREE.Group(); pg.add(plant); plant.position.y = 0.35;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; const leaf = mesh(new THREE.ConeGeometry(0.28, 1.4, 5), pm, Math.cos(a) * 0.55, 0.7, Math.sin(a) * 0.55, false); leaf.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); plant.add(leaf); }
      const fruit = new THREE.Group(); plant.add(fruit); for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28 + 0.6; fruit.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), tm, Math.cos(a) * 0.6, 0.55 + (k % 2) * 0.35, Math.sin(a) * 0.6, false)); }
      E.plots.push({ plant, fruit, cur: 0 });
    });
  }
  // shelter
  { const g = new THREE.Group(); g.position.set(MOD.shelter.x, 0, MOD.shelter.z); bGroup.add(g); E.mods.shelter = g;
    const mound = mesh(new THREE.SphereGeometry(MOD.shelter.r + 1.8, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a4a2a, roughness: 1, flatShading: true }), 0, -0.4, 0); mound.scale.y = 0.62; g.add(mound);
    const dm = mesh(new THREE.SphereGeometry(MOD.shelter.r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.white2, 0, 0.6, 0); dm.scale.y = 0.7; g.add(dm);
    g.add(mesh(new THREE.BoxGeometry(2.0, 2.2, 1.0), M.orange, 0, 1.0, MOD.shelter.r - 0.2));
    g.add(mesh(new THREE.BoxGeometry(1.4, 1.8, 1.05), M.dark, 0, 0.95, MOD.shelter.r - 0.15));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 1.08), i % 2 ? M.dark : M.amber, -0.6 + i * 0.4, 2.15, MOD.shelter.r - 0.12, false));
  }

  // ---------- stations ----------
  // shield console + lever
  { const [sx, sz] = ST.shield; const g = new THREE.Group(); g.position.set(sx, 0, sz - 1.0); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(2.2, 0.8, 1.1), M.dark, 0, 0.4, 0)); g.add(mesh(new THREE.BoxGeometry(2.0, 0.12, 0.9), M.mid, 0, 0.86, 0.05));
    const lever = new THREE.Group(); lever.position.set(0, 0.95, 0.05); g.add(lever);
    lever.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8), M.mid, 0, 0.75, 0)); lever.add(mesh(new THREE.SphereGeometry(0.24, 12, 8), M.amber, 0, 1.55, 0, false));
    const base = mesh(new THREE.TorusGeometry(0.4, 0.09, 8, 16), M.amber, 0, 0.9, 0.05, false); base.rotation.x = Math.PI / 2; g.add(base);
    E.lever = lever; E.pips = [0, 1, 2].map((i) => { const p = mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x103040, emissiveIntensity: 1 }), -0.8 + i * 0.35 - 0.05, 0.93, 0.38, false); g.add(p); return p; }); }
  { const [lx, lz] = ST.lowpower; const g = new THREE.Group(); g.position.set(lx, 0, lz - 1.0); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), M.dark, 0, 0.4, 0));
    E.lpBtn = mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x35ff6a, emissiveIntensity: 1.8 }), 0, 0.9, 0.05, false); g.add(E.lpBtn); }
  // comms tower
  { const g = new THREE.Group(); g.position.set(-8, 0, -13.7); scene.add(g); E.tower = g;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const leg = mesh(new THREE.CylinderGeometry(0.06, 0.12, 12, 5), M.white2, Math.cos(a) * 0.8, 6, Math.sin(a) * 0.8); leg.rotation.set(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05); g.add(leg); }
    for (let i = 0; i < 6; i++) { const r = mesh(new THREE.TorusGeometry(0.85 - i * 0.07, 0.04, 4, 4), M.white2, 0, 1.5 + i * 1.8, 0, false); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 4; g.add(r); }
    const dish = mesh(new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), M.white, 0, 10.4, 0.2); dish.rotation.x = -1.0; E.dish = dish; g.add(dish);
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 4), M.mid, 0, 10.9, 0.9, false).rotateX(1.0));
    E.beacon = mesh(new THREE.SphereGeometry(0.22, 8, 6), M.red, 0, 12.2, 0, false); g.add(E.beacon);
    const pad = new THREE.Group(); pad.position.set(ST.comms[0], 0, ST.comms[1] - 0.9); scene.add(pad); pad.add(mesh(new THREE.BoxGeometry(1.8, 0.9, 1.0), M.dark, 0, 0.45, 0)); pad.add(mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), M.cyan, 0, 0.92, 0.45, false)); }
  // recycler cabinet
  { const [rx, rz] = ST.recycler; const g = new THREE.Group(); g.position.set(rx, 0, rz - 0.9); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.5, 1.0), M.white, 0, 0.75, 0)); g.add(mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), M.dark, 0, 1.0, 0.52, false));
    E.recLight = mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x35ff6a, emissiveIntensity: 2 }), 0.6, 1.3, 0.55, false); g.add(E.recLight);
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 8), M.mid, -1.2, 1.0, 0, false)); E.recPos = new THREE.Vector3(rx, 1.6, rz - 0.9); }
  // storage crates
  { const [cx, cz] = ST.storage; const g = new THREE.Group(); g.position.set(cx, 0, cz); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(2.4, 1.1, 1.4), M.white2, 0, 0.55, 0)); g.add(mesh(new THREE.BoxGeometry(2.45, 0.2, 1.45), M.orange, 0, 0.7, 0, false));
    g.add(mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), M.white, -0.2, 1.55, 0));
    E.kits = []; for (let i = 0; i < 6; i++) { const k = mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), M.orange, -0.75 + i * 0.3, 2.15, 0, false); g.add(k); E.kits.push(k); } }
  // solar arrays
  E.panels = [];
  { const panelTex = (() => { const c = makeCanvas(128, 128), x = c.getContext('2d'); x.fillStyle = '#17306a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#6fa0ff'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); } const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return canvasTex(c); })();
    const pm = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.3, metalness: 0.5, emissive: 0x0a1e50, emissiveIntensity: 0.6 });
    const dm = new THREE.MeshBasicMaterial({ color: 0xd9a066, transparent: true, opacity: 0, depthWrite: false, fog: true });
    ['panel0', 'panel1', 'panel2'].forEach((id) => {
      const [px, pz] = ST[id]; const g = new THREE.Group(); g.position.set(px + 0.8, 0, pz); scene.add(g);
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6), M.mid, 0, 0.6, 0));
      const hinge = new THREE.Group(); hinge.position.set(-1.1, 1.15, 0); g.add(hinge);
      const geo = new THREE.BoxGeometry(2.4, 0.08, 3.3); geo.translate(1.1, 0, 0);
      const board = mesh(geo, pm, 0, 0, 0); hinge.add(board);
      const dustM = dm.clone(); const dust = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.3), dustM); dust.rotation.x = -Math.PI / 2; dust.position.set(1.1, 0.05, 0); hinge.add(dust);
      board.add(mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), M.white2, 1.1, 0, 1.65, false), mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), M.white2, 1.1, 0, -1.65, false));
      E.panels.push({ hinge, dust, cur: 0.55, dustCur: 0 });
    }); }
  // rover (decor)
  { const g = new THREE.Group(); g.position.set(33, 0, 7); g.rotation.y = -0.7; scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(4.2, 1.2, 2.4), M.white, 0, 1.4, 0)); g.add(mesh(new THREE.BoxGeometry(2.2, 0.9, 2.2), M.white2, -0.6, 2.4, 0)); g.add(mesh(new THREE.BoxGeometry(4.3, 0.25, 2.5), M.orange, 0, 1.0, 0, false));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 1.5), M.cyan, 2.12, 1.7, 0, false));
    [[-1.5, -1.4], [1.5, -1.4], [-1.5, 1.4], [1.5, 1.4]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.7, 14), M.dark, x, 0.85, z); w.rotation.x = Math.PI / 2; g.add(w); });
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), M.mid, 0.4, 3.4, 0)); }
  // lamps
  E.lamps = [];
  [[-19, 0], [-8, 1], [3, 0], [12, 1], [21, 2]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6), M.mid, 0, 1.2, 0));
    const b = mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a2308, emissive: 0xffc070, emissiveIntensity: 0.8 }), 0, 2.5, 0, false); g.add(b); E.lamps.push(b);
  });
  // signs
  const addSign = (id, text, pos, color) => { const s = signSprite(text, color); s.position.set(pos[0], pos[1], pos[2]); scene.add(s); E.signs.push({ s, id }); };
  addSign('shield', 'SHIELD', [ST.shield[0], 5.2, ST.shield[1] - 1]); addSign('lowpower', 'POWER SAVER', [ST.lowpower[0] + 0.3, 2.6, ST.lowpower[1] - 1], '#7dff9a');
  addSign('comms', 'COMMS', [ST.comms[0], 2.8, ST.comms[1] - 0.9]); addSign('medbay', 'MEDBAY', [ST.medbay[0], 4.3, ST.medbay[1] - 0.5], '#ff8a8a');
  addSign('recycler', 'WATER RECYCLER', [ST.recycler[0], 3.0, ST.recycler[1] - 1]); addSign('greenhouse', 'GREENHOUSE', [ST.greenhouse[0], 4.4, ST.greenhouse[1] - 0.4], '#7dff9a');
  addSign('shelter', 'STORM SHELTER', [ST.shelter[0], 4.2, ST.shelter[1] - 0.4], '#ffd24a'); addSign('storage', 'REPAIR KITS', [ST.storage[0], 3.2, ST.storage[1]], '#ffb347');

  // ---------- shield dome ----------
  const shU = { uLevel: { value: 0 }, uTime: { value: 0 }, uRip: { value: [new THREE.Vector4(0, 0, 0, 9), new THREE.Vector4(0, 0, 0, 9), new THREE.Vector4(0, 0, 0, 9), new THREE.Vector4(0, 0, 0, 9)] }, uCol: { value: col(0x4fe3ff) } };
  const shield = new THREE.Mesh(new THREE.SphereGeometry(SHIELD_C.r, q.shieldSeg, Math.round(q.shieldSeg / 2), 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: shU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec3 vN; varying vec3 vW; uniform float uLevel,uTime; uniform vec4 uRip[4]; uniform vec3 uCol;
      void main(){ if(uLevel<0.01) discard; vec3 V = normalize(cameraPosition - vW); float f = pow(1.0-abs(dot(normalize(vN),V)),2.2);
        vec2 uv = vec2(atan(vW.x-1.0,vW.z+1.0)*9.0, vW.y*0.55); vec2 g = abs(fract(uv+vec2(0.0,uv.x*0.5))-0.5);
        float hex = smoothstep(0.46,0.5,max(g.x,g.y)); float scan = 0.5+0.5*sin(vW.y*0.8 - uTime*1.5);
        float rip=0.0; for(int i=0;i<4;i++){ float d = distance(vW, uRip[i].xyz); float age = uRip[i].w; rip += smoothstep(3.0,0.0,abs(d-age*34.0))*(1.0-clamp(age,0.0,1.0)); }
        float a = (0.04 + f*0.8 + hex*0.32*(0.5+scan*0.5) + rip*1.2) * (0.4 + uLevel*0.4);
        gl_FragColor = vec4(mix(uCol, vec3(1.0), rip*0.5+f*0.3)*a*1.6, a); }`,
  }));
  shield.position.set(SHIELD_C.x, 0, SHIELD_C.z); shield.renderOrder = 5; scene.add(shield); E.shield = shield; E.shU = shU; E.rip = 0;

  // ---------- per-frame ----------
  const palettes = {
    day: { top: col(0xd96a4a), mid: col(0xf0955a), hor: col(0xffc888), fog: col(0xf0a068) },
    dusk: { top: col(0x7a3a5a), mid: col(0xd9634a), hor: col(0xffa060), fog: col(0xe08a58) },
    night: { top: col(0x0a0818), mid: col(0x1a1030), hor: col(0x3a2848), fog: col(0x2a1c34) },
    storm: { top: col(0x6a3820), mid: col(0x8a502e), hor: col(0x9a6238), fog: col(0x8a5632) },
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  let lastKey = '';
  E.update = (state, info, dt, tm, ctx) => {
    const p0 = info.progress; // visual daylight: warm dawn start, bright noon, dusk, short dark night
    const light = p0 < 0.88 ? 0.5 + 0.5 * Math.pow(Math.sin(Math.PI * p0 / 0.88), 0.7) : p0 < 0.96 ? 0.5 * (1 - smooth(0.88, 0.96, p0)) + 0.04 : 0.04 + 0.46 * smooth(0.96, 1, p0);
    const storm = state.weather.storm, flare = state.weather.flare || 0;
    // palette: dawn/dusk warm edges, day, night
    const p = info.progress; const edge = (1 - smooth(0.5, 0.85, light)) * smooth(0.05, 0.5, light);
    const mk = (k) => { tmp.copy(palettes.night[k]).lerp(palettes.day[k], smooth(0.05, 0.5, light)); tmp.lerp(palettes.dusk[k], edge * 0.75); tmp.lerp(palettes.storm[k], storm * 0.85); return tmp; };
    skyU.top.value.copy(mk('top')); skyU.mid.value.copy(mk('mid')); skyU.hor.value.copy(mk('hor'));
    scene.fog.color.copy(mk('fog')); scene.fog.density = lerp(0.0075, 0.046, storm) + (1 - light) * 0.002;
    // sun position
    const az = lerp(-1.1, 1.1, clamp(p / 0.9, 0, 1)); const el = p < 0.9 ? 0.1 + 0.95 * Math.sin(Math.PI * p / 0.9) : -0.2 + 0.0;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el) * 0.9 - 0.1).normalize();
    skyU.sunDir.value.copy(dir); sun.position.copy(dir).multiplyScalar(700).add(ctx.camPos); sunGlow.position.copy(sun.position);
    const sunVis = clamp(smooth(-0.02, 0.1, dir.y) * (1 - storm * 0.75), 0, 1);
    sun.visible = dir.y > -0.05; sunGlow.visible = sun.visible; sunGlow.material.opacity = sunVis * (0.8 + (ctx.sunFlash || 0));
    sunGlow.scale.setScalar(240 + (ctx.sunFlash || 0) * 220); sun.scale.setScalar(1 + (ctx.sunFlash || 0) * 0.8);
    sky.position.copy(ctx.camPos);
    E.phobos.position.set(ctx.camPos.x + 300 * Math.cos(tm * 0.01 + 1), 330 + 40 * Math.sin(tm * 0.013), ctx.camPos.z - 420 + 90 * Math.sin(tm * 0.01)); E.phobos.visible = E.deimos.visible = storm < 0.5;
    E.deimos.position.set(ctx.camPos.x - 260 + 40 * Math.cos(tm * 0.007), 280, ctx.camPos.z - 500);
    E.stars.material.opacity = clamp(1 - light * 3, 0, 1) * (1 - storm); E.stars.position.copy(ctx.camPos);
    // lights
    sunL.position.copy(ctx.focus).addScaledVector(dir, 70); sunL.target.position.copy(ctx.focus); sunL.target.updateMatrixWorld();
    sunL.intensity = (0.15 + 3.0 * smooth(0, 0.5, light)) * (1 - storm * 0.72); sunL.color.setHSL(0.09, 0.8, lerp(0.7, 0.82, light));
    hemi.intensity = lerp(0.5, 1.15, smooth(0, 0.5, light)) * (1 - storm * 0.25); hemi.color.copy(skyU.mid.value).lerp(new THREE.Color(1, 0.8, 0.65), 0.35);
    fill.intensity = lerp(0.12, 0.55, smooth(0, 0.5, light)); fill.color.setHSL(0.07, 0.8, 0.7);
    // lamps / glow at night & storm
    const dark = clamp(1 - light * 1.5 + storm * 0.8, 0, 1);
    E.lamps.forEach((b) => { b.material.emissiveIntensity = 0.15 + dark * 3.2; });
    E.greenLight.intensity = (state.lowPower ? 2 : 10) * (0.6 + dark * 0.8);
    // shield
    const lv = state.shield; shU.uLevel.value += (lv - shU.uLevel.value) * Math.min(1, dt * 4); shU.uTime.value = tm;
    shU.uCol.value.setHex(lv >= 3 ? 0xa8e8ff : lv === 2 ? 0x4fe3ff : 0x5fb0ff); shield.visible = shU.uLevel.value > 0.02;
    for (const r of shU.uRip.value) if (r.w < 9) r.w += dt * 1.6;
    // lever and pips
    const targetA = [-0.75, -0.25, 0.25, 0.75][lv]; E.lever.rotation.z += (targetA - E.lever.rotation.z) * Math.min(1, dt * 10);
    E.pips.forEach((pp, i) => { const on = lv > i; pp.material.emissive.setHex(on ? (lv === 3 ? 0xa8e8ff : 0x4fe3ff) : 0x103040); pp.material.emissiveIntensity = on ? 3 : 0.4; });
    E.lpBtn.material.emissive.setHex(state.lowPower ? 0xffb347 : 0x35ff6a); E.lpBtn.position.y = state.lowPower ? 0.86 : 0.9;
    // panels
    state.panels.forEach((pn, i) => {
      const o = E.panels[i]; const target = pn.folded ? 1.5 : 0.55; o.cur += (target - o.cur) * Math.min(1, dt * 4); o.hinge.rotation.z = o.cur;
      o.dustCur += (pn.dust - o.dustCur) * Math.min(1, dt * 3); o.dust.material.opacity = o.dustCur * 0.78;
    });
    // plots
    state.plots.forEach((pl, i) => { const o = E.plots[i]; o.cur += (pl.g - o.cur) * Math.min(1, dt * 3); const s = 0.2 + 0.8 * Math.min(1, o.cur); o.plant.scale.setScalar(s); o.fruit.visible = o.cur >= 0.98; if (o.fruit.visible) o.fruit.rotation.y = tm * 0.5; });
    // kits
    E.kits.forEach((k, i) => { k.visible = i < state.kits; });
    // recycler + beacon
    const clog = state.recycler.clogged; E.recLight.material.emissive.setHex(clog ? 0xff3a2a : 0x35ff6a); E.recLight.material.emissiveIntensity = clog ? 1 + 2.5 * (0.5 + 0.5 * Math.sin(tm * 9)) : 2;
    E.beacon.material.emissiveIntensity = 0.5 + 3 * Math.max(0, Math.sin(tm * 3)); E.dish.rotation.z = Math.sin(tm * 0.2) * 0.3;
    // signs fade with distance
    E.signs.forEach(({ s }) => { const d = Math.hypot(s.position.x - ctx.focus.x, s.position.z - ctx.focus.z); s.material.opacity = clamp(1.4 - d / 18, 0, 1) * smooth(2.5, 5.5, d) * (1 - storm * 0.3); s.visible = s.material.opacity > 0.02; });
  };
  E.addRipple = (x, y, z) => { const r = shU.uRip.value[E.rip++ % 4]; r.set(x, y, z, 0); };
  return E;
}
