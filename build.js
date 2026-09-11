#!/usr/bin/env node
/* Builds the SAVVA site: one content model → an English page and an Arabic page.
   Run: node build.js */

const fs = require('fs');
const path = require('path');
const render = require('./src/template.js');
const { site } = require('./src/content.js');
const { mapSvg } = require('./src/map-svg.js');
const menuArt = require('./src/menu-art.js');
const mapData = require('./src/map-data.json');

const ROOT = __dirname;
const IMG = path.join(ROOT, 'assets', 'img');

/* Inline the brand SVGs so they inherit currentColor and cost no extra request. */
function inline(file, cls) {
  const raw = fs.readFileSync(path.join(IMG, file), 'utf8');
  return raw
    .replace(/\s(role|aria-label)="[^"]*"/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);
}

/* The wordmark and lockup are inlined so they take the surrounding text colour.
   The carafe ornament is decorative and single-toned, so it stays an <img>
   rather than adding 25 kB to every page — addressed from the page's own
   folder, like every other URL on the site. */
const svg = {
  wordmark: inline('savva-wordmark.svg', 'mark mark--word'),
  lockup: inline('savva-lockup.svg', 'mark mark--lockup'),
  cup: (base) => `<img class="mark mark--cup" src="${base}assets/img/ornament-cup.svg" alt="" width="113" height="95" loading="lazy" decoding="async">`
};

/* Favicon: the brand olive field with the wordmark's S, cropped from the real
   lettering rather than redrawn. */
function favicon() {
  const word = fs.readFileSync(path.join(IMG, 'savva-wordmark.svg'), 'utf8');
  // the wordmark is one compound path; its first subpath is the S, and the
  // following A interlocks with it, so take the subpath rather than a crop
  const s = word.match(/<path d="([^"]+)"/)[1].split(/(?=M)/).filter(Boolean)[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="#7F8265"/>` +
    `<svg x="14" y="13" width="36" height="38" viewBox="82 591 66 93" preserveAspectRatio="xMidYMid meet">` +
    `<g transform="translate(0,1920) scale(1,-1)" fill="#E3D2BB"><path d="${s}"/></g></svg></svg>`;
}

function write(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('  ' + rel.padEnd(28) + (Buffer.byteLength(data) / 1024).toFixed(1) + ' kb');
}

console.log('SAVVA build → ' + site.url);
if (!process.env.SITE_URL) {
  console.log('  ! SITE_URL not set — canonical/hreflang use the default. See README.');
}

write('index.html', render('en', svg));
write('ar/index.html', render('ar', svg));
write('assets/img/favicon.svg', favicon());

/* The map: the OpenStreetMap bake for the 3D scene, and the same streets drawn
   flat for the collapsed card and for browsers without WebGL. */
write('assets/data/savva-map.json', JSON.stringify(mapData));
write('assets/img/savva-map.svg', mapSvg(mapData));

/* The menu drawings, one sprite every row points into. */
write('assets/img/menu-art.svg', menuArt.sprite());

write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${site.url}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${site.url}/"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${site.url}/ar/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.url}/"/>
  </url>
  <url>
    <loc>${site.url}/ar/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${site.url}/"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${site.url}/ar/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.url}/"/>
  </url>
</urlset>
`);

console.log('done.');
