// SCRIPTED REPLAY for the practice task. Not a real agent run. It stands in until real
// recordings exist, and deliberately includes the four hard cases from the handover:
//   1. a thinking block several paragraphs long          (k1)
//   2. tool output of 100+ lines (an install log)        (c2)
//   3. ten tool calls in a row with no message between   (c3 … c12)
//   4. a failed command with an error trace              (c14)
// Format: a list of timed events. The display doesn't care whether it is a recording or live.
//   t    seconds from task start      dur  seconds it takes to stream in
//   type request | message | thinking | tool | preview

import { PAGES } from './cube-pages.js?v=20261122f';

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

const INDEX_V1 = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cube</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="scene">
    <div class="cube" id="cube">
      <div class="face f1"></div>
      <div class="face f2"></div>
      <div class="face f3"></div>
      <div class="face f4"></div>
      <div class="face f5"></div>
      <div class="face f6"></div>
    </div>
  </div>
  <script type="module" src="/main.js"></script>
</body>
</html>`;

export const EVENTS = [
  { id: 'r1', t: 0, type: 'request', text: 'Build a spinning 3D cube that changes colour when I click it.' },

  { id: 'm1', t: 2, dur: 3, type: 'message', text: "I'll build this as a small web page: a 3D cube made of six faces that rotates continuously, and a click handler that cycles its colour. I'll set up a project first so we can preview it as we go." },

  { id: 'k1', t: 6, dur: 10, type: 'thinking', text:
`The user wants a cube that spins and changes colour on click. There are a few ways to do 3D in the browser. Three.js would make the geometry trivial, but it adds a dependency and the preview environment may not have network access for a CDN at runtime. WebGL by hand is overkill for one cube.

CSS 3D transforms can do this well: six absolutely positioned faces, each rotated and translated by half the edge length, inside a container with transform-style: preserve-3d and a perspective on the parent. Spinning is then just a keyframe animation on rotateY, with a fixed rotateX tilt so the top face is visible.

For the colour change, the simplest robust approach is a CSS custom property on the cube that every face reads, and a click listener that steps through a small palette. Clicking during the animation is fine because the listener is on the cube element, which keeps its hit area while it rotates.

I'll use Vite for a dev server so the preview reloads as files change. That means an npm install, which will be noisy but quick. Then: index.html for the markup, style.css for the faces and animation, main.js for the click handler.` },

  { id: 'c1', t: 17, dur: 1, type: 'tool', call: 'Bash(ls -la)', output:
`total 8
drwxr-xr-x  3 agent  staff   96 Nov 21 12:40 .
drwxr-xr-x  9 agent  staff  288 Nov 21 12:40 ..
-rw-r--r--  1 agent  staff   47 Nov 21 12:40 README.md` },

  { id: 'c2', t: 19, dur: 7, type: 'tool', call: 'Bash(npm init -y && npm install --save-dev vite)', output: installLog() },

  { id: 'm2', t: 27, dur: 2, type: 'message', text: 'Vite is installed. Now the page itself.' },

  // Ten tool calls in a row, no message between them.
  { id: 'c3', t: 30, dur: 1.2, type: 'tool', call: 'Write(index.html)', output: INDEX_V1.split('\n').map(l => '+ ' + l).join('\n') },
  { id: 'c4', t: 32, dur: 1.2, type: 'tool', call: 'Write(style.css)', output:
`+ body { display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f4f5f7; }
+ .scene { width: 180px; height: 180px; perspective: 700px; }
+ .cube { position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
+         transform: rotateX(-24deg) rotateY(36deg); cursor: pointer; }
+ .face { position: absolute; inset: 0; background: var(--c, #6b8cff); opacity: .92;
+         border: 2px solid rgba(255, 255, 255, .6); }
+ .f1 { transform: translateZ(90px); }
+ .f2 { transform: rotateY(180deg) translateZ(90px); }
+ .f3 { transform: rotateY(90deg) translateZ(90px); }
+ .f4 { transform: rotateY(-90deg) translateZ(90px); }
+ .f5 { transform: rotateX(90deg) translateZ(90px); }
+ .f6 { transform: rotateX(-90deg) translateZ(90px); }` },
  { id: 'c5', t: 34, dur: 1, type: 'tool', call: 'Write(main.js)', output: `+ // Interaction is added in the next step.\n+ console.log('cube ready');` },
  { id: 'c6', t: 35.5, dur: 1, type: 'tool', call: 'Edit(package.json)', output:
`   "scripts": {
-    "test": "echo \\"Error: no test specified\\" && exit 1"
+    "dev": "vite",
+    "build": "vite build"
   },` },
  { id: 'c7', t: 37, dur: 1.5, type: 'tool', call: 'Bash(npm run dev -- --port 5173 &)', output:
`> cube@1.0.0 dev
> vite --port 5173

  VITE v5.4.11  ready in 214 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose` },
  { id: 'c8', t: 39, dur: 1, type: 'tool', call: 'Bash(curl -s localhost:5173 | head -5)', output:
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />` },
  { id: 'c9', t: 40.5, dur: 1, type: 'tool', call: 'Read(style.css)', output: '12 lines' },
  { id: 'c10', t: 42, dur: 1, type: 'tool', call: 'Bash(grep -c "class=\\"face" index.html)', output: '6' },
  { id: 'c11', t: 43.5, dur: 1.2, type: 'tool', call: 'Bash(npx --yes html-validate index.html)', output: '✔ No issues found' },
  { id: 'c12', t: 45.5, dur: 1.5, type: 'tool', call: 'Screenshot(http://localhost:5173)', output: 'Saved screenshot-1.png (1280×800)' },
  { id: 'p1', t: 47, type: 'preview', html: PAGES.static },

  { id: 'm3', t: 48, dur: 2.5, type: 'message', text: "The cube is on the page with all six faces. It isn't moving yet. Next I'll add the rotation and the click-to-change-colour behaviour." },

  { id: 'k2', t: 51.5, dur: 4, type: 'thinking', text:
`Spin: a keyframe on the .cube element that goes from rotateY(0) to rotateY(360deg) over about eight seconds, linear, infinite. I need to keep the rotateX tilt inside both keyframes, otherwise the animation will override it and the cube will look flat-on.

Colour: put the palette in its own module so it's easy to change, and import it from main.js.` },

  { id: 'c13', t: 56, dur: 1.5, type: 'tool', call: 'Edit(style.css)', output:
`  .cube { position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
-         transform: rotateX(-24deg) rotateY(36deg); cursor: pointer; }
+         transform: rotateX(-24deg) rotateY(36deg); cursor: pointer;
+         animation: spin 8s linear infinite; }
+ @keyframes spin {
+   from { transform: rotateX(-24deg) rotateY(0deg); }
+   to   { transform: rotateX(-24deg) rotateY(360deg); }
+ }` },
  { id: 'p2', t: 58, type: 'preview', html: PAGES.spinning },
  { id: 'c13b', t: 58.5, dur: 1.5, type: 'tool', call: 'Write(main.js)', output:
`- // Interaction is added in the next step.
- console.log('cube ready');
+ import { colours } from './colors.js';
+
+ const cube = document.getElementById('cube');
+ let i = 0;
+ cube.addEventListener('click', () => {
+   i = (i + 1) % colours.length;
+   cube.style.setProperty('--c', colours[i]);
+ });` },

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

  { id: 'c15', t: 67.5, dur: 1, type: 'tool', call: 'Write(colors.js)', output: `+ export const colours = ['#6b8cff', '#ff8a5c', '#3cc4a0', '#f2c94c', '#b37feb'];` },
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

  { id: 'm4', t: 72.5, dur: 3, type: 'message', text: 'Done. The cube spins continuously and changes to the next colour in a five-colour palette each time you click it. Try clicking it in the preview.' },
];

export const END = 77;
