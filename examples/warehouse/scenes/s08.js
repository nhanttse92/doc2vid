// Scene s08: Attitude and Safety (packet sections 15, 16 and 17).
//   b01 attitude is contagious: rings from the Worker reach co-workers and a customer.
//   b02 four tiles: neat and clean / nothing hazardous near machinery, keep learning, find better ways,
//       share your career goals.
//   b03 Part VI title card, then three panels: weekly meeting, annual refresher, proper PPE.
//   b04 tools row, then the lifting Do / Don't and a two-person lift.
//   b05 authorised forklift operator, then box-cutter strokes (wrong first) and the blade retracting.
//   b06 hazmat bay, SDS from its wall holder, hose press and saw, certificate.
//   b07-b08 the general-rules checklist at left with one vignette per rule at right.
// Every time comes from ctx.beat / ctx.cue; render(t) is a pure function of t.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C, ease, show } = Kit;
  const SW = Kit.STROKE;
  const TAU = Math.PI * 2;
  const INF = Infinity;
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const prog = (t, t0, d, fn = ease.enter) => fn(lin(t, t0, d));
  const G = (p, a = {}) => el('g', a, p);
  const INK = (x = {}) => ({ stroke: C.ink, 'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...x });
  const f2 = v => Math.round(v * 100) / 100;
  const fmod = (a, b) => ((a % b) + b) % b;
  const hexs = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    p = clamp(p);
    const A = hexs(a), B = hexs(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
  };
  const steelLight = mix(C.steel, C.paper, 0.55);
  const hole = mix(C.cartonEdge, C.ink, 0.6);

  // STYLE §5 presence: fade + translate in from `from`, out toward `to`. Returns opacity.
  function vis(node, t, tIn, tOut = INF, { x = 0, y = 0, s = 1, r = 0, from = [0, 24], to = [0, -16], enter = 0.4, exit = 0.3 } = {}) {
    const pin = ease.enter(lin(t, tIn, enter));
    const pout = ease.exit(lin(t, tOut - exit, exit));
    const o = pin * (1 - pout);
    place(node, { x: x + from[0] * (1 - pin) + to[0] * pout, y: y + from[1] * (1 - pin) + to[1] * pout, s, r, o });
    show(node, o > 0.001);
    return o;
  }
  // Inverse of ease.enter by bisection (for "when does a ring reach this person").
  function invEnter(v) {
    v = clamp(v);
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ease.enter(m) < v) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  // Rows a Kit label wraps to (same rule as ui.js wrap), so content can line up across tiles.
  function wrapRows(str, size, weight, maxW) {
    let n = 0;
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const w of para.split(' ')) {
        const nx = line ? `${line} ${w}` : w;
        if (line && Kit.measure(nx, size, weight) > maxW) { n++; line = w; } else line = nx;
      }
      n++;
    }
    return n;
  }

  // A Worker in its own wrapper group so the scene can move, scale and fade it.
  function person(parent, opts, s = 1) {
    const wrap = G(parent);
    const w = Kit.Worker(wrap, { ...opts, stroke: SW / s });
    return { wrap, w, s };
  }
  function drive(p, t, { x, y, o = 1, k = 1 }, params) {
    place(p.wrap, { x, y, s: p.s * k, o });
    show(p.wrap, o > 0.001);
    if (o <= 0.001) return null;
    const a = p.w.update({ t, ...params });
    const P = q => (q ? [x + q[0] * p.s * k, y + q[1] * p.s * k] : null);
    return { head: P(a.head), face: P(a.face), chest: P(a.chest), hip: P(a.hip), hand: P(a.hand), hand2: P(a.hand2), prop: P(a.prop) };
  }

  // ------------------------------------------------------------------ scene-local assets
  // Arrow that draws on from its tail (origin) along +x; mirror with s: [-1, 1] to point left.
  function Arrow(parent, { len = 200, color = C.correct, width = 9 } = {}) {
    const g = G(parent);
    const line = el('path', { d: `M0 0H${len - 16}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g);
    const head = el('path', { d: 'M10 0L-14 -16L-14 16Z', fill: color, stroke: color, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    return {
      g,
      update(p) {
        p = clamp(p);
        set(line, { 'stroke-dashoffset': f2(1 - p) });
        show(line, p > 0.001); show(head, p > 0.001);
        place(head, { x: (len - 16) * p + 4, s: lerp(0.6, 1, ease.pop(lin(p, 0.6, 0.4))) });
      },
    };
  }

  // Snap-off box cutter, ~260 x 60 with the blade out. Origin: centre of the handle (the grip is at
  // x -84..8). update({blade 0..1 extension, click 0..1 motion-line flash}).
  function BoxCutter(parent) {
    const g = G(parent);
    const blade = G(g);
    el('path', { d: 'M0 -11H124L150 10H0Z', fill: C.paper, ...INK() }, blade);
    el('path', { d: 'M52 -11L70 10M80 -11L98 10M108 -11L126 10', fill: 'none', stroke: C.steel, 'stroke-width': 2.5 }, blade);
    el('path', { d: 'M-104 -12Q-104 -26 -90 -26H50L86 -11V13L64 26H-90Q-104 26 -104 12Z', fill: C.safety, ...INK() }, g);
    el('rect', { x: -86, y: -11, width: 94, height: 24, rx: 9, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
    [-68, -52, -36, -20, -4].forEach(x => el('line', { x1: x, y1: -5, x2: x, y2: 7, stroke: C.steel, 'stroke-width': 3, 'stroke-linecap': 'round' }, g));
    const slider = G(g);
    el('rect', { x: -14, y: -36, width: 30, height: 13, rx: 5, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, slider);
    el('path', { d: 'M-6 -32V-27M1 -32V-27M8 -32V-27', fill: 'none', stroke: C.steel, 'stroke-width': 2 }, slider);
    const click = el('path', { d: 'M-28 -48L-36 -62M-2 -52V-68M24 -48L32 -62', fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
    return {
      g,
      update({ blade: b = 1, click: c = 0 } = {}) {
        b = clamp(b);
        place(blade, { x: -76 + 76 * b });
        place(slider, { x: -22 + 36 * b });
        set(click, { opacity: f2(clamp(c)) }); show(click, c > 0.01);
      },
    };
  }

  // Tape gun icon, ~170 x 150. Origin: centre.
  function TapeGun(parent) {
    const g = G(parent);
    el('path', { d: 'M-4 14L-30 70Q-34 80 -24 82L-12 84Q-3 85 0 76L22 18Z', fill: C.steelDark, ...INK() }, g);
    el('path', { d: 'M-44 4H60L78 30H56L48 18H-44Z', fill: C.steel, ...INK() }, g);
    el('path', { d: 'M22 -10L66 26', fill: 'none', stroke: C.cartonEdge, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: -12, cy: -28, r: 44, fill: C.carton, ...INK() }, g);
    el('circle', { cx: -12, cy: -28, r: 30, fill: 'none', stroke: C.cartonEdge, 'stroke-width': 2 }, g);
    el('circle', { cx: -12, cy: -28, r: 18, fill: C.paper, ...INK() }, g);
    el('circle', { cx: -12, cy: -28, r: 6, fill: C.steelDark }, g);
    el('circle', { cx: 66, cy: 28, r: 10, fill: steelLight, ...INK() }, g);
    el('path', { d: 'M74 40L79 46L84 40L89 46L94 40', fill: 'none', ...INK({ 'stroke-width': 2.5 }) }, g);
    return { g };
  }

  // Hand truck with a carton on its toe plate, front view, ~120 x 250. Origin: bottom-centre.
  function HandTruck(parent) {
    const g = G(parent);
    [-44, 44].forEach(x => {
      el('circle', { cx: x, cy: -22, r: 22, fill: C.ink, ...INK() }, g);
      el('circle', { cx: x, cy: -22, r: 8, fill: C.steel }, g);
    });
    const rail = d => {
      el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 10 + 2 * SW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      el('path', { d, fill: 'none', stroke: C.steel, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    };
    rail('M-34 -20V-214Q-34 -240 0 -240Q34 -240 34 -214V-20');
    rail('M-34 -170H34M-34 -110H34');
    el('rect', { x: -28, y: -150, width: 56, height: 128, rx: 3, fill: C.carton, ...INK() }, g);
    el('path', { d: 'M-28 -122H28', stroke: C.cartonEdge, 'stroke-width': 3 }, g);
    el('rect', { x: -50, y: -22, width: 100, height: 14, rx: 3, fill: C.steelDark, ...INK() }, g);
    return { g };
  }

  // Gear with n teeth, steel, ink outline, dark hub. Origin: centre. update(angle in degrees).
  function Gear(parent, { r = 60, n = 10 } = {}) {
    const g = G(parent), spin = G(g);
    const ri = r - 14, step = TAU / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = i * step;
      const pts = [[a, ri], [a + step * 0.12, r], [a + step * 0.38, r], [a + step * 0.5, ri]];
      pts.forEach(([ang, rad], j) => { d += `${i === 0 && j === 0 ? 'M' : 'L'}${f2(rad * Math.cos(ang))} ${f2(rad * Math.sin(ang))}`; });
      d += `A${ri} ${ri} 0 0 1 ${f2(ri * Math.cos(a + step))} ${f2(ri * Math.sin(a + step))}`;
    }
    el('path', { d: d + 'Z', fill: C.steel, ...INK() }, spin);
    el('circle', { r: r * 0.36, fill: C.steelDark, ...INK() }, spin);
    el('circle', { r: r * 0.13, fill: C.bgLight, ...INK({ 'stroke-width': 2 }) }, spin);
    [0, 1, 2].forEach(i => el('circle', { cx: f2(r * 0.55 * Math.cos(i * TAU / 3)), cy: f2(r * 0.55 * Math.sin(i * TAU / 3)), r: r * 0.08, fill: C.steelDark }, spin));
    return { g, update(angle) { place(spin, { r: angle }); } };
  }

  // Open-end wrench, ~250 x 66. Origin: centre. cracked: zigzag crack plus a pulsing error halo.
  function Wrench(parent, { cracked = false } = {}) {
    const g = G(parent);
    const shapes = [
      ['path', { d: 'M-112 0A28 28 0 1 1 -112 0.1Z' }],
      ['rect', { x: -96, y: -12, width: 182, height: 24, rx: 10 }],
      ['path', { d: 'M78 -16L96 -32Q124 -36 132 -14L116 -9L106 -16V16L116 9L132 14Q124 36 96 32L78 16Z' }],
    ];
    const halo = cracked ? G(g) : null;
    if (halo) shapes.forEach(([tag, a]) => el(tag, { ...a, fill: 'none', stroke: C.error, 'stroke-width': 14, 'stroke-linejoin': 'round' }, halo));
    shapes.forEach(([tag, a]) => el(tag, { ...a, fill: 'none', stroke: C.ink, 'stroke-width': 2 * SW, 'stroke-linejoin': 'round' }, g));
    shapes.forEach(([tag, a]) => el(tag, { ...a, fill: C.steel }, g));
    el('circle', { cx: -112, cy: 0, r: 12, fill: C.paper, ...INK() }, g);
    el('path', { d: 'M-74 -4H60', stroke: steelLight, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    if (cracked) el('path', { d: 'M4 -12L14 -3L5 3L16 12', fill: 'none', stroke: C.error, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    return { g, update({ t = 0, alert = 1 } = {}) { if (halo) set(halo, { opacity: f2(alert * (0.75 + 0.25 * Math.cos(TAU * t))) }); } };
  }

  // Stop sign on a post. Origin: foot of the post on the floor; sign centre at y = -(post + 0).
  function StopSign(parent, { post = 300 } = {}) {
    const g = G(parent);
    el('rect', { x: -7, y: -post, width: 14, height: post, fill: C.steel, ...INK() }, g);
    const oct = r => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * TAU / 8; return `${f2(r * Math.cos(a))} ${f2(r * Math.sin(a) - post)}`; }).join('L');
    el('path', { d: `M${oct(66)}Z`, fill: C.error, ...INK() }, g);
    el('path', { d: `M${oct(56)}Z`, fill: 'none', stroke: C.paper, 'stroke-width': 4 }, g);
    Kit.text(g, 'STOP', { x: 0, y: -post + 12, size: 34, weight: 800, fill: C.paper, anchor: 'middle' });
    return { g };
  }

  // Emergency stations for the wall board (origins: bottom-centre on the board's base line).
  function Extinguisher(parent) {
    const g = G(parent);
    el('path', { d: 'M10 -150C34 -150 40 -120 38 -70', fill: 'none', ...INK({ 'stroke-width': 7 }) }, g);
    el('rect', { x: 32, y: -74, width: 12, height: 26, rx: 3, fill: C.ink }, g);
    el('path', { d: 'M-26 -112Q-26 -136 0 -136Q26 -136 26 -112V-4Q26 0 22 0H-22Q-26 0 -26 -4Z', fill: C.error, ...INK() }, g);
    el('rect', { x: -20, y: -96, width: 40, height: 40, rx: 4, fill: C.paper, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: 'M1 -88C5 -82 10 -78 10 -72C10 -66 6 -62 0 -62C-6 -62 -10 -66 -10 -72C-10 -77 -6 -80 -3 -84C-2 -80 0 -79 1 -78C1 -82 0 -85 1 -88Z', fill: C.error }, g);
    el('rect', { x: -9, y: -152, width: 18, height: 18, rx: 3, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: 'M-6 -152L-30 -166M4 -152L22 -160', fill: 'none', ...INK({ 'stroke-width': 5 }) }, g);
    el('rect', { x: -32, y: -40, width: 64, height: 10, rx: 3, fill: C.steel, ...INK({ 'stroke-width': 2 }) }, g);
    return { g };
  }
  function EyeWash(parent) {
    const g = G(parent);
    el('rect', { x: -48, y: -172, width: 96, height: 58, rx: 8, fill: C.correct, ...INK() }, g);
    el('path', { d: 'M-24 -143Q0 -164 24 -143Q0 -122 -24 -143Z', fill: C.paper, ...INK({ 'stroke-width': 2 }) }, g);
    el('circle', { cx: 0, cy: -143, r: 6, fill: C.ink }, g);
    el('path', { d: 'M32 -158C35 -153 37 -150 37 -147A5 5 0 0 1 27 -147C27 -150 29 -153 32 -158Z', fill: C.paper }, g);
    el('rect', { x: -7, y: -78, width: 14, height: 78, fill: C.steel, ...INK() }, g);
    el('path', { d: 'M-52 -92H52Q46 -66 0 -66Q-46 -66 -52 -92Z', fill: steelLight, ...INK() }, g);
    el('rect', { x: -26, y: -104, width: 12, height: 14, rx: 3, fill: C.correct, ...INK({ 'stroke-width': 2 }) }, g);
    el('rect', { x: 14, y: -104, width: 12, height: 14, rx: 3, fill: C.correct, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: 'M52 -86L70 -86', fill: 'none', ...INK({ 'stroke-width': 4 }) }, g);
    el('rect', { x: 68, y: -100, width: 18, height: 28, rx: 4, fill: C.safety, ...INK({ 'stroke-width': 2 }) }, g);
    return { g };
  }
  function FirstAid(parent) {
    const g = G(parent);
    el('rect', { x: -22, y: -150, width: 44, height: 14, rx: 6, fill: C.steelDark, ...INK() }, g);
    el('rect', { x: -58, y: -140, width: 116, height: 96, rx: 10, fill: C.correct, ...INK() }, g);
    el('path', { d: 'M-10 -120H10V-102H28V-82H10V-64H-10V-82H-28V-102H-10Z', fill: C.paper, ...INK({ 'stroke-width': 2 }) }, g);
    el('line', { x1: -58, x2: 58, y1: -126, y2: -126, stroke: C.ink, 'stroke-width': 2 }, g);
    return { g };
  }

  // Paper speech bubble with a pointer at the bottom centre. Origin: pointer tip.
  function Bubble(parent, { w = 190, h = 136 } = {}) {
    const g = G(parent), body = G(g);
    const r = 14, ph = 18, pw = 14;
    const d = `M${-w / 2 + r} ${-h - ph}H${w / 2 - r}A${r} ${r} 0 0 1 ${w / 2} ${-h - ph + r}V${-ph - r}A${r} ${r} 0 0 1 ${w / 2 - r} ${-ph}H${pw}L0 0L${-pw} ${-ph}H${-w / 2 + r}A${r} ${r} 0 0 1 ${-w / 2} ${-ph - r}V${-h - ph + r}A${r} ${r} 0 0 1 ${-w / 2 + r} ${-h - ph}Z`;
    el('path', { d, fill: C.paper, ...INK() }, body);
    const inner = G(body);
    place(inner, { y: -ph - h / 2 });
    return { g, body, inner };
  }

  // A plain card (paper, 16 px radius, 1 px steel border), origin top-left.
  function Card(parent, w, h) {
    const g = G(parent);
    el('rect', { width: w, height: h, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, g);
    return g;
  }

  // Floor band inside a panel slot.
  const floorBand = (parent, y, w, h) => el('rect', { x: -2, y, width: w + 4, height: h, fill: C.floor }, parent);

  Engine.scene('s08', {
    build(ctx) {
      const R = ctx.root;
      const B = id => ctx.beat(id);
      const cue = (id, phrase, nth) => ctx.cue(id, phrase, nth);
      const ids = ctx.beats.map(b => b.id);
      const nextStart = id => { const i = ids.indexOf(id); return i + 1 < ids.length ? B(ids[i + 1]).start : INF; };
      const OUT = id => nextStart(id) + 0.3; // things leave in the first 0.3 s of the next beat
      const fns = [];
      const on = f => fns.push(f);
      // Only update a group's contents while it can be seen.
      const live = (t, a, b) => t >= a - 0.05 && t <= b + 0.05;

      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, R);
      const stage = G(R);
      const ltLayer = G(R);
      const cardLayer = G(R);

      const b3 = B('s08b03');
      const tWipe = Math.max(b3.start + 2.0, cue('s08b03', 'safety is everyone') - 0.2);

      // ---------------------------------------------------------------- lower third
      const lt = Kit.LowerThird(ltLayer, { texts: ['15. Personal Improvement', '16. Warehouse Safety', '17. General Safety Practices'] });
      const ltTimes = [0.7, tWipe + 0.5, B('s08b07').start + 0.2];
      on(t => lt.update({ t, times: ltTimes }));

      // ---------------------------------------------------------------- b01 attitude is contagious
      {
        const id = 's08b01', tOut = OUT(id);
        const g = G(stage);
        const FL = 800, CX = 960, SC = 1.35, SO = 1.15;
        const floorG = G(g);
        el('rect', { x: 0, y: FL - 44, width: 1920, height: 1080 - FL + 44, fill: C.floor }, floorG);
        const R0 = 70, R1 = 820, PER = 3.2;
        const rings = Kit.Rings(G(g), { count: 3, r0: R0, r1: R1, period: PER, width: 5 });
        place(rings.g, { x: CX, y: FL - 165 * SC });
        const tRings = cue(id, 'contagious') - 0.3;
        const tFellow = cue(id, 'your fellow workers');
        const others = [
          { x: 300, v: 'driver', f: 1, tIn: tFellow },
          { x: 620, v: 'worker', f: 1, tIn: tFellow + 0.12 },
          { x: 1300, v: 'manager', f: -1, tIn: tFellow + 0.24 },
          { x: 1620, v: 'customer', f: -1, tIn: cue(id, 'your customers') },
        ].map((d, i) => {
          const p = person(g, { variant: d.v, facing: d.f, seed: 31 + i }, SO);
          const D = Math.abs(d.x - CX) - 52;
          return { ...d, p, touch: tRings + invEnter((D - R0) / (R1 - R0)) * PER };
        });
        const hero = person(g, { variant: 'worker', seed: 30 }, SC);
        const tHero = 0.9, tThumb = cue(id, 'your own attitude');
        const heading = Kit.Heading(g, { text: 'A good attitude is contagious' });
        const tHead = cue(id, 'a good attitude');
        const callout = Kit.Callout(g, { text: 'Yours to own and manage', pointer: 'down' });
        place(callout.g, { x: CX + 6, y: FL - 262 * SC - 16 });
        const tCall = cue(id, 'yours to own');
        on(t => {
          if (!live(t, -1, tOut)) { show(g, false); return; }
          show(g, true);
          vis(floorG, t, -1, tOut, { from: [0, 0], to: [0, 0] });
          rings.update({ t, tIn: tRings, tOut });
          for (const d of others) {
            const pin = ease.enter(lin(t, d.tIn, 0.4)), pout = ease.exit(lin(t, tOut - 0.3, 0.3));
            const lit = ease.enter(lin(t, d.touch, 0.3));
            const o = pin * (1 - pout) * lerp(0.35, 1, lit);
            const k = 1 + 0.05 * Math.sin(Math.PI * lin(t, d.touch, 0.35));
            drive(d.p, t, { x: d.x, y: FL + 24 * (1 - pin) - 16 * pout, o, k }, { ...Kit.Worker.poseAt(t, [[-1, 'stand'], [d.touch, 'thumbs-up']]), facing: d.f });
          }
          const pin = ease.enter(lin(t, tHero, 0.4)), pout = ease.exit(lin(t, tOut - 0.3, 0.3));
          drive(hero, t, { x: CX, y: FL + 24 * (1 - pin) - 16 * pout, o: pin * (1 - pout) }, Kit.Worker.poseAt(t, [[-1, 'stand'], [tThumb, 'thumbs-up']]));
          heading.update({ t, tIn: tHead, tOut });
          callout.update({ t, tIn: tCall, tOut });
        });
      }

      // ---------------------------------------------------------------- b02 four tiles
      {
        const id = 's08b02', b = B(id), tOut = OUT(id);
        const g = G(stage);
        const TW = 320, TH = 640, TY = 170, FY = 505;
        const defs = [
          { x: 90, label: 'Neat and clean', tIn: cue(id, 'keep it neat'), mark: 'check' },
          { x: 430, label: 'Nothing hazardous\nnear machinery', tIn: cue(id, 'avoid wearing'), mark: 'x' },
          { x: 790, label: 'Keep learning', tIn: cue(id, 'keep growing') },
          { x: 1150, label: 'Find better ways', tIn: cue(id, 'find better ways') - 0.3 },
          { x: 1510, label: 'Share your\ncareer goals', tIn: cue(id, 'tell your supervisor') },
        ];
        const tiles = defs.map(d => {
          const tile = Kit.Tile(g, { label: d.label, width: TW, height: TH });
          place(tile.g, { x: d.x, y: TY });
          const labH = 24 + wrapRows(d.label, 30, 600, TW - 40) * 38;
          const cg = G(tile.slot);
          place(cg, { y: -((TH - labH) / 2 + 6) }); // content coords: x from tile centre, y from tile top
          return { ...d, tile, cg };
        });
        // Tile 1: neat Worker.
        const neat = person(tiles[0].cg, { seed: 41 }, 1.3);
        // Tile 2: scarf near a turning gear.
        const t1 = tiles[1].cg;
        el('rect', { x: 14, y: 228, width: 126, height: 277, rx: 8, fill: C.steelDark, ...INK() }, t1);
        el('path', { d: 'M14 470H140', stroke: C.ink, 'stroke-width': 2 }, t1);
        const ringD = el('circle', { cx: 72, cy: 326, r: 68, fill: 'none', stroke: C.error, 'stroke-width': 4, 'stroke-dasharray': '12 9' }, t1);
        const gear = Gear(t1, { r: 52, n: 10 });
        place(gear.g, { x: 72, y: 326 });
        const scarfP = person(t1, { seed: 42 }, 1.2);
        const scarfG = G(t1);
        const scarfT = el('path', { fill: C.accent, ...INK() }, scarfG);
        const scarfS = el('path', { fill: 'none', stroke: C.paper, 'stroke-width': 4, 'stroke-linecap': 'round' }, scarfG);
        const scarfE = el('path', { fill: 'none', ...INK({ 'stroke-width': 2.5 }) }, scarfG);
        const scarfN = el('rect', { width: 50, height: 18, rx: 9, fill: C.accent, ...INK() }, scarfG);
        // Tile 3: book with a rising line.
        const bookG = G(tiles[2].cg);
        const book = Kit.Book(bookG, { size: 210 });
        // Tile 4: lightbulb over a rack.
        const rackG = G(tiles[3].cg);
        place(rackG, { x: 0, y: FY });
        const rack = Kit.PalletRack(G(rackG), { contents: ['carton'] });
        place(rack.g, { x: -8, s: 0.4 });
        const noLabels = Array.from({ length: 9 }, () => ({ labelOn: 0 }));
        const bulbG = G(tiles[3].cg);
        const bulb = Kit.Lightbulb(bulbG, { size: 130 });
        // Tile 5: Worker and Supervisor sharing a career-plan bubble.
        const tw = person(tiles[4].cg, { seed: 43 }, 0.98);
        const sup = person(tiles[4].cg, { variant: 'supervisor', facing: -1, seed: 44 }, 0.98);
        const bub = Bubble(tiles[4].cg, { w: 190, h: 136 });
        place(bub.g, { x: 0, y: 244 });
        const ladder = Kit.Ladder(bub.inner, { size: 104 });
        on(t => {
          if (!live(t, defs[0].tIn, tOut)) { show(g, false); return; }
          show(g, true);
          tiles.forEach(d => d.tile.update({ t, tIn: d.tIn, tOut, mark: d.mark || 'none', tMark: d.tIn + 0.6 }));
          const bob = (ph) => 1.5 * Math.sin(TAU * t / 3 + ph);
          if (t >= defs[0].tIn) drive(neat, t, { x: 0, y: FY }, { pose: 'neat' });
          if (t >= defs[1].tIn) {
            gear.update(t * 70);
            set(ringD, { opacity: f2(lin(t, defs[1].tIn + 0.5, 0.3) * (0.7 + 0.3 * Math.cos(TAU * t))) });
            const a = drive(scarfP, t, { x: -78, y: FY }, { pose: 'stand', lean: 4 });
            // Scarf: a band round the neck and a loose tail that swings into the gear teeth.
            const n = [lerp(a.face[0], a.chest[0], 0.55) + 6, lerp(a.face[1], a.chest[1], 0.5) + 4];
            const sw = Math.sin(TAU * t / 1.3);
            const P0 = n, P1 = [n[0] + 30, n[1] + 46], P2 = [18 + 10 * sw, 326], P3 = [42 + 8 * sw, 384 + 3 * sw];
            const bz = (u, i) => (1 - u) ** 3 * P0[i] + 3 * (1 - u) ** 2 * u * P1[i] + 3 * (1 - u) * u * u * P2[i] + u ** 3 * P3[i];
            const L = [], Rr = [];
            for (let k = 0; k <= 12; k++) {
              const u = k / 12, x = bz(u, 0), y = bz(u, 1);
              const dx = bz(Math.min(1, u + 0.01), 0) - bz(Math.max(0, u - 0.01), 0), dy = bz(Math.min(1, u + 0.01), 1) - bz(Math.max(0, u - 0.01), 1);
              const len = Math.hypot(dx, dy) || 1, hw = 8 + 3 * u + 1.2 * Math.sin(u * 9 + t * 4);
              L.push([x - dy / len * hw, y + dx / len * hw]); Rr.push([x + dy / len * hw, y - dx / len * hw]);
            }
            const pts = L.concat(Rr.reverse());
            set(scarfT, { d: 'M' + pts.map(q => `${f2(q[0])} ${f2(q[1])}`).join('L') + 'Z' });
            const sl = u => { const i = Math.round(u * 12); return `M${f2(L[i][0])} ${f2(L[i][1])}L${f2(Rr[12 - i][0])} ${f2(Rr[12 - i][1])}`; };
            set(scarfS, { d: sl(0.6) + sl(0.78) });
            const e0 = L[12], e1 = Rr[0];
            let fr = '';
            for (let k = 0; k < 4; k++) { const u = (k + 0.5) / 4, x = lerp(e0[0], e1[0], u), y = lerp(e0[1], e1[1], u); fr += `M${f2(x)} ${f2(y)}l${f2(2 + 2 * sw)} 12`; }
            set(scarfE, { d: fr });
            set(scarfN, { x: f2(n[0] - 25), y: f2(n[1] - 11) });
          }
          if (t >= defs[2].tIn) { book.update({ t, tIn: defs[2].tIn + 0.15 }); place(bookG, { y: 300 + bob(0) }); }
          if (t >= defs[3].tIn) {
            rack.update({ state: 'stocked', bins: noLabels, t });
            bulb.update({ t, tIn: defs[3].tIn + 0.2, tOn: defs[3].tIn + 0.6 });
            place(bulbG, { y: 168 + bob(1) });
          }
          if (t >= defs[4].tIn) {
            const t4 = defs[4].tIn;
            drive(tw, t, { x: -76, y: FY }, { pose: 'stand', nod: Math.max(0, Math.sin(Math.PI * lin(t, t4 + 1.4, 0.7))) });
            drive(sup, t, { x: 78, y: FY }, { pose: 'hold-clipboard', writing: t > t4 + 1.6, facing: -1 });
            const pb = prog(t, t4 + 0.35, 0.3, ease.pop);
            place(bub.body, { s: Math.max(0.001, pb), y: bob(2) * 0.6, o: lin(t, t4 + 0.35, 0.12) });
            ladder.update({ t, tIn: t4 + 0.55 });
          }
        });
      }

      // ---------------------------------------------------------------- b03 Part VI title card + three panels
      {
        const id = 's08b03', b = b3, tOut = OUT(id);
        const card = Kit.SectionTitleCard(cardLayer, { part: 'Part VI', title: 'Safety', sub: '16. Warehouse Safety', hazard: true });
        const g = G(stage);
        const xs = Kit.stripX(3, 520, 40), PY = 150, PH = 680;
        const pIn = b.start + 0.6;
        const caps = ['Weekly safety meeting', 'Annual refresher training', 'Proper PPE'];
        const panels = caps.map((c, i) => { const p = Kit.Panel(g, { width: 520, height: PH, caption: c }); place(p.g, { x: xs[i], y: PY }); return p; });
        const AH = panels[0].areaH;
        const cal = Kit.Calendar(panels[0].slot, { title: 'Every week', yearEnd: false, markerCol: 1 });
        place(cal.g, { x: 50, y: (AH - 360) / 2 });
        const tWeek = cue(id, 'weekly safety meeting');
        const marks = [0, 1, 2, 3, 4].map(i => tWeek + 0.15 + 0.22 * i);
        const certW = G(panels[1].slot);
        const cert = Kit.Certificate(certW, { loop: true });
        const tAnnual = cue(id, 'annual refresher');
        floorBand(panels[2].slot, AH - 70, 520, 70);
        const ppeW = person(panels[2].slot, { seed: 45 }, 1.5);
        const tPPE = cue(id, 'proper personal protective');
        on(t => {
          // Title card: fades up over the end of b02, holds, then wipes up.
          show(card.g, t >= b.start && t < tWipe + 0.7);
          if (t >= b.start && t < tWipe + 0.7) {
            place(card.g, { o: lin(t, b.start, 0.4) });
            card.update({ t, tIn: b.start, tWipe });
          }
          if (!live(t, pIn, tOut)) { show(g, false); return; }
          show(g, true);
          panels.forEach((p, i) => p.update({ t, tIn: pIn + 0.1 * i, tOut, from: 'below' }));
          cal.update({ t, tIn: pIn + 0.2, markers: marks });
          place(certW, { x: 110, y: (AH - 220) / 2 + 10 + 1.5 * Math.sin(TAU * t / 3.2) });
          cert.update({ seal: 1, loop: lin(t, tAnnual, 1.3), check: lin(t, tAnnual + 1.45, 0.3) });
          drive(ppeW, t, { x: 260, y: AH - 44 }, { pose: 'stand', ppe: Kit.Worker.ppeAt(t, tPPE, 0.3, 0.3) });
        });
      }

      // ---------------------------------------------------------------- b04 tools, lifting, assistance
      {
        const id = 's08b04', b = B(id), tOut = OUT(id);
        const g = G(stage);
        const tB = cue(id, 'serious injury');
        // Phase A: Know your tools.
        const headA = Kit.Heading(g, { text: 'Know your tools' });
        const tools = [0, 1, 2, 3].map(i => {
          const cg = G(g), c = Card(cg, 340, 340), art = G(c);
          const chk = Kit.GreenCheck(c, { size: 44 });
          place(chk.g, { x: 306, y: 34 });
          return { cg, art, chk, x: 220 + i * 380, y: 370, tIn: b.start + 0.3 + 0.1 * i, tChk: Math.min(b.start + 1.1 + 0.45 * i, tB - 0.4) };
        });
        const broom = Kit.Broom(tools[0].art);
        place(broom.g, { x: 170, y: 296, s: 1.15 });
        const cutterA = BoxCutter(tools[1].art);
        place(cutterA.g, { x: 158, y: 176, s: 1.1, r: -24 });
        cutterA.update({ blade: 1 });
        place(TapeGun(tools[2].art).g, { x: 168, y: 162, s: 1.25 });
        place(HandTruck(tools[3].art).g, { x: 170, y: 306, s: 1.1 });
        // Phase B: lifting Do / Don't.
        const headB = Kit.Heading(g, { text: 'Lift with bent knees, no twisting' });
        const dd = Kit.DoDontPanel(g, { width: 1080, rows: 1, rowHeight: 560 });
        place(dd.g, { x: 80, y: 200 });
        const tDont = tB + 0.6, tDo = Math.max(tDont + 1.4, cue(id, 'follow the guidelines'));
        const bad = person(dd.slot(0, 'dont'), { seed: 46 }, 1.4);
        const good = person(dd.slot(0, 'do'), { seed: 47 }, 1.4);
        // Two-person lift.
        const tAsk = cue(id, 'ask for assistance') - 0.2;
        const pan = Kit.Panel(g, { width: 640, height: 560, caption: 'Heavy? Ask for assistance' });
        place(pan.g, { x: 1200, y: 292 });
        const PF = pan.areaH - 70;
        floorBand(pan.slot, PF, 640, 80);
        const boxG = G(pan.slot);
        const box = Kit.Carton(boxG, { w: 190, h: 150, d: 70 });
        const liftL = person(pan.slot, { seed: 48 }, 1.15);
        const liftR = person(pan.slot, { seed: 49, facing: -1 }, 1.15);
        const strain = el('path', { d: 'M-118 -40L-134 -40M-118 -70L-136 -76M118 -40L134 -40M118 -70L136 -76', fill: 'none', ...INK({ 'stroke-width': 3 }) }, boxG);
        const tL = tAsk + 1.0;
        on(t => {
          if (!live(t, b.start, tOut)) { show(g, false); return; }
          show(g, true);
          headA.update({ t, tIn: b.start + 0.3, tOut: tB + 0.3 });
          tools.forEach(d => {
            const o = vis(d.cg, t, d.tIn, tB + 0.3, { x: d.x, y: d.y + 1.5 * Math.sin(TAU * t / 3 + d.x) });
            if (o > 0) d.chk.update({ t, tIn: d.tChk });
          });
          headB.update({ t, tIn: tB + 0.35, tOut });
          dd.update({ t, tIn: tB + 0.3, tOut, rows: [{ dont: tDont, do: tDo }] });
          if (t >= tDont) drive(bad, t, { x: 210, y: 520 }, { pose: 'lift-bad' });
          if (t >= tDo) {
            // Squat, lift with the legs, hold, lower; repeats as idle life.
            const u = fmod(t - (tDo + 0.9), 4.6);
            const k = t < tDo + 0.9 ? 0 : u < 1.4 ? 0 : u < 2.2 ? Engine.ease.inOut((u - 1.4) / 0.8) : u < 3.8 ? 1 : 1 - Engine.ease.inOut((u - 3.8) / 0.8);
            drive(good, t, { x: 220, y: 520 }, { pose: 'carry-carton', from: 'lift-bent-knees', blend: k });
          }
          pan.update({ t, tIn: tAsk, tOut, from: 'right', mark: 'check', tMark: tL + 1.0 });
          if (t >= tAsk) {
            const k = Engine.ease.inOut(lin(t, tL, 0.9)), lift = 64 * k;
            place(boxG, { x: 300, y: PF - lift });
            box.update({ t, tape: 1 });
            set(strain, { opacity: f2(lin(t, tL + 0.2, 0.2) * (1 - lin(t, tL + 1.6, 0.4)) * (0.6 + 0.4 * Math.sin(TAU * t * 2))) });
            const hy = -(75 + lift) / 1.15;
            drive(liftL, t, { x: 135, y: PF }, { pose: 'stand', from: 'lift-bent-knees', blend: k, prop: false, reach: [(205 - 135) / 1.15 - 4, hy], reach2: [(205 - 135) / 1.15 + 4, hy - 8] });
            drive(liftR, t, { x: 510, y: PF }, { pose: 'stand', from: 'lift-bent-knees', blend: k, prop: false, facing: -1, reach: [(510 - 428) / 1.15 - 4, hy - 14], reach2: [(510 - 428) / 1.15 + 4, hy - 22] });
          }
        });
      }

      // ---------------------------------------------------------------- b05 authorised operators, box cutter
      {
        const id = 's08b05', b = B(id), tOut = OUT(id);
        const g = G(stage);
        const pA = Kit.Panel(g, { width: 1000, height: 700, caption: 'Trained and authorised only' });
        place(pA.g, { x: 80, y: 150 });
        const AF = pA.areaH - 110;
        floorBand(pA.slot, AF, 1000, 120);
        const fork = Kit.Forklift(G(pA.slot), { driver: true });
        place(fork.g, { x: 330, y: AF });
        const authG = G(pA.slot);
        place(authG, { x: 290, y: AF - 352 });
        const auth = Kit.Badge(authG, { text: 'Authorised', variant: 'correct', height: 48, size: 28 });
        const tAuth = cue(id, 'proper training');
        const walker = person(pA.slot, { seed: 50, facing: -1 }, 1.15);
        const tW0 = cue(id, 'only authorised'), speed = Kit.Worker.WALK_SPEED * 0.8 * 1.15;
        const X0 = 1070, X1 = 760, tW1 = tW0 + (X0 - X1) / speed;
        const stopX = Kit.RedX(pA.slot, { size: 64 });
        place(stopX.g, { x: 650, y: AF - 190 });

        const pB = Kit.Panel(g, { width: 720, height: 700, caption: 'Box cutters and knives: use caution' });
        place(pB.g, { x: 1120, y: 150 });
        const BF = pB.areaH - 110;
        floorBand(pB.slot, BF, 720, 120);
        const tB0 = cue(id, 'improper use') - 0.2;
        const cutG = G(pB.slot); // behind the Worker, so the near hand sits on the grip
        const user = person(pB.slot, { seed: 51 }, 1.35);
        const cutter = BoxCutter(cutG);
        const arrowBad = Arrow(pB.slot, { len: 220, color: C.error });
        const arrowGood = Arrow(pB.slot, { len: 220, color: C.correct });
        const markBad = Kit.RedX(pB.slot, { size: 48 }), markGood = Kit.GreenCheck(pB.slot, { size: 48 });
        const cautionG = G(pB.slot);
        const caution = Kit.Badge(cautionG, { text: 'Caution', variant: 'safety' });
        const tWrong = cue(id, 'one of the largest'), tRight = Math.max(tWrong + 1.6, cue(id, 'so use caution') - 0.4);
        const tRetract = Math.max(tRight + 1.2, cue(id, 'box cutters and knives'));
        const UX = 130, HY = -150; // user position; hand height (local)
        on(t => {
          if (!live(t, b.start, tOut)) { show(g, false); return; }
          show(g, true);
          pA.update({ t, tIn: b.start + 0.3, tOut, from: 'left' });
          fork.update({ state: 'idle', t });
          auth.update({ t, tIn: tAuth });
          const wx = t < tW0 ? X0 : t < tW1 ? X0 - speed * (t - tW0) : X1;
          drive(walker, t, { x: wx, y: AF }, { ...Kit.Worker.poseAt(t, [[-1, 'walk'], [tW1, 'stand']]), stride: 0.8, facing: -1, nod: 0.6 * Math.sin(Math.PI * lin(t, tW1 + 0.4, 0.8)) });
          stopX.update({ t, tIn: tW1 + 0.05 });

          pB.update({ t, tIn: tB0, tOut, from: 'right' });
          if (t >= tB0) {
            // Hand x (local): 116 at rest; wrong stroke pulls toward the body, right stroke pushes away.
            const hx = Engine.keys(t, [[tWrong, 120], [tWrong + 0.6, 42], [tRight, 42], [tRight + 0.6, 120]], Engine.ease.inOut);
            const a = drive(user, t, { x: UX, y: BF }, { pose: 'stand', reach: [hx, HY] });
            const hand = a ? a.hand : [UX + hx * 1.35, BF + HY * 1.35];
            place(cutG, { x: hand[0] + 40, y: hand[1] + 2, s: 1.05 });
            cutter.update({ blade: 1 - lin(t, tRetract, 0.22), click: lin(t, tRetract + 0.2, 0.06) * (1 - lin(t, tRetract + 0.45, 0.2)) });
            const ay0 = BF + HY * 1.35;
            place(arrowBad.g, { x: 560, y: ay0 - 112, s: [-1, 1] });
            arrowBad.update(prog(t, tWrong, 0.6, Engine.ease.inOut));
            place(markBad.g, { x: 610, y: ay0 - 112 });
            markBad.update({ t, tIn: tWrong + 0.55 });
            place(arrowGood.g, { x: 340, y: ay0 + 112 });
            arrowGood.update(prog(t, tRight, 0.6, Engine.ease.inOut));
            place(markGood.g, { x: 610, y: ay0 + 112 });
            markGood.update({ t, tIn: tRight + 0.55 });
            place(cautionG, { x: hand[0] + 44, y: hand[1] - 54 });
            caution.update({ t, tIn: tRetract + 0.3 });
          }
        });
      }

      // ---------------------------------------------------------------- b06 hazmat, SDS, hose training
      {
        const id = 's08b06', b = B(id), tOut = OUT(id);
        const g = G(stage);
        const xs = Kit.stripX(3, 520, 40), PY = 110, PH = 560;
        const caps = ['Hazardous material:\nspecial handling', 'Know the Safety\nData Sheets', 'Hose press and hose saw:\nspecific training'];
        const tIns = [b.start + 0.3, cue(id, 'be familiar') - 0.2, cue(id, 'building hydraulic') - 0.2];
        const panels = caps.map((c, i) => { const p = Kit.Panel(g, { width: 520, height: PH, caption: c }); place(p.g, { x: xs[i], y: PY }); return p; });
        const AH = panels[0].areaH;
        // Panel 1: hazmat bay.
        const s1 = panels[0].slot;
        floorBand(s1, AH - 96, 520, 96);
        el('rect', { x: 96, y: 74, width: 18, height: AH - 96 - 74 + 22, fill: C.steelDark, ...INK() }, s1);
        el('rect', { x: 406, y: 74, width: 18, height: AH - 96 - 74 + 22, fill: C.steelDark, ...INK() }, s1);
        const beam = Kit.HazardStripe(s1, { width: 328, height: 22 });
        place(beam.g, { x: 96, y: 56 });
        el('rect', { x: 96, y: 56, width: 328, height: 22, fill: 'none', ...INK() }, s1);
        const strip = Kit.HazardStripe(s1, { width: 360, height: 18 });
        place(strip.g, { x: 80, y: AH - 40 });
        el('rect', { x: 80, y: AH - 40, width: 360, height: 18, fill: 'none', ...INK({ 'stroke-width': 2 }) }, s1);
        const hzG = G(s1);
        const hzBox = Kit.Carton(hzG, { w: 176, h: 150, d: 60 });
        const sign = Kit.HazardSign(hzG, { size: 92 });
        place(sign.g, { x: 0, y: -78 });
        // Panel 2: SDS sliding out of its wall holder.
        const s2 = panels[1].slot;
        el('rect', { x: 110, y: 250, width: 300, height: 180, rx: 6, fill: C.steelDark, ...INK() }, s2);
        const sdsG = G(s2);
        const sds = Kit.SDS(sdsG);
        el('path', { d: 'M104 304H416V438Q416 446 408 446H112Q104 446 104 438Z', fill: C.steel, ...INK() }, s2);
        el('path', { d: 'M124 322H396', stroke: steelLight, 'stroke-width': 4, 'stroke-linecap': 'round' }, s2);
        const tSDS = cue(id, 'safety data sheets') - 0.3;
        // Panel 3: hose press and saw.
        const s3 = panels[2].slot;
        floorBand(s3, AH - 50, 520, 50);
        const pressG = G(s3);
        const press = Kit.HosePress(pressG);
        place(pressG, { x: 190, y: AH - 22, s: 0.76 });
        const sawG = G(s3);
        const saw = Kit.HoseSaw(sawG);
        place(sawG, { x: 440, y: AH - 74, s: 0.8 });
        const trainG = G(s3);
        place(trainG, { x: 260, y: 64 });
        const train = Kit.Badge(trainG, { text: 'Training required', variant: 'accent' });
        const tTrain = cue(id, 'specific training');
        // Certificate row.
        const rowG = G(g);
        const tCert = cue(id, 'training will be provided');
        const certText = 'Specific training provided';
        const tw = Kit.measure(certText, 36, 700);
        const rowW = 240 + 36 + tw, rx0 = (1920 - rowW) / 2;
        const certG = G(rowG);
        place(certG, { x: rx0, y: 0, s: 0.8 });
        const cert = Kit.Certificate(certG, {});
        Kit.text(rowG, certText, { x: rx0 + 240 + 36, y: 100, size: 36, weight: 700, fill: C.ink });
        on(t => {
          if (!live(t, b.start, tOut)) { show(g, false); return; }
          show(g, true);
          panels.forEach((p, i) => p.update({ t, tIn: tIns[i], tOut, from: 'below' }));
          beam.update({ t, speed: 6 }); strip.update({ t, speed: -6 });
          const pc = ease.enter(lin(t, tIns[0] + 0.3, 0.9));
          place(hzG, { x: lerp(-160, 252, pc), y: AH - 52 });
          hzBox.update({ t, tape: 1 });
          sign.update({ t, tIn: tIns[0] + 1.1, swing: tIns[0] + 1.35 });
          const ps = ease.enter(lin(t, tSDS, 0.8));
          place(sdsG, { x: 130, y: lerp(270, 34, ps) });
          sds.update({ pulse: lin(t, tSDS + 0.9, 0.5) + lin(fmod(t - tSDS - 2.4, 3), 0, 0.5) * (t > tSDS + 2.4 ? 1 : 0) });
          const u = t - tIns[2] - 0.6;
          press.update({ press: u > 0 ? Math.sin(Math.PI * clamp(fmod(u, 2.6) / 1.3)) : 0, t });
          saw.update({ cut: u > 0 ? 0.5 - 0.5 * Math.cos(TAU * u / 2.6) : 0, t, spin: t > tIns[2] });
          train.update({ t, tIn: tTrain });
          vis(rowG, t, tCert, tOut, { y: 700 + Math.sin(TAU * t / 3) });
          cert.update({ seal: 1, check: lin(t, tCert + 0.5, 0.3) });
        });
      }

      // ---------------------------------------------------------------- b07 + b08 checklist and vignettes
      {
        const b7 = B('s08b07'), b8 = B('s08b08');
        const g = G(stage);
        const items = ['No horseplay', 'Observe signs', 'Authorised areas only', 'Good housekeeping', 'Damaged tools removed', 'Supervisor provides PPE', 'Locked out, tagged out', 'Know your emergency equipment'];
        const list = Kit.Checklist(g, { items });
        const LY = Math.round(500 - list.h / 2);
        place(list.g, { x: 80, y: LY });
        const PX = 80 + list.w + 40, PW = 1840 - PX, PH = 700;
        const pan = Kit.Panel(g, { width: PW, height: PH });
        place(pan.g, { x: PX, y: 150 });
        const S = pan.slot, FY = 600;
        const floorG = G(S);
        floorBand(floorG, 560, PW, PH - 560);
        const c = [
          cue('s08b07', 'no horseplay'), cue('s08b07', 'observe all safety'), cue('s08b07', 'keep unauthorised'),
          cue('s08b07', 'good housekeeping'), cue('s08b07', 'tools, equipment'),
          cue('s08b08', 'the right personal'), cue('s08b08', 'equipment or vehicles'), cue('s08b08', 'every employee must know'),
        ];
        const starts = [b7.start + 0.55, c[1], c[2], c[3], c[4], c[5], c[6], c[7] + 0.7];
        const ends = starts.slice(1).concat([INF]);
        const vigs = [];
        const vig = (i, f) => { const vg = G(S); vigs.push({ vg, s: starts[i], e: ends[i], f }); return vg; };
        const ticks = [];
        const mark = (parent, kind, x, y, size = 64) => { const m = (kind === 'x' ? Kit.RedX : Kit.GreenCheck)(parent, { size }); place(m.g, { x, y }); return m; };
        const MX = PW - 56, MY = 56;

        // V0 No horseplay: two Workers shoving.
        {
          const vg = vig(0);
          const L = person(vg, { seed: 52 }, 1.45), Rr = person(vg, { seed: 53, facing: -1, variant: 'driver' }, 1.45);
          const x0 = PW / 2;
          const m = mark(vg, 'x', x0, 150, 72);
          const tm = Math.max(c[0], starts[0] + 0.6);
          ticks[0] = tm + 0.45;
          vigs[vigs.length - 1].f = t => {
            const k = Math.sin(TAU * (t - starts[0]) / 1.1);
            const xl = x0 - 82 + (k > 0 ? 13 * k : 24 * k), xr = x0 + 82 + (k > 0 ? 24 * k : 13 * k);
            const dist = (xr - xl) / 1.45;
            drive(L, t, { x: xl, y: FY }, { pose: 'stand', lean: k < 0 ? 12 * k : 6 * k, reach: [dist - 30, -168], reach2: [dist - 22, -158] });
            drive(Rr, t, { x: xr, y: FY }, { pose: 'stand', facing: -1, lean: k > 0 ? -12 * k : -6 * k, reach: [dist - 30, -170], reach2: [dist - 22, -160] });
            m.update({ t, tIn: tm });
          };
        }
        // V1 Observe signs: forklift halts at the stop sign while a pedestrian crosses.
        {
          const vg = vig(1);
          let d = '';
          for (let i = 0; i < 7; i++) { const x = 500 + i * 58; d += `M${x} 690H${x + 30}L${x + 70} 572H${x + 40}Z`; }
          el('path', { d, fill: C.paper, stroke: C.steel, 'stroke-width': 1.5 }, vg);
          el('path', { d: 'M404 690H422L462 572H444Z', fill: C.paper, stroke: C.steel, 'stroke-width': 1.5 }, vg);
          const stop = StopSign(vg, { post: 330 });
          place(stop.g, { x: 470, y: 580 });
          const fG = G(vg);
          const fl = Kit.Forklift(fG, { driver: true, seed: 54, stroke: SW / 0.72 });
          const ped = person(vg, { seed: 55 }, 1.25);
          const m = mark(vg, 'check', MX, MY);
          const s = starts[1], tStop = s + 1.1, tP0 = s + 0.6, sp = Kit.Worker.WALK_SPEED * 0.9 * 1.25, tP1 = tP0 + 320 / sp;
          ticks[1] = Math.min(tP1 + 0.5, ends[1] - 0.1);
          vigs[vigs.length - 1].f = t => {
            const p = ease.enter(lin(t, s, 1.1)), fx = lerp(-240, 240, p);
            place(fG, { x: fx, y: 610, s: 0.72 });
            fl.update({ state: t < tStop - 0.1 ? 'driving' : 'idle', t, dist: (fx + 240) / 0.72, stroke: SW / 0.72 });
            const px = t < tP0 ? 540 : t < tP1 ? 540 + sp * (t - tP0) : 860;
            drive(ped, t, { x: px, y: 660 }, { ...Kit.Worker.poseAt(t, [[-1, 'walk'], [tP1, 'stand']]), stride: 0.9 });
            m.update({ t, tIn: ticks[1] - 0.25 });
          };
        }
        // V2 Authorised areas only: an outsider stops at the dashed zone.
        {
          const vg = vig(2);
          el('path', { d: 'M600 688H1010L1046 576H636Z', fill: C.accent, 'fill-opacity': 0.16, stroke: C.accent, 'stroke-width': 5, 'stroke-dasharray': '18 12', 'stroke-linejoin': 'round' }, vg);
          const palG = G(vg);
          const pal = Kit.Pallet(palG);
          place(palG, { x: 820, y: 652, s: 0.8 });
          el('rect', { x: 608, y: 196, width: 12, height: 444, fill: C.steel, ...INK() }, vg);
          const signG = G(vg);
          place(signG, { x: 614, y: 194 });
          const sign = Kit.Badge(signG, { text: 'Authorised only', variant: 'safety', height: 48, size: 26 });
          const out = person(vg, { variant: 'customer', seed: 56 }, 1.35);
          const s = starts[2], tW0 = s + 0.35, sp = Kit.Worker.WALK_SPEED * 0.8 * 1.35, X0 = 60, X1 = 440, tW1 = tW0 + (X1 - X0) / sp;
          const m = mark(vg, 'x', 526, 430, 64);
          ticks[2] = Math.min(tW1 + 0.6, ends[2] - 0.1);
          vigs[vigs.length - 1].f = t => {
            pal.update({ count: 4, t });
            sign.update({ t });
            const x = t < tW0 ? X0 : t < tW1 ? X0 + sp * (t - tW0) : X1;
            drive(out, t, { x, y: 640 }, { ...Kit.Worker.poseAt(t, [[-1, 'walk'], [tW1, 'stand']]), stride: 0.8 });
            m.update({ t, tIn: tW1 + 0.05 });
          };
        }
        // V3 Good housekeeping: sweeping clears the debris.
        {
          const vg = vig(3);
          const debG = G(vg);
          const deb = Kit.Debris(debG, { n: 16, w: 400, h: 50 });
          place(debG, { x: 760, y: 640 });
          const sw = person(vg, { seed: 57 }, 1.35);
          const s = starts[3], tW0 = s + 0.3, sp = Kit.Worker.WALK_SPEED * 0.5 * 1.35, X0 = 160, X1 = 640, tW1 = tW0 + (X1 - X0) / sp;
          const m = mark(vg, 'check', MX, MY);
          ticks[3] = Math.min(tW1 + 0.3, ends[3] - 0.1);
          vigs[vigs.length - 1].f = t => {
            const x = t < tW0 ? X0 : t < tW1 ? X0 + sp * (t - tW0) : X1;
            drive(sw, t, { x, y: 630 }, { pose: 'sweep', walking: t >= tW0 && t < tW1 ? 1 : 0, stride: 0.5 });
            deb.update({ clear: clamp((x + 135 - 560) / 360), t });
            m.update({ t, tIn: ticks[3] - 0.25 });
          };
        }
        // V4 Damaged tools removed: the cracked wrench goes into the bin.
        {
          const vg = vig(4);
          el('rect', { x: 120, y: 456, width: 16, height: 150, fill: C.steelDark, ...INK() }, vg);
          el('rect', { x: 560, y: 456, width: 16, height: 150, fill: C.steelDark, ...INK() }, vg);
          el('rect', { x: 90, y: 440, width: 516, height: 20, rx: 3, fill: C.steel, ...INK() }, vg);
          const tg = TapeGun(vg).g;
          place(tg, { x: 170, y: 386, s: 0.62 });
          const good = Wrench(vg);
          place(good.g, { x: 320, y: 422, s: 0.6, r: -6 });
          // Bin: back opening, the moving wrench, then the front face with its label.
          el('path', { d: 'M660 476L700 446H1010L970 476Z', fill: hole, ...INK() }, vg);
          const wrG = G(vg);
          const bad = Wrench(wrG, { cracked: true });
          el('path', { d: 'M660 476H970V606H660Z', fill: C.steelDark, ...INK() }, vg);
          el('path', { d: 'M970 476L1010 446V576L970 606Z', fill: mix(C.steelDark, C.ink, 0.35), ...INK() }, vg);
          const labW = Kit.measure('Removed from service', 24, 700) + 28;
          el('rect', { x: 815 - labW / 2, y: 512, width: labW, height: 46, rx: 6, fill: C.paper, ...INK({ 'stroke-width': 2 }) }, vg);
          Kit.text(vg, 'Removed from service', { x: 815, y: 543, size: 24, weight: 700, anchor: 'middle' });
          const m = mark(vg, 'check', MX, MY);
          const s = starts[4];
          const tMove = Math.max(s + 2.2, cue('s08b07', 'anything damaged') + 0.3), tDrop = tMove + 1.2;
          ticks[4] = Math.min(tDrop + 0.35, ends[4] - 0.1);
          vigs[vigs.length - 1].f = t => {
            const p1 = Engine.ease.inOut(lin(t, tMove, 0.55)), p2 = lin(t, tMove + 0.55, 0.65);
            const x = p2 > 0 ? lerp(640, 815, p2) : lerp(495, 640, p1);
            const y = p2 > 0 ? 422 - 120 * p2 + 230 * p2 * p2 : 422;
            place(wrG, { x, y, s: 0.6, r: p2 > 0 ? 80 * p2 : 0 });
            show(wrG, t < tDrop);
            bad.update({ t, alert: lin(t, s + 0.6, 0.3) });
            m.update({ t, tIn: ticks[4] - 0.25 });
          };
        }
        // V5 Supervisor provides PPE: items pass from the Supervisor to the Worker and snap on.
        {
          const vg = vig(5);
          const sp = person(vg, { variant: 'supervisor', clipboard: false, seed: 58 }, 1.45);
          const wk = person(vg, { seed: 59, facing: -1 }, 1.45);
          const kinds = ['hardHat', 'glasses', 'vest', 'gloves'];
          const icons = kinds.map(k => { const ig = G(vg); return { k, ig, ic: Kit.PPEIcon(ig, { item: k, size: 70, bg: true }) }; });
          const s = starts[5];
          const hand = kinds.map((_, i) => s + 0.9 + 0.8 * i);
          const m = mark(vg, 'check', MX, MY);
          ticks[5] = Math.min(hand[3] + 1.2, ends[5] - 0.1);
          const SX = PW / 2 - 200, WX = PW / 2 + 190;
          vigs[vigs.length - 1].f = t => {
            const busy = hand.some(h => t > h - 0.3 && t < h + 0.6);
            const ps = drive(sp, t, { x: SX, y: FY }, { pose: 'stand', reach: busy ? [92, -150] : null });
            const ppe = {};
            kinds.forEach((k, i) => { ppe[k] = lin(t, hand[i] + 0.55, 0.3); });
            const pw = drive(wk, t, { x: WX, y: FY }, { pose: 'stand', facing: -1, ppe });
            if (!ps || !pw) return;
            icons.forEach((d, i) => {
              const h = hand[i];
              const from = [ps.hand[0] + 20, ps.hand[1] - 20];
              const to = d.k === 'hardHat' ? [pw.head[0], pw.head[1] + 10] : d.k === 'glasses' ? pw.face : d.k === 'vest' ? pw.chest : pw.hand;
              const q = Engine.ease.inOut(lin(t, h, 0.55));
              const x = lerp(from[0], to[0], q), y = lerp(from[1], to[1], q) - 80 * Math.sin(Math.PI * q);
              const o = lin(t, h - 0.3, 0.15) * (1 - lin(t, h + 0.5, 0.15));
              place(d.ig, { x, y, s: lerp(1, 0.6, q), o }); show(d.ig, o > 0.001);
              d.ic.update({ p: lin(t, h - 0.3, 0.3) });
            });
            m.update({ t, tIn: ticks[5] - 0.25 });
          };
        }
        // V6 Locked out, tagged out.
        {
          const vg = vig(6);
          const fG = G(vg);
          const fl = Kit.Forklift(fG, { driver: false, stroke: SW / 1.1 });
          place(fG, { x: PW / 2 - 30, y: FY + 10, s: 1.1 });
          const s = starts[6];
          const tLock = Math.max(s + 0.6, cue('s08b08', 'locked out') - 0.3), tTag = Math.max(tLock + 0.5, cue('s08b08', 'tagged out') - 0.5);
          const m = mark(vg, 'check', MX, MY);
          ticks[6] = Math.min(tTag + 1.25, ends[6] - 0.1);
          vigs[vigs.length - 1].f = t => {
            fl.update({ state: 'tagged-out', t, desat: prog(t, tLock, 0.8), padlock: lin(t, tLock + 0.15, 0.3), tag: lin(t, tTag, 0.9), stroke: SW / 1.1 });
            m.update({ t, tIn: ticks[6] - 0.25 });
          };
        }
        // V7 Emergency equipment: wall board stations ping on a mini map.
        const tEnd = ctx.duration;
        {
          const vg = vig(7);
          const BX = Math.round((PW - 888) / 2);
          el('rect', { x: BX, y: 24, width: 888, height: 206, rx: 12, fill: steelLight, ...INK() }, vg);
          const st = [Extinguisher, EyeWash, FirstAid].map((F, i) => {
            const sg = G(vg);
            const x = BX + 150 + i * 294;
            const hl = el('rect', { x: x - 84, y: 36, width: 168, height: 182, rx: 12, fill: 'none', stroke: C.accent, 'stroke-width': 5 }, vg);
            place(F(sg).g, { x, y: 214 });
            return { x, hl };
          });
          const mapG = G(vg);
          const MS = 0.74;
          place(mapG, { x: BX, y: 238, s: MS });
          const map = Kit.WarehouseMap(mapG, {});
          const lines = st.map((d, i) => {
            const mk = map.marker(i), px = BX + mk.x * MS, py = 238 + (mk.y - 56) * MS;
            return el('path', { d: `M${d.x} 220L${f2(px)} ${f2(py)}`, fill: 'none', stroke: C.accent, 'stroke-width': 4, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round', pathLength: 1 }, vg);
          });
          const s = starts[7];
          const tLoc = Math.max(s + 0.5, cue('s08b08', 'the location'));
          const pins = [0, 1, 2].map(i => tLoc + 0.2 + 0.7 * i);
          ticks[7] = pins[2] + 0.8;
          const PERIOD = 1.4, tStop = pins[0] + Math.max(0, Math.floor((tEnd - 1.2 - pins[0]) / PERIOD)) * PERIOD;
          vigs[vigs.length - 1].f = t => {
            const nm = pins.reduce((a, p) => a + lin(t, p, 0.35), 0);
            const ping = t >= pins[0] && t < tStop ? fmod((t - pins[0]) / PERIOD, 1) : 0;
            map.update({ markers: nm, ping });
            st.forEach((d, i) => {
              const p = lin(t, pins[i], 0.3);
              set(d.hl, { opacity: f2(p * (0.75 + 0.25 * Math.cos(TAU * (t - pins[i]) / 2.4))) }); show(d.hl, p > 0);
              set(lines[i], { opacity: f2(0.9 * p) }); show(lines[i], p > 0);
            });
          };
        }
        on(t => {
          if (!live(t, b7.start, INF)) { show(g, false); return; }
          show(g, true);
          list.update({ t, tIn: b7.start + 0.3, rows: [c[0] - 0.2, ...c.slice(1)], ticks });
          pan.update({ t, tIn: b7.start + 0.4, from: 'right' });
          vis(floorG, t, b7.start, starts[7] + 0.3, { from: [0, 0], to: [0, 0] });
          vigs.forEach(v => {
            if (!live(t, v.s, v.e + 0.3)) { show(v.vg, false); return; }
            // The next vignette waits until the previous one has nearly gone (no busy crossfade).
            const o = vis(v.vg, t, v === vigs[0] ? v.s : v.s + 0.25, v.e + 0.3, { from: [40, 0], to: [-24, 0] });
            if (o > 0) v.f(t);
          });
        });
      }

      return { fns };
    },
    render(t, ctx, st) { for (const f of st.fns) f(t); },
  });
})();
