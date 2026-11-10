# Veil — Glass sheet (Levy's revision)

**Live:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/
**Why these changes:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/#why

A fork of [Saoumya's Veil Glass prototype](https://github.com/saoumyamandy/veil-glass-prototype), for the Agent Veil group (UC Berkeley HCI). The simulated run, the Lumen app and the agent's behaviour are hers and unchanged. This revision changes how the veil is organised and how it reads. It is a proposal for discussion, not a team decision.

A simulated coding agent adds a pricing page to Lumen, a made-up app. Its raw terminal runs under a frosted glass sheet; the page it builds updates on the right.

## What changed in this revision

- **One light, neutral workspace.** The glass is the only translucent surface. It signals "there is more underneath"; the cards on it are solid so they read clearly in every view.
- **What vs. where.** The six views (Result → Everything) are the main control, shown as separate modes with dots for the layers each lets through: rung 5 swaps actions for thinking rather than adding to rung 4. Glass placement (cover, pin left, fold away) is a small, secondary icon group.
- **Phases.** The feed is grouped by what the agent is doing. Earlier phases fold to a header, the agent's last line and what's inside; the current phase stays open. Reading older work no longer gets interrupted by new activity ("New activity ↓").
- **More room for the page.** Run info is one quiet line. Claims vs. checks, change log and layers fold into one bar with a summary and open on click.
- **Finished ≠ verified.** The header shows "The agent has finished" separately from "2 of 3 claims checked". Questions for you always show, in every view.
- **Lens removed**, following the team's decision to continue with the glass sheet.

## What you can try

Start the agent, switch views, open a phase, ask **Why?**, say **Not that**, answer the agent's question, open **Claims vs checks**, preview on **Phone** and **Ask it to check** the mobile claim, step through page versions in **Everything**.

## Running it locally

Plain HTML, CSS and JavaScript modules; serve it rather than opening `file://`:

```bash
python3 -m http.server 8000
```

All data is made up. No model is called and nothing you do is recorded or sent.
