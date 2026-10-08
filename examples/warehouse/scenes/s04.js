// Scene s04: Locations, Mezzanine, Packing and Shipping (STORYBOARD.md s04b01–s04b07).
// Four views, each replacing the last: warehouse map (b01–b02, zooming into row B's rack),
// mezzanine side elevation (b03–b04), packing and shipping (b05 customers, b06 three panels),
// and the 50 lb carton scale (b07). Every time comes from ctx.beat / ctx.cue.
// Scene-local assets (STYLE §6 items the kit does not provide): Mezzanine (14), WeightLimitSign,
// platform Scale (19), packing bench, frown speech bubble, dashed delivery arrow, the assembled
// B-02-3 location label with its brackets.
(() => {
  const { el, set, place, clamp, lerp, prog } = Engine;
  const { C, ease, text, show, measure } = Kit;
  const SW = Kit.STROKE;
  const FLOOR = 850;
  const INF = Infinity;
  const r2 = v => Math.round(v * 100) / 100;
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const pin = (t, t0, d = 0.4) => prog(t, t0, d, ease.enter);
  const pout = (t, t0, d = 0.35) => prog(t, t0, d, ease.exit);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const qb = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
  const ink = (extra = {}) => ({ stroke: C.ink, 'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
  const rect = (parent, x, y, w, h, attrs = {}) => el('rect', { x, y, width: w, height: h, ...attrs }, parent);
  // Thick bar: ink outline path under a coloured path on the same centre line.
  function bar(parent, d, color, w) {
    el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': w + 2 * SW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    return el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  }
  // A path that draws itself with p 0..1.
  const drawn = (parent, d, attrs = {}) => el('path', { d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }, parent);
  const drawTo = (node, p) => { show(node, p > 0.001); set(node, { 'stroke-dashoffset': r2(1 - clamp(p)) }); };
  // Damped spring sum: each [t0, delta] eases in with a small overshoot (needles, snaps).
  const spring = (t, events) => events.reduce((v, [t0, d]) => (t >= t0 ? v + d * (1 - Math.exp(-5 * (t - t0)) * Math.cos(9 * (t - t0))) : v), 0);
  let uid = 0;
  const nid = p => `s04-${p}-${++uid}`;

  // ------------------------------------------------------------------ scene-local assets
  // Mezzanine (STYLE §6.14): side elevation, upper deck on columns, railing, staircase, shelving
  // on the deck. update({build: 0..1}) builds it bottom-up. Origin: bottom-centre on the floor.
  // Local layout: stairs from (-560, 0) up to the deck's left end (-200, -300); deck to x 520.
  const MZ = { deckY: -300, deckT: 28, x0: -200, x1: 520, standY: -310, railY: -395, midY: -348, shelfY: -440 };
  function Mezzanine(parent) {
    const g = el('g', {}, parent);
    const parts = {};
    const layer = k => (parts[k] = el('g', {}, g));
    // columns
    const cols = layer('cols');
    for (const x of [-188, 160, 498]) {
      rect(cols, x - 11, MZ.deckY + MZ.deckT, 22, -(MZ.deckY + MZ.deckT), { fill: C.steelDark, ...ink() });
      rect(cols, x - 18, -8, 36, 8, { fill: C.steelDark, ...ink({ 'stroke-width': 2 }) });
    }
    // stairs: 12 steps, rise 25, run 30
    const stairs = layer('stairs');
    let d = 'M-560 0';
    for (let i = 0; i < 12; i++) d += `V${-(i + 1) * 25}H${-560 + (i + 1) * 30}`;
    d += `V${MZ.deckY + MZ.deckT}L-526 0Z`;
    el('path', { d, fill: C.steel, ...ink() }, stairs);
    bar(stairs, 'M-548 -22V-118M-212 -300V-392', C.steelDark, 5);
    bar(stairs, 'M-548 -112L-212 -386', C.steelDark, 6);
    // deck: front fascia + top face in depth
    const deck = layer('deck');
    el('path', { d: `M${MZ.x0} ${MZ.deckY}L${MZ.x1} ${MZ.deckY}L${MZ.x1 + 35} ${MZ.deckY - 20}L${MZ.x0 + 35} ${MZ.deckY - 20}Z`, fill: '#B9C2CC', ...ink() }, deck);
    rect(deck, MZ.x0, MZ.deckY, MZ.x1 - MZ.x0, MZ.deckT, { fill: C.steel, ...ink() });
    el('path', { d: `M${MZ.x1} ${MZ.deckY}L${MZ.x1 + 35} ${MZ.deckY - 20}V${MZ.deckY + MZ.deckT - 20}L${MZ.x1} ${MZ.deckY + MZ.deckT}Z`, fill: C.steelDark, ...ink() }, deck);
    // shelving at the back of the deck
    const shelf = layer('shelf');
    for (const x of [85, 520]) rect(shelf, x - 5, -556, 10, 556 + MZ.standY, { fill: C.steelDark, ...ink() });
    el('path', { d: `M80 ${MZ.shelfY}L525 ${MZ.shelfY}L551 ${MZ.shelfY - 15}L106 ${MZ.shelfY - 15}Z`, fill: '#C9D0D8', ...ink({ 'stroke-width': 2 }) }, shelf);
    rect(shelf, 80, MZ.shelfY, 445, 10, { fill: C.steel, ...ink({ 'stroke-width': 2 }) });
    rect(shelf, 80, -562, 445, 8, { fill: C.steel, ...ink({ 'stroke-width': 2 }) });
    // under-shelf group for scene items standing on the deck (worker, debris) sits between
    // shelving and railing so the railing passes in front of them
    parts.onDeck = el('g', {}, g);
    // railing along the deck front
    const rail = layer('rail');
    let posts = '';
    for (const x of [-190, -70, 50, 170, 290, 410, 515]) posts += `M${x} ${MZ.deckY}V${MZ.railY}`;
    bar(rail, posts, C.steelDark, 4);
    bar(rail, `M-190 ${MZ.midY}H515`, C.steelDark, 4);
    bar(rail, `M-190 ${MZ.railY}H515`, C.steelDark, 7);
    const order = [['cols', 0, 0.3], ['deck', 0.2, 0.45], ['stairs', 0.32, 0.62], ['shelf', 0.5, 0.8], ['rail', 0.62, 0.92]];
    return {
      g, onDeck: parts.onDeck,
      update({ build = 1 } = {}) {
        for (const [k, a, b] of order) {
          const p = seg(build, a, b), e = ease.enter(p);
          show(parts[k], p > 0);
          set(parts[k], { transform: `translate(0 ${r2(24 * (1 - e))})`, opacity: r2(p) });
        }
      },
    };
  }

  // WeightLimitSign: safety-yellow placard with a scale glyph and "MAX LOAD" (no number), bolted to
  // the railing. update({on: 0..1}) drops it on with a bounce; the bolts pop in at the end.
  // Origin: centre of the 220×100 placard.
  function WeightSign(parent) {
    const g = el('g', {}, parent), body = el('g', {}, g);
    el('rect', { x: -110, y: -50, width: 220, height: 100, rx: 10, fill: C.safety, ...ink({ 'stroke-width': 3 }) }, body);
    el('rect', { x: -102, y: -42, width: 204, height: 84, rx: 6, fill: 'none', stroke: C.ink, 'stroke-width': 1.5 }, body);
    // scale glyph: platform, post and dial
    const gl = el('g', { transform: 'translate(-64 2)' }, body);
    el('path', { d: 'M-26 26H26L22 16H-22Z', fill: C.ink }, gl);
    el('rect', { x: -3, y: -2, width: 6, height: 18, fill: C.ink }, gl);
    el('circle', { cx: 0, cy: -14, r: 15, fill: C.paper, stroke: C.ink, 'stroke-width': 3.5 }, gl);
    el('path', { d: 'M0 -14L7 -22', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, gl);
    text(body, 'MAX', { x: 30, y: -6, size: 30, weight: 800, anchor: 'middle' });
    text(body, 'LOAD', { x: 30, y: 28, size: 30, weight: 800, anchor: 'middle' });
    const bolts = [-94, 94].map(x => {
      const b = el('g', { transform: `translate(${x} -36)` }, body);
      el('circle', { r: 6, fill: C.steel, ...ink({ 'stroke-width': 2 }) }, b);
      el('path', { d: 'M-3 0H3', stroke: C.ink, 'stroke-width': 2 }, b);
      return b;
    });
    return {
      g,
      update({ on = 1 } = {}) {
        const p = clamp(on), drop = seg(p, 0, 0.6);
        show(body, p > 0);
        set(body, { transform: `translate(0 ${r2(-60 * (1 - ease.pop(drop)))})`, opacity: r2(seg(p, 0, 0.2)) });
        bolts.forEach((b, i) => {
          const q = seg(p, 0.65 + i * 0.12, 0.85 + i * 0.12);
          show(b, q > 0);
          set(b, { transform: `translate(${i ? 94 : -94} -36) scale(${r2(Math.max(0.01, ease.pop(q)))})` });
        });
      },
    };
  }

  // Platform Scale (STYLE §6.19): low platform with a dial on a post at its right; red zone and red
  // line at 50 lb; a "50 lb" Badge on the post (ink, error when exceeded, correct when under).
  // update({w: pounds, variant, bump, t}). Origin: bottom-centre of the platform; top at y -100.
  const DIAL = { x: 150, y: -390, r: 78 };
  const angOf = w => -120 + 240 * clamp(w / 80);
  function Scale(parent) {
    const g = el('g', {}, parent);
    Kit.shadow(g, 240);
    rect(g, DIAL.x - 9, -318, 18, 310, { fill: C.steelDark, ...ink() });
    rect(g, DIAL.x - 26, -8, 52, 8, { fill: C.steelDark, ...ink({ 'stroke-width': 2 }) });
    rect(g, 96, -62, DIAL.x - 100, 14, { fill: C.steelDark, ...ink({ 'stroke-width': 2 }) });
    rect(g, -100, -88, 200, 80, { rx: 6, fill: C.steel, ...ink() });
    for (const x of [-84, 70]) rect(g, x, -8, 14, 8, { fill: C.ink });
    el('path', { d: 'M-112 -100H112L120 -112H-104Z', fill: '#C9D0D8', ...ink({ 'stroke-width': 2 }) }, g);
    rect(g, -112, -100, 224, 12, { fill: C.steelDark, ...ink({ 'stroke-width': 2 }) });
    const dial = el('g', { transform: `translate(${DIAL.x} ${DIAL.y})` }, g);
    el('circle', { r: DIAL.r, fill: C.steelDark, ...ink() }, dial);
    el('circle', { r: DIAL.r - 10, fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, dial);
    const polar = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
    const [ax, ay] = polar(angOf(50), 56), [bx, by] = polar(angOf(80), 56);
    el('path', { d: `M${r2(ax)} ${r2(ay)}A56 56 0 0 1 ${r2(bx)} ${r2(by)}`, fill: 'none', stroke: C.error, 'stroke-width': 12 }, dial);
    let ticks = '';
    for (let w = 0; w <= 80; w += 10) {
      const [x0, y0] = polar(angOf(w), w % 50 === 0 ? 44 : 50), [x1, y1] = polar(angOf(w), 64);
      ticks += `M${r2(x0)} ${r2(y0)}L${r2(x1)} ${r2(y1)}`;
    }
    el('path', { d: ticks, stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, dial);
    const [lx0, ly0] = polar(angOf(50), 30), [lx1, ly1] = polar(angOf(50), 70);
    el('path', { d: `M${r2(lx0)} ${r2(ly0)}L${r2(lx1)} ${r2(ly1)}`, stroke: C.error, 'stroke-width': 6, 'stroke-linecap': 'round' }, dial);
    const needle = el('g', {}, dial);
    el('path', { d: 'M0 12L0 -58', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, needle);
    el('circle', { r: 8, fill: C.ink }, dial);
    el('circle', { r: 3, fill: C.accent }, dial);
    const bg = el('g', { transform: `translate(${DIAL.x} ${DIAL.y + DIAL.r + 34})` }, g);
    const badge = Kit.Badge(bg, { text: '50 lb', variant: 'ink' });
    return {
      g,
      update({ w = 0, variant = 'ink', bump, t = 0, phase = 0 } = {}) {
        set(needle, { transform: `rotate(${r2(angOf(w) + 0.6 * Math.sin((t + phase) * 7.3))})` });
        badge.update({ t, variant, bump });
      },
    };
  }

  // Packing bench: wood top, steel legs and a lower shelf. Origin: bottom-centre; top at y -170.
  function Bench(parent, w = 300) {
    const g = el('g', {}, parent);
    Kit.shadow(g, w + 20);
    for (const x of [-w / 2 + 14, w / 2 - 30]) rect(g, x, -160, 16, 160, { fill: C.steelDark, ...ink() });
    rect(g, -w / 2 + 10, -56, w - 20, 12, { fill: C.steel, ...ink({ 'stroke-width': 2 }) });
    rect(g, -w / 2, -170, w, 18, { rx: 3, fill: C.carton, stroke: C.ink, 'stroke-width': SW });
    el('path', { d: `M${-w / 2 + 8} -161H${w / 2 - 8}`, stroke: C.cartonEdge, 'stroke-width': 2 }, g);
    return g;
  }

  // Frown speech bubble (paper with an error outline, frowning face). update({t, tIn, tOut}).
  // Origin: the tail tip (bottom-right of the bubble).
  function Frown(parent) {
    const g = el('g', {}, parent), pop = el('g', {}, g);
    el('path', { d: 'M-118 -128H-14Q0 -128 0 -114V-48Q0 -34 -14 -34H-26L-2 0L-52 -34H-118Q-132 -34 -132 -48V-114Q-132 -128 -118 -128Z', fill: C.paper, stroke: C.error, 'stroke-width': 4, 'stroke-linejoin': 'round' }, pop);
    el('circle', { cx: -86, cy: -94, r: 6, fill: C.error }, pop);
    el('circle', { cx: -46, cy: -94, r: 6, fill: C.error }, pop);
    el('path', { d: 'M-90 -56Q-66 -78 -42 -56', fill: 'none', stroke: C.error, 'stroke-width': 6, 'stroke-linecap': 'round' }, pop);
    return {
      g,
      update({ t = 0, tIn = -INF, tOut = INF } = {}) {
        const s = lerp(0.01, 1, prog(t, tIn, 0.3, ease.pop)), o = lin(t, tIn, 0.12) * (1 - pout(t, tOut - 0.3, 0.3));
        place(pop, { s: Math.max(0.01, s), o, y: Math.sin(t * Math.PI * 2 / 3) });
        show(pop, o > 0.001);
      },
    };
  }

  // Dashed delivery arrow along a quadratic curve a -> c -> b, revealed left to right (or right to
  // left) with a clip; the arrow head pops at the end. update(p 0..1).
  function DashArrow(parent, a, c, b) {
    const g = el('g', {}, parent), id = nid('arrow');
    const clipR = el('rect', { y: Math.min(a[1], c[1], b[1]) - 60, height: Math.abs(Math.max(a[1], b[1]) - Math.min(a[1], c[1])) + 160, width: 0 }, el('clipPath', { id }, el('defs', {}, g)));
    const cl = el('g', { 'clip-path': `url(#${id})` }, g);
    el('path', { d: `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`, fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-dasharray': '16 12', 'stroke-linecap': 'round' }, cl);
    const ang = Math.atan2(b[1] - c[1], b[0] - c[0]) * 180 / Math.PI;
    const head = el('g', {}, g);
    el('path', { d: 'M8 0L-14 -13L-14 13Z', fill: C.ink, stroke: C.ink, 'stroke-width': 3, 'stroke-linejoin': 'round' }, head);
    const dir = b[0] >= a[0] ? 1 : -1;
    return {
      g,
      update(p) {
        p = clamp(p);
        const xa = a[0] - dir * 20, xb = lerp(a[0], b[0], p) + dir * 4;
        set(clipR, { x: r2(Math.min(xa, xb)), width: r2(Math.abs(xb - xa)) });
        show(g, p > 0);
        const hp = seg(p, 0.85, 1);
        set(head, { transform: `translate(${b[0]} ${b[1]}) rotate(${r2(ang)}) scale(${r2(Math.max(0.01, ease.pop(hp)))})` });
        show(head, hp > 0);
      },
    };
  }

  // Gear angle for a machine that runs at 90 deg/s, coasts to a stop over 0.8 s from tStop and
  // spins back up over 0.8 s from tGo (pure function of t).
  function gearAngle(t, tStop = INF, tGo = INF) {
    const a0 = 90 * Math.min(t, tStop);
    if (t <= tStop) return a0;
    const dt = Math.min(t - tStop, 0.8), a1 = a0 + 90 * (dt - dt * dt / 1.6);
    if (t <= tGo) return a1;
    const du = t - tGo, k = Math.min(du, 0.8);
    return 90 * tStop + 36 + 90 * k * k / 1.6 + 90 * Math.max(0, du - 0.8);
  }
  // Snap a time to the next moment the Machine's boom bob is at its peak, so the switch between
  // the 'running' bob and the lowered 'stopped' boom is the smallest possible step.
  const boomPeak = (t0, min) => { const k = Math.round((t0 - 0.4) / 1.6); const a = 0.4 + 1.6 * k; return a >= min ? a : a + 1.6; };

  // ------------------------------------------------------------------ scene
  Engine.scene('s04', {
    build(ctx) {
      const root = ctx.root, S = {};
      const B = id => ctx.beat(id), cue = (id, ph, n) => ctx.cue(id, ph, n);
      const b1 = B('s04b01'), b2 = B('s04b02'), b3 = B('s04b03'), b4 = B('s04b04'), b5 = B('s04b05'), b6 = B('s04b06'), b7 = B('s04b07');
      const T = S.T = {};

      // ---- timing (all derived from the narration) ----
      T.mapDraw = b1.start + 0.2;
      T.rows = Math.max(b1.start + 1.5, cue('s04b01', 'layout') + 0.3);
      T.walk0 = cue('s04b01', 'As a new employee');
      T.point = cue('s04b01', 'supports the location');
      T.signs = cue('s04b02', 'aisles are properly marked');
      T.zoom = cue('s04b02', 'And sections within');
      T.mark0 = Math.max(T.zoom + 1.0, cue('s04b02', 'clearly marked'));
      T.asm = Math.max(T.mark0 + 1.0, cue('s04b02', 'find the proper location'));
      T.sup = Math.max(T.asm + 1.6, cue('s04b02', 'Any question'));
      T.callout = Math.max(T.sup + 1.3, cue('s04b02', 'goes to the Parts'));
      T.out2 = b3.start;
      // b03 / b04
      T.mzBuild = b3.start + 0.3;
      T.list = Math.max(T.mzBuild + 1.0, cue('s04b03', 'lighter') - 0.4);
      T.row1 = cue('s04b03', 'lighter');
      T.stays = cue('s04b03', 'slower moving');
      T.row2 = cue('s04b03', 'supplies');
      T.float = [0, 1, 2].map(i => cue('s04b03', 'supplies') - 0.3 + 0.55 * i);
      T.row3 = b4.start + 0.3;
      T.wk0 = b4.start + 0.1;
      T.sweep = T.wk0 + 1.2;
      T.clear0 = T.sweep + 0.4;
      T.clear1 = Math.max(T.clear0 + 2.2, cue('s04b04', 'Shelves stay') - 0.2);
      T.dust = cue('s04b04', 'free of dust');
      T.snap = cue('s04b04', 'organised');
      T.sign = cue('s04b04', 'weight limitation');
      T.out4 = b5.start;
      // b05
      T.p0 = b5.start + 0.3;
      T.arrow = Math.max(T.p0 + 0.6, cue('s04b05', 'customers see'));
      T.ship = T.arrow + 0.45;
      T.open = T.ship + 0.95;
      T.rise = T.open + 0.35;
      T.missing = Math.max(T.rise + 0.5, cue('s04b05', 'does not receive'));
      T.stop = cue('s04b05', 'or the order is incorrect') + 0.2;
      T.stopped = boomPeak(T.stop + 0.8, T.stop + 0.3);
      T.frown = T.stop + 0.6;
      T.mirror = Math.max(T.frown + 0.5, cue('s04b05', "the company's image") - 0.3);
      T.out5 = b6.start;
      // b06
      T.pn1 = b6.start + 0.3;
      T.tag = Math.max(T.pn1 + 0.5, cue('s04b06', 'tagged') - 0.4);
      T.pn2 = cue('s04b06', 'Clean boxes') - 0.2;
      T.bad = T.pn2 + 0.5;
      T.good = T.bad + 0.45;
      T.fade = Math.max(T.good + 0.8, cue('s04b06', 'every customer shipment'));
      T.pn3 = cue('s04b06', 'know the cut off') - 0.2;
      T.out6 = b7.start;
      // b07
      T.sc0 = b7.start + 0.3;
      T.drops = [0, 1, 2, 3, 4, 5].map(i => T.sc0 + 0.7 + 0.5 * i);
      T.over = T.drops[5] + 0.4;
      T.split = Math.max(T.over + 1.4, cue('s04b07', 'Everyone has different'));
      T.xfer = [0, 1, 2].map(i => T.split + 1.0 + 0.4 * i);
      T.rule = cue('s04b07', 'As a general rule');
      T.checks = Math.max(T.xfer[2] + 0.9, cue('s04b07', 'fifty pounds'));
      T.close = T.checks + 0.5;
      T.vary = cue('s04b07', 'though that can vary');
      T.wkIn = Math.max(T.close + 0.8, T.vary - 0.3);

      // ---- background and floor ----
      rect(root, 0, 0, 1920, 1080, { fill: C.bgLight });
      S.floorG = el('g', {}, root);
      rect(S.floorG, 0, FLOOR, 1920, 1080 - FLOOR, { fill: C.floor });
      el('path', { d: `M0 ${FLOOR}H1920`, stroke: C.steel, 'stroke-width': 2 }, S.floorG);

      // ================= b01–b02: warehouse map =================
      const MX = 420, MY = 270, MS = 0.9, FY = 522, WS = 0.4 / MS, WALK_X1 = 518;
      S.map = { MX, MY, MS, FY, WS, WALK_X1 };
      S.mapView = el('g', {}, root);
      S.mapG = el('g', {}, S.mapView);
      place(S.mapG, { x: MX, y: MY, s: MS });
      S.whMap = Kit.WarehouseMap(S.mapG, {});
      const trailG = el('g', {}, S.mapG);
      S.trail = [];
      for (let x = 4; x <= WALK_X1 - 30; x += 22) S.trail.push({ x, n: el('circle', { cx: x, cy: FY + 3, r: 4.5, fill: C.inkSoft }, trailG) });
      S.mapWkG = el('g', {}, S.mapG);
      S.mapWk = Kit.Worker(S.mapWkG, { stroke: 2.5 / 0.4 });
      S.walkDist = WALK_X1 + 40;
      S.walkSpeed = Kit.Worker.WALK_SPEED * 0.9 * WS;
      T.walk1 = T.walk0 + S.walkDist / S.walkSpeed;
      S.signs = ['A', 'B', 'C'].map((L, i) => {
        const g = el('g', {}, S.mapView);
        place(g, { x: MX + (118 + 160 * i) * MS, y: -20 });
        return Kit.AisleSign(g, { letter: L, drop: 175 });
      });
      S.headAisles = Kit.Heading(root, { text: 'Aisles marked' });

      // ================= b02: rack close-up =================
      const RX = 600, RS = 0.92;
      S.rack = { RX, RS };
      S.rackView = el('g', {}, root);
      const rsg = el('g', {}, S.rackView);
      place(rsg, { x: RX + 18, y: -20 });
      S.rackSign = Kit.AisleSign(rsg, { letter: 'B', drop: 175 });
      S.rackG = el('g', {}, S.rackView);
      place(S.rackG, { x: RX, y: FLOOR, s: RS });
      S.rackK = Kit.PalletRack(S.rackG, { bays: 1, aisle: 'B', contents: ['carton'] });
      rect(S.rackG, -262, -564, 524, 40, { rx: 4, fill: C.steel, ...ink() });
      const BINX = [-158.67, 0, 158.67];
      S.markers = ['01', '02', '03'].map((s, i) => {
        const g = el('g', { transform: `translate(${BINX[i]} -544)` }, S.rackG);
        return Kit.SectionMarker(g, { text: s });
      });
      S.shelfHalo = el('rect', { x: -316, y: -412, width: 48, height: 48, rx: 10, fill: 'none', stroke: C.accent, 'stroke-width': 6 }, S.rackG);
      [60, 235, 410].forEach((lv, i) => {
        rect(S.rackG, -312, -lv + 2, 40, 40, { rx: 6, fill: C.paper, ...ink() });
        text(S.rackG, String(i + 1), { x: -292, y: -lv + 22 + 9, size: 26, weight: 800, anchor: 'middle' });
      });
      // assembled label B-02-3 with brackets
      const LX = 1010, LY = 268, PS = 64;
      const pieces = ['B', '-', '02', '-', '3'];
      const pw = pieces.map(p => measure(p, PS, 800));
      const GAP = 18, PAD = 36;
      let cx = PAD;
      const pcx = pieces.map((p, i) => { const c = cx + pw[i] / 2; cx += pw[i] + GAP; return c; });
      const boxW = cx - GAP + PAD, boxH = 104;
      S.lab = { LX, LY, boxW, boxH, pcx, PS };
      S.labG = el('g', {}, S.rackView);
      S.labBox = el('g', { transform: `translate(${LX} ${LY})` }, S.labG);
      el('rect', { width: boxW, height: boxH, rx: 12, fill: C.paper, ...ink({ 'stroke-width': 3 }) }, S.labBox);
      S.hyph = [1, 3].map(i => text(S.labBox, '-', { x: pcx[i], y: boxH / 2 + PS * 0.36, size: PS, weight: 800, anchor: 'middle' }));
      S.brk = [0, 2, 4].map((pi, k) => {
        const hw = Math.max(26, pw[pi] / 2 + 6), x = pcx[pi], y = boxH + 12;
        const path = drawn(S.labBox, `M${r2(x - hw)} ${y}V${y + 12}H${r2(x + hw)}V${y}M${r2(x)} ${y + 12}V${y + 24}`, { stroke: C.inkSoft, 'stroke-width': 3 });
        const lbl = text(S.labBox, ['Aisle', 'Section', 'Shelf'][k], { x, y: y + 58, size: 28, weight: 600, fill: C.inkSoft, anchor: 'middle' });
        return { path, lbl };
      });
      // dotted pointer from the big label to the bin label; it grows by moving its end point
      S.connector = el('path', { d: 'M0 0', fill: 'none', stroke: C.accent, 'stroke-width': 7, 'stroke-dasharray': '0.1 14', 'stroke-linecap': 'round' }, S.labG);
      // flying pieces: source stage position and font size
      const src = [
        { x: RX + 18, y: -20 + 175 + 88, size: 84 },
        { x: RX + BINX[1] * RS, y: FLOOR - 544 * RS, size: 26 * RS },
        { x: RX - 292 * RS, y: FLOOR - (410 - 22) * RS, size: 26 * RS },
      ];
      S.fly = [0, 2, 4].map((pi, k) => {
        const g = el('g', {}, S.labG);
        text(g, pieces[pi], { x: 0, y: PS * 0.36, size: PS, weight: 800, anchor: 'middle' });
        return { g, from: src[k], to: { x: LX + pcx[pi], y: LY + boxH / 2 }, t0: T.asm + 0.35 * k };
      });
      // the bin label B-02-3 on the rack (bin 7: top shelf, middle)
      S.binLabel = { x: RX + 72 * RS, y: FLOOR - (410 - 20) * RS };
      S.conA = [LX - 8, LY + boxH / 2];
      S.conB = [S.binLabel.x + 8, S.binLabel.y];
      // supervisor + callout
      S.supX = 1660;
      S.supG = el('g', {}, S.rackView);
      S.sup = Kit.Worker(S.supG, { variant: 'supervisor', facing: -1 });
      S.supCallG = el('g', {}, S.rackView);
      S.supCall = Kit.Callout(S.supCallG, { text: 'Questions: Parts/Warehouse Supervisor', pointer: 'down', at: 0.72 });
      S.headSections = Kit.Heading(root, { text: 'Sections marked' });

      // ================= b03–b04: mezzanine =================
      const MZX = 1285;
      S.mzX = MZX;
      S.mzView = el('g', {}, root);
      S.mzG = el('g', {}, S.mzView);
      place(S.mzG, { x: MZX, y: FLOOR });
      // heavy pallet under the deck (drawn first, behind the deck front)
      S.mz = Mezzanine(S.mzG);
      // heavy pallet under the deck, in front of the columns (it never overlaps the deck)
      S.palG = el('g', {}, S.mzG);
      S.pallet = Kit.Pallet(S.palG, {});
      S.tagG = el('g', {}, S.mzG);
      place(S.tagG, { x: 330 - 102 + 10, y: -194 + 8 });
      S.staysTag = Kit.Tag(S.tagG, { lines: ['Stays below'] });
      // light cartons: shelf slots and slightly askew landing offsets
      const CW = Math.ceil(Math.max(...['Supplies', 'Packing', 'Cartons'].map(s => measure(s, 24, 600))) + 34);
      S.cw = CW;
      S.slots = [0, 1, 2].map(i => 80 + (445 - 3 * CW) / 4 * (i + 1) + CW * (i + 0.5));
      S.askew = [[10, -4], [-12, 3], [8, -2.5]];
      S.dust = [];
      const dustG = S.dustG = el('g', {}, S.mzG);
      for (let i = 0; i < 9; i++) {
        const x = 100 + i * 48 + ((i * 37) % 17), y = MZ.shelfY - 6 - ((i * 13) % 6);
        S.dust.push(el('ellipse', { cx: x, cy: y, rx: 5 + (i % 3) * 2, ry: 3, fill: C.inkSoft, opacity: 0.45 }, dustG));
      }
      S.lightG = el('g', {}, S.mzG);
      S.light = ['Supplies', 'Packing', 'Cartons'].map(s => {
        const g = el('g', {}, S.lightG);
        return { g, c: Kit.Carton(g, { w: CW, h: 80, d: 32, label: s, labelSize: 24 }) };
      });
      // worker and debris on the deck, behind the railing
      S.debrisG = el('g', { transform: `translate(30 ${MZ.standY + 4})` }, S.mz.onDeck);
      S.debris = Kit.Debris(S.debrisG, { n: 9, w: 170, h: 18 });
      S.mzWkG = el('g', {}, S.mz.onDeck);
      S.mzWk = Kit.Worker(S.mzWkG, { stroke: 2.5 / 0.62 });
      S.wsG = el('g', { transform: `translate(300 ${MZ.midY})` }, S.mzG);
      S.wsign = WeightSign(S.wsG);
      S.wsCheckG = el('g', { transform: `translate(410 ${MZ.midY - 50})` }, S.mzG);
      S.wsCheck = Kit.GreenCheck(S.wsCheckG, { size: 48 });
      S.mzG.appendChild(S.lightG); // flying cartons pass in front of everything
      S.list = Kit.Checklist(root, { items: ['Lighter, slower moving', 'Supplies, packing, cartons', 'Same cleanliness standard', 'Weight limits marked and followed'] });
      S.listY = 250;

      // ================= b05: packing and shipping =================
      S.packView = el('g', {}, root);
      const BX = 960;
      const benchG = el('g', {}, S.packView);
      place(benchG, { x: BX, y: FLOOR });
      Bench(benchG, 300);
      S.benchG = benchG;
      // customers and machines (right = first shipment, left = mirrored second shipment)
      S.side = [
        { dir: 1, land: 1230, cust: 1440, mach: 1680 },
        { dir: -1, land: 690, cust: 480, mach: 240 },
      ].map((d, k) => {
        const g = el('g', {}, S.packView);
        const mg = el('g', {}, g);
        place(mg, { x: d.mach, y: FLOOR, s: [1.05 * d.dir, 1.05] });
        const machine = Kit.Machine(mg, { stroke: 2.5 / 1.05 });
        const cg = el('g', {}, g);
        place(cg, { x: d.cust, y: FLOOR });
        const cust = Kit.Worker(cg, { variant: 'customer', facing: -d.dir });
        const arrow = DashArrow(g, [BX + d.dir * 10, FLOOR - 250], [BX + d.dir * 170, FLOOR - 420], [d.land - d.dir * 30, FLOOR - 160]);
        const cartonG = el('g', {}, g);
        const carton = Kit.Carton(cartonG, { w: 140, h: 104, d: 48 });
        const kinds = ['bearing', 'brakeshoe', 'sealring'];
        const parts = kinds.map((kind, i) => {
          const pg = el('g', {}, carton.inside);
          return { pg, p: Kit.Part(pg, { kind }), x: [-62, 14, 88][i] };
        });
        return { ...d, g, mg, machine, cg, cust, arrow, cartonG, carton, parts };
      });
      S.missG = el('g', {}, S.packView);
      S.miss = Kit.Badge(S.missG, { text: 'Missing', variant: 'error' });
      S.frown = Frown(el('g', { transform: `translate(${1440 - 34} ${FLOOR - 280})` }, S.packView));
      S.custCheck = Kit.GreenCheck(el('g', { transform: `translate(${480 + 40} ${FLOOR - 330})` }, S.packView), { size: 56 });
      S.okHeadCheck = Kit.GreenCheck(el('g', { transform: 'translate(108 133)' }, root), { size: 56 });
      S.headComplete = Kit.Heading(root, { text: 'Complete and correct', x: 152 });

      // ================= b06: three panels =================
      const PX = Kit.stripX(3, 520, 40), PY = 230;
      S.panels = ['Part number and quantity tagged', 'Clean boxes only', 'Know shipper cut off times'].map((cap, i) => {
        const g = el('g', {}, root);
        place(g, { x: PX[i], y: PY });
        return { g, p: Kit.Panel(g, { caption: cap }) };
      });
      const benchTop = (slot, aH) => {
        rect(slot, 30, aH - 88, 460, 18, { rx: 3, fill: C.carton, stroke: C.ink, 'stroke-width': SW });
        for (const x of [60, 444]) rect(slot, x, aH - 70, 16, 80, { fill: C.steelDark, ...ink() });
      };
      // panel 1: part + hanging tag
      {
        const P = S.panels[0].p, aH = P.areaH;
        benchTop(P.slot, aH);
        const pg = el('g', { transform: `translate(170 ${aH - 88 - 70}) scale(1.55)` }, P.slot);
        S.p1Part = Kit.Part(pg, { kind: 'bearing' });
        const tg = el('g', { transform: `translate(205 ${aH - 88 - 138}) scale(1.2)` }, P.slot);
        S.p1Tag = Kit.Tag(tg, { lines: ['P/N 123-A', 'QTY 2'] });
      }
      // panel 2: clean carton vs scuffed carton
      {
        const P = S.panels[1].p, aH = P.areaH;
        benchTop(P.slot, aH);
        S.p2y = aH - 88;
        S.p2Clean = el('g', {}, P.slot);
        S.p2CleanC = Kit.Carton(S.p2Clean, { w: 140, h: 120, d: 50 });
        S.p2Ok = Kit.GreenCheck(el('g', { transform: 'translate(22 -176)' }, S.p2Clean), { size: 56 });
        S.p2Dirty = el('g', {}, P.slot);
        S.p2DirtyC = Kit.Carton(S.p2Dirty, { w: 140, h: 120, d: 50 });
        S.p2Bad = Kit.RedX(el('g', { transform: 'translate(22 -176)' }, S.p2Dirty), { size: 56 });
      }
      // panel 3: clock with cut-off wedge, three trucks leaving, a carton making the last one
      {
        const P = S.panels[2].p;
        const cg = el('g', { transform: 'translate(132 170)' }, P.slot);
        S.p3Clock = Kit.Clock(cg, { size: 180 });
        S.p3Lanes = [150, 290, 430];
        S.p3Trucks = S.p3Lanes.map(y => {
          const g = el('g', {}, P.slot);
          return { g, y, k: Kit.BoxTruck(g, { cargo: true }) };
        });
        S.p3CartonG = el('g', {}, P.slot);
        S.p3Carton = Kit.Carton(S.p3CartonG, { w: 116, h: 110, d: 50 });
      }

      // ================= b07: the 50 lb scale =================
      S.scView = el('g', {}, root);
      S.sc = [0, 1].map(() => {
        const g = el('g', {}, S.scView);
        const scale = Scale(g);
        const cg = el('g', { transform: 'translate(0 -100)' }, g);
        const carton = Kit.Carton(cg, { w: 100, h: 76, d: 26 });
        return { g, scale, cg, carton };
      });
      // the worker's carton: same Kit.Carton as on the scale, drawn behind the worker's arms and
      // moved with his hands, so the hand-over from the scale is seamless
      S.liftG = el('g', {}, S.scView);
      S.liftC = Kit.Carton(S.liftG, { w: 100, h: 76, d: 26 });
      S.wkG = el('g', {}, S.scView);
      S.wk = Kit.Worker(S.wkG, { stroke: 2.5 / 1.2 });
      S.partKinds = ['hosecoil', 'bolt', 'sealring', 'brakeshoe', 'bearing', 'shaft'];
      S.partW = [9, 8, 10, 10, 11, 10];
      S.flyG = el('g', {}, S.scView);
      S.sparts = S.partKinds.map(kind => { const g = el('g', {}, S.flyG); return { g, p: Kit.Part(g, { kind }) }; });
      S.scX = [el('g', {}, S.scView), el('g', {}, S.scView)];
      S.scRedX = Kit.RedX(S.scX[0], { size: 56 });
      S.scOk = [Kit.GreenCheck(S.scX[0], { size: 56 }), Kit.GreenCheck(S.scX[1], { size: 56 })];
      S.wkOkG = el('g', {}, S.scView);
      S.wkOk = Kit.GreenCheck(S.wkOkG, { size: 56 });
      S.headRule = Kit.Heading(root, { text: 'General rule: one carton ≤ 50 lb' });
      S.headVary = Kit.Heading(root, { text: 'Varies with size, shape, dimensions', size: 34, weight: 500, color: C.inkSoft, y: 206 });
      // worker stops so its carton (lift-bent-knees) sits exactly where carton 1 sits on scale 1
      S.wkScale = 1.2;
      T.wkArrive = T.wkIn + (720 - 34 - 57.6 + 80) / (Kit.Worker.WALK_SPEED * 0.9 * S.wkScale);
      T.crouch = T.wkArrive + 0.25;
      T.rise2 = T.crouch + 0.9;

      // ---- lower third (persists through the scene) ----
      S.lt = Kit.LowerThird(root, { texts: ['6. Warehouse Location System', '7. Mezzanine Storage', '8. Packing and Shipping'] });
      S.ltTimes = [b1.start, b3.start, b5.start];
      return S;
    },

    render(t, ctx, S) {
      const T = S.T;
      S.lt.update({ t, times: S.ltTimes });
      renderMap(t, S, T);
      renderRack(t, S, T);
      renderMezz(t, S, T);
      renderPack(t, S, T);
      renderPanels(t, S, T);
      renderScale(t, S, T);
    },
  });

  // ------------------------------------------------------------------ b01–b02 map
  function renderMap(t, S, T) {
    const { MX, MY, MS, FY, WS, WALK_X1 } = S.map;
    // zoom into row B: scale the whole map view about row B's centre while it fades
    const z = prog(t, T.zoom, 1.1, ease.inOut);
    const vis = t < T.zoom + 1.2;
    show(S.mapView, vis);
    if (!vis) return;
    const P = [MX + 278 * MS, MY + 208 * MS], Q = [S.rack.RX, FLOOR - 280 * S.rack.RS];
    const s = lerp(1, 4, z);
    place(S.mapView, { x: lerp(P[0], Q[0], z) - s * P[0], y: lerp(P[1], Q[1], z) - s * P[1], s, o: 1 - prog(t, T.zoom + 0.3, 0.45, ease.exit) });
    S.whMap.update({ draw: lin(t, T.mapDraw, 1.6), rows: clamp((t - T.rows) / 0.35, 0, 6), zones: 0 });
    // worker walks in through the side door and along the front aisle, leaving a dotted trail
    const wx = -40 + clamp((t - T.walk0) * S.walkSpeed, 0, S.walkDist);
    const walking = t >= T.walk0 && t < T.walk1;
    const pose = Kit.Worker.poseAt(t, [[-INF, 'walk'], [T.walk1, 'stand'], [T.point, 'point'], [T.signs + 0.4, 'stand']]);
    const wo = lin(t, T.walk0, 0.3);
    show(S.mapWkG, wo > 0);
    place(S.mapWkG, { x: wx, y: FY, s: WS, o: wo });
    S.mapWk.update({ ...pose, t, walking: walking ? 1 : 0, stride: 0.9, aim: 130, stroke: 2.5 / 0.4 });
    for (const d of S.trail) show(d.n, t >= T.walk0 && d.x < wx - 26);
    S.signs.forEach((sg, i) => sg.update({ on: lin(t, T.signs + 0.22 * i, 1.3), t }));
    S.headAisles.update({ t, tIn: T.signs, tOut: T.zoom + 0.35 });
  }

  // ------------------------------------------------------------------ b02 rack close-up
  function renderRack(t, S, T) {
    const tIn = T.zoom + 0.6;
    const vis = t >= tIn && t < T.out2 + 0.4;
    show(S.rackView, vis);
    const fl = pin(t, tIn, 0.6) * 1;
    set(S.floorG, { opacity: r2(fl) });
    show(S.floorG, fl > 0);
    S.headSections.update({ t, tIn: T.zoom + 0.9, tOut: T.out2 + 0.35 });
    if (!vis) return;
    const k = pin(t, tIn, 0.6), sc = lerp(0.72, 1, k), Q = [S.rack.RX, FLOOR - 280 * S.rack.RS];
    const out = pout(t, T.out2, 0.35);
    place(S.rackView, { x: Q[0] * (1 - sc), y: Q[1] * (1 - sc) - 16 * out, s: sc, o: k * (1 - out) });
    S.rackSign.update({ on: 1, t });
    const asmEnd = T.asm + 0.35 * 2 + 0.75;
    S.rackK.update({ state: 'stocked', t, bins: { 7: { labelOutline: t >= asmEnd + 0.5 ? 'accent' : null } } });
    S.markers.forEach((m, i) => {
      const f = S.fly[1];
      m.update({ on: lin(t, T.mark0 + 0.25 * i, 0.45), outline: i === 1 && t >= f.t0 - 0.2 && t < f.t0 + 0.8 ? 'accent' : null, t });
    });
    const sh = S.fly[2];
    set(S.shelfHalo, { opacity: r2(lin(t, sh.t0 - 0.2, 0.2) * (1 - lin(t, sh.t0 + 0.8, 0.3))) });
    // label box, flying pieces, hyphens, brackets
    const lb = pin(t, T.asm - 0.3, 0.4);
    set(S.labBox, { opacity: r2(lb), transform: `translate(${S.lab.LX} ${r2(S.lab.LY + 16 * (1 - lb))})` });
    show(S.labBox, lb > 0);
    S.fly.forEach(f => {
      const u = prog(t, f.t0, 0.75, ease.inOut);
      const x = lerp(f.from.x, f.to.x, u), y = lerp(f.from.y, f.to.y, u) - 150 * Math.sin(Math.PI * u);
      const s = lerp(f.from.size / S.lab.PS, 1, u);
      place(f.g, { x, y, s, o: lin(t, f.t0, 0.12) });
      show(f.g, t >= f.t0);
    });
    S.hyph.forEach((h, i) => set(h, { opacity: r2(lin(t, S.fly[i + 1].t0 + 0.6, 0.25)) }));
    S.brk.forEach((b, i) => {
      const tb = asmEnd + 0.15 * i;
      drawTo(b.path, lin(t, tb, 0.3));
      set(b.lbl, { opacity: r2(lin(t, tb + 0.15, 0.25)) });
    });
    const cp = prog(t, asmEnd + 0.4, 0.6, ease.enter);
    show(S.connector, cp > 0.01);
    set(S.connector, { d: `M${r2(S.conA[0])} ${r2(S.conA[1])}L${r2(lerp(S.conA[0], S.conB[0], cp))} ${r2(lerp(S.conA[1], S.conB[1], cp))}` });
    // supervisor walks in from the right, waves, then the callout
    const walkD = 1990 - S.supX, sp = Kit.Worker.WALK_SPEED * 0.9;
    const tStop = T.sup + walkD / sp;
    const sx = 1990 - clamp((t - T.sup) * sp, 0, walkD);
    const walking = t >= T.sup && t < tStop;
    show(S.supG, t >= T.sup);
    place(S.supG, { x: sx, y: FLOOR });
    const pose = Kit.Worker.poseAt(t, [[-INF, 'walk'], [tStop, 'stand'], [T.callout - 0.1, 'wave'], [T.callout + 1.5, 'stand']]);
    const an = S.sup.update({ ...pose, t, walking: walking ? 1 : 0, stride: 0.9, facing: -1 });
    place(S.supCallG, { x: S.supX + an.head[0], y: FLOOR + an.head[1] - 12 });
    S.supCall.update({ t, tIn: T.callout, tOut: T.out2 + 0.35 });
  }

  // ------------------------------------------------------------------ b03–b04 mezzanine
  function renderMezz(t, S, T) {
    const vis = t >= T.mzBuild && t < T.out4 + 0.4;
    show(S.mzView, vis);
    S.list.update({
      t, tIn: T.list, tOut: T.out4 + 0.35,
      rows: [T.row1, T.row2, T.row3, T.sign - 0.2],
      ticks: [T.stays + 0.8, T.float[2] + 1.5, T.clear1 + 0.1, T.sign + 0.8],
    });
    place(S.list.g, { x: 80, y: S.listY });
    if (!vis) return;
    const out = pout(t, T.out4, 0.35);
    place(S.mzView, { y: -16 * out, o: 1 - out });
    S.mz.update({ build: lin(t, T.mzBuild, 1.6) });
    // pallet that stays below + its tag
    const pp = pin(t, T.mzBuild + 0.9, 0.4);
    place(S.tagG, { x: 330 - 102 + 10, y: -194 + 8 + 24 * (1 - pp) });
    place(S.palG, { x: 330, y: 24 * (1 - pp), s: 0.85, o: pp });
    S.pallet.update({ count: 4, t });
    S.staysTag.update({ on: lin(t, T.stays, 0.9), t });
    // light cartons float up the stairs, over the deck, onto the shelf (slightly askew), then snap
    S.light.forEach((c, i) => {
      const t0 = T.float[i], u = prog(t, t0, 1.5, ease.inOut);
      const xs = S.slots[i], [ax, ar] = S.askew[i];
      const snap = spring(t, [[T.snap + 0.12 * i, 1]]);
      const fx = xs + ax * (1 - snap), fr = ar * (1 - snap);
      const pts = [[-640, -12], [-230, -350], [xs, -500], [fx, MZ.shelfY]];
      const segs = [0.42, 0.82, 1];
      let x, y;
      if (u < segs[0]) { const k = u / segs[0]; x = lerp(pts[0][0], pts[1][0], k); y = lerp(pts[0][1], pts[1][1], k); }
      else if (u < segs[1]) { const k = (u - segs[0]) / (segs[1] - segs[0]); x = lerp(pts[1][0], pts[2][0], k); y = lerp(pts[1][1], pts[2][1], k) - 20 * Math.sin(Math.PI * k); }
      else { const k = (u - segs[1]) / (1 - segs[1]); x = lerp(pts[2][0], pts[3][0], k); y = lerp(pts[2][1], pts[3][1], k); }
      const flying = u > 0 && u < 1;
      const bob = flying ? 3 * Math.sin((t - t0) * 9) : 0;
      const o = lin(t, t0, 0.25);
      show(c.g, o > 0);
      place(c.g, { x, y: y + bob, r: flying ? 3 * Math.sin((t - t0) * 5) : (u >= 1 ? fr : 0), o });
      c.c.update({ t });
    });
    S.dust.forEach((d, i) => set(d, { opacity: r2(0.45 * (1 - lin(t, T.dust + 0.08 * i, 0.4))) }));
    const dg = lin(t, T.mzBuild + 1.1, 0.4);
    show(S.dustG, dg > 0);
    set(S.dustG, { opacity: r2(dg) });
    // worker walks on at the stair top, sweeps, then stands neat
    const wx0 = -240, wx1 = -92, sp = Kit.Worker.WALK_SPEED * 0.7 * 0.62;
    const tArr = T.wk0 + (wx1 - wx0) / sp;
    const wx = wx0 + clamp((t - T.wk0) * sp, 0, wx1 - wx0);
    const wo = lin(t, T.wk0, 0.35);
    show(S.mzWkG, wo > 0);
    place(S.mzWkG, { x: wx, y: MZ.standY + 2, s: 0.62, o: wo });
    const pose = Kit.Worker.poseAt(t, [[-INF, 'walk'], [tArr, 'stand'], [T.sweep, 'sweep'], [T.clear1 + 0.2, 'neat']]);
    S.mzWk.update({ ...pose, t, walking: t >= T.wk0 && t < tArr ? 1 : 0, stride: 0.7 });
    S.debris.update({ clear: lin(t, T.clear0, T.clear1 - T.clear0), t });
    const db = lin(t, T.mzBuild + 0.6, 0.4);
    show(S.debrisG, db > 0);
    set(S.debrisG, { opacity: r2(db) });
    S.wsign.update({ on: lin(t, T.sign, 0.75) });
    S.wsCheck.update({ t, tIn: T.sign + 0.8 });
  }

  // ------------------------------------------------------------------ b05 packing and shipping
  function renderPack(t, S, T) {
    const vis = t >= T.p0 && t < T.out5 + 0.4;
    show(S.packView, vis);
    S.headComplete.update({ t, tIn: T.mirror + 1.2, tOut: T.out5 + 0.35 });
    S.okHeadCheck.update({ t, tIn: T.mirror + 1.35, tOut: T.out5 + 0.35 });
    if (!vis) return;
    const out = pout(t, T.out5, 0.35);
    place(S.packView, { y: -16 * out, o: 1 - out });
    const bp = pin(t, T.p0, 0.4);
    place(S.benchG, { x: 960, y: FLOOR + 24 * (1 - bp), o: bp });
    S.side.forEach((d, k) => {
      // k = 0: the first shipment (incomplete, to the right); k = 1: the mirrored, complete one
      const t0 = k === 0 ? T.p0 : T.mirror;
      const arrowT = k === 0 ? T.arrow : T.mirror + 0.05;
      const ship = k === 0 ? T.ship : T.mirror + 0.25;
      const open = k === 0 ? T.open : ship + 0.75;
      const rise = k === 0 ? T.rise : open + 0.15;
      const e = pin(t, t0, 0.4);
      show(d.g, t >= t0);
      place(d.g, { x: 24 * (1 - e) * d.dir, o: e });
      const stopped = k === 0 && t >= T.stopped;
      d.machine.update({ state: stopped ? 'stopped' : 'running', t, angle: k === 0 ? gearAngle(t, T.stop) : gearAngle(t), alert: stopped, stroke: 2.5 / 1.05 });
      d.cust.update({ pose: 'stand', t, facing: -d.dir });
      // carton: on the bench, then along the arc to the customer, then opens
      d.arrow.update(lin(t, arrowT, 0.5));
      set(d.arrow.g, { opacity: r2(1 - lin(t, open + 0.2, 0.4)) });
      const u = prog(t, ship, 0.8, ease.inOut);
      const a = [960 - d.dir * 20, FLOOR - 170], c = [960 + d.dir * 160, FLOOR - 470], b = [d.land, FLOOR];
      const [cx, cy] = qb(a, c, b, u);
      const co = k === 0 ? pin(t, T.p0 + 0.15, 0.4) : pin(t, T.mirror, 0.3);
      show(d.cartonG, co > 0);
      place(d.cartonG, { x: cx, y: cy, r: 8 * Math.sin(Math.PI * u) * d.dir, o: co });
      d.carton.update({ open: lin(t, open, 0.5), tape: 1, t });
      // parts rise out of the open carton; the middle one is missing from the first shipment
      d.parts.forEach((pt, i) => {
        const q = pin(t, rise + 0.1 * i, 0.5);
        show(pt.pg, q > 0);
        place(pt.pg, { x: pt.x - 8, y: lerp(-40, -170, q), s: 0.75 });
        pt.p.update({ missing: k === 0 && i === 1, t });
      });
    });
    place(S.missG, { x: S.side[0].land + 6, y: FLOOR - 230 });
    S.miss.update({ t, tIn: T.missing });
    S.frown.update({ t, tIn: T.frown });
    S.custCheck.update({ t, tIn: T.mirror + 1.35 });
  }

  // ------------------------------------------------------------------ b06 three panels
  function renderPanels(t, S, T) {
    const tOut = T.out6 + 0.35;
    const ins = [T.pn1, T.pn2, T.pn3];
    const marks = [T.tag + 1.9, T.fade + 0.9, T.pn3 + 4.6];
    S.panels.forEach((p, i) => {
      show(p.g, t >= ins[i] && t < tOut + 0.05);
      p.p.update({ t, tIn: ins[i], tOut, from: 'below', mark: 'check', tMark: marks[i] });
    });
    if (t < T.pn1 || t > tOut) return;
    // panel 1: the tag swings onto the part and writes its text
    S.p1Part.update({ state: 'new', tag: false, t });
    S.p1Tag.update({ on: lin(t, T.tag, 0.9), write: lin(t, T.tag + 0.6, 1.1), t });
    // panel 2: wrong (scuffed) first, then right (clean); the scuffed one fades out, clean centres
    const fo = pout(t, T.fade, 0.5);
    const mv = prog(t, T.fade + 0.3, 0.7, ease.enter);
    place(S.p2Clean, { x: lerp(150, 238, mv), y: S.p2y });
    S.p2CleanC.update({ t });
    S.p2Ok.update({ t, tIn: T.good });
    place(S.p2Dirty, { x: 360, y: S.p2y + 16 * fo, o: 1 - fo });
    show(S.p2Dirty, fo < 1);
    S.p2DirtyC.update({ scuff: 1, t });
    S.p2Bad.update({ t, tIn: T.bad });
    // panel 3: the minute hand runs toward the cut-off wedge; trucks leave; the carton makes the last
    const c0 = T.pn3 + 0.3;
    const minute = lerp(10, 49, prog(t, c0 + 0.2, 3.8, ease.linear));
    S.p3Clock.update({ t, state: 'cut-off', tState: c0, time: [4, minute] });
    const leave = [c0 + 1.0, c0 + 2.0, c0 + 3.5];
    S.p3Trucks.forEach((tr, i) => {
      const d = prog(t, leave[i], 1.1, ease.in) * 360;
      place(tr.g, { x: 372 + d, y: tr.y + 52, s: [-0.3, 0.3] });
      tr.k.update({ arrive: 1, roll: d / 0.3, t });
    });
    const cu = prog(t, c0 + 2.3, 0.8, ease.inOut);
    const co = lin(t, c0 + 2.1, 0.2) * (1 - lin(t, c0 + 3.05, 0.15));
    show(S.p3CartonG, co > 0);
    place(S.p3CartonG, { x: lerp(150, 268, cu), y: S.p3Lanes[2] + 52 - 26 * cu - 30 * Math.sin(Math.PI * cu), s: 0.5, o: co });
    S.p3Carton.update({ tape: 1, t });
  }

  // ------------------------------------------------------------------ b07 the 50 lb scale
  // Carton offset on each platform (left of centre, so the Worker can lift it from the side).
  const C1X = -34, WK_PROP = 57.6; // lift-bent-knees carton centre at 48 * 1.2 in front of the hip
  function renderScale(t, S, T) {
    const vis = t >= T.sc0;
    show(S.scView, vis);
    S.headRule.update({ t, tIn: T.rule });
    S.headVary.update({ t, tIn: T.vary });
    if (!vis) return;
    const e0 = pin(t, T.sc0, 0.4);
    const mv = prog(t, T.split, 0.8, ease.enter);
    const x1 = lerp(880, 720, mv);
    const e2 = pin(t, T.split + 0.3, 0.45);
    const x2 = 1240 + 24 * (1 - e2);
    place(S.sc[0].g, { x: x1, y: FLOOR + 24 * (1 - e0), o: e0 });
    place(S.sc[1].g, { x: x2, y: FLOOR, o: e2 });
    show(S.sc[1].g, e2 > 0);
    // weights: six drops into carton 1, three parts move to carton 2, the worker lifts carton 1
    const xferPart = [5, 4, 3];
    const ev1 = S.partW.map((w, i) => [T.drops[i] + 0.4, w]);
    const ev2 = [];
    xferPart.forEach((pi, k) => { ev1.push([T.xfer[k] + 0.1, -S.partW[pi]]); ev2.push([T.xfer[k] + 0.7, S.partW[pi]]); });
    ev1.push([T.rise2 + 0.15, -(S.partW[0] + S.partW[1] + S.partW[2])]);
    const w1 = Math.max(0, spring(t, ev1)), w2 = spring(t, ev2);
    const v1 = t >= T.checks ? 'correct' : t >= T.over + 0.1 && t < T.xfer[0] + 0.3 ? 'error' : 'ink';
    const v2 = t >= T.checks + 0.15 ? 'correct' : 'ink';
    S.sc[0].scale.update({ w: w1, variant: v1, bump: t >= T.checks ? T.checks : t >= T.xfer[0] + 0.3 ? T.xfer[0] + 0.3 : T.over + 0.1, t });
    S.sc[1].scale.update({ w: w2, variant: v2, bump: T.checks + 0.15, t, phase: 1.3 });
    // carton 1: open, bulges when over packed, closes and tapes once both are under the line
    const overB = lin(t, T.over, 0.4) * (1 - lin(t, T.xfer[0] + 0.3, 0.5));
    const cl = lin(t, T.close, 0.45), tp = lin(t, T.close + 0.45, 0.5);
    S.sc.forEach(s => set(s.cg, { transform: `translate(${C1X} -100)` }));
    S.sc[0].carton.update({ open: 1 - cl, tape: tp, bulge: overB, outline: overB > 0.05 ? 'error' : null, t });
    S.sc[1].carton.update({ open: 1 - cl, tape: tp, t });
    // carton 1 hands over to the worker's carton the moment the crouch completes
    show(S.sc[0].cg, t < T.crouch + 0.3);
    // falling / moving parts in stage coords; a part is hidden once it drops below a rim
    const rim1 = [x1 + C1X + 10, FLOOR - 176], rim2 = [x2 + C1X + 10, FLOOR - 176];
    const offs = [-24, 16, -6, 20, -22, 18];
    const restY = i => (i >= 4 ? rim1[1] - 12 - (i - 4) * 10 : rim1[1] - 4);
    S.sparts.forEach((sp, i) => {
      const td = T.drops[i], k = xferPart.indexOf(i);
      let x = 0, y = 0, on = false, r = 0;
      if (t >= td && (k < 0 || t < T.xfer[k])) {
        const u = clamp((t - td) / 0.4);
        x = rim1[0] + offs[i];
        y = lerp(rim1[1] - 300, restY(i), u * u);
        on = u < 1 || i >= 4;
        r = 30 * (1 - u) * (i % 2 ? 1 : -1);
      } else if (k >= 0 && t >= T.xfer[k]) {
        const u = prog(t, T.xfer[k], 0.7, ease.inOut);
        const a = [rim1[0] + offs[i], restY(i)], b = [rim2[0] + offs[i] * 0.6, rim2[1] - 4];
        const c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 110]; // low arc: passes under the dial badge
        [x, y] = qb(a, c, b, u);
        on = u < 0.99;
        r = 200 * u;
      }
      show(sp.g, on);
      if (on) { place(sp.g, { x, y, r, s: 0.5 }); sp.p.update({ t }); }
    });
    // marks over the cartons
    place(S.scX[0], { x: x1 + C1X + 12, y: FLOOR - 270 });
    place(S.scX[1], { x: x2 + C1X + 12, y: FLOOR - 270 });
    S.scRedX.update({ t, tIn: T.over + 0.2, tOut: T.split + 0.35 });
    S.scOk[0].update({ t, tIn: T.checks, tOut: T.wkIn + 1.2 });
    S.scOk[1].update({ t, tIn: T.checks + 0.15 });
    // worker walks in from the left, crouches with a straight back and bent knees, lifts the carton
    const ws = S.wkScale, sp = Kit.Worker.WALK_SPEED * 0.9 * ws;
    const wx1 = 720 + C1X - WK_PROP;
    const wx = -80 + clamp((t - T.wkIn) * sp, 0, wx1 + 80);
    const walking = t >= T.wkIn && t < T.wkArrive;
    show(S.wkG, t >= T.wkIn);
    place(S.wkG, { x: wx, y: FLOOR, s: ws });
    const pose = t < T.rise2
      ? Kit.Worker.poseAt(t, [[-INF, 'walk'], [T.wkArrive, 'stand'], [T.crouch, 'lift-bent-knees']], 0.3)
      : Kit.Worker.poseAt(t, [[-INF, 'lift-bent-knees'], [T.rise2, 'carry-carton']], 0.6);
    const an = S.wk.update({ ...pose, t, walking: walking ? 1 : 0, stride: 0.9, stroke: 2.5 / ws, prop: false });
    // lift carton: bottom-centre between the hands, as the Worker places its own carton
    const held = t >= T.crouch + 0.3;
    show(S.liftG, held);
    if (held) {
      place(S.liftG, { x: wx + ((an.hand[0] + an.hand2[0]) / 2 - 2) * ws, y: FLOOR + (Math.max(an.hand[1], an.hand2[1]) + 8) * ws });
      S.liftC.update({ tape: 1, t });
    }
    place(S.wkOkG, { x: wx + an.head[0] * ws - 80, y: FLOOR + an.head[1] * ws - 4 });
    S.wkOk.update({ t, tIn: T.rise2 + 0.7 });
  }
})();
