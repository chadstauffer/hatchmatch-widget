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
  const money = n => '$' + n.toFixed(2);
  const num = n => n.toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
.title{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
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
.compact .title{font-size:12px;letter-spacing:.08em}
.compact .lamp{font-size:10px}
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
.pack{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;height:48px;padding:0 18px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.pack span:nth-child(2){color:var(--on-accent);opacity:.8}
.ghost{display:flex;justify-content:space-between;align-items:center;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--text)}
/* expanded */
.head{display:flex;flex-direction:column;gap:6px;padding:14px 16px 10px}
.tabs{display:flex;background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:0 8px}
.tab{flex:1;height:44px;text-align:center;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--tab);box-shadow:inset 0 -2px 0 transparent}
.tab[aria-selected=true]{color:var(--text);box-shadow:inset 0 -2px 0 var(--accent)}
.panel{min-height:320px}
.now{padding:16px;display:flex;flex-direction:column;gap:16px}
.sec{display:flex;flex-direction:column;gap:8px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ticks{display:flex;gap:3px;height:12px;align-items:flex-end}.ticks i{flex:1;height:7px;background:var(--off)}.ticks i.on{height:12px;background:var(--c)}
.wx{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.wx .d{display:flex;align-items:center;gap:10px}
.wx .col{display:flex;flex-direction:column-reverse;gap:2px}.wx .col i{width:10px;height:6px;border-radius:1px;background:var(--off)}.wx .col i.on{background:var(--text)}
.note{font-size:13px;padding:10px 12px;border:1px solid var(--red);border-radius:10px}
.slots{padding:8px 16px 16px;display:flex;flex-direction:column}
.slot{display:grid;grid-template-columns:88px 1fr;gap:12px;align-items:center;min-height:64px;border-top:1px solid var(--line)}
.chip{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);justify-self:start;max-width:100%}
.chip[aria-pressed=true]{background:var(--surface2);border-color:var(--accent)}
.chip .dot{width:7px;height:7px;border-radius:50%;background:var(--off);flex:none}.chip[aria-pressed=true] .dot{background:var(--accent)}
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
.meta{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
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
.packbar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:10px 16px 14px;display:flex;flex-direction:column;gap:10px}
.steps{display:flex;align-items:center;gap:10px}
.steps .step button{width:30px}.steps .step b{min-width:12px}
.link{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;height:36px;margin-left:auto}
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
  async function fetchFlow(site) {
    const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00060&period=PT6H`);
    if (!r.ok) throw new Error(r.status);
    const ts = (await r.json()).value.timeSeries[0];
    const vals = ts.values[0].value.map(v => ({ value: +v.value, at: v.dateTime })).filter(v => v.value >= 0);
    const last = vals[vals.length - 1], first = vals[0];
    const delta = last.value - first.value;
    return { value: last.value, at: last.at, trend: Math.abs(delta) < Math.max(100, last.value * .02) ? 'Steady' : delta > 0 ? 'Rising' : 'Falling', live: true };
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
      blocks: d.precipitation_probability_max[i] <= 10 ? 1 : d.precipitation_probability_max[i] <= 30 ? 2 : d.precipitation_probability_max[i] <= 50 ? 3 : d.precipitation_probability_max[i] <= 70 ? 4 : 5,
    }));
  }

  /* ---------- instance ---------- */
  class Card {
    constructor(host, data) {
      this.host = host; this.data = data;
      this.root = host.attachShadow({ mode: 'open' });
      const demo = new URLSearchParams(location.search).get('state') || host.dataset.demoState || '';
      this.demo = demo;
      this.s = { open: false, tab: 'now', section: data.water.sections[0], anglers: 1, days: 1, qty: {}, variant: {}, customize: false, hatch: null, added: false, filled: false,
        flow: { value: data.water.flow.lastReading.value, at: data.water.flow.lastReading.at, trend: '', live: false, failed: false }, weather: null };
      this.picks = data.picks.filter(p => p.variant);
      this.byId = new Map(this.picks.map(p => [p.id, p]));
      this.events = [];
      this.root.addEventListener('click', e => this.onClick(e));
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
      else fetchFlow(w.usgsSite).then(f => { this.s.flow = f; this.render(); }).catch(() => { this.s.flow.failed = true; this.render(); });
      fetchWeather(w.lat, w.lon).then(wx => { this.s.weather = wx; this.render(); }).catch(() => {});
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
    /** Row model: substitute takes the row when the chosen variant is out of stock. */
    rows() {
      const mult = this.s.anglers * this.s.days, filter = this.s.hatch;
      const out = [];
      for (const role of this.data.roles) {
        const flies = this.picks
          .filter(p => p.role === role.key && p.sections.includes(this.s.section) && (!filter || p.hatches.includes(filter)))
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
    pack() {
      const items = this.rows().flatMap(g => g.flies).filter(r => r.qty > 0 && !r.oos);
      const flies = items.reduce((n, r) => n + r.qty, 0), total = items.reduce((n, r) => n + r.price, 0);
      return { items, flies, total, url: this.cartUrl(items) };
    }
    cartUrl(items) {
      const w = this.data.water, lines = items.map(r => `${r.v.id}:${r.qty}`).join(',');
      const u = new URL(`${this.data.storeUrl}/cart/${lines}`);
      u.searchParams.set('storefront', 'true');
      u.searchParams.set('utm_source', 'hatchmatch'); u.searchParams.set('utm_medium', 'widget'); u.searchParams.set('utm_campaign', w.id);
      u.searchParams.set('attributes[hatchmatch_report]', `${w.id}-${this.data.report.publishedAt}`);
      u.searchParams.set('attributes[hatchmatch_water]', w.id);
      u.searchParams.set('attributes[hatchmatch_section]', this.s.section);
      return u.toString();
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
    packButton() {
      const k = this.pack();
      if (this.s.added) return `<button class="pack" data-action="viewcart"><span>Added</span><span></span><span>View cart</span></button>`;
      return `<button class="pack" data-action="addpack" ${k.flies ? '' : 'disabled'}><span>Add the pack</span><span>${k.flies} ${k.flies === 1 ? 'fly' : 'flies'}</span><span>${money(k.total)}</span></button>`;
    }
    compact() {
      const d = this.data, fr = this.fresh(), r = this.rating(), w = this.wading(), hn = this.hatchNow(), f = this.s.flow;
      const closed = d.water.closed;
      return `<div class="card compact">
  <button class="expand" data-action="expand" aria-expanded="false" aria-label="Expand the ${esc(d.water.name)} report">
    <div class="between"><div class="title">${esc(d.water.name)}</div><div class="row" style="gap:8px;flex:none"><span class="lamp muted" style="--c:${fr.color}"><i></i>${fr.label}</span><span class="chev" aria-hidden="true">▼</span></div></div>
    ${closed ? `<div class="lamp" style="--c:var(--red);font-size:13px;font-weight:600"><i></i>Closed</div><div>${esc(d.water.closedNote || '')}</div>` : `
    <div class="row"><span class="label">Fishing</span><span class="caps" style="font-weight:600;letter-spacing:.12em">${esc(r.label)}</span>${this.meter(r.n, true)}<span class="muted" style="font-size:11px">${r.n} of 5</span></div>
    <div class="sec">
      <div class="flowrow"><div class="row" style="gap:5px;align-items:baseline"><span class="big" style="color:${f.failed ? 'var(--muted)' : 'var(--text)'}">${num(f.value)}</span><span class="unit">CFS</span></div>${this.flowBar(false)}</div>
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
      const d = this.data, fr = this.fresh(), r = this.rating(), tab = this.s.tab;
      const tabs = ['now', 'hatch', 'rig', 'notes'];
      return `<div class="card">
  <div class="head">
    <div class="between"><div class="title">${esc(d.water.name)}</div><button class="chev" data-action="collapse" aria-label="Collapse">▲</button></div>
    <div class="between" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)">
      <span class="lamp" style="--c:${fr.color};font-size:10px"><i></i>${fr.label}</span>
      <span class="row" style="gap:8px"><span>Fishing</span><span style="font-size:11px;font-weight:600;color:var(--text)">${esc(r.label)}</span>${this.meter(r.n)}</span>
    </div>
  </div>
  <div class="tabs" role="tablist" aria-label="Report">
    ${tabs.map(k => `<button class="tab" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel-${k}" tabindex="${tab === k ? 0 : -1}" data-action="tab" data-tab="${k}" data-focus="tab-${k}">${k}</button>`).join('')}
  </div>
  <div class="panel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}">${this['tab_' + tab]()}</div>
  <div class="packbar">
    <div class="steps">
      ${this.stepper('Anglers', 'anglers', this.s.anglers)}${this.stepper('Days', 'days', this.s.days)}
      <button class="link" data-action="customize" style="color:${this.s.customize ? 'var(--accent)' : 'var(--text)'}" data-focus="customize">${this.s.customize ? 'Done' : 'Edit pack'}</button>
    </div>
    ${tab === 'rig' ? `<div class="muted" style="font-size:11px">${this.mathLine()}</div>` : ''}
    ${this.packButton()}
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
    <div class="wx">${(wx || [{ day: 'Day 1', label: 'clouds', blocks: 2 }, { day: 'Day 2', label: 'sprinkles', blocks: 3 }, { day: 'Day 3', label: 'sprinkles', blocks: 3 }]).map(x => `
      <div class="d"><div class="col" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i class="${i < x.blocks ? 'on' : ''}"></i>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:2px"><span class="label" style="letter-spacing:.12em">${esc(x.day)}</span>${x.hi != null ? `<span style="font-weight:600;white-space:nowrap">${x.hi}° ${x.lo}°</span>` : ''}<span class="muted" style="font-size:10px;white-space:nowrap">${x.pct != null ? x.pct + '% ' : ''}${esc(x.label)}</span></div></div>`).join('')}</div>
  </div>
  <div class="sec rule" style="padding-top:14px">
    <div class="between"><span class="label">Report age</span><span class="lamp" style="--c:${fr.color}"><i></i>${fr.label}</span></div>
    ${this.ticks(28, Math.min(27, Math.round(fr.days / 14 * 27)), fr.color)}
    <div class="between" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)"><span>${fr.days === 0 ? 'Today' : fr.days + (fr.days === 1 ? ' day ago' : ' days ago')}</span><span>7 days</span><span>14 days</span></div>
    ${fr.stale ? `<div class="note">Conditions may have changed since this report. Flow and weather are live.</div>` : ''}
    <div class="row muted" style="gap:8px;padding-top:10px"><span class="avatar"></span>Report by ${esc(d.report.author || 'The Fly Shop')}</div>
  </div>
  <a class="ghost" href="tel:${d.water.guidePhone.replace(/\D/g, '')}" data-action="guide"><span class="caps" style="font-weight:600">Fish it with a guide</span><span class="muted">${d.water.guidePhone}</span></a>
</div>`;
    }
    tab_hatch() {
      const now = this.slotNow();
      return `<div class="slots">
  <div class="between" style="padding:8px 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)"><span>Time of day</span><span>Hatch, size, the guide's word</span></div>
  ${this.data.hatches.map((h, i) => `<div class="slot">
    <div style="display:flex;flex-direction:column;gap:2px"><span class="label" style="color:${i === now ? 'var(--text)' : 'var(--muted)'}">${cap(SLOTS[i])}</span>${i === now ? `<span class="lamp" style="--c:var(--green);color:var(--green);font-size:10px"><i style="width:6px;height:6px"></i>Now</span>` : ''}</div>
    ${h.none ? `<div class="muted" style="font-size:12px">${esc(h.fallback)}</div>`
      : `<button class="chip" data-action="hatch" data-key="${h.key}" aria-pressed="${this.s.hatch === h.key}" aria-label="Show flies for ${esc(h.insect)}"><span class="dot"></span><span style="font-weight:600">${esc(h.insect)}</span><span class="muted">${esc(h.size)}</span>${this.meter(h.intensity)}<span class="accent" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding-left:4px">Flies</span></button>`}
  </div>`).join('')}
  <div class="muted" style="padding-top:12px;font-size:12px">Intensity is the guide's word for each hatch this week. Tap a hatch to see the flies that match it in the rig.</div>
</div>`;
    }
    tab_rig() {
      const d = this.data, groups = this.rows(), filter = d.hatches.find(h => h.key === this.s.hatch);
      return `<div class="rig">
  <div class="row" style="gap:8px;padding-bottom:8px"><span class="muted" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase">Section</span>
    ${d.water.sections.map(s => `<button class="pill" data-action="section" data-key="${esc(s)}" aria-pressed="${this.s.section === s}" data-focus="section-${esc(s)}"><i></i>${esc(s)}</button>`).join('')}</div>
  ${filter ? `<div class="filter"><span class="label" style="letter-spacing:.12em">Flies for</span><span class="lamp" style="--c:var(--accent);font-weight:600"><i></i>${esc(filter.insect)}</span><button class="link accent" data-action="showall">Show all</button></div>` : ''}
  <div class="muted" style="font-size:12px;padding:6px 0 2px">Quantities are per angler per day. ${this.s.customize ? 'Set counts and sizes below.' : ''}</div>
  ${groups.map(g => `<div>
    <div class="group">${esc(g.role.label)}</div>
    ${g.flies.map(r => this.flyRow(r)).join('')}
  </div>`).join('')}
  ${groups.length ? '' : `<div class="muted" style="padding:16px 0">No flies in this section for that hatch.</div>`}
</div>`;
    }
    flyRow(r) {
      const { p, use, v, per, qty, sub } = r, id = p.id;
      const lamp = r.oos ? ['var(--red)', 'Out of stock'] : (v.lowStock ? ['var(--amber)', 'Low stock'] : ['var(--green)', 'In stock']);
      const meta = sub ? `<i></i>Instead of ${esc(sub.name)}, out of stock` : esc([v.color, v.size].filter(Boolean).join('  '));
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
      this.root.innerHTML = `<style>${CSS}</style><div class="hm" data-theme="${this.theme()}" style="--accent:${accent};--on-accent:${onAccent}">${this.s.open ? this.expanded() : this.compact()}</div>`;
      if (focusKey) this.root.querySelector(`[data-focus="${focusKey}"]`)?.focus();
    }

    /* ---- interaction ---- */
    onClick(e) {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const a = el.dataset.action, s = this.s;
      switch (a) {
        case 'expand': this.set({ open: true }); this.emit('card_expanded'); this.root.querySelector('[data-action="collapse"]')?.focus(); break;
        case 'collapse': this.set({ open: false }); this.root.querySelector('[data-action="expand"]')?.focus(); break;
        case 'tab': this.set({ tab: el.dataset.tab }); if (el.dataset.tab === 'notes') this.emit('notes_expanded'); break;
        case 'section': this.set({ section: el.dataset.key, added: false }); this.emit('section_switched', { section: el.dataset.key }); break;
        case 'hatch': this.set({ hatch: s.hatch === el.dataset.key ? null : el.dataset.key, tab: 'rig', added: false }); this.emit('hatch_filtered', { hatch: el.dataset.key }); break;
        case 'showall': this.set({ hatch: null, added: false }); break;
        case 'customize': this.set({ customize: !s.customize, tab: 'rig' }); if (!s.customize) this.emit('pack_customized'); break;
        case 'step': { const k = el.dataset.key, d = +el.dataset.d, max = k === 'anglers' ? 6 : 7; this.set({ [k]: Math.min(max, Math.max(1, s[k] + d)), added: false }); break; }
        case 'qty': { const id = el.dataset.id, p = this.byId.get(id), cur = s.qty[id] != null ? s.qty[id] : p.qty; this.set({ qty: { ...s.qty, [id]: Math.max(0, cur + +el.dataset.d) }, added: false }); break; }
        case 'variant': this.set({ variant: { ...s.variant, [el.dataset.id]: +el.dataset.vid }, added: false }); this.emit('size_changed', { pick: el.dataset.id, variant: +el.dataset.vid }); break;
        case 'addpack': { const k = this.pack(); this.emit('pack_added', { flies: k.flies, total: +k.total.toFixed(2), section: s.section, items: k.items.map(r => ({ variant: r.v.id, sku: r.v.sku, qty: r.qty })) }); window.open(k.url, '_blank', 'noopener'); this.set({ added: true }); break; }
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
