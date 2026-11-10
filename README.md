# Veil — Glass sheet (Levy's revision)

**Live:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/
**Why these changes:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/#why

A fork of [Saoumya's Veil Glass prototype](https://github.com/saoumyamandy/veil-glass-prototype), for the Agent Veil group (UC Berkeley HCI). The simulated run, the Lumen app and the agent's behaviour are hers and unchanged. This revision changes how the veil is organised and how it reads. It is a proposal for discussion, not a team decision.

A simulated coding agent adds a pricing page to Lumen, a made-up app. Its raw terminal runs under a frosted glass sheet; the page it builds updates on the right.

## What changed in this revision

- **Look.** One quiet, slightly warm ground for the whole app (a wide, soft greige wash, no edges between areas). The terminal is written on that ground; the veil is a thin warm frosted sheet over it, so the work underneath shows as a faint texture. Everything you read is a warm-white block. Colour only marks state. Type: Outfit for display, Inter for text, JetBrains Mono for code.
- **What vs. where.** Six views (Result → Everything) are the main control, with dots for the layers each lets through. Glass placement (cover, pin left, fold away) is small and secondary.
- **Phases.** The feed is grouped by what the agent is doing. A folded phase shows a written summary and what is inside; a phase with a failed check says whether it was fixed and re-checked. Reading older work isn't interrupted by new activity.
- **Requirements** next to the task: what the page should do, including the yearly price rule, marked "from the brief" or "proposed for this demo".
- **Rules for reduced views.** Moving the veil never uncovers the raw work (a frost stays, with a logged "Show the raw work"). Claims follow the commentary; check details follow the actions; one Layers switch turns verification on in every view. Questions always show.
- **Checks and versions.** "Finished" and "N of M claims checked" are separate. Every check says which page version it ran on, and looking back at an old version says the checks ran on a later one.
- **Lens removed**, following the team's decision to continue with the glass sheet.

## What you can try

Start the agent, switch views, open a phase, ask **Why?**, say **Not that**, answer the agent's question, open **Claims vs checks**, preview on **Phone** and **Ask it to check** the mobile claim, step through page versions in **Everything**.

## Running it locally

Plain HTML, CSS and JavaScript modules; serve it rather than opening `file://`:

```bash
python3 -m http.server 8000
```

All data is made up. No model is called and nothing you do is recorded or sent.
