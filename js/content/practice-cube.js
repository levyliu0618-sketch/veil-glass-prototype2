// SCRIPTED REPLAY for the practice task. Not a real agent run. It stands in until real
// recordings exist, and deliberately includes the four hard cases from the handover:
//   1. a thinking block several paragraphs long          (k1)
//   2. tool output of 100+ lines (an install log)        (c2)
//   3. eleven tool calls in a row with no message between (c3 … c12)
//   4. a failed command with an error trace              (c14)
// Format: a list of timed events. The display doesn't care whether it is a recording or live.
//   t    seconds from task start      dur  seconds it takes to stream in
//   type request | message | thinking | tool | preview

import { PAGES, SRC } from './cube-pages.js?v=20261122g';

const plus = src => src.split('\n').map(l => '+ ' + l).join('\n');
const minus = src => src.split('\n').map(l => '- ' + l).join('\n');
const lines = src => src.split('\n').length;
const count = (src, word) => src.split('\n').filter(l => l.includes(word)).length;

export const TASK = {
  title: 'Spinning 3D cube',
  brief: 'Ask the agent to build a web page with a 3D cube that spins on its own and changes colour each time you click it.',
  seconds: 12 * 60,
};

function installLog() {
  const pkgs = ['vite', 'esbuild', 'rollup', 'postcss', 'nanoid', 'picocolors', 'source-map-js', 'fsevents', '@esbuild/darwin-arm64',
    '@esbuild/linux-x64', '@rollup/rollup-darwin-arm64', '@rollup/rollup-linux-x64-gnu', '@types/estree', 'resolve', 'is-core-module',
    'path-parse', 'supports-preserve-symlinks-flag', 'hasown', 'function-bind'];
  const lines = ['', 'added 0 packages, and audited 1 package in 312ms', '', 'found 0 vulnerabilities',
    '> npm install', ''];
  let n = 0;
  for (let round = 0; round < 6; round++) {
    for (const p of pkgs) {
      n++;
      const v = `${(n % 5) + 1}.${(n * 7) % 13}.${(n * 3) % 10}`;
      lines.push(`npm http fetch GET 200 https://registry.npmjs.org/${p}/-/${p.split('/').pop()}-${v}.tgz ${40 + ((n * 37) % 400)}ms (cache miss)`);
    }
  }
  lines.push('npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.');
  lines.push('', 'added 11 packages, and audited 12 packages in 4s', '', '3 packages are looking for funding', '  run `npm fund` for details', '', 'found 0 vulnerabilities');
  return lines.join('\n');
}

export const EVENTS = [
  { id: 'r1', t: 0, type: 'request', text: 'Build a spinning 3D cube that changes colour when I click it.' },

  { id: 'm1', t: 2, dur: 3, type: 'message', text: "I'll build this as a small web page: a 3D cube with softly rounded edges that rotates continuously, and a click handler that cycles its colour. I'll set up a project first so we can preview it as we go." },

  { id: 'k1', t: 6, dur: 10, type: 'thinking', text:
`The user wants a cube that spins and changes colour on click. There are a few ways to do 3D in the browser. Three.js would make the geometry trivial, but it adds a dependency and the preview environment may not have network access for a CDN at runtime.

CSS 3D transforms could spin six flat faces, but they can't give rounded edges or a shadow that follows the shape, and the seams between faces show at the corners. A cube reads as a solid object mostly through its bevels and how light falls across them.

A small WebGL fragment shader can do this without a library: describe the cube as a signed distance function for a rounded box, ray-march it, and light it with one soft key light, a fill, ambient occlusion, and a soft shadow on a floor plane that fades into the background. It's about a hundred lines. I'll start it in a matte plaster white so the shape reads before any colour does.

For the colour change, the shader takes the colour as a uniform; a click listener checks that the click landed on the cube, steps through a small palette, and eases to the next colour instead of snapping.

I'll use Vite for a dev server so the preview reloads as files change. That means an npm install, which will be noisy but quick. Then: index.html with a canvas, style.css for the layout, cube.js for the renderer, main.js to start it.` },

  { id: 'c1', t: 17, dur: 1, type: 'tool', call: 'Bash(ls -la)', output:
`total 8
drwxr-xr-x  3 agent  staff   96 Nov 21 12:40 .
drwxr-xr-x  9 agent  staff  288 Nov 21 12:40 ..
-rw-r--r--  1 agent  staff   47 Nov 21 12:40 README.md` },

  { id: 'c2', t: 19, dur: 7, type: 'tool', call: 'Bash(npm init -y && npm install --save-dev vite)', output: installLog() },

  { id: 'm2', t: 27, dur: 2, type: 'message', text: 'Vite is installed. Now the page itself.' },

  // Ten tool calls in a row, no message between them.
  { id: 'c3', t: 30, dur: 1.2, type: 'tool', call: 'Write(index.html)', output: plus(SRC.index) },
  { id: 'c4', t: 32, dur: 1, type: 'tool', call: 'Write(style.css)', output: plus(SRC.style) },
  { id: 'c5', t: 33.5, dur: 2, type: 'tool', call: 'Write(cube.js)', output: plus(SRC.cubeStill) },
  { id: 'c5b', t: 35.6, dur: 0.6, type: 'tool', call: 'Write(main.js)', output: plus(SRC.mainStill) },
  { id: 'c6', t: 36.4, dur: 0.8, type: 'tool', call: 'Edit(package.json)', output:
`   "scripts": {
-    "test": "echo \\"Error: no test specified\\" && exit 1"
+    "dev": "vite",
+    "build": "vite build"
   },` },
  { id: 'c7', t: 37.5, dur: 1.5, type: 'tool', call: 'Bash(npm run dev -- --port 5173 &)', output:
`> cube@1.0.0 dev
> vite --port 5173

  VITE v5.4.11  ready in 214 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose` },
  { id: 'c8', t: 39.3, dur: 1, type: 'tool', call: 'Bash(curl -s localhost:5173 | head -5)', output: SRC.index.split('\n').slice(0, 5).join('\n') },
  { id: 'c9', t: 40.6, dur: 1, type: 'tool', call: 'Read(cube.js)', output: `${lines(SRC.cubeStill)} lines` },
  { id: 'c10', t: 42, dur: 1, type: 'tool', call: 'Bash(grep -c "uniform" cube.js)', output: String(count(SRC.cubeStill, 'uniform')) },
  { id: 'c11', t: 43.5, dur: 1.2, type: 'tool', call: 'Bash(npx --yes html-validate index.html)', output: '✔ No issues found' },
  { id: 'c12', t: 45.5, dur: 1.5, type: 'tool', call: 'Screenshot(http://localhost:5173)', output: 'Saved screenshot-1.png (1280×800)' },
  { id: 'p1', t: 47, type: 'preview', html: PAGES.static },

  { id: 'm3', t: 48, dur: 2.5, type: 'message', text: "The cube is on the page: rounded edges, matte plaster white, with a soft shadow on the floor. It isn't moving yet. Next I'll add the rotation and the click-to-change-colour behaviour." },

  { id: 'k2', t: 51.5, dur: 4, type: 'thinking', text:
`Spin: the angle is a constant right now. Make it a function of time in the render loop, one full turn about every eight seconds, so it keeps a steady pace whatever the frame rate.

Colour: put the palette in its own module so it's easy to change, import it from main.js, and only react to clicks that land on the cube itself, not the empty space around it.` },

  { id: 'c13', t: 56, dur: 1.2, type: 'tool', call: 'Edit(cube.js)', output: `- ${SRC.angleStill}\n+ ${SRC.angleSpin}` },
  { id: 'p2', t: 58, type: 'preview', html: PAGES.spinning },
  { id: 'c13b', t: 58.5, dur: 1.5, type: 'tool', call: 'Write(main.js)', output: minus(SRC.mainStill) + '\n' + plus(SRC.main) },

  // A failed command with an error trace.
  { id: 'c14', t: 61, dur: 2.5, type: 'tool', call: 'Bash(npm run build)', output:
`> cube@1.0.0 build
> vite build

vite v5.4.11 building for production...
✓ 2 modules transformed.
x Build failed in 41ms
error during build:
[vite]: Rollup failed to resolve import "./colors.js" from "/Users/agent/cube/main.js".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
\`build.rollupOptions.external\`
    at viteWarn (file:///Users/agent/cube/node_modules/vite/dist/node/chunks/dep-CDnG8rE7.js:65589:17)
    at onRollupWarning (file:///Users/agent/cube/node_modules/vite/dist/node/chunks/dep-CDnG8rE7.js:65621:5)
    at onwarn (file:///Users/agent/cube/node_modules/vite/dist/node/chunks/dep-CDnG8rE7.js:65284:7)
    at file:///Users/agent/cube/node_modules/rollup/dist/es/shared/node-entry.js:19452:13
    at Object.logger [as onLog] (file:///Users/agent/cube/node_modules/rollup/dist/es/shared/node-entry.js:21178:9)
    at ModuleLoader.handleInvalidResolvedId (file:///Users/agent/cube/node_modules/rollup/dist/es/shared/node-entry.js:20067:26)
    at file:///Users/agent/cube/node_modules/rollup/dist/es/shared/node-entry.js:20025:26` },

  { id: 'k3', t: 64.5, dur: 2.5, type: 'thinking', text: 'I imported ./colors.js but never created it. The build is right to fail. Create the module with the palette, then rebuild.' },

  { id: 'c15', t: 67.5, dur: 1, type: 'tool', call: 'Write(colors.js)', output: plus(SRC.colors) },
  { id: 'c16', t: 69, dur: 2, type: 'tool', call: 'Bash(npm run build)', output:
`> cube@1.0.0 build
> vite build

vite v5.4.11 building for production...
✓ 4 modules transformed.
dist/index.html                 0.52 kB │ gzip: 0.31 kB
dist/assets/index-Bq2xT1aC.css  0.71 kB │ gzip: 0.34 kB
dist/assets/index-D8n3kVfQ.js   0.38 kB │ gzip: 0.27 kB
✓ built in 63ms` },
  { id: 'p3', t: 71.5, type: 'preview', html: PAGES.clickable },

  { id: 'm4', t: 72.5, dur: 3, type: 'message', text: 'Done. The cube spins continuously and starts in matte plaster white. Each click on it eases to the next colour: charcoal, terracotta, blush pink, sage green, then back to white. Try clicking it in the preview.' },
];

export const END = 77;
