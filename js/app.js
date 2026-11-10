import { Engine } from './engine.js';
import { createLayers, fmt, esc } from './shared.js';
import { TASK } from './data.js';
import { mountSheet } from './sheet.js';
import { mountWhy } from './why.js';

const engine = new Engine();
const layers = createLayers(engine);
const ui = { why: new Set(), steer: new Map(), lit: null, viewVersion: null, device: 'desktop', cycle: 'monthly', tab: 'claims', dockOpen: false, phaseOpen: new Map() };
const ctx = { engine, layers, ui };

const stage = document.getElementById('stage');
const bar = document.getElementById('bar');
let view = null;

function route() {
  const name = location.hash === '#why' ? 'why' : 'sheet';
  if (view && view.name === name) return;
  // Mounting can set layers, which re-renders; keep the old view out of that render.
  view = null;
  stage.innerHTML = '';
  document.body.dataset.page = name;
  const next = name === 'why' ? mountWhy(stage) : mountSheet(stage, ctx);
  next.name = name;
  view = next;
  document.title = name === 'why' ? 'Why these changes · Veil' : 'Veil · Glass sheet';
  render();
}

function renderBar() {
  const E = engine;
  const name = view ? view.name : 'sheet';
  let play;
  if (!E.started) play = '<button class="btn-primary sm" data-act="start">Start</button>';
  else if (E.done) play = '<button class="bar-btn" disabled>Finished</button>';
  else if (E.waiting) play = '<button class="bar-btn" disabled>Waiting for you</button>';
  else play = `<button class="bar-btn" data-act="toggle-play">${E.playing ? 'Pause' : 'Resume'}</button>`;
  if (name === 'why') {
    bar.innerHTML = `<div class="brand"><span class="mark" aria-hidden="true"></span>Veil<em>Glass sheet · Levy's revision</em></div>
      <a class="bar-link" href="#sheet">← Back to the prototype</a>`;
    return;
  }
  bar.innerHTML = `
    <div class="brand"><span class="mark" aria-hidden="true"></span>Veil<em>Glass sheet</em></div>
    <div class="task-wrap">
      <button class="task" data-act="reqs" aria-expanded="${!!ui.reqOpen}" aria-controls="reqs">
        <span class="task-k">Task</span><b>${esc(TASK.title)}</b><span class="task-app">for ${TASK.app}, a made-up app</span>
        <span class="task-reqs">Requirements <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.5 8 9.5l3-3"/></svg></span>
      </button>
      ${ui.reqOpen ? reqsHTML() : ''}
    </div>
    <div class="playback">
      ${play}
      <button class="bar-btn" data-act="skip" ${E.done || E.waiting || !E.started ? 'disabled' : ''}>Skip ahead</button>
      <button class="bar-btn" data-act="restart">Restart</button>
      <div class="seg seg--sm" role="group" aria-label="Speed">${[1, 2, 4]
        .map(s => `<button class="${E.speed === s ? 'on' : ''}" data-act="speed" data-speed="${s}" aria-pressed="${E.speed === s}">${s}×</button>`)
        .join('')}</div>
      <span class="bar-clock">${fmt(E.clock)}</span>
    </div>
    <span class="demo-tag" title="A scripted run. No model is called and nothing you do is recorded or sent.">Simulated run · example data</span>
    <a class="bar-link" href="#why">Why these changes</a>`;
}

// What the page should do, so people can judge it without reading the agent's log.
function reqsHTML() {
  return `<div class="reqs-pop" id="reqs" role="dialog" aria-label="Requirements">
    <p class="reqs-brief">${esc(TASK.brief)}</p>
    <ol class="reqs-list">${TASK.requirements
      .map(r => `<li><span>${esc(r.text)}</span>${r.tryIt ? `<small>${esc(r.tryIt)}</small>` : ''}<em class="src-${r.from}">${r.from === 'brief' ? 'From the brief' : 'Proposed for this demo'}</em></li>`)
      .join('')}</ol>
    <p class="reqs-foot">Check these against the page on the right. The agent sees only the brief.</p>
  </div>`;
}

function render() {
  renderBar();
  if (view) view.render();
}

engine.on(kind => {
  if (view && view.name === 'why') return;
  if (kind === 'tick') {
    // Tools and helpers change look when they finish, so redraw when that set changes.
    const sig = engine.log.filter(ev => engine.isRunning(ev)).map(ev => ev.id + (ev.type === 'subagent' ? Math.ceil(((engine.clock - ev.at) / ev.dur) * ev.steps.length) : '')).join();
    if (sig !== ctx.runningSig) {
      ctx.runningSig = sig;
      return render();
    }
    const clock = bar.querySelector('.bar-clock');
    if (clock) clock.textContent = fmt(engine.clock);
    view && view.tick();
    return;
  }
  render();
});
layers.on(() => view && view.name !== 'why' && render());

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const { act, id, choice } = b.dataset;
  switch (act) {
    case 'start':
      engine.start();
      break;
    case 'toggle-play':
      engine.playing ? engine.pause() : engine.play();
      break;
    case 'skip':
      engine.skip();
      break;
    case 'restart':
      engine.reset();
      ui.why.clear();
      ui.steer.clear();
      ui.viewVersion = null;
      ui.cycle = 'monthly';
      ui.phaseOpen.clear();
      render();
      break;
    case 'speed':
      engine.setSpeed(+b.dataset.speed);
      break;
    case 'why': {
      if (ui.why.has(id)) ui.why.delete(id);
      else {
        ui.why.add(id);
        const ev = engine.byId.get(id);
        engine.note(`You asked why: "${ev.plain || ev.short || ev.text}"`);
      }
      render();
      break;
    }
    case 'steer-open':
      ui.steer.get(id) === b.dataset.card ? ui.steer.delete(id) : ui.steer.set(id, b.dataset.card);
      render();
      break;
    case 'steer':
      ui.steer.delete(id);
      engine.steer(id, choice);
      break;
    case 'reqs':
      ui.reqOpen = !ui.reqOpen;
      if (ui.reqOpen) engine.note('You opened the requirements');
      renderBar();
      break;
    case 'answer':
      engine.answer(id, choice);
      break;
    case 'ask-check':
      engine.askCheck(id);
      break;
    case 'rung':
      layers.apply(+b.dataset.n);
      break;
    case 'layer':
      layers.set(b.dataset.key, +b.dataset.val);
      break;
    case 'version':
      ui.viewVersion = +b.dataset.v || null;
      render();
      break;
    case 'device':
      ui.device = b.dataset.device;
      engine.note(`You previewed the page on ${ui.device === 'mobile' ? 'a phone' : 'desktop'}`);
      render();
      break;
    case 'cycle':
      ui.cycle = b.dataset.cycle || (ui.cycle === 'monthly' ? 'yearly' : 'monthly');
      render();
      break;
    case 'tab':
      // Clicking the open tab folds the panel; any other tab opens it.
      if (ui.dockOpen && ui.tab === b.dataset.tab && !b.dataset.keep) ui.dockOpen = false;
      else { ui.tab = b.dataset.tab; ui.dockOpen = true; }
      render();
      break;
    case 'dock-close':
      ui.dockOpen = false;
      render();
      break;
    case 'phase': {
      const open = b.getAttribute('aria-expanded') === 'true';
      ui.phaseOpen.set(id, !open);
      render();
      break;
    }
    case 'feed-latest':
      view && view.toLatest && view.toLatest();
      break;
    case 'sheet-mode': {
      const mode = b.dataset.mode;
      const cur = ui.sheetMode || 'cover';
      if (mode === cur) break;
      if (mode === 'collapsed') ui.sheetLast = cur;
      ui.sheetMode = mode;
      engine.note({ cover: 'You laid the veil back over the work', pinned: 'You pinned the veil to the left', collapsed: 'You collapsed the veil' }[mode]);
      render();
      break;
    }
  }
});

// Close the requirements on Escape or a click elsewhere.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.reqOpen) { ui.reqOpen = false; renderBar(); bar.querySelector('.task')?.focus(); }
});
document.addEventListener('pointerdown', e => {
  if (ui.reqOpen && !e.target.closest('.task-wrap')) { ui.reqOpen = false; renderBar(); }
});

document.addEventListener('change', e => {
  if (e.target.dataset.change === 'verify') layers.setVerify(e.target.checked);
  if (e.target.dataset.change === 'checks-always') layers.setChecksAlways(e.target.checked);
});

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  engine.tick(Math.min(1.2, (now - last) / 1000));
  last = now;
}, 100);

window.addEventListener('hashchange', route);
route();

// For testing from the console.
window.veil = { engine, layers, ui, render };
