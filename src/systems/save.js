const K_SAVE = 'redsol.save.v1', K_META = 'redsol.meta.v1', K_SET = 'redsol.settings.v1';
const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export const Save = {
  hasGame() { const s = get(K_SAVE, null); return !!(s && s.json && !s.done); },
  write(json, crewId, sols) { set(K_SAVE, { json, crewId, sols, at: Date.now(), done: false }); },
  load() { return get(K_SAVE, null); },
  finish() { const s = get(K_SAVE, null); if (s) { s.done = true; set(K_SAVE, s); } },
  clear() { try { localStorage.removeItem(K_SAVE); } catch { /* ignore */ } },
  meta() { return Object.assign({ perkKits: 0, runs: 0, wins: 0, bestStars: 0, badges: [] }, get(K_META, {})); },
  setMeta(m) { set(K_META, m); },
  settings() { return Object.assign({ quality: 'auto', sound: true }, get(K_SET, {})); },
  setSettings(s) { set(K_SET, s); },
};
