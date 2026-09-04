// Cart URLs for a Shopify shop, tested against catalog.theflyshop.com on Sep 4, 2026.
//
// buildAddUrl — the path the widget uses.
//   GET {store}/cart/add?items[0][id]=…&items[0][quantity]=…&items[0][properties][_hatchmatch]=…&return_to=/cart?utm_…
//   Appends to whatever the customer already has in the cart, carries hidden
//   line-item properties (underscore prefix: on the order, not shown to the
//   customer), and lands on the cart page. Works as a plain top-level
//   navigation across the domain split, so the widget on theflyshop.com can
//   add to the cart on catalog.theflyshop.com. return_to can chain through
//   /cart/update?attributes[…] to set cart attributes as well.
//
// buildCartUrl — the permalink, kept for reference only.
//   {store}/cart/{variantId}:{qty},…  REPLACES the customer's cart. Verified:
//   a six-item cart went to one item. Do not put this in front of a customer.

export function buildAddUrl(storeUrl, items, { water, report, section, returnTo } = {}) {
  const u = new URL(`${storeUrl.replace(/\/$/, '')}/cart/add`);
  let i = 0;
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    u.searchParams.set(`items[${i}][id]`, String(it.variantId));
    u.searchParams.set(`items[${i}][quantity]`, String(it.qty));
    if (report) u.searchParams.set(`items[${i}][properties][_hatchmatch_report]`, report);
    if (section) u.searchParams.set(`items[${i}][properties][_hatchmatch_section]`, section);
    i++;
  }
  const utm = `utm_source=hatchmatch&utm_medium=widget${water ? `&utm_campaign=${encodeURIComponent(water)}` : ''}`;
  const cartPage = `/cart?${utm}`;
  const attrs = report ? `/cart/update?attributes[hatchmatch_report]=${encodeURIComponent(report)}${water ? `&attributes[hatchmatch_water]=${encodeURIComponent(water)}` : ''}&return_to=${encodeURIComponent(cartPage)}` : cartPage;
  u.searchParams.set('return_to', returnTo || attrs);
  return u.toString();
}

export function buildCartUrl(storeUrl, items, { water, report, storefront = true, extra = {} } = {}) {
  const lines = items.filter(i => i.qty > 0).map(i => `${i.variantId}:${i.qty}`).join(',');
  const u = new URL(`${storeUrl.replace(/\/$/, '')}/cart/${lines}`);
  if (storefront) u.searchParams.set('storefront', 'true');
  u.searchParams.set('utm_source', 'hatchmatch');
  u.searchParams.set('utm_medium', 'widget');
  if (water) u.searchParams.set('utm_campaign', water);
  if (report) u.searchParams.set('attributes[hatchmatch_report]', report);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, String(v));
  return u.toString();
}
