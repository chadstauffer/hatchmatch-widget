// Shopify cart permalink. One URL adds every pack item and works across the
// domain split (widget on theflyshop.com, cart on catalog.theflyshop.com).
//
//   https://catalog.theflyshop.com/cart/{variantId}:{qty},{variantId}:{qty}?storefront=true&utm_...&attributes[hatchmatch_report]=...
//
// storefront=true lands on the cart page instead of checkout, so the button
// can honestly say VIEW CART. Cart attributes show up on the order in the
// shop's own Shopify admin, so attribution needs no API access. Line-item
// properties are not supported by permalinks; the same-domain /cart/add.js
// path carries those.
//
// Known Shopify behaviour: a permalink replaces whatever is already in the
// customer's cart. Acceptable for the demo; the pilot should use add.js when
// the widget is on the same domain as the cart.

export function buildCartUrl(storeUrl, items, { water, report, storefront = true, extra = {} } = {}) {
  const lines = items.filter(i => i.qty > 0).map(i => `${i.variantId}:${i.qty}`).join(',');
  const u = new URL(`${storeUrl.replace(/\/$/, '')}/cart/${lines}`);
  if (storefront) u.searchParams.set('storefront', 'true');
  u.searchParams.set('utm_source', 'hatchmatch');
  u.searchParams.set('utm_medium', 'widget');
  if (water) u.searchParams.set('utm_campaign', water);
  if (report) u.searchParams.set('attributes[hatchmatch_report]', report);
  if (water) u.searchParams.set('attributes[hatchmatch_water]', water);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, String(v));
  return u.toString();
}
