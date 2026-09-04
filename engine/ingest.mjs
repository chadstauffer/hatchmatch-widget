#!/usr/bin/env node
// Catalog ingestion. Pulls a shop's fly collections from the public Shopify
// storefront and writes data/catalog/flies.json: one record per product, one
// clean line per variant (id, SKU, color, size, price, stock, image, url).
//
//   node engine/ingest.mjs                       # The Fly Shop, "flies" collection
//   node engine/ingest.mjs --store https://catalog.theflyshop.com --collections flies,dry-flies --out data/catalog/flies.json
//
// Runs once at onboarding, then nightly for price and stock.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchCollection } from './lib/shopify.mjs';
import { normalizeProduct } from './lib/variants.mjs';

const DEFAULTS = {
  store: 'https://catalog.theflyshop.com',
  collections: 'flies',
  out: 'data/catalog/flies.json',
};

function args(argv) {
  const o = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) o[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

export async function ingest({ store, collections, log = () => {} }) {
  const storeUrl = store.replace(/\/$/, '');
  const handles = String(collections).split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Map();
  for (const handle of handles) {
    const raw = await fetchCollection(storeUrl, handle, { onPage: p => log(`${p.handle} page ${p.page}: ${p.count}`) });
    for (const r of raw) {
      const item = seen.get(r.handle) || normalizeProduct(r, { storeUrl });
      item.collections = [...new Set([...(item.collections || []), handle])];
      seen.set(r.handle, item);
    }
  }
  const products = [...seen.values()].sort((a, b) => a.handle.localeCompare(b.handle));
  return {
    shop: new URL(storeUrl).host,
    storeUrl,
    pulledAt: new Date().toISOString(),
    collections: handles,
    count: products.length,
    variantCount: products.reduce((n, p) => n + p.variants.length, 0),
    products,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = args(process.argv.slice(2));
  const catalog = await ingest({ ...o, log: m => console.error(m) });
  await mkdir(dirname(o.out), { recursive: true });
  await writeFile(o.out, JSON.stringify(catalog, null, 1));
  const oos = catalog.products.flatMap(p => p.variants.filter(v => !v.available)).length;
  console.error(`${catalog.count} products, ${catalog.variantCount} variants (${oos} out of stock) -> ${o.out}`);
}
