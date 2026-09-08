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
  const nOrNull = v => (v == null || v === '' || v === '--' || !Number.isFinite(Number(v))) ? null : Number(v);
  // The per-day rows, kept whole. The scale only needs the columns flattened, but the flow
  // position band needs to know which day of the year each percentile belongs to.
  const days = rows.map(r => ({ m: nOrNull(r.month_nu), d: nOrNull(r.day_nu),
    p10: nOrNull(r.p10_va), p25: nOrNull(r.p25_va), p75: nOrNull(r.p75_va), p90: nOrNull(r.p90_va) }))
    .filter(r => r.m && r.d && r.p10 != null && r.p25 != null && r.p75 != null && r.p90 != null);
  return { rows: rows.length, days, p50: col('p50_va'), p90: col('p90_va'), p95: col('p95_va'), max: col('max_va'),
           beginYr: Math.min(...col('begin_yr')), endYr: Math.max(...col('end_yr')) };
}

/** Every daily mean the gauge has ever published. The statistics service cannot answer the
    question the limit asks -- it reports percentiles per calendar day, so the best it can offer is
    the median across season days of that day's p90, which is "a typical day's high water", not
    "the flow this river exceeds a tenth of its season". On a river with runoff inside the season
    the two are nowhere near each other: measured against the real record that estimator reads 73%
    low on the Upper Sacramento, 68% low on the Trinity, 38% low on the Klamath. So this asks for
    the record itself. One extra request per gauge at scrape time; nothing at runtime. */
export async function dailyValues(site) {
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${site}&parameterCd=00060&statCd=00003&startDT=1900-01-01`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`daily values HTTP ${r.status}`);
  const ts = (await r.json()).value.timeSeries[0];
  if (!ts) throw new Error('no daily record for this site');
  return ts.values[0].value
    .map(x => ({ m: +x.dateTime.slice(5, 7), v: +x.value }))
    .filter(x => Number.isFinite(x.v) && x.v >= 0);
}

/** The wading limit, derived. Through round 7 this was the one number the engine refused to
    compute, on the grounds that a wading call is a person's to make. It still is -- what changed
    is what the number claims. Six hand-set limits turned out to mean six different things: measured
    against each river's own season they landed anywhere from the 35th percentile to the 93rd, so
    "under 7,500 on the Lower Sac" and "under 2,000 on the Pit" were not two readings of one rule,
    and an angler comparing two waters would have been right to notice.

    One rule instead: the flow this river exceeds only a tenth of its own April-October record.
    Every water then fires the same way -- 21 or 22 days a fishing season, on 52 to 116 years of
    daily gauge record each -- and the card can say what the number is rather than assert it.

    That is why the label is HIGH WATER and not WADING LIMIT. This statistic knows how high the
    river is running. It knows nothing about whether you can stand in it: gradient, substrate and
    channel shape are not gauged, and a river can sit at its median and still be unwadeable. The
    lamp stays NORMAL / HIGH, which describes water rather than instructing anglers, and the real
    wading advice stays where it belongs -- in the guide's own notes. A shop that knows better
    still overrides it; applyOverrides() has not changed. */
export const LIMIT_Q = 90;
export const SEASON = [4, 10];               // April-October, generously the fishing season
const pctile = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
/** Round to a step an angler would repeat out loud. A limit reading 13,873 implies a precision
    the underlying judgement does not have. */
const roundLimit = v => { const m = v >= 10000 ? 500 : v >= 2000 ? 100 : v >= 500 ? 50 : v >= 100 ? 10 : 5; return Math.round(v / m) * m; };
export function deriveLimit(values) {
  const seas = values.filter(x => x.m >= SEASON[0] && x.m <= SEASON[1]).map(x => x.v);
  if (seas.length < 365) return null;         // less than a year of season record decides nothing
  return roundLimit(pctile(seas, LIMIT_Q));
}

/** How often a limit actually fires, so the report can show it rather than assert consistency. */
export function limitDays(values, limit) {
  const seas = values.filter(x => x.m >= SEASON[0] && x.m <= SEASON[1]);
  if (!seas.length || limit == null) return null;
  const yrs = new Set(values.map(x => x.y)).size || 1;
  return { over: seas.filter(x => x.v >= limit).length, seasonDays: seas.length, yrs };
}

export const SCALE_Q = 0.70;
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
/** The scale has one more job now than it had in round 3: it has to be able to SHOW the limit.
    Derived from p95 alone, three of six rivers put their own limit at 83-100% of the bar, and at
    100% there is no high side left to light -- the split stops carrying information at exactly the
    reading it exists to mark. So the max is whichever is larger, the season scale or enough
    headroom above the limit. It only ever widens a bar, never narrows one. */
export const LIMIT_HEADROOM = 1.4;
export function deriveScale(stats, limit) {
  if (!stats.p95.length) return null;
  const p95 = quantile(stats.p95, SCALE_Q);
  const seasonMax = niceMax(p95);
  const max = limit == null ? seasonMax : Math.max(seasonMax, niceMax(limit * LIMIT_HEADROOM));
  return { min: 0, max, seasonMax, widenedForLimit: max !== seasonMax, p95, p95Max: Math.max(...stats.p95),
           recordMax: stats.max.length ? Math.max(...stats.max) : null,
           years: `${stats.beginYr}\u2013${stats.endYr}` };
}

/** Where today's reading sits in this river's own record for this time of year.
    Thirty-six buckets -- early, mid and late of each month -- and NOT 366 days, because the card
    says "near normal for early September" and the data has no business being finer than the
    sentence it produces. Each bucket is the median of its days' p10, p25, p75 and p90.
    This is descriptive and measured. It is emphatically not a wading verdict: a river can sit
    dead in the middle of its normal range and still be unsafe to wade, and inventing a threshold
    is the one mistake on this card that could get a person hurt. */
export const THIRD = d => d <= 10 ? 0 : d <= 20 ? 1 : 2;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
export function derivePosition(stats) {
  if (!stats.days || !stats.days.length) return null;
  const buckets = Array.from({ length: 36 }, () => []);
  for (const r of stats.days) buckets[(r.m - 1) * 3 + THIRD(r.d)].push(r);
  // A bucket with no record cannot be filled in from its neighbours: it is reported as null and
  // the card says nothing for that part of the year rather than guessing at it.
  const bands = buckets.map(b => b.length
    ? [median(b.map(r => r.p10)), median(b.map(r => r.p25)), median(b.map(r => r.p75)), median(b.map(r => r.p90))].map(v => Math.round(v))
    : null);
  return bands.some(Boolean) ? { bands, years: `${stats.beginYr}\u2013${stats.endYr}` } : null;
}

/** Precedence: a number a shop or a guide set always beats a derived one. This is the rule, not a
    carve-out for the Lower Sac -- every onboarding will have a water whose owner knows better than
    the record does, and nothing computed may quietly replace what they wrote.
    Returns the flow block to ship, and says which parts came from where. */
export function applyOverrides(derived, override) {
  const shop = (override && override.flow) || null;
  if (!derived && !shop) return null;
  const out = { min: 0, max: null, threshold: null, thresholdLabel: 'high water', ...(derived || {}) };
  const from = { min: derived ? 'derived' : 'default', max: derived ? 'derived' : 'none',
                 threshold: derived && derived.threshold != null ? 'derived' : 'unset' };
  for (const k of ['min', 'max', 'threshold', 'thresholdLabel']) {
    if (shop && shop[k] != null) { out[k] = shop[k]; if (k in from) from[k] = 'shop'; }
  }
  out.source = from;
  return out;
}

/** The one place waters.json is read. A wading limit is a safety number; two copies of one is
    two chances to disagree, so nothing else in the engine may keep its own table of them. */
export async function readOverrides() {
  const { readFile } = await import('node:fs/promises');
  return readFile('data/waters.json', 'utf8').then(t => JSON.parse(t).waters).catch(() => ({}));
}

/** Everything a shop sets that is not the flow block. Shared by the scrape and by --apply so a
    fixture rebuilt either way lands in the same state. */
export function applyWaterFields(water, ov) {
  if (!ov) return water;
  if (ov.sections) water.sections = ov.sections;
  if (ov.packName) water.packName = ov.packName;
  // How long this shop's report on this water stays current. Never derived -- see waters.json.
  if (ov.reportFreshness) water.reportFreshness = ov.reportFreshness;
  return water;
}

/** Where the threshold lands on the scale. Outside 25-75% the split stops informing. */
export function checkThreshold(scale, threshold) {
  if (scale == null || threshold == null) return { ok: null, pct: null };
  const pct = (threshold - scale.min) / (scale.max - scale.min) * 100;
  return { ok: pct >= 25 && pct <= 75, pct };
}

// Gauges only. The thresholds are NOT here: they come from waters.json like everything else
// reads them, so this report can never tell you a limit is fine while the card ships another.
const WATERS = [
  ['lower-sacramento', 'Lower Sacramento', '11370500'],
  ['upper-sacramento', 'Upper Sacramento', '11342000'],
  ['trinity',          'Trinity',          '11525500'],
  ['hat-creek',        'Hat Creek',        '11355500'],
  ['klamath',          'Klamath',          '11516530'],
  ['pit',              'Pit',              '11355010'],
  ['fall-river',       'Fall River',       null      ],
  ['mccloud',          'McCloud',          null      ],
];

/** `npm run scales -- --write` refreshes the position table on every fixture that has a gauge,
    the hand-built Lower Sac included. It is one command rather than a number pasted in by hand,
    because a table nobody knows how to regenerate goes stale silently. */
async function writePositions() {
  const { readFile, writeFile, readdir } = await import('node:fs/promises');
  const dir = 'data/reports';
  const files = (await readdir(dir)).filter(f => /-\d{4}-\d{2}-\d{2}\.json$/.test(f) && !f.includes('resolved'));
  const cache = new Map();
  for (const f of files) {
    const d = JSON.parse(await readFile(`${dir}/${f}`, 'utf8'));
    const site = d.water && d.water.usgsSite;
    if (!site || !d.water.flow) { console.error(`  ${f.padEnd(40)} no gauge, skipped`); continue; }
    try {
      if (!cache.has(site)) cache.set(site, derivePosition(await dailyStats(site)));
      const pos = cache.get(site);
      if (!pos) { console.error(`  ${f.padEnd(40)} no daily statistics`); continue; }
      d.water.flow.position = pos;
      await writeFile(`${dir}/${f}`, JSON.stringify(d, null, 2) + '\n');
      console.error(`  ${f.padEnd(40)} ${pos.bands.filter(Boolean).length}/36 buckets, ${pos.years}`);
    } catch (e) { console.error(`  ${f.padEnd(40)} ! ${e.message}`); }
  }
}

/** `npm run scales -- --apply` pushes waters.json into the built fixtures. Re-scraping would do
    it too, but re-scraping also re-reads the shop's live page, so a one-line threshold edit would
    arrive tangled with whatever they published this morning. A number a guide gave us should be
    able to land on its own. */
async function applyToFixtures() {
  const { readFile, writeFile, readdir } = await import('node:fs/promises');
  const dir = 'data/reports';
  const OVERRIDES = await readOverrides();
  const files = (await readdir(dir)).filter(f => /-\d{4}-\d{2}-\d{2}\.json$/.test(f) && !f.includes('resolved'));
  for (const f of files) {
    const d = JSON.parse(await readFile(`${dir}/${f}`, 'utf8'));
    const ov = OVERRIDES[d.water.id] || null;
    const before = JSON.stringify(d.water.flow || null);
    applyWaterFields(d.water, ov);
    // Recompute the flow block exactly the way the scrape does -- limit, then a scale that can
    // show it, then whatever the shop has written on top.
    const cur = d.water.flow || {};
    let derived = null;
    if (d.water.usgsSite) {
      try {
        const limit = deriveLimit(await dailyValues(d.water.usgsSite));
        const sc = deriveScale(await dailyStats(d.water.usgsSite), limit);
        if (sc) derived = { min: sc.min, max: sc.max, threshold: limit };
      } catch (e) { console.error(`  ${f.padEnd(40)} ! ${e.message}`); }
    }
    const flow = applyOverrides(derived || (cur.max != null ? { min: cur.min, max: cur.max } : null), ov);
    if (flow) d.water.flow = { ...cur, ...flow };
    const fl = d.water.flow, th = fl && fl.threshold;
    const chk = fl && th != null ? checkThreshold(fl, th) : { pct: null };
    const note = th == null ? 'no limit'
      : `${th.toLocaleString()} on ${fl.min.toLocaleString()}-${fl.max.toLocaleString()}, ${chk.pct.toFixed(0)}% of the bar${chk.ok ? '' : '   OUTSIDE 25-75%'}`;
    await writeFile(`${dir}/${f}`, JSON.stringify(d, null, 2) + '\n');
    console.error(`  ${f.padEnd(40)} ${JSON.stringify(d.water.flow) === before ? '     ' : 'wrote'} ${note}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--write')) { await writePositions(); process.exit(0); }
  if (process.argv.includes('--apply')) { await applyToFixtures(); process.exit(0); }
  const OVERRIDES = await readOverrides();
  const out = {};
  for (const [id, name, site] of WATERS) {
    if (!site) { out[id] = { name, gauge: null, note: 'no live gauge on file' }; continue; }
    try {
      const stats = await dailyStats(site);
      const vals = await dailyValues(site);
      const shop = ((OVERRIDES[id] || {}).flow || {}).threshold ?? null;
      const threshold = shop ?? deriveLimit(vals);
      // Report what SHIPS, not what the derivation alone would give: a scale the shop has set
      // moves the tick, and a report that quietly disagrees with the card is worse than none.
      const scale = applyOverrides(deriveScale(stats, threshold), OVERRIDES[id]);
      const chk = checkThreshold(scale, threshold);
      const d = limitDays(vals, threshold);
      out[id] = { name, gauge: site, ...scale, years: `${stats.beginYr}\u2013${stats.endYr}`,
                  threshold, from: shop != null ? 'shop' : 'derived',
                  daysPerSeason: d ? +(d.over / (d.seasonDays / 214)).toFixed(0) : null,
                  thresholdPct: chk.pct, thresholdOk: chk.ok };
    } catch (e) { out[id] = { name, gauge: site, error: e.message }; }
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); }
  else {
    console.log('water                gauge      record         scale max   high water            days/season');
    console.log('-'.repeat(94));
    for (const [id, v] of Object.entries(out)) {
      if (!v.gauge) { console.log(`${v.name.padEnd(20)} ${'--'.padEnd(10)} ${v.note}`); continue; }
      if (v.error) { console.log(`${v.name.padEnd(20)} ${v.gauge.padEnd(10)} ERROR ${v.error}`); continue; }
      const th = v.threshold == null ? 'none' : `${v.threshold.toLocaleString()} @ ${v.thresholdPct.toFixed(0)}% ${v.from}${v.thresholdOk ? '' : '  OUTSIDE 25-75%'}`;
      console.log(`${v.name.padEnd(20)} ${v.gauge.padEnd(10)} ${v.years.padEnd(12)} ${(String(v.max) + (v.widenedForLimit ? '*' : ' ')).padStart(11)}   ${th.padEnd(22)} ${String(v.daysPerSeason ?? '-').padStart(6)}`);
    }
    console.log('\n* scale widened so the bar can show its own limit. days/season is out of 214 (Apr-Oct).');
  }
}
