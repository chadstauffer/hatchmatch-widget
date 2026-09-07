#!/usr/bin/env node
// Pack resolver. Takes a report fixture (the guide's words) and the ingested
// catalog, and writes the resolved report the card renders from: every pick
// pinned to a real variant id, price, stock and image, with a flag list for
// anything that needed a guess.
//
//   node engine/resolve.mjs data/reports/lower-sacramento-2026-09-01.json
//
// Writes <fixture>.resolved.json and <fixture>.unresolved.md beside the fixture.

import { readFile, writeFile } from 'node:fs/promises';
import { findProduct, colorMatches } from './lib/match.mjs';
import { thumb } from './lib/variants.mjs';
import { buildAddUrl } from './lib/cart.mjs';

const ROLES = [['dry', 'Dry'], ['dropper', 'Dropper'], ['point', 'Point'], ['eggs', 'Eggs']];

function handleFromLink(link) {
  if (!link) return null;
  try { return new URL(link).pathname.split('/').filter(Boolean).pop() || null; } catch { return null; }
}

/** Middle of a size range. Sizes sort by hook number; an even count takes the smaller fly of the two middles (#12–18 -> #16, #14–16 -> #16). */
export function middleSize(sizes) {
  const nums = [...new Set(sizes)].map(s => +String(s).replace('#', '')).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  return '#' + nums[Math.floor(nums.length / 2)];
}

function slimVariant(v) {
  return { id: v.id, sku: v.sku, color: v.color, size: v.size, price: v.price, available: v.available, image: thumb(v.image, 240), url: v.url };
}

export function resolvePick(pick, catalog, aliases) {
  const flags = [];
  const linkHandle = handleFromLink(pick.reportLink);
  // The colour words and the page's own link go in as tiebreaks: several products can share a
  // name ("Stimulator" is three), and the name alone then picks whichever the catalog happens to
  // list first. Neither can outrank a better name match; they only separate equals.
  let found = findProduct(pick.name, catalog, aliases, { colors: pick.colors || [], linkHandle });
  // The words did not match anything, but the page's own link might. Following the shop's link
  // is following the shop, not guessing: "Pheasant Tails" is not in the catalog as written and
  // the page links it to pheasant-tail. Flagged so a guide still sees it.
  if (!found && linkHandle) {
    const linked = catalog.products.find(x => x.handle === linkHandle);
    if (linked) {
      found = { product: linked, method: 'link', score: 1, candidates: [] };
      flags.push({ severity: 'confirm', text: `No catalog product matches "${pick.name}" by name. Resolved by the page's own link to "${linked.title}". Confirm.` });
    }
  }
  if (!found) return { ...pick, status: 'unresolved', flags: [{ severity: 'blocker', text: `No product in the catalog matches "${pick.name}", and the page gives no usable link.` }] };
  const { product, method, score, candidates } = found;
  if (method === 'fuzzy') flags.push({ severity: 'confirm', text: `Matched "${pick.name}" to "${product.title}" by fuzzy match (score ${score.toFixed(2)}). Confirm.`, candidates });
  // Say which signal separated same-named products, and say when nothing did.
  if (found.tiebreak === 'color') flags.push({ severity: 'confirm', text: `Several products are named "${pick.name}". Chose "${product.title}" on the report's own colour word (${(pick.colors || []).join(', ')}). Confirm.`, candidates });
  else if (found.tiebreak === 'link') flags.push({ severity: 'confirm', text: `Several products are named "${pick.name}". Chose "${product.title}" because the page links to it. Confirm.`, candidates });
  else if (found.tied) flags.push({ severity: 'confirm', text: `Several products are named "${pick.name}" and nothing on the page separates them. Showing "${product.title}"; the alternatives are listed. Confirm.`, candidates });

  if (!pick.reportLink) flags.push({ severity: 'nolink', text: 'Named on the page without a link. Resolved by name.' });
  else if (method === 'link') { /* already flagged: the link is what resolved it */ }
  else if (linkHandle !== product.handle) {
    // The words and the link disagree. Never pick silently: show both with prices and let the guide choose.
    const linked = catalog.products.find(p => p.handle === linkHandle);
    const price = p => p ? (p.priceMin === p.priceMax ? `$${p.priceMin.toFixed(2)}` : `$${p.priceMin.toFixed(2)} to $${p.priceMax.toFixed(2)}`) : 'not in the catalog';
    flags.push({
      severity: 'wronglink',
      text: linked
        ? `The page links to "${linked.title}" (${price(linked)}, ${linked.colors.length ? linked.colors.join(', ') : 'one color'}). The words match "${product.title}" (${price(product)}). Resolved to the words; confirm which.`
        : `The page links to "${linkHandle}", which is not in the catalog. Resolved by name to "${product.title}" (${price(product)}).`,
      candidates: [{ handle: product.handle, title: product.title, price: product.priceMin }, ...(linked ? [{ handle: linked.handle, title: linked.title, price: linked.priceMin }] : [])],
    });
  }

  // Narrow variants by the guide's color and size words. If a filter empties the list, drop it and say so.
  let allowed = product.variants;
  if (pick.colors?.length) {
    const byColor = allowed.filter(v => pick.colors.some(c => colorMatches(c, v.color)));
    if (byColor.length) allowed = byColor;
    else flags.push({ severity: 'confirm', text: `Report says ${pick.colors.join(', ')}; the shop carries ${product.colors.join(', ') || 'one color'}. Showing all colors.` });
  }
  if (pick.sizes?.length && product.sizes.length) {
    const bySize = allowed.filter(v => pick.sizes.includes(v.size));
    if (bySize.length) allowed = bySize;
    else flags.push({ severity: 'confirm', text: `Report says ${pick.sizes.join(', ')}; the shop carries ${product.sizes.join(', ')}. Showing all sizes.` });
  }

  // Default variant. Color: the report's first color word, else the shop's first color (flagged; no rule invented).
  // Size: the middle of the range (spec §12), whether the range is the report's or the shop's.
  // When the shop sells color and size as one option ("Tan #14", "Olive #16"), the size rule would change the
  // fly, so it does not apply: first variant, flagged.
  const colorChoices = [...new Set(allowed.map(v => v.color).filter(Boolean))];
  const sizeChoices = [...new Set(allowed.map(v => v.size).filter(Boolean))];
  const combined = product.options.some(o => /colou?r|coloe/i.test(o.name) && /size/i.test(o.name));
  const midSize = combined ? null : middleSize(sizeChoices);
  const order = (v) => {
    const ci = pick.colors?.length ? pick.colors.findIndex(c => colorMatches(c, v.color)) : 0;
    const si = midSize ? (v.size === midSize ? 0 : 1) : 0;
    return (ci < 0 ? 99 : ci) * 100 + si;
  };
  const ranked = [...allowed].sort((a, b) => order(a) - order(b));
  const variant = ranked.find(v => v.available) || ranked[0];
  const label = v => [v.color, v.size].filter(Boolean).join(' ');

  if (combined && allowed.length > 1 && !(pick.colors?.length && pick.sizes?.length)) {
    flags.push({ severity: 'color', text: `Color and size are one option at the shop (${allowed.map(label).join(', ')}). Showing ${label(variant)} first; the rest are chips.` });
  } else {
    if (colorChoices.length > 1 && !pick.colors?.length) flags.push({ severity: 'color', text: `No color on the report. Shop carries ${colorChoices.join(', ')}. Showing ${variant.color} first; the rest are chips.` });
    if (colorChoices.length > 1 && pick.colors?.length > 1) flags.push({ severity: 'info', text: `Report lists ${pick.colors.join(' and ')}. Showing ${variant.color} first; the other is a chip.` });
    if (sizeChoices.length > 1 && !pick.sizes?.length) flags.push({ severity: 'size', text: `No size on the report. Shop carries ${sizeChoices.join(', ')}. Defaulted to the middle, ${variant.size}.` });
    if (sizeChoices.length > 1 && pick.sizes?.length > 1) flags.push({ severity: 'info', text: `Report gives a range (${pick.sizes.join(', ')}). Defaulted to the middle, ${variant.size}; the rest are chips.` });
  }
  if (pick.sizeSource) flags.push({ severity: 'info', text: `Size source: ${pick.sizeSource}.` });
  if (!variant.available) flags.push({ severity: 'stock', text: `Out of stock at the shop right now (${variant.sku}).` });
  if (allowed.some(v => !v.available) && variant.available) flags.push({ severity: 'info', text: `Some options are out of stock: ${allowed.filter(v => !v.available).map(v => [v.color, v.size].filter(Boolean).join(' ')).join(', ')}.` });

  return {
    ...pick,
    status: flags.some(f => ['confirm', 'color', 'size', 'wronglink'].includes(f.severity)) ? 'confirm' : 'resolved',
    matchedBy: method,
    product: { handle: product.handle, title: product.title, vendor: product.vendor, url: product.url, type: product.type },
    variant: slimVariant(variant),
    variants: allowed.map(slimVariant),
    flags,
  };
}

export function resolveReport(fixture, catalog, aliases) {
  const picks = fixture.picks.map(p => resolvePick(p, catalog, aliases));
  const byId = new Map(picks.map(p => [p.id, p]));

  // Substitution: an out-of-stock default variant hands its row to the first in-stock substitute.
  for (const p of picks) {
    if (p.status === 'unresolved') continue;
    if (p.variant.available) continue;
    const alt = (fixture.substitutes?.[p.id] || []).map(id => byId.get(id)).find(s => s && s.variant?.available);
    if (alt) p.substitute = { pickId: alt.id, name: alt.name, reason: `Instead of ${p.name}, out of stock` };
    else p.flags.push({ severity: 'stock', text: 'Out of stock and no in-stock substitute listed.' });
  }

  const unresolved = picks.flatMap(p => p.flags.filter(f => f.severity !== 'info').map(f => ({ pickId: p.id, name: p.name, severity: f.severity, text: f.text, candidates: f.candidates })));
  const prices = picks.filter(p => p.variant).map(p => p.variant.price);
  const at295 = prices.filter(x => x === 2.95).length;
  const observations = [
    `Rating: ${fixture.report.rating}${fixture.report.ratingNote ? `, ${fixture.report.ratingNote}` : ''}.`,
    prices.length ? `Prices from the catalog: ${picks.length} picks run $${Math.min(...prices).toFixed(2)} to $${Math.max(...prices).toFixed(2)}; ${at295} are $2.95.` : null,
    fixture.hatches.some(h => h.sizeSource) ? `Hatch sizes (${fixture.hatches.filter(h => h.size).map(h => `${h.insect} ${h.size}`).join(', ')}) are not on the page. They are placeholders for the guide to set.` : null,
    // Their words, but our choice of which sentence to lift out of the prose -- so it goes in
    // front of them like every other call the matching made.
    (fixture.report.wadingTags || []).length
      ? `FOR THE GUIDE, ${fixture.water.shortName}: the card condenses your wading notes to short phrases -- `
        + fixture.report.wadingTags.map(t => `"${t.phrase}" (from "${t.from}")`).join('; ')
        + `. The phrases are ours and the sentences are yours; confirm each one says what you meant. Your full text is unchanged on the notes tab.`
      : null,
    // Clarity is now read out of their prose rather than left blank, so it goes to them too.
    fixture.report.clarityFrom
      ? `FOR THE GUIDE, ${fixture.water.shortName}: the card reads clarity as "${fixture.report.clarity}" from your own line -- "${fixture.report.clarityFrom}". Confirm that is the word you meant.`
      : null,
    fixture.readOnly ? 'Read-only: the page gives no hatch slots, no roles and no quantities, so this water shows conditions and flies but cannot sell a pack. Nothing here is invented to fill the gap.' : null,
    // The numbers only a person can supply, as ONE ask rather than one per number -- a guide
    // reads this list once, and two separate lines asking them to think about the same water is
    // two chances to answer neither.
    (() => {
      const w = fixture.water, need = [];
      if (w.flow && w.flow.max != null && w.flow.threshold == null)
        need.push(`a wading limit ("wadeable below X CFS"). Until then the card shows where the flow sits in this river's own record for the date and gives no wading verdict, because a verdict with no number behind it is a safety claim we have not earned`);
      if (!w.reportFreshness)
        need.push(`how long a report on this water stays current, and how long before it reads as older. The card is running 14 and 30 days as an INTERIM -- chosen to fit how this page actually reads, not from any standard, and it is a placeholder until you say`);
      return need.length
        ? `FOR THE GUIDE, ${w.shortName}: ${need.length} number${need.length === 1 ? '' : 's'} only you can set -- ${need.join('; and ')}.`
        : null;
    })(),
  ].filter(Boolean);
  // A read-only water has no sections and no quantities, so it has no packs. That is the honest
  // shape of a report nobody has broken out yet, not a failure to compute one.
  const packs = {};
  for (const section of (fixture.water.sections || [])) {
    const items = picks.filter(p => p.status !== 'unresolved' && p.sections.includes(section)).map(p => {
      const use = p.substitute ? byId.get(p.substitute.pickId) : p;
      return { pickId: p.id, variantId: use.variant.id, sku: use.variant.sku, qty: p.qty, price: use.variant.price };
    });
    packs[section] = {
      flies: items.reduce((n, i) => n + i.qty, 0),
      total: +items.reduce((n, i) => n + i.qty * i.price, 0).toFixed(2),
      cartUrl: buildAddUrl(catalog.storeUrl, items, { water: fixture.water.id, report: `${fixture.water.id}-${fixture.report.publishedAt}`, section }),
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    shop: catalog.shop,
    storeUrl: catalog.storeUrl,
    catalogPulledAt: catalog.pulledAt,
    water: fixture.water,
    report: fixture.report,
    hatches: fixture.hatches,
    roles: ROLES.map(([key, label]) => ({ key, label })),
    picks,
    substitutes: fixture.substitutes || {},
    readOnly: !!fixture.readOnly,
    packs,
    summary: {
      picks: picks.length,
      resolved: picks.filter(p => p.status === 'resolved').length,
      confirm: picks.filter(p => p.status === 'confirm').length,
      unresolved: picks.filter(p => p.status === 'unresolved').length,
      priceMin: prices.length ? Math.min(...prices) : null, priceMax: prices.length ? Math.max(...prices) : null,
    },
    unresolved,
    observations,
  };
}

function unresolvedMarkdown(r) {
  const lines = [`# ${r.water.name}, report of ${r.report.publishedAt}: what needs a human`, '',
    `Catalog pulled ${r.catalogPulledAt}. ${r.summary.resolved} picks resolved clean, ${r.summary.confirm} need confirmation, ${r.summary.unresolved} unresolved.`, '',
    '| Pick | Severity | What | Resolved to |', '|---|---|---|---|'];
  for (const p of r.picks) for (const f of p.flags) {
    const to = p.variant ? `${p.product.handle} · ${p.variant.sku} · ${[p.variant.color, p.variant.size].filter(Boolean).join(' ')} · $${p.variant.price.toFixed(2)}` : '—';
    lines.push(`| ${p.name} | ${f.severity} | ${f.text.replace(/\|/g, '/')} | ${to} |`);
  }
  lines.push('', '## Every pick', '', '| Pick | Role | Sections | Variant | SKU | Price | Stock |', '|---|---|---|---|---|---|---|');
  for (const p of r.picks) {
    const v = p.variant;
    lines.push(`| ${p.name} | ${p.role || p.group || '—'} | ${(p.sections || []).join(', ') || '—'} | ${v ? [v.color, v.size].filter(Boolean).join(' ') : '—'} | ${v?.sku || '—'} | ${v ? '$' + v.price.toFixed(2) : '—'} | ${v ? (v.available ? 'in stock' : 'OUT') : '—'} |`);
  }
  if (Object.keys(r.packs).length) {
    lines.push('', '## Pack totals at default quantities (one angler, one day)', '');
    for (const [s, k] of Object.entries(r.packs)) lines.push(`- ${s}: ${k.flies} flies, $${k.total.toFixed(2)}`);
  }
  lines.push('', '## Observations', '');
  for (const o of r.observations) lines.push(`- ${o}`);
  return lines.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixturePath = process.argv[2];
  if (!fixturePath) { console.error('usage: node engine/resolve.mjs <fixture.json> [catalog.json] [aliases.json]'); process.exit(1); }
  const [fixture, catalog, aliases] = await Promise.all([
    readFile(fixturePath, 'utf8').then(JSON.parse),
    readFile(process.argv[3] || 'data/catalog/flies.json', 'utf8').then(JSON.parse),
    readFile(process.argv[4] || 'data/catalog/aliases.json', 'utf8').then(JSON.parse),
  ]);
  const resolved = resolveReport(fixture, catalog, aliases);
  const base = fixturePath.replace(/\.json$/, '');
  await writeFile(`${base}.resolved.json`, JSON.stringify(resolved, null, 1));
  await writeFile(`${base}.unresolved.md`, unresolvedMarkdown(resolved));
  const s = resolved.summary;
  console.error(`${s.resolved} resolved, ${s.confirm} to confirm, ${s.unresolved} unresolved.`
    + (s.priceMin == null ? '' : ` Prices $${s.priceMin.toFixed(2)} to $${s.priceMax.toFixed(2)}.`));
  for (const [name, pack] of Object.entries(resolved.packs)) console.error(`  ${name}: ${pack.flies} flies, $${pack.total.toFixed(2)}`);
  console.error(`-> ${base}.resolved.json, ${base}.unresolved.md`);
}
