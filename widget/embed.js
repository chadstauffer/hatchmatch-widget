/* HatchMatch report widget. One component, rendered into a shadow root.
   Data, font and mark are inlined by build.mjs for the static demo. */
(function () {
  'use strict';
  const DATA = "__HM_DATA__";
  const FONT = "__HM_FONT__";
  const STONEFLY = "__HM_STONEFLY__";

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
  const CACHE = 'hm1:';
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
  const SLOTS = ['morning', 'midday', 'afternoon', 'last light'];
  const DAY = 86400000;
  const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => n.toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
  const CARET = up => `<svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="${up ? 'M4 1.9 7 6.1H1Z' : 'M4 6.1 1 1.9h6Z'}"/></svg>`;

  const CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
.hm{font-family:'Kode Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:13px;line-height:1.4;color:var(--text);max-width:440px;margin:0 auto}
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
.live .frames{position:relative;flex:1 1 auto;min-width:0;height:16px}
.live .frames>span{position:absolute;inset:0;display:flex;align-items:center;gap:6px;white-space:nowrap;opacity:0;transition:opacity .3s linear}
.live .frames>span.on{opacity:1}
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
/* Seven days of flow, right of the figure. Discrete cells in the meters' own language, never a
   smooth line. The scale is the segmented bar's own range, never the window's min and max:
   auto-scaling would draw a dependable tailwater week as a mountain range, which on this river
   would say the opposite of the truth. The dotted line is the wading threshold, which turns
   "is it rising" into "has it been fishable this week" -- the question a flat week can answer. */
.spark{position:relative;display:flex;align-items:flex-end;gap:2px;flex:none;margin-left:auto;height:23px;margin-bottom:4px}
.spark .col{position:relative;display:flex;flex-direction:column-reverse;gap:1px;width:3px}
.spark .col i{width:3px;height:3px;background:var(--seg)}
/* Which column is now, without spending the colour channel that carries the threshold. */
.spark .col.cur::after{content:'';position:absolute;left:0;right:0;bottom:-4px;height:2px;background:var(--accent)}
/* Over the cells, not under them: on a flat week this line is the only thing that varies, so it
   carries a 1px halo in the card's own background to separate it from the cells it crosses. */
.spark .lim{position:absolute;left:-3px;right:-3px;z-index:1;height:0;border-top:1px dashed var(--text);pointer-events:none;box-shadow:0 -1px 0 var(--bg),0 1px 0 var(--bg)}
.bar{position:relative;display:flex;gap:2px;height:14px;align-items:center}
.bar i{flex:1;height:10px;border-radius:1px;background:var(--off)}
.bar.tall{height:16px}.bar.tall i{height:12px}
.bar i.on{background:var(--seg)}
.bar i.on.fill{animation:hm-lit 1ms linear both;animation-delay:calc(var(--i) * 32ms)}
@keyframes hm-lit{from{background:var(--off)}to{background:var(--seg)}}
.bar .tick{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--text);transform:translateX(-1px)}
.bar.tall .tick{top:-4px;bottom:-4px}
.ranges{position:relative;height:14px;font-size:10px;letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.ranges span{position:absolute;white-space:nowrap}
.ranges .mid{transform:translateX(-50%);color:var(--text)}
/* "Fair to Good" plus the word FISHING plus the meter overruns a 350px card. The word is the
   part that gives: a rating beside a lamp needs no caption. */
@container (max-width:409px){.fishlabel{display:none}}
.chev{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;font-size:9px;color:var(--accent);flex:none}
.pack{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;height:48px;padding:0 14px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
/* Nothing to buy is not the primary action. Disabled loses the fill and reads as a state. */
.pack[disabled]{background:none;border:1px solid var(--line);color:var(--muted);cursor:default}
.pack>span{white-space:nowrap;flex:none}
.pack span:nth-child(2){color:var(--on-accent);opacity:.8}
.pack .packlabel{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pack .packlabel em{font-style:normal;display:none}
.pack .packlabel.short b{display:none}.pack .packlabel.short em{display:inline}
.ghost{display:flex;justify-content:space-between;align-items:center;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--text)}
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
.ticks{display:flex;gap:3px;height:12px;align-items:flex-end}.ticks i{flex:1;height:7px;background:var(--off)}.ticks i.on{height:12px;background:var(--c)}
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
.band i{flex:1;height:10px;border-radius:1px;background:var(--off)}
.band i.in{background:color-mix(in srgb, var(--green), transparent 55%)}
.band i.at{background:var(--text)}
.slots{padding:8px 16px 16px;display:flex;flex-direction:column}
.slot{display:grid;grid-template-columns:74px minmax(0,1fr);gap:10px;align-items:center;min-height:64px;border-top:1px solid var(--line)}
.chip{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);justify-self:start;max-width:100%}
.chip[aria-expanded=true]{background:var(--surface2);border-color:var(--accent)}
.chip .dot{width:7px;height:7px;border-radius:50%;background:var(--off);flex:none}.chip[aria-expanded=true] .dot{background:var(--accent)}
.chip{justify-self:stretch;width:100%;min-width:0;gap:8px;padding:0 10px 0 12px}
.chip .word{font-size:11px;margin-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chip .care{margin-left:auto;color:var(--accent);font-size:9px;flex:none;padding-left:6px}
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
.name{font-size:14px;font-weight:600;line-height:1.2}
.meta{font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}
.meta i{width:6px;height:6px;border-radius:50%;background:var(--red);flex:none}
.right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;white-space:nowrap}
.stock{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.stock i{width:6px;height:6px;border-radius:50%;background:var(--c)}
.edit{display:flex;align-items:center;gap:8px;padding:0 0 10px 48px;flex-wrap:wrap}
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
.secsel .care{position:absolute;right:0;font-size:9px;color:var(--accent);pointer-events:none}
/* Was a 48px bordered box inside the scroll. It is a link, not a second buy button. */
.allflies{display:flex;justify-content:space-between;align-items:center;gap:10px;height:28px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.allflies span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.allflies span:last-child{color:var(--accent);flex:none}
.allflies.muted span{color:var(--muted)}
.powered{display:flex;justify-content:center;align-items:center;gap:6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.powered svg{width:12px;height:12px;color:var(--accent);opacity:.8}
.avatar{width:20px;height:20px;border-radius:50%;background:var(--off);flex:none}
/* The title is the water switcher. A bare caret at text size on the baseline -- never a second
   circular chevron, because the circle already means expand/collapse. */
button.title{display:inline-flex;align-items:baseline;gap:7px;max-width:100%}
button.title .tcare{font-size:8px;color:var(--accent);flex:none}
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
    return { value: last.value, at: last.iso, delta: null, hours: null, series: vals.map(v => v.value), days: vals.length, trend: '', live: false, source: 'waterservices.usgs.gov/nwis/dv' };
  };
  const fetchWindow = (site, win) => cached(`win:${site}:${win.join('/')}`, () => fetchWindowLive(site, win), hasSeries);
  async function fetchFlowLive(site, win) {
    const errors = [];
    if (win) return fetchWindow(site, win);
    try {
      // Seven days, not six hours. Keswick releases move in discrete steps every few days, so a
      // six-hour window on a tailwater is flat noise -- it would draw a broken graph, not a calm
      // one. One request still: the six-hour delta is computed off the tail of this same series.
      const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00060&period=P7D`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ts = (await r.json()).value.timeSeries[0];
      const vals = ts.values[0].value.map(v => ({ value: +v.value, at: +new Date(v.dateTime), iso: v.dateTime })).filter(v => v.value >= 0 && v.at);
      if (!vals.length) throw new Error('empty series');
      const last = vals[vals.length - 1], end = last.at;
      const six = vals.filter(v => end - v.at <= 6 * 3600e3);
      const first = six.length > 1 ? six[0] : vals[0];
      const delta = last.value - first.value;
      const hours = Math.max(1, Math.round((end - first.at) / 3600000));
      // Fourteen twelve-hour buckets across the window, mean per bucket. A bucket the gauge did
      // not report stays null and draws as a gap rather than being interpolated across.
      const COLS = 14, SPAN = 12 * 3600e3, acc = Array.from({ length: COLS }, () => ({ n: 0, sum: 0 }));
      for (const v of vals) {
        const i = COLS - 1 - Math.floor((end - v.at) / SPAN);
        if (i >= 0 && i < COLS) { acc[i].n++; acc[i].sum += v.value; }
      }
      const series = acc.map(b => b.n ? b.sum / b.n : null);
      return { value: last.value, at: last.iso, delta, hours, series, days: 7, trend: Math.abs(delta) < Math.max(100, last.value * .02) ? 'Steady' : delta > 0 ? 'Rising' : 'Falling', live: true, source: 'waterservices.usgs.gov/nwis/iv' };
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
    const out = { temp: null, turbidity: null };
    try {
      const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00010,63680&period=PT2H`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      for (const ts of ((await r.json()).value.timeSeries || [])) {
        const code = ts.variable.variableCode[0].value;
        const vals = ts.values[0].value.map(v => +v.value).filter(v => v > -999);
        if (!vals.length) continue;
        const last = vals[vals.length - 1];
        if (code === '00010') out.temp = Math.round(last * 9 / 5 + 32);
        if (code === '63680') out.turbidity = Math.round(last * 10) / 10;
      }
    } catch (e) { console.debug('[hatchmatch] water temp / turbidity unavailable at this gauge:', e.message); }
    return out;
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
      this.s = { open: false, tab: 'now', section: (r0.water.sections || [])[0], anglers: 1, days: 1, qty: {}, variant: {}, picker: false, expanded: new Set(), added: false, filled: false,
        flow: { value: 0, at: new Date().toISOString(), trend: '', delta: null, hours: null, series: null, days: null, live: false, failed: false }, weather: null, temp: null, turbidity: null, lightbox: null, tip: null };
      this.useReport(r0);
      this.s.flow.value = this.data.water.flow.lastReading.value;
      this.s.flow.at = this.data.water.flow.lastReading.at;
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
    /** Swaps which report the card is rendering. Phase B replaces pendingReport() with a real
        resolved report per water; everything downstream of here already works on one. */
    useReport(data) {
      // A water with no gauge has no published flow block at all. Normalise it once here so every
      // reader downstream sees the same shape and the existing null guards do the rest.
      if (!data.water.flow) data.water.flow = { min: null, max: null, threshold: null, thresholdLabel: '', lastReading: { value: 0, at: new Date().toISOString() } };
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
      this.s.qty = {}; this.s.variant = {}; this.s.added = false; this.s.expanded = new Set();
      this.s.flow = { value: this.data.water.flow.lastReading.value, at: this.data.water.flow.lastReading.at, trend: '', delta: null, hours: null, series: null, days: null, live: false, failed: !this.data.water.usgsSite };
      this.s.weather = null; this.s.temp = null; this.s.turbidity = null;
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
        fetchAux(w.usgsSite).then(a => { if (!live()) return; if (a.temp != null || a.turbidity != null) { this.s.temp = a.temp; this.s.turbidity = a.turbidity; this.emit('water_aux', a); this.render(); } });
        this.watchFlow();
      }
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
      if (this.demo === 'stale') return 23; if (this.demo === 'aging') return 9;
      return Math.max(0, Math.floor((Date.now() - new Date(this.data.report.publishedAt + 'T12:00:00')) / DAY));
    }
    freshFor(publishedAt) {
      if (!publishedAt) return null;
      const d = this.demo === 'stale' ? 23 : this.demo === 'aging' ? 9
        : Math.max(0, Math.floor((Date.now() - new Date(publishedAt + 'T12:00:00')) / DAY));
      return { days: d, label: 'Updated ' + shortDate(publishedAt), color: d < 7 ? 'var(--green)' : d < 14 ? 'var(--amber)' : 'var(--red)', stale: d >= 14 };
    }
    fresh() { return this.freshFor(this.data.report.publishedAt) || { days: 0, label: 'No report yet', color: 'var(--off)', stale: false }; }
    slotNow() { const h = new Date().getHours(); return h < 11 ? 0 : h < 15 ? 1 : h < 19 ? 2 : 3; }
    hatchNow() {
      const H = this.data.hatches, i = this.slotNow(), now = H[i];
      if (!H.some(h => !h.none)) return null;
      if (now && !now.none) return { h: now, label: 'Hatching now', when: 'this ' + SLOTS[i] };
      const j = H.findIndex((h, k) => k > i && !h.none);
      const next = j >= 0 ? H[j] : H.find(h => !h.none);
      return { h: next, label: 'Next hatch', when: (j >= 0 ? '' : 'tomorrow ') + SLOTS[H.indexOf(next)] };
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
    ticks(count, idx, color) { return `<div class="ticks" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<i class="${i === idx ? 'on' : ''}" style="--c:${color}"></i>`).join('')}</div>`; }
    flowBar(tall) {
      const F = this.data.water.flow, f = this.s.flow, segs = 24;
      // No published range for this water yet. A bar without a scale is a decoration, so there
      // isn't one -- the number and the strip still carry the real reading.
      if (F.max == null) return '';
      // A range without a wading threshold is a real shape: not every water has a limit a guide
      // will stand behind. No tick, no amber, and the label says the range and nothing more.
      const lim = F.threshold != null;
      const filled = f.failed ? 0 : Math.round((f.value - F.min) / (F.max - F.min) * segs);
      const cells = Array.from({ length: segs }, (_, i) => {
        const on = i < filled, top = F.min + (i + 1) * (F.max - F.min) / segs;
        const color = lim && top > F.threshold ? 'var(--amber)' : `color-mix(in srgb, var(--water1), var(--water2) ${Math.round(i / (segs - 1) * 100)}%)`;
        return `<i class="${on ? 'on' : ''}${on && !this.s.filled ? ' fill' : ''}" style="--i:${i};--seg:${color}"></i>`;
      }).join('');
      const tick = lim ? `<span class="tick" style="left:${((F.threshold - F.min) / (F.max - F.min) * 100).toFixed(2)}%"></span>` : '';
      const label = `${num(f.value)} CFS on a scale of ${num(F.min)} to ${num(F.max)}` + (lim ? `, ${F.thresholdLabel} ${num(F.threshold)}` : '');
      return `<div class="bar${tall ? ' tall' : ''}" role="img" aria-label="${label}">${cells}${tick}</div>`;
    }
    ratingOf(r) { return { label: r, n: { Poor: 1, Fair: 2, 'Fair to Good': 3, Good: 4, Great: 5 }[r] || 0 }; }
    rating() { return this.ratingOf(this.data.report.rating); }
    wading() {
      const F = this.data.water.flow, f = this.s.flow;
      if (F.threshold == null) return null;
      const ok = !f.failed && f.value < F.threshold;
      return { label: ok ? 'Wadeable' : 'Not today', color: ok ? 'var(--green)' : 'var(--amber)', note: `Wadeable below ${num(F.threshold)} CFS` };
    }
    /** Only reached when both endpoints failed. The live reading says the same things in the strip. */
    flowNote() {
      const w = this.data.water, f = this.s.flow;
      if (!w.usgsSite) return w.gaugeNote || 'No live gauge on file for this water.';
      const time = new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
      return `Flow data unavailable. Last reading ${num(f.value)} CFS at ${time}.`;
    }
    /** The shop's own name for the pack wins; otherwise the water's short name. */
    packName() { const w = this.data.water; return w.packName || `${w.shortName} pack`; }
    packButton() {
      const k = this.pack();
      // The page lists this water's flies but sets no quantities, so there is no pack to add.
      // Inventing "two of each" is the same class of invention as inventing a hatch slot.
      if (this.data.readOnly) return `<button class="pack" disabled><span class="packlabel"><b>No pack for the ${esc(this.data.water.shortName)} yet</b><em>No pack yet</em></span><span></span><span>&mdash;</span></button>`;
      if (this.s.added) return `<button class="pack" data-action="viewcart"><span>Added</span><span></span><span>View cart</span></button>`;
      // Three columns, always. When it will not all fit, the water name is the part that goes:
      // the count and the price are the promise. See fitPackLabel().
      return `<button class="pack" data-action="addpack" ${k.flies ? '' : 'disabled'}><span class="packlabel"><b>Add ${esc(this.packName())}</b><em>Add pack</em></span><span>${k.flies} ${k.flies === 1 ? 'fly' : 'flies'}</span><span>${money(k.total)}</span></button>`;
    }
    /** One header for both states. Only the chevron changes: the two facts never move. */
    header(open) {
      const fr = this.fresh(), r = this.rating();
      // The title is the water switcher, and only when the card is open -- compact, the whole face
      // is already one button and a button cannot hold another. A bare caret at text size on the
      // baseline: the circle in the corner already means expand, and two actions must not share a
      // shape. Compact keeps a plain title.
      const name = esc(this.data.water.name);
      const title = open && this.waters.length > 1
        ? `<button class="title" data-action="waters" data-focus="waters" aria-expanded="${this.s.picker}" aria-label="Switch water. Currently ${name}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span><span class="tcare" aria-hidden="true">&#9662;</span></button>`
        : `<div class="title">${name}</div>`;
      return `<div class="between">${title}${open
        ? `<button class="chev" data-action="collapse" aria-label="Collapse">&#9650;</button>`
        : `<span class="chev" aria-hidden="true">&#9660;</span>`}</div>
    <div class="between">
      <span class="lamp" style="--c:${fr.color};font-size:11px"><i></i>${fr.label}</span>
      ${r.n ? `<span class="row" style="gap:8px"><span class="label fishlabel">Fishing</span><span class="caps" style="font-weight:600;letter-spacing:.12em">${esc(r.label)}</span>${this.meter(r.n)}</span>` : `<span class="label">Not rated yet</span>`}
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
      out.push(`Read ${esc(time)} &middot; ${esc(this.data.water.gaugeName)}`);
      // Signed number, not a caret: the caret on the flow figure is the one place trend is stated,
      // and it reads the classified trend. This reads the measurement, which can be -20 while the
      // classification is still Steady. Two carets disagreeing six pixels apart is worse than none.
      if (f.delta != null && f.hours) {
        const d = Math.round(f.delta);
        out.push(d === 0
          ? `Holding for ${f.hours} hrs`
          : `${d > 0 ? '+' : '\u2212'}${num(Math.abs(d))} CFS in ${f.hours} hrs`);
      }
      if (this.s.temp != null) out.push(`Water ${this.s.temp}&deg;`);
      return out;
    }
    liveStrip() {
      const frames = this.liveFrames();
      if (!frames.length) return '';
      const f = this.s.flow, at = this.frame % frames.length;
      return `<div class="live"><i class="${f.live ? 'pulse' : ''}"></i><b>${f.live ? 'Live' : 'Last reading'}</b><span class="frames">${frames.map((t, i) => `<span class="${i === at ? 'on' : ''}"${i === at ? '' : ' aria-hidden="true"'}>${t}</span>`).join('')}</span></div>`;
    }
    /** The week, quantized to six steps on the bar's own fixed scale. Renders wherever the bar
        renders: without a published range there is no honest scale, and inventing one from the
        window's own spread is the single thing this graphic must never do. */
    sparkline() {
      const F = this.data.water.flow, f = this.s.flow, STEPS = 6;
      if (f.failed || !f.series || F.max == null) return '';
      const span = F.max - F.min;
      const cols = f.series.map((v, i) => {
        const cur = i === f.series.length - 1;
        if (v == null) return `<span class="col"></span>`;
        const step = Math.max(1, Math.min(STEPS, Math.ceil((v - F.min) / span * STEPS)));
        // Only the lit cells: drawing the unlit ones made a solid 14x6 block that read as texture.
        // Cells take the segmented bar's own two colours, split at the threshold, so the two
        // graphics read as one instrument. Measured across all six gauges we carry, six steps on
        // a fixed full-range scale yields one or two distinct levels -- these rivers genuinely
        // have no shape to show in a week, so the threshold is what this graphic is for.
        const cells = Array.from({ length: step }, (_, k) => {
          const top = F.min + (k + 1) * span / STEPS;
          const seg = F.threshold != null && top > F.threshold ? 'var(--amber)'
            : `color-mix(in srgb, var(--water1), var(--water2) 55%)`;
          return `<i style="--seg:${seg}"></i>`;
        }).join('');
        return `<span class="col${cur ? ' cur' : ''}">${cells}</span>`;
      }).join('');
      // The line is not redundant with the colour split: a column that never reaches the
      // threshold has no amber, so the line is the only thing saying where the limit is.
      const lim = F.threshold == null ? '' : `<span class="lim" style="bottom:${((F.threshold - F.min) / span * 100).toFixed(2)}%"></span>`;
      const seen = f.series.filter(v => v != null);
      const label = `${f.days} days of flow, ${num(Math.round(Math.min(...seen)))} to ${num(Math.round(Math.max(...seen)))} CFS`
        + (F.threshold == null ? '' : `, ${F.thresholdLabel} ${num(F.threshold)}`);
      return `<span class="spark" role="img" aria-label="${label}">${cols}${lim}</span>`;
    }
    /** The whole flow instrument. Compact and expanded render the same thing; expanded adds the
        range labels under the bar and nothing else. */
    flowModule(expanded) {
      const F = this.data.water.flow, f = this.s.flow;
      const tick = F.max == null || F.threshold == null ? null : ((F.threshold - F.min) / (F.max - F.min) * 100).toFixed(2) + '%';
      return `<div class="flowmod">
      ${this.data.water.usgsSite ? `<div class="flownum"><span class="big xl" style="color:${f.failed ? 'var(--muted)' : 'var(--text)'}">${num(f.value)}</span><span class="unit" style="font-size:11px;letter-spacing:.14em">CFS</span>${this.sparkline()}</div>` : ''}
      ${this.flowBar(true)}
      ${expanded && F.max != null ? `<div class="ranges"><span style="left:0">${num(F.min)}</span>${tick ? `<span class="mid" style="left:${tick}">${num(F.threshold)} ${esc(F.thresholdLabel)}</span>` : ''}<span style="right:0">${num(F.max)}</span></div>` : ''}
      ${f.failed ? `<div class="lamp muted" style="--c:var(--amber);text-transform:none;letter-spacing:0;font-size:12px;white-space:normal"><i></i>${this.flowNote()}</div>` : this.liveStrip()}
    </div>`;
    }
    /** Water temperature against the 50-65 trout-active band. A tailwater like the Lower Sac barely
        moves; a freestone swings hard. Absent unless the gauge actually reports 00010. */
    tempRow() {
      const t = this.s.temp;
      if (t == null) return '';
      const lo = 40, hi = 75, a = 50, b = 65, segs = 34;
      const pos = v => Math.max(0, Math.min(segs - 1, Math.round((v - lo) / (hi - lo) * (segs - 1))));
      const at = pos(t), cells = Array.from({ length: segs }, (_, i) => {
        const deg = lo + i * (hi - lo) / (segs - 1);
        return `<i class="${i === at ? 'at' : (deg >= a && deg <= b ? 'in' : '')}"></i>`;
      }).join('');
      const mid = ((( (a + b) / 2) - lo) / (hi - lo) * 100).toFixed(2) + '%';
      const pa = ((a - lo) / (hi - lo) * 100).toFixed(2) + '%', pb = ((b - lo) / (hi - lo) * 100).toFixed(2) + '%';
      return `<div class="sec rule" style="padding-top:14px">
    <div class="between"><span class="label">Water temp</span><span style="font-size:15px;font-weight:600">${t}&deg;</span></div>
    <div class="bar tall band" role="img" aria-label="Water temperature ${t} degrees, trout-active band ${a} to ${b}">${cells}</div>
    <div class="ranges"><span style="left:0">${lo}&deg;</span><span style="left:${pa}">${a}&deg;</span><span class="mid" style="left:${mid}">Prime</span><span style="left:${pb}">${b}&deg;</span><span style="right:0">${hi}&deg;</span></div>
  </div>`;
    }
    compact() {
      const d = this.data, w = this.wading(), hn = this.hatchNow(), f = this.s.flow;
      const closed = d.water.closed;
      return `<div class="card compact">
  <button class="expand" data-action="expand" aria-expanded="false" aria-label="Expand the ${esc(d.water.name)} report">
    ${this.header(false)}
    ${closed ? `<div class="lamp" style="--c:var(--red);font-size:13px;font-weight:600"><i></i>Closed</div><div>${esc(d.water.closedNote || '')}</div>` : `
    <div class="sec">
      ${this.flowModule(false)}
      ${f.failed || !w ? '' : `<div class="row caps" style="letter-spacing:.12em"><span class="muted">Wading</span><span class="lamp" style="--c:${w.color}"><i></i>${w.label}</span><span class="muted" style="margin-left:auto;text-transform:none;letter-spacing:.04em">${w.note}</span></div>`}
    </div>
    ${hn ? `<div class="row rule" style="padding-top:10px">
      <span class="label" style="white-space:nowrap">${hn.label}</span>
      <span style="font-weight:600;white-space:nowrap">${esc(hn.h.insect)} <span class="muted" style="font-weight:400">${esc(hn.h.size)}</span></span>
      <span class="lamp" style="text-transform:none;letter-spacing:0;font-size:11px;--c:${hn.h.intensity >= 4 ? 'var(--accent)' : hn.h.intensity >= 2 ? 'var(--green)' : 'var(--amber)'}"><i></i>${esc(hn.h.word)}</span>
      <span class="muted" style="margin-left:auto;font-size:10px;text-align:right">${hn.when}</span>
    </div>` : `<div class="muted rule" style="padding-top:10px;font-size:12px">No guide's report on this water yet. Flow and weather are live.</div>`}`}
  </button>
  ${closed ? `<a class="ghost" href="tel:${d.water.guidePhone.replace(/\D/g, '')}"><span class="caps" style="font-weight:600">Fish it with a guide</span><span class="muted">${d.water.guidePhone}</span></a>` : this.packButton()}
</div>`;
    }
    expanded() {
      const d = this.data, tab = this.s.tab;
      const tabs = ['now', 'hatch', 'notes'];
      return `<div class="card open">
  <div class="head">
    ${this.header(true)}
  </div>
  <div class="tabs" role="tablist" aria-label="Report">
    ${tabs.map(k => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel-${k}" tabindex="${tab === k ? 0 : -1}" data-action="tab" data-tab="${k}" data-focus="tab-${k}">${k}</button>`).join('')}
  </div>
  <div class="panelwrap">${this.s.picker
    ? `<div class="panel" role="region" aria-label="Choose a water" tabindex="0">${this.tab_waters()}</div>`
    : `<div class="panel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" tabindex="0">${this['tab_' + tab]()}</div>`}</div>
  <div class="buybar">
    ${this.tripRow()}
    <button class="allflies" data-action="catalog" data-focus="catalog"><span>All flies for the ${esc(d.water.shortName)}</span><span aria-hidden="true">&rarr;</span></button>
    ${this.packButton()}
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
    ${secs.length > 1 ? `<span class="secsel"><span class="label lab">Section</span><span class="box"><select data-action="section" data-focus="section" aria-label="Section of the river">${secs.map(x => `<option value="${esc(x)}"${x === this.s.section ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select><span class="care" aria-hidden="true">&#9662;</span></span></span>` : ''}
  </div>`;
    }
    tab_now() {
      const d = this.data, w = this.wading(), fr = this.fresh();
      // Illustrative, not measured: these positions place a four-value ordinal on a 24-tick scale
      // so it reads as an instrument. There is no percentage behind them and none is printed.
      // The only real number here is turbidity, and only if the gauge actually reports 63680.
      const clarity = { Poor: 3, Fair: 9, Good: 15, Excellent: 22 }[d.report.clarity] ?? 12;
      const turb = this.s.turbidity;
      const wx = this.s.weather;
      return `<div class="now">
  ${this.flowModule(true)}
  ${w || d.report.clarity ? `<div class="two rule" style="padding-top:14px">
    ${w ? `<div class="sec"><div class="label">Wading</div><div class="lamp" style="--c:${w.color};font-size:13px;font-weight:600;letter-spacing:.1em"><i style="width:8px;height:8px"></i>${w.label}</div><div class="muted" style="font-size:12px">${w.note}</div></div>` : ''}
    ${d.report.clarity ? `<div class="sec"><div class="label">Clarity</div><div class="accent caps" style="font-weight:600;letter-spacing:.1em;font-size:13px">${esc(d.report.clarity)}${turb != null ? `<span class="muted" style="letter-spacing:.06em"> &middot; ${turb} FNU</span>` : ''}</div>${this.ticks(24, clarity, 'var(--accent)')}</div>` : ''}
  </div>` : ''}
  ${this.tempRow()}
  <div class="sec rule" style="padding-top:14px;gap:10px">
    <div class="between"><span class="label">Next three days</span><span class="muted" style="font-size:10px">${wx ? 'High, low, rain chance' : 'From the report'}</span></div>
    <div class="wx">${(wx || [{ day: 'Day 1', label: 'Clouds', icon: 'clouds' }, { day: 'Day 2', label: 'Sprinkles', icon: 'drizzle' }, { day: 'Day 3', label: 'Sprinkles', icon: 'drizzle' }]).map(x => `
      <div class="d"><span class="day"><span class="ic">${WX_ICON[x.icon || x.label] || WX_ICON.clouds}</span><span class="label" style="letter-spacing:.12em">${esc(x.day)}</span></span>${x.hi != null ? `<span class="temps"><span>${CARET(true)}${x.hi}°</span><span class="lo">${CARET(false)}${x.lo}°</span></span>` : ''}<span class="cond">${esc(cap(x.label))}${x.pct != null ? `, ${x.pct}% rain` : ''}</span></div>`).join('')}</div>
  </div>
  ${d.report.publishedAt ? `<div class="sec rule" style="padding-top:14px">
    <div class="between"><span class="label">Report age</span><span class="lamp" style="--c:${fr.color}"><i></i>${fr.label}</span></div>
    ${this.ticks(28, Math.min(27, Math.round(fr.days / 14 * 27)), fr.color)}
    <div class="between" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)"><span>${fr.days === 0 ? 'Today' : fr.days + (fr.days === 1 ? ' day ago' : ' days ago')}</span><span>7 days</span><span>14 days</span></div>
    ${fr.stale ? `<div class="note">Conditions may have changed since this report. Flow and weather are live.</div>` : ''}
    ${d.report.author ? `<div class="muted" style="padding-top:10px">Report by ${esc(d.report.author)}</div>` : ''}
  </div>` : ''}
  <a class="ghost guide" href="tel:${d.water.guidePhone.replace(/\D/g, '')}" data-action="guide"><span class="caps" style="font-weight:600">Fish it with a guide</span><span class="muted">${d.water.guidePhone}</span></a>
</div>`;
    }
    /** One panel. The angler's question is one question, so the hatch and the flies that answer it
        live in the same place: time-of-day rows, flies nested under the row that calls for them. */
    tab_hatch() {
      const d = this.data, now = this.slotNow();
      // The flies are real and the prices are the shop's. What is missing is the guide's minute:
      // which hatch, what time of day, how many. That gap is the whole pitch, said plainly.
      if (d.readOnly) return `<div class="slots">
    <div class="empty" style="padding:14px 0 4px">
      <div style="color:var(--text);font-weight:600">A guide hasn't broken the ${esc(d.water.shortName)} out by hatch yet.</div>
      <div>These are the shop's own hot flies for this water, on real SKUs at the shop's prices. What the ${esc(this.resolved.water.shortName)} has and this doesn't is a hatch for each part of the day, and how many of each to carry.</div>
    </div>
    ${this.flyGroups(this.rows())}
  </div>`;
      // A slot with no hatch is hidden unless the angler is standing in it. The fallback text is
      // the guide's own prose -- worth reading at dusk, noise at 2pm. A rule, not a special case:
      // a guide who does list a last-light hatch still gets it shown.
      const slots = d.hatches.map((h, i) => (h.none && i !== now) ? '' : this.slotRow(h, i, i === now)).join('');
      const anytime = this.anytimeRow();
      return `<div class="slots">
  <div class="between" style="padding:8px 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)"><span>Time of day</span><span>Hatch, size, the guide's word</span></div>
  ${slots}${anytime}
</div>`;
    }
    /** A hatch row and, underneath it, the flies for that hatch. The row is the disclosure. */
    slotRow(h, i, isNow) {
      const label = `<div style="display:flex;flex-direction:column;gap:2px"><span class="label" style="color:${isNow ? 'var(--text)' : 'var(--muted)'}">${cap(SLOTS[i])}</span>${isNow ? `<span class="lamp" style="--c:var(--green);color:var(--green);font-size:10px"><i style="width:6px;height:6px"></i>Now</span>` : ''}</div>`;
      if (h.none) return `<div class="slot">${label}<div class="muted" style="font-size:12px">${esc(h.fallback)}</div></div>`;
      const open = this.s.expanded.has(h.slot), id = `flies-${h.slot.replace(/\s+/g, '-')}`;
      return `<div class="slot">${label}
    <button class="chip${this.s.tip === h.slot ? ' tipopen' : ''}" data-action="slot" data-slot="${esc(h.slot)}" data-focus="slot-${esc(h.slot)}" aria-expanded="${open}" aria-controls="${id}">
      <span class="dot"></span><span style="font-weight:600">${esc(h.insect)}</span><span class="muted">${esc(h.size)}</span>${this.meter(h.intensity, false, `Intensity: ${esc(h.word)}, ${h.intensity} of 5`)}<span class="word muted">${esc(h.word)}</span><span class="care" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
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
      <span class="dot"></span><span class="muted">${esc(tags.map(cap).join(', '))}</span><span class="care" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
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
      return `<div class="fly${qty === 0 ? ' zero' : ''}">
    ${v.image ? `<button class="thumb" data-action="image" data-id="${id}" data-focus="img-${id}" aria-label="Larger picture of ${esc(use.name)}"><img src="${esc(v.image)}" alt="" loading="lazy" width="36" height="36"></button>` : `<div class="thumb"></div>`}
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><a class="name" href="${esc(v.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" data-action="fly" data-id="${id}">${esc(use.name)}</a><span class="meta">${meta}</span></div>
    <div class="right"><span class="qtyline">${qty == null ? '' : r.oos ? `<span class="muted" style="font-size:11px">×${qty}</span>` : `<span class="step sm"><button data-action="qty" data-id="${id}" data-d="-1" aria-label="Fewer ${esc(use.name)}${mult > 1 ? ', one per angler per day' : ''}" data-focus="q-${id}-">−</button><b aria-live="polite">${qty}</b><button data-action="qty" data-id="${id}" data-d="1" aria-label="More ${esc(use.name)}${mult > 1 ? ', one per angler per day' : ''}" data-focus="q-${id}+">+</button></span>`}<span>${money(r.price)}</span></span><span class="stock" style="--c:${lamp[0]}"><i></i>${lamp[1]}</span></div>
  </div>
  ${chips ? `<div class="edit">
    <span class="muted" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase">Option</span>${chips}
  </div>` : ''}`;
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
      if (!d.report.notes.length) return `<div class="empty"><div style="color:var(--text);font-weight:600">No guide's notes for this water yet.</div><div>When the shop publishes prose for ${esc(d.water.shortName)}, it appears here as written and is never edited by the system.</div></div>`;
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
        // Only fade an edge there is something past.
        next.parentElement.classList.toggle('fade', next.scrollHeight > next.clientHeight + 1);
      }
      if (focusKey) this.root.querySelector(`[data-focus="${focusKey}"]`)?.focus();
      this.fitPackLabel();
      this.startCycle();
    }
    /** The count and price grow with the steppers, so the fit is not a width breakpoint. Lay the long
        label out, and if it clips, fall back to the generic one. Past roughly 336 flies on a 350px
        card even the generic label clips: the label is what gives, never the count or the price. */
    fitPackLabel() {
      const el = this.root.querySelector('.pack .packlabel');
      if (!el) return;
      el.classList.remove('short');
      if (el.scrollWidth > el.clientWidth + 1) el.classList.add('short');
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
          const open = !s.picker;
          this.set({ picker: open, tip: null });
          if (open) this.emit('water_list_opened', {});
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
  HM.mount = function (host, data) {
    injectFont();
    const card = new Card(host, data || DATA);
    HM.cards.push(card);
    return card;
  };
  function boot() {
    document.querySelectorAll('#hatchmatch, .hatchmatch, [data-hatchmatch]').forEach(host => { if (!host.shadowRoot) HM.mount(host); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
