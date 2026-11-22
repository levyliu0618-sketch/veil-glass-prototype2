// Participant screen. Renders whatever state the moderator console sends.
// Rules from the handover this file keeps:
// - Same shell, widths, fonts and preview size in every view. A view only changes which blocks arrive.
// - Nothing collapses, blurs or summarises; no labels that point to hidden layers.
// - Every block is its own element with a stable id (data-block).

import { open, fmtClock } from './protocol.js?v=20261122b';

const $app = document.getElementById('app');
let S = null;                 // last state from the console
let structureSig = '';
let shown = new Map();        // block id -> rendered text signature
let lastPreviewId = null;
let briefOpen = false;
const pinnedBottom = { stream: true, chat: true, work: true };

const send = open(msg => {
  if (msg.kind === 'state') { S = msg; render(); }
});
// The console shows a small mirror of this screen; the mirror doesn't count as the participant.
const MIRROR = new URLSearchParams(location.search).has('mirror');
send({ kind: 'hello', mirror: MIRROR });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- shell ----------

function shell() {
  $app.innerHTML = `
    <header class="top">
      <span class="view-label" data-r="view"></span>
      <div class="brief">
        <button class="brief-btn" data-act="brief" aria-expanded="false"><span data-r="title"></span></button>
        <div class="brief-pop" data-r="briefpop" hidden></div>
      </div>
      <div class="top-right">
        <span class="timer" data-r="timer"></span>
        <button class="accept" data-act="accept">I'd accept this</button>
      </div>
    </header>
    <main class="layout" data-r="layout"></main>`;
}

function layoutHTML(layout) {
  const chatCol = name => `
      <section class="col col-${name}" aria-label="${name === 'stream' ? 'Conversation' : 'Chat'}">
        <div class="scroller" data-scroll="${name}"><div class="stream" data-stream="${name}"></div>
          <div class="working" data-r="working" hidden>Working…</div>
        </div>
        <button class="jump" data-act="jump" data-for="${name}" hidden>Jump to latest</button>
        <form class="ask" data-act="ask">
          <textarea rows="1" placeholder="Ask the agent to build or change something" aria-label="Message to the agent"></textarea>
          <button type="submit" aria-label="Send">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>
          </button>
        </form>
      </section>`;
  const preview = `<div class="preview"><div class="preview-bar"><i></i><i></i><i></i><span>localhost:5173</span></div><iframe title="Page preview" data-r="frame" sandbox="allow-scripts"></iframe></div>`;
  if (layout === 'pane') {
    return `${chatCol('chat')}
      <section class="col col-work" aria-label="Work">
        ${preview}
        <div class="scroller work-scroller" data-scroll="work"><div class="stream" data-stream="work"></div></div>
        <button class="jump" data-act="jump" data-for="work" hidden>Jump to latest</button>
      </section>`;
  }
  return `${chatCol('stream')}<section class="col col-preview" aria-label="Page preview">${preview}</section>`;
}

// ---------- blocks ----------

function blockShell(b) {
  const time = `<time class="bt">${fmtClock(b.t)}</time>`;
  if (b.type === 'request') return `<div class="block b-request" data-block="${b.id}" data-turn="${b.turn}"><div class="bubble" data-text></div>${time}</div>`;
  if (b.type === 'message') return `<div class="block b-message" data-block="${b.id}" data-turn="${b.turn}"><div class="prose" data-text></div>${time}</div>`;
  if (b.type === 'thinking') return `<div class="block b-thinking" data-block="${b.id}" data-turn="${b.turn}"><div class="b-label">Thinking</div><div class="prose" data-text></div>${time}</div>`;
  return `<div class="block b-tool" data-block="${b.id}" data-turn="${b.turn}"><div class="call" data-call></div><pre class="out" data-out></pre>${time}</div>`;
}

const tintable = () => S.variants.code === 'tint' || S.variants.errors === 'tint';
function outputHTML(text) {
  return text.split('\n').map(l => {
    let c = '';
    if (S.variants.code === 'tint' && /^\+(\s|$)/.test(l)) c = 'ln-add';
    else if (S.variants.code === 'tint' && /^-(\s|$)/.test(l)) c = 'ln-del';
    if (S.variants.errors === 'tint' && /\berror\b|failed|^x /i.test(l)) c = 'ln-err';
    return c ? `<span class="${c}">${esc(l)}</span>` : esc(l);
  }).join('\n');
}

function fillBlock(el, b) {
  const sig = `${b.text || ''}|${b.call || ''}|${b.output || ''}|${S.variants.code}|${S.variants.errors}`;
  if (shown.get(b.id) === sig) return false;
  shown.set(b.id, sig);
  if (b.type === 'tool') {
    el.querySelector('[data-call]').textContent = b.call;
    const out = el.querySelector('[data-out]');
    if (tintable()) out.innerHTML = outputHTML(b.output || '');
    else out.textContent = b.output || '';
    out.hidden = !b.output;
  } else {
    el.querySelector('[data-text]').textContent = b.text;
  }
  return true;
}

// Group blocks into units for display, per the grouping variant.
function units(list, streamName) {
  const g = S.variants.grouping;
  const out = [];
  for (const b of list) {
    const last = out[out.length - 1];
    const isWork = b.type === 'thinking' || b.type === 'tool';
    if (g === 'tools' && b.type === 'tool' && last && last.kind === 'group' && last.of === 'tools') { last.items.push(b); continue; }
    if (g === 'tools' && b.type === 'tool') { out.push({ kind: 'group', of: 'tools', items: [b] }); continue; }
    if (g === 'turns' && isWork && last && last.kind === 'group' && last.of === 'turn' && last.turn === b.turn) { last.items.push(b); continue; }
    if (g === 'turns' && isWork) { out.push({ kind: 'group', of: 'turn', turn: b.turn, items: [b] }); continue; }
    out.push({ kind: 'one', b });
  }
  // A group of one tool call is just the block.
  return out.map(u => (u.kind === 'group' && u.of === 'tools' && u.items.length === 1 ? { kind: 'one', b: u.items[0] } : u));
}

function streamHTML(list, streamName) {
  const dividers = S.layout === 'pane' && S.variants.link === 'dividers';
  let prevTurn = null;
  return units(list, streamName).map(u => {
    const first = u.kind === 'one' ? u.b : u.items[0];
    const div = dividers && prevTurn !== null && first.turn !== prevTurn ? '<hr class="turn-divider" />' : '';
    prevTurn = (u.kind === 'one' ? u.b : u.items[u.items.length - 1]).turn;
    if (u.kind === 'one') return div + blockShell(u.b);
    return div + `<div class="group group-${u.of}">${u.items.map(blockShell).join('')}</div>`;
  }).join('');
}

// ---------- render ----------

function render() {
  if (!S) return;
  if (!$app.querySelector('header.top')) shell();
  const root = document.documentElement;
  root.dataset.layout = S.layout;
  for (const [k, v] of Object.entries(S.variants)) root.dataset[k] = v;

  const r = n => $app.querySelector(`[data-r="${n}"]`);
  r('view').textContent = `View ${S.view}`;
  r('title').textContent = S.task.title;
  const pop = r('briefpop');
  pop.textContent = S.task.brief;
  pop.hidden = !briefOpen;
  r('timer').textContent = S.timer.show ? `${fmtClock(S.timer.left)} left` : '';
  r('timer').hidden = !S.timer.show;
  const acc = $app.querySelector('.accept');
  acc.classList.toggle('is-pressed', !!S.accepted);
  acc.setAttribute('aria-pressed', String(!!S.accepted));

  // Layout skeleton changes only when the layout option changes.
  const layoutEl = r('layout');
  if (layoutEl.dataset.layout !== S.layout) {
    layoutEl.dataset.layout = S.layout;
    layoutEl.innerHTML = layoutHTML(S.layout);
    structureSig = '';
    shown = new Map();
    lastPreviewId = null;
    bindScroll();
  }

  // Streams
  const isChat = b => b.type === 'request' || b.type === 'message';
  const streams = S.layout === 'pane'
    ? { chat: S.blocks.filter(isChat), work: S.blocks.filter(b => !isChat(b)) }
    : { stream: S.blocks };
  const before = {};
  for (const name of Object.keys(streams)) {
    const sc = $app.querySelector(`[data-scroll="${name}"]`);
    before[name] = sc ? sc.scrollHeight : 0;
  }
  const sig = JSON.stringify([S.layout, S.variants.grouping, S.variants.link, Object.entries(streams).map(([k, l]) => [k, l.map(b => b.id + ':' + b.turn)])]);
  if (sig !== structureSig) {
    structureSig = sig;
    shown = new Map();
    for (const [name, list] of Object.entries(streams)) {
      $app.querySelector(`[data-stream="${name}"]`).innerHTML = list.length || name !== (S.layout === 'pane' ? 'chat' : 'stream')
        ? streamHTML(list, name)
        : `<p class="empty-brief">${esc(S.task.brief)}</p>`;
    }
  }
  let grew = {};
  for (const [name, list] of Object.entries(streams)) {
    const host = $app.querySelector(`[data-stream="${name}"]`);
    for (const b of list) {
      const el = host.querySelector(`[data-block="${b.id}"]`);
      if (el && fillBlock(el, b)) grew[name] = true;
    }
  }

  // Working indicator: one shared line, identical in every view.
  const w = r('working');
  if (w) w.hidden = !(S.working && S.variants.working === 'line');

  // Scrolling: follow unless the reader scrolled up (or always follow, per variant).
  for (const name of Object.keys(streams)) {
    const sc = $app.querySelector(`[data-scroll="${name}"]`);
    const jump = $app.querySelector(`[data-act="jump"][data-for="${name}"]`);
    const changed = grew[name] || sc.scrollHeight !== before[name];
    if (S.variants.scroll === 'always' || pinnedBottom[name]) {
      sc.scrollTop = sc.scrollHeight;
      if (jump) jump.hidden = true;
    } else if (changed && jump) jump.hidden = false;
  }

  // Preview: same size and position in every view; updates when the agent's page changes.
  const frame = r('frame');
  if (frame && S.preview && S.preview.id !== lastPreviewId) {
    lastPreviewId = S.preview.id;
    frame.srcdoc = S.preview.html;
  }
}

function bindScroll() {
  $app.querySelectorAll('[data-scroll]').forEach(sc => {
    const name = sc.dataset.scroll;
    pinnedBottom[name] = true;
    sc.addEventListener('scroll', () => {
      const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 40;
      pinnedBottom[name] = atBottom;
      if (atBottom) { const j = $app.querySelector(`[data-act="jump"][data-for="${name}"]`); if (j) j.hidden = true; }
      if (!MIRROR) send({ kind: 'scroll', stream: name, atBottom });
    });
  });
}

// ---------- input ----------

$app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'FORM') return;
  const act = b.dataset.act;
  if (act === 'brief') {
    briefOpen = !briefOpen;
    b.setAttribute('aria-expanded', String(briefOpen));
    render();
  } else if (act === 'accept') {
    send({ kind: 'accept' });
  } else if (act === 'jump') {
    const sc = $app.querySelector(`[data-scroll="${b.dataset.for}"]`);
    sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    pinnedBottom[b.dataset.for] = true;
    b.hidden = true;
  }
});

$app.addEventListener('submit', e => {
  e.preventDefault();
  const ta = e.target.querySelector('textarea');
  const text = ta.value.trim();
  if (!text) return;
  send({ kind: 'request', text });
  ta.value = '';
  pinnedBottom.stream = pinnedBottom.chat = true;
});
$app.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});

// Chat-to-work link (pane layout, "hover" variant): hovering a message highlights the work after it.
$app.addEventListener('mouseover', e => {
  if (!S || S.layout !== 'pane' || S.variants.link !== 'hover') return;
  const m = e.target.closest('.col-chat .block');
  $app.querySelectorAll('.col-work .is-linked').forEach(x => x.classList.remove('is-linked'));
  if (m) $app.querySelectorAll(`.col-work [data-turn="${m.dataset.turn}"]`).forEach(x => x.classList.add('is-linked'));
});

// Report which blocks are on screen, so time-on-screen can be logged per block id.
const io = new IntersectionObserver(entries => {
  const changes = entries.map(en => ({ id: en.target.dataset.block, on: en.isIntersecting }));
  if (changes.length && !MIRROR) send({ kind: 'seen', changes });
}, { threshold: 0.5 });
new MutationObserver(muts => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.matches('[data-block]')) io.observe(n);
    n.querySelectorAll('[data-block]').forEach(el => io.observe(el));
  }
}).observe($app, { childList: true, subtree: true });

document.addEventListener('pointerdown', e => {
  if (briefOpen && !e.target.closest('.brief')) { briefOpen = false; render(); }
});

// Until the console connects, show only the shell.
setTimeout(() => {
  if (!S) $app.innerHTML = `<div class="waiting">Waiting for the session to start.</div>`;
}, 800);
