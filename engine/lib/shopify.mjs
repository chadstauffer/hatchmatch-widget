// Public Shopify storefront reads. No credentials, no admin API.
// Endpoints: /collections/{handle}/products.json (paged), /products/{handle}.js (one product, all variants).

const UA = 'HatchMatch ingestion (contact: stauffer.chad@gmail.com)';

async function getJson(url, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= retries) throw new Error(`${res.status} ${url}`);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
}

/** Every product in a collection. Pages until Shopify returns an empty page. */
export async function fetchCollection(storeUrl, handle, { limit = 250, onPage } = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const data = await getJson(`${storeUrl}/collections/${handle}/products.json?limit=${limit}&page=${page}`);
    const products = data.products || [];
    onPage?.({ handle, page, count: products.length });
    out.push(...products);
    if (products.length < limit) break;
  }
  return out;
}

/** One product with full variant detail (price in cents, featured_image per variant). */
export async function fetchProduct(storeUrl, handle) {
  return getJson(`${storeUrl}/products/${handle}.js`);
}

/** All collections the store exposes publicly (handle, title, products_count). */
export async function fetchCollections(storeUrl, { limit = 250 } = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const data = await getJson(`${storeUrl}/collections.json?limit=${limit}&page=${page}`);
    const cols = data.collections || [];
    out.push(...cols);
    if (cols.length < limit) break;
  }
  return out;
}
