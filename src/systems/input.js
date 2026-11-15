import { clamp } from '../world/util.js';

const ICON_USE = '<svg viewBox="0 0 40 40"><path d="M14 22V9a2.2 2.2 0 0 1 4.4 0v9m0-2V7.5a2.2 2.2 0 0 1 4.4 0V17m0-6a2.2 2.2 0 0 1 4.4 0v8.5m0-4.5a2.2 2.2 0 0 1 4.4 0V25c0 6-4 10-10 10h-1.5c-4 0-6.200-2-8.500-5.500L9 24.500a2.200 2.200 0 0 1 3.600-2.500L14 24"/></svg>';
const ICON_RUN = '<svg viewBox="0 0 40 40"><circle cx="25" cy="8" r="3.2"/><path d="M20 15l-6 4 2 5 7 2m-4-9l7 1 4 5m-9 3l-3 8m1-8l7 2 1 6"/></svg>';

export class Input {
  constructor(canvas, uiRoot, world, touch) {
    this.world = world; this.touch = touch; this.keys = new Set(); this.useKey = false; this.useBtn = false; this.runToggle = false; this.joy = { x: 0, y: 0 }; this.enabled = false; this.onPause = () => {}; this.drag = null;
    window.addEventListener('keydown', (e) => { if (e.repeat) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') { this.onPause(); return; } this.keys.add(e.code); if (e.code === 'KeyE' || e.code === 'Space') this.useKey = true; });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'KeyE' || e.code === 'Space') this.useKey = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.useKey = false; this.useBtn = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => { if (!this.enabled) return; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!this.drag || this.drag.id !== e.pointerId) return; const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.x = e.clientX; this.drag.y = e.clientY; const k = e.pointerType === 'touch' ? 0.0075 : 0.0055; world.yaw -= dx * k; world.pitch = clamp(world.pitch + dy * k * 0.7, 0.08, 1.2); });
    const end = (e) => { if (this.drag && this.drag.id === e.pointerId) this.drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => { if (!this.enabled) return; world.dist = clamp(world.dist + Math.sign(e.deltaY) * 0.8, 5, 14); e.preventDefault(); }, { passive: false });
    this.buildTouch(uiRoot);
  }
  buildTouch(root) {
    const t = document.createElement('div'); t.id = 'touch'; this.tEl = t;
    t.innerHTML = `<div id="joy"><div class="nub"></div></div><button id="bRun" class="rbtn" aria-label="Run">${ICON_RUN}RUN</button><button id="bUse" class="rbtn" aria-label="Use">${ICON_USE}USE</button>`;
    root.appendChild(t);
    const joy = t.querySelector('#joy'), nub = joy.querySelector('.nub'); let jid = null;
    const setJ = (e) => { const r = joy.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const R = r.width / 2 - 8; const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } nub.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.hypot(dx, dy) / R; this.joy.x = m < 0.12 ? 0 : dx / R; this.joy.y = m < 0.12 ? 0 : dy / R; };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); setJ(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJ(e); });
    const up = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; nub.style.transform = ''; };
    joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    const use = t.querySelector('#bUse'), run = t.querySelector('#bRun');
    use.addEventListener('pointerdown', (e) => { this.useBtn = true; use.classList.add('down'); use.setPointerCapture(e.pointerId); e.preventDefault(); });
    const ue = () => { this.useBtn = false; use.classList.remove('down'); }; use.addEventListener('pointerup', ue); use.addEventListener('pointercancel', ue);
    run.addEventListener('pointerdown', (e) => { this.runToggle = !this.runToggle; run.classList.toggle('on', this.runToggle); e.preventDefault(); });
  }
  setEnabled(v) { this.enabled = v; this.tEl.classList.toggle('show', v && this.touch); if (!v) { this.keys.clear(); this.useKey = false; this.useBtn = false; this.joy.x = this.joy.y = 0; } }
  get() {
    const k = this.keys; let f = 0, r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1; if (k.has('KeyS') || k.has('ArrowDown')) f -= 1; if (k.has('KeyD') || k.has('ArrowRight')) r += 1; if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    f += -this.joy.y; r += this.joy.x; const m = Math.hypot(f, r); if (m > 1) { f /= m; r /= m; }
    const y = this.world.yaw; const mx = -Math.sin(y) * f + Math.cos(y) * r, mz = -Math.cos(y) * f - Math.sin(y) * r;
    return { mx: this.enabled ? mx : 0, mz: this.enabled ? mz : 0, run: this.enabled && (k.has('ShiftLeft') || k.has('ShiftRight') || this.runToggle), use: this.enabled && (this.useKey || this.useBtn) };
  }
}
