// Scene s03: Packaging and Storing of Parts (packet sections 4 and 5).
//   b01-b04  packaging bench: three cartons, then multipack, set and kit in turn (stage A)
//   b05      camera pans right to a rack: cartons turn so the part number faces front (stage B)
//   b06      do/don't for mixed bins + a worn bin label replaced
//   b07      outdoor strip: weatherproof crate vs carton with condensation and rust
//   b08-b09  proper-stocking checklist (six rows) beside a rack, a strap/tag clean-up and Each vs Pkg of 10
//   b10      improper stocking: five-row do/don't table
// Every time comes from ctx.beat / ctx.cue; render(t) is a pure function of t.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C, ease, text, measure, show } = Kit;
  const INF = Infinity;
  const FLOOR = 800;

  const lin = (t, t0, d) => clamp((t - t0) / d);
  const pe = (t, t0, d = 0.4) => ease.enter(lin(t, t0, d));
  const px = (t, t0, d = 0.3) => ease.exit(lin(t, t0, d));
  const io = (t, t0, d) => Engine.ease.inOut(lin(t, t0, d));
  const r1 = v => Math.round(v * 10) / 10;
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    p = clamp(p);
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
  };
  const REAR = mix(C.steel, C.bgLight, 0.62);
  const DECK = mix(C.steel, C.paper, 0.55);
  const STEEL_LIGHT = mix(C.steel, C.paper, 0.55);
  const SKY = mix(C.neutral, C.paper, 0.8);
  const dRect = (x, y, w, h, r = 0) => (r
    ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
    : `M${x} ${y}h${w}v${h}h${-w}Z`);
  const dCircle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

  // Opacity envelope: enter (STYLE enter curve) from tIn, exit (exit curve) finishing at tOut.
  function env(t, tIn, tOut = INF, enter = 0.4, exit = 0.3) {
    const a = tIn === -INF ? 1 : pe(t, tIn, enter);
    const b = tOut === INF ? 0 : px(t, tOut - exit, exit);
    return { a, b, o: a * (1 - b) };
  }
  // Place a group with the standard entrance (fade + `from` offset) and exit (fade + `to` offset).
  // Returns false (and hides the group) while it is invisible, so callers can skip updates.
  function stageIn(node, t, tIn, tOut, { x = 0, y = 0, s = 1, r = 0, from = [0, 24], to = [0, -16], enter = 0.4, exit = 0.3 } = {}) {
    const v = env(t, tIn, tOut, enter, exit);
    const on = v.o > 0.001;
    show(node, on);
    if (on) place(node, { x: x + from[0] * (1 - v.a) + to[0] * v.b, y: y + from[1] * (1 - v.a) + to[1] * v.b, s, r, o: v.o });
    return on;
  }
  // A path that draws on: drawTo(node, p) with p 0..1.
  const drawOn = (parent, d, attrs = {}) => el('path', { d, fill: 'none', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', stroke: C.ink, 'stroke-width': 4, ...attrs }, parent);
  const drawTo = (node, p) => { show(node, p > 0.001); set(node, { 'stroke-dashoffset': 1 - clamp(p) }); };
  // Curly braces: horizontal under x0..x1 (point down by h); vertical right of y0..y1 (point right by h).
  function braceH(x0, x1, y, h) {
    const m = (x0 + x1) / 2, q = h / 2;
    return `M${x0} ${y}Q${x0} ${y + q} ${x0 + q} ${y + q}L${m - q} ${y + q}Q${m} ${y + q} ${m} ${y + h}Q${m} ${y + q} ${m + q} ${y + q}L${x1 - q} ${y + q}Q${x1} ${y + q} ${x1} ${y}`;
  }
  function braceV(x, y0, y1, h) {
    const m = (y0 + y1) / 2, q = h / 2;
    return `M${x} ${y0}Q${x + q} ${y0} ${x + q} ${y0 + q}L${x + q} ${m - q}Q${x + q} ${m} ${x + h} ${m}Q${x + q} ${m} ${x + q} ${m + q}L${x + q} ${y1 - q}Q${x + q} ${y1} ${x} ${y1}`;
  }
  function wrapText(str, size, weight, maxW) {
    const out = [];
    let line = '';
    for (const word of str.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, size, weight) > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
    return out;
  }
  // Jagged rectangle outline (a cardboard cutaway).
  function jagRect(cx, cy, w, h, n = 7, amp = 3) {
    const pts = [];
    const edge = (ax, ay, bx, by, nx, ny) => {
      for (let i = 0; i < n; i++) {
        const u = i / n, o = i % 2 ? amp : -amp;
        pts.push([ax + (bx - ax) * u + nx * o, ay + (by - ay) * u + ny * o]);
      }
    };
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    edge(x0, y0, x1, y0, 0, 1); edge(x1, y0, x1, y1, -1, 0); edge(x1, y1, x0, y1, 0, -1); edge(x0, y1, x0, y0, 1, 0);
    return 'M' + pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join('L') + 'Z';
  }

  // A shelf bin seen from the front: rear wall, deck edge, items, top and front beams, uprights.
  // Origin: bottom-centre of the front beam; items stand at y = -beam - 6. legs: upright length below 0.
  function binFrame(parent, { w = 440, h = 260, beam = 50, legs = 0, topBeam = 26 } = {}) {
    const g = el('g', {}, parent), UW = 20;
    el('rect', { x: -w / 2, y: -h, width: w, height: h - beam, fill: REAR }, g);
    el('path', { d: `M${-w / 2} ${-beam}L${-w / 2 + 14} ${-beam - 12}H${w / 2 - 6}L${w / 2} ${-beam}Z`, fill: DECK, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    const items = el('g', {}, g);
    if (topBeam) el('rect', { x: -w / 2, y: -h, width: w, height: topBeam, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, g);
    el('rect', { x: -w / 2, y: -beam, width: w, height: beam, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, g);
    [-1, 1].forEach(sg => {
      const x = sg < 0 ? -w / 2 - UW : w / 2;
      el('rect', { x, y: -h - 10, width: UW, height: h + 10 + legs, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2.5 }, g);
      let d = '';
      for (let y = -h; y < legs - 12; y += 22) d += `M${x + UW / 2 - 3} ${y}h6v8h-6z`;
      el('path', { d, fill: C.ink, opacity: 0.5 }, g);
    });
    const front = el('g', {}, g);
    return { g, items, front };
  }
  // Oil bearing (plain sleeve bushing) with an oil drop; ~40 x 56. Origin: centre of the sleeve.
  function oilBearing(parent) {
    const g = el('g', {}, parent);
    el('path', { d: dRect(-17, -20, 34, 40, 6), fill: STEEL_LIGHT, stroke: C.ink, 'stroke-width': 2.5 }, g);
    el('path', { d: dRect(-6, -20, 12, 40), fill: C.steelDark, opacity: 0.4 }, g);
    el('path', { d: 'M-17 -7H17M-17 7H17', stroke: C.ink, 'stroke-width': 1.8 }, g);
    el('path', { d: 'M12 -40C17 -33 19 -29 15 -25C11 -22 6 -25 8 -30C9 -33 11 -36 12 -40Z', fill: C.neutral, stroke: C.ink, 'stroke-width': 2 }, g);
    return g;
  }
  // "=" and "≠" signs drawn as strokes. Origin: centre.
  function equalsSign(parent, not) {
    const g = el('g', {}, parent);
    el('path', { d: 'M-18 -8H18M-18 8H18' + (not ? 'M9 -20L-9 20' : ''), stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' }, g);
    return g;
  }

  Engine.scene('s03', {
    build(ctx) {
      const R = ctx.root;
      const b = {};
      ['b01', 'b02', 'b03', 'b04', 'b05', 'b06', 'b07', 'b08', 'b09', 'b10'].forEach(k => { b[k] = ctx.beat(`s03${k}`); });
      const cue = (id, ph, n = 0) => ctx.cue(`s03${id}`, ph, n);
      const fns = [];
      const on = f => fns.push(f);
      const defs = el('defs', {}, R);
      let clipN = 0;
      const clipRect = (x, y, w, h, rx = 0) => {
        const id = `s03-clip-${++clipN}`;
        el('rect', { x, y, width: w, height: h, rx }, el('clipPath', { id }, defs));
        return `url(#${id})`;
      };

      // ------------------------------------------------------------------ timing
      const T = {};
      T.ltIn = b.b01.start + 0.1;
      T.cartonsIn = cue('b01', 'different types');
      T.labels = [0, 1, 2].map(i => cue('b01', 'identified') - 0.1 + 0.45 * i);
      T.nav = cue('b01', 'describes three');
      // stage index 0 = b01 layout, 1 = multipack focus, 2 = set focus, 3 = kit focus
      T.stage = [-INF, b.b02.start + 0.05, b.b03.start + 0.05, b.b04.start + 0.05];
      T.open1 = cue('b02', 'more than one');
      T.bolts = cue('b02', 'for example');
      T.badge = cue('b02', 'quantity of ten');
      T.lift = cue('b02', 'sold as individual');
      T.mpOut = b.b03.start + 0.35;
      T.shoes = cue('b03', 'two or more');
      T.brace3 = cue('b03', 'together make');
      T.stamp3 = cue('b03', 'two brake shoes');
      T.setOut = b.b04.start + 0.35;
      T.cyl = b.b04.start + 0.7;
      T.kitTitle = cue('b04', 'a cylinder seal kit');
      T.open3 = T.kitTitle;
      T.groups = [cue('b04', 'contains seals'), cue('b04', 'seal bearings'), cue('b04', 'oil bearings')];
      T.brace4 = cue('b04', 'together they');
      T.stamp4 = cue('b04', 'hydraulic cylinder');
      // b05: the camera pans to the rack
      T.pan = b.b05.start;
      T.lt2 = b.b05.start + 0.3;
      const dropStart = Math.max(cue('b05', 'warehouse space'), T.pan + 1.0);
      T.drop = [0, 1, 2, 3, 4].map(k => dropStart + 0.45 * k);
      T.headB = cue('b05', 'stacked cartons');
      T.turn = [0, 1, 2].map(j => cue('b05', 'plainly display') + 0.45 * j);
      T.place = cue('b05', 'order filling');
      const WS = 1.05, WV = Kit.Worker.WALK_SPEED * WS;
      const WX = [-170, 380, 655];
      T.w1 = T.pan + 0.9; T.w1e = T.w1 + (WX[1] - WX[0]) / WV;
      T.w2e = T.place - 0.6; T.w2 = T.w2e - (WX[2] - WX[1]) / WV;
      T.outB = b.b06.start + 0.35;
      // b06
      T.dd6 = b.b06.start + 0.25;
      T.dd6dont = Math.max(cue('b06', 'avoid stocking'), T.dd6 + 0.5);
      T.dd6do = cue('b06', 'dissimilar') - 0.3;
      T.card6 = cue('b06', 'every bin location') - 0.1;
      T.repl = cue('b06', 'worn gets') - 0.25;
      T.out6 = b.b07.start + 0.35;
      // b07
      T.strip = b.b07.start + 0.15;
      T.head7 = cue('b07', 'stored outside');
      T.cut = cue('b07', 'moisture');
      T.drops = cue('b07', 'condensation');
      T.callout7 = cue('b07', 'condensation') + 0.3;
      T.rust = cue('b07', 'cause rust');
      T.x7 = T.rust + 1.0;
      T.check7 = T.x7 + 1.2;
      T.out7 = b.b08.start + 0.35;
      // b08-b09 checklist
      T.cl = b.b08.start + 0.3;
      T.rows = [cue('b08', 'every part placed'), cue('b08', 'all part numbers'), cue('b08', 'overstock locations'),
        b.b09.start + 0.25, cue('b09', 'remove unnecessary'), cue('b09', 'and make it clear')];
      T.ticks = [cue('b08', 'visible part number') + 0.6, cue('b08', 'face front') + 0.5, cue('b08', 'permanent location'),
        cue('b09', 'time frames') + 0.4, cue('b09', 'strapping') + 0.6, cue('b09', 'package quantity') + 0.6];
      T.rack8 = b.b08.start + 0.45;
      T.rack8Out = b.b09.start + 0.35;
      T.turn8 = cue('b08', 'face front') - 0.1;
      T.tags8 = cue('b08', 'clearly tagged');
      T.arrows8 = cue('b08', 'used before');
      T.clockIn = b.b09.start + 0.4;
      T.clockOut = cue('b09', 'remove unnecessary') + 0.3;
      T.c9In = cue('b09', 'remove unnecessary') + 0.25;
      T.tagOff = cue('b09', 'tags');
      T.sciIn = cue('b09', 'wire') - 0.2;
      T.snip = cue('b09', 'strapping');
      T.c9Out = cue('b09', 'and make it clear') + 0.6;
      T.flipIn = cue('b09', 'and make it clear') + 0.35;
      T.flips = [0, 1, 2, 3].map(k => T.flipIn + 0.7 + 0.6 * k);
      T.settle = Math.max(T.flips[3] + 0.6, cue('b09', 'package quantity') - 0.3);
      T.out9 = b.b10.start + 0.35;
      // b10
      T.dd10 = b.b10.start + 0.3;
      T.rows10 = [
        [cue('b10', 'never overstock'), cue('b10', 'location changed') - 0.3],
        [cue('b10', 'never overload'), cue('b10', 'or shelves')],
        [cue('b10', 'make sure the part number'), cue('b10', 'match the part')],
        [cue('b10', 'do not remove'), cue('b10', 'guards against')],
        [cue('b10', 'and store parts'), cue('b10', 'surfaces are protected')],
      ];

      // ------------------------------------------------------------------ background and floor
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, R);
      const floorG = el('g', {}, R);
      el('rect', { x: 0, y: FLOOR, width: 1920, height: 1080 - FLOOR, fill: C.floor }, floorG);
      const joints = el('path', { fill: 'none', stroke: mix(C.floor, C.steel, 0.28), 'stroke-width': 2 }, floorG);
      el('line', { x1: 0, x2: 1920, y1: FLOOR, y2: FLOOR, stroke: mix(C.floor, C.steel, 0.45), 'stroke-width': 2 }, floorG);
      const camX = t => -1920 * io(t, T.pan, 0.8);
      on(t => {
        let fo = 1;
        if (t >= b.b06.start) fo = 1 - px(t, b.b06.start, 0.4);
        if (t >= b.b08.start) fo = pe(t, b.b08.start + 0.2, 0.4);
        if (t >= b.b10.start) fo = 1 - px(t, b.b10.start, 0.4);
        show(floorG, fo > 0.001);
        set(floorG, { opacity: fo });
        // floor joints move with the camera, so the pan reads as travel
        const sp = 320, o = ((camX(t) % sp) + sp) % sp;
        let d = '';
        for (let k = -1; k < 8; k++) d += `M${r1(o + k * sp)} ${FLOOR}l-70 ${1080 - FLOOR}`;
        set(joints, { d });
      });

      // ================================================================== STAGE A: packaging (b01-b04)
      const stageA = el('g', {}, R);
      on(t => { const x = camX(t); show(stageA, x > -1919); place(stageA, { x }); });

      // ---- navigator heading: "Multiple packaged  •  Set  •  Kit" (active type in ink + accent bar)
      const navG = el('g', {}, stageA);
      const NAV = ['Multiple packaged', 'Set', 'Kit'], NGAP = 24;
      let nx = 80;
      const nav = NAV.map((s, i) => {
        const g = el('g', {}, navG);
        if (i > 0) {
          text(g, '•', { x: nx + NGAP, y: 150, size: 48, weight: 700, fill: C.inkSoft });
          nx += NGAP * 2 + measure('•', 48, 700);
        }
        const node = text(g, s, { x: nx, y: 150, size: 48, weight: 700, fill: C.ink });
        const seg = { g, node, x: nx, w: measure(s, 48, 700) };
        nx += seg.w;
        return seg;
      });
      const navBar = el('rect', { y: 170, height: 6, rx: 3, fill: C.accent }, navG);
      const ACT = [null, 0, 1, 2];
      const stageAt = t => { let k = 0; for (let j = 1; j < 4; j++) if (t >= T.stage[j]) k = j; return k; };
      on(t => {
        if (t > T.pan + 1) return;
        const k = stageAt(t);
        nav.forEach((sg, i) => {
          const v = env(t, T.nav + 0.2 * i);
          show(sg.g, v.o > 0.001);
          place(sg.g, { y: 12 * (1 - v.a), o: v.o });
          const wOf = st => (st === 0 || ACT[st] === i ? 1 : 0);
          const w = k === 0 ? 1 : lerp(wOf(k - 1), wOf(k), lin(t, T.stage[k], 0.3));
          set(sg.node, { fill: mix(C.inkSoft, C.ink, w) });
        });
        if (k === 0) { show(navBar, false); return; }
        const p = pe(t, T.stage[k], 0.5), a = nav[ACT[k]], pr = k > 1 ? nav[ACT[k - 1]] : null;
        const x = pr ? lerp(pr.x, a.x, p) : a.x, w = pr ? lerp(pr.w, a.w, p) : a.w * p;
        show(navBar, w > 0.5);
        set(navBar, { x: r1(x), width: r1(Math.max(0.5, w)) });
      });

      // ---- worker inspecting the cartons (b01)
      const wAg = el('g', {}, stageA);
      const wA = Kit.Worker(wAg, { variant: 'worker', seed: 4 });
      on(t => {
        if (!stageIn(wAg, t, -INF, b.b02.start + 0.35, { x: 300, y: FLOOR, s: 1.35, to: [-16, 0] })) return;
        wA.update({ pose: 'inspect', t, stroke: 2.5 / 1.35 });
      });

      // ---- three cartons: columns in b01, then focus (centre, large) or parked (small, at the sides)
      const FX = 925, FS = 1.6;
      const COLS = [
        [[760, 1.45], [FX, FS], [175, 0.62], [175, 0.62]],
        [[1140, 1.45], [1590, 0.62], [FX, FS], [320, 0.62]],
        [[1520, 1.45], [1735, 0.62], [1735, 0.62], [FX, FS]],
      ];
      const cartonsA = COLS.map(pos => {
        const g = el('g', {}, stageA);
        return { g, c: Kit.Carton(g, { shadow: true }), pos };
      });
      on(t => {
        if (t > T.pan + 1) return;
        const k = stageAt(t);
        cartonsA.forEach(({ g, c, pos }, i) => {
          const p = k === 0 ? 1 : pe(t, T.stage[k], 0.9);
          const A = pos[Math.max(0, k - 1)], Bp = pos[k];
          const v = env(t, T.cartonsIn + 0.12 * i, INF, 0.6);
          show(g, v.o > 0.001);
          if (v.o <= 0.001) return;
          place(g, { x: lerp(A[0], Bp[0], p) + 240 * (1 - v.a), y: FLOOR, s: lerp(A[1], Bp[1], p), o: v.o });
          let open = 0;
          if (i === 0) open = lin(t, T.open1, 0.6) * (1 - lin(t, T.stage[2], 0.45));
          if (i === 2) open = lin(t, T.open3, 0.6);
          c.update({ open, t });
        });
      });
      // column labels (b01)
      const colBadges = NAV.map((s, i) => {
        const g = el('g', {}, stageA);
        place(g, { x: COLS[i][0][0] + 31, y: FLOOR + 52 });
        return Kit.Badge(g, { text: s, variant: 'paper', height: 50, size: 28 });
      });
      on(t => colBadges.forEach((bd, i) => bd.update({ t, tIn: T.labels[i], tOut: b.b02.start + 0.35 })));
      // opening of the focus carton (bolts and kit parts fly out of it)
      const OPEN = [FX + 35, FLOOR - 186];

      // ---- b02 multipack: ten bolts in a 2 x 5 grid, "Package qty 10", one bolt lifted out with a tag
      const mpG = el('g', {}, stageA);
      const card2 = el('g', {}, mpG);
      el('rect', { x: 640, y: 300, width: 640, height: 188, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1.5 }, card2);
      const SLOT = i => [960 + ((i % 5) - 2) * 118, 354 + Math.floor(i / 5) * 84];
      const bolts = Array.from({ length: 10 }, () => { const g = el('g', {}, mpG); return { g, p: Kit.Bolt(g) }; });
      const badge2g = el('g', {}, mpG);
      place(badge2g, { x: 960, y: 300 });
      const badge2 = Kit.Badge(badge2g, { text: 'Package qty 10', variant: 'accent', height: 50, size: 30 });
      const tag2g = el('g', {}, mpG);
      const tag2 = Kit.Tag(tag2g, { lines: ['Sold as', 'individual units'] });
      const LIFT = [1390, 380];
      on(t => {
        if (t < T.bolts - 0.5 || !stageIn(mpG, t, -INF, T.mpOut)) { show(mpG, false); return; }
        const ca = env(t, T.bolts - 0.3);
        show(card2, ca.o > 0.001);
        place(card2, { y: 12 * (1 - ca.a), o: ca.o });
        const bob = 1.2 * Math.sin((2 * Math.PI * t) / 3.2) * lin(t, T.bolts + 1.2, 0.6);
        let tip = null;
        bolts.forEach(({ g, p }, i) => {
          const ti = T.bolts + 0.07 * i, q = lin(t, ti, 0.5);
          show(g, q > 0);
          if (q <= 0) return;
          const [sx, sy] = SLOT(i);
          let x = lerp(OPEN[0], sx, ease.enter(q)), y = lerp(OPEN[1], sy, ease.enter(q)) - 90 * Math.sin(Math.PI * q) + bob;
          let s = lerp(0.35, 1, ease.pop(q)), r = 0;
          if (i === 9) {
            const l = pe(t, T.lift, 0.8);
            x = lerp(x, LIFT[0], l); y = lerp(y, LIFT[1], l) - 30 * Math.sin(Math.PI * l); r = -8 * l; s *= 1 + 0.12 * l;
            const a = (r * Math.PI) / 180;
            tip = [x + Math.cos(a) * 49 * s, y + Math.sin(a) * 49 * s];
          }
          place(g, { x, y, s, r, o: lin(t, ti, 0.12) });
          p.update({ t });
        });
        badge2.update({ t, tIn: T.badge });
        const tagOn = lin(t, T.lift + 0.5, 1.0);
        show(tag2g, tagOn > 0 && !!tip);
        if (tagOn > 0 && tip) {
          place(tag2g, { x: tip[0], y: tip[1], s: 1.15 });
          tag2.update({ on: tagOn, write: lin(t, T.lift + 0.7, 1.1), t });
        }
      });

      // ---- b03 set: two brake shoes, a brace, "2 brake shoes = 1 set"
      const setG = el('g', {}, stageA);
      const shoes = [0, 1].map(() => { const g = el('g', {}, setG); return { g, p: Kit.BrakeShoe(g) }; });
      const brace3 = drawOn(setG, braceH(722, 1198, 412, 32));
      const stamp3g = el('g', {}, setG);
      place(stamp3g, { x: 960, y: 506 });
      const stamp3 = Kit.Stamp(stamp3g, { text: '2 brake shoes = 1 set', size: 48, color: C.ink, angle: -3 });
      on(t => {
        if (t < T.shoes - 0.1 || !stageIn(setG, t, -INF, T.setOut)) { show(setG, false); return; }
        const bob = 1.2 * Math.sin((2 * Math.PI * t) / 3.4);
        shoes.forEach(({ g, p }, i) => {
          const t0 = T.shoes + 0.1 * i, q = pe(t, t0, 0.7), o = lin(t, t0, 0.25);
          show(g, o > 0);
          place(g, { x: [835, 1085][i] + (i ? 560 : -560) * (1 - q), y: 352 + bob, s: 1.7, o });
          p.update({ t });
        });
        drawTo(brace3, pe(t, T.brace3, 0.5));
        stamp3.update({ t, tIn: T.stamp3 });
      });

      // ---- b04 kit: hydraulic cylinder draws in, three part groups slot in, brace, "= 1 kit"
      const kitG = el('g', {}, stageA);
      const title4 = text(kitG, 'Cylinder seal kit', { x: 960, y: 228, size: 40, weight: 700, anchor: 'middle' });
      const KC = [960, 350], KS = 1.32;
      const cylG = el('g', {}, kitG);
      const cylFill = el('g', {}, cylG), cylLine = el('g', {}, cylG);
      const CYL = [
        [dCircle(-246, 0, 20) + dCircle(-246, 0, 7), C.steelDark],
        [dRect(-232, -16, 22, 32), C.steelDark],
        [dRect(-212, -62, 26, 124, 4), C.steelDark],
        [dRect(-186, -54, 312, 108, 6), C.steel],
        [dRect(126, -62, 28, 124, 4), C.steelDark],
        [dRect(154, -13, 76, 26, 3), STEEL_LIGHT],
        [dRect(228, -16, 14, 32), C.steelDark],
        [dCircle(250, 0, 18) + dCircle(250, 0, 7), C.steelDark],
      ];
      const SWK = 2.5 / KS;
      CYL.forEach(([d, fill]) => el('path', { d, fill, 'fill-rule': 'evenodd' }, cylFill));
      el('path', { d: 'M-170 -38H100M168 -5H214', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, cylFill);
      const cylLines = CYL.map(([d]) => drawOn(cylLine, d, { 'stroke-width': SWK }));
      const WIN = [-140, -40, 60];
      const winG = el('g', {}, cylG);
      const wins = WIN.map(x => ({
        bg: el('path', { d: dRect(x - 42, -40, 84, 80, 8), fill: C.paper, stroke: C.ink, 'stroke-width': SWK }, winG),
        dash: el('path', { d: dRect(x - 36, -34, 72, 68, 6), fill: 'none', stroke: C.inkSoft, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, winG),
      }));
      const grp = [0, 1, 2].map(() => el('g', {}, cylG));
      const kitParts = [];
      [[-18, -16], [18, -16], [0, 15]].forEach(([x, y]) => kitParts.push(Kit.SealRing(el('g', { transform: `translate(${x} ${y}) scale(0.46)` }, grp[0]))));
      [[-19, 0], [19, 0]].forEach(([x, y]) => kitParts.push(Kit.Bearing(el('g', { transform: `translate(${x} ${y}) scale(0.4)` }, grp[1]))));
      [[-17, 8], [17, 8]].forEach(([x, y]) => oilBearing(el('g', { transform: `translate(${x} ${y}) scale(0.82)` }, grp[2])));
      kitParts.forEach(p => p.update({}));
      // caption line "Seals  •  Seal bearings  •  Oil bearings", each part revealed as its group lands
      const CAP = ['Seals', 'Seal bearings', 'Oil bearings'], CGAP = 22, CAPY = 502;
      const capW = CAP.map(s => measure(s, 34, 600)), bW = measure('•', 34, 600);
      let ccx = 960 - (capW[0] + capW[1] + capW[2] + 2 * (bW + 2 * CGAP)) / 2;
      const caps = CAP.map((s, i) => {
        const g = el('g', {}, kitG);
        if (i > 0) { text(g, '•', { x: ccx + CGAP, y: CAPY, size: 34, weight: 600, fill: C.inkSoft }); ccx += bW + 2 * CGAP; }
        text(g, s, { x: ccx, y: CAPY, size: 34, weight: 600, fill: C.ink });
        const mid = ccx + capW[i] / 2;
        ccx += capW[i];
        const wx = KC[0] + KS * WIN[i];
        const lead = el('path', { d: `M${r1(wx)} ${KC[1] + KS * 40 + 6}L${r1(mid)} ${CAPY - 38}`, stroke: C.inkSoft, 'stroke-width': 2, 'stroke-dasharray': '3 5', 'stroke-linecap': 'round', fill: 'none' }, g);
        return { g, lead };
      });
      const brace4 = drawOn(kitG, braceV(1336, 262, 514, 34));
      const stamp4g = el('g', {}, kitG);
      place(stamp4g, { x: 1535, y: 388 });
      const stamp4 = Kit.Stamp(stamp4g, { text: '= 1 kit', size: 56, color: C.ink, angle: -4 });
      on(t => {
        const vis = t > b.b04.start && t < T.pan + 1;
        show(kitG, vis);
        if (!vis) return;
        const tv = env(t, T.kitTitle);
        set(title4, { opacity: tv.o, transform: `translate(0 ${r1(10 * (1 - tv.a))})` });
        const bob = 1.2 * Math.sin((2 * Math.PI * t) / 3.6);
        place(cylG, { x: KC[0], y: KC[1] + bob, s: KS });
        const dp = lin(t, T.cyl, 1.2);
        cylLines.forEach(n => drawTo(n, ease.enter(dp)));
        set(cylFill, { opacity: clamp((dp - 0.4) / 0.6) });
        const wo = pe(t, T.cyl + 1.1, 0.4);
        show(winG, wo > 0.001);
        set(winG, { opacity: wo });
        // flight: from the open carton to the window, arc up, pop to size; bump on landing
        const O = [(OPEN[0] - KC[0]) / KS, (OPEN[1] - KC[1]) / KS];
        grp.forEach((g, i) => {
          const tg = T.groups[i], q = lin(t, tg, 0.7);
          show(g, q > 0);
          set(wins[i].dash, { opacity: 1 - lin(t, tg + 0.55, 0.3) });
          if (q <= 0) return;
          const x = lerp(O[0], WIN[i], ease.enter(q)), y = lerp(O[1], 0, ease.enter(q)) - 70 * Math.sin(Math.PI * q);
          const s = lerp(0.5, 1, ease.pop(q)) * (1 + 0.12 * Math.sin(Math.PI * lin(t, tg + 0.7, 0.3)));
          place(g, { x, y, s, o: lin(t, tg, 0.12) });
        });
        caps.forEach((c, i) => {
          const v = env(t, T.groups[i] + 0.55);
          show(c.g, v.o > 0.001);
          place(c.g, { y: 8 * (1 - v.a), o: v.o });
        });
        drawTo(brace4, pe(t, T.brace4, 0.5));
        stamp4.update({ t, tIn: T.stamp4 });
      });

      // ================================================================== STAGE B: rack, part numbers face front (b05)
      const stageB = el('g', {}, R);
      const RX = 1235, RS = 1.05;
      const rackBg = el('g', {}, stageB);
      place(rackBg, { x: RX, y: FLOOR, s: RS });
      const rackB = Kit.PalletRack(rackBg, { bays: 2, contents: ['carton'] });
      const PNB = ['123-A', '214-B', '305-C', '118-D', '226-E', '331-F', '142-G', '257-H', '363-J',
        '408-K', '519-L', '624-M', '432-N', '545-P', '651-R', '476-S', '582-T', '693-U'];
      const ORDER = [3, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 11, 10, 9, 2, 1, 0];
      const BLANK = [1, 2, 10]; // drop in with the blank side facing out; turn in this order
      const checksB = [...BLANK, 0].map(i => {
        const g = el('g', {}, stageB);
        const p = rackB.bin(i);
        place(g, { x: RX + RS * (p.x + 46), y: FLOOR + RS * (p.y - 90) });
        return Kit.GreenCheck(g, { size: 32 });
      });
      const wBg = el('g', {}, stageB);
      const wB = Kit.Worker(wBg, { variant: 'worker', seed: 7 });
      const wTimeline = [[-INF, 'carry-carton'], [T.place - 0.55, 'lift-bent-knees'], [T.place, 'stand'], [T.place + 0.75, 'thumbs-up']];
      on(t => {
        const cx = 1920 + camX(t);
        const vis = cx < 1919 && t < T.outB + 0.05;
        show(stageB, vis);
        if (!vis) return;
        const ex = env(t, -INF, T.outB);
        place(stageB, { x: cx, y: -16 * ex.b, o: ex.o });
        let fill = 12;
        T.drop.forEach(td => { fill += lin(t, td, 0.4); });
        fill += lin(t, T.place, 0.35);
        const bins = {};
        for (let i = 0; i < 18; i++) bins[i] = { carton: { label: PNB[i] } };
        BLANK.forEach((i, j) => { bins[i].carton.turn = lin(t, T.turn[j], 0.6); });
        rackB.update({ state: 'stocked', fill, order: ORDER, bins, t });
        checksB.forEach((c, j) => c.update({ t, tIn: j < 3 ? T.turn[j] + 0.55 : T.place + 0.45 }));
        // worker: walks in, waits, walks to the rack and sets the last carton on the bottom shelf
        let x = WX[0], walking = 0;
        if (t >= T.w1) x = lerp(WX[0], WX[1], lin(t, T.w1, T.w1e - T.w1));
        if (t >= T.w2) x = lerp(WX[1], WX[2], lin(t, T.w2, T.w2e - T.w2));
        if (t < T.w1e + 0.1) walking = Math.min(lin(t, T.w1, 0.12), 1 - lin(t, T.w1e - 0.12, 0.12));
        else walking = Math.min(lin(t, T.w2, 0.12), 1 - lin(t, T.w2e - 0.12, 0.12));
        show(wBg, t >= T.w1);
        if (t < T.w1) return;
        place(wBg, { x, y: FLOOR, s: WS });
        const pz = Kit.Worker.poseAt(t, wTimeline, 0.2);
        wB.update({ ...pz, t, walking, stroke: 2.5 / WS });
      });
      const headB = Kit.Heading(R, { text: 'Part number facing front' });
      on(t => headB.update({ t, tIn: T.headB, tOut: T.outB }));

      // ================================================================== b06: dissimilar parts, replace worn labels
      const g6 = el('g', {}, R);
      const dd6 = Kit.DoDontPanel(g6, { width: 1120, rows: [{ do: 'Dissimilar parts only' }], rowHeight: 600 });
      place(dd6.g, { x: 80, y: 88 });
      const bin6 = side => {
        const host = el('g', { transform: 'translate(270 448)' }, dd6.slot(0, side));
        return binFrame(host, { w: 440, h: 330, beam: 56 });
      };
      const bin6d = bin6('dont'), bin6o = bin6('do');
      const parts6 = [];
      const addPart = (parent, kind, x, y, s, r = 0) => {
        const g = el('g', { transform: `translate(${x} ${y}) rotate(${r}) scale(${s})` }, parent);
        const p = Kit.Part(g, { kind });
        parts6.push(p);
        return p;
      };
      const label6 = (parent, txt, x) => {
        const g = el('g', { transform: `translate(${x} -28)` }, parent);
        const l = Kit.LocationLabel(g, { text: txt });
        l.update({});
        return l;
      };
      addPart(bin6d.items, 'bolt', -108, -96, 1.8, -3);
      addPart(bin6d.items, 'bolt', 108, -96, 1.8, 3);
      label6(bin6d.front, '123-A', -108); label6(bin6d.front, '123-B', 108);
      addPart(bin6o.items, 'bolt', -108, -96, 1.8, -3);
      addPart(bin6o.items, 'hosecoil', 112, -142, 1.45);
      label6(bin6o.front, '123-A', -108); label6(bin6o.front, '456-H', 112);
      parts6.forEach(p => p.update({}));
      // close-up of a bin edge: the worn label peels off and a crisp one replaces it
      const card6 = el('g', {}, g6);
      const C6W = 600, C6H = 692;
      el('rect', { width: C6W, height: C6H, rx: 12, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, card6);
      const in6 = el('g', { 'clip-path': clipRect(0, 0, C6W, C6H, 12) }, card6);
      el('rect', { x: 0, y: 0, width: C6W, height: C6H - 64, fill: REAR }, in6);
      const c6 = Kit.Carton(el('g', { transform: 'translate(320 336) scale(1.3)' }, in6), { label: '123-A' });
      c6.update({});
      el('path', { d: 'M52 346L68 332H600V346Z', fill: DECK, stroke: C.ink, 'stroke-width': 2 }, in6);
      el('rect', { x: 52, y: 346, width: 560, height: 92, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, in6);
      el('rect', { x: 18, y: -10, width: 34, height: C6H, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2.5 }, in6);
      {
        let d = '';
        for (let y = 12; y < C6H - 76; y += 30) d += `M${32} ${y}h6v11h-6z`;
        el('path', { d, fill: C.ink, opacity: 0.5 }, in6);
      }
      el('line', { x1: 0, x2: C6W, y1: C6H - 64, y2: C6H - 64, stroke: C.steel, 'stroke-width': 1 }, card6);
      text(card6, 'Replace worn or damaged labels', { x: C6W / 2, y: C6H - 22, size: 28, weight: 600, anchor: 'middle' });
      const lbl6g = el('g', {}, in6);
      place(lbl6g, { x: 330, y: 392, s: 1.6 });
      const lbl6 = Kit.LocationLabel(lbl6g, { text: '123-A' });
      const chk6g = el('g', {}, card6);
      place(chk6g, { x: 470, y: 358 });
      const chk6 = Kit.GreenCheck(chk6g, { size: 56 });
      on(t => {
        const vis = t >= b.b06.start && t < T.out6 + 0.05;
        show(g6, vis);
        if (!vis) return;
        const ex = env(t, -INF, T.out6);
        place(g6, { y: -16 * ex.b, o: ex.o });
        dd6.update({ t, tIn: T.dd6, rows: [{ dont: T.dd6dont, do: T.dd6do }] });
        if (!stageIn(card6, t, T.card6, INF, { x: 1240, y: 88, from: [24, 0] })) return;
        lbl6.update({ state: 'worn', replace: lin(t, T.repl, 1.3), outline: t < T.repl ? 'error' : null, t });
        chk6.update({ t, tIn: T.repl + 1.35 });
      });

      // ================================================================== b07: outside storage
      const g7 = el('g', {}, R);
      const head7 = Kit.Heading(g7, { text: 'Outside storage: weatherproof carton' });
      const strip = el('g', {}, g7);
      const SX = 80, SY = 190, SW7 = 1760, SH7 = 670, GROUND = 660, BASE7 = 742;
      const sc = el('g', { 'clip-path': clipRect(SX, SY, SW7, SH7, 16) }, strip);
      el('rect', { x: SX, y: SY, width: SW7, height: SH7, fill: SKY }, sc);
      const CLOUD = 'M-70 18H70A24 24 0 0 0 52 -14A30 30 0 0 0 4 -30A28 28 0 0 0 -40 -14A22 22 0 0 0 -70 18Z';
      const clouds = [[420, 300, 1.2], [1020, 250, 0.9], [1560, 320, 1.1]].map(([x, y, s]) => ({ g: el('g', {}, sc), x, y, s }));
      clouds.forEach(c => el('path', { d: CLOUD, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 / c.s, 'stroke-linejoin': 'round' }, c.g));
      el('rect', { x: SX, y: GROUND, width: SW7, height: SY + SH7 - GROUND, fill: C.floor }, sc);
      el('line', { x1: SX, x2: SX + SW7, y1: GROUND, y2: GROUND, stroke: mix(C.floor, C.steel, 0.45), 'stroke-width': 2 }, sc);
      const crate7g = el('g', {}, sc);
      place(crate7g, { x: 560, y: BASE7, s: 2.0 });
      const crate7 = Kit.Crate(crate7g, { shadow: true });
      const ct7g = el('g', {}, sc);
      place(ct7g, { x: 1150, y: BASE7, s: 2.1 });
      const carton7 = Kit.Carton(ct7g, { shadow: true });
      carton7.update({});
      // cutaway window on the carton front (carton-local coords): dark inside, droplets, a bolt that rusts
      const cutG = el('g', {}, ct7g);
      const CUT = [0, -58], CW7 = 80, CH7 = 74;
      const cutClip = el('path', { d: jagRect(CUT[0], CUT[1], CW7, CH7) }, el('clipPath', { id: 's03-cut7' }, defs));
      void cutClip;
      const cutIn = el('g', { 'clip-path': 'url(#s03-cut7)' }, cutG);
      el('rect', { x: -50, y: -100, width: 100, height: 90, fill: mix(C.carton, C.ink, 0.42) }, cutIn);
      el('path', { d: 'M-50 -38L-40 -30H50V-10H-50Z', fill: mix(C.cartonEdge, C.ink, 0.55) }, cutIn);
      const bolt7g = el('g', { transform: 'translate(0 -37) rotate(-4) scale(0.52)' }, cutIn);
      const bolt7 = Kit.Bolt(bolt7g);
      const drops7 = Array.from({ length: 9 }, (_, i) => {
        const x = -32 + 64 * hash(i + 3), y = -88 + 42 * hash(i + 11);
        const g = el('g', {}, cutIn);
        el('ellipse', { cx: 0, cy: 0, rx: 2.4, ry: 3.2, fill: C.paper, stroke: C.neutral, 'stroke-width': 1.1 }, g);
        return { g, x, y };
      });
      el('path', { d: jagRect(CUT[0], CUT[1], CW7, CH7), fill: 'none', stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, cutG);
      const rain = el('path', { fill: 'none', stroke: mix(C.neutral, C.ink, 0.2), 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.5 }, sc);
      el('rect', { x: SX, y: SY, width: SW7, height: SH7, rx: 16, fill: 'none', stroke: C.steel, 'stroke-width': 1.5 }, strip);
      const call7g = el('g', {}, g7);
      place(call7g, { x: 1190, y: BASE7 + 12 });
      const call7 = Kit.Callout(call7g, { text: 'Condensation causes rust', pointer: 'up', at: 0.42 });
      const x7g = el('g', {}, g7);
      place(x7g, { x: 1352, y: 470 });
      const x7 = Kit.RedX(x7g, { size: 56 });
      const ok7g = el('g', {}, g7);
      place(ok7g, { x: 820, y: 488 });
      const ok7 = Kit.GreenCheck(ok7g, { size: 56 });
      on(t => {
        const vis = t >= b.b07.start && t < T.out7 + 0.05;
        show(g7, vis);
        if (!vis) return;
        const ex = env(t, -INF, T.out7);
        place(g7, { y: -16 * ex.b, o: ex.o });
        head7.update({ t, tIn: T.head7 });
        stageIn(strip, t, T.strip, INF);
        clouds.forEach((c, i) => place(c.g, { x: c.x + 8 * Math.sin((t + i * 2) / 3), y: c.y, s: c.s }));
        crate7.update({ beads: 1, t });
        const cq = pe(t, T.cut, 0.5);
        show(cutG, cq > 0.001);
        set(cutG, { transform: `translate(${CUT[0]} ${CUT[1]}) scale(${cq.toFixed(3)}) translate(${-CUT[0]} ${-CUT[1]})` });
        bolt7.update({ rust: lin(t, T.rust, 1.8), t });
        drops7.forEach((d, i) => {
          const td = T.drops + 0.14 * i, q = ease.pop(lin(t, td, 0.3));
          show(d.g, q > 0.001);
          const slide = 3 * clamp((t - td) / 6);
          set(d.g, { transform: `translate(${r1(d.x)} ${r1(d.y + slide)}) scale(${Math.max(0.01, q).toFixed(3)})` });
        });
        // rain: deterministic streaks falling through the strip
        let rd = '';
        const H = SH7 + 60;
        for (let i = 0; i < 52; i++) {
          const x = SX + 20 + hash(i + 1) * (SW7 + 20), v = 1000 * (0.85 + 0.3 * hash(i + 7));
          const y = SY - 40 + ((t * v + hash(i + 3) * H) % H);
          rd += `M${r1(x)} ${r1(y)}l-8 30`;
        }
        set(rain, { d: rd });
        call7.update({ t, tIn: T.callout7 });
        x7.update({ t, tIn: T.x7 });
        ok7.update({ t, tIn: T.check7 });
      });

      // ================================================================== b08-b09: proper stocking checklist
      const g8 = el('g', {}, R);
      const ITEMS = ['Visible part number', 'Part numbers face front', 'Overstock tagged, used first',
        'Process discrepancies on time', 'Remove tags, wire, tape, strapping', 'Each or package quantity: make it clear'];
      // The kit card is sized for all six rows; in b08 only three exist, so a scene-drawn frame of the
      // same style shows the three-row height and grows at b09 while a clip hides the kit card's lower part.
      const CLX = 80, CLY = 270;
      const clFrame = el('g', {}, g8);
      const clFrameR = el('rect', { x: 0, y: 0, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, clFrame);
      const cl = Kit.Checklist(g8, { items: ITEMS });
      place(cl.g, { x: CLX, y: CLY });
      set(clFrameR, { width: cl.w });
      const clClipId = 's03-cl-clip';
      const clClipR = el('rect', { x: -12, y: -12, width: cl.w + 24 }, el('clipPath', { id: clClipId }, defs));
      set(cl.g, { 'clip-path': `url(#${clClipId})` });
      const H3 = cl.rowY(2) + 18 + 32;
      // rack: lower two shelves are permanent locations; the top shelf is overstock of the part below it
      const r8g = el('g', {}, g8);
      const rack8 = Kit.PalletRack(r8g, { bays: 1, contents: ['carton'] });
      const R8X = 1440, R8S = 1.2;
      const PN8 = ['118-D', '226-E', '331-F', '123-A', '214-B', '305-C', '123-A', '214-B', '305-C'];
      const tags8 = [6, 7, 8].map(i => {
        const p = rack8.bin(i);
        const g = el('g', { transform: `translate(${p.x - 40} ${p.y - 82}) scale(0.86)` }, r8g);
        return Kit.OverstockTag(g, { arrow: false, string: 18 });
      });
      const hl8 = el('g', {}, r8g);
      for (let i = 0; i < 9; i++) {
        if (i === 4) continue; // that carton still shows its blank side here
        const p = rack8.bin(i);
        el('rect', { x: p.x - 47, y: p.y - 72, width: 94, height: 48, rx: 8, fill: 'none', stroke: C.accent, 'stroke-width': 4 }, hl8);
      }
      const chk8g = el('g', {}, r8g);
      { const p = rack8.bin(4); place(chk8g, { x: p.x + 46, y: p.y - 92, s: 1 / R8S }); }
      const chk8 = Kit.GreenCheck(chk8g, { size: 32 });
      // b09 right side: clock (on time), carton with strap + old tag, then Each vs Pkg of 10
      const clock9g = el('g', {}, g8);
      place(clock9g, { x: 1400, y: 470 });
      const clock9 = Kit.Clock(clock9g, { size: 240, color: 'correct' });
      const c9g = el('g', {}, g8);
      const carton9 = Kit.Carton(c9g, { shadow: true });
      carton9.update({});
      const strapG = el('g', {}, c9g);
      const strap9 = Kit.Strap(strapG, {});
      const tag9g = el('g', { transform: 'translate(52 -108) scale(0.6)' }, c9g);
      const tag9 = Kit.Tag(tag9g, { lines: ['Old tag'] });
      const sci9g = el('g', {}, c9g);
      const sci9 = Kit.Scissors(sci9g);
      const flipG = el('g', {}, g8);
      const shelf9 = [1250, 1570].map(x => {
        const host = el('g', { transform: `translate(${x} 752)` }, flipG);
        return binFrame(host, { w: 270, h: 210, beam: 48, legs: FLOOR - 752, topBeam: 22 });
      });
      [-78, 0, 78].forEach((x, i) => { const p = Kit.Bearing(el('g', { transform: `translate(${x} ${-82 - (i % 2) * 2}) scale(0.58)` }, shelf9[0].items)); p.update({}); });
      const pkg9 = Kit.Package(el('g', { transform: 'translate(-10 -58) scale(0.95)' }, shelf9[1].items), { n: 10 });
      pkg9.update({});
      const lab9 = ['Each', 'Pkg of 10'].map(s => {
        const g = el('g', {}, flipG);
        return { g, l: Kit.LocationLabel(g, { text: s, w: 180, h: 50, size: 28 }) };
      });
      const chk9 = [0, 1].map(() => { const g = el('g', {}, flipG); return { g, c: Kit.GreenCheck(g, { size: 32 }) }; });
      const FLIP = [1410, 470], SLOT9 = [[1250, 728], [1570, 728]];
      on(t => {
        const grow = pe(t, b.b09.start + 0.05, 0.6), hA = lerp(H3, cl.h, grow);
        set(clClipR, { height: r1(grow >= 1 ? cl.h + 24 : hA - 16 + 12) });
        const vis = t >= b.b08.start && t < T.out9 + 0.05;
        show(g8, vis);
        if (!vis) return;
        const ex = env(t, -INF, T.out9);
        place(g8, { y: -16 * ex.b, o: ex.o });
        cl.update({ t, tIn: T.cl, rows: T.rows, ticks: T.ticks });
        const pc = Kit.presence(t, T.cl);
        place(clFrame, { x: CLX, y: CLY + pc.dy, o: pc.o });
        show(clFrame, pc.o > 0.001);
        set(clFrameR, { height: r1(hA) });
        // rack (b08)
        if (stageIn(r8g, t, T.rack8, T.rack8Out, { x: R8X, y: FLOOR, s: R8S })) {
          const bins = {};
          for (let i = 0; i < 9; i++) bins[i] = { carton: { label: PN8[i] } };
          bins[4].carton.turn = lin(t, T.turn8, 0.6);
          rack8.update({ state: 'permanent', bins, arrows: lin(t, T.arrows8, 0.4), t });
          tags8.forEach((tg, k) => {
            const q = lin(t, T.tags8 + 0.15 * k, 1.1);
            show(tg.g, q > 0);
            if (q > 0) tg.update({ on: q, t: t + k * 0.4 });
          });
          const hv = env(t, T.ticks[0] - 0.3, T.ticks[0] + 1.6);
          show(hl8, hv.o > 0.001);
          set(hl8, { opacity: hv.o });
          chk8.update({ t, tIn: T.turn8 + 0.55 });
        }
        // clock: discrepancies processed on time
        clock9.update({ t, tIn: T.clockIn, tOut: T.clockOut, state: 'on-time', tState: T.ticks[3] - 0.1, time: [10, 10] });
        // carton: the old tag comes off, scissors snip the strap
        if (stageIn(c9g, t, T.c9In, T.c9Out, { x: 1380, y: FLOOR, s: 2.0, from: [40, 0] })) {
          carton9.update({ t });
          tag9.update({ on: 1, remove: lin(t, T.tagOff, 0.7), t });
          strap9.update({ cut: 0.84 * lin(t, T.snip, 0.8), t });
          const so = 1 - lin(t, T.snip + 0.75, 0.35);
          show(strapG, so > 0.001);
          set(strapG, { opacity: so });
          const si = pe(t, T.sciIn, 0.5), so2 = px(t, T.snip + 0.45, 0.35);
          const sciO = lin(t, T.sciIn, 0.2) * (1 - so2);
          show(sci9g, sciO > 0.001);
          const snipOpen = t < T.snip ? 1 : 1 - pe(t, T.snip, 0.15);
          set(sci9g, { transform: `translate(${r1(-52 - 90 * (1 - si) - 40 * so2)} ${r1(-148 - 110 * (1 - si) - 60 * so2)}) rotate(35)`, opacity: sciO });
          sci9.update({ open: snipOpen });
        }
        // Each vs Pkg of 10: one label flips back and forth, then settles as two clear bin labels
        if (stageIn(flipG, t, T.flipIn, INF)) {
          let txt = 'Each', sy = 1;
          T.flips.forEach((tf, k) => {
            const q = lin(t, tf, 0.3);
            if (q >= 0.5) txt = k % 2 === 0 ? 'Pkg of 10' : 'Each';
            if (q > 0 && q < 1) sy = Math.max(0.04, Math.abs(Math.cos(Math.PI * q)));
          });
          const m = pe(t, T.settle, 0.7);
          const p0 = [lerp(FLIP[0], SLOT9[0][0], m), lerp(FLIP[1], SLOT9[0][1], m)];
          const p1 = [lerp(FLIP[0], SLOT9[1][0], m), lerp(FLIP[1], SLOT9[1][1], m)];
          const s = lerp(1.5, 1, m);
          place(lab9[0].g, { x: p0[0], y: p0[1], s: [s, s * sy] });
          lab9[0].l.update({ text: txt, t });
          const o1 = lin(t, T.settle, 0.15);
          show(lab9[1].g, o1 > 0);
          place(lab9[1].g, { x: p1[0], y: p1[1], s, o: o1 });
          lab9[1].l.update({ t });
          chk9.forEach((c, i) => {
            place(c.g, { x: SLOT9[i][0] + 92, y: SLOT9[i][1] - 26 });
            c.c.update({ t, tIn: T.settle + 0.8 + 0.15 * i });
          });
        }
        // keep the flipping label in front of the incoming twin
        void 0;
      });

      // ================================================================== b10: improper stocking table
      const g10 = el('g', {}, R);
      const DD10X = 720, DD10Y = 80, ROWH = 128, ROWG = 14;
      const dd10 = Kit.DoDontPanel(g10, { width: 1120, rows: 5, rowHeight: ROWH, rowGap: ROWG });
      place(dd10.g, { x: DD10X, y: DD10Y });
      const RULES = ['Never overstock a location', 'Never overload baskets or shelves', 'Part number and description match',
        'Keep protective packaging on', 'Protect machined surfaces'];
      const ruleG = RULES.map((s, i) => {
        const g = el('g', {}, g10);
        const lines = wrapText(s, 32, 600, 560);
        const cy = DD10Y + dd10.cellY(i) + ROWH / 2, lh = 40;
        el('rect', { x: 80, y: r1(cy - (lines.length * lh) / 2 - 4), width: 6, height: lines.length * lh + 8, rx: 3, fill: C.accent }, g);
        lines.forEach((ln, k) => text(g, ln, { x: 104, y: r1(cy - ((lines.length - 1) * lh) / 2 + k * lh + 11.5), size: 32, weight: 600, fill: C.ink }));
        return g;
      });
      // clip each cell's art to the cell
      const cell = (i, side) => {
        const slot = dd10.slot(i, side);
        set(slot, { 'clip-path': clipRect(0, 0, dd10.cellW, ROWH, 12) });
        return slot;
      };
      const at = (parent, x, y, s = 1, r = 0) => el('g', { transform: `translate(${x} ${y})${r ? ` rotate(${r})` : ''}${s !== 1 ? ` scale(${s})` : ''}` }, parent);
      const ups10 = [];
      // row 0: crammed narrow bin vs the same cartons in a larger bay
      {
        const d = binFrame(at(cell(0, 'dont'), 230, 120), { w: 150, h: 102, beam: 22, topBeam: 14 });
        const crammed = [[-50, -26], [0, -26], [50, -26], [-20, -66]].map(([x, y]) => Kit.Carton(at(d.items, x, y, 0.36)));
        ups10.push(t => crammed.forEach(c => c.update({ bulge: 1, outline: 'error', t })));
        const o = binFrame(at(cell(0, 'do'), 240, 120), { w: 360, h: 102, beam: 22, topBeam: 14 });
        [-126, -42, 42, 126].forEach(x => Kit.Carton(at(o.items, x, -26, 0.36)).update({}));
      }
      // row 1: overloaded wire basket vs a normal one
      const baskets10 = ['dont', 'do'].map(side => {
        const c = cell(1, side);
        el('rect', { x: 120, y: 110, width: 260, height: 12, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, c);
        return Kit.WireBasket(at(c, 236, 110, 0.7));
      });
      // row 2: bin label against the carton's label
      ['dont', 'do'].forEach(side => {
        const c = cell(2, side);
        Kit.LocationLabel(at(c, 112, 64), { text: '123-A' }).update({});
        equalsSign(at(c, 232, 64), side === 'dont');
        Kit.Carton(at(c, 340, 114, 0.9), { w: 140, h: 84, d: 40, labelSize: 26, label: side === 'dont' ? '123-B' : '123-A' }).update({});
      });
      // row 3: protective wrap torn off (rust gets in) vs kept on
      const wrap10 = ['dont', 'do'].map(side => Kit.BrakeShoe(at(cell(3, side), 250, 66, 1.15)));
      // row 4: machined shaft tossed on a steel shelf (scratched) vs resting on a padded cradle
      const shaft10 = ['dont', 'do'].map(side => {
        const c = cell(4, side);
        el('rect', { x: 100, y: side === 'dont' ? 98 : 102, width: 300, height: 14, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, c);
        return side === 'dont' ? Kit.Shaft(at(c, 236, 74, 1.15, -10)) : Kit.Shaft(at(c, 240, 51, 1.1));
      });
      on(t => {
        const vis = t >= b.b10.start;
        show(g10, vis);
        if (!vis) return;
        const rows = T.rows10.map(([d, o]) => ({ dont: d, do: o }));
        dd10.update({ t, tIn: T.dd10, rows });
        ruleG.forEach((g, i) => {
          const v = env(t, T.rows10[i][0]);
          show(g, v.o > 0.001);
          place(g, { x: -24 * (1 - v.a), o: v.o });
        });
        ups10.forEach(f => f(t));
        const [d1, o1] = T.rows10[1];
        baskets10[0].update({ over: lin(t, d1 + 0.4, 1.2), t });
        baskets10[1].update({ over: 0, t });
        const [d3, o3] = T.rows10[3];
        wrap10[0].update({ wrap: 1, torn: lin(t, d3 + 0.45, 0.8), rust: 0.6 * lin(t, d3 + 1.0, 1.2), t });
        wrap10[1].update({ wrap: lin(t, o3 + 0.35, 0.8), t });
        const [d4] = T.rows10[4];
        shaft10[0].update({ scratched: lin(t, d4 + 0.4, 0.5), t });
        shaft10[1].update({ cradle: true, t });
        void o1;
      });

      // ------------------------------------------------------------------ lower third (on top of everything)
      const lt = Kit.LowerThird(R, { texts: ['4. Packaging of Parts', '5. Storing of Parts'] });
      on(t => lt.update({ t, times: [T.ltIn, T.lt2] }));

      return { fns, T };
    },
    render(t, ctx, state) {
      for (const f of state.fns) f(t);
    },
  });
})();
