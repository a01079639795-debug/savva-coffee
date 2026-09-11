#!/usr/bin/env node
/* Minimal static file server for local preview. Dev-only — not part of the site. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;
// --base=/savva/ serves the site under a project path, the way GitHub Pages
// publishes a repository, so relative URLs can be checked before deploying.
const BASE = ((process.argv.find((a) => a.startsWith('--base=')) || '').slice(7) || '/').replace(/\/?$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (!rel.startsWith(BASE)) {
    if (rel + '/' === BASE) { res.writeHead(301, { Location: BASE }).end(); return; }
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Outside ' + BASE + ': ' + rel);
    return;
  }
  rel = '/' + rel.slice(BASE.length);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      const notFound = path.join(ROOT, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(fs.readFileSync(notFound));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + rel);
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    }).end(data);
  });
}).listen(PORT, () => console.log('SAVVA preview running at http://localhost:' + PORT + BASE));
