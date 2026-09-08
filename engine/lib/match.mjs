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

/** Several products can share a name. "Stimulator" is three: Olive #16, Orange, Yellow -- one
    normalized title, one dice score of 1.00 apiece, and taking the first left the card showing
    Olive for a page that says Orange and links to Orange. A name that cannot separate them is
    not the guide's whole sentence: the colour word is also the guide's word, so it decides
    first, and the shop's own link decides what is left. The link is only ever a tiebreak among
    equals -- it can still never outrank a better name match, which is the standing rule. */
function preferAmong(list, colors, linkHandle) {
  if (list.length < 2) return { product: list[0], by: null, tied: false };
  let pool = list;
  if (colors && colors.length) {
    const byColor = pool.filter(p => (p.colors || []).some(c => colors.some(w => colorMatches(w, c))));
    if (byColor.length && byColor.length < pool.length) return byColor.length === 1
      ? { product: byColor[0], by: 'color', tied: false }
      : { product: (linkHandle && byColor.find(p => p.handle === linkHandle)) || byColor[0], by: 'color', tied: byColor.length > 1 };
    if (byColor.length) pool = byColor;
  }
  const linked = linkHandle ? pool.find(p => p.handle === linkHandle) : null;
  if (linked) return { product: linked, by: 'link', tied: false };
  return { product: pool[0], by: null, tied: true };
}

/**
 * @param {string} name  the guide's words, e.g. "Jigged Birds Nest"
 * @param {object} catalog  { products: [...] } from ingest
 * @param {object} aliases  { patterns: [{ name, handle, aliases: [] }] }
 * @returns {{ product, method: 'alias'|'exact'|'fuzzy', score, candidates }|null}
 */
export function findProduct(name, catalog, aliases, { minScore = 0.6, handle, colors = [], linkHandle = null } = {}) {
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
  if (exact.length > 1) {
    const { product, by, tied } = preferAmong(exact, colors, linkHandle);
    return { product, method: 'exact', score: 1, tiebreak: by, tied,
      candidates: exact.slice(0, 5).map(p => ({ handle: p.handle, title: p.title, score: 1 })) };
  }

  const qt = tokens(name);
  const scored = catalog.products
    .map(p => ({ product: p, score: Math.max(dice(qt, tokens(p.baseTitle || p.title)), dice(qt, tokens(p.title))) }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  // Everything tied at the top score is one undecided set, not a ranking.
  const top = scored.filter(x => x.score === scored[0].score).map(x => x.product);
  const { product, by, tied } = preferAmong(top, colors, linkHandle);
  return { product, method: 'fuzzy', score: scored[0].score, tiebreak: by, tied,
    candidates: scored.slice(0, 5).map(x => ({ handle: x.product.handle, title: x.product.title, score: +x.score.toFixed(2) })) };
}
