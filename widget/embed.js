/* HatchMatch report widget. One component, rendered into a shadow root.
   Data, font and mark are inlined by build.mjs for the static demo. */
(function () {
  'use strict';
  const DATA = "__HM_DATA__";
  const FONT = "__HM_FONT__";
  const STONEFLY = "__HM_STONEFLY__";

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
/* live strip: overlapping frames, one visible at a time */
.live{position:relative;height:16px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.live>span{position:absolute;inset:0;display:flex;align-items:center;gap:7px;white-space:nowrap;opacity:0;transition:opacity .3s linear}
.live>span.on{opacity:1}
.live i{width:6px;height:6px;border-radius:50%;background:var(--green);flex:none}
.live i.pulse{animation:hm-pulse 2s ease-in-out infinite}
@keyframes hm-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){.live>span{transition:none}.live i.pulse{animation:none}}
.expand{display:flex;flex-direction:column;gap:10px;width:100%;border-radius:8px}
.big{font-size:28px;font-weight:600;letter-spacing:-.02em;line-height:1}
.big.xl{font-size:44px;letter-spacing:-.03em}
.unit{font-size:10px;letter-spacing:.12em;color:var(--muted)}
.flowrow{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}
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
.chev{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;font-size:9px;color:var(--accent);flex:none}
.pack{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;height:48px;padding:0 14px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
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
.card.open{max-height:min(78vh,720px)}
.head,.tabs,.packbar{flex:none}
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
.slots{padding:8px 16px 16px;display:flex;flex-direction:column}
.slot{display:grid;grid-template-columns:74px minmax(0,1fr);gap:10px;align-items:center;min-height:64px;border-top:1px solid var(--line)}
.chip{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);justify-self:start;max-width:100%}
.chip[aria-expanded=true]{background:var(--surface2);border-color:var(--accent)}
.chip .dot{width:7px;height:7px;border-radius:50%;background:var(--off);flex:none}.chip[aria-expanded=true] .dot{background:var(--accent)}
.chip{justify-self:stretch;width:100%;min-width:0;gap:8px;padding:0 10px 0 12px}
.chip .word{font-size:11px;margin-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chip .care{margin-left:auto;color:var(--accent);font-size:9px;flex:none;padding-left:6px}
@container (max-width:399px){.chip .meter{display:none}}
.flies{padding:0 0 6px}
.only{display:inline-block;padding:1px 5px;border:1px solid var(--line);border-radius:3px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.catalog{margin-top:8px}
.sel{display:inline-flex;align-items:center;height:36px;padding:0 8px;border:1px solid var(--line);border-radius:999px}
.sel select{font:inherit;font-size:12px;color:inherit;background:none;border:0;padding:0 2px;cursor:pointer;max-width:96px}
.pill{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.pill[aria-pressed=true]{background:var(--surface2)}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--off)}.pill[aria-pressed=true] i{background:var(--accent)}
.rig{padding:12px 16px 8px;display:flex;flex-direction:column;gap:4px}
.filter{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--accent);border-radius:10px;margin-top:4px}
.group{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);padding:10px 0 4px}
.fly{display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:center;min-height:56px;padding:8px 0;border-top:1px solid var(--line)}
.fly.zero{opacity:.45}
.thumb{width:36px;height:36px;border-radius:8px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover}
.name{font-size:14px;font-weight:600;line-height:1.2}
.meta{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}
.meta i{width:6px;height:6px;border-radius:50%;background:var(--red);flex:none}
.right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;white-space:nowrap}
.stock{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.stock i{width:6px;height:6px;border-radius:50%;background:var(--c)}
.edit{display:flex;align-items:center;gap:8px;padding:0 0 10px 48px;flex-wrap:wrap}
.step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;height:36px}
.step button{width:36px;height:36px;font-size:16px;text-align:center}.step b{min-width:18px;text-align:center;font-size:13px}
.vchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:999px;font-size:12px}
.vchip[aria-pressed=true]{background:var(--surface2)}.vchip i{width:6px;height:6px;border-radius:50%;background:var(--off)}.vchip[aria-pressed=true] i{background:var(--accent)}
.vchip.oos{color:var(--muted);text-decoration:line-through}
.notes{padding:16px;display:flex;flex-direction:column;gap:14px}
.prose{font-size:15px;line-height:1.65;display:flex;flex-direction:column;gap:14px}.prose p{margin:0}
.foot{font-size:11px;letter-spacing:.06em;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
.packbar{background:var(--bg);border-top:1px solid var(--line);padding:10px 16px 14px;display:flex;flex-direction:column;gap:10px}
.editrow{display:flex;justify-content:flex-end;margin-top:-4px}
.packbar .guide{border:0;border-top:1px solid var(--line);border-radius:0;padding:0;min-height:44px;margin-top:2px}
.steps{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px}
.steps .step button{width:30px}.steps .step b{min-width:12px}
.link{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;height:36px}
.powered{display:flex;justify-content:center;align-items:center;gap:6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.powered svg{width:12px;height:12px;color:var(--accent);opacity:.8}
.avatar{width:20px;height:20px;border-radius:50%;background:var(--off);flex:none}
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
  async function fetchFlow(site) {
    const errors = [];
    try {
      const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00060&period=PT6H`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ts = (await r.json()).value.timeSeries[0];
      const vals = ts.values[0].value.map(v => ({ value: +v.value, at: v.dateTime })).filter(v => v.value >= 0);
      if (!vals.length) throw new Error('empty series');
      const last = vals[vals.length - 1], first = vals[0], delta = last.value - first.value;
      return { value: last.value, at: last.at, trend: Math.abs(delta) < Math.max(100, last.value * .02) ? 'Steady' : delta > 0 ? 'Rising' : 'Falling', live: true, source: 'waterservices.usgs.gov/nwis/iv' };
    } catch (e) { errors.push(`nwis/iv: ${e.message}`); }
    try {
      const r = await fetch(`https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?monitoring_location_id=USGS-${site}&parameter_code=00060&f=json`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const f = ((await r.json()).features || []).find(x => x.properties && x.properties.parameter_code === '00060');
      if (!f) throw new Error('no streamflow feature');
      return { value: +f.properties.value, at: f.properties.time, trend: '', live: true, source: 'api.waterdata.usgs.gov' };
    } catch (e) { errors.push(`ogcapi: ${e.message}`); }
    throw new Error(errors.join(' | '));
  }
  const WX = c => c === 0 ? 'clear' : c <= 2 ? 'mostly clear' : c === 3 ? 'clouds' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow' : 'storms';
  async function fetchWeather(lat, lon) {
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
      this.host = host; this.data = data;
      this.root = host.attachShadow({ mode: 'open' });
      const demo = new URLSearchParams(location.search).get('state') || host.dataset.demoState || '';
      this.demo = demo;
      this.frame = 0; this.cycler = null; this.poll = null; this.scrollPos = {}; this.shownTab = null;
      this.s = { open: false, tab: 'now', section: data.water.sections[0], anglers: 1, days: 1, qty: {}, variant: {}, customize: false, expanded: new Set(), added: false, filled: false,
        flow: { value: data.water.flow.lastReading.value, at: data.water.flow.lastReading.at, trend: '', live: false, failed: false }, weather: null };
      this.picks = data.picks.filter(p => p.variant);
      this.byId = new Map(this.picks.map(p => [p.id, p]));
      // Open the slot the angler is standing in, if it has a hatch. The rest start closed.
      const now = data.hatches[this.slotNow()];
      if (now && !now.none) this.s.expanded.add(now.slot);
      this.events = [];
      this.root.addEventListener('click', e => this.onClick(e));
      this.root.addEventListener('change', e => {
        const el = e.target.closest('[data-action="section"]');
        if (!el) return;
        this.set({ section: el.value, added: false });
        this.emit('section_switched', { section: el.value });
      });
      this.root.addEventListener('keydown', e => this.onKey(e));
      new MutationObserver(() => this.render()).observe(host, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-on-accent'] });
      this.render();
      this.emit('pack_viewed', { water: data.water.id, report: data.report.publishedAt });
      requestAnimationFrame(() => { this.s.filled = true; });
      this.load();
    }
    async load() {
      const w = this.data.water;
      if (this.demo === 'noflow') { this.s.flow.failed = true; this.render(); }
      else fetchFlow(w.usgsSite).then(f => { this.s.flow = f; this.emit('flow_live', { value: f.value, at: f.at, source: f.source }); this.render(); })
        .catch(e => { this.s.flow.failed = true; this.s.flow.error = e.message; console.warn('[hatchmatch] flow unavailable, showing the report\'s last reading:', e.message); this.emit('flow_unavailable', { error: e.message }); this.render(); });
      fetchWeather(w.lat, w.lon).then(wx => { this.s.weather = wx; this.render(); })
        .catch(e => { console.warn('[hatchmatch] weather unavailable, showing the report\'s outlook:', e.message); this.emit('weather_unavailable', { error: e.message }); });
      this.watchFlow();
    }
    /** LIVE has to be true to be worth saying. Re-read the gauge every five minutes, but only while
        the host is on screen. A refresh that fails keeps the last good number: only the first load
        is allowed to set `failed`, because that is the only one with nothing to fall back to. */
    watchFlow() {
      if (this.demo === 'noflow' || !window.IntersectionObserver) return;
      const tick = () => fetchFlow(this.data.water.usgsSite)
        .then(f => { this.s.flow = f; this.emit('flow_live', { value: f.value, at: f.at, source: f.source }); this.render(); })
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
    fresh() {
      const d = this.days(), label = 'Updated ' + shortDate(this.data.report.publishedAt);
      return { days: d, label, color: d < 7 ? 'var(--green)' : d < 14 ? 'var(--amber)' : 'var(--red)', stale: d >= 14 };
    }
    slotNow() { const h = new Date().getHours(); return h < 11 ? 0 : h < 15 ? 1 : h < 19 ? 2 : 3; }
    hatchNow() {
      const H = this.data.hatches, i = this.slotNow(), now = H[i];
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
    meter(n, wide) { return `<span class="meter${wide ? ' wide' : ''}" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; }
    ticks(count, idx, color) { return `<div class="ticks" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<i class="${i === idx ? 'on' : ''}" style="--c:${color}"></i>`).join('')}</div>`; }
    flowBar(tall) {
      const F = this.data.water.flow, f = this.s.flow, segs = 24;
      const filled = f.failed ? 0 : Math.round((f.value - F.min) / (F.max - F.min) * segs);
      const tick = ((F.threshold - F.min) / (F.max - F.min) * 100).toFixed(2) + '%';
      const cells = Array.from({ length: segs }, (_, i) => {
        const on = i < filled, top = F.min + (i + 1) * (F.max - F.min) / segs;
        const color = top > F.threshold ? 'var(--amber)' : `color-mix(in srgb, var(--water1), var(--water2) ${Math.round(i / (segs - 1) * 100)}%)`;
        return `<i class="${on ? 'on' : ''}${on && !this.s.filled ? ' fill' : ''}" style="--i:${i};--seg:${color}"></i>`;
      }).join('');
      return `<div class="bar${tall ? ' tall' : ''}" role="img" aria-label="${num(f.value)} CFS on a scale of ${num(F.min)} to ${num(F.max)}, ${F.thresholdLabel} ${num(F.threshold)}">${cells}<span class="tick" style="left:${tick}"></span></div>`;
    }
    rating() {
      const r = this.data.report.rating, n = { Poor: 1, Fair: 2, 'Fair to Good': 3, Good: 4, Great: 5 }[r] || 0;
      return { label: r, n };
    }
    wading() {
      const F = this.data.water.flow, f = this.s.flow;
      const ok = !f.failed && f.value < F.threshold;
      return { label: ok ? 'Wadeable' : 'Not today', color: ok ? 'var(--green)' : 'var(--amber)', note: `Wadeable below ${num(F.threshold)} CFS` };
    }
    flowNote() {
      const f = this.s.flow, t = new Date(f.at);
      const time = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
      return f.failed ? `Flow data unavailable. Last reading ${num(f.value)} CFS at ${time}.` : `USGS ${this.data.water.gaugeName.replace(/^USGS\s*/, '')}, ${time}`;
    }
    /** The shop's own name for the pack wins; otherwise the water's short name. */
    packName() { const w = this.data.water; return w.packName || `${w.shortName} pack`; }
    packButton() {
      const k = this.pack();
      if (this.s.added) return `<button class="pack" data-action="viewcart"><span>Added</span><span></span><span>View cart</span></button>`;
      // Three columns, always. When it will not all fit, the water name is the part that goes:
      // the count and the price are the promise. See fitPackLabel().
      return `<button class="pack" data-action="addpack" ${k.flies ? '' : 'disabled'}><span class="packlabel"><b>Add ${esc(this.packName())}</b><em>Add pack</em></span><span>${k.flies} ${k.flies === 1 ? 'fly' : 'flies'}</span><span>${money(k.total)}</span></button>`;
    }
    /** One header for both states. Only the chevron changes: the two facts never move. */
    header(open) {
      const fr = this.fresh(), r = this.rating();
      return `<div class="between"><div class="title">${esc(this.data.water.name)}</div>${open
        ? `<button class="chev" data-action="collapse" aria-label="Collapse">&#9650;</button>`
        : `<span class="chev" aria-hidden="true">&#9660;</span>`}</div>
    <div class="between">
      <span class="lamp" style="--c:${fr.color};font-size:11px"><i></i>${fr.label}</span>
      <span class="row" style="gap:8px"><span class="label">Fishing</span><span class="caps" style="font-weight:600;letter-spacing:.12em">${esc(r.label)}</span>${this.meter(r.n)}</span>
    </div>`;
    }
    /** Report age and live flow are different facts. The lamp above owns the age and stays still;
        this strip owns what is actually changing. Frames crossfade; the dot pulses only when live. */
    liveFrames() {
      const f = this.s.flow;
      if (f.failed) return [];
      const time = new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return [
        [f.live ? 'Live' : 'Last reading', `${num(f.value)} CFS`, f.trend].filter(Boolean).join(' · '),
        `Read ${time} · ${this.data.water.gaugeName}`,
      ];
    }
    liveStrip() {
      const frames = this.liveFrames();
      if (!frames.length) return '';
      const pulse = this.s.flow.live, at = this.frame % frames.length;
      return `<div class="live">${frames.map((t, i) => `<span class="${i === at ? 'on' : ''}"${i === at ? '' : ' aria-hidden="true"'}><i class="${pulse ? 'pulse' : ''}"></i>${esc(t)}</span>`).join('')}</div>`;
    }
    compact() {
      const d = this.data, w = this.wading(), hn = this.hatchNow(), f = this.s.flow;
      const closed = d.water.closed;
      return `<div class="card compact">
  <button class="expand" data-action="expand" aria-expanded="false" aria-label="Expand the ${esc(d.water.name)} report">
    ${this.header(false)}
    ${closed ? `<div class="lamp" style="--c:var(--red);font-size:13px;font-weight:600"><i></i>Closed</div><div>${esc(d.water.closedNote || '')}</div>` : `
    <div class="sec">
      <div class="flowrow"><div class="row" style="gap:5px;align-items:baseline"><span class="big" style="color:${f.failed ? 'var(--muted)' : 'var(--text)'}">${num(f.value)}</span><span class="unit">CFS</span></div>${this.flowBar(false)}</div>
      ${this.liveStrip()}
      ${f.failed ? `<div class="lamp muted" style="--c:var(--amber);text-transform:none;letter-spacing:0;font-size:12px;white-space:normal"><i></i>${this.flowNote()}</div>`
        : `<div class="row caps" style="letter-spacing:.12em"><span class="muted">Wading</span><span class="lamp" style="--c:${w.color}"><i></i>${w.label}</span><span class="muted" style="margin-left:auto;text-transform:none;letter-spacing:.04em">${w.note}</span></div>`}
    </div>
    <div class="row rule" style="padding-top:10px">
      <span class="label" style="white-space:nowrap">${hn.label}</span>
      <span style="font-weight:600;white-space:nowrap">${esc(hn.h.insect)} <span class="muted" style="font-weight:400">${esc(hn.h.size)}</span></span>
      <span class="lamp" style="text-transform:none;letter-spacing:0;font-size:11px;--c:${hn.h.intensity >= 4 ? 'var(--accent)' : hn.h.intensity >= 2 ? 'var(--green)' : 'var(--amber)'}"><i></i>${esc(hn.h.word)}</span>
      <span class="muted" style="margin-left:auto;font-size:10px;text-align:right">${hn.when}</span>
    </div>`}
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
  <div class="panelwrap"><div class="panel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" tabindex="0">${this['tab_' + tab]()}</div></div>
  <div class="packbar">
    <div class="label">Your trip</div>
    <div class="steps">${this.stepper('Anglers', 'anglers', this.s.anglers)}${this.stepper('Days', 'days', this.s.days)}
      <span class="row" style="gap:6px"><span class="label" style="letter-spacing:.1em">Section</span><span class="sel"><select data-action="section" data-focus="section" aria-label="Section of the river">${d.water.sections.map(x => `<option value="${esc(x)}"${x === this.s.section ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></span></span>
    </div>
    <div class="muted" style="font-size:11px">${this.mathLine()}</div>
    ${this.packButton()}
    <div class="editrow"><button class="link" data-action="customize" style="color:${this.s.customize ? 'var(--accent)' : 'var(--text)'}" data-focus="customize">${this.s.customize ? 'Done' : 'Edit pack'}</button></div>
    <a class="ghost guide" href="tel:${d.water.guidePhone.replace(/\D/g, '')}" data-action="guide"><span class="caps" style="font-weight:600">Fish it with a guide</span><span class="muted">${d.water.guidePhone}</span></a>
    <div class="powered">${STONEFLY.startsWith('__') ? '' : STONEFLY}Powered by HatchMatch</div>
  </div>
</div>`;
    }
    stepper(label, key, val) {
      return `<div class="row" style="gap:6px"><span class="label" style="letter-spacing:.1em">${label}</span><span class="step"><button data-action="step" data-key="${key}" data-d="-1" aria-label="Fewer ${label.toLowerCase()}" data-focus="${key}-">−</button><b aria-live="polite">${val}</b><button data-action="step" data-key="${key}" data-d="1" aria-label="More ${label.toLowerCase()}" data-focus="${key}+">+</button></span></div>`;
    }
    mathLine() {
      const rows = this.rows().flatMap(g => g.flies).filter(r => !r.oos), per = rows.reduce((n, r) => n + r.per, 0), k = this.pack();
      const a = this.s.anglers, dd = this.s.days;
      return `${per} flies per angler per day × ${a} ${a === 1 ? 'angler' : 'anglers'} × ${dd} ${dd === 1 ? 'day' : 'days'} = ${k.flies} flies`;
    }
    tab_now() {
      const d = this.data, F = d.water.flow, f = this.s.flow, w = this.wading(), fr = this.fresh();
      const clarity = { Poor: 3, Fair: 9, Good: 15, Excellent: 22 }[d.report.clarity] ?? 12;
      const tick = ((F.threshold - F.min) / (F.max - F.min) * 100).toFixed(2) + '%';
      const wx = this.s.weather;
      return `<div class="now">
  <div class="sec">
    <div class="between"><span class="label">Flow, ${esc(d.water.gaugeName)}</span><span class="label">${f.failed ? '' : f.trend}</span></div>
    <div class="row" style="gap:8px;align-items:baseline"><span class="big xl" style="color:${f.failed ? 'var(--muted)' : 'var(--text)'}">${num(f.value)}</span><span class="unit" style="font-size:11px;letter-spacing:.14em">CFS</span></div>
    ${this.flowBar(true)}
    <div class="ranges"><span style="left:0">${num(F.min)}</span><span class="mid" style="left:${tick}">${num(F.threshold)} ${esc(F.thresholdLabel)}</span><span style="right:0">${num(F.max)}</span></div>
    <div class="muted" style="font-size:11px">${f.failed ? this.flowNote() : `${f.live ? 'Live' : 'Last reading'}, ${this.flowNote()}`}</div>
  </div>
  <div class="two rule" style="padding-top:14px">
    <div class="sec"><div class="label">Wading</div><div class="lamp" style="--c:${w.color};font-size:13px;font-weight:600;letter-spacing:.1em"><i style="width:8px;height:8px"></i>${w.label}</div><div class="muted" style="font-size:12px">${w.note}</div></div>
    <div class="sec"><div class="label">Clarity</div><div class="accent caps" style="font-weight:600;letter-spacing:.1em;font-size:13px">${esc(d.report.clarity)}</div>${this.ticks(24, clarity, 'var(--accent)')}</div>
  </div>
  <div class="sec rule" style="padding-top:14px;gap:10px">
    <div class="between"><span class="label">Next three days</span><span class="muted" style="font-size:10px">${wx ? 'High, low, rain chance' : 'From the report'}</span></div>
    <div class="wx">${(wx || [{ day: 'Day 1', label: 'Clouds', icon: 'clouds' }, { day: 'Day 2', label: 'Sprinkles', icon: 'drizzle' }, { day: 'Day 3', label: 'Sprinkles', icon: 'drizzle' }]).map(x => `
      <div class="d"><span class="day"><span class="ic">${WX_ICON[x.icon || x.label] || WX_ICON.clouds}</span><span class="label" style="letter-spacing:.12em">${esc(x.day)}</span></span>${x.hi != null ? `<span class="temps"><span>${CARET(true)}${x.hi}°</span><span class="lo">${CARET(false)}${x.lo}°</span></span>` : ''}<span class="cond">${esc(cap(x.label))}${x.pct != null ? `, ${x.pct}% rain` : ''}</span></div>`).join('')}</div>
  </div>
  <div class="sec rule" style="padding-top:14px">
    <div class="between"><span class="label">Report age</span><span class="lamp" style="--c:${fr.color}"><i></i>${fr.label}</span></div>
    ${this.ticks(28, Math.min(27, Math.round(fr.days / 14 * 27)), fr.color)}
    <div class="between" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)"><span>${fr.days === 0 ? 'Today' : fr.days + (fr.days === 1 ? ' day ago' : ' days ago')}</span><span>7 days</span><span>14 days</span></div>
    ${fr.stale ? `<div class="note">Conditions may have changed since this report. Flow and weather are live.</div>` : ''}
    ${d.report.author ? `<div class="muted" style="padding-top:10px">Report by ${esc(d.report.author)}</div>` : ''}
  </div>
</div>`;
    }
    /** One panel. The angler's question is one question, so the hatch and the flies that answer it
        live in the same place: time-of-day rows, flies nested under the row that calls for them. */
    tab_hatch() {
      const d = this.data, now = this.slotNow();
      const slots = d.hatches.map((h, i) => this.slotRow(h, i, i === now)).join('');
      const anytime = this.anytimeRow();
      return `<div class="slots">
  <div class="between" style="padding:8px 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)"><span>Time of day</span><span>Hatch, size, the guide's word</span></div>
  ${slots}${anytime}
  <div class="muted" style="padding:14px 0 4px;font-size:12px">Intensity is the guide's word for each hatch this week.${this.s.customize ? ' Quantities are per angler per day.' : ''}</div>
  <button class="ghost catalog" data-action="catalog" data-focus="catalog"><span class="caps" style="font-weight:600">All flies for the ${esc(d.water.shortName)}</span><span aria-hidden="true">&rarr;</span></button>
</div>`;
    }
    /** A hatch row and, underneath it, the flies for that hatch. The row is the disclosure. */
    slotRow(h, i, isNow) {
      const label = `<div style="display:flex;flex-direction:column;gap:2px"><span class="label" style="color:${isNow ? 'var(--text)' : 'var(--muted)'}">${cap(SLOTS[i])}</span>${isNow ? `<span class="lamp" style="--c:var(--green);color:var(--green);font-size:10px"><i style="width:6px;height:6px"></i>Now</span>` : ''}</div>`;
      if (h.none) return `<div class="slot">${label}<div class="muted" style="font-size:12px">${esc(h.fallback)}</div></div>`;
      const open = this.s.expanded.has(h.slot), id = `flies-${h.slot.replace(/\s+/g, '-')}`;
      return `<div class="slot">${label}
    <button class="chip" data-action="slot" data-slot="${esc(h.slot)}" data-focus="slot-${esc(h.slot)}" aria-expanded="${open}" aria-controls="${id}">
      <span class="dot"></span><span style="font-weight:600">${esc(h.insect)}</span><span class="muted">${esc(h.size)}</span>${this.meter(h.intensity)}<span class="word muted">${esc(h.word)}</span><span class="care" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
    </button>
  </div>
  <div class="flies" id="${id}"${open ? '' : ' hidden'}>${open ? this.flyGroups(this.rows(h.key)) : ''}</div>`;
    }
    /** Three picks carry hatch tags no listed slot matches -- one stonefly, two eggs. Without this
        row they would sit in the pack and in the count while appearing nowhere in the list. */
    anytimeRow() {
      const groups = this.rows(null, true);
      if (!groups.length) return '';
      const open = this.s.expanded.has('anytime');
      const tags = [...new Set(groups.flatMap(g => g.flies).flatMap(r => r.p.hatches))];
      return `<div class="slot"><span class="label" style="color:var(--muted)">Anytime</span>
    <button class="chip" data-action="slot" data-slot="anytime" data-focus="slot-anytime" aria-expanded="${open}" aria-controls="flies-anytime" aria-label="Flies not tied to a hatch">
      <span class="dot"></span><span class="muted">${esc(tags.map(cap).join(', '))}</span><span class="care" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
    </button>
  </div>
  <div class="flies" id="flies-anytime"${open ? '' : ' hidden'}>${open ? this.flyGroups(groups) : ''}</div>`;
    }
    flyGroups(groups) {
      if (!groups.length) return `<div class="muted" style="padding:10px 0 14px;font-size:12px">No flies for this hatch in the ${esc(this.s.section)} section.</div>`;
      return groups.map(g => `<div>
    <div class="group">${esc(g.role.label)}</div>
    ${g.flies.map(r => this.flyRow(r)).join('')}
  </div>`).join('');
    }
    flyRow(r) {
      const { p, use, v, per, qty, sub } = r, id = p.id;
      const lamp = r.oos ? ['var(--red)', 'Out of stock'] : (v.lowStock ? ['var(--amber)', 'Low stock'] : ['var(--green)', 'In stock']);
      const only = p.sections.length === 1 ? `<span class="only">${esc(p.sections[0])} only</span>` : '';
      const meta = sub ? `<i></i>Instead of ${esc(sub.name)}, out of stock` : esc([v.color, v.size].filter(Boolean).join('  ')) + only;
      const chips = p.variants.length > 1 && !sub ? p.variants.map(x => {
        const bothVary = new Set(p.variants.map(y => y.color)).size > 1 && new Set(p.variants.map(y => y.size)).size > 1;
        const label = bothVary ? [x.color, x.size].filter(Boolean).join(' ') : (new Set(p.variants.map(y => y.color)).size > 1 ? x.color : x.size);
        return `<button class="vchip${this.unavailable(x, p) ? ' oos' : ''}" data-action="variant" data-id="${id}" data-vid="${x.id}" aria-pressed="${x.id === v.id}" data-focus="v-${x.id}"><i></i>${esc(label)}</button>`;
      }).join('') : '';
      return `<div class="fly${qty === 0 ? ' zero' : ''}">
    <div class="thumb">${v.image ? `<img src="${esc(v.image)}" alt="" loading="lazy" width="36" height="36">` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><a class="name" href="${esc(v.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" data-action="fly" data-id="${id}">${esc(use.name)}</a><span class="meta">${meta}</span></div>
    <div class="right"><span><span class="muted" style="font-size:11px">×${qty}</span> ${money(r.price)}</span><span class="stock" style="--c:${lamp[0]}"><i></i>${lamp[1]}</span></div>
  </div>
  ${this.s.customize ? `<div class="edit">
    <span class="muted" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase">In pack</span>
    <span class="step"><button data-action="qty" data-id="${id}" data-d="-1" aria-label="Fewer ${esc(use.name)}" data-focus="q-${id}-">−</button><b>${per}</b><button data-action="qty" data-id="${id}" data-d="1" aria-label="More ${esc(use.name)}" data-focus="q-${id}+">+</button></span>
    ${chips ? `<span class="muted" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding-left:4px">Option</span>${chips}` : ''}
  </div>` : ''}`;
    }
    tab_notes() {
      const d = this.data;
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
      this.root.innerHTML = `<style>${CSS}</style><div class="hm" data-theme="${this.theme()}" style="--accent:${accent};--on-accent:${onAccent}">${this.s.open ? this.expanded() : this.compact()}</div>`;
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
      if (this.s.open || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (this.root.querySelectorAll('.live>span').length < 2) return;
      this.cycler = setInterval(() => {
        const frames = this.root.querySelectorAll('.live>span');
        if (frames.length < 2) { clearInterval(this.cycler); this.cycler = null; return; }
        this.frame = (this.frame + 1) % frames.length;
        frames.forEach((el, i) => { el.classList.toggle('on', i === this.frame); el.toggleAttribute('aria-hidden', i !== this.frame); });
      }, 6000);
    }

    /* ---- interaction ---- */
    onClick(e) {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const a = el.dataset.action, s = this.s;
      switch (a) {
        case 'expand': this.set({ open: true }); this.emit('card_expanded'); this.root.querySelector('[data-action="collapse"]')?.focus(); break;
        case 'collapse': this.set({ open: false }); this.root.querySelector('[data-action="expand"]')?.focus(); break;
        case 'tab': this.set({ tab: el.dataset.tab }); if (el.dataset.tab === 'notes') this.emit('notes_expanded'); break;
        case 'slot': {
          const key = el.dataset.slot, open = new Set(s.expanded);
          open.has(key) ? open.delete(key) : open.add(key);
          this.set({ expanded: open });
          if (!s.expanded.has(key)) { const h = this.data.hatches.find(x => x.slot === key); this.emit('hatch_expanded', { slot: key, insect: h ? h.insect : null }); }
          break;
        }
        case 'customize': this.set({ customize: !s.customize, tab: 'hatch' }); if (!s.customize) this.emit('pack_customized'); break;
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
      }
    }
    onKey(e) {
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
