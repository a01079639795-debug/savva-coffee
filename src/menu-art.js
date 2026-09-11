/* SAVVA menu drawings — one small picture per menu item, so a guest can see at
   a glance what each name is: the vessel it comes in and the colours of what
   is in it. They are drawings on purpose. A stock photograph of some other
   café's latte would be a false picture of SAVVA's; a drawing claims only the
   kind of drink. Wherever SAVVA's own photograph of an item exists it replaces
   the drawing (`photo` on the item in content.js).

   build.js writes every drawing into one sprite, assets/img/menu-art.svg, and
   each menu row points into it with <use>. Flat fills only — no gradients,
   masks or clip paths — so the sprite renders the same when it is referenced
   from another document. Every drawing sits on a 64 × 64 grid. */

const P = {
  ceramic: '#f4ede3', ceramicShade: '#d8c9b3',
  glass: 'rgba(244,237,227,.15)', glassLine: 'rgba(244,237,227,.78)',
  shadow: 'rgba(20,18,13,.3)', straw: '#26221b', print: '#7db446',
  espresso: '#35200f', crema: '#b9814c', cremaDark: '#83532f',
  coffee: '#5a331e', latte: '#b3814f', milk: '#f1e6d2', foam: '#eadcc6',
  condensed: '#efd5a0', matcha: '#86a646', berry: '#7a1c33', hibiscus: '#7a1227',
  tea: '#b5632b', mocha: '#d7b287', choc: '#5a3222', melon: '#f0a45e',
  paper: '#a3b384', crust: '#b07a45'
};

/* --- drawing primitives --------------------------------------------------- */
const n = (v) => Math.round(v * 10) / 10;
const poly = (a, fill) => `<path d="M${a.map((p) => n(p[0]) + ' ' + n(p[1])).join('L')}Z" fill="${fill}"/>`;
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const line = (d, stroke, w, op) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op ? ` opacity="${op}"` : ''}/>`;
const ell = (cx, cy, rx, ry, fill) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"/>`;
const dot = (cx, cy, r, fill) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${fill}"/>`;
const shadow = (w, cx = 32) => ell(cx, 57.6, w, 2.4, P.shadow);
const share = (layers) => layers.reduce((s, l) => s + l[1], 0);

/* --- SAVVA's clear cup: tapered, rolled rim, flat lid, green print ---------
   Cold drinks come in it, as in every one of SAVVA's own photographs. Layers
   fill from the base, as [colour, share] pairs. */
const K = { top: 15, bot: 54, lt: 18, rt: 46, lb: 22, rb: 42 };
function wall(y, inset) {
  const k = (y - K.top) / (K.bot - K.top);
  return [K.lt + (K.lb - K.lt) * k + inset, K.rt + (K.rb - K.rt) * k - inset];
}
function band(y0, y1, fill) {
  const [a0, b0] = wall(y0, 1.2), [a1, b1] = wall(y1, 1.2);
  return poly([[a0, y0], [b0, y0], [b1, y1], [a1, y1]], fill);
}
function ice(y) {
  return [[23.5, y + 1.2, 14], [32.5, y - .6, -18], [27.5, y + 6.4, 26], [35, y + 5.4, 8]].map(([x, yy, a]) =>
    `<rect x="${n(x)}" y="${n(yy)}" width="6.6" height="6.6" rx="1.6" transform="rotate(${a} ${n(x + 3.3)} ${n(yy + 3.3)})" fill="rgba(255,255,255,.26)" stroke="rgba(255,255,255,.6)" stroke-width=".7"/>`).join('');
}
function iced(layers, o = {}) {
  const yb = K.bot - 1.4, yt = yb - (yb - K.top - 1) * (o.fill || .86), total = share(layers);
  let s = shadow(14) + poly([[K.lt, K.top], [K.rt, K.top], [K.rb, K.bot], [K.lb, K.bot]], P.glass);
  let y = yb;
  for (const [c, part] of layers) {
    const h = (yb - yt) * part / total;
    s += band(y - h - .3, y, c);   // the overlap hides hairline seams
    y -= h;
  }
  if (o.ice) s += ice(yt);
  s += line('M27 35h10', P.print, 2.4) + line('M29 38.2h6', P.print, .8, .85);
  s += line('M21 19L23.8 50', 'rgba(255,255,255,.3)', 1.5);
  s += line(`M${K.lt} ${K.top}L${K.lb} ${K.bot}L${K.rb} ${K.bot}L${K.rt} ${K.top}`, P.glassLine, 1);
  if (o.dome) {
    s += path(`M${K.lt + 1} ${K.top}C${K.lt + 3} ${K.top - 10.5} ${K.rt - 3} ${K.top - 10.5} ${K.rt - 1} ${K.top}Z`, o.dome)
      + dot(26, 10.5, .9, 'rgba(255,255,255,.4)') + dot(33, 8.6, 1.1, 'rgba(255,255,255,.35)') + dot(38.5, 11, .8, 'rgba(255,255,255,.4)');
  }
  s += `<rect x="${K.lt - 1.6}" y="${K.top - 1.8}" width="${K.rt - K.lt + 3.2}" height="2.8" rx="1.4" fill="rgba(244,237,227,.5)" stroke="${P.glassLine}" stroke-width=".8"/>`;
  if (o.straw !== false) s += line(`M37 ${K.top - 1}L41.5 3.5`, P.straw, 2.2);
  if (o.top) s += o.top;
  return s;
}

/* --- ceramic: a cup seen three-quarter, its surface an ellipse ------------- */
function cup(surface, top = '') {
  return shadow(20) + ell(32, 51.5, 21, 4.4, P.ceramicShade) + ell(32, 50.6, 18.5, 3.3, P.ceramic)
    + line('M46 34C53.5 33.4 53.6 42.4 43.8 43.4', P.ceramic, 3.2)
    + path('M17 30.5C17 42.5 23.5 49 32 49C40.5 49 47 42.5 47 30.5Z', P.ceramic)
    + path('M39.5 31.4C39.8 41.6 37.1 47.2 32.6 48.9C41 48.6 47 42.2 47 30.5Z', P.ceramicShade)
    + ell(32, 30.5, 15, 4.3, P.ceramic) + ell(32, 30.7, 13.2, 3.3, surface) + top;
}
function mug(surface, top = '') {
  return shadow(16) + line('M43 30C50.5 30 50.5 42 42.6 42.4', P.ceramic, 3.4)
    + path('M19 26L43 26L43 47C43 49.2 41.2 51 39 51L23 51C20.8 51 19 49.2 19 47Z', P.ceramic)
    + path('M37 26L43 26L43 47C43 49.2 41.2 51 39 51L35.5 51C36.8 49.6 37 47.6 37 46Z', P.ceramicShade)
    + ell(31, 26, 12, 3.2, P.ceramic) + ell(31, 26.2, 10.6, 2.5, surface) + top;
}
function demitasse(top = '') {
  return shadow(15) + ell(32, 50, 15, 3.4, P.ceramicShade) + ell(32, 49.3, 13, 2.6, P.ceramic)
    + line('M40.6 39C45 38.8 45.2 44 39.6 44.6', P.ceramic, 2.4)
    + path('M22.5 37C22.5 44 26.6 48 32 48C37.4 48 41.5 44 41.5 37Z', P.ceramic)
    + path('M37 37.6C37.2 43.6 35.4 46.8 32.5 47.9C37.8 47.7 41.5 43.8 41.5 37Z', P.ceramicShade)
    + ell(32, 37, 9.5, 2.8, P.ceramic) + ell(32, 37.2, 8.2, 2.1, P.cremaDark) + ell(32, 37.1, 7, 1.6, P.crema) + top;
}

/* --- a straight glass, layers seen through it ------------------------------ */
function tumbler(top, layers, surface) {
  const x0 = 22.5, x1 = 41.5, bot = 54, floor = bot - 2.6, fillTop = top + 2.2, total = share(layers);
  let s = shadow(12) + poly([[x0, top], [x1, top], [x1, bot], [x0, bot]], P.glass);
  let y = floor;
  for (const [c, part] of layers) {
    const h = (floor - fillTop) * part / total;
    s += poly([[x0 + 1, y - h - .3], [x1 - 1, y - h - .3], [x1 - 1, y], [x0 + 1, y]], c);
    y -= h;
  }
  return s + ell(32, fillTop, 8.5, 1.3, surface)
    + poly([[x0 + 1, floor], [x1 - 1, floor], [x1 - 1, bot - .8], [x0 + 1, bot - .8]], 'rgba(244,237,227,.28)')
    + line(`M${x0 + 2.2} ${top + 4}V${floor - 2}`, 'rgba(255,255,255,.3)', 1.4)
    + line(`M${x0} ${top}V${bot}H${x1}V${top}`, P.glassLine, 1)
    + `<ellipse cx="32" cy="${top}" rx="9.5" ry="1.5" fill="none" stroke="${P.glassLine}" stroke-width=".9"/>`;
}

/* --- SAVVA's green paper cup, for the hot cup of the day -------------------- */
function paperCup() {
  return poly([[20, 19], [40, 19], [37, 54], [23, 54]], P.paper)
    + poly([[35, 19], [40, 19], [37, 54], [33.4, 54]], 'rgba(20,18,13,.12)')
    + path('M22.3 46C26 43.6 31 48 38.4 44.8L37.6 54H23Z', '#ebdfc9')
    + line('M26.2 31.5h7.6', '#f1e6d2', 2) + line('M27.6 34.4h4.8', '#f1e6d2', .7, .9)
    + `<rect x="18.4" y="15.8" width="23.2" height="3.6" rx="1.6" fill="${P.ceramic}"/>`
    + ell(30, 15.8, 9.6, 2.2, '#e9dfcf') + ell(35.2, 15.2, 1.4, .55, P.straw);
}

/* --- plates and slices ------------------------------------------------------ */
const plate = () => shadow(24) + ell(32, 52, 25, 5.4, P.ceramicShade) + ell(32, 51.2, 22.5, 4.2, P.ceramic);

// a wedge cut from a round cake: the top, the outer side, then the cut face
// with its layers from the top down
function wedge(top, back, layers, dec = '') {
  const H = 17, total = share(layers);
  let s = plate()
    + poly([[45, 26.5], [52.5, 31.5], [52.5, 31.5 + H], [45, 26.5 + H]], back)
    + poly([[10, 34], [45, 26.5], [52.5, 31.5]], top);
  let f = 0;
  for (const [c, part] of layers) {
    const f1 = f + part / total;
    s += poly([[10, 34 + H * f], [45, 26.5 + H * f], [45, 26.8 + H * f1], [10, 34.3 + H * f1]], c);
    f = f1;
  }
  return s + dec;
}

function sandwich(filling) {
  const sesame = [[20, 24, -30], [26, 20.4, -12], [33, 19.4, 8], [39.5, 21.6, 24], [45, 26, 38], [23.5, 29, -18], [30, 25.4, 0], [37, 26.6, 16], [42.5, 31, 30], [16.8, 31.6, -38]];
  return shadow(22) + ell(32, 52.6, 23.5, 4.6, '#efe5d3')
    + path('M11 44C11 48.2 15 50.6 21 50.6H43C49 50.6 53 48.2 53 44Z', '#95562a')
    + filling
    + path('M9.5 38.5C12 36 14 40 16.5 37.6C19 35.4 21 39.6 23.6 37.4C26 35.2 28.4 39.6 31 37.3C33.6 35 36 39.6 38.6 37.3C41 35.1 43.4 39.4 46 37.4C48.4 35.5 50.8 38.7 54.5 38L54 41.5H10Z', '#8fc15c')
    + path('M10.5 38C10.5 24 20 16 32 16C44 16 53.5 24 53.5 38Z', '#a4632f')
    + line('M15 34C16.4 25.6 22.6 20.4 31 19.8', '#bd7a41', 2)
    + sesame.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry=".6" transform="rotate(${a} ${x} ${y})" fill="#f3e6cf"/>`).join('');
}

/* --- the menu ------------------------------------------------------------- */
const ART = {
  // hot
  espresso: () => demitasse(),
  americano: () => cup('#6b4428', ell(32, 30.9, 11.8, 2.7, '#2e1a10')),
  cortado: () => tumbler(29, [[P.espresso, 1.1], [P.latte, 1], [P.foam, .5]], P.foam),
  macchiato: () => demitasse(ell(32, 36.7, 3.8, 1.25, P.ceramic) + ell(32.3, 36.3, 2, .6, '#fbf7f1')),
  flatwhite: () => cup(P.latte, ell(32, 30.8, 5.2, 1.5, P.milk) + ell(32, 30.5, 3.2, .95, P.latte) + ell(32, 30.3, 1.6, .5, P.milk)),
  latte: () => tumbler(13, [[P.milk, 2.2], [P.latte, 1.3], [P.foam, .7]], P.foam),
  cappuccino: () => cup('#a87448', ell(32, 30.6, 10.2, 2.4, P.foam)
    + dot(27.6, 30.3, .6, '#7a4a2b') + dot(31.6, 31.2, .55, '#7a4a2b') + dot(35.8, 30.2, .55, '#7a4a2b') + dot(33, 29.6, .45, '#7a4a2b') + dot(29.4, 31.4, .45, '#7a4a2b')),
  spanish: () => tumbler(13, [[P.condensed, .9], [P.latte, 2.3], [P.foam, .6]], P.foam),
  matchalatte: () => cup(P.matcha, ell(30.3, 30.4, 2.4, 1, P.milk) + ell(33.7, 30.4, 2.4, 1, P.milk) + poly([[28, 30.7], [36, 30.7], [32, 32.6]], P.milk)),
  whitemocha: () => cup(P.mocha, line('M22 30.6q2.5 -1.3 5 0t5 0t5 0t5 0', P.ceramic, .7)),
  hotchoc: () => mug(P.choc, ell(27.5, 26, 3, .8, '#a47552') + ell(33.5, 26.5, 2.6, .7, '#a47552') + ell(30.5, 25.4, 1.6, .45, '#a47552')),
  tea: () => cup(P.tea, line('M41.2 29.6C43.6 33 44.6 36 45 40.2', '#ece0cf', .6)
    + `<rect x="42.8" y="40" width="4.6" height="5.2" rx=".8" fill="#e9dcc7"/>` + line('M44 42.2h2.2', P.tea, .8)),
  turkish: () => turkish('#a8784c'),
  turkishmilk: () => turkish('#cda47a'),
  daycoffee: () => `<g transform="translate(22 7) scale(.66)">${iced([[P.coffee, 1]], { ice: true, fill: .82 })}</g>` + shadow(13, 30) + paperCup(),
  v60: () => shadow(15)
    + path('M20 38C20 34 23 32 26 32H38C41 32 44 34 44 38V50C44 52.5 42 54 39.5 54H24.5C22 54 20 52.5 20 50Z', P.glass)
    + path('M21.3 44H42.7V50C42.7 51.8 41.3 52.8 39.5 52.8H24.5C22.7 52.8 21.3 51.8 21.3 50Z', P.coffee)
    + line('M44 37C49.5 37 49.5 47 44 47', P.glassLine, 1.4)
    + line('M20 38C20 34 23 32 26 32H38C41 32 44 34 44 38V50C44 52.5 42 54 39.5 54H24.5C22 54 20 52.5 20 50Z', P.glassLine, 1)
    + line('M32 33V38.6', P.coffee, 1.1)
    + `<rect x="22" y="29.6" width="20" height="2.6" rx="1.1" fill="${P.ceramic}"/>`
    + path('M16 16H48L38.5 30H25.5Z', P.ceramic) + path('M40.5 16H48L38.5 30H35.6Z', P.ceramicShade)
    + line('M24 19.5L27.8 27M32 19.5V27M40 19.5L36.2 27', P.ceramicShade, .8)
    + ell(32, 16, 16, 2.2, P.ceramic) + ell(32, 16.3, 13.6, 1.5, '#5b3a24'),

  // cold, all in SAVVA's clear cup
  'iced-americano': () => iced([[P.espresso, 1]], { ice: true }),
  alfredo: () => iced([['#6b3f24', 2], ['#c89a6a', .8]], { ice: true, fill: .7 }),
  'iced-latte': () => iced([[P.milk, 1.3], ['#c8a07a', .5], [P.coffee, .9]], { ice: true }),
  'iced-spanish': () => iced([[P.condensed, .6], [P.milk, .7], ['#c8a07a', .4], [P.coffee, .8]], { ice: true }),
  'iced-matcha': () => iced([[P.milk, 1.2], ['#b9c78f', .3], [P.matcha, 1]], { ice: true }),
  'iced-matcha-spanish': () => iced([[P.condensed, .55], [P.milk, .8], ['#b9c78f', .25], [P.matcha, .9]], { ice: true }),
  'savva-matcha': () => iced([['#8fb14c', 1]], { ice: true }),
  'matcha-berry': () => iced([[P.berry, .9], [P.milk, .7], [P.matcha, 1]], { top: dot(31, 12.6, 1.8, '#c2324d') + dot(35.4, 12.9, 1.6, '#aa2842') }),
  'iced-tea': () => iced([['#b86a2c', 1]], { ice: true }),
  'iced-hibiscus': () => iced([[P.hibiscus, 1]], { ice: true }),
  'hibiscus-slush': () => iced([[P.hibiscus, 1]], { fill: 1, dome: '#9a1c35' }),
  shaken: () => iced([['#8a5a36', 1.6], ['#d4ae82', .6]], { ice: true, fill: .78 }),
  'iced-whitemocha': () => iced([[P.milk, .8], [P.mocha, 1.3]], { ice: true }),
  'iced-choc': () => iced([['#7c4a31', .6], [P.choc, 1.4]], { ice: true }),
  melon: () => iced([[P.melon, 1]], { fill: 1, dome: '#f6bd83' }),

  // desserts
  cookies: () => plate()
    + ell(32, 46.5, 19, 5.4, '#8e5a2e') + path('M13 43v3.5c0 3 8.5 5.4 19 5.4s19-2.4 19-5.4V43Z', '#8e5a2e') + ell(32, 43, 19, 5.4, '#b98049')
    + path('M16 36.5v3.2c0 2.8 7.6 5 17 5s17-2.2 17-5v-3.2Z', '#8e5a2e') + ell(33, 36.5, 17, 5, '#c58a52')
    + dot(26, 35.6, 1.3, P.espresso) + dot(33, 38, 1.2, P.espresso) + dot(39.5, 35.4, 1.2, P.espresso) + dot(30, 33.5, 1, P.espresso)
    + ell(36, 33.6, 1.6, .8, '#e8cf9c') + ell(24.5, 38, 1.4, .7, '#e8cf9c') + dot(17.6, 44.6, 1, P.espresso) + dot(46.4, 45, 1, P.espresso),
  danish: () => plate() + ell(32, 42, 20, 8.6, '#b5773c') + ell(32, 40.6, 19, 7.6, '#d49a52')
    + line('M32 40.8c2.8 0 3.6 2 1.2 2.8c-3.8 1.2-8-1-6.4-3.6c2-3.2 9.8-3.8 13-.4c3 3.2-1 7-8.4 7c-7.4 0-12.6-3.8-10-8c2.8-4.4 13.4-5.6 19-1.6', '#8e5324', 1.6)
    + line('M17 38.5l5 3l4-4l5 4l4-4.4l5 4l4-3.6l4 2.6', P.ceramic, 1),
  marble: () => plate()
    + path('M44 26C44 20 38.5 17 32 17L35 16C41.5 16 47 19 47 25V49L44 50Z', '#8e5d33')
    + path('M20 50V26C20 20 25.5 17 32 17C38.5 17 44 20 44 26V50Z', P.crust)
    + path('M22 49V27C22 22 26.5 19.5 32 19.5C37.5 19.5 42 22 42 27V49Z', '#ecca8c')
    + line('M25 45C28 41 23 37 27.5 33C31 30 27.5 26 32 23.6C35.8 21.8 39 25 36.2 28C33.4 31 39 34 36 38C33.6 41 37.8 44 35 47', '#6b3e24', 3.2),
  crunchy: () => plate()
    + poly([[14, 36], [25, 41.5], [25, 48.5], [14, 43]], '#4a2819') + poly([[25, 41.5], [51, 35], [51, 42], [25, 48.5]], '#57301e')
    + poly([[14, 36], [40, 30], [51, 35], [25, 41.5]], '#6b3d25')
    + line('M22.7 34L33.7 39.3M31.4 32L42.4 37.3', '#4a2819', .9) + line('M19.5 38.8L45.5 32.5', '#4a2819', .9)
    + [[19, 36.6], [24.5, 38.6], [28, 34.6], [33, 36.8], [37.4, 33.2], [42, 35.4], [46, 34.4], [30.5, 39.6]].map(([x, y]) => dot(x, y, .75, '#d0a26f')).join(''),
  cheesecake: () => wedge('#3f4088', '#e6d7bd', [['#3f4088', .8], ['#f2e6cf', 3.6], ['#b4814d', 1]],
    dot(22, 31, 1.8, '#4d50a3') + dot(28, 29.7, 1.9, '#4d50a3') + dot(36, 28.5, 1.8, '#4d50a3') + dot(31, 31.4, 1.5, '#5a5db3') + dot(43, 30.2, 1.7, '#4d50a3')
    + dot(27.4, 29.1, .5, 'rgba(255,255,255,.5)') + dot(35.4, 27.9, .5, 'rgba(255,255,255,.5)')),
  pecan: () => wedge('#8d5324', '#9c6737', [['#8d5324', .6], ['#b07a45', 2], ['#e6c89a', .5], ['#b07a45', 2]],
    [[20, 31.6, -8], [28.6, 29.8, -12], [37.2, 28.8, -10], [45.6, 30.6, 20]].map(([x, y, a]) =>
      `<g transform="rotate(${a} ${x} ${y})">${ell(x, y, 2.6, 1.25, '#6e3a1f')}${line(`M${x - 1.8} ${y}h3.6`, '#9a5a30', .5)}</g>`).join('')),
  chococake: () => wedge('#2c1710', '#3a1f13', [['#2c1710', .7], ['#4a2819', 2], ['#8a5a3a', .45], ['#4a2819', 2], ['#8a5a3a', .45], ['#4a2819', 1.2]],
    line('M18 32.4L40 27.6', 'rgba(255,255,255,.18)', 1)),

  // breakfast
  'sandwich-turkey': () => sandwich(path('M10 42C13 40.5 16 43.5 19 41.6C22 39.8 25 43.4 28 41.5C31 39.6 34 43.4 37 41.5C40 39.7 43 43.2 46 41.5C49 39.9 52 42.6 54 41.8L53.5 45H10.5Z', '#e3a193')),
  'sandwich-halloumi': () => sandwich(`<rect x="12" y="40.2" width="40" height="4.6" rx="1.4" fill="#f6efe0"/>` + line('M18 41v3.2M26 41v3.2M34 41v3.2M42 41v3.2', '#c89a6a', 1.1))
};

// the Turkish pot beside its cup
function turkish(foam) {
  return shadow(22)
    + line('M50.5 30.5L61 22.5', '#8e5a2e', 2.2)
    + path('M40 47.5C39 41 40.8 36.4 43 33.6L41.8 30.4H52L50.8 33.6C53 36.4 54.8 41 53.8 47.5Z', '#b9773d')
    + path('M49 33.8C50.8 36.6 52.4 41 51.4 47.5H53.8C54.8 41 53 36.4 50.8 33.6Z', '#8e5a2e')
    + ell(46.9, 30.4, 5.2, 1.1, '#d49a52')
    + ell(26, 50.2, 13, 2.8, P.ceramicShade) + ell(26, 49.6, 11, 2.1, P.ceramic)
    + line('M35.2 37.4C39.2 37.6 39 43.2 34.4 43.2', P.ceramic, 2.2)
    + path('M17 34.5H35L33.6 46C33.4 47.6 32.1 48.6 30.5 48.6H21.5C19.9 48.6 18.6 47.6 18.4 46Z', P.ceramic)
    + path('M31 34.5H35L33.6 46C33.4 47.6 32.1 48.6 30.5 48.6H29.4C30.6 47.6 30.8 46.6 30.9 45.6Z', P.ceramicShade)
    + ell(26, 34.5, 9, 2.4, P.ceramic) + ell(26, 34.7, 7.8, 1.8, foam)
    + dot(23.4, 34.5, .55, 'rgba(255,255,255,.45)') + dot(27.6, 35.1, .5, 'rgba(255,255,255,.45)') + dot(29.4, 34.2, .4, 'rgba(255,255,255,.45)');
}

// every drawing leaves a margin for its shadow; the small cups sit lower and
// narrower on the grid, so they are framed tighter to read at the same size
const FRAME = { espresso: '12 17 40 40', macchiato: '12 17 40 40', cortado: '8 12 48 48', turkish: '6 10 52 52', turkishmilk: '6 10 52 52' };

function sprite() {
  return '<svg xmlns="http://www.w3.org/2000/svg">'
    + Object.keys(ART).map((k) => `<symbol id="${k}" viewBox="${FRAME[k] || '4 3 56 56'}">${ART[k]()}</symbol>`).join('')
    + '</svg>\n';
}

module.exports = { sprite, has: (k) => Object.prototype.hasOwnProperty.call(ART, k) };
