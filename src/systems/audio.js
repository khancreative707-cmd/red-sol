// All sound is synthesized with WebAudio, no audio files needed.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.geigerAcc = 0; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
    // noise buffer
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = nb;
    // wind
    const ws = c.createBufferSource(); ws.buffer = nb; ws.loop = true; this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = 0.7; this.windG = c.createGain(); this.windG.gain.value = 0.03; ws.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master); ws.start();
    // pad
    this.padG = c.createGain(); this.padG.gain.value = 0.05; this.padG.connect(this.master);
    [110, 164.81, 220, 277.18].forEach((f, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; const g = c.createGain(); g.gain.value = 0.25; const l = c.createOscillator(); l.frequency.value = 0.07 + i * 0.03; const lg = c.createGain(); lg.gain.value = 0.18; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(this.padG); o.start(); l.start(); });
    // shield hum
    this.humG = c.createGain(); this.humG.gain.value = 0; const ho = c.createOscillator(); ho.type = 'sawtooth'; ho.frequency.value = 55; const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220; ho.connect(hf); hf.connect(this.humG); this.humG.connect(this.master); ho.start();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; }
  tone(f, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) { if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); }
  burst(dur, vol, freq, q = 1, type = 'lowpass') { if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  click() { this.tone(660, 0.07, 'triangle', 0.1); }
  ok() { this.tone(523, 0.1, 'triangle', 0.12); this.tone(784, 0.16, 'triangle', 0.12, 0, 0.09); }
  done() { this.tone(660, 0.09, 'sine', 0.1); this.tone(990, 0.14, 'sine', 0.1, 0, 0.08); }
  bad() { this.tone(220, 0.25, 'sawtooth', 0.1, -80); }
  alarm() { for (let i = 0; i < 3; i++) { this.tone(880, 0.18, 'square', 0.07, 0, i * 0.3); this.tone(660, 0.14, 'square', 0.07, 0, i * 0.3 + 0.16); } }
  impact() { this.burst(1.2, 0.9, 260, 0.8); this.tone(70, 0.9, 'sine', 0.5, -40); }
  whoosh() { this.burst(1.6, 0.25, 900, 0.6, 'bandpass'); }
  step() { this.burst(0.06, 0.05, 500, 1); }
  call() { this.tone(1200, 0.1, 'sine', 0.1); this.tone(1500, 0.1, 'sine', 0.1, 0, 0.12); this.tone(1000, 0.2, 'sine', 0.08, 0, 0.26); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, 0, i * 0.14)); }
  sad() { [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.12, 0, i * 0.25)); }
  update(dt, st) { // st: {storm, dose rate (0..1), shield, light}
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(0.025 + st.storm * 0.35, t, 0.4); this.windF.frequency.setTargetAtTime(350 + st.storm * 700, t, 0.5);
    this.humG.gain.setTargetAtTime(st.shield * 0.018, t, 0.3); this.padG.gain.setTargetAtTime(this.muted ? 0 : 0.05 * (0.5 + st.light * 0.5), t, 1);
    if (st.dose > 0.01 && !this.muted) { this.geigerAcc += dt * (4 + st.dose * 28); while (this.geigerAcc > 1) { this.geigerAcc--; if (Math.random() < 0.8) this.burst(0.012, 0.18, 3500, 1, 'highpass'); } }
  }
}
