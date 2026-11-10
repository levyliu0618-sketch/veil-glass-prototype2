// "Why these changes": a short page of the design changes in this revision, the
// question each one answers, and what supports it. Static content.

const S = {
  shn: { label: 'Shneiderman 1996', url: 'https://drum.lib.umd.edu/items/cd983adb-568a-47d3-b43a-1d8d8b8c72f4/full', kind: 'Design principle' },
  nng: { label: 'NN/g: Progressive disclosure', url: 'https://www.nngroup.com/videos/progressive-disclosure/', kind: 'Design guideline' },
  hig: { label: 'Apple HIG: Materials', url: 'https://developer.apple.com/design/human-interface-guidelines/materials', kind: 'Product precedent' },
  r1: { label: 'R1 · CUA design space (IUI 2026)', url: 'https://arxiv.org/abs/2602.07283', kind: 'Empirical study' },
  r2: { label: 'R2 · Explaining too much?', url: 'https://arxiv.org/abs/2605.25856', kind: 'Empirical study' },
  r3: { label: 'R3 · Questioning the AI (CHI 2020)', url: 'https://arxiv.org/abs/2001.02478', kind: 'Interview study' },
  r4: { label: 'R4 · AI Chains (CHI 2022)', url: 'https://arxiv.org/abs/2110.01691', kind: 'Empirical study' },
  r5: { label: 'R5 · Multi-agent sensemaking (CHI 2026)', url: 'https://doi.org/10.1145/3772318.3791157', kind: 'Empirical study' },
  r7: { label: 'R7 · Revealing AI reasoning (N = 752)', url: 'https://arxiv.org/abs/2511.04050', kind: 'Empirical study' },
  pg: { label: 'Agent Veil playground', url: 'https://agent-veil-pink.vercel.app/playground', kind: 'Team prototype' },
};

const link = k => `<a href="${S[k].url}" target="_blank" rel="noreferrer">${S[k].label}</a>`;

const QUESTIONS = [
  {
    q: 'How do people find what matters quickly?',
    ui: 'Phases with a one-line recap, one clear type scale, solid cards on the glass',
    rows: [
      {
        change: 'The feed is grouped into phases (each status line starts one). Earlier phases fold to a header and the agent’s last line in that phase; the current phase stays open.',
        src: ['shn', 'r1'],
        says: 'Shneiderman’s mantra: overview first, zoom and filter, then details on demand. R1 (20-person Wizard-of-Oz study of computer-use agents): people want progress and detail at different moments, and their needs differ by person and situation.',
        open: 'Whether the phases match how people think about the task. R1 studied computer-use agents, not coding agents.',
      },
      {
        change: 'Cards on the glass are solid and use one type scale. Labels like SAID / DID are gone or softened; the tool name is shown in code type.',
        src: ['hig'],
        says: 'Apple’s guidance: thicker, more opaque materials give better contrast for text; thinner, translucent ones remind people of the content behind. Use the more opaque variant when a component holds a lot of text.',
        open: 'A product guideline, not a study of agent interfaces. Our assumption: legibility of the cards matters more than how glassy they look.',
      },
    ],
  },
  {
    q: 'When should details open?',
    ui: 'Six view modes, folding phases, “Why?” on a card, raw output only when asked',
    rows: [
      {
        change: 'The frosted→clear slider is now six separate view buttons. Dots under each show which layers it lets through, so “Thinking” reads as a different mix, not “Actions plus a bit”. Glass placement (cover, pin, fold) moved to small icons; per-layer controls stay in the Layers panel.',
        src: ['pg', 'nng'],
        says: 'The playground defines rung 5 as commentary plus thinking without tool calls: a swap, not a step up. NN/g: keep the primary choices visible and defer secondary options, so people stay focused on the main decision.',
        open: 'Whether six modes are too many for a first-time participant. Which controls participants may use is a study-design decision (Sam, Saoumya).',
      },
      {
        change: 'Thinking stays behind “Why?” on the card it explains, instead of a separate stream.',
        src: ['r3', 'r2'],
        says: 'R3 organises explanation needs as questions people ask (“Why…?”). R2 (N = 559): summaries raised trust and appeal without improving accuracy; full traces from one open-weight model lowered accuracy.',
        open: 'Neither paper tested on-demand reasoning in a coding-agent feed.',
      },
      {
        change: 'If you scroll up to read older work, new activity no longer pulls you down. A “New activity ↓” button appears instead. A question for you still scrolls into view.',
        src: [],
        says: 'Our design choice, needed once a live backend streams events.',
        open: 'Untested.',
      },
    ],
  },
  {
    q: 'How do we stop “looks transparent” from reading as “is correct”?',
    ui: 'Finished vs. verified in the header; claims vs. checks with three states',
    rows: [
      {
        change: 'The header says “The agent has finished” separately from “2 of 3 claims checked”. Claims use three states: Checked · passed, Checked · failed, Not checked.',
        src: ['r7', 'r5'],
        says: 'R7 (N = 752): showing AI reasoning, brief or long, raised agreement with the AI and crowded out people’s own knowledge. R5 (12-person qualitative study): individual agents could be wrong even when the final answer was right.',
        open: 'Whether separating “finished” from “verified” changes how carefully people check. Our hypothesis to test.',
      },
      {
        change: 'Claims vs checks is folded into one summary line under the page (“3 claims · 2 passed · 1 not checked”) and opens on click. The questions the agent asks you always show, in every view.',
        src: ['r4'],
        says: 'R4 (20-person study): making intermediate steps visible and editable improved perceived transparency and control. Its system also let people edit, so the benefit isn’t from visibility alone.',
        open: 'Whether a one-line summary is noticed enough when a check is missing.',
      },
    ],
  },
];

const CHANGES = [
  ['Layout', 'Light, neutral workspace. The page preview gets most of the right column. Model, effort, tokens and cost are one quiet line (whether they belong in the study is a team decision).'],
  ['The veil', 'The glass says “there is more underneath”. The cards on it say clearly what the current view lets through. Choosing to see less shows less, not blurrier text.'],
  ['Controls', 'What the veil shows (six views) is the main control. Where the glass sits (cover, pin, fold) is a small, secondary one.'],
  ['Process', 'Grouped into phases with a one-line recap. Hover a card and its raw lines still light up under the glass.'],
  ['Checks', 'Finished and verified are shown separately. Questions for you are never hidden.'],
  ['Removed', 'The Lens version, following the team’s decision to continue with the glass sheet.'],
];

export function mountWhy(root) {
  root.innerHTML = `<main class="why-page">
    <h1>Why these changes</h1>
    <p class="lead">A revision of Saoumya’s Glass Sheet prototype by Levy, for group discussion. The run, the Lumen app and the agent behaviour are hers and unchanged. This revision changes how the veil is organised and how it reads. It is a proposal, not a team decision.</p>

    <section>
      <h2>What changed</h2>
      <dl class="changes-list">${CHANGES.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </section>

    ${QUESTIONS.map(
      (g, i) => `<section>
        <h2><span class="qn">${i + 1}</span>${g.q}</h2>
        <p class="ui-line">In the interface: ${g.ui}</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Design choice</th><th>Supported by</th><th>What the source found or says</th><th>Still our assumption</th></tr></thead>
          <tbody>${g.rows
            .map(r => `<tr><td>${r.change}</td><td>${r.src.length ? r.src.map(k => `${link(k)}<small>${S[k].kind}</small>`).join('<br>') : '<span class="muted">Our choice</span>'}</td><td>${r.says}</td><td>${r.open}</td></tr>`)
            .join('')}</tbody>
        </table></div>
      </section>`,
    ).join('')}

    <section>
      <h2>Open questions for the team</h2>
      <ul>
        <li><b>Shobhit:</b> which events, statuses and check records can the backend send live? Phases need status events; the claims panel needs a link from each claim to the check behind it.</li>
        <li><b>Sam and Saoumya:</b> which controls may participants use in the study: fixed views, free adjustment, “Not that”, asking for a check?</li>
        <li><b>Everyone:</b> do model, effort and price labels belong in the study? Should the final task stay a pricing page, with one or two planted errors that are visible to a non-engineer?</li>
      </ul>
      <p class="muted small">All data is made up. No model is called. Nothing you click is recorded or sent anywhere. Sources were checked on 9 November 2026; R1–R7 abstracts were read on 27 October 2026.</p>
    </section>
    <p><a href="#sheet">← Back to the prototype</a></p>
  </main>`;
  return { render() {}, tick() {}, unmount() {} };
}
