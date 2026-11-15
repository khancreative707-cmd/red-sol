import { CREW_LOOK, drawPortrait } from '../world/util.js';
import { FACTS, DATASETS, ASSET_CREDITS, FLARE_VARIANTS } from '../data/archive.js';

export const term = (w, tip) => `<span class="term" tabindex="0" data-tip="${tip}">${w}</span>`;
export const T = {
  sol: term('sol', 'A sol is one Mars day. It lasts about 24 hours and 39 minutes.'),
  dose: term('radiation dose', 'How much space radiation your body soaks up. A little is okay. A lot makes astronauts sick.'),
  delay: term('radio delay', 'Radio messages need 3 to 22 minutes to travel one way between Mars and Earth.'),
  shield: term('shield', 'A glowing energy dome that blocks radiation. A stronger shield uses more battery power.'),
};

const CREW_TEXT = {
  mei: { good: 'Fast at solar panels, repairs and making kits', bad: 'Slow with plants. Takes more radiation' },
  diego: { good: 'Fast at harvesting and caring for plants', bad: 'Slow at repairs and fixing machines' },
  asha: { good: 'Takes half the radiation. Fast medic', bad: 'Average speed at repairs and plants' },
};

export class UI {
  constructor(root, sound) { this.root = root; this.sound = sound; this.cur = null; }
  clear() { if (this.cur) { this.cur.remove(); this.cur = null; } }
  show(html, cls = '', bind) {
    this.clear(); const el = document.createElement('div'); el.className = 'screen ' + cls; el.innerHTML = html; this.root.appendChild(el); this.cur = el;
    el.addEventListener('click', (e) => { if (e.target.closest('button')) this.sound.click(); });
    if (bind) bind(el); const first = el.querySelector('.btn'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 50); return el;
  }
  title({ hasSave, onNew, onQuick, onContinue, onHow, onCredits, onSettings }) {
    this.show(`<div class="center" style="width:100%">
      <div class="logo">RED SOL</div><div class="sub">Mars Outpost Trainer</div>
      <div class="col menu">
        ${hasSave ? '<button class="btn big" data-a="cont">Continue Mission</button>' : ''}
        <button class="btn ${hasSave ? 'alt' : 'big'}" data-a="new">${hasSave ? 'New Mission (7 sols)' : 'Play (7 sols)'}</button>
        <button class="btn alt" data-a="quick">Quick Mission (4 sols)</button>
        <div class="row"><button class="btn alt" data-a="how">How to Play</button><button class="btn alt" data-a="set">Settings</button><button class="btn alt" data-a="cred">Data &amp; Credits</button></div>
      </div>
      <div class="team">TEAM REZONX ELITES</div>
    </div><div class="corner">NASA Space Apps Challenge 2026 &middot; Built with AI assistance (Claude) &middot; Not made or endorsed by NASA</div>`, '', (el) => {
      el.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (!a) return; ({ cont: onContinue, new: onNew, quick: onQuick, how: onHow, cred: onCredits, set: onSettings })[a]?.(); });
    });
  }
  select({ sols, onPick, onBack }) {
    const cards = Object.keys(CREW_LOOK).map((id) => { const L = CREW_LOOK[id], tx = CREW_TEXT[id];
      return `<button class="pick" data-id="${id}"><canvas width="120" height="120" data-p="${id}"></canvas><b>${L.name}</b><div class="role">${L.role}</div><div class="good">+ ${tx.good}</div><div class="bad">- ${tx.bad}</div></button>`; }).join('');
    this.show(`<div class="center card" style="max-width:min(960px,96vw)"><h2>Choose your astronaut</h2><p class="dim">You play as one. The other two crewmates work on their own. Mission: <b>${sols} sols</b>.</p><div class="crew">${cards}</div><button class="btn alt" data-back>Back</button></div>`, 'shade', (el) => {
      el.querySelectorAll('canvas').forEach((c) => drawPortrait(c.getContext('2d'), 120, c.dataset.p));
      el.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.id)));
      el.querySelector('[data-back]').addEventListener('click', onBack);
    });
  }
  briefing({ sol, sols, tip, first, touch, last, onGo }) {
    const ctrl = first ? (touch ? `<p>Use the <b>joystick</b> to walk. Swipe the right side to look around. Stand near a glowing ring and hold <b>USE</b>.</p>` : `<p><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> walk &middot; <span class="keys"><kbd>Shift</kbd></span> run &middot; hold <span class="keys"><kbd>E</kbd></span> to work &middot; drag the mouse to look.</p>`) : '';
    this.show(`<div class="card center" style="max-width:min(640px,94vw)"><div class="dim" style="letter-spacing:.3em;font-weight:800">MARS DAY</div><h2 style="font-size:42px;margin:0">SOL ${sol} <span class="dim" style="font-size:20px">of ${sols}</span></h2>
      ${last ? '<p style="color:#ff9a7a;font-weight:800">FINAL SOL: expect two dangers at once!</p>' : ''}
      <p>${tip}</p>${ctrl}<div style="margin-top:12px"><button class="btn big" data-go>${first ? 'Start Mission' : 'Start Sol ' + sol}</button></div></div>`, 'shade', (el) => el.querySelector('[data-go]').addEventListener('click', onGo));
  }
  tally({ sol, sols, summary, earth, onNext }) {
    const ev = (summary.eventsFaced || []).map((t) => (FACTS[t]?.title || t)).join(', ') || 'A quiet day';
    this.show(`<div class="card center" style="max-width:min(560px,94vw)"><div class="dim" style="letter-spacing:.3em;font-weight:800">NIGHT FALLS</div><h2>SOL ${sol} COMPLETE</h2>
      <div class="stat"><span>Events today</span><b>${ev}</b></div>
      <div class="stat"><span>Lowest battery</span><b>${Math.round(summary.powerMin ?? 0)}%</b></div>
      <div class="stat"><span>Plants harvested</span><b>${summary.harvested ?? 0}</b></div>
      <div class="stat"><span>Leaks patched</span><b>${summary.patched ?? 0}</b></div>
      <p class="dim" style="margin-top:10px">${earth ? 'Message from Earth: ' + earth : 'Earth says: good work, crew.'}</p>
      <button class="btn big" data-go>${sol >= sols ? 'Finish Mission' : 'Next Sol'}</button></div>`, 'shade', (el) => el.querySelector('[data-go]').addEventListener('click', onNext));
  }
  pause({ onResume, onHow, onSettings, onCredits, onRestart, onQuit, log }) {
    const lg = (log || []).slice(-4).map((l) => `<li>${l}</li>`).join('');
    this.show(`<div class="card center" style="min-width:min(380px,92vw)"><h2>Paused</h2><div class="col"><button class="btn big" data-a="res">Resume</button>
      <button class="btn alt" data-a="how">How to Play</button><button class="btn alt" data-a="set">Settings</button><button class="btn alt" data-a="cred">Data &amp; Credits</button>
      <button class="btn alt" data-a="rest">Restart Mission</button><button class="btn alt" data-a="quit">Quit to Title</button></div>
      ${lg ? `<h3>Recent news</h3><ul class="tl" style="text-align:left">${lg}</ul>` : ''}<p class="dim" style="font-size:12px">Your progress is saved automatically.</p></div>`, 'shade', (el) => {
      el.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; ({ res: onResume, how: onHow, set: onSettings, cred: onCredits, rest: onRestart, quit: onQuit })[a]?.(); });
    });
  }
  howto(touch, onBack) {
    this.show(`<div class="card" style="max-width:min(760px,95vw)"><h2>How to play</h2>
      <p>Keep your crew alive on Mars. Every choice <b>helps one thing and costs another</b>.</p>
      <h3>Controls</h3>${touch ? '<p>Joystick: walk &middot; Swipe right side: look &middot; <b>USE</b> (hold): work &middot; <b>RUN</b>: run faster &middot; Pause: top right.</p>' : '<p><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> walk &middot; <kbd>Shift</kbd> run &middot; hold <kbd>E</kbd> or <kbd>Space</kbd> to work &middot; mouse drag to look &middot; <kbd>Esc</kbd> pause.</p>'}
      <h3>Read the base</h3><div class="grid2">
        <p><b>Power</b> from solar panels. The ${T.shield} and greenhouse lights use it.</p>
        <p><b>Water and Food</b> run down as the crew lives. The greenhouse and recycler refill them.</p>
        <p><b>Backpack bars</b> show crew health. The <b>wrist screen</b> shows ${T.sol} time and your ${T.dose}.</p>
        <p><b>Red sky signs</b> warn of danger. <b>Glowing rings</b> show jobs that need doing.</p></div>
      <h3>Trade-offs</h3><p>Shield up = safer crew but less battery. Fold panels in a storm = panels stay clean but no power. Wait for Earth's advice = smarter choice but the ${T.delay} makes you wait.</p>
      <div class="center" style="margin-top:10px"><button class="btn" data-back>Back</button></div></div>`, 'shade', (el) => el.querySelector('[data-back]').addEventListener('click', onBack));
  }
  settings({ quality, sound, onQuality, onSound }, onBack) {
    this.show(`<div class="card center" style="min-width:min(420px,92vw)"><h2>Settings</h2>
      <h3>Graphics quality</h3><div class="seg" id="q">${['auto', 'low', 'medium', 'high'].map((q) => `<button data-q="${q}" class="${q === quality ? 'on' : ''}">${q}</button>`).join('')}</div>
      <p class="dim" style="font-size:13px">Auto lowers quality if your device is slow.</p>
      <h3>Sound</h3><div class="seg" id="s">${[['on', true], ['off', false]].map(([n, v]) => `<button data-s="${n}" class="${v === sound ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div style="margin-top:16px"><button class="btn" data-back>Back</button></div></div>`, 'shade', (el) => {
      el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { onQuality(b.dataset.q); el.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { onSound(b.dataset.s === 'on'); el.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('[data-back]').addEventListener('click', onBack);
    });
  }
  credits(onBack) {
    const ds = DATASETS.map((d) => `<div class="ds"><b>${d.name}</b> <span class="pill arc">ARCHIVED</span><br><span class="dim">${d.agency}</span> &middot; <a href="${d.url}" target="_blank" rel="noopener">${d.url}</a><br>${d.why}</div>`).join('');
    this.show(`<div class="card" style="max-width:min(820px,95vw)"><h2>Data &amp; Credits</h2>
      <p><b>All real data in this game is ARCHIVED.</b> It is saved inside the game and is never live. Nothing here is a live NASA feed.</p>
      <h3>Real data we used and why</h3>${ds}
      <h3>What is real and what is game-made</h3><p>Real: the events these missions and storms are based on (dates and agencies shown on event cards). Game-made: the numbers for power, water and food, the glowing shield dome, the greenhouse crops, and how fast things happen. Real shields are thick walls and shelters, not glowing domes. In the game, 1 second of radio delay shows 1 minute of real delay.</p>
      <h3>Game credits</h3><ul class="tl">${ASSET_CREDITS.map((a) => `<li>${a}</li>`).join('')}</ul>
      <p class="center dim" style="margin-top:10px">Team <b>RezonX Elites</b> &middot; NASA Space Apps Challenge 2026</p>
      <div class="center"><button class="btn" data-back>Back</button></div></div>`, 'shade', (el) => el.querySelector('[data-back]').addEventListener('click', onBack));
  }
  debrief(d, { onAgain, onChange, onCredits }) {
    const won = d.status === 'won'; const stars = [1, 2, 3].map((i) => `<span class="${i <= d.stars ? '' : 'off'}">&#9733;</span>`).join('');
    const st = d.stats || {}; const rows = [['Sols survived', d.solsSurvived], ['Plants harvested', st.harvested], ['Leaks patched', st.patched], ['Calls to Earth', st.earthCalls], ['Score', d.score]].filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    const bd = (d.badges || []).map((b) => `<div class="badge"><b>${b.name}</b><br>${b.desc}</div>`).join('') || '<span class="dim">No badges this time. Try again!</span>';
    const tl = (d.timeline || []).map((t) => { const f = FACTS[t.factId || t.type]; const real = f && f.real; const flare = (t.type === 'flare' && t.variantId) ? FLARE_VARIANTS.find((v) => v.id === t.variantId) : null;
      const src = flare ? `${flare.title}, ${flare.date}. ${flare.source}` : f ? `${f.source}${f.date ? ', ' + f.date : ''}` : '';
      return `<li><b>Sol ${t.sol}: ${f?.title || t.type}</b> ${src ? `<span class="pill ${real || (flare && flare.real) ? 'arc' : 'game'}">${(flare ? flare.real : real) ? 'ARCHIVED' : 'GAME-MADE'}</span>` : ''}<br>${t.note || ''}<br><span class="dim">${flare ? flare.blurb : (f ? f.text : '')}</span>${src ? `<br><span class="dim" style="font-size:12px">Source: ${src}</span>` : ''}</li>`; }).join('');
    this.show(`<div class="card" style="max-width:min(860px,96vw)"><div class="center"><h2 style="font-size:34px">${won ? 'MISSION COMPLETE!' : 'EARLY RETURN'}</h2>
      ${won ? '' : `<p>${d.failReason || 'The crew went to the rover shelter and came home safely.'}</p><p class="dim">That is okay! Real missions learn from hard days. Your crew gathered data for the next team.</p>`}
      <div class="stars">${stars}</div></div>
      <div class="grid2"><div><h3>Mission stats</h3>${rows}</div><div><h3>Badges</h3><div class="badges">${bd}</div></div></div>
      <h3>What you learned</h3><ul class="tl">${(d.lessons || []).map((l) => `<li>${l}</li>`).join('')}</ul>
      <h3>Your mission vs real space weather</h3><ul class="tl">${tl || '<li class="dim">No events were recorded.</li>'}</ul>
      <div class="row" style="margin-top:14px"><button class="btn big" data-a="again">Play Again</button><button class="btn alt" data-a="change">Change Crew</button><button class="btn alt" data-a="cred">Data &amp; Credits</button></div></div>`, 'shade', (el) => {
      el.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; ({ again: onAgain, change: onChange, cred: onCredits })[a]?.(); });
    });
  }
}
