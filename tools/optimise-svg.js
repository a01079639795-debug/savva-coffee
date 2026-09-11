#!/usr/bin/env node
/* Round path coordinates in the extracted brand SVGs. The source came out of a
   print PDF at four decimals, which is far more precision than a screen needs. */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'assets', 'img');
const FILES = ['savva-wordmark.svg', 'savva-lockup.svg', 'savva-arabic.svg', 'ornament-cup.svg'];

for (const name of FILES) {
  const file = path.join(DIR, name);
  const before = fs.statSync(file).size;
  let svg = fs.readFileSync(file, 'utf8');
  svg = svg.replace(/-?\d+\.\d+/g, (m) => {
    const v = Math.round(parseFloat(m) * 10) / 10;
    return String(v);
  });
  fs.writeFileSync(file, svg);
  console.log(name.padEnd(22) + (before / 1024).toFixed(1) + 'kb → ' + (fs.statSync(file).size / 1024).toFixed(1) + 'kb');
}
