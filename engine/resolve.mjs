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
  const found = findProduct(pick.name, catalog, aliases);
  if (!found) return { ...pick, status: 'unresolved', flags: [{ severity: 'blocker', text: `No product in the catalog matches "${pick.name}".` }] };
  const { product, method, score, candidates } = found;
  if (method === 'fuzzy') flags.push({ severity: 'confirm', text: `Matched "${pick.name}" to "${product.title}" by fuzzy match (score ${score.toFixed(2)}). Confirm.`, candidates });

  const linkHandle = handleFromLink(pick.reportLink);
  if (!pick.reportLink) flags.push({ severity: 'nolink', text: 'Named on the page without a link. Resolved by name.' });
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
    `Prices from the catalog: ${picks.length} picks run $${Math.min(...prices).toFixed(2)} to $${Math.max(...prices).toFixed(2)}; ${at295} are $2.95.`,
    fixture.hatches.some(h => h.sizeSource) ? `Hatch sizes (${fixture.hatches.filter(h => h.size).map(h => `${h.insect} ${h.size}`).join(', ')}) are not on the page. They are placeholders for the guide to set.` : null,
  ].filter(Boolean);
  const packs = {};
  for (const section of fixture.water.sections) {
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
    packs,
    summary: {
      picks: picks.length,
      resolved: picks.filter(p => p.status === 'resolved').length,
      confirm: picks.filter(p => p.status === 'confirm').length,
      unresolved: picks.filter(p => p.status === 'unresolved').length,
      priceMin: Math.min(...prices), priceMax: Math.max(...prices),
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
    lines.push(`| ${p.name} | ${p.role} | ${p.sections.join(', ')} | ${v ? [v.color, v.size].filter(Boolean).join(' ') : '—'} | ${v?.sku || '—'} | ${v ? '$' + v.price.toFixed(2) : '—'} | ${v ? (v.available ? 'in stock' : 'OUT') : '—'} |`);
  }
  lines.push('', '## Pack totals at default quantities (one angler, one day)', '');
  for (const [s, k] of Object.entries(r.packs)) lines.push(`- ${s}: ${k.flies} flies, $${k.total.toFixed(2)}`);
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
  console.error(`${s.resolved} resolved, ${s.confirm} to confirm, ${s.unresolved} unresolved. Prices $${s.priceMin.toFixed(2)} to $${s.priceMax.toFixed(2)}.`);
  for (const [name, pack] of Object.entries(resolved.packs)) console.error(`  ${name}: ${pack.flies} flies, $${pack.total.toFixed(2)}`);
  console.error(`-> ${base}.resolved.json, ${base}.unresolved.md`);
}
