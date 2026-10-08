// Scene s01: Welcome and Purpose (Part I). Opening title card on bg-dark, which wipes up to the light
// stage for the purpose beats (rack, three-panel strip), the common errors, the three preventions and the
// table of contents. Every time is derived from ctx.beat / ctx.cue; render(t) sets every attribute from t.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const C = Kit.C, E = Kit.ease;
  const FLOOR = 860;
  const INF = 1e9;

  const lin = (t, t0, d) => clamp((t - t0) / d);
  // Standard presence for a group: fade + 24 px in from below (side -1 / +1: from the left / right),
  // fade + 16 px up out, finished by tOut.
  function present(node, t, tIn, tOut = INF, { x = 0, y = 0, s = 1, side = 0, rise = 24 } = {}) {
    const pin = E.enter(lin(t, tIn, 0.4)), pout = E.exit(lin(t, tOut - 0.3, 0.3));
    const o = pin * (1 - pout), off = (1 - pin) * rise;
    place(node, { x: x + side * off, y: y + (side ? 0 : off) - 16 * pout, s, o });
    Kit.show(node, o > 0.001);
    return o;
  }
  // Small-icon pop: ease-out-back scale 0 -> 1 over 0.3 s, fade out by tOut.
  function pop(node, t, tIn, tOut = INF, { x = 0, y = 0, s = 1 } = {}) {
    const p = E.pop(lin(t, tIn, 0.3)), o = Math.min(lin(t, tIn, 0.1), 1 - E.exit(lin(t, tOut - 0.3, 0.3)));
    place(node, { x, y, s: Math.max(0.001, s * p), o });
    Kit.show(node, t >= tIn && o > 0.001);
  }
  // 0 -> 1 -> 0 bump over d seconds from t0 (nods, highlights).
  const bump = (t, t0, d) => { const u = lin(t, t0, d); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0; };
  const qb = (a, b, c, u) => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]];
  const qbPath = (a, b, c, u0, u1, n = 24) => {
    let d = '';
    for (let k = 0; k <= n; k++) { const p = qb(a, b, c, lerp(u0, u1, k / n)); d += `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }
    return d;
  };
  const f1 = v => v.toFixed(1);

  // Tiny packing slip glyph (no text, so it stays legible as a symbol at 40x52).
  function miniSlip(parent) {
    const g = el('g', {}, parent);
    el('rect', { x: -21, y: -27, width: 42, height: 54, rx: 4, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, g);
    el('rect', { x: -14, y: -19, width: 20, height: 5, rx: 2.5, fill: C.ink }, g);
    [28, 20, 24].forEach((w, k) => el('rect', { x: -14, y: -8 + k * 8, width: w, height: 4, rx: 2, fill: C.steel }, g));
    el('path', { d: 'M-14 16v6M-11 16v6M-6 16v6M-3 16v6M1 16v6M5 16v6M8 16v6M13 16v6', stroke: C.ink, 'stroke-width': 1.8 }, g);
    return g;
  }
  // Solid accent arrow along a path that draws on (pathLength 1), with an arrow head at the end.
  function loopArrow(parent, d, head) {
    const g = el('g', {}, parent);
    const o = el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 13, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, g);
    const f = el('path', { d, fill: 'none', stroke: C.accent, 'stroke-width': 7, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, g);
    const h = el('path', { d: 'M-2 -13 L18 0 L-2 13 Z', fill: C.accent, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round', transform: `translate(${f1(head[0])} ${f1(head[1])}) rotate(${f1(head[2])})` }, g);
    return p => {
      set(o, { 'stroke-dashoffset': 1 - p }); set(f, { 'stroke-dashoffset': 1 - p });
      set(h, { opacity: lin(p, 0.85, 0.15) });
    };
  }

  Engine.scene('s01', {
    build(ctx) {
      const root = ctx.root;
      const B = id => ctx.beat(id);
      const cue = (id, at) => ctx.cue(id, at);
      const b1 = B('s01b01'), b2 = B('s01b02'), b3 = B('s01b03'), b4 = B('s01b04'), b5 = B('s01b05'), b6 = B('s01b06');
      const S = {};

      // ---------------------------------------------------------------- times
      const T = S.T = {};
      // b01: map draws after the calm first 15 frames; the title lands with "Welcome to the Warehouse Training Packet".
      T.map = 0.5;
      T.title = b1.start + 0.15;
      T.inset = cue('s01b01', 'over the next') - 0.1;
      T.track = cue('s01b01', 'walk through') - 0.1;
      T.walk = cue('s01b01', 'freight is received') - 0.6;
      T.icons = ['freight is received', 'packaged', 'stored', 'orders and returns', 'inventory is counted', 'clean', 'safe']
        .map(p => cue('s01b01', p) + 0.15);
      T.wipe = b2.start;
      // b02
      T.lower = b2.start + 0.7;
      T.calloutA = cue('s01b02', "one of the company's") - 0.1;
      T.accuracy = cue('s01b02', 'accuracy');
      T.calloutB = T.accuracy + 0.05;
      T.nods = [cue('s01b02', 'puts it simply'), cue('s01b02', 'credibility')];
      T.write = [cue('s01b02', 'warehouse personnel'), T.accuracy - 0.4];
      T.out2 = b3.start + 0.35;
      // b03
      T.p1 = b3.start + 0.35;
      T.arrow = cue('s01b03', 'availability');
      T.carton = T.arrow + 0.55;
      T.land = T.carton + 1.0;
      T.p2 = Math.max(T.p1 + 1.5, cue('s01b03', 'accurate inventory') - 0.2);
      T.type = T.p2 + 0.5;
      T.term = cue('s01b03', 'timely');
      T.p3 = Math.max(T.p2 + 1.5, cue('s01b03', 'and when everyone') - 0.2);
      T.loopDraw = T.p3 + 0.8;
      T.teamChecks = cue('s01b03', 'accurately and on time');
      T.spin = Math.max(T.teamChecks + 0.8, cue('s01b03', 'whole company'));
      T.out3 = b4.start + 0.35;
      // b04
      T.lower2 = b4.start + 0.3;
      T.head4 = b4.start + 0.3;
      T.clip = b4.start + 0.45;
      T.clock = b4.start + 0.65;
      T.sweep = cue('s01b04', 'timely processing');
      T.late = T.sweep + 0.9;
      T.sweepEnd = T.sweep + 2.2;
      T.tasks = ['storing', 'stocking', 'shipping', 'counting'].map(p => cue('s01b04', p));
      T.out4 = b5.start + 0.35;
      // b05
      T.list = b5.start + 0.35;
      T.items = ['understand the impact', 'follow the required', 'ask for assistance'].map(p => cue('s01b05', p));
      T.people = b5.start + 0.5;
      T.ask = cue('s01b05', 'this packet cannot');
      T.sup = cue('s01b05', 'ask your supervisor');
      T.out5 = b6.start + 0.35;
      // b06
      T.toc = b6.start + 0.3;
      T.dock = cue('s01b06', 'at the dock') - 0.1;

      // ---------------------------------------------------------------- light stage (b02 to b06)
      el('rect', { width: 1920, height: 1080, fill: C.bgLight }, root);
      el('rect', { x: 0, y: FLOOR, width: 1920, height: 1080 - FLOOR, fill: C.floor }, root);

      // b02: rack, worker with clipboard, callouts, carton checks
      S.b2 = el('g', {}, root);
      const RACK = { x: 790, s: 0.8 };
      const rackG = el('g', {}, S.b2);
      place(rackG, { x: RACK.x, y: FLOOR, s: RACK.s });
      S.rack = Kit.PalletRack(rackG, { bays: 3, contents: ['carton'] });
      // Kit.shadow sizes ry at 6 % of the width, which for a 3-bay rack spills ~75 px below the floor line
      // under the lower third; flatten it (the rack's first child is its shadow ellipse).
      set(S.rack.g.firstChild, { ry: 22 });
      // Location labels would render at 19 px at this scale (under the 22 px minimum), so hide them.
      S.rackBins = {};
      for (let i = 0; i < S.rack.n; i++) S.rackBins[i] = { label: null };
      S.checks = [];
      const checkG = el('g', {}, S.b2);
      for (let i = 0; i < S.rack.n; i++) {
        const b = S.rack.bin(i), bay = Math.floor(i / 9), shelf = Math.floor((i % 9) / 3), bin = i % 3;
        const k = (bay * 3 + bin) * 3 + shelf;   // column by column, bottom to top
        const c = Kit.GreenCheck(checkG, { size: 32 });
        S.checks.push({ c, x: RACK.x + RACK.s * (b.x + 38), y: FLOOR + RACK.s * (b.y - 80), tIn: T.accuracy + 0.35 + 0.07 * k });
      }
      S.w2 = Kit.Worker(S.b2, { variant: 'worker', facing: -1, seed: 3 });
      S.w2pos = { x: 1640, s: 0.95 };
      const tipY = FLOOR - RACK.s * 560 - 14;
      S.calloutA = Kit.Callout(S.b2, { text: "One of the company's largest assets", maxWidth: 900 });
      S.calloutB = Kit.Callout(S.b2, { text: 'Accuracy builds credibility', maxWidth: 900 });
      place(S.calloutA.g, { x: RACK.x, y: tipY }); place(S.calloutB.g, { x: RACK.x, y: tipY });

      // b03: three-panel strip
      S.b3 = el('g', {}, root);
      const PX = Kit.stripX(3, 520, 40), PY = 196;
      const caps = ['Customers rely on availability', 'Accurate and timely', "Everyone's area, done right"];
      S.panels = caps.map((caption, i) => {
        const p = Kit.Panel(S.b3, { caption });
        place(p.g, { x: PX[i], y: PY });
        return p;
      });
      // Panel 1: customer, excavator, carton delivered along a dashed arrow.
      {
        const sl = S.panels[0].slot, AH = S.panels[0].areaH, FL = AH - 72;
        el('rect', { x: 0, y: FL, width: 520, height: 80, fill: C.floor }, sl);
        const mg = el('g', {}, sl); place(mg, { x: 372, y: FL, s: 0.78 });
        S.machine = Kit.Machine(mg, { stroke: 2.5 / 0.78 });
        const cg = el('g', {}, sl); place(cg, { x: 96, y: FL, s: 0.64 });
        S.cust = Kit.Worker(cg, { variant: 'customer', seed: 5, stroke: 2.5 / 0.64 });
        S.arrowPts = [[46, 128], [196, -10], [214, FL - 4]];
        S.dash = el('path', { d: 'M0 0', fill: 'none', stroke: C.inkSoft, 'stroke-width': 4, 'stroke-dasharray': '12 10', 'stroke-linecap': 'round' }, sl);
        S.dashHead = el('path', { d: 'M-2 -11 L16 0 L-2 11 Z', fill: C.inkSoft }, sl);
        S.p1Carton = el('g', {}, sl);
        S.carton1 = Kit.Carton(S.p1Carton, { w: 116, h: 110, d: 50 });
        S.p1FL = FL;
      }
      // Panel 2: terminal with the on-hands table and a green check.
      {
        const sl = S.panels[1].slot;
        const tg = el('g', {}, sl); place(tg, { x: 44, y: 78, s: 1.2 });
        S.term = Kit.Terminal(tg, {});
        S.termCheck = Kit.GreenCheck(sl, { size: 56 });
        place(S.termCheck.g, { x: 404, y: 84 });
      }
      // Panel 3: three workers in a loop of arrows, each with a check.
      {
        const sl = S.panels[2].slot, cx = 260, cy = 250, R = 128, R2 = 156;
        S.loop = el('g', {}, sl);
        set(S.loop, { transform: `translate(${cx} ${cy})` });
        S.loopSpin = el('g', {}, S.loop);
        S.loopArrows = [[-62, -16], [62, 118], [196, 242]].map(([a0, a1]) => {
          const P = a => [R2 * Math.cos(a * Math.PI / 180), R2 * Math.sin(a * Math.PI / 180)];
          const p0 = P(a0), p1 = P(a1);
          const d = `M${f1(p0[0])} ${f1(p0[1])} A${R2} ${R2} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`;
          return loopArrow(S.loopSpin, d, [p1[0], p1[1], a1 + 90]);
        });
        const spots = [[-90, 'carry-carton', 1], [30, 'hold-clipboard', -1], [150, 'point', 1]];
        S.team = spots.map(([a, pose, facing], i) => {
          const x = cx + R * Math.cos(a * Math.PI / 180), y = cy + R * Math.sin(a * Math.PI / 180) + 66;
          const g = el('g', {}, sl);
          const w = Kit.Worker(g, { seed: 7 + i, stroke: 2.5 / 0.5, facing });
          const ck = Kit.GreenCheck(sl, { size: 32 });
          return { g, w, x, y, pose, facing, ck, cx: x + facing * 6 + 40, cy: y - 120 };
        });
      }

      // b04: heading, late clipboard, clock, four task icons with their paperwork
      S.b4 = el('g', {}, root);
      S.head4 = Kit.Heading(S.b4, { text: 'Common errors: late documentation' });
      S.clipG = el('g', {}, S.b4);
      S.clipboard = Kit.Clipboard(S.clipG, {});
      S.clockG = el('g', {}, S.b4);
      S.clock = Kit.Clock(S.clockG, { size: 200, color: 'error' });
      const TX = [510, 810, 1110, 1410], TY = 744;
      const names = ['box', 'rack', 'truck', 'document'], words = ['Store', 'Stock', 'Ship', 'Count'];
      S.tasks = names.map((name, i) => {
        const g = el('g', {}, S.b4);
        const disc = el('g', {}, g);
        el('circle', { r: 46, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, disc);
        const ic = Kit.Icon(disc, { name, size: 54, color: C.ink });
        if (i === 0) { place(ic.g, { y: -6 }); el('path', { d: 'M-30 25H30', stroke: C.steelDark, 'stroke-width': 5, 'stroke-linecap': 'round' }, disc); } // carton on a shelf
        const dots = el('path', { d: 'M0 0', fill: 'none', stroke: C.inkSoft, 'stroke-width': 3.5, 'stroke-dasharray': '0.1 8', 'stroke-linecap': 'round' }, g);
        const slip = miniSlip(g);
        const label = Kit.text(g, words[i], { x: 0, y: 92, size: 34, weight: 600, anchor: 'middle' });
        return { g, disc, dots, slip, label, x: TX[i], y: TY };
      });
      S.bullets = [0, 1, 2].map(i => Kit.text(S.b4, '•', { x: (TX[i] + TX[i + 1]) / 2, y: TY + 92, size: 34, weight: 600, fill: C.inkSoft, anchor: 'middle' }));

      // b05: checklist, worker asks the supervisor
      S.b5 = el('g', {}, root);
      S.listG = el('g', {}, S.b5);
      S.list = Kit.Checklist(S.listG, { items: ['Understand the impact', 'Follow the instructions', 'Ask for assistance'] });
      S.listPos = { x: 150, y: 470 - S.list.h / 2 };
      S.w5 = Kit.Worker(S.b5, { variant: 'worker', seed: 11 });
      S.sup = Kit.Worker(S.b5, { variant: 'supervisor', facing: -1, seed: 12 });
      S.ask = Kit.Callout(S.b5, { text: '?', size: 44 });
      S.askCheck = Kit.GreenCheck(S.b5, { size: 56 });
      S.walk5 = { x0: 930, x1: 1395, sx: 1660, speed: Kit.Worker.WALK_SPEED * 0.95 };
      S.walk5.dur = (S.walk5.x1 - S.walk5.x0) / S.walk5.speed;

      // b06: table of contents
      S.b6 = el('g', {}, root);
      const TOC = ['Purpose', 'Receiving, Storing, Shipping', 'Ordering, Returns', 'Inventory Counts', 'Maintenance', 'Safety'];
      const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      const cw = 1000, pitch = 78, ch = 36 * 2 + pitch * 6;
      S.toc = { x: 460, y: 470 - ch / 2, w: cw, h: ch };
      S.tocCard = el('g', {}, S.b6);
      el('rect', { width: cw, height: ch, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, S.tocCard);
      S.tocRows = TOC.map((title, i) => {
        const cy = 36 + pitch * i + pitch / 2;
        if (i) el('line', { x1: 32, x2: cw - 32, y1: 36 + pitch * i, y2: 36 + pitch * i, stroke: C.floor, 'stroke-width': 1.5 }, S.tocCard);
        const row = el('g', {}, S.tocCard);
        const band = el('rect', { x: 20, y: -31, width: 0, height: 62, rx: 12, fill: C.accent }, row);
        const fill = i === 0 ? C.inkSoft : C.ink;
        Kit.text(row, ROM[i], { x: 60, y: 12, size: 34, weight: 800, fill });
        Kit.text(row, title, { x: 170, y: 12, size: 34, weight: 600, fill });
        const ck = i === 0 ? Kit.GreenCheck(row, { size: 32 }) : null;
        if (ck) place(ck.g, { x: cw - 64, y: 0 });
        return { row, band, ck, cy };
      });

      S.lower = Kit.LowerThird(root, { texts: ['1. Purpose of Warehouse Training Packet', '2. Common Errors and Preventions'] });

      // ---------------------------------------------------------------- dark opening card (on top; wipes up)
      S.dark = el('g', {}, root);
      el('rect', { width: 1920, height: 1080, fill: C.bgDark }, S.dark);
      const vg = el('radialGradient', { id: 's01-vignette', cx: 0.5, cy: 0.5, r: 0.75 }, el('defs', {}, S.dark));
      el('stop', { offset: 0.5, 'stop-color': '#000', 'stop-opacity': 0 }, vg);
      el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.22 }, vg);
      el('rect', { width: 1920, height: 1080, fill: 'url(#s01-vignette)' }, S.dark);
      const mapG = el('g', {}, S.dark);
      place(mapG, { x: 780, y: 290, s: 0.8 });
      S.map = Kit.WarehouseMap(mapG, { lineArt: true, theme: 'dark' });
      S.titleG = el('g', {}, S.dark);
      Kit.text(S.titleG, 'Warehouse Training Packet', { x: 960, y: 196, size: 88, weight: 800, fill: C.paper, anchor: 'middle' });
      S.rule = el('rect', { x: 880, y: 230, width: 0, height: 4, rx: 2, fill: C.accent }, S.dark);
      // Light inset so the Worker (dark trousers, ink outline) stays legible on the navy card.
      S.inset = el('g', {}, S.dark);
      const IW = 570, IH = 496;
      const clip = el('clipPath', { id: 's01-inset' }, el('defs', {}, S.inset));
      el('rect', { width: IW, height: IH, rx: 16 }, clip);
      const ic = el('g', { 'clip-path': 'url(#s01-inset)' }, S.inset);
      el('rect', { width: IW, height: IH, fill: C.bgLight }, ic);
      S.iFloor = 410;
      el('rect', { y: S.iFloor, width: IW, height: IH - S.iFloor, fill: C.floor }, ic);
      const pg = el('g', {}, ic); place(pg, { x: 372, y: S.iFloor, s: 0.9 });
      S.pallet = Kit.Pallet(pg, {});
      S.w1 = Kit.Worker(ic, { variant: 'worker', seed: 1 });
      S.walk1 = { x0: -120, x1: 196, speed: Kit.Worker.WALK_SPEED * 0.85 };
      S.walk1.dur = (S.walk1.x1 - S.walk1.x0) / S.walk1.speed;
      S.tlG = el('g', {}, S.dark);
      place(S.tlG, { x: 240, y: 884 });
      S.tl = Kit.ProgressTimeline(S.tlG, { nodes: ['truck', 'box', 'rack', 'tag', 'document', 'broom', 'hazard'].map(icon => ({ icon, label: '' })), width: 1440, dark: true });
      return S;
    },

    render(t, ctx, S) {
      const T = S.T;

      // ---------------------------------------------------------------- b01 opening card
      const pw = Engine.ease.inOut(lin(t, T.wipe, 0.6));
      place(S.dark, { y: -1080 * pw });
      Kit.show(S.dark, pw < 1);
      if (pw < 1) {
        S.map.update({ draw: lin(t, T.map, 1.5) });
        const pt = Kit.presence(t, T.title, INF, { rise: 12 });
        place(S.titleG, { y: pt.dy, o: pt.o });
        set(S.rule, { width: (160 * E.enter(lin(t, T.title + 0.35, 0.5))).toFixed(1) });
        present(S.inset, t, T.inset, INF, { x: 170, y: 290 });
        S.pallet.update({ count: 2, t });
        const w = S.walk1, u = lin(t, T.walk, w.dur), tArr = T.walk + w.dur;
        const walking = t < T.walk ? 0 : t < tArr ? 1 : 1 - lin(t, tArr, 0.25);
        const pose = Kit.Worker.poseAt(t, [[0, 'wave'], [tArr + 1.8, 'stand']], 0.2);
        place(S.w1.g, { x: lerp(w.x0, w.x1, u), y: S.iFloor });
        S.w1.update({ ...pose, t, walking, stride: 0.85 });
        S.tl.update({ t, tIn: T.track, show: T.icons });
      }

      // ---------------------------------------------------------------- b02 rack and purpose
      if (present(S.b2, t, T.wipe - 0.6, T.out2) > 0) {
        S.rack.update({ state: 'stocked', bins: S.rackBins, t });
        S.checks.forEach(k => { place(k.c.g, { x: k.x, y: k.y }); k.c.update({ t, tIn: k.tIn }); });
        const nod = Math.max(...T.nods.map(tn => Math.max(bump(t, tn, 0.35), bump(t, tn + 0.35, 0.35))));
        place(S.w2.g, { x: S.w2pos.x, y: FLOOR, s: S.w2pos.s });
        S.w2.update({ pose: 'hold-clipboard', t, nod, writing: t > T.write[0] && t < T.write[1], facing: -1 });
        S.calloutA.update({ t, tIn: T.calloutA, tOut: T.calloutB + 0.15 });
        S.calloutB.update({ t, tIn: T.calloutB, tOut: INF });
      }

      // ---------------------------------------------------------------- b03 three-panel strip
      Kit.show(S.b3, t > T.p1 - 0.1 && t < T.out3 + 0.1);
      if (t > T.p1 - 0.1 && t < T.out3 + 0.1) {
        const [p1, p2, p3] = S.panels;
        p1.update({ t, tIn: T.p1, tOut: T.out3 });
        p2.update({ t, tIn: T.p2, tOut: T.out3 });
        p3.update({ t, tIn: T.p3, tOut: T.out3 });
        // Panel 1: the gear turns slowly, then speeds up once the carton lands (integrated speed ramp).
        const R = t < T.land ? 0 : t < T.land + 1 ? (t - T.land) ** 2 / 2 : 0.5 + (t - T.land - 1);
        S.machine.update({ state: 'running', t, angle: 90 * (0.4 * (t - T.p1) + 2.4 * R), speed: t > T.land ? 2 : 1 });
        const cp = Kit.Worker.poseAt(t, [[0, 'stand'], [T.land + 0.6, 'thumbs-up']], 0.2);
        S.cust.update({ ...cp, t });
        const [A, Q, Z] = S.arrowPts, da = E.enter(lin(t, T.arrow, 0.6)) * 0.8;
        set(S.dash, { d: da > 0.01 ? qbPath(A, Q, Z, 0, da) : 'M0 0', opacity: 1 - 0.5 * lin(t, T.land, 0.5) });
        const hp = qb(A, Q, Z, da), hq = qb(A, Q, Z, Math.max(0, da - 0.02));
        set(S.dashHead, { transform: `translate(${f1(hp[0])} ${f1(hp[1])}) rotate(${f1(Math.atan2(hp[1] - hq[1], hp[0] - hq[0]) * 180 / Math.PI)})`, opacity: lin(da, 0.1, 0.1) * (1 - 0.5 * lin(t, T.land, 0.5)) });
        const cu = E.enter(lin(t, T.carton, T.land - T.carton));
        const cpos = qb([A[0], A[1] + 20], [Q[0], Q[1] + 20], Z, cu);
        place(S.p1Carton, { x: cpos[0], y: cpos[1], s: 0.42, o: lin(t, T.carton, 0.2) });
        Kit.show(S.p1Carton, t >= T.carton);
        S.carton1.update({ tape: 1, t });
        // Panel 2
        const typed = lin(t, T.type, 0.6);
        S.term.update({ screen: 'onhands', row: 0, typed, flash: bump(t, T.type + 0.7, 0.8), t });
        S.termCheck.update({ t, tIn: T.term });
        // Panel 3
        S.team.forEach((m, i) => {
          const o = E.enter(lin(t, T.p3 + 0.35 + 0.12 * i, 0.4));
          place(m.g, { x: m.x, y: m.y + 16 * (1 - o), s: 0.5, o });
          m.w.update({ pose: m.pose, t, facing: m.facing, nod: i === 1 ? bump(t, T.teamChecks + 0.3, 0.4) : 0 });
          place(m.ck.g, { x: m.cx, y: m.cy });
          m.ck.update({ t, tIn: T.teamChecks + 0.18 * i });
        });
        S.loopArrows.forEach((f, i) => f(E.enter(lin(t, T.loopDraw + 0.2 * i, 0.6))));
        set(S.loopSpin, { transform: `rotate(${f1(360 * Engine.ease.inOut(lin(t, T.spin, 1.4)))})` });
      }

      // ---------------------------------------------------------------- b04 common errors
      const on4 = t > T.head4 - 0.1 && t < T.out4 + 0.1;
      Kit.show(S.b4, on4);
      if (on4) {
        S.head4.update({ t, tIn: T.head4, tOut: T.out4 });
        present(S.clipG, t, T.clip, T.out4, { x: 640, y: 196 });
        S.clipboard.update({ checks: 2, late: lin(t, T.late, 0.8) });
        present(S.clockG, t, T.clock - 0.01, T.out4, { x: 1180, y: 396 });
        // Fast sweep, then the hands coast to a stop (idle state fed the matching hand angle).
        const h0 = 10, m0 = 10;
        if (t < T.sweepEnd) {
          S.clock.update({ t, state: t >= T.sweep ? 'fast-sweep' : 'idle', tState: T.sweep, time: [h0, m0], pulse: t < T.sweep + 3 && t >= T.sweep });
        } else {
          const e = T.sweepEnd - T.sweep, spin = 900 * e * e / (e + 0.3), v = 900 * (e * e + 0.6 * e) / (e + 0.3) ** 2;
          const k = 2.5, extra = v * (1 - Math.exp(-k * (t - T.sweepEnd))) / k;
          S.clock.update({ t, state: 'idle', tState: T.sweep, time: [h0, m0 + (spin + extra) / 6], pulse: t < T.sweep + 3 });
        }
        S.tasks.forEach((k, i) => {
          const t0 = T.tasks[i];
          pop(k.disc, t, t0, INF);
          Kit.show(k.g, true);
          place(k.g, { x: k.x, y: k.y, o: 1 - E.exit(lin(t, T.out4 - 0.3, 0.3)) });
          const pl = E.enter(lin(t, t0 + 0.2, 0.35));
          set(k.dots, { d: pl > 0.01 ? `M34 -30L${f1(34 + 28 * pl)} ${f1(-30 - 14 * pl)}` : 'M0 0' });
          present(k.slip, t, t0 + 0.4, INF, { x: 84, y: -50, side: -1 });
          const pt = Kit.presence(t, t0 + 0.05, INF, { rise: 12 });
          set(k.label, { opacity: pt.o.toFixed(3), transform: `translate(0 ${pt.dy.toFixed(2)})` });
        });
        const o4 = 1 - E.exit(lin(t, T.out4 - 0.3, 0.3));
        S.bullets.forEach((b, i) => set(b, { opacity: (lin(t, T.tasks[i + 1], 0.3) * o4).toFixed(3) }));
      }

      // ---------------------------------------------------------------- b05 preventions
      const on5 = t > T.list - 0.1 && t < T.out5 + 0.1;
      Kit.show(S.b5, on5);
      if (on5) {
        const ox = 1 - E.exit(lin(t, T.out5 - 0.3, 0.3));
        place(S.b5, { o: ox, y: -16 * (1 - ox) });
        place(S.listG, { x: S.listPos.x, y: S.listPos.y });
        S.list.update({ t, tIn: T.list, rows: T.items.map((c, i) => Math.max(T.list + 0.3 + 0.1 * i, c - 0.4)), ticks: T.items.map(c => c + 0.45) });
        const w = S.walk5, u = lin(t, T.ask, w.dur), tArr = T.ask + w.dur;
        const walking = t < T.ask ? 0 : t < tArr ? 1 : 1 - lin(t, tArr, 0.25);
        const tDone = Math.max(tArr + 0.4, T.sup);
        const x = lerp(w.x0, w.x1, u);
        const po = E.enter(lin(t, T.people, 0.4));
        place(S.w5.g, { x, y: FLOOR + 24 * (1 - po), o: po });
        const nod = Math.max(...T.items.map(c => bump(t, c + 0.45, 0.45)));
        const pose = Kit.Worker.poseAt(t, [[0, 'stand'], [T.ask - 0.2, 'point'], [tDone + 0.6, 'stand']], 0.2);
        S.w5.update({ ...pose, t, walking, stride: 0.95, nod: t < T.ask ? nod : 0, aim: 100 });
        place(S.sup.g, { x: w.sx, y: FLOOR + 24 * (1 - po), o: po });
        S.sup.update({ ...Kit.Worker.poseAt(t, [[0, 'stand'], [tDone, 'thumbs-up']], 0.2), t, facing: -1 });
        const hy = FLOOR - 262 - 18;
        place(S.ask.g, { x, y: hy });
        S.ask.update({ t, tIn: T.ask - 0.2, tOut: tDone + 0.2 });
        place(S.askCheck.g, { x, y: hy - 16 - S.ask.h / 2 });
        S.askCheck.update({ t, tIn: tDone });
      }

      // ---------------------------------------------------------------- b06 table of contents
      const on6 = t > T.toc - 0.1;
      Kit.show(S.b6, on6);
      if (on6) {
        present(S.tocCard, t, T.toc, INF, { x: S.toc.x, y: S.toc.y + Math.sin((t - T.toc) * Math.PI * 2 / 5) });
        S.tocRows.forEach((r, i) => {
          const tr = T.toc + 0.3 + 0.1 * i;
          const hl = i === 1 ? E.enter(lin(t, T.dock, 0.4)) : 0;
          const b = i === 1 ? 1 + 0.04 * bump(t, T.dock + 0.1, 0.45) : 1;
          present(r.row, t, tr, INF, { x: 0, y: r.cy, side: -1 });
          if (b !== 1) place(r.row, { x: 0, y: r.cy, s: b, o: 1 });
          set(r.band, { width: (960 * hl).toFixed(1) });
          Kit.show(r.band, hl > 0.001);
          if (r.ck) r.ck.update({ t, tIn: tr + 0.2 });
        });
      }

      // ---------------------------------------------------------------- lower third (packet sections)
      S.lower.update({ t, times: [T.lower, T.lower2], tOut: T.out5 });
    },
  });
})();
