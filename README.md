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

**One backend dependency.** The card is a script tag and a mount call, with one exception: water
temperature is read through a proxy we run (`/api/water-temp` on the existing Render service),
because CDEC sends no `Access-Control-Allow-Origin` and a browser cannot reach it otherwise. It is
an optional source and it fails soft -- if the proxy is slow, down, or never deployed, the water
temperature row and its live-strip line do not render and nothing else on the card changes. Flow,
weather, flies, prices and stock have no backend and never will.

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
  audit.mjs           every water's rendered card vs its source pane on the shop's page. Parses the page independently of scrape.mjs on purpose
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
demo/serve.mjs        the static server behind `npm run demo`, no-store on every response
demo/index.html       the pitch page
demo/production.html  the renderer with no reports inlined, fed a payload the way the API would
demo/review.html      the review bench: one live card, every display variable a switch
demo/measure.html     the height harness the panel numbers come from
demo/sweep.html       every state x theme x width x tab, plus the invariants, widows and overflow
demo/shot.html        one card, driven by query string, for the review screenshots each round
```

## Run

`npm run demo` serves the repo through `demo/serve.mjs`, which sends
`Cache-Control: no-store` on every response, so a refresh is always the current build. It was
`python3 -m http.server` before, which sends no `Cache-Control` at all -- a `<meta http-equiv>`
is not a dependable substitute, because browsers largely ignore it for the document itself, which
is the case that matters on reload. The server prints the build id at startup and the bench
prints it at the top of its readout, so "am I looking at the new code" is answerable by looking.

```
npm run ingest     # pull the catalog (about 2 seconds, four pages)
npm run resolve    # pin every pick to a variant, write the flag list
npm run build      # dist/embed.js
npm run audit      # diff all 8 waters against the shop's page; non-zero if anything is unexplained
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

## Round 7 — the card

- **One caret.** There were four: HTML triangles at 8px and 9px (`&#9650; &#9660; &#9662; &#9656;`)
  beside a drawn SVG one. Entity triangles cannot be size-matched to each other or to a drawn
  glyph, because each is whatever the font says it is, so the caret is now drawn once at 9px and
  every control that opens something uses it. They differ only by the frame around them: a circle
  for expand, bare for the water selector, the hatch rows, the section control and the new option
  toggle. All of them point down closed and up open -- the water selector always pointed down, and
  the hatch rows pointed *right* when closed. The trend arrow on the flow unit and the hi/lo
  glyphs on the weather row keep their own sizes: they report direction, not open state.
  The section control is a native `<select>`; its popup is drawn by the OS and fires no open
  event, so its caret stays down rather than claiming a state we cannot know.
- **The live strip was painting over itself, and it was not two timers.** Both frames are
  absolutely positioned in one box and cross-faded symmetrically, so for the middle of every
  transition two texts were legible on top of each other -- measured at 0.55 and 0.44 opacity
  150ms in, which is exactly the reported `READC4S15NPM HR0SGS KESWICK`. Now the outgoing frame
  fades out over 150ms and the incoming one starts after it: same 300ms, never two things to read.
- **The flow graph's day axis is gone** -- the week ticks and the baseline rule under the plot.
  It marked time across the window, which is a thing you have to be told before you can read it,
  and the standing rule here is that a graphic needing copy to be understood is the wrong graphic.
  The plot is untouched: thirty columns, ten rows, 3px cells, and the 5K/10K value labels that do
  carry their own meaning. The graph is 39px now rather than 48, which is what those cells and
  their gaps actually need -- the axis and its gap were the other nine.
- **The live strip sits above the bar on the compact card.** Round 7 first argued for leaving it
  at the foot of the block: metadata belongs at the end, and moving it would split the bar from
  the scale labels beneath it. The second reason stopped being true in the same round -- those
  labels went with the bar into the WADING block, so the compact bar has nothing under it to be
  separated from. What is left is the reading and its provenance together, and a bar that runs
  straight into the wading verdict it produces. Expanded is unaffected: there is no bar in that
  flow module to sit above.
- **The flow bar moved into the WADING block when expanded**, with its `0 / limit / max` labels.
  Compact keeps it where it is -- there is no wading section on that card and the flow module is
  the whole of it. Safe now only because the graph carries its own y-axis labels; through round 6c
  the bar's labelled scale was the graph's only legend. A water with no threshold on file still
  gets the bar, under `FLOW RANGE` rather than `WADING`, because it is still this river's flow on
  this river's own scale -- it just has no verdict.
- **The clarity tick meter is gone, the word stays.** Its positions (`{Poor:3, Fair:9, Good:15,
  Excellent:22}` of 24) were invented placements for a four-value ordinal, already commented in
  the source as illustrative. No water we carry has a turbidity gauge, so there was never a number
  behind it. `CLARITY · EXCELLENT` is honest and complete, and where a gauge does report 63680 the
  FNU figure still sits beside it.
- **No text widows.** `text-wrap: pretty` on the card covers running text; fly and water names get
  `text-wrap: balance`, because a name is a short heading and pretty broke "Jigged Bird's / Nest"
  where balance gives "Jigged / Bird's Nest". Numbers never separate from their units: `3% rain`,
  `7,500 CFS`, `Sep 1`, `6 hrs`, `21 flies` are joined with non-breaking spaces. `demo/sweep.html`
  measures widows now rather than anyone eyeballing them -- every word gets a Range rect, words
  group into lines by their top edge, and a wrapped block whose last line holds one word is
  reported -- unless the last two words could not have shared a line at that width, in which case
  no arrangement avoids it and there is nothing to report. It found 22 distinct widows across
  state x theme x width x tab, in 277 places, and 5 more once the sweep was widened from three
  widths to the six the card actually claims. It now finds zero, with one recorded exemption:
  "BP Weiss / Nymph" at 320px, where balance prefers the even break over the one the widow rule
  wants, and is right to.
- **The guide CTA is part of the trip block.** It was a bordered box between the scroll content and
  the pinned controls, belonging to neither. It sits directly under the CTA now, no border, with
  `OR` stating the relationship: buy the flies, or hire the person. On a water with no pack it is
  the primary action and carries the fill, because it is the only thing the card can offer on the
  Trinity or the Pit today.
- **The all-flies link left the pinned block** for the bottom of the HATCH panel, inside the
  scroll. It is a browse action and it belongs with the browsing, and the pinned block is now
  identical on all three tabs.
- **Variant options collapse.** Pat's Rubberlegs rendered nine chips -- most of a screen for one
  fly. The chosen variant shows with a caret; tapping it opens the set, and opening a second fly's
  options closes the first.
- **Overflow is measured now too**, and as what it actually means: does anything render outside
  the card's own box. Content wider than a box that clips it on purpose is not overflow, and the
  first version of the check spent its time reporting exactly that. Two questions instead -- has
  anything escaped the card edge, and is any live-strip frame having its text cut off. It found
  three real faults: the flow-position band ran 25px past the strip, the compact hatch row ran
  36px past the card at 320px (present before this round, on every build back to round 2), and
  the gauge-name frame was clipped on four waters. All three are fixed, and the strip gives up
  the word "Read", then its spacing, then half its tracking before it gives up a gauge name.
  It also catches a control whose own label is ellipsising, which is how the pack-less guide CTA
  was caught rendering "FISH IT WITH A G..." at 320px -- it falls back to the whole phrase "With a
  guide" now, the same long/short idiom the pack button uses. **The sweep walks all six widths
  now, not three**; three of the faults above only exist at the widths it was not testing.
  420 combinations across six widths and both themes: zero escapes, zero cut frames, zero
  truncated labels, zero widows, zero invariant failures, zero leaked intervals.
- **`3 DAY FORECAST`**, not `NEXT THREE DAYS`. The numeral scans faster in a caps monospace label
  and it frees five characters on one of the card's tighter rows.

### Panel and pinned heights, measured

Two approved tickets pulled the pinned block in opposite directions, and the net is not what
ticket 6.1 predicted. Measured against the previous build on the same harness:

| | pinned before | pinned after | panel before | panel after |
|---|---|---|---|---|
| 390x844 | 169px | 175px | 370px | **364px** |
| 375x667 | 169px | 175px | 232px | **226px** |

Moving the all-flies link out took 28px off the pinned block, exactly as 6.1 said it would. The
guide line moved *in* and cost 34px. The panel is therefore 6px shorter, not 28px taller. What did
improve: the pinned block is identical on all three tabs, the NOW tab's scroll lost the 48px
bordered guide box, and on a pack-less water the pinned block is 106px rather than 169px because
there is no trip row to shape a pack that does not exist.

## Round 7 — the flow position band

- `● LIVE · HOLDING FOR 6 HRS · WELL BELOW NORMAL FOR EARLY SEPTEMBER`. Where today's reading sits
  in this river's own record for this time of year, from the USGS daily statistics the scale
  already comes from. Bands are the percentiles for the date: below p10 is well below normal,
  below p25 below normal, through p75 near normal, through p90 above normal, and above that well
  above normal.
- **Thirty-six buckets, not 366 days** -- early, mid and late of each month, each the median of its
  days' p10/p25/p75/p90. The card says "near normal for early September", and the data has no
  business being finer than the sentence it produces. 45 to 99 years of record per gauge, all
  36 buckets filled on all six gauged waters. `npm run scales -- --write` regenerates them; a
  table nobody knows how to regenerate goes stale silently.
- **It is not a wading verdict and must never become one.** A river can sit dead in the middle of
  its normal range and still be dangerous to wade -- the Pit's own report says it is slippery and
  to carry a staff. Waters with no threshold on file show position and no verdict.
- **The threshold is now an explicit ask on the guide pass.** Every gauged water without one
  carries a `FOR THE GUIDE` line in its `.unresolved.md`, alongside the fly confirmations: one
  number they will stand behind, "wadeable below X CFS", turns the verdict on.

## Round 7 — the water-temperature proxy

Round 2 turned the CDEC proxy down on the grounds that it was not worth ending "no backend" for.
Round 7 reversed that: the alternative on the table was a hard-coded constant -- "the temp we know
it's always going to be at" -- sitting inside a `● LIVE` block next to a genuinely live gauge
reading, which is the one thing this card has never done. If the number matters that much, get it
honestly.

- **One endpoint**, `GET /api/water-temp?station=KWK`, on the Render service that was already
  running with auto-deploy. No new infrastructure, and no new dependencies: `cors`,
  `express-rate-limit` and `lru-cache` were all already in that service.
- **Cached fifteen minutes server-side.** The sensor is hourly; there is no reason to ask CDEC per
  pageview. Rate limited to 60/min, and the station is checked against an allowlist -- an open
  passthrough is someone else's rate limit to spend.
- **The reading is often hours old and the card says so.** CDEC's most recent hours are routinely
  its `-9999` sentinel; at the time of writing the newest real reading was eight hours back. Those
  rows are filtered, and a reading older than two hours names its own hour in the live strip
  (`Water 54° at 3 PM`) rather than borrowing the flow reading's freshness. Past a day it is not a
  reading and it is dropped. The expanded row names its source and read time outright:
  `CDEC KWK · READ 3:00 PM`.
- **CDEC reports DEG F already**, unlike USGS 00010 which is Celsius. If CDEC ever changes those
  units the endpoint returns no reading rather than serving Celsius as Fahrenheit.
- **The gauge still wins.** Where USGS reports 00010 -- Hat Creek, the Trinity -- that is one more
  field on a request the card already makes, and the proxy is never called. The proxy answers only
  where the gauge is silent, which on the pilot river is always.
- **Degrade verified, not asserted.** With the proxy killed on a cold start: the row is absent, the
  strip is back to two frames, and the flow figure, graph column count, lit bar segments, wading
  block and weather row are identical to the run where it answered. The failure is in
  `window.HatchMatch.events` as `water_temp_unavailable`.
- A host that would rather run its own proxy points at it with `data-temp-proxy`.

## Round 7 — ticket 6.3, the audit

`npm run audit` diffs every water's rendered card against its source pane on the shop's page and
exits non-zero on anything it cannot account for. It parses the page **independently of
`engine/scrape.mjs`** on purpose: a shared parser would agree with itself and disagree with the
page, which is the failure it exists to catch. It caught two that way.

- **The Pit and the Upper Sac were dropping a sub-head.** The page writes
  `<strong>Streamers &amp; Leeches:</strong>`, and the scraper matched headings against raw markup
  with a character class that has no `;` in it, so that heading was never seen and its four flies
  filed under `Nymphs/Wet Flies` -- the shop's own categories, reported wrong. Headings are now
  decoded before they are matched, and a trailing colon is what makes a bold run a heading.
- **A pane ran past its own closing tag.** Blocks were cut at wherever the *next* pane started,
  which is only right when another pane follows immediately. The Upper Sac is followed by the
  "Regional Still Waters" section, so its block ran 6,695 bytes long and its last fly's
  `asWritten` swallowed the whole of it. Nothing renders that field, so it was invisible -- but
  one linked bullet in that section would have become a fly on the Upper Sac. Panes are now
  bounded by balancing their own `<div>`, which closes cleanly on all 26 of the page's panes.
- **A name that matches three products is not a match.** "Stimulator" is Olive #16, Orange and
  Yellow at the shop -- one normalized title, one fuzzy score of 1.00 apiece -- and taking the
  first left the Pit card showing **Olive** for a page that says Orange and links to Orange. The
  colour word is the guide's word too, so it now separates same-named products first, and the
  page's own link separates what is left. Neither can outrank a better name match: they only
  break ties. The Trinity's "TB Solitude Stone" moved the same way, onto the `tb-golden-stone`
  the page actually links to.
- **Copy no longer asserts that a guide has not done something.** The Pit card said "A guide
  hasn't broken the Pit out by hatch yet" directly above the shop's own `Dry Flies` and
  `Nymphs/Wet Flies` sub-heads -- contradicted by the screen below it, and untrue about the
  shop's work. Every read-only water now describes what it has and frames the Lower Sac as
  additive. Same for the compact card's line and the notes tab's empty state.
- **"the Hat Creek" is not how anyone says it.** Water names in copy take an article or not
  (`theName()`): the Pit, the Trinity, the Lower Sac -- but Hat Creek and Fall River.

Two differences remain, and both are the shop's catalog rather than our reading of it: the Pit's
Mayfly Cripples sells size inside the colour option (`Green Drake #12`), so the size rule cannot
apply without changing the fly; and the Upper Sac's Low Water Baetis is listed at #18 on the page
and stocked only in #20. Both are in the findings list for the guide. The Lower Sac differs by
design -- it is the one water with a guide's report, so it groups by role rather than by the
page's sub-heads, and it carries three picks the hot-fly list does not: Jigged Bird's Nest twice
(one page line, two colours) and Jig Nation and Eng Thing, which the shop names in its own prose.
Every exemption in `engine/audit.mjs` names the water, the fly and the reason; an exemption with
no reason is a silenced bug.

## Round 6c — a month, and a labelled scale

- Class names inside the flow graph are prefixed `hg-` wherever they are a state modifier or a
  generic word. Two collisions shipped before that rule existed: `.live` is the live strip's class
  and silently gave the graph `display:flex` and `height:16px`, collapsing the plot to the 9px sum
  of its own gaps; `.rule` was the card's divider and added a border to every value line it was
  used for. Scoped descendants are safe, bare modifiers are not. `demo/sweep.html` now asserts the plot has real
  height, because nothing else in it noticed.

- The window is thirty days, not seven. A week is too short a swath on a dam-controlled river:
  the Lower Sac's seven-day spread is about 9% of its scale and its thirty-day spread is 41%, so
  the month is where the shape is. Thirty columns over thirty days is a day a column, one request
  (`period=P30D`, ~226 KB, ~320ms).
- Value labels on a 1-2-2.5-5 ladder -- 5K and 10K on the Lower Sac, 50/100/150 on Hat Creek --
  at their exact heights, with nothing drawn across the plot.
- The value labels are right-aligned, so they share a right edge with the `15,000` on the range
  row directly beneath them. Left-aligned in their gutter they were ragged and stopped short of it.
- The value axis sits on the **right**, beside the newest column. The right edge is now, so the
  scale is next to the reading being checked; on the left it sat between the CFS figure and the
  plot, close enough to read as an annotation on the number rather than on the graph.
- The cell height rounds rather than ceilings. Ceiling put 7,690 CFS on a 0-15,000 scale six rows up, whose top edge stands for
  9,000; continuous label placement then put the 10K mark just above it, so the graph read about
  9-10K while the number said 7,690. Rounding lands it on five rows, 7,500, and snapping the
  labels to the same grid means the two can never disagree again. Every water now renders within
  half a row of its reading, which is the best a ten-row grid can do.
- The vertical scale carries nice round labels on a 1-2-2.5-5 ladder -- 5K / 10K on the Lower Sac,
  50 / 100 / 150 on Hat Creek. Interior values only: the top of the grid is the scale max by
  definition, and a label centred on the top edge hangs half outside the graph.
- Cells are 3px square at every width; the column count follows the width the graph actually got.
  The graph flexes into whatever the flow figure leaves it rather than sitting at a fixed size, so
  a 440px card with a three-figure reading draws 62 columns across 280px where it used to draw 30
  across 150. `fitSparkline()` measures after layout and redraws the graph once if the width wants
  a different count -- one correction, never a loop, because the second pass agrees with itself.
- The newest column's trace cell is the accent, and it pulses -- but only while the reading is
  actually live. A pulse on a historical window or a stale gauge would claim something the data
  does not support. Reduced motion stops it.  Without it nothing said which end of the graph is now, and reading it right to left is an easy
  mistake to make once.
- The axis and the labels stand clear of the plot. Week ticks are positioned across
  `100% - 1px` so the last one lands inside rather than a pixel past, which had been putting a
  hairline of overflow on the flow row at every width.

## Round 6b — the hydrograph is a dot matrix

- Same sampled series, same fixed scale, same fill logic; only the drawing changed. The smooth
  vector version proved the shape was right, but every other meter on this card is discrete lit
  cells, so this one is too.
- 30 columns x 10 rows at full width, 20 x 10 below a 344px card. 14 x 6 failed because 84 states
  cannot describe a curve; 300 can. At the compressed floor the graph is 75px wide and still holds
  20 columns.
- Three cell states, which is what puts water under the trace: the top lit cell of a column at
  full brightness, the cells beneath it at 60%, the rest at 12% as the grid the shape sits on.
- 44px tall, not 40: ten rows of 3px cells with 1px gaps need 39px of grid and the axis takes 5.
  At 40 the cells came out 2.6px tall against 3.1 wide. 44 also matches the CFS figure exactly,
  so the graph pairs with the number without growing the row.

## Round 6 — the flow graph is a hydrograph

- Rebuilt as SVG: an area fill for the water, a 1px trace on top, a baseline rule and seven day
  ticks. Fourteen buckets by six levels is 84 possible states -- a pattern, not a curve, which is
  why it read as decoration however the cells were coloured.
- One sample per pixel column, and no level quantization. The gauge reports every fifteen minutes,
  so a `P7D` window is around 672 readings; bucketing to fourteen threw away 98% of measured data
  to fit a grid. The series is 128 points now and Y is continuous.
- The viewBox is a fixed 128 units wide, stretched by CSS, so the trace compresses when the row is
  tight instead of losing buckets. 123x40 down to 82x32.
- Scale is still 0 to the derived max, never the window's own min and max. A flat river renders
  flat and a low river renders as a sliver: a 1px minimum fill means a real reading always paints,
  while a bucket the gauge never reported paints nothing and breaks the trace.

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
  Eight waters; only the Lower Sac carries hatch slots and quantities. The rest render live gauge
  and weather, the shop's own hot flies under the shop's own sub-heads, and say what the Lower Sac
  adds on top rather than what they lack.
- Water temperature: CDEC carries it for Keswick (station KWK, sensor 25, `dur_code=H`) but sends
  no `Access-Control-Allow-Origin`, so it is unreachable from the browser without a proxy. USGS
  has no live water temp or turbidity anywhere on the Lower Sac. The band meter is built and
  data-gated: it lights up on Hat Creek and the Trinity, which do report USGS 00010, and stays
  dark here. No air temperature is ever substituted for water.
  **Superseded in round 7 -- the proxy exists now. See below.**
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
