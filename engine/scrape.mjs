#!/usr/bin/env node
// theflyshop.com/streamreport.html -> one fixture per regional river.
//
//   node engine/scrape.mjs [--page <file>] [--out data/reports]
//
// The page is uniformly structured, so this reads it rather than transcribing it:
//
//   <div class="tab-pane fade" id="hat-creek-report">
//     <h4>Hat Creek - Updated:&nbsp;September 1, 2026</h4>
//     <p><b>Fishing conditions:</b> <span class="label label-default">Poor</span> …
//        <span class="label label-default-danger">Fair to Good</span> …</p>   <- the live rating
//     <div class="report"><b>Report:</b>&nbsp;<prose></div>
//     <div><b>Hot Flies:</b><BR>
//       • <a href="https://catalog.theflyshop.com/…">Lance's Jigged X-May</a><BR>
//       • <a>BP Weiss Nymph</a><BR>            <- named without a link
//     </div>
//   </div>
//
// Nothing is written for the shop. Hatch slots, quantities and roles are the guide's to supply
// and are absent here: these fixtures are read-only until someone sets them.

import { readFile, writeFile } from 'node:fs/promises';
import { dailyStats, deriveScale, applyOverrides } from './scales.mjs';

const SRC = 'https://www.theflyshop.com/streamreport.html';

/* The eight regional rivers, with the gauge each was confirmed against on the NWIS site service.
   Fall River and the McCloud have USGS sites but no real-time series at any of them, so they
   carry null rather than a plausible-looking guess.
   The page carries 26 report panes in all -- Baum Lake, Iron Canyon, Manzanita, Pyramid,
   Bollibokka, Circle7, Oasis Springs and the rest. They parse with the same code; adding one is
   one entry in this map. Out of scope for this round by decision, not by capability. */
export const WATERS = {
  'fall-river':       { id: 'fall-river',       shortName: 'Fall River', group: 'river', usgsSite: null,       gaugeName: null,             lat: 41.0075, lon: -121.4469, gaugeNote: 'No live USGS gauge. Sites exist at Fall River Mills; none reports a real-time series.' },
  'hat-creek':        { id: 'hat-creek',        shortName: 'Hat Creek',  group: 'river', usgsSite: '11355500', gaugeName: 'USGS Hat Creek', lat: 40.6891, lon: -121.4228 },
  'klamath-river':    { id: 'klamath',          shortName: 'Klamath',    group: 'river', usgsSite: '11516530', gaugeName: 'USGS Iron Gate', lat: 41.9279, lon: -122.4442 },
  'mccloud-river':    { id: 'mccloud',          shortName: 'McCloud',    group: 'river', usgsSite: null,       gaugeName: null,             lat: 41.1252, lon: -122.0686, gaugeNote: 'No live USGS gauge. Fourteen sites on the river; none reports a real-time series.' },
  'pit-river':        { id: 'pit',              shortName: 'Pit',        group: 'river', usgsSite: '11355010', gaugeName: 'USGS Pit No 1',  lat: 40.9832, lon: -121.5119 },
  'trinity-river':    { id: 'trinity',          shortName: 'Trinity',    group: 'river', usgsSite: '11525500', gaugeName: 'USGS Lewiston',  lat: 40.7247, lon: -122.8011 },
  'upper-sac':        { id: 'upper-sacramento', shortName: 'Upper Sac', group: 'river', usgsSite: '11342000', gaugeName: 'USGS Delta', lat: 40.9396, lon: -122.4172 },
};
const GUIDE_PHONE = '800-669-3474';

const strip = h => h.replace(/<[^>]+>/g, '');
const unent = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const clean = h => unent(strip(h)).replace(/\s+/g, ' ').trim();

/** "September 1, 2026" -> "2026-09-01". Never guessed: a block without a parseable date is skipped. */
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export function isoDate(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  if (mo < 0) return null;
  return `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}

/** A fly line is "• <a href>Name</a> - qualifier<BR>". The qualifier is the guide's own words for
    colour and size; it is split, never interpreted beyond splitting. */
export function parseQualifier(text) {
  // The separator must have whitespace on both sides. "Ho-bo Spey" and "Dry-dropper" carry their
  // own hyphens, and splitting on the first one turns that fly into "Ho" in colour "bo Spey".
  const m = /^(.*?)\s+[-–]\s+(.+)$/.exec(text);
  if (!m) return { name: text.trim(), colors: [], sizes: [] };
  const name = m[1].trim(), rest = m[2].trim();
  const sizes = [...rest.matchAll(/#\s?(\d+)(?:\s*[-–]\s*#?\s?(\d+))?/g)].flatMap(s => {
    const a = +s[1], b = s[2] ? +s[2] : null;
    if (b == null) return ['#' + a];
    // Step two from the low end rather than keeping even numbers: hook sizes usually run even,
    // but "#13-17" is the shop's business, not ours to round.
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const out = [];
    for (let n = lo; n <= hi; n += 2) out.push('#' + n);
    return out;
  });
  const colors = rest.replace(/#\s?\d+(\s*[-–]\s*\d+)?/g, '').split(/\s*(?:,|\bor\b|&|\band\b)\s*/i)
    .map(s => s.trim().replace(/^[-–\s]+|[-–\s]+$/g, '')).filter(s => s && s.length < 30 && /[a-z]/i.test(s));
  return { name, colors, sizes };
}

export function parsePage(html) {
  const out = [];
  // Each water is one tab pane. Split on the opening tag so a block ends where the next begins.
  const panes = [...html.matchAll(/<div class="tab-pane[^"]*"\s+id="([a-z0-9-]+)-report"/gi)];
  panes.forEach((p, i) => {
    const slug = p[1];
    const water = WATERS[slug];
    if (!water) return;                       // stillwaters and private waters are out of scope
    const block = html.slice(p.index, i + 1 < panes.length ? panes[i + 1].index : html.length);

    const h4 = /<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block);
    const heading = h4 ? clean(h4[1]) : '';
    const name = heading.split(/\s+-\s+Updated/i)[0].trim();
    const publishedAt = isoDate(heading);

    // The live rating is the one label the page marks differently. No fallback: a block whose
    // rating we cannot read gets null and the card says "not rated" rather than guessing.
    const lit = /<span class="label label-default-danger"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const rating = lit ? clean(lit[1]) : null;

    const rep = /<div class="report">([\s\S]*?)<\/div>/i.exec(block);
    const notes = rep
      ? clean(rep[1].replace(/<b>\s*Report:\s*<\/b>/i, '')).split(/(?<=[.!?])\s{2,}/).map(s => s.trim()).filter(Boolean)
      : [];

    // Hot flies: every bullet in the block after the "Hot Flies:" marker. Sub-heads such as
    // "Eggs:" / "Nymphs:" are the shop's own grouping and are carried through as written.
    const hotIdx = block.search(/<b>\s*Hot Flies:\s*<\/b>/i);
    const picks = [];
    if (hotIdx >= 0) {
      const hot = block.slice(hotIdx);
      let group = null;
      for (const line of hot.split(/<BR\s*\/?>/i)) {
        // Sub-heads are <strong> on this page, and one of them is "Nymphs/Wet Flies:".
        const head = /<(?:b|strong)>\s*([A-Za-z][A-Za-z '&/]{2,26}):\s*<\/(?:b|strong)>/i.exec(line);
        if (head && !/hot flies/i.test(head[1])) group = clean(head[1]);
        const a = /<a\b([^>]*)>([\s\S]*?)<\/a>([\s\S]*)$/i.exec(line);
        let label, href = null, trailing = '';
        if (a) {
          const h = /href="([^"]+)"/i.exec(a[1]);
          href = h ? h[1] : null;
          label = clean(a[2]);
          trailing = clean(a[3]).replace(/^[•\s]+/, '');
        } else if (/^\s*•/.test(clean(line)) || /^\s*•/.test(line)) {
          // The page has at least one bullet whose anchor is inside out:
          // "• Copper John Red</a> - #10-14<a>". Recover the fly rather than dropping it.
          label = clean(line).replace(/^[•\s]+/, '');
        }
        if (!label) continue;
        const { name: flyName, colors, sizes } = parseQualifier(trailing ? `${label} - ${trailing}` : label);
        if (!flyName) continue;
        picks.push({
          id: null, group, name: flyName, colors, sizes, reportLink: href,
          asWritten: label + (trailing ? ` - ${trailing}` : ''),
        });
      }
    }
    // Stable ids from the name, deduplicated.
    const seen = new Map();
    for (const pk of picks) {
      const base = pk.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'fly';
      const n = (seen.get(base) || 0) + 1; seen.set(base, n);
      pk.id = n === 1 ? base : `${base}-${n}`;
    }

    out.push({
      note: `Scraped from ${SRC} by engine/scrape.mjs. The guide's words only. Hatch slots, quantities and roles are the guide's to supply and are absent: this water is read-only until someone sets them.`,
      water: { ...water, name, packName: null, flow: null, sections: [], guidePhone: GUIDE_PHONE, closed: false },
      report: { publishedAt, author: null, rating, clarity: null, wading: null, notes,
                notesPermission: 'pending', source: { url: SRC, fetchedAt: new Date().toISOString().slice(0, 10) } },
      hatches: [], readOnly: true, picks, substitutes: {},
    });
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pageArg = process.argv.indexOf('--page');
  const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'data/reports';
  const html = pageArg > 0
    ? await readFile(process.argv[pageArg + 1], 'utf8')
    : await (await fetch(SRC, { headers: { 'user-agent': 'Mozilla/5.0 (HatchMatch fixture builder)' } })).text();
  const reports = parsePage(html);
  console.error(`${reports.length} regional rivers parsed from ${html.length.toLocaleString()} bytes\n`);
  // Scale from measured record, then let anything a shop or guide has set override it. The
  // wading threshold is never derived: that is a person deciding what is safe.
  const OVERRIDES = await readFile('data/waters.json', 'utf8').then(t => JSON.parse(t).waters).catch(() => ({}));
  for (const r of reports) {
    const ov = OVERRIDES[r.water.id] || null;
    if (ov) {
      if (ov.sections) r.water.sections = ov.sections;
      if (ov.packName) r.water.packName = ov.packName;
    }
    let sc = null;
    if (r.water.usgsSite) {
      try { sc = deriveScale(await dailyStats(r.water.usgsSite)); }
      catch (e) { console.error(`  ! ${r.water.shortName}: scale unavailable (${e.message})`); }
    }
    const flow = applyOverrides(sc ? { min: sc.min, max: sc.max } : null, ov);
    if (flow) {
      r.water.flow = { ...flow, lastReading: { value: 0, at: new Date().toISOString() } };
      if (sc) r.water.flow.scaleSource = `USGS daily statistics ${sc.years}, ${Math.round(sc.p95).toLocaleString()} CFS at the 70th percentile of daily p95, rounded up`;
    }
  }
  for (const r of reports) {
    const file = `${outDir}/${r.water.id}-${r.report.publishedAt}.json`;
    await writeFile(file, JSON.stringify(r, null, 2) + '\n');
    const noLink = r.picks.filter(p => !p.reportLink).length;
    const f = r.water.flow;
    const sc = f && f.max != null ? `0-${f.max.toLocaleString()}${f.source && f.source.max === 'shop' ? '*' : ''}` : 'no scale';
    console.error(`  ${r.water.shortName.padEnd(11)} ${String(r.report.publishedAt).padEnd(11)} ${String(r.report.rating || 'no rating').padEnd(13)} ${String(r.picks.length).padStart(2)} flies` +
      (noLink ? `, ${noLink} unlinked` : '').padEnd(13) + ` ${sc.padEnd(10)} -> ${file}`);
  }
}
