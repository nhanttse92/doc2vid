// Scene s07: Housekeeping and Equipment (Part V: Maintenance).
// b01 title card + four benefit tiles; b02-b03 daily housekeeping checklist with a right-hand stage;
// b04 untidy-conditions checklist; b05 three-panel strip (pallets, overflow, clearances);
// b06 forklift benefits and speed do/don't; b07 daily inspection and tag-out; b08 vehicle care.
// Every time comes from ctx.beat / ctx.cue; render(t) is a pure function of t.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C } = Kit;
  const INF = Infinity;
  const D = Math.PI / 180;
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const ent = (t, t0, d) => Kit.ease.enter(lin(t, t0, d));
  const inout = (t, t0, d) => Engine.ease.inOut(lin(t, t0, d));
  const r2 = v => Math.round(v * 100) / 100;
  const INK = (w = 2.5) => ({ stroke: C.ink, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const hash = i => { const x = Math.sin(i * 127.1 + 74.7) * 43758.5453; return x - Math.floor(x); };
  const SPARKLE = 'M0 -13 L3.2 -3.2 L13 0 L3.2 3.2 L0 13 L-3.2 3.2 L-13 0 L-3.2 -3.2 Z';
  // Blend two #rrggbb colours.
  const mix = (a, b, p) => {
    const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join('');
  };
  // Standard enter (fade + rise) / exit (fade + 16 px up) of a placed group; returns opacity.
  function show(node, t, tIn, tOut, { x = 0, y = 0, s = 1, r = 0, rise = 24, fall = 16, dx = 0 } = {}) {
    const pin = Kit.ease.enter(clamp((t - tIn) / 0.4));
    const pout = Kit.ease.exit(clamp((t - ((tOut == null ? INF : tOut) - 0.3)) / 0.3));
    const o = pin * (1 - pout);
    // dx: enter sideways from dx px instead of rising
    const ox = dx * (1 - pin), oy = dx ? -pout * fall : (1 - pin) * rise - pout * fall;
    place(node, { x: x + ox, y: y + oy, s, r, o });
    Kit.show(node, o > 0.001);
    return o;
  }
  const vis = (node, o) => { set(node, { opacity: r2(clamp(o)) }); Kit.show(node, o > 0.001); };
  // Piecewise-linear track [[t, v], ...] (linear between keys); returns value.
  const track = (t, keys) => Engine.keys(t, keys, Kit.ease.linear);
  // 1 while t is inside [a, b] with short ramps (for the Worker's walking blend).
  const during = (t, a, b, ramp = 0.12) => Math.min(lin(t, a - 0.001, ramp), 1 - lin(t, b - ramp, ramp));
  // Arc between two points with a lift (for things flying into bins).
  const arc = (p0, p1, k, lift) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - lift * 4 * k * (1 - k)];

  // ------------------------------------------------------------------ local assets (STYLE §6)
  // Shelving cabinet with dust puffs; a feather duster swipes across it. Origin bottom-centre.
  // update({dusted 0..1 swipe progress, duster 0..1 visibility, t})
  function Cabinet(parent) {
    const g = el('g', {}, parent);
    Kit.shadow(g, 190);
    el('rect', { x: -86, y: -264, width: 172, height: 264, rx: 4, fill: C.steel, ...INK() }, g);
    el('rect', { x: -72, y: -250, width: 144, height: 236, fill: C.steelDark, ...INK(2) }, g);
    const box = (x, base, w, h, fill = C.carton) => {
      el('rect', { x, y: base - h, width: w, height: h, fill, ...INK(2) }, g);
      if (fill === C.carton) el('path', { d: `M${x + w / 2 - 5} ${base - h}v14h10v-14`, fill: '#DDB27C', stroke: 'none' }, g);
    };
    [-14, -92, -170].forEach(y => el('rect', { x: -74, y, width: 148, height: 8, fill: C.steel, ...INK(2) }, g));
    box(-64, -14, 54, 46); box(-4, -14, 62, 38);
    [[-64, C.neutral], [-48, C.accent], [-32, C.paper], [-16, C.neutral]].forEach(([x, f]) => el('rect', { x, y: -150, width: 15, height: 58, rx: 2, fill: f, ...INK(2) }, g));
    box(10, -92, 52, 42);
    box(-62, -170, 44, 36); box(-8, -170, 66, 52, C.steel);
    box(-60, -250, 50, 0.01, C.steelDark);
    // dust: grey puff clusters on top and on each shelf
    const puffs = [[-56, -266, 0.05], [-6, -266, 0.15], [50, -266, 0.27], [40, -176, 0.42], [-40, -176, 0.55], [-20, -98, 0.72], [56, -98, 0.86], [36, -20, 0.95]]
      .map(([x, y, u], i) => {
        const pg = el('g', {}, g);
        [[-12, 0, 9], [0, -6, 12], [13, 0, 8]].forEach(([dx, dy, r]) => el('circle', { cx: dx, cy: dy, r, fill: C.inkSoft, opacity: 0.6 }, pg));
        return { pg, x, y, u, i };
      });
    // feather duster: accent feather head at the origin, wooden handle down-right
    const duster = el('g', {}, g);
    el('path', { d: 'M10 10L46 58', stroke: C.ink, 'stroke-width': 11, 'stroke-linecap': 'round' }, duster);
    el('path', { d: 'M10 10L46 58', stroke: C.cartonEdge, 'stroke-width': 6, 'stroke-linecap': 'round' }, duster);
    [[-12, -6, -30], [4, -12, 10], [14, 2, 50], [-6, 8, -70], [0, -2, 0]].forEach(([x, y, a]) =>
      el('ellipse', { cx: 0, cy: 0, rx: 17, ry: 9, transform: `translate(${x} ${y}) rotate(${a})`, fill: C.accent, ...INK(2) }, duster));
    const path = [[-84, -280], [84, -280], [76, -190], [-70, -190], [-70, -112], [76, -112], [70, -36]];
    return {
      g,
      update({ dusted = 0, duster: dv = 0, t = 0 } = {}) {
        puffs.forEach(p => {
          const k = lin(dusted * 1.12, p.u - 0.02, 0.12);
          const drift = Math.sin(t * 1.3 + p.i) * 1.2;
          set(p.pg, { transform: `translate(${r2(p.x + drift)} ${r2(p.y - 16 * k)}) scale(${r2(1 + 0.5 * k)})`, opacity: r2(1 - k) });
          Kit.show(p.pg, k < 1);
        });
        Kit.show(duster, dv > 0.001);
        if (dv > 0.001) {
          const f = clamp(dusted) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), u = f - i;
          const x = lerp(path[i][0], path[i + 1][0], u), y = lerp(path[i][1], path[i + 1][1], u);
          set(duster, { transform: `translate(${r2(x)} ${r2(y)}) rotate(${r2(-20 + 14 * Math.sin(dusted * 40))})`, opacity: r2(dv) });
        }
      },
    };
  }

  // Large steel dumpster with a hinged lid (hinge on the right). Origin bottom-centre.
  // update({lid 0..1}). Field: inside (group behind the front face, dumpster-local coords).
  function Dumpster(parent) {
    const g = el('g', {}, parent);
    Kit.shadow(g, 200);
    el('rect', { x: -98, y: -152, width: 196, height: 10, fill: C.ink }, g);
    const inside = el('g', {}, g);
    el('path', { d: 'M-88 -16L-100 -146H100L88 -16Z', fill: C.steel, ...INK() }, g);
    el('path', { d: 'M-60 -26V-136M-20 -26V-136M20 -26V-136M60 -26V-136', stroke: C.steelDark, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    el('rect', { x: -104, y: -152, width: 16, height: 26, rx: 3, fill: C.steelDark, ...INK(2) }, g);
    el('rect', { x: 88, y: -152, width: 16, height: 26, rx: 3, fill: C.steelDark, ...INK(2) }, g);
    [-62, 62].forEach(x => { el('circle', { cx: x, cy: -12, r: 12, fill: C.ink }, g); el('circle', { cx: x, cy: -12, r: 5, fill: C.steel }, g); });
    const lid = el('g', {}, g);
    el('path', { d: 'M-106 -146H106L102 -160H-102Z', fill: C.steelDark, ...INK() }, lid);
    return {
      g, inside,
      update({ lid: l = 0 } = {}) { set(lid, { transform: l > 0 ? `rotate(${r2(100 * Kit.ease.enter(clamp(l)))} 106 -146)` : '' }); },
    };
  }

  // Small paper trash scraps (for the trash can and dumpster). Origin centre of the cluster.
  function Scraps(parent, n = 3, seed = 0) {
    const g = el('g', {}, parent);
    for (let i = 0; i < n; i++) {
      const a = hash(seed + i) * 60 - 30;
      el('path', { d: 'M-10 -7L8 -9L11 5L-7 9Z', fill: i % 2 ? C.paper : C.floor, ...INK(2), transform: `translate(${(i - (n - 1) / 2) * 14} ${(i % 2) * -6}) rotate(${a.toFixed(1)})` }, g);
    }
    return g;
  }
  // Crumpled bag, coffee cup and drinks can icons. Origins bottom-centre.
  function Bag(parent) {
    const g = el('g', {}, parent);
    el('path', { d: 'M-22 0L-26 -24L-14 -38L-2 -30L8 -42L22 -30L20 -8L24 0Z', fill: C.paper, ...INK(2.2) }, g);
    el('path', { d: 'M-14 -30L-6 -14L-16 -6M8 -34L4 -18L14 -10M-2 -24L2 -6', fill: 'none', stroke: C.inkSoft, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    return g;
  }
  function Cup(parent) {
    const g = el('g', {}, parent);
    el('path', { d: 'M-13 0L-16 -42H16L13 0Z', fill: C.paper, ...INK(2.2) }, g);
    el('path', { d: 'M-15 -30H15L14 -16H-14Z', fill: C.carton, ...INK(2) }, g);
    el('rect', { x: -19, y: -50, width: 38, height: 8, rx: 3, fill: C.steelDark, ...INK(2) }, g);
    return g;
  }
  function Can(parent) {
    const g = el('g', {}, parent);
    el('rect', { x: -12, y: -40, width: 24, height: 40, rx: 4, fill: C.neutral, ...INK(2.2) }, g);
    el('rect', { x: -12, y: -40, width: 24, height: 6, rx: 3, fill: C.steel, ...INK(2) }, g);
    el('path', { d: 'M-6 -26V-10', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, g);
    return g;
  }
  // Loose banding strap bundle (carried in the hand). Origin centre.
  function StrapBundle(parent) {
    const g = el('g', {}, parent);
    const d = 'M-26 4C-18 -14 -6 14 2 -4S18 -12 24 6';
    el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-22 -6C-10 -18 4 0 20 -12', fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    return g;
  }

  // Clearance-set icons (STYLE §6 item 33). Origins bottom-centre on the floor line.
  function FireHydrant(parent) {
    const g = el('g', {}, parent);
    el('rect', { x: -34, y: -14, width: 68, height: 14, rx: 3, fill: C.steelDark, ...INK() }, g);
    el('path', { d: 'M-24 -14V-92H24V-14Z', fill: C.safety, ...INK() }, g);
    el('path', { d: 'M-28 -92Q-28 -122 0 -124Q28 -122 28 -92Z', fill: C.safety, ...INK() }, g);
    el('rect', { x: -8, y: -136, width: 16, height: 14, rx: 3, fill: C.steel, ...INK(2) }, g);
    el('rect', { x: -40, y: -70, width: 16, height: 22, rx: 3, fill: C.steel, ...INK(2) }, g);
    el('rect', { x: 24, y: -70, width: 16, height: 22, rx: 3, fill: C.steel, ...INK(2) }, g);
    el('circle', { cx: 0, cy: -58, r: 11, fill: C.steel, ...INK(2) }, g);
    el('path', { d: 'M-24 -96H24', stroke: C.ink, 'stroke-width': 2.5 }, g);
    return g;
  }
  function Doorway(parent) {
    const g = el('g', {}, parent);
    el('rect', { x: -62, y: -196, width: 124, height: 196, fill: C.steelDark, ...INK() }, g);
    el('rect', { x: -48, y: -182, width: 96, height: 182, fill: C.ink }, g);
    el('path', { d: 'M-48 0V-182L-8 -170V12Z', fill: C.steel, ...INK() }, g);
    el('rect', { x: -40, y: -150, width: 22, height: 40, rx: 2, fill: C.paper, ...INK(2), transform: 'skewY(16)' }, g);
    el('circle', { cx: -16, cy: -82, r: 4, fill: C.ink }, g);
    // exit pictogram plate above the door (no text)
    el('rect', { x: -26, y: -226, width: 52, height: 24, rx: 4, fill: C.correct, ...INK(2) }, g);
    el('path', { d: 'M-12 -214H10M4 -220L10 -214L4 -208', stroke: C.paper, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    return g;
  }
  function ElectricalPanel(parent) {
    const g = el('g', {}, parent);
    el('path', { d: 'M-8 -200V-150M8 -200V-150', stroke: C.steelDark, 'stroke-width': 7 }, g);
    el('rect', { x: -52, y: -152, width: 104, height: 120, rx: 6, fill: C.steel, ...INK() }, g);
    el('rect', { x: -42, y: -142, width: 84, height: 100, rx: 3, fill: 'none', stroke: C.steelDark, 'stroke-width': 2 }, g);
    el('path', { d: 'M0 -132L28 -86H-28Z', fill: C.safety, ...INK(2.2) }, g);
    el('path', { d: 'M3 -124L-6 -104H3L-3 -92L8 -110H-1Z', fill: C.ink }, g);
    el('rect', { x: 32, y: -100, width: 6, height: 18, rx: 2, fill: C.ink }, g);
    return g;
  }

  // Simple service van, side view facing right, 520 x 260 (STYLE §6 item 17). Origin bottom-centre.
  // update({dist (px travelled, wheel turn), sparkle 0..1 + tSparkle stagger handled by caller via
  //   sparkles[i] scale, dent 0..1 error ring, t}). Fields: dentAt [x, y] local, fuelAt [x, y].
  function Van(parent) {
    const g = el('g', {}, parent);
    Kit.shadow(g, 500);
    const body = el('g', {}, g);
    el('path', { d: 'M-252 -42V-222Q-252 -238 -236 -238H96Q114 -238 122 -226L178 -150L238 -136Q254 -132 254 -116V-42Z', fill: C.paper, ...INK() }, body);
    el('path', { d: 'M108 -224L160 -152H96V-224Z', fill: C.steelDark, ...INK(2.2) }, body);
    el('path', { d: 'M114 -214L126 -214L118 -186Z', fill: C.paper, opacity: 0.45 }, body);
    el('rect', { x: 10, y: -222, width: 74, height: 62, rx: 6, fill: C.steelDark, ...INK(2.2) }, body);
    el('path', { d: 'M-252 -112H254V-96H-252Z', fill: C.neutral, ...INK(2) }, body);
    el('path', { d: 'M90 -228V-50M-2 -228V-50M-130 -228V-50', stroke: C.inkSoft, 'stroke-width': 2, fill: 'none' }, body);
    el('rect', { x: 66, y: -134, width: 18, height: 6, rx: 3, fill: C.ink }, body);
    el('rect', { x: -26, y: -134, width: 18, height: 6, rx: 3, fill: C.ink }, body);
    el('rect', { x: 236, y: -130, width: 14, height: 14, rx: 3, fill: C.safety, ...INK(2) }, body);
    el('rect', { x: -252, y: -150, width: 10, height: 24, rx: 2, fill: C.accent, ...INK(2) }, body);
    el('rect', { x: 196, y: -56, width: 62, height: 16, rx: 4, fill: C.steelDark, ...INK(2) }, body);
    el('rect', { x: -258, y: -56, width: 50, height: 16, rx: 4, fill: C.steelDark, ...INK(2) }, body);
    el('circle', { cx: -196, cy: -160, r: 9, fill: C.steel, ...INK(2) }, body);
    // dent on the rear panel
    el('path', { d: 'M-104 -176Q-92 -164 -98 -150Q-90 -142 -76 -146', fill: 'none', stroke: C.inkSoft, 'stroke-width': 3, 'stroke-linecap': 'round' }, body);
    el('path', { d: 'M-100 -170Q-88 -160 -92 -150', fill: 'none', stroke: C.steel, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.6 }, body);
    const dentRing = el('ellipse', { cx: -92, cy: -160, rx: 30, ry: 26, fill: 'none', stroke: C.error, 'stroke-width': 4 }, body);
    const wheels = [-160, 160].map(x => {
      el('path', { d: `M${x - 52} -42A52 52 0 0 1 ${x + 52} -42Z`, fill: C.ink }, body);
      const w = el('g', {}, body);
      el('circle', { cx: x, cy: -40, r: 40, fill: '#2B3442', ...INK() }, w);
      el('circle', { cx: x, cy: -40, r: 20, fill: C.steel, ...INK(2) }, w);
      const hub = el('g', {}, w);
      for (let k = 0; k < 5; k++) el('circle', { cx: r2(x + 11 * Math.cos(k * 1.2566)), cy: r2(-40 + 11 * Math.sin(k * 1.2566)), r: 2.6, fill: C.ink }, hub);
      return { x, hub };
    });
    const sparkleAt = [[-200, -200], [44, -200], [148, -196], [-60, -70], [210, -110], [-150, -120]];
    const sparkles = sparkleAt.map(([x, y]) => {
      const sg = el('g', { transform: `translate(${x} ${y})` }, g), s = el('g', {}, sg);
      el('path', { d: SPARKLE, fill: C.accent, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, s);
      return s;
    });
    return {
      g, dentAt: [-92, -160], sparkleAt,
      update({ dist = 0, sparkle = [], dent = 0, t = 0 } = {}) {
        wheels.forEach(w => set(w.hub, { transform: `rotate(${r2((dist / 40 / D) % 360)} ${w.x} -40)` }));
        Kit.show(dentRing, dent > 0.001);
        set(dentRing, { opacity: r2(dent * (0.8 + 0.2 * Math.cos(t * 2 * Math.PI))) });
        sparkles.forEach((s, i) => {
          const k = sparkle[i] || 0;
          Kit.show(s, k > 0.001);
          if (k > 0.001) {
            const tw = 0.85 + 0.15 * Math.sin(t * 2 * Math.PI / 1.4 + i * 1.7);
            set(s, { transform: `rotate(${r2(10 * Math.sin(t * 0.9 + i))}) scale(${r2(Math.max(0.001, k * tw))})` });
          }
        });
      },
    };
  }

  // Fuel gauge 240 x 140 (STYLE §6 item 18): E / ½ / F, red zone below half. Origin: needle pivot.
  // update({v 0..1 fill level})
  function FuelGauge(parent) {
    const g = el('g', {}, parent);
    const R = 112;
    el('path', { d: `M${-R} 22V0A${R} ${R} 0 0 1 ${R} 0V22Z`, fill: C.paper, ...INK() }, g);
    const pt = (a, r) => `${r2(r * Math.sin(a * D))} ${r2(-r * Math.cos(a * D))}`;
    const band = (a0, a1, col) => el('path', { d: `M${pt(a0, 88)}A88 88 0 0 1 ${pt(a1, 88)}`, fill: 'none', stroke: col, 'stroke-width': 16 }, g);
    band(-80, 0, C.error); band(0, 80, C.steel);
    for (let i = 0; i <= 4; i++) {
      const a = -80 + 40 * i;
      el('path', { d: `M${pt(a, 76)}L${pt(a, 100)}`, stroke: C.ink, 'stroke-width': i % 2 ? 2.5 : 4, 'stroke-linecap': 'round' }, g);
    }
    Kit.text(g, 'E', { x: -58, y: -6, size: 26, weight: 700, anchor: 'middle' });
    Kit.text(g, '½', { x: 0, y: -40, size: 26, weight: 700, anchor: 'middle' });
    Kit.text(g, 'F', { x: 58, y: -6, size: 26, weight: 700, anchor: 'middle' });
    const needle = el('g', {}, g);
    el('path', { d: 'M-5 0L0 -84L5 0Z', fill: C.ink, ...INK(2) }, needle);
    el('circle', { r: 10, fill: C.ink }, g);
    el('circle', { r: 4, fill: C.accent }, g);
    return { g, update({ v = 0 } = {}) { set(needle, { transform: `rotate(${r2(-80 + 160 * clamp(v))})` }); } };
  }
  // Fuel pump nozzle icon; drops fall from the spout while pouring. Origin: spout tip.
  function FuelNozzle(parent) {
    const g = el('g', {}, parent);
    el('path', { d: 'M76 -44C110 -60 120 -100 96 -130', fill: 'none', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M76 -44C110 -60 120 -100 96 -130', fill: 'none', stroke: C.steelDark, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M0 0L34 -24', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M0 0L34 -24', stroke: C.steel, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M28 -34L64 -58L84 -40L56 -12Z', fill: C.steelDark, ...INK() }, g);
    el('path', { d: 'M46 -16Q52 0 66 -4', fill: 'none', ...INK(4) }, g);
    const drops = [0, 1, 2].map(() => el('path', { d: 'M0 -7Q5 0 0 4Q-5 0 0 -7Z', fill: C.neutral, stroke: C.ink, 'stroke-width': 1.5 }, g));
    return {
      g,
      update({ pour = 0, t = 0 } = {}) {
        drops.forEach((n, i) => {
          const ph = ((t / 0.5 + i / 3) % 1 + 1) % 1;
          Kit.show(n, pour > 0.01);
          set(n, { transform: `translate(${r2(-4 - 4 * ph)} ${r2(8 + 34 * ph)})`, opacity: r2(pour * (1 - ph)) });
        });
      },
    };
  }

  // Dashed floor zone (clearance / overflow). pts = screen-space polygon in the parent's coords.
  function Zone(parent, pts, { color = C.inkSoft, fill = null } = {}) {
    const g = el('g', {}, parent);
    const d = 'M' + pts.map(p => `${p[0]} ${p[1]}`).join('L') + 'Z';
    const bg = el('path', { d, fill: fill || C.correct, opacity: fill ? 1 : 0, stroke: 'none' }, g);
    const line = el('path', { d, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-dasharray': '12 8', 'stroke-linejoin': 'round' }, g);
    return { g, bg, line };
  }

  // ------------------------------------------------------------------ the scene
  Engine.scene('s07', {
    build(ctx) {
      const root = ctx.root;
      const B = id => ctx.beat(id), cue = (id, ph, n) => ctx.cue(id, ph, n);
      const b1 = B('s07b01'), b2 = B('s07b02'), b3 = B('s07b03'), b4 = B('s07b04'), b5 = B('s07b05'), b6 = B('s07b06'), b7 = B('s07b07'), b8 = B('s07b08');
      const T = {};
      // b01
      T.card = 0.5;
      // wipe on "supports", so the first tile follows the reveal within about a second
      T.wipe = Math.max(cue('s07b01', 'supports') - 0.6, T.card + 2.5);
      T.tiles = ['safe work', 'professional', 'efficiency', 'protection'].map((ph, i) => Math.max(cue('s07b01', ph) - 0.15, T.wipe + 0.6 + 0.3 * i));
      // the first tile lands as the card finishes lifting, so the reveal is never an empty frame
      T.tiles[0] = Math.min(T.tiles[0], T.wipe + 0.45);
      T.lt = [T.wipe + 0.8, b6.start + 0.3];
      // b02
      T.b2 = b2.start; T.b3 = b3.start; T.b4 = b4.start; T.b5 = b5.start; T.b6 = b6.start; T.b7 = b7.start; T.b8 = b8.start;
      T.sweep = cue('s07b02', 'Floors and dock') - 0.1;
      T.walk0 = T.sweep + 0.3; T.walkDist = 360; T.walkV = Kit.Worker.WALK_SPEED * 0.45 * 0.95;
      T.walk1 = T.walk0 + T.walkDist / T.walkV;
      T.dust = Math.max(cue('s07b02', 'Cabinets'), T.walk1 + 0.2);
      T.trash = Math.max(cue('s07b02', 'All trash cans'), T.dust + 1.9);
      T.shift = Math.max(cue('s07b02', 'end of shift'), T.trash + 0.6);
      T.dailyTicks = [Math.max(cue('s07b02', 'disposed of') + 0.3, T.walk1 + 0.2), T.dust + 1.9, T.shift + 1.0];
      // b03
      T.spillIn = T.b3 + 0.35;
      T.mop = Math.max(cue('s07b03', 'liquid') - 0.2, T.spillIn + 0.5);
      T.mopEnd = T.mop + 2.0;
      T.clean = cue('s07b03', 'is cleaned');
      T.wind = Math.max(cue('s07b03', 'excess hose') - 0.1, T.clean + 0.6);
      T.dailyTicks.push(T.mopEnd + 0.1, T.wind + 1.7);
      // b04
      T.box = cue('s07b04', 'keep empty boxes') + 0.1;
      T.cup = Math.max(cue('s07b04', 'coffee cups') - 0.3, T.box + 2.4);
      T.scis = cue('s07b04', 'Remove banding');
      T.cut = Math.max(cue('s07b04', 'is cut', 0) - 0.1, T.scis + 1.0);
      T.walkP0 = Math.max(T.scis + 0.1, T.cup + 2.3); T.walkP1 = T.walkP0 + 190 / (Kit.Worker.WALK_SPEED * 0.85 * 0.85);
      T.pick = Math.max(cue('s07b04', 'dispose'), T.cut + 1.0, T.walkP1 + 0.1);
      T.untidyTicks = [T.box + 1.8, T.cup + 2.3, T.pick + 1.9];
      // b05
      T.p1 = T.b5 + 0.35; T.broken = T.p1 + 0.5;
      T.swap = Math.max(cue('s07b05', 'replaced'), T.broken + 1.0);
      T.gather = Math.max(cue('s07b05', 'Broken and splintered'), T.swap + 1.2);
      T.dispose = Math.max(cue('s07b05', 'disposed of properly') - 0.2, T.gather + 0.7);
      T.p2 = Math.max(cue('s07b05', 'Overflow parts') - 0.3, T.dispose + 1.2);
      T.never = cue('s07b05', 'never stocked');
      T.move = Math.max(cue('s07b05', 'overflow moves'), T.never + 0.8);
      T.p3 = Math.max(cue('s07b05', 'And fire hydrants') - 0.2, T.move + 1.8);
      T.clear = [cue('s07b05', 'fire hydrants') + 0.4, cue('s07b05', 'door passageways') + 0.4, cue('s07b05', 'electrical junction') + 0.6];
      T.clear = T.clear.map((v, i) => Math.max(v, T.p3 + 0.6 + 0.5 * i));
      T.p3Mark = Math.max(cue('s07b05', 'kept clear') + 0.4, T.clear[2] + 0.7);
      // b06
      T.fkIn = T.b6 + 0.4; T.fkStop = T.fkIn + 3.0;
      T.badges = ['productivity', 'operating cost', 'workplace safe'].map((ph, i) => Math.max(cue('s07b06', ph) - 0.1, T.fkIn + 0.8 + 0.3 * i));
      T.speed = Math.max(cue('s07b06', 'Speed or abuse'), T.badges[2] + 1.5);
      T.aMove = T.speed - 0.5;
      // b07
      T.wIn = T.b7 + 0.2;
      T.insp = T.b7 + 0.5;
      T.fail = Math.max(cue('s07b07', 'safety related') - 0.1, T.insp + 4.4);
      T.tag = Math.max(cue('s07b07', 'tagged out') - 0.5, T.fail + 1.0);
      T.report = Math.max(cue('s07b07', 'Unsafe equipment'), T.tag + 1.6);
      T.nod7 = Math.max(cue('s07b07', 'supervisor') + 0.1, T.report + 0.8);
      // b08
      T.van = T.b8 + 0.35;
      T.cleanV = Math.max(cue('s07b08', 'kept clean'), T.van + 1.4);
      T.loopGo = Math.max(cue('s07b08', 'Before operating') - 0.4, T.cleanV + 1.0);
      T.note = Math.max(cue('s07b08', 'report any damage'), T.loopGo + 2.4);
      T.gauge = Math.max(cue('s07b08', 'If the tank') - 0.3, T.note + 1.0);
      T.fill = Math.max(cue('s07b08', 'fill it'), T.gauge + 0.9);
      T.trained = Math.max(cue('s07b08', 'task trained'), T.fill + 1.8);

      // ---------------- layers (back to front)
      const L = name => el('g', { id: `s07-${name}` }, root);
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, root);
      const floorG = L('floor');
      el('rect', { x: -20, y: 690, width: 1960, height: 410, fill: C.floor }, floorG);
      el('rect', { x: -20, y: 686, width: 1960, height: 6, fill: C.steel, opacity: 0.5 }, floorG);

      // b01 tiles
      const tilesL = L('tiles');
      const tileX = [140, 560, 980, 1400], tileY = 300;
      const tileDefs = [{ label: 'Safe', icon: 'Shield' }, { label: 'Professional' }, { label: 'Efficient', icon: 'Target' }, { label: 'Protects assets' }];
      const tiles = tileDefs.map((d, i) => {
        const wrap = el('g', {}, tilesL);
        const tile = Kit.Tile(wrap, { label: d.label, icon: d.icon, width: 380, height: 340, iconSize: 150 });
        return { wrap, tile };
      });
      const proWorkerG = el('g', { transform: 'translate(-22 92) scale(0.6)' }, tiles[1].tile.slot);
      const proWorker = Kit.Worker(proWorkerG, { stroke: 2.5 / 0.6, seed: 71 });
      const proStarG = el('g', { transform: 'translate(70 -64)' }, tiles[1].tile.slot);
      const proStar = Kit.Star(proStarG, { size: 64 });
      const rackMiniG = el('g', { transform: 'translate(-14 96) scale(0.34)' }, tiles[3].tile.slot);
      const rackMini = Kit.PalletRack(rackMiniG, { contents: ['carton'] });
      const lockG = el('g', { transform: 'translate(0 8)' }, tiles[3].tile.slot);
      const lock = Kit.Padlock(lockG, { size: 84 });
      const noLabels = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, { label: null }]));

      // b02 stage
      const st2 = L('b02');
      const st2Items = {};
      const mk = (parent, x, y, s = 1) => { const g = el('g', {}, parent); return { g, x, y, s }; };
      st2Items.cab = mk(st2, 990, 745, 1); const cabinet = Cabinet(st2Items.cab.g);
      st2Items.clock = mk(st2, 1290, 430, 0.85); const clock = Kit.Clock(st2Items.clock.g, { size: 200, color: 'neutral' });
      st2Items.dump = mk(st2, 1730, 745, 0.95); const dumpster = Dumpster(st2Items.dump.g);
      const dumpScraps = [0, 1, 2].map(i => { const g = el('g', {}, dumpster.inside); Scraps(g, 2, 10 + i); return g; });
      st2Items.debris = mk(st2, 1330, 876, 1); const debris = Kit.Debris(st2Items.debris.g, { n: 18, w: 340, h: 36 });
      st2Items.pan = mk(st2, 1535, 878, 0.9); const dustpan = Kit.Dustpan(st2Items.pan.g);
      st2Items.can = mk(st2, 1650, 874, 0.9); const can2 = Kit.TrashCan(st2Items.can.g);
      const canScraps = el('g', { transform: 'translate(0 -104)' }, can2.inside); Scraps(canScraps, 3, 3);

      // b03 stage
      const st3 = L('b03');
      const st3Items = {};
      st3Items.spill = mk(st3, 1060, 856, 1); const spill = Kit.Spill(st3Items.spill.g, { w: 230, h: 66 });
      st3Items.hook = mk(st3, 1740, 846, 0.95); const hook = Kit.HoseHook(st3Items.hook.g, { height: 300, trail: 330 });
      st3Items.press = mk(st3, 1405, 846, 0.78); const press = Kit.HosePress(st3Items.press.g);
      st3Items.offcuts = mk(st3, 1330, 866, 1); const offcuts = Kit.Debris(st3Items.offcuts.g, { n: 9, w: 240, h: 26 });
      st3Items.mop = mk(st3, 1060, 860, 0.8); const mop = Kit.Mop(st3Items.mop.g);
      const spillCheckG = el('g', {}, st3); const spillCheck = Kit.GreenCheck(spillCheckG, { size: 56 });
      const hoseCheckG = el('g', {}, st3); const hoseCheck = Kit.GreenCheck(hoseCheckG, { size: 56 });

      // b04 stage
      const st4 = L('b04');
      const st4Items = {};
      st4Items.rack = mk(st4, 1000, 832, 0.62); const rack = Kit.PalletRack(st4Items.rack.g, { contents: ['carton'] });
      st4Items.pallet = mk(st4, 1650, 832, 0.7); const pallet = Kit.Pallet(st4Items.pallet.g);
      const strap = Kit.Strap(st4Items.pallet.g, { ...pallet.box(4), at: [0] });
      st4Items.can = mk(st4, 1370, 832, 0.85); const can4 = Kit.TrashCan(st4Items.can.g);
      // Items that end up in the can live inside its `inside` group (drawn behind the can's front),
      // in stage coordinates via the inverse of the can's placement.
      const canLayer = el('g', { transform: `scale(${r2(1 / 0.85)}) translate(-1370 -832)` }, can4.inside);
      const boxG = el('g', {}, canLayer);
      const emptyBox = Kit.Carton(boxG, { w: 92, h: 80, d: 40 });
      const bagG = el('g', { transform: 'translate(-14 -6)' }, boxG); Bag(bagG);
      const cupG = el('g', {}, canLayer); Cup(cupG);
      const tinG = el('g', {}, canLayer); Can(tinG);
      const strapFallG = el('g', {}, canLayer); StrapBundle(strapFallG);
      st4Items.scis = mk(st4, 1598, 670, 0.7); const scissors = Kit.Scissors(st4Items.scis.g);
      const palletCheckG = el('g', {}, st4); const palletCheck = Kit.GreenCheck(palletCheckG, { size: 56 });

      // b05 panels
      const st5 = L('b05');
      const px = Kit.stripX(3, 520, 40), pY = 196;
      const caps = ['Broken pallets: replace and discard', 'No overflow on aisle floors', 'Hydrants, doors, junction boxes clear'];
      const panels = caps.map((c, i) => { const g = el('g', {}, st5); const p = Kit.Panel(g, { width: 520, height: 580, caption: c }); return { g, p }; });
      // panel 1: broken pallet -> intact; splinters into a can
      const s1 = panels[0].p.slot, g1 = panels[0].p.areaH - 46;
      const brokenG = el('g', {}, s1); const brokenPallet = Kit.Pallet(brokenG);
      const goodG = el('g', {}, s1); const goodPallet = Kit.Pallet(goodG);
      const can5G = el('g', { transform: `translate(440 ${g1}) scale(0.85)` }, s1); const can5 = Kit.TrashCan(can5G);
      const splLayer = el('g', { transform: `scale(${r2(1 / 0.85)}) translate(-440 ${-g1})` }, can5.inside);
      const splG = el('g', {}, splLayer); const splinters = Kit.Splinters(splG, { n: 6 });
      const p1X = el('g', {}, s1); const p1Xm = Kit.RedX(p1X, { size: 56 });
      const p1C = el('g', {}, s1); const p1Cm = Kit.GreenCheck(p1C, { size: 56 });
      // panel 2: aisle floor cartons move to a marked overflow area
      const s2 = panels[1].p.slot, g2 = panels[1].p.areaH;
      el('path', { d: `M0 ${g2 - 160}H520M0 ${g2 - 34}H520`, stroke: C.safety, 'stroke-width': 10 }, s2);
      el('path', { d: `M0 ${g2 - 165}H520M0 ${g2 - 155}H520M0 ${g2 - 39}H520M0 ${g2 - 29}H520`, stroke: C.ink, 'stroke-width': 1.5 }, s2);
      const zoneY = g2 - 176;
      const ovZone = Zone(s2, [[282, zoneY], [478, zoneY], [512, zoneY - 60], [316, zoneY - 60]], { color: C.accent, fill: mix(C.accent, C.paper, 0.78) });
      set(ovZone.line, { 'stroke-width': 4 });
      el('path', { d: `M420 ${zoneY - 120}V${zoneY - 52}`, stroke: C.steelDark, 'stroke-width': 6, 'stroke-linecap': 'round' }, s2);
      const ovLabel = el('g', { transform: `translate(420 ${zoneY - 140})` }, s2);
      const ovW = Kit.measure('Overflow', 26, 700) + 28;
      el('rect', { x: -ovW / 2, y: -20, width: ovW, height: 40, rx: 8, fill: C.paper, ...INK(2.5) }, ovLabel);
      Kit.text(ovLabel, 'Overflow', { x: 0, y: 9, size: 26, weight: 700, anchor: 'middle' });
      const rack2G = el('g', { transform: `translate(124 ${zoneY - 6}) scale(0.4)` }, s2); const rack2 = Kit.PalletRack(rack2G, { contents: ['carton'] });
      const ovCartons = [0, 1].map(() => { const g = el('g', {}, s2); return { g, c: Kit.Carton(g, { w: 92, h: 82, d: 40 }) }; });
      const ovTagG = el('g', {}, s2); const ovTag = Kit.OverstockTag(ovTagG, { arrow: false, string: 26 });
      const p2X = el('g', {}, s2); const p2Xm = Kit.RedX(p2X, { size: 48 });
      // panel 3: hydrant, doorway, junction box with clearance zones
      const s3 = panels[2].p.slot, g3 = panels[2].p.areaH - 110;
      const iconX = [92, 262, 432];
      const zones3 = iconX.map(x => Zone(s3, [[x - 72, g3 + 96], [x + 58, g3 + 96], [x + 76, g3 + 12], [x - 54, g3 + 12]]));
      [FireHydrant, Doorway, ElectricalPanel].forEach((f, i) => { const g = el('g', { transform: `translate(${iconX[i]} ${g3}) scale(${i === 1 ? 0.9 : 1})` }, s3); f(g); });
      const strays = iconX.map(() => { const g = el('g', {}, s3); return { g, c: Kit.Carton(g, { w: 70, h: 60, d: 30 }) }; });
      const clearChecks = iconX.map(() => { const g = el('g', {}, s3); return { g, m: Kit.GreenCheck(g, { size: 40 }) }; });

      // b06-b07 forklifts
      const st6 = L('b06');
      const fkAG = el('g', {}, st6); const fkA = Kit.Forklift(fkAG, { driver: true, driverVariant: 'worker', load: true, seed: 7 });
      const fkBG = el('g', {}, st6); const fkB = Kit.Forklift(fkBG, { driver: true, driverVariant: 'driver', load: true, seed: 8 });

      // b08 van layer (behind the Worker): dotted walk-around ring, the Worker's back-half copy, van
      const st8 = L('b08');
      const ring = { cx: 1000, cy: 800, rx: 380, ry: 58 };
      const dotsG = el('g', {}, st8);
      const NS = 720, arcLen = [0];
      const ringPt = th => [ring.cx + ring.rx * Math.cos(th), ring.cy + ring.ry * Math.sin(th)];
      for (let i = 1; i <= NS; i++) { const a = ringPt((i - 1) / NS * 2 * Math.PI), b = ringPt(i / NS * 2 * Math.PI); arcLen.push(arcLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
      const ringL = arcLen[NS];
      const thetaAt = s => { s = clamp(s, 0, ringL); let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arcLen[m] < s) lo = m; else hi = m; } const u = (s - arcLen[lo]) / Math.max(1e-6, arcLen[hi] - arcLen[lo]); return (lo + u) / NS * 2 * Math.PI; };
      const NDOT = 64;
      const dots = Array.from({ length: NDOT }, (_, i) => { const p = ringPt(thetaAt((i + 0.5) / NDOT * ringL)); return el('circle', { cx: r2(p[0]), cy: r2(p[1]), r: 4.5, fill: C.inkSoft }, dotsG); });
      const wkBackG = el('g', {}, st8); const wkBack = Kit.Worker(wkBackG, { seed: 5 });
      const vanG = el('g', {}, st8); const van = Van(vanG);
      const gaugeG = el('g', {}, st8); const gauge = FuelGauge(gaugeG);
      const gaugeCard = el('rect', { x: -140, y: -138, width: 280, height: 184, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, gaugeG);
      gaugeG.insertBefore(gaugeCard, gaugeG.firstChild);
      const nozG = el('g', {}, st8); const nozzle = FuelNozzle(nozG);
      const gaugeCheckG = el('g', {}, st8); const gaugeCheck = Kit.GreenCheck(gaugeCheckG, { size: 56 });

      // characters
      const wkG = el('g', {}, root); const wk = Kit.Worker(wkG, { seed: 5 });
      const supG = el('g', {}, root); const sup = Kit.Worker(supG, { variant: 'supervisor', seed: 9 });

      // overlays
      const ov = L('overlay');
      const handCupG = el('g', {}, ov); const handCup = el('g', { transform: 'translate(-12 26)' }, handCupG); Cup(handCup); const handTin = el('g', { transform: 'translate(14 30)' }, handCupG); Can(handTin);
      const handStrapG = el('g', {}, ov); StrapBundle(handStrapG);
      const badgeTexts = ['Productivity', 'Lower cost', 'Safety'];
      const badges = badgeTexts.map(s => { const g = el('g', {}, ov); return { g, b: Kit.Badge(g, { text: s, height: 52, size: 30 }) }; });
      const heading6 = Kit.Heading(ov, { text: 'No speed, no abuse' });
      const xB = el('g', {}, ov); const xBm = Kit.RedX(xB, { size: 56 });
      const okA = el('g', {}, ov); const okAm = Kit.GreenCheck(okA, { size: 56 });
      const tagCallG = el('g', {}, ov); const tagCall = Kit.Callout(tagCallG, { text: 'Safety related? Tag out', pointer: 'up', at: 0.5 });
      const repCallG = el('g', {}, ov); const repCall = Kit.Callout(repCallG, { text: 'Report unsafe equipment immediately', pointer: 'down', at: 0.32, maxWidth: 460 });
      const exclG = el('g', {}, ov); const excl = Kit.ExclamationMark(exclG, { size: 72 });
      const noteG = el('g', {}, ov);
      el('rect', { x: -34, y: -28, width: 68, height: 56, rx: 6, fill: C.paper, stroke: C.error, 'stroke-width': 4 }, noteG);
      el('path', { d: 'M-20 -14H8M-20 -2H14M-20 10H2', stroke: C.error, 'stroke-width': 3, 'stroke-linecap': 'round' }, noteG);
      el('circle', { cx: 22, cy: 12, r: 9, fill: C.error, ...INK(2) }, noteG);
      el('path', { d: 'M22 6V13M22 16.5V17', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round' }, noteG);
      const trainedG = el('g', {}, ov); const trained = Kit.Badge(trainedG, { text: 'Task trained', variant: 'correct', icon: 'check', height: 44, size: 26 });

      // checklists
      const lists = L('lists');
      const mkList = (opts, x, y) => { const c = Kit.Checklist(lists, opts); place(c.g, { x, y }); return c; };
      const daily = mkList({ title: 'Daily', items: ['Daily: sweep floors and dock', 'Dust cabinets and shelves', 'Empty trash at end of shift', 'No oil or liquid spills', 'Hose press area clean, hose put away'] }, 80, 200);
      const untidy = mkList({ title: 'Prevent untidy conditions', items: ['Empty boxes and bags out of bins', 'Trash picked up', 'Cut banding: remove and dispose'] }, 80, 200);
      const insp = mkList({ title: 'Daily inspection', items: ['Tires', 'Lights and horn', 'Forks and mast', 'Brakes'] }, 80, 200);
      const brakeG = el('g', {}, lists); const brake = Kit.Badge(brakeG, { text: 'Brake fault', variant: 'error', icon: 'x' });
      const brakeX = 80 + insp.textX + Kit.measure('Brakes', 34, 500) + 24 + (Kit.measure('Brake fault', 24, 600) + 22 + 32) / 2, brakeY = 200 + insp.rowY(3);
      const vehicle = mkList({ items: ['Clean inside and out', 'Visual inspection before use', 'Below half a tank? Fill it', 'Task trained'] }, 80, 200);

      const lower = Kit.LowerThird(root, { texts: ['13. Warehouse Housekeeping', '14. Vehicle and Equipment Maintenance'] });
      const card = Kit.SectionTitleCard(root, { part: 'Part V', title: 'Maintenance', sub: '13. Warehouse Housekeeping' });

      // rest-hand positions for blending IK reaches in and out
      const probe = Kit.Worker(el('g', { display: 'none' }, root), { seed: 99 });
      const restStand = probe.update({ pose: 'stand', t: 0 }).hand;
      const restClip = probe.update({ pose: 'hold-clipboard', t: 0 }).hand;

      return {
        T, floorG, tiles, proWorker, proStar, rackMini, lock, noLabels,
        st2Items, cabinet, clock, dumpster, dumpScraps, debris, dustpan, can2, canScraps,
        st3Items, spill, hook, press, offcuts, mop, spillCheckG, spillCheck, hoseCheckG, hoseCheck,
        st4Items, rack, pallet, strap, can4, boxG, emptyBox, cupG, tinG, strapFallG, scissors, palletCheckG, palletCheck,
        panels, g1, brokenG, brokenPallet, goodG, goodPallet, can5, splG, splinters, p1X, p1Xm, p1C, p1Cm,
        g2, zoneY, ovZone, ovLabel, rack2, ovCartons, ovTagG, ovTag, p2X, p2Xm,
        g3, iconX, zones3, strays, clearChecks,
        fkAG, fkA, fkBG, fkB,
        ring, ringPt, thetaAt, ringL, dots, NDOT, wkBackG, wkBack, vanG, van, gaugeG, gauge, nozG, nozzle, gaugeCheckG, gaugeCheck,
        wkG, wk, supG, sup,
        handCupG, handStrapG, badges, heading6, xB, xBm, okA, okAm, tagCallG, tagCall, repCallG, repCall, exclG, excl, noteG, trainedG, trained,
        daily, untidy, insp, brakeG, brake, brakeX, brakeY, vehicle, lower, card, restStand, restClip,
      };
    },

    render(t, ctx, S) {
      const T = S.T;
      // ---------------- b01: title card, tiles, lower third
      S.card.update({ t, tIn: T.card, tWipe: T.wipe });
      S.lower.update({ t, times: T.lt });
      const tilesOut = T.b2 + 0.35;
      const tileX = [140, 560, 980, 1400];
      S.tiles.forEach((d, i) => {
        const on = t >= T.tiles[i] - 0.05 && t <= tilesOut + 0.05;
        Kit.show(d.wrap, on);
        if (!on) return;
        place(d.wrap, { x: tileX[i], y: 300 + Math.sin(t * 2 * Math.PI / 3.2 + i * 1.3) * 1 });
        d.tile.update({ t, tIn: T.tiles[i], tOut: tilesOut });
        if (i === 1) {
          S.proWorker.update({ pose: 'neat', t });
          S.proStar.update({ t, tIn: T.tiles[1] + 0.25 });
        }
        if (i === 3) {
          S.rackMini.update({ state: 'stocked', bins: S.noLabels, t });
          S.lock.update({ p: lin(t, T.tiles[3] + 0.25, 0.3), open: 0 });
        }
      });

      // floor (from b02 to the end)
      show(S.floorG, t, T.b2 + 0.05, null, { rise: 0 });

      // ---------------- b02: daily housekeeping stage
      const out2 = T.b3 + 0.35;
      const in2 = T.b2 + 0.25;
      if (t >= in2 - 0.05 && t <= out2 + 0.05) {
        const it = S.st2Items;
        const order = ['cab', 'clock', 'dump', 'debris', 'pan', 'can'];
        order.forEach((k, i) => {
          const o = it[k];
          if (k === 'can') return;
          show(o.g, t, in2 + 0.08 * i, out2, { x: o.x, y: o.y, s: o.s });
        });
        // cabinet dusting
        const dp = lin(t, T.dust, 1.7);
        S.cabinet.update({ dusted: dp, duster: Math.min(lin(t, T.dust - 0.2, 0.2), 1 - lin(t, T.dust + 1.7, 0.25)), t });
        // clock: 4:40, then the hands run on to 5:00 and the end-of-shift moon pops
        const m = lerp(40, 60, inout(t, T.shift, 0.8));
        S.clock.update({ t, state: t >= T.shift + 0.7 ? 'end-of-shift' : 'idle', tState: T.shift + 0.7, time: [4 + Math.floor(m / 60), m % 60], label: 'End of shift' });
        // debris cleared by the broom (computed from the Worker below)
        // trash can lifts to the dumpster rim, tips, returns
        const c = it.can, tr = T.trash;
        const up = inout(t, tr, 0.6) * (1 - inout(t, tr + 1.9, 0.6));
        const rim = [1730 - 95 - 38 * 0.9, 745 - 146 * 0.95];
        const cx = lerp(c.x, rim[0], up), cy = lerp(c.y, rim[1], up) - 40 * Math.sin(Math.PI * up) * (t < tr + 1.2 ? 1 : 0);
        show(c.g, t, in2 + 0.4, out2, { x: cx, y: cy, s: c.s });
        const tip = lin(t, tr + 0.6, 0.45) * (1 - lin(t, tr + 1.45, 0.4));
        S.can2.update({ tip, t });
        Kit.show(S.canScraps, t < tr + 0.85);
        S.dumpster.update({ lid: lin(t, tr + 0.2, 0.35) * (1 - lin(t, tr + 1.7, 0.35)) });
        S.dumpScraps.forEach((g, i) => {
          const k = lin(t, tr + 0.85 + i * 0.08, 0.45);
          const p = arc([-30 + i * 18, -150], [-10 + i * 26, -60], Kit.ease.linear(k), -10);
          set(g, { transform: `translate(${r2(p[0])} ${r2(p[1])})` });
          Kit.show(g, k > 0 && k < 1);
        });
        S.dustpan.update({ angle: 0 });
      } else {
        Object.values(S.st2Items).forEach(o => Kit.show(o.g, false));
      }

      // ---------------- b03: spill and hose press
      const out3 = T.b4 + 0.35, in3 = T.b3 + 0.3;
      if (t >= in3 - 0.05 && t <= out3 + 0.05) {
        const it = S.st3Items;
        show(it.spill.g, t, T.spillIn, out3, { x: it.spill.x, y: it.spill.y, rise: 0 });
        const sz = 1 - lin(t, T.mop + 0.3, 1.5);
        S.spill.update({ size: sz, outline: sz > 0.02 ? 'error' : null, t });
        const mopO = show(it.mop.g, t, T.mop, T.mopEnd + 0.4, { x: it.mop.x + 10 * Math.sin(Math.min(t, T.mopEnd) * 3), y: it.mop.y - 30 * (1 - ent(t, T.mop, 0.4)), s: it.mop.s, rise: 0 });
        if (mopO > 0) S.mop.update({ wiping: t > T.mop + 0.3 && t < T.mopEnd, t, angle: -8 });
        Kit.show(S.spillCheckG, true); Kit.show(S.hoseCheckG, true);
        place(S.spillCheckG, { x: it.spill.x, y: it.spill.y - 70 }); S.spillCheck.update({ t, tIn: T.mopEnd - 0.1, tOut: out3 });
        show(it.press.g, t, in3 + 0.15, out3, { x: it.press.x, y: it.press.y, s: it.press.s });
        show(it.hook.g, t, in3 + 0.25, out3, { x: it.hook.x, y: it.hook.y, s: it.hook.s });
        show(it.offcuts.g, t, in3 + 0.3, out3, { x: it.offcuts.x, y: it.offcuts.y });
        S.offcuts.update({ clear: lin(t, T.clean, 0.8), t });
        S.press.update({ press: 0, t });
        S.hook.update({ wind: lin(t, T.wind, 1.6), t });
        place(S.hoseCheckG, { x: it.hook.x - 100, y: it.hook.y - 330 }); S.hoseCheck.update({ t, tIn: T.wind + 1.6, tOut: out3 });
      } else {
        Object.values(S.st3Items).forEach(o => Kit.show(o.g, false));
        Kit.show(S.spillCheckG, false); Kit.show(S.hoseCheckG, false);
      }

      // ---------------- b04: untidy conditions
      const out4 = T.b5 + 0.35, in4 = T.b4 + 0.3;
      // Worker reach/hand anchors are needed by the stage, so the b04 Worker state is computed first.
      let wk4 = null;
      if (t >= in4 - 0.05 && t <= out4 + 0.05) wk4 = worker4(t, T, S);
      renderWorker(t, T, S, wk4);
      if (t >= in4 - 0.05 && t <= out4 + 0.05) {
        const it = S.st4Items;
        show(it.rack.g, t, in4, out4, { x: it.rack.x, y: it.rack.y, s: it.rack.s });
        const bins = { ...S.noLabels, 2: { label: null, content: 'none' }, 5: { label: null, content: 'none' } };
        S.rack.update({ state: 'stocked', bins, t });
        show(it.can.g, t, in4 + 0.1, out4, { x: it.can.x, y: it.can.y, s: it.can.s });
        show(it.pallet.g, t, in4 + 0.2, out4, { x: it.pallet.x, y: it.pallet.y, s: it.pallet.s });
        S.pallet.update({ count: 4, t });
        const cutP = lin(t, T.cut, 0.9);
        S.strap.update({ cut: cutP, t });
        Kit.show(S.strap.g, t < T.pick + 0.5);
        set(S.strap.g, { opacity: r2(1 - lin(t, T.pick + 0.42, 0.1)) });
        // empty box + bag: slide out of the bin, hop into the can
        const binPos = S.rack.bin(2), bx = it.rack.x + binPos.x * it.rack.s, by = it.rack.y + binPos.y * it.rack.s;
        const k1 = ent(t, T.box, 0.45), k2 = lin(t, T.box + 0.45, 0.7), k3 = lin(t, T.box + 1.15, 0.35);
        let bp = [bx + 30 * k1, by];
        if (k2 > 0) bp = arc([bx + 30, by], [1370, 742], Engine.ease.inOut(k2), 70);
        if (k3 > 0) bp = [1370, 742 + 90 * Engine.ease.in(k3)];
        set(S.boxG, { transform: `translate(${r2(bp[0])} ${r2(bp[1])}) scale(${r2(0.62 * (1 - 0.25 * k2))})` });
        Kit.show(S.boxG, k3 < 1);
        S.emptyBox.update({ empty: true, open: 1, t });
        // cup + can on the middle shelf, then in the hand, then dropped into the can
        const shelf = S.rack.bin(5), sx = it.rack.x + shelf.x * it.rack.s, sy = it.rack.y + shelf.y * it.rack.s;
        const tc = T.cup;
        const onShelf = t < tc + 0.7;
        const drop = lin(t, tc + 1.85, 0.35);
        const hand = wk4 && wk4.hand;
        const dropFrom = [1362, 736];
        set(S.cupG, { transform: onShelf ? `translate(${r2(sx - 14)} ${r2(sy)}) scale(0.62)` : `translate(${r2(dropFrom[0] - 8)} ${r2(dropFrom[1] + 20 + 80 * Engine.ease.in(drop))}) scale(0.62)` });
        set(S.tinG, { transform: onShelf ? `translate(${r2(sx + 14)} ${r2(sy)}) scale(0.62)` : `translate(${r2(dropFrom[0] + 8)} ${r2(dropFrom[1] + 22 + 80 * Engine.ease.in(drop))}) scale(0.62)` });
        const cupVis = onShelf || (drop > 0 && drop < 1);
        Kit.show(S.cupG, cupVis); Kit.show(S.tinG, cupVis);
        const carryCup = t >= tc + 0.7 && t < tc + 1.85;
        Kit.show(S.handCupG, carryCup && !!hand);
        if (carryCup && hand) place(S.handCupG, { x: hand[0], y: hand[1], s: 0.62 });
        // strap: carried bundle, then dropped
        const tp = T.pick;
        const carryStrap = t >= tp + 0.45 && t < tp + 1.65;
        Kit.show(S.handStrapG, carryStrap && !!hand);
        if (carryStrap && hand) place(S.handStrapG, { x: hand[0], y: hand[1] + 6, s: 0.8 });
        const sdrop = lin(t, tp + 1.65, 0.35);
        const sFrom = [1362, 736];
        set(S.strapFallG, { transform: `translate(${r2(sFrom[0])} ${r2(sFrom[1] + 14 + 80 * Engine.ease.in(sdrop))}) scale(0.8)` });
        Kit.show(S.strapFallG, sdrop > 0 && sdrop < 1);
        // can lid opens around each drop
        const lidOpen = Math.max(
          lin(t, T.box + 0.8, 0.25) * (1 - lin(t, T.box + 1.6, 0.3)),
          lin(t, tc + 1.45, 0.25) * (1 - lin(t, tc + 2.25, 0.3)),
          lin(t, tp + 1.3, 0.25) * (1 - lin(t, tp + 2.05, 0.3)));
        S.can4.update({ lid: lidOpen, t });
        // scissors snip the strap
        const so = show(it.scis.g, t, T.scis + 0.1, T.cut + 0.7, { x: it.scis.x, y: it.scis.y, s: it.scis.s, rise: 0, dx: -24 });
        if (so > 0) {
          const sn = t - (T.cut - 0.55);
          const open = sn < 0 ? 0.9 : sn < 0.6 ? 0.45 + 0.45 * Math.cos(sn / 0.3 * 2 * Math.PI) : 0;
          S.scissors.update({ open });
        }
        Kit.show(S.palletCheckG, true);
        place(S.palletCheckG, { x: it.pallet.x + 30, y: 586 }); S.palletCheck.update({ t, tIn: tp + 1.9, tOut: out4 });
      } else {
        Object.values(S.st4Items).forEach(o => Kit.show(o.g, false));
        Kit.show(S.handCupG, false); Kit.show(S.handStrapG, false); Kit.show(S.palletCheckG, false);
      }

      // ---------------- b05: three-panel strip
      const out5 = T.b6 + 0.35;
      const pIn = [T.p1, T.p2, T.p3];
      const pMark = [T.dispose + 0.9, T.move + 1.8, T.p3Mark];
      if (t >= T.p1 - 0.05 && t <= out5 + 0.05) {
        S.panels.forEach((P, i) => {
          place(P.g, { x: Kit.stripX(3, 520, 40)[i], y: 196 });
          Kit.show(P.g, t >= pIn[i] - 0.05);
          P.p.update({ t, tIn: pIn[i], tOut: out5, from: 'below', mark: 'check', tMark: pMark[i] });
        });
        // panel 1
        const gy = S.g1;
        const bo = 1 - ent(t, T.swap, 0.35);
        place(S.brokenG, { x: 215 - 40 * (1 - bo), y: gy, s: 0.9, o: bo }); Kit.show(S.brokenG, bo > 0.001);
        S.brokenPallet.update({ count: 4, broken: lin(t, T.broken, 0.6), outline: t > T.broken ? 'error' : null, t });
        const gi = ent(t, T.swap + 0.25, 0.5);
        place(S.goodG, { x: 215 + 60 * (1 - gi), y: gy, s: 0.9, o: gi }); Kit.show(S.goodG, gi > 0.001);
        S.goodPallet.update({ count: 4, t });
        place(S.p1X, { x: 240, y: 108 }); S.p1Xm.update({ t, tIn: T.broken + 0.5, tOut: T.swap + 0.3 });
        place(S.p1C, { x: 240, y: 108 }); S.p1Cm.update({ t, tIn: T.swap + 0.75 });
        // splinters left on the floor, gathered, then dropped into the can (in stage-of-panel coords)
        const sv = t >= T.swap + 0.05;
        const flyK = lin(t, T.dispose, 0.6), fall = lin(t, T.dispose + 0.6, 0.3);
        let sp = [78, gy - 2];
        if (flyK > 0) sp = arc([78, gy - 2], [440, gy - 120], Engine.ease.inOut(flyK), 90);
        if (fall > 0) sp = [440, gy - 120 + 90 * Engine.ease.in(fall)];
        set(S.splG, { transform: `translate(${r2(sp[0])} ${r2(sp[1])}) scale(${r2(1 - 0.35 * flyK)})`, opacity: r2(lin(t, T.swap + 0.05, 0.3)) });
        Kit.show(S.splG, sv && fall < 1);
        S.splinters.update({ spread: 1 - ent(t, T.gather, 0.5) });
        S.can5.update({ lid: lin(t, T.dispose + 0.2, 0.25) * (1 - lin(t, T.dispose + 1.0, 0.3)), t });
        // panel 2
        const zy = S.zoneY;
        const mv = inout(t, T.move, 0.9);
        const from = [[214, S.g2 - 60], [300, S.g2 - 60]], to = [[352, zy - 10], [436, zy - 10]];
        S.ovCartons.forEach((c, i) => {
          const p = arc(from[i], to[i], mv, 20);
          place(c.g, { x: p[0], y: p[1], s: 0.72 });
          c.c.update({ outline: mv < 0.95 && t > T.p2 ? 'error' : null, t });
        });
        S.rack2.update({ state: 'stocked', bins: S.noLabels, t });
        place(S.ovTagG, { x: to[0][0] - 32, y: to[0][1] - 60 });
        Kit.show(S.ovTagG, t >= T.move + 0.9);
        S.ovTag.update({ on: lin(t, T.move + 0.9, 0.8), t });
        place(S.p2X, { x: 258, y: S.g2 - 150 }); S.p2Xm.update({ t, tIn: T.never + 0.2, tOut: T.move + 0.2 });
        set(S.ovZone.line, { 'stroke-dashoffset': r2(-t * 6) });
        // panel 3
        S.zones3.forEach((z, i) => {
          const tc = T.clear[i];
          const k = lin(t, tc, 0.5);
          place(S.strays[i].g, { x: S.iconX[i] + 4 + 40 * Engine.ease.in(k), y: S.g3 + 70 + 70 * Engine.ease.in(k), s: 0.62, o: 1 - k });
          Kit.show(S.strays[i].g, k < 1);
          S.strays[i].c.update({ outline: 'error', t });
          const f = lin(t, tc + 0.45, 0.6);
          set(z.bg, { opacity: r2(f > 0 ? 0.25 + 0.35 * Math.sin(Math.PI * Math.min(1, f * 1.0)) : 0) });
          set(z.line, { stroke: f > 0 ? C.correct : C.inkSoft, 'stroke-width': f > 0 ? 4 : 3 });
          place(S.clearChecks[i].g, { x: S.iconX[i], y: S.g3 - 238 });
          S.clearChecks[i].m.update({ t, tIn: tc + 0.55 });
        });
      } else {
        S.panels.forEach(P => Kit.show(P.g, false));
      }

      // ---------------- b06-b07: forklifts
      const out7 = T.b8 + 0.35;
      if (t >= T.fkIn - 0.05 && t <= out7 + 0.05) {
        // A: drives in and stops, then moves to the right for the do/don't and stays for b07
        // steady 400 px/s, then a 0.8 s quadratic stop over the last 160 px
        const cruise = T.fkStop - 0.8;
        let ax = t < cruise ? -280 + 400 * Math.max(0, t - T.fkIn) : 600 + 160 * (1 - (1 - lin(t, cruise, 0.8)) ** 2);
        if (t > T.aMove) ax = lerp(760, 1250, inout(t, T.aMove, 1.4));
        const moving = (t > T.fkIn && t < T.fkStop - 0.15) || (t > T.aMove && t < T.aMove + 1.25);
        const oA = show(S.fkAG, t, T.fkIn, out7, { x: ax, y: 820, rise: 0 });
        if (oA > 0) {
          const tagged = t >= T.tag;
          const drv = 1 - lin(t, T.b7, 0.35);
          if (S.fkA.driver) set(S.fkA.driver.g, { opacity: r2(drv) });
          S.fkA.update({ state: tagged ? 'tagged-out' : moving ? 'driving' : 'idle', t, dist: ax + 280, tag: tagged ? lin(t, T.tag, 0.9) : 0, desat: tagged ? ent(t, T.tag + 0.6, 0.7) : 0, driver: drv > 0.001 });
        }
        // B: speeds in from the left, stays "speeding" in place, exits at b07
        const bx = Engine.keys(t, [[T.speed + 0.1, -320], [T.speed + 0.9, 470]], Kit.ease.enter);
        const oB = show(S.fkBG, t, T.speed + 0.1, T.b7 + 0.35, { x: bx, y: 820, rise: 0 });
        if (oB > 0) S.fkB.update({ state: 'speeding', t });
        S.badges.forEach((b, i) => {
          place(b.g, { x: [480, 760, 1040][i], y: 430 });
          b.b.update({ t, tIn: T.badges[i], tOut: T.speed - 0.1 });
        });
        S.heading6.update({ t, tIn: T.speed, tOut: T.b7 + 0.35 });
        place(S.xB, { x: 470, y: 440 }); S.xBm.update({ t, tIn: T.speed + 0.95, tOut: T.b7 + 0.35 });
        place(S.okA, { x: 1250, y: 440 }); S.okAm.update({ t, tIn: T.speed + 1.7, tOut: T.b7 + 0.35 });
        // b07 callouts
        place(S.tagCallG, { x: 1300, y: 836 }); S.tagCall.update({ t, tIn: T.tag + 0.7, tOut: out7 });
      } else {
        Kit.show(S.fkAG, false); Kit.show(S.fkBG, false);
        S.badges.forEach(b => b.b.update({ t, tIn: INF }));
        S.heading6.update({ t, tIn: INF }); S.xBm.update({ t, tIn: INF }); S.okAm.update({ t, tIn: INF }); S.tagCall.update({ t, tIn: INF });
      }

      // ---------------- checklists
      const ckDaily = { t, tIn: T.b2 + 0.15, tOut: T.b4 + 0.35, ticks: T.dailyTicks };
      // Kit.Checklist's glow computes cos(t - done); a missing `done` gives NaN on the hidden glow, so
      // pass a finite far-future time when the list is not complete.
      const NEVER = 1e6;
      S.daily.update(ckDaily);
      if (t > T.b4 && t < T.b5 + 0.5) S.untidy.update({ t, tIn: T.b4 + 0.35, tOut: T.b5 + 0.35, ticks: T.untidyTicks }); else S.untidy.update({ t, tIn: NEVER, done: NEVER });
      const inspTicks = [T.insp + 1.0, T.insp + 2.6, T.insp + 4.2];
      if (t > T.b7 && t < T.b8 + 0.5) S.insp.update({ t, tIn: T.b7 + 0.3, tOut: T.b8 + 0.35, ticks: inspTicks, fails: [null, null, null, T.fail], done: NEVER }); else S.insp.update({ t, tIn: NEVER, done: NEVER });
      place(S.brakeG, { x: S.brakeX, y: S.brakeY }); S.brake.update({ t, tIn: T.fail + 0.15, tOut: T.b8 + 0.35 });
      const vRows = [T.cleanV - 0.3, T.loopGo, T.gauge, T.trained - 0.2].map((v, i) => Math.max(v, T.b8 + 0.7 + 0.35 * i));
      const vTicks = [T.cleanV + 1.0, T.loopGo + 0.8 + S.ringL / 320 + 0.2, T.fill + 1.5, T.trained + 0.6];
      S.vehicle.update({ t, tIn: T.b8 + 0.35, ticks: vTicks });

      // ---------------- b07-b08 callouts and van
      place(S.repCallG, { x: 1530, y: 540 }); S.repCall.update({ t, tIn: T.report + 0.3, tOut: out7 });
      place(S.exclG, { x: 1372, y: 470 }); S.excl.update({ t, tIn: T.report + 0.45, tOut: out7 });
      const vanOn = t >= T.van - 0.05;
      if (vanOn) {
        const vx = Engine.keys(t, [[T.van, -420], [T.van + 1.6, 1000]], Kit.ease.enter);
        show(S.vanG, t, T.van, null, { x: vx, y: 820, rise: 0 });
        const sparkle = S.van.sparkleAt.map((_, i) => Kit.ease.pop(lin(t, T.cleanV + 0.12 * i, 0.3)));
        const dentK = lin(t, T.note - 1.0, 0.3);
        S.van.update({ dist: vx + 420, sparkle, dent: dentK, t });
        // gauge + nozzle
        show(S.gaugeG, t, T.gauge, null, { x: 1000, y: 410 });
        const fillK = inout(t, T.fill, 1.4);
        S.gauge.update({ v: lerp(0.44, 1, fillK) + 0.006 * Math.sin(t * 3) * (1 - fillK) });
        // nozzle in the van's fuel cap (mirrored so it hangs off the rear); a small pump pulse while filling
        const pumping = Math.min(lin(t, T.fill, 0.2), 1 - lin(t, T.fill + 1.4, 0.2));
        const nz = show(S.nozG, t, T.fill - 0.6, null, { x: vx - 196, y: 820 - 160, s: [-1, 1], r: 3 * pumping * Math.sin(t * 2 * Math.PI * 2.5), dx: -24, rise: 0 });
        if (nz > 0) S.nozzle.update({ pour: 0, t });
        place(S.gaugeCheckG, { x: 1118, y: 300 }); S.gaugeCheck.update({ t, tIn: T.fill + 1.45 });
        // dotted walk-around ring draws as the Worker walks it
        const walked = clamp((t - (T.loopGo + 0.8)) * 320, 0, S.ringL);
        const drawn = walked / S.ringL;
        S.dots.forEach((d, i) => { const on = (i + 0.5) / S.NDOT <= drawn; Kit.show(d, on); });
        // the note flies from the dent to the Supervisor
        const nk = lin(t, T.note, 0.9);
        const dent = [vx + S.van.dentAt[0], 820 + S.van.dentAt[1] - 40];
        const np = arc(dent, [1700, 640], Engine.ease.inOut(nk), 180);
        const no = Kit.ease.pop(lin(t, T.note - 0.7, 0.25)) * (1 - lin(t, T.note + 0.85, 0.2));
        place(S.noteG, { x: np[0], y: np[1], s: Math.max(0.001, 1.3 * no * (1 - 0.3 * nk)), r: -8 + 8 * nk, o: clamp(no * 3) });
        Kit.show(S.noteG, no > 0.001);
      } else {
        Kit.show(S.vanG, false); Kit.show(S.gaugeG, false); Kit.show(S.nozG, false); Kit.show(S.noteG, false);
        S.gaugeCheck.update({ t, tIn: INF });
        S.dots.forEach(d => Kit.show(d, false));
      }

      // ---------------- characters
      Kit.show(S.trainedG, t >= T.trained - 0.05);
      S.trained.update({ t, tIn: T.trained });
      // supervisor (b07-b08)
      const so = show(S.supG, t, T.b7 + 0.3, null, { x: 1730, y: 820 });
      if (so > 0) {
        const nodAt = [T.nod7, T.note + 0.9];
        let nod = 0;
        nodAt.forEach(n => { const u = t - n; if (u > 0 && u < 1.0) nod = Math.max(nod, Math.sin(u / 0.5 * Math.PI) ** 2); });
        S.sup.update({ pose: 'stand', t, facing: -1, nod });
      }
    },
  });

  // ------------------------------------------------------------------ Worker choreography
  // b04: reach the shelf for a cup and can, bin them; squat for the cut strap, bin it.
  function worker4(t, T, S) {
    const s = 0.85, y = 832, tc = T.cup, tp = T.pick;
    const x = Engine.keys(t, [[tc, 1260], [tc + 0.3, 1180], [tc + 1.05, 1180], [tc + 1.5, 1300], [T.walkP0, 1300], [T.walkP1, 1490], [tp + 1.0, 1490], [tp + 1.3, 1430]], Kit.ease.linear);
    const walking = Math.max(during(t, tc, tc + 0.3), during(t, tc + 1.05, tc + 1.5), during(t, T.walkP0, T.walkP1), during(t, tp + 1.0, tp + 1.3));
    const facing = t < tc + 1.0 ? -1 : t < tp + 0.95 ? 1 : -1;
    const loc = (sx, sy) => [(sx - x) / s * facing, (sy - y) / s];
    const rest = S.restStand;
    const shelf = S.rack.bin(5), shelfP = [S.st4Items.rack.x + shelf.x * 0.62, S.st4Items.rack.y + shelf.y * 0.62 - 14];
    const over = loc(1362, 736);
    const carry = [34, -112];
    const seg = (a, b, p0, p1) => (t >= a && t < b ? [lerp(p0[0], p1[0], Kit.ease.enter((t - a) / (b - a))), lerp(p0[1], p1[1], Kit.ease.enter((t - a) / (b - a)))] : null);
    const shelfL = loc(shelfP[0], shelfP[1]);
    const reach = seg(tc + 0.3, tc + 0.65, rest, shelfL) || seg(tc + 0.65, tc + 0.7, shelfL, shelfL) || seg(tc + 0.7, tc + 0.95, shelfL, carry)
      || seg(tc + 0.95, tc + 1.5, carry, carry) || seg(tc + 1.5, tc + 1.8, carry, over) || seg(tc + 1.8, tc + 1.85, over, over) || seg(tc + 1.85, tc + 2.15, over, rest)
      || seg(tp + 0.7, tp + 1.3, carry, carry) || seg(tp + 1.3, tp + 1.55, carry, over) || seg(tp + 1.55, tp + 1.65, over, over) || seg(tp + 1.65, tp + 1.95, over, rest);
    const pose = Kit.Worker.poseAt(t, [[-INF, 'stand'], [tp, 'lift-bent-knees'], [tp + 0.65, 'stand']], 0.25);
    return { x, y, s, facing, walking, reach, pose };
  }

  function renderWorker(t, T, S, wk4) {
    const wk = S.wk;
    let st = null;
    // b02: sweep the dock floor, then stand neat
    if (t >= T.b2 && t <= T.b3 + 0.4) {
      const x = Engine.keys(t, [[T.walk0, 1040], [T.walk1, 1040 + T.walkDist]], Kit.ease.linear);
      const pose = Kit.Worker.poseAt(t, [[-INF, 'stand'], [T.sweep, 'sweep'], [T.walk1 + 0.15, 'neat'], [T.walk1 + 2.2, 'stand']], 0.2);
      st = { x, y: 872, s: 0.95, tIn: T.b2 + 0.35, tOut: T.b3 + 0.35, debris: true, p: { ...pose, walking: during(t, T.walk0, T.walk1), stride: 0.45, facing: 1 } };
    } else if (wk4) {
      st = { x: wk4.x, y: wk4.y, s: wk4.s, tIn: T.box + 1.3, tOut: T.b5 + 0.35, p: { ...wk4.pose, walking: wk4.walking, stride: 0.85, facing: wk4.facing, reach: wk4.reach || undefined, prop: (wk4.pose.pose === 'lift-bent-knees' || wk4.pose.from === 'lift-bent-knees') ? false : undefined } };
    } else if (t >= T.b7) {
      st = worker78(t, T, S);
    }
    Kit.show(S.wkBackG, false);
    if (!st) { Kit.show(S.wkG, false); if (wk4) wk4.hand = null; return; }
    const o = show(S.wkG, t, st.tIn, st.tOut, { x: st.x, y: st.y, s: st.s });
    if (st.back) {
      // back half of the walk-around: the copy behind the van takes over
      Kit.show(S.wkG, false);
      show(S.wkBackG, t, -INF, null, { x: st.x, y: st.y, s: st.s, rise: 0 });
      S.wkBack.update({ ...st.p, t, stroke: 2.5 / st.s });
      return;
    }
    if (o <= 0) { if (wk4) wk4.hand = null; return; }
    const a = wk.update({ ...st.p, t, stroke: 2.5 / st.s });
    if (wk4) wk4.hand = [st.x + a.hand[0] * st.s, st.y + a.hand[1] * st.s];
    if (st.debris) {
      const tip = st.x + (a.prop ? a.prop[0] : 100) * st.s;
      const it = S.st2Items.debris;
      const u = (tip - (it.x - 170)) / 340;
      S.debris.update({ clear: clamp((u + 0.12) / 1.15), t });
    }
    if (st.badge) {
      place(S.trainedG, { x: st.x + a.chest[0] * st.s, y: st.y + a.chest[1] * st.s + st.badge.dy });
    }
  }
  // b07-b08: inspection walk with the clipboard, report, then the vehicle walk-around.
  function worker78(t, T, S) {
    const y0 = 820, s = 1;
    const i0 = T.insp;
    // b07 inspection stops: rear (980), cab (1230), forks (1520)
    let x = Engine.keys(t, [[i0 + 1.0, 980], [i0 + 1.9, 1230], [i0 + 2.6, 1230], [i0 + 3.6, 1520]], Kit.ease.linear);
    let y = y0;
    let walking = Math.max(during(t, i0 + 1.0, i0 + 1.9), during(t, i0 + 2.6, i0 + 3.6));
    let facing = t < i0 + 3.65 ? 1 : t < T.report ? -1 : 1;
    const writing = (t > i0 + 0.2 && t < i0 + 0.95) || (t > i0 + 1.95 && t < i0 + 2.55) || (t > i0 + 3.7 && t < i0 + 4.3);
    let stride = 0.8, back = false;
    const p = { pose: 'hold-clipboard', writing };
    if (t >= T.b8) {
      // walk to the ring's right end, then once round the van, then stand
      const g0 = T.loopGo, g1 = g0 + 0.8;
      const start = S.ringPt(0);
      if (t < g1) {
        x = Engine.keys(t, [[g0, 1520], [g1, start[0]]], Kit.ease.linear);
        y = Engine.keys(t, [[g0, y0], [g1, start[1]]], Kit.ease.linear);
        walking = during(t, g0, g1); facing = t < g0 ? 1 : -1; stride = 0.75;
      } else {
        const walked = clamp((t - g1) * 320, 0, S.ringL);
        const th = S.thetaAt(walked);
        const pt = S.ringPt(th);
        x = pt[0]; y = pt[1];
        const loopOn = walked < S.ringL;
        walking = loopOn ? during(t, g1, g1 + S.ringL / 320) : 0;
        facing = th < Math.PI ? -1 : 1;
        if (!loopOn) facing = 1;
        back = loopOn && th > Math.PI + 0.02 && th < 2 * Math.PI - 0.02;
        stride = 320 / Kit.Worker.WALK_SPEED;
      }
      p.writing = false;
    }
    const st = { x, y, s, tIn: T.wIn, tOut: null, back, p: { ...p, walking, stride, facing } };
    // Task trained badge settles on the chest
    if (t >= T.trained - 0.05) st.badge = { dy: -40 * (1 - Kit.ease.enter(lin(t, T.trained, 0.6))) };
    return st;
  }
})();
