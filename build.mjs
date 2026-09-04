#!/usr/bin/env node
// Bundles the widget for the static demo: widget source + the resolved report
// + Kode Mono + the stonefly mark, into one dist/embed.js that works from a
// plain <script> tag, including from file://. In production the report comes
// from the HatchMatch API and only the renderer ships.
//
//   node build.mjs [report.resolved.json]

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const reportPath = process.argv[2] || 'data/reports/lower-sacramento-2026-09-01.resolved.json';
const [src, reportText, font, stonefly] = await Promise.all([
  readFile('widget/embed.js', 'utf8'),
  readFile(reportPath, 'utf8'),
  readFile('widget/assets/KodeMono.ttf'),
  readFile('widget/assets/stonefly.svg', 'utf8'),
]);

// Ship only what the card renders. Engine flags and provenance stay in the repo.
const full = JSON.parse(reportText);
const DROP = new Set(['flags', 'asWritten', 'reportLink', 'sizeSource', 'note', 'ratingNote', 'notesPermission', 'substitutesNote', 'candidates', 'matchedBy']);
const slim = JSON.parse(JSON.stringify(full, (k, v) => (DROP.has(k) ? undefined : v)));
delete slim.unresolved;

const out = src
  .replace('"__HM_DATA__"', JSON.stringify(slim))
  .replace('"__HM_FONT__"', JSON.stringify(`data:font/ttf;base64,${font.toString('base64')}`))
  .replace('"__HM_STONEFLY__"', JSON.stringify(stonefly.trim()));

await mkdir('dist', { recursive: true });
await writeFile('dist/embed.js', out);
console.error(`dist/embed.js ${(out.length / 1024).toFixed(0)} KB (report ${(JSON.stringify(slim).length / 1024).toFixed(0)} KB, font ${(font.length / 1024).toFixed(0)} KB)`);
