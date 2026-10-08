// Kit: ui. UI components, clock, calendar, hazard sign, abstract icons and the line-icon set.
// Spec: STYLE.md §4 (recurring treatments) and §6 items 20, 21, 35, 39, 40. Contract: build/AGENT_BRIEF.md.
//
// Conventions shared by every factory in this file:
// - Kit.Name(parent, options) returns {g, update(params), ...}. Every node is made in the factory.
// - update() never sets a transform or opacity on `g`. Scenes position, scale and fade `g` with
//   Engine.place; components animate inner groups only.
// - All times are scene times in seconds. `tIn` is when the component starts entering; omit it and
//   the component is already fully on screen. `tOut` is when it has finished exiting; omit it and it
//   stays. Per-item times (ticks, rows, nodes) are arrays; a null/undefined entry means "never".
// - Calling update() with the same params always gives the same picture (no hidden state).
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C, ease, text, measure, show } = Kit;
  const SW = Kit.STROKE;
  const INF = Infinity;
  const T = (v, d = -INF) => (v == null ? d : v); // optional start time: missing = long ago
  const N = v => (v == null ? INF : v); // optional event time: missing = never
  const prog = (t, t0, d, fn = ease.enter) => fn(clamp((t - t0) / d));
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const bump = (t, t0, d = 0.35, amt = 0.15) => 1 + amt * Math.sin(Math.PI * clamp((t - t0) / d));
  const fmod = (a, b) => ((a % b) + b) % b;
  const f2 = v => Math.round(v * 100) / 100;
  let uid = 0;
  const nextId = p => `ui-${p}-${++uid}`;

  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  // Linear blend of two #rrggbb colours (for fill tweens).
  function mix(a, b, p) {
    if (p <= 0) return a;
    if (p >= 1) return b;
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
  }
  // Rounded rectangle as a path (x, y top-left).
  const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  // Pie wedge from a0 to a1 degrees, clockwise from 12 o'clock.
  function wedge(r, a0, a1) {
    if (a1 - a0 >= 359.99) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
    if (a1 - a0 <= 0.05) return 'M0 0';
    const p = a => `${f2(r * Math.sin(a * Math.PI / 180))} ${f2(-r * Math.cos(a * Math.PI / 180))}`;
    return `M0 0L${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}Z`;
  }
  // Split str (honouring \n) into lines no wider than maxW at the given font.
  function wrap(str, size, weight, maxW = INF) {
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure(next, size, weight) > maxW) { out.push(line); line = word; } else line = next;
      }
      out.push(line);
    }
    return out;
  }
  const widest = (rows, size, weight) => Math.max(0, ...rows.map(s => measure(s, size, weight)));
  // A path that draws on: set its 'stroke-dashoffset' to 1 - p.
  const drawPath = (parent, d, attrs = {}) => el('path', { d, fill: 'none', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }, parent);
  const drawTo = (node, p) => { show(node, p > 0.001); set(node, { 'stroke-dashoffset': 1 - clamp(p) }); };
  // Standard small-icon pop (ease-out-back 0.25 s) and exit fade; returns opacity.
  function popIn(node, t, tIn, tOut, { dur = 0.3, from = 0 } = {}) {
    const s = lerp(from, 1, prog(t, T(tIn), dur, ease.pop));
    const o = lin(t, T(tIn), 0.12) * (1 - prog(t, N(tOut) - 0.3, 0.3, ease.exit));
    place(node, { s: Math.max(0.001, s), o });
    show(node, o > 0.001);
    return o;
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Icon(parent, {name, size = 48, color = C.ink, stroke})
  //   Line icon (round caps, no fill) for ProgressTimeline nodes, Tiles and badges.
  //   name: truck | magnifier | pen | sort | boxin | document | folder | clock | broom | shield |
  //         box | hand | rack | tag | hazard | check | cross   (Kit.Icon.names lists them)
  //   stroke: rendered stroke width in px (default scales with size, 2.2 to 4 px).
  // update({color, o}): recolour (e.g. steel idle, ink active, paper done) and opacity.
  // Origin: centre. Footprint: size × size.
  // ---------------------------------------------------------------------------------------------
  const P = (g, d, a = {}) => el('path', { d, ...a }, g);
  const DOT = (g, cx, cy, r) => el('circle', { cx, cy, r, fill: 'currentColor', stroke: 'none' }, g);
  const ICONS = {
    truck: (g, w) => {
      P(g, 'M-22 8V-13H3V8'); P(g, 'M3 -5H13L21 3V8'); P(g, 'M-22 8H-19M-7 8H7M19 8H21'); P(g, 'M8 -1H12L15 3H8Z', { 'stroke-width': w * 0.7 });
      el('circle', { cx: -13, cy: 11, r: 5 }, g); el('circle', { cx: 13, cy: 11, r: 5 }, g);
    },
    magnifier: (g, w) => { el('circle', { cx: -5, cy: -5, r: 12 }, g); P(g, 'M4 4L17 17', { 'stroke-width': w * 1.6 }); },
    pen: g => { P(g, 'M-2 3L13 -12L18 -7L3 8Z'); P(g, 'M-2 3L-6 12L3 8'); P(g, 'M-22 19Q-19 12 -15 18T-8 18T-1 18H20'); },
    sort: g => { P(g, 'M-9 17V-15M-16 -8L-9 -15L-2 -8'); P(g, 'M9 -17V15M2 8L9 15L16 8'); },
    boxin: g => { P(g, 'M-18 -2H18V20H-18Z'); P(g, 'M-18 -2L-23 -9M18 -2L23 -9'); P(g, 'M0 -22V8M-7 1L0 8L7 1'); },
    document: g => { P(g, 'M-14 -21H6L15 -12V21H-14Z'); P(g, 'M6 -21V-12H15'); P(g, 'M-8 -3H9M-8 5H9M-8 13H3'); },
    folder: g => { P(g, 'M-21 -16H-7L-2 -11H21V17H-21Z'); P(g, 'M-21 -4H21'); },
    clock: g => { el('circle', { r: 19 }, g); P(g, 'M0 -11V0L8 6'); },
    broom: g => { const r = el('g', { transform: 'rotate(35) translate(0 2)' }, g); P(r, 'M0 -25V-2'); P(r, 'M-5 -2H5V3H-5Z'); P(r, 'M-6 3H6L12 21H-12Z'); P(r, 'M-3 9L-5 21M3 9L5 21'); },
    shield: g => { P(g, 'M0 -21L17 -15V-2C17 10 9 17 0 21C-9 17 -17 10 -17 -2V-15Z'); P(g, 'M-7 0L-2 6L8 -6'); },
    box: g => { P(g, 'M0 -20L19 -11V11L0 20L-19 11V-11Z'); P(g, 'M-19 -11L0 -2L19 -11M0 -2V20'); P(g, 'M-9.5 -15.5L9.5 -6.5'); },
    hand: g => { P(g, 'M-9 3V-14A3 3 0 0 1 -3 -14V-1V-18A3 3 0 0 1 3 -18V-1V-16A3 3 0 0 1 9 -16V0V-10A3 3 0 0 1 15 -10V6C15 16 9 21 1 21H-2C-8 21 -11 18 -14 13L-20 3A3 3 0 0 1 -15 -1L-9 3Z'); },
    rack: g => { P(g, 'M-18 -21V21M18 -21V21M-18 -7H18M-18 7H18M-23 21H23'); P(g, 'M-13 -7V-15H-3V-7M3 7V-1H13V7M-12 21V13H0V21'); },
    tag: g => { P(g, 'M-20 -11H5L18 0L5 11H-20Z'); el('circle', { cx: 6, cy: 0, r: 3 }, g); P(g, 'M-14 -3H-4M-14 4H-8'); },
    hazard: g => { P(g, 'M0 -20L21 17H-21Z'); P(g, 'M0 -6V5'); DOT(g, 0, 11, 2.4); },
    check: g => { P(g, 'M-15 1L-5 11L16 -11'); },
    cross: g => { P(g, 'M-13 -13L13 13M13 -13L-13 13'); },
  };
  function Icon(parent, { name = 'box', size = 48, color = C.ink, stroke } = {}) {
    const g = el('g', {}, parent);
    const px = stroke || clamp(size * 0.07, 2.2, 4);
    const w = px * 48 / size;
    const body = el('g', { transform: `scale(${f2(size / 48)})`, fill: 'none', stroke: 'currentColor', color, 'stroke-width': f2(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    (ICONS[name] || ICONS.box)(body, w);
    return {
      g, size,
      update({ color: c, o } = {}) { if (c) set(body, { color: c }); if (o != null) set(body, { opacity: clamp(o) }); },
    };
  }
  Icon.names = Object.keys(ICONS);

  // ---------------------------------------------------------------------------------------------
  // Kit.GreenCheck(parent, {size = 32}) and Kit.RedX(parent, {size = 32})
  //   Filled circle (correct / error) with a paper check or X and a 2.5 px ink outline.
  //   STYLE sizes: 32 (row badge) and 56 (column header); any size works.
  // update({t, tIn, tOut}): pops in (ease-out-back 0.25 s) and the mark draws on (0.25 s).
  // Origin: centre.
  // ---------------------------------------------------------------------------------------------
  function Mark(parent, kind, { size = 32 } = {}) {
    const g = el('g', {}, parent), pop = el('g', {}, g), r = size / 2, k = r / 16;
    el('circle', { r: r - SW / 2, fill: kind === 'check' ? C.correct : C.error, stroke: C.ink, 'stroke-width': SW }, pop);
    const d = kind === 'check'
      ? `M${-6.5 * k} ${0.5 * k}L${-2 * k} ${5 * k}L${7 * k} ${-5 * k}`
      : `M${-5 * k} ${-5 * k}L${5 * k} ${5 * k}M${5 * k} ${-5 * k}L${-5 * k} ${5 * k}`;
    const mark = drawPath(pop, d, { stroke: C.paper, 'stroke-width': Math.max(3, size * 0.1) });
    return {
      g, size,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(pop, t, tIn, tOut, { dur: 0.25 });
        drawTo(mark, prog(t, T(tIn) + 0.08, 0.25));
      },
    };
  }
  const GreenCheck = (parent, o) => Mark(parent, 'check', o);
  const RedX = (parent, o) => Mark(parent, 'x', o);

  // ---------------------------------------------------------------------------------------------
  // Kit.Badge(parent, {text, variant = 'ink', icon, height = 40, size = 24})
  //   40 px pill (STYLE §4): ink fill, paper text by default. Text 24 px 600.
  //   variant: ink | paper | accent | neutral | correct | error | safety
  //   icon: 'check' | 'x' | 'none'. Default: check for correct, x for error (red is never the only
  //   signal), none otherwise.
  // update({t, tIn, tOut, text, variant, icon, bump}): pops in; text/variant can change per frame;
  //   bump = time of a 1.15 scale bounce (e.g. a value change).
  // Fields: width (current pill width). Origin: centre.
  // ---------------------------------------------------------------------------------------------
  const BADGE = {
    ink: [C.ink, C.paper, 'none'], paper: [C.paper, C.ink, C.ink], accent: [C.accent, C.ink, C.ink],
    neutral: [C.neutral, C.paper, C.ink], correct: [C.correct, C.paper, C.ink], error: [C.error, C.paper, C.ink],
    safety: [C.safety, C.ink, C.ink],
  };
  function Badge(parent, { text: str = '', variant = 'ink', icon, height = 40, size = 24 } = {}) {
    const g = el('g', {}, parent), pop = el('g', {}, g), body = el('g', {}, pop);
    const pill = el('rect', { y: -height / 2, height, rx: height / 2, 'stroke-width': SW }, body);
    const glyph = el('g', { fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, body);
    const chk = el('path', { d: 'M-6 0.5L-2 4.5L6 -4.5' }, glyph);
    const crs = el('path', { d: 'M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5' }, glyph);
    const label = text(body, str, { size, weight: 600, anchor: 'middle', y: f2(size * 0.36) });
    const api = { g, width: height };
    api.update = ({ t = 0, tIn, tOut, text: s = str, variant: v = variant, icon: ic = icon, bump: tb } = {}) => {
      const [fill, ink, stroke] = BADGE[v] || BADGE.ink;
      const which = ic || (v === 'correct' ? 'check' : v === 'error' ? 'x' : 'none');
      const iw = which === 'none' ? 0 : 22;
      const w = Math.max(height, measure(String(s), size, 600) + iw + 32);
      api.width = w;
      set(pill, { x: f2(-w / 2), width: f2(w), fill, stroke });
      set(label, { x: f2(iw / 2), fill: ink, text: s });
      set(glyph, { stroke: ink, transform: `translate(${f2(-w / 2 + 16 + 8)} 0)` });
      show(glyph, iw > 0); show(chk, which === 'check'); show(crs, which === 'x');
      popIn(pop, t, tIn, tOut, { dur: 0.25 });
      place(body, { s: bump(t, N(tb), 0.25) });
    };
    api.update({});
    return api;
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Counter(parent, {from = 0, format = v => String(v), variant = 'ink', height = 40, size = 24})
  //   A Badge whose number ticks up by one at each tick time (e.g. cartons counted 1 to 5).
  // update({t, tIn, tOut, ticks: [t1, t2, ...], value, variant}): value = from + ticks passed
  //   (or `value` if given); each tick bounces the badge. variant may change (e.g. to 'error').
  // Origin: centre.
  // ---------------------------------------------------------------------------------------------
  function Counter(parent, { from = 0, format = v => String(v), variant = 'ink', height = 40, size = 24 } = {}) {
    const b = Badge(parent, { text: format(from), variant, height, size });
    return {
      g: b.g,
      update({ t = 0, tIn, tOut, ticks = [], value, variant: v = variant } = {}) {
        const passed = ticks.filter(x => x != null && x <= t);
        const val = value != null ? value : from + passed.length;
        b.update({ t, tIn, tOut, text: format(val), variant: v, bump: passed.length ? Math.max(...passed) : null });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Stamp(parent, {text = 'NO EXCEPTION', size = 72, color = C.error, angle = -8})
  //   Rubber stamp: 72 px 800 text, 4 px border, paper backing, rotated -8 degrees.
  // update({t, tIn, tOut}): slams in (scale 1.4 to 1 in 0.3 s) with a 2-frame white flash on impact.
  // Origin: centre.
  // ---------------------------------------------------------------------------------------------
  function Stamp(parent, { text: str = 'NO EXCEPTION', size = 72, color = C.error, angle = -8 } = {}) {
    const g = el('g', {}, parent), pop = el('g', {}, g), body = el('g', { transform: `rotate(${angle})` }, pop);
    const w = measure(str, size, 800) + 56, h = size + 36;
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, fill: C.paper, 'fill-opacity': 0.94, stroke: color, 'stroke-width': 4 }, body);
    el('rect', { x: -w / 2 + 8, y: -h / 2 + 8, width: w - 16, height: h - 16, rx: 6, fill: 'none', stroke: color, 'stroke-width': 1.5 }, body);
    text(body, str, { size, weight: 800, fill: color, anchor: 'middle', y: f2(size * 0.36) });
    const flash = el('rect', { x: -w / 2 - 12, y: -h / 2 - 12, width: w + 24, height: h + 24, rx: 16, fill: C.paper }, body);
    return {
      g, width: w, height: h,
      update({ t = 0, tIn, tOut } = {}) {
        const t0 = T(tIn);
        const s = lerp(1.4, 1, Engine.ease.in(lin(t, t0, 0.3)));
        const o = lin(t, t0, 0.08) * (1 - prog(t, N(tOut) - 0.3, 0.3, ease.exit));
        place(pop, { s, o }); show(pop, o > 0.001);
        const f = Math.floor((t - t0 - 0.3) * 30 + 1e-6);
        set(flash, { opacity: f === 0 ? 0.85 : f === 1 ? 0.4 : 0 });
        show(flash, f === 0 || f === 1);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Callout(parent, {text, pointer = 'down', at = 0.5, variant = 'accent', maxWidth = 560, size = 30})
  //   Rounded box (12 px radius, 2.5 px ink outline) with a 16 px pointer toward its subject.
  //   Text 30 px 600, max two lines ('\n' or auto-wrap at maxWidth).
  //   pointer: down | up | left | right | none. at: pointer position along that side, 0..1.
  //   variant: accent (accent fill, ink text) | info (neutral fill, paper text) | paper.
  // update({t, tIn, tOut, idle = true}): pops in (scale 0.9 to 1 about the tip, fade, 0.25 s);
//   exits with a fade (0.3 s); idle adds a 1 px bob (3 s period).
  // Fields: w, h (box size). Origin: the pointer tip (box centre when pointer = 'none').
  // ---------------------------------------------------------------------------------------------
  function Callout(parent, { text: str = '', pointer = 'down', at = 0.5, variant = 'accent', maxWidth = 560, size = 30 } = {}) {
    const [fill, ink] = { accent: [C.accent, C.ink], info: [C.neutral, C.paper], paper: [C.paper, C.ink] }[variant] || [C.accent, C.ink];
    const lh = Math.round(size * 1.27), padX = 24, padY = 14;
    const rows = wrap(str, size, 600, maxWidth - padX * 2);
    const w = Math.ceil(widest(rows, size, 600)) + padX * 2, h = padY * 2 + rows.length * lh;
    const r = 12, ph = 16, pw = 14;
    const px = clamp(w * at, r + pw, w - r - pw), py = clamp(h * at, r + pw, h - r - pw);
    let d = `M${r} 0`;
    if (pointer === 'up') d += `H${px - pw}L${px} ${-ph}L${px + pw} 0`;
    d += `H${w - r}A${r} ${r} 0 0 1 ${w} ${r}`;
    if (pointer === 'right') d += `V${py - pw}L${w + ph} ${py}L${w} ${py + pw}`;
    d += `V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}`;
    if (pointer === 'down') d += `H${px + pw}L${px} ${h + ph}L${px - pw} ${h}`;
    d += `H${r}A${r} ${r} 0 0 1 0 ${h - r}`;
    if (pointer === 'left') d += `V${py + pw}L${-ph} ${py}L0 ${py - pw}`;
    d += `V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    const tip = { up: [px, -ph], right: [w + ph, py], down: [px, h + ph], left: [-ph, py] }[pointer] || [w / 2, h / 2];
    const g = el('g', {}, parent), pop = el('g', {}, g);
    const box = el('g', { transform: `translate(${f2(-tip[0])} ${f2(-tip[1])})` }, pop);
    el('path', { d, fill, stroke: C.ink, 'stroke-width': SW, 'stroke-linejoin': 'round' }, box);
    rows.forEach((s, i) => text(box, s, { x: w / 2, y: f2(padY + lh * i + lh / 2 + size * 0.36), size, weight: 600, fill: ink, anchor: 'middle' }));
    return {
      g, w, h,
      update({ t = 0, tIn, tOut, idle = true } = {}) {
        const t0 = T(tIn);
        const pin = prog(t, t0, 0.25), pout = prog(t, N(tOut) - 0.3, 0.3, ease.exit);
        const o = pin * (1 - pout);
        const bob = idle ? Math.sin(t * Math.PI * 2 / 3) * 1 : 0;
        place(pop, { y: bob, s: lerp(0.9, 1, pin) * lerp(1, 0.95, pout), o }); show(pop, o > 0.001);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Heading(parent, {text, size = 48, weight = 700, color = C.ink, x = 80, y = 150, anchor = 'start',
  //                      maxWidth = 1760, sub, subColor = C.inkSoft})
  //   Scene caption / heading (STYLE §4): 48 px 700 at top-left, baseline y = 150 by default.
  //   Wraps at maxWidth; `sub` adds a 34 px 500 second line. On bg-dark pass color: C.paper.
  // update({t, tIn, tOut}): fades in with a 12 px rise (0.4 s); exits with fade + 12 px up.
  // Origin: the stage. The text sits at (x, y) baseline, so leave `g` untransformed for STYLE placement.
  // ---------------------------------------------------------------------------------------------
  function Heading(parent, { text: str = '', size = 48, weight = 700, color = C.ink, x = 80, y = 150, anchor = 'start', maxWidth = 1760, sub, subColor = C.inkSoft } = {}) {
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const rows = wrap(str, size, weight, maxWidth), lh = Math.round(size * 1.12);
    rows.forEach((s, i) => text(inner, s, { x, y: y + i * lh, size, weight, fill: color, anchor }));
    if (sub) text(inner, sub, { x, y: y + (rows.length - 1) * lh + 52, size: 34, weight: 500, fill: subColor, anchor });
    return {
      g, lines: rows.length,
      update({ t = 0, tIn, tOut } = {}) {
        const p = Kit.presence(t, T(tIn), N(tOut), { rise: 12, fall: 12 });
        place(inner, { y: p.dy, o: p.o }); show(inner, p.o > 0.001);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.LowerThird(parent, {text | texts: [...], x = 80, y = 900, height = 80})
  //   Paper chip, 6 px accent left bar, 16 px padding, 8 px radius, 34 px 600 text, in the band
//   y = 900..980.
  //   Pass every section name the scene will show as `texts`; only one is on screen at a time.
  // update({t, tIn, times: [t0, t1, ...], tOut}): texts[0] slides in from -40 px with a fade (0.4 s)
  //   at times[0] (or tIn); each later text replaces the previous at its time with a 0.3 s
  //   crossfade (old text out, then new text in) while the chip eases to the new width. At tOut the chip slides out left and fades.
  // Origin: the stage (chip top-left at x, y), so leave `g` untransformed for STYLE placement.
  // ---------------------------------------------------------------------------------------------
  function LowerThird(parent, { text: one = '', texts, x = 80, y = 900, height = 80 } = {}) {
    const list = texts || [one];
    const g = el('g', {}, parent), cg = el('g', { transform: `translate(${x} ${y})` }, g), inner = el('g', {}, cg);
    const id = nextId('lt');
    const clipRect = el('rect', { height }, el('clipPath', { id }, el('defs', {}, cg)));
    const bar = el('path', { fill: C.accent }, inner), body = el('path', { fill: C.paper }, inner);
    const edge = el('path', { fill: 'none', stroke: C.steel, 'stroke-width': 1 }, inner);
    const clip = el('g', { 'clip-path': `url(#${id})` }, inner);
    const widths = list.map(s => Math.ceil(measure(s, 34, 600)) + 6 + 16 * 2);
    const labels = list.map(s => text(clip, s, { x: 22, y: f2(height / 2 + 12.4), size: 34, weight: 600, fill: C.ink }));
    return {
      g, widths,
      update({ t = 0, tIn, times, tOut } = {}) {
        const ts = times || [T(tIn)];
        const starts = list.map((_, i) => (i === 0 ? T(ts[0]) : N(ts[i])));
        let cur = -1;
        starts.forEach((s0, i) => { if (t >= s0) cur = i; });
        const pin = prog(t, starts[0], 0.4), po = prog(t, N(tOut) - 0.3, 0.3, ease.exit);
        const o = cur < 0 ? 0 : pin * (1 - po);
        place(inner, { x: -40 * (1 - pin) - 40 * po, o }); show(cg, o > 0.001);
        if (cur < 0) return;
        // A replacement crossfades the text (0.3 s) while the chip eases to the new width.
        const pc = cur > 0 ? lin(t, starts[cur], 0.3) : 1;
        const w = cur > 0 ? lerp(widths[cur - 1], widths[cur], ease.enter(pc)) : widths[0];
        set(bar, { d: rr(0, 0, w, height, 8) });
        set(body, { d: `M6 0H${f2(w - 8)}A8 8 0 0 1 ${f2(w)} 8V${height - 8}A8 8 0 0 1 ${f2(w - 8)} ${height}H6Z` });
        set(edge, { d: rr(0, 0, w, height, 8) });
        set(clipRect, { width: f2(w) });
        labels.forEach((l, i) => {
          // Out then in (0.15 s each) so two names are never legible on top of each other.
          const lo = cur === 0 ? (i === 0 ? 1 : 0) : i === cur ? lin(t, starts[cur] + 0.15, 0.15) : i === cur - 1 ? 1 - lin(t, starts[cur], 0.15) : 0;
          set(l, { opacity: f2(lo) }); show(l, lo > 0.001);
        });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.HazardStripe(parent, {width = 1920, height = 24, stripe = 24})
  //   Band of 45-degree safety / ink stripes (title card edge, hazmat bay floor).
  // update({t, speed = 0}): stripes slide sideways at `speed` px/s (idle life); 0 = still.
  // Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function HazardStripe(parent, { width = 1920, height = 24, stripe = 24 } = {}) {
    const g = el('g', {}, parent), id = nextId('stripe');
    const cp = el('clipPath', { id }, el('defs', {}, g));
    el('rect', { width, height }, cp);
    const clip = el('g', { 'clip-path': `url(#${id})` }, g);
    el('rect', { width, height, fill: C.safety }, clip);
    const band = el('g', {}, clip), period = stripe * 2;
    let d = '';
    for (let x = -period - height; x < width + period; x += period) d += `M${x} ${height}L${x + height} 0H${x + height + stripe}L${x + stripe} ${height}Z`;
    el('path', { d, fill: C.ink }, band);
    return {
      g,
      update({ t = 0, speed = 0 } = {}) { place(band, { x: fmod(t * speed, period) }); },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.SectionTitleCard(parent, {part, title, sub, hazard = false})
  //   Full-frame bg-dark card with a subtle vignette (STYLE §4): part number (36 px 600, accent,
  //   tracked caps) at y = 360, title (88 px 800, paper, up to 2 lines via '\n') at y = 430,
  //   sub-line (40 px 400) at y = 560, all centred. hazard: true adds the Part VI 24 px hazard
  //   stripe along the bottom edge.
  // update({t, tIn, tWipe}): part, title and sub rise in (12 px) from tIn; the 160 px accent rule
  //   draws left to right over 0.5 s; the text block breathes by 1 px (idle). At tWipe the card
  //   translates to y = -1080 (ease-in-out, 0.6 s), revealing the scene beneath, then hides.
//   tOut is accepted as an alias for tWipe. Omit both and the card stays.
  // Origin: top-left of the frame (0, 0). Size 1920 × 1080.
  // ---------------------------------------------------------------------------------------------
  function SectionTitleCard(parent, { part = '', title = '', sub = '', hazard = false } = {}) {
    const g = el('g', {}, parent), card = el('g', {}, g);
    el('rect', { width: 1920, height: 1080, fill: C.bgDark }, card);
    const vid = nextId('vignette');
    const grad = el('radialGradient', { id: vid, cx: 0.5, cy: 0.5, r: 0.75 }, el('defs', {}, card));
    el('stop', { offset: 0.5, 'stop-color': '#000', 'stop-opacity': 0 }, grad);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.22 }, grad);
    el('rect', { width: 1920, height: 1080, fill: `url(#${vid})` }, card);
    const content = el('g', {}, card);
    const rows = wrap(title, 88, 800, 1700), shift = (rows.length - 1) * 46;
    const partG = el('g', {}, content), titleG = el('g', {}, content), subG = el('g', {}, content);
    text(partG, part, { x: 963, y: 387 - shift, size: 36, weight: 600, fill: C.accent, anchor: 'middle', spacing: 0.18, upper: true });
    rows.forEach((s, i) => text(titleG, s, { x: 960, y: 497 - shift + i * 92, size: 88, weight: 800, fill: C.paper, anchor: 'middle' }));
    const ruleY = 497 - shift + (rows.length - 1) * 92 + 30;
    const rule = el('rect', { x: 880, y: ruleY - 2, width: 160, height: 4, rx: 2, fill: C.accent }, content);
    text(subG, sub, { x: 960, y: ruleY + 64, size: 40, weight: 400, fill: C.onDarkSoft, anchor: 'middle' });
    const stripe = hazard ? HazardStripe(card, { width: 1920, height: 24 }) : null;
    if (stripe) place(stripe.g, { y: 1056 });
    return {
      g,
      update({ t = 0, tIn, tWipe, tOut } = {}) {
        const t0 = T(tIn);
        if (tWipe == null) tWipe = tOut;
        [[partG, 0.1], [titleG, 0.2], [subG, 0.6]].forEach(([node, d]) => {
          const p = Kit.presence(t, t0 + d, INF, { rise: 12 });
          place(node, { y: p.dy, o: p.o });
        });
        set(rule, { width: f2(160 * prog(t, t0 + 0.45, 0.5)) });
        place(content, { y: Math.sin(t * Math.PI * 2 / 5) });
        const pw = Engine.ease.inOut(lin(t, N(tWipe), 0.6));
        place(card, { y: -1080 * pw }); show(card, pw < 1);
        if (stripe) stripe.update({ t, speed: 8 });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Checklist(parent, {title, items: [...], width})
  //   Paper card (16 px radius, 1 px steel border, 32 px padding), optional 36 px heading, one row
  //   per item: 36 px steel circle + 34 px 500 text (ink-soft until ticked). Width fits the text
  //   unless given.
  // update({t, tIn, tOut, rows: [t...], ticks: [t...], fails: [t...], done}):
  //   card fades + rises at tIn; row i appears at rows[i] (default tIn + 0.3 + 0.35 i);
  //   ticks[i]: circle fills correct, check draws (0.25 s), text goes ink-soft to ink;
  //   fails[i]: circle fills error with an X (e.g. 'Brake fault');
  //   once every row is ticked (or at `done`), a 2 px correct border glow fades in and breathes.
  // Fields: w, h, rowY(i) (centre y of row i), textX (x where row text starts).
  // Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function Checklist(parent, { title, items = [], width } = {}) {
    const pad = 32, rowH = 60, circ = 36, head = title ? 64 : 0, textX = pad + circ + 20;
    const w = width || Math.ceil(Math.max(480, textX + widest(items, 34, 500) + pad, title ? pad * 2 + measure(title, 36, 700) : 0));
    const h = pad * 2 + head + Math.max(0, items.length - 1) * rowH + circ;
    const rowY = i => pad + head + circ / 2 + i * rowH;
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const glow = el('rect', { x: -5, y: -5, width: w + 10, height: h + 10, rx: 20, fill: 'none', stroke: C.correct, 'stroke-width': 2 }, inner);
    el('rect', { width: w, height: h, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, inner);
    if (title) text(inner, title, { x: pad, y: pad + 28, size: 36, weight: 700, fill: C.ink });
    const rows = items.map((s, i) => {
      const rg = el('g', {}, inner), cg = el('g', { transform: `translate(${pad + circ / 2} ${rowY(i)})` }, rg), cs = el('g', {}, cg);
      const circle = el('circle', { r: circ / 2 - SW / 2, fill: C.paper, stroke: C.steel, 'stroke-width': SW }, cs);
      const chk = drawPath(cs, 'M-8 0.5L-2.5 6L8.5 -6', { stroke: C.paper, 'stroke-width': 4 });
      const crs = drawPath(cs, 'M-6.5 -6.5L6.5 6.5M6.5 -6.5L-6.5 6.5', { stroke: C.paper, 'stroke-width': 4 });
      const label = text(rg, s, { x: textX, y: f2(rowY(i) + 12.4), size: 34, weight: 500, fill: C.inkSoft });
      return { rg, cs, circle, chk, crs, label };
    });
    return {
      g, w, h, rowY, textX,
      update({ t = 0, tIn, tOut, rows: at, ticks = [], fails = [], done } = {}) {
        const t0 = T(tIn);
        const pc = Kit.presence(t, t0, N(tOut));
        place(inner, { y: pc.dy, o: pc.o }); show(inner, pc.o > 0.001);
        rows.forEach((r, i) => {
          const ta = at && at[i] != null ? at[i] : t0 + 0.3 + 0.35 * i;
          const pr = prog(t, ta, 0.35);
          place(r.rg, { y: 16 * (1 - pr), o: pr }); show(r.rg, pr > 0.001);
          const tk = N(ticks[i]), tf = N(fails[i]);
          const pk = lin(t, tk, 0.25), pf = lin(t, tf, 0.25);
          const fill = pf > 0 ? mix(C.paper, C.error, pf) : mix(C.paper, C.correct, pk);
          set(r.circle, { fill, stroke: mix(C.steel, C.ink, Math.max(pk, pf)) });
          place(r.cs, { s: bump(t, tk, 0.3) * bump(t, tf, 0.3) });
          drawTo(r.chk, pf > 0 ? 0 : prog(t, tk + 0.05, 0.25));
          drawTo(r.crs, prog(t, tf + 0.05, 0.25));
          set(r.label, { fill: mix(C.inkSoft, C.ink, Math.max(pk, pf)) });
        });
        const allTicked = items.length && items.every((_, i) => ticks[i] != null);
        const td = done != null ? done : allTicked ? Math.max(...ticks.slice(0, items.length)) + 0.3 : INF;
        const go = prog(t, td, 0.4) * (0.7 + 0.3 * Math.cos((t - td) * Math.PI));
        set(glow, { opacity: clamp(go) }); show(glow, go > 0.001);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.DoDontPanel(parent, {width = 1600, rows = 2, rowHeight = 220, headers = ["Don't", 'Do'], gap = 40, rowGap = 24})
  //   Two equal columns, 40 px gap. Headers: 56 px RedX (left) / GreenCheck (right) + 34 px label
  //   over a 1 px baseline. One paper cell per row and side. rows may be a count or an array of
  //   captions [{dont: 'Bin bulging', do: 'Larger bay'}, ...] (28 px 600, bottom of each cell).
  //   Put illustrations in slot(i, 'dont' | 'do'): a group at the cell's top-left, cellW × contentH.
  // update({t, tIn, tOut, rows: [{dont: t, do: t}, ...]}): headers enter at tIn; each cell slides in
  //   from its outer side (-24 px, fade, 0.35 s) at its time (default: wrong first, then right,
  //   0.9 s per row). Wrong cells pulse a 3 px error outline (1 to 0.6 to 1, 1 s, two cycles) and get
  //   a 32 px RedX; right cells get a single 32 px GreenCheck badge, top-right.
  // Fields: w, h, cellW, rowH, contentH, cellY(i), slot(i, side).
  // Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function DoDontPanel(parent, { width = 1600, rows = 2, rowHeight = 220, headers = ["Don't", 'Do'], gap = 40, rowGap = 24 } = {}) {
    const n = typeof rows === 'number' ? rows : rows.length;
    const caps = typeof rows === 'number' ? [] : rows;
    const colW = (width - gap) / 2, headH = 72, top = headH + 20;
    const cellY = i => top + i * (rowHeight + rowGap);
    const anyCap = caps.some(c => c && (c.dont || c.do));
    const contentH = anyCap ? rowHeight - 52 : rowHeight;
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const heads = ['dont', 'do'].map((side, c) => {
      const x0 = c * (colW + gap), hg = el('g', {}, inner);
      const mark = (c ? GreenCheck : RedX)(hg, { size: 56 });
      place(mark.g, { x: x0 + 28, y: 28 });
      text(hg, headers[c], { x: x0 + 72, y: 40, size: 34, weight: 700, fill: C.ink });
      el('line', { x1: x0, x2: x0 + colW, y1: 64.5, y2: 64.5, stroke: C.inkSoft, 'stroke-width': 1 }, hg);
      return { hg, mark };
    });
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(['dont', 'do'].map((side, c) => {
        const cg = el('g', { transform: `translate(${c * (colW + gap)} ${cellY(i)})` }, inner), anim = el('g', {}, cg);
        el('rect', { width: colW, height: rowHeight, rx: 12, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, anim);
        const slot = el('g', {}, anim);
        const cap = caps[i] && caps[i][side];
        if (cap) text(anim, cap, { x: colW / 2, y: rowHeight - 20, size: 28, weight: 600, fill: C.ink, anchor: 'middle' });
        const outline = side === 'dont' ? el('rect', { x: 1.5, y: 1.5, width: colW - 3, height: rowHeight - 3, rx: 11, fill: 'none', stroke: C.error, 'stroke-width': 3 }, anim) : null;
        const mark = (side === 'dont' ? RedX : GreenCheck)(anim, { size: 32 });
        place(mark.g, { x: colW - 26, y: 26 });
        return { cg, anim, slot, outline, mark };
      }));
    }
    const h = cellY(n - 1) + rowHeight;
    return {
      g, w: width, h, cellW: colW, rowH: rowHeight, contentH, cellY,
      slot: (i, side) => cells[i][side === 'do' ? 1 : 0].slot,
      update({ t = 0, tIn, tOut, rows: at = [] } = {}) {
        const t0 = T(tIn);
        const pc = Kit.presence(t, t0, N(tOut));
        place(inner, { y: pc.dy, o: pc.o }); show(inner, pc.o > 0.001);
        heads.forEach((hd, c) => {
          const p = prog(t, t0 + 0.1 * c, 0.4);
          place(hd.hg, { o: p }); hd.mark.update({ t, tIn: t0 + 0.1 + 0.1 * c });
        });
        cells.forEach(([dont, good], i) => {
          const ti = at[i] || {};
          const td = ti.dont != null ? ti.dont : t0 + 0.4 + 0.9 * i;
          const tg = ti.do != null ? ti.do : t0 + 0.85 + 0.9 * i;
          const pd = prog(t, td, 0.35), pg = prog(t, tg, 0.35);
          place(dont.anim, { x: -24 * (1 - pd), o: pd }); show(dont.cg, pd > 0.001);
          place(good.anim, { x: 24 * (1 - pg), o: pg }); show(good.cg, pg > 0.001);
          const u = t - (td + 0.3);
          const po = u < 0 ? 0 : u < 2 ? 1 - 0.4 * (1 - Math.cos(u * Math.PI * 2)) / 2 : 1;
          set(dont.outline, { opacity: f2(po * lin(t, td + 0.15, 0.15)) });
          dont.mark.update({ t, tIn: td + 0.3 });
          good.mark.update({ t, tIn: tg + 0.35 });
        });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.ProgressTimeline(parent, {nodes: [{label, icon}], width = 1600, dark = false, nodeSize = 44, iconSize = 26})
  //   6 px steel track with evenly spaced 44 px nodes; 24 px 600 labels under the nodes ('\n' for
  //   two lines). icon: a Kit.Icon name; without one the node shows its number. dark: label colours
  //   for bg-dark. Idle: paper fill, steel border, steel icon. Active: accent fill. Done: correct
  //   fill, paper icon; a correct fill line grows along the track behind done nodes.
  // update({t, tIn, tOut, show: [t...], active: [t...], done: [t...], pulse: [t | [t...]]}):
  //   track fades in at tIn; node i pops in at show[i] (default tIn + 0.1 + 0.08 i);
  //   active[i] / done[i]: fill tweens 0.3 s with a 1.15 scale bounce;
  //   pulse[i]: re-pulse (bounce + a correct ring that expands and fades), e.g. a recap.
  // Fields: xs (node centre x), nodes[i].slot (group at node centre for extra content).
  // Origin: centre of the first node (left end of the track, on the node centre line).
  // ---------------------------------------------------------------------------------------------
  function ProgressTimeline(parent, { nodes = [], width = 1600, dark = false, nodeSize = 44, iconSize = 26 } = {}) {
    const n = nodes.length, r = nodeSize / 2;
    const xs = nodes.map((_, i) => (n === 1 ? width / 2 : (i * width) / (n - 1)));
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const trackG = el('g', {}, inner);
    el('line', { x1: 0, x2: width, y1: 0, y2: 0, stroke: C.steel, 'stroke-width': 6, 'stroke-linecap': 'round' }, trackG);
    const fillLine = el('line', { x1: 0, x2: 0, y1: 0, y2: 0, stroke: C.correct, 'stroke-width': 6, 'stroke-linecap': 'round' }, trackG);
    const [lIdle, lOn] = dark ? [C.onDarkSoft, C.paper] : [C.inkSoft, C.ink];
    const items = nodes.map((nd, i) => {
      const ng = el('g', { transform: `translate(${f2(xs[i])} 0)` }, inner), pop = el('g', {}, ng), sc = el('g', {}, pop);
      const ring = el('circle', { r, fill: 'none', stroke: C.correct, 'stroke-width': 3 }, pop);
      const circle = el('circle', { r: r - SW / 2, fill: C.paper, stroke: C.steel, 'stroke-width': SW }, sc);
      const icon = nd.icon ? Icon(sc, { name: nd.icon, size: iconSize, color: C.steel }) : null;
      const num = nd.icon ? null : text(sc, String(i + 1), { size: 24, weight: 700, fill: C.steel, anchor: 'middle', y: 8.7 });
      const slot = el('g', {}, sc);
      const labels = String(nd.label || '').split('\n').map((s, k) => text(pop, s, { y: r + 32 + k * 28, size: 24, weight: 600, fill: lIdle, anchor: 'middle' }));
      return { pop, sc, ring, circle, icon, num, slot, labels };
    });
    return {
      g, xs, w: width,
      nodes: items.map(it => ({ slot: it.slot })),
      update({ t = 0, tIn, tOut, show: shows = [], active = [], done = [], pulse = [] } = {}) {
        const t0 = T(tIn);
        const pc = Kit.presence(t, t0, N(tOut));
        place(inner, { y: pc.dy, o: pc.o }); show(inner, pc.o > 0.001);
        set(trackG, { opacity: f2(lin(t, t0, 0.4)) });
        let fillX = 0;
        items.forEach((it, i) => {
          const ts = shows[i] != null ? shows[i] : t0 + 0.1 + 0.08 * i;
          const ps = prog(t, ts, 0.3, ease.pop);
          place(it.pop, { s: Math.max(0.001, ps), o: lin(t, ts, 0.1) }); show(it.pop, t >= ts);
          const ta = N(active[i]), td = N(done[i]);
          const pa = lin(t, ta, 0.3), pd = lin(t, td, 0.3);
          if (pd > 0) fillX = Math.max(fillX, lerp(i ? xs[i - 1] : 0, xs[i], ease.enter(pd)));
          set(it.circle, { fill: mix(mix(C.paper, C.accent, pa), C.correct, pd), stroke: mix(C.steel, C.ink, Math.max(pa, pd)) });
          const ic = mix(mix(C.steel, C.ink, pa), C.paper, pd);
          if (it.icon) it.icon.update({ color: ic }); else set(it.num, { fill: ic });
          it.labels.forEach(l => set(l, { fill: mix(lIdle, lOn, Math.max(pa, pd)) }));
          const pl = [].concat(pulse[i] == null ? [] : pulse[i]).filter(x => x <= t);
          const tp = pl.length ? Math.max(...pl) : INF;
          place(it.sc, { s: bump(t, ta) * bump(t, td) * bump(t, tp) });
          const u = lin(t, tp, 0.6);
          set(it.ring, { r: f2(r + 20 * ease.enter(u)), opacity: f2(0.9 * (1 - u)) }); show(it.ring, u > 0 && u < 1);
        });
        set(fillLine, { x2: f2(fillX) }); show(fillLine, fillX > 0);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.ThinkingDots(parent, {size = 16, gap = 14, color = C.accent, period = 1.2})
  //   Three dots that pulse in sequence (quiz pause).
  // update({t, tIn, tOut}): fades in at tIn and out by tOut (0.2 s); pulses while visible.
  // Origin: centre of the middle dot.
  // ---------------------------------------------------------------------------------------------
  function ThinkingDots(parent, { size = 16, gap = 14, color = C.accent, period = 1.2 } = {}) {
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const dots = [0, 1, 2].map(i => el('circle', { cx: (i - 1) * (size + gap), r: size / 2, fill: color }, inner));
    return {
      g,
      update({ t = 0, tIn, tOut } = {}) {
        const t0 = T(tIn);
        const o = Math.min(lin(t, t0, 0.2), 1 - lin(t, N(tOut) - 0.2, 0.2));
        set(inner, { opacity: f2(o) }); show(inner, o > 0.001);
        const base = t0 === -INF ? t : t - t0;
        dots.forEach((d, i) => {
          const ph = fmod(base - i * 0.2, period) / period;
          const k = ph < 0.5 ? Math.sin(Math.PI * ph / 0.5) : 0;
          set(d, { r: f2((size / 2) * (1 + 0.35 * k)), opacity: f2(0.4 + 0.6 * k) });
        });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.QuizCard(parent, {question, answer})
  //   Full-frame bg-dark quiz card: question 52 px 700 paper at the top (wraps to 2 lines), an
  //   illustration area centred at (960, 520) (max 500 px tall, put content in `stage`),
  //   ThinkingDots at (960, 880) during the pause, and the answer (44 px 600 correct on a paper chip
  //   with a 40 px GreenCheck) in the same place.
  // update({t, tIn, tOut, think: [t0, t1], tAnswer}): question rises in at tIn; dots pulse during
  //   think (default tIn + 0.8 to tAnswer); the answer slides up from +24 px at tAnswer and its check
  //   pops; at tOut the content (not the background) fades out.
  // Fields: stage (group centred at the illustration area). Origin: top-left of the frame.
  // ---------------------------------------------------------------------------------------------
  function QuizCard(parent, { question = '', answer = '' } = {}) {
    const g = el('g', {}, parent);
    el('rect', { width: 1920, height: 1080, fill: C.bgDark }, g);
    const content = el('g', {}, g);
    const qG = el('g', {}, content);
    const qRows = wrap(question, 52, 700, 1600);
    qRows.forEach((s, i) => text(qG, s, { x: 960, y: 190 - (qRows.length - 1) * 30 + i * 62, size: 52, weight: 700, fill: C.paper, anchor: 'middle' }));
    const stage = el('g', { transform: 'translate(960 520)' }, content);
    const dots = ThinkingDots(content, {});
    place(dots.g, { x: 960, y: 880 });
    const aRows = wrap(answer, 44, 600, 1480), lh = 54;
    const aw = Math.ceil(widest(aRows, 44, 600)), cw = aw + 40 + 20 + 64, ch = 40 + aRows.length * lh;
    const ansG = el('g', {}, content), chip = el('g', { transform: `translate(${f2(960 - cw / 2)} ${f2(880 - ch / 2)})` }, ansG);
    el('rect', { width: cw, height: ch, rx: 16, fill: C.paper }, chip);
    aRows.forEach((s, i) => text(chip, s, { x: 32 + 60, y: f2(20 + lh * i + lh / 2 + 16), size: 44, weight: 600, fill: C.correct }));
    const check = GreenCheck(chip, { size: 40 });
    place(check.g, { x: 32 + 20, y: ch / 2 });
    return {
      g, stage,
      update({ t = 0, tIn, tOut, think, tAnswer } = {}) {
        const t0 = T(tIn), ta = N(tAnswer);
        const pq = Kit.presence(t, t0, INF);
        place(qG, { y: pq.dy, o: pq.o });
        const th = think || [t0 + 0.8, ta];
        dots.update({ t, tIn: th[0], tOut: th[1] });
        const pa = Kit.presence(t, ta, INF);
        place(ansG, { y: pa.dy, o: pa.o }); show(ansG, pa.o > 0.001);
        check.update({ t, tIn: ta + 0.15 });
        const o = 1 - prog(t, N(tOut) - 0.3, 0.3, ease.exit);
        set(content, { opacity: f2(o) });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Panel(parent, {width = 520, height = 560, caption})
  //   Frame for the three-panel strip: paper card (16 px radius, 1 px steel border). Optional
  //   caption (30 px 600, up to 2 lines) under a divider at the bottom. Content goes in `slot`
  //   (top-left at the panel's top-left, clipped to the picture area areaW × areaH).
  //   Kit.stripX(n = 3, w = 520, gap = 40) gives the x of each panel for a centred strip.
  // update({t, tIn, tOut, from = 'left', mark = 'none', tMark}): enters with fade + 24 px from
  //   `from` (left | right | below), exits with fade + 16 px onward. mark: 'check' (32 px GreenCheck)
  //   or 'x' (32 px RedX + 3 px error outline), top-right, pops at tMark.
  // Fields: w, h, areaW, areaH, slot. Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function Panel(parent, { width = 520, height = 560, caption } = {}) {
    const capRows = caption ? wrap(caption, 30, 600, width - 48) : [];
    const capH = capRows.length ? 28 + capRows.length * 38 : 0, areaH = height - capH;
    const g = el('g', {}, parent), inner = el('g', {}, g), id = nextId('panel');
    const cp = el('clipPath', { id }, el('defs', {}, inner));
    el('path', { d: rr(0, 0, width, height, 16) }, cp);
    el('rect', { width, height, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, inner);
    const clip = el('g', { 'clip-path': `url(#${id})` }, inner);
    const slot = el('g', {}, el('g', { 'clip-path': `url(#${id}-a)` }, clip));
    el('rect', { width, height: areaH }, el('clipPath', { id: `${id}-a` }, el('defs', {}, inner)));
    if (capRows.length) {
      el('line', { x1: 24, x2: width - 24, y1: areaH + 0.5, y2: areaH + 0.5, stroke: C.steel, 'stroke-width': 1 }, inner);
      capRows.forEach((s, i) => text(inner, s, { x: width / 2, y: f2(areaH + 14 + 38 * i + 19 + 11), size: 30, weight: 600, fill: C.ink, anchor: 'middle' }));
    }
    const outline = el('rect', { x: 1.5, y: 1.5, width: width - 3, height: height - 3, rx: 15, fill: 'none', stroke: C.error, 'stroke-width': 3 }, inner);
    const ok = GreenCheck(inner, { size: 32 }), bad = RedX(inner, { size: 32 });
    place(ok.g, { x: width - 28, y: 28 }); place(bad.g, { x: width - 28, y: 28 });
    return {
      g, slot, w: width, h: height, areaW: width, areaH,
      update({ t = 0, tIn, tOut, from = 'left', mark = 'none', tMark } = {}) {
        const pin = prog(t, T(tIn), 0.4), pout = prog(t, N(tOut) - 0.3, 0.3, ease.exit);
        const [ux, uy] = { left: [-1, 0], right: [1, 0], below: [0, 1] }[from] || [0, 1];
        const k = 24 * (1 - pin), q = 16 * pout;
        const o = pin * (1 - pout);
        place(inner, { x: ux * k - ux * q, y: uy * k - uy * q, o }); show(inner, o > 0.001);
        const tm = T(tMark);
        ok.update({ t, tIn: mark === 'check' ? tm : INF });
        bad.update({ t, tIn: mark === 'x' ? tm : INF });
        set(outline, { opacity: f2(mark === 'x' ? lin(t, tm, 0.2) : 0) });
      },
    };
  }
  const stripX = (n = 3, w = 520, gap = 40) => Array.from({ length: n }, (_, i) => (1920 - (n * w + (n - 1) * gap)) / 2 + i * (w + gap));

  // ---------------------------------------------------------------------------------------------
  // Kit.Tile(parent, {label, icon, width = 360, height = 320, iconSize = 120, iconColor = C.ink})
  //   Icon + 2 to 4 word label card (Part V / Part VI reveals). icon: a Kit.Icon name ('shield') or
  //   an abstract icon name ('Shield', 'Target', 'Lightbulb', 'Book', 'Ladder', 'Handshake',
  //   'QuestionMark', 'ExclamationMark', 'Moon', 'Star'), or omit it and draw into `slot` (a group
  //   at the centre of the icon area). Label 30 px 600, wraps to 2 lines.
  // update({t, tIn, tOut, mark = 'none', tMark, iconParams}): pops in (scale 0.9 to 1 + fade, 0.3 s);
  //   an abstract icon plays its own entrance 0.15 s later (iconParams are passed to it);
  //   mark 'check' / 'x' pops a 32 px badge top-right at tMark.
  // Fields: w, h, slot, icon (the icon component, if any). Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function Tile(parent, { label = '', icon, width = 360, height = 320, iconSize = 120, iconColor = C.ink } = {}) {
    const rows = wrap(label, 30, 600, width - 40), labH = 24 + rows.length * 38;
    const g = el('g', {}, parent), pop = el('g', {}, g);
    el('rect', { width, height, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, pop);
    const slot = el('g', { transform: `translate(${width / 2} ${f2((height - labH) / 2 + 6)})` }, pop);
    let ic = null, abstract = false;
    if (icon && ICONS[icon]) ic = Icon(slot, { name: icon, size: iconSize, color: iconColor });
    else if (icon && ABSTRACT.includes(icon)) { ic = Kit[icon](slot, { size: iconSize }); abstract = true; }
    rows.forEach((s, i) => text(pop, s, { x: width / 2, y: f2(height - labH + 4 + 38 * i + 19 + 11), size: 30, weight: 600, fill: C.ink, anchor: 'middle' }));
    const ok = GreenCheck(pop, { size: 32 }), bad = RedX(pop, { size: 32 });
    place(ok.g, { x: width - 26, y: 26 }); place(bad.g, { x: width - 26, y: 26 });
    return {
      g, slot, icon: ic, w: width, h: height,
      update({ t = 0, tIn, tOut, mark = 'none', tMark, iconParams = {} } = {}) {
        const t0 = T(tIn);
        const pin = prog(t, t0, 0.3), pout = prog(t, N(tOut) - 0.3, 0.3, ease.exit);
        const s = lerp(0.9, 1, pin), o = lin(t, t0, 0.25) * (1 - pout);
        place(pop, { x: (width / 2) * (1 - s), y: (height / 2) * (1 - s), s, o }); show(pop, o > 0.001);
        if (abstract) ic.update({ t, tIn: t0 + 0.15, ...iconParams });
        const tm = T(tMark);
        ok.update({ t, tIn: mark === 'check' ? tm : INF });
        bad.update({ t, tIn: mark === 'x' ? tm : INF });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Clock(parent, {size = 200, color = 'neutral', label})
  //   200 px dial: ink bezel, paper face, 12 ticks, hour/minute hands, accent second hand that
  //   ticks once a second (idle life). color: neutral (stock) | error (emergency) | accent (8 h
  //   goal) | correct, or any hex. label: text for the pill under the dial (e.g. '24 h').
  // update({t, tIn, tOut, state = 'idle', tState, to = 1, dur = 1.2, label, color, pulse = false, time = [10, 10]}):
  //   state 'idle'         hands at `time` [h, m], second hand ticking.
  //         'fill'         a `color` wedge sweeps clockwise from 12 to `to` (0..1 of a turn) over
  //                        `dur` from tState; the label pill pops in.
  //         'fast-sweep'   hands spin fast from tState with motion arcs ("late").
  //         'cut-off'      a red wedge (10 to 12 o'clock) grows and a 'Cut off' pill (with X) pops.
  //         'end-of-shift' a moon badge pops top-right; pill reads label or 'End of shift'.
  //         'on-time'      a 56 px GreenCheck pops top-right; pill shows label if given.
  //   tState defaults to tIn. pulse: true adds the urgency pulse (scale 1.0 to 1.04, 1 s).
  //   The clock pops in at tIn (scale 0.9 to 1 + fade) and fades out by tOut.
  // Origin: dial centre. Footprint: size × size, plus the pill hanging ~45 px below.
  // ---------------------------------------------------------------------------------------------
  const TONE = { neutral: C.neutral, error: C.error, accent: C.accent, correct: C.correct };
  const TONE_BADGE = { [C.neutral]: 'neutral', [C.error]: 'error', [C.accent]: 'accent', [C.correct]: 'correct' };
  function Clock(parent, { size = 200, color = 'neutral', label = '' } = {}) {
    const k = size / 200;
    const g = el('g', {}, parent), pop = el('g', {}, g), body = el('g', { transform: `scale(${f2(k)})` }, pop), pulseG = el('g', {}, body);
    const arcs = el('g', { fill: 'none', stroke: C.accent, 'stroke-width': 6, 'stroke-linecap': 'round' }, pulseG);
    el('path', { d: 'M-80 -82A114 114 0 0 1 -20 -112' }, arcs);
    el('path', { d: 'M82 80A114 114 0 0 1 20 112' }, arcs);
    el('circle', { r: 100 - SW / 2, fill: C.steelDark, stroke: C.ink, 'stroke-width': SW }, pulseG);
    el('circle', { r: 88, fill: C.paper }, pulseG);
    const fillW = el('path', { d: 'M0 0', opacity: 0.9 }, pulseG);
    const cutW = el('path', { d: 'M0 0', fill: C.error, opacity: 0.9 }, pulseG);
    el('circle', { r: 88, fill: 'none', stroke: C.ink, 'stroke-width': SW }, pulseG);
    const ticks = el('g', { stroke: C.ink, 'stroke-linecap': 'round' }, pulseG);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, q = i % 3 === 0, r0 = q ? 66 : 72;
      el('line', { x1: f2(r0 * Math.sin(a)), y1: f2(-r0 * Math.cos(a)), x2: f2(82 * Math.sin(a)), y2: f2(-82 * Math.cos(a)), 'stroke-width': q ? 5 : 3 }, ticks);
    }
    const hourH = el('line', { y2: -46, stroke: C.ink, 'stroke-width': 9, 'stroke-linecap': 'round' }, pulseG);
    const minH = el('line', { y2: -68, stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round' }, pulseG);
    const secH = el('line', { y1: 14, y2: -74, stroke: C.accent, 'stroke-width': 3, 'stroke-linecap': 'round' }, pulseG);
    el('circle', { r: 8, fill: C.ink }, pulseG);
    el('circle', { r: 3, fill: C.accent }, pulseG);
    const pill = Badge(pulseG, { text: label || ' ', height: 44, size: 26 });
    place(pill.g, { y: 112 });
    const moonG = el('g', {}, pulseG);
    place(moonG, { x: 74, y: -74 });
    const moon = Moon(moonG, { size: 64, badge: true });
    const check = GreenCheck(pulseG, { size: 56 });
    place(check.g, { x: 74, y: -74 });
    return {
      g,
      update({ t = 0, tIn, tOut, state = 'idle', tState, to = 1, dur = 1.2, label: lab = label, color: col = color, pulse = false, time = [10, 10] } = {}) {
        const ts = T(tState, T(tIn));
        const s = lerp(0.9, 1, prog(t, T(tIn), 0.3)), o = lin(t, T(tIn), 0.2) * (1 - prog(t, N(tOut) - 0.3, 0.3, ease.exit));
        place(pop, { s, o }); show(pop, o > 0.001);
        const ps = pulse ? 1 + 0.02 * (1 - Math.cos((t - (ts === -INF ? 0 : ts)) * Math.PI * 2)) : 1;
        place(pulseG, { s: ps });
        let hA = (time[0] % 12) * 30 + time[1] * 0.5, mA = time[1] * 6;
        const e = state === 'fast-sweep' ? Math.max(0, t - (ts === -INF ? 0 : ts)) : 0;
        if (state === 'fast-sweep') { const spin = 900 * e * e / (e + 0.3); mA += spin; hA += spin / 12; }
        set(hourH, { transform: `rotate(${f2(hA)})` });
        set(minH, { transform: `rotate(${f2(mA)})` });
        set(secH, { transform: `rotate(${(Math.floor(t + 1e-6) * 6) % 360})` });
        show(arcs, state === 'fast-sweep');
        set(arcs, { transform: `rotate(${f2(fmod(e * 400, 360))})` });
        const hex = TONE[col] || col;
        const pf = state === 'fill' ? prog(t, ts, dur, ease.linear) : 0;
        set(fillW, { d: wedge(88, 0, 360 * clamp(to) * pf), fill: hex }); show(fillW, pf > 0);
        const pc = state === 'cut-off' ? prog(t, ts, 0.4) : 0;
        set(cutW, { d: wedge(88, 300, 300 + 60 * pc) }); show(cutW, pc > 0);
        let pillText = null, variant = 'ink', icon = 'none';
        if (state === 'fill' && lab) { pillText = lab; variant = TONE_BADGE[hex] || 'ink'; }
        if (state === 'cut-off') { pillText = 'Cut off'; variant = 'error'; icon = 'x'; }
        if (state === 'end-of-shift') pillText = lab || 'End of shift';
        if (state === 'on-time' && lab) { pillText = lab; variant = 'correct'; icon = 'check'; }
        pill.update({ t, tIn: pillText ? ts + 0.3 : INF, text: pillText || ' ', variant, icon });
        moon.update({ t, tIn: state === 'end-of-shift' ? ts : INF });
        check.update({ t, tIn: state === 'on-time' ? ts : INF });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Calendar(parent, {title = 'December', weeks = 5, offset = 1, days = 31, markerCol = 1,
  //                       yearEnd = true, yearEndLabel = 'Year end'})
  //   420 × 360 month card: ink header with title (26 px 700 paper) and binding rings, weekday row,
  //   7 × weeks day grid (22 px numbers). offset = column of day 1 (0 = Monday). Weekly markers
  //   (accent squares) sit on column markerCol each week; the last day is the highlighted
  //   year-end cell (neutral) with a 'Year end' pill hanging under the card.
  // update({t, tIn, tOut, markers: [t...], pulse = true, period = 0.5, tYearEnd}): card fades +
  //   rises at tIn; marker i pops at markers[i] (default tIn + 0.4 + 0.25 i); after the last one
  //   the markers pulse in sequence (period s each) when pulse is true; year end pops at tYearEnd
  //   (default after the markers).
  // Fields: w, h, cell(day) -> {x, y} centre of a day cell. Origin: top-left.
  // ---------------------------------------------------------------------------------------------
  function Calendar(parent, { title = 'December', weeks = 5, offset = 1, days = 31, markerCol = 1, yearEnd = true, yearEndLabel = 'Year end' } = {}) {
    const W = 420, H = 360, headH = 64, top = 108, colW = (W - 24) / 7, rowH = (H - 12 - top) / weeks;
    const cell = day => { const idx = day - 1 + offset; return { x: 12 + colW * (idx % 7) + colW / 2, y: top + rowH * Math.floor(idx / 7) + rowH / 2 }; };
    const g = el('g', {}, parent), inner = el('g', {}, g);
    el('path', { d: rr(0, 0, W, H, 14), fill: C.paper, stroke: C.ink, 'stroke-width': SW }, inner);
    el('path', { d: `M0 ${headH}V14A14 14 0 0 1 14 0H${W - 14}A14 14 0 0 1 ${W} 14V${headH}Z`, fill: C.ink, stroke: C.ink, 'stroke-width': SW, 'stroke-linejoin': 'round' }, inner);
    [110, W - 110].forEach(x => el('rect', { x: x - 7, y: -12, width: 14, height: 26, rx: 7, fill: C.steel, stroke: C.ink, 'stroke-width': SW }, inner));
    text(inner, title, { x: W / 2, y: 42, size: 26, weight: 700, fill: C.paper, anchor: 'middle' });
    'MTWTFSS'.split('').forEach((d, i) => text(inner, d, { x: f2(12 + colW * i + colW / 2), y: 96, size: 22, weight: 600, fill: C.inkSoft, anchor: 'middle' }));
    for (let r = 1; r < weeks; r++) el('line', { x1: 12, x2: W - 12, y1: f2(top + r * rowH), y2: f2(top + r * rowH), stroke: C.floor, 'stroke-width': 1 }, inner);
    const markG = el('g', {}, inner), numG = el('g', {}, inner);
    const markers = [];
    for (let w = 0; w < weeks; w++) {
      const day = w * 7 + markerCol - offset + 1;
      if (day < 1 || day > days) continue;
      const c = cell(day), mg = el('g', { transform: `translate(${f2(c.x)} ${f2(c.y)})` }, markG), s = el('g', {}, mg);
      el('rect', { x: -21, y: -18, width: 42, height: 36, rx: 8, fill: C.accent, stroke: C.ink, 'stroke-width': 2 }, s);
      markers.push(s);
    }
    let ye = null, yeNum = null;
    if (yearEnd) {
      const c = cell(days), yg = el('g', { transform: `translate(${f2(c.x)} ${f2(c.y)})` }, markG);
      ye = el('g', {}, yg);
      el('rect', { x: -24, y: -20, width: 48, height: 40, rx: 8, fill: C.neutral, stroke: C.ink, 'stroke-width': 2 }, ye);
    }
    for (let d = 1; d <= days; d++) {
      const c = cell(d);
      const node = text(numG, String(d), { x: f2(c.x), y: f2(c.y + 8), size: 22, weight: 500, fill: C.ink, anchor: 'middle' });
      if (yearEnd && d === days) yeNum = node;
    }
    let pill = null;
    if (yearEnd) {
      const c = cell(days), pg = el('g', {}, inner);
      const pw = measure(yearEndLabel, 24, 600) + 32;
      place(pg, { x: clamp(c.x, pw / 2, W - pw / 2), y: H + 30 });
      pill = Badge(pg, { text: yearEndLabel, variant: 'neutral' });
    }
    return {
      g, w: W, h: H, cell,
      update({ t = 0, tIn, tOut, markers: mt = [], pulse = true, period = 0.5, tYearEnd } = {}) {
        const t0 = T(tIn);
        const pc = Kit.presence(t, t0, N(tOut));
        place(inner, { y: pc.dy, o: pc.o }); show(inner, pc.o > 0.001);
        const times = markers.map((_, i) => (mt[i] != null ? mt[i] : t0 + 0.4 + 0.25 * i));
        const last = Math.max(-INF, ...times);
        const u = (t - (last === -INF ? 0 : last + 0.3)) / period;
        const active = pulse && u >= 0 ? Math.floor(u) % markers.length : -1;
        markers.forEach((m, i) => {
          const sIn = prog(t, times[i], 0.3, ease.pop);
          const sp = i === active ? 1 + 0.18 * Math.sin(Math.PI * (u - Math.floor(u))) : 1;
          place(m, { s: Math.max(0.001, sIn * sp), o: lin(t, times[i], 0.1) }); show(m, t >= times[i]);
        });
        if (ye) {
          const ty = tYearEnd != null ? tYearEnd : (last === -INF ? -INF : last + 0.4);
          const p = prog(t, ty, 0.3, ease.pop);
          place(ye, { s: Math.max(0.001, p) }); show(ye, t >= ty);
          set(yeNum, { fill: t >= ty + 0.1 ? C.paper : C.ink, 'font-weight': t >= ty + 0.1 ? 700 : 500 });
          pill.update({ t, tIn: ty + 0.2 });
        }
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.HazardSign(parent, {size = 120, glyph = 'flame'})
  //   Diamond placard: safety fill, ink border and inner border line, generic glyph
  //   ('flame' | 'exclamation'). No UN numbers.
  // update({t, tIn, tOut, swing}): pops in (ease-out-back); swing = time of a small settle wobble.
  // Origin: centre. Footprint: size × size.
  // ---------------------------------------------------------------------------------------------
  function absIcon(parent, size, base = 120) {
    const g = el('g', {}, parent), pop = el('g', {}, g), k = size / base;
    const body = el('g', { transform: `scale(${f2(k)})`, stroke: C.ink, 'stroke-width': f2(SW / k), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, pop);
    return { g, pop, body, k, sw: SW / k };
  }
  function HazardSign(parent, { size = 120, glyph = 'flame' } = {}) {
    const a = absIcon(parent, size);
    const wob = el('g', {}, a.body);
    el('path', { d: 'M0 -58L58 0L0 58L-58 0Z', fill: C.safety }, wob);
    el('path', { d: 'M0 -47L47 0L0 47L-47 0Z', fill: 'none', 'stroke-width': f2(a.sw * 0.8) }, wob);
    if (glyph === 'exclamation') {
      el('rect', { x: -6, y: -28, width: 12, height: 34, rx: 6, fill: C.ink, stroke: 'none' }, wob);
      el('circle', { cy: 18, r: 7, fill: C.ink, stroke: 'none' }, wob);
    } else {
      el('path', { d: 'M1 -30C6 -18 19 -10 19 6C19 19 10 26 0 26C-10 26 -19 19 -19 6C-19 -4 -12 -9 -9 -17C-6 -10 -4 -7 -2 -5C0 -13 -2 -22 1 -30Z', fill: C.ink, stroke: 'none' }, wob);
      el('path', { d: 'M0 4C4 9 8 13 8 17C8 22 4 24 0 24C-4 24 -8 22 -8 17C-8 13 -4 10 0 4Z', fill: C.safety, stroke: 'none' }, wob);
      el('line', { x1: -20, x2: 20, y1: 32, y2: 32, 'stroke-width': 5 }, wob);
    }
    el('path', { d: 'M0 -58L58 0L0 58L-58 0Z', fill: 'none' }, wob);
    return {
      g: a.g,
      update({ t = 0, tIn, tOut, swing } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const u = t - N(swing);
        place(wob, { r: u > 0 && u < 1.2 ? 6 * Math.sin(u * 14) * Math.exp(-u * 3.5) : 0 });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Abstract icons (STYLE §6 item 39). Each: Kit.Name(parent, {size = 120, ...}), centre origin,
  // update({t, tIn, tOut, ...}) pops in (ease-out-back) and then plays the animation noted.
  //   Kit.Shield({size, color = C.correct})      check draws on (tIn + 0.15).
  //   Kit.Target({size})                          arrow flies in and hits (tIn + 0.25), small wobble.
  //   Kit.Lightbulb({size})  update({..., tOn})   bulb lights (paper to safety) with accent rays at
  //                                               tOn (default tIn + 0.3); rays breathe while on.
  //   Kit.Book({size})                            open book; a rising correct line chart draws on.
  //   Kit.Ladder({size})                          four career steps rise in sequence, flag on top.
  //   Kit.Handshake({size})                       two sleeves (worker blue, supervisor purple) and
  //                                               clasped hands; gentle shake after entry.
  //   Kit.QuestionMark({size, color = C.accent})  '?' disc; small wobble after entry.
  //   Kit.ExclamationMark({size, color = C.safety}) '!' disc; small wobble after entry.
  //   Kit.Moon({size, badge = false})             crescent (safety); badge: on a bg-dark disc.
  //   Kit.Star({size, color = C.accent})          five-point star; twinkle sparkles (idle).
  // ---------------------------------------------------------------------------------------------
  function Shield(parent, { size = 120, color = C.correct } = {}) {
    const a = absIcon(parent, size);
    el('path', { d: 'M0 -54L44 -38V-6C44 24 24 44 0 54C-24 44 -44 24 -44 -6V-38Z', fill: color }, a.body);
    el('path', { d: 'M0 -42L33 -30V-6C33 16 18 31 0 40', fill: 'none', stroke: C.paper, 'stroke-width': 4, opacity: 0.35 }, a.body);
    const chk = drawPath(a.body, 'M-19 -2L-5 12L20 -16', { stroke: C.paper, 'stroke-width': 11 });
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) { popIn(a.pop, t, tIn, tOut); drawTo(chk, prog(t, T(tIn) + 0.15, 0.3)); },
    };
  }

  function Target(parent, { size = 120 } = {}) {
    const a = absIcon(parent, size);
    el('circle', { r: 50, fill: C.paper }, a.body);
    el('circle', { r: 37, fill: C.accent }, a.body);
    el('circle', { r: 24, fill: C.paper }, a.body);
    el('circle', { r: 11, fill: C.ink }, a.body);
    const arrow = el('g', {}, a.body), wob = el('g', {}, arrow);
    el('line', { x1: 2, y1: -2, x2: 52, y2: -52, 'stroke-width': 6 }, wob);
    el('path', { d: 'M44 -60L52 -52L64 -56L56 -64L58 -74L50 -66Z', fill: C.error, 'stroke-width': f2(a.sw * 0.8) }, wob);
    el('path', { d: 'M60 -44L52 -52L56 -64L64 -56L74 -58L66 -50Z', fill: C.error, 'stroke-width': f2(a.sw * 0.8) }, wob);
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const th = T(tIn) + 0.25, p = prog(t, th, 0.35, Engine.ease.in);
        place(arrow, { x: 70 * (1 - p), y: -70 * (1 - p), o: lin(t, th, 0.1) }); show(arrow, t >= th);
        const u = t - th - 0.35;
        place(wob, { r: u > 0 && u < 1 ? 5 * Math.sin(u * 30) * Math.exp(-u * 5) : 0 });
      },
    };
  }

  function Lightbulb(parent, { size = 120 } = {}) {
    const a = absIcon(parent, size);
    const rays = el('g', { stroke: C.accent, 'stroke-width': 7 }, a.body);
    [-90, -50, -130, -10, -170, 30, 210].forEach(deg => {
      const r = deg * Math.PI / 180;
      el('line', { x1: f2(47 * Math.cos(r)), y1: f2(-18 + 47 * Math.sin(r)), x2: f2(58 * Math.cos(r)), y2: f2(-18 + 58 * Math.sin(r)) }, rays);
    });
    const glass = el('path', { d: 'M-14 22C-14 10 -34 2 -34 -18A34 34 0 1 1 34 -18C34 2 14 10 14 22Z', fill: C.paper }, a.body);
    el('path', { d: 'M-8 14V-4L0 4L8 -4V14', fill: 'none', 'stroke-width': f2(a.sw * 0.8) }, a.body);
    el('path', { d: 'M-15 22H15V40C15 46 10 50 4 50H-4C-10 50 -15 46 -15 40Z', fill: C.steel }, a.body);
    el('path', { d: 'M-15 31H15M-15 40H15', fill: 'none', 'stroke-width': f2(a.sw * 0.8) }, a.body);
    return {
      g: a.g,
      update({ t = 0, tIn, tOut, tOn } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const ton = tOn != null ? tOn : T(tIn) + 0.3, p = lin(t, ton, 0.25);
        set(glass, { fill: mix(C.paper, C.safety, p) });
        show(rays, p > 0);
        const breathe = 1 + 0.06 * Math.sin((t - (ton === -INF ? 0 : ton)) * Math.PI);
        set(rays, { opacity: f2(p), transform: `translate(0 -18) scale(${f2(lerp(0.7, 1, prog(t, ton, 0.3, ease.pop)) * breathe)}) translate(0 18)` });
      },
    };
  }

  function Book(parent, { size = 120 } = {}) {
    const a = absIcon(parent, size);
    el('path', { d: 'M0 2C-14 -6 -34 -6 -52 0V46C-34 40 -14 40 0 48Z', fill: C.paper }, a.body);
    el('path', { d: 'M0 2C14 -6 34 -6 52 0V46C34 40 14 40 0 48Z', fill: C.paper }, a.body);
    el('path', { d: 'M-42 12C-30 8 -18 8 -10 12M-42 22C-30 18 -18 18 -10 22M-42 32C-30 28 -18 28 -10 32', fill: 'none', stroke: C.steel, 'stroke-width': 3 }, a.body);
    const line = drawPath(a.body, 'M-36 -14L-14 -30L4 -22L34 -52', { stroke: C.correct, 'stroke-width': 7 });
    const head = el('path', { d: 'M22 -54L36 -54L36 -40', fill: 'none', stroke: C.correct, 'stroke-width': 7 }, a.body);
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const p = prog(t, T(tIn) + 0.2, 0.6);
        drawTo(line, p); set(head, { opacity: f2(lin(t, T(tIn) + 0.7, 0.15)) });
      },
    };
  }

  function Ladder(parent, { size = 120 } = {}) {
    const a = absIcon(parent, size);
    // Four stair steps, each a block with its own riser + tread outline, so the whole reads as stairs.
    const steps = [0, 1, 2, 3].map(i => {
      const x = -52 + i * 26, h = (i + 1) * 22;
      const sg = el('g', { transform: `translate(${x} 50)` }, a.body), s = el('g', {}, sg);
      el('rect', { x: 0, y: -h, width: 26, height: h, fill: i === 3 ? C.accent : C.paper, stroke: 'none' }, s);
      el('path', { d: `M0 ${-h + 22}V${-h}H26${i === 3 ? `V0` : ''}`, fill: 'none' }, s);
      return s;
    });
    el('line', { x1: -56, x2: 56, y1: 50, y2: 50 }, a.body);
    el('line', { x1: -52, x2: -52, y1: 50, y2: 28 }, a.body);
    const flag = el('g', { transform: 'translate(39 -38)' }, a.body);
    el('line', { x1: 0, y1: 0, x2: 0, y2: -34, 'stroke-width': 4 }, flag);
    el('path', { d: 'M0 -34L22 -27L0 -20Z', fill: C.correct }, flag);
    const arrow = drawPath(a.body, 'M-50 0L-20 -30M-20 -30H-34M-20 -30V-16', { stroke: C.ink, 'stroke-width': 5 });
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        steps.forEach((s, i) => { const p = prog(t, T(tIn) + 0.1 + 0.12 * i, 0.3, ease.pop); place(s, { s: [1, Math.max(0.001, p)] }); });
        const pf = prog(t, T(tIn) + 0.65, 0.3, ease.pop);
        set(flag, { transform: `translate(39 -38) scale(${f2(Math.max(0.001, pf))})` });
        drawTo(arrow, prog(t, T(tIn) + 0.8, 0.3));
      },
    };
  }

  function Handshake(parent, { size = 120 } = {}) {
    const a = absIcon(parent, size);
    const shake = el('g', {}, a.body), body = el('g', { transform: 'translate(0 4)' }, shake);
    const thin = f2(a.sw * 0.8);
    el('rect', { x: -60, y: -28, width: 24, height: 50, rx: 4, fill: C.shirt.worker }, body);
    el('rect', { x: 36, y: -28, width: 24, height: 50, rx: 4, fill: C.shirt.supervisor }, body);
    // Supervisor's hand comes from the right, lower; the worker's hand comes from the left, higher,
    // and its fingertips wrap down over the other hand; the supervisor's thumb rests on top.
    el('path', { d: 'M38 -10H0C-12 -10 -22 -2 -22 8C-22 18 -12 24 0 24H38Z', fill: C.skin }, body);
    [-2, 8, 18].forEach(x => el('rect', { x, y: -2, width: 10, height: 20, rx: 5, fill: C.skin, 'stroke-width': thin }, body));
    el('path', { d: 'M-38 -24H8C20 -24 28 -16 28 -6C28 2 22 8 14 8H-38Z', fill: C.skin }, body);
    el('path', { d: 'M-24 -24C-20 -34 0 -36 8 -24', fill: C.skin }, body);
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const u = t - T(tIn) - 0.3;
        place(shake, { y: u > 0 && u < 1.2 ? 4 * Math.sin(u * 16) * (1 - u / 1.2) : 0 });
      },
    };
  }

  function GlyphDisc(parent, { size = 120, color, glyph }) {
    const a = absIcon(parent, size);
    const wob = el('g', {}, a.body);
    el('circle', { r: 52, fill: color }, wob);
    if (glyph === '!') {
      el('rect', { x: -7, y: -34, width: 14, height: 42, rx: 7, fill: C.ink, stroke: 'none' }, wob);
      el('circle', { cy: 23, r: 8, fill: C.ink, stroke: 'none' }, wob);
    } else {
      el('path', { d: 'M-17 -16C-17 -30 -8 -36 1 -36C12 -36 19 -29 19 -19C19 -6 3 -4 3 10', fill: 'none', 'stroke-width': 13 }, wob);
      el('circle', { cx: 3, cy: 27, r: 8, fill: C.ink, stroke: 'none' }, wob);
    }
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        const u = t - T(tIn) - 0.25;
        place(wob, { r: u > 0 && u < 1 ? 8 * Math.sin(u * 18) * Math.exp(-u * 4) : 0 });
      },
    };
  }
  const QuestionMark = (parent, { size = 120, color = C.accent } = {}) => GlyphDisc(parent, { size, color, glyph: '?' });
  const ExclamationMark = (parent, { size = 120, color = C.safety } = {}) => GlyphDisc(parent, { size, color, glyph: '!' });

  function Moon(parent, { size = 120, badge = false } = {}) {
    const a = absIcon(parent, size);
    if (badge) el('circle', { r: 56, fill: C.bgDark }, a.body);
    // Crescent = outer circle (R, centre 0,0) minus inner circle (r, centre c).
    const R = badge ? 34 : 46, r = R * 0.86, cx = R * 0.45, cy = -R * 0.35;
    const d = Math.hypot(cx, cy), m = (R * R - r * r + d * d) / (2 * d), hh = Math.sqrt(R * R - m * m);
    const ux = cx / d, uy = cy / d, px = ux * m, py = uy * m;
    const p1 = [px - uy * hh, py + ux * hh], p2 = [px + uy * hh, py - ux * hh];
    const pt = q => `${f2(q[0])} ${f2(q[1])}`;
    el('path', { d: `M${pt(p1)}A${R} ${R} 0 1 1 ${pt(p2)}A${f2(r)} ${f2(r)} 0 0 0 ${pt(p1)}Z`, fill: C.safety }, a.body);
    if (badge) [[24, -24, 3], [34, 14, 2.5], [8, 30, 2]].forEach(([x, y, rr2]) => el('circle', { cx: x, cy: y, r: rr2, fill: C.paper, stroke: 'none' }, a.body));
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) { popIn(a.pop, t, tIn, tOut); },
    };
  }

  function Star(parent, { size = 120, color = C.accent } = {}) {
    const a = absIcon(parent, size);
    const spin = el('g', {}, a.body);
    let d = '';
    for (let i = 0; i < 10; i++) {
      const ang = (-90 + i * 36) * Math.PI / 180, rad = i % 2 ? 22 : 52;
      d += `${i ? 'L' : 'M'}${f2(rad * Math.cos(ang))} ${f2(rad * Math.sin(ang) + 4)}`;
    }
    el('path', { d: d + 'Z', fill: color }, spin);
    const sparks = [[44, -40, 1], [-46, -30, 0.7], [40, 40, 0.6]].map(([x, y, k]) => {
      const sg = el('g', { transform: `translate(${x} ${y})` }, a.body), s = el('g', {}, sg);
      el('path', { d: 'M0 -9V9M-9 0H9', fill: 'none', stroke: C.accent, 'stroke-width': 4 }, s);
      return [s, k];
    });
    return {
      g: a.g,
      update({ t = 0, tIn, tOut } = {}) {
        popIn(a.pop, t, tIn, tOut);
        place(spin, { r: 3 * Math.sin(t * Math.PI * 2 / 4) });
        sparks.forEach(([s, k], i) => {
          const ph = fmod(t * 0.8 + i * 0.37, 1);
          place(s, { s: Math.max(0.001, k * Math.sin(Math.PI * ph)), o: lin(t, T(tIn) + 0.3, 0.2) });
        });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Kit.Rings(parent, {count = 3, r0 = 40, r1 = 220, color = C.accent, period = 1.8, width = 4})
  //   Soft rings radiating outward (attitude is contagious). Pair with Kit.Handshake or a Worker.
  // update({t, tIn, tOut}): while on (tIn to tOut) rings grow from r0 to r1 and fade, staggered.
  //   Scenes can time "ring reaches a person" from radius(t) below.
  // Fields: radius(t, tIn, i) gives ring i's radius at t. Origin: centre.
  // ---------------------------------------------------------------------------------------------
  function Rings(parent, { count = 3, r0 = 40, r1 = 220, color = C.accent, period = 1.8, width = 4 } = {}) {
    const g = el('g', {}, parent), inner = el('g', {}, g);
    const rings = Array.from({ length: count }, () => el('circle', { r: r0, fill: 'none', stroke: color, 'stroke-width': width }, inner));
    const phase = (t, tIn, i) => (t - T(tIn, 0) - (i * period) / count) / period;
    const radius = (t, tIn, i) => lerp(r0, r1, ease.enter(fmod(phase(t, tIn, i), 1)));
    return {
      g, radius,
      update({ t = 0, tIn, tOut } = {}) {
        const off = 1 - lin(t, N(tOut) - 0.3, 0.3);
        rings.forEach((c, i) => {
          const ph = phase(t, tIn, i), started = tIn == null || ph >= 0, q = fmod(ph, 1);
          const o = started ? 0.85 * (1 - q) * off : 0;
          set(c, { r: f2(radius(t, tIn, i)), opacity: f2(o) }); show(c, o > 0.01);
        });
      },
    };
  }

  const ABSTRACT = ['Shield', 'Target', 'Lightbulb', 'Book', 'Ladder', 'Handshake', 'QuestionMark', 'ExclamationMark', 'Moon', 'Star'];

  Object.assign(window.Kit, {
    Icon, GreenCheck, RedX, Badge, Counter, Stamp, Callout, Heading, LowerThird, HazardStripe,
    SectionTitleCard, Checklist, DoDontPanel, ProgressTimeline, ThinkingDots, QuizCard, Panel, stripX,
    Tile, Clock, Calendar, HazardSign, Shield, Target, Lightbulb, Book, Ladder, Handshake,
    QuestionMark, ExclamationMark, Moon, Star, Rings,
  });
})();
