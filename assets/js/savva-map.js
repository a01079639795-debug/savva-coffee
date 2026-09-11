/* ============================================================================
   SAVVA — the location card, on the real map.
   Every street, building, park and landmark drawn here is real: baked from
   OpenStreetMap by tools/fetch-map.js into local metres around SAVVA's Google
   Maps coordinates, and fetched from /assets/data/savva-map.json. Raw WebGL —
   no library, no map tiles, no request to any map service.

   savva.js owns the card (its springs, its open state, the opening hours) and
   announces every change with a `savva:xmap` event; this file owns the camera.
   Opening flies in from exactly the top-down framing the card's flat preview
   shows, while Bir Uthman's streets and blocks rise outward from SAVVA; the
   pin lands on the real coordinates and the small plate with the address
   comes up above it. Without WebGL nothing here runs and the preview stays.
   ========================================================================== */
(function () {
  'use strict';

  var xmap = document.querySelector('[data-xmap]');
  if (!xmap || xmap.classList.contains('has-gl')) return;
  var card = xmap.querySelector('[data-xmap-card]');
  var view = xmap.querySelector('[data-xmap-view]');
  var labelBox = xmap.querySelector('[data-xmap-labels]');
  var marker = xmap.querySelector('[data-xmap-marker]');
  if (!card || !view || !marker || !xmap.dataset.map) return;

  var root = document.documentElement;
  var lang = root.lang === 'ar' ? 'ar' : 'en';
  var lite = root.classList.contains('lite');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var canvas = document.createElement('canvas');
  canvas.className = 'xmap__gl';
  canvas.setAttribute('aria-hidden', 'true');
  var attrs = { alpha: false, antialias: true, depth: true, powerPreference: 'low-power' };
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
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  var rad = function (d) { return d * Math.PI / 180; };
  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var ramp = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
  var inOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* --- Palette: SAVVA's olive ground, cream streets ---------------------- */
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  var C = {
    fog: rgb('#2f3226'), ground: rgb('#3b3f31'), cream: rgb('#e3d2bb'),
    green: rgb('#4b5337'), water: rgb('#51625c'),
    block: rgb('#8d9173'), mosque: rgb('#b9b497'), landmark: rgb('#dccbad')
  };
  // road classes as tools/fetch-map.js numbers them, widest first: the width
  // each is drawn at in metres, and how far its tone leans from olive to cream
  var ROAD_W = [15, 12.5, 10.5, 9, 7, 6, 4.2, 2.6];
  var ROAD_K = [.64, .57, .49, .42, .37, .28, .2, .16];

  /* --- Geometry -------------------------------------------------------------
     One interleaved layout for everything: position, normal, colour, and a
     `detail` flag. Detail is Bir Uthman itself — the side streets, the parks
     and the blocks — which rises outward from SAVVA during the flight; the
     arterials and mosques are the city the camera starts over. */
  var STRIDE = 10, UP = [0, 1, 0];
  function v(out, x, y, z, n, c, d) { out.push(x, y, z, n[0], n[1], n[2], c[0], c[1], c[2], d); }

  function area(p) { var s = 0, n = p.length; for (var i = 0; i < n; i += 2) { var j = (i + 2) % n; s += p[i] * p[j + 1] - p[j] * p[i + 1]; } return s / 2; }

  // ear clipping — outlines here are a handful of points, so O(n²) is plenty
  function earcut(p) {
    var n = p.length / 2, idx = [], out = [], i, guard = 0;
    for (i = 0; i < n; i++) idx.push(i);
    var sgn = area(p) > 0 ? 1 : -1;
    function cross(a, b, c) { return (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) - (p[b * 2 + 1] - p[a * 2 + 1]) * (p[c * 2] - p[a * 2]); }
    function inside(q, a, b, c) { return cross(a, b, q) * sgn >= 0 && cross(b, c, q) * sgn >= 0 && cross(c, a, q) * sgn >= 0; }
    while (idx.length > 3 && guard++ < 4000) {
      var cut = false;
      for (i = 0; i < idx.length; i++) {
        var a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        if (cross(a, b, c) * sgn <= 0) continue;
        var ear = true;
        for (var j = 0; j < idx.length && ear; j++) {
          var q = idx[j];
          if (q !== a && q !== b && q !== c && inside(q, a, b, c)) ear = false;
        }
        if (!ear) continue;
        out.push(a, b, c); idx.splice(i, 1); cut = true; break;
      }
      if (!cut) break;   // a degenerate outline: keep what was clipped
    }
    if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
    return out;
  }

  function polygon(out, p, y, c, d) {
    var t = earcut(p);
    for (var i = 0; i < t.length; i++) v(out, p[t[i] * 2], y, p[t[i] * 2 + 1], UP, c, d);
  }

  // each segment a quad, squared off past both ends so the joints close
  function ribbon(out, p, w, c, d) {
    var h = w / 2;
    for (var i = 2; i < p.length; i += 2) {
      var ax = p[i - 2], az = p[i - 1], bx = p[i], bz = p[i + 1];
      var dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
      if (l < .01) continue;
      dx /= l; dz /= l;
      var nx = -dz * h, nz = dx * h, x0 = ax - dx * h, z0 = az - dz * h, x1 = bx + dx * h, z1 = bz + dz * h;
      v(out, x0 + nx, 0, z0 + nz, UP, c, d); v(out, x0 - nx, 0, z0 - nz, UP, c, d); v(out, x1 + nx, 0, z1 + nz, UP, c, d);
      v(out, x1 + nx, 0, z1 + nz, UP, c, d); v(out, x0 - nx, 0, z0 - nz, UP, c, d); v(out, x1 - nx, 0, z1 - nz, UP, c, d);
    }
  }

  // a footprint stood up as a block: the roof, then one wall per edge with its
  // outward normal (outlines arrive counter-clockwise from the bake)
  function prism(out, p, hgt, c, d) {
    polygon(out, p, hgt, c, d);
    var n = p.length / 2;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n, ax = p[i * 2], az = p[i * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
      var l = Math.hypot(bx - ax, bz - az) || 1, nr = [(bz - az) / l, 0, -(bx - ax) / l];
      v(out, ax, 0, az, nr, c, d); v(out, bx, 0, bz, nr, c, d); v(out, bx, hgt, bz, nr, c, d);
      v(out, ax, 0, az, nr, c, d); v(out, bx, hgt, bz, nr, c, d); v(out, ax, hgt, az, nr, c, d);
    }
  }

  // OpenStreetMap carries no heights for these blocks, so height is a drawing
  // convention read off the footprint — larger plots stand a little taller —
  // not a survey. Mosques read lighter; al-Qiblatayn is the landmark.
  function heightOf(kind, p) {
    var s = Math.sqrt(Math.abs(area(p)));
    if (kind === 2) return 17;
    if (kind === 1) return 6 + Math.min(7, s / 6);
    return 4.5 + Math.min(9, s / 3.2);
  }

  /* --- Shaders ------------------------------------------------------------- */
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute float aDet;',
    'uniform mat4 uVP; uniform vec3 uEye; uniform vec2 uFog; uniform float uReveal;',
    'varying vec3 vCol; varying vec3 vNrm; varying float vFog; varying float vShow;',
    'void main() {',
    '  float d = length(aPos.xz);',
    // detail rises as the reveal front passes it, with a little overshoot
    '  float show = aDet > .5 ? 1. - smoothstep(uReveal - 170., uReveal, d) : 1.;',
    '  vec3 p = aPos; p.y *= show + .16 * sin(show * 3.14159);',
    '  vCol = aCol; vNrm = aNrm; vShow = show;',
    '  vFog = smoothstep(uFog.x, uFog.y, length(p - uEye));',
    '  gl_Position = uVP * vec4(p, 1.);',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float;',
    'uniform vec3 uLight; uniform vec3 uFogCol; uniform vec3 uGround;',
    'varying vec3 vCol; varying vec3 vNrm; varying float vFog; varying float vShow;',
    'void main() {',
    '  float lam = .6 + .4 * max(dot(normalize(vNrm), uLight), 0.);',
    '  vec3 c = mix(uGround, vCol * lam, vShow);',
    '  gl_FragColor = vec4(mix(c, uFogCol, vFog), 1.);',
    '}'
  ].join('\n');

  var prog, loc = {}, layers = [];
  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  function init() {
    var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    ['aPos', 'aNrm', 'aCol', 'aDet'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
    ['uVP', 'uEye', 'uFog', 'uReveal', 'uLight', 'uFogCol', 'uGround'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  var data = null, labels = [];
  function build() {
    var flat = [], solid = [], G = 9000;
    // the ground, then parks and water, then the streets narrow to wide
    v(flat, -G, 0, -G, UP, C.ground, 0); v(flat, G, 0, -G, UP, C.ground, 0); v(flat, G, 0, G, UP, C.ground, 0);
    v(flat, -G, 0, -G, UP, C.ground, 0); v(flat, G, 0, G, UP, C.ground, 0); v(flat, -G, 0, G, UP, C.ground, 0);
    // parks and water are part of the city the flight starts over, as the
    // flat preview draws them, so they never wait for the reveal
    data.areas.forEach(function (a) { polygon(flat, a.slice(1), 0, a[0] ? C.water : C.green, 0); });
    data.roads.forEach(function (r) {
      var c = r[0];
      ribbon(flat, r.slice(1), ROAD_W[c], mix(C.ground, C.cream, ROAD_K[c]), c >= 5 ? 1 : 0);
    });
    data.buildings.forEach(function (b) {
      var k = b[0], p = b.slice(1);
      prism(solid, p, heightOf(k, p), k === 2 ? C.landmark : k ? C.mosque : C.block, k ? 0 : 1);
    });
    layers = [flat, solid].map(function (arr) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return { buf: buf, count: arr.length / STRIDE };
    });
  }

  function makeLabels() {
    if (!labelBox || labels.length) return;
    data.labels.forEach(function (l) {
      var text = l[lang] || l.en;
      if (!text) return;
      var el = document.createElement('span');
      el.className = 'xmap__label xmap__label--' + l.t;
      el.textContent = text;
      if (lang === 'ar') { el.lang = 'ar'; el.dir = 'rtl'; }
      labelBox.appendChild(el);
      labels.push({ el: el, x: l.x, z: l.z });
    });
  }

  /* --- Camera ---------------------------------------------------------------
     Yaw turns the map about SAVVA, pitch tips it from straight down toward
     the horizon, `d` is the camera's distance. The flight starts at the
     preview's own framing — top-down, north up, the half-height given by
     src/map-svg.js — so the moment the canvas takes over is invisible. */
  var FOV = rad(38);
  var HALF = +(xmap.dataset.mapHalf || 875);
  var D0 = HALF / Math.tan(FOV / 2);
  var FLY = 3000, BACK = 900;
  // the camera comes down turning to face south-south-west — toward Sultana
  // Road and al-Qiblatayn — so once it lands the landmarks stand ahead of SAVVA
  var goal = { pitch: rad(56), yaw: rad(-165) };
  var cam = { d: D0, pitch: 0, yaw: 0, sx: 0, sy: 0, reveal: 0 };
  var flight = 0, dir = 0, userYaw = 0, userPitch = 0, wide = false;

  function place(now) {
    var t = flight, e = inOut(t);
    var arrived = smooth(ramp(t, .9, 1));
    var settle = smooth(ramp(t, .3, 1));
    var drift = reduce.matches ? 0 : Math.sin(now / 9000) * rad(4) * arrived;
    wide = cssW >= 480;
    xmap.classList.toggle('is-wide', wide);
    cam.d = Math.exp(Math.log(D0) + (Math.log(wide ? 470 : 540) - Math.log(D0)) * e);
    cam.pitch = Math.max(0, Math.min(rad(66), goal.pitch * smooth(ramp(t, .26, 1)) + userPitch * arrived));
    cam.yaw = goal.yaw * e + (userYaw + drift) * arrived;
    // once pitched, SAVVA settles low — and on a wide card to the left, with
    // the plate beside it — so the streets and names ahead stay clear
    cam.sy = -.22 * settle;
    cam.sx = wide ? -.26 * settle : 0;
    cam.reveal = 1500 * smooth(ramp(t, .42, 1));
    xmap.classList.toggle('is-landed', t > .72);
    xmap.classList.toggle('is-plate', t > .86);
  }

  var vp = ident();
  function draw(now) {
    var w = canvas.width, h = canvas.height;
    if (!w || !h || !layers.length) return;
    place(now);
    var aspect = w / h, d = cam.d;
    var P = perspective(FOV, aspect, Math.max(4, d * .04), d + 9500);
    // slide the whole image in screen space, so SAVVA can sit off-centre
    // while the camera still turns about it
    P[8] -= cam.sx;
    P[9] -= cam.sy;
    var V = mul(trans(0, 0, -d), mul(rotX(Math.PI / 2 - cam.pitch), rotY(cam.yaw)));
    vp = mul(P, V);
    var sp = Math.sin(cam.pitch);
    var eye = [-d * sp * Math.sin(cam.yaw), d * Math.cos(cam.pitch), d * sp * Math.cos(cam.yaw)];

    gl.viewport(0, 0, w, h);
    gl.clearColor(C.fog[0], C.fog[1], C.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(loc.uVP, false, new Float32Array(vp));
    gl.uniform3fv(loc.uEye, eye);
    gl.uniform2f(loc.uFog, d * 1.15, d * 1.15 + Math.max(1500, d * 2.4));
    gl.uniform1f(loc.uReveal, cam.reveal);
    gl.uniform3fv(loc.uLight, [-.52, .74, .43]);
    gl.uniform3fv(loc.uFogCol, C.fog);
    gl.uniform3fv(loc.uGround, C.ground);

    // the ground layers are painted in order, the blocks are depth-tested
    layers.forEach(function (L, i) {
      if (i) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
      var B = STRIDE * 4;
      gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, B, 0);
      gl.enableVertexAttribArray(loc.aNrm); gl.vertexAttribPointer(loc.aNrm, 3, gl.FLOAT, false, B, 12);
      gl.enableVertexAttribArray(loc.aCol); gl.vertexAttribPointer(loc.aCol, 3, gl.FLOAT, false, B, 24);
      gl.enableVertexAttribArray(loc.aDet); gl.vertexAttribPointer(loc.aDet, 1, gl.FLOAT, false, B, 36);
      gl.drawArrays(gl.TRIANGLES, 0, L.count);
    });
    overlay();
  }

  /* --- The DOM layer: pin, plate and street names, on projected points ---- */
  function project(x, y, z) {
    var m = vp;
    var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 1) return null;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    return [(cx / cw * .5 + .5) * cssW, (.5 - cy / cw * .5) * cssH];
  }
  var plate = marker.querySelector('.xmap__plate');
  function overlay() {
    var pin = project(0, 0, 0), box = null;
    if (pin) {
      marker.style.transform = 'translate3d(' + (pin[0] - cssW / 2).toFixed(1) + 'px,' + (pin[1] - cssH / 2).toFixed(1) + 'px,0)';
      marker.style.setProperty('--squash', Math.cos(cam.pitch).toFixed(3));
    }
    // the plate's box on the card, grown a little, once it is up
    if (plate && xmap.classList.contains('is-plate')) {
      var pr = plate.getBoundingClientRect(), cr = card.getBoundingClientRect();
      box = [pr.left - cr.left - 12, pr.top - cr.top - 12, pr.right - cr.left + 12, pr.bottom - cr.top + 12];
    }
    labels.forEach(function (l) {
      var s = project(l.x, 3, l.z), a = 0;
      if (s) {
        var hw = l.hw || (l.hw = l.el.offsetWidth / 2);
        var edge = Math.min(s[0] - hw, cssW - s[0] - hw, s[1] - 18, cssH - s[1] - 30);
        a = smooth(edge / 40);
        // names never cross the pin or the plate
        if (pin) a *= smooth((Math.hypot(s[0] - pin[0], (s[1] - pin[1]) * 1.6) - 60) / 60);
        if (box) {
          var dx = Math.max(box[0] - (s[0] + hw), 0, (s[0] - hw) - box[2]), dy = Math.max(box[1] - s[1], 0, s[1] - box[3]);
          a *= smooth(Math.hypot(dx, dy) / 30);
        }
        l.el.style.transform = 'translate3d(' + s[0].toFixed(1) + 'px,' + s[1].toFixed(1) + 'px,0)';
      }
      l.el.style.opacity = a.toFixed(3);
    });
  }

  /* --- Size, visibility and the frame loop -------------------------------- */
  var cssW = 0, cssH = 0, open = false, visible = true, raf = 0, last = 0;
  function resize() {
    var r = card.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    var dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2);
    var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    if (dir) {
      flight = clamp01(flight + dir * dt / (dir > 0 ? FLY : BACK));
      if (dir < 0) { userYaw *= .9; userPitch *= .9; }
      if (flight === 1 || flight === 0) dir = 0;
    }
    draw(now);
    // a flight or a drag always runs to its end; the slow drift once open
    // only runs while the card is on screen
    var moving = dir !== 0 || dragging || (open && visible && !reduce.matches);
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf && layers.length) raf = requestAnimationFrame(frame); }

  function setOpen(next) {
    open = next;
    if (reduce.matches) { flight = open ? 1 : 0; dir = 0; userYaw = userPitch = 0; }
    else dir = open ? 1 : -1;
    kick();
  }

  /* --- Drag to turn the map ------------------------------------------------
     Sideways drags turn it about SAVVA; on a mouse, up and down tip it. The
     view is pan-y, so on a phone a vertical swipe still scrolls the page. */
  var dragging = null;
  view.addEventListener('pointerdown', function (e) {
    if (!open || flight < .9 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: userYaw, pitch: userPitch, touch: e.pointerType !== 'mouse' };
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    xmap.classList.add('is-dragging');
    kick();
  });
  view.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    userYaw = dragging.yaw + (e.clientX - dragging.x) * .006;
    if (!dragging.touch) userPitch = Math.max(rad(-26), Math.min(rad(9), dragging.pitch - (e.clientY - dragging.y) * .004));
  });
  function release(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging = null;
    xmap.classList.remove('is-dragging');
  }
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);

  /* --- Start --------------------------------------------------------------- */
  function start() {
    if (!init()) return;
    build();
    makeLabels();
    view.insertBefore(canvas, view.firstChild);
    xmap.classList.add('has-gl');
    resize();
    if (xmap.classList.contains('is-open')) setOpen(true);
    else { flight = 0; kick(); }
  }

  xmap.addEventListener('savva:xmap', function (e) { setOpen(!!(e.detail && e.detail.open)); });

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { resize(); kick(); }).observe(card);
  } else {
    window.addEventListener('resize', function () { resize(); kick(); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(card);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = 0; kick(); } });

  // a lost context hands the card back to the flat preview until it returns
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    raf = 0; layers = [];
    xmap.classList.remove('has-gl', 'is-landed', 'is-plate');
  });
  canvas.addEventListener('webglcontextrestored', function () {
    if (init() && data) { build(); xmap.classList.add('has-gl'); kick(); }
  });

  fetch(xmap.dataset.map).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (json) {
    data = json;
    start();
  }).catch(function () { /* the flat preview remains the map */ });
})();
