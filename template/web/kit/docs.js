// Kit: docs. Warehouse map, paperwork, terminal, filing drawer and small doc-side icons
// (STYLE.md §6 items 13, 22–27). Every factory follows the contract in build/AGENT_BRIEF.md:
// all nodes are created in the factory, update(params) only sets attributes and toggles display,
// and the picture depends on params alone. Handwriting is Inter skewed and tilted, revealed
// left to right by a clip rect driven by a progress param.
(() => {
  const { el, set, clamp, lerp } = Engine;
  const { C, STROKE, ease, text, show, measure } = Kit;

  // ---------- shared helpers (private to this file) ----------
  let uid = 0;
  const uniq = p => `kdoc-${p}-${++uid}`;
  // Deterministic pseudo-random in [0, 1) from an index (no Math.random anywhere in the kit).
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    p = clamp(p);
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
  };
  const inkLine = (extra = {}) => ({ stroke: C.ink, 'stroke-width': STROKE, 'stroke-linejoin': 'round', ...extra });
  const rectD = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  const tf = (x, y, s = 1, r = 0) => `translate(${x.toFixed(2)} ${y.toFixed(2)})${r ? ` rotate(${r.toFixed(2)})` : ''}${s !== 1 ? ` scale(${s.toFixed(4)})` : ''}`;

  // A stroke that draws itself: pathLength 1 plus a dash offset.
  const drawn = (parent, d, attrs = {}) => el('path', {
    d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs,
  }, parent);
  const drawTo = (node, p) => { p = clamp(p); set(node, { 'stroke-dashoffset': 1 - p, display: p > 0.001 ? 'inline' : 'none' }); };

  // Sample a path's geometry once at build time, so update can place things along it cheaply.
  function sampler(d, n = 80) {
    const probe = el('path', { d, fill: 'none' }, document.getElementById('stage'));
    const len = probe.getTotalLength();
    const pts = [];
    for (let i = 0; i <= n; i++) { const q = probe.getPointAtLength((len * i) / n); pts.push([q.x, q.y]); }
    probe.remove();
    return p => {
      const f = clamp(p) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      return { x: lerp(x0, x1, k), y: lerp(y0, y1, k), angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI };
    };
  }

  // Rounded "text line" placeholder used on paperwork (decorative, not text).
  const bar = (parent, x, y, w, h = 10, fill = C.steel, o = 0.45) =>
    el('rect', { x, y: y - h / 2, width: Math.max(h, w), height: h, rx: h / 2, fill, opacity: o }, parent);

  function barcode(parent, x, y, w, h, seed = 1, fill = C.ink) {
    let d = '', cx = x, i = 0;
    while (true) {
      const bw = 2 + Math.floor(hash(seed * 31 + i) * 4) * 1.5;
      if (cx + bw > x + w) break;
      d += `M${cx.toFixed(1)} ${y}h${bw.toFixed(1)}v${h}h${(-bw).toFixed(1)}Z`;
      cx += bw + 2.5 + Math.floor(hash(seed * 17 + i + 0.37) * 3) * 1.5;
      i++;
    }
    return el('path', { d, fill }, parent);
  }

  // Check circle: empty steel ring -> pops green, white check draws. p 0..1.
  function checkCircle(parent, x, y, r = 12) {
    const g = el('g', { transform: tf(x, y) }, parent);
    el('circle', { cx: 0, cy: 0, r, fill: C.paper, stroke: C.steel, 'stroke-width': STROKE }, g);
    const dot = el('circle', { cx: 0, cy: 0, r, fill: C.correct, stroke: C.ink, 'stroke-width': STROKE, opacity: 0 }, g);
    const tick = drawn(g, `M${-r * 0.45} ${r * 0.02} L${-r * 0.1} ${r * 0.38} L${r * 0.5} ${-r * 0.36}`, { stroke: C.paper, 'stroke-width': Math.max(2.5, r * 0.26) });
    return p => {
      p = clamp(p);
      const s = p > 0 ? 0.7 + 0.3 * ease.pop(seg(p, 0, 0.6)) : 1;
      set(g, { transform: tf(x, y, s) });
      set(dot, { opacity: seg(p, 0, 0.25) });
      drawTo(tick, seg(p, 0.3, 1));
    };
  }

  // Handwritten line: Inter, tilted and skewed, revealed left to right. Returns {g, width, update(p)}.
  function hand(parent, str, { x = 0, y = 0, size = 28, fill = C.error, weight = 600, skew = -12, rot = -2 } = {}) {
    const cid = uniq('hw');
    const cp = el('clipPath', { id: cid }, el('defs', {}, parent));
    const width = measure(str, size, weight) + size * 0.35;
    const r = el('rect', { x: x - size * 0.4, y: y - size * 1.5, width: 0, height: size * 2.2 }, cp);
    const g = el('g', { 'clip-path': `url(#${cid})` }, parent);
    text(el('g', { transform: `translate(${x} ${y}) rotate(${rot}) skewX(${skew})` }, g), str, { size, weight, fill });
    return {
      g, width,
      update(p) { p = clamp(p); set(r, { width: p * (width + size * 0.5) }); show(g, p > 0); },
    };
  }

  // Sheet of paper with a title and a rule under it (documents family, 260×340 by default).
  function sheet(g, { w = 260, h = 340, title = '', titleX = 18, size = 24 } = {}) {
    el('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: C.paper, ...inkLine() }, g);
    const t = title ? text(g, title, { x: titleX, y: 40, size, weight: 800 }) : null;
    el('line', { x1: 16, y1: 56, x2: w - 16, y2: 56, stroke: C.steel, 'stroke-width': 2 }, g);
    return t;
  }

  // Small padlock, body centred on the origin. Returns update(u): u 0 locked -> 1 open and green.
  function padlock(parent, x, y, s = 1) {
    const g = el('g', { transform: tf(x, y, s) }, parent);
    const sh = el('g', {}, g);
    el('path', { d: 'M-9 10 V-13 A9 9 0 0 1 9 -13 V-1', fill: 'none', stroke: C.ink, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, sh);
    const body = el('rect', { x: -15, y: -5, width: 30, height: 24, rx: 5, fill: C.steelDark, ...inkLine() }, g);
    el('circle', { cx: 0, cy: 5, r: 3.4, fill: C.paper }, g);
    el('rect', { x: -1.5, y: 6, width: 3, height: 7, rx: 1.5, fill: C.paper }, g);
    return u => {
      u = clamp(u);
      set(sh, { transform: `translate(0 ${(-11 * ease.enter(seg(u, 0, 0.6))).toFixed(2)}) rotate(${(-14 * ease.enter(seg(u, 0.4, 1))).toFixed(2)} -9 6)` });
      set(body, { fill: mix(C.steelDark, C.correct, seg(u, 0.4, 0.8)) });
    };
  }

  // =====================================================================================
  /* Kit.WarehouseMap(parent, opts) — STYLE §6.13. Top-down plan of the warehouse, 1200×620, with
   * 2.5D depth (walls and rack rows show a front face). Rows A–F run front to back with aisles
   * between them, labels A–F along the bottom of the rows, three floor zones along the bottom
   * wall, an optional dashed Overflow zone on the right, two dock doors under Outbound.
   * Options:
   *   lineArt: false   true = outline-only map for title / closing cards: walls, row outlines and
   *                    zone outlines all self-draw with `draw`; no fills, no labels.
   *   theme: 'light'   'dark' (lineArt only) = paper / onDarkSoft lines and paper route dots for
 *                    bg-dark cards. The filled map carries its own floor, so it works on either background.
   *   route: [[x,y]…]  dotted route polyline in map coords. Default snakes up aisle A|B, down C|D,
   *                    up E|F and ends at the Outbound zone.
   *   stops: [[x,y,label]…] pick stops on that route (default five, ascending A-01-2 … E-02-1).
   *   markers: [{x, y, kind}]  emergency pins (tip at x,y); kind 'extinguisher' | 'eyewash' | 'firstaid'.
   *                    Default three pins along the walls.
   * update({
   *   draw: 0..1       outline self-draws (walls, doors). Filled mode: fills fade in over the last 40%.
   *                    lineArt: walls, then rows (staggered), then zones. Default 1.
   *   rows: 0..6       rack rows A–F drop in one at a time; the fraction is the current row's drop
   *                    (falls 50 px with a small settle). Default 6. Ignored in lineArt.
   *   zones: 0..1      Will Call, Shop / Field, Outbound rise in (staggered). Default 1.
   *   lit: null | 'willcall' | 'shop' | 'outbound' | 'overflow'   zone filled accent, solid outline.
   *   litP: 0..1       strength of `lit` (tween it to light a zone). Default 1.
   *   overflow: 0..1   dashed "Overflow" zone fades in. Default 0.
   *   route: 0..1      dotted route draws along its length with an arrow head; stop dots pop
   *                    (accent) as the route passes them. Default 0.
   *   markers: 0..N    emergency pins pop in one at a time (fraction = current pin's pop). Default 0.
   *   ping: 0..1       ring-pulse phase on the visible pins, e.g. (t / 1.2) % 1. Default 0 (no ring).
   * })
   * Helpers (map-local coords): map.routeAt(p) -> {x, y, angle}; map.stops -> [{x, y, p, label}]
   *   (p = route progress at that stop); map.row('B') -> {x, y, w, h, cx, cy};
   *   map.zone('outbound') -> {x, y, w, h, cx, cy}; map.marker(i) -> {x, y}; map.W, map.H.
   * Origin: top-left of the 1200×620 plan.
   */
  Kit.WarehouseMap = function (parent, opts = {}) {
    const { lineArt = false, theme = 'light' } = opts;
    const dark = theme === 'dark';
    const W = 1200, H = 620, WALL = 14, BODY = 604;
    const lineMain = lineArt && dark ? C.paper : C.ink;
    const lineSoft = lineArt ? (dark ? C.onDarkSoft : C.inkSoft) : C.ink;
    const RY = 70, RH = 260, RW = 96, FACE = 16;
    const rows = 'ABCDEF'.split('').map((L, i) => {
      const x = 70 + i * 160;
      return { L, x, y: RY, w: RW, h: RH + FACE, cx: x + RW / 2, cy: RY + RH / 2 };
    });
    const zoneDefs = [
      { key: 'willcall', label: 'Will Call', x: 34, y: 446, w: 360, h: 132 },
      { key: 'shop', label: 'Shop / Field', x: 420, y: 446, w: 360, h: 132 },
      { key: 'outbound', label: 'Outbound', x: 806, y: 446, w: 360, h: 132 },
      { key: 'overflow', label: 'Overflow', x: 1010, y: RY, w: 156, h: RH + FACE },
    ].map(z => ({ ...z, cx: z.x + z.w / 2, cy: z.y + z.h / 2 }));
    const zoneBy = Object.fromEntries(zoneDefs.map(z => [z.key, z]));
    const doors = [880, 1040];

    const g = el('g', {}, parent);

    // --- building fills (filled mode only) ---
    const fills = el('g', {}, g);
    if (!lineArt) {
      el('rect', { x: 0, y: 0, width: W, height: BODY, fill: C.steel }, fills);
      el('rect', { x: WALL, y: WALL, width: W - 2 * WALL, height: BODY - 2 * WALL, fill: C.floor }, fills);
      el('rect', { x: 0, y: BODY, width: W, height: H - BODY, fill: C.steelDark }, fills);
      el('rect', { x: 0, y: 470, width: WALL, height: 84, fill: C.floor }, fills);
      for (const dx of doors) {
        el('rect', { x: dx, y: BODY - WALL, width: 100, height: WALL, fill: C.floor }, fills);
        el('rect', { x: dx, y: BODY, width: 100, height: H - BODY, fill: C.paper }, fills);
      }
    }
    // --- building outlines (self-drawing) ---
    const wallLines = [
      drawn(g, rectD(0, 0, W, BODY), { stroke: lineMain, 'stroke-width': STROKE }),
      drawn(g, rectD(WALL, WALL, W - 2 * WALL, BODY - 2 * WALL), { stroke: lineMain, 'stroke-width': STROKE }),
      drawn(g, `M0 ${BODY}V${H}H${W}V${BODY}`, { stroke: lineMain, 'stroke-width': STROKE }),
    ];
    const doorLines = [
      drawn(g, `M0 470h${WALL}M0 554h${WALL}`, { stroke: lineMain, 'stroke-width': STROKE }),
      ...doors.map(dx => drawn(g, `M${dx} ${BODY - WALL}V${H}M${dx + 100} ${BODY - WALL}V${H}M${dx + 8} ${BODY + 6}h84M${dx + 8} ${BODY + 11}h84`, { stroke: lineSoft, 'stroke-width': 2 })),
    ];

    // --- zones ---
    const zoneNodes = zoneDefs.map(z => {
      const zg = el('g', {}, g);
      const fill = el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 10, fill: C.accent, opacity: 0 }, zg);
      const dash = el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 10, fill: 'none', stroke: C.inkSoft, 'stroke-width': STROKE, 'stroke-dasharray': '14 10' }, zg);
      const solid = el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 10, fill: 'none', stroke: C.ink, 'stroke-width': 3, opacity: 0 }, zg);
      const big = z.key !== 'overflow';
      const label = text(zg, z.label, { x: z.cx, y: z.cy + (big ? 10 : 8), size: big ? 30 : 24, weight: big ? 700 : 600, anchor: 'middle', fill: C.inkSoft });
      const line = lineArt && z.key !== 'overflow' ? drawn(g, `M${z.x + 10} ${z.y}H${z.x + z.w - 10}A10 10 0 0 1 ${z.x + z.w} ${z.y + 10}V${z.y + z.h - 10}A10 10 0 0 1 ${z.x + z.w - 10} ${z.y + z.h}H${z.x + 10}A10 10 0 0 1 ${z.x} ${z.y + z.h - 10}V${z.y + 10}A10 10 0 0 1 ${z.x + 10} ${z.y}Z`, { stroke: lineSoft, 'stroke-width': 2 }) : null;
      if (lineArt) show(zg, false);
      return { z, zg, fill, dash, solid, label, line };
    });

    // --- rack rows ---
    const rowNodes = rows.map((r, i) => {
      const rg = el('g', {}, g);
      if (!lineArt) {
        el('rect', { x: r.x, y: RY, width: RW, height: RH, fill: C.steel, ...inkLine() }, rg);
        el('rect', { x: r.x, y: RY + RH, width: RW, height: FACE, fill: C.steelDark, ...inkLine() }, rg);
        el('line', { x1: r.cx, y1: RY + 4, x2: r.cx, y2: RY + RH - 4, stroke: C.steelDark, 'stroke-width': 2 }, rg);
        // cartons on the shelves, one per half-section where the hash says so
        for (let s = 0; s < 3; s++) for (let half = 0; half < 2; half++) {
          const k = i * 6 + s * 2 + half;
          if (hash(k) < 0.22) continue;
          const cw = 26 + Math.round(hash(k + 50) * 10), ch = 34 + Math.round(hash(k + 90) * 30);
          const cx0 = half ? r.cx + 6 : r.x + 6, sy = RY + s * (RH / 3);
          el('rect', { x: cx0 + Math.round(hash(k + 7) * (RW / 2 - 12 - cw)), y: sy + 12 + Math.round(hash(k + 3) * (RH / 3 - 24 - ch)), width: cw, height: ch, rx: 2, fill: C.carton, stroke: C.cartonEdge, 'stroke-width': 2 }, rg);
        }
        el('path', { d: `M${r.x} ${RY + RH / 3}h${RW}M${r.x} ${RY + (2 * RH) / 3}h${RW}`, stroke: C.ink, 'stroke-width': STROKE }, rg);
        text(rg, r.L, { x: r.cx, y: RY + RH + FACE + 36, size: 30, weight: 800, anchor: 'middle' });
      }
      const lines = lineArt ? [
        drawn(g, rectD(r.x, RY, RW, RH), { stroke: lineSoft, 'stroke-width': 2 }),
        drawn(g, `M${r.x} ${RY + RH}V${RY + RH + FACE}H${r.x + RW}V${RY + RH}`, { stroke: lineSoft, 'stroke-width': 2 }),
        drawn(g, `M${r.x} ${RY + RH / 3}h${RW}M${r.x} ${RY + (2 * RH) / 3}h${RW}M${r.cx} ${RY}V${RY + RH}`, { stroke: lineSoft, 'stroke-width': 1.5 }),
      ] : [];
      return { rg, lines };
    });

    // --- route ---
    const routePts = opts.route || [[110, 412], [198, 412], [198, 42], [518, 42], [518, 412], [838, 412], [838, 42], [988, 42], [988, 466]];
    const segs = [];
    let L = 0;
    for (let i = 1; i < routePts.length; i++) {
      const [x0, y0] = routePts[i - 1], [x1, y1] = routePts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      segs.push({ x0, y0, x1, y1, len, at: L });
      L += len;
    }
    const routeAt = p => {
      const d = clamp(p) * L;
      let s = segs[segs.length - 1];
      for (const q of segs) if (d <= q.at + q.len) { s = q; break; }
      const k = s.len ? clamp((d - s.at) / s.len) : 0;
      return { x: lerp(s.x0, s.x1, k), y: lerp(s.y0, s.y1, k), angle: (Math.atan2(s.y1 - s.y0, s.x1 - s.x0) * 180) / Math.PI };
    };
    const progressOf = (x, y) => {
      let best = { d: Infinity, p: 0 };
      for (const s of segs) {
        const vx = s.x1 - s.x0, vy = s.y1 - s.y0;
        const k = s.len ? clamp(((x - s.x0) * vx + (y - s.y0) * vy) / (s.len * s.len)) : 0;
        const d = Math.hypot(s.x0 + vx * k - x, s.y0 + vy * k - y);
        if (d < best.d) best = { d, p: (s.at + s.len * k) / L };
      }
      return best.p;
    };
    const routeG = el('g', {}, g);
    const dotFill = lineArt && dark ? C.paper : C.ink;
    const dots = [];
    for (let d = 0; d <= L; d += 20) {
      const q = routeAt(d / L);
      dots.push({ p: d / L, node: el('circle', { cx: q.x, cy: q.y, r: 4.5, fill: dotFill }, routeG) });
    }
    const stopDefs = opts.stops || [[198, 287, 'A-01-2'], [198, 200, 'B-02-3'], [518, 113, 'C-03-1'], [518, 287, 'D-01-2'], [838, 200, 'E-02-1']];
    const stops = stopDefs.map(([x, y, label]) => ({ x, y, label, p: progressOf(x, y) }));
    const stopNodes = stops.map(s => el('circle', { cx: s.x, cy: s.y, r: 11, fill: C.accent, ...inkLine() }, routeG));
    const head = el('path', { d: 'M10 0 L-8 -9 L-4 0 L-8 9 Z', fill: dotFill }, routeG);

    // --- emergency markers ---
    const markerDefs = opts.markers || [{ x: 40, y: 200, kind: 'extinguisher' }, { x: 678, y: 58, kind: 'eyewash' }, { x: 1160, y: 430, kind: 'firstaid' }];
    const markerNodes = markerDefs.map(m => {
      const color = m.kind === 'extinguisher' ? C.error : C.correct;
      const mg = el('g', {}, g);
      const ring = el('circle', { cx: 0, cy: -34, r: 20, fill: 'none', stroke: color, 'stroke-width': 4, opacity: 0 }, mg);
      const pin = el('g', {}, mg);
      el('path', { d: 'M0 0 C-5 -10 -20 -20 -20 -34 A20 20 0 1 1 20 -34 C20 -20 5 -10 0 0 Z', fill: color, ...inkLine() }, pin);
      if (m.kind === 'extinguisher') {
        el('rect', { x: -5.5, y: -40, width: 11, height: 17, rx: 3, fill: C.paper }, pin);
        el('path', { d: 'M-2 -40 V-45 H6 M2 -45 L8 -41', fill: 'none', stroke: C.paper, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, pin);
      } else if (m.kind === 'eyewash') {
        el('path', { d: 'M0 -47 C5 -40 8 -36 8 -32 A8 8 0 0 1 -8 -32 C-8 -36 -5 -40 0 -47 Z', fill: C.paper }, pin);
      } else {
        el('path', { d: 'M-3.5 -45h7v7.5h7.5v7h-7.5v7.5h-7v-7.5h-7.5v-7h7.5Z', fill: C.paper }, pin);
      }
      return { m, mg, pin, ring };
    });

    return {
      g, W, H, routeAt, stops,
      row: L_ => { const r = rows.find(q => q.L === L_); return r && { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.cx, cy: r.cy }; },
      zone: k => { const z = zoneBy[k]; return z && { x: z.x, y: z.y, w: z.w, h: z.h, cx: z.cx, cy: z.cy }; },
      marker: i => ({ x: markerDefs[i].x, y: markerDefs[i].y }),
      update({ draw = 1, rows: nRows = 6, zones = 1, lit = null, litP = 1, overflow = 0, route = 0, markers = 0, ping = 0 } = {}) {
        if (lineArt) {
          drawTo(wallLines[0], seg(draw, 0, 0.32));
          drawTo(wallLines[1], seg(draw, 0.08, 0.4));
          drawTo(wallLines[2], seg(draw, 0.2, 0.42));
          doorLines.forEach((n, i) => drawTo(n, seg(draw, 0.36 + i * 0.03, 0.5 + i * 0.03)));
          rowNodes.forEach((r, i) => r.lines.forEach((n, j) => drawTo(n, seg(draw, 0.3 + i * 0.05 + j * 0.04, 0.52 + i * 0.05 + j * 0.04))));
          zoneNodes.forEach((z, i) => z.line && drawTo(z.line, seg(draw, 0.62 + i * 0.06, 0.82 + i * 0.06)));
        } else {
          wallLines.forEach((n, i) => drawTo(n, seg(draw, i * 0.08, 0.5 + i * 0.05)));
          doorLines.forEach((n, i) => drawTo(n, seg(draw, 0.4, 0.62)));
          set(fills, { opacity: seg(draw, 0.6, 1) });
          rowNodes.forEach((r, i) => {
            const p = clamp(nRows - i);
            show(r.rg, p > 0);
            set(r.rg, { transform: `translate(0 ${(-50 * (1 - ease.pop(p))).toFixed(2)})`, opacity: seg(p, 0, 0.35) });
          });
          zoneNodes.forEach((n, i) => {
            const isOver = n.z.key === 'overflow';
            const p = isOver ? clamp(overflow) : ease.enter(seg(zones, i * 0.15, i * 0.15 + 0.7));
            const lp = lit === n.z.key ? clamp(litP) : 0;
            show(n.zg, p > 0);
            set(n.zg, { transform: `translate(0 ${(12 * (1 - p)).toFixed(2)})`, opacity: p });
            set(n.fill, { opacity: lp });
            set(n.dash, { opacity: 1 - lp });
            set(n.solid, { opacity: lp });
            set(n.label, { fill: mix(C.inkSoft, C.ink, lp) });
          });
        }
        // route + stops + head
        const rp = clamp(route);
        show(routeG, rp > 0);
        for (const d of dots) show(d.node, d.p <= rp + 1e-6);
        stops.forEach((s, i) => {
          const sp = clamp((rp - s.p) * L / 40);
          show(stopNodes[i], sp > 0);
          set(stopNodes[i], { transform: `translate(${s.x} ${s.y}) scale(${(0.4 + 0.6 * ease.pop(sp)).toFixed(3)}) translate(${-s.x} ${-s.y})` });
        });
        const hq = routeAt(rp);
        show(head, rp > 0 && rp < 1);
        set(head, { transform: tf(hq.x, hq.y, 1, hq.angle) });
        // markers
        markerNodes.forEach((n, i) => {
          const p = clamp(markers - i);
          show(n.mg, p > 0);
          set(n.mg, { transform: tf(n.m.x, n.m.y) });
          set(n.pin, { transform: `translate(0 ${(-14 * (1 - ease.enter(p))).toFixed(2)}) scale(${(0.5 + 0.5 * ease.pop(p)).toFixed(3)})`, opacity: seg(p, 0, 0.3) });
          const ph = clamp(ping);
          set(n.ring, { r: 20 + 30 * ph, opacity: p >= 1 && ph > 0 ? 0.9 * (1 - ph) : 0 });
        });
      },
    };
  };

  // =====================================================================================
  /* Kit.Clipboard(parent, {title = 'Manifest', items = 5, noteText = 'Damage noted'}) — STYLE §6.22.
   * 300×400 hardboard clipboard holding a manifest: title, `items` line items each with a check
   * circle, a handwritten red note line, and a signature line guarded by a padlock.
   * update({
   *   checks: 0..items  rows tick in order; the fraction is the current row's tick (circle pops
   *                     green, check draws; give each tick ~0.25 s). Default 0.
   *   unlock: 0..1      padlock opens (shackle lifts and swings, body turns green) and the greyed
   *                     signature line comes to full ink. Default 0.
   *   sign:   0..1      pen stroke signs the line; a small pen rides the stroke tip while 0 < sign < 1.
   *   note:   0..1      handwritten red `noteText` writes on, left to right. Default 0.
   *   late:   0..1      paper tints red, red X badge pops at the top-right corner, and a paper chip
   *                     "Late paperwork" (red text, red outline) appears below the board (y 410–454).
   * })
   * Helpers: clip.rowY(i) -> y of row i's centre; clip.notePos -> {x, y} of the note's baseline start.
   * Origin: top-left of the board (the metal clip pokes 12 px above y = 0).
   */
  Kit.Clipboard = function (parent, opts = {}) {
    const { title = 'Manifest', items = 5, noteText = 'Damage noted' } = opts;
    const g = el('g', {}, parent);
    el('rect', { x: 0, y: 0, width: 300, height: 400, rx: 16, fill: C.carton, ...inkLine() }, g);
    el('rect', { x: 18, y: 30, width: 264, height: 354, rx: 4, fill: C.paper, ...inkLine() }, g);
    const tint = el('rect', { x: 18, y: 30, width: 264, height: 354, rx: 4, fill: C.error, opacity: 0 }, g);
    el('rect', { x: 96, y: -12, width: 108, height: 46, rx: 10, fill: C.steel, ...inkLine() }, g);
    el('rect', { x: 126, y: -3, width: 48, height: 12, rx: 6, fill: C.steelDark }, g);
    text(g, title.toUpperCase(), { x: 40, y: 74, size: 24, weight: 800, spacing: 0.12 });
    const pitch = Math.min(38, 152 / Math.max(1, items - 1));
    const rowY = i => 102 + i * pitch;
    const ticks = [];
    for (let i = 0; i < items; i++) {
      const y = rowY(i);
      bar(g, 76, y, 90 + Math.round(hash(i + 11) * 54));
      bar(g, 234, y, 26);
      ticks.push(checkCircle(g, 52, y, 12));
    }
    const note = hand(g, noteText, { x: 40, y: 312, size: 30 });
    // signature line, padlock, pen
    const signG = el('g', {}, g);
    text(signG, 'Sign', { x: 36, y: 370, size: 22, weight: 600, fill: C.inkSoft });
    el('line', { x1: 92, y1: 368, x2: 222, y2: 368, stroke: C.inkSoft, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, signG);
    const sigD = 'M98 362 C104 340 112 334 114 346 C116 360 104 368 110 356 C116 342 126 336 128 350 C129 360 132 362 138 350 C144 338 150 340 150 352 C150 362 158 358 164 348 C170 338 176 342 176 352 C177 360 186 356 194 350 C202 344 210 346 218 344';
    const sig = drawn(g, sigD, { stroke: C.ink, 'stroke-width': 3 });
    const sigAt = sampler(sigD);
    const lock = padlock(g, 254, 356);
    const pen = el('g', {}, g);
    el('rect', { x: -5, y: -54, width: 10, height: 44, rx: 2, fill: C.neutral, ...inkLine({ 'stroke-width': 2 }) }, pen);
    el('rect', { x: -5, y: -60, width: 10, height: 9, rx: 3, fill: C.ink }, pen);
    el('path', { d: 'M-5 -10 L0 0 L5 -10 Z', fill: C.ink }, pen);
    // late paperwork
    const lateG = el('g', {}, g);
    const xBadge = el('g', {}, lateG);
    el('circle', { cx: 0, cy: 0, r: 24, fill: C.error, ...inkLine() }, xBadge);
    el('path', { d: 'M-9 -9 L9 9 M9 -9 L-9 9', stroke: C.paper, 'stroke-width': 5, 'stroke-linecap': 'round' }, xBadge);
    const chipW = measure('Late paperwork', 26, 700) + 36;
    const chip = el('g', {}, lateG);
    el('rect', { x: 150 - chipW / 2, y: 410, width: chipW, height: 44, rx: 22, fill: C.paper, stroke: C.error, 'stroke-width': 3 }, chip);
    text(chip, 'Late paperwork', { x: 150, y: 441, size: 26, weight: 700, fill: C.error, anchor: 'middle' });

    return {
      g, rowY, notePos: { x: 40, y: 312 },
      update({ checks = 0, unlock = 0, sign = 0, note: noteP = 0, late = 0 } = {}) {
        ticks.forEach((f, i) => f(checks - i));
        lock(unlock);
        set(signG, { opacity: 0.4 + 0.6 * clamp(unlock) });
        drawTo(sig, sign);
        const sp = clamp(sign);
        show(pen, sp > 0 && sp < 1);
        const q = sigAt(sp);
        set(pen, { transform: tf(q.x, q.y, 1, 28) });
        note.update(noteP);
        const lp = clamp(late);
        set(tint, { opacity: 0.16 * lp });
        show(lateG, lp > 0);
        set(xBadge, { transform: tf(290, 18, ease.pop(seg(lp, 0, 0.7))) });
        set(chip, { opacity: seg(lp, 0.2, 0.7), transform: `translate(0 ${(12 * (1 - ease.enter(seg(lp, 0.2, 1)))).toFixed(2)})` });
      },
    };
  };

  // =====================================================================================
  /* Kit.PackingSlip(parent, opts) — STYLE §6.23. 260×340 paper slip: header, 5 numbered rows
   * (01–05, decorative text bars), up to two handwritten red note lines and a barcode band.
   * Options:
   *   variant: 'plain' | 'customer' | 'shop'   header text 'Packing slip' | 'Customer order' |
   *            'Shop order'; customer adds a hard-hat glyph, shop a wrench glyph left of the title.
   *   title:   override the header text.
   *   notes:   red handwritten lines, default ['Qty short', 'Wrong part'].
   * update({
   *   pending: 0..1   "Pending" badge (accent pill, rotated) pops onto the top-right corner.
   *   notes:   0..2   red note lines write on one after the other (fraction = current line).
   *   row:     null | 0..4   row whose number is highlighted (accent chip behind "0n").
   *   rowGlow: 0..1   strength of that highlight; pulse it (e.g. 0.5 + 0.5 sin) to pulse the number.
   * })
   * Helpers: slip.rowPos(i) -> {x, y} centre of row i's number chip (for dotted connectors).
   * Origin: top-left. The pending badge overhangs the top edge (it reaches y ≈ −40).
   */
  Kit.PackingSlip = function (parent, opts = {}) {
    const { variant = 'plain', notes: noteTexts = ['Qty short', 'Wrong part'] } = opts;
    const title = opts.title || { plain: 'Packing slip', customer: 'Customer order', shop: 'Shop order' }[variant] || 'Packing slip';
    const g = el('g', {}, parent);
    const glyph = variant === 'customer' || variant === 'shop';
    sheet(g, { title, titleX: glyph ? 52 : 18, size: glyph && measure(title, 24, 800) > 190 ? 22 : 24 });
    if (variant === 'customer') {
      const hg = el('g', { transform: tf(32, 32) }, g);
      el('path', { d: 'M-12 4 A12 12 0 0 1 12 4 Z', fill: C.safety, ...inkLine({ 'stroke-width': 2 }) }, hg);
      el('rect', { x: -16, y: 3, width: 32, height: 6, rx: 3, fill: C.safety, ...inkLine({ 'stroke-width': 2 }) }, hg);
      el('line', { x1: 0, y1: -8, x2: 0, y2: 3, stroke: C.ink, 'stroke-width': 2 }, hg);
    } else if (variant === 'shop') {
      const wg = el('g', { transform: tf(32, 30, 1, -45) }, g);
      el('rect', { x: -3.5, y: -2, width: 7, height: 22, rx: 3.5, fill: C.steelDark, ...inkLine({ 'stroke-width': 2 }) }, wg);
      el('path', { d: 'M-9 -14 A10 10 0 1 0 9 -14 L5 -14 L5 -6 L-5 -6 L-5 -14 Z', fill: C.steelDark, ...inkLine({ 'stroke-width': 2 }) }, wg);
    }
    const rowY = i => 80 + i * 32;
    const glows = [], nums = [];
    for (let i = 0; i < 5; i++) {
      const y = rowY(i);
      glows.push(el('rect', { x: 10, y: y - 15, width: 40, height: 30, rx: 8, fill: C.accent, opacity: 0 }, g));
      nums.push(text(g, `0${i + 1}`, { x: 30, y: y + 8, size: 22, weight: 700, fill: C.inkSoft, anchor: 'middle' }));
      bar(g, 60, y, 90 + Math.round(hash(i + 3) * 60));
      bar(g, 214, y, 28);
    }
    const noteLines = noteTexts.slice(0, 2).map((s, i) => hand(g, s, { x: 22, y: 254 + i * 32, size: 26 }));
    barcode(g, 18, 300, 224, 26, 3);
    const badge = el('g', {}, g);
    const bw = measure('Pending', 24, 700) + 32;
    el('rect', { x: -bw / 2, y: -20, width: bw, height: 40, rx: 20, fill: C.accent, ...inkLine() }, badge);
    text(badge, 'Pending', { x: 0, y: 8, size: 24, weight: 700, anchor: 'middle' });
    return {
      g, rowPos: i => ({ x: 30, y: rowY(i) }),
      update({ pending = 0, notes = 0, row = null, rowGlow = 0 } = {}) {
        const pp = clamp(pending);
        show(badge, pp > 0);
        set(badge, { transform: tf(196, -14, ease.pop(pp), -6), opacity: seg(pp, 0, 0.3) });
        noteLines.forEach((n, i) => n.update(notes - i));
        for (let i = 0; i < 5; i++) {
          const k = row === i ? clamp(rowGlow) : 0;
          set(glows[i], { opacity: k });
          set(nums[i], { fill: mix(C.inkSoft, C.ink, k), transform: `translate(30 ${rowY(i)}) scale(${(1 + 0.18 * k).toFixed(3)}) translate(-30 ${-rowY(i)})` });
        }
      },
    };
  };

  // =====================================================================================
  /* Kit.PickDocument(parent, {title = 'Pick list', locations}) — STYLE §6.23. 260×340 pick
   * document: five rows of location codes in ascending sequence (default A-01-2, B-02-3,
   * C-03-1, D-01-2, E-02-1, matching WarehouseMap's default stops), a sequence arrow down the
   * left margin, a check circle per row and a barcode band.
   * update({
   *   ticks:  0..5     rows tick off in order (fraction = current row's tick).
   *   active: null | 0..4   row with an accent band (the location being picked).
   *   activeP: 0..1    strength of that band. Default 1.
   * })
   * Helpers: doc.rowY(i).  Origin: top-left.
   */
  Kit.PickDocument = function (parent, opts = {}) {
    const { title = 'Pick list', locations = ['A-01-2', 'B-02-3', 'C-03-1', 'D-01-2', 'E-02-1'] } = opts;
    const g = el('g', {}, parent);
    sheet(g, { title });
    const rowY = i => 88 + i * 40;
    const bands = [], ticks = [];
    locations.slice(0, 5).forEach((loc, i) => {
      const y = rowY(i);
      bands.push(el('rect', { x: 10, y: y - 18, width: 240, height: 36, rx: 8, fill: C.accent, opacity: 0 }, g));
      text(g, loc, { x: 50, y: y + 9, size: 26, weight: 700 });
      ticks.push(checkCircle(g, 224, y, 13));
    });
    el('path', { d: `M28 ${rowY(0) - 8} V${rowY(4) + 6}`, stroke: C.neutral, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('path', { d: `M20 ${rowY(4) + 2} L28 ${rowY(4) + 14} L36 ${rowY(4) + 2} Z`, fill: C.neutral, stroke: C.neutral, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    barcode(g, 18, 300, 224, 26, 7);
    return {
      g, rowY,
      update({ ticks: n = 0, active = null, activeP = 1 } = {}) {
        ticks.forEach((f, i) => f(n - i));
        bands.forEach((b, i) => set(b, { opacity: active === i ? clamp(activeP) : 0 }));
      },
    };
  };

  // =====================================================================================
  /* Kit.RecountReport(parent, {title = 'Recount report', amber = [1, 3]}) — STYLE §6.23. 260×340
   * report: six rows (part, description, system qty, counted qty as decorative bars) with the
   * `amber` row indices marked by accent highlight bands and a "≠" flag at the right edge.
   * update({
   *   highlight: 0..1  amber bands sweep in left to right (staggered) and the ≠ flags pop.
   *   rows: 0..6       rows appear top to bottom, e.g. while printing (fraction = current row
   *                    fading in). Default 6.
   * })
   * Origin: top-left.
   */
  Kit.RecountReport = function (parent, opts = {}) {
    const { title = 'Recount report', amber = [1, 3] } = opts;
    const g = el('g', {}, parent);
    sheet(g, { title, size: measure(title, 24, 800) > 220 ? 22 : 24 });
    const rowY = i => 86 + i * 36;
    const rowsN = [], bands = [], flags = [];
    for (let i = 0; i < 6; i++) {
      const y = rowY(i), isA = amber.includes(i);
      const band = isA ? el('rect', { x: 10, y: y - 15, width: 240, height: 30, rx: 6, fill: C.accent }, g) : null;
      const rg = el('g', {}, g);
      bar(rg, 18, y, 48, 10, C.ink, 0.55);
      bar(rg, 78, y, 60 + Math.round(hash(i + 21) * 40));
      bar(rg, 168, y, 18, 10, C.ink, 0.55);
      bar(rg, 194, y, 18, 10, C.ink, 0.55);
      const flag = isA ? el('g', {}, g) : null;
      if (flag) {
        el('circle', { cx: 0, cy: 0, r: 11, fill: C.paper, ...inkLine({ 'stroke-width': 2 }) }, flag);
        el('path', { d: 'M-5 -3h10M-5 3h10M3 -7 L-3 7', stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, flag);
      }
      rowsN.push(rg); bands.push(band); flags.push(flag);
    }
    el('line', { x1: 16, y1: 300, x2: 244, y2: 300, stroke: C.steel, 'stroke-width': 2 }, g);
    bar(g, 18, 318, 70, 10, C.ink, 0.55);
    bar(g, 176, 318, 46, 10, C.ink, 0.55);
    return {
      g, rowY,
      update({ highlight = 0, rows = 6 } = {}) {
        let k = 0;
        for (let i = 0; i < 6; i++) {
          const rp = clamp(rows - i);
          set(rowsN[i], { opacity: rp });
          if (!bands[i]) continue;
          const hp = ease.enter(seg(highlight, k * 0.25, k * 0.25 + 0.6)) * (rp >= 1 ? 1 : 0);
          set(bands[i], { width: Math.max(0.01, 240 * hp), opacity: hp > 0 ? 1 : 0 });
          show(flags[i], hp > 0.5);
          set(flags[i], { transform: tf(236, rowY(i), ease.pop(seg(hp, 0.5, 1))) });
          k++;
        }
      },
    };
  };

  // =====================================================================================
  /* Kit.CountSheet(parent, {title = 'Count sheet', rows}) — STYLE §6.23. 260×340 count sheet with
   * columns P/N, Desc, Qty (three ruled lines) and a "Notes" box with three note slots.
   * Options: rows = up to 3 rows of [pn, desc, qty] strings; default
   *   [['123-A', 'Bearing', '6'], ['B-07', 'Bolt', '10'], ['', '', '']]. Empty strings stay blank.
   * update({
   *   write: 0..9   fields write on by hand (ink) in reading order, row by row: field k = row*3 + col;
   *                 the fraction is the current field's left-to-right reveal (~0.4 s per field).
   *   notes: 0..3   accent note icons pop into the Notes slots (fraction = current note's pop).
   * })
   * Helpers: sheet.notePos(i) -> {x, y} centre of note slot i (fly notes there, then raise `notes`);
   *   sheet.fieldPos(row, col) -> {x, y} baseline start of a field.
   * Origin: top-left.
   */
  Kit.CountSheet = function (parent, opts = {}) {
    const { title = 'Count sheet', rows = [['123-A', 'Bearing', '6'], ['B-07', 'Bolt', '10'], ['', '', '']] } = opts;
    const g = el('g', {}, parent);
    sheet(g, { title });
    const colX = [22, 106, 204], colW = [68, 80, 36], rowY = i => 132 + i * 38;
    ['P/N', 'Desc', 'Qty'].forEach((s, i) => text(g, s, { x: colX[i] - 4, y: 86, size: 22, weight: 700, fill: C.inkSoft }));
    el('line', { x1: 16, y1: 98, x2: 244, y2: 98, stroke: C.ink, 'stroke-width': 2 }, g);
    for (let i = 0; i < 3; i++) el('line', { x1: 16, y1: rowY(i) + 10, x2: 244, y2: rowY(i) + 10, stroke: C.steel, 'stroke-width': 1.5 }, g);
    el('path', { d: 'M98 68V216M194 68V216', stroke: C.steel, 'stroke-width': 1.5 }, g);
    const fields = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const s = (rows[r] && rows[r][c]) || '';
      const size = s ? Math.max(22, Math.min(24, Math.floor((24 * colW[c]) / (measure(s, 24, 600) + 4)))) : 24;
      fields.push(s ? hand(g, s, { x: colX[c], y: rowY(r), size, fill: C.ink, weight: 600, skew: -10, rot: -1.5 }) : null);
    }
    el('rect', { x: 14, y: 232, width: 232, height: 94, rx: 8, fill: 'none', stroke: C.steel, 'stroke-width': 2 }, g);
    text(g, 'Notes', { x: 26, y: 260, size: 22, weight: 700, fill: C.inkSoft });
    const slot = i => ({ x: 52 + i * 62, y: 296 });
    const noteIcons = [0, 1, 2].map(i => {
      const p = slot(i);
      el('rect', { x: p.x - 20, y: p.y - 20, width: 40, height: 40, rx: 6, fill: 'none', stroke: C.steel, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
      const ng = el('g', {}, g);
      el('path', { d: 'M-19 -19 H11 L19 -11 V19 H-19 Z', fill: C.accent, ...inkLine({ 'stroke-width': 2 }) }, ng);
      el('path', { d: 'M11 -19 V-11 H19', fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, ng);
      el('path', { d: 'M-11 -4 H9 M-11 5 H4', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, ng);
      return { ng, p };
    });
    return {
      g, notePos: slot, fieldPos: (r, c) => ({ x: colX[c], y: rowY(r) }),
      update({ write = 0, notes = 0 } = {}) {
        fields.forEach((f, k) => f && f.update(write - k));
        noteIcons.forEach((n, i) => {
          const p = clamp(notes - i);
          show(n.ng, p > 0);
          set(n.ng, { transform: tf(n.p.x, n.p.y, ease.pop(p), -6 * (1 - p)) });
        });
      },
    };
  };

  // =====================================================================================
  /* Kit.SDS(parent, {}) — STYLE §6.23. 260×340 Safety Data Sheet: two-line title "Safety /
   * Data Sheet", a HazardSign-style diamond (safety yellow, ink border, exclamation glyph) in the
   * top-right corner, and three numbered sections of decorative text bars.
   * update({ pulse: 0..1 })  diamond bump (scale 1 -> 1.12 -> 1 over the 0..1 range); default 0.
   * Origin: top-left.
   */
  Kit.SDS = function (parent) {
    const g = el('g', {}, parent);
    el('rect', { x: 0, y: 0, width: 260, height: 340, rx: 6, fill: C.paper, ...inkLine() }, g);
    text(g, 'Safety', { x: 18, y: 42, size: 26, weight: 800 });
    text(g, 'Data Sheet', { x: 18, y: 72, size: 26, weight: 800 });
    el('line', { x1: 16, y1: 92, x2: 244, y2: 92, stroke: C.steel, 'stroke-width': 2 }, g);
    const dg = el('g', { transform: tf(212, 48) }, g);
    el('rect', { x: -24, y: -24, width: 48, height: 48, rx: 4, transform: 'rotate(45)', fill: C.safety, ...inkLine() }, dg);
    el('rect', { x: -18, y: -18, width: 36, height: 36, rx: 2, transform: 'rotate(45)', fill: 'none', stroke: C.ink, 'stroke-width': 1.5 }, dg);
    el('path', { d: 'M0 -14 V4', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, dg);
    el('circle', { cx: 0, cy: 13, r: 3.2, fill: C.ink }, dg);
    for (let s = 0; s < 3; s++) {
      const y = 118 + s * 74;
      el('rect', { x: 18, y: y - 13, width: 26, height: 26, rx: 5, fill: C.ink }, g);
      text(g, String(s + 1), { x: 31, y: y + 8, size: 22, weight: 700, fill: C.paper, anchor: 'middle' });
      bar(g, 56, y, 90 + Math.round(hash(s + 40) * 50), 12, C.ink, 0.55);
      bar(g, 18, y + 28, 200 + Math.round(hash(s + 44) * 20));
      bar(g, 18, y + 48, 130 + Math.round(hash(s + 48) * 60));
    }
    return {
      g,
      update({ pulse = 0 } = {}) {
        const k = Math.sin(Math.PI * clamp(pulse));
        set(dg, { transform: tf(212, 48, 1 + 0.12 * k) });
      },
    };
  };

  // =====================================================================================
  /* Kit.PolicyBook(parent, {title = 'POLICY'}) — STYLE §6.23. Small hardback book, neutral-blue
   * cover with the title in paper; the cover flips open around the spine to show two pages of
   * decorative text bars.
   * update({ open: 0..1 })  0 closed (170×220), 1 open spread (352×228). Ease it yourself
   *   (e.g. Kit.ease.enter over 0.6 s). The book shifts so it stays centred on the origin.
   * Origin: centre (closed: x −85..85, y −110..110; open: x −176..176, y −114..114).
   */
  Kit.PolicyBook = function (parent, opts = {}) {
    const { title = 'POLICY' } = opts;
    const g = el('g', {}, parent);
    const book = el('g', {}, g);
    const pages = (pg, mirror) => {
      el('rect', { x: 0, y: -114, width: 176, height: 228, rx: 6, fill: C.neutral, ...inkLine() }, pg);
      el('rect', { x: 0, y: -106, width: 168, height: 212, rx: 2, fill: C.paper, ...inkLine({ 'stroke-width': 2 }) }, pg);
      for (let i = 0; i < 7; i++) {
        const w = 90 + Math.round(hash(i + (mirror ? 70 : 60)) * 40);
        bar(pg, mirror ? 168 - 22 - w : 22, -78 + i * 26, w, 9);
      }
    };
    const right = el('g', {}, book);
    pages(right, false);
    const flip = el('g', {}, book);
    const inner = el('g', {}, flip);
    pages(inner, true);
    const cover = el('g', {}, flip);
    el('rect', { x: 0, y: -110, width: 170, height: 220, rx: 8, fill: C.neutral, ...inkLine() }, cover);
    el('rect', { x: 0, y: -110, width: 18, height: 220, rx: 4, fill: C.steelDark, ...inkLine() }, cover);
    const tw = measure(title, 26, 800);
    const ts = tw > 120 ? 120 / tw : 1;
    const tg = el('g', { transform: `translate(94 -18) scale(${ts.toFixed(3)})` }, cover);
    text(tg, title, { x: 0, y: 0, size: 26, weight: 800, fill: C.paper, anchor: 'middle', spacing: 0.08 });
    el('line', { x1: 50, y1: 4, x2: 138, y2: 4, stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round' }, cover);
    el('rect', { x: 66, y: 22, width: 56, height: 40, rx: 4, fill: 'none', stroke: C.paper, 'stroke-width': 2.5 }, cover);
    return {
      g,
      update({ open = 0 } = {}) {
        const o = clamp(open);
        set(book, { transform: `translate(${lerp(-85, 0, o).toFixed(2)} 0)` });
        const c = Math.cos(Math.PI * o);
        set(flip, { transform: `scale(${(Math.abs(c) < 0.02 ? 0.02 * Math.sign(c || 1) : c).toFixed(4)} 1)` });
        show(cover, c >= 0);
        show(inner, c < 0);
        show(right, o > 0);
      },
    };
  };

  // =====================================================================================
  /* Kit.Certificate(parent, {title = 'Certificate', loop = false}) — STYLE §6.23. 300×220 paper
   * certificate: accent inner border, title, two text bars, a signature, and an accent ribbon seal
   * (rosette with two tails) at the bottom-right.
   * Option loop: true adds a neutral "1 year" loop arrow circling the sheet (ellipse centred on the
   *   sheet, reaching ~60 px beyond its sides and 46 px above it, with a "1 year" chip on top).
   * update({
   *   seal:  0..1   ribbon seal pops in. Default 1.
   *   loop:  0..1   loop arrow draws clockwise, arrow head and "1 year" chip pop at the end. Default 0.
   *   check: 0..1   green check badge pops at the top-right corner. Default 0.
   * })
   * Origin: top-left of the sheet.
   */
  Kit.Certificate = function (parent, opts = {}) {
    const { title = 'Certificate', loop: hasLoop = false } = opts;
    const g = el('g', {}, parent);
    el('rect', { x: 0, y: 0, width: 300, height: 220, rx: 6, fill: C.paper, ...inkLine() }, g);
    el('rect', { x: 12, y: 12, width: 276, height: 196, rx: 3, fill: 'none', stroke: C.accent, 'stroke-width': 4 }, g);
    text(g, title, { x: 150, y: 66, size: 30, weight: 800, anchor: 'middle' });
    bar(g, 70, 98, 160);
    bar(g, 96, 120, 108);
    el('line', { x1: 40, y1: 176, x2: 150, y2: 176, stroke: C.inkSoft, 'stroke-width': 2 }, g);
    el('path', { d: 'M46 170 C52 152 60 152 58 166 C57 174 66 160 74 158 C80 157 78 168 86 166 C94 164 100 158 112 160', fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    const seal = el('g', {}, g);
    el('path', { d: 'M-14 14 L-22 48 L-12 42 L-6 52 L0 18 Z', fill: C.accent, ...inkLine({ 'stroke-width': 2 }) }, seal);
    el('path', { d: 'M14 14 L22 48 L12 42 L6 52 L0 18 Z', fill: C.accent, ...inkLine({ 'stroke-width': 2 }) }, seal);
    let star = '';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, r = i % 2 ? 26 : 31;
      star += `${i ? 'L' : 'M'}${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    }
    el('path', { d: star + 'Z', fill: C.accent, ...inkLine({ 'stroke-width': 2 }) }, seal);
    el('circle', { cx: 0, cy: 0, r: 17, fill: 'none', stroke: C.ink, 'stroke-width': 2 }, seal);
    el('path', { d: 'M0 -9 L2.6 -3.2 L8.6 -2.8 L4 1.2 L5.4 7.4 L0 4 L-5.4 7.4 L-4 1.2 L-8.6 -2.8 L-2.6 -3.2 Z', fill: C.ink }, seal);
    // loop arrow around the sheet
    const loopG = el('g', {}, g);
    let loopPath = null, loopHead = null, chip = null, headAt = null;
    if (hasLoop) {
      const cx = 150, cy = 110, rx = 210, ry = 156;
      const a0 = -80, a1 = 230;
      let d = '';
      for (let i = 0; i <= 60; i++) {
        const a = ((a0 + ((a1 - a0) * i) / 60) * Math.PI) / 180;
        d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rx).toFixed(1)} ${(cy + Math.sin(a) * ry).toFixed(1)}`;
      }
      loopPath = drawn(loopG, d, { stroke: C.neutral, 'stroke-width': 6 });
      headAt = sampler(d, 60);
      loopHead = el('path', { d: 'M12 0 L-8 -11 L-4 0 L-8 11 Z', fill: C.neutral, stroke: C.neutral, 'stroke-width': 2, 'stroke-linejoin': 'round' }, loopG);
      chip = el('g', {}, loopG);
      const cw = measure('1 year', 26, 700) + 32;
      el('rect', { x: -cw / 2, y: -22, width: cw, height: 44, rx: 22, fill: C.neutral, ...inkLine() }, chip);
      text(chip, '1 year', { x: 0, y: 9, size: 26, weight: 700, fill: C.paper, anchor: 'middle' });
    }
    const check = el('g', {}, g);
    el('circle', { cx: 0, cy: 0, r: 22, fill: C.correct, ...inkLine() }, check);
    el('path', { d: 'M-9 0 L-2.5 7 L10 -7', fill: 'none', stroke: C.paper, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, check);
    return {
      g,
      update({ seal: sp = 1, loop = 0, check: cp = 0 } = {}) {
        sp = clamp(sp);
        show(seal, sp > 0);
        set(seal, { transform: tf(240, 160, ease.pop(sp), -12 * (1 - sp)) });
        if (hasLoop) {
          const lp = clamp(loop);
          show(loopG, lp > 0);
          drawTo(loopPath, seg(lp, 0, 0.85));
          const q = headAt(seg(lp, 0, 0.85));
          set(loopHead, { transform: tf(q.x, q.y, ease.pop(seg(lp, 0.75, 0.95)), q.angle) });
          set(chip, { transform: tf(150, -46, ease.pop(seg(lp, 0.8, 1))) });
        }
        const c = clamp(cp);
        show(check, c > 0);
        set(check, { transform: tf(292, 8, ease.pop(c)) });
      },
    };
  };

  // =====================================================================================
  /* Kit.PickTag(parent, {values}) — STYLE §6.24. 700×440 generic white ticket (no vendor name or
   * logo): grey "Order Ticket" header with a string hole, a 2×3 field grid
   *   row 1: LOCATION | PART NUMBER | PICK QTY      row 2: DESCRIPTION (two cells wide) | ITEM
   * with sample values B-02-3, 123-A, 6, BEARING, 04, and a decorative barcode band.
   * Option values: {location, part, qty, desc, item} to override the sample values.
   * update({
   *   dim: 0..1        fade every field that is not highlighted to 35% (the "all dimmed" look).
   *   highlight: null | 'location' | 'part' | 'qty' | 'desc' | 'item'   that field fully lit, or
   *                    an object {location: 0..1, …} for per-field amounts (tween to sweep in).
   *   Highlighting fills an accent band behind the value (sweeps in left to right), outlines the
   *   cell in 3 px ink and lifts it out of `dim`.
   * })
   * Helpers: tag.field(key) -> {x, y, w, h, cx, cy} cell rect (for Callouts and dotted lines);
   *   tag.value(key) -> {x, y} left baseline of the value text.
   * Origin: top-left.
   */
  Kit.PickTag = function (parent, opts = {}) {
    const values = { location: 'B-02-3', part: '123-A', qty: '6', desc: 'BEARING', item: '04', ...(opts.values || {}) };
    const g = el('g', {}, parent);
    el('rect', { x: 0, y: 0, width: 700, height: 440, rx: 12, fill: C.paper, ...inkLine() }, g);
    el('path', { d: 'M1.25 64 V13 A11.75 11.75 0 0 1 13 1.25 H687 A11.75 11.75 0 0 1 698.75 13 V64 Z', fill: C.floor }, g);
    el('line', { x1: 0, y1: 64, x2: 700, y2: 64, stroke: C.ink, 'stroke-width': STROKE }, g);
    el('rect', { x: 0, y: 0, width: 700, height: 440, rx: 12, fill: 'none', ...inkLine() }, g);
    text(g, 'Order Ticket', { x: 28, y: 43, size: 30, weight: 700, fill: C.inkSoft });
    el('circle', { cx: 666, cy: 32, r: 11, fill: C.paper, stroke: C.inkSoft, 'stroke-width': 2.5 }, g);
    const cw = (700 - 48 - 32) / 3;
    const cell = (c, r, span = 1) => ({ x: 24 + c * (cw + 16), y: 82 + r * 132, w: cw * span + 16 * (span - 1), h: 116 });
    const defs = [
      ['location', 'LOCATION', cell(0, 0)], ['part', 'PART NUMBER', cell(1, 0)], ['qty', 'PICK QTY', cell(2, 0)],
      ['desc', 'DESCRIPTION', cell(0, 1, 2)], ['item', 'ITEM', cell(2, 1)],
    ];
    const fields = {};
    for (const [key, label, b] of defs) {
      const fg = el('g', {}, g);
      const box = el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: C.paper, stroke: C.steel, 'stroke-width': 2 }, fg);
      const band = el('rect', { x: b.x + 10, y: b.y + 46, width: 0, height: 60, rx: 8, fill: C.accent }, fg);
      text(fg, label, { x: b.x + 18, y: b.y + 34, size: 22, weight: 700, fill: C.inkSoft, spacing: 0.06 });
      const vs = Math.min(50, (50 * (b.w - 40)) / measure(values[key], 50, 800));
      text(fg, values[key], { x: b.x + 18, y: b.y + 96, size: Math.round(vs), weight: 800 });
      fields[key] = { fg, box, band, b };
    }
    el('line', { x1: 24, y1: 356, x2: 676, y2: 356, stroke: C.steel, 'stroke-width': 2, 'stroke-dasharray': '8 6' }, g);
    barcode(g, 24, 372, 430, 48, 11);
    bar(g, 486, 386, 150, 12, C.ink, 0.5);
    bar(g, 486, 408, 104, 12, C.steel, 0.5);
    return {
      g,
      field: k => { const b = fields[k].b; return { x: b.x, y: b.y, w: b.w, h: b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; },
      value: k => ({ x: fields[k].b.x + 18, y: fields[k].b.y + 96 }),
      update({ dim = 0, highlight = null } = {}) {
        for (const [k, f] of Object.entries(fields)) {
          const h = clamp(typeof highlight === 'string' ? (highlight === k ? 1 : 0) : highlight && highlight[k] != null ? highlight[k] : 0);
          set(f.fg, { opacity: 1 - 0.65 * clamp(dim) * (1 - h) });
          set(f.band, { width: (f.b.w - 20) * ease.enter(h), opacity: h > 0 ? 1 : 0 });
          set(f.box, { stroke: h > 0.05 ? C.ink : C.steel, 'stroke-width': h > 0.05 ? 3 : 2 });
        }
      },
    };
  };

  // =====================================================================================
  /* Kit.Terminal(parent, {rows}) — STYLE §6.25. 360×300 desk terminal: monitor (dark screen) on a
   * neck, a base unit with a printer slot on its right end, keyboard and mouse in front.
   * Option rows: on-hands table rows [[part, qty]…] (3), default [['123-A', 12], ['B-07', 4], ['C-33', 9]].
   * update({
   *   screen: 'off' | 'onhands' | 'covered' | 'report' | 'print'   (default 'onhands')
   *     onhands: table "Part / On hand" with 3 rows.
   *     covered: same table with a grey panel and eye-slash icon over the On-hand column.
   *     report:  "Count report" list of 4 rows, two flagged in accent.
   *     print:   printer glyph, "Printing", accent progress bar driven by `print`.
   *   row: 0..2          active row whose quantity shows `value` (default 0).
   *   value: number|string   quantity shown in the active row (default its option value); round it
   *                      yourself when ticking (12 → 17).
   *   flash: 0..1        green flash behind the active quantity (fade it out over ~0.5 s).
   *   cover: 0..1        grey panel slides down over the On-hand column (default 1 for 'covered',
   *                      0 otherwise); tween to 0 to lift it.
   *   typed: 0..1        reveals the active value's characters left to right with a caret (the
   *                      "types into the system" moment). Default 1.
   *   print: 0..1        paper rises out of the printer slot (130 px at 1); also drives the
   *                      progress bar on the 'print' screen.
   *   paper: 'slip' | 'report'   what the rising paper shows (report = two accent rows).
   *   t: seconds         optional; blinks the caret while 0 < typed < 1.
   * })
   * Helpers: term.paperTop(print) -> {x, y} top-left of the rising paper (52 px wide) for a hand-off
   *   to a full-size document; term.screenRect -> {x, y, w, h}.
   * Origin: top-left (monitor top edge at y 0, keyboard bottom at y 300).
   */
  Kit.Terminal = function (parent, opts = {}) {
    const rows = opts.rows || [['123-A', 12], ['B-07', 4], ['C-33', 9]];
    const g = el('g', {}, parent);
    const SX = 22, SY = 12, SW = 246, SH = 162, SLOT = 209;
    // paper (behind the base, clipped to above the slot)
    const pcid = uniq('slot');
    el('rect', { x: 280, y: -400, width: 80, height: SLOT + 400 }, el('clipPath', { id: pcid }, el('defs', {}, g)));
    const paperClip = el('g', { 'clip-path': `url(#${pcid})` }, g);
    const paper = el('g', {}, paperClip);
    el('rect', { x: 0, y: 0, width: 52, height: 140, rx: 3, fill: C.paper, ...inkLine({ 'stroke-width': 2 }) }, paper);
    bar(paper, 8, 14, 30, 6, C.ink, 0.6);
    const paperRows = el('g', {}, paper), paperAmber = el('g', {}, paper);
    for (let i = 0; i < 5; i++) {
      bar(paperRows, 8, 32 + i * 18, 22 + Math.round(hash(i + 80) * 14), 6);
      if (i === 1 || i === 3) el('rect', { x: 4, y: 25 + i * 18, width: 44, height: 14, rx: 3, fill: C.accent }, paperAmber);
      bar(paperAmber, 8, 32 + i * 18, 24 + Math.round(hash(i + 90) * 12), 6, C.ink, 0.45);
    }
    barcode(paper, 8, 118, 36, 12, 5);
    // monitor
    el('rect', { x: 128, y: 184, width: 34, height: 28, fill: C.steel, ...inkLine() }, g);
    el('rect', { x: 10, y: 0, width: 270, height: 186, rx: 12, fill: C.steelDark, ...inkLine() }, g);
    el('rect', { x: SX, y: SY, width: SW, height: SH, rx: 5, fill: C.bgDark }, g);
    const led = el('circle', { cx: 145, cy: 180, r: 3, fill: C.correct }, g);
    // base unit with printer slot, keyboard, mouse
    el('rect', { x: 0, y: 208, width: 360, height: 42, rx: 8, fill: C.steel, ...inkLine() }, g);
    el('rect', { x: 284, y: SLOT - 4, width: 68, height: 9, rx: 4.5, fill: C.ink }, g);
    el('rect', { x: 14, y: 222, width: 36, height: 8, rx: 4, fill: C.steelDark }, g);
    el('circle', { cx: 266, cy: 229, r: 4, fill: C.correct }, g);
    el('path', { d: 'M44 260 H296 L312 298 H28 Z', fill: C.paper, ...inkLine() }, g);
    let keys = '';
    for (let r = 0; r < 3; r++) {
      const y = 265 + r * 10.5, slant = (y + 3.5 - 260) * (16 / 38);
      const x0 = 44 - slant + 9, kw = (252 + 2 * slant - 18) / 13;
      for (let k = 0; k < 13; k++) keys += rectD((x0 + k * kw + 1.5).toFixed(1), y.toFixed(1), (kw - 3).toFixed(1), 7);
    }
    el('path', { d: keys, fill: C.floor }, g);
    el('rect', { x: 326, y: 266, width: 24, height: 32, rx: 12, fill: C.paper, ...inkLine() }, g);
    el('line', { x1: 338, y1: 268, x2: 338, y2: 278, stroke: C.ink, 'stroke-width': 2 }, g);
    // screens (clipped to the screen)
    const scid = uniq('scr');
    el('rect', { x: SX, y: SY, width: SW, height: SH, rx: 5 }, el('clipPath', { id: scid }, el('defs', {}, g)));
    const scr = el('g', { 'clip-path': `url(#${scid})` }, g);
    // off: reflection
    const offG = el('g', {}, scr);
    el('path', { d: `M${SX + 150} ${SY} L${SX + 60} ${SY + SH} M${SX + 190} ${SY} L${SX + 100} ${SY + SH}`, stroke: C.onDarkSoft, 'stroke-width': 10, opacity: 0.12 }, offG);
    // onhands table
    const tblG = el('g', {}, scr);
    text(tblG, 'Part', { x: SX + 14, y: SY + 30, size: 22, weight: 700, fill: C.onDarkSoft });
    text(tblG, 'On hand', { x: SX + SW - 14, y: SY + 30, size: 22, weight: 700, fill: C.onDarkSoft, anchor: 'end' });
    el('line', { x1: SX + 12, y1: SY + 42, x2: SX + SW - 12, y2: SY + 42, stroke: C.onDarkSoft, 'stroke-width': 1.5, opacity: 0.6 }, tblG);
    const rowY = i => SY + 76 + i * 36;
    const flashR = el('rect', { x: SX + SW - 82, y: 0, width: 72, height: 32, rx: 6, fill: C.correct, opacity: 0 }, tblG);
    const qtyT = rows.map((r, i) => {
      text(tblG, r[0], { x: SX + 14, y: rowY(i), size: 24, weight: 600, fill: C.paper });
      return text(tblG, String(r[1]), { x: SX + SW - 16, y: rowY(i), size: 26, weight: 700, fill: C.paper, anchor: 'end' });
    });
    const caret = el('rect', { x: 0, y: 0, width: 3, height: 26, fill: C.accent }, tblG);
    const coverG = el('g', {}, tblG);
    el('rect', { x: SX + SW - 92, y: SY + 46, width: 90, height: SH - 50, rx: 6, fill: C.steel, ...inkLine({ 'stroke-width': 2 }) }, coverG);
    const eye = el('g', { transform: tf(SX + SW - 47, SY + 46 + (SH - 50) / 2) }, coverG);
    el('path', { d: 'M-22 0 C-12 -14 12 -14 22 0 C12 14 -12 14 -22 0 Z', fill: 'none', stroke: C.paper, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, eye);
    el('circle', { cx: 0, cy: 0, r: 6, fill: C.paper }, eye);
    el('line', { x1: -18, y1: 16, x2: 18, y2: -16, stroke: C.steel, 'stroke-width': 8, 'stroke-linecap': 'round' }, eye);
    el('line', { x1: -18, y1: 16, x2: 18, y2: -16, stroke: C.paper, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, eye);
    // report list
    const repG = el('g', {}, scr);
    text(repG, 'Count report', { x: SX + 14, y: SY + 30, size: 22, weight: 700, fill: C.onDarkSoft });
    el('line', { x1: SX + 12, y1: SY + 42, x2: SX + SW - 12, y2: SY + 42, stroke: C.onDarkSoft, 'stroke-width': 1.5, opacity: 0.6 }, repG);
    for (let i = 0; i < 4; i++) {
      const y = SY + 64 + i * 26, flag = i === 1 || i === 2;
      if (flag) el('rect', { x: SX + 8, y: y - 11, width: SW - 16, height: 22, rx: 5, fill: C.accent, opacity: 0.9 }, repG);
      el('rect', { x: SX + 16, y: y - 4, width: 8, height: 8, rx: 2, fill: flag ? C.ink : C.paper }, repG);
      bar(repG, SX + 34, y, 70 + Math.round(hash(i + 60) * 60), 8, flag ? C.ink : C.paper, flag ? 0.7 : 0.7);
      bar(repG, SX + SW - 54, y, 34, 8, flag ? C.ink : C.paper, 0.7);
    }
    // printing
    const prG = el('g', {}, scr);
    const pg = el('g', { transform: tf(SX + SW / 2, SY + 58) }, prG);
    el('rect', { x: -14, y: -30, width: 28, height: 18, fill: 'none', stroke: C.paper, 'stroke-width': 3 }, pg);
    el('rect', { x: -26, y: -14, width: 52, height: 26, rx: 5, fill: 'none', stroke: C.paper, 'stroke-width': 3 }, pg);
    el('rect', { x: -14, y: 4, width: 28, height: 20, fill: C.bgDark, stroke: C.paper, 'stroke-width': 3 }, pg);
    text(prG, 'Printing', { x: SX + SW / 2, y: SY + 120, size: 22, weight: 600, fill: C.paper, anchor: 'middle' });
    el('rect', { x: SX + 40, y: SY + 134, width: SW - 80, height: 10, rx: 5, fill: 'none', stroke: C.onDarkSoft, 'stroke-width': 1.5 }, prG);
    const prBar = el('rect', { x: SX + 40, y: SY + 134, width: 0, height: 10, rx: 5, fill: C.accent }, prG);
    return {
      g, screenRect: { x: SX, y: SY, w: SW, h: SH },
      paperTop: p => ({ x: 296, y: SLOT - 130 * clamp(p) }),
      update({ screen = 'onhands', row = 0, value, flash = 0, cover, typed = 1, print = 0, paper: kind = 'slip', t = 0 } = {}) {
        const on = screen !== 'off';
        show(offG, !on);
        set(led, { fill: on ? C.correct : C.steel });
        const table = screen === 'onhands' || screen === 'covered';
        show(tblG, table);
        show(repG, screen === 'report');
        show(prG, screen === 'print');
        if (table) {
          const v = String(value != null ? value : rows[row][1]);
          const shown = v.slice(0, Math.round(clamp(typed) * v.length));
          qtyT.forEach((n, i) => set(n, { text: i === row ? shown : String(rows[i][1]) }));
          const ry = rowY(row);
          set(flashR, { y: ry - 24, opacity: clamp(flash) });
          const typing = typed < 1;
          show(caret, typing && Math.floor(t * 2.5) % 2 === 0);
          set(caret, { x: SX + SW - 12, y: ry - 22 });
          const cv = cover != null ? clamp(cover) : screen === 'covered' ? 1 : 0;
          show(coverG, cv > 0);
          set(coverG, { transform: `translate(0 ${(-(SH + 4) * (1 - ease.enter(cv))).toFixed(2)})` });
        }
        set(prBar, { width: Math.max(0.01, (SW - 80) * clamp(print)) });
        const pp = clamp(print);
        show(paper, pp > 0);
        set(paper, { transform: tf(296, SLOT - 130 * pp) });
        show(paperRows, kind !== 'report');
        show(paperAmber, kind === 'report');
      },
    };
  };

  // =====================================================================================
  /* Kit.FolderDrawer(parent, {}) — STYLE §6.26. 320×240 two-drawer filing cabinet (steel). The
   * top drawer pulls forward to reveal two hanging folders tabbed "In" and "Out"; documents drop
   * into them; a "Daily" badge sits on the cabinet's top-right corner.
   * update({
   *   open:   0..1   top drawer pulls out (front drops 58 px and grows 6%), folder tabs show.
   *   docIn:  0..1   a document ("In") falls from above the frame into the In folder.
   *   docOut: 0..1   same for the "Out" folder. Documents only read as filed while the drawer is
   *                  open; close it after both land (they stay inside).
   *   badge:  0..1   "Daily" badge pops (ink pill, paper text). Default 0.
   * })
   * Helpers: drawer.slot('in' | 'out') -> {x, y} top-centre of a filed document (drawer open).
 * Filed documents show a 10 px strip of paper above the folder's front flap.
   * Origin: top-left; cabinet body spans y 70–240, documents start ~150 px above it.
   */
  Kit.FolderDrawer = function (parent) {
    const g = el('g', {}, parent);
    el('rect', { x: 10, y: 70, width: 300, height: 170, rx: 8, fill: C.steelDark, ...inkLine() }, g);
    // bottom drawer
    el('rect', { x: 26, y: 160, width: 268, height: 68, rx: 5, fill: C.steel, ...inkLine() }, g);
    el('rect', { x: 130, y: 186, width: 60, height: 12, rx: 6, fill: C.ink }, g);
    // drawer interior, then hanging folders: back (with tab) / documents / front flap
    const interior = el('rect', { x: 26, y: 82, width: 268, height: 0, fill: C.ink }, g);
    // contents are clipped at the drawer front's bottom edge, so nothing shows below a closed drawer
    const icid = uniq('drawer');
    const insideClip = el('rect', { x: 0, y: -400, width: 320, height: 550 }, el('clipPath', { id: icid }, el('defs', {}, g)));
    const inside = el('g', {}, el('g', { 'clip-path': `url(#${icid})` }, g));
    const backs = el('g', {}, inside), docsG = el('g', {}, inside), fronts = el('g', {}, inside);
    const folders = [['In', 36, 56], ['Out', 168, 64]].map(([label, x, tw]) => {
      el('path', { d: `M${x} 200 V100 Q${x} 94 ${x + 6} 94 H${x + tw - 6} Q${x + tw} 94 ${x + tw} 100 V112 H${x + 116} V200 Z`, fill: C.carton, ...inkLine({ 'stroke-width': 2 }) }, backs);
      text(backs, label, { x: x + tw / 2, y: 114, size: 22, weight: 700, anchor: 'middle' });
      el('rect', { x, y: 128, width: 116, height: 72, fill: C.carton, ...inkLine({ 'stroke-width': 2 }) }, fronts);
      return x + tw + (116 - tw) / 2;
    });
    const docs = folders.map((cx, i) => {
      const dg = el('g', {}, docsG);
      el('rect', { x: -25, y: 0, width: 50, height: 76, rx: 3, fill: C.paper, ...inkLine({ 'stroke-width': 2 }) }, dg);
      bar(dg, -16, 8, 32, 5); bar(dg, -16, 18, 24, 5);
      text(dg, i ? 'Out' : 'In', { x: 0, y: 60, size: 22, weight: 700, anchor: 'middle' });
      return { dg, cx };
    });
    // top drawer front (in front of folders and documents)
    const front = el('g', {}, g);
    el('rect', { x: 26, y: 82, width: 268, height: 68, rx: 5, fill: C.steel, ...inkLine() }, front);
    el('rect', { x: 130, y: 108, width: 60, height: 12, rx: 6, fill: C.ink }, front);
    el('rect', { x: 134, y: 90, width: 52, height: 12, rx: 2, fill: C.paper, stroke: C.ink, 'stroke-width': 1.5 }, front);
    const badge = el('g', {}, g);
    const bw = measure('Daily', 24, 700) + 32;
    el('rect', { x: -bw / 2, y: -20, width: bw, height: 40, rx: 20, fill: C.ink }, badge);
    text(badge, 'Daily', { x: 0, y: 8, size: 24, weight: 700, fill: C.paper, anchor: 'middle' });
    const landY = 118;
    return {
      g,
      slot: k => ({ x: docs[k === 'out' ? 1 : 0].cx, y: landY - 10 }),
      update({ open = 0, docIn = 0, docOut = 0, badge: bp = 0 } = {}) {
        const o = ease.enter(clamp(open)), dy = 58 * o, s = 1 + 0.06 * o;
        set(front, { transform: `translate(160 ${(116 + dy).toFixed(2)}) scale(${s.toFixed(4)}) translate(-160 -116)` });
        set(interior, { height: Math.max(0, dy - 2) });
        set(insideClip, { height: 400 + 116 + 34 * s + dy });
        show(backs, o > 0.02);
        show(fronts, o > 0.02);
        set(inside, { transform: `translate(0 ${(-10 * o).toFixed(2)})` });
        [docIn, docOut].forEach((p, i) => {
          p = clamp(p);
          const d = docs[i];
          show(d.dg, p > 0);
          const y = lerp(-160, landY, ease.exit(p));
          set(d.dg, { transform: tf(d.cx, y, 1, (1 - p) * (i ? 8 : -8)), opacity: seg(p, 0, 0.15) });
        });
        const b = clamp(bp);
        show(badge, b > 0);
        set(badge, { transform: tf(262, 70, ease.pop(b)) });
      },
    };
  };

  // =====================================================================================
  /* Kit.Camera(parent, {}) — STYLE §6.27. 80×60 camera icon (steel-dark body, paper lens ring,
   * flash window, accent shutter button) with a white starburst flash.
   * update({ flash: 0..1 })  flash burst opacity. For the STYLE two-frame flash use
   *   flash: Kit.Camera.flashAt(t, t0)   (1 for two frames from t0, else 0).
   * Origin: centre of the 80×60 body (the burst reaches ~34 px around the flash window, top-left).
   */
  Kit.Camera = function (parent) {
    const g = el('g', {}, parent);
    el('path', { d: 'M-16 -20 L-10 -30 H12 L18 -20 Z', fill: C.steelDark, ...inkLine() }, g);
    el('rect', { x: 22, y: -27, width: 12, height: 7, rx: 2, fill: C.accent, ...inkLine({ 'stroke-width': 2 }) }, g);
    el('rect', { x: -40, y: -20, width: 80, height: 50, rx: 8, fill: C.steelDark, ...inkLine() }, g);
    el('rect', { x: -34, y: -14, width: 13, height: 8, rx: 2, fill: C.paper, ...inkLine({ 'stroke-width': 2 }) }, g);
    el('circle', { cx: 2, cy: 5, r: 18, fill: C.paper, ...inkLine() }, g);
    el('circle', { cx: 2, cy: 5, r: 11, fill: C.ink }, g);
    el('circle', { cx: -2, cy: 1, r: 3.5, fill: C.paper }, g);
    const burst = el('g', { transform: tf(-30, -14) }, g);
    let d = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 14 : 34;
      d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
    }
    el('path', { d: d + 'Z', fill: C.paper, stroke: C.accent, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, burst);
    el('circle', { cx: 0, cy: 0, r: 11, fill: C.paper }, burst);
    return {
      g,
      update({ flash = 0 } = {}) { const f = clamp(flash); show(burst, f > 0); set(burst, { opacity: f }); },
    };
  };
  Kit.Camera.flashAt = (t, t0) => (t >= t0 && t < t0 + 2 / 30 ? 1 : 0);

  // =====================================================================================
  /* Kit.Plane(parent, {carrier = 'UPS', dir = 1}) — STYLE §6.27. 120×60 generic plane outline
   * (paper fuselage, steel wing and tail, no markings) towing a plain-text carrier tag (paper
   * chip, ink text, e.g. 'UPS', 'FEDEX') on a short line behind it. dir 1 flies right, -1 left
   * (the tag text never mirrors). Move it across the frame with Engine.place.
   * update({
   *   t: seconds   idle life: ±2 px bob, slight pitch, tag sways on its line.
   *   tag: 0..1    tag visibility (fades and swings in). Default 1.
   * })
   * Origin: centre of the plane body; the tag trails 70 px + its width behind the tail.
   */
  Kit.Plane = function (parent, opts = {}) {
    const { carrier = 'UPS', dir = 1 } = opts;
    const g = el('g', {}, parent);
    const tagG = el('g', {}, g);
    const tw = measure(carrier, 24, 700) + 28;
    const line = el('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: C.ink, 'stroke-width': 2 }, tagG);
    const chip = el('g', {}, tagG);
    el('rect', { x: -tw / 2, y: -20, width: tw, height: 40, rx: 6, fill: C.paper, ...inkLine() }, chip);
    text(chip, carrier, { x: 0, y: 8, size: 24, weight: 700, anchor: 'middle' });
    const body = el('g', {}, g);
    const flip = el('g', { transform: `scale(${dir < 0 ? -1 : 1} 1)` }, body);
    el('path', { d: 'M-8 -2 L-30 -24 L-18 -24 L14 -2 Z', fill: C.steel, ...inkLine() }, flip);
    el('path', { d: 'M-48 -4 L-58 -28 L-46 -28 L-30 -4 Z', fill: C.steel, ...inkLine() }, flip);
    el('path', { d: 'M-56 -4 L40 -6 C52 -6 60 0 60 4 C60 9 54 12 44 12 L-46 12 C-54 12 -58 6 -56 -4 Z', fill: C.paper, ...inkLine() }, flip);
    el('path', { d: 'M44 -4 C50 -4 55 0 56 3 L44 3 Z', fill: C.steelDark }, flip);
    for (let i = 0; i < 5; i++) el('circle', { cx: -28 + i * 13, cy: 2, r: 2.6, fill: C.inkSoft }, flip);
    el('path', { d: 'M-4 6 L-22 30 L-10 30 L18 6 Z', fill: C.steel, ...inkLine() }, flip);
    return {
      g,
      update({ t = 0, tag = 1 } = {}) {
        const bob = Math.sin(t * 2.2) * 2, pitch = Math.sin(t * 1.3) * 1.5 * dir;
        set(body, { transform: tf(0, bob, 1, pitch) });
        const tp = clamp(tag);
        show(tagG, tp > 0);
        const tailX = -58 * dir, cx = tailX - dir * (70 + tw / 2);
        const sway = Math.sin(t * 3.1 + 0.6) * 4 + (1 - tp) * 18;
        set(line, { x1: tailX, y1: bob - 2, x2: cx + dir * tw / 2, y2: bob + sway * 0.5 });
        set(chip, { transform: tf(cx, bob + sway, 1, Math.sin(t * 3.1) * 3 * dir), opacity: tp });
        set(line, { opacity: tp });
      },
    };
  };

  // =====================================================================================
  /* Kit.Magnifier(parent, {label}) — STYLE §6.27. 70 px magnifying glass (steel rim, paper glass,
   * steel-dark handle to the lower right), used for inspection and as a "Research" badge.
   * Option label: e.g. 'Research' adds a neutral pill with paper text to the right of the icon.
   * update({
   *   glint: 0..1   a light glint sweeps across the glass (loop it for idle life). Default 0.
   *   tilt: degrees rotate the icon about its centre (for a scanning wobble). Default 0.
   *   badge: 0..1   label pill pops in (only with a label). Default 1.
   * })
   * Origin: centre of the 70 px icon (lens centre is at −10, −10).
   */
  Kit.Magnifier = function (parent, opts = {}) {
    const { label = null } = opts;
    const g = el('g', {}, parent);
    const icon = el('g', {}, g);
    el('path', { d: 'M8 8 L28 28', stroke: C.ink, 'stroke-width': 14, 'stroke-linecap': 'round' }, icon);
    el('path', { d: 'M8 8 L28 28', stroke: C.steelDark, 'stroke-width': 9, 'stroke-linecap': 'round' }, icon);
    el('circle', { cx: -10, cy: -10, r: 25, fill: C.steel, ...inkLine() }, icon);
    el('circle', { cx: -10, cy: -10, r: 18, fill: C.paper, ...inkLine() }, icon);
    const gcid = uniq('lens');
    el('circle', { cx: -10, cy: -10, r: 16.5 }, el('clipPath', { id: gcid }, el('defs', {}, icon)));
    const glintG = el('g', { 'clip-path': `url(#${gcid})` }, icon);
    const glint = el('path', { d: 'M-6 -24 L4 -24 L-14 4 L-24 4 Z', fill: C.neutral, opacity: 0.35 }, glintG);
    let pill = null;
    if (label) {
      const w = measure(label, 24, 600) + 32;
      pill = el('g', {}, g);
      el('rect', { x: 0, y: -20, width: w, height: 40, rx: 20, fill: C.neutral, ...inkLine() }, pill);
      text(pill, label, { x: w / 2, y: 8, size: 24, weight: 600, fill: C.paper, anchor: 'middle' });
    }
    return {
      g,
      update({ glint: gp = 0, tilt = 0, badge = 1 } = {}) {
        set(icon, { transform: tilt ? `rotate(${tilt.toFixed(2)})` : '' });
        set(glint, { transform: `translate(${lerp(-26, 40, clamp(gp)).toFixed(2)} 0)` });
        if (pill) {
          const b = clamp(badge);
          show(pill, b > 0);
          set(pill, { transform: tf(44, 0, 0.6 + 0.4 * ease.pop(b)), opacity: seg(b, 0, 0.4) });
        }
      },
    };
  };
})();
