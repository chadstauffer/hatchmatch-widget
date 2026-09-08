#!/usr/bin/env node
// Diff every water's rendered card output against its source pane on the shop's page.
//
//   node engine/audit.mjs [--page <file>] [--json]
//
// This is the trust check. A shop owner will read the card river by river the first time they
// see it, against the page they wrote, and every difference has to be one we already know about.
//
// The page side is parsed HERE, independently of engine/scrape.mjs. That is the point: if the
// scraper and the auditor shared a parser they would agree with each other and disagree with the
// page, which is the failure this is meant to catch. It found two that way -- the "Streamers &
// Leeches" sub-head that the scraper's regex never saw because the page writes it "&amp;", and
// the Upper Sac pane running past its own closing tag into the still-water section.
//
// The card side replicates what widget/embed.js actually paints: picks with no variant are
// dropped by useReport(), and a read-only water's groups are the first-appearance order of the
// shop's own sub-heads.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://www.theflyshop.com/streamreport.html';

/* Which pane on the page each water's report came from. */
const PANE = {
  'lower-sacramento': 'lower-sac', 'upper-sacramento': 'upper-sac', 'pit': 'pit-river',
  'trinity': 'trinity-river', 'hat-creek': 'hat-creek', 'klamath': 'klamath-river',
  'mccloud': 'mccloud-river', 'fall-river': 'fall-river',
};
/* Differences we have looked at and decided are correct. Anything not on this list is a finding.
   Each one names the water, the fly and why -- an exemption with no reason is just a silenced bug. */
const KNOWN = {
  'lower-sacramento': 'The pilot. Its report is the guide\'s, not the page\'s: flies group by role (Dry / Dropper / Point / Eggs) rather than by the page\'s sub-heads, and it carries three picks the hot-fly list does not -- Jigged Bird\'s Nest twice (one page line, two colours, both in the pack) and Jig Nation and Eng Thing, which the shop names in its own prose and the fixture marks "notes only".',
  'pit:mayfly-cripples': 'The shop sells this one as a single option that carries the size inside the colour ("Green Drake #12", "Limestone #16"), so the size rule cannot apply without changing the fly. First variant, and the rest are chips.',
  'upper-sacramento:low-water-baetis': 'The page says #18. The shop\'s catalog carries only #20. The card shows what the shop can actually sell and the findings list says so.',
};

const RATINGS = ['Poor', 'Fair', 'Fair to Good', 'Good', 'Great'];
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const strip = h => h.replace(/<[^>]+>/g, '');
const unent = s => s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;/g,"'")
  .replace(/&quot;|&ldquo;|&rdquo;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&hellip;/g,'…')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
const clean = h => unent(strip(h)).replace(/\s+/g,' ').trim();
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function isoDate(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2,'0')}-${String(+m[2]).padStart(2,'0')}`;
}

/** A pane ends where its own div closes, not where the next pane starts. */
function endOfPane(html, start) {
  const re = /<div\b|<\/div\s*>/gi;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[0][1] === '/' ? -1 : 1; if (!depth) return re.lastIndex; }
  return html.length;
}

function pageFlies(block) {
  const i = block.search(/<b>\s*Hot Flies:\s*<\/b>/i);
  if (i < 0) return [];
  const out = [];
  let group = null;
  for (const line of block.slice(i).split(/<BR\s*\/?>/i)) {
    const hm = /<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/i.exec(line);
    if (hm) {
      const t = clean(hm[1]);
      if (/:$/.test(t)) {
        const label = t.slice(0, -1).trim();
        if (label && label.length <= 26 && /^[A-Za-z][A-Za-z '&/]*$/.test(label) && !/hot flies/i.test(label)) group = label;
      }
    }
    const a = /<a\b([^>]*)>([\s\S]*?)<\/a>([\s\S]*)$/i.exec(line);
    let label = null, href = null, trailing = '';
    if (a) {
      const h = /href="([^"]+)"/i.exec(a[1]);
      href = h ? h[1] : null;
      label = clean(a[2]);
      trailing = clean(a[3]).replace(/^[•\s]+/, '').replace(/^[-–]\s*/, '');
    } else if (/^\s*•/.test(clean(line))) label = clean(line).replace(/^[•\s]+/, '');
    if (!label) continue;
    const asWritten = trailing ? `${label} - ${trailing}` : label;
    const m = /^(.*?)\s+[-–]\s+(.+)$/.exec(asWritten);
    out.push({ group, name: (m ? m[1] : asWritten).trim(), qual: m ? m[2].trim() : '', href, asWritten });
  }
  return out;
}

function pagePane(block) {
  const h4 = /<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block);
  const heading = h4 ? clean(h4[1]) : '';
  const lit = /<span class="label label-default-danger"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
  const rating = lit ? clean(lit[1]) : null;
  return { name: heading.split(/\s+-\s+Updated/i)[0].trim(), date: isoDate(heading),
           rating, blocks: rating ? RATINGS.indexOf(rating) + 1 : 0, flies: pageFlies(block) };
}

/** What widget/embed.js paints for this report. */
function cardSide(d) {
  const picks = (d.picks || []).filter(p => p.variant);
  const order = [...new Set(picks.map(p => p.group || 'Hot flies'))];
  return {
    name: d.water.name, date: d.report.publishedAt, rating: d.report.rating,
    blocks: { Poor:1, Fair:2, 'Fair to Good':3, Good:4, Great:5 }[d.report.rating] || 0,
    groups: order, picks, dropped: (d.picks || []).filter(p => !p.variant), readOnly: !!d.readOnly,
  };
}

/** The sizes a "#14-16" style qualifier stands for, every hook in the range. */
function sizesIn(qual) {
  const out = [];
  for (const m of qual.matchAll(/#\s?(\d+)(?:\s*[-–]\s*#?\s?(\d+))?/g)) {
    if (!m[2]) { out.push('#' + +m[1]); continue; }
    const [lo, hi] = [+m[1], +m[2]].sort((a, b) => a - b);
    for (let n = lo; n <= hi; n++) out.push('#' + n);
  }
  return out;
}
const colorsIn = qual => qual.replace(/#\s?\d+(\s*[-–]\s*#?\s?\d+)?/g, '')
  .split(/\s*(?:,|\bor\b|&|\band\b)\s*/i).map(s => s.trim().replace(/^[-–\s]+|[-–\s]+$/g, ''))
  .filter(s => s && s.length < 30 && /[a-z]/i.test(s));

export async function audit(pageHtml) {
  const panes = [...pageHtml.matchAll(/<div class="tab-pane[^"]*"\s+id="([a-z0-9-]+)-report"/gi)];
  const bySlug = new Map(panes.map(p => [p[1], pageHtml.slice(p.index, endOfPane(pageHtml, p.index))]));
  const files = (await readdir(join(ROOT, 'data/reports'))).filter(f => f.endsWith('.resolved.json')).sort();
  const rows = [];
  for (const f of files) {
    const d = JSON.parse(await readFile(join(ROOT, 'data/reports', f), 'utf8'));
    const block = bySlug.get(PANE[d.water.id]);
    if (!block) { rows.push({ water: d.water.id, name: d.water.name, findings: [{ what: 'pane', detail: `No pane named "${PANE[d.water.id]}" on the page.` }] }); continue; }
    const page = pagePane(block), card = cardSide(d);
    const findings = [], checks = [];
    const check = (what, p, c) => { const ok = String(p) === String(c); checks.push({ what, page: p, card: c, ok });
      if (!ok) findings.push({ what, detail: `page "${p}", card "${c}"` }); };
    check('name', page.name, card.name);
    check('report date', page.date, card.date);
    check('rating word', page.rating, card.rating);
    check('lit blocks', page.blocks, card.blocks);
    check('sub-heads', [...new Set(page.flies.map(f => f.group || 'Hot flies'))].join(' | '), card.groups.join(' | '));
    check('fly count', page.flies.length, card.picks.length);
    for (const p of card.dropped) findings.push({ what: 'dropped', detail: `"${p.name}" has no variant and is never rendered.` });

    const used = new Set();
    for (const pf of page.flies) {
      let ci = card.picks.findIndex((p, i) => !used.has(i) && p.asWritten === pf.asWritten);
      if (ci < 0) ci = card.picks.findIndex((p, i) => !used.has(i) && key(p.asWritten) === key(pf.asWritten));
      if (ci < 0) ci = card.picks.findIndex((p, i) => !used.has(i) && key(p.name) === key(pf.name));
      if (ci < 0) ci = card.picks.findIndex((p, i) => !used.has(i) && (key(p.name).includes(key(pf.name)) || key(pf.name).includes(key(p.name))));
      if (ci < 0) { findings.push({ what: 'missing', fly: pf.asWritten, detail: `on the page under "${pf.group || 'Hot flies'}", not on the card.` }); continue; }
      used.add(ci);
      const cp = card.picks[ci], v = cp.variant;
      // The card shows the shop's own product title, so a name difference is only worth
      // reporting when the two are not recognisably the same fly.
      if (key(cp.name) !== key(pf.name) && !key(cp.name).includes(key(pf.name)) && !key(pf.name).includes(key(cp.name)))
        findings.push({ what: 'name', fly: pf.asWritten, id: cp.id, detail: `card calls it "${cp.name}"` });
      if (card.readOnly && (cp.group || 'Hot flies') !== (pf.group || 'Hot flies'))
        findings.push({ what: 'group', fly: pf.asWritten, id: cp.id, detail: `page files it under "${pf.group}", card under "${cp.group}"` });
      if (pf.qual) {
        const sizes = sizesIn(pf.qual), colors = colorsIn(pf.qual);
        if (sizes.length && v.size && !sizes.includes(v.size))
          findings.push({ what: 'size', fly: pf.asWritten, id: cp.id, detail: `page says ${pf.qual}, card shows ${v.size}` });
        if (sizes.length && !v.size)
          findings.push({ what: 'size', fly: pf.asWritten, id: cp.id, detail: `page says ${pf.qual}, card shows no size (${v.color || 'no colour'})` });
        if (colors.length && v.color && !colors.some(c => key(v.color).includes(key(c)) || key(c).includes(key(v.color))))
          findings.push({ what: 'colour', fly: pf.asWritten, id: cp.id, detail: `page says ${colors.join(' / ')}, card shows ${v.color}` });
      }
    }
    card.picks.forEach((p, i) => { if (!used.has(i)) findings.push({ what: 'extra', fly: p.asWritten || p.name, id: p.id, detail: 'on the card, not on the page\'s hot-fly list.' }); });

    // Split into what we have already accounted for and what is new. A whole-water entry covers
    // every difference on that water; a water:pick entry covers just that fly.
    const known = f => KNOWN[d.water.id] || (f.id ? KNOWN[`${d.water.id}:${f.id}`] : null);
    // A check that a known entry covers is not a difference to answer for; mark it so.
    for (const c of checks) if (!c.ok && KNOWN[d.water.id]) c.known = true;
    rows.push({ water: d.water.id, name: card.name, page, card, checks,
      findings: findings.filter(f => !known(f)),
      explained: findings.filter(f => known(f)).map(f => ({ ...f, why: known(f) })) });
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pageArg = process.argv.indexOf('--page');
  const html = pageArg > 0
    ? await readFile(process.argv[pageArg + 1], 'utf8')
    : await (await fetch(SRC, { headers: { 'user-agent': 'Mozilla/5.0 (HatchMatch audit)' } })).text();
  const rows = await audit(html);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  let open = 0;
  for (const r of rows) {
    console.log(`\n${r.name}`);
    for (const c of (r.checks || [])) console.log(`  ${c.ok ? 'ok   ' : c.known ? 'known' : 'DIFF '} ${String(c.what).padEnd(12)} page: ${String(c.page).padEnd(34)} card: ${c.card}`);
    for (const f of r.findings) { open++; console.log(`  DIFF  ${f.what.padEnd(12)} ${f.fly ? f.fly + ' -- ' : ''}${f.detail}`); }
    // Check-level differences are already on the lines above; only the per-fly ones are new here.
    for (const f of (r.explained || [])) if (f.fly) console.log(`  known ${f.what.padEnd(12)} ${f.fly} -- ${f.detail}`);
    if (!r.findings.length) console.log(`  ${(r.explained || []).length ? 'nothing unexplained' : 'clean'}`);
  }
  console.log(`\n${rows.length} waters, ${open} unexplained difference${open === 1 ? '' : 's'}.`);
  process.exit(open ? 1 : 0);
}
