// Moderator console. Researcher-only window. Holds the replay content and every control,
// and sends the participant screen only what the current view allows.

import { open, fmtClock } from './protocol.js';
import { TASK, EVENTS, END } from './content/practice-cube.js';
import { PAGES } from './content/cube-pages.js';

// ---------- state ----------

const VIEWS = {
  A: { thinking: false, tools: false },
  B: { thinking: true, tools: false },
  C: { thinking: false, tools: true },
  D: { thinking: true, tools: true },
};

// Panel decisions from the handover: each is a switchable variant; first option is the "Start with".
const VARIANTS = [
  { group: 'Information architecture', items: [
    { key: 'grouping', label: 'Order and grouping', opts: [['tools', 'Time order, consecutive tool calls grouped'], ['time', 'Strict time order'], ['turns', 'Work grouped under the message before it']] },
    { key: 'long', label: 'Long content', opts: [['full', 'Full length'], ['box', 'Fixed-height box that scrolls inside']] },
    { key: 'running', label: 'Running state', opts: [['stream', 'Text streams in as it arrives'], ['finished', 'A block appears only when finished']] },
    { key: 'working', label: 'Working indicator', opts: [['line', 'One shared "Working…" line'], ['none', 'None']] },
    { key: 'scroll', label: 'Scrolling', opts: [['follow', 'Follow unless scrolled up, plus Jump to latest'], ['always', 'Always follow']] },
    { key: 'link', label: 'Chat to work link (pane only)', opts: [['none', 'None'], ['hover', 'Hover a message to highlight the work after it'], ['dividers', 'Divider per turn']] },
  ] },
  { group: 'Content design', items: [
    { key: 'labels', label: 'Block labels', opts: [['short', '"Thinking" label; tool name as emitted'], ['none', 'Style only, no labels']] },
    { key: 'thinking', label: 'Thinking style', opts: [['rule', 'Muted with a left rule'], ['indent', 'Muted and indented'], ['quote', 'Quote-style card']] },
    { key: 'tool', label: 'Tool call anatomy', opts: [['split', 'Call line, then output below'], ['box', 'Call and output in one box']] },
    { key: 'code', label: 'Code and diffs', opts: [['plain', 'Plain monospace, + and − kept as text'], ['tint', '+ / − lines tinted']] },
    { key: 'errors', label: 'Errors', opts: [['plain', 'As produced, no tint'], ['tint', 'Error text tinted']] },
    { key: 'time', label: 'Timestamps', opts: [['none', 'None'], ['block', 'Time per block']] },
  ] },
];

const st = {
  layout: 'stream',
  view: 'D',
  variants: Object.fromEntries(VARIANTS.flatMap(g => g.items.map(i => [i.key, i.opts[0][0]]))),
  time: 0,
  playing: false,
  speed: 1,
  started: false,
  typed: [],             // requests the participant typed
  accepted: null,        // time the participant pressed "I'd accept this"
  showTimer: true,
  autoStart: true,       // the participant's first request starts the replay
  ownFirst: false,       // their words replaced the scripted first request
  code: '',
  mode: 'think-aloud',
  log: [],               // researcher-side activity
  connected: false,
  onScreen: new Map(),   // block id -> { since, total }
};

const send = open(msg => {
  if (msg.kind === 'hello') { if (!msg.mirror) { st.connected = true; note('Participant screen connected'); } broadcast(true); renderStatus(); }
  if (msg.kind === 'request') {
    // The participant's first request starts the replay, standing in for the agent picking it up.
    // Their own words replace the scripted request.
    if (!st.started && st.autoStart) {
      st.started = true; st.playing = true; st.time = 0; st.ownFirst = true;
      st.typed.push({ id: 'r1', t: 0, type: 'request', text: msg.text });
      note(`Participant sent: "${msg.text}" (replay started)`);
    } else {
      st.typed.push({ id: `u${st.typed.length + 1}`, t: st.time, type: 'request', text: msg.text });
      note(`Participant sent: "${msg.text}"`);
    }
    broadcast(true); renderStatus();
  }
  if (msg.kind === 'accept' && st.accepted == null) { st.accepted = st.time; note("Participant pressed I'd accept this"); broadcast(true); renderStatus(); }
  if (msg.kind === 'seen') for (const c of msg.changes) trackSeen(c);
  if (msg.kind === 'scroll' && !msg.atBottom) note(`Participant scrolled up in ${msg.stream}`, true);
});

function note(text, quiet) {
  const last = st.log[0];
  if (quiet && last && last.text === text && st.time - last.t < 3) return;
  st.log.unshift({ t: st.time, text });
  st.log.length = Math.min(st.log.length, 60);
}

function trackSeen({ id, on }) {
  const now = performance.now();
  const r = st.onScreen.get(id) || { since: null, total: 0 };
  if (on && r.since == null) r.since = now;
  if (!on && r.since != null) { r.total += now - r.since; r.since = null; }
  st.onScreen.set(id, r);
}

// ---------- what the participant may see ----------

function partial(e, t) {
  const p = Math.max(0, Math.min(1, (t - e.t) / (e.dur || 0.001)));
  if (e.type === 'tool') {
    const lines = e.output.split('\n');
    return { ...e, output: lines.slice(0, Math.ceil(lines.length * p)).join('\n') };
  }
  return { ...e, text: e.text.slice(0, Math.ceil(e.text.length * p)) };
}

function visibleBlocks() {
  const v = VIEWS[st.view];
  const t = st.time;
  const scripted = EVENTS.filter(e => e.type !== 'preview' && !(st.ownFirst && e.id === 'r1'));
  const all = [...scripted, ...st.typed].sort((a, b) => a.t - b.t);
  const out = [];
  let turn = 0;
  for (const e of all) {
    // The participant's own requests always show; the scripted run shows once it has started.
    if (e.t > t || (!st.started && !st.typed.includes(e))) continue;
    // Hidden layers are dropped here, so they never reach the participant window.
    if (e.type === 'thinking' && !v.thinking) continue;
    if (e.type === 'tool' && !v.tools) continue;
    const running = e.dur && t < e.t + e.dur;
    if (running && st.variants.running === 'finished') continue;
    const b = running ? partial(e, t) : e;
    if (e.type === 'request' || e.type === 'message') turn++;
    const { id, type, text, call, output } = b;
    out.push({ id, type, t: e.t, turn, ...(type === 'tool' ? { call, output } : { text }) });
  }
  return out;
}

function currentPreview() {
  if (!st.started) return { id: 'empty', html: PAGES.empty };
  const p = EVENTS.filter(e => e.type === 'preview' && e.t <= st.time).pop();
  return p ? { id: p.id, html: p.html } : { id: 'empty', html: PAGES.empty };
}

let lastSent = '';
function broadcast(force) {
  const blocks = visibleBlocks();
  const preview = currentPreview();
  const state = {
    kind: 'state',
    layout: st.layout,
    view: st.view,
    variants: st.variants,
    task: { title: TASK.title, brief: TASK.brief },
    timer: { show: st.showTimer, left: TASK.seconds - st.time },
    accepted: st.accepted != null,
    working: st.started && st.time < END,
    blocks,
  };
  const key = JSON.stringify(state) + preview.id;
  if (!force && key === lastSent) return;
  lastSent = key;
  send({ ...state, preview });
}

// ---------- clock ----------

let last = null;
function frame(now) {
  if (st.playing && last != null) {
    st.time = Math.min(TASK.seconds, st.time + ((now - last) / 1000) * st.speed);
    if (st.time >= END && st.time - ((now - last) / 1000) * st.speed < END) note('Agent run finished');
  }
  last = now;
  broadcast();
  renderClock();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(renderStatus, 500);

// ---------- UI ----------

const $ = s => document.querySelector(s);
const seg = (name, opts, cur) =>
  `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map(([v, l]) => `<button role="radio" aria-checked="${v === cur}" data-set="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;

function renderControls() {
  $('#layout').innerHTML = seg('layout', [['stream', 'Option 1 · In-stream'], ['pane', 'Option 2 · Pane']], st.layout);
  $('#view').innerHTML = seg('view', [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], st.view)
    + `<p class="hint">${({ A: 'Thinking hidden · tool calls hidden', B: 'Thinking shown · tool calls hidden', C: 'Thinking hidden · tool calls shown', D: 'Thinking shown · tool calls shown' })[st.view]}</p>`;
  $('#speed').innerHTML = seg('speed', [['1', '1×'], ['2', '2×'], ['4', '4×']], String(st.speed));
  $('#variants').innerHTML = VARIANTS.map(g => `<h3>${g.group}</h3>${g.items.map(i => `
    <label class="variant"><span>${i.label}</span>
      <select data-variant="${i.key}">${i.opts.map(([v, l], n) => `<option value="${v}" ${st.variants[i.key] === v ? 'selected' : ''}>${l}${n === 0 ? ' (start with)' : ''}</option>`).join('')}</select>
    </label>`).join('')}`).join('');
  $('#timer-show').checked = st.showTimer;
}

function renderClock() {
  $('#clock').textContent = fmtClock(st.time);
  $('#play').textContent = st.playing ? 'Pause' : st.started ? 'Resume' : 'Start practice task';
  const scrub = $('#scrub');
  if (document.activeElement !== scrub) scrub.value = Math.min(st.time, END);
}

function renderStatus() {
  const left = TASK.seconds - st.time;
  const vis = visibleBlocks();
  const counts = vis.reduce((a, b) => ((a[b.type] = (a[b.type] || 0) + 1), a), {});
  $('#status').innerHTML = `
    <dl>
      <div><dt>Participant screen</dt><dd>${st.connected ? 'Connected' : '<span class="warn">Not open</span>'}</dd></div>
      <div><dt>Layout · view</dt><dd>${st.layout === 'pane' ? 'Pane' : 'In-stream'} · View ${st.view}</dd></div>
      <div><dt>Time left</dt><dd>${fmtClock(left)}${st.showTimer ? '' : ' <span class="muted">(hidden from participant)</span>'}</dd></div>
      <div><dt>Accept pressed</dt><dd>${st.accepted == null ? '—' : `at ${fmtClock(st.accepted)}`}</dd></div>
      <div><dt>On participant screen now</dt><dd>${['request', 'message', 'thinking', 'tool'].map(k => `${counts[k] || 0} ${k}`).join(' · ')}</dd></div>
    </dl>
    <h3>Activity</h3>
    <ol class="log">${st.log.map(l => `<li><time>${fmtClock(l.t)}</time>${l.text.replace(/</g, '&lt;')}</li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ol>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.set) {
    const k = b.dataset.set, v = b.dataset.v;
    if (k === 'layout') { st.layout = v; note(`Layout: ${v === 'pane' ? 'Pane' : 'In-stream'}`); }
    if (k === 'view') { st.view = v; note(`View ${v}`); }
    if (k === 'speed') st.speed = +v;
    renderControls(); broadcast(true); renderStatus();
  }
  if (b.id === 'play') {
    if (!st.started) { st.started = true; note('Practice task started'); }
    st.playing = !st.playing;
    broadcast(true);
  }
  if (b.id === 'restart') {
    Object.assign(st, { time: 0, playing: false, started: false, typed: [], accepted: null, ownFirst: false });
    st.onScreen.clear();
    note('Restarted');
    broadcast(true); renderStatus();
  }
  if (b.id === 'stop') { st.playing = false; note('Run stopped'); }
  if (b.id === 'end') { st.started = true; st.time = END; st.playing = false; broadcast(true); }
  if (b.id === 'open') window.open('index.html', 'agent-veil-participant', 'width=1440,height=900');
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.variant) { st.variants[t.dataset.variant] = t.value; note(`${t.dataset.variant}: ${t.value}`); broadcast(true); }
  if (t.id === 'timer-show') { st.showTimer = t.checked; broadcast(true); renderStatus(); }
  if (t.id === 'autostart') st.autoStart = t.checked;
  if (t.id === 'pcode') st.code = t.value;
  if (t.name === 'mode') st.mode = t.value;
});
document.addEventListener('input', e => {
  if (e.target.id === 'scrub') { st.started = true; st.time = +e.target.value; broadcast(true); }
});

$('#scrub').max = END;
renderControls();
renderStatus();
broadcast(true);

// Scale the participant mirror to fit its card.
const mf = document.querySelector('.mirror-frame');
new ResizeObserver(() => {
  mf.querySelector('iframe').style.transform = `scale(${mf.clientWidth / 1440})`;
}).observe(mf);
