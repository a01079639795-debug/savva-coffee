/* The location card's flat map. Same OpenStreetMap data as the 3D scene
   (src/map-data.json), drawn top-down and north-up, centred on SAVVA and
   framed to exactly the half-height the WebGL camera starts its flight from,
   so the moment the canvas takes over nothing on the card moves. It is also
   the whole map wherever WebGL is missing.

   Only what the scene shows before its reveal is drawn: the arterials, the
   parks and the mosques. Colours are the scene's own (assets/js/savva-map.js),
   pre-lit the way its shader lights flat ground, so the two read as one
   surface. Keep the two palettes in step. */

const HALF_H = 875;   // metres from SAVVA to the top edge
const HALF_W = 1500;  // 12 : 7, the collapsed card's shape
const LIT = .896;     // the shader's lambert term for an upward face

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const css = (c) => '#' + c.map((v) => Math.round(v * LIT).toString(16).padStart(2, '0')).join('');

const GROUND = hex('#3b3f31'), CREAM = hex('#e3d2bb');
const AREA = [hex('#4b5337'), hex('#51625c')];
const BUILDING = [null, hex('#b9b497'), hex('#dccbad')];
const ROAD_W = [15, 12.5, 10.5, 9, 7];
const ROAD_K = [.64, .57, .49, .42, .37];

function near(p, mx, mz) {
  for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i]) < mx && Math.abs(p[i + 1]) < mz) return true;
  return false;
}
function d(p, close) {
  let s = '';
  for (let i = 0; i < p.length; i += 2) s += (i ? 'L' : 'M') + Math.round(p[i]) + ' ' + Math.round(p[i + 1]);
  return s + (close ? 'Z' : '');
}

function mapSvg(data) {
  const MX = HALF_W + 250, MZ = HALF_H + 250;
  const areas = [[], []], roads = ROAD_W.map(() => []), blds = [[], [], []];
  for (const a of data.areas) { const p = a.slice(1); if (near(p, MX, MZ)) areas[a[0]].push(d(p, true)); }
  for (const r of data.roads) { if (r[0] > 4) continue; const p = r.slice(1); if (near(p, MX, MZ)) roads[r[0]].push(d(p)); }
  for (const b of data.buildings) { if (!b[0]) continue; const p = b.slice(1); if (near(p, MX, MZ)) blds[b[0]].push(d(p, true)); }

  const fill = (list, c) => (list.length ? `<path d="${list.join('')}" fill="${css(c)}"/>` : '');
  // narrow classes first, as in the scene, so the wide roads lie on top
  const streets = roads.map((list, c) => (list.length
    ? `<path d="${list.join('')}" stroke="${css(mix(GROUND, CREAM, ROAD_K[c]))}" stroke-width="${ROAD_W[c]}"/>` : '')).reverse().join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}" preserveAspectRatio="xMidYMid slice">`
    + `<rect x="${-HALF_W * 2}" y="${-HALF_H * 2}" width="${HALF_W * 4}" height="${HALF_H * 4}" fill="${css(GROUND)}"/>`
    + fill(areas[0], AREA[0]) + fill(areas[1], AREA[1])
    + `<g fill="none" stroke-linecap="square" stroke-linejoin="round">${streets}</g>`
    + fill(blds[1], BUILDING[1]) + fill(blds[2], BUILDING[2])
    + '</svg>\n';
}

module.exports = { mapSvg, HALF_H };
