#!/usr/bin/env node
// Flow scales for the card's segmented bar and sparkline, derived from USGS daily statistics.
//
// Percentile bounds from 80+ years of measured record are data, not invention. The alternative --
// a guide picking a number per river -- is a calendar dependency for something that is measurable.
// What is NOT measurable is the wading threshold: that is a person deciding what is safe, and it
// stays a person's call.
//
//   node engine/scales.mjs [--json]
//
// Rules, per round 3:
//   min is 0 on every river. Floating it to p5 is auto-scaling in a different costume, and zero
//     is a real reference an angler can reason about.
//   max is one number per river, not one per calendar day: a scale that moves with the date is
//     not a fixed scale. WHICH single number is a real trade-off, measured across six gauges:
//       max of p95   storms read beautifully (6 levels) but five of six rivers sit at step 1 in
//                    fishing season, and the Lower Sac's threshold lands at 13%.
//       median p95   the season reads (steps 1-4) but a storm week clips 8 of 14 columns.
//     No percentile satisfies both: the Upper Sac runs 255 CFS in September and 17,500 in a
//     January storm, and six linear steps cannot resolve 69x. We take the 70th percentile of the
//     daily-p95 distribution -- the season is readable, thresholds land inside the band, and a
//     storm clips to "far above normal", which is still the answer to the only question the card
//     asks. A hand-set scale from the shop always wins over a derived one.
//   a threshold, where one exists, should sit between 25% and 75% of the scale. Outside that the
//     two-colour split stops carrying information. Flagged, never silently shipped.

const LADDER = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
/** Round up to the next nice number at this order of magnitude. An absolute step (nearest 5,000)
    cannot serve rivers three orders of magnitude apart: Hat Creek would sit on 0-5,000 forever. */
export function niceMax(v) {
  if (!(v > 0)) return null;
  const e = Math.floor(Math.log10(v)), base = 10 ** e;
  for (const m of LADDER) if (v <= m * base * (1 + 1e-9)) return Math.round(m * base);
  return 10 * base;
}

/** statTypeCd must be `all`. Asking for p10,p25,p50,p75,p90 silently drops p90, and p90 alone
    returns an empty body. Verified from a browser as well as from curl. */
export async function dailyStats(site) {
  const url = `https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=${site}&statReportType=daily&statTypeCd=all&parameterCd=00060`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`stat service HTTP ${r.status}`);
  const lines = (await r.text()).split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length < 3) throw new Error('no statistics for this site');
  const head = lines[0].split('\t');
  const rows = lines.slice(2).map(l => Object.fromEntries(l.split('\t').map((v, i) => [head[i], v])));
  const col = k => rows.map(r => r[k]).filter(v => v != null && v !== '' && v !== '--').map(Number).filter(Number.isFinite);
  return { rows: rows.length, p50: col('p50_va'), p90: col('p90_va'), p95: col('p95_va'), max: col('max_va'),
           beginYr: Math.min(...col('begin_yr')), endYr: Math.max(...col('end_yr')) };
}

export const SCALE_Q = 0.70;
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
export function deriveScale(stats) {
  if (!stats.p95.length) return null;
  const p95 = quantile(stats.p95, SCALE_Q);
  return { min: 0, max: niceMax(p95), p95, p95Max: Math.max(...stats.p95),
           recordMax: stats.max.length ? Math.max(...stats.max) : null,
           years: `${stats.beginYr}\u2013${stats.endYr}` };
}

/** Where the threshold lands on the derived scale. Outside 25-75% the split stops informing. */
export function checkThreshold(scale, threshold) {
  if (scale == null || threshold == null) return { ok: null, pct: null };
  const pct = (threshold - scale.min) / (scale.max - scale.min) * 100;
  return { ok: pct >= 25 && pct <= 75, pct };
}

const WATERS = [
  ['lower-sacramento', 'Lower Sacramento', '11370500', 7500],
  ['upper-sacramento', 'Upper Sacramento', '11342000', null],
  ['trinity',          'Trinity',          '11525500', null],
  ['hat-creek',        'Hat Creek',        '11355500', null],
  ['klamath',          'Klamath',          '11516530', null],
  ['pit',              'Pit',              '11355010', null],
  ['fall-river',       'Fall River',       null,       null],
  ['mccloud',          'McCloud',          null,       null],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const [id, name, site, threshold] of WATERS) {
    if (!site) { out[id] = { name, gauge: null, note: 'no live gauge on file' }; continue; }
    try {
      const stats = await dailyStats(site);
      const scale = deriveScale(stats);
      const chk = checkThreshold(scale, threshold);
      out[id] = { name, gauge: site, ...scale, threshold, thresholdPct: chk.pct, thresholdOk: chk.ok };
    } catch (e) { out[id] = { name, gauge: site, error: e.message }; }
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); }
  else {
    console.log('water                gauge      record        p95      scale max   threshold');
    console.log('-'.repeat(84));
    for (const [id, v] of Object.entries(out)) {
      if (!v.gauge) { console.log(`${v.name.padEnd(20)} ${'--'.padEnd(10)} ${v.note}`); continue; }
      if (v.error) { console.log(`${v.name.padEnd(20)} ${v.gauge.padEnd(10)} ERROR ${v.error}`); continue; }
      const th = v.threshold == null ? 'none' : `${v.threshold.toLocaleString()} @ ${v.thresholdPct.toFixed(0)}%${v.thresholdOk ? ' ok' : '  OUTSIDE 25-75%'}`;
      console.log(`${v.name.padEnd(20)} ${v.gauge.padEnd(10)} ${v.years.padEnd(12)} ${String(Math.round(v.p95)).padStart(8)} ${String(v.max).padStart(11)}   ${th}`);
    }
  }
}
