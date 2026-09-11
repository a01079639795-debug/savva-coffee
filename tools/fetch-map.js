#!/usr/bin/env node
/* Dev-only. Fetches the real streets, buildings and landmarks around SAVVA from
   OpenStreetMap (Overpass API) and bakes them into src/map-data.json: local
   metres around the cafe's Google Maps coordinates, simplified and rounded.
   The build turns that file into the location card's 3D scene and its flat
   fallback, so the site itself never calls a map service.

   Map data © OpenStreetMap contributors, available under the ODbL.

   Run:  node tools/fetch-map.js                  fetch fresh from Overpass
         node tools/fetch-map.js near.json wide.json   bake saved responses */

const fs = require('fs');
const path = require('path');
const { facts } = require('../src/content.js');

const OUT = path.join(__dirname, '..', 'src', 'map-data.json');
const LAT0 = facts.lat, LNG0 = facts.lng;

// metres per degree at this latitude (WGS84 series), so the local plane is
// true to within centimetres across the few kilometres the scene covers
const phi = LAT0 * Math.PI / 180;
const KY = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const KX = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);

const NEAR = 620;   // half-size of the detailed block, metres
const WIDE = 2600;  // half-size of the arterial network the camera flies in over

function bbox(m) {
  const dy = m / KY, dx = m / KX;
  return `${(LAT0 - dy).toFixed(5)},${(LNG0 - dx).toFixed(5)},${(LAT0 + dy).toFixed(5)},${(LNG0 + dx).toFixed(5)}`;
}

const Q_NEAR = `[out:json][timeout:60];(
way["highway"](${bbox(NEAR)});way["building"](${bbox(NEAR)});
way["landuse"](${bbox(NEAR)});way["leisure"](${bbox(NEAR)});way["natural"](${bbox(NEAR)});
node["historic"](${bbox(NEAR + 200)});way["historic"](${bbox(NEAR + 200)}););out body;>;out skel qt;`;

const Q_WIDE = `[out:json][timeout:90];(
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link)$"](${bbox(WIDE)});
way["amenity"="place_of_worship"]["name"](${bbox(WIDE)});way["leisure"="park"](${bbox(WIDE)}););out body;>;out skel qt;`;

async function overpass(q) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'savva-site-build/1.0' },
    body: 'data=' + encodeURIComponent(q)
  });
  if (!res.ok) throw new Error('Overpass ' + res.status);
  return res.json();
}

/* --- geometry helpers ---------------------------------------------------- */
const proj = (n) => [(n.lon - LNG0) * KX, -(n.lat - LAT0) * KY];   // x east, z south

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, az] = pts[a], [bx, bz] = pts[b];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    let far = -1, dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / len;
      if (d > dmax) { dmax = d; far = i; }
    }
    if (far > -1) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// a closed ring's endpoints coincide, which would collapse the line
// simplifier to nothing — so it is split at its far side and done in halves
function simplifyRing(pts, tol) {
  let f = 1;
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[f][0] - pts[0][0], pts[f][1] - pts[0][1])) f = i;
  const out = [...simplify(pts.slice(0, f + 1), tol), ...simplify([...pts.slice(f), pts[0]], tol).slice(1, -1)];
  return out.length >= 3 ? out : pts;
}

const area2 = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
const flat = (pts, dp) => pts.flatMap(([x, z]) => [+x.toFixed(dp), +z.toFixed(dp)]);
const dist = (p) => Math.hypot(p[0], p[1]);
const inside = (pts, lim) => pts.some((p) => Math.abs(p[0]) < lim && Math.abs(p[1]) < lim);

// road classes, widest first — index is what the renderer keys width and tone on
const ROAD = [
  ['motorway', 'trunk'], ['primary'], ['secondary'], ['tertiary'],
  ['motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'],
  ['residential', 'unclassified', 'living_street', 'road'], ['service'],
  ['pedestrian', 'footway', 'path', 'cycleway', 'steps']
];
const roadClass = (h) => ROAD.findIndex((set) => set.includes(h));

// OSM's Arabic names here are sometimes typed with Persian letterforms
// (ی, ک); these are normalised to the Arabic letters, nothing else changes
const arabic = (s) => s && s.replace(/ی/g, 'ي').replace(/ک/g, 'ك').trim();

/* --- the landmarks the scene labels -------------------------------------
   Each is matched on its own OSM tags. A road is often split into many ways,
   some named only in Arabic and some only in English, so both names are
   gathered across every matching way, and the label sits where the road
   passes closest to SAVVA. English drops any trailing gloss after " - ". */
const has = (tg, re) => re.test(tg.name || '') || re.test(tg['name:en'] || '');
const LANDMARKS = [
  { k: 'sultana', t: 'road', match: (tg) => tg.highway && has(tg, /طريق سلطانة|Sultana Road/) },
  { k: 'kingabdullah', t: 'road', match: (tg) => tg.highway && has(tg, /طريق الملك عبدالله|King Abdullah Road/) },
  { k: 'khalid', t: 'road', match: (tg) => tg.highway && /^(trunk|primary|secondary)$/.test(tg.highway) && has(tg, /^خالد بن الوليد$|Khalid Bin Al Waleed/) },
  { k: 'qiblatayn', t: 'place', match: (tg) => tg.amenity === 'place_of_worship' && has(tg, /^مسجد القبلتين$|Qiblatayn/) },
  { k: 'well', t: 'place', match: (tg) => has(tg, /بئر عثمان|Uthman Ibn Affan/) }
];
const LATIN = (s) => s && /[A-Za-z]/.test(s) && !/[؀-ۿ]/.test(s);
const ARABIC = (s) => s && /[؀-ۿ]/.test(s);

function bake(near, wide) {
  const nodes = new Map();
  for (const d of [near, wide]) for (const e of d.elements) if (e.type === 'node') nodes.set(e.id, e);
  const ways = new Map();
  for (const d of [near, wide]) for (const e of d.elements) if (e.type === 'way' && e.tags) ways.set(e.id, e);
  const nearIds = new Set(near.elements.filter((e) => e.type === 'way').map((e) => e.id));

  const roads = [], buildings = [], areas = [];
  const found = new Map();   // landmark key → { en, ar, at, d }

  function offer(L, tg, at, d) {
    const cur = found.get(L.k) || { d: Infinity };
    const names = [tg['name:en'], tg.name, tg['name:ar']];
    const en = cur.en || (names.find(LATIN) || '').split(' - ')[0].trim();
    const ar = cur.ar || arabic(names.find(ARABIC) || '');
    found.set(L.k, d < cur.d ? { en, ar, at, d, t: L.t } : { ...cur, en, ar });
  }

  for (const w of ways.values()) {
    const tg = w.tags;
    let pts = w.nodes.map((id) => nodes.get(id)).filter(Boolean).map(proj);
    if (pts.length < 2) continue;
    const detailed = nearIds.has(w.id);
    const dp = detailed ? 1 : 0;

    for (const L of LANDMARKS) {
      if (!L.match(tg)) continue;
      // roads are labelled where they pass closest to SAVVA; places at their centre
      if (L.t === 'road') {
        const at = pts.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        offer(L, tg, at, dist(at));
      } else {
        const ring = pts.slice(0, -1);
        const at = ring.reduce((a, b) => [a[0] + b[0] / ring.length, a[1] + b[1] / ring.length], [0, 0]);
        offer(L, tg, at, -Math.abs(area2(ring)));   // the largest outline wins
      }
    }

    if (tg.highway) {
      const c = roadClass(tg.highway);
      if (c < 0 || !inside(pts, WIDE)) continue;
      if (!detailed && c > 4) continue;
      pts = simplify(pts, detailed ? .8 : 3);
      roads.push([c, ...flat(pts, dp)]);
      continue;
    }

    const closed = w.nodes[0] === w.nodes[w.nodes.length - 1];
    if (!closed) continue;
    pts = pts.slice(0, -1);
    if (pts.length < 3 || !inside(pts, WIDE)) continue;
    if (area2(pts) < 0) pts.reverse();   // counter-clockwise in x/z, for the triangulator

    // building kind: 0 any building, 1 a mosque, 2 the Qiblatayn landmark.
    // An outline of several hectares tagged as a building is a compound wall
    // traced as one, not a block anyone could stand up — it is left out.
    if (tg.building || tg.amenity === 'place_of_worship') {
      if (!detailed && tg.amenity !== 'place_of_worship') continue;
      if (Math.abs(area2(pts)) / 2 > 20000) {
        console.log(`  skipped w${w.id}: ${Math.round(Math.abs(area2(pts)) / 2)} m² tagged ${JSON.stringify(tg)}`);
        continue;
      }
      const kind = LANDMARKS[3].match(tg) ? 2 : tg.amenity === 'place_of_worship' ? 1 : 0;
      buildings.push([kind, ...flat(pts, 1)]);
    } else if (tg.leisure === 'park' || tg.leisure === 'garden' || /^(grass|orchard|farmland|meadow|village_green)$/.test(tg.landuse || '')) {
      areas.push([0, ...flat(simplifyRing(pts, detailed ? .8 : 3), dp)]);
    } else if (tg.natural === 'water' || tg.landuse === 'reservoir') {
      areas.push([1, ...flat(pts, dp)]);
    }
  }

  // point landmarks
  for (const e of near.elements) {
    if (e.type !== 'node' || !e.tags) continue;
    for (const L of LANDMARKS) if (L.match(e.tags)) offer(L, e.tags, proj(e), 0);
  }

  const labels = LANDMARKS.filter((L) => found.has(L.k)).map((L) => {
    const f = found.get(L.k);
    return { k: L.k, t: f.t, en: f.en, ar: f.ar, x: Math.round(f.at[0]), z: Math.round(f.at[1]) };
  });

  roads.sort((a, b) => b[0] - a[0]);   // narrow first, so wide roads paint over them
  return {
    source: '© OpenStreetMap contributors, ODbL — ' + new Date().toISOString().slice(0, 10),
    origin: [LAT0, LNG0],
    roads, buildings, areas, labels
  };
}

(async () => {
  const [a, b] = process.argv.slice(2);
  const near = a ? JSON.parse(fs.readFileSync(a, 'utf8')) : await overpass(Q_NEAR);
  const wide = b ? JSON.parse(fs.readFileSync(b, 'utf8')) : await overpass(Q_WIDE);
  const data = bake(near, wide);
  const json = JSON.stringify(data);
  fs.writeFileSync(OUT, json);
  console.log(`map → ${path.relative(process.cwd(), OUT)}  ${(json.length / 1024).toFixed(1)} kb`);
  console.log(`  ${data.roads.length} roads, ${data.buildings.length} buildings, ${data.areas.length} areas`);
  for (const l of data.labels) console.log(`  ${l.k.padEnd(13)} ${String(Math.round(Math.hypot(l.x, l.z))).padStart(5)} m  ${l.en} / ${l.ar}`);
})().catch((e) => { console.error(e); process.exit(1); });
