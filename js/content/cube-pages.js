// The page the agent builds, at each point it changes. Shown in the preview.
// Self-contained HTML, no network.

const base = (extraCss, extraJs, spin) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Cube</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #f4f5f7; font-family: system-ui, sans-serif; }
  .scene { width: 180px; height: 180px; perspective: 700px; }
  .cube { position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
          transform: rotateX(-24deg) rotateY(36deg); ${spin ? 'animation: spin 8s linear infinite;' : ''} cursor: pointer; }
  .face { position: absolute; inset: 0; border: 2px solid rgba(255,255,255,.6); background: var(--c, #6b8cff); opacity: .92; }
  .f1 { transform: translateZ(90px); } .f2 { transform: rotateY(180deg) translateZ(90px); }
  .f3 { transform: rotateY(90deg) translateZ(90px); } .f4 { transform: rotateY(-90deg) translateZ(90px); }
  .f5 { transform: rotateX(90deg) translateZ(90px); } .f6 { transform: rotateX(-90deg) translateZ(90px); }
  .f3, .f4 { filter: brightness(.85); } .f5, .f6 { filter: brightness(1.1); }
  @keyframes spin { from { transform: rotateX(-24deg) rotateY(0deg); } to { transform: rotateX(-24deg) rotateY(360deg); } }
  ${extraCss}
</style></head>
<body>
  <div class="scene"><div class="cube" id="cube">
    <div class="face f1"></div><div class="face f2"></div><div class="face f3"></div>
    <div class="face f4"></div><div class="face f5"></div><div class="face f6"></div>
  </div></div>
  <script>${extraJs}<\/script>
</body></html>`;

export const PAGES = {
  empty: `<!doctype html><html><body style="margin:0;height:100vh;background:#fff"></body></html>`,
  static: base('', '', false),
  spinning: base('', '', true),
  clickable: base(
    '',
    `const colours = ['#6b8cff', '#ff8a5c', '#3cc4a0', '#f2c94c', '#b37feb'];
     let i = 0;
     document.getElementById('cube').addEventListener('click', () => {
       i = (i + 1) % colours.length;
       document.getElementById('cube').style.setProperty('--c', colours[i]);
     });`,
    true,
  ),
};
