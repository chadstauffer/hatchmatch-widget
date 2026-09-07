/* HatchMatch report widget. One component, rendered into a shadow root.
   Data, font and mark are inlined by build.mjs for the static demo. */
(function () {
  'use strict';
  const DATA = "__HM_DATA__";
  const FONT = "__HM_FONT__";
  const STONEFLY = "__HM_STONEFLY__";
  const BUILD = "__HM_BUILD__";

  /* The waters ship as resolved reports. Group order for the picker; anything else falls last. */
  const GROUPS = [['river', 'Rivers'], ['stillwater', 'Stillwaters'], ['private', 'Private waters']];

  /* A short cache so a page with several cards, or a person clicking through waters, does not
     re-ask a free public service for the same answer. Per tab, five minutes, and a miss or a
     storage error just means a fetch. */
  const TTL = 5 * 60 * 1000;
  /* The namespace carries a schema version, and every hit is checked against what this build
     actually needs before it is trusted. A five-minute TTL does not catch the case that matters:
     a payload written by an older build is not stale, it is the wrong shape, and reading it back
     leaves the card rendering a flow with no sparkline and no way to know why. `valid` also gates
     writes, so a degraded result -- the latest-value fallback, which has no series -- is never
     cached in place of a good one. */
  // Namespaced by build. Any rebuild invalidates every entry, so a payload can never outlive the
  // code that wrote it -- which is the failure that took a graph off the card with no error.
  const CACHE = `hm:${BUILD}:`;
  function cached(key, fetcher, valid) {
    const k = CACHE + key;
    let hit = null;
    try { hit = JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { /* private mode, quota, disabled */ }
    if (hit && Date.now() - hit.at < TTL && (!valid || valid(hit.v))) return Promise.resolve(hit.v);
    return fetcher().then(v => {
      try { if (!valid || valid(v)) sessionStorage.setItem(k, JSON.stringify({ at: Date.now(), v })); } catch (e) { /* nothing to do */ }
      return v;
    });
  }
  const hasSeries = f => !!f && Array.isArray(f.series) && f.series.length > 0;

  const ACCENTS = { orange: ['#FF7124', '#081215'], burnt: ['#D4632A', '#081215'], spruce: ['#2E7D4F', '#F5EDE0'] };
  /* SLOTS are the fixture's own keys and stay as the guide wrote them -- they are also the ids
     behind data-slot, aria-controls and the expanded set, so renaming one is a data migration.
     SLOT_LABEL is what the card says. The third slot displays as EVENING because "midday" and
     "afternoon" name the same part of the day to a reader, and the four rows have to read as four
     distinct times. It covers 3pm to 7pm; the guide's own words for that hatch were "late
     afternoon", so the label is a shade earlier than the prose it came from. */
  /* INTERIM, NOT A STANDARD. How long a guide's report stays current is the shop's call, the same
     way the wading threshold is, and nobody has given us a number: their page states no cadence,
     only "we will continue to update the report as we receive more information".

     The card ran 7/14 from its first commit with no justification recorded anywhere. Measured
     against this shop on 2026-09-07 that was wrong in a way you could see: their three freshest
     reports were all published Sep 1, and 7 days would have graded the whole batch as aging the
     next morning. Their eight reports sat at 3, 6, 6, 6, 13, 13, 27 and 248 days -- median 13.

     14/30 is chosen deliberately to fit that, and it is still a placeholder. It is one snapshot
     of eight ages, not a history of publish intervals, so it describes where this shop's reports
     happen to sit rather than how often they intend to write. A number from the shop replaces it
     via `reportFreshness` in data/waters.json, and it is on the guide pass with the CFS
     threshold. */
  const FRESHNESS = { current: 14, recent: 30 };
  const SLOTS = ['morning', 'midday', 'afternoon', 'last light'];
  const SLOT_LABEL = { morning: 'Morning', midday: 'Midday', afternoon: 'Evening', 'last light': 'Last light' };
  /* Short months, the same form the rest of the card uses for a date. "Well below normal for
     early September" is 277px against a 252px strip on a 350px card; "early Sep" fits, and the
     card says "Sep 1" everywhere else, so the long form was the odd one out anyway. */
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const THIRDS = ['early', 'mid', 'late'];
  const DAY = 86400000;
  const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => n.toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  /* The month and the day are one token: "Sep 1" must never break across a line. */
  const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', ' ');

  /* Condition glyphs, keyed by WX(). One stroke weight, no fills, no gradients. */
  const SVG = p => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const cloud = (x, y) => `<path d="M${5.5 + x} ${12.5 + y}A2.5 2.5 0 0 1 ${5.9 + x} ${7.54 + y}A3.6 3.6 0 0 1 ${12.6 + x} ${8.6 + y}A2 2 0 0 1 ${12.2 + x} ${12.5 + y}Z"/>`;
  const flake = (x, y) => `<path d="M${x} ${y - 1.1}v2.2M${x - .95} ${y - .55}l1.9 1.1M${x + .95} ${y - .55}l-1.9 1.1"/>`;
  const RAIN = SVG(cloud(0, -2) + `<path d="M6.4 12.6 5.5 14.6M8.9 12.6 8 14.6M11.4 12.6 10.5 14.6"/>`);
  const WX_ICON = {
    'clear': SVG(`<circle cx="8" cy="8" r="3"/><path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.34 3.34l1.13 1.13M11.53 11.53l1.13 1.13M12.66 3.34l-1.13 1.13M4.47 11.53l-1.13 1.13"/>`),
    'mostly clear': SVG(`<circle cx="6" cy="5.5" r="2.2"/><path d="M6 1.6v1M2.1 5.5h1M3.24 2.74l.71.71M8.76 2.74l-.71.71"/><path d="M7 13.5A2 2 0 0 1 7.4 9.53 2.9 2.9 0 0 1 12.8 10.4 1.6 1.6 0 0 1 12.5 13.5Z"/>`),
    'clouds': SVG(cloud(0, -.75)),
    'fog': SVG(cloud(0, -3.5) + `<path d="M3.4 11.2h9.2M4.6 13.4h6.8M3.4 15.6h9.2"/>`),
    'drizzle': RAIN, 'rain': RAIN, 'showers': RAIN,
    'snow': SVG(cloud(0, -2) + flake(7, 14) + flake(10.5, 14)),
    'storms': SVG(cloud(0, -2) + `<path d="M9.6 11.4 7.4 14.1h2.1L8.6 15.8"/>`),
  };
  /* One caret glyph for the whole card. It was four before -- HTML triangles at 8px and 9px
     (&#9650; &#9660; &#9662; &#9656;) beside this SVG -- and entity triangles cannot be
     size-matched to each other or to a drawn one, because each is whatever the font says it is.
     Drawing it once is the only way "identical in size and weight" is a fact rather than a hope.
     Every control that opens something uses this, points down closed and up open, and differs
     from its neighbours only by the frame around it: a circle for expand, bare for the rest. */
  const CARET = up => `<svg class="cr" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="${up ? 'M4 1.9 7 6.1H1Z' : 'M4 6.1 1 1.9h6Z'}"/></svg>`;
  /* The expand control is no longer a caret. Two strokes that rotate 45 degrees turn a plus into
     a close, which separates it from the water selector by shape rather than only by the circle
     around it -- one adds the report, the other switches which river you are reading. */
  const PLUSX = `<svg class="px" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3.6v8.8"/><path d="M3.6 8h8.8"/></svg>`;

  const CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
/* text-wrap:pretty inherits, so one declaration covers every text block on the card. It exists
   for exactly the reported failure: a last line carrying one short word. It cannot help a phrase
   that must never break at all -- a number and its unit, a size and its hash -- so those are
   joined below with a non-breaking space instead. */
.hm{font-family:'Kode Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:13px;line-height:1.4;color:var(--text);max-width:440px;margin:0 auto;text-wrap:pretty}
.hm[data-theme=dark]{--bg:#081215;--surface:#0F1D22;--surface2:#16232A;--text:#D6CFC6;--muted:#A08C7E;--tab:#B9AFA3;--line:#1E2628;--off:#22302F;--green:#5BBF7A;--amber:#E0A63A;--red:#E5484D;--water1:#3B4883;--water2:#8FA3E8;--shadow:0 14px 32px rgba(0,0,0,.45)}
.hm[data-theme=light]{--bg:#F5EDE0;--surface:#FFFFFF;--surface2:#EDE4D7;--text:#081215;--muted:#505452;--tab:#3E4442;--line:#D9D0C4;--off:#D5CCC0;--green:#2E8B57;--amber:#B7791F;--red:#C0392B;--water1:#2F4A9E;--water2:#4F7BD9;--shadow:0 14px 32px rgba(0,0,0,.18)}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0;margin:0;text-align:left}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
img{display:block}
.card{background:var(--bg);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.caps{text-transform:uppercase;letter-spacing:.14em;font-size:11px}
.label{text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:var(--muted)}
.title{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.lamp{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
.lamp i{width:7px;height:7px;border-radius:50%;background:var(--c,var(--off));flex:none}
.meter{display:inline-flex;gap:2px}.meter i{width:8px;height:8px;border-radius:1px;background:var(--off)}.meter i.on{background:var(--accent)}
.meter.wide{gap:3px}.meter.wide i{width:14px}
.row{display:flex;align-items:center;gap:10px}
.between{display:flex;justify-content:space-between;align-items:center;gap:10px}
.muted{color:var(--muted)}
.accent{color:var(--accent)}
.rule{border-top:1px solid var(--line)}
/* compact */
.compact{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px}
.compact .lamp{font-size:10px}
/* Live strip. The dot and the word LIVE are stationary -- only the suffix cycles, because a label
   that restates itself every six seconds is motion spending space on nothing. The CFS value is
   never in here: it is 44px tall, six pixels above. */
.live{display:flex;align-items:center;gap:7px;height:16px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.live i{width:6px;height:6px;border-radius:50%;background:var(--green);flex:none}
.live i.pulse{animation:hm-pulse 2s ease-in-out infinite}
.live>b{font-weight:400;flex:none;white-space:nowrap}
.live>b::after{content:'·';padding-left:7px;opacity:.7}
.live .frames{position:relative;flex:1 1 auto;min-width:0;height:16px;overflow:hidden}
/* Sequential, not cross-faded. Both frames are absolutely positioned in the same box, so a
   symmetric cross-fade puts two readable texts on top of each other for the middle of it --
   "READC4S15NPM HR0SGS KESWICK" is "Read 4:15 PM · USGS Keswick" and a delta at ~50% each. Now
   the outgoing one is gone before the incoming one starts: out over 150ms, in over 150ms after a
   150ms wait. Same 300ms, and never two things to read at once. */
.live .frames>span{position:absolute;inset:0;display:flex;align-items:center;gap:6px;white-space:nowrap;opacity:0;transition:opacity .15s linear}
.live .frames>span.on{opacity:1;transition:opacity .15s linear .15s}
.live .frames svg{width:7px;height:7px;flex:none}
@keyframes hm-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){.live .frames>span{transition:none}.live i.pulse{animation:none}}
.expand{display:flex;flex-direction:column;gap:10px;width:100%;border-radius:8px}
.big{font-size:28px;font-weight:600;letter-spacing:-.02em;line-height:1}
.big.xl{font-size:44px;letter-spacing:-.03em}
.unit{font-size:10px;letter-spacing:.12em;color:var(--muted)}
/* One flow module, both states. The number, the caret, the bar and the strip are identical
   compact and expanded; only the range labels are additive. */
.flowmod{display:flex;flex-direction:column;gap:10px}
.flownum{display:flex;align-items:center;gap:8px}
/* Direction stacks with the unit, not with the number: an arrow above CFS when the river is
   coming up, below CFS when it is dropping, and never both. Reading it off the unit rather than
   off the figure keeps the figure clean and puts the arrow where the eye already goes to check
   what the number means. */
.unitstack{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:none}
.unitstack .ar{display:block;color:var(--accent);line-height:0}
.unitstack .ar svg{width:12px;height:12px;display:block}
/* Seven days of flow, right of the figure. Discrete cells in the meters' own language, never a
   smooth line. The scale is the segmented bar's own range, never the window's min and max:
   auto-scaling would draw a dependable tailwater week as a mountain range, which on this river
   would say the opposite of the truth. The dotted line is the wading threshold, which turns
   "is it rising" into "has it been fishable this week" -- the question a flat week can answer. */
/* Class names inside this graphic are prefixed hg- wherever they are a state modifier or a
   generic word. Two collisions have already been shipped here: .live is the live strip's class
   and silently gave the graph display:flex and height:16px, collapsing the plot to nine pixels;
   .rule was the card's divider and added a border to every value line it was used for. Scoped
   descendants are safe, bare modifiers are not.
   A hydrograph rasterized onto a dot matrix. Thirty columns by ten rows: 14 x 6 failed because
   84 states cannot describe a curve, and 300 can. Three states per cell, which is what puts water
   underneath the trace -- the top lit cell of a column is the trace at full brightness, the cells
   beneath it are the water at 60%, the rest are the grid the shape sits on at 12%.
   Cells are 3px square at every width; only the column count changes when the row is tight, so a
   cell never changes shape.
   The day axis -- a week tick and a baseline rule under the plot -- is gone. It marked time
   across the window, which needs a caption to say so, and a graphic that needs copy to be
   understood is the wrong graphic. The plot keeps its ten rows of 3px cells; the graph is 39px
   now rather than 48, which is what those cells and their gaps actually need. */
/* The value axis is on the right, beside the newest column: the right edge is now, so the scale
   sits next to the reading being checked, and on the left it sat between the CFS figure and the
   plot, close enough to read as an annotation on the number rather than on the graph.
   A two-by-two grid so the labels and the value rules resolve their percentages against the plot
   area alone. As a flex row they measured against the whole graph rather than the plot, which put
   every label three pixels low -- enough, at 3px rows, to name the wrong one. */
.spark{position:relative;display:grid;grid-template-columns:minmax(0,1fr) calc(var(--lab,3) * (1ch + .06em));grid-template-rows:minmax(0,1fr);column-gap:4px;height:39px;flex:1 1 auto;min-width:0;max-width:280px;color:var(--muted)}
/* The gutter is exactly as wide as its longest label. An auto column cannot do it -- the labels are
   absolutely positioned, so they lend the column no intrinsic width and it collapsed to nothing,
   putting the numbers on top of the plot. The face is monospace, so character count is exact. */
.spark .yaxis{position:relative;grid-area:1/2;font-size:9px;letter-spacing:.06em}
/* The top label sits on the top edge rather than centred across it, so it does not hang half
   outside the graph; the midpoint one is centred on its own line. */
/* Right-aligned, so 5K and 10K share a right edge with the 15,000 on the range row directly
   below them. Left-aligned they were ragged and stopped short of it. */
.spark .yaxis b{position:absolute;right:0;transform:translateY(-50%);font-weight:400;white-space:nowrap;opacity:.75;line-height:1}

.spark .grid{position:relative;grid-area:1/1;display:flex;gap:1px;min-height:0}
.spark .col{display:flex;flex-direction:column-reverse;gap:1px;flex:1 1 0;min-width:0}
.spark .col i{flex:1 1 0;min-height:0;border-radius:1px;background:currentColor;opacity:.12}
/* The newest column, marked. Without it nothing on the graph says which end is now, and reading
   it right to left is an easy mistake to make once. */
.spark .col.cur i.top{background:var(--accent)}
/* The newest reading breathes, but only when it is actually live: a pulse on a historical window
   or on a stale gauge would be claiming something the data does not support. */
/* The whole newest column breathes, not just its top cell. The column is the thing that means
   "today"; pulsing one 3px square at the top of it asked the eye to find the mark before it could
   read the signal. Lit as a column it is unmissable, and the top cell stays the brightest of them
   so the reading itself is still legible within it. */
.spark.hg-live .col.cur i.on{animation:hm-pulse 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.spark.hg-live .col.cur i.on{animation:none}}
.spark .col i.on{background:color-mix(in srgb,var(--water1),var(--water2) 55%);opacity:.6}
.spark .col i.top{background:color-mix(in srgb,var(--water1),var(--water2) 80%);opacity:1}
/* Tight rows drop the value labels rather than the resolution: the plot keeps its cells. */
@container (max-width:344px){.spark{grid-template-columns:minmax(0,1fr);column-gap:0}.spark .yaxis{display:none}}
/* The segmented bar. Its CSS was deleted wholesale by a careless splice during the hydrograph
   rebuild, so the bar has been rendering with transparent segments -- present in the DOM, and
   invisible -- for several rounds. The water-temperature band reuses .bar i, so that went with it. */
.bar{position:relative;display:flex;gap:2px;height:14px;align-items:center}
.bar i{flex:1;height:10px;border-radius:1px;background:var(--off)}
.bar.tall{height:16px}.bar.tall i{height:12px}
.bar i.on{background:var(--seg)}
.bar i.on.fill{animation:hm-lit 1ms linear both;animation-delay:calc(var(--i) * 32ms)}
/* Where the river is. Accent plus pulse means "now" on the graph, so it means the same here. */
.bar i.on.cur{background:var(--accent)}
.bar.barlive i.on.cur{animation:hm-pulse 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.bar.barlive i.on.cur{animation:none}}
@keyframes hm-lit{from{background:var(--off)}to{background:var(--seg)}}
/* The wading limit. It used to be the brightest thing on the bar -- full white, taller than the
   cells -- which is why it read as the river level. It is a boundary, and the bar already draws
   that boundary as a colour change, so it only has to mark where: muted, and it no longer
   competes with the lit cell that is the actual reading. */
.bar .tick{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--muted);transform:translateX(-1px)}
.bar.tall .tick{top:-4px;bottom:-4px}
/* Verdict and threshold sentence read as one statement, so they share a line and wrap together
   rather than the sentence widowing under the lamp. */
/* Both captions and both states fit one line at every width we support -- but only while
   clarity is a word on its own. Where a gauge reports turbidity the FNU figure joins it and the
   row runs 56px over at 320px. It wraps rather than dropping anything: the measured number is
   the last thing on this card that should give way to a caption, and only waters with a 63680
   gauge ever reach the second line. */
.wadehead{flex-wrap:wrap;row-gap:6px}
/* Below 360px the clarity measurement is the part that gives: the guide's word is the call, the
   figure beside it is a bonus, and both states plus two captions do not fit a 288px row. */
@container (max-width:359px){.claritydetail{display:none}}
/* Two captions and two states are a lot for a 288px row. Below 335px the spacing gives before
   any of the four words does -- tracking and gaps are the cheapest thing on the row. */
@container (max-width:334px){.wadehead{gap:6px}.wadehead .row{gap:5px}.wadehead .lamp{gap:5px;letter-spacing:.04em}}
/* The guide's own wading advice, where they wrote any. Sentence case and prose weight, so it
   cannot be mistaken for one of the card's instrument readings: it is a caution in their words,
   not a verdict this card computed. A water with no threshold still gets no verdict. */
.wadenote{display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:1.45;color:var(--muted)}
/* Phrases, separated rather than punctuated into a sentence: each one is its own fact and wraps
   as a unit, so a two-word phrase never breaks across lines. */
.wadenote .tags{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.wadenote .tags b{font-weight:400;color:var(--text);white-space:nowrap}
.wadenote .tags i{font-style:normal;opacity:.5}
/* The caption is one word on both variants now -- WADING or FLOW -- so it cannot break. The row
   still wraps as a backstop for a long state word on a narrow card. */
.headcap{white-space:nowrap}
.wadehead .row{flex-wrap:wrap;row-gap:4px}
.ranges{position:relative;height:14px;font-size:10px;letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.ranges span{position:absolute;white-space:nowrap}
.ranges .mid{transform:translateX(-50%);color:var(--text)}
/* Anchored to the tick rather than straddling it, near the ends. The end label is not what gives
   here: the wading limit is the number someone's safety turns on, and it may never be the thing
   that gets crowded or clipped by a scale bound the bar's own edge already shows. */
.ranges .mid.anchr{transform:translateX(calc(-100% - 4px))}
.ranges .mid.anchl{transform:translateX(4px)}
/* "Fair to Good" plus the word FISHING plus the meter overruns a 350px card. The word is the
   part that gives: a rating beside a lamp needs no caption. */
@container (max-width:409px){.fishlabel{display:none}}
/* The shop's rating is their word and must never break inside itself -- "FAIR TO / GOOD" reads as
   a mistake. Renaming this lamp to GUIDE REPORT made it five characters longer than UPDATED and
   pushed that rating into wrapping at 350px and below on the three waters rated "Fair to Good".
   The filler word goes instead: "REPORT SEP 4" still names the source, which is the whole reason
   the lamp was renamed. Same order of sacrifice as the strip's "Read" and the flow head's "for". */
.rateword{white-space:nowrap}
@container (max-width:359px){.guideword{display:none}}
/* The compact wading row carries the same caption, word and lamp as the expanded header, so the
   caption is not the part that gives -- dropping it made the two cards disagree at exactly the
   widths most people hold. Measured, the three fit on one line down to 335px and wrap at 330.
   Wrapped, the sentence lands alone under the lamp on the right and reads as a broken row rather
   than a second line, so below 335 it goes entirely. The threshold is still in the bar's
   aria-label at every width, and on the range row the moment the card is opened.
   The wrap stays as a backstop only: with the sentence gone nothing here can reach a second line. */
.wadingrow{flex-wrap:wrap;row-gap:4px}
@container (max-width:334px){.wadingnote{display:none}}
/* The compact hatch line carries four things that must not break internally -- the label, the
   insect and size, the guide's intensity word, and when. Below 360px they need 322px of a 286px
   row. Nothing here is droppable ("this afternoon" is the whole answer when the label reads
   "Next hatch"), so the row wraps instead and the compact card grows one line at those widths.
   Predates round 7; the overflow sweep is what found it. */
/* Three items now, not four: the timing moved into the label and the trailing "this afternoon"
   is gone, which is what was orphaning onto a second line. Below 360px the guide's intensity word
   is the part that gives -- when and what are the row's job, and the HATCH tab carries intensity
   properly with a meter and the guide's own caveat. The wrap rule stays as a backstop for an
   insect name longer than anything we carry today. */
/* A control, not a caption: full width, its own top rule, and an arrow that says it navigates. */
.hatchnow{width:100%;padding-top:10px}
.hatchnow .go{color:var(--accent);flex:none;font-size:12px}
@container (max-width:359px){.hatchword{display:none}}
@container (max-width:359px){.hatchnow{flex-wrap:wrap;row-gap:4px}}
/* Below 360px the strip is the tightest row on the card. "Read" goes first; if that is still
   three pixels short, the remaining spacing gives them up rather than the gauge name, which is
   the frame's whole point. No text is abbreviated at any width. */
@container (max-width:359px){.readword{display:none}.live{gap:5px}.live>b::after{padding-left:5px}}
/* 320px is the narrowest card we support, and the two longest gauge names ("USGS Pit No 1",
   "USGS Lewiston") are still four pixels over there. Tracking is the last thing to give: half the
   letter-spacing on this one 11px row buys ten pixels and reads the same. */
@container (max-width:329px){.live{letter-spacing:.04em}}
/* The caret itself, one size everywhere it means "this opens". The direction glyphs on the
   weather row and the flow unit are a different statement -- they report which way something is
   going, not whether a panel is open -- and keep their own sizes below. */
.cr{width:9px;height:9px;display:block;flex:none}
.chev{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;color:var(--accent);flex:none}
/* A plus, and a close: the same two strokes turned 45 degrees. render() replaces the node, so
   the resting angle is CSS and the tween is started by hand from the angle it just left --
   otherwise the icon would arrive already rotated and never animate. */
.chev .px{width:13px;height:13px;display:block;transition:transform .18s cubic-bezier(.4,0,.2,1)}
.chev[data-open=true] .px{transform:rotate(45deg)}
@media (prefers-reduced-motion:reduce){.chev .px{transition:none}}
.pack{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;height:48px;padding:0 14px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
/* Nothing to buy is not the primary action. Disabled loses the fill and reads as a state. */
.pack[disabled]{background:none;border:1px solid var(--line);color:var(--muted);cursor:default}
.pack>span{white-space:nowrap;flex:none}
.pack span:nth-child(2){color:var(--on-accent);opacity:.8}
.pack .packlabel{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pack .packlabel em{font-style:normal;display:none}
.pack .packlabel.short b{display:none}.pack .packlabel.short em{display:inline}
.ghost{display:flex;justify-content:space-between;align-items:center;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--text)}
/* Buy the flies, or hire the person: one decision, so one block. This was a bordered box sitting
   between the scroll content and the pinned controls and belonging to neither, which is why it
   read as orphaned. It sits directly ABOVE the CTA now, no border and no "Or" -- which reverses
   both halves of ticket 5's sketch. The relationship still reads without the conjunction, because
   the filled 48px button against a 34px line of text says which one is the offer, and putting the
   button last leaves it closest to the thumb. */
.guideline{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:34px;text-decoration:none;color:var(--text);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.guideline .tel{color:var(--accent);flex:none;white-space:nowrap}
.guideline .what{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Same idiom as the pack button: lay the long label out, and if it clips, fall back to a shorter
   phrase rather than an ellipsis. At 320px the primary line has 147px for a label that wants 168,
   and "With a guide" is a whole phrase where "Fish it with a g..." is a mistake. See fitLabels(). */
.glabel em{font-style:normal;display:none}
.glabel.short b{display:none}.glabel.short em{display:inline}
/* On a water with no pack this is the action, not the alternative -- it is the only thing the
   card can offer on the Trinity or the Pit today and it should read that way. */
/* The primary variant carries the whole phrase and the phone at every width down to 320. At the
   pack button's 13px/.12em it does not: "FISH IT WITH A GUIDE" plus a phone number needs 337px of
   a 350px card and the label was ellipsising to "FISH IT WITH A G...". A point of size and a
   little tracking buys 35px, and no word is lost at any width. */
.guideline.primary{min-height:48px;padding:0 14px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:12px;font-weight:700;letter-spacing:.1em}
.guideline.primary .tel{color:var(--on-accent);opacity:.85}
.nopack{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
/* expanded */
.head{display:flex;flex-direction:column;gap:10px;padding:14px 16px 10px}
.tabs{display:flex;background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:0 8px}
.tab{flex:1;height:44px;text-align:center;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--tab);box-shadow:inset 0 -2px 0 transparent}
.tab[aria-selected=true]{color:var(--text);box-shadow:inset 0 -2px 0 var(--accent)}
.card.open{height:min(78vh,720px);min-height:360px}
.head,.tabs,.buybar{flex:none}
.panelwrap{position:relative;flex:1 1 auto;min-height:0;display:flex}
.panelwrap.fade::after{content:'';position:absolute;left:0;right:0;bottom:0;height:24px;background:linear-gradient(transparent,var(--bg));pointer-events:none}
.panel{flex:1 1 280px;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.now{padding:16px;display:flex;flex-direction:column;gap:16px}
.sec{display:flex;flex-direction:column;gap:8px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.wx{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.wx .d{display:flex;flex-direction:column;gap:3px;min-width:0}
.wx .day{display:flex;align-items:center;gap:6px}
.wx .cond{font-size:10px;color:var(--muted)}
.wx .ic{flex:none;color:var(--text)}.wx .ic svg{width:16px;height:16px;display:block}
.temps{display:flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap}
.temps span{display:inline-flex;align-items:center;gap:2px}
.temps .lo{color:var(--muted);font-weight:400}
.temps svg{width:8px;height:8px;flex:none}
.note{font-size:13px;padding:10px 12px;border:1px solid var(--red);border-radius:10px}
/* Water temperature band. Same visual language as the flow bar and its wading threshold: a real
   measurement against a real threshold. Renders only when the gauge reports 00010. */
/* Cell shape comes from .bar and .bar.tall alone -- .band used to restate flex, height and
   radius, which made "are these the same cell?" a question about specificity rather than a fact.
   The band only says what differs: which cells are lit, and in what. */
.band i.in{background:color-mix(in srgb,var(--green),transparent 55%)}
/* Report age. Two zones lit quietly behind one accent cell, exactly like the temperature band --
   cell shape comes from .bar, so all three instruments draw the same cell. */
.age i.zc{background:color-mix(in srgb,var(--green),transparent 55%)}
.age i.zr{background:color-mix(in srgb,var(--amber),transparent 60%)}
.age i.cur{background:var(--accent)}
/* The reading, in the accent that means "you are here" on the flow bar and on the graph. It does
   not pulse: pulse means the number is live, and this one is hourly at best and routinely hours
   behind, which is why the row names its own read time underneath. */
.band i.cur{background:var(--accent)}
.slots{padding:8px 16px 16px;display:flex;flex-direction:column}
.slot{display:grid;grid-template-columns:74px minmax(0,1fr);gap:10px;align-items:center;min-height:64px;border-top:1px solid var(--line)}
.chip{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);justify-self:start;max-width:100%}
.chip[aria-expanded=true]{background:var(--surface2);border-color:var(--accent)}
.chip .dot{width:7px;height:7px;border-radius:50%;background:var(--off);flex:none}.chip[aria-expanded=true] .dot{background:var(--accent)}
.chip{justify-self:stretch;width:100%;min-width:0;gap:8px;padding:0 10px 0 12px}
.chip .word{font-size:11px;margin-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chip .care{display:inline-flex;align-items:center;margin-left:auto;color:var(--accent);flex:none;padding-left:6px}
/* Same 9px accent glyph as the header chevron, deliberately not in a circle: the circle is the
   expand/collapse shape, and two different actions must not look like one control. */
.chip{position:relative}
.chip .meter{cursor:help}
.tip{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:6;padding:8px 10px;background:var(--surface2);border:1px solid var(--line);border-radius:8px;font-size:11px;line-height:1.45;letter-spacing:0;text-transform:none;color:var(--text);text-align:left;box-shadow:var(--shadow);display:none}
.chip .meter:hover ~ .tip,.chip.tipopen .tip{display:block}
@media (hover:none){.chip .meter:hover ~ .tip{display:none}}
@container (max-width:399px){.chip .meter{display:none}}
.flies{padding:0 0 6px}
.only{display:inline-block;padding:1px 5px;border:1px solid var(--line);border-radius:3px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.pill[aria-pressed=true]{background:var(--surface2)}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--off)}.pill[aria-pressed=true] i{background:var(--accent)}
.rig{padding:12px 16px 8px;display:flex;flex-direction:column;gap:4px}
.filter{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--accent);border-radius:10px;margin-top:4px}
.group{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);padding:10px 0 4px}
.fly{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:56px;padding:5px 0;border-top:1px solid var(--line)}
/* Zero dims the row but never removes it: a fly you took out has to be a fly you can put back. */
.fly.zero{opacity:.45}
.thumb{width:36px;height:36px;border-radius:8px;background:var(--surface);border:1px solid var(--line);overflow:hidden;padding:0;display:block}
.thumb img{width:100%;height:100%;object-fit:cover}
.right .qtyline{display:flex;align-items:center;gap:8px}
/* Lightbox. Inside the shadow root, so it inherits the card's theme and cannot be styled by the
   host page. The name link still goes to the product; the image is its own affordance now. */
.lb{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72)}
.lbcard{position:relative;width:min(360px,100%);max-height:100%;overflow-y:auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--shadow)}
.lbimg{width:100%;aspect-ratio:1;border-radius:12px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
.lbimg img{width:100%;height:100%;object-fit:contain}
.lbclose{position:absolute;top:10px;right:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:50%;background:var(--bg);font-size:14px;line-height:1}
@media (prefers-reduced-motion:no-preference){.lb{animation:hm-fade .16s ease-out both}}
@keyframes hm-fade{from{opacity:0}to{opacity:1}}
/* A fly name is a short heading, not running prose, so it wants balance rather than pretty:
   pretty broke "Jigged Bird's / Nest" and "Pat's Rubber / Legs", balance gives "Jigged /
   Bird's Nest" and "Pat's / Rubber Legs". A two-word name that cannot fit on one line still
   wraps one-and-one, because no arrangement of two words avoids that. */
.name,.wname{text-wrap:balance}
.name{font-size:14px;font-weight:600;line-height:1.2}
/* balance, so "Natural Dark  #16" breaks as "Natural / Dark #16" rather than dropping the size
   onto a line of its own. A size orphaned under its colour reads as a separate fact. */
.meta{font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;text-wrap:balance}
.meta i{width:6px;height:6px;border-radius:50%;background:var(--red);flex:none}
.right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;white-space:nowrap}
.stock{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.stock i{width:6px;height:6px;border-radius:50%;background:var(--c)}
.edit{display:flex;align-items:center;gap:8px;padding:0 0 10px 48px;flex-wrap:wrap}
/* The chosen variant is the control that opens the rest. Same caret, same size, down closed. */
.optog{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}
.optog .meta{min-width:0}
.optog .care{display:inline-flex;align-items:center;color:var(--accent);flex:none}
.step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;height:36px}
.step button{width:36px;height:36px;font-size:16px;text-align:center}.step b{min-width:18px;text-align:center;font-size:13px}
/* One stepper component, two sizes. The small one fits the fly row and the pinned trip row. */
.step.sm{height:28px}
.step.sm button{width:28px;height:28px;font-size:14px}
.step.sm b{min-width:14px;font-size:12px}
.vchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:999px;font-size:12px}
.vchip[aria-pressed=true]{background:var(--surface2)}.vchip i{width:6px;height:6px;border-radius:50%;background:var(--off)}.vchip[aria-pressed=true] i{background:var(--accent)}
.vchip.oos{color:var(--muted);text-decoration:line-through}
.notes{padding:16px;display:flex;flex-direction:column;gap:14px}
.prose{font-size:15px;line-height:1.65;display:flex;flex-direction:column;gap:14px}.prose p{margin:0}
.foot{font-size:11px;letter-spacing:.06em;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
.buybar{border-top:1px solid var(--line);padding:6px 16px 10px;display:flex;flex-direction:column;gap:6px}
/* The three pack-shaping controls, one row, directly above the CTA. Anglers and days are not a
   destination -- they are a modifier on the buy action, so they sit on it. Section is their peer:
   it shapes the pack the same way. Present on every tab, so the pinned height never changes.
   Caption over control, not beside it. Measured: laid out inline the three need a 372px card and
   a 375x667 phone gives 335. Stacked they need 232 and keep the whole word at every width, in
   the same 44px -- so no label ever has to be dropped and no control ever has to shrink. */
.triprow{display:flex;align-items:flex-end;gap:12px;min-height:44px}
.tripctl{display:flex;flex-direction:column;align-items:flex-start;gap:3px;flex:none}
.tripctl .lab{white-space:nowrap;line-height:1}
.secsel{display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-left:auto;flex:0 1 auto;min-width:0;max-width:150px}
.secsel .lab{line-height:1}
.secsel .box{position:relative;display:inline-flex;align-items:center;height:28px;max-width:100%}
.secsel select{font:inherit;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:inherit;background:none;border:0;padding:0 14px 0 0;margin:0;cursor:pointer;appearance:none;-webkit-appearance:none;width:100%;text-overflow:ellipsis}
.secsel .care{position:absolute;right:0;display:inline-flex;align-items:center;color:var(--accent);pointer-events:none}
/* Was a 48px bordered box inside the scroll. It is a link, not a second buy button. */
.allflies{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:44px;margin-top:6px;border-top:1px solid var(--line);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.allflies span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.allflies span:last-child{color:var(--accent);flex:none}
.allflies.muted span{color:var(--muted)}
.powered{display:flex;justify-content:center;align-items:center;gap:6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.powered svg{width:12px;height:12px;color:var(--accent);opacity:.8}
.avatar{width:20px;height:20px;border-radius:50%;background:var(--off);flex:none}
/* The title is the water switcher. A bare caret at text size on the baseline -- never a second
   circular chevron, because the circle already means expand/collapse. */
button.title{display:inline-flex;align-items:baseline;gap:7px;max-width:100%}
button.title .tcare{display:inline-flex;align-items:center;align-self:center;color:var(--accent);flex:none}
/* Picker mode: the panel is taken over, not covered, so it inherits the scrolling already built. */
.waters{padding:4px 16px 16px;display:flex;flex-direction:column}
.wgroup{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);padding:14px 0 4px}
.wrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;min-height:56px;padding:9px 0;border-top:1px solid var(--line)}
.wrow[aria-current=true] .wname{color:var(--accent)}
.wname{grid-area:1/1;font-size:14px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wrow .lamp{grid-area:1/2;justify-self:end;font-size:10px}
.wsub{grid-area:2/1;font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px;min-width:0}
.wdate{grid-area:2/2;justify-self:end;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.empty{padding:20px 16px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--muted);line-height:1.6}
`;

  let fontInjected = false;
  function injectFont() {
    if (fontInjected || !FONT || FONT.startsWith('__')) return;
    fontInjected = true;
    const s = document.createElement('style');
    s.textContent = `@font-face{font-family:'Kode Mono';src:url(${FONT}) format('truetype');font-weight:400 700;font-display:swap}`;
    document.head.appendChild(s);
  }

  /* ---------- live data ---------- */
  /* USGS, two endpoints. The instantaneous-values service gives a six-hour series (for the trend);
     the newer OGC API gives the latest value only. Either reports CORS * as of Sep 2026. */
  /** Which way the river is going over the window the sparkline draws, not over the last six
      hours. Read across six hours a tailwater is permanently steady -- the Lower Sac moves 80 CFS
      while the week moves 1,148 -- so the arrow never appeared on the pilot river. Worse, a short
      window can point the opposite way to the graph beside it: the Pit was down 256 CFS in six
      hours and up 108 over the week. Five per cent of where the window started is the band; below
      that the river is holding and no arrow is drawn. The strip keeps the six-hour delta, which
      is a different fact and says so in words. */
  function weekTrend(series) {
    const v = (series || []).filter(x => x != null);
    if (v.length < 2) return '';
    const first = v[0], delta = v[v.length - 1] - first;
    return Math.abs(delta) < Math.max(1, first * 0.05) ? 'Steady' : delta > 0 ? 'Rising' : 'Falling';
  }

  /** A fixed historical window, for showing the card against a week the river actually did
      something -- a storm, spring runoff -- instead of whatever it happens to be doing today.
      It has to be the daily-values service, not the instantaneous one: nwis/iv answers 403 to a
      browser for any startDT/endDT, and for period=P365D, while accepting P7D and P30D. curl
      gets 200 for all of them, so this is only visible from a page. nwis/dv takes date ranges
      and returns one mean per day, which is 14 columns over 14 days. Never labelled live. */
  const fetchWindowLive = async (site, win) => {
    const r = await fetch(`https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${site}&parameterCd=00060&statCd=00003&startDT=${win[0]}&endDT=${win[1]}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ts = (await r.json()).value.timeSeries[0];
    if (!ts) throw new Error('no series for that window');
    const vals = ts.values[0].value.map(v => ({ value: +v.value, iso: v.dateTime })).filter(v => v.value >= 0).slice(-14);
    if (!vals.length) throw new Error('empty window');
    const last = vals[vals.length - 1];
    // Daily means: no sub-daily data, so no six-hour delta. That frame is dropped, not invented.
    const series = vals.map(v => v.value);
    return { value: last.value, at: last.iso, delta: null, hours: null, series, days: vals.length, trend: weekTrend(series), live: false, source: 'waterservices.usgs.gov/nwis/dv' };
  };
  const fetchWindow = (site, win) => cached(`win:${site}:${win.join('/')}`, () => fetchWindowLive(site, win), hasSeries);
  async function fetchFlowLive(site, win) {
    const errors = [];
    if (win) return fetchWindow(site, win);
    try {
      // Seven days, not six hours. Keswick releases move in discrete steps every few days, so a
      // six-hour window on a tailwater is flat noise -- it would draw a broken graph, not a calm
      // one. One request still: the six-hour delta is computed off the tail of this same series.
      const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00060&period=P30D`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ts = (await r.json()).value.timeSeries[0];
      const vals = ts.values[0].value.map(v => ({ value: +v.value, at: +new Date(v.dateTime), iso: v.dateTime })).filter(v => v.value >= 0 && v.at);
      if (!vals.length) throw new Error('empty series');
      const last = vals[vals.length - 1], end = last.at;
      const six = vals.filter(v => end - v.at <= 6 * 3600e3);
      const first = six.length > 1 ? six[0] : vals[0];
      const delta = last.value - first.value;
      const hours = Math.max(1, Math.round((end - first.at) / 3600000));
      // Thirty days in six-hour buckets. A week is too short a swath on a dam-controlled river:
      // the Lower Sac's seven-day spread is about 9% of its scale and its thirty-day spread is
      // 41%, so the month is where the shape actually is. A bucket the gauge did not report stays
      // null and draws as a gap rather than being interpolated across.
      const DAYS = 30, COLS = DAYS * 4, SPAN = DAYS * 24 * 3600e3 / COLS, acc = Array.from({ length: COLS }, () => ({ n: 0, sum: 0 }));
      for (const v of vals) {
        const i = COLS - 1 - Math.floor((end - v.at) / SPAN);
        if (i >= 0 && i < COLS) { acc[i].n++; acc[i].sum += v.value; }
      }
      const series = acc.map(b => b.n ? b.sum / b.n : null);
      return { value: last.value, at: last.iso, delta, hours, series, days: DAYS, trend: weekTrend(series), live: true, source: 'waterservices.usgs.gov/nwis/iv' };
    } catch (e) { errors.push(`nwis/iv: ${e.message}`); }
    try {
      const r = await fetch(`https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?monitoring_location_id=USGS-${site}&parameter_code=00060&f=json`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const f = ((await r.json()).features || []).find(x => x.properties && x.properties.parameter_code === '00060');
      if (!f) throw new Error('no streamflow feature');
      // Latest value only: no series, so no delta. That frame is dropped, not faked.
      return { value: +f.properties.value, at: f.properties.time, delta: null, hours: null, series: null, days: null, trend: '', live: true, source: 'api.waterdata.usgs.gov' };
    } catch (e) { errors.push(`ogcapi: ${e.message}`); }
    throw new Error(errors.join(' | '));
  }
  const fetchFlow = (site, win) => win ? fetchWindow(site, win) : cached(`flow:${site}`, () => fetchFlowLive(site), hasSeries);
  /* Water temperature (00010, Celsius) and turbidity (63680, FNU) off the same instantaneous-values
     service the flow comes from, so they cost one request and inherit its CORS. Neither is carried
     at every gauge -- Keswick reports neither, verified against the site's own series catalog on
     Sep 4 2026 -- so both are optional and a missing one drops its frame or its row. Nothing here
     substitutes air temperature for water, or derives a number from a word. */
  const fetchAux = site => cached(`aux:${site}`, () => fetchAuxLive(site), a => !!a && typeof a === 'object' && 'temp' in a && 'turbidity' in a);
  async function fetchAuxLive(site) {
    const out = { temp: null, turbidity: null, at: null };
    try {
      const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00010,63680&period=PT2H`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      for (const ts of ((await r.json()).value.timeSeries || [])) {
        const code = ts.variable.variableCode[0].value;
        const vals = ts.values[0].value.map(v => +v.value).filter(v => v > -999);
        if (!vals.length) continue;
        const last = vals[vals.length - 1];
        if (code === '00010') { out.temp = Math.round(last * 9 / 5 + 32); out.at = ts.values[0].value[ts.values[0].value.length - 1].dateTime || null; }
        if (code === '63680') out.turbidity = Math.round(last * 10) / 10;
      }
    } catch (e) { console.debug('[hatchmatch] water temp / turbidity unavailable at this gauge:', e.message); }
    return out;
  }
  /* Water temperature that USGS does not carry. CDEC has it hourly for the rivers we cover and
     sends no Access-Control-Allow-Origin, so a browser cannot read it: one endpoint on the
     existing Render service fetches, normalizes and re-serves it with CORS, cached fifteen
     minutes at the server because the sensor is hourly.

     THIS IS THE CARD'S ONE BACKEND DEPENDENCY, and it is deliberately the weakest kind: if the
     proxy is slow, down or never deployed, this rejects and the water-temperature row and strip
     frame stay dark exactly as they do today. Nothing else on the card changes, and no number is
     ever substituted for the one we could not get. A host that would rather run its own can point
     at it with data-temp-proxy. */
  const TEMP_PROXY = 'https://hatchmatch-api.onrender.com/api/water-temp';
  const fetchProxyTemp = (station, base) => cached(`ctemp:${station}`, () => fetchProxyTempLive(station, base), t => !!t && typeof t === 'object' && 'tempF' in t);
  async function fetchProxyTempLive(station, base) {
    const r = await fetch(`${base || TEMP_PROXY}?station=${encodeURIComponent(station)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (typeof j.tempF !== 'number') throw new Error(j.note || j.error || 'no reading');
    return { tempF: j.tempF, at: j.at || null, source: j.source || 'cdec.water.ca.gov' };
  }

  const WX = c => c === 0 ? 'clear' : c <= 2 ? 'mostly clear' : c === 3 ? 'clouds' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow' : 'storms';
  const fetchWeather = (lat, lon) => cached(`wx:${lat},${lon}`, () => fetchWeatherLive(lat, lon), wx => Array.isArray(wx) && wx.length > 0 && wx[0].hi != null);
  async function fetchWeatherLive(lat, lon) {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`);
    if (!r.ok) throw new Error(r.status);
    const d = (await r.json()).daily;
    return d.time.map((t, i) => ({
      day: new Date(t + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]),
      pct: d.precipitation_probability_max[i], label: WX(d.weather_code[i]),
    }));
  }

  /* ---------- instance ---------- */
  class Card {
    constructor(host, data) {
      // DATA is every water the shop publishes. The first is the one the card opens on.
      const list = Array.isArray(data) ? data : [data];
      this.host = host; this.reports = new Map(list.map(r => [r.water.id, r]));
      this.waters = list.map(r => ({ ...r.water, publishedAt: r.report.publishedAt, rating: r.report.rating, readOnly: !!r.readOnly }));
      this.resolved = list[0]; this.data = list[0];
      this.root = host.attachShadow({ mode: 'open' });
      const demo = new URLSearchParams(location.search).get('state') || host.dataset.demoState || '';
      this.demo = demo;
      // data-demo-window="2026-01-01/2026-01-08" shows the card against that week instead of now.
      const win = (host.dataset.demoWindow || '').split('/').filter(Boolean);
      this.window = win.length === 2 ? win : null;
      this.frame = 0; this.cycler = null; this.poll = null; this.loadToken = 0; this.scrollPos = {}; this.shownTab = null;
      const r0 = this.resolved;
      this.s = { open: false, tab: 'now', section: (r0.water.sections || [])[0], anglers: 1, days: 1, qty: {}, variant: {}, picker: false, expanded: new Set(), options: null, added: false, filled: false,
        flow: { value: 0, at: new Date().toISOString(), trend: '', delta: null, hours: null, series: null, days: null, live: false, failed: false }, weather: null, temp: null, tempAt: null, tempSource: null, turbidity: null, lightbox: null, tip: null };
      this.useReport(r0);
      const lr0 = this.data.water.flow.lastReading;
      this.s.flow.value = lr0 ? lr0.value : null;
      this.s.flow.at = lr0 ? lr0.at : new Date().toISOString();
      // Open the slot the angler is standing in, if it has a hatch. The rest start closed.
      const now = r0.hatches[this.slotNow()];
      if (now && !now.none) this.s.expanded.add(now.slot);
      this.events = [];
      this.root.addEventListener('click', e => this.onClick(e));
      // Native title does not exist on touch, so the meter gets a long press. Hover is CSS.
      this.root.addEventListener('touchstart', e => {
        const chip = e.target.closest?.('.chip');
        if (!chip || !e.target.closest?.('.meter')) return;
        this.press = setTimeout(() => { this.pressed = true; this.set({ tip: chip.dataset.slot }); }, 450);
      }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(t =>
        this.root.addEventListener(t, () => clearTimeout(this.press), { passive: true }));
      this.root.addEventListener('change', e => {
        const el = e.target.closest('[data-action="section"]');
        if (!el) return;
        this.set({ section: el.value, added: false });
        this.emit('section_switched', { section: el.value });
      });
      this.root.addEventListener('keydown', e => this.onKey(e));
      new MutationObserver(() => this.render()).observe(host, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-on-accent'] });
      this.render();
      this.emit('pack_viewed', { water: r0.water.id, report: r0.report.publishedAt });
      requestAnimationFrame(() => { this.s.filled = true; });
      this.load();
    }
    /** Replaces the whole report set on a card that is already mounted. This is the production
        path: the renderer ships with nothing inlined and the host hands it reports once they
        arrive. Re-mounting the same element instead would try to attach a second shadow root. */
    setReports(list) {
      this.reports = new Map(list.map(r => [r.water.id, r]));
      this.waters = list.map(r => ({ ...r.water, publishedAt: r.report.publishedAt, rating: r.report.rating, readOnly: !!r.readOnly }));
      this.resolved = list[0];
      this.useReport(list[0]);
      const w = this.data.water;
      this.s.section = (w.sections || [])[0];
      this.s.qty = {}; this.s.variant = {}; this.s.added = false; this.s.expanded = new Set(); this.s.options = null;
      const lrS = w.flow.lastReading;
      this.s.flow = { value: lrS ? lrS.value : null, at: lrS ? lrS.at : new Date().toISOString(), trend: '', delta: null, hours: null, series: null, days: null, live: false, failed: !w.usgsSite };
      this.s.weather = null; this.s.temp = null; this.s.tempAt = null; this.s.tempSource = null; this.s.turbidity = null;
      const now = this.data.hatches[this.slotNow()];
      if (now && !now.none) this.s.expanded.add(now.slot);
      clearInterval(this.poll); this.poll = null;
      this.render();
      this.load();
      return this;
    }
    /** Swaps which report the card is rendering. Phase B replaces pendingReport() with a real
        resolved report per water; everything downstream of here already works on one. */
    useReport(data) {
      // A water with no gauge has no published flow block at all. Normalise it once here so every
      // reader downstream sees the same shape and the existing null guards do the rest.
      if (!data.water.flow) data.water.flow = { min: null, max: null, threshold: null, thresholdLabel: '', lastReading: null };
      this.data = data;
      this.picks = (data.picks || []).filter(p => p.variant);
      this.byId = new Map(this.picks.map(p => [p.id, p]));
    }
    switchWater(id) {
      const from = this.data.water.id;
      if (id === from) { this.set({ picker: false }); return; }
      const next = this.reports.get(id);
      if (!next) return;
      this.useReport(next);
      clearInterval(this.poll); this.poll = null;
      this.s.section = this.data.water.sections[0];
      this.s.qty = {}; this.s.variant = {}; this.s.added = false; this.s.expanded = new Set(); this.s.options = null;
      const lrW = this.data.water.flow.lastReading;
      this.s.flow = { value: lrW ? lrW.value : null, at: lrW ? lrW.at : new Date().toISOString(), trend: '', delta: null, hours: null, series: null, days: null, live: false, failed: !this.data.water.usgsSite };
      this.s.weather = null; this.s.temp = null; this.s.tempAt = null; this.s.tempSource = null; this.s.turbidity = null;
      const now = this.data.hatches[this.slotNow()];
      if (now && !now.none) this.s.expanded.add(now.slot);
      this.set({ picker: false });
      this.emit('water_switched', { from, to: id });
      this.load();
    }
    /** Every load carries a token. Switching water starts a new one, and a response from an
        older load is dropped rather than painted -- otherwise a slow first request lands after
        the switch and puts one river's number under another river's gauge name. */
    async load() {
      const w = this.data.water, token = ++this.loadToken;
      const live = () => token === this.loadToken;
      // No gauge on file is not a failed fetch: nothing is tried, and the card says which it is.
      if (!w.usgsSite || this.demo === 'noflow') { this.s.flow.failed = true; this.render(); }
      else {
        fetchFlow(w.usgsSite, this.window).then(f => { if (!live()) return; this.s.flow = f; this.emit('flow_live', { value: f.value, at: f.at, source: f.source }); this.render(); })
          .catch(e => { if (!live()) return; this.s.flow.failed = true; this.s.flow.error = e.message; console.warn('[hatchmatch] flow unavailable, showing the report\'s last reading:', e.message); this.emit('flow_unavailable', { error: e.message }); this.render(); });
        fetchAux(w.usgsSite).then(a => {
          if (!live()) return;
          if (a.temp != null || a.turbidity != null) { this.s.temp = a.temp; this.s.tempAt = a.at || null; this.s.tempSource = 'gauge'; this.s.turbidity = a.turbidity; this.emit('water_aux', a); this.render(); }
          // The gauge on the river itself wins and costs no backend. The proxy only answers where
          // USGS reports no 00010 at all, which is the case on the pilot river.
          if (a.temp == null) this.loadProxyTemp(live);
        }).catch(() => { if (live()) this.loadProxyTemp(live); });
        this.watchFlow();
      }
      if (!w.usgsSite) this.loadProxyTemp(live);
      fetchWeather(w.lat, w.lon).then(wx => { if (!live()) return; this.s.weather = wx; this.render(); })
        .catch(e => { console.warn('[hatchmatch] weather unavailable, showing the report\'s outlook:', e.message); this.emit('weather_unavailable', { error: e.message }); });
    }
    /** LIVE has to be true to be worth saying. Re-read the gauge every five minutes, but only while
        the host is on screen. A refresh that fails keeps the last good number: only the first load
        is allowed to set `failed`, because that is the only one with nothing to fall back to. */
    watchFlow() {
      if (this.demo === 'noflow' || !window.IntersectionObserver) return;
      if (this.window) return;   // a fixed historical window has nothing to refresh
      const site = this.data.water.usgsSite, token = this.loadToken;
      const tick = () => fetchFlow(site)
        .then(f => { if (token !== this.loadToken) return; this.s.flow = f; this.emit('flow_live', { value: f.value, at: f.at, source: f.source }); this.render(); })
        .catch(e => console.warn('[hatchmatch] flow refresh failed, keeping the last reading:', e.message));
      new IntersectionObserver(([e]) => {
        clearInterval(this.poll); this.poll = null;
        if (e.isIntersecting) this.poll = setInterval(tick, 5 * 60 * 1000);
      }).observe(this.host);
    }
    /** The one backend call the card makes, and the only one it can do without. A water with no
        CDEC station never asks; a proxy that does not answer leaves the row and the strip frame
        dark, which is what they already do on every water USGS is silent about. */
    loadProxyTemp(live) {
      const w = this.data.water;
      if (!w.cdecStation || this.demo === 'notemp') return;
      fetchProxyTemp(w.cdecStation, this.host.dataset.tempProxy)
        .then(t => {
          if (!live()) return;
          this.s.temp = Math.round(t.tempF); this.s.tempAt = t.at; this.s.tempSource = 'proxy';
          this.emit('water_temp', { temp: t.tempF, at: t.at, source: t.source, via: 'proxy' });
          this.render();
        })
        .catch(e => {
          console.debug('[hatchmatch] water temp proxy unavailable, leaving the row dark:', e.message);
          this.emit('water_temp_unavailable', { station: w.cdecStation, error: e.message });
        });
    }
    emit(type, detail) {
      const ev = { type, at: new Date().toISOString(), water: this.data.water.id, ...detail };
      this.events.push(ev); (window.HatchMatch.events ||= []).push(ev);
      this.host.dispatchEvent(new CustomEvent('hatchmatch', { detail: ev, bubbles: true }));
      if (this.host.hasAttribute('data-debug')) console.debug('[hatchmatch]', ev);
    }
    set(patch) { Object.assign(this.s, typeof patch === 'function' ? patch(this.s) : patch); this.render(); }

    /* ---- derived ---- */
    theme() { return this.host.dataset.theme === 'light' ? 'light' : 'dark'; }
    accent() {
      const a = this.host.dataset.accent || 'orange';
      if (ACCENTS[a]) return ACCENTS[a];
      return [a, this.host.dataset.onAccent || '#081215'];
    }
    days() {
      if (this.demo === 'stale') return 40; if (this.demo === 'aging') return 20;
      return Math.max(0, Math.floor((Date.now() - new Date(this.data.report.publishedAt + 'T12:00:00')) / DAY));
    }
    freshFor(publishedAt) {
      if (!publishedAt) return null;
      const d = this.demo === 'stale' ? 40 : this.demo === 'aging' ? 20
        : Math.max(0, Math.floor((Date.now() - new Date(publishedAt + 'T12:00:00')) / DAY));
      // "Updated Sep 1" sits directly above a live CFS figure, where it reads as the date of the
      // flow rather than of the guide's report -- which is the one place on this card the two
      // kinds of freshness could be confused, and they are four days apart. Name whose date it
      // is. `short` is for the report-age block, whose own heading already says what it dates.
      const c = this.freshness();
      // CURRENT / RECENT / OLDER, not FRESH / AGING / STALE. This renders on the shop's own site
      // about the shop's own work, and "stale" grades their diligence rather than describing a
      // date -- the same failure ticket 6.3 existed to catch. These say how old it is and stop.
      const verdict = d < c.current ? 'Current' : d < c.recent ? 'Recent' : 'Older';
      // `labelShort` drops the word "Guide" so the header can shed it on a tight row. Naming the
      // source is what stops this reading as the date of the flow figure below it, and "report"
      // still does that -- where "Sep 1" alone would not.
      return { days: d, verdict, cutoffs: c,
               label: 'Guide report ' + shortDate(publishedAt), labelShort: 'report ' + shortDate(publishedAt),
               short: shortDate(publishedAt),
               color: d < c.current ? 'var(--green)' : d < c.recent ? 'var(--amber)' : 'var(--red)',
               stale: d >= c.recent };
    }
    fresh() { return this.freshFor(this.data.report.publishedAt) || { days: 0, verdict: 'None yet', cutoffs: this.freshness(), label: 'No guide report yet', labelShort: 'no report yet', short: '\u2014', color: 'var(--off)', stale: false }; }
    /** The shop's own answer where they have given one, the interim default where they have not.
        `shopSet` is what lets the card say which it is rather than presenting both as settled. */
    freshness() {
      const f = this.data.water.reportFreshness;
      return { current: (f && f.current) || FRESHNESS.current, recent: (f && f.recent) || FRESHNESS.recent, shopSet: !!f };
    }
    slotNow() { const h = new Date().getHours(); return h < 11 ? 0 : h < 15 ? 1 : h < 19 ? 2 : 3; }
    /** Which hatch to put on the compact card, and when the guide placed it.
        It no longer says "Hatching now", which was three claims the data does not support:
        the report is the guide's prose from a published date, not a live observation -- the
        Lower Sac's is four days old as this is written; the slot is a four-hour wall-clock
        bucket while the guide wrote "late afternoon"; and the intensity word is that guide's
        call on how the hatch has been THIS WEEK, which is what the HATCH tab's own tooltip
        says. The worst case was midday on the Lower Sac, where the card asserted a caddis
        hatch was happening now off a report that says "may or may not be happening".
        Naming the part of the day is a forecast, which is what the guide actually gave us. */
    hatchNow() {
      const H = this.data.hatches, i = this.slotNow(), now = H[i];
      if (!H.some(h => !h.none)) return null;
      // "<Time of day> hatch" at every hour -- no "this", no "at". The word "hatch" is what makes
      // the time a subject rather than a preposition dangling off the fly name beside it.
      // Tomorrow keeps its prefix and drops "hatch", because "tomorrow morning" is already a time
      // and the longer form does not fit the row at 320px.
      const at = (k, tomorrow) => tomorrow ? `Tomorrow ${SLOT_LABEL[SLOTS[k]].toLowerCase()}` : `${SLOT_LABEL[SLOTS[k]]} hatch`;
      if (now && !now.none) return { h: now, when: at(i, false) };
      const j = H.findIndex((h, k) => k > i && !h.none);
      const next = j >= 0 ? H[j] : H.find(h => !h.none);
      return { h: next, when: at(H.indexOf(next), j < 0) };
    }
    variantOf(p) { const id = this.s.variant[p.id]; return p.variants.find(v => v.id === id) || p.variant; }
    unavailable(v, p) { return !v.available || (this.demo === 'oos' && p.id === 'weiss'); }
    /** The hatch each pick is filed under: its own first tag that matches a listed slot. The report's
        tag order encodes which hatch the fly is really for. Anything matching no listed hatch is
        `null` and lands in ANYTIME. One pick, one group -- so the groups sum to the CTA's count. */
    listedHatches() { return new Set(this.data.hatches.filter(h => !h.none).map(h => h.key)); }
    groupOf(p) { const listed = this.listedHatches(); return p.hatches.find(h => listed.has(h)) || null; }
    /** Row model: substitute takes the row when the chosen variant is out of stock.
        rows() is the whole pack for the section; rows(key) is one hatch group, rows(null, true) ANYTIME. */
    rows(hatch = undefined, anytime = false) {
      const mult = this.s.anglers * this.s.days;
      const pick = p => hatch === undefined ? true : anytime ? this.groupOf(p) === null : this.groupOf(p) === hatch;
      // A read-only water has no roles and no sections -- the page gives neither. Its flies group
      // under the shop's own sub-heads ("Nymphs/Wet Flies", "Eggs", "Swing Flies") where the page
      // has them, and under one heading where it does not. Nothing is invented to fill the gap.
      if (this.data.readOnly) {
        const seen = [...new Set(this.picks.map(p => p.group || 'Hot flies'))];
        return seen.map(label => ({
          role: { key: label, label },
          flies: this.picks.filter(p => (p.group || 'Hot flies') === label && pick(p)).map(p => {
            const v = this.variantOf(p);
            return { p, use: p, v, per: null, qty: null, sub: null, price: v.price, oos: this.unavailable(v, p) };
          }),
        })).filter(g => g.flies.length);
      }
      const out = [];
      for (const role of this.data.roles) {
        const flies = this.picks
          .filter(p => p.role === role.key && p.sections.includes(this.s.section) && pick(p))
          .map(p => {
            const per = this.s.qty[p.id] != null ? this.s.qty[p.id] : p.qty, qty = per * mult;
            let v = this.variantOf(p), use = p, sub = null;
            if (this.unavailable(v, p)) {
              const alt = (this.data.substitutes[p.id] || []).map(id => this.byId.get(id)).find(s => s && !this.unavailable(this.variantOf(s), s));
              if (alt) { sub = { name: p.name }; use = alt; v = this.variantOf(alt); }
            }
            return { p, use, v, per, qty, sub, price: v.price * qty, oos: this.unavailable(v, p) && !sub };
          });
        if (flies.length) out.push({ role, flies });
      }
      return out;
    }
    /** The pack is the whole rig for the section. There is exactly one of these, and one buy button. */
    pack() {
      // No quantities, no pack. The all-flies link still works: it is a catalog link, not a cart.
      if (this.data.readOnly) return { items: [], flies: 0, total: 0, url: null };
      const items = this.rows().flatMap(g => g.flies).filter(r => r.qty > 0 && !r.oos);
      const flies = items.reduce((n, r) => n + r.qty, 0), total = items.reduce((n, r) => n + r.price, 0);
      return { items, flies, total, url: this.cartUrl(items) };
    }
    /** GET /cart/add appends to the customer's existing cart and lands on the cart page. Hidden line-item
        properties (underscore prefix) put the report on the order without showing the customer. The
        permalink form (/cart/{id}:{qty}) replaces the cart, so it is not used. */
    utm() { return `utm_source=hatchmatch&utm_medium=widget&utm_campaign=${encodeURIComponent(this.data.water.id)}`; }
    cartUrl(items, landing) {
      const w = this.data.water, report = `${w.id}-${this.data.report.publishedAt}`;
      const u = new URL(`${this.data.storeUrl}/cart/add`);
      items.forEach((r, i) => {
        u.searchParams.set(`items[${i}][id]`, String(r.v.id));
        u.searchParams.set(`items[${i}][quantity]`, String(r.qty));
        u.searchParams.set(`items[${i}][properties][_hatchmatch_report]`, report);
        u.searchParams.set(`items[${i}][properties][_hatchmatch_section]`, this.s.section);
      });
      const dest = landing || `/cart?${this.utm()}`;
      u.searchParams.set('return_to', `/cart/update?attributes[hatchmatch_report]=${encodeURIComponent(report)}&attributes[hatchmatch_water]=${encodeURIComponent(w.id)}&return_to=${encodeURIComponent(dest)}`);
      return u.toString();
    }
    /** The catalog link hands the shop a warm cart: the same /cart/add the pack button fires, but
        landing on the collection instead of the cart. One navigation, so no cross-site cookie
        problem -- Shopify adds the items and then forwards to the collection page. */
    catalogUrl() {
      const k = this.pack();
      const collection = `${this.data.fliesCollection || '/collections/flies'}?${this.utm()}`;
      return k.items.length ? this.cartUrl(k.items, collection) : this.data.storeUrl + collection;
    }

    /* ---- templates ---- */
    /** Decorative by default. Given a label it becomes an image with a name, so the guide's word
        and the value are reachable without hovering anything. */
    meter(n, wide, label) {
      const a = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
      return `<span class="meter${wide ? ' wide' : ''}"${a}>${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    }
    flowBar(tall) {
      const F = this.data.water.flow, f = this.s.flow, segs = 24;
      // No published range, or nothing ever read from the gauge. A bar without a scale or without
      // a value is a decoration, so there isn't one.
      if (F.max == null || f.value == null) return '';
      // A range without a wading threshold is a real shape: not every water has a limit a guide
      // will stand behind. No tick, no amber, and the label says the range and nothing more.
      const lim = F.threshold != null;
      // Ceil, not round: the bar's job is the wading limit, and a river at 7,670 against a 7,500
      // limit has to light a segment above the line. Rounding stopped the fill at 7,500 exactly
      // and the bar showed no over-limit colour at all until the river was a third of a segment
      // past it.
      const filled = f.failed ? 0 : Math.max(0, Math.min(segs, Math.ceil((f.value - F.min) / (F.max - F.min) * segs)));
      const cells = Array.from({ length: segs }, (_, i) => {
        const on = i < filled, top = F.min + (i + 1) * (F.max - F.min) / segs;
        const color = lim && top > F.threshold ? 'var(--amber)' : `color-mix(in srgb, var(--water1), var(--water2) ${Math.round(i / (segs - 1) * 100)}%)`;
        // The last lit cell is where the river actually is. It gets the accent and, when the
        // reading is live, the pulse -- the same thing "now" already looks like on the graph
        // directly above this bar. Before, the only mark on the bar was the wading limit, so the
        // loudest thing on it was the fact people were least asking about.
        const cur = on && i === filled - 1;
        return `<i class="${on ? 'on' : ''}${cur ? ' cur' : ''}${on && !this.s.filled ? ' fill' : ''}" style="--i:${i};--seg:${color}"></i>`;
      }).join('');
      const tick = lim ? `<span class="tick" style="left:${((F.threshold - F.min) / (F.max - F.min) * 100).toFixed(2)}%"></span>` : '';
      const label = `${num(f.value)} CFS on a scale of ${num(F.min)} to ${num(F.max)}` + (lim ? `, ${F.thresholdLabel} ${num(F.threshold)}` : '');
      return `<div class="bar${tall ? ' tall' : ''}${f.live && !f.failed ? ' barlive' : ''}" role="img" aria-label="${label}">${cells}${tick}</div>`;
    }
    ratingOf(r) { return { label: r, n: { Poor: 1, Fair: 2, 'Fair to Good': 3, Good: 4, Great: 5 }[r] || 0 }; }
    /** The guide's clarity word, lit the way the wading lamp beside it is. Poor / Fair / Good /
        Excellent is their own four-value ordinal and this reads it rather than scoring it: the two
        words that mean you can see get green, the two that mean you cannot get amber. Same two
        colours as the wading lamp, so the row speaks one vocabulary rather than two.
        A word outside those four gets the accent and makes no claim -- lighting an unrecognised
        word green or amber would be exactly the invention this avoids. */
    clarityLamp(word) {
      return {
        excellent: 'var(--green)', good: 'var(--green)', fair: 'var(--amber)', poor: 'var(--amber)',
        // Not grades. "Clearing" is a direction and gets the neutral accent -- the guide is saying
        // it is improving, not saying it is good. The two dirty-water words are amber because they
        // are the guide's own description of water you will struggle to fish.
        // Neither of these is a grade: one is a direction, the other is a forecast. Both take the
        // neutral accent so the row never reads them as "the water is good" or "the water is bad".
        clearing: 'var(--accent)', variable: 'var(--accent)',
        'off colour': 'var(--amber)', stained: 'var(--amber)',
      }[String(word || '').toLowerCase()] || 'var(--accent)';
    }
    rating() { return this.ratingOf(this.data.report.rating); }
    wading() {
      const F = this.data.water.flow, f = this.s.flow;
      if (F.threshold == null || f.value == null) return null;
      const ok = !f.failed && f.value < F.threshold;
      // The lamp describes the water; the note beside it carries the shop's rule. "Not today" was
      // the card telling an experienced angler what to do with their day, off one number, and it
      // read as exactly that. "High" is the same fact without the instruction -- and it is what
      // anglers actually say -- so the call stays with the person standing in the river. The pair
      // is one flow vocabulary now rather than a verdict on one side and a level on the other,
      // which also drops the "Wadeable / Wadeable below 7,500 CFS" stutter.
      return { label: ok ? 'Normal' : 'High', color: ok ? 'var(--green)' : 'var(--amber)', note: `Wadeable below ${num(F.threshold)} CFS` };
    }
    /** Only reached when both endpoints failed. The live reading says the same things in the strip. */
    /** Three different silences, said differently. No gauge on file, a gauge we have never read,
        and a gauge that answered once and has stopped are not the same fact, and a gauge that is
        unreachable must never render as a river at zero. */
    flowNote() {
      const w = this.data.water, f = this.s.flow;
      if (!w.usgsSite) return w.gaugeNote || 'No live gauge on file for this water.';
      if (f.value == null) return `No reading from ${w.gaugeName || 'the gauge'} yet. Flow will appear here when it answers.`;
      const time = new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
      return `Flow data unavailable. Last reading ${num(f.value)} CFS at ${time}.`;
    }
    /** The shop's own name for the pack wins; otherwise the water's short name. */
    packName() { const w = this.data.water; return w.packName || `${w.shortName} pack`; }
    /** "the Pit", "the Trinity", "the Lower Sac" -- but "Hat Creek" and "Fall River", which take
        no article in the way anyone who fishes them says it. Getting a river's name wrong in
        copy about that river is the same class of error as describing it wrong. */
    theName(short) { return /creek$|^fall river$/i.test(short) ? esc(short) : `the ${esc(short)}`; }
    packButton() {
      const k = this.pack();
      // The page lists this water's flies but sets no quantities, so there is no pack to add.
      // Inventing "two of each" is the same class of invention as inventing a hatch slot.
      if (this.data.readOnly) return `<button class="pack" disabled><span class="packlabel"><b>No pack for ${this.theName(this.data.water.shortName)} yet</b><em>No pack yet</em></span><span></span><span>&mdash;</span></button>`;
      if (this.s.added) return `<button class="pack" data-action="viewcart"><span>Added</span><span></span><span>View cart</span></button>`;
      // Three columns, always. When it will not all fit, the water name is the part that goes:
      // the count and the price are the promise. See fitLabels().
      return `<button class="pack" data-action="addpack" ${k.flies ? '' : 'disabled'}><span class="packlabel"><b>Add ${esc(this.packName())}</b><em>Add pack</em></span><span>${k.flies} ${k.flies === 1 ? 'fly' : 'flies'}</span><span>${money(k.total)}</span></button>`;
    }
    /** The guide line, directly under the CTA and part of the same block. On a water that sells a
        pack it is the alternative to buying one and says so with OR; on a water that cannot, it is
        the primary action and carries the fill. */
    guideCta(primary) {
      const w = this.data.water;
      if (!w.guidePhone) return '';
      return `<a class="guideline${primary ? ' primary' : ''}" href="tel:${w.guidePhone.replace(/\D/g, '')}" data-action="guide">`
        + `<span class="what glabel"><b>Fish it with a guide</b><em>With a guide</em></span>`
        + `<span class="tel">${esc(w.guidePhone)}</span></a>`;
    }
    /** The title row: the water switcher, and the open/close control.
        The title is the switcher in BOTH states now. Compact used to get a plain word, because
        the whole face was one button and a button cannot hold another -- so this row is lifted
        out of that button and the two controls stand on their own, the same move the hatch line
        made. Tapping the title on a compact card opens the card on the water list.
        The two controls no longer share a shape at all: a caret for the switcher, a plus that
        rotates into a close for the card itself. */
    titleRow(open) {
      const name = esc(this.data.water.name);
      const title = this.waters.length > 1
        ? `<button class="title" data-action="waters" data-focus="waters" aria-expanded="${open && this.s.picker}" aria-label="Switch water. Currently ${name}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span><span class="tcare">${CARET(open && this.s.picker)}</span></button>`
        : `<div class="title">${name}</div>`;
      return `<div class="between">${title}<button class="chev" data-open="${open}" data-action="${open ? 'collapse' : 'expand'}" data-focus="openclose" aria-expanded="${open}" aria-label="${open ? 'Close the report' : 'Open the report'}">${PLUSX}</button></div>`;
    }
    /** Report date and rating. Never a control, so it stays inside the card face. */
    lampRow() {
      const fr = this.fresh(), r = this.rating();
      return `<div class="between">
      <span class="lamp" style="--c:${fr.color};font-size:11px"><i></i><span class="guideword">Guide </span>${fr.labelShort}</span>
      ${r.n ? `<span class="row" style="gap:8px"><span class="label fishlabel">Fishing</span><span class="caps rateword" style="font-weight:600;letter-spacing:.12em">${esc(r.label)}</span>${this.meter(r.n)}</span>` : `<span class="label">Not rated yet</span>`}
    </div>`;
    }
    /** Report age and live flow are different facts. The lamp above owns the age and stays still;
        this strip owns what is actually changing. Each frame is a fact the card does not already
        show: when it was read, how fast it is moving, how cold it is. A frame whose source is
        missing is dropped, never faked -- one frame is a fine strip. Returns HTML, not text. */
    liveFrames() {
      const f = this.s.flow, out = [];
      if (f.failed) return [];
      const time = new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      // "Read 5:54 PM · USGS Pit No 1" needs 269px of a 252px strip on a 350px card. The gauge
      // name is the identifying fact and the time is the changing one; "Read" is the filler, so
      // that is what goes when the row is tight. Nothing is abbreviated and nothing is cut.
      out.push(`<span class="readword">Read </span>${esc(time)} &middot; ${esc(this.data.water.gaugeName)}`);
      // Signed number, not a caret: the caret on the flow figure is the one place trend is stated,
      // and it reads the classified trend. This reads the measurement, which can be -20 while the
      // classification is still Steady. Two carets disagreeing six pixels apart is worse than none.
      if (f.delta != null && f.hours) {
        const d = Math.round(f.delta);
        out.push(d === 0
          ? `Holding for ${f.hours} hrs`
          : `${d > 0 ? '+' : '\u2212'}${num(Math.abs(d))} CFS in ${f.hours} hrs`);
      }
      // CDEC's hourly sensor routinely runs several hours behind, and this frame sits inside a
      // block headed LIVE. A fresh reading is stated plainly; an older one names its own hour
      // rather than borrowing the flow reading's. Past a day it is not a reading, and it is gone.
      const pos = this.flowPosition();
      if (pos) out.push(esc(`${pos.word} for ${pos.when}`));
      if (this.s.temp != null) {
        const age = this.s.tempAt ? (Date.now() - new Date(this.s.tempAt)) / 3600e3 : 0;
        if (age <= 24) {
          const hr = this.s.tempAt ? new Date(this.s.tempAt).toLocaleTimeString('en-US', { hour: 'numeric' }) : '';
          out.push(age > 2 && hr ? `Water ${this.s.temp}&deg; at ${esc(hr)}` : `Water ${this.s.temp}&deg;`);
        }
      }
      return out;
    }
    /** Where the reading sits in this river's own record for this time of year, against the
        percentiles USGS publishes per calendar day. Descriptive and measured, and positive when
        the water is good -- which is what the Pit at 857 CFS needed and had nothing to say.

        It is NOT a wading verdict and must never become one. A river can sit dead in the middle
        of its normal range and still be dangerous to wade; the Pit's own report says it is a
        slippery river and to carry a staff. Waters with no threshold on file show this and no
        verdict, and the threshold stays a number a guide sets. */
    flowPosition() {
      const P = this.data.water.flow.position, f = this.s.flow;
      // A historical window is not "now", and a failed or absent reading has nothing to place.
      if (!P || !P.bands || !f.live || f.failed || f.value == null || this.window) return null;
      const now = new Date(), third = now.getDate() <= 10 ? 0 : now.getDate() <= 20 ? 1 : 2;
      const b = P.bands[now.getMonth() * 3 + third];
      if (!b) return null;
      const [p10, p25, p75, p90] = b;
      const word = f.value < p10 ? 'Well below normal'
        : f.value < p25 ? 'Below normal'
        : f.value <= p75 ? 'Near normal'
        : f.value <= p90 ? 'Above normal' : 'Well above normal';
      // One or two words for the lamp, and deliberately NOT the wading vocabulary. Once the shop
      // supplies thresholds a river can show both lamps at once, and "WADING HIGH" beside "FLOW
      // HIGH" would be two different measurements wearing the same word. Up and down are what
      // anglers say about a river against its own normal, and they cannot be confused with a
      // limit. The strip keeps the full sentence, where there is room to say it properly.
      const short = f.value < p10 ? 'Well down' : f.value < p25 ? 'Down'
        : f.value <= p75 ? 'Typical' : f.value <= p90 ? 'Up' : 'Well up';
      // Word and period separately, because two places need different halves: the strip says the
      // whole sentence, the wading header puts the period in its caption so that "normal" there
      // cannot be read as the wading verdict of the same name on the pilot river.
      // Inside p10-p90 is this river's usual span for the date; outside it is the outlier. That
      // is the definition of the band, not a judgement laid over it -- which is what lets this
      // lamp take a state colour without becoming the wading verdict 6.4 forbids. No word here
      // says anything about safety.
      const usual = f.value >= p10 && f.value <= p90;
      return { word, short, when: `${THIRDS[third]}\u00A0${MONTHS[now.getMonth()]}`, usual, years: P.years || null };
    }
    liveStrip() {
      const frames = this.liveFrames();
      if (!frames.length) return '';
      const f = this.s.flow, at = this.frame % frames.length;
      return `<div class="live"><i class="${f.live ? 'pulse' : ''}"></i><b>${f.live ? 'Live' : 'Last reading'}</b><span class="frames">${frames.map((t, i) => `<span class="${i === at ? 'on' : ''}"${i === at ? '' : ' aria-hidden="true"'}>${t}</span>`).join('')}</span></div>`;
    }
    /** REVERSAL of round 3: the caret is back. The sparkline says direction, magnitude and shape
        on a river that moves -- and says none of them legibly on a stable tailwater, which is the
        river the shop will actually look at. Direction now appears twice on purpose: the caret is
        precise and always legible, the sparkline is contextual and sometimes flat. */
    /** The unit, with an arrow above it when the river is rising and below it when it is falling.
        Never both, and nothing at all when it is steady -- an arrow that is always there stops
        meaning anything. */
    unitStack() {
      const f = this.s.flow;
      const dir = f.failed || !f.trend || f.trend === 'Steady' ? null : (f.trend === 'Rising' ? 'up' : 'down');
      const arrow = d => `<span class="ar" role="img" aria-label="${f.trend}">${CARET(d === 'up')}</span>`;
      return `<span class="unitstack">${dir === 'up' ? arrow('up') : ''}<span class="unit" style="font-size:11px;letter-spacing:.14em">CFS</span>${dir === 'down' ? arrow('down') : ''}</span>`;
    }
    /** Round values on a 1-2-2.5-5 ladder, so a 0-15,000 river reads 5K and 10K. They sit at one
        third and two thirds rather than anywhere the eye finds unaided, so each carries a rule
        across the plot: a 9px label cannot point at a 3px row on its own. */
    scaleTicks(max) {
      const raw = max / 4, e = Math.floor(Math.log10(raw)), base = 10 ** e;
      const step = [1, 2, 2.5, 5, 10].map(m => m * base).find(v => v >= raw) || 10 * base;
      const out = [];
      // Interior values only: the top of the grid is the scale max by definition, and a label
      // centred on that edge hangs half outside.
      for (let v = step; v < max - 1e-9; v += step) out.push(v);
      return out;
    }
    /** The month as a hydrograph, rasterized onto a cell grid. The sampled series and the fixed
        scale are unchanged -- only how it is drawn. A column the gauge never reported lights
        nothing, and a real reading always lights at least one cell, so low water and no data
        never look the same. */
    sparkline() {
      const F = this.data.water.flow, f = this.s.flow;
      if (f.failed || !f.series || F.max == null) return '';
      // Columns follow the width the graph actually got, at a 4px pitch, so a wide card shows
      // more of the month at finer resolution instead of leaving the space empty. render()
      // measures and corrects this on the pass after the first.
      const COLS = this.sparkCols || 30, ROWS = 10;
      const span = F.max - F.min, src = f.series;
      if (src.length < 2) return '';
      // Resample to the column count. Over thirty days at thirty columns that is a day a column.
      const cols = Array.from({ length: COLS }, (_, c) => {
        const lo = Math.floor(c * src.length / COLS), hi = Math.max(lo + 1, Math.floor((c + 1) * src.length / COLS));
        let n = 0, sum = 0;
        for (let i = lo; i < hi && i < src.length; i++) if (src[i] != null) { n++; sum += src[i]; }
        return n ? sum / n : null;
      });
      // Round, not ceil. Ceil put 7,690 CFS on a 0-15,000 scale six rows up, whose top edge is
      // 9,000 -- overstating by 1,310 and rendering just under the 10K label. Rounding lands it
      // on five rows, 7,500, which is 190 out and reads correctly against the labels.
      const row = v => Math.max(1, Math.min(ROWS, Math.round((v - F.min) / span * ROWS)));
      const cells = cols.map((v, i) => {
        const cur = i === cols.length - 1 ? ' cur' : '';
        if (v == null) return `<span class="col${cur}">${'<i></i>'.repeat(ROWS)}</span>`;
        const lit = row(v);
        return `<span class="col${cur}">${Array.from({ length: ROWS }, (_, r) =>
          `<i class="${r < lit - 1 ? 'on' : r === lit - 1 ? 'on top' : ''}"></i>`).join('')}</span>`;
      }).join('');
      const fmt = v => v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(Math.round(v));
      // Exact heights, never snapped to a row: the cells are the approximation, the labels are not.
      const at = v => (100 - (v - F.min) / span * 100).toFixed(2);
      const ticksY = this.scaleTicks(F.max);
      const ylab = ticksY.map(v => `<b style="top:${at(v)}%">${fmt(v)}</b>`).join('');
      const seen = src.filter(v => v != null);
      const label = `${f.days} days of flow, ${num(Math.round(Math.min(...seen)))} to ${num(Math.round(Math.max(...seen)))} CFS, scale ${num(F.min)} to ${num(F.max)}`;
      const widest = ticksY.reduce((n, v) => Math.max(n, fmt(v).length), 2);
      return `<span class="spark${f.live ? ' hg-live' : ''}" style="--lab:${widest}" role="img" aria-label="${label}">`
        + `<span class="yaxis" aria-hidden="true">${ylab}</span>`
        + `<span class="grid">${cells}</span>`
        + `</span>`;
    }
    /** The container query that sizes the graph keys off the card, so the renderer has to ask the
        same question to pick a column count. */
    cardWidth() {
      const el = this.root.querySelector('.card');
      return el ? el.getBoundingClientRect().width : 440;
    }
    /** The whole flow instrument. Compact and expanded render the same thing; expanded adds the
        range labels under the bar and nothing else. */
    flowModule(expanded) {
      const f = this.s.flow;
      // REVERSAL of the bar's home. The bar is the wading instrument, so expanded it goes and
      // lives with the wading words -- figure, caret, graph and strip are what is left here.
      // Compact keeps it: there is no wading section on that card to move it to, and the flow
      // module is the whole of it. Safe to split now only because the graph carries its own
      // y-axis labels; through round 6c the bar's labelled scale was the graph's only legend.
      //
      // The strip sits ABOVE the bar, which reverses the round-7 call to leave it at the foot of
      // the block. That call rested on two things: metadata belongs at the end of a block, and
      // moving it would split the bar from the scale labels beneath it. The second reason stopped
      // being true in the same round -- the 0/limit/max labels went with the bar into the WADING
      // block, so the compact bar has nothing under it to be separated from. What is left is the
      // reading and its provenance sitting together, with the bar closing the block.
      const strip = f.failed
        ? `<div class="lamp muted" style="--c:var(--amber);text-transform:none;letter-spacing:0;font-size:12px;white-space:normal"><i></i>${this.flowNote()}</div>`
        : this.liveStrip();
      return `<div class="flowmod">
      ${this.data.water.usgsSite && f.value != null ? `<div class="flownum"><span class="big xl" style="color:${f.failed ? 'var(--muted)' : 'var(--text)'}">${num(f.value)}</span>${this.unitStack()}${this.sparkline()}</div>` : ''}
      ${strip}
      ${expanded ? '' : this.flowBar(true)}
    </div>`;
    }
    /** The wading block, expanded only: the verdict and its threshold sentence, the bar with its
        own 0 / limit / max labels, and clarity as words. One block, not two columns -- the tick
        meter that used to hold the right column is gone (round 7, ticket 2.2): its positions were
        invented placements for a four-value ordinal, and a meter that visualises a guess does not
        belong beside instruments that report measurements. The word is the honest whole of it.
        A water with no threshold on file still has a bar worth showing -- it is this river's flow
        on this river's own scale -- so the block renders without a verdict and says which it is. */
    wadingBlock() {
      const d = this.data, w = this.wading(), F = d.water.flow;
      const bar = this.flowBar(true), clarity = d.report.clarity, turb = this.s.turbidity;
      // The Fall River and the McCloud have no gauge, so there is no bar, no verdict and no
      // scale -- but people still wade them, and the caution is true without a gauge. They get
      // the note on its own rather than nothing: no heading, no axis, nothing that would imply
      // a measurement the card does not have.
      // The left slot holds the most load-bearing state this water has. With a wading limit on
      // file that is the verdict; without one it is where the flow sits in this river's own
      // record, which is the whole reason ticket 6.4 computed it -- five of eight waters had
      // nothing to say here otherwise. The caption names the comparison, so NORMAL under WADING
      // and BELOW NORMAL under FLOW FOR EARLY SEP cannot be read as the same measurement.
      // Its lamp is the accent and not a state colour: the percentile is descriptive, and
      // lighting "well above normal" amber would turn it into the safety verdict 6.4 forbids.
      // Two slots, and the data decides what fills them. Left is the wading verdict where a guide
      // has set a limit; right is the shop's clarity word where they gave one. Flow position
      // fills whichever of the two the data cannot -- so a water always shows the most it honestly
      // has, and the row keeps its shape. Today that is wading+clarity on the pilot and flow alone
      // elsewhere; the moment the shop returns thresholds it becomes wading+flow on the rest.
      const pos = this.flowPosition();
      // This block is the wading instrument, so its caption is WADING on every water and its
      // state is about wading. Where the flow sits against its own record is a fact about flow,
      // and it belongs to the flow module above -- the figure, the graph and the live strip --
      // which already carries it. Showing it here made a block headed for one thing report
      // another.
      //
      // Without a limit there is no verdict, and the card says which it is rather than guessing.
      // The unlit dot is the same mark clarity uses for "the guide made no call": an absence,
      // read as an absence. A number in waters.json turns it into NORMAL or HIGH the same day.
      let head = w ? { cap: 'Wading', word: w.label, color: w.color }
        : { cap: 'Wading', word: 'Not set', color: 'var(--off)', muted: true };
      // Turbidity from a gauge where one reports it, otherwise the visibility the guide wrote.
      // Both are measurements, so both sit in the same slot beside the word.
      // Clarity always has a slot. Where the guide called it, that is the call; where they did
      // not, the card says so rather than leaving a gap the reader has to interpret -- an absent
      // row and a clear river look identical otherwise. The unlit dot is the card's existing mark
      // for "no data", so the absence reads as an absence and not as a grade.
      const flowSlot = null;
      let right = clarity
        ? { cap: 'Clarity', word: clarity, color: this.clarityLamp(clarity),
            detail: turb != null ? `${turb}\u00A0FNU` : (d.report.clarityDetail || null) }
        : { cap: 'Clarity', word: 'No call', color: 'var(--off)', muted: true, detail: null };
      // A water with no gauge has no bar, so "Flow range" would caption nothing. Where that
      // leaves only clarity, it takes the left slot rather than sitting alone on the right.
      if (!head && right) { head = right; right = null; }
      const tickPct = F.max == null || F.threshold == null ? null : (F.threshold - F.min) / (F.max - F.min) * 100;
      const tick = tickPct == null ? null : tickPct.toFixed(2) + '%';
      // Which side of its own tick the limit label hangs on. Centred it straddles the tick, which
      // is what you want in the middle of the bar and exactly what collides at the ends: Hat
      // Creek's limit is 150 of 200, so "150 WADING LIMIT" centred at 75% runs into the "200" at
      // 350px and overlaps it outright at 320. Near an end the label anchors to its tick and grows
      // inward instead. No measurement and no observer -- the tick percentage is known at render
      // and the container queries stay the only thing that reads the width.
      // The mid slot of the axis names what the bar is measured against: the wading limit at its
      // own tick where there is one, otherwise the record the position verdict comes from. It sits
      // centred and in the same white as the limit label, because it labels the row rather than a
      // point -- there is no single CFS value for "the record" to sit on.
      const midAnchor = tickPct == null ? '' : tickPct > 62 ? ' anchr' : tickPct < 20 ? ' anchl' : '';
      const midLabel = tick ? `<span class="mid${midAnchor}" style="left:${tick}">${num(F.threshold)}\u00A0${esc(F.thresholdLabel)}</span>` : '';
      const ranges = bar && F.max != null
        ? `<div class="ranges"><span style="left:0">${num(F.min)}</span>${midLabel}<span style="right:0">${num(F.max)}</span></div>`
        : '';
      // The header row carries both states, each as a caption and a lit dot -- the same shape the
      // card already uses for LIVE and for the guide report, so a reader learns it once.
      // There is no threshold sentence under it. The number and the word are both already on
      // screen an inch below, on the range row under the bar (0 / 7,500 WADING LIMIT / 15,000),
      // and the bar's own colour split says which side is which. The compact card keeps the
      // sentence, because there it is the only place the threshold appears at all.
      // The clarity dot is the accent rather than a colour keyed to the word. Poor/Fair/Good/
      // Excellent is a four-value ordinal from the guide, and turning it into green-amber-red
      // would be deriving a judgement nobody supplied -- the same reason the tick meter went.
      return `<div class="sec rule" style="padding-top:14px;gap:10px">
    <div class="between wadehead">
      <span class="row" style="gap:7px">
        <span class="label headcap">${head.cap}</span>
        ${head.word ? `<span class="lamp${head.muted ? ' muted' : ' accent'}" style="--c:${head.color};font-size:12px;font-weight:600;letter-spacing:.1em"><i></i>${esc(head.word)}</span>` : ''}
      </span>
      ${right ? `<span class="row" style="gap:7px">
        <span class="label headcap">${esc(right.cap)}</span>
        <span class="lamp${right.muted ? ' muted' : ' accent'}" style="--c:${right.color};font-size:12px;font-weight:600;letter-spacing:.1em"><i></i>${esc(right.word)}</span>
        ${right.detail ? `<span class="accent claritydetail" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(right.detail)}</span>` : ''}
      </span>` : ''}
    </div>
    ${bar}${ranges}
    ${this.wadingNote()}
  </div>`;
    }
    /** Report age on the same instrument as the other two: 24 cells, zones lit quietly, and the
        accent cell marking where this report actually sits. The scale runs to the OLDER cutoff,
        so a report past it pins to the last cell -- the honest shape, because a report 248 days
        old is not further right than one at 40, it is simply off the end.
        The cutoffs are interim. See FRESHNESS at the top of this file. */
    ageBar(fr) {
      const segs = 24, max = fr.cutoffs.recent;
      const at = Math.max(0, Math.min(segs - 1, Math.round(fr.days / max * (segs - 1))));
      const cells = Array.from({ length: segs }, (_, i) => {
        const day = i * max / (segs - 1);
        return `<i class="${i === at ? 'cur' : (day < fr.cutoffs.current ? 'zc' : 'zr')}"></i>`;
      }).join('');
      const mid = (fr.cutoffs.current / max * 100).toFixed(2) + '%';
      const label = `Guide report ${fr.days} day${fr.days === 1 ? '' : 's'} old, current under ${fr.cutoffs.current} days, older past ${max}`;
      return `<div class="bar tall age" role="img" aria-label="${label}">${cells}</div>
    <div class="ranges"><span style="left:0">0</span><span class="mid" style="left:${mid}">${fr.cutoffs.current}&nbsp;days</span><span style="right:0">${max}&nbsp;days</span></div>`;
    }
    /** What the angler is told about getting in the water.
        Where the guide wrote something, it is theirs, verbatim, under their name. Where they did
        not, the card says something generic and TRUE OF EVERY RIVER, under a heading that does
        not put it in their mouth -- because a caution about changing flows is not a claim about
        this water, and attributing our sentence to a guide would be the one thing this whole
        block exists to avoid. Neither form is a wading verdict: no river is called wadeable here.
        This fallback is the only card-authored sentence in the block. */
    wadingNote() {
      // Short phrases, not the guide's paragraph. This is a card, and the untouched prose is two
      // taps away on NOTES -- so this row carries what an angler acts on and nothing else.
      const tags = this.data.report.wadingTags || [];
      if (tags.length) return `<div class="wadenote"><span class="label">Guide notes</span>`
        + `<span class="tags">${tags.map(t => `<b>${esc(t.phrase)}</b>`).join('<i aria-hidden="true">&middot;</i>')}</span></div>`;
      // One heading either way. The generic line is still ours rather than theirs, so it is
      // written to be plainly generic -- advice no guide would need to have given.
      return `<div class="wadenote"><span class="label">Guide notes</span><span class="tags"><b>Look before you wade</b></span></div>`;
    }
    /** Water temperature against the 50-65 trout-active band. A tailwater like the Lower Sac barely
        moves; a freestone swings hard. Absent unless the gauge actually reports 00010. */
    tempRow() {
      const t = this.s.temp;
      if (t == null) return '';
      // 24 segments, the same count the flow bar draws. At 34 the cells were narrower than the
      // bar six pixels above and the two instruments did not look like the same instrument.
      // Coarser per cell -- about 1.5F instead of 1.1F -- which costs nothing, because the exact
      // figure is printed on the row above.
      const lo = 40, hi = 75, a = 50, b = 65, segs = 24;
      const pos = v => Math.max(0, Math.min(segs - 1, Math.round((v - lo) / (hi - lo) * (segs - 1))));
      // The trout-active range is lit cells again, in green, and the reading is the accent cell.
      // The grammar is held by colour rather than by form now: accent means "you are here" on
      // every instrument on the card, and green here means "the water is in range". What made
      // the old version misread was that the reading was a pale cell competing with the green,
      // which is the same shape that had already been misread as the flow bar's wading tick.
      const at = pos(t);
      const cells = Array.from({ length: segs }, (_, i) => {
        const deg = lo + i * (hi - lo) / (segs - 1);
        return `<i class="${i === at ? 'cur' : (deg >= a && deg <= b ? 'in' : '')}"></i>`;
      }).join('');
      const pct = v => (v - lo) / (hi - lo) * 100;
      const mid = pct((a + b) / 2).toFixed(2) + '%';
      const pa = pct(a).toFixed(2) + '%', pb = pct(b).toFixed(2) + '%';
      // Two sources can fill this row and they are not equally cheap: the gauge on the river is
      // one more field on a request the card already makes, the proxy is the card's only backend
      // call. Say which one answered and when it was read -- a number in a card that reports
      // measurements has to be able to name where it came from.
      const src = this.s.tempSource === 'proxy' ? `CDEC ${esc(this.data.water.cdecStation || '')}` : esc(this.data.water.gaugeName || 'the gauge');
      const when = this.s.tempAt ? new Date(this.s.tempAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
      return `<div class="sec rule" style="padding-top:14px">
    <div class="between"><span class="label">Water temp</span><span style="font-size:15px;font-weight:600">${t}&deg;</span></div>
    <div class="bar tall band" role="img" aria-label="Water temperature ${t} degrees, trout-active band ${a} to ${b}">${cells}</div>
    <div class="ranges"><span style="left:0">${lo}&deg;</span><span style="left:${pa}">${a}&deg;</span><span class="mid" style="left:${mid}">Prime</span><span style="left:${pb}">${b}&deg;</span><span style="right:0">${hi}&deg;</span></div>
    <div class="muted" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding-top:2px">${src}${when ? ` &middot; read ${esc(when)}` : ''}</div>
  </div>`;
    }
    compact() {
      const d = this.data, w = this.wading(), hn = this.hatchNow(), f = this.s.flow;
      const closed = d.water.closed;
      // The hatch line is its own control: tapping it opens the card on that hatch, with the
      // slot's flies already showing, rather than on NOW. It has to be a SIBLING of the expand
      // button and not a child -- a button cannot contain a button, which is the same rule that
      // keeps the pack button outside the card face. The arrow says it goes somewhere; a caret
      // would be wrong here, because carets on this card mean a panel opening in place.
      const hatchLine = hn
        ? `<button class="row rule hatchnow" data-action="hatchjump" data-slot="${esc(hn.h.slot)}" data-focus="hatchjump" aria-label="Open the ${esc(hn.h.insect)} hatch, ${esc(hn.when.toLowerCase())}">
      <span class="label" style="white-space:nowrap">${hn.when}</span>
      <span style="font-weight:600;white-space:nowrap">${esc(hn.h.insect)} <span class="muted" style="font-weight:400">${esc(hn.h.size)}</span></span>
      <span class="lamp hatchword" style="margin-left:auto;text-transform:none;letter-spacing:0;font-size:11px;--c:${hn.h.intensity >= 4 ? 'var(--accent)' : hn.h.intensity >= 2 ? 'var(--green)' : 'var(--amber)'}"><i></i>${esc(hn.h.word)}</span>
      <span class="go" aria-hidden="true">&rarr;</span>
    </button>`
        : '';
      return `<div class="card compact">
  ${this.titleRow(false)}
  <button class="expand" data-action="expand" aria-expanded="false" aria-label="Expand the ${esc(d.water.name)} report">
    ${this.lampRow()}
    ${closed ? `<div class="lamp" style="--c:var(--red);font-size:13px;font-weight:600"><i></i>Closed</div><div>${esc(d.water.closedNote || '')}</div>` : `
    <div class="sec">
      ${this.flowModule(false)}
      ${f.failed || !w ? '' : `<div class="row caps wadingrow" style="letter-spacing:.12em"><span class="label">Wading</span><span class="lamp accent" style="--c:${w.color};font-size:11px;font-weight:600;letter-spacing:.1em"><i></i>${w.label}</span><span class="muted wadingnote" style="margin-left:auto;text-transform:none;letter-spacing:.04em">${w.note}</span></div>`}
    </div>
    ${hn ? '' : `<div class="muted rule" style="padding-top:10px;font-size:12px">The shop's own report and hot flies inside. Flow and weather are live.</div>`}`}
  </button>
  ${closed ? '' : hatchLine}
  ${closed ? `<a class="ghost" href="tel:${d.water.guidePhone.replace(/\D/g, '')}"><span class="caps" style="font-weight:600">Fish it with a guide</span><span class="muted">${d.water.guidePhone}</span></a>` : this.packButton()}
</div>`;
    }
    expanded() {
      const d = this.data, tab = this.s.tab;
      const tabs = ['now', 'hatch', 'notes'];
      return `<div class="card open">
  <div class="head">
    ${this.titleRow(true)}
    ${this.lampRow()}
  </div>
  <div class="tabs" role="tablist" aria-label="Report">
    ${tabs.map(k => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel-${k}" tabindex="${tab === k ? 0 : -1}" data-action="tab" data-tab="${k}" data-focus="tab-${k}">${k}</button>`).join('')}
  </div>
  <div class="panelwrap">${this.s.picker
    ? `<div class="panel" role="region" aria-label="Choose a water" tabindex="0">${this.tab_waters()}</div>`
    : `<div class="panel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" tabindex="0">${this['tab_' + tab]()}</div>`}</div>
  <div class="buybar">
    ${this.tripRow()}
    ${d.readOnly
      ? `<div class="nopack">No pack for ${this.theName(d.water.shortName)} yet</div>${this.guideCta(true)}`
      : `${this.guideCta(false)}${this.packButton()}`}
    <div class="powered">${STONEFLY.startsWith('__') ? '' : STONEFLY}Powered by HatchMatch</div>
  </div>
</div>`;
    }
    /** The steppers sit directly above the button whose count and price they change, so the
        causation is spatial. mathLine() used to narrate it in a sentence; the sentence is gone. */
    tripStepper(label, key, val) {
      const a = label.toLowerCase();
      return `<span class="tripctl"><span class="label lab">${label}</span><span class="step sm"><button data-action="step" data-key="${key}" data-d="-1" aria-label="Fewer ${a}" data-focus="${key}-">−</button><b aria-live="polite">${val}</b><button data-action="step" data-key="${key}" data-d="1" aria-label="More ${a}" data-focus="${key}+">+</button></span></span>`;
    }
    /** Section is a peer of anglers and days, not a property of the fly list: all three shape the
        same pack. A water with one section shows no control rather than a select with one option. */
    tripRow() {
      const secs = this.data.water.sections;
      // Anglers and days shape a pack. A water with no pack has nothing for them to shape.
      if (this.data.readOnly) return '';
      return `<div class="triprow">
    ${this.tripStepper('Anglers', 'anglers', this.s.anglers)}
    ${this.tripStepper('Days', 'days', this.s.days)}
    ${secs.length > 1 ? `<span class="secsel"><span class="label lab">Section</span><span class="box"><select data-action="section" data-focus="section" aria-label="Section of the river">${secs.map(x => `<option value="${esc(x)}"${x === this.s.section ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select><span class="care" aria-hidden="true">${CARET(false)}</span></span></span>` : ''}
  </div>`;
    }
    tab_now() {
      const d = this.data, fr = this.fresh();
      const wx = this.s.weather;
      return `<div class="now">
  ${this.flowModule(true)}
  ${this.wadingBlock()}
  ${this.tempRow()}
  <div class="sec rule" style="padding-top:14px;gap:10px">
    <!-- "High, low, rain chance" is gone. An up arrow over 95 and a down arrow over 62 already
         say high and low, and "0% rain" already says rain chance, so it named three things that
         each label themselves. Its other job -- telling a screen reader which number is which,
         because both carets are aria-hidden -- moved onto the days below, where it is stated per
         day and attached to the numbers instead of sitting in a heading above them. The fallback
         stays: that one is provenance, not a legend. -->
    <div class="between"><span class="label">3 day forecast</span>${wx ? '' : `<span class="muted" style="font-size:10px">From the report</span>`}</div>
    <div class="wx">${(wx || [{ day: 'Day 1', label: 'Clouds', icon: 'clouds' }, { day: 'Day 2', label: 'Sprinkles', icon: 'drizzle' }, { day: 'Day 3', label: 'Sprinkles', icon: 'drizzle' }]).map(x => `
      <div class="d"><span class="day"><span class="ic">${WX_ICON[x.icon || x.label] || WX_ICON.clouds}</span><span class="label" style="letter-spacing:.12em">${esc(x.day)}</span></span>${x.hi != null ? `<span class="temps" role="img" aria-label="High ${x.hi}, low ${x.lo}"><span>${CARET(true)}${x.hi}°</span><span class="lo">${CARET(false)}${x.lo}°</span></span>` : ''}<span class="cond">${esc(cap(x.label))}${x.pct != null ? `, ${x.pct}% rain` : ''}</span></div>`).join('')}</div>
  </div>
  ${d.report.publishedAt ? `<div class="sec rule" style="padding-top:14px;gap:10px">
    <div class="between"><span class="row" style="gap:7px"><span class="label">Guide report age</span><span class="lamp accent" style="--c:${fr.color};font-size:12px;font-weight:600;letter-spacing:.1em"><i></i>${fr.verdict}</span></span></div>
    ${this.ageBar(fr)}
    ${fr.stale ? `<div class="note">Conditions may have changed since this report. Flow and weather are live.</div>` : ''}
    ${d.report.author ? `<div class="muted" style="padding-top:10px">Report by ${esc(d.report.author)}</div>` : ''}
  </div>` : ''}
</div>`;
    }
    /** One panel. The angler's question is one question, so the hatch and the flies that answer it
        live in the same place: time-of-day rows, flies nested under the row that calls for them. */
    tab_hatch() {
      const d = this.data, now = this.slotNow();
      // What this panel says about a read-only water describes what is on it, and frames the
      // pilot as additive. It never asserts that a guide has not done something: the shop has
      // done a version of this -- the sub-heads directly below this sentence are the shop's own
      // categories -- and saying otherwise was both false and a slight on their work.
      if (d.readOnly) {
        // "In the shop's own categories" is only true where the page gives sub-heads. The Fall
        // River, Hat Creek and the McCloud list one flat set, so those get the plainer phrase.
        const grouped = this.rows().length > 1;
        return `<div class="slots">
    <div class="empty" style="padding:14px 0 4px">
      <div style="color:var(--text);font-weight:600">These are the shop's hot flies for ${this.theName(d.water.shortName)}, ${grouped ? "in the shop's own categories" : 'as the shop lists them'}, on real SKUs at real prices.</div>
      <div>What ${this.theName(this.resolved.water.shortName)} adds on top: a hatch for each part of the day, and how many of each to carry.</div>
    </div>
    ${this.flyGroups(this.rows())}
    ${this.allFliesLink()}
  </div>`;
      }
      // A slot with no hatch is hidden unless the angler is standing in it. The fallback text is
      // the guide's own prose -- worth reading at dusk, noise at 2pm. A rule, not a special case:
      // a guide who does list a last-light hatch still gets it shown.
      const slots = d.hatches.map((h, i) => (h.none && i !== now) ? '' : this.slotRow(h, i, i === now)).join('');
      const anytime = this.anytimeRow();
      return `<div class="slots">
  <div class="between" style="padding:8px 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)"><span style="white-space:nowrap">Time of\u00A0day</span><span>Hatch, size, the guide's word</span></div>
  ${slots}${anytime}
  ${this.allFliesLink()}
</div>`;
    }
    /** REVERSAL of round 4, which put this in the pinned block to stop the pinned height changing
        between tabs. Moving it into the HATCH panel does that better: the pinned block becomes
        identical on all three tabs and smaller by the height of this row. It is a browse action
        and it belongs with the browsing. */
    allFliesLink() {
      return `<button class="allflies" data-action="catalog" data-focus="catalog"><span>All flies for ${this.theName(this.data.water.shortName)}</span><span aria-hidden="true">&rarr;</span></button>`;
    }
    /** A hatch row and, underneath it, the flies for that hatch. The row is the disclosure. */
    slotRow(h, i, isNow) {
      const label = `<div style="display:flex;flex-direction:column;gap:2px"><span class="label" style="color:${isNow ? 'var(--text)' : 'var(--muted)'}">${esc(SLOT_LABEL[SLOTS[i]] || cap(SLOTS[i]))}</span>${isNow ? `<span class="lamp" style="--c:var(--green);color:var(--green);font-size:10px"><i style="width:6px;height:6px"></i>Now</span>` : ''}</div>`;
      if (h.none) return `<div class="slot">${label}<div class="muted" style="font-size:12px">${esc(h.fallback)}</div></div>`;
      const open = this.s.expanded.has(h.slot), id = `flies-${h.slot.replace(/\s+/g, '-')}`;
      return `<div class="slot">${label}
    <button class="chip${this.s.tip === h.slot ? ' tipopen' : ''}" data-action="slot" data-slot="${esc(h.slot)}" data-focus="slot-${esc(h.slot)}" aria-expanded="${open}" aria-controls="${id}">
      <span class="dot"></span><span style="font-weight:600">${esc(h.insect)}</span><span class="muted">${esc(h.size)}</span>${this.meter(h.intensity, false, `Intensity: ${esc(h.word)}, ${h.intensity} of 5`)}<span class="word muted">${esc(h.word)}</span><span class="care" aria-hidden="true">${CARET(open)}</span>
      <span class="tip" role="tooltip">The guide's call on how strong this hatch has been this week.</span>
    </button>
  </div>
  <div class="flies" id="${id}"${open ? '' : ' hidden'}>${open ? this.flyGroups(this.rows(h.key)) : ''}</div>`;
    }
    /** Three picks carry hatch tags no listed slot matches -- one stonefly, two eggs. Without this
        row they would sit in the pack and in the count while appearing nowhere in the list. */
    /** Stoneflies and eggs are not hatch-driven; they are fished through the day. ALL DAY is
        angler-native and parallel in form to MORNING / MIDDAY / AFTERNOON. */
    anytimeRow() {
      const groups = this.rows(null, true);
      if (!groups.length) return '';
      const open = this.s.expanded.has('all day');
      const tags = [...new Set(groups.flatMap(g => g.flies).flatMap(r => r.p.hatches))];
      return `<div class="slot"><span class="label" style="color:var(--muted)">All day</span>
    <button class="chip" data-action="slot" data-slot="all day" data-focus="slot-all day" aria-expanded="${open}" aria-controls="flies-all-day" aria-label="Flies not tied to a hatch">
      <span class="dot"></span><span class="muted">${esc(tags.map(cap).join(', '))}</span><span class="care" aria-hidden="true">${CARET(open)}</span>
    </button>
  </div>
  <div class="flies" id="flies-all-day"${open ? '' : ' hidden'}>${open ? this.flyGroups(groups) : ''}</div>`;
    }
    flyGroups(groups) {
      if (!groups.length) return `<div class="muted" style="padding:10px 0 14px;font-size:12px">No flies for this hatch in the ${esc(this.s.section)} section.</div>`;
      return groups.map(g => `<div>
    <div class="group">${esc(g.role.label)}</div>
    ${g.flies.map(r => this.flyRow(r)).join('')}
  </div>`).join('');
    }
    /** The stepper shows the number of flies the row actually buys, and the price beside it is the
        price of exactly that many. State stores per-angler-per-day, so a tap moves the total by the
        multiplier: with two anglers over two days, one more each per day is four more flies.
        Nothing reaches the shop's cart until the CTA is pressed -- cross-domain, we cannot add
        incrementally, and no per-tap request is fired. What is live is the pack and the totals. */
    flyRow(r) {
      const { p, use, v, per, qty, sub } = r, id = p.id;
      const mult = this.s.anglers * this.s.days;
      // A null quantity means this water sells no pack: show the shop's unit price and stock, and
      // nothing that implies the row is being bought.
      const lamp = r.oos ? ['var(--red)', 'Out of stock'] : (v.lowStock ? ['var(--amber)', 'Low stock'] : ['var(--green)', 'In stock']);
      // A water with no sections has no "up top only" to say.
      const only = (p.sections || []).length === 1 ? `<span class="only">${esc(p.sections[0])} only</span>` : '';
      const meta = sub ? `<i></i>Instead of ${esc(sub.name)}, out of stock` : esc([v.color, v.size].filter(Boolean).join('  ')) + only;
      const chips = p.variants.length > 1 && !sub ? p.variants.map(x => {
        const bothVary = new Set(p.variants.map(y => y.color)).size > 1 && new Set(p.variants.map(y => y.size)).size > 1;
        const label = bothVary ? [x.color, x.size].filter(Boolean).join(' ') : (new Set(p.variants.map(y => y.color)).size > 1 ? x.color : x.size);
        return `<button class="vchip${this.unavailable(x, p) ? ' oos' : ''}" data-action="variant" data-id="${id}" data-vid="${x.id}" aria-pressed="${x.id === v.id}" data-focus="v-${x.id}"><i></i>${esc(label)}</button>`;
      }).join('') : '';
      // Nine option chips for one fly is most of a screen. Show the chosen variant with a caret,
      // and open the set on demand -- one fly at a time, so a second opening closes the first.
      const optOpen = this.s.options === id, optId = `opt-${id}`;
      const metaEl = chips
        ? `<button class="optog" data-action="options" data-id="${id}" data-focus="opt-${id}" aria-expanded="${optOpen}" aria-controls="${optId}" aria-label="Options for ${esc(use.name)}"><span class="meta">${meta}</span><span class="care" aria-hidden="true">${CARET(optOpen)}</span></button>`
        : `<span class="meta">${meta}</span>`;
      return `<div class="fly${qty === 0 ? ' zero' : ''}">
    ${v.image ? `<button class="thumb" data-action="image" data-id="${id}" data-focus="img-${id}" aria-label="Larger picture of ${esc(use.name)}"><img src="${esc(v.image)}" alt="" loading="lazy" width="36" height="36"></button>` : `<div class="thumb"></div>`}
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><a class="name" href="${esc(v.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" data-action="fly" data-id="${id}">${esc(use.name)}</a>${metaEl}</div>
    <div class="right"><span class="qtyline">${qty == null ? '' : r.oos ? `<span class="muted" style="font-size:11px">×${qty}</span>` : `<span class="step sm"><button data-action="qty" data-id="${id}" data-d="-1" aria-label="Fewer ${esc(use.name)}${mult > 1 ? ', one per angler per day' : ''}" data-focus="q-${id}-">−</button><b aria-live="polite">${qty}</b><button data-action="qty" data-id="${id}" data-d="1" aria-label="More ${esc(use.name)}${mult > 1 ? ', one per angler per day' : ''}" data-focus="q-${id}+">+</button></span>`}<span>${money(r.price)}</span></span><span class="stock" style="--c:${lamp[0]}"><i></i>${lamp[1]}</span></div>
  </div>
  ${chips ? `<div class="edit" id="${optId}"${optOpen ? '' : ' hidden'}>${optOpen ? `<span class="muted" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase">Option</span>${chips}` : ''}</div>` : ''}`;
    }
    /** Tap the thumbnail, get the picture. Lives in the shadow root, so it inherits the card's
        theme and no host stylesheet can reach it. The name link still goes to the product page --
        the image is now its own affordance rather than a decoration on someone else's link. */
    lightbox() {
      const id = this.s.lightbox;
      if (!id) return '';
      const p = this.byId.get(id);
      if (!p) return '';
      const v = this.variantOf(p);
      const big = v.image ? v.image.replace(/([?&]width=)\d+/, '$1800') : null;
      const meta = [v.color, v.size].filter(Boolean).join('  ');
      return `<div class="lb" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
  <div class="lbcard">
    <button class="lbclose" data-action="lbclose" data-focus="lbclose" aria-label="Close">&#10005;</button>
    <div class="lbimg">${big ? `<img src="${esc(big)}" alt="${esc(p.name)}">` : ''}</div>
    <div class="between"><span style="font-size:15px;font-weight:600;line-height:1.2">${esc(p.name)}</span><span style="font-weight:600;white-space:nowrap">${money(v.price)}</span></div>
    ${meta ? `<div class="muted" style="font-size:12px">${esc(meta)}</div>` : ''}
    <a class="ghost" href="${esc(v.url)}" target="_blank" rel="noopener" data-action="fly" data-id="${esc(id)}"><span class="caps" style="font-weight:600">View on theflyshop.com</span><span class="accent" aria-hidden="true">&rarr;</span></a>
  </div>
</div>`;
    }
    /** A panel takeover rather than an overlay, so it inherits the scrolling already built and the
        pinned block keeps showing the current water's pack while you look. */
    tab_waters() {
      const cur = this.data.water.id;
      const groups = GROUPS.map(([key, label]) => {
        const rows = this.waters.filter(w => w.group === key);
        if (!rows.length) return '';
        return `<div class="wgroup">${label}</div>` + rows.map(w => {
          // Every water has a real report now, so every row carries its own rating and date --
          // including the Klamath's January one, which the lamp renders red without being told to.
          const fr = this.freshFor(w.publishedAt), r = this.ratingOf(w.rating);
          return `<button class="wrow" data-action="water" data-id="${esc(w.id)}" data-focus="w-${esc(w.id)}" aria-current="${w.id === cur}">
      <span class="wname">${esc(w.name)}</span>
      <span class="lamp" style="--c:${fr ? fr.color : 'var(--off)'}"><i></i>${fr ? esc(shortDate(w.publishedAt)) : 'No date'}</span>
      <span class="wsub">${r.n ? `${esc(r.label)} ${this.meter(r.n, false, `Fishing ${esc(r.label)}, ${r.n} of 5`)}` : 'Not rated'}</span>
      <span class="wdate">${w.readOnly ? 'Flies only' : 'Full pack'}</span>
    </button>`;
        }).join('');
      }).join('');
      return `<div class="waters">${groups}</div>`;
    }
    tab_notes() {
      const d = this.data;
      if (!d.report.notes.length) return `<div class="empty"><div style="color:var(--text);font-weight:600">This report carries no prose.</div><div>When the shop publishes prose for ${this.theName(d.water.shortName)}, it appears here as written and is never edited by the system.</div></div>`;
      return `<div class="notes">
  <div class="between"><span class="label">Guide's notes, ${shortDate(d.report.publishedAt)}</span><span class="label" style="letter-spacing:.1em">${esc(d.report.author || 'The Fly Shop')}</span></div>
  <div class="prose">${d.report.notes.map(p => `<p>${esc(p)}</p>`).join('')}</div>
  <div class="foot">The shop's own ${shortDate(d.report.publishedAt)} text. Never edited by the system.</div>
</div>`;
    }

    render() {
      const [accent, onAccent] = this.accent();
      const focusKey = this.root.activeElement?.dataset?.focus;
      const panel = this.root.querySelector('.panel');
      if (panel && this.shownTab) this.scrollPos[this.shownTab] = panel.scrollTop;
      clearInterval(this.cycler); this.cycler = null;   // innerHTML is about to drop the nodes this drives
      this.root.innerHTML = `<style>${CSS}</style><div class="hm" data-theme="${this.theme()}" style="--accent:${accent};--on-accent:${onAccent}">${this.s.open ? this.expanded() : this.compact()}${this.lightbox()}</div>`;
      this.shownTab = this.s.open ? this.s.tab : null;
      const next = this.root.querySelector('.panel');
      if (next) {
        next.scrollTop = this.scrollPos[this.s.tab] || 0;
        // A jump from the compact card's hatch line lands on that slot rather than at the top of
        // the panel. Measured against the panel's own box, so it is right whatever is above it.
        if (this.scrollToSlot) {
          const chip = this.root.querySelector(`.chip[data-slot="${this.scrollToSlot.replace(/"/g, '\\"')}"]`);
          const row = chip && chip.closest('.slot');
          if (row) next.scrollTop += row.getBoundingClientRect().top - next.getBoundingClientRect().top;
          this.scrollToSlot = null;
          chip?.focus();
        }
        // Only fade an edge there is something past.
        next.parentElement.classList.toggle('fade', next.scrollHeight > next.clientHeight + 1);
      }
      // Tween the plus/close from where it was. The node is new after every render, so without
      // this it would simply appear at its new angle.
      const px = this.root.querySelector('.chev .px');
      if (px && this.wasOpen != null && this.wasOpen !== this.s.open
          && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        px.style.transition = 'none';
        px.style.transform = this.wasOpen ? 'rotate(45deg)' : 'rotate(0deg)';
        px.getBoundingClientRect();                 // flush, so the start angle is real
        px.style.transition = '';
        px.style.transform = '';
      }
      this.wasOpen = this.s.open;
      if (focusKey) this.root.querySelector(`[data-focus="${focusKey}"]`)?.focus();
      this.fitSparkline();
      this.fitLabels();
      this.startCycle();
    }
    /** The graph flexes to whatever the flow figure leaves it, so its column count is only
        knowable after layout. Measure, and if the width wants a different number of columns,
        redraw just the graph. One correction, never a loop: the second pass measures the same
        width and agrees with itself. */
    fitSparkline() {
      const spark = this.root.querySelector('.spark');
      if (!spark) { this.sparkCols = null; return; }
      const grid = spark.querySelector('.grid');
      if (!grid) return;
      // 3px cell plus a 1px gap. Never finer than the series and never so coarse it stops being
      // a curve; 120 is the whole 30-day series at six-hour resolution.
      const want = Math.max(14, Math.min(120, Math.floor((grid.clientWidth + 1) / 4)));
      if (want === this.sparkCols) return;
      this.sparkCols = want;
      const fresh = this.sparkline();
      if (fresh) spark.outerHTML = fresh;
    }
    /** The count and price grow with the steppers, so the fit is not a width breakpoint. Lay the long
        label out, and if it clips, fall back to the generic one. Past roughly 336 flies on a 350px
        card even the generic label clips: the label is what gives, never the count or the price. */
    fitLabels() {
      for (const el of this.root.querySelectorAll('.pack .packlabel, .guideline .glabel')) {
        el.classList.remove('short');
        if (el.scrollWidth > el.clientWidth + 1) el.classList.add('short');
      }
    }
    /** Advances the live strip in place rather than re-rendering: six seconds is a long time to hold
        a card that is otherwise still. Reduced motion gets frame one and nothing else. */
    startCycle() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (this.root.querySelectorAll('.live .frames>span').length < 2) return;
      this.cycler = setInterval(() => {
        const frames = this.root.querySelectorAll('.live .frames>span');
        if (frames.length < 2) { clearInterval(this.cycler); this.cycler = null; return; }
        this.frame = (this.frame + 1) % frames.length;
        frames.forEach((el, i) => { el.classList.toggle('on', i === this.frame); el.toggleAttribute('aria-hidden', i !== this.frame); });
      }, 6000);
    }

    /* ---- interaction ---- */
    onClick(e) {
      // A long press that opened the tooltip must not also toggle the row it sits in.
      if (this.pressed) { this.pressed = false; e.preventDefault(); return; }
      const lb = e.target.closest?.('.lb');
      if (lb && e.target === lb) { this.closeLightbox(); return; }
      const el = e.target.closest('[data-action]');
      if (this.s.tip && !e.target.closest?.('.meter')) this.set({ tip: null });
      if (!el) return;
      const a = el.dataset.action, s = this.s;
      switch (a) {
        case 'expand': this.set({ open: true }); this.emit('card_expanded'); this.root.querySelector('[data-action="collapse"]')?.focus(); break;
        // Open the card on the hatch the compact face was showing, with that slot's flies
        // already out. Additive to whatever was open: a jump should not close a slot the angler
        // opened themselves. render() does the scrolling, once the panel it scrolls exists.
        case 'hatchjump': {
          const slot = el.dataset.slot, open = new Set(s.expanded);
          open.add(slot);
          this.scrollToSlot = slot;
          const h = this.data.hatches.find(x => x.slot === slot);
          this.set({ open: true, tab: 'hatch', picker: false, expanded: open });
          this.emit('hatch_opened_from_card', { slot, insect: h ? h.insect : null });
          break;
        }
        case 'collapse': this.set({ open: false }); this.root.querySelector('[data-action="expand"]')?.focus(); break;
        case 'tab': this.set({ tab: el.dataset.tab, picker: false }); if (el.dataset.tab === 'notes') this.emit('notes_expanded'); break;
        case 'slot': {
          const key = el.dataset.slot, open = new Set(s.expanded);
          open.has(key) ? open.delete(key) : open.add(key);
          this.set({ expanded: open });
          if (!s.expanded.has(key)) { const h = this.data.hatches.find(x => x.slot === key); this.emit('hatch_expanded', { slot: key, insect: h ? h.insect : null }); }
          break;
        }
        case 'step': { const k = el.dataset.key, d = +el.dataset.d, max = k === 'anglers' ? 6 : 7; this.set({ [k]: Math.min(max, Math.max(1, s[k] + d)), added: false }); break; }
        case 'qty': { const id = el.dataset.id, p = this.byId.get(id), cur = s.qty[id] != null ? s.qty[id] : p.qty; this.set({ qty: { ...s.qty, [id]: Math.max(0, cur + +el.dataset.d) }, added: false }); break; }
        case 'options': { const id = el.dataset.id; this.set({ options: s.options === id ? null : id }); if (s.options !== id) this.emit('options_opened', { pick: id }); break; }
        case 'variant': this.set({ variant: { ...s.variant, [el.dataset.id]: +el.dataset.vid }, added: false }); this.emit('size_changed', { pick: el.dataset.id, variant: +el.dataset.vid }); break;
        case 'addpack': { const k = this.pack(); this.emit('pack_added', { flies: k.flies, total: +k.total.toFixed(2), section: s.section, items: k.items.map(r => ({ variant: r.v.id, sku: r.v.sku, qty: r.qty })) }); window.open(k.url, '_blank', 'noopener'); this.set({ added: true }); break; }
        // Sends them to the shop's own catalog with the pack already in the cart. Not a concession:
        // the shop gets the traffic and a warm cart instead of a 440px card trying to be a catalog.
        case 'catalog': { const k = this.pack(); this.emit('catalog_opened', { flies: k.flies, total: +k.total.toFixed(2) }); window.open(this.catalogUrl(), '_blank', 'noopener'); break; }
        case 'viewcart': window.open(this.pack().url, '_blank', 'noopener'); break;
        case 'guide': this.emit('guide_cta_tapped'); break;
        case 'fly': this.emit('fly_opened', { pick: el.dataset.id }); break;
        case 'image': {
          this.lbReturn = el.dataset.focus;
          this.set({ lightbox: el.dataset.id, tip: null });
          this.emit('fly_image_opened', { pick: el.dataset.id });
          this.root.querySelector('.lbclose')?.focus();
          break;
        }
        case 'lbclose': this.closeLightbox(); break;
        case 'waters': {
          // The list lives in the expanded panel, so from a compact card this opens the card on
          // it rather than doing nothing. Tapping the title again closes the list, not the card.
          const open = !(s.open && s.picker);
          this.set({ open: true, picker: open, tip: null });
          if (open) this.emit('water_list_opened', { from: s.open ? 'expanded' : 'compact' });
          break;
        }
        case 'water': this.switchWater(el.dataset.id); break;
      }
    }
    closeLightbox() {
      if (!this.s.lightbox) return;
      const back = this.lbReturn;
      this.lbReturn = null;
      this.set({ lightbox: null });
      this.root.querySelector(`[data-focus="${back}"]`)?.focus();
    }
    /** While the dialog is open, Tab stays inside it and Escape leaves it -- and focus goes back to
        the thumbnail that opened it, not to the top of the card. */
    onKey(e) {
      if (e.key === 'Escape') {
        if (this.s.lightbox) { e.preventDefault(); this.closeLightbox(); return; }
        if (this.s.tip) { e.preventDefault(); this.set({ tip: null }); return; }
      }
      if (this.s.lightbox && e.key === 'Tab') {
        const f = [...this.root.querySelectorAll('.lbcard button, .lbcard a[href]')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1], cur = this.root.activeElement;
        if (e.shiftKey && (cur === first || !f.includes(cur))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (cur === last || !f.includes(cur))) { e.preventDefault(); first.focus(); }
        return;
      }
      const t = e.target.closest?.('[role="tab"]'); if (!t) return;
      const tabs = [...this.root.querySelectorAll('[role="tab"]')], i = tabs.indexOf(t);
      const go = j => { const k = tabs[(j + tabs.length) % tabs.length].dataset.tab; this.set({ tab: k }); this.root.querySelector(`[data-tab="${k}"]`).focus(); };
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(tabs.length - 1); }
    }
  }

  /* ---------- mount ---------- */
  const HM = window.HatchMatch = window.HatchMatch || { events: [], cards: [] };
  HM.build = BUILD;
  /** Mounting the same element twice used to throw: a host can only ever have one shadow root.
      In production the renderer ships with no reports inlined and the host calls mount() once the
      API answers, so "already mounted" is the normal case, not an error. Hand it reports. */
  HM.mount = function (host, data) {
    const reports = data || DATA;
    if (!Array.isArray(reports) || !reports.length) throw new Error('HatchMatch.mount needs at least one report');
    injectFont();
    const already = HM.cards.find(c => c.host === host);
    if (already) return already.setReports(reports);
    const card = new Card(host, reports);
    HM.cards.push(card);
    return card;
  };
  /* Auto-mount only when reports were inlined at build time. The renderer-only bundle has none,
     so it waits to be handed some rather than claiming the element with an empty card. */
  function boot() {
    if (!Array.isArray(DATA) || !DATA.length) return;
    document.querySelectorAll('#hatchmatch, .hatchmatch, [data-hatchmatch]').forEach(host => { if (!host.shadowRoot) HM.mount(host); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
