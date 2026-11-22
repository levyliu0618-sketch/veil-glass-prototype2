// Moderator console. Researcher-only window. Holds the replay content and every control,
// and sends the participant screen only what the current view allows.
//
// Two clocks, kept apart on purpose:
//   task clock   real time since the task started; drives the timer and every logged time
//   replay clock position in the scripted run; pause, speed and scrubbing change only this

import { open, fmtClock } from './protocol.js?v=20261122c';
import { TASK, EVENTS, END } from './content/practice-cube.js?v=20261122c';
import { PAGES } from './content/cube-pages.js?v=20261122c';

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
    { key: 'code', label: 'Code and diffs', opts: [['plain', 'Plain monospace, + and − kept as text'], ['syntax', 'Syntax highlighting'], ['tint', '+ / − lines tinted']] },
    { key: 'errors', label: 'Errors', opts: [['plain', 'As produced, no tint'], ['tint', 'Error text tinted']] },
    { key: 'time', label: 'Timestamps', opts: [['none', 'None'], ['block', 'Time per block']] },
  ] },
];

const PRACTICE_REQUEST = 'Build a spinning 3D cube that changes colour when I click it.';

const st = {
  layout: 'stream',
  view: 'D',
  variants: Object.fromEntries(VARIANTS.flatMap(g => g.items.map(i => [i.key, i.opts[0][0]]))),
  // replay clock
  time: 0, playing: false, speed: 1, started: false,
  // task clock (performance.now() values)
  taskStart: null, taskStop: null, timeUp: false,
  typed: [],             // requests the participant typed
  accepted: null,        // { task, replay } when "I'd accept this" was pressed
  showTimer: true,
  autoStart: true,       // the participant's first request starts the task and the replay
  ownFirst: false,       // their words replaced the scripted first request
  code: '', mode: 'think-aloud',
  log: [],               // researcher-side activity, stamped with task time
  lastPing: 0,           // last heartbeat from the real participant screen
  onScreen: new Map(),   // block id -> { since, total } in ms of task time on screen
};

const taskTime = () => (st.taskStart == null ? 0 : ((st.taskStop ?? performance.now()) - st.taskStart) / 1000);
const connected = () => performance.now() - st.lastPing < 4000;

function startTask(how) {
  if (st.taskStart != null) return;
  st.taskStart = performance.now();
  st.taskStop = null;
  st.started = true;
  st.playing = true;
  note(`Task started (${how})`);
}
function stopTask(why) {
  if (st.taskStart == null || st.taskStop != null) return;
  st.taskStop = performance.now();
  st.playing = false;
  closeAllSeen();
  note(why);
}

const send = open(msg => {
  if (msg.kind === 'hello' || msg.kind === 'ping') {
    if (!msg.mirror) {
      const was = connected();
      st.lastPing = performance.now();
      if (!was) note('Participant screen connected');
    }
    if (msg.kind === 'hello') broadcast(true);
  }
  if (msg.kind === 'request') {
    send({ kind: 'ack', rid: msg.rid });
    if (!st.started && st.autoStart) {
      // A fixed practice replay: any first request starts the same cube run. Their own words
      // replace the scripted request; nothing pretends to answer them.
      st.ownFirst = true;
      st.typed.push({ id: 'r1', t: 0, type: 'request', text: msg.text });
      startTask('participant sent the first request');
      note(`Participant sent: "${msg.text}"`);
    } else {
      st.typed.push({ id: `u${st.typed.length + 1}`, t: st.time, type: 'request', text: msg.text });
      note(`Participant sent: "${msg.text}" (no reply in this replay)`);
    }
    broadcast(true); renderStatus();
  }
  if (msg.kind === 'accept' && st.accepted == null && st.taskStart != null) {
    st.accepted = { task: taskTime(), replay: st.time };
    note(`Participant pressed I'd accept this (replay at ${fmtClock(st.time)})`);
    broadcast(true); renderStatus();
  }
  if (msg.kind === 'seen' && !msg.mirror) for (const c of msg.changes) trackSeen(c);
  if (msg.kind === 'scroll' && !msg.mirror && !msg.atBottom) note(`Participant scrolled up in ${msg.stream}`, true);
});

function note(text, quiet) {
  const t = taskTime();
  const last = st.log[0];
  if (quiet && last && last.text === text && t - last.t < 3) return;
  st.log.unshift({ t, text });
  st.log.length = Math.min(st.log.length, 80);
}

// Screen time per block, only while the task clock runs. This is time on screen, not reading time.
function trackSeen({ id, on }) {
  if (st.taskStart == null || st.taskStop != null) return;
  const now = performance.now();
  const r = st.onScreen.get(id) || { since: null, total: 0 };
  if (on && r.since == null) r.since = now;
  if (!on && r.since != null) { r.total += now - r.since; r.since = null; }
  st.onScreen.set(id, r);
}
function closeAllSeen() {
  const now = performance.now();
  for (const r of st.onScreen.values()) if (r.since != null) { r.total += now - r.since; r.since = null; }
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
    const own = st.typed.includes(e);
    if (!own && (!st.started || e.t > t)) continue;
    // Hidden layers are dropped here, so they never reach the participant window.
    if (e.type === 'thinking' && !v.thinking) continue;
    if (e.type === 'tool' && !v.tools) continue;
    const running = !own && e.dur && t < e.t + e.dur;
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
let lastBeat = 0;
function broadcast(force) {
  const blocks = visibleBlocks();
  const preview = currentPreview();
  const state = {
    kind: 'state',
    layout: st.layout,
    view: st.view,
    variants: st.variants,
    task: { title: TASK.title, brief: TASK.brief },
    timer: { show: st.showTimer, left: Math.max(0, TASK.seconds - Math.floor(taskTime())) },
    taskRunning: st.taskStart != null && st.taskStop == null,
    accepted: st.accepted != null,
    working: st.started && st.time < END,
    blocks,
  };
  const key = JSON.stringify(state) + preview.id;
  const now = performance.now();
  // Also send a heartbeat every second, so the participant screen knows the console is there.
  if (!force && key === lastSent && now - lastBeat < 1000) return;
  lastSent = key;
  lastBeat = now;
  send({ ...state, preview });
}

// ---------- clocks ----------

let last = null;
function frame(now) {
  if (st.playing && last != null) {
    const before = st.time;
    st.time = Math.min(END, st.time + ((now - last) / 1000) * st.speed);
    if (st.time >= END && before < END) { st.playing = false; note('Replay finished'); }
  }
  if (!st.timeUp && st.taskStart != null && taskTime() >= TASK.seconds) { st.timeUp = true; stopTask('Time is up'); }
  last = now;
  broadcast();
  renderClock();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(renderStatus, 500);

// ---------- UI ----------

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  $('#autostart').checked = st.autoStart;
  $('#practice').textContent = PRACTICE_REQUEST;
}

function renderClock() {
  const running = st.taskStart != null && st.taskStop == null;
  $('#task-clock').textContent = fmtClock(taskTime());
  $('#start').disabled = st.taskStart != null;
  $('#stop').disabled = !running;
  $('#play').disabled = !st.started || st.time >= END;
  $('#play').textContent = st.playing ? 'Pause replay' : 'Resume replay';
  $('#clock').textContent = `${fmtClock(st.time)} / ${fmtClock(END)}`;
  const scrub = $('#scrub');
  if (document.activeElement !== scrub) scrub.value = st.time;
}

function renderStatus() {
  const left = Math.max(0, TASK.seconds - taskTime());
  const vis = visibleBlocks();
  const counts = vis.reduce((a, b) => ((a[b.type] = (a[b.type] || 0) + 1), a), {});
  const ago = st.lastPing ? Math.round((performance.now() - st.lastPing) / 1000) : null;
  const conn = connected()
    ? 'Connected'
    : `<span class="warn">Not connected</span> <span class="muted">${ago == null ? '— open it with the button above, in this same browser' : `(last seen ${ago}s ago)`}</span>`;
  const now = performance.now();
  const seen = [...st.onScreen.entries()]
    .map(([id, r]) => [id, r.total + (r.since != null ? now - r.since : 0)])
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const taskState = st.taskStart == null ? 'Not started' : st.taskStop != null ? (st.timeUp ? 'Time is up' : 'Stopped') : 'Running';
  $('#status').innerHTML = `
    <dl>
      <div><dt>Participant screen</dt><dd>${conn}</dd></div>
      <div><dt>Layout · view</dt><dd>${st.layout === 'pane' ? 'Pane' : 'In-stream'} · View ${st.view}</dd></div>
      <div><dt>Task</dt><dd>${taskState} · ${fmtClock(taskTime())} elapsed · ${fmtClock(left)} left${st.showTimer ? '' : ' <span class="muted">(timer hidden from participant)</span>'}</dd></div>
      <div><dt>Accept pressed</dt><dd>${st.accepted == null ? '—' : `at ${fmtClock(st.accepted.task)} task time <span class="muted">(replay at ${fmtClock(st.accepted.replay)})</span>`}</dd></div>
      <div><dt>On participant screen now</dt><dd>${['request', 'message', 'thinking', 'tool'].map(k => `${counts[k] || 0} ${k}`).join(' · ')}</dd></div>
    </dl>
    <h3>Activity <span class="muted">(task time)</span></h3>
    <ol class="log">${st.log.map(l => `<li><time>${fmtClock(l.t)}</time>${esc(l.text)}</li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ol>
    <h3>Time on screen <span class="muted">(top blocks, seconds; screen time, not reading time — still to be validated)</span></h3>
    <ol class="log seen">${seen.map(([id, ms]) => `<li><time>${(ms / 1000).toFixed(1)}</time>${esc(id)}</li>`).join('') || '<li class="muted">Starts with the task.</li>'}</ol>`;
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
  if (b.id === 'start') { startTask('moderator'); broadcast(true); }
  if (b.id === 'stop') { stopTask('Task stopped by moderator'); broadcast(true); }
  if (b.id === 'play') { st.playing = !st.playing; note(st.playing ? 'Replay resumed' : 'Replay paused'); broadcast(true); }
  if (b.id === 'reset') {
    Object.assign(st, { time: 0, playing: false, started: false, typed: [], accepted: null, ownFirst: false, taskStart: null, taskStop: null, timeUp: false });
    st.onScreen.clear();
    st.log = [];
    note('Reset');
    broadcast(true); renderStatus();
  }
  if (b.id === 'end') { st.started = true; st.time = END; st.playing = false; note('Replay jumped to end'); broadcast(true); }
  if (b.id === 'open') window.open('index.html', 'agent-veil-participant', 'width=1440,height=900');
  if (b.id === 'copy-practice') { navigator.clipboard?.writeText(PRACTICE_REQUEST); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1200); }
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
