# HatchMatch widget

An embeddable river report that sells flies. This repo is the engine and the card, built to spec v0.2. First target: The Fly Shop, Redding, Lower Sacramento River.

```
<div id="hatchmatch"></div>
<script src="https://cdn.hatchmatch.app/embed.js"></script>
<script>
  const reports = await (await fetch('https://api.hatchmatch.app/waters/theflyshop')).json();
  HatchMatch.mount(document.getElementById('hatchmatch'), reports);
</script>
```

The shipped bundle carries no reports: **167 KB with the font inlined, 88 KB without**, against a
370 KB demo bundle whose 205 KB of reports never leave the repo. `dist/embed.renderer.js` is that
bundle and `demo/production.html` mounts it against a fetched payload, so the claim is measured
rather than asserted. `mount()` is idempotent -- handing an already-mounted element a new set of
reports replaces them in place -- and auto-boot only fires when reports were inlined at build time.

## Layout

```
engine/
  ingest.mjs          Shopify storefront -> data/catalog/flies.json (one line per variant: id, SKU, color, size, price, stock, image)
  scrape.mjs          theflyshop.com/streamreport.html -> one fixture per regional river
  scales.mjs          USGS daily statistics -> the flow scale each river's bar and sparkline use
data/waters.json      numbers a shop or guide has set. These always win over anything derived.
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
demo/production.html  the renderer with no reports inlined, fed a payload the way the API would
demo/review.html      the review bench: one live card, every display variable a switch
demo/measure.html     the height harness the panel numbers come from
demo/sweep.html       every state x theme x width x tab, plus the invariants
```

## Run

The demo is served by `python3 -m http.server`, which sends no `Cache-Control`. The pages carry
`no-store` and `build.mjs` stamps the bundle's script tag, so a rebuild is always what loads. If
you were running the demo before that landed, **hard-reload once** (Cmd+Shift+R) to evict the
page the browser already has. The bench prints the build id it is running, top of the readout.

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
- The pack button opens `GET /cart/add?items[…]` on the catalog domain. Verified against their store: it appends to whatever the customer already has, carries hidden line-item properties (`_hatchmatch_report`, `_hatchmatch_section`) onto the order, and chains through `/cart/update` to set cart attributes, then lands on the cart page with UTM. The cart permalink (`/cart/{id}:{qty}`) is not used: it replaces the customer's cart, verified by watching a six-item cart drop to one.
- The hatch filter is a view. Tapping BWO narrows the rig; the pack button still adds the full pack, and says so. A second, labeled action inside the filter banner adds only the filtered flies.
- "What we found" is a toggle under the card: links to check, flies to link, and the color and size calls for the guide, built from the resolver's flag list.
- Report freshness is computed from the publish date, so the lamp will go amber on its own after seven days and red after fourteen.
- Every tap is an event: `window.HatchMatch.events`, and a `hatchmatch` CustomEvent on the host. Add `data-debug` to the host to see them in the console. `pack_added` fires only for the full pack and is the monthly headline; the filtered add fires `fly_added` and is reported separately.

Demo states for the pitch, as a query string on the demo page: `?state=aging`, `?state=stale`, `?state=oos` (takes the Weiss Nymph out of stock so the substitute row shows), `?state=noflow`.

## Phase B — eight waters

- `npm run scrape` reads the shop's stream report page into seven new fixtures. The page is
  uniformly structured (`<h4>` name and date, a `label-default-danger` span for the live rating,
  `div.report` for the prose, anchors under `Hot Flies:`), so this reads it rather than
  transcribing it. It carries 26 report panes in all; the stillwaters and private waters parse
  with the same code and are out of scope by decision, not by capability.
- Nothing is written for the shop. The page gives no hatch slots, no roles and no quantities, so
  those seven waters are `readOnly`: real flies at the shop's real prices, grouped under the
  shop's own sub-heads, and no pack button. Inventing "two of each" is the same class of
  invention as inventing a hatch slot.
- 105 picks across 8 waters, **0 unresolved**. When a name matches nothing, the resolver now
  follows the page's own link before giving up -- "Pheasant Tails" is not in the catalog as
  written and the page links it to `pheasant-tail`. Flagged for the guide either way.
- Flow scales come from USGS daily statistics (`statTypeCd=all`; asking for an explicit list
  silently drops p90). `min` is 0 on every river. `max` is the 70th percentile of the daily-p95
  distribution, rounded up a nice-number ladder -- see the trade-off recorded in `scales.mjs`.
  The wading threshold is not derived and stays null: that is a person deciding what is safe.
- Network reads are cached in `sessionStorage` for five minutes, keyed by gauge or window, so a
  page with several cards asks a free public service once. The key namespace carries a schema
  version and every hit is validated against what the current build needs before it is trusted:
  a payload written by an older build is not stale, it is the wrong shape, and serving it back
  left the card rendering a flow with no sparkline and no way to know why. `demo/sweep.html`
  checks this.

## Round 5 — corrections to round 4

- The sparkline is back to filled columns. Single lit cells read as a scatter of marks needing a
  legend. The flat-week problem they were meant to solve was misdiagnosed: it is not the fill
  mode, it is that on the Lower Sac the wading limit and the water sit at the same height, so the
  dashed line runs through the plotted level. The per-cell colour split resolves it -- a solid
  below-limit block with one above-limit row on top reads as "just over the limit, all week".
- The sparkline is one colour, filled to each bucket's level, and carries nothing else. A
  threshold colour split and a dashed limit line were both built here and taken out: the
  graphic's job is the shape of the week, and the segmented bar directly below already carries
  the limit against a labelled scale. No captions and no legend -- if it needs copy to be
  understood, it is the wrong graphic.
- Trend stacks with the unit, not the number: an accent arrow above `CFS` when the river is
  rising, below `CFS` when it is dropping, never both, nothing when steady. It reads the same
  seven-day window the sparkline draws, not the last six hours -- across six hours a tailwater is
  permanently steady, so the arrow never appeared on the pilot river, and on the Pit the short
  window pointed the opposite way to the graph beside it. Earlier rounds put it
  beside the figure, which is not what was asked for and, muted at 11px, was not visible either.

## Round 4 — the flow module again

- The trend caret is back. It was deleted in round 3 on the reasoning that the sparkline says
  direction, magnitude and shape; that holds on a river that moves and not on a stable tailwater,
  which is the river the shop will actually look at. Direction appears twice on purpose: the
  caret is precise and always legible, the sparkline is contextual and sometimes flat.
- The sparkline lights exactly one cell per column against a faint grid, instead of filling
  columns from the bottom. Filled columns at one level rendered a steady week as a solid slab,
  which reads as a broken graphic. One cell per column makes a flat week a horizontal line, a
  falling week a descending one, and it works at every variance level.
- It is now 123x34 (82x28 below a 344px card), vertically centred on the CFS figure. Columns flex
  rather than being fixed: what has to fit is content-dependent -- a six-figure reading plus a
  caret costs 30px more than a steady four-figure one -- so the graphic compresses and all
  fourteen buckets always survive. Zero row overflow across 24 width x value x trend combinations.
- A gauge that has never answered no longer renders as a river at zero. `lastReading` is null
  rather than a fabricated 0, and the card says which silence it is: no gauge on file, no reading
  yet, or a last reading that has gone stale.

## Round 3

- `demo/review.html` is one live card with a control panel, not a grid of screens. Theme, accent,
  card width, tab, water, report state, anglers, days, slot expansion and the flow window are all
  switches, and a readout prints the gauge, scale, sparkline quantization and pack totals.
- The flow window can be pointed at a real historical week (`data-demo-window="2026-01-01/2026-01-14"`).
  It uses the daily-values service: `nwis/iv` answers 403 to a browser for any `startDT`/`endDT`
  and for `period=P365D`, while accepting `P7D` and `P30D`. curl gets 200 for all of them, so this
  is only visible from a page. Windowed data is never labelled live.
- A load token means a response from the water you just switched away from is dropped rather than
  painted under the new water's gauge name.

- Flow is fetched over `P7D`, not `PT6H`: Keswick releases move in discrete steps every few
  days, so a six-hour window on a tailwater is flat noise. Still one request -- the strip's
  six-hour delta comes off the tail of the same series.
- A 14-column sparkline sits right of the CFS figure. Twelve-hour buckets, six discrete steps,
  on the segmented bar's own fixed range -- never the window's own min and max, which would draw
  a dependable week as a mountain range. A bucket the gauge did not report draws as a gap.
- Cells take the bar's two colours split at `water.flow.threshold`, with a dashed line at the
  threshold and a 2px accent underline on the current column. Measured across all six gauges we
  carry, six steps on a fixed range gives one or two distinct levels: these rivers have no shape
  to show in a week, so the threshold is what the graphic is for.
- The trend caret is gone. Flow direction appears once per card state, as the signed delta.
- The wading threshold is optional throughout the flow module. Not every river has a limit a
  guide will stand behind, and a range without one no longer crashes the bar.

## Round 2

- Three tabs: NOW / HATCH / NOTES. The TRIP tab is gone. Anglers, days and section are one 44px
  row pinned directly above the CTA on every tab, caption over control. Pinned block is 169px;
  the panel is 370px at 390x844 and 232px at 375x667, up from 187px.
- One `flowModule({expanded})` renders the flow in both card states. The number, trend caret,
  bar and live strip are identical; expanded adds the range labels and nothing else.
- The live strip's `LIVE` prefix is stationary and only the suffix cycles. The CFS value is never
  in it. Frames: the read time and gauge, the signed six-hour delta, and water temperature where
  the gauge reports it. A frame with no source is dropped, not faked.
- Trend appears exactly once, as a caret on the flow figure. Up sits at the cap height, down at
  the baseline, steady shows nothing.
- Every fly row has a live 28px stepper. The CTA count and total move on every tap; nothing
  reaches the shop's cart until the CTA is pressed. Tapping a thumbnail opens a lightbox in the
  shadow root that traps and restores focus.
- The title is the water switcher: a bare caret at text size, never a second circular chevron.
  Eight waters; only the Lower Sac is resolved. The rest render live gauge and weather and say
  plainly that no guide has broken them out.
- Water temperature: CDEC carries it for Keswick (station KWK, sensor 25, `dur_code=H`) but sends
  no `Access-Control-Allow-Origin`, so it is unreachable from the browser without a proxy. USGS
  has no live water temp or turbidity anywhere on the Lower Sac. The band meter is built and
  data-gated: it lights up on Hat Creek and the Trinity, which do report USGS 00010, and stays
  dark here. No air temperature is ever substituted for water.
- Clarity keeps the guide's word. USGS turbidity (63680) is requested on the same call and shown
  as `EXCELLENT - 1.2 FNU` where a gauge reports it. Keswick does not, so the word stands alone.
  No percentage is derived from a four-value ordinal.

## Decisions made in this pass

- Flow bar is water blue on the water's own range, amber past the wading threshold tick, fills once on load. Range for the Lower Sac is 0 to 15,000.
- Pack button is three caps spans with space-between: ADD THE PACK / 21 FLIES / $65.95, then ADDED / VIEW CART.
- Card width is fluid to 440px and centered in the host. The single column does not stretch to 680.
- No insect icons. The stonefly appears only in the Powered by line, as an SVG in currentColor.
- The compact card is a real button (the whole face expands) with the pack button as a sibling, not a child. Tabs carry tab roles, arrow keys, and focus survives re-render. Zero-quantity rows dim.
- Report rating is Great. The live page highlights that label; v0.2 assumed Good.
- Prices are not all $2.95. The rig runs $1.50 (Eng Thing) to $3.95 (Jigged Bird's Nest, Ginger Snap).
- Size default is the middle of the range (spec §12), whether the range is the report's (#14 to 16 gives #16) or the shop's (no size on the report, shop carries #12 to 18, card shows #16). Color has no invented rule: the report's first color word, else the shop's first color, flagged. When the shop sells color and size as one option (Spotlight Caddis: Tan #14, Olive #16) the size rule does not apply, since it would change the fly: first variant, flagged.
- The findings panel is written for the people who wrote the page. It lists what the matching turned up as things to confirm, not as faults.
- When the shop's link and the shop's words disagree (Jigged Bird's Nest links to the $2.25 CB Birds Nest, the words say jigged, Natural and Hot Spot, which only the $3.95 Zack's carries), the resolver follows the words but flags both with prices. It never picks the pricier fly silently.

## Known pilot items

- Flow comes from `waterservices.usgs.gov/nwis/iv` (six-hour series, for the trend) with `api.waterdata.usgs.gov/ogcapi` as fallback. If both fail the card shows the report's last reading and says so; the reason is in `window.HatchMatch.events` and the console.
- The stonefly SVG is a trace of the 64px PNG. Fine at 12 to 22px; redraw it as a proper vector before it goes bigger.
- Catalog pull is a snapshot. Run `npm run ingest` nightly for price and stock.
