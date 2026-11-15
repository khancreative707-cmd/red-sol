import * as THREE from 'three';

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Ground is flat around the base so buildings and crew sit on y=0.
export function groundH(x, z) {
  const d = Math.hypot(x / 46, (z + 1) / 30);
  const k = smooth(1.0, 2.1, d);
  if (k <= 0) return 0;
  return k * (fbm(x * 0.035 + 7, z * 0.035 - 3) * 16 + Math.abs(Math.sin(x * 0.05 + fbm(z * 0.03, x * 0.03) * 4)) * 4);
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t; }

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function wrapText(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

const FONT = '"Nunito","Baloo 2","Trebuchet MS","Segoe UI",system-ui,sans-serif';
export { FONT };

// ---- crew look (shared by 3D and portraits) ----
export const CREW_LOOK = {
  mei:   { name: 'Mei',   role: 'Power Engineer', visor: 0x35e6ff, visorCss: '#35e6ff', accent: 0xff8a3d, skin: '#f1c7a1', hair: '#241410', bun: true },
  diego: { name: 'Diego', role: 'Botanist',       visor: 0xffd24a, visorCss: '#ffd24a', accent: 0x6ee06a, skin: '#a8714a', hair: '#1c120c', bun: false },
  asha:  { name: 'Asha',  role: 'Medic and Radiation Scientist', visor: 0xff6fd0, visorCss: '#ff6fd0', accent: 0xff5a5a, skin: '#c98e63', hair: '#150c0a', bun: true },
};

export function drawPortrait(ctx, size, id) {
  const L = CREW_LOOK[id] || CREW_LOOK.mei; const s = size, cx = s / 2, cy = s / 2;
  ctx.clearRect(0, 0, s, s);
  const bg = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.7); bg.addColorStop(0, '#9a5033'); bg.addColorStop(1, '#3a170d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
  // suit shoulders
  ctx.fillStyle = '#f4f1ee'; ctx.beginPath(); ctx.ellipse(cx, s * 1.02, s * 0.46, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.fillRect(cx - s * 0.46, s * 0.86, s * 0.92, s * 0.05);
  // helmet
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy - s * 0.02, s * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d7d2cd'; ctx.lineWidth = s * 0.02; ctx.stroke();
  // face glass
  ctx.fillStyle = 'rgba(30,25,40,.88)'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.27, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  // face
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.01, s * 0.2, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.12, s * 0.21, s * 0.11, 0, Math.PI, 0); ctx.fill();
  if (L.bun) { ctx.beginPath(); ctx.arc(cx + s * 0.1, cy - s * 0.2, s * 0.07, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#1b1210'; ctx.beginPath(); ctx.arc(cx - s * 0.07, cy, s * 0.028, 0, 7); ctx.arc(cx + s * 0.07, cy, s * 0.028, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - s * 0.062, cy - s * 0.01, s * 0.01, 0, 7); ctx.arc(cx + s * 0.078, cy - s * 0.01, s * 0.01, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a3322'; ctx.lineWidth = s * 0.018; ctx.beginPath(); ctx.arc(cx, cy + s * 0.07, s * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // visor tint rim + glint
  ctx.strokeStyle = L.visorCss; ctx.globalAlpha = 0.9; ctx.lineWidth = s * 0.025; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.27, s * 0.24, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - s * 0.12, cy - s * 0.12, s * 0.07, s * 0.03, -0.6, 0, 7); ctx.fill();
}

export function drawEarthIcon(ctx, s) {
  ctx.clearRect(0, 0, s, s); const c = s / 2;
  const g = ctx.createRadialGradient(c * 0.8, c * 0.8, 2, c, c, c); g.addColorStop(0, '#6fd3ff'); g.addColorStop(1, '#1a5fb0');
  ctx.fillStyle = '#0b1a33'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c * 0.7, 0, 7); ctx.fill();
  ctx.fillStyle = '#5fd36a'; ctx.beginPath(); ctx.ellipse(c * 0.8, c * 0.9, c * 0.25, c * 0.2, 0.5, 0, 7); ctx.ellipse(c * 1.25, c * 1.15, c * 0.2, c * 0.28, -0.3, 0, 7); ctx.fill();
}

// ---- icons for holo panels ----
export function drawIcon(ctx, kind, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.08; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'power') { ctx.beginPath(); ctx.moveTo(s * 0.58, 0); ctx.lineTo(s * 0.12, s * 0.58); ctx.lineTo(s * 0.46, s * 0.58); ctx.lineTo(s * 0.36, s); ctx.lineTo(s * 0.88, s * 0.38); ctx.lineTo(s * 0.54, s * 0.38); ctx.closePath(); ctx.fill(); }
  else if (kind === 'water') { ctx.beginPath(); ctx.moveTo(s * 0.5, 0); ctx.bezierCurveTo(s * 0.95, s * 0.5, s * 0.9, s * 0.98, s * 0.5, s * 0.98); ctx.bezierCurveTo(s * 0.1, s * 0.98, s * 0.05, s * 0.5, s * 0.5, 0); ctx.fill(); }
  else if (kind === 'food') { ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.7); ctx.bezierCurveTo(s * 0.1, s * 0.2, s * 0.5, s * 0.05, s * 0.92, s * 0.08); ctx.bezierCurveTo(s * 0.95, s * 0.55, s * 0.6, s * 0.9, s * 0.1, s * 0.7); ctx.fill(); ctx.strokeStyle = 'rgba(0,40,20,.6)'; ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.95); ctx.lineTo(s * 0.55, s * 0.45); ctx.stroke(); }
  else if (kind === 'hull') { ctx.beginPath(); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.92, s * 0.18); ctx.lineTo(s * 0.88, s * 0.6); ctx.quadraticCurveTo(s * 0.8, s * 0.88, s * 0.5, s); ctx.quadraticCurveTo(s * 0.2, s * 0.88, s * 0.12, s * 0.6); ctx.lineTo(s * 0.08, s * 0.18); ctx.closePath(); ctx.fill(); }
  else if (kind === 'warn') { ctx.beginPath(); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s, s * 0.92); ctx.lineTo(0, s * 0.92); ctx.closePath(); ctx.stroke(); ctx.font = `900 ${s * 0.6}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('!', s * 0.5, s * 0.8); }
  else if (kind === 'earth') { ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.45, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s / 2, s / 2, s * 0.18, s * 0.45, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.05, s / 2); ctx.lineTo(s * 0.95, s / 2); ctx.stroke(); }
  ctx.restore();
}

export function statColor(v) { return v < 15 ? '#ff4a3a' : v < 35 ? '#ffb23a' : '#4fe3ff'; }

// Draw a holographic stat panel (320x160)
export function drawStatPanel(ctx, kind, label, value, warn) {
  const w = 320, h = 160; ctx.clearRect(0, 0, w, h);
  const col = statColor(value);
  ctx.save();
  rr(ctx, 8, 8, w - 16, h - 16, 24);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(20,70,110,.78)'); g.addColorStop(1, 'rgba(8,34,60,.78)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke(); ctx.shadowBlur = 0;
  // scanlines
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff'; for (let y = 16; y < h - 16; y += 6) ctx.fillRect(16, y, w - 32, 2); ctx.globalAlpha = 1;
  ctx.shadowColor = col; ctx.shadowBlur = 14; drawIcon(ctx, kind, 30, 38, 82, col); ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8f6ff'; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(label, 132, 62);
  ctx.fillStyle = warn ? '#ff7a6a' : '#ffffff'; ctx.font = `900 78px ${FONT}`; ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.fillText(Math.round(value) + '%', 128, 132); ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawLeakPanel(ctx, text) {
  const w = 320, h = 160; ctx.clearRect(0, 0, w, h);
  rr(ctx, 8, 8, w - 16, h - 16, 24);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(190,30,20,.85)'); g.addColorStop(1, 'rgba(120,10,10,.85)');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = '#ff6a4a'; ctx.shadowBlur = 20; ctx.strokeStyle = '#ff9a7a'; ctx.lineWidth = 5; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.shadowColor = '#ffd0a0'; ctx.shadowBlur = 12; drawIcon(ctx, 'warn', 26, 36, 80, '#ffe4c0'); ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; let fs2 = 40; ctx.font = `900 ${fs2}px ${FONT}`; ctx.textAlign = 'left'; while (ctx.measureText(text).width > 176 && fs2 > 20) { fs2 -= 2; ctx.font = `900 ${fs2}px ${FONT}`; } ctx.fillText(text, 122, 96);
}

export function drawSkyWarn(ctx, title, sub, kind) {
  const w = 1024, h = 256; ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,90,70,.7)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 490 - i * 14, 100 - i * 6, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.5 - i * 0.14; ctx.stroke(); }
  ctx.globalAlpha = 1;
  rr(ctx, 120, 46, 784, 164, 26);
  const g = ctx.createLinearGradient(0, 46, 0, 210); g.addColorStop(0, 'rgba(210,40,30,.88)'); g.addColorStop(1, 'rgba(140,16,16,.88)');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 24; ctx.strokeStyle = '#ffb09a'; ctx.lineWidth = 5; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.shadowColor = '#ffe0b0'; ctx.shadowBlur = 14; drawIcon(ctx, 'warn', 160, 78, 100, '#ffe9c8'); ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.shadowColor = '#ff8a6a'; ctx.shadowBlur = 10;
  let fs = 62; ctx.font = `900 ${fs}px ${FONT}`; while (ctx.measureText(title).width > 640 && fs > 28) { fs -= 3; ctx.font = `900 ${fs}px ${FONT}`; }
  ctx.fillText(title, 290, sub ? 130 : 148);
  if (sub) { ctx.shadowBlur = 0; ctx.fillStyle = '#ffd9cf'; ctx.font = `700 28px ${FONT}`; ctx.fillText(sub, 292, 178); }
  ctx.restore();
}

export function drawBubble(ctx, kind, id, who, text) {
  const w = 512, h = 200; ctx.clearRect(0, 0, w, h);
  rr(ctx, 8, 8, w - 16, h - 40, 26);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(14,60,96,.9)'); g.addColorStop(1, 'rgba(8,36,64,.9)');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = '#4fe3ff'; ctx.shadowBlur = 16; ctx.strokeStyle = '#6fe8ff'; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(60, h - 33); ctx.lineTo(84, h - 4); ctx.lineTo(106, h - 33); ctx.fillStyle = 'rgba(8,36,64,.95)'; ctx.fill();
  // portrait
  const pc = makeCanvas(96, 96); const pctx = pc.getContext('2d');
  if (kind === 'earth') drawEarthIcon(pctx, 96); else drawPortrait(pctx, 96, id);
  ctx.save(); ctx.beginPath(); ctx.arc(66, 82, 44, 0, 7); ctx.clip(); ctx.drawImage(pc, 22, 38, 88, 88); ctx.restore();
  ctx.strokeStyle = '#6fe8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(66, 82, 44, 0, 7); ctx.stroke();
  ctx.fillStyle = '#9fefff'; ctx.font = `900 24px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(who + ':', 128, 52);
  ctx.fillStyle = '#fff'; ctx.font = `800 26px ${FONT}`;
  const lines = wrapText(ctx, text, 360).slice(0, 4);
  lines.forEach((l, i) => ctx.fillText(l, 128, 84 + i * 30));
}

export function drawPrompt(ctx, text, enabled) {
  const w = 512, h = 112; ctx.clearRect(0, 0, w, h);
  ctx.font = `900 34px ${FONT}`; const tw = Math.min(w - 30, ctx.measureText(text).width + 60); const x = (w - tw) / 2;
  rr(ctx, x, 14, tw, 70, 22);
  ctx.fillStyle = enabled ? 'rgba(12,56,92,.88)' : 'rgba(70,30,24,.88)'; ctx.fill();
  ctx.shadowColor = enabled ? '#4fe3ff' : '#ff8a6a'; ctx.shadowBlur = 14; ctx.strokeStyle = enabled ? '#7aeaff' : '#ff9a7a'; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, 50, w - 50);
}

export function drawSign(ctx, text, col) {
  const w = 256, h = 80; ctx.clearRect(0, 0, w, h);
  rr(ctx, 4, 4, w - 8, h - 8, 14); ctx.fillStyle = 'rgba(10,40,64,.9)'; ctx.fill();
  ctx.strokeStyle = col || '#4fe3ff'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
}

export function drawWrist(ctx, solText, timeText, dose) {
  const w = 192, h = 128; ctx.clearRect(0, 0, w, h);
  rr(ctx, 4, 4, w - 8, h - 8, 16); ctx.fillStyle = 'rgba(8,50,80,.85)'; ctx.fill();
  ctx.shadowColor = '#4fe3ff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#67e6ff'; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.font = `900 34px ${FONT}`; ctx.fillText(solText, w / 2, 42);
  ctx.font = `900 40px ${FONT}`; ctx.fillStyle = '#7aeaff'; ctx.fillText(timeText, w / 2, 86);
  // dose bar
  ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, 22, 100, w - 44, 12, 6); ctx.fill();
  const c = dose > 60 ? '#ff4a3a' : dose > 30 ? '#ffb23a' : '#7dff9a';
  ctx.fillStyle = c; rr(ctx, 22, 100, Math.max(8, (w - 44) * Math.min(1, dose / 100)), 12, 6); ctx.fill();
}
