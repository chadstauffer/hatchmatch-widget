// Resolve a guide's words to a catalog product.
// Order: alias table -> exact normalized title -> fuzzy token match (scored, flagged for confirmation).

const STOP = new Set(['the', 'a', 'an', 'fly', 'flies', 'nymph', 'nymphs', 'pattern']);
const COLOR_ALIASES = {
  bwo: 'blue wing olive', baetis: 'blue wing olive', pmd: 'pale morning dun',
  dark: 'natural dark', hotspot: 'hot spot', cb: 'copper bead', gb: 'gold bead', tb: 'tungsten bead',
};

export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']s\b/g, '')          // Mercer's -> mercer
    .replace(/[’']n[’']?\b/g, 'n')    // Peaches 'n Cream -> peaches n cream
    .replace(/&/g, ' and ')
    .replace(/#\s*\d+(\s*(-|to)\s*\d+)?/g, ' ')  // drop sizes
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w))
    .join(' ')
    .trim();
}

export function normalizeColor(s) {
  if (!s) return null;
  const n = String(s).toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COLOR_ALIASES[n] || n;
}

/** Does a variant's color satisfy the guide's word? "Dark" matches "Natural Dark"; "BWO" matches "Blue Wing Olive". */
export function colorMatches(want, have) {
  if (!want) return true;
  if (!have) return false;
  const w = normalizeColor(want), h = normalizeColor(have);
  return w === h || h.includes(w) || w.includes(h);
}

function tokens(s) { return new Set(normalizeName(s).split(' ').filter(Boolean)); }

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * @param {string} name  the guide's words, e.g. "Jigged Birds Nest"
 * @param {object} catalog  { products: [...] } from ingest
 * @param {object} aliases  { patterns: [{ name, handle, aliases: [] }] }
 * @returns {{ product, method: 'alias'|'exact'|'fuzzy', score, candidates }|null}
 */
export function findProduct(name, catalog, aliases, { minScore = 0.6, handle } = {}) {
  const byHandle = new Map(catalog.products.map(p => [p.handle, p]));
  if (handle && byHandle.has(handle)) return { product: byHandle.get(handle), method: 'handle', score: 1, candidates: [] };

  const q = normalizeName(name);
  for (const pat of aliases?.patterns || []) {
    const names = [pat.name, ...(pat.aliases || [])].map(normalizeName);
    if (names.includes(q) && byHandle.has(pat.handle)) {
      return { product: byHandle.get(pat.handle), method: 'alias', score: 1, candidates: [] };
    }
  }

  const exact = catalog.products.filter(p => normalizeName(p.baseTitle || p.title) === q);
  if (exact.length === 1) return { product: exact[0], method: 'exact', score: 1, candidates: [] };

  const qt = tokens(name);
  const scored = catalog.products
    .map(p => ({ product: p, score: Math.max(dice(qt, tokens(p.baseTitle || p.title)), dice(qt, tokens(p.title))) }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  return { product: scored[0].product, method: 'fuzzy', score: scored[0].score, candidates: scored.slice(0, 5).map(x => ({ handle: x.product.handle, title: x.product.title, score: +x.score.toFixed(2) })) };
}
