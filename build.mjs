#!/usr/bin/env node
// Bundles the widget for the static demo: widget source + every resolved report + Kode Mono +
// the stonefly mark, into one dist/embed.js that works from a plain <script> tag, including from
// file://. In production the reports come from the HatchMatch API and only the renderer ships.
//
//   node build.mjs [report.resolved.json ...]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const reportPaths = args.length ? args
  : (await readdir('data/reports')).filter(f => f.endsWith('.resolved.json')).sort().map(f => `data/reports/${f}`);

const [src, font, stonefly] = await Promise.all([
  readFile('widget/embed.js', 'utf8'),
  readFile('widget/assets/KodeMono.ttf'),
  readFile('widget/assets/stonefly.svg', 'utf8'),
]);
const reports = await Promise.all(reportPaths.map(p => readFile(p, 'utf8').then(JSON.parse)));

// The Lower Sac is the water the card opens on: it is the one a guide has broken out by hatch.
reports.sort((a, b) => (a.water.id === 'lower-sacramento' ? -1 : b.water.id === 'lower-sacramento' ? 1 : a.water.name.localeCompare(b.water.name)));

// Ship only what the card renders. Engine flags and provenance stay in the repo.
const DROP = new Set(['flags', 'asWritten', 'reportLink', 'sizeSource', 'note', 'ratingNote', 'notesPermission', 'substitutesNote', 'candidates', 'matchedBy', 'scaleSource']);
const slim = reports.map(full => {
  const s = JSON.parse(JSON.stringify(full, (k, v) => (DROP.has(k) ? undefined : v)));
  delete s.unresolved; delete s.observations;
  return s;
});

// A stamp that changes on every build. It namespaces the runtime cache, so a cached payload can
// never outlive the code that wrote it, and it cache-busts the demo's script tag, so a rebuild is
// always the thing the browser runs.
const build = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const out = src
  .replace('"__HM_BUILD__"', JSON.stringify(build))
  .replace('"__HM_DATA__"', JSON.stringify(slim))
  .replace('"__HM_FONT__"', JSON.stringify(`data:font/ttf;base64,${font.toString('base64')}`))
  .replace('"__HM_STONEFLY__"', JSON.stringify(stonefly.trim()));

await mkdir('dist', { recursive: true });
await writeFile('dist/embed.js', out);

// The demo is served by python3 -m http.server, which sends no Cache-Control, so a browser will
// happily run a stale bundle. Stamp the harness script tags so a rebuild is always what loads.
for (const page of ['demo/review.html', 'demo/sweep.html', 'demo/measure.html', 'demo/index.html']) {
  try {
    const html = await readFile(page, 'utf8');
    const next = html.replace(/(<script src="\.\.\/dist\/embed\.js)(\?b=[0-9]+)?(")/g, `$1?b=${build}$3`);
    if (next !== html) await writeFile(page, next);
  } catch (e) { /* a page that isn't there yet is not an error */ }
}
console.error(`dist/embed.js build ${build}, ${(out.length / 1024).toFixed(0)} KB (${slim.length} waters, ${(JSON.stringify(slim).length / 1024).toFixed(0)} KB, font ${(font.length / 1024).toFixed(0)} KB)`);
for (const r of slim) console.error(`  ${r.water.shortName.padEnd(11)} ${r.picks.length} picks${r.readOnly ? ', read-only' : ''}`);

// The flag list, for the demo page's "what we found" panel. Their page's problems, next to a card
// that has them right. Built from the Lower Sac, which is the one with a pack to sell.
const full = reports.find(r => r.water.id === 'lower-sacramento') || reports[0];
const flag = sev => full.picks.flatMap(p => p.flags.filter(f => f.severity === sev).map(f => ({ pick: p.name, text: f.text, candidates: f.candidates || null, resolved: p.variant ? `${[p.variant.color, p.variant.size].filter(Boolean).join(' ')} $${p.variant.price.toFixed(2)}` : null })));
const findings = {
  water: full.water.name, publishedAt: full.report.publishedAt, sourceUrl: full.report.source?.url, catalogPulledAt: full.catalogPulledAt,
  counts: full.summary,
  wrongLinks: flag('wronglink'), noLinks: flag('nolink'), color: flag('color'), size: flag('size'), other: flag('confirm'), stock: flag('stock'),
  observations: full.observations || [],
  packs: Object.fromEntries(Object.entries(full.packs).map(([k, v]) => [k, { flies: v.flies, total: v.total }])),
  // Every water, for the "what we found" header: the whole round, not just the pilot river.
  allWaters: reports.map(r => ({ name: r.water.shortName, publishedAt: r.report.publishedAt, rating: r.report.rating,
    picks: r.summary.picks, confirm: r.summary.confirm, unresolved: r.summary.unresolved, readOnly: !!r.readOnly })),
};
await writeFile('demo/findings.js', `window.HM_FINDINGS = ${JSON.stringify(findings, null, 1)};\n`);
const tot = findings.allWaters.reduce((a, w) => ({ picks: a.picks + w.picks, confirm: a.confirm + w.confirm, unresolved: a.unresolved + w.unresolved }), { picks: 0, confirm: 0, unresolved: 0 });
console.error(`demo/findings.js: ${tot.picks} picks across ${findings.allWaters.length} waters, ${tot.confirm} to confirm, ${tot.unresolved} unresolved`);
