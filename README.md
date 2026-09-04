# HatchMatch widget

An embeddable river report that sells flies. This repo is the engine and the card, built to spec v0.2. First target: The Fly Shop, Redding, Lower Sacramento River.

```
<div id="hatchmatch" data-shop="theflyshop" data-water="lower-sacramento"></div>
<script src="https://cdn.hatchmatch.app/embed.js" async></script>
```

## Layout

```
engine/
  ingest.mjs          Shopify storefront -> data/catalog/flies.json (one line per variant: id, SKU, color, size, price, stock, image)
  resolve.mjs         report fixture + catalog -> <report>.resolved.json and <report>.unresolved.md
  lib/shopify.mjs     public storefront reads, paged, no credentials
  lib/variants.mjs    color and size parsing across the shop's option shapes; CDN thumbnail sizing
  lib/match.mjs       alias table -> exact title -> fuzzy token match (scored, flagged)
  lib/cart.mjs        cart permalink with UTM and cart attributes
data/
  catalog/flies.json  780 products, 1,851 variants, pulled Sep 4, 2026
  catalog/aliases.json  canonical patterns, the words guides use, the shop handle each resolves to
  reports/lower-sacramento-2026-09-01.json            the fixture: the guide's words, nothing written for them
  reports/lower-sacramento-2026-09-01.resolved.json   engine output the card renders from
  reports/lower-sacramento-2026-09-01.unresolved.md   what needs the guide's eye
widget/
  embed.js            the card. Vanilla JS, shadow root, no dependencies
  assets/             Kode Mono (OFL), stonefly.svg (currentColor)
build.mjs             inlines the resolved report, font and mark into dist/embed.js for the static demo
demo/index.html       the pitch page
```

## Run

```
npm run ingest     # pull the catalog (about 2 seconds, four pages)
npm run resolve    # pin every pick to a variant, write the flag list
npm run build      # dist/embed.js
npm run demo       # http://127.0.0.1:8787/demo/
```

The demo also works straight from `demo/index.html` on disk. Live flow and weather need a network connection; both fall back to the report's last reading.

## What the demo does

- Every fly is a real variant on catalog.theflyshop.com with the shop's own price, stock and photo.
- Flow is live from USGS 11370500 (Keswick), with a six-hour trend. Weather is live for Redding from Open-Meteo. No keys.
- The pack button opens a Shopify cart permalink carrying every fly, tagged `utm_source=hatchmatch` plus cart attributes for report, water and section, so the order in the shop's admin says where it came from.
- Report freshness is computed from the publish date, so the lamp will go amber on its own after seven days and red after fourteen.
- Every tap is an event: `window.HatchMatch.events`, and a `hatchmatch` CustomEvent on the host. Add `data-debug` to the host to see them in the console.

Demo states for the pitch, as a query string on the demo page: `?state=aging`, `?state=stale`, `?state=oos` (takes the Weiss Nymph out of stock so the substitute row shows), `?state=noflow`.

## Decisions made in this pass

- Flow bar is water blue on the water's own range, amber past the wading threshold tick, fills once on load. Range for the Lower Sac is 0 to 15,000.
- Pack button is three caps spans with space-between: ADD THE PACK / 21 FLIES / $65.95, then ADDED / VIEW CART.
- Card width is fluid to 440px and centered in the host. The single column does not stretch to 680.
- No insect icons. The stonefly appears only in the Powered by line, as an SVG in currentColor.
- The compact card is a real button (the whole face expands) with the pack button as a sibling, not a child. Tabs carry tab roles, arrow keys, and focus survives re-render. Zero-quantity rows dim.
- Report rating is Great. The live page highlights that label; v0.2 assumed Good.
- Prices are not all $2.95. The rig runs $1.50 (Eng Thing) to $3.95 (Jigged Bird's Nest, Ginger Snap). Pack at defaults: Up top 21 flies $65.95, Lower 25 flies $75.25.

## Known pilot items

- A cart permalink replaces whatever the customer already has in the cart. On the same domain, `POST /cart/add.js` appends and also carries line-item properties. The permalink is the cross-domain path for the demo.
- The stonefly SVG is a trace of the 64px PNG. Fine at 12 to 22px; redraw it as a proper vector before it goes bigger.
- Catalog pull is a snapshot. Run `npm run ingest` nightly for price and stock.
