// Kit: objects. Dock, storage, parts, housekeeping and hose-shop objects
// (STYLE.md §6 items 2–12, 28, 31, 32, 38). Contract: build/AGENT_BRIEF.md.
//
// Conventions shared by every factory in this file:
// - Kit.Name(parent, options) returns {g, update(params), ...}. Every node is made in the factory;
//   update() only sets attributes, text and display, and never touches g's transform or opacity
//   (place, scale and fade g with Engine.place).
// - Animation params are progress values 0..1. Drive them linearly (e.g. Engine.prog(t, t0, d,
//   Kit.ease.linear)); each component applies its own STYLE easing, overshoot or settle inside.
//   `t` (scene seconds) only drives idle life and cycles (wheels, sway, pulses), so update() is a
//   pure function of params.
// - Isometric: every boxy object uses the same oblique-isometric projection. Front faces are flat
//   (labels stay legible) and depth recedes up-right at 30 degrees: a depth d moves a point by
//   (+0.866 d, -0.5 d). Kit.iso(x, y, z) gives that projection (y up, z = depth away from viewer).
// - Origins: grounded objects are bottom-centre of the FRONT face on the floor line (depth extends
//   up-right of it); icons are centre; exceptions are stated in each header.
// - `outline` params draw a coloured halo round the silhouette: 'error' | 'correct' | 'accent' |
//   'neutral' or null. 'error' halos pulse (opacity 1 -> 0.6 -> 1 per second) when t is given.
(() => {
  const { el, set, clamp, lerp } = Engine;
  const { C, ease, text, show, measure } = Kit;
  const SW = Kit.STROKE;
  const CS = Math.cos(Math.PI / 6), SN = 0.5;
  // Oblique projection: x right, y up, z depth (away from the viewer) -> screen [X, Y].
  const P = (x, y, z = 0) => [x + z * CS, -y - z * SN];
  const r1 = v => Math.round(v * 10) / 10;
  const dPoly = (ps, close = true) => (ps.length ? 'M' + ps.map(q => `${r1(q[0])} ${r1(q[1])}`).join('L') + (close ? 'Z' : '') : 'M0 0');
  const dCircle = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;
  const dRect = (x, y, w, h, r = 0) => {
    if (!r) return `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
    r = Math.min(r, w / 2, h / 2);
    return `M${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}V${r1(y + h - r)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)}H${r1(x + r)}Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)}V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Z`;
  };
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const fmod = (a, b) => ((a % b) + b) % b;
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    p = clamp(p);
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
  };
  let uid = 0;
  const uniq = p => `kobj-${p}-${++uid}`;
  const INK = (extra = {}) => ({ stroke: C.ink, 'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
  const tf = (x = 0, y = 0, s = 1, r = 0) => `translate(${r1(x)} ${r1(y)})${r ? ` rotate(${r1(r)})` : ''}${s !== 1 ? ` scale(${(Array.isArray(s) ? s : [s, s]).map(v => v.toFixed(4)).join(' ')})` : ''}`;
  // Centred text: y is the visual middle of the caps.
  const ctext = (parent, str, x, cy, size, weight = 600, fill = C.ink, anchor = 'middle') =>
    text(parent, str, { x, y: cy + size * 0.36, size, weight, fill, anchor });
  const pulse = t => (t == null ? 1 : 0.8 + 0.2 * Math.cos(2 * Math.PI * t));
  const HL = { error: C.error, correct: C.correct, accent: C.accent, neutral: C.neutral };
  const haloNode = (parent, width = 10) => el('path', { fill: 'none', 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', display: 'none' }, parent);
  function setHalo(node, d, hl, t) {
    if (!hl) { show(node, false); return; }
    set(node, { d, stroke: HL[hl] || hl, opacity: hl === 'error' ? pulse(t) : 1, display: 'inline' });
  }
  // Damped wobble after an impact: q 0..1 -> decaying oscillation in [-1, 1].
  const wobble = (q, cycles = 2, decay = 4) => (q <= 0 || q >= 1 ? 0 : Math.exp(-decay * q) * Math.sin(2 * Math.PI * cycles * q));
  // Tones derived from the palette (flat fills only).
  const T = {
    top: mix(C.carton, C.paper, 0.3), inside: mix(C.cartonEdge, C.ink, 0.5), insideBack: mix(C.carton, C.ink, 0.22),
    insideSide: mix(C.cartonEdge, C.ink, 0.32), tape: mix(C.carton, C.paper, 0.55), hole: mix(C.cartonEdge, C.ink, 0.6),
    steelTop: mix(C.steel, C.paper, 0.32), steelSide: mix(C.steel, C.steelDark, 0.5), steelLight: mix(C.steel, C.paper, 0.55),
    darkTop: mix(C.steelDark, C.paper, 0.22), darkSide: mix(C.steelDark, C.ink, 0.35), rear: mix(C.steelDark, C.bgLight, 0.42),
    concrete: mix(C.floor, C.steel, 0.38), rust: C.shirt.customer, dull: mix(C.steel, C.floor, 0.6), rubber: mix(C.ink, C.steelDark, 0.35),
    window: C.onDarkSoft, puddle: mix(C.ink, C.steelDark, 0.35),
  };

  // Extrude a flat profile (screen coords, front face at z = 0) by depth d: the visible connecting
  // faces (those facing up or right) and then the front face. Static geometry, built once.
  function extrude(parent, pts, d, { front, top, side, sw = SW } = {}) {
    const g = el('g', {}, parent);
    const off = [d * CS, -d * SN];
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
      const nx = (sgn * ey) / len, ny = (-sgn * ex) / len; // outward normal in screen coords
      if (nx * CS - ny * SN <= 0.02) continue;
      const quad = [a, b, [b[0] + off[0], b[1] + off[1]], [a[0] + off[0], a[1] + off[1]]];
      el('path', { d: dPoly(quad), fill: ny < -0.5 ? top : side, ...INK({ 'stroke-width': sw }) }, g);
    }
    el('path', { d: dPoly(pts), fill: front, ...INK({ 'stroke-width': sw }) }, g);
    return g;
  }

  // ---------- Hanging tag (shared by Tag, OverstockTag, PriceTag and the NEW/CORE part tags) ----------
  // Origin: the string's attachment point. The body hangs below-right of it.
  function buildTag(parent, { lines, size = 22, weight = 700, fill = C.paper, textFill = C.ink, minW = 90, minH = 60, string = 34, arrow = false }) {
    const tw = Math.max(...lines.map(s => measure(s, size, weight)));
    const w = Math.max(minW, tw + 52), lh = size * 1.18, h = Math.max(minH, lines.length * lh + 18);
    const ex = string * 0.35, ey = string * 0.94;
    const g = el('g', {}, parent);
    const body = el('g', { transform: tf(ex, ey, 1, 9) }, g);
    const x0 = -14, x1 = w - 14;
    const shape = `M${x0} ${r1(-h / 2 + 12)}L${x0 + 12} ${r1(-h / 2)}H${r1(x1 - 6)}Q${r1(x1)} ${r1(-h / 2)} ${r1(x1)} ${r1(-h / 2 + 6)}V${r1(h / 2 - 6)}Q${r1(x1)} ${r1(h / 2)} ${r1(x1 - 6)} ${r1(h / 2)}H${x0 + 12}L${x0} ${r1(h / 2 - 12)}Z`;
    el('path', { d: shape, fill, ...INK() }, body);
    el('circle', { cx: 0, cy: 0, r: 6, fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, body);
    el('circle', { cx: 0, cy: 0, r: 2.4, fill: C.ink }, body);
    const cx = (14 + x1) / 2;
    const texts = lines.map((s, i) => ctext(body, s, cx, (i - (lines.length - 1) / 2) * lh, size, weight, textFill));
    // string from the attachment point, over the top edge, to the eyelet (drawn above the body)
    const str = el('path', { d: `M0 0C${r1(ex * 0.1)} ${r1(ey * 0.5)} ${r1(ex * 0.7)} ${r1(ey * 0.5)} ${r1(ex)} ${r1(ey)}`, fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: 0, cy: 0, r: 3, fill: C.ink }, g);
    let arrowG = null;
    if (arrow) {
      arrowG = el('g', {}, body);
      el('path', { d: `M${r1(cx - 9)} ${r1(h / 2 + 6)}h18v20h12l-21 24l-21 -24h12z`, fill: C.accent, ...INK() }, arrowG);
    }
    const full = lines.map(s => s);
    return {
      g, body, w, h, texts, arrowG, str,
      write(p) {
        const total = full.reduce((a, s) => a + s.length, 0);
        let n = Math.round(clamp(p) * total);
        full.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; set(texts[i], { text: s.slice(0, k) }); });
      },
      setLines(ls) { ls.forEach((s, i) => { if (texts[i]) { full[i] = s; set(texts[i], { text: s }); } }); },
    };
  }
  // Rotation/offset of a hanging tag: on (swing-in), idle sway, remove (pulled off up-right, fades).
  function tagPose(p, base = 0) {
    const on = clamp(p.on ?? 1), rem = clamp(p.remove ?? 0), t = p.t ?? 0;
    const e = ease.enter(seg(on, 0, 0.55));
    let r = base + (p.swing ?? 0) - 75 * (1 - e) + 14 * wobble(seg(on, 0.4, 1), 1.6, 3.5) + 0.9 * Math.sin(2 * Math.PI * t / 2.7);
    const er = ease.exit(rem);
    return { r: r + 25 * er, x: 46 * er, y: -38 * er, o: Math.min(seg(on, 0, 0.18), 1 - seg(rem, 0.3, 1)) };
  }

  // ======================================================================================
  // Kit.WheelChock(parent, {})
  //   70×50 safety-yellow wedge with grip ribs. Its concave face (right side) fits a 40 px tyre.
  // update({place = 1, missing = false, t}):
  //   place 0..1: slides in from the left (-90 px), clicks against the tyre (squash) and flashes
  //     3 motion lines on its left at ~0.7.
  //   missing: true shows a dashed ink-soft outline with a red X instead of the chock.
  // Origin: bottom-centre on the floor line (tyre contact point is ~13 px right of the origin+35).
  // ======================================================================================
  function WheelChock(parent) {
    const g = el('g', {}, parent);
    // Concave face: circle of radius 40 centred at (48, -40) from the floor up to y = -50.
    const arc = [];
    for (let i = 0; i <= 8; i++) {
      const y = -1 - (49 * i) / 8;
      arc.push([48 - Math.sqrt(Math.max(0, 1600 - (y + 40) ** 2)), y]);
    }
    const prof = [[-35, 0], [arc[0][0], 0], ...arc, [0, -50], [-35, -9]];
    const solid = el('g', {}, g);
    const slab = el('g', {}, solid);
    el('path', { d: dPoly([[-35, -9], [0, -50], [12, -57], [-23, -16]]), fill: mix(C.safety, C.paper, 0.35), ...INK() }, slab);
    el('path', { d: dPoly(prof), fill: C.safety, ...INK() }, slab);
    for (let i = 0; i < 4; i++) {
      const u = 0.18 + i * 0.2;
      const a = [lerp(-35, 0, u), lerp(-9, -50, u)];
      el('path', { d: `M${r1(a[0])} ${r1(a[1])}l11 -6`, stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, slab);
    }
    const lines = el('g', {}, g);
    const mlines = [0, 1, 2].map(i => el('path', { d: `M${-58 - i * 4} ${-12 - i * 14}h-22`, stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, lines));
    const missG = el('g', {}, g);
    el('path', { d: dPoly(prof), fill: 'none', stroke: C.inkSoft, 'stroke-width': 2.5, 'stroke-dasharray': '7 6' }, missG);
    el('path', { d: 'M-14 -42L18 -6M18 -42L-14 -6', stroke: C.error, 'stroke-width': 6, 'stroke-linecap': 'round' }, missG);
    return {
      g,
      update(p = {}) {
        const pl = clamp(p.place ?? 1), missing = !!p.missing;
        show(solid, !missing && pl > 0); show(missG, missing);
        const e = ease.enter(seg(pl, 0, 0.7));
        const hit = seg(pl, 0.62, 1);
        const sq = 1 - 0.08 * wobble(hit, 1.5, 5);
        set(solid, { transform: tf(-90 * (1 - e), 0, [1 / sq, sq]), opacity: seg(pl, 0, 0.15) });
        const flash = hit > 0 && hit < 1 ? Math.sin(Math.PI * hit) : 0;
        show(lines, !missing && flash > 0.02);
        mlines.forEach((n, i) => set(n, { opacity: clamp(flash * 1.4 - i * 0.12), transform: `translate(${r1(-10 * hit)} 0)` }));
      },
    };
  }

  // ======================================================================================
  // Kit.BoxTruck(parent, {from = -1100, cargo = true})
  //   Side view, ~720×315: steel cargo box, dark cab facing left, two wheels, rear roll door on the
  //   rear face (visible in iso depth). Backs in left-to-right toward a dock on its right.
  //   Mirror with Engine.place s: [-1, 1] for a truck driving off to the right (no text on it).
  // update({arrive = 1, door = 0, chock = 0, chockMissing = false, roll = 0, t}):
  //   arrive 0..1: slides in from x = from to 0 (ease-out over ~80 %), then a suspension settle
  //     bounce. Drive linearly over ~1.6 s. Wheels turn with the distance travelled.
  //   door 0..1: rear roll door rolls up, revealing the dark cargo bay (with cartons if cargo).
  //   chock 0..1: WheelChock place animation at the rear tyre. chockMissing: dashed outline + red X.
  //   roll: extra distance in px for the wheel rotation when the scene moves the truck itself.
  // States: arriving (arrive < 1), parked (arrive 1), door-open (door 1), chocked (chock 1).
  // Origin: bottom-centre on the floor line. Rear tyre centre (200, -40); front tyre (-262, -40).
  // ======================================================================================
  function BoxTruck(parent, o = {}) {
    const from = o.from ?? -1100, R = 40, DD = 70;
    const g = el('g', {}, parent);
    const shadowN = el('ellipse', { cx: 0, cy: 0, rx: 360, ry: 12, fill: C.ink, opacity: 0.1 }, g);
    const move = el('g', {}, g);
    const body = el('g', {}, move);
    // chassis and tank
    el('path', { d: dRect(-344, -84, 660, 18), fill: C.steelDark, ...INK() }, body);
    el('path', { d: dRect(-160, -92, 96, 32), fill: C.steel, ...INK() }, body);
    // cab (dark), facing left
    const cab = [[-362, -60], [-362, -128], [-353, -141], [-314, -147], [-290, -228], [-278, -238], [-214, -238], [-206, -229], [-206, -60]];
    extrude(body, cab, DD, { front: C.steelDark, top: T.darkTop, side: T.darkSide });
    el('path', { d: dPoly([[-302, -152], [-282, -224], [-232, -224], [-232, -152]]), fill: T.window, ...INK() }, body);
    el('path', { d: 'M-296 -150V-64M-224 -150V-64', stroke: C.ink, 'stroke-width': 2, fill: 'none' }, body);
    el('path', { d: dRect(-252, -136, 16, 6), fill: C.ink }, body);
    el('path', { d: dRect(-362, -124, 9, 16), fill: C.safety, ...INK({ 'stroke-width': 2 }) }, body);
    el('path', { d: 'M-360 -100h18M-360 -90h18M-360 -80h18', stroke: C.ink, 'stroke-width': 2 }, body);
    el('path', { d: dRect(-322, -214, 9, 30), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, body);
    el('path', { d: dRect(-286, -66, 40, 8), fill: C.ink }, body);
    // cargo box: near face, top and rear face
    const bx0 = -200, bx1 = 300, by0 = 80, by1 = 282;
    extrude(body, [[bx0, -by0], [bx1, -by0], [bx1, -by1], [bx0, -by1]], DD, { front: C.steel, top: T.steelTop, side: T.steelSide });
    for (let x = bx0 + 100; x < bx1; x += 100) el('path', { d: `M${x} ${-by1 + 6}V${-by0 - 6}`, stroke: C.steelDark, 'stroke-width': 2, opacity: 0.6 }, body);
    el('path', { d: `M${bx0} ${-by0 - 14}H${bx1}`, stroke: C.steelDark, 'stroke-width': 2, opacity: 0.6 }, body);
    el('path', { d: dRect(286, -112, 10, 18), fill: C.error, ...INK({ 'stroke-width': 1.8 }) }, body);
    el('path', { d: dRect(280, -84, 50, 14), fill: C.steelDark, ...INK() }, body);
    // rear door on the rear face (plane x = bx1): interior, cargo, rolling curtain
    const RP = (y, z) => P(bx1, y, z);
    const dz0 = 8, dz1 = DD - 8, dy0 = by0 + 8, dy1 = by1 - 10;
    el('path', { d: dPoly([RP(dy0, dz0), RP(dy0, dz1), RP(dy1, dz1), RP(dy1, dz0)]), fill: C.ink }, body);
    const cargoG = el('g', {}, body);
    [[dy0, dy0 + 62, 12, 34], [dy0, dy0 + 62, 36, 58], [dy0 + 62, dy0 + 116, 22, 46]].forEach(([ya, yb, za, zb]) =>
      el('path', { d: dPoly([RP(ya, za), RP(ya, zb), RP(yb, zb), RP(yb, za)]), fill: C.carton, ...INK({ 'stroke-width': 2 }) }, cargoG));
    const curtain = el('path', { fill: T.steelLight, ...INK({ 'stroke-width': 2 }) }, body);
    const slats = el('path', { fill: 'none', stroke: C.steelDark, 'stroke-width': 1.6 }, body);
    const doorBar = el('path', { fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, body);
    el('path', { d: dPoly([RP(dy0, dz0), RP(dy0, dz1), RP(dy1, dz1), RP(dy1, dz0)]), fill: 'none', ...INK() }, body);
    // wheels (arch, tyre, rim, lugs that rotate)
    const wheels = [-262, 200].map(x => {
      el('circle', { cx: x, cy: -R, r: R + 7, fill: C.ink }, move);
      const wg = el('g', {}, move);
      el('circle', { cx: x, cy: -R, r: R, fill: T.rubber, ...INK() }, wg);
      el('circle', { cx: x, cy: -R, r: 23, fill: C.steel, ...INK({ 'stroke-width': 2 }) }, wg);
      const hub = el('g', {}, wg);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        el('circle', { cx: r1(x + 14 * Math.cos(a)), cy: r1(-R + 14 * Math.sin(a)), r: 2.6, fill: C.ink }, hub);
      }
      el('circle', { cx: x, cy: -R, r: 6, fill: C.steelDark, ...INK({ 'stroke-width': 1.6 }) }, hub);
      return { x, hub };
    });
    const chock = WheelChock(g);
    set(chock.g, { transform: tf(200 - 48, 0) });
    return {
      g, chock,
      update(p = {}) {
        const ar = clamp(p.arrive ?? 1);
        const x = from * (1 - ease.enter(seg(ar, 0, 0.8)));
        const q = seg(ar, 0.62, 1);
        const bob = 5 * wobble(q, 2, 3.5);
        set(move, { transform: tf(x, 0) });
        set(body, { transform: `translate(0 ${r1(-Math.abs(bob) * 0.4 + bob * 0.6)}) rotate(${(bob * 0.12).toFixed(3)} 200 -40)` });
        set(shadowN, { cx: r1(x), rx: 360 });
        const ang = ((x + (p.roll ?? 0)) / R) * 57.2958;
        wheels.forEach(w => set(w.hub, { transform: `rotate(${ang.toFixed(2)} ${w.x} ${-R})` }));
        const door = ease.enter(clamp(p.door ?? 0));
        const yb = lerp(dy0, dy1 - 6, door);
        set(curtain, { d: dPoly([RP(yb, dz0), RP(yb, dz1), RP(dy1, dz1), RP(dy1, dz0)]) });
        let sd = '';
        for (let y = yb + 14; y < dy1 - 2; y += 14) sd += `M${r1(RP(y, dz0)[0])} ${r1(RP(y, dz0)[1])}L${r1(RP(y, dz1)[0])} ${r1(RP(y, dz1)[1])}`;
        set(slats, { d: sd || 'M0 0' });
        set(doorBar, { d: dPoly([RP(yb, dz0), RP(yb, dz1), RP(yb + 8, dz1), RP(yb + 8, dz0)]) });
        show(cargoG, (o.cargo ?? true) && door > 0.05);
        const ch = clamp(p.chock ?? 0);
        show(chock.g, ch > 0 || !!p.chockMissing);
        chock.update({ place: ch, missing: !!p.chockMissing && ch === 0, t: p.t });
      },
    };
  }

  // ======================================================================================
  // Kit.DockDoor(parent, {number = 3, label = `DOCK ${number}`})
  //   420×520 roll-up dock door: dark steel frame and header, paper number plate (24 px 800),
  //   concrete dock face with two black rubber bumpers and a safety-striped leveller edge.
  // update({open = 0, t}): open 0..1 rolls the slatted curtain up into the header (ease-out),
  //   revealing the dark warehouse interior.
  // Origin: bottom-centre on the floor line. Dock floor (door sill) at y = -96; opening x ±170.
  // ======================================================================================
  function DockDoor(parent, o = {}) {
    const label = o.label ?? `DOCK ${o.number ?? 3}`;
    const g = el('g', {}, parent);
    const OX = 170, OT = -466, OB = -96, OH = OB - OT;
    // dock face below the door
    el('path', { d: dRect(-210, -96, 420, 96), fill: T.concrete, ...INK() }, g);
    const sid = uniq('dstripe');
    const defs = el('defs', {}, g);
    el('path', { d: dRect(-210, -96, 420, 12) }, el('clipPath', { id: sid }, defs));
    const st = el('g', { 'clip-path': `url(#${sid})` }, g);
    el('path', { d: dRect(-210, -96, 420, 12), fill: C.safety }, st);
    let sd = '';
    for (let x = -230; x < 220; x += 24) sd += `M${x} -84l12 -12h12l-12 12z`;
    el('path', { d: sd, fill: C.ink }, st);
    el('path', { d: dRect(-210, -96, 420, 12), fill: 'none', ...INK() }, g);
    [-169, 169].forEach(x => {
      el('path', { d: dRect(x - 19, -80, 38, 54, 4), fill: T.rubber, ...INK() }, g);
      el('path', { d: `M${x - 11} -66h22M${x - 11} -53h22M${x - 11} -40h22`, stroke: C.steelDark, 'stroke-width': 2 }, g);
    });
    // opening interior (dark warehouse)
    el('path', { d: dRect(-OX, OT, 2 * OX, OH), fill: C.ink }, g);
    el('path', { d: 'M-150 -330h120M-150 -250h120M-150 -170h120M40 -330h120M40 -250h120M40 -170h120M-150 -390V-104M-30 -390V-104M40 -390V-104M160 -390V-104', stroke: C.steelDark, 'stroke-width': 3, opacity: 0.55 }, g);
    el('path', { d: dRect(-OX, -110, 2 * OX, 14), fill: C.steelDark }, g);
    // curtain, clipped to the opening
    const cid = uniq('dclip');
    el('path', { d: dRect(-OX, OT, 2 * OX, OH) }, el('clipPath', { id: cid }, defs));
    const cur = el('g', { 'clip-path': `url(#${cid})` }, g);
    const curMove = el('g', {}, cur);
    el('path', { d: dRect(-OX, OT, 2 * OX, OH), fill: T.steelLight }, curMove);
    let ld = '';
    for (let y = OB - 22; y > OT; y -= 22) ld += `M${-OX} ${y}H${OX}`;
    el('path', { d: ld, stroke: C.steel, 'stroke-width': 2.2 }, curMove);
    el('path', { d: dRect(-OX, OB - 12, 2 * OX, 12), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, curMove);
    el('path', { d: dRect(-22, OB - 34, 44, 10, 3), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, curMove);
    el('path', { d: dRect(-OX, OT, 2 * OX, OH), fill: 'none', ...INK() }, g);
    // frame and header
    el('path', { d: dRect(-210, -520, 40, 424), fill: C.steelDark, ...INK() }, g);
    el('path', { d: dRect(170, -520, 40, 424), fill: C.steelDark, ...INK() }, g);
    el('path', { d: dRect(-210, -520, 420, 54), fill: C.steel, ...INK() }, g);
    el('path', { d: 'M-200 -480H200', stroke: C.steelDark, 'stroke-width': 2 }, g);
    const pw = Math.max(110, measure(label, 24, 800) + 28);
    el('path', { d: dRect(-pw / 2, -513, pw, 40), fill: C.paper, ...INK() }, g);
    ctext(g, label, 0, -493, 24, 800);
    return {
      g,
      update(p = {}) {
        const op = ease.enter(clamp(p.open ?? 0));
        set(curMove, { transform: `translate(0 ${r1(-(OH - 10) * op)})` });
      },
    };
  }

  // ======================================================================================
  // Kit.Carton(parent, {w = 116, h = 110, d = 50, label, labelSize = 24, shadow = false})
  //   Oblique-isometric cardboard box, ~160×135 at default size (front w×h, depth d). Faces:
  //   carton front, light top, cartonEdge side, 2.5 px ink outlines.
  // update({label, open = 0, tape = 0, damaged = 0, scuff = 0, empty = false, bulge = 0, turn,
  //         outline, t}):
  //   label: string on a paper LocationLabel-style chip on the front (overrides the option;
  //     null hides it). Text 24 px 600, shrinks only if it would overflow the front face.
  //   open 0..1: the four flaps rotate open (ease-out); the dark inside shows.
  //   tape 0..1: a tape strip runs up the front and back over the top (sealed).
  //   damaged 0..1: front-top-right corner crushes in, crease lines; adds an error outline.
  //   scuff 0..1: grey smudges fade in (clean = 0, scuffed = 1).
  //   empty: lighter tones and open flaps (unless open is given).
  //   bulge 0..1: sides bow outward (overstuffed).
  //   turn 0..1: the box spins a quarter turn about its vertical axis (squash) to show its label:
  //     the label is hidden for turn < 0.5. Omit turn and the label simply shows.
  //   outline: halo colour (see conventions). damaged > 0 implies 'error'.
  // Extras: carton.inside is a group drawn inside the open box (behind the front face), for
  //   scene items (carton-local coords, inside floor at y = 0). Carton.size = {w, h, d}.
  // States: plain, labelled, damaged, open, sealed, clean / scuffed, empty.
  // Origin: bottom-centre of the front face (depth extends up-right).
  // ======================================================================================
  function Carton(parent, o = {}) {
    const w = o.w ?? 116, h = o.h ?? 110, d = o.d ?? 50, L = d * 0.62;
    const g = el('g', {}, parent);
    if (o.shadow) Kit.shadow(g, w + d * CS + 12, { x: (d * CS) / 2, y: 0 });
    const body = el('g', {}, g);
    const halo = haloNode(body, 11);
    const flapAttrs = INK({ 'stroke-width': 2.2 });
    const backLo = el('path', { fill: T.top, ...flapAttrs }, body);
    const cid = uniq('cin');
    const clipP = el('path', {}, el('clipPath', { id: cid }, el('defs', {}, body)));
    const openG = el('g', { 'clip-path': `url(#${cid})` }, body);
    const holeN = el('path', { fill: T.inside }, openG);
    const inBack = el('path', { fill: T.insideBack }, openG);
    const inLeft = el('path', { fill: T.insideSide }, openG);
    const inside = el('g', {}, body);
    const side = el('path', { ...INK() }, body);
    const front = el('path', { ...INK() }, body);
    const top = el('path', { ...INK() }, body);
    const rim = el('path', { fill: 'none', ...INK() }, body);
    const seam = el('path', { fill: 'none', stroke: C.cartonEdge, 'stroke-width': 2 }, body);
    const smudge = el('g', {}, body);
    [[-0.22, 0.32, 16, 9], [0.18, 0.62, 12, 7], [-0.05, 0.16, 9, 5], [0.3, 0.2, 7, 5]].forEach(([u, v, rx, ry], i) =>
      el('ellipse', { cx: r1(u * w), cy: r1(-v * h), rx, ry, fill: C.inkSoft, opacity: 0.32 - i * 0.04, transform: `rotate(${-12 + i * 9} ${r1(u * w)} ${r1(-v * h)})` }, smudge));
    const sm2 = P(w / 2, h * 0.45, d * 0.5);
    el('ellipse', { cx: r1(sm2[0]), cy: r1(sm2[1]), rx: 6, ry: 11, fill: C.inkSoft, opacity: 0.3, transform: `rotate(-30 ${r1(sm2[0])} ${r1(sm2[1])})` }, smudge);
    const tapeF = el('path', { fill: T.tape, stroke: C.cartonEdge, 'stroke-width': 1.5 }, body);
    const tapeT = el('path', { fill: T.tape, stroke: C.cartonEdge, 'stroke-width': 1.5 }, body);
    const crease = el('path', { fill: 'none', stroke: mix(C.cartonEdge, C.ink, 0.45), 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, body);
    const labelG = el('g', {}, body);
    const labelR = el('rect', { fill: C.paper, ...INK({ 'stroke-width': 2 }), rx: 3 }, labelG);
    const labelT = text(labelG, '', { x: 0, y: 0, size: o.labelSize ?? 24, weight: 600, anchor: 'middle' });
    const backHi = el('path', { fill: T.top, ...flapAttrs }, body);
    const leftF = el('path', { fill: C.carton, ...flapAttrs }, body);
    const rightF = el('path', { fill: T.top, ...flapAttrs }, body);
    const frontF = el('path', { fill: C.carton, ...flapAttrs }, body);
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const sub = (a, k) => a.map(v => v * k);
    return {
      g, inside, size: { w, h, d },
      update(p = {}) {
        const empty = !!p.empty;
        const open = clamp(p.open ?? (empty ? 1 : 0));
        const crush = ease.enter(clamp(p.damaged ?? 0));
        const bulge = clamp(p.bulge ?? 0);
        const eo = open > 0 ? ease.enter(open) : 0, rad = Math.PI / 180;
        const th = eo * 112 * rad, thF = eo * 122 * rad, thS = eo * 128 * rad;
        // 3D corners (crushed front-top-right corner)
        const FBL = [-w / 2, 0, 0], FBR = [w / 2, 0, 0], BBR = [w / 2, 0, d];
        const FTL = [-w / 2, h, 0], BTL = [-w / 2, h, d], BTR = [w / 2, h, d];
        const FTR = [w / 2 - 20 * crush, h - 26 * crush, 9 * crush];
        // bulge warp on projected points
        const minX = -w / 2, maxX = w / 2 + d * CS, Ht = h + d * SN, cx = (minX + maxX) / 2;
        const warp = q => {
          if (bulge <= 0) return q;
          const v = clamp(-q[1] / Ht), u = clamp((q[0] - minX) / (maxX - minX));
          return [cx + (q[0] - cx) * (1 + 0.13 * bulge * 4 * v * (1 - v)), q[1] * (1 + 0.09 * bulge * 4 * u * (1 - u))];
        };
        const proj = c => warp(P(c[0], c[1], c[2]));
        const face = cs => {
          if (bulge <= 0) return dPoly(cs.map(c => P(c[0], c[1], c[2])));
          const out = [];
          for (let i = 0; i < cs.length; i++) {
            const a = cs[i], b = cs[(i + 1) % cs.length];
            for (let k = 0; k < 6; k++) out.push(proj([lerp(a[0], b[0], k / 6), lerp(a[1], b[1], k / 6), lerp(a[2], b[2], k / 6)]));
          }
          return dPoly(out);
        };
        const tone = c => (empty ? mix(c, C.paper, 0.3) : c);
        set(front, { d: face([FBL, FBR, FTR, FTL]), fill: tone(C.carton) });
        set(side, { d: face([FBR, BBR, BTR, FTR]), fill: tone(C.cartonEdge) });
        const topD = face([FTL, FTR, BTR, BTL]);
        show(top, open === 0); show(seam, open === 0); show(openG, open > 0); show(rim, open > 0);
        if (open === 0) {
          set(top, { d: topD, fill: tone(T.top) });
          const a = proj([0, h, 0]), b = proj([0, h, d]);
          set(seam, { d: `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}` });
        } else {
          set(clipP, { d: topD }); set(rim, { d: topD });
          set(holeN, { d: topD });
          set(inBack, { d: face([[-w / 2, h, d], [w / 2, h, d], [w / 2, 0, d], [-w / 2, 0, d]]), fill: empty ? mix(T.insideBack, C.paper, 0.25) : T.insideBack });
          set(inLeft, { d: face([[-w / 2, h, 0], [-w / 2, h, d], [-w / 2, 0, d], [-w / 2, 0, 0]]), fill: empty ? mix(T.insideSide, C.paper, 0.2) : T.insideSide });
        }
        // flaps
        const flap = (h0, h1, dir) => face([h0, h1, add(h1, dir), add(h0, dir)]);
        const s = Math.sin(th), c = Math.cos(th);
        const sF = Math.sin(thF), cF = Math.cos(thF), sS = Math.sin(thS), cS = Math.cos(thS);
        const showFl = open > 0;
        show(backLo, showFl && th > Math.PI / 2); show(backHi, showFl && th <= Math.PI / 2);
        [leftF, rightF, frontF].forEach(n => show(n, showFl));
        if (showFl) {
          const bd = flap(BTL, BTR, sub([0, s, -c], L));
          set(th > Math.PI / 2 ? backLo : backHi, { d: bd, fill: tone(T.top) });
          set(leftF, { d: flap(FTL, BTL, sub([cS, sS, 0], L * 0.9)), fill: tone(C.carton) });
          set(rightF, { d: flap(FTR, BTR, sub([-cS, sS, 0], L * 0.9)), fill: tone(T.top) });
          set(frontF, { d: flap(FTL, FTR, sub([0, sF, cF], L)), fill: tone(C.carton) });
        }
        // tape: up the front (first 35 %), then over the top
        const tp = clamp(p.tape ?? 0);
        show(tapeF, tp > 0 && open === 0); show(tapeT, tp > 0.35 && open === 0);
        if (tp > 0) {
          const f = seg(tp, 0, 0.35), k = seg(tp, 0.35, 1);
          set(tapeF, { d: face([[-8, h - 34, 0], [8, h - 34, 0], [8, h - 34 + 34 * f, 0], [-8, h - 34 + 34 * f, 0]]) });
          set(tapeT, { d: face([[-8, h, 0], [8, h, 0], [8, h, d * k], [-8, h, d * k]]) });
        }
        set(smudge, { opacity: clamp(p.scuff ?? 0) });
        show(smudge, (p.scuff ?? 0) > 0);
        show(crease, crush > 0.02);
        if (crush > 0.02) {
          const k = proj(FTR), m = (q) => `M${r1(k[0])} ${r1(k[1])}L${r1(q[0])} ${r1(q[1])}`;
          const a = proj([w / 2 - 44 * crush, h - 30 * crush, 0]), b = proj([w / 2 - 40 * crush, h, d * 0.42]);
          const c2 = proj([w / 2, h - 50 * crush, d * 0.38]), e2 = proj([w / 2 - 12 * crush, h - 4 * crush, d * 0.2]);
          set(crease, { d: m(a) + m(b) + m(c2) + `M${r1(e2[0])} ${r1(e2[1])}l-7 9` });
        }
        // label chip
        const label = p.label !== undefined ? p.label : o.label;
        const turning = p.turn != null;
        const tu = turning ? clamp(p.turn) : 1;
        const showLabel = !!label && (!turning || tu >= 0.5);
        show(labelG, showLabel);
        if (showLabel) {
          let size = o.labelSize ?? 24;
          const tw = measure(label, size, 600);
          if (tw > w - 28) size = Math.max(16, (size * (w - 28)) / tw);
          const lw = Math.min(w - 12, measure(label, size, 600) + 20), lh = size + 14;
          const cyL = -h * 0.56 + (crush * 6);
          set(labelR, { x: r1(-lw / 2), y: r1(cyL - lh / 2), width: r1(lw), height: r1(lh) });
          set(labelT, { text: label, 'font-size': r1(size), y: r1(cyL + size * 0.36) });
        }
        const hl = p.outline !== undefined ? p.outline : crush > 0 ? 'error' : null;
        setHalo(halo, dPoly([FBL, FBR, BBR, BTR, BTL, FTL].map(proj)), hl, p.t);
        // quarter-turn squash
        const sx = turning ? Math.max(0.04, Math.abs(Math.cos(Math.PI * tu))) : 1;
        set(body, { transform: sx === 1 ? '' : `translate(${r1((d * CS) / 2)} 0) scale(${sx.toFixed(3)} 1) translate(${r1(-(d * CS) / 2)} 0)` });
      },
    };
  }
  Carton.size = { w: 116, h: 110, d: 50 };

  // ======================================================================================
  // Kit.Crate(parent, {w = 130, h = 100, d = 64, shadow = false})   (alias Kit.WeatherproofCrate)
  //   Slatted wooden crate with corner posts and a sealed steel lid (gasket line, two latches).
  // update({beads = 0, outline, t}): beads 0..1 shows water beading on the lid, with drops
  //   running off its front edge on a 1.6 s loop (t). Stays dry inside.
  // Origin: bottom-centre of the front face.
  // ======================================================================================
  function Crate(parent, o = {}) {
    const w = o.w ?? 130, h = o.h ?? 100, d = o.d ?? 64;
    const g = el('g', {}, parent);
    if (o.shadow) Kit.shadow(g, w + d * CS + 12, { x: (d * CS) / 2, y: 0 });
    const halo = haloNode(g, 11);
    const fp = cs => dPoly(cs.map(c => P(...c)));
    const hl = h - 12;
    // side face and front face base (gaps), planks, posts
    el('path', { d: fp([[w / 2, 0, 0], [w / 2, 0, d], [w / 2, hl, d], [w / 2, hl, 0]]), fill: T.hole, ...INK() }, g);
    el('path', { d: fp([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, hl, 0], [-w / 2, hl, 0]]), fill: T.hole, ...INK() }, g);
    const n = 4, ph = hl / n;
    for (let i = 0; i < n; i++) {
      const y0 = i * ph + 2, y1 = (i + 1) * ph - 2;
      el('path', { d: fp([[w / 2, y0, 4], [w / 2, y0, d - 4], [w / 2, y1, d - 4], [w / 2, y1, 4]]), fill: C.cartonEdge, ...INK({ 'stroke-width': 1.6 }) }, g);
      el('path', { d: fp([[-w / 2, y0, 0], [w / 2, y0, 0], [w / 2, y1, 0], [-w / 2, y1, 0]]), fill: C.carton, ...INK({ 'stroke-width': 1.6 }) }, g);
    }
    [[-w / 2, -w / 2 + 14], [w / 2 - 14, w / 2]].forEach(([a, b]) =>
      el('path', { d: fp([[a, 0, 0], [b, 0, 0], [b, hl, 0], [a, hl, 0]]), fill: C.cartonEdge, ...INK({ 'stroke-width': 2 }) }, g));
    el('path', { d: fp([[w / 2, 0, d - 12], [w / 2, 0, d], [w / 2, hl, d], [w / 2, hl, d - 12]]), fill: mix(C.cartonEdge, C.ink, 0.15), ...INK({ 'stroke-width': 2 }) }, g);
    // lid: overhangs by 4, thickness 12, steel, gasket
    const lx = w / 2 + 4;
    el('path', { d: fp([[lx, hl, -4], [lx, hl, d + 4], [lx, h, d + 4], [lx, h, -4]]), fill: T.steelSide, ...INK() }, g);
    el('path', { d: fp([[-lx, hl, -4], [lx, hl, -4], [lx, h, -4], [-lx, h, -4]]), fill: C.steel, ...INK() }, g);
    el('path', { d: fp([[-lx, h, -4], [lx, h, -4], [lx, h, d + 4], [-lx, h, d + 4]]), fill: T.steelTop, ...INK() }, g);
    el('path', { d: fp([[-lx + 9, h, 4], [lx - 9, h, 4], [lx - 9, h, d - 4], [-lx + 9, h, d - 4]]), fill: 'none', stroke: C.ink, 'stroke-width': 2 }, g);
    el('path', { d: fp([[-lx, hl + 3, -4], [lx, hl + 3, -4]]).replace('Z', ''), stroke: C.ink, 'stroke-width': 3 }, g);
    [-w / 4, w / 4].forEach(x => el('path', { d: fp([[x - 7, hl - 14, -5], [x + 7, hl - 14, -5], [x + 7, h - 3, -5], [x - 7, h - 3, -5]]), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g));
    // water beads on the lid and drops running off the front edge
    const beadsG = el('g', {}, g);
    const beadPts = [];
    for (let i = 0; i < 9; i++) {
      const q = P(-w / 2 + 12 + hash(i * 3 + 1) * (w - 24), h, 8 + hash(i * 3 + 2) * (d - 16));
      beadPts.push(el('ellipse', { cx: r1(q[0]), cy: r1(q[1]), rx: 4 + 2 * hash(i), ry: 3, fill: C.paper, stroke: C.neutral, 'stroke-width': 1.5 }, beadsG));
    }
    const drops = [-w / 3, 0.1 * w, w / 3].map(x => el('path', { d: 'M0 -5C3 0 4 3 0 5C-4 3 -3 0 0 -5Z', fill: C.neutral, stroke: C.ink, 'stroke-width': 1 }, beadsG));
    return {
      g,
      update(p = {}) {
        const b = clamp(p.beads ?? 0), t = p.t ?? 0;
        show(beadsG, b > 0); set(beadsG, { opacity: b });
        drops.forEach((n, i) => {
          const x = [-w / 3, 0.1 * w, w / 3][i];
          const k = fmod(t / 1.6 + i * 0.37, 1);
          set(n, { transform: tf(x, -hl + 6 + 70 * k * k, 1), opacity: (1 - k) * b });
        });
        setHalo(halo, dPoly([P(-lx, 0, 0), P(w / 2, 0, 0), P(w / 2, 0, d), P(lx, h, d + 4), P(-lx, h, d + 4), P(-lx, h, -4)]), p.outline, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.Part(parent, {kind = 'bolt'})   Part icons, STYLE §6 item 28. Also Kit.Bolt, Kit.Bearing,
  //   Kit.BrakeShoe, Kit.Shaft, Kit.HoseCoil, Kit.SealRing, Kit.GenericPart (same API, kind fixed).
  //   kind: bolt (100×36) | bearing (90×90) | brakeshoe (108×44, crescent) | shaft (120×32; cradle adds 30
  //   below) | hosecoil (100×100) | sealring (70×70) | part (generic rounded block, 80×60).
  //   Steel parts are steel with paper highlights; hose and seal are dark rubber.
  // update({state, tag, tagOn = 1, rust = 0, wrap = 0, torn = 0, cradle = false, scratched = 0,
  //         missing = false, outline, t}):
  //   state: 'new' (bright, two sparkle glints) | 'core' (dull grey, wear marks) | null (plain).
  //   tag: 'new' | 'core' | false: hanging NEW / CORE tag at the top-right. Defaults to state.
  //     tagOn 0..1 swings the tag in.
  //   rust 0..1: orange-brown speckles spread over the part.
  //   wrap 0..1: protective bubble wrap slides on (left to right). torn 0..1: the wrap rips in two
  //     and the right half peels away (unwrapped).
  //   cradle (shaft): padded cradle under it. scratched 0..1: red scratch marks on the surface.
  //   missing: only a dashed error outline of the silhouette (e.g. a missing part in a box).
  // Part.sizes[kind] = [w, h]. Origin: centre.
  // ======================================================================================
  const PART_SIZE = { bolt: [100, 36], bearing: [90, 90], brakeshoe: [108, 44], shaft: [120, 32], hosecoil: [100, 100], sealring: [70, 70], part: [80, 60] };
  const arcPt = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  function annSector(cx, cy, r0, r1_, a0, a1) {
    const A = arcPt(cx, cy, r1_, a0), B = arcPt(cx, cy, r1_, a1), Cc = arcPt(cx, cy, r0, a1), D = arcPt(cx, cy, r0, a0);
    const big = a1 - a0 > 180 ? 1 : 0;
    return `M${r1(A[0])} ${r1(A[1])}A${r1_} ${r1_} 0 ${big} 1 ${r1(B[0])} ${r1(B[1])}L${r1(Cc[0])} ${r1(Cc[1])}A${r0} ${r0} 0 ${big} 0 ${r1(D[0])} ${r1(D[1])}Z`;
  }
  function drawPart(kind, g) {
    const steel = { fill: C.steel, ...INK() };
    const hi = (d, w = 3) => el('path', { d, fill: 'none', stroke: C.paper, 'stroke-width': w, 'stroke-linecap': 'round', opacity: 0.75 }, g);
    if (kind === 'bolt') {
      el('path', { d: 'M-28 -9H44L49 -4V4L44 9H-28Z', ...steel }, g);
      let th = '';
      for (let x = -6; x <= 40; x += 6) th += `M${x} -9L${x - 4} 9`;
      el('path', { d: th, stroke: C.ink, 'stroke-width': 1.5 }, g);
      el('path', { d: dRect(-33, -14, 6, 28), ...steel }, g);
      el('path', { d: dRect(-50, -18, 18, 36, 3), ...steel }, g);
      el('path', { d: 'M-50 -6H-32M-50 6H-32', stroke: C.ink, 'stroke-width': 1.6 }, g);
      hi('M-26 -4H-10'); hi('M-47 -12V-9', 2.5);
      return 'M-50 -18H-33V-14H-28V-9H44L49 -4V4L44 9H-28V14H-33V18H-50Z';
    }
    if (kind === 'bearing') {
      el('path', { d: dCircle(0, 0, 45) + dCircle(0, 0, 34), 'fill-rule': 'evenodd', ...steel }, g);
      el('path', { d: dCircle(0, 0, 34) + dCircle(0, 0, 22), 'fill-rule': 'evenodd', fill: C.steelDark, stroke: 'none' }, g);
      for (let k = 0; k < 9; k++) {
        const q = arcPt(0, 0, 28, k * 40 - 90);
        el('circle', { cx: r1(q[0]), cy: r1(q[1]), r: 5.6, fill: T.steelLight, ...INK({ 'stroke-width': 1.6 }) }, g);
      }
      el('path', { d: dCircle(0, 0, 22) + dCircle(0, 0, 12), 'fill-rule': 'evenodd', ...steel }, g);
      el('path', { d: 'M-36 -18A40 40 0 0 1 -14 -37', fill: 'none', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.75 }, g);
      return dCircle(0, 0, 45) + dCircle(0, 0, 12);
    }
    if (kind === 'brakeshoe') {
      // Crescent web between the table (circle at (0, 44), r 46) and an inner arc (circle at (0, 62), r 40);
      // friction lining band (r 52..62) on the outside curve.
      const cy = 44, A = a => arcPt(0, cy, 46, a), I = a => arcPt(0, 62, 40, a);
      const w0 = A(-152), w1 = A(-28), i1 = I(-30), i0 = I(-150);
      const web = `M${r1(w0[0])} ${r1(w0[1])}A46 46 0 0 1 ${r1(w1[0])} ${r1(w1[1])}L${r1(i1[0])} ${r1(i1[1])}A40 40 0 0 0 ${r1(i0[0])} ${r1(i0[1])}Z`;
      el('path', { d: web + dCircle(-17, 12, 4.5) + dCircle(17, 12, 4.5), 'fill-rule': 'evenodd', ...steel }, g);
      el('path', { d: annSector(0, cy, 46, 52, -152, -28), ...steel }, g);
      el('path', { d: annSector(0, cy, 52, 62, -146, -34), fill: T.rubber, ...INK() }, g);
      [-118, -90, -62].forEach(a => { const q = arcPt(0, cy, 57, a); el('circle', { cx: r1(q[0]), cy: r1(q[1]), r: 2.4, fill: C.steel }, g); });
      el('path', { d: `M${r1(arcPt(0, cy, 49, -130)[0])} ${r1(arcPt(0, cy, 49, -130)[1])}A49 49 0 0 1 ${r1(arcPt(0, cy, 49, -100)[0])} ${r1(arcPt(0, cy, 49, -100)[1])}`, fill: 'none', stroke: C.paper, 'stroke-width': 2.5, opacity: 0.75, 'stroke-linecap': 'round' }, g);
      const o1 = arcPt(0, cy, 62, -146), o2 = arcPt(0, cy, 62, -34), t1 = arcPt(0, cy, 52, -28), t0 = arcPt(0, cy, 52, -152);
      return `M${r1(o1[0])} ${r1(o1[1])}A62 62 0 0 1 ${r1(o2[0])} ${r1(o2[1])}L${r1(t1[0])} ${r1(t1[1])}L${r1(i1[0])} ${r1(i1[1])}A40 40 0 0 0 ${r1(i0[0])} ${r1(i0[1])}L${r1(t0[0])} ${r1(t0[1])}Z`;
    }
    if (kind === 'shaft') {
      el('path', { d: dRect(-60, -10, 16, 20, 2), ...steel }, g);
      el('path', { d: dRect(34, -11, 22, 22), ...steel }, g);
      el('path', { d: dRect(55, -7, 6, 14), ...steel }, g);
      el('path', { d: dRect(-46, -16, 82, 32, 3), ...steel }, g);
      el('path', { d: dRect(-30, -16, 26, 6), fill: C.steelDark, ...INK({ 'stroke-width': 1.6 }) }, g);
      el('path', { d: 'M-40 -16V16M30 -16V16', stroke: C.ink, 'stroke-width': 1.5 }, g);
      hi('M-36 -7H28'); hi('M38 -5H52', 2.5);
      return 'M-60 -10H-46V-16H36V-11H55V-7H61V7H55V11H36V16H-46V10H-60Z';
    }
    if (kind === 'hosecoil') {
      [[0, 0, 44], [3, -2, 35], [6, -4, 26]].forEach(([x, y, r]) => {
        el('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.ink, 'stroke-width': 10 }, g);
        el('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.steelDark, 'stroke-width': 4.5 }, g);
      });
      el('path', { d: 'M30 31L42 43', stroke: C.ink, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M30 31L42 43', stroke: C.steelDark, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M38 36l12 12l-7 7l-12 -12z', fill: C.steel, ...INK({ 'stroke-width': 2 }) }, g);
      el('path', { d: 'M-30 -22A37 37 0 0 1 -10 -36', fill: 'none', stroke: C.steel, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
      return dCircle(0, 0, 50);
    }
    if (kind === 'sealring') {
      el('path', { d: dCircle(0, 0, 35) + dCircle(0, 0, 23), 'fill-rule': 'evenodd', fill: T.rubber, ...INK() }, g);
      el('path', { d: 'M-27 -12A29 29 0 0 1 -10 -27', fill: 'none', stroke: C.steel, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      return dCircle(0, 0, 35) + dCircle(0, 0, 23);
    }
    // generic part: rounded block with a bore
    el('path', { d: `M-40 -20Q-40 -30 -30 -30H30Q40 -30 40 -20V20Q40 30 30 30H-30Q-40 30 -40 20Z` + dCircle(10, 0, 12), 'fill-rule': 'evenodd', ...steel }, g);
    el('path', { d: 'M-32 -22H18', stroke: C.paper, 'stroke-width': 3, opacity: 0.75, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: -24, cy: 14, r: 4, fill: C.steelDark, ...INK({ 'stroke-width': 1.5 }) }, g);
    el('circle', { cx: 10, cy: 0, r: 12, fill: 'none', stroke: C.ink, 'stroke-width': 2.5 }, g);
    return `M-40 -20Q-40 -30 -30 -30H30Q40 -30 40 -20V20Q40 30 30 30H-30Q-40 30 -40 20Z` + dCircle(10, 0, 12);
  }
  function Part(parent, o = {}) {
    const kind = PART_SIZE[o.kind] ? o.kind : 'part';
    const [pw, ph] = PART_SIZE[kind];
    const g = el('g', {}, parent);
    const halo = haloNode(g, 10);
    const cradleG = el('g', {}, g);
    if (kind === 'shaft') {
      [-28, 26].forEach(x => {
        el('path', { d: `M${x - 18} 30H${x + 18}V44H${x - 18}Z`, fill: C.steelDark, ...INK() }, cradleG);
        el('path', { d: `M${x - 18} 30V20Q${x} 10 ${x + 18} 20V30Z`, fill: C.neutral, ...INK() }, cradleG);
      });
    }
    const content = el('g', {}, g);
    const bodyG = el('g', {}, content);
    const sil = drawPart(kind, bodyG);
    const clipId = uniq('pclip');
    el('path', { d: sil, 'clip-rule': 'evenodd' }, el('clipPath', { id: clipId }, el('defs', {}, g)));
    const overlay = el('g', { 'clip-path': `url(#${clipId})` }, content);
    const dull = el('path', { d: dRect(-pw / 2 - 12, -ph / 2 - 12, pw + 24, ph + 24), fill: C.floor }, overlay);
    const wear = el('g', {}, overlay);
    let wl = '', wd = '';
    for (let i = 0; i < 6; i++) {
      const x = (hash(i + 3) - 0.5) * pw * 0.8, y = (hash(i + 11) - 0.5) * ph * 0.7;
      wl += `M${r1(x)} ${r1(y)}l${r1(6 + 6 * hash(i))} ${r1(3 - 6 * hash(i + 5))}`;
      wd += dCircle(-x * 0.7, y * 0.8 + 4, 2 + 1.5 * hash(i + 7));
    }
    el('path', { d: wl, stroke: C.inkSoft, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, wear);
    el('path', { d: wd, fill: C.steelDark, opacity: 0.6 }, wear);
    // rust speckles: one path; update() includes the first k of them, in a fixed shuffled order
    const rustDots = [];
    for (let i = 0; i < 22; i++) rustDots.push({ d: dCircle((hash(i * 2 + 41) - 0.5) * pw, (hash(i * 2 + 42) - 0.5) * ph, 2.2 + 2.6 * hash(i + 90)), k: hash(i + 500) });
    rustDots.sort((a, b) => a.k - b.k);
    const rustN = el('path', { fill: T.rust }, overlay);
    const scratch = el('path', { fill: 'none', stroke: C.error, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, overlay);
    {
      let sd = '';
      for (let i = 0; i < 4; i++) {
        const x = -pw * 0.35 + i * pw * 0.2, y = -ph * 0.2 + (i % 2) * ph * 0.3;
        sd += `M${r1(x)} ${r1(y)}l5 4l4 -5l5 4l4 -4`;
      }
      set(scratch, { d: sd });
    }
    const outlineN = el('path', { d: sil, fill: 'none', ...INK(), 'fill-rule': 'evenodd' }, content);
    const sparkle = el('g', {}, content);
    [[pw / 2 - 8, -ph / 2 - 6, 9], [pw / 2 + 10, -ph / 2 + 12, 6]].forEach(([x, y, s]) =>
      el('path', { d: `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, fill: C.paper, ...INK({ 'stroke-width': 1.6 }) }, sparkle));
    // protective bubble wrap in two halves split by a jagged tear
    const wrapG = el('g', {}, g);
    const wid = uniq('pwrap');
    const defs = el('defs', {}, wrapG);
    const revealR = el('rect', { x: -pw / 2 - 14, y: -ph / 2 - 14, width: 0, height: ph + 28 }, el('clipPath', { id: wid }, defs));
    const wrapInner = el('g', { 'clip-path': `url(#${wid})` }, wrapG);
    let tear = `M${r1(-pw / 2 - 20)} ${r1(-ph / 2 - 20)}`;
    const jag = [];
    for (let i = 0; i <= 8; i++) jag.push([((i % 2) ? 7 : -7) + 4, -ph / 2 - 14 + (i * (ph + 28)) / 8]);
    const leftClip = uniq('pwl'), rightClip = uniq('pwr');
    el('path', { d: dPoly([[-pw / 2 - 20, -ph / 2 - 20], ...jag, [-pw / 2 - 20, ph / 2 + 20]]) }, el('clipPath', { id: leftClip }, defs));
    el('path', { d: dPoly([[pw / 2 + 20, -ph / 2 - 20], ...jag, [pw / 2 + 20, ph / 2 + 20]]) }, el('clipPath', { id: rightClip }, defs));
    void tear;
    const halves = [leftClip, rightClip].map(id => {
      const hg = el('g', {}, wrapInner);
      const cg = el('g', { 'clip-path': `url(#${id})` }, hg);
      el('rect', { x: -pw / 2 - 12, y: -ph / 2 - 12, width: pw + 24, height: ph + 24, rx: 14, fill: C.paper, opacity: 0.62, stroke: C.inkSoft, 'stroke-width': 2.5 }, cg);
      let bub = '';
      for (let yy = -ph / 2 - 4, row = 0; yy < ph / 2 + 8; yy += 13, row++)
        for (let xx = -pw / 2 - 4 + (row % 2 ? 7 : 0); xx < pw / 2 + 8; xx += 14) bub += dCircle(xx, yy, 4);
      el('path', { d: bub, fill: 'none', stroke: C.inkSoft, 'stroke-width': 1.3, opacity: 0.6 }, cg);
      el('path', { d: dPoly(jag, false), fill: 'none', stroke: C.inkSoft, 'stroke-width': 2, display: 'none' }, cg);
      return { hg, edge: cg.lastChild };
    });
    const tagG = el('g', { transform: tf(pw / 2 - 12, -ph / 2 + 2) }, g);
    const tagNew = buildTag(tagG, { lines: ['NEW'], size: 22, weight: 800, minW: 72, minH: 36, string: 24 });
    const tagCore = buildTag(tagG, { lines: ['CORE'], size: 22, weight: 800, minW: 72, minH: 36, string: 24, fill: mix(C.paper, C.floor, 0.55) });
    const missN = el('path', { d: sil, fill: 'none', stroke: C.error, 'stroke-width': 3, 'stroke-dasharray': '9 7', 'fill-rule': 'evenodd' }, g);
    return {
      g, kind, size: [pw, ph],
      update(p = {}) {
        const st = p.state ?? null, missing = !!p.missing, t = p.t ?? 0;
        show(content, !missing); show(missN, missing);
        show(cradleG, kind === 'shaft' && !!p.cradle && !missing);
        const core = st === 'core';
        show(dull, core); set(dull, { opacity: 0.55 });
        show(wear, core);
        show(sparkle, st === 'new');
        if (st === 'new') set(sparkle, { opacity: 0.75 + 0.25 * Math.sin(2 * Math.PI * t / 1.4) });
        const rust = clamp(p.rust ?? 0), nr = Math.round(rust * rustDots.length);
        show(rustN, nr > 0);
        if (nr > 0) set(rustN, { d: rustDots.slice(0, nr).map(r => r.d).join('') });
        show(scratch, (p.scratched ?? 0) > 0); set(scratch, { opacity: clamp(p.scratched ?? 0) });
        const wrap = clamp(p.wrap ?? 0), torn = ease.enter(clamp(p.torn ?? 0));
        show(wrapG, wrap > 0 && !missing);
        set(revealR, { width: r1((pw + 28) * ease.enter(wrap)) });
        set(halves[0].hg, { transform: tf(-10 * torn, 6 * torn, 1, -8 * torn) });
        set(halves[1].hg, { transform: tf(34 * torn, 26 * torn, 1, 30 * torn), opacity: 1 - 0.3 * torn });
        halves.forEach(hv => show(hv.edge, torn > 0));
        const tg = p.tag !== undefined ? p.tag : st;
        show(tagNew.g, tg === 'new' && !missing); show(tagCore.g, tg === 'core' && !missing);
        const pose = tagPose({ on: p.tagOn ?? 1, t });
        [tagNew, tagCore].forEach(tgn => set(tgn.g, { transform: tf(pose.x, pose.y, 1, pose.r), opacity: pose.o }));
        setHalo(halo, sil, p.outline, p.t);
      },
    };
  }
  Part.sizes = PART_SIZE;
  const partAlias = kind => (parent, o = {}) => Part(parent, { ...o, kind });

  // ======================================================================================
  // Kit.Splinters(parent, {n = 5})
  //   Broken-pallet wood shards (carton / cartonEdge with ink outlines), for disposal.
  // update({spread = 0, t}): 0 = shards clustered; 1 = scattered about 60 px and turned.
  // Origin: centre of the cluster.
  // ======================================================================================
  function Splinters(parent, o = {}) {
    const n = o.n ?? 5;
    const g = el('g', {}, parent);
    const shards = [];
    for (let i = 0; i < n; i++) {
      const L = 34 + 26 * hash(i + 1), Wd = 7 + 4 * hash(i + 2);
      const sg = el('g', {}, g);
      el('path', { d: `M${r1(-L / 2)} 0L${r1(-L / 4)} ${r1(-Wd / 2)}L${r1(L / 2)} ${r1(-Wd / 2 + 2)}L${r1(L / 2 - 6)} 1L${r1(L / 2 + 3)} ${r1(Wd / 2)}L${r1(-L / 3)} ${r1(Wd / 2)}Z`, fill: i % 2 ? C.cartonEdge : C.carton, ...INK({ 'stroke-width': 2 }) }, sg);
      shards.push({ sg, a: hash(i + 7) * 360, r0: 6 + 8 * hash(i + 3), r1: 34 + 30 * hash(i + 4), rot0: -30 + 60 * hash(i + 5), rot1: -90 + 180 * hash(i + 6) });
    }
    return {
      g,
      update(p = {}) {
        const s = ease.enter(clamp(p.spread ?? 0));
        shards.forEach(sh => {
          const r = lerp(sh.r0, sh.r1, s), a = (sh.a * Math.PI) / 180;
          set(sh.sg, { transform: tf(r * Math.cos(a), r * Math.sin(a) * 0.6, 1, lerp(sh.rot0, sh.rot1, s)) });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.Pallet(parent, {shadow = true})
  //   Oblique-isometric wooden pallet, 300×71 (front 240 wide, 36 high, 70 deep): top boards,
  //   three blocks, bottom board. Holds a stack of up to 6 Cartons (2 wide × 3 high, w 104 h 96 d 44).
  // update({count = 0, cartons = [], broken = 0, outline, t}):
  //   count 0..6: cartons shown, filled bottom-left, bottom-right, then up. A fractional part
  //     drops the next carton in from 40 px above with a fade (stacked state).
  //   cartons: per-carton Carton.update params by stack index, e.g. [{}, {damaged: 1}].
  //   broken 0..1: the front top board cracks and the pallet (with its stack) tilts 3 degrees.
  //   outline: halo around the pallet only.
  // Extras: pallet.cartons[i] (Carton components), pallet.slot(i) -> {x, y} front-bottom-centre of
  //   stack slot i in pallet coords, pallet.box(count) -> {w, h, d} of the pallet plus stack, for a
  //   Kit.Strap round the load. States: intact, broken, stacked. Splinters: Kit.Splinters.
  // Origin: bottom-centre of the front face.
  // ======================================================================================
  function Pallet(parent, o = {}) {
    const w = 240, d = 70, h = 36, CW = 104, CH = 96, CD = 44;
    const g = el('g', {}, parent);
    if (o.shadow !== false) Kit.shadow(g, w + d * CS + 16, { x: (d * CS) / 2, y: 0 });
    const tilt = el('g', {}, g);
    const halo = haloNode(tilt, 11);
    const fp = cs => dPoly(cs.map(c => P(...c)));
    const pg = el('g', {}, tilt);
    const thin = INK({ 'stroke-width': 1.8 });
    // right side face: dark opening band, block ends, boards
    el('path', { d: fp([[w / 2, 9, 0], [w / 2, 9, d], [w / 2, 27, d], [w / 2, 27, 0]]), fill: T.hole }, pg);
    [[0, 14], [28, 42], [56, 70]].forEach(([a, b]) => el('path', { d: fp([[w / 2, 9, a], [w / 2, 9, b], [w / 2, 27, b], [w / 2, 27, a]]), fill: C.cartonEdge, ...thin }, pg));
    el('path', { d: fp([[w / 2, 0, 0], [w / 2, 0, d], [w / 2, 9, d], [w / 2, 9, 0]]), fill: C.cartonEdge, ...thin }, pg);
    for (let k = 0; k < 4; k++) el('path', { d: fp([[w / 2, 27, k * 18.5], [w / 2, 27, k * 18.5 + 14], [w / 2, 36, k * 18.5 + 14], [w / 2, 36, k * 18.5]]), fill: C.cartonEdge, ...thin }, pg);
    // front: opening band, blocks, boards
    el('path', { d: fp([[-w / 2, 9, 0], [w / 2, 9, 0], [w / 2, 27, 0], [-w / 2, 27, 0]]), fill: T.hole }, pg);
    [[-w / 2, -w / 2 + 30], [-15, 15], [w / 2 - 30, w / 2]].forEach(([a, b]) => {
      el('path', { d: fp([[b, 9, 0], [b, 9, 12], [b, 27, 12], [b, 27, 0]]), fill: C.cartonEdge }, pg);
      el('path', { d: fp([[a, 9, 0], [b, 9, 0], [b, 27, 0], [a, 27, 0]]), fill: C.carton, ...thin }, pg);
    });
    el('path', { d: fp([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 9, 0], [-w / 2, 9, 0]]), fill: C.carton, ...thin }, pg);
    // top deck: dark base then four boards; the front board's edge is the top front strip
    el('path', { d: fp([[-w / 2, 36, 0], [w / 2, 36, 0], [w / 2, 36, d], [-w / 2, 36, d]]), fill: T.hole }, pg);
    for (let k = 3; k >= 0; k--) el('path', { d: fp([[-w / 2, 36, k * 18.5], [w / 2, 36, k * 18.5], [w / 2, 36, k * 18.5 + 14], [-w / 2, 36, k * 18.5 + 14]]), fill: T.top, ...thin }, pg);
    const crackL = el('path', { d: fp([[-w / 2, 27, 0], [28, 27, 0], [28, 36, 0], [-w / 2, 36, 0]]), fill: C.carton, ...thin }, pg);
    const crackR = el('path', { d: fp([[32, 27, 0], [w / 2, 27, 0], [w / 2, 36, 0], [32, 36, 0]]), fill: C.carton, ...thin }, pg);
    el('path', { d: fp([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 0, d], [w / 2, 36, d], [-w / 2, 36, d], [-w / 2, 36, 0]]), fill: 'none', ...INK() }, pg);
    const crack = el('path', { d: `M${r1(P(28, 36, 0)[0])} ${r1(P(28, 36, 0)[1])}l5 4l-4 3l6 3M${r1(P(28, 36, 0)[0])} ${r1(P(28, 36, 0)[1])}l6 -5l-3 -4l7 -3`, fill: 'none', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, pg);
    const stack = el('g', {}, tilt);
    const slot = i => { const col = i % 2, row = Math.floor(i / 2); const q = P(col ? 58 : -58, 36 + row * CH, 13); return { x: q[0], y: q[1] }; };
    const cartons = [];
    for (let i = 0; i < 6; i++) {
      const c = Carton(stack, { w: CW, h: CH, d: CD });
      const s = slot(i);
      set(c.g, { transform: tf(s.x, s.y) });
      cartons.push(c);
    }
    return {
      g, cartons, slot,
      box: (count = 6) => ({ w, h: h + Math.ceil(Math.min(6, count) / 2) * CH, d }),
      update(p = {}) {
        const n = clamp(p.count ?? 0, 0, 6), b = ease.enter(clamp(p.broken ?? 0));
        cartons.forEach((c, i) => {
          const vis = i < Math.floor(n) || (i === Math.floor(n) && n % 1 > 0);
          show(c.g, vis);
          if (!vis) return;
          const s = slot(i);
          const q = i < Math.floor(n) ? 1 : n % 1;
          set(c.g, { transform: tf(s.x, s.y - 40 * (1 - ease.enter(q))), opacity: seg(q, 0, 0.4) });
          c.update({ ...(p.cartons?.[i] || {}), t: p.t });
        });
        set(tilt, { transform: b ? `rotate(${(-3 * b).toFixed(2)} ${-w / 2} 0)` : '' });
        show(crack, b > 0.02);
        set(crackR, { transform: b ? `translate(${r1(2 * b)} ${r1(3 * b)}) rotate(${(4 * b).toFixed(2)} ${r1(P(32, 31, 0)[0])} ${r1(P(32, 31, 0)[1])})` : '' });
        void crackL;
        setHalo(halo, fp([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 0, d], [w / 2, 36, d], [-w / 2, 36, d], [-w / 2, 36, 0]]), p.outline, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.Strap(parent, {w = 116, h = 110, d = 50, at = [0]})   (alias Kit.BandingStrap)
  //   Thin dark banding strap(s) round a box of front w×h and depth d with the same origin as a
  //   Carton (pass Pallet.box(n) for a loaded pallet). `at`: x offsets of each band.
  // update({cut = 0, t}): cut 0..1: the band snaps at the top-front edge (snap lines), springs
  //   loose and lands as a squiggle on the floor in front; at the end a pulsing error outline marks
  //   it as a trip hazard.
  // Origin: same as the Carton / Pallet it wraps (bottom-centre of the front face).
  // ======================================================================================
  function Strap(parent, o = {}) {
    const w = o.w ?? 116, h = o.h ?? 110, d = o.d ?? 50, at = o.at ?? [0], N = 30;
    const g = el('g', {}, parent);
    const bands = at.map((x0, bi) => {
      // attached route: up the front, over the top (the back run is hidden)
      const route = [[x0, 2, 0], [x0, h, 0], [x0, h, d]];
      const lens = [h - 2, d], total = lens[0] + lens[1];
      const attached = [];
      for (let i = 0; i < N; i++) {
        const s = (i / (N - 1)) * total;
        const k = s < lens[0] ? 0 : 1, u = k === 0 ? s / lens[0] : (s - lens[0]) / lens[1];
        const a = route[k], b = route[k + 1];
        attached.push(P(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)));
      }
      const loose = [];
      const span = Math.min(260, total * 0.9), dir = bi % 2 ? 1 : -1;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        loose.push(P(x0 + dir * (span * 0.5 - span * u) * 0.9 + 20 * dir, 1, -14 - 16 * Math.sin(u * Math.PI * 2.5 + bi)));
      }
      // mid pose: the band whips outward about its base (cut end flicks up and away)
      const B = P(x0, 2, 0), th = dir * 62 * (Math.PI / 180), ct = Math.cos(th), st = Math.sin(th);
      const mid = attached.map(q => { const dx = q[0] - B[0], dy = q[1] - B[1]; return [B[0] + dx * ct - dy * st, B[1] + dx * st + dy * ct]; });
      const halo = el('path', { fill: 'none', stroke: C.error, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      const band = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      const snap = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
      const cp = P(x0, h, 0);
      set(snap, { d: `M${r1(cp[0] - 10)} ${r1(cp[1] - 8)}l-10 -8M${r1(cp[0] + 10)} ${r1(cp[1] - 8)}l10 -8M${r1(cp[0])} ${r1(cp[1] - 12)}v-12` });
      return { attached, mid, loose, halo, band, snap };
    });
    return {
      g,
      update(p = {}) {
        const cut = clamp(p.cut ?? 0);
        const q1 = ease.enter(seg(cut, 0.08, 0.42)), q2 = ease.pop(seg(cut, 0.42, 1));
        bands.forEach(bd => {
          const pts = bd.attached.map((a, i) => {
            const m = bd.mid[i], b = bd.loose[i];
            const x = q2 > 0 ? lerp(m[0], b[0], q2) : lerp(a[0], m[0], q1);
            const y = q2 > 0 ? lerp(m[1], b[1], q2) : lerp(a[1], m[1], q1);
            return [x, y];
          });
          set(bd.band, { d: dPoly(pts, false) });
          const hv = seg(cut, 0.85, 1);
          show(bd.halo, hv > 0);
          if (hv > 0) set(bd.halo, { d: dPoly(pts, false), opacity: hv * pulse(p.t) });
          const sn = seg(cut, 0, 0.25);
          show(bd.snap, sn > 0 && sn < 1);
          set(bd.snap, { opacity: Math.sin(Math.PI * sn) });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.Scissors(parent, {})
  //   Scissors icon, ~130×60, blades pointing right: steel blades, neutral-blue handle loops.
  // update({open = 0.6}): blade opening 0..1 (0 = closed, 1 = about 34 degrees apart). Snip by
  //   driving open 1 -> 0 (e.g. 0.5 + 0.5 * cos(...)).
  // Origin: centre (the pivot screw).
  // ======================================================================================
  function Scissors(parent) {
    const g = el('g', {}, parent);
    const blades = [1, -1].map(sg => {
      const bg = el('g', {}, g);
      el('path', { d: `M-6 ${-3 * sg}L-30 ${14 * sg}`, stroke: C.ink, 'stroke-width': 9, 'stroke-linecap': 'round' }, bg);
      el('path', { d: `M-6 ${-3 * sg}L-30 ${14 * sg}`, stroke: C.steelDark, 'stroke-width': 4, 'stroke-linecap': 'round' }, bg);
      el('path', { d: `M-58 ${22 * sg}a17 12 0 1 0 34 0a17 12 0 1 0 -34 0Z M-50 ${22 * sg}a9 6 0 1 0 18 0a9 6 0 1 0 -18 0Z`, 'fill-rule': 'evenodd', fill: C.neutral, ...INK() }, bg);
      el('path', { d: `M-8 ${-6 * sg}L64 ${-2 * sg}Q72 0 64 ${2 * sg}L-8 ${5 * sg}Z`, fill: C.steel, ...INK() }, bg);
      el('path', { d: `M4 ${-2 * sg}L54 ${-0.5 * sg}`, stroke: C.paper, 'stroke-width': 2, opacity: 0.7, 'stroke-linecap': 'round' }, bg);
      return bg;
    });
    el('circle', { cx: 0, cy: 0, r: 5, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
    return {
      g,
      update(p = {}) {
        const a = 17 * clamp(p.open ?? 0.6);
        set(blades[0], { transform: `rotate(${(-a).toFixed(2)})` });
        set(blades[1], { transform: `rotate(${a.toFixed(2)})` });
      },
    };
  }

  // ======================================================================================
  // Kit.Tag(parent, {lines = ['P/N 123-A', 'QTY 2'], size = 22, string = 34})
  //   Hanging paper luggage tag on a string, at least 90×60, grows to fit its text (22 px 700).
  // update({write = 1, on = 1, remove = 0, swing = 0, t, lines}):
  //   write 0..1: the text writes on character by character across the lines.
  //   on 0..1: swings in from -75 degrees with a damped settle.  remove 0..1: pulled off up-right
  //   and fades. swing: extra angle in degrees. t: 1-degree idle sway. lines: replace the text.
  // Extras: tag.w, tag.h (body size).
  // Origin: the string's attachment point (the body hangs below-right of it).
  // ======================================================================================
  function Tag(parent, o = {}) {
    const g = el('g', {}, parent);
    const tg = buildTag(g, { lines: o.lines ?? ['P/N 123-A', 'QTY 2'], size: o.size ?? 22, string: o.string ?? 34 });
    return {
      g, w: tg.w, h: tg.h,
      update(p = {}) {
        if (p.lines) tg.setLines(p.lines);
        tg.write(p.write ?? 1);
        const ps = tagPose(p);
        set(tg.g, { transform: tf(ps.x, ps.y, 1, ps.r), opacity: ps.o });
      },
    };
  }

  // ======================================================================================
  // Kit.OverstockTag(parent, {arrow = true, text = 'Overstock', string = 30})
  //   Accent (orange) hanging tag reading "Overstock" (22 px 700 ink), with an optional accent
  //   down-arrow under it pointing to the permanent bin ("use first").
  // update({on = 1, remove = 0, swing = 0, arrow = 1, t}): arrow 0..1 shows the arrow, which bobs
  //   6 px down and back each 1.2 s (t). Other params as Kit.Tag.
  // Origin: the string's attachment point.
  // ======================================================================================
  function OverstockTag(parent, o = {}) {
    const g = el('g', {}, parent);
    const tg = buildTag(g, { lines: [o.text ?? 'Overstock'], size: 22, fill: C.accent, string: o.string ?? 30, minH: 44, arrow: o.arrow ?? true });
    return {
      g, w: tg.w, h: tg.h,
      update(p = {}) {
        const ps = tagPose(p);
        set(tg.g, { transform: tf(ps.x, ps.y, 1, ps.r), opacity: ps.o });
        if (tg.arrowG) {
          const a = clamp(p.arrow ?? 1), t = p.t ?? 0;
          show(tg.arrowG, a > 0);
          set(tg.arrowG, { opacity: a, transform: `translate(0 ${r1(6 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 1.2)))}) rotate(-9 ${r1(tg.w / 2 - 8)} 0)` });
        }
      },
    };
  }

  // ======================================================================================
  // Kit.PriceTag(parent, {text = 'Freight charges', string = 28})
  //   Small paper price tag (22 px 600 text, accent eyelet band) that swings onto a document.
  // update({on = 1, remove = 0, swing = 0, t}): as Kit.Tag (on = swing-in with damped settle).
  // Origin: the string's attachment point (pin it to the document's corner).
  // ======================================================================================
  function PriceTag(parent, o = {}) {
    const g = el('g', {}, parent);
    const tg = buildTag(g, { lines: [o.text ?? 'Freight charges'], size: 22, weight: 600, string: o.string ?? 28, minH: 44 });
    el('path', { d: `M-14 ${r1(-tg.h / 2 + 12)}L-2 ${r1(-tg.h / 2)}H9V${r1(tg.h / 2)}H-2L-14 ${r1(tg.h / 2 - 12)}Z`, fill: C.accent, ...INK({ 'stroke-width': 2 }) }, tg.body).parentNode.insertBefore(tg.body.lastChild, tg.body.childNodes[1]);
    return {
      g, w: tg.w, h: tg.h,
      update(p = {}) {
        const ps = tagPose(p);
        set(tg.g, { transform: tf(ps.x, ps.y, 1, ps.r), opacity: ps.o });
      },
    };
  }

  // ======================================================================================
  // Kit.LocationLabel(parent, {text = 'B-02-3', oldText = text, w = 150, h = 44, size = 26})
  //   (alias Kit.BinTag) Paper bin label with a location code or part number (26 px 600 ink).
  //   Widens to fit long text.
  // update({state = 'good', text, replace = 0, outline, t}):
  //   state: 'good' | 'worn' (torn top-right corner, dingy paper, faded scratched digits) |
  //     'missing' (dashed outline only).
  //   replace 0..1: the worn label (oldText) peels off its top-left corner and drops away while a
  //     crisp good label slides in from the right (+60 px). The final state is 'good'.
  //   text: change the text (e.g. 'Each' -> 'Pkg of 10').
  // Origin: centre.
  // ======================================================================================
  function LocationLabel(parent, o = {}) {
    const size = o.size ?? 26, h = o.h ?? 44;
    const txt0 = o.text ?? 'B-02-3';
    const w = Math.max(o.w ?? 150, measure(txt0, size, 600) + 28);
    const g = el('g', {}, parent);
    const halo = haloNode(g, 10);
    const torn = `M${-w / 2} ${-h / 2}H${w / 2 - 30}L${w / 2 - 22} ${-h / 2 + 7}L${w / 2 - 15} ${-h / 2 + 3}L${w / 2 - 10} ${-h / 2 + 13}L${w / 2} ${-h / 2 + 18}V${h / 2}H${-w / 2}Z`;
    const face = (parent2, worn, str) => {
      const fg = el('g', {}, parent2);
      if (worn) {
        el('path', { d: torn, fill: mix(C.paper, C.floor, 0.6), ...INK() }, fg);
        el('ellipse', { cx: -w / 4, cy: h / 6, rx: 18, ry: 8, fill: C.floor, opacity: 0.9 }, fg);
        const tn = ctext(fg, str, 0, 0, size, 600, C.inkSoft);
        set(tn, { opacity: 0.5 });
        el('path', { d: `M${-w / 4} -4l26 -6M${w / 12} 8l30 -9M${-w / 6} 12l14 -3`, stroke: mix(C.paper, C.floor, 0.6), 'stroke-width': 4, 'stroke-linecap': 'round' }, fg);
        return { fg, tn };
      }
      el('path', { d: dRect(-w / 2, -h / 2, w, h, 4), fill: C.paper, ...INK() }, fg);
      return { fg, tn: ctext(fg, str, 0, 0, size, 600, C.ink) };
    };
    const old = face(g, true, o.oldText ?? txt0);
    const cur = el('g', {}, g);
    const good = face(cur, false, txt0);
    const worn = face(cur, true, txt0);
    const miss = el('path', { d: dRect(-w / 2, -h / 2, w, h, 4), fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '8 6' }, cur);
    return {
      g, w, h,
      update(p = {}) {
        const rp = clamp(p.replace ?? 0);
        const st = rp > 0 ? 'good' : p.state ?? 'good';
        if (p.text != null) { set(good.tn, { text: p.text }); set(worn.tn, { text: p.text }); }
        show(good.fg, st === 'good'); show(worn.fg, st === 'worn'); show(miss, st === 'missing');
        show(old.fg, rp > 0 && rp < 0.62);
        if (rp > 0) {
          const k = seg(rp, 0, 0.6);
          set(old.fg, { transform: `translate(${r1(-6 * k)} ${r1(70 * k * k)}) rotate(${r1(-32 * ease.enter(seg(k, 0, 0.5)))} ${-w / 2} ${-h / 2})`, opacity: 1 - seg(k, 0.5, 1) });
        }
        const q = seg(rp, 0.38, 1);
        set(cur, { transform: rp > 0 ? `translate(${r1(60 * (1 - ease.enter(q)))} 0)` : '', opacity: rp > 0 ? seg(q, 0, 0.35) : 1 });
        setHalo(halo, dRect(-w / 2, -h / 2, w, h), p.outline, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.SectionMarker(parent, {text = '02'})
  //   80×36 accent label for a rack upright (26 px 800 ink numerals).
  // update({on = 1, text, outline, t}): on 0..1 slides in from the left (24 px) with a fade.
  // Origin: centre.
  // ======================================================================================
  function SectionMarker(parent, o = {}) {
    const g = el('g', {}, parent);
    const halo = haloNode(g, 10);
    const inner = el('g', {}, g);
    el('path', { d: dRect(-40, -18, 80, 36, 5), fill: C.accent, ...INK() }, inner);
    const tn = ctext(inner, o.text ?? '02', 0, 0, 26, 800);
    return {
      g,
      update(p = {}) {
        const on = clamp(p.on ?? 1);
        if (p.text != null) set(tn, { text: p.text });
        set(inner, { transform: `translate(${r1(-24 * (1 - ease.enter(on)))} 0)`, opacity: seg(on, 0, 0.6) });
        setHalo(halo, dRect(-40, -18, 80, 36), p.outline, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.AisleSign(parent, {letter = 'A', drop = 70})
  //   Hanging placard 120×140 on two wires: accent header band "AISLE" (22 px 700) and a big
  //   letter (84 px 800). Hangs `drop` px below its ceiling anchor.
  // update({on = 1, letter, t}): on 0..1 drops from 480 px above (ease-out, first 45 %) and swings
  //   to rest (damped, 10 degrees); t gives a 0.6-degree idle sway.
  // Origin: the ceiling anchor (top centre of the wires).
  // ======================================================================================
  function AisleSign(parent, o = {}) {
    const dr = o.drop ?? 70;
    const g = el('g', {}, parent);
    const sw = el('g', {}, g);
    el('path', { d: `M-34 0L-40 ${dr}M34 0L40 ${dr}`, stroke: C.ink, 'stroke-width': 2, fill: 'none' }, sw);
    el('path', { d: dRect(-60, dr, 120, 140, 8), fill: C.paper, ...INK() }, sw);
    el('path', { d: `M-60 ${dr + 8}Q-60 ${dr} -52 ${dr}H52Q60 ${dr} 60 ${dr + 8}V${dr + 32}H-60Z`, fill: C.accent, ...INK() }, sw);
    text(sw, 'AISLE', { x: 0, y: dr + 24, size: 22, weight: 700, anchor: 'middle', spacing: 0.12 });
    const letter = ctext(sw, o.letter ?? 'A', 0, dr + 88, 84, 800);
    [-40, 40].forEach(x => el('circle', { cx: x, cy: dr + 4, r: 3, fill: C.ink }, sw));
    return {
      g,
      update(p = {}) {
        const on = clamp(p.on ?? 1), t = p.t ?? 0;
        if (p.letter != null) set(letter, { text: p.letter });
        const y = -480 * (1 - ease.enter(seg(on, 0, 0.45)));
        const ang = 10 * wobble(seg(on, 0.38, 1), 2, 3) + 0.6 * Math.sin((2 * Math.PI * t) / 3.1);
        set(sw, { transform: `translate(0 ${r1(y)}) rotate(${ang.toFixed(2)})`, opacity: seg(on, 0, 0.12) });
      },
    };
  }

  // ======================================================================================
  // Kit.WireBasket(parent, {w = 140, h = 80, d = 46})
  //   Steel wire mesh basket on a shelf, ~180×105, with a few small parts inside.
  // update({over = 0, outline, t}): over 0..1 overloads it: the floor sags 14 px, parts heap above
  //   the rim, two parts spill over the front edge (falling on a 1.4 s loop, t), and a pulsing
  //   error outline appears (overloaded state; 0 = normal).
  // Origin: bottom-centre of the front face.
  // ======================================================================================
  function WireBasket(parent, o = {}) {
    const w = o.w ?? 140, h = o.h ?? 80, d = o.d ?? 46;
    const g = el('g', {}, parent);
    const halo = haloNode(g, 11);
    const wire = { fill: 'none', stroke: C.steelDark, 'stroke-width': 1.8 };
    const back = el('path', wire, g);
    const floorN = el('path', { fill: mix(C.steel, C.paper, 0.6), opacity: 0.7 }, g);
    // contents: simple mini parts (nuts, rings, bolts)
    const mini = (pg, kind, x, y, s = 1) => {
      const m = el('g', { transform: tf(x, y, s) }, pg);
      if (kind === 0) el('path', { d: 'M-9 -5L0 -10L9 -5V5L0 10L-9 5Z' + dCircle(0, 0, 3.5), 'fill-rule': 'evenodd', fill: C.steel, ...INK({ 'stroke-width': 2 }) }, m);
      else if (kind === 1) el('path', { d: dCircle(0, 0, 10) + dCircle(0, 0, 5), 'fill-rule': 'evenodd', fill: T.rubber, ...INK({ 'stroke-width': 2 }) }, m);
      else el('path', { d: 'M-14 -4H8V-7H14V7H8V4H-14Z', fill: C.steel, ...INK({ 'stroke-width': 2 }) }, m);
      return m;
    };
    const base = el('g', {}, g);
    [[-40, -14, 0], [-16, -12, 1], [10, -14, 2], [36, -12, 0], [54, -18, 1]].forEach(([x, y, k]) => mini(base, k, x + 8, y - 4));
    const heap = el('g', {}, g);
    const heapItems = [];
    // a mound above the rim: rows of 5, 4, 3 items
    let hi = 0;
    [5, 4, 3].forEach((cnt, r) => {
      for (let j = 0; j < cnt; j++, hi++) {
        const x = (j - (cnt - 1) / 2) * (w / 5.4) + 6 * (hash(hi) - 0.5), y = -h + 6 - r * 15 - 3 * hash(hi + 9);
        heapItems.push(mini(heap, (hi * 2 + r) % 3, x, y, 1.05));
      }
    });
    const spill = [0, 1].map(i => mini(g, i === 0 ? 0 : 2, 0, 0, 1.1));
    const front = el('path', { fill: 'none', stroke: C.steelDark, 'stroke-width': 1.8 }, g);
    const frame = el('path', { fill: 'none', ...INK() }, g);
    return {
      g,
      update(p = {}) {
        const ov = ease.enter(clamp(p.over ?? 0)), t = p.t ?? 0, sag = 14 * ov;
        const sagY = (x, z) => -sag * Math.sin(Math.PI * clamp((x + w / 2) / w)) * (1 - 0.4 * (z / d));
        const pt = (x, y, z) => { const q = P(x, y, z); return [q[0], q[1] - (y === 0 ? sagY(x, z) : 0)]; };
        const ln = (a, b) => `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
        const curve = (z, y) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(pt(-w / 2 + (w * i) / 8, y, z)); return pts; };
        let bd = '';
        for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 10) bd += ln(pt(x, 0, d), pt(x, h, d));
        bd += dPoly(curve(d, h * 0.5), false) + dPoly(curve(d, 0), false);
        set(back, { d: bd });
        set(floorN, { d: dPoly([...curve(0, 0), ...curve(d, 0).reverse()]) });
        let fd = '';
        for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 10) fd += ln(pt(x, 0, 0), pt(x, h, 0));
        for (let z = 0; z <= d + 0.1; z += d / 3) fd += ln(pt(w / 2, 0, z), pt(w / 2, h, z));
        fd += dPoly(curve(0, h * 0.5), false) + dPoly(curve(0, h * 0.25), false) + dPoly(curve(0, h * 0.75), false);
        [0.25, 0.5, 0.75].forEach(v => { fd += ln(pt(w / 2, h * v, 0), pt(w / 2, h * v, d)); });
        set(front, { d: fd });
        const fr = dPoly([...curve(0, 0), pt(w / 2, 0, d), pt(w / 2, h, d), pt(-w / 2, h, d), pt(-w / 2, h, 0)]);
        set(frame, { d: fr + dPoly([pt(-w / 2, h, 0), pt(w / 2, h, 0), pt(w / 2, h, d)], false) + ln(pt(w / 2, h, 0), pt(w / 2, 0, 0)) });
        set(base, { transform: `translate(${r1(d * CS * 0.45)} ${r1(-d * SN * 0.45 + sag * 0.6)})` });
        show(heap, ov > 0.01);
        heapItems.forEach((m, i) => show(m, ov * 12 > i));
        set(heap, { transform: `translate(${r1(d * CS * 0.4)} ${r1(-d * SN * 0.4 + (1 - ov) * 20)})`, opacity: seg(ov, 0, 0.5) });
        spill.forEach((m, i) => {
          const k = fmod(t / 1.4 + i * 0.5, 1);
          const x0 = -w / 4 + i * w / 2.5, y0 = -h - 8;
          show(m, ov > 0.6);
          set(m, { transform: tf(x0 + 18 * k, y0 + 120 * k * k, 1.1, 200 * k * (i ? -1 : 1)), opacity: (1 - seg(k, 0.75, 1)) * seg(ov, 0.6, 1) });
        });
        const hl = p.outline !== undefined ? p.outline : ov > 0.3 ? 'error' : null;
        setHalo(halo, dPoly([...curve(0, 0), pt(w / 2, 0, d), pt(w / 2, h, d), pt(-w / 2, h, d), pt(-w / 2, h, 0)]), hl, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.PalletRack(parent, {bays = 1, aisle = 'B', labels, parts, contents})
  //   Rack: per bay 520×560, steel-dark uprights (punched holes), steel beams, light wire decks in
  //   30-degree depth, 3 shelves × 3 bins per bay. Each bin carries a LocationLabel (136×36, 24 px)
  //   on its beam and can hold a Carton, Part icons or a WireBasket.
  //   Bins are indexed i = bay * 9 + shelf * 3 + bin, shelf 0 = bottom. Default label of bin i:
  //   `${aisle}-${section}-${shelf + 1}` with section = bay * 3 + bin + 1, two digits (so the middle
  //   bin of the top shelf of bay 0 is "B-02-3"). labels: array or function(i, bay, shelf, bin).
  //   parts: part kinds shown in 'parts' bins, an array per bin index or one array for all
  //   (default ['bolt', 'bearing']).
  //   contents: which bin content kinds to build, default all of ['carton', 'over', 'parts',
  //   'basket', 'tag'] (~250 nodes per bin). Pass e.g. ['carton', 'tag'] for a lighter rack; a
  //   content kind that was not built shows nothing.
  // update({state = 'stocked', fill, order, bins, arrows = 1, t}):
  //   state: 'empty' | 'stocked' (a carton in every bin) | 'overstocked' (cartons crammed and
  //     bulging past the bin edges, error outlines) | 'permanent' (permanent + overstock: lower two
  //     shelves stocked and labelled; top shelf cartons carry an OverstockTag and an accent arrow on
  //     the top beam points down to the permanent bin, bobbing for "use first").
  //   fill: how many bins (in `order`, default bottom-left to top-right) have their content; a
  //     fractional part drops the next one in from 40 px above. Default: all.
  //   bins: per-bin overrides, {i: {...}} or array: {content: 'carton' | 'over' | 'parts' |
  //     'basket' | 'none', carton: {Carton params}, label, labelState: 'good' | 'worn' | 'missing',
  //     replace (label replace 0..1), labelOn (0..1 fade), tag (bool), basket: 0..1 overload,
  //     part: {Part params}, outline, o (content opacity)}.
  //   arrows 0..1: visibility of the permanent-state arrows.
  // Extras: rack.bin(i) -> {x, y} front-bottom-centre of bin i's content (rack coords);
  //   rack.labelAt(i) -> {x, y} label centre; rack.index(bay, shelf, bin); rack.cartons[i],
  //   rack.labels[i] (components; cartons[i] is null if 'carton' was not built); rack.n; rack.width.
  // Origin: bottom-centre of the front frame on the floor line.
  // ======================================================================================
  function PalletRack(parent, o = {}) {
    const bays = o.bays ?? 1, W = bays * 520, H = 560, UW = 22, BH = 40, RD = 46;
    const LV = [60, 235, 410];
    const S = (W - UW) / bays, ux = k => -W / 2 + UW / 2 + k * S, binW = (S - UW) / 3;
    const n = bays * 9;
    const index = (bay, shelf, bin) => bay * 9 + shelf * 3 + bin;
    const coords = i => ({ bay: Math.floor(i / 9), shelf: Math.floor((i % 9) / 3), bin: i % 3 });
    const binX = i => { const c = coords(i); return ux(c.bay) + UW / 2 + (c.bin + 0.5) * binW; };
    const pad2 = v => String(v).padStart(2, '0');
    const labelOf = i => {
      const c = coords(i);
      if (typeof o.labels === 'function') return o.labels(i, c.bay, c.shelf, c.bin);
      if (Array.isArray(o.labels) && o.labels[i] != null) return o.labels[i];
      return `${o.aisle ?? 'B'}-${pad2(c.bay * 3 + c.bin + 1)}-${c.shelf + 1}`;
    };
    const partsOf = i => (Array.isArray(o.parts) ? (Array.isArray(o.parts[0]) ? o.parts[i] || ['bolt', 'bearing'] : o.parts) : ['bolt', 'bearing']);
    const g = el('g', {}, parent);
    Kit.shadow(g, W + 60, { x: (RD * CS) / 2, y: 0 });
    const rear = el('g', {}, g);
    const off = P(0, 0, RD);
    for (let k = 0; k <= bays; k++) el('path', { d: dRect(ux(k) - UW / 2 + off[0], -H + off[1], UW, H), fill: T.rear, ...INK({ 'stroke-width': 2 }) }, rear);
    for (let k = 0; k < bays; k++) LV.forEach(lv => el('path', { d: dRect(ux(k) + UW / 2 + off[0], -lv + off[1], S - UW, 16), fill: T.rear, ...INK({ 'stroke-width': 2 }) }, rear));
    // right-end side frame bracing
    const xr = ux(bays);
    let br = '';
    for (let y = 30; y < H - 40; y += 90) { const a = P(xr, y, 0), b = P(xr, y + 90, RD); br += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
    el('path', { d: br, stroke: C.steelDark, 'stroke-width': 4, fill: 'none' }, rear);
    // decks
    const decks = el('g', {}, g);
    for (let k = 0; k < bays; k++) LV.forEach(lv => {
      const xa = ux(k) + UW / 2, xb = ux(k + 1) - UW / 2;
      el('path', { d: dPoly([P(xa, lv, 0), P(xb, lv, 0), P(xb, lv, RD), P(xa, lv, RD)]), fill: mix(C.steel, C.paper, 0.55), ...INK({ 'stroke-width': 2 }) }, decks);
      let wl = '';
      for (let x = xa + 24; x < xb; x += 24) { const a = P(x, lv, 2), b = P(x, lv, RD - 2); wl += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
      el('path', { d: wl, stroke: C.steel, 'stroke-width': 1.5 }, decks);
    });
    // front uprights
    for (let k = 0; k <= bays; k++) {
      const x = ux(k);
      el('path', { d: dRect(x - UW / 2, -H, UW, H), fill: C.steelDark, ...INK() }, g);
      let hd = '';
      for (let y = -H + 16; y < -10; y += 22) hd += `M${x - 3} ${y}h6v8h-6z`;
      el('path', { d: hd, fill: C.ink, opacity: 0.55 }, g);
      el('path', { d: dRect(x - UW / 2 - 6, -6, UW + 12, 6), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
    }
    // beams with labels and permanent-state arrows
    for (let k = 0; k < bays; k++) LV.forEach(lv => el('path', { d: dRect(ux(k) + UW / 2, -lv, S - UW, BH), fill: C.steel, ...INK() }, g));
    const labels = [], arrowsN = [];
    for (let i = 0; i < n; i++) {
      const c = coords(i);
      const lg = el('g', { transform: tf(binX(i), -LV[c.shelf] + BH / 2) }, g);
      labels.push(LocationLabel(lg, { text: labelOf(i), w: 136, h: 36, size: 24 }));
      if (c.shelf === 2) {
        const ag = el('g', { transform: tf(binX(i), -LV[2] + BH / 2) }, g);
        el('path', { d: 'M-10 -16h20v12h14l-24 22l-24 -22h14z', fill: C.accent, ...INK() }, ag);
        arrowsN.push({ i, ag });
      }
    }
    // contents per bin
    const cg = el('g', {}, g);
    const bins = [];
    const CW = 92, CH = 86, CD = 40;
    const has = Object.fromEntries(['carton', 'over', 'parts', 'basket', 'tag'].map(k => [k, (o.contents ?? ['carton', 'over', 'parts', 'basket', 'tag']).includes(k)]));
    for (let i = 0; i < n; i++) {
      const c = coords(i);
      const bg = el('g', { transform: tf(binX(i), -LV[c.shelf]) }, cg);
      const halo = haloNode(bg, 11);
      const inner = el('g', {}, bg);
      const carton = has.carton ? Carton(inner, { w: CW, h: CH, d: CD }) : null;
      const overG = el('g', {}, inner);
      const ov = has.over ? [Carton(overG, { w: CW, h: CH, d: CD }), Carton(overG, { w: CW, h: CH, d: CD }), Carton(overG, { w: 80, h: 70, d: 34 })] : [];
      if (has.over) { set(ov[0].g, { transform: tf(-42, 0) }); set(ov[1].g, { transform: tf(44, 0) }); set(ov[2].g, { transform: tf(-4, -CH + 2) }); }
      const partsG = el('g', {}, inner);
      const kinds = has.parts ? partsOf(i).slice(0, 3) : [];
      const parts = kinds.map((k, j) => {
        const sz = PART_SIZE[k] || PART_SIZE.part;
        const s = Math.min(0.62, (kinds.length > 1 ? 66 : 90) / Math.max(sz[0], sz[1]));
        const pgp = el('g', { transform: tf((j - (kinds.length - 1) / 2) * (binW / kinds.length) + 10, -(sz[1] * s) / 2 - 12, s) }, partsG);
        return Part(pgp, { kind: k });
      });
      const basketG = el('g', { transform: tf(-8, 0) }, inner);
      const basket = has.basket ? WireBasket(basketG, { w: 112, h: 64, d: 36 }) : null;
      const tagG = el('g', { transform: tf(-CW / 2 + 6, -CH + 4, 0.86) }, inner);
      const tag = has.tag ? OverstockTag(tagG, { arrow: false, string: 18 }) : null;
      bins.push({ bg, halo, inner, carton, overG, ov, partsG, parts, basketG, basket, tagG, tag });
    }
    const defaultOrder = Array.from({ length: n }, (_, i) => i).sort((a, b) => coords(a).shelf - coords(b).shelf || a - b);
    const cartons = bins.map(b => b.carton);
    return {
      g, n, labels, cartons, index, width: W,
      bin: i => ({ x: binX(i), y: -LV[coords(i).shelf] }),
      labelAt: i => ({ x: binX(i), y: -LV[coords(i).shelf] + BH / 2 }),
      update(p = {}) {
        const state = p.state ?? 'stocked', t = p.t;
        const order = p.order ?? defaultOrder;
        const fill = p.fill ?? n;
        const rank = new Array(n).fill(n);
        order.forEach((i, r) => { rank[i] = r; });
        const ovr = Array.isArray(p.bins) ? p.bins : p.bins || {};
        for (let i = 0; i < n; i++) {
          const c = coords(i), b = bins[i], ob = ovr[i] || {};
          let content = state === 'empty' ? 'none' : state === 'overstocked' ? 'over' : 'carton';
          if (ob.content) content = ob.content;
          const permTop = state === 'permanent' && c.shelf === 2;
          const r = rank[i];
          const q = r < Math.floor(fill) ? 1 : r === Math.floor(fill) ? fill % 1 : 0;
          const vis = content !== 'none' && q > 0;
          show(b.bg, vis);
          if (vis) {
            set(b.inner, { transform: `translate(0 ${r1(-40 * (1 - ease.enter(q)))})` });
            set(b.bg, { opacity: seg(q, 0, 0.4) * (ob.o ?? 1) });
            if (b.carton) show(b.carton.g, content === 'carton');
            show(b.overG, content === 'over'); show(b.partsG, content === 'parts'); show(b.basketG, content === 'basket');
            if (content === 'carton' && b.carton) b.carton.update({ ...(ob.carton || {}), t });
            if (content === 'over') b.ov.forEach(cn => cn.update({ bulge: 1, outline: 'error', ...(ob.carton || {}), t }));
            if (content === 'parts') b.parts.forEach(pt => pt.update({ ...(ob.part || {}), t }));
            if (content === 'basket' && b.basket) b.basket.update({ over: ob.basket ?? 0, t });
            const tagOn = !!b.tag && (ob.tag ?? permTop) && content === 'carton';
            show(b.tagG, tagOn);
            if (tagOn) b.tag.update({ t: t != null ? t + i * 0.4 : undefined });
            setHalo(b.halo, dRect(-binW / 2 + 4, -(LV[1] - LV[0]) + BH + 6, binW - 8, LV[1] - LV[0] - BH - 8), ob.outline, t);
          }
          const lb = labels[i];
          const showLabel = !permTop && ob.label !== null;
          show(lb.g.parentNode, showLabel);
          if (showLabel) {
            lb.update({ state: ob.labelState ?? 'good', text: ob.label, replace: ob.replace ?? 0, outline: ob.labelOutline, t });
            set(lb.g, { opacity: ob.labelOn ?? 1 });
          }
        }
        const ar = clamp(p.arrows ?? 1);
        arrowsN.forEach(({ i, ag }) => {
          const on = state === 'permanent' && ar > 0;
          show(ag, on);
          if (on) set(ag, { opacity: ar, transform: tf(binX(i), -LV[2] + BH / 2 + 5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (p.t ?? 0)) / 1.2))) });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.Broom(parent, {})
  //   Push broom: wood handle (cartonEdge), wood head block, dark bristles. ~150×210.
  // update({angle = 0, push = 0, t, sweeping = false}): angle tilts the broom about its bristle
  //   tips (degrees); push shifts the head along the floor (px). sweeping: true adds a back-and-
  //   forth push of ±10 px on a 0.8 s cycle (t) with dust flicks.
  // Origin: bottom-centre (bristle tips on the floor line).
  // ======================================================================================
  function Broom(parent) {
    const g = el('g', {}, parent);
    const mv = el('g', {}, g);
    el('path', { d: 'M-5 -32L-86 -206L-74 -211L7 -36Z', fill: C.cartonEdge, ...INK() }, mv);
    el('path', { d: 'M-88 -206l17 -8', stroke: C.ink, 'stroke-width': 10, 'stroke-linecap': 'round' }, mv);
    el('path', { d: dRect(-62, -36, 124, 18, 4), fill: C.carton, ...INK() }, mv);
    el('path', { d: 'M-58 -18H58L56 0H-56Z', fill: T.rubber, ...INK() }, mv);
    let bd = '';
    for (let x = -50; x <= 50; x += 10) bd += `M${x} -16V-2`;
    el('path', { d: bd, stroke: C.steelDark, 'stroke-width': 2 }, mv);
    const puffs = [0, 1, 2].map(i => el('circle', { r: 4 - i, fill: C.inkSoft, opacity: 0.4 }, g));
    return {
      g,
      update(p = {}) {
        const t = p.t ?? 0, sw = !!p.sweeping;
        const ph = (2 * Math.PI * t) / 0.8;
        const dx = (p.push ?? 0) + (sw ? 10 * Math.sin(ph) : 0);
        set(mv, { transform: `translate(${r1(dx)} 0) rotate(${((p.angle ?? 0) + (sw ? 2 * Math.cos(ph) : 0)).toFixed(2)})` });
        puffs.forEach((n, i) => {
          show(n, sw);
          const k = fmod(t / 0.8 + i * 0.33, 1);
          set(n, { cx: r1(dx + 64 + 26 * k), cy: r1(-6 - 16 * k - i * 3), opacity: 0.45 * (1 - k) });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.Dustpan(parent, {})   Neutral-blue dustpan facing the viewer (open front lip, side walls,
  //   back wall, handle up and back), ~145×110 in iso depth.
  // update({angle = 0, t}): tilt in degrees about the left end of the lip.
  // Origin: bottom-centre of the front lip on the floor line.
  // ======================================================================================
  function Dustpan(parent) {
    const g = el('g', {}, parent);
    const mv = el('g', {}, g);
    const fp = cs => dPoly(cs.map(c => P(...c)));
    const X = 52, D = 46, Hb = 30;
    const hb = P(0, Hb - 6, D), he = P(0, Hb + 46, D + 40);
    el('path', { d: `M${r1(hb[0])} ${r1(hb[1])}L${r1(he[0])} ${r1(he[1])}`, stroke: C.ink, 'stroke-width': 13, 'stroke-linecap': 'round' }, mv);
    el('path', { d: `M${r1(hb[0])} ${r1(hb[1])}L${r1(he[0])} ${r1(he[1])}`, stroke: C.neutral, 'stroke-width': 7, 'stroke-linecap': 'round' }, mv);
    el('path', { d: fp([[-X, 0, D], [X, 0, D], [X, Hb, D], [-X, Hb, D]]), fill: mix(C.neutral, C.ink, 0.12), ...INK() }, mv);
    el('path', { d: fp([[-X, 0, 0], [X, 0, 0], [X, 0, D], [-X, 0, D]]), fill: mix(C.neutral, C.paper, 0.4), ...INK() }, mv);
    el('path', { d: fp([[-X, 0, 0], [-X, 0, D], [-X, Hb, D]]), fill: mix(C.neutral, C.ink, 0.3), ...INK() }, mv);
    el('path', { d: fp([[X, 0, 0], [X, 0, D], [X, Hb, D]]), fill: C.neutral, ...INK() }, mv);
    el('path', { d: fp([[-X, 0, 0], [X, 0, 0]]).replace('Z', ''), stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, mv);
    return { g, update(p = {}) { set(mv, { transform: `rotate(${(p.angle ?? 0).toFixed(2)} ${-X} 0)` }); } };
  }

  // ======================================================================================
  // Kit.Mop(parent, {})   Mop: wood handle, steel clamp, paper-white cotton strands, ~110×230.
  // update({angle = 0, t, wiping = false}): angle tilts it about the head (degrees). wiping: the
  //   head swings ±18 px on a 0.9 s cycle (t) and the strands trail.
  // Origin: bottom-centre (strand tips on the floor line).
  // ======================================================================================
  function Mop(parent) {
    const g = el('g', {}, parent);
    const mv = el('g', {}, g);
    el('path', { d: 'M-4 -40L22 -228L34 -226L8 -38Z', fill: C.cartonEdge, ...INK() }, mv);
    el('path', { d: dRect(-18, -50, 36, 14, 3), fill: C.steel, ...INK() }, mv);
    const strands = [];
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 10;
      strands.push({ n: el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 11, 'stroke-linecap': 'round' }, mv), m: el('path', { fill: 'none', stroke: mix(C.paper, C.floor, 0.35), 'stroke-width': 6, 'stroke-linecap': 'round' }, mv), x });
    }
    return {
      g,
      update(p = {}) {
        const t = p.t ?? 0, wp = !!p.wiping;
        const ph = (2 * Math.PI * t) / 0.9, dx = wp ? 18 * Math.sin(ph) : 0, lag = wp ? -10 * Math.cos(ph) : 0;
        set(mv, { transform: `translate(${r1(dx)} 0) rotate(${(p.angle ?? 0).toFixed(2)} 0 -6)` });
        strands.forEach((s, i) => {
          const bx = s.x * 0.45, ex = s.x + lag * (0.6 + 0.1 * (i % 3));
          const d = `M${r1(bx)} -38Q${r1((bx + ex) / 2 + lag * 0.3)} -18 ${r1(ex)} -4`;
          set(s.n, { d }); set(s.m, { d });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.Spill(parent, {w = 200, h = 70})
  //   Dark liquid puddle on the floor (flattened irregular blob) with two highlights.
  // update({size = 1, outline, t}): size 0..1 scales the puddle about its centre (shrinks to
  //   nothing as it is mopped). outline e.g. 'error' for the red hazard outline (pulses with t).
  //   t also drifts the highlights by under 2 px.
  // Origin: centre of the puddle (on the floor).
  // ======================================================================================
  function Spill(parent, o = {}) {
    const w = o.w ?? 200, h = o.h ?? 70;
    const g = el('g', {}, parent);
    const sc = el('g', {}, g);
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 1 + 0.12 * Math.sin(3 * a + 1) + 0.08 * Math.sin(5 * a + 2) + 0.05 * Math.sin(9 * a);
      pts.push([(w / 2) * r * Math.cos(a), (h / 2) * r * Math.sin(a)]);
    }
    const blob = dPoly(pts);
    const halo = haloNode(sc, 12);
    el('path', { d: blob, fill: T.puddle, ...INK() }, sc);
    const hl = el('g', {}, sc);
    el('ellipse', { cx: -w * 0.18, cy: -h * 0.12, rx: w * 0.12, ry: h * 0.09, fill: C.steel, opacity: 0.7 }, hl);
    el('ellipse', { cx: w * 0.14, cy: h * 0.1, rx: w * 0.05, ry: h * 0.05, fill: C.steel, opacity: 0.6 }, hl);
    return {
      g,
      update(p = {}) {
        const s = clamp(p.size ?? 1), t = p.t ?? 0;
        show(sc, s > 0.01);
        set(sc, { transform: `scale(${s.toFixed(3)})` });
        set(hl, { transform: `translate(${r1(1.5 * Math.sin(t * 0.9))} 0)` });
        setHalo(halo, blob, p.outline, p.t);
      },
    };
  }

  // ======================================================================================
  // Kit.Debris(parent, {n = 10, w = 240, h = 60})
  //   Floor debris specks scattered over a w×h patch: paper scraps, wood chips, dirt dots.
  // update({clear = 0, t}): clear 0..1 removes specks left to right (each pops and shrinks as the
  //   sweep passes it). t adds a sub-2 px drift.
  // Origin: centre of the patch.
  // ======================================================================================
  function Debris(parent, o = {}) {
    const n = o.n ?? 10, w = o.w ?? 240, h = o.h ?? 60;
    const g = el('g', {}, parent);
    const specks = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n + (hash(i + 20) - 0.5) * 0.06, x = (u - 0.5) * w, y = (hash(i + 30) - 0.5) * h;
      const sg = el('g', {}, g);
      const k = i % 3;
      if (k === 0) el('path', { d: 'M-9 -5L7 -7L10 4L-6 7Z', fill: C.paper, ...INK({ 'stroke-width': 1.8 }) }, sg);
      else if (k === 1) el('path', { d: 'M-8 -2L6 -4L9 2L-5 4Z', fill: C.cartonEdge, ...INK({ 'stroke-width': 1.8 }) }, sg);
      else el('circle', { r: 4, fill: C.inkSoft }, sg);
      specks.push({ sg, x, y, u: clamp(u), r: hash(i + 40) * 180 });
    }
    return {
      g,
      update(p = {}) {
        const cl = clamp(p.clear ?? 0), t = p.t ?? 0;
        specks.forEach((s, i) => {
          const k = seg(cl * 1.15 - s.u, 0, 0.12);
          show(s.sg, k < 1);
          const sc = k > 0 ? (1 + 0.3 * Math.sin(Math.PI * Math.min(1, k * 2))) * (1 - k) : 1;
          set(s.sg, { transform: tf(s.x + 1.2 * Math.sin(t * 0.7 + i), s.y, sc, s.r) });
        });
      },
    };
  }

  // ======================================================================================
  // Kit.TrashCan(parent, {})
  //   Steel trash can 96×110 with ridges, dark rim and a hinged lid.
  // update({lid = 0, tip = 0, t}): lid 0..1 opens the lid (hinged at the back-left). tip 0..1
  //   tips the can 105 degrees clockwise about its bottom-right corner (emptying to the right);
  //   the lid opens with it.
  // Extras: trash.inside, a group drawn inside the can (between the dark opening and the front
  //   body) for items dropped in; use can-local coords (opening at y = -100, x ±42).
  // Origin: bottom-centre on the floor line.
  // ======================================================================================
  function TrashCan(parent) {
    const g = el('g', {}, parent);
    const sh = Kit.shadow(g, 100, { x: 0, y: 0 });
    const tipG = el('g', {}, g);
    el('path', { d: 'M-44 -100Q0 -112 44 -100Q0 -90 -44 -100Z', fill: C.ink }, tipG);
    const inside = el('g', {}, tipG);
    el('path', { d: 'M-38 0H38L44 -96H-44Z', fill: C.steel, ...INK() }, tipG);
    el('path', { d: 'M-24 -10L-27 -86M-8 -10L-9 -86M8 -10L9 -86M24 -10L27 -86', stroke: C.steelDark, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, tipG);
    el('path', { d: dRect(-47, -102, 94, 10, 4), fill: C.steelDark, ...INK() }, tipG);
    const lid = el('g', {}, tipG);
    el('path', { d: 'M-48 -102Q0 -126 48 -102Z', fill: C.steel, ...INK() }, lid);
    el('path', { d: 'M-12 -114V-121H12V-114', fill: 'none', ...INK() }, lid);
    return {
      g, inside,
      update(p = {}) {
        const tp = ease.enter(clamp(p.tip ?? 0)), ld = Math.max(ease.enter(clamp(p.lid ?? 0)), tp);
        set(tipG, { transform: tp ? `rotate(${(105 * tp).toFixed(2)} 38 0)` : '' });
        set(lid, { transform: ld ? `rotate(${(-110 * ld).toFixed(2)} -47 -102)` : '' });
        set(sh, { opacity: 0.1 * (1 - 0.5 * tp) });
      },
    };
  }

  // ======================================================================================
  // Kit.HosePress(parent, {hose = true})
  //   Hydraulic hose crimp press on a steel bench, 420×260: bench top in iso depth, dark legs and
  //   lower shelf; press base, column, head with a die ring, pull lever. With hose: a black hose
  //   with a steel ferrule enters the die from the left and trails off the bench.
  // update({press = 0, t}): press 0..1: the lever pulls down, the die closes on the ferrule
  //   (crimp ridges appear past 0.6) with three flash lines at the moment of the crimp.
  // Origin: bottom-centre on the floor line (bench top surface at y = -150).
  // ======================================================================================
  function HosePress(parent, o = {}) {
    const g = el('g', {}, parent);
    Kit.shadow(g, 440, { x: 26, y: 0 });
    const BD = 56, top = 150;
    // bench: back legs, shelf, top
    const fp = cs => dPoly(cs.map(c => P(...c)));
    [[-190, BD - 10], [178, BD - 10]].forEach(([x, z]) => el('path', { d: fp([[x, 0, z], [x + 12, 0, z], [x + 12, top, z], [x, top, z]]), fill: T.rear, ...INK({ 'stroke-width': 2 }) }, g));
    el('path', { d: fp([[-196, 34, 0], [196, 34, 0], [196, 34, BD], [-196, 34, BD]]), fill: T.steelTop, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: dRect(-196, -34, 392, 10), fill: C.steel, ...INK({ 'stroke-width': 2 }) }, g);
    [-196, 178].forEach(x => el('path', { d: dRect(x, -top, 18, top), fill: C.steelDark, ...INK() }, g));
    el('path', { d: fp([[-210, top, 0], [210, top, 0], [210, top, BD], [-210, top, BD]]), fill: T.steelTop, ...INK() }, g);
    el('path', { d: fp([[210, top - 14, 0], [210, top - 14, BD], [210, top, BD], [210, top, 0]]), fill: T.steelSide, ...INK() }, g);
    el('path', { d: dRect(-210, -top, 420, 14), fill: C.steel, ...INK() }, g);
    // press body (sits on the bench, set back a little)
    const pb = el('g', { transform: tf(...P(20, 0, 18)) }, g);
    el('path', { d: dRect(-70, -top - 26, 170, 26), fill: C.steelDark, ...INK() }, pb);
    el('path', { d: dRect(60, -top - 126, 30, 100), fill: C.steel, ...INK() }, pb);
    el('path', { d: dRect(-56, -top - 146, 150, 46, 6), fill: C.steel, ...INK() }, pb);
    el('path', { d: `M-46 ${-top - 136}H84`, stroke: C.paper, 'stroke-width': 3, opacity: 0.6, 'stroke-linecap': 'round' }, pb);
    // die ring and ferrule
    const dieY = -top - 62, dieX = 4;
    el('circle', { cx: dieX, cy: dieY, r: 34, fill: C.steelDark, ...INK() }, pb);
    const ram = el('path', { d: dRect(dieX - 14, -top - 100, 28, 20), fill: C.steel, ...INK({ 'stroke-width': 2 }) }, pb);
    const hoseG = el('g', {}, pb);
    el('path', { d: `M${dieX - 6} ${dieY}H-120Q-196 ${dieY} -214 ${dieY + 60}T-238 ${-top + 110}`, fill: 'none', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, hoseG);
    el('path', { d: `M${dieX - 6} ${dieY}H-120Q-196 ${dieY} -214 ${dieY + 60}T-238 ${-top + 110}`, fill: 'none', stroke: C.steelDark, 'stroke-width': 5, 'stroke-linecap': 'round' }, hoseG);
    el('path', { d: dRect(dieX - 26, dieY - 9, 34, 18, 2), fill: C.steel, ...INK({ 'stroke-width': 2 }) }, hoseG);
    const ridges = el('path', { d: `M${dieX - 20} ${dieY - 9}v18M${dieX - 12} ${dieY - 9}v18M${dieX - 4} ${dieY - 9}v18`, stroke: C.ink, 'stroke-width': 2 }, hoseG);
    const jaws = [0, 1, 2, 3].map(k => el('path', { d: `M${dieX} ${dieY - 30}l-8 10h16z`, fill: C.steel, ...INK({ 'stroke-width': 1.6 }), transform: `rotate(${k * 90} ${dieX} ${dieY})` }, pb));
    // lever
    const lever = el('g', {}, pb);
    el('path', { d: `M90 ${-top - 120}L170 ${-top - 196}`, stroke: C.ink, 'stroke-width': 10, 'stroke-linecap': 'round' }, lever);
    el('path', { d: `M90 ${-top - 120}L170 ${-top - 196}`, stroke: C.steel, 'stroke-width': 5, 'stroke-linecap': 'round' }, lever);
    el('circle', { cx: 172, cy: -top - 198, r: 11, fill: C.ink, stroke: C.ink, 'stroke-width': SW }, lever);
    el('circle', { cx: 90, cy: -top - 120, r: 7, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, pb);
    const flash = el('path', { d: `M${dieX - 44} ${dieY - 30}l-14 -10M${dieX + 44} ${dieY - 30}l14 -10M${dieX} ${dieY - 46}v-14`, stroke: C.accent, 'stroke-width': 4, 'stroke-linecap': 'round' }, pb);
    return {
      g,
      update(p = {}) {
        const pr = clamp(p.press ?? 0), e = ease.enter(seg(pr, 0, 0.6));
        show(hoseG, o.hose !== false);
        set(lever, { transform: `rotate(${(52 * e).toFixed(2)} 90 ${-top - 120})` });
        set(ram, { transform: `translate(0 ${r1(10 * e)})` });
        jaws.forEach((j, k) => set(j, { transform: `rotate(${k * 90} ${dieX} ${dieY}) translate(0 ${r1(10 * e)})` }));
        show(ridges, pr > 0.6 && o.hose !== false);
        const f = seg(pr, 0.55, 0.85);
        show(flash, f > 0 && f < 1);
        set(flash, { opacity: Math.sin(Math.PI * f) });
      },
    };
  }

  // ======================================================================================
  // Kit.HoseSaw(parent, {})
  //   Hose cut-off saw icon, ~170×130: dark base, pivot arm, steel motor housing, toothed blade
  //   under a safety-yellow guard, a hose clamped on the base.
  // update({cut = 0, t, spin = true}): cut 0..1 lowers the arm 14 degrees onto the hose; with spin
  //   the blade turns at 1.5 rev/s from t.
  // Origin: centre.
  // ======================================================================================
  function HoseSaw(parent) {
    const g = el('g', {}, parent);
    el('path', { d: dRect(-84, 40, 168, 14, 3), fill: C.steelDark, ...INK() }, g);
    el('path', { d: 'M-70 32H74', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-70 32H74', stroke: C.steelDark, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    el('path', { d: dRect(-66, 18, 14, 22), fill: C.steel, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: dRect(-76, -6, 20, 46), fill: C.steel, ...INK() }, g);
    const arm = el('g', {}, g);
    el('path', { d: 'M-66 4L16 -12', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, arm);
    el('path', { d: 'M-66 4L16 -12', stroke: C.steel, 'stroke-width': 6, 'stroke-linecap': 'round' }, arm);
    const blade = el('g', {}, arm);
    let teeth = '';
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 0.5) / 24) * Math.PI * 2;
      teeth += `${k ? 'L' : 'M'}${r1(20 + 38 * Math.cos(a0))} ${r1(-4 + 38 * Math.sin(a0))}L${r1(20 + 43 * Math.cos(a1))} ${r1(-4 + 43 * Math.sin(a1))}`;
    }
    el('path', { d: teeth + 'Z', fill: T.steelLight, ...INK({ 'stroke-width': 2 }) }, blade);
    el('path', { d: 'M20 -30V22M-6 -4H46', stroke: C.steel, 'stroke-width': 3 }, blade);
    el('circle', { cx: 20, cy: -4, r: 8, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, blade);
    el('path', { d: 'M-30 -4A50 50 0 0 1 70 -4L58 -4A38 38 0 0 0 -18 -4Z', fill: C.safety, ...INK() }, arm);
    el('path', { d: dRect(-8, -64, 56, 30, 8), fill: C.steel, ...INK() }, arm);
    el('path', { d: 'M0 -56h40', stroke: C.paper, 'stroke-width': 3, opacity: 0.6, 'stroke-linecap': 'round' }, arm);
    el('circle', { cx: -66, cy: 4, r: 6, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
    return {
      g,
      update(p = {}) {
        const c = ease.enter(clamp(p.cut ?? 0)), t = p.t ?? 0;
        set(arm, { transform: `rotate(${(14 * c).toFixed(2)} -66 4)` });
        set(blade, { transform: p.spin === false ? '' : `rotate(${((t * 540) % 360).toFixed(1)} 20 -4)` });
      },
    };
  }

  // ======================================================================================
  // Kit.HoseHook(parent, {label = 'Hose', height = 300, trail = 420})
  //   Wall hook with a paper "Hose" plate (26 px 700), and a black hose that trails from the hook
  //   down to the floor and `trail` px to the left (toward a HosePress).
  // update({wind = 1, t}): wind 0..1 winds the hose up onto the hook: the coiled part grows into
  //   three hanging loops while the trailing end is pulled in along the floor and up.
  // Origin: bottom-centre on the floor line, directly under the hook.
  // ======================================================================================
  function HoseHook(parent, o = {}) {
    const H = o.height ?? 300, trail = o.trail ?? 420;
    const g = el('g', {}, parent);
    el('path', { d: dRect(-22, -H - 26, 44, 40, 4), fill: C.steelDark, ...INK() }, g);
    const lab = o.label ?? 'Hose', lw = Math.max(96, measure(lab, 26, 700) + 28);
    el('path', { d: dRect(-lw / 2, -H - 82, lw, 44, 4), fill: C.paper, ...INK() }, g);
    ctext(g, lab, 0, -H - 60, 26, 700);
    const hoseB = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const hoseM = el('path', { fill: 'none', stroke: C.steelDark, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M-8 ${-H - 6}V${-H + 16}Q-8 ${-H + 30} 6 ${-H + 30}Q18 ${-H + 30} 18 ${-H + 16}V${-H + 8}`, fill: 'none', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    el('path', { d: `M-8 ${-H - 6}V${-H + 16}Q-8 ${-H + 30} 6 ${-H + 30}Q18 ${-H + 30} 18 ${-H + 16}V${-H + 8}`, fill: 'none', stroke: C.steel, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    const fitting = el('path', { d: 'M-6 -9h18v18h-18z', fill: C.steel, ...INK({ 'stroke-width': 2 }) }, g);
    // route from the hook: down the wall to the floor then left along it (with a gentle wave)
    const route = [];
    const hy = -H + 26;
    for (let i = 0; i <= 30; i++) route.push([4 + 4 * Math.sin(i * 0.4), hy + ((-8 - hy) * i) / 30]);
    for (let i = 1; i <= 60; i++) route.push([4 - (trail * i) / 60, -8 + 4 * Math.sin(i * 0.35)]);
    const cum = [0];
    for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const L = cum[cum.length - 1];
    const along = s => {
      s = clamp(s, 0, L);
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [lerp(route[i - 1][0], route[i][0], u), lerp(route[i - 1][1], route[i][1], u)];
    };
    // coil: three hanging loops, arc length per loop ~ L / 3
    const loopLen = L / 3, RL = loopLen / (2 * Math.PI);
    const coilPt = s => {
      const k = Math.min(2, Math.floor(s / loopLen)), ph = (2 * Math.PI * (s - k * loopLen)) / loopLen;
      const r = RL * (1 - 0.05 * k);
      return [4 + (k - 1) * 8 + r * Math.sin(ph), hy - 4 + r + k * 3 - r * Math.cos(ph)];
    };
    return {
      g,
      update(p = {}) {
        const wd = Engine.ease.inOut(clamp(p.wind ?? 1));
        const sc = wd * L, pts = [];
        const N = 90;
        for (let i = 0; i <= N; i++) {
          const s = (i / N) * L;
          pts.push(s <= sc ? coilPt(s) : along(s - sc));
        }
        const d = dPoly(pts, false);
        set(hoseB, { d }); set(hoseM, { d });
        const a = pts[N - 1], b = pts[N];
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        set(fitting, { transform: `translate(${r1(b[0])} ${r1(b[1])}) rotate(${ang.toFixed(1)})` });
      },
    };
  }

  // ======================================================================================
  // Kit.Cart(parent, {parts = ['bolt', 'bearing']})
  //   Order-picking cart, 260×200 side view in iso depth: steel frame, handle on the left (the
  //   Worker pushes it rightwards), top tote tray, bottom shelf, four casters.
  // update({cartons = 0, parts = 0, roll = 0, t}):
  //   cartons 0..2: cartons in the top tray (fractional part drops the next one in).
  //   parts 0..n: loose Part icons on the bottom shelf (fractional drops the next in).
  //   roll: distance travelled in px; the casters turn.
  // Extras: cart.load is a group inside the tray (behind its front lip) for scene items, cart-local
  //   coords (tray floor at y = -128); cart.slot(i) -> {x, y} for tray slots 0..1; cart.cartons[i]
  //   are the two tray Carton components.
  // Origin: bottom-centre on the floor line (front face).
  // ======================================================================================
  function Cart(parent, o = {}) {
    const g = el('g', {}, parent);
    const D = 64, fp = cs => dPoly(cs.map(c => P(...c)));
    Kit.shadow(g, 290, { x: 24, y: 0 });
    // rear posts and rear casters
    [[-112, D], [104, D]].forEach(([x, z]) => el('path', { d: fp([[x, 30, z], [x + 8, 30, z], [x + 8, 150, z], [x, 150, z]]), fill: T.rear, ...INK({ 'stroke-width': 2 }) }, g));
    // bottom shelf with parts
    el('path', { d: fp([[-116, 46, 0], [116, 46, 0], [116, 46, D], [-116, 46, D]]), fill: T.steelTop, ...INK({ 'stroke-width': 2 }) }, g);
    const partsG = el('g', {}, g);
    const kinds = o.parts ?? ['bolt', 'bearing'];
    const parts = kinds.map((k, j) => {
      const sz = PART_SIZE[k] || PART_SIZE.part, s = Math.min(0.5, 46 / sz[1]);
      const pgp = el('g', {}, partsG);
      return { pgp, part: Part(pgp, { kind: k }), x: -60 + j * (150 / Math.max(1, kinds.length - 1 || 1)), y: -46 - (sz[1] * s) / 2 - 10, s };
    });
    el('path', { d: dRect(-116, -46, 232, 10), fill: C.steel, ...INK() }, g);
    // tray: back wall, floor, load, contents, front lip
    const TY = 128, TH = 30;
    el('path', { d: fp([[-118, TY, D], [118, TY, D], [118, TY + TH, D], [-118, TY + TH, D]]), fill: T.steelSide, ...INK({ 'stroke-width': 2 }) }, g);
    el('path', { d: fp([[-118, TY, 0], [118, TY, 0], [118, TY, D], [-118, TY, D]]), fill: mix(C.steel, C.ink, 0.25) }, g);
    const load = el('g', {}, g);
    const slot = i => { const q = P(-62 + i * 64, TY, 10); return { x: q[0], y: q[1] }; };
    const cartons = [0, 1].map(i => { const c = Carton(load, { w: 70, h: 58, d: 40 }); return c; });
    el('path', { d: fp([[118, TY, 0], [118, TY, D], [118, TY + TH, D], [118, TY + TH, 0]]), fill: T.steelSide, ...INK() }, g);
    el('path', { d: dRect(-118, -TY - TH, 236, TH), fill: C.steel, ...INK() }, g);
    el('path', { d: `M-108 ${-TY - TH + 8}H108`, stroke: C.paper, 'stroke-width': 2.5, opacity: 0.5 }, g);
    // front posts and handle
    [-114, 106].forEach(x => el('path', { d: dRect(x, -150 + TH, 8, 120), fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g));
    el('path', { d: 'M-112 -150L-140 -200', stroke: C.ink, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-112 -150L-140 -200', stroke: C.steel, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-148 -204h16', stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
    // casters
    const wheels = [-92, 92].map(x => {
      el('path', { d: `M${x - 8} -38h16l-4 12h-8z`, fill: C.steelDark, ...INK({ 'stroke-width': 2 }) }, g);
      el('circle', { cx: x, cy: -16, r: 16, fill: T.rubber, ...INK() }, g);
      el('circle', { cx: x, cy: -16, r: 7, fill: C.steel, ...INK({ 'stroke-width': 1.6 }) }, g);
      const hub = el('g', {}, g);
      [0, 120, 240].forEach(a => el('circle', { cx: r1(x + 11 * Math.cos((a * Math.PI) / 180)), cy: r1(-16 + 11 * Math.sin((a * Math.PI) / 180)), r: 1.8, fill: C.steel }, hub));
      return { x, hub };
    });
    return {
      g, load, slot, cartons,
      update(p = {}) {
        const nc = clamp(p.cartons ?? 0, 0, 2), np = clamp(p.parts ?? 0, 0, parts.length), t = p.t;
        cartons.forEach((c, i) => {
          const q = i < Math.floor(nc) ? 1 : i === Math.floor(nc) ? nc % 1 : 0;
          show(c.g, q > 0);
          if (q > 0) { const s = slot(i); set(c.g, { transform: tf(s.x, s.y - 36 * (1 - ease.enter(q))), opacity: seg(q, 0, 0.4) }); c.update({ t }); }
        });
        parts.forEach((pp, i) => {
          const q = i < Math.floor(np) ? 1 : i === Math.floor(np) ? np % 1 : 0;
          show(pp.pgp, q > 0);
          if (q > 0) { set(pp.pgp, { transform: tf(pp.x, pp.y - 30 * (1 - ease.enter(q)), pp.s), opacity: seg(q, 0, 0.4) }); pp.part.update({ t }); }
        });
        const ang = ((p.roll ?? 0) / 16) * 57.2958;
        wheels.forEach(w => set(w.hub, { transform: `rotate(${ang.toFixed(1)} ${w.x} -16)` }));
      },
    };
  }

  // ======================================================================================
  // Kit.Package(parent, {n = 10, cols = 5, kind = 'bolt', label})
  //   Small retail box (200×110 front, iso depth 30) with a clear window showing n Part icons in a
  //   grid (cols per row). label: optional text on the top band (22 px 700), e.g. 'PKG OF 10'.
  // update({count = n, hidden = [], tip = 0, shrink = 0, outline, t}):
  //   count: parts still inside (the last ones go first). hidden: indices to hide instead.
  //   tip 0..1: tips over 110 degrees clockwise about the bottom-right corner (emptying).
  //   shrink 0..1: scales the box down to nothing (into a TrashCan).
  // Extras: package.slot(i) -> {x, y, s, r} of part i in package coords (centre, scale, rotation)
  //   so a scene can fly its own Part icon from there.
  // Origin: bottom-centre of the front face.
  // ======================================================================================
  function Package(parent, o = {}) {
    const n = o.n ?? 10, cols = o.cols ?? 5, rows = Math.ceil(n / cols), kind = o.kind ?? 'bolt';
    const w = 200, h = 110, d = 30;
    const g = el('g', {}, parent);
    const tipG = el('g', {}, g);
    const halo = haloNode(tipG, 11);
    const fp = cs => dPoly(cs.map(c => P(...c)));
    el('path', { d: fp([[w / 2, 0, 0], [w / 2, 0, d], [w / 2, h, d], [w / 2, h, 0]]), fill: C.cartonEdge, ...INK() }, tipG);
    el('path', { d: fp([[-w / 2, h, 0], [w / 2, h, 0], [w / 2, h, d], [-w / 2, h, d]]), fill: T.top, ...INK() }, tipG);
    el('path', { d: dRect(-w / 2, -h, w, h), fill: C.paper, ...INK() }, tipG);
    el('path', { d: dRect(-w / 2, -h, w, 22), fill: C.neutral, ...INK() }, tipG);
    if (o.label) ctext(tipG, o.label, 0, -h + 11, 18, 700, C.paper);
    const wx = -w / 2 + 10, wy = -h + 28, ww = w - 20, wh = h - 36;
    el('path', { d: dRect(wx, wy, ww, wh, 4), fill: mix(C.paper, C.bgLight, 0.6), ...INK({ 'stroke-width': 2 }) }, tipG);
    const sz = PART_SIZE[kind] || PART_SIZE.part;
    const cw = ww / cols, chh = wh / rows;
    const vertical = sz[0] > sz[1] * 1.5;
    const s = Math.min((vertical ? chh : cw) * 0.86 / sz[0], (vertical ? cw : chh) * 0.86 / sz[1]);
    const slot = i => ({ x: wx + cw * ((i % cols) + 0.5), y: wy + chh * (Math.floor(i / cols) + 0.5), s, r: vertical ? 90 : 0 });
    const parts = [];
    for (let i = 0; i < n; i++) {
      const sl = slot(i);
      const pgp = el('g', { transform: tf(sl.x, sl.y, sl.s, sl.r) }, tipG);
      parts.push({ pgp, part: Part(pgp, { kind }) });
    }
    el('path', { d: `M${wx + 8} ${wy + 6}l22 0`, stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round' }, tipG);
    return {
      g, slot,
      update(p = {}) {
        const count = p.count ?? n, hidden = p.hidden || [];
        parts.forEach((pp, i) => { const v = i < count && !hidden.includes(i); show(pp.pgp, v); if (v) pp.part.update({ t: p.t }); });
        const tp = ease.enter(clamp(p.tip ?? 0)), sk = 1 - ease.exit(clamp(p.shrink ?? 0));
        show(tipG, sk > 0.01);
        set(tipG, { transform: `rotate(${(110 * tp).toFixed(2)} ${w / 2} 0) translate(0 ${r1(-h / 2 * (1 - sk))}) scale(${sk.toFixed(3)})` });
        setHalo(halo, fp([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 0, d], [w / 2, h, d], [-w / 2, h, d], [-w / 2, h, 0]]), p.outline, p.t);
      },
    };
  }

  Object.assign(window.Kit, {
    iso: P,
    BoxTruck, WheelChock, DockDoor, Pallet, Splinters, Carton, Crate, WeatherproofCrate: Crate, Package,
    Strap, BandingStrap: Strap, Scissors, Tag, OverstockTag, PriceTag, LocationLabel, BinTag: LocationLabel,
    PalletRack, WireBasket, AisleSign, SectionMarker,
    Part, Bolt: partAlias('bolt'), Bearing: partAlias('bearing'), BrakeShoe: partAlias('brakeshoe'), Shaft: partAlias('shaft'),
    HoseCoil: partAlias('hosecoil'), SealRing: partAlias('sealring'), GenericPart: partAlias('part'),
    Broom, Dustpan, Mop, Spill, Debris, TrashCan, HosePress, HoseSaw, HoseHook, Cart,
  });
})();
