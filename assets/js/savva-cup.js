/* ============================================================================
   SAVVA — the cup, in three dimensions.
   One real drink, Savva Melon, modelled from SAVVA's own photographs: the
   tapered clear PET cup with its rolled rim, the flat snap lid, the peach slush
   packed up under it, and the green SAVVA print drawn from the brand's own
   wordmark. Raw WebGL — no library, so the site keeps its zero-dependency
   rule — and loaded by savva.js only as the section approaches.

   The scroll driver in savva.js stays the single source of progress: it writes
   --t / --enter / --dom / --name / --exit on the section, and this file reads
   them each frame and eases towards them. If WebGL is missing, or the context
   is lost, nothing here runs and the photograph composition remains — which is
   also exactly what ships without JS and under reduced data.
   ========================================================================== */
(function () {
  'use strict';

  // read while this script is still executing: it is null in any callback
  var ASSETS = document.currentScript ? new URL('..', document.currentScript.src).href : '/assets/';

  var section = document.querySelector('[data-ritual]');
  if (!section || section.classList.contains('has-gl')) return;
  var stage = section.querySelector('[data-ritual-stage]');
  var slot = section.querySelector('[data-ritual-tilt]');
  if (!stage || !slot) return;

  var root = document.documentElement;
  var lite = root.classList.contains('lite');
  var small = Math.min(window.screen.width, window.screen.height) < 700;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  var canvas = document.createElement('canvas');
  canvas.className = 'ritual__gl';
  canvas.setAttribute('aria-hidden', 'true');
  var attrs = { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, powerPreference: 'high-performance' };
  var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  if (!gl) return;

  /* --- Small linear-algebra kit (column-major, as WebGL expects) --------- */
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookAt(e, t, u) {
    var zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
    var l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function normalMat(m) { return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]; }
  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function lin(hex, k) { // sRGB hex → linear rgb, optionally scaled
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map(function (c) { return Math.pow(c / 255, 2.2) * (k || 1); });
  }
  var rad = function (d) { return d * Math.PI / 180; };
  var smooth = function (x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

  /* --- Geometry: every part is a surface of revolution ---------------------
     A profile is a list of [radius, height] points, traversed so that the
     outside lies to the right of the direction of travel; the lathe turns it
     through 360° with the seam at the back, where the camera never looks.
     Units: the cup is 2.4 tall, 1.0 in radius at the rim — the proportions of
     the Savva Melon cup in SAVVA's photographs (base ≈ 0.76 of the rim). */
  var H0 = -1.2, H1 = 1.2, RB = 0.765, RT = 1.0;
  function wallR(y) { return RB + (RT - RB) * (y - (H0 + 0.1)) / (H1 - 0.03 - (H0 + 0.1)); }
  function arc(cx, cy, r, a0, a1, n, out) {
    for (var i = 0; i <= n; i++) {
      var a = rad(a0 + (a1 - a0) * i / n);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  }

  function cupProfile() {
    var p = [[0, H0 + 0.035], [0.3, H0 + 0.035], [0.6, H0 + 0.03]];
    // the stacking foot, then the rounded heel
    arc(0.66, H0 + 0.02, 0.02, 180, 270, 3, p);
    arc(RB - 0.07, H0 + 0.07, 0.07, 270, 360, 6, p);
    for (var i = 1; i <= 24; i++) {
      var y = H0 + 0.1 + (H1 - 0.03 - (H0 + 0.1)) * i / 24;
      p.push([wallR(y), y]);
    }
    // the rolled rim: a small bead the lid snaps over
    arc(RT + 0.022, H1 - 0.005, 0.028, 200, 520, 12, p);
    return p;
  }

  function lidProfile() {
    var p = [[RT + 0.058, H1 - 0.05], [RT + 0.062, H1 - 0.01]];
    arc(RT + 0.04, H1 + 0.012, 0.024, 0, 90, 5, p);          // the skirt rolls over the bead
    p.push([RT - 0.02, H1 + 0.036], [RT - 0.045, H1 + 0.024]); // the seat
    p.push([RT - 0.065, H1 + 0.027], [RT - 0.08, H1 + 0.045], [RT - 0.095, H1 + 0.058]);
    for (var i = 0; i <= 14; i++) {                           // a very gentle crown
      var r = (RT - 0.1) * (1 - i / 14);
      p.push([r, H1 + 0.06 + 0.035 * (1 - Math.pow(r / (RT - 0.1), 2))]);
    }
    return p;
  }

  var FILL = H1 - 0.05; // the slush reaches up under the lid
  function bodyProfile() {
    // a rounded heel that meets the wall exactly, so the normals run smooth
    var inset = 0.018, rr = 0.07, y0 = H0 + 0.06;
    var cx = wallR(y0 + rr) - inset - rr;
    var p = [[0, y0], [cx * 0.5, y0]];
    arc(cx, y0 + rr, rr, 270, 360, 6, p);
    for (var i = 1; i <= 22; i++) {
      var y = y0 + rr + (FILL - (y0 + rr)) * i / 22;
      p.push([wallR(y) - inset, y]);
    }
    return p;
  }

  function frothProfile() {
    var edge = wallR(FILL) - 0.018, p = [];
    for (var i = 0; i <= 16; i++) {
      var r = edge * (1 - i / 16);
      p.push([r, FILL + 0.1 * Math.pow(1 - Math.pow(r / edge, 2), 0.55)]);
    }
    return p;
  }

  function lathe(profile, seg) {
    var n = profile.length, pos = [], nor = [], idx = [], i, j;
    for (i = 0; i < n; i++) {
      var a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      var nr = dy / l, ny = -dx / l;
      for (j = 0; j <= seg; j++) {
        var ang = (j / seg - 0.5) * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang);
        pos.push(profile[i][0] * s, profile[i][1], profile[i][0] * c);
        nor.push(nr * s, ny, nr * c);
      }
    }
    for (i = 0; i < n - 1; i++) for (j = 0; j < seg; j++) {
      var p0 = i * (seg + 1) + j, p1 = p0 + seg + 1;
      idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1);
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
  }

  /* --- The print: SAVVA's own wordmark, with COFFEE beneath, as on the cup --
     Drawn white into a power-of-two canvas; the shader tints it with the ink.
     The texture spans ±0.105 of a turn around the front of the cup and the
     band 0.425–0.675 of its height, which places the lettering where SAVVA
     prints it. */
  var LOGO_BOX = [-0.105, 0.105, 0.425, 0.675];
  function drawLogo() {
    return fetch(ASSETS + 'img/savva-wordmark.svg').then(function (r) { return r.text(); }).then(function (svg) {
      svg = svg.replace('fill="currentColor"', 'fill="#ffffff"');
      var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); res(img); };
        img.onerror = rej;
        img.src = url;
      });
    }).then(function (img) {
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      return ready.then(function () {
        var c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        var x = c.getContext('2d');
        var w = 860, h = w * 107.8 / 336.8;
        x.drawImage(img, (1024 - w) / 2, 70, w, h);
        x.fillStyle = '#ffffff';
        x.font = '500 40px Archivo, "Helvetica Neue", Arial, sans-serif';
        x.textBaseline = 'alphabetic';
        var word = 'COFFEE', track = 30, total = 0, k;
        for (k = 0; k < word.length; k++) total += x.measureText(word[k]).width + (k ? track : 0);
        var cx = (1024 - total) / 2, base = 70 + h + 88;
        for (k = 0; k < word.length; k++) {
          x.fillText(word[k], cx, base);
          cx += x.measureText(word[k]).width + track;
        }
        return c;
      });
    });
  }

  /* --- Shaders -------------------------------------------------------------
     One vertex stage for every part. Two materials: the slush (opaque, lit
     with a soft wrap and a little light carried through it) and clear PET
     (reflection of a small photographic studio — two tall softboxes and a
     top light — by Fresnel, plus a cold-drink frost, condensation beads and
     the printed ink). Everything is composed in linear light and tone-mapped
     at the end of each material, then written premultiplied. */
  var VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'uniform mat4 uModel;',
    'uniform mat4 uViewProj;',
    'uniform mat3 uNrm;',
    'varying vec3 vPos;',
    'varying vec3 vNor;',
    'varying vec3 vObj;',
    'void main() {',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vPos = w.xyz;',
    '  vNor = uNrm * aNor;',
    '  vObj = aPos;',
    '  gl_Position = uViewProj * w;',
    '}'
  ].join('\n');

  var COMMON = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec3 uCam;',
    'uniform vec3 uKeyDir;',
    'uniform vec3 uKeyCol;',
    'uniform vec3 uRimDir;',
    'uniform vec3 uRimCol;',
    'uniform vec3 uAmb;',
    'uniform float uEnvRot;',
    'uniform float uExpo;',
    'uniform float uAlpha;',
    'uniform mat3 uRotF;',
    'varying vec3 vPos;',
    'varying vec3 vNor;',
    'varying vec3 vObj;',
    'float hash13(vec3 p) {',
    '  p = fract(p * 0.1031);',
    '  p += dot(p, p.zyx + 31.32);',
    '  return fract((p.x + p.y) * p.z);',
    '}',
    'float vnoise(vec3 p) {',
    '  vec3 i = floor(p), f = fract(p);',
    '  vec3 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),',
    '                 mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),',
    '             mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),',
    '                 mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);',
    '}',
    'float fbm(vec3 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.13) + 0.15 * vnoise(p * 4.31); }',
    // linear up to 0.8, then a soft shoulder into white, then display gamma —
    // a filmic curve would wash the melon out, and its colour is SAVVA's
    'vec3 tonemap(vec3 c) {',
    '  c *= uExpo;',
    '  vec3 over = max(c - 0.8, 0.0);',
    '  c = min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));',
    '  return pow(max(c, 0.0), vec3(1.0 / 2.2));',
    '}',
    'float softbox(float az, float y, float c, float w, float y0, float y1) {',
    '  float dx = abs(az - c);',
    '  dx = min(dx, 6.28318 - dx);',
    '  return smoothstep(w, w * 0.55, dx) * smoothstep(y0 - 0.18, y0, y) * (1.0 - smoothstep(y1, y1 + 0.18, y));',
    '}',
    // a small, dark studio: a tall key box front-left, a narrow rim strip
    // behind on the right, a thin fill and a top light — rotated by uEnvRot
    // so the highlights travel across the cup as the page scrolls
    'vec3 studio(vec3 d) {',
    '  float c = cos(uEnvRot), s = sin(uEnvRot);',
    '  d = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);',
    '  float az = atan(d.x, d.z);',
    '  vec3 col = mix(vec3(0.012, 0.012, 0.01), vec3(0.075, 0.078, 0.06), smoothstep(-0.3, 0.9, d.y));',
    '  col += vec3(1.0, 0.95, 0.86) * 2.6 * softbox(az, d.y, -0.8, 0.24, -0.25, 0.8);',
    '  col += vec3(0.86, 0.9, 0.76) * 1.5 * softbox(az, d.y, 2.3, 0.13, -0.3, 0.75);',
    '  col += vec3(1.0, 0.96, 0.9) * 0.8 * softbox(az, d.y, 0.55, 0.06, 0.05, 0.6);',
    '  col += vec3(1.0, 0.97, 0.9) * 0.5 * smoothstep(0.8, 0.97, d.y);',
    '  return col;',
    '}'
  ].join('\n');

  var FS_SLUSH = COMMON + '\n' + [
    'uniform vec3 uBodyLo;',
    'uniform vec3 uBodyMid;',
    'uniform vec3 uBodyHi;',
    'uniform vec3 uFrothCol;',
    'uniform float uFroth;',
    'void main() {',
    '  vec3 N = normalize(vNor);',
    '  vec3 V = normalize(uCam - vPos);',
    // crystals: a bump from the gradient of a small noise field, far finer
    // on the packed froth than in the body of the drink
    '  vec3 q = vObj * mix(3.2, 10.0, uFroth);',
    // the bump needs only the fine octave's slope: four lookups, not twelve
    '  vec3 qf = q * 2.13;',
    '  float n0 = fbm(q), n1 = vnoise(qf), e = 0.08;',
    '  vec3 g = (vec3(vnoise(qf + vec3(e, 0.0, 0.0)), vnoise(qf + vec3(0.0, e, 0.0)), vnoise(qf + vec3(0.0, 0.0, e))) - n1) / e;',
    '  vec3 gw = uRotF * g;',
    '  N = normalize(N - (gw - N * dot(gw, N)) * mix(0.05, 0.16, uFroth));',
    '  float h = clamp((vObj.y + 1.2) / 2.4, 0.0, 1.0);',
    '  vec3 body = mix(uBodyLo, uBodyMid, smoothstep(0.0, 0.45, h));',
    '  body = mix(body, uBodyHi, smoothstep(0.55, 1.0, h));',
    '  vec3 alb = mix(body, uFrothCol, uFroth);',
    '  alb *= 0.9 + 0.2 * n0;',
    '  float fleck = smoothstep(0.7, 0.8, fbm(vObj * 16.0 + 3.1));',
    '  alb = mix(alb, uBodyLo * 0.78, fleck * 0.28 * (1.0 - uFroth));',
    '  float dk = max(0.0, (dot(N, uKeyDir) + 0.5) / 1.5);',
    '  float dr = max(0.0, dot(N, uRimDir));',
    '  vec3 col = alb * (uAmb + uKeyCol * dk * 0.8 + uRimCol * dr * 0.5);',
    // light carried through the slush and out towards the viewer
    '  col += alb * uRimCol * pow(clamp(dot(V, -uRimDir), 0.0, 1.0), 2.0) * 0.28;',
    // seen through the plastic, the wall thickens towards the silhouette
    '  float fr = 1.0 - max(dot(N, V), 0.0);',
    '  col *= mix(1.0, 0.6, fr * fr);',
    '  vec3 Hh = normalize(uKeyDir + V);',
    '  float spark = uFroth > 0.5 ? smoothstep(0.5, 0.75, vnoise(vObj * 24.0)) : 0.0;',
    '  col += uKeyCol * pow(max(dot(N, Hh), 0.0), 70.0) * (0.04 + uFroth * 0.3 * spark);',
    '  gl_FragColor = vec4(tonemap(col), 1.0) * uAlpha;',
    '}'
  ].join('\n');

  var FS_PET = COMMON + '\n' + [
    'uniform float uSide;',
    'uniform float uFrost;',
    'uniform float uInkOn;',
    'uniform float uDrops;',
    'uniform sampler2D uLogo;',
    'uniform vec3 uInk;',
    'uniform vec4 uLogoBox;',
    'void main() {',
    '  vec3 N = normalize(vNor) * uSide;',
    '  vec3 V = normalize(uCam - vPos);',
    '  float h = clamp((vObj.y + 1.2) / 2.4, 0.0, 1.0);',
    '  float ang = atan(vObj.x, vObj.z);',
    '  float drop = 0.0;',
    '  if (uDrops > 0.0) {',
    // condensation: a scatter of beads, each a tiny lens whose normal
    // bulges out from its centre
    '    vec2 q = vec2(ang * 9.0, vObj.y * 9.0);',
    '    vec2 id = floor(q), f = fract(q);',
    '    float best = 9.0;',
    '    vec2 bv = vec2(0.0);',
    '    for (int j = -1; j <= 1; j++) {',
    '      for (int i = -1; i <= 1; i++) {',
    '        vec2 o = vec2(float(i), float(j));',
    '        vec3 k = vec3(id + o, 7.13);',
    '        float on = step(0.5, hash13(k));',
    '        vec2 c = o + vec2(hash13(k + 1.7), hash13(k + 2.9)) * 0.7 + 0.15 - f;',
    '        float r = (0.1 + 0.22 * hash13(k + 4.3)) * on + 0.0001;',
    '        float d = length(c) / r;',
    '        if (d < best) { best = d; bv = -c / r; }',
    '      }',
    '    }',
    '    drop = (1.0 - smoothstep(0.8, 1.0, best)) * uDrops * smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.9, 0.97, h));',
    '    vec3 T = uRotF * normalize(vec3(vObj.z, 0.0, -vObj.x) + vec3(0.00001, 0.0, 0.0));',
    '    vec3 U = uRotF * vec3(0.0, 1.0, 0.0);',
    '    N = normalize(N + (T * bv.x + U * bv.y) * drop * 0.8);',
    '  }',
    '  float NdV = max(dot(N, V), 0.0);',
    '  float F = 0.045 + 0.955 * pow(1.0 - NdV, 5.0);',
    '  vec3 R = reflect(-V, N);',
    '  vec3 Hk = normalize(uKeyDir + V), Hr = normalize(uRimDir + V);',
    '  vec3 refl = studio(R) * F',
    '    + uKeyCol * pow(max(dot(N, Hk), 0.0), 240.0) * 1.2',
    '    + uRimCol * pow(max(dot(N, Hr), 0.0), 140.0) * 0.9;',
    // a cold drink fogs its cup, most of all low down
    '  float frost = uFrost * mix(0.7, 1.0, 1.0 - h) * (0.7 + 0.6 * vnoise(vObj * 9.0));',
    '  vec3 frostCol = vec3(0.95, 0.93, 0.88) * (uAmb * 1.5 + uKeyCol * max(dot(N, uKeyDir), 0.0) * 0.4 + uRimCol * 0.1);',
    '  vec3 rgb = tonemap(refl) + tonemap(frostCol) * frost;',
    '  float a = frost + F * 0.25 + drop * 0.12;',
    '  if (uInkOn > 0.5) {',
    '    vec2 st = vec2((ang / 6.28318 - uLogoBox.x) / (uLogoBox.y - uLogoBox.x), (h - uLogoBox.z) / (uLogoBox.w - uLogoBox.z));',
    '    float ink = 0.0;',
    '    if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) ink = texture2D(uLogo, st).a;',
    '    vec3 inkCol = uInk * (uAmb * 1.3 + uKeyCol * max(dot(N, uKeyDir), 0.0) * 0.6 + uRimCol * max(dot(N, uRimDir), 0.0) * 0.25);',
    '    rgb = mix(rgb, tonemap(inkCol + refl * 0.35), ink);',
    '    a = mix(a, 1.0, ink * 0.95);',
    '  }',
    // premultiplied output must never carry more light than coverage
    '  a = clamp(max(a, max(rgb.r, max(rgb.g, rgb.b))), 0.0, 1.0);',
    '  gl_FragColor = vec4(rgb, a) * uAlpha;',
    '}'
  ].join('\n');

  /* --- GL plumbing -------------------------------------------------------- */
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aNor');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }
  function mesh(g) {
    function buf(target, data) {
      var b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    }
    return { pos: buf(gl.ARRAY_BUFFER, g.pos), nor: buf(gl.ARRAY_BUFFER, g.nor), idx: buf(gl.ELEMENT_ARRAY_BUFFER, g.idx), n: g.idx.length };
  }
  function drawMesh(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nor);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }

  var progs;
  try {
    progs = { slush: program(FS_SLUSH), pet: program(FS_PET) };
  } catch (err) {
    return; // a driver that cannot build these keeps the photograph
  }
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);

  // modest devices get fewer facets and no condensation — same composition
  var seg = lite || small ? 72 : 128;
  var drops = !lite && !small;
  var meshes = {
    cup: mesh(lathe(cupProfile(), seg)),
    lid: mesh(lathe(lidProfile(), seg)),
    body: mesh(lathe(bodyProfile(), seg)),
    froth: mesh(lathe(frothProfile(), seg))
  };

  // a transparent 1×1 stands in until the print is drawn; its filter must not
  // ask for mipmaps, or WebGL samples an incomplete texture as opaque black
  var logoTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, logoTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  drawLogo().then(function (c) {
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var an = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    kick();
  }).catch(function () { /* an unprinted cup is still the cup */ });

  /* --- Light and material, sampled from the Savva Melon photographs ------ */
  var C = {
    lo: lin('#dd9552'), mid: lin('#efb06c'), hi: lin('#f3c186'), froth: lin('#f4dcbc'),
    ink: lin('#5f8634'),
    // lit so the key side lands on the photographed colour, not past it
    key: lin('#fff6ea', 1.0), rim: lin('#e4ead0', 0.75), amb: lin('#8a8878')
  };
  var KEY = norm3([-0.62, 0.55, 0.62]);
  var RIM = norm3([0.72, 0.28, -0.62]);

  /* --- The scene ----------------------------------------------------------- */
  var dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : small ? 1.5 : 2);
  var target = { t: 0.3, enter: 1, dom: 0.3, name: 1, exit: 0 };
  var cur = null;
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  var last = 0;

  function readProgress() {
    var st = section.style;
    for (var k in target) {
      var v = parseFloat(st.getPropertyValue('--' + k));
      if (!isNaN(v)) target[k] = v;
    }
  }

  function frame(now) {
    var cr = canvas.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (cr.width < 2 || cr.height < 2 || sr.height < 2) return;
    var w = Math.round(cr.width * dpr), h = Math.round(cr.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    readProgress();
    var still = reduce.matches;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    // the scene eases towards the scroll position rather than snapping to it,
    // which is what makes the motion read as physical
    if (!cur || still) cur = { t: target.t, enter: target.enter, dom: target.dom, name: target.name, exit: target.exit };
    else {
      var k = 1 - Math.exp(-dt * 6);
      for (var key in target) cur[key] += (target[key] - cur[key]) * k;
    }
    var kp = 1 - Math.exp(-dt * 4);
    ptr.x += (ptr.tx - ptr.x) * kp;
    ptr.y += (ptr.ty - ptr.y) * kp;
    var px = still ? 0 : ptr.x, py = still ? 0 : ptr.y;
    var time = still ? 0 : now / 1000, drift = still ? 0 : 1;

    var e = cur.enter, d = cur.dom, x = cur.exit;
    var alpha = e * (1 - x);
    gl.viewport(0, 0, w, h);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (alpha < 0.003) return;

    // The camera is sized so the cup fills the slot the stylesheet reserves
    // for it, and centred on that slot with an off-axis projection — so the
    // drink is seen head-on wherever the slot sits, in either language.
    // at its largest the cup still sits inside its slot, clear of the type
    var scale = 0.86 + e * 0.08 + d * 0.22 - x * 0.2;
    var fov = rad(26), th = Math.tan(fov / 2);
    // on a narrow screen the width binds before the height does
    var fitH = Math.min(sr.height, cr.width * 0.85);
    var dist = 3.05 * cr.height / (2 * fitH * scale * th);
    var cx = (sr.left + sr.width / 2 - cr.left) / cr.width;
    var cy = (sr.top + sr.height / 2 - cr.top) / cr.height;
    var yawC = px * rad(6), pitC = rad(7) - py * rad(4);
    var eye = [Math.sin(yawC) * Math.cos(pitC) * dist, Math.sin(pitC) * dist, Math.cos(yawC) * Math.cos(pitC) * dist];
    var proj = perspective(fov, cr.width / cr.height, 0.1, dist * 4 + 20);
    proj[8] = 1 - 2 * cx;
    proj[9] = 2 * cy - 1;
    var vp = mul(proj, lookAt(eye, [0, 0, 0], [0, 1, 0]));

    // It rises out of depth turning, comes round until the print faces the
    // viewer as it takes the room, straightens from its lean as it does, and
    // recedes the way it came. Underneath, a slow float that never repeats
    // exactly, because the three periods share no common factor.
    var yaw = rad(-40 + 72 * smooth(cur.t)) - (1 - e) * rad(70) + drift * rad(4) * Math.sin(time * 0.32);
    var pitch = rad(13 - 7 * d) + drift * rad(1.5) * Math.sin(time * 0.41 + 1.3);
    var roll = rad(12 - 8 * d) + drift * rad(1.8) * Math.sin(time * 0.27 + 0.4);
    var lift = drift * 0.05 * Math.sin(time * 0.7) + x * 0.45 - (1 - e) * 0.5 + cur.name * 0.02;
    var push = -(1 - e) * 5 - x * 3.5;
    var model = mul(trans(0, lift, push), mul(rotZ(roll), mul(rotX(pitch), mul(rotY(yaw), trans(0, -0.06, 0)))));
    var nm = normalMat(model);
    var envRot = rad(-20 + 45 * cur.t) + px * 0.2;

    function use(pr) {
      var u = pr.u;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniformMatrix4fv(u.uViewProj, false, vp);
      gl.uniformMatrix3fv(u.uNrm, false, nm);
      gl.uniformMatrix3fv(u.uRotF, false, nm);
      gl.uniform3fv(u.uCam, eye);
      gl.uniform3fv(u.uKeyDir, KEY);
      gl.uniform3fv(u.uKeyCol, C.key);
      gl.uniform3fv(u.uRimDir, RIM);
      gl.uniform3fv(u.uRimCol, C.rim);
      gl.uniform3fv(u.uAmb, C.amb);
      gl.uniform1f(u.uEnvRot, envRot);
      gl.uniform1f(u.uExpo, 1.0);
      gl.uniform1f(u.uAlpha, alpha);
      return u;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    // 1 — the drink, opaque
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.cullFace(gl.BACK);
    var us = use(progs.slush);
    gl.uniform3fv(us.uBodyLo, C.lo);
    gl.uniform3fv(us.uBodyMid, C.mid);
    gl.uniform3fv(us.uBodyHi, C.hi);
    gl.uniform3fv(us.uFrothCol, C.froth);
    gl.uniform1f(us.uFroth, 0);
    drawMesh(meshes.body);
    gl.uniform1f(us.uFroth, 1);
    drawMesh(meshes.froth);

    // 2 — the plastic, far side before near side, blended premultiplied
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    var up = use(progs.pet);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.uniform1i(up.uLogo, 0);
    gl.uniform3fv(up.uInk, C.ink);
    gl.uniform4fv(up.uLogoBox, LOGO_BOX);

    gl.cullFace(gl.FRONT);
    gl.uniform1f(up.uSide, -1);
    gl.uniform1f(up.uInkOn, 0);
    gl.uniform1f(up.uDrops, 0);
    gl.uniform1f(up.uFrost, 0.05);
    drawMesh(meshes.cup);
    gl.uniform1f(up.uFrost, 0.02);
    drawMesh(meshes.lid);

    gl.cullFace(gl.BACK);
    gl.uniform1f(up.uSide, 1);
    gl.uniform1f(up.uFrost, 0.1);
    gl.uniform1f(up.uInkOn, 1);
    gl.uniform1f(up.uDrops, drops ? 1 : 0);
    drawMesh(meshes.cup);
    gl.uniform1f(up.uInkOn, 0);
    gl.uniform1f(up.uDrops, 0);
    gl.uniform1f(up.uFrost, 0.03);
    drawMesh(meshes.lid);
  }

  /* --- Running only while it can be seen ----------------------------------- */
  var visible = false, raf = 0;
  function tick(now) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    try {
      frame(now);
    } catch (err) {
      giveUp();
      return;
    }
    if (!reduce.matches) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(tick); }

  function giveUp() {
    visible = false;
    if (io) io.disconnect();
    section.classList.remove('has-gl');
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  var space = stage.querySelector('.ritual__space');
  stage.insertBefore(canvas, space ? space.nextSibling : stage.firstChild);
  section.classList.add('has-gl');

  var io = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    // a still page gets its frame at once, rather than waiting on a rAF
    // that nothing else on the page is asking the browser for
    if (visible) { if (reduce.matches) tick(performance.now()); else kick(); }
  }, { rootMargin: '15% 0px' });
  io.observe(section);

  // under reduced motion there is no loop: one still frame per scroll or resize
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick, { passive: true });
  document.addEventListener('visibilitychange', kick);
  reduce.addEventListener('change', kick);

  if (fine.matches) {
    stage.addEventListener('pointermove', function (ev) {
      var b = stage.getBoundingClientRect();
      ptr.tx = ((ev.clientX - b.left) / b.width - 0.5) * 2;
      ptr.ty = ((ev.clientY - b.top) / b.height - 0.5) * 2;
      kick();
    });
    stage.addEventListener('pointerleave', function () { ptr.tx = 0; ptr.ty = 0; kick(); });
  }

  canvas.addEventListener('webglcontextlost', function (ev) {
    ev.preventDefault();
    giveUp();
  });
})();
