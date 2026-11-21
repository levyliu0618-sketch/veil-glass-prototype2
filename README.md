# Agent Veil — study task screen (two layout options)

- **Participant screen:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/
- **Moderator console:** https://levyliu0618-sketch.github.io/veil-glass-prototype2/console.html

Built from Saoumya's handover *Agent Veil UI Handover: Two Layout Options* (20 Nov 2026, Megadoc → "IA and content"). Information architecture and content follow that document; visual design is Levy's.

The earlier Glass Sheet concept (frosted veil over the terminal, six views) is kept on the branch [`glass-sheet-concept-archive`](https://github.com/levyliu0618-sketch/veil-glass-prototype2/tree/glass-sheet-concept-archive). It started as a fork of [Saoumya's Veil Glass prototype](https://github.com/saoumyamandy/veil-glass-prototype).

## How to try it

1. Open the **moderator console**. It has a small mirror of the participant screen, so one window is enough for a team demo.
2. For a real setup, press **Open participant screen** and put that window on the shared screen. The two windows talk over a `BroadcastChannel` on the same machine (no server), so open both in the same browser.
3. Press **Start practice task**, then switch **Layout option** (in-stream / pane) and **View** (A–D) while it runs.

| View | Thinking | Tool calls |
| --- | --- | --- |
| A | hidden | hidden |
| B | shown | hidden |
| C | hidden | shown |
| D | shown | shown |

## What it does

- **Two layouts, one shell.** Option 1 puts everything in one stream beside the preview; option 2 keeps chat on the left and a work pane (preview on top, thinking and tool calls under it) on the right. Column widths, fonts and preview size never change with the view.
- **Shared shell:** view label, one-line task brief (full brief on click), 12:00 timer, "I'd accept this", request box, chat, preview.
- **Four block types:** request, message, thinking, tool call. Each block has a stable `data-block` id, and the participant screen reports which blocks are on screen so time-on-screen can be logged.
- **Hidden means absent.** The console filters the replay before sending it, so in Views A–C the hidden blocks are not in the participant page, its code or its messages.
- **Moderator console:** layout switch, View A–D, replay (start, pause, stop, restart, jump, speed), session setup (participant code, think-aloud/silent, timer visible or not), live status (view, time left, accept time, what is on screen, activity), and every panel variant from the handover, switchable on the same replay. Each variant's first option is the handover's "Start with".
- **Content:** a scripted practice run (spinning cube that changes colour on click), stored as timed events (`js/content/practice-cube.js`). It includes the four hard cases: a long thinking block, 100+ lines of install log, ten tool calls in a row, and a failed build with an error trace. Swap in real recordings in the same format.

Not built yet (session phase): timestamped notes, session log export, live agent runs, loading the view from a participant's schedule.

## Files

```
index.html               participant screen (holds no task content)
console.html             moderator console
js/participant.js        renders state from the console
js/console.js            replay clock, view filtering, controls, variants
js/protocol.js           BroadcastChannel helper
js/content/              scripted replay + the pages the agent builds
css/                     participant and console styles
```

Plain HTML, CSS and JS modules. Serve the folder (`python3 -m http.server 8000`) rather than opening `file://`.
