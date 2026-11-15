const K_SAVE = 'redsol.save.v1', K_META = 'redsol.meta.v1', K_SET = 'redsol.settings.v1';
const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export const Save = {
  hasGame() { const s = get(K_SAVE, null); return !!(s && s.json && !s.done && this.load()); },
  write(json, crewId, sols) { set(K_SAVE, { json, crewId, sols, at: Date.now(), done: false }); },
  load() { const s = get(K_SAVE, null); if (!s) return null; try { const st = JSON.parse(s.json); const ok = st && st.v === 1 && Array.isArray(st.crew) && st.crew.length === 3 && Number.isFinite(st.power) && Number.isFinite(st.t) && st.status === 'playing' && ['mei', 'diego', 'asha'].includes(s.crewId); if (ok) return s; } catch { /* corrupt */ } this.clear(); return null; },
  finish() { const s = get(K_SAVE, null); if (s) { s.done = true; set(K_SAVE, s); } },
  clear() { try { localStorage.removeItem(K_SAVE); } catch { /* ignore */ } },
  meta() { return Object.assign({ perkKits: 0, runs: 0, wins: 0, bestStars: 0, badges: [] }, get(K_META, {})); },
  setMeta(m) { set(K_META, m); },
  settings() { return Object.assign({ quality: 'auto', sound: true }, get(K_SET, {})); },
  setSettings(s) { set(K_SET, s); },
};
