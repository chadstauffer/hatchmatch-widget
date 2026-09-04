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

// The flag list, for the demo page's "what we found" panel. Their page's problems, next to a card that has them right.
const flag = sev => full.picks.flatMap(p => p.flags.filter(f => f.severity === sev).map(f => ({ pick: p.name, text: f.text, candidates: f.candidates || null, resolved: p.variant ? `${[p.variant.color, p.variant.size].filter(Boolean).join(' ')} $${p.variant.price.toFixed(2)}` : null })));
const findings = {
  water: full.water.name, publishedAt: full.report.publishedAt, sourceUrl: full.report.source?.url, catalogPulledAt: full.catalogPulledAt,
  counts: full.summary,
  wrongLinks: flag('wronglink'), noLinks: flag('nolink'), color: flag('color'), size: flag('size'), other: flag('confirm'), stock: flag('stock'),
  observations: full.observations || [],
  packs: Object.fromEntries(Object.entries(full.packs).map(([k, v]) => [k, { flies: v.flies, total: v.total }])),
};
await writeFile('demo/findings.js', `window.HM_FINDINGS = ${JSON.stringify(findings, null, 1)};\n`);
console.error(`demo/findings.js: ${findings.wrongLinks.length} wrong links, ${findings.noLinks.length} without links, ${findings.color.length} colors and ${findings.size.length} sizes to confirm`);
