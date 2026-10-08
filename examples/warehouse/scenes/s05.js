// Scene s05: Stock Orders and Order Filling (Part III: Ordering, Returns). Beats s05b01–s05b10.
// Every time is derived from ctx.beat / ctx.cue, so the picture follows the measured narration.
// build() makes every node once; render(t) sets all of them from t alone (no state between frames).
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C, ease } = Kit;
  const inOut = Engine.ease.inOut;
  const INF = Infinity;
  const FLOOR = 860;

  // ---------- local helpers
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };
  const bump = (t, t0, d = 0.3, a = 0.15) => 1 + a * Math.sin(Math.PI * lin(t, t0, d));
  const pres = (t, tIn, tOut = INF, o) => Kit.presence(t, tIn, tOut, o);
  // Place a group with a presence {o, dy} (standard enter / exit); hidden while invisible.
  function stage(g, x, y, s, p) {
    const vis = p.o > 0.002;
    Kit.show(g, vis);
    if (vis) place(g, { x, y: y + p.dy, s, o: p.o });
    return vis;
  }
  const REAR = mix(C.steelDark, C.bgLight, 0.42), DECK = mix(C.steel, C.paper, 0.55), BENCH = mix(C.steel, C.paper, 0.32);
  const INK = (w = 2.5) => ({ stroke: C.ink, 'stroke-width': w, 'stroke-linejoin': 'round' });
  const poly = pts => 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
  const quad = (a, c, b, n = 48) => Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n, v = 1 - u;
    return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
  });
  // Rotate point p about c by deg (SVG sense: positive = clockwise on screen).
  const rotAbout = (p, c, deg) => {
    const a = deg * Math.PI / 180, dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  };

  // Rack bay in the kit's PalletRack style (steel-dark punched uprights, steel beams, light wire decks
  // in 30-degree depth), drawn here because these close-ups need bins wider or more numerous than the
  // kit rack's fixed 3x3 bay. Absolute stage coordinates. xs: left x of each front upright.
  function rackBay(parent, { xs, top, decks, uw = 18, beamH = 40, depth = 40, labels = [] }) {
    const g = el('g', {}, parent);
    const ox = depth * 0.866, oy = -depth * 0.5;
    const xa = xs[0] + uw, xb = xs[xs.length - 1];
    xs.forEach(x => el('rect', { x: x + ox, y: top + oy, width: uw, height: FLOOR - top, fill: REAR, ...INK(2) }, g));
    el('rect', { x: xa + ox, y: top + oy, width: xb - xa, height: 18, fill: REAR, ...INK(2) }, g);
    decks.forEach(y => {
      el('path', { d: poly([[xa, y], [xb, y], [xb + ox, y + oy], [xa + ox, y + oy]]), fill: DECK, ...INK(2) }, g);
      let d = '';
      for (let x = xa + 22; x < xb - 4; x += 22) d += `M${x} ${y - 1}l${(ox - 2).toFixed(1)} ${(oy + 1).toFixed(1)}`;
      el('path', { d, stroke: C.steel, 'stroke-width': 1.5 }, g);
    });
    xs.forEach(x => {
      el('rect', { x, y: top, width: uw, height: FLOOR - top, fill: C.steelDark, ...INK() }, g);
      let hd = '';
      for (let y = top + 16; y < FLOOR - 14; y += 22) hd += `M${x + uw / 2 - 3} ${y}h6v8h-6z`;
      el('path', { d: hd, fill: C.ink, opacity: 0.55 }, g);
      el('rect', { x: x - 6, y: FLOOR - 6, width: uw + 12, height: 6, fill: C.steelDark, ...INK(2) }, g);
    });
    for (let k = 0; k + 1 < xs.length; k++) {
      const a = xs[k] + uw, w = xs[k + 1] - a;
      el('rect', { x: a, y: top, width: w, height: 22, fill: C.steel, ...INK() }, g);
      decks.forEach(y => el('rect', { x: a, y, width: w, height: beamH, fill: C.steel, ...INK() }, g));
    }
    labels.forEach(({ x, y, text, size = 24, w = 120, h = 34 }) => {
      const lg = el('g', { transform: `translate(${x} ${y})` }, g);
      Kit.LocationLabel(lg, { text, w, h, size }).update({});
    });
    return g;
  }

  // Packing bench: steel top in depth, front edge, two legs. Top front edge at y = top.
  function bench(parent, x0, x1, top, depth = 44) {
    const g = el('g', {}, parent);
    const ox = depth * 0.866, oy = -depth * 0.5;
    Kit.shadow(g, x1 - x0 + 40, { x: (x0 + x1) / 2 + ox / 2, y: FLOOR });
    [x0 + 24, x1 - 40].forEach(x => el('rect', { x: x + ox, y: top + oy, width: 16, height: FLOOR - top - oy - 10, fill: REAR, ...INK(2) }, g));
    [x0 + 24, x1 - 40].forEach(x => el('rect', { x, y: top + 18, width: 16, height: FLOOR - top - 18, fill: C.steelDark, ...INK() }, g));
    el('rect', { x: x0 + 24, y: FLOOR - 70, width: x1 - x0 - 48, height: 12, fill: C.steelDark, ...INK(2) }, g);
    el('path', { d: poly([[x0, top], [x1, top], [x1 + ox, top + oy], [x0 + ox, top + oy]]), fill: BENCH, ...INK() }, g);
    el('path', { d: poly([[x1, top], [x1 + ox, top + oy], [x1 + ox, top + oy + 18], [x1, top + 18]]), fill: C.steelDark, ...INK() }, g);
    el('rect', { x: x0, y: top, width: x1 - x0, height: 18, fill: C.steel, ...INK() }, g);
    return g;
  }

  // Dotted path along a polyline that reveals with progress p (the map-route look).
  function dots(parent, pts, { gap = 20, r = 4.5, fill = C.ink, head = false, keepHead = false } = {}) {
    const g = el('g', {}, parent);
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = L[L.length - 1];
    const at = d => {
      let i = 1;
      while (i < pts.length - 1 && L[i] < d) i++;
      const k = clamp((d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]));
      const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI;
      return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), a];
    };
    const list = [];
    for (let d = 0; d <= total - gap * 0.4; d += gap) { const q = at(d); list.push({ p: d / total, n: el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r, fill }, g) }); }
    const hd = head ? el('path', { d: 'M12 0 L-8 -10 L-4 0 L-8 10 Z', fill }, g) : null;
    return {
      g,
      update(p) {
        p = clamp(p);
        Kit.show(g, p > 0);
        if (p <= 0) return;
        list.forEach(q => Kit.show(q.n, q.p <= p + 1e-6));
        if (hd) {
          const q = at(p * total);
          Kit.show(hd, keepHead || p < 1);
          set(hd, { transform: `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)}) rotate(${q[2].toFixed(1)})` });
        }
      },
    };
  }

  Engine.scene('s05', {
    build(ctx) {
      const R = ctx.root;
      const bt = id => ctx.beat(`s05${id}`);
      const cue = (id, ph, n = 0) => ctx.cue(`s05${id}`, ph, n);
      const b = {};
      ['b01', 'b02', 'b03', 'b04', 'b05', 'b06', 'b07', 'b08', 'b09', 'b10'].forEach(k => { b[k] = bt(k); });
      const out = k => b[k].start + 0.35;      // exits finish in the first 0.4 s of beat k
      const S = { b };
      const T = {};
      S.T = T;

      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, R);
      el('rect', { x: 0, y: FLOOR, width: 1920, height: 1080 - FLOOR, fill: C.floor }, R);
      el('line', { x1: 0, x2: 1920, y1: FLOOR, y2: FLOOR, stroke: mix(C.floor, C.ink, 0.18), 'stroke-width': 2 }, R);

      // ================= b01: received stock goes to the shelf within 8 hours
      T.wipe = Math.max(b.b01.start + 2, cue('b01', 'Processing') - 0.25);
      T.lt1 = T.wipe + 0.6;
      T.goal = cue('b01', 'The goal') - 0.1;
      const g1 = el('g', {}, R);
      S.g1 = g1;
      S.pallet1 = Kit.Pallet(g1, {});
      place(S.pallet1.g, { x: 330, y: FLOOR });
      S.rack1 = Kit.PalletRack(g1, { contents: ['carton'] });
      place(S.rack1.g, { x: 1470, y: FLOOR, s: 0.92 });
      S.term = Kit.Terminal(g1, {});
      place(S.term.g, { x: 720, y: 560 });
      S.clock = Kit.Clock(g1, { size: 180, color: 'accent', label: '8 h' });
      place(S.clock.g, { x: 900, y: 300 });
      // Six cartons leave the pallet (top first) for the empty middle and top shelves.
      const fly1 = el('g', {}, g1);
      const binOrder = [5, 4, 3, 8, 7, 6];
      const c0 = Math.max(T.wipe + 1.0, cue('b01', 'critical step'));
      const cEnd = Math.min(cue('b01', 'receipt') + 0.3, b.b01.end - 1.6);
      const D1 = 1.5, gap1 = Math.max(1.2, (cEnd - c0 - D1) / 5);
      S.c1 = binOrder.map((bin, k) => {
        const sl = S.pallet1.slot(5 - k), bn = S.rack1.bin(bin);
        return {
          bin, t0: c0 + k * gap1,
          S: [330 + sl.x, FLOOR + sl.y], E: [1470 + 0.92 * bn.x, FLOOR + 0.92 * bn.y],
          carton: Kit.Carton(fly1, { w: 92, h: 86, d: 40 }),
        };
      });
      T.c0 = c0; T.cLand = S.c1[5].t0 + D1; T.D1 = D1;
      S.hGoal = Kit.Heading(g1, { text: 'Goal: on the shelf within 8 hours' });

      // ================= b03–b06 mini scenes (right half), drawn under the pick tag
      // ---- b03: sort by location, then shelve in one pass
      const g3 = el('g', {}, R);
      S.g3 = g3;
      const U3 = S.U3 = [864, 1048, 1232, 1416, 1600, 1784];
      const bc3 = i => U3[i] + 18 + (184 - 18) / 2;
      const sorted = ['B-01', 'B-02', 'B-03', 'C-01', 'C-02'];
      const jumbled = ['B-03', 'C-01', 'B-01', 'C-02', 'B-02'];
      rackBay(g3, {
        xs: U3, top: 600, decks: [800], beamH: 38, depth: 36,
        labels: sorted.map((s, i) => ({ x: bc3(i), y: 819, text: s })),
      });
      el('rect', { x: 864, y: 500, width: 936, height: 14, rx: 7, fill: DECK, ...INK() }, g3);
      const cx3 = i => bc3(i) - 20.5;   // carton front-centre that centres its depth inside bin i
      T.shuf = cue('b03', 'Sorting') + 0.25;
      T.drop = Math.max(T.shuf + 1.15, cue('b03', 'before shelving'));
      const route3 = dots(g3, [[884, 557], [1782, 557]], { gap: 22, r: 5, fill: C.neutral, head: true, keepHead: true });
      S.route3 = route3;
      // Cartons moving left hop over the others, so they are built last (drawn in front).
      const order3 = [0, 1, 3, 2, 4];
      S.cartons3 = [];
      order3.forEach(j => {
        const label = jumbled[j];
        const g = el('g', {}, g3);
        const c = Kit.Carton(g, { label });
        S.cartons3.push({ g, c, from: j, to: sorted.indexOf(label) });
      });
      S.co3 = Kit.Callout(g3, { text: 'Sort by location first', pointer: 'down', variant: 'info' });
      place(S.co3.g, { x: 1340, y: 342 });

      // ---- b04: verify the part number against the shelf and the bin tag
      const g4 = el('g', {}, R);
      S.g4 = g4;
      rackBay(g4, { xs: [1290, 1772], top: 360, decks: [620], beamH: 42, labels: [{ x: 1540, y: 641, text: '123-A', size: 26, w: 150, h: 40 }] });
      S.shelf4 = [1385, 1560].map(x => { const c = Kit.Carton(g4, { label: '123-A' }); place(c.g, { x, y: 620 }); c.update({}); return c; });
      S.wk4 = Kit.Worker(g4, {});
      S.held4 = Kit.Carton(g4, { label: '123-A' });
      S.held4.update({});
      // The held carton rides on the Worker's far hand; its label is the start of the three match lines.
      S.reach4 = [96, -150];
      const a4 = S.wk4.update({ pose: 'inspect', t: 0, reach2: S.reach4, lean: 2 });
      const hl4 = [1030 + a4.hand2[0] + 50 + 46, FLOOR + a4.hand2[1] + 44 - 62];
      S.match4 = [
        { to: [1339, 558], c: [(hl4[0] + 1339) / 2, 560] },
        { to: [1514, 552], c: [1400, 300] },
        { to: [1462, 641], c: [1330, 712] },
      ].map(m => dots(g4, quad(hl4, m.c, m.to), { gap: 16, r: 4.5, fill: C.correct }));
      S.check4 = Kit.GreenCheck(g4, { size: 56 });
      place(S.check4.g, { x: 1540, y: 438 });

      // ---- b05 / b06: count the parts, then check the description
      const g5 = el('g', {}, R);
      S.g5 = g5;
      el('rect', { x: 884, y: 334, width: 520, height: 12, rx: 6, fill: DECK, ...INK(2) }, g5);
      S.parts5 = [0, 1, 2, 3, 4, 5].map(i => {
        const g = el('g', {}, g5);
        return { g, p: Kit.Bearing(g), x: 930 + 90 * i, y: 300 };
      });
      S.miss5 = Kit.Bearing(el('g', {}, g5));
      S.counter5 = Kit.Counter(g5, { from: 0, format: v => `${v} of 6` });
      place(S.counter5.g, { x: 1556, y: 300 });
      S.ok5 = Kit.GreenCheck(g5, { size: 40 });
      place(S.ok5.g, { x: 1664, y: 300 });
      S.bad5 = Kit.RedX(g5, { size: 40 });
      place(S.bad5.g, { x: 1664, y: 300 });

      const g6 = el('g', {}, R);
      S.g6 = g6;
      S.bear6 = Kit.Bearing(el('g', {}, g6));
      S.bolt6 = Kit.Bolt(el('g', {}, g6));
      S.ok6 = Kit.GreenCheck(g6, { size: 40 });
      place(S.ok6.g, { x: 1158, y: 522 });
      S.bad6 = Kit.RedX(g6, { size: 40 });
      place(S.bad6.g, { x: 1186, y: 548 });
      S.co6 = Kit.Callout(g6, { text: 'Claim discrepancy', pointer: 'down', variant: 'info' });
      place(S.co6.g, { x: 1076, y: 540 });

      // ================= b07: compare, shelve, hand the packing list to the Parts Manager
      const g7 = el('g', {}, R);
      S.g7 = g7;
      S.pallet7 = Kit.Pallet(g7, {});
      place(S.pallet7.g, { x: 330, y: FLOOR });
      S.rack7 = Kit.PalletRack(g7, { contents: ['carton'] });
      place(S.rack7.g, { x: 870, y: FLOOR, s: 0.92 });
      const fly7 = el('g', {}, g7);
      S.c7 = [8, 7].map((bin, k) => {
        const sl = S.pallet7.slot(1 - k), bn = S.rack7.bin(bin);
        return { bin, S: [330 + sl.x, FLOOR + sl.y], E: [870 + 0.92 * bn.x, FLOOR + 0.92 * bn.y], carton: Kit.Carton(fly7, { w: 92, h: 86, d: 40 }) };
      });
      S.wk7 = Kit.Worker(g7, {});
      S.hCompare = Kit.Heading(g7, { text: 'Compare, shelve, then packing list to Parts Manager' });

      // Parts Manager and the packing slip persist from b05 through b07.
      const gSM = el('g', {}, R);
      S.gMgr = el('g', {}, gSM);
      S.mgr = Kit.Worker(S.gMgr, { variant: 'manager', facing: -1 });
      S.gSlip = el('g', {}, gSM);
      S.slip = Kit.PackingSlip(S.gSlip, { notes: ['Qty short', 'Wrong part'] });

      // ================= pick tag (b02–b07) and its callouts
      S.gTag = el('g', {}, R);
      S.tag = Kit.PickTag(S.gTag, {});
      const TAG = { x: 80, y: 316 };
      S.TAG = TAG;
      const col = { loc: 127.3, pn: 350, qty: 572.7, desc: 238.7, item: 572.7 };
      const above = TAG.y - 4, below = TAG.y + 444;
      S.ring6 = el('rect', { x: -109.5, y: -64, width: 219, height: 128, rx: 14, fill: 'none', stroke: C.accent, 'stroke-width': 5 }, R);
      S.itemLine = dots(R, quad([TAG.x + 680, TAG.y + 256], [1080, 650], [1398, 450 + 80 + 3 * 32]), { gap: 18, r: 4.5, fill: C.ink });
      const callout = (text, pointer, x, y, at, variant = 'accent') => {
        const c = Kit.Callout(R, { text, pointer, at, variant });
        place(c.g, { x, y });
        return c;
      };
      S.coLoc = callout('Location: bin to place the part', 'down', TAG.x + col.loc, above, 0.22);
      S.coPN = callout('Part number: verify against shelf and bin tag', 'down', TAG.x + col.pn, above, 0.5);
      S.coQty = callout('Pick qty: verify the count', 'down', TAG.x + col.qty, above, 0.62);
      S.coMis = callout('Mismatch: note on packing list,\nto Parts Manager', 'down', TAG.x + col.qty, above, 0.76);
      S.coDesc = callout('Description must match the part', 'up', TAG.x + col.desc, below, 0.4);
      S.coItem = callout('Item: cross check\nwith packing list', 'up', TAG.x + col.item, below, 0.5);
      S.hVendor = Kit.Heading(R, { text: 'Vendor pick tag' });

      // ================= b08: order filling from the pick document
      const g8 = el('g', {}, R);
      S.g8 = g8;
      S.doc = Kit.PickDocument(el('g', {}, g8), {});
      S.map = Kit.WarehouseMap(el('g', {}, g8), {});
      S.MAP = { x: 500, y: 200, s: 1.1 };
      S.tokenG = el('g', {}, g8);
      S.cart8 = Kit.Cart(el('g', {}, S.tokenG), { parts: [] });
      S.wk8 = Kit.Worker(el('g', {}, S.tokenG), { stroke: 2.5 / 0.3 });
      S.order8 = Kit.Carton(el('g', {}, g8), {});
      S.tag8G = el('g', {}, g8);
      S.tag8 = Kit.Tag(S.tag8G, { lines: ['Order 0417'], string: 38 });
      S.hSeq = Kit.Heading(g8, { text: 'Location sequence' });
      S.hDest = Kit.Heading(g8, { text: 'Will Call  •  Shop / Field  •  Outbound' });
      // Keep the double spaces around the bullets (SVG collapses runs of spaces by default).
      S.hDest.g.querySelectorAll('text').forEach(n => n.setAttribute('style', `${n.getAttribute('style') || ''}; white-space: pre`));

      // ================= b09: inspect damaged stock before shipment; repackage
      const g9 = el('g', {}, R);
      S.g9 = g9;
      // Bench top at waist height (about 0.55 of the Worker's 260 px).
      S.B9 = { top: 722, s: 1.25, dx: 1000, fx: 1420 };
      bench(g9, 860, 1640, S.B9.top);
      S.dmg = Kit.Carton(el('g', {}, g9), {});
      S.fresh = Kit.Carton(el('g', {}, g9), {});
      S.wk9 = Kit.Worker(g9, {});
      // Each repacked part exists three times: inside the damaged box (behind its front face), in
      // flight (in front of everything), inside the fresh box. Only one copy shows at a time.
      S.parts9 = [['bearing', -24, 0.55], ['sealring', 30, 0.7]].map(([kind, lx, s]) => ({
        kind, lx, s,
        a: Kit.Part(S.dmg.inside, { kind }),
        f: Kit.Part(el('g', {}, g9), { kind }),
        z: Kit.Part(S.fresh.inside, { kind }),
      }));
      S.ok9 = Kit.GreenCheck(g9, { size: 56 });
      place(S.ok9.g, { x: 1572, y: 586 });
      S.coInspect = Kit.Callout(g9, { text: 'Inspect before shipment', pointer: 'down' });
      place(S.coInspect.g, { x: 1030, y: 470 });
      S.coRepack = Kit.Callout(g9, { text: 'Repackage if needed', pointer: 'down', variant: 'info' });
      place(S.coRepack.g, { x: 1450, y: 470 });
      S.hUsed = Kit.Heading(g9, { text: 'Used, crushed or damaged? Inspect first' });

      // ================= b10: pull from a package, empty the rest, dispose of the packaging
      const g10 = el('g', {}, R);
      S.g10 = g10;
      rackBay(g10, { xs: [300, 1000], top: 250, decks: [640], beamH: 42, labels: [{ x: 659, y: 661, text: 'B-07', size: 26, w: 150, h: 40 }] });
      S.trash = Kit.TrashCan(g10);
      place(S.trash.g, { x: 1160, y: FLOOR });
      S.cart10 = Kit.Cart(g10, { parts: [] });
      place(S.cart10.g, { x: 1640, y: FLOOR });
      S.cartBolts = [[-40, -166, -22], [30, -164, 14]].map(([x, y, r]) => { const g = el('g', {}, S.cart10.load); place(g, { x, y, r, s: 0.45 }); return { g, p: Kit.Bolt(g) }; });
      S.pkgG = el('g', {}, g10);
      S.pkg = Kit.Package(S.pkgG, { n: 10, cols: 5, kind: 'bolt', label: 'PKG OF 10' });
      S.PKG = { x: 540, y: 640, s: 1.3 };
      // Lowest point (below the pivot, in stage px) of the package box rotated by deg about its
      // bottom-right corner: front corners plus the depth corners (+26, -15).
      const pkCorners = [[-200, 0], [-200, -110], [0, -110], [26, -15], [26, -125], [-174, -125]];
      S.liftAt = deg => S.PKG.s * Math.max(0, ...pkCorners.map(c => rotAbout(c, [0, 0], deg)[1])) + 4 * clamp(deg / 110);
      // Loose bolts after the pour: rest positions on the deck, right of the package.
      const rest = [[752, 628, -12], [800, 630, 8], [848, 628, -4], [896, 630, 14], [944, 628, -9], [776, 612, 18], [830, 613, -15], [884, 612, 5]];
      S.loose = rest.map(([x, y, r], i) => { const g = el('g', {}, g10); return { g, p: Kit.Bolt(g), x, y, r, slot: i }; });
      S.flyBolts = [3, 4].map(slot => { const g = el('g', {}, g10); return { g, p: Kit.Bolt(g), slot }; });
      S.ok10 = Kit.GreenCheck(g10, { size: 56 });
      place(S.ok10.g, { x: 852, y: 470 });
      S.coDispose = Kit.Callout(g10, { text: 'Dispose of the packaging', pointer: 'down', at: 0.3 });
      place(S.coDispose.g, { x: 1160, y: 728 });
      S.hPull = Kit.Heading(g10, { text: 'Pull from a package: empty the rest into the bin' });

      // ================= lower third and title card (on top)
      S.lt = Kit.LowerThird(R, { texts: ['9. Stock Order Processing', '10. Order Filling'] });
      S.card = Kit.SectionTitleCard(R, { part: 'Part III', title: 'Ordering, Returns', sub: '9. Stock Order Processing' });

      // ---- remaining beat times
      T.tagIn = b.b02.start + 0.35;
      T.vendor = cue('b02', 'pick tag') - 0.25;
      T.dim = cue('b02', 'read it together');
      T.out1 = out('b02');
      // b03
      T.m3 = b.b03.start;
      T.hlLoc = b.b03.start + 0.45;
      T.sort = cue('b03', 'Sorting');
      // b04
      T.hlPN = b.b04.start + 0.4;
      T.wk4 = b.b04.start + 0.7;
      T.l1 = cue('b04', 'other parts');
      T.l3 = Math.max(T.l1 + 0.8, cue('b04', 'bin tag'));
      T.ok4 = T.l3 + 0.65;
      // b05
      T.hlQty = b.b05.start + 0.35;
      T.parts5 = b.b05.start + 0.6;
      T.count5 = Math.max(T.parts5 + 1.0, cue('b05', 'Verify it'));
      T.ok5 = T.count5 + 6 * 0.3 + 0.15;
      T.mis = Math.max(T.ok5 + 0.6, cue('b05', 'If the quantity'));
      T.slipIn = Math.max(T.mis + 0.8, cue('b05', 'note it on') - 0.2);
      T.note1 = T.slipIn + 0.45;
      T.give = Math.max(T.note1 + 1.0, cue('b05', 'give it to'));
      T.mgrIn = T.give - 0.9;
      T.nod5 = T.give + 0.9;
      // b06
      T.hlDesc = b.b06.start + 0.35;
      T.bear6 = b.b06.start + 0.7;
      T.flip6 = Math.max(T.bear6 + 1.2, cue('b06', 'received bolts') - 0.1);
      T.co6 = Math.max(T.flip6 + 0.4, cue('b06', 'claim discrepancy') - 0.1);
      T.note2 = Math.max(T.co6 + 0.5, cue('b06', 'Note it on'));
      T.item = Math.max(T.note2 + 1.2, cue('b06', 'Item is'));
      T.itemLine = T.item + 0.45;
      T.pulse = T.itemLine + 0.7;
      // b07
      T.zoom = b.b07.start + 0.05;
      T.wk7 = b.b07.start + 0.3;
      T.slipFly = b.b07.start + 0.55;
      T.c7 = [b.b07.start + 0.8, b.b07.start + 2.0];
      T.walk7 = Math.max(T.slipFly + 1.0, cue('b07', 'hand the packing list') - 0.2);
      T.walkDur7 = 295 / Kit.Worker.WALK_SPEED;
      T.handOver = T.walk7 + T.walkDur7 + 0.25;
      T.thumb = T.handOver + 0.75;
      // b08
      T.doc = b.b08.start + 0.4;
      T.map = b.b08.start + 0.55;
      T.seq = cue('b08', 'location sequence') - 0.2;
      T.r0 = Math.max(T.map + 1.3, cue('b08', 'follow the list') - 0.3);
      T.r1 = Math.max(T.r0 + 2.8, cue('b08', 'Filled orders') - 0.1);
      T.zones = cue('b08', 'Filled orders') - 0.2;
      T.lit = [cue('b08', 'Will Call'), cue('b08', 'Shop or Field'), cue('b08', 'Outbound')];
      T.dest = T.lit[0] - 0.3;
      T.order = T.lit[2] + 0.25;
      T.mark = Math.max(T.order + 0.75, cue('b08', 'and marked'));
      T.lt2 = b.b08.start + 0.2;
      // b09
      T.used = b.b09.start + 0.4;
      T.inspect = cue('b09', 'inspect it') - 0.1;
      T.open9 = Math.max(T.inspect + 1.0, cue('b09', 'verify the customer'));
      T.fresh = T.open9 - 0.5;
      T.close9 = T.open9 + 2.45;
      T.ok9 = T.close9 + 1.05;
      T.repack = Math.max(T.ok9 - 0.2, cue('b09', 'repackaging') - 0.3);
      // b10
      T.pull = b.b10.start + 0.4;
      T.lift10 = Math.max(b.b10.start + 1.3, cue('b10', 'pull one') + 0.6);
      T.pour = Math.max(T.lift10 + 1.9, cue('b10', 'empty all') - 0.1);
      T.dispose = Math.max(T.pour + 1.6, cue('b10', 'dispose') - 0.2);
      T.ok10 = T.dispose + 1.25;
      return S;
    },

    render(t, ctx, S) {
      const { T, b } = S;
      const W = Kit.Worker;

      // ---------------- title card + lower third
      S.card.update({ t, tIn: -2, tWipe: T.wipe });
      S.lt.update({ t, times: [T.lt1, T.lt2] });

      // ---------------- b01
      {
        const p = pres(t, -1, T.out1);
        if (stage(S.g1, 0, 0, 1, p)) {
          const moving = S.c1.map(c => t >= c.t0 && t < c.t0 + T.D1);
          const started = S.c1.filter(c => t >= c.t0).length;
          const landed = S.c1.filter(c => t >= c.t0 + T.D1);
          S.pallet1.update({ count: 6 - started, t });
          const bins = {};
          for (const i of [3, 4, 5, 6, 7, 8]) bins[i] = { content: 'none' };
          landed.forEach(c => { bins[c.bin] = {}; });
          S.rack1.update({ state: 'stocked', bins, t });
          S.c1.forEach((c, k) => {
            Kit.show(c.carton.g, moving[k]);
            if (!moving[k]) return;
            const u = (t - c.t0) / T.D1, cruise = 545;
            const a = inOut(clamp(u / 0.28)), v = inOut(clamp((u - 0.28) / 0.72));
            const x = lerp(c.S[0], c.E[0], v);
            const y = u < 0.28 ? lerp(c.S[1], cruise, a) : lerp(cruise, c.E[1], smooth((x - 1110) / 120));
            place(c.carton.g, { x, y, s: lerp(1.13, 0.92, ease.enter(clamp(u / 0.28))) });
            c.carton.update({ t });
          });
          S.clock.update({ t, state: 'fill', tState: T.c0, to: 8 / 12, dur: T.cLand - T.c0, color: 'accent', label: '8 h' });
          let flash = 0;
          landed.forEach(c => { flash = Math.max(flash, 1 - lin(t, c.t0 + T.D1, 0.6)); });
          S.term.update({ screen: 'onhands', row: 0, value: 12 + landed.length, flash, t });
          S.hGoal.update({ t, tIn: T.goal });
        }
      }

      // ---------------- pick tag: zoom in (b02), dock left (b03–b06), shrink to a corner (b07), exit (b08)
      {
        const pin = ease.enter(lin(t, T.tagIn, 0.7));
        const toLeft = ease.enter(lin(t, b.b03.start, 0.8));
        const toCorner = ease.enter(lin(t, T.zoom, 0.9));
        let cx = 960, cy = 540, s = lerp(0.45, 1.5, pin);
        cx = lerp(cx, 430, toLeft); cy = lerp(cy, 536, toLeft); s = lerp(s, 1, toLeft);
        cx = lerp(cx, 1738, toCorner); cy = lerp(cy, 154, toCorner); s = lerp(s, 0.28, toCorner);
        const o = lin(t, T.tagIn, 0.35) * (1 - ease.exit(lin(t, b.b08.start + 0.05, 0.3)));
        const bob = Math.sin(t * Math.PI * 2 / 3.4) * (1 - toCorner);
        Kit.show(S.gTag, o > 0.002);
        if (o > 0.002) {
          place(S.gTag, { x: cx - 350 * s, y: cy - 220 * s + bob, s, o });
          const on = (t0, t1) => lin(t, t0, 0.5) * (1 - lin(t, t1, 0.3));
          S.tag.update({
            dim: lin(t, T.dim, 0.5) * (1 - lin(t, T.zoom, 0.5)),
            highlight: {
              location: on(T.hlLoc, b.b04.start + 0.05),
              part: on(T.hlPN, b.b05.start + 0.05),
              qty: on(T.hlQty, b.b06.start + 0.05),
              desc: on(T.hlDesc, T.item - 0.1),
              item: on(T.item + 0.1, T.zoom),
            },
          });
        }
        S.hVendor.update({ t, tIn: T.vendor, tOut: out('b07') });
        S.coLoc.update({ t, tIn: b.b03.start + 0.6, tOut: out('b04') });
        S.coPN.update({ t, tIn: b.b04.start + 0.55, tOut: out('b05') });
        S.coQty.update({ t, tIn: b.b05.start + 0.5, tOut: T.mis + 0.3 });
        S.coMis.update({ t, tIn: T.mis + 0.35, tOut: out('b06') });
        S.coDesc.update({ t, tIn: b.b06.start + 0.5, tOut: T.item + 0.3 });
        S.coItem.update({ t, tIn: T.item + 0.35, tOut: out('b07') });
        // ITEM on the tag and row 04 on the slip pulse together.
        const ph = t >= T.pulse ? 0.5 - 0.5 * Math.cos((t - T.pulse) * Math.PI * 2 / 1.1) : 0;
        const ringO = lin(t, T.itemLine + 0.5, 0.3) * (1 - lin(t, b.b07.start, 0.3));
        Kit.show(S.ring6, ringO > 0.002);
        if (ringO > 0.002) place(S.ring6, { x: S.TAG.x + 572.7, y: S.TAG.y + 272, s: 1 + 0.04 * ph, o: ringO * (0.55 + 0.45 * ph) });
        S.itemLine.update(lin(t, T.itemLine, 0.6) * (t < b.b07.start + 0.3 ? 1 : 0));
        S.itemLine.g.setAttribute('opacity', String(1 - lin(t, b.b07.start, 0.3)));
        S.ph6 = ph;
      }
      function out(k) { return b[k].start + 0.35; }

      // ---------------- b03 mini: sort by location, shelve in one pass
      {
        const p = pres(t, T.m3 + 0.5, out('b04'));
        if (stage(S.g3, 0, 0, 1, p)) {
          const cx = i => S.U3[i] + 18 + 83 - 20.5;
          S.cartons3.forEach(q => {
            const pi = pres(t, T.m3 + 0.7 + 0.08 * q.from, INF);
            const u = inOut(lin(t, T.shuf, 0.9));
            const left = q.to < q.from;
            let x = lerp(cx(q.from), cx(q.to), u);
            let y = 500 - (left ? 40 * Math.sin(Math.PI * u) : 0);
            const d0 = T.drop + 0.15 + 0.2 * q.to;
            y += 300 * inOut(lin(t, d0, 0.45));
            const sq = t >= d0 + 0.45 ? 1 - 0.05 * Math.sin(Math.PI * lin(t, d0 + 0.45, 0.2)) : 1;
            Kit.show(q.g, pi.o > 0.002);
            place(q.g, { x, y: y + pi.dy, s: [0.95 * (2 - sq), 0.95 * sq], o: pi.o });
            q.c.update({ t });
          });
          S.route3.update(lin(t, T.drop, 1.4));
          S.co3.update({ t, tIn: T.sort, tOut: out('b04') });
        }
      }

      // ---------------- b04 mini: part number matches shelf stock and bin tag
      {
        const p = pres(t, b.b04.start + 0.5, out('b05'));
        if (stage(S.g4, 0, 0, 1, p)) {
          const pw = pres(t, T.wk4, INF);
          const wx = 1030;
          const pose = W.poseAt(t, [[0, 'inspect']]);
          const a = S.wk4.update({ ...pose, t, reach2: S.reach4, lean: 2 });
          place(S.wk4.g, { x: wx, y: FLOOR + pw.dy, o: pw.o });
          const hx = wx + a.hand2[0], hy = FLOOR + a.hand2[1] + pw.dy;
          place(S.held4.g, { x: hx + 50, y: hy + 44, o: pw.o });
          // match lines: held label to both shelf labels, then to the bin tag
          [T.l1, T.l1 + 0.35, T.l3].forEach((t0, i) => S.match4[i].update(lin(t, t0, 0.45)));
          S.check4.update({ t, tIn: T.ok4 });
        }
      }

      // ---------------- b05 / b06 mini
      {
        const p5 = pres(t, T.parts5 - 0.1, out('b06'));
        if (stage(S.g5, 0, 0, 1, p5)) {
          S.parts5.forEach((q, i) => {
            const pi = pres(t, T.parts5 + 0.08 * i, INF);
            const tc = T.count5 + 0.3 * i;
            let y = q.y + pi.dy, o = pi.o;
            if (i === 5) { const g = ease.exit(lin(t, T.mis, 0.45)); y -= 50 * g; o *= 1 - g; }
            Kit.show(q.g, o > 0.002);
            place(q.g, { x: q.x, y, s: 0.72 * bump(t, tc, 0.3, 0.18), o });
            q.p.update({ t });
          });
          const mo = lin(t, T.mis + 0.3, 0.3);
          Kit.show(S.miss5.g.parentNode, mo > 0.002);
          place(S.miss5.g.parentNode, { x: S.parts5[5].x, y: 300, s: 0.72, o: mo });
          S.miss5.update({ missing: true, t });
          const ticks = [0, 1, 2, 3, 4, 5].map(i => T.count5 + 0.3 * i);
          const bad = t >= T.mis + 0.35;
          S.counter5.update({ t, tIn: T.parts5 + 0.3, ticks, value: bad ? 5 : undefined, variant: bad ? 'error' : t >= T.ok5 ? 'correct' : 'ink' });
          S.ok5.update({ t, tIn: T.ok5, tOut: T.mis + 0.3 });
          S.bad5.update({ t, tIn: T.mis + 0.4 });
        }
        const p6 = pres(t, T.bear6, T.item + 0.35);
        if (stage(S.g6, 0, 0, 1, p6)) {
          const f = lin(t, T.flip6, 0.4);
          const s1 = f < 0.5 ? 1 - ease.exit(f * 2) : 0, s2 = f >= 0.5 ? ease.enter((f - 0.5) * 2) : 0;
          Kit.show(S.bear6.g.parentNode, s1 > 0.01);
          place(S.bear6.g.parentNode, { x: 1080, y: 596, s: [1.6 * Math.max(0.01, s1), 1.6] });
          S.bear6.update({ t });
          Kit.show(S.bolt6.g.parentNode, s2 > 0.01);
          place(S.bolt6.g.parentNode, { x: 1080, y: 596, s: [1.9 * Math.max(0.01, s2), 1.9] });
          S.bolt6.update({ t });
          S.ok6.update({ t, tIn: T.bear6 + 0.45, tOut: T.flip6 });
          S.bad6.update({ t, tIn: T.flip6 + 0.4 });
          S.co6.update({ t, tIn: T.co6 });
        }
      }

      // ---------------- Parts Manager + packing slip (b05–b07)
      {
        const mgrOut = out('b08');
        // manager walks in from the right, stands, nods; in b07 takes the slip and gives a thumbs-up
        const mx0 = 2000, mx = 1745;
        const walkD = (mx0 - mx) / W.WALK_SPEED;
        const wu = lin(t, T.mgrIn, walkD);
        const po = 1 - ease.exit(lin(t, mgrOut - 0.3, 0.3));
        const vis = t >= T.mgrIn && po > 0.002;
        Kit.show(S.gMgr, vis);
        let mHand = null;
        if (vis) {
          const x = lerp(mx0, mx, wu);
          const tl = [[0, 'walk'], [T.mgrIn + walkD, 'stand'], [T.thumb, 'thumbs-up']];
          const pose = W.poseAt(t, tl);
          const nod = Math.max(0, Math.sin(Math.PI * lin(t, T.nod5, 0.7))) + Math.max(0, Math.sin(Math.PI * lin(t, T.thumb + 0.3, 0.7)));
          const take = ease.enter(lin(t, T.handOver - 0.2, 0.45));
          const params = { ...pose, t, nod: clamp(nod) };
          if (take > 0) params.reach2 = [lerp(20, 78, take), lerp(-104, -150, take)];
          const a = S.mgr.update(params);
          place(S.gMgr, { x, y: FLOOR, o: po });
          mHand = [x + a.hand2[0], FLOOR + a.hand2[1]];
        }
        // the slip: enters (b05), slides to the manager, gains notes, flies to the worker (b07),
        // rides in the worker's hand, then passes to the manager
        S.mHand = mHand;
      }

      // ---------------- b07
      {
        const p = pres(t, T.zoom + 0.15, out('b08'));
        let wHand = null;
        if (stage(S.g7, 0, 0, 1, p)) {
          // last two cartons slide from the pallet into the top shelf
          const started = T.c7.filter(t0 => t >= t0).length;
          S.pallet7.update({ count: 2 - started, t });
          const bins = { 7: { content: 'none' }, 8: { content: 'none' } };
          S.c7.forEach((c, k) => {
            const t0 = T.c7[k], D = 1.3, u = (t - t0) / D;
            const mv = u >= 0 && u < 1;
            if (u >= 1) bins[c.bin] = {};
            Kit.show(c.carton.g, mv);
            if (!mv) return;
            const x = Engine.keys(u, [[0, c.S[0]], [0.25, c.S[0]], [0.8, c.E[0]]]);
            const y = Engine.keys(u, [[0, c.S[1]], [0.3, 318], [0.72, 318], [1, c.E[1]]]);
            place(c.carton.g, { x, y, s: lerp(1.13, 0.92, ease.enter(clamp(u / 0.3))) });
            c.carton.update({ t });
          });
          S.rack7.update({ state: 'stocked', bins, t });
          // worker: holds the slip, walks it to the manager, hands it over
          const pw = pres(t, T.wk7, INF);
          const wu = lin(t, T.walk7, T.walkDur7);
          const x = lerp(1250, 1545, wu);
          const walking = t >= T.walk7 && t < T.walk7 + T.walkDur7 ? 1 : 0;
          const pose = W.poseAt(t, [[0, 'hold-clipboard'], [T.handOver + 0.3, 'stand']]);
          const a = S.wk7.update({ ...pose, t, walking, prop: false });
          place(S.wk7.g, { x, y: FLOOR + pw.dy, o: pw.o });
          wHand = [x + a.hand2[0], FLOOR + a.hand2[1] + pw.dy];
          S.hCompare.update({ t, tIn: b.b07.start + 0.5 });
        }
        S.wHand = wHand;
      }

      // ---------------- slip placement (after both characters, so it can follow their hands)
      {
        const slipOut = out('b08');
        const pin = pres(t, T.slipIn, slipOut);
        const vis = pin.o > 0.002;
        Kit.show(S.gSlip, vis);
        if (vis) {
          const slide = ease.enter(lin(t, T.give, 0.8));
          let x = lerp(1000, 1390, slide), y = 450 + pin.dy, s = 1;
          // b07: fly into the worker's hand (scaled down), ride along, then pass to the manager
          if (S.wHand && t >= T.slipFly) {
            const f = ease.enter(lin(t, T.slipFly, 0.8));
            const wx = S.wHand[0] - 96, wy = S.wHand[1] - 74;
            x = lerp(x, wx, f); y = lerp(y, wy, f); s = lerp(1, 0.42, f);
            if (S.mHand && t >= T.handOver - 0.2) {
              const g = ease.enter(lin(t, T.handOver - 0.2, 0.5));
              x = lerp(x, S.mHand[0] - 100, g); y = lerp(y, S.mHand[1] - 74, g);
            }
          }
          place(S.gSlip, { x, y, s, o: pin.o });
          S.slip.update({
            notes: lin(t, T.note1, 0.9) + lin(t, T.note2, 0.9),
            row: 3, rowGlow: lin(t, T.itemLine + 0.5, 0.3) * (0.45 + 0.55 * S.ph6) * (1 - lin(t, b.b07.start, 0.3)),
          });
        }
      }

      // ---------------- b08: pick document, route, destinations
      {
        const p = pres(t, T.doc - 0.1, out('b09'));
        if (stage(S.g8, 0, 0, 1, p)) {
          const pd = pres(t, T.doc, INF);
          place(S.doc.g.parentNode, { x: 110 - 24 * (1 - pd.o), y: 255, s: 1.25, o: pd.o });
          const M = S.MAP;
          const pm = lin(t, T.map, 0.3);
          place(S.map.g.parentNode, { x: M.x, y: M.y, s: M.s, o: pm });
          const rp = lin(t, T.r0, T.r1 - T.r0);
          const stopT = S.map.stops.map(st => T.r0 + st.p * (T.r1 - T.r0));
          const ticks = stopT.reduce((n, ts) => n + lin(t, ts, 0.3), 0);
          let active = stopT.findIndex(ts => t < ts);
          if (t < T.r0 - 0.3) active = null;
          S.doc.update({ ticks, active: active < 0 ? null : active, activeP: lin(t, T.r0 - 0.3, 0.3) });
          const litIdx = T.lit.filter(x => t >= x).length - 1;
          const litKey = litIdx < 0 ? null : ['willcall', 'shop', 'outbound'][litIdx];
          S.map.update({
            draw: lin(t, T.map, 1.0), rows: 6 * lin(t, T.map + 0.3, 0.9), zones: lin(t, T.zones, 1.0),
            route: rp, lit: litKey, litP: litIdx < 0 ? 0 : lin(t, T.lit[litIdx], 0.25),
          });
          // worker + cart token follows the route head
          const q = S.map.routeAt(rp);
          const sx = M.x + q.x * M.s, sy = M.y + q.y * M.s + 8;
          const tk = lin(t, T.r0 - 0.4, 0.4);
          Kit.show(S.tokenG, tk > 0.002);
          if (tk > 0.002) {
            place(S.tokenG, { o: tk });
            const moving = t >= T.r0 && t < T.r1 ? 1 : 0;
            S.wk8.update({ pose: 'push-cart', t, walking: moving, stride: 0.8 });
            place(S.wk8.g.parentNode, { x: sx - 34, y: sy, s: 0.3 });
            const loaded = clamp(ticks) * (t < T.order ? 1 : 0);
            S.cart8.update({ cartons: loaded, roll: rp * 2400, t });
            place(S.cart8.g.parentNode, { x: sx + 22, y: sy, s: 0.21 });
          }
          // the filled carton slides from the cart into Outbound and is tagged
          const ou = lin(t, T.order, 0.7);
          Kit.show(S.order8.g.parentNode, t >= T.order);
          if (t >= T.order) {
            const e = ease.enter(ou);
            // left end of the zone, so the zone label and the tag beside it stay readable
            const ox = lerp(sx + 20, 1423, e), oy = lerp(sy - 30, 826, e) - 40 * Math.sin(Math.PI * ou);
            place(S.order8.g.parentNode, { x: ox, y: oy, s: lerp(0.3, 0.5, e) });
            S.order8.update({ t });
          }
          Kit.show(S.tag8G, t >= T.mark);
          if (t >= T.mark) {
            // hangs level (swing cancels the tag's 9-degree rest tilt) in the strip under the label
            place(S.tag8G, { x: 1451, y: 771 });
            S.tag8.update({ on: lin(t, T.mark, 0.9), swing: -9, t });
          }
          S.hSeq.update({ t, tIn: T.seq, tOut: T.dest });
          S.hDest.update({ t, tIn: T.dest + 0.3 });
        }
      }

      // ---------------- b09: inspect, repackage
      {
        const p = pres(t, b.b09.start + 0.3, out('b10'));
        if (stage(S.g9, 0, 0, 1, p)) {
          S.hUsed.update({ t, tIn: T.used });
          const B9 = S.B9;
          const pd = pres(t, b.b09.start + 0.45, INF);
          place(S.dmg.g, { x: B9.dx, y: B9.top + pd.dy, s: B9.s, o: pd.o });
          const open9 = lin(t, T.open9, 0.5);
          S.dmg.update({ damaged: 1, open: open9, t });
          const pf = pres(t, T.fresh, INF);
          Kit.show(S.fresh.g, pf.o > 0.002);
          place(S.fresh.g, { x: B9.fx, y: B9.top + pf.dy, s: B9.s, o: pf.o });
          const closeP = lin(t, T.close9, 0.45);
          S.fresh.update({ open: 1 - closeP, tape: lin(t, T.close9 + 0.5, 0.6), t });
          S.parts9.forEach((q, k) => {
            const t0 = T.open9 + 0.5 + 0.4 * k;
            const rise = ease.enter(lin(t, t0, 0.4)), fly = lin(t, t0 + 0.4, 0.8), sink = ease.enter(lin(t, t0 + 1.2, 0.35));
            const inA = t >= t0 && t < t0 + 0.4, inF = t >= t0 + 0.4 && t < t0 + 1.2, inZ = t >= t0 + 1.2 && closeP < 0.5;
            Kit.show(q.a.g, inA); Kit.show(q.f.g, inF); Kit.show(q.z.g, inZ);
            // carton-local y -150 is just above the open box; the flight stays low to clear the callout
            if (inA) { place(q.a.g, { x: q.lx, y: lerp(-40, -150, rise), s: q.s }); q.a.update({ t }); }
            if (inF) {
              const e = inOut(fly);
              place(q.f.g, { x: lerp(B9.dx, B9.fx, e) + B9.s * q.lx, y: B9.top - B9.s * 150 - 22 * Math.sin(Math.PI * fly), s: q.s * B9.s, r: 20 * Math.sin(Math.PI * fly) });
              q.f.update({ t });
            }
            if (inZ) { place(q.z.g, { x: q.lx, y: lerp(-150, -46, sink), s: q.s }); q.z.update({ t }); }
          });
          const pw = pres(t, b.b09.start + 0.6, INF);
          const pose = W.poseAt(t, [[0, 'inspect'], [T.open9 + 0.2, 'stand'], [T.ok9 + 0.1, 'thumbs-up']]);
          S.wk9.update({ ...pose, t, lean: pose.pose === 'inspect' ? 10 : 0 });
          place(S.wk9.g, { x: 820, y: FLOOR + pw.dy, o: pw.o });
          S.ok9.update({ t, tIn: T.ok9 });
          S.coInspect.update({ t, tIn: T.inspect, tOut: T.repack });
          S.coRepack.update({ t, tIn: T.repack + 0.3 });
        }
      }

      // ---------------- b10: package quantity
      {
        const p = pres(t, b.b10.start + 0.3, INF);
        if (stage(S.g10, 0, 0, 1, p)) {
          S.hPull.update({ t, tIn: T.pull });
          const P = S.PKG;
          const tip = lin(t, T.pour, 0.7);
          const theta = 110 * ease.enter(tip);
          const poured = S.loose.map((q, i) => t >= T.pour + 0.45 + 0.06 * i);
          const hidden = [3, 4].filter((s, k) => t >= T.lift10 + 0.35 * k);
          const remaining = [0, 1, 2, 5, 6, 7, 8, 9];
          remaining.forEach((s, i) => { if (poured[i]) hidden.push(s); });
          // package: tips into the bin, then shrinks and arcs into the trash can
          const dz = lin(t, T.dispose, 0.8);
          const shrink = dz;
          // The kit tips 110 degrees about the bottom-right corner, which would sink the box's top
          // corner through the deck; lift it by the lowest rotated corner so it pours from above.
          const lift = S.liftAt(theta), liftMax = S.liftAt(110);
          const target = [1160 - 782, 760 - (542 - liftMax)];
          const pk = pres(t, b.b10.start + 0.5, INF);
          Kit.show(S.pkgG, pk.o > 0.002 && dz < 1);
          place(S.pkgG, { x: P.x + target[0] * inOut(dz), y: P.y + pk.dy - lift + target[1] * inOut(dz) - 150 * Math.sin(Math.PI * dz), s: P.s, o: pk.o });
          S.pkg.update({ hidden, tip, shrink, t });
          S.trash.update({ lid: lin(t, T.dispose - 0.35, 0.3) * (1 - lin(t, T.dispose + 0.85, 0.3)), t });
          // two bolts lift out to the cart
          S.flyBolts.forEach((q, k) => {
            const t0 = T.lift10 + 0.35 * k, u = lin(t, t0, 1.2);
            const show = t >= t0 && u < 1;
            Kit.show(q.g, show);
            if (show) {
              const sl = S.pkg.slot(q.slot);
              const sx = P.x + P.s * sl.x, sy = P.y + P.s * sl.y;
              const ex = 1640 + (k ? 30 : -40), ey = FLOOR + (k ? -164 : -166);
              const lift = ease.enter(clamp(u / 0.25)), mv = inOut(clamp((u - 0.2) / 0.8));
              const x = lerp(sx, ex, mv), y = lerp(sy - 60 * lift, ey, mv) - 140 * Math.sin(Math.PI * mv);
              place(q.g, { x, y, s: lerp(P.s * sl.s, 0.45, mv) + 0.25 * Math.sin(Math.PI * mv), r: lerp(sl.r, k ? 14 : -22, mv) });
              q.p.update({ t });
            }
          });
          S.cartBolts.forEach((q, k) => Kit.show(q.g, t >= T.lift10 + 0.35 * k + 1.2));
          S.cartBolts.forEach(q => q.p.update({ t }));
          S.cart10.update({ t });
          // the remaining eight pour out of the tipped package and settle on the deck
          S.loose.forEach((q, i) => {
            Kit.show(q.g, poured[i]);
            if (!poured[i]) return;
            const sl = S.pkg.slot(remaining[i]);
            const piv = [100, 0];
            const r0 = rotAbout([sl.x, sl.y], piv, 110);
            const sx = P.x + P.s * r0[0], sy = P.y + P.s * r0[1] - S.liftAt(110);
            const u = lin(t, T.pour + 0.45 + 0.06 * i, 0.5);
            const e = ease.enter(u);
            place(q.g, { x: lerp(sx, q.x, e), y: lerp(sy, q.y, u * u), s: lerp(P.s * sl.s, 0.45, e), r: lerp(sl.r + 110, q.r, e) });
            q.p.update({ t });
          });
          S.coDispose.update({ t, tIn: T.dispose + 0.85 });
          S.ok10.update({ t, tIn: T.ok10 });
          place(S.ok10.g, { x: 852, y: 470, s: t > T.ok10 + 0.5 ? 1 + 0.02 * Math.sin((t - T.ok10) * Math.PI * 2 / 2.4) : 1 });
        }
      }
    },
  });
})();
