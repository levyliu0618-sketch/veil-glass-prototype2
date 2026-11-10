import {
  RUNGS, LAYERS, esc, fmt, clarity, visible, claimsVisible, syncList, cardHTML, cardSig, mountTerminal, mountPreview, receiptHTML, updateDock, briefHTML,
} from './shared.js';

// Where the sheet sits: over the raw work, docked as a column on the left, or folded to a strip.
// These are secondary to WHAT the veil shows, so they are small icon buttons in the sheet's corner.
const MODES = [
  {
    id: 'cover', label: 'Cover the work', title: 'Lay the veil over the work',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><rect x="3.5" y="4.5" width="9" height="7" rx="1" class="fillish"/></svg>',
  },
  {
    id: 'pinned', label: 'Pin to the left', title: 'Pin the veil to the left so the raw work shows beside it',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><rect x="2.5" y="3.5" width="5" height="9" rx="1" class="fillish"/></svg>',
  },
  {
    id: 'collapsed', label: 'Fold away', title: 'Fold the veil into a strip on the left',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.5 4 4.5 8l4 4M12.5 4l-4 4 4 4"/></svg>',
  },
];
const EXPAND_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.5 4l4 4-4 4M3.5 4l4 4-4 4"/></svg>';
const CHEVRON = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.5 8 9.5l3-3"/></svg>';

// Short names for the six layers, in the order the mode dots are drawn.
const DOT_NAMES = ['Status and commentary', 'Thinking', 'Actions', 'Raw output', 'Helpers', 'Page versions'];

function dotsHTML(set) {
  return `<span class="mdots" aria-hidden="true">${LAYERS.map((l, i) => {
    const v = set[l.key];
    const max = l.stops.length - 1;
    const cls = v === 0 ? '' : v === max ? ' full' : ' part';
    return `<i class="${cls}" title="${DOT_NAMES[i]}"></i>`;
  }).join('')}</span>`;
}

// What a view includes, in plain words, for the line under the mode buttons.
function includesText(L) {
  const out = [];
  if (L.verbosity >= 1) out.push(L.verbosity >= 2 ? 'status and commentary' : 'status lines');
  if (L.thinking) out.push('its thinking');
  if (L.summary) out.push('each action');
  if (L.full) out.push('the raw output');
  if (L.subagents) out.push(L.subagents === 2 ? 'helpers in full' : 'helpers');
  if (L.versions === 2) out.push('every page version');
  if (!out.length) return 'Only the finished page and any question for you.';
  return `Shows ${out.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Questions for you always show.`;
}

// Version 1, revised: a frosted sheet lies over the agent's raw terminal. The glass says
// "there is more underneath"; the cards on it say clearly what the current view lets through.
export function mountSheet(root, ctx) {
  const E = ctx.engine;
  root.innerHTML = `<main class="sheet-view">
    <section class="agent-pane" aria-label="The agent's work">
      <div class="terminal" aria-hidden="true"></div>
      <div class="glass-sheet">
        <div class="sheet-head">
          <span class="now-dot"></span>
          <div class="now"><b></b><span class="verify-state"></span></div>
          <span class="clock"></span>
          <div class="sheet-modes" role="group" aria-label="Where the veil sits"></div>
        </div>
        <div class="feed-wrap">
          <div class="feed" aria-live="polite"></div>
          <button class="new-pill" data-act="feed-latest" hidden>New activity ↓</button>
        </div>
        <div class="dial"></div>
        <div class="sheet-rail">
          <button class="rail-btn" data-act="sheet-mode" aria-label="Open the veil" title="Open the veil">${EXPAND_ICON}</button>
          <div class="rail-pill"><span class="now-dot"></span><span class="rail-label"></span><span class="rail-clock"></span></div>
          <button class="rail-btn rail-q" data-act="sheet-mode" aria-label="The agent is asking you something. Open the veil." title="The agent is asking you something" hidden>?</button>
        </div>
      </div>
      <div class="sheet-float"></div>
      <div class="raw-veil" hidden>
        <div class="raw-veil-note">
          <b>The raw work is hidden in this view</b>
          <span>Moving the veil doesn't uncover it. Showing it is a choice, and it's logged.</span>
          <button class="chip-btn" data-act="layer" data-key="full" data-val="1">Show the raw work</button>
        </div>
      </div>
    </section>
    <aside class="side">
      <div class="preview-host"></div>
      <div class="receipt-host"></div>
      <div class="dock"></div>
    </aside>
  </main>`;

  const $ = s => root.querySelector(s);
  const view = $('.sheet-view');
  const sheet = $('.glass-sheet');
  const feed = $('.feed');
  const pill = $('.new-pill');
  const term = mountTerminal($('.terminal'), ctx);
  const preview = mountPreview($('.preview-host'), ctx);
  let lastAsked = null;
  let lastMode = null;
  let lastCount = 0;

  // Hovering a card lights its raw lines under the glass.
  feed.addEventListener('mouseover', e => {
    const card = e.target.closest('[data-evt]');
    const id = card ? card.dataset.evt : null;
    if (id !== ctx.ui.lit) {
      ctx.ui.lit = id;
      term.light(id);
    }
  });
  feed.addEventListener('mouseleave', () => {
    ctx.ui.lit = null;
    term.light(null);
  });
  const nearBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  feed.addEventListener('scroll', () => { if (nearBottom()) pill.hidden = true; });

  function nowText() {
    const L = ctx.layers.v;
    if (!E.started) return 'Waiting for the brief';
    if (E.waiting) return 'Waiting for your answer';
    if (E.done) return 'The agent has finished';
    if (L.verbosity >= 1 && E.status) return E.status;
    return 'Working behind the veil';
  }

  // "Finished" and "verified" are different things, so they are shown separately.
  function verifyText() {
    if (!claimsVisible(ctx.layers.v)) return '';
    const claims = [...E.claims.values()];
    if (!claims.length) return E.done ? 'It made no claims to check' : '';
    const states = claims.map(c => E.claimStatus(c).state);
    const ok = states.filter(s => s === 'checked' || s === 'fixed').length;
    const failed = states.filter(s => s === 'failed').length;
    const parts = [`${ok} of ${claims.length} claims checked`];
    if (failed) parts.push(`${failed} failed`);
    return parts.join(' · ');
  }

  function renderHead() {
    const live = E.started && !E.done && E.playing;
    for (const el of [$('.sheet-head'), $('.rail-pill')]) {
      el.classList.toggle('is-live', live);
      el.classList.toggle('is-waiting', !!E.waiting);
      el.classList.toggle('is-done', !!E.done);
    }
    $('.sheet-head b').textContent = nowText();
    const vt = verifyText();
    const vs = $('.verify-state');
    vs.textContent = vt;
    vs.hidden = !vt;
    const claims = [...E.claims.values()];
    const allOk = vt && claims.length > 0 && claims.every(c => ['checked', 'fixed'].includes(E.claimStatus(c).state));
    vs.className = `verify-state ${allOk ? 'ok' : vt && claims.length ? 'warn' : ''}`;
    $('.sheet-head .clock').textContent = fmt(E.clock);
    $('.rail-clock').textContent = fmt(E.clock);
  }

  function renderMode() {
    const mode = ctx.ui.sheetMode || 'cover';
    view.dataset.mode = mode;
    const r = RUNGS.find(x => x.n === ctx.layers.rung());
    $('.rail-label').textContent = `Veil · ${r ? r.short : 'Custom'}`;
    $('.rail-q').hidden = !E.waiting;
    $('.sheet-float').innerHTML = mode === 'collapsed' && E.waiting ? cardHTML(E.waiting, ctx) : '';
    if (mode === lastMode) return;
    lastMode = mode;
    $('.sheet-modes').innerHTML = MODES.map(
      m => `<button class="icon-btn${m.id === mode ? ' on' : ''}" data-act="sheet-mode" data-mode="${m.id}" aria-pressed="${m.id === mode}" aria-label="${m.label}" title="${m.title}">${m.icon}</button>`,
    ).join('');
    root.querySelectorAll('.rail-btn').forEach(b => (b.dataset.mode = ctx.ui.sheetLast || 'cover'));
  }

  // The six rungs are different views, not points on a frosted-to-clear scale:
  // rung 5 swaps actions for thinking. Each button shows which layers it lets through.
  function renderDial() {
    const cur = ctx.layers.rung();
    const L = ctx.layers.v;
    $('.dial').innerHTML = `<div class="dial-top">
        <span class="dial-k">View</span>
        <span class="dial-name">${cur ? esc(RUNGS[cur - 1].name) : 'Custom'}</span>
        <button class="link-btn" data-act="tab" data-tab="layers" data-keep="1">Adjust layers</button>
      </div>
      <div class="modes" role="radiogroup" aria-label="What the veil shows">
        ${RUNGS.map(x => `<button role="radio" aria-checked="${x.n === cur}" class="mode${x.n === cur ? ' on' : ''}" data-act="rung" data-n="${x.n}" title="${esc(x.hint)}">
          <span class="mname">${esc(x.short)}</span>${dotsHTML(x.set)}</button>`).join('')}
      </div>
      <p class="dial-hint">${esc(includesText(L))}</p>`;
  }

  // Group the feed into phases: each status line starts one. Earlier phases fold to a
  // header and the agent's last line in it; the current phase stays open.
  function feedItems() {
    const L = ctx.layers.v;
    const evs = E.log.filter(ev => visible(ev, L));
    const phases = [];
    let cur = null;
    for (const ev of evs) {
      if (ev.type === 'status') {
        cur = { head: ev, items: [] };
        phases.push(cur);
      } else if (cur) cur.items.push(ev);
      else phases.push({ head: null, items: [ev] });
    }
    const heads = phases.filter(p => p.head);
    const lastHead = heads[heads.length - 1];
    // While running, the current phase is open. Once done, the last phase with work in it is.
    const openByDefault = E.done ? [...heads].reverse().find(p => p.items.length) : lastHead;
    const out = [];
    for (const p of phases) {
      if (!p.head) {
        p.items.forEach(ev => out.push({ key: ev.id, sig: cardSig(ev, ctx), html: cardHTML(ev, ctx) }));
        continue;
      }
      const id = p.head.id;
      // A question waiting for an answer is never folded away.
      const mustOpen = p.items.some(ev => ev === E.waiting);
      const userSet = ctx.ui.phaseOpen.get(id);
      const open = mustOpen || (userSet !== undefined ? userSet : p === openByDefault);
      // A phase that had a failed check keeps saying so, and also says if it was fixed.
      const failedHere = p.items.filter(ev => ev.type === 'tool' && ev.check && ev.ok === false && !E.isRunning(ev));
      const fixes = E.failedChecks();
      const unfixed = failedHere.filter(f => !fixes.find(x => x.f === f)?.passedBy).length;
      const fail = failedHere.length
        ? unfixed
          ? { tone: 'bad', text: 'A check failed, not fixed yet' }
          : { tone: 'fixed', text: 'A check failed · fixed, re-check passed' }
        : null;
      // The recap is written for the phase as a whole, and is commentary, so it needs commentary on.
      const recapText = !open && L.verbosity >= 2 && p.head.recap ? p.head.recap : '';
      const n = p.items.length;
      // A folded phase still says what is inside it in this view, so changing the view shows.
      const count = t => p.items.filter(ev => ev.type === t).length;
      const meta = open ? '' : [
        [count('tool'), 'action'], [count('think'), 'thought'], [count('subagent'), 'helper'], [count('artifact'), 'page version'],
      ].filter(([k]) => k).map(([k, w]) => `${k} ${w}${k === 1 ? '' : 's'}`).join(' · ');
      const html = `<div class="phase-head${open ? ' is-open' : ''}${p === lastHead && !E.done ? ' is-current' : ''}" data-evt="${id}">
          <button class="phase-btn" data-act="phase" data-id="${id}" aria-expanded="${open}" ${n ? '' : 'disabled'}>
            ${n ? CHEVRON : '<span class="chev-sp"></span>'}<span class="phase-title">${esc(p.head.text)}</span>
            ${fail ? `<span class="phase-flag ${fail.tone}">${fail.text}</span>` : ''}
            <time>${fmt(p.head.at)}</time>
          </button>
          ${recapText ? `<p class="phase-recap">${esc(recapText)}</p>` : ''}
          ${meta ? `<p class="phase-meta">${meta}</p>` : ''}
        </div>`;
      out.push({ key: id, sig: [open, recapText, meta, fail && fail.text, p === lastHead, E.done, n > 0].join('|') + p.head.rev, html });
      if (open) p.items.forEach(ev => out.push({ key: ev.id, sig: cardSig(ev, ctx), html: `<div class="in-phase">${cardHTML(ev, ctx)}</div>` }));
    }
    return out;
  }

  function renderFeed() {
    if (!E.started) {
      syncList(feed, [{ key: 'brief', sig: 'b', html: briefHTML() }]);
      return;
    }
    const near = nearBottom();
    const items = feedItems();
    if (!items.length) {
      items.push({
        key: 'drawn',
        sig: String(E.done),
        html: `<div class="veil-note"><b>The veil is fully drawn.</b><span>${E.done ? 'The agent has finished. The page is on the right.' : 'The agent is working underneath. Choose a view below to see how.'}</span></div>`,
      });
    }
    syncList(feed, items);
    const asking = E.waiting && E.waiting.id;
    // Don't pull a reader back down while they read older work; offer a button instead.
    if (near || (asking && asking !== lastAsked)) {
      feed.scrollTop = feed.scrollHeight;
      pill.hidden = true;
    } else if (items.length > lastCount) pill.hidden = false;
    lastCount = items.length;
    lastAsked = asking;
  }

  function renderFrost() {
    // The glass still clears a little as the view lets more through, but the cards on it
    // are solid, so reading never depends on how frosted the glass is.
    const c = clarity(ctx.layers.v);
    sheet.style.setProperty('--frost', `${(24 - 10 * c).toFixed(1)}px`);
    sheet.style.setProperty('--tint', (0.6 - 0.12 * c).toFixed(3));
  }

  // Pinning or folding the veil uncovers the terminal. When the raw-work layer is off, a frost
  // stays over it, so the layout buttons never turn a reduced view into "see everything".
  function renderRawVeil() {
    const mode = ctx.ui.sheetMode || 'cover';
    $('.raw-veil').hidden = !(mode !== 'cover' && ctx.layers.v.full === 0);
  }

  function renderDockState() {
    $('.dock').classList.toggle('is-open', !!ctx.ui.dockOpen);
    view.classList.toggle('dock-open', !!ctx.ui.dockOpen);
  }

  function render() {
    renderMode();
    renderHead();
    renderDial();
    renderFeed();
    renderFrost();
    renderRawVeil();
    term.render();
    preview.update();
    $('.receipt-host').innerHTML = receiptHTML(E);
    renderDockState();
    updateDock($('.dock'), ctx);
  }

  function tick() {
    renderHead();
    $('.receipt-host').innerHTML = receiptHTML(E);
  }

  function toLatest() {
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    pill.hidden = true;
  }

  return { render, tick, toLatest, unmount() {} };
}
