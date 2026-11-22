// The page the agent builds, at each point it changes. Shown in the preview.
// Self-contained HTML, no network. The same source strings are shown in the replay's
// tool calls (practice-cube.js), so the code a participant reads is the code that runs.

export const PLASTER = '#ece7df';

export const SRC = {};

SRC.index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cube</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <canvas id="scene" aria-label="A rounded 3D cube"></canvas>
  <script type="module" src="/main.js"></script>
</body>
</html>`;

SRC.style = `html, body { height: 100%; margin: 0; background: #ebe9e5; }
canvas { display: block; width: 100%; height: 100%; }`;

// Renderer: a rounded box as a signed distance function, ray-marched in a fragment shader,
// lit by one soft key light, with ambient occlusion and a soft shadow on a floor that
// fades into the background. ANGLE is the only line that changes when the cube starts spinning.
const ANGLE_STILL = 'const angle = () => 0.62;';
const ANGLE_SPIN = 'const angle = t => 0.62 + t * 0.785;   // one turn every 8 s';

const cube = angleLine => `// Rounded cube: ray-marched signed distance field, no library.
const FRAG = \`
precision highp float;
uniform vec2 uRes;
uniform float uAngle;
uniform vec3 uColour;
const vec3 BG = vec3(0.922, 0.914, 0.898);
const float FLOOR = -0.9;

float roundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float cube(vec3 p) {
  p.y -= 0.02;
  return roundBox(rotX(0.12) * rotY(uAngle) * p, vec3(0.56), 0.16);
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.0008, 0.0);
  return normalize(vec3(cube(p + e.xyy) - cube(p - e.xyy),
                        cube(p + e.yxy) - cube(p - e.yxy),
                        cube(p + e.yyx) - cube(p - e.yyx)));
}
float softShadow(vec3 ro, vec3 rd, float k) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 56; i++) {
    float h = cube(ro + rd * t);
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.2);
    if (res < 0.002 || t > 6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
float occlusion(vec3 p, vec3 n) {
  float o = 0.0, s = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.05 * float(i);
    o += (h - cube(p + n * h)) * s;
    s *= 0.65;
  }
  return clamp(1.0 - 1.8 * o, 0.0, 1.0);
}
void main() {
  float S = min(uRes.y, uRes.x * 0.52);                    // size by the shorter side
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / S;
  vec3 ro = vec3(0.0, 1.25, 4.8), ta = vec3(0.0, -0.05, 0.0);
  vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0.0, 1.0, 0.0))), u = cross(r, f);
  vec3 rd = normalize(f * 1.75 + uv.x * r + uv.y * u);
  vec3 L = normalize(vec3(-0.55, 0.85, 0.65));     // key light, upper left
  vec3 F = normalize(vec3(0.8, 0.25, 0.55));        // soft fill, right
  vec3 bg = pow(BG * (1.0 - 0.05 * uv.y), vec3(2.2));

  float t = 0.0; bool hit = false;
  for (int i = 0; i < 110; i++) {
    float h = cube(ro + rd * t);
    if (h < 0.0006) { hit = true; break; }
    t += h;
    if (t > 12.0) break;
  }
  float tf = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e9;
  vec3 col = bg;

  if (hit && t < tf) {
    vec3 p = ro + rd * t, n = normal(p);
    float ao = occlusion(p, n);
    float dif = clamp(dot(n, L), 0.0, 1.0) * softShadow(p + n * 0.01, L, 12.0);
    float fill = clamp(dot(n, F), 0.0, 1.0);
    float sky = 0.5 + 0.5 * n.y;
    float bounce = clamp(-n.y, 0.0, 1.0);
    vec3 light = 0.95 * dif * vec3(1.0, 0.97, 0.93)
               + 0.22 * fill * ao
               + 0.38 * sky * ao * vec3(0.94, 0.96, 1.0)
               + 0.18 * bounce * ao * bg;
    col = pow(uColour, vec3(2.2)) * light;
    vec3 hv = normalize(L - rd);
    col += 0.05 * pow(clamp(dot(n, hv), 0.0, 1.0), 20.0) * dif;          // matte: a faint sheen only
    col += 0.06 * pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0) * ao;     // edges catch the light
  } else if (tf < 1e8) {
    vec3 p = ro + rd * tf;
    float sh = softShadow(p, L, 3.5);
    float contact = clamp(cube(p) / 0.75, 0.0, 1.0);
    col = bg * mix(0.62, 1.0, sh) * mix(0.72, 1.0, contact);
    col = mix(col, bg, smoothstep(5.0, 11.0, tf));
  }
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}\`;

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
${angleLine}

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export function createCube(canvas, start = '${PLASTER}') {
  const gl = canvas.getContext('webgl', { antialias: true });
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);

  let from = hex(start), to = from, mixStart = 0;
  function frame(now) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const k = Math.min(1, (now - mixStart) / 350);
    const e = k * k * (3 - 2 * k);
    gl.uniform2f(U('uRes'), w, h);
    gl.uniform1f(U('uAngle'), angle(now / 1000));
    gl.uniform3fv(U('uColour'), from.map((c, i) => c + (to[i] - c) * e));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setColour(c) { const k = Math.min(1, (performance.now() - mixStart) / 350); from = from.map((v, i) => v + (to[i] - v) * k); to = hex(c); mixStart = performance.now(); },
    // Is a point (CSS px) on the cube? Project its centre and compare with its on-screen size.
    hit(x, y) {
      const H = canvas.clientHeight, W = canvas.clientWidth, S = Math.min(H, W * 0.52);
      const z = 4.9, s = 1.75 / z * S;
      const cx = W / 2, cy = H / 2 + 0.02 * S;
      return Math.hypot(x - cx, y - cy) < 0.82 * s;
    },
  };
}`;

SRC.cubeStill = cube(ANGLE_STILL);
SRC.cubeSpin = cube(ANGLE_SPIN);
SRC.angleStill = ANGLE_STILL;
SRC.angleSpin = ANGLE_SPIN;

SRC.mainStill = `import { createCube } from './cube.js';

createCube(document.getElementById('scene'));`;

SRC.main = `import { createCube } from './cube.js';
import { colours } from './colors.js';

const canvas = document.getElementById('scene');
const cube = createCube(canvas, colours[0]);
let i = 0;

canvas.addEventListener('click', e => {
  if (!cube.hit(e.offsetX, e.offsetY)) return;
  i = (i + 1) % colours.length;
  cube.setColour(colours[i]);
});
canvas.addEventListener('pointermove', e => {
  canvas.style.cursor = cube.hit(e.offsetX, e.offsetY) ? 'pointer' : 'default';
});`;

SRC.colors = `// plaster white, charcoal, terracotta, blush pink, sage green
export const colours = ['${PLASTER}', '#2f2f31', '#d9783a', '#e3aaa0', '#7f9f84'];`;

// Inline the modules into one page for the preview (srcdoc can't import files).
const strip = s => s.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const page = (cubeSrc, mainSrc, withColours) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Cube</title>
<style>${SRC.style}</style></head>
<body>
  <canvas id="scene" aria-label="A rounded 3D cube"></canvas>
  <script>
${strip(cubeSrc)}
${withColours ? strip(SRC.colors) : ''}
${strip(mainSrc)}
<\/script>
</body></html>`;

export const PAGES = {
  empty: `<!doctype html><html><body style="margin:0;height:100vh;background:#ebe9e5"></body></html>`,
  static: page(SRC.cubeStill, SRC.mainStill, false),
  spinning: page(SRC.cubeSpin, SRC.mainStill, false),
  clickable: page(SRC.cubeSpin, SRC.main, true),
};
