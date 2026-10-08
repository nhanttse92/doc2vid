// Kit: characters. STYLE.md §6 items 1 (Worker), 15 (Forklift), 16 (TagOut + Padlock), 30 (Machine),
// 36 (PPE set). Contract (build/AGENT_BRIEF.md): every factory creates all of its nodes up front and
// returns {g, update(params)}; update only sets attributes and toggles display, and is a pure function
// of its params (time arrives as params.t), so any frame can be rendered in any order.
//
// Factories: Kit.Worker, Kit.PPEIcon, Kit.Forklift, Kit.TagOut, Kit.Padlock, Kit.Machine.
// Helpers:   Kit.Worker.poseAt, Kit.Worker.ppeAt, Kit.Worker.POSES, Kit.Worker.WALK_SPEED,
//            Kit.Worker.SEAT_Y, Kit.Forklift.DRIVE_SPEED.
(() => {
  const { el, set, clamp, lerp } = Engine;
  const { C, STROKE } = Kit;

  // ---------------------------------------------------------------- shared helpers
  const D = Math.PI / 180;
  const TAU = Math.PI * 2;
  // Limb angles: 0 = straight down, +90 = forward (the facing direction), 180 = straight up.
  const dir = a => [Math.sin(a * D), Math.cos(a * D)];
  const angOf = (x, y) => Math.atan2(x, y) / D;
  // Same rotation as SVG rotate(a): positive is clockwise on screen (a forward lean when facing right).
  const rot = ([x, y], a) => { const c = Math.cos(a * D), s = Math.sin(a * D); return [x * c - y * s, x * s + y * c]; };
  const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
  const r2 = v => Math.round(v * 100) / 100;
  const pt = p => `${r2(p[0])} ${r2(p[1])}`;
  const line = (...ps) => 'M' + ps.map(pt).join(' L');
  const hash = (i, seed = 0) => { const x = Math.sin(i * 127.1 + seed * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
  const num = (v, d = 0) => (v === true ? 1 : v == null || v === false ? d : clamp(Number(v)));
  const tf = (x, y, r = 0, s = 1) => `translate(${r2(x)} ${r2(y)})${r ? ` rotate(${r2(r)})` : ''}${s !== 1 ? ` scale(${r2(s)})` : ''}`;

  // Every ink outline registers here so the `stroke` param can keep outlines at 2.5 px on screen when a
  // component is drawn small: pass stroke = 2.5 / scale. Thick limbs/bars register their fill width; their
  // outline is width + 2 * stroke.
  function outlines() {
    const list = [];
    let cur;
    return {
      line(node, base = STROKE) { list.push([node, base, 0]); set(node, { stroke: C.ink, 'stroke-width': base }); return node; },
      limb(node, width) { list.push([node, 0, width]); set(node, { 'stroke-width': width + 2 * STROKE }); return node; },
      apply(sw) {
        if (sw === cur) return;
        cur = sw;
        for (const [n, b, w] of list) set(n, { 'stroke-width': w ? w + 2 * sw : b * sw / STROKE });
      },
    };
  }
  // Filled shape with an ink outline.
  const shape = (L, tag, attrs, parent, base) => L.line(el(tag, { 'stroke-linejoin': 'round', ...attrs }, parent), base);
  // Thick rounded bar (limb, pole, handle): an ink outline path under a coloured path on the same centre line.
  function bar(L, parent, color, width, cap = 'round') {
    const o = L.limb(el('path', { fill: 'none', stroke: C.ink, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, parent), width);
    const f = el('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, parent);
    return { o, f, d(d) { set(o, { d }); set(f, { d }); } };
  }
  // 4-point sparkle star centred on 0,0.
  const SPARKLE = 'M0 -13 L3.2 -3.2 L13 0 L3.2 3.2 L0 13 L-3.2 3.2 L-13 0 L-3.2 -3.2 Z';

  // Colour helpers for the Forklift's tagged-out desaturation (no SVG filters).
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  function dim(h, a) {
    if (!a) return h;
    const c = rgb(h), y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], grey = lerp(y, 196, 0.35);
    return hex(c.map(v => lerp(v, grey, a)));
  }

  // ---------------------------------------------------------------- Worker rig
  // Proportions at 1x (260 px tall standing). Body coordinates: origin on the floor under the hip, +x is the
  // facing direction, y up is negative.
  const TH = 54, SH = 50, UA = 46, FA = 44;          // thigh, shin, upper arm, forearm
  const LEG_W = 23, ARM_W = 17, ANKLE = 12;
  // Hand shapes. Origin at the wrist, +x along the forearm towards the fingertips, -y on the thumb side
  // (forward when the arm hangs, up when it reaches forward). 'thumb' (thumbs-up) is drawn upright in body
  // coordinates instead, centred just past the wrist, so the thumb points up whatever the forearm does.
  const FIST = 'M-3 -8.5 C3 -10.5 12 -10.5 16 -8.5 C20.5 -6 20.5 6 16 8.5 C12 10.5 3 10.5 -3 8.5 Z';
  const HANDS = {
    open: {
      body: 'M-3 -7.5 C4 -9.5 12 -9 17.5 -7.5 C23 -6 24.5 0 21.5 4.5 C18 8.5 9 9 -3 7.5 Z',
      thumb: 'M3 -6.8 C7 -10.8 12.5 -11.2 15 -9 C16.5 -7.6 14 -6.3 10.5 -6 Z',
      creases: 'M15 0.5 L20.5 0.5',
    },
    fist: {
      body: FIST,
      thumb: 'M1 -8 C5 -12.5 12 -12.5 14 -8.5 C14.5 -6.5 11 -5 7 -5 Z',
      creases: 'M11 -1.5 L17.5 -1.5 M11 3.5 L17.5 3.5',
    },
    point: {
      body: FIST,
      thumb: 'M0 -8 C4 -12 10 -12.5 12 -9.5 C12.5 -8 9.5 -7 6 -6.5 Z',
      index: 'M10 -9 L28 -7.8 C32 -7.5 32 -1.5 28 -1.2 L12 -1 Z',
      creases: 'M11 3.5 L17.5 3.5',
    },
    thumb: {
      body: 'M-8 -7 C-8 -9 -6 -10 -3 -10 L5 -10 C8 -10 9.5 -8 9.5 -5 L9.5 7 C9.5 10 8 11.5 5 11.5 L-3 11.5 C-6 11.5 -8 10 -8 7 Z',
      thumb: 'M-6.5 -6 L-6.5 -20 C-6.5 -25.5 1.5 -25.5 1.5 -20 L1.5 -8 Z',
      creases: 'M3 -4 L9.5 -4 M3 1 L9.5 1 M3 6 L9.5 6',
    },
  };
  const HIP = { n: [-6, 0], f: [10, 0] };             // leg roots (near = drawn in front)
  const SHO = { n: [-4, -72], f: [16, -72] };         // shoulders in torso-local coordinates (hip = 0,0)
  const HEAD = [6, -114], HEAD_R = 32;
  const BOOT = 'M-10 -8 L6 -8 Q9 1 19 3 Q27 4 27 9 L27 12 L-10 12 Z';
  const BOOT_SOLE = [[-10, 12], [27, 12]];

  // Two-bone IK: shoulder s to hand target t; returns [upper, fore] limb angles with the elbow down.
  function ik(s, t) {
    const dx = t[0] - s[0], dy = t[1] - s[1], len = Math.hypot(dx, dy) || 1;
    const d = clamp(len, Math.abs(UA - FA) + 1, UA + FA - 0.01);
    const base = angOf(dx, dy);
    const off = Math.acos(clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1)) / D;
    const tt = add(s, [dx, dy], d / len);
    const pick = [base + off, base - off].map(u => ({ u, e: add(s, dir(u), UA) })).sort((a, b) => b.e[1] - a.e[1])[0];
    return [pick.u, angOf(tt[0] - pick.e[0], tt[1] - pick.e[1])];
  }

  // Pose = { lean (deg, + forward), legN/legF [thigh, shin, foot] (world angles; foot is SVG degrees, + toe
  // down), armN/armF [upper, fore] relative to the torso (0 = hanging along it) or {to:[x,y]} a torso-local
  // hand target or {toW:[x,y]} a hand target relative to the hip in body coordinates, handN/handF shape
  // ('open' | 'fist' | 'point' | 'thumb'), props {name: weight}, fx {twist, sparkle}, farFree (the far arm is
  // idle, so the supervisor can hold her clipboard with it) }.
  const base = o => ({ lean: 0, legN: [-2, -2, 0], legF: [3, 3, 0], armN: [-5, 3], armF: [7, 14], handN: 'open', handF: 'open', props: {}, fx: {}, farFree: false, ...o });
  // Walk: 6 frames per step at 30 fps (a full stride of two steps every 0.4 s), smooth swing.
  const STEP = 0.2;
  function walkLegs(t, stride = 1) {
    const ph = t / (2 * STEP) * TAU, A = 20 * stride;
    const leg = q => { const th = A * Math.sin(q), c = Math.cos(q), bend = c > 0 ? 44 * stride * c * c : 0; return [th, th - bend, bend * 0.45]; };
    return { n: leg(ph), f: leg(ph + Math.PI), s: Math.sin(ph) };
  }
  const CLIP_ARM = { to: [46, -50] };      // hold-clipboard: board up at the chest, reading
  const CLIP_SIDE = { to: [42, -30] };     // supervisor's free arm: board held lower, clear of gestures
  const POSES = {
    stand: () => base({ farFree: true }),
    walk: (t, p) => {
      const w = walkLegs(t, p.stride ?? 1), a = 18 * (p.stride ?? 1) * w.s;
      return base({ lean: 3, legN: w.n, legF: w.f, armN: [-a, -a + 14], armF: [a + 4, a + 20], farFree: true });
    },
    wave: t => base({ armN: [-122, -168 + 18 * Math.sin(t * TAU / 0.7)], handN: 'open', farFree: true }),
    point: (t, p) => { const a = p.aim ?? 92; return base({ armN: [a - 4, a], handN: 'point', farFree: true }); },
    kneel: () => base({ lean: 6, legN: [4, -88, 75], legF: [84, 2, 0], armN: [50, 74], armF: [26, 44], handN: 'open', handF: 'open' }),
    inspect: () => base({ lean: 8, armN: { to: [52, -96] }, armF: [10, 26], handN: 'fist', props: { magnifier: 1 } }),
    'hold-clipboard': (t, p) => base({
      armF: CLIP_ARM, handF: 'fist', props: { clipboard: 1, pen: p.writing ? 1 : 0 },
      armN: p.writing ? { to: [24 + 4 * Math.sin(t * TAU * 2.2), -60 + 3 * Math.sin(t * TAU * 1.3)] } : [-5, 3],
      handN: p.writing ? 'fist' : 'open',
    }),
    'carry-carton': () => base({ lean: -3, armN: { to: [24, -22] }, armF: { to: [70, -24] }, handN: 'fist', handF: 'fist', props: { carton: 1 } }),
    'push-cart': () => base({ lean: 14, armN: { to: [64, -44] }, armF: { to: [78, -42] }, handN: 'fist', handF: 'fist' }),
    sweep: t => {
      const s = Math.sin(t * TAU / 0.8);
      return base({ lean: 12, legN: [-9, -9, 0], legF: [12, 12, 0], armN: { to: [26 + 9 * s, -50 + 2 * s] }, armF: { to: [60 + 14 * s, -12 + 2 * s] }, handN: 'fist', handF: 'fist', props: { broom: 1 } });
    },
    'lift-bent-knees': () => base({ lean: 10, legN: [58, -14, 0], legF: [64, -8, 0], armN: { toW: [26, -2] }, armF: { toW: [74, -4] }, handN: 'fist', handF: 'fist', props: { carton: 1 } }),
    'lift-bad': () => base({ lean: 78, legN: [-4, -4, 0], legF: [4, 4, 0], armN: { toW: [64, 72] }, armF: { toW: [96, 70] }, handN: 'fist', handF: 'fist', props: { carton: 1 }, fx: { twist: 1 } }),
    'thumbs-up': () => base({ armN: [50, 150], handN: 'thumb', farFree: true }),
    neat: () => base({ armN: [-2, 0], armF: [3, 5], fx: { sparkle: 1 }, farFree: true }),
    sit: (t, p) => {
      const k = p.typing ? 3 * Math.sin(t * TAU * 3.1) : 0, k2 = p.typing ? 3 * Math.sin(t * TAU * 2.7 + 1) : 0;
      return base({ lean: 4, legN: [86, 4, 0], legF: [88, 6, 0], armN: [40 + k, 86 + k], armF: [44 + k2, 90 + k2], handN: 'fist', handF: 'fist' });
    },
  };
  const POSE_NAMES = Object.keys(POSES);

  function armAngles(a, sho, lean) {
    if (Array.isArray(a)) return a.slice();
    if (a.to) return ik(sho, a.to);
    return ik(sho, rot(a.toW, -lean));
  }
  function resolve(name, t, p, cfg) {
    const q = (POSES[name] || POSES.stand)(t, p);
    if (cfg.clipboard && q.farFree) { q.armF = CLIP_SIDE; q.handF = 'fist'; q.props = { ...q.props, clipboard: 1 }; }
    q.armN = armAngles(q.armN, SHO.n, q.lean);
    q.armF = armAngles(q.armF, SHO.f, q.lean);
    return q;
  }
  const mixArr = (a, b, w) => a.map((v, i) => lerp(v, b[i], w));
  function mixObj(a, b, w) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] || 0, b[k] || 0, w);
    return o;
  }
  function mix(a, b, w) {
    return {
      lean: lerp(a.lean, b.lean, w), legN: mixArr(a.legN, b.legN, w), legF: mixArr(a.legF, b.legF, w),
      armN: mixArr(a.armN, b.armN, w), armF: mixArr(a.armF, b.armF, w),
      handN: w < 0.5 ? a.handN : b.handN, handF: w < 0.5 ? a.handF : b.handF,
      props: mixObj(a.props, b.props, w), fx: mixObj(a.fx, b.fx, w),
    };
  }
  function legPts(root, [th, sh, foot]) {
    const knee = add(root, dir(th), TH), ankle = add(knee, dir(sh), SH);
    const low = Math.max(knee[1] + LEG_W / 2 + 1, ...BOOT_SOLE.map(c => ankle[1] + rot(c, foot)[1]));
    return { root, knee, ankle, foot, low };
  }
  function blinkAt(t, seed) {
    const ph = hash(3, seed) * 4, k0 = Math.floor((t - ph) / 4);
    let m = 0;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const tb = ph + 4 * k + (hash(k, seed) - 0.5);   // one blink per ~4 s, 3–5 s apart
      m = Math.max(m, 1 - Math.abs(t - tb) / 0.08);
    }
    return clamp(m);
  }

  // Pure pose solver: params -> body-coordinate geometry. Shared by Worker.update, SEAT_Y and the Forklift.
  function solve(p, cfg) {
    const t = p.t || 0;
    let q = resolve(p.pose || 'stand', t, p, cfg);
    if (p.from && p.blend != null && p.blend < 1) q = mix(resolve(p.from, t, p, cfg), q, Kit.ease.enter(clamp(p.blend)));
    else q = mix(q, q, 1);
    const walking = num(p.walking);
    if (walking) { const w = walkLegs(t, p.stride ?? 1); q.legN = mixArr(q.legN, w.n, walking); q.legF = mixArr(q.legF, w.f, walking); }
    const lean = q.lean + (p.lean || 0);
    const legN0 = legPts(HIP.n, q.legN), legF0 = legPts(HIP.f, q.legF);
    const hipY = -Math.max(legN0.low, legF0.low);
    const hip = [0, hipY];
    const legN = legPts(add(hip, HIP.n), q.legN), legF = legPts(add(hip, HIP.f), q.legF);
    const breath = 0.6 - 0.6 * Math.cos((t + cfg.seed * 0.37) * TAU / 3.4);   // 0..1.2 px idle breathing
    const tor = [0, hipY - breath];
    const toW = v => add(tor, rot(v, lean));
    const toL = w => rot([w[0] - tor[0], w[1] - tor[1]], -lean);
    if (p.reach) q.armN = ik(SHO.n, toL(p.reach));
    if (p.reach2) q.armF = ik(SHO.f, toL(p.reach2));
    const arm = (sho, [u, l]) => {
      const s = toW(sho), uw = u - lean, lw = l - lean, e = add(s, dir(uw), UA), h = add(e, dir(lw), FA);
      return { s, e, h, uw, lw };
    };
    const armN = arm(SHO.n, q.armN), armF = arm(SHO.f, q.armF);
    const nod = num(p.nod);
    const head = toW([HEAD[0] + 2 * nod, HEAD[1] + 3 * nod]);
    return { q, t, lean, hip, tor, toW, legN, legF, armN, armF, head, headRot: lean + 14 * nod };
  }

  /* Kit.Worker(parent, {variant, hat, clipboard, seed, stroke, facing})
       The recurring associate (STYLE.md §6.1): 260 px tall standing, round head, two dot eyes, flat
       shirt/trousers/boots, drawn 3/4 view facing right.
     Options:
       variant   'worker' (blue, default) | 'supervisor' (purple, holds a clipboard with her free arm)
                 | 'driver' (brown, cap) | 'analyst' (teal; use pose 'sit', chair on by default)
                 | 'manager' (teal, tie stripe) | 'customer' (orange, hard hat)
       hat       'none' | 'cap' | 'hardhat'   (default from variant)
       clipboard true/false: supervisor's clipboard (default true for supervisor)
       seed      number for blink/breath phase (default: creation order, so Workers don't blink in sync)
       stroke    default outline width in local units (2.5). Drawing at scale s? pass 2.5 / s.
       facing    default facing (1 right, -1 left)
     update({pose, t, from, blend, walking, stride, aim, writing, typing, lean, nod, facing, reach, reach2,
             prop, chair, hat, ppe, stroke})
       pose    'stand' | 'walk' | 'wave' | 'point' | 'kneel' | 'inspect' | 'hold-clipboard' | 'carry-carton'
               | 'push-cart' | 'sweep' | 'lift-bent-knees' | 'lift-bad' | 'thumbs-up' | 'neat' | 'sit'
               (list: Kit.Worker.POSES). Held props are drawn by the Worker: clipboard (hold-clipboard),
               magnifier (inspect), carton (carry-carton, lift-bent-knees, lift-bad), broom (sweep), pointing
               hand (point), thumb (thumbs-up). lift-bad adds the red twist arrow + lower-back flash; neat
               adds sparkles. push-cart draws no cart: its hands sit at about (73..86, -140), so put a cart
               handle there (or read the returned hand anchors). sit: hip at Kit.Worker.SEAT_Y (-66), so a
               seat top belongs at y -54; hands forward at about (72..94, -97).
       t       seconds; drives walk (6 frames/step), wave, sweep, writing, typing, blink (every 3–5 s) and
               1 px breathing. Always pass the scene time.
       from, blend  arm/leg cross-blend: previous pose name and 0..1 progress (STYLE: 0.2 s). Easiest via
               Kit.Worker.poseAt(t, [[t0,'stand'],[t1,'point']]) which returns {pose, from, blend}.
       walking 0..1  walk-cycle legs under any pose (e.g. hold-clipboard while walking). stride 0.5..1.2.
               Move the Worker at Kit.Worker.WALK_SPEED (356) * stride * scale px/s for no foot slide.
       aim     point: arm angle in degrees (92 forward, 140 up-forward, 40 down-forward)
       writing hold-clipboard: pen hand scribbles.   typing  sit: hands tap.
       lean    extra forward lean in degrees.   nod  0..1 head tilt (animate it for a nod).
       facing  1 | -1 (mirror).
       reach / reach2  [x, y] near / far hand target (2-bone IK, elbow down) in the Worker's own unscaled
               coordinates with +x = the way it faces, e.g. reach: [70, -20] to touch something low in front.
       prop    false hides the pose's held prop.   chair  sit: draw an office chair (analyst default on).
       hat     overrides the hat option.
       ppe     {hardHat, glasses, gloves, vest, boots}: each 0..1 snap-on progress (or true); ppe: true = all.
               Kit.Worker.ppeAt(t, t0) gives the in-sequence snap (0.2 s apart).
       stroke  outline width override (see options).
     update returns anchors in the Worker's local coordinates (facing applied; multiply by your scale and add
       your position): {head (top of head, for a callout), face, chest (badge spot), hip, hand (near), hand2
       (far), prop (held prop centre, or null)}.
     Origin: bottom-centre on the floor line, under the hip. Head top at y ≈ -262 standing; footprint about
       110 px wide standing.
  */
  let workerCount = 0;
  function Worker(parent, opts = {}) {
    const variant = C.shirt[opts.variant] ? opts.variant : 'worker';
    const shirt = C.shirt[variant];
    const cfg = { seed: opts.seed ?? ++workerCount, clipboard: opts.clipboard ?? variant === 'supervisor' };
    const hat0 = opts.hat || (variant === 'driver' ? 'cap' : variant === 'customer' ? 'hardhat' : 'none');
    const stroke0 = opts.stroke ?? STROKE;
    const L = outlines();

    const g = el('g', {}, parent);
    const shadow = Kit.shadow(g, 110);
    const body = el('g', {}, g);

    // Office chair (sit pose).
    const chair = el('g', {}, body);
    const chairBack = shape(L, 'rect', { x: -50, y: -66, width: 15, height: 74, rx: 7, fill: C.steelDark }, chair);
    const chairPost = bar(L, chair, C.steel, 8);
    const chairBase = bar(L, chair, C.steelDark, 7);
    const chairSeat = shape(L, 'rect', { x: -40, y: 0, width: 66, height: 13, rx: 6, fill: C.steelDark }, chair);
    const chairWheels = [-34, 24].map(x => shape(L, 'circle', { cx: x, r: 5.5, fill: C.ink }, chair));

    // Arms: outline under skin under sleeve (short sleeves), then the hand group, then the glove.
    function makeArm(parent) {
      const grp = el('g', {}, parent);
      const out = L.limb(el('path', { fill: 'none', stroke: C.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp), ARM_W);
      const skin = el('path', { fill: 'none', stroke: C.skin, 'stroke-width': ARM_W, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp);
      const sleeve = el('path', { fill: 'none', stroke: shirt, 'stroke-width': ARM_W + 1, 'stroke-linecap': 'round' }, grp);
      // A hand is thumb, palm/fingers, an optional pointing index finger and knuckle creases, drawn in
      // hand-local coordinates (see HANDS); the glove repeats the same shapes in safety yellow.
      const handParts = (parent, fill) => {
        const inner = el('g', {}, parent);
        const parts = ['thumb', 'body', 'index'].map(() => shape(L, 'path', { fill }, inner));
        parts.push(L.line(el('path', { fill: 'none', 'stroke-linecap': 'round' }, inner), 1.6));
        return { inner, parts };
      };
      const hand = el('g', {}, grp);
      const handIn = handParts(hand, C.skin);
      const glove = el('g', {}, grp);
      const cuffG = el('g', {}, glove);
      shape(L, 'rect', { x: -19, y: -10.5, width: 15, height: 21, rx: 3, fill: C.safety }, cuffG);
      const gloveIn = handParts(glove, C.safety);
      return { grp, out, skin, sleeve, hand, handIn, glove, cuffG, gloveIn };
    }
    function makeLeg(parent) {
      const grp = el('g', {}, parent);
      const leg = bar(L, grp, C.trousers, LEG_W);
      const boot = el('g', {}, grp);
      shape(L, 'path', { d: BOOT, fill: C.boots }, boot);
      const ppe = el('g', {}, boot);
      shape(L, 'path', { d: 'M-11 -17 L7 -17 L8 -6 Q11 1 19 2.5 Q28 3.5 28 9 L28 13 L-11 13 Z', fill: C.boots }, ppe);
      shape(L, 'rect', { x: -11, y: -17, width: 18, height: 6, fill: C.safety }, ppe, 2);
      shape(L, 'path', { d: 'M17 2.4 Q28 3.5 28 9 L28 9.5 L17 9.5 Z', fill: C.steel }, ppe, 2);
      shape(L, 'rect', { x: -11, y: 9.5, width: 39, height: 4, rx: 1.5, fill: C.ink }, ppe, 1.5);
      return { grp, leg, boot, ppe };
    }

    const armF = makeArm(body);
    const legF = makeLeg(body);
    const legN = makeLeg(body);

    // Torso (rotates about the hip with the lean).
    const torso = el('g', {}, body);
    shape(L, 'path', { d: 'M-27 9 L-28 -64 Q-29 -88 2 -88 Q32 -88 32 -64 L31 9 Q2 13 -27 9 Z', fill: shirt }, torso);
    shape(L, 'path', { d: 'M-21 -60 L-7 -60 L-7 -49 Q-14 -46 -21 -49 Z', fill: 'none' }, torso, 2);
    const tie = el('g', {}, torso);
    shape(L, 'path', { d: 'M5 -84 L13 -84 L12 -77 L16 -42 L9 -34 L2 -42 L6 -77 Z', fill: C.bgDark }, tie, 2);
    shape(L, 'path', { d: 'M-3 -87 L9 -76 L21 -87', fill: 'none', 'stroke-linecap': 'round' }, torso, 2.5);
    const vest = el('g', {}, torso);
    shape(L, 'path', { d: 'M-27 9 L-28 -64 Q-29 -86 -8 -87 L4 -60 L5 11 Q-12 12 -27 9 Z', fill: C.safety }, vest);
    shape(L, 'path', { d: 'M13 11 L13 -60 L22 -87 Q32 -85 32 -64 L31 9 Q21 11 13 11 Z', fill: C.safety }, vest);
    for (const y of [-40, -20]) {
      shape(L, 'rect', { x: -27.5, y, width: 32, height: 7, fill: C.paper }, vest, 1.5);
      shape(L, 'rect', { x: 13, y, width: 18.5, height: 7, fill: C.paper }, vest, 1.5);
    }

    // Head (rotates with lean + nod). Ear, face, hair, eyes, glasses, cap, hard hat.
    const head = el('g', {}, body);
    const HK = HEAD_R / 30;                       // head art is drawn for r = 30, scaled to HEAD_R
    const headArt = el('g', { transform: `scale(${r2(HK)})` }, head);
    const H = (tag, attrs, par, b = STROKE) => shape(L, tag, attrs, par, b / HK);
    H('circle', { cx: 0, cy: 0, r: 30, fill: C.skin }, headArt);
    H('path', { d: 'M-29 9 C-35 -18 -14 -33 6 -31 C20 -30 29 -22 30.5 -11 C22 -17 10 -18 0 -16 C-9 -14 -14 -8 -16 1 C-18 8 -23 11 -29 9 Z', fill: C.boots }, headArt);
    H('circle', { cx: -11, cy: 5, r: 5.5, fill: C.skin }, headArt, 2);
    const eyes = [[12, 1], [24, 0]].map(([x, y]) => el('ellipse', { cx: x, cy: y, rx: 3.4, ry: 4.2, fill: C.ink }, headArt));
    const glasses = el('g', {}, headArt);
    H('path', { d: 'M-28 -3 L5 -5', fill: 'none', 'stroke-linecap': 'round' }, glasses, 3);
    H('path', { d: 'M4 -7 L32 -7 Q33 5 27 7.5 L9 7.5 Q3 5 4 -7 Z', fill: C.neutral, 'fill-opacity': 0.35 }, glasses);
    const cap = el('g', {}, headArt);
    H('path', { d: 'M-31 -6 C-31 -27 -17 -37 1 -37 C19 -37 31 -27 31 -8 Z', fill: C.steelDark }, cap);
    H('path', { d: 'M20 -11 L49 -8 Q53 -4 48 -2 L20 -3 Z', fill: C.steelDark }, cap);
    const hardhat = el('g', {}, headArt);
    H('path', { d: 'M-32 -11 C-32 -33 -17 -45 1 -45 C20 -45 33 -33 33 -11 Z', fill: C.safety }, hardhat);
    H('path', { d: 'M-11 -42 Q6 -48 23 -36 L26 -29 Q8 -40 -9 -36 Z', fill: C.safety }, hardhat, 2);
    H('path', { d: 'M-37 -15 L39 -15 Q48 -15 48 -10 Q48 -7 42 -7 L-37 -7 Q-41 -7 -41 -11 Q-41 -15 -37 -15 Z', fill: C.safety }, hardhat);

    // Hand-held props (drawn over the torso, under the near arm).
    const props = el('g', {}, body);
    const clip = el('g', {}, props);
    shape(L, 'rect', { x: -46, y: -36, width: 46, height: 60, rx: 4, fill: C.cartonEdge }, clip);
    shape(L, 'rect', { x: -41, y: -29, width: 36, height: 48, fill: C.paper }, clip, 2);
    for (const [y, w] of [[-18, 24], [-8, 26], [2, 20], [12, 24]]) el('line', { x1: -36, x2: -36 + w, y1: y, y2: y, stroke: C.inkSoft, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, clip);
    shape(L, 'rect', { x: -31, y: -40, width: 16, height: 9, rx: 2, fill: C.steel }, clip, 2);
    const pen = el('g', {}, props);
    const penBar = bar(L, pen, C.neutral, 5);
    penBar.d('M0 6 L0 -20');
    const mag = el('g', {}, props);
    const magHandle = bar(L, mag, C.steelDark, 7);
    magHandle.d('M0 6 L0 -24');
    shape(L, 'circle', { cx: 0, cy: -42, r: 18, fill: C.steelDark }, mag);
    shape(L, 'circle', { cx: 0, cy: -42, r: 12.5, fill: C.paper, 'fill-opacity': 0.7 }, mag, 2);
    el('path', { d: 'M-6 -47 Q-3 -51 2 -51', fill: 'none', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round' }, mag);
    const carton = el('g', {}, props);
    shape(L, 'path', { d: 'M-30 -46 L-20 -56 L40 -56 L30 -46 Z', fill: '#DDB27C' }, carton);
    shape(L, 'path', { d: 'M30 0 L40 -10 L40 -56 L30 -46 Z', fill: C.cartonEdge }, carton);
    shape(L, 'rect', { x: -30, y: -46, width: 60, height: 46, fill: C.carton }, carton);
    shape(L, 'path', { d: 'M-25 -51 L35 -51', fill: 'none' }, carton, 1.5);
    shape(L, 'rect', { x: -6, y: -46, width: 12, height: 14, fill: '#DDB27C' }, carton, 1.5);
    const broom = el('g', {}, props);
    const broomStick = bar(L, broom, C.cartonEdge, 6);
    const broomHead = el('g', {}, broom);
    shape(L, 'path', { d: 'M-30 2 L30 2 L35 16 L-35 16 Z', fill: C.safety }, broomHead);
    shape(L, 'rect', { x: -27, y: -7, width: 54, height: 10, rx: 3, fill: C.steelDark }, broomHead);
    for (const x of [-18, -6, 6, 18]) el('line', { x1: x, x2: x * 1.15, y1: 5, y2: 14, stroke: C.ink, 'stroke-width': 1.5, opacity: 0.45 }, broomHead);

    const armN = makeArm(body);

    // Effects: lift-bad twist arrow + lower-back flash (torso frame), neat sparkles.
    const twist = el('g', {}, body);
    const flash = el('g', {}, twist);
    shape(L, 'path', { d: 'M0 -17 L4.5 -6 L16 -9 L8 0 L16 9 L4.5 6 L0 17 L-4.5 6 L-16 9 L-8 0 L-16 -9 L-4.5 -6 Z', fill: C.error }, flash, 2);
    const twistArc = bar(L, twist, C.error, 5);
    twistArc.d('M-30 -34 A44 12 0 1 0 34 -26');
    shape(L, 'path', { d: 'M0 -8 L14 0 L0 8 Z', fill: C.error, transform: 'translate(36 -25) rotate(-16)' }, twist, 2);
    const sparkles = [[46, -246], [-46, -196], [52, -170]].map(([x, y]) => {
      const s = el('g', {}, body);
      shape(L, 'path', { d: SPARKLE, fill: C.accent }, s, 2);
      return { s, x, y };
    });

    // Layer helpers for the hand shapes and glove.
    function setArm(A, a, hs, gloveP, gloveOn) {
      const mid = add(a.s, dir(a.uw), UA * 0.55);
      set(A.out, { d: line(a.s, a.e, a.h) });
      set(A.skin, { d: line(mid, a.e, a.h) });
      set(A.sleeve, { d: line(a.s, mid) });
      const shapes = HANDS[hs] || HANDS.open;
      // Turned along the forearm, except a thumbs-up, which stays upright just past the wrist.
      const inner = hs === 'thumb' ? tf(...dir(a.lw).map(v => v * 7)) : tf(0, 0, 90 - a.lw);
      set(A.hand, { transform: tf(a.h[0], a.h[1]) });
      paintHand(A.handIn, shapes, inner);
      Kit.show(A.glove, gloveP > 0);
      if (gloveP > 0) {
        const s = 1.6 - 0.6 * Kit.ease.pop(gloveP);
        set(A.glove, { transform: tf(a.h[0], a.h[1], 0, s), opacity: clamp(gloveP * 4) });
        set(A.cuffG, { transform: tf(0, 0, 90 - a.lw) });
        paintHand(A.gloveIn, shapes, inner);
      }
    }
    function paintHand({ inner, parts: [thumb, body, index, creases] }, shapes, transform) {
      set(inner, { transform });
      set(thumb, { d: shapes.thumb });
      set(body, { d: shapes.body });
      set(creases, { d: shapes.creases });
      Kit.show(index, !!shapes.index);
      if (shapes.index) set(index, { d: shapes.index });
    }
    function setLeg(Lg, l, bootP) {
      Lg.leg.d(line(l.root, l.knee, l.ankle));
      set(Lg.boot, { transform: tf(l.ankle[0], l.ankle[1], l.foot) });
      Kit.show(Lg.ppe, bootP > 0);
      if (bootP > 0) set(Lg.ppe, { transform: `translate(0 ${r2(-22 * (1 - Kit.ease.pop(bootP)))})`, opacity: clamp(bootP * 4) });
    }

    function update(p = {}) {
      L.apply(p.stroke ?? stroke0);
      const S = solve(p, cfg), { q, t } = S;
      const facing = (p.facing ?? opts.facing ?? 1) < 0 ? -1 : 1;
      set(body, { transform: facing < 0 ? 'scale(-1 1)' : '' });
      const ppeAll = p.ppe === true;
      const pp = k => (ppeAll ? 1 : num(p.ppe && p.ppe[k]));
      const hat = p.hat || hat0;

      // Shadow follows the feet.
      const xs = [S.legN.ankle[0], S.legF.ankle[0], S.legN.knee[0], S.legF.knee[0]];
      const x0 = Math.min(...xs) - 14, x1 = Math.max(...xs) + 30;
      set(shadow, { cx: r2(facing * (x0 + x1) / 2), rx: r2(Math.max(55, (x1 - x0) / 2 + 12)) });

      // Chair (sit only).
      const showChair = (p.chair ?? variant === 'analyst') && (p.pose === 'sit');
      Kit.show(chair, showChair);
      if (showChair) {
        const sy = S.hip[1] + LEG_W / 2 + 1;
        set(chairSeat, { y: r2(sy) }); set(chairBack, { y: r2(sy - 76) });
        chairPost.d(line([-6, sy + 12], [-6, -12]));
        chairBase.d(line([-34, -10], [24, -10]));
        chairWheels.forEach(w => set(w, { cy: -5.5 }));
      }

      setLeg(legF, S.legF, pp('boots'));
      setLeg(legN, S.legN, pp('boots'));
      setArm(armF, S.armF, q.handF, pp('gloves'), pp('gloves') > 0.5);
      setArm(armN, S.armN, q.handN, pp('gloves'), pp('gloves') > 0.5);

      set(torso, { transform: tf(S.tor[0], S.tor[1], S.lean) });
      Kit.show(tie, variant === 'manager');
      const vp = pp('vest');
      Kit.show(vest, vp > 0);
      if (vp > 0) set(vest, { transform: `translate(2 -40) scale(${r2(1.25 - 0.25 * Kit.ease.pop(vp))}) translate(-2 40)`, opacity: clamp(vp * 4) });

      set(head, { transform: tf(S.head[0], S.head[1], S.headRot) });
      const b = blinkAt(t, cfg.seed);
      eyes.forEach(e => set(e, { ry: r2(4.2 * (1 - 0.88 * b)) }));
      const gp = pp('glasses');
      Kit.show(glasses, gp > 0);
      if (gp > 0) set(glasses, { transform: `translate(${r2(24 * (1 - Kit.ease.pop(gp)))} 0)`, opacity: clamp(gp * 4) });
      const hh = Math.max(hat === 'hardhat' ? 1 : 0, pp('hardHat'));
      Kit.show(hardhat, hh > 0);
      if (hh > 0) set(hardhat, { transform: `translate(0 ${r2(-40 * (1 - Kit.ease.pop(hh)))})`, opacity: clamp(hh * 4) });
      Kit.show(cap, hat === 'cap' && hh < 0.5);

      // Props.
      const w = k => (p.prop === false ? 0 : clamp(q.props[k] || 0));
      const hN = S.armN.h, hF = S.armF.h;
      const wc = w('clipboard');
      Kit.show(clip, wc > 0.01);
      if (wc > 0.01) set(clip, { transform: tf(hF[0] + 4, hF[1], S.lean - 6), opacity: r2(wc) });
      const wp = w('pen');
      Kit.show(pen, wp > 0.01);
      if (wp > 0.01) set(pen, { transform: tf(hN[0], hN[1], S.lean + 30), opacity: r2(wp) });
      const wm = w('magnifier');
      Kit.show(mag, wm > 0.01);
      if (wm > 0.01) set(mag, { transform: tf(hN[0], hN[1], S.lean + 12), opacity: r2(wm) });
      const wk = w('carton');
      Kit.show(carton, wk > 0.01);
      let propAt = null;
      if (wk > 0.01) {
        const cx = (hN[0] + hF[0]) / 2 - 2;
        const floorish = q.fx.twist > 0.5;   // lift-bad: the carton still sits on the floor
        const cy = floorish ? 0 : Math.max(hN[1], hF[1]) + 8;
        set(carton, { transform: tf(cx, cy), opacity: r2(wk) });
        propAt = [cx, cy - 28];
      }
      const wb = w('broom');
      Kit.show(broom, wb > 0.01);
      if (wb > 0.01) {
        const v = [hF[0] - hN[0], hF[1] - hN[1]], len = Math.hypot(...v) || 1, u = [v[0] / len, v[1] / len];
        const k = Math.min(400, (-16 - hN[1]) / Math.max(0.2, u[1]));
        const end = add(hN, u, k), top = add(hN, u, -18);
        broomStick.d(line(top, end));
        set(broomHead, { transform: tf(end[0], end[1] - 2) });
        set(broom, { opacity: r2(wb) });
        propAt = end;
      }
      if (wc > 0.01) propAt = add(hF, [-18, -6]);
      if (wm > 0.01) propAt = add(hN, rot([0, -42], S.lean + 12));

      // Effects.
      const wt = clamp(q.fx.twist || 0);
      Kit.show(twist, wt > 0.01);
      if (wt > 0.01) {
        set(twist, { transform: tf(S.tor[0], S.tor[1], S.lean), opacity: r2(wt) });
        const k = 1 + 0.18 * Math.sin(t * TAU / 0.6);
        set(flash, { transform: tf(-29, -6, 0, k) });
      }
      const ws = clamp(q.fx.sparkle || 0);
      sparkles.forEach((s, i) => {
        Kit.show(s.s, ws > 0.01);
        if (ws > 0.01) {
          const ph = (t / 1.6 + i / 3) % 1, k = Math.max(0, Math.sin(ph * Math.PI));
          set(s.s, { transform: tf(s.x, s.y + S.hip[1] + 116, ph * 90, 0.35 + 0.75 * k), opacity: r2(ws * clamp(k * 1.5)) });
        }
      });

      const F = v => [r2(v[0] * facing), r2(v[1])];
      return {
        head: F(S.toW([HEAD[0], HEAD[1] - HEAD_R])), face: F(add(S.head, [18, 0])), chest: F(S.toW([4, -54])),
        hip: F(S.hip), hand: F(hN), hand2: F(hF), prop: propAt && F(propAt),
      };
    }
    update({});
    return { g, update };
  }

  // Pose timeline -> {pose, from, blend} with the STYLE.md 0.2 s cross-blend.
  //   Kit.Worker.poseAt(t, [[0, 'walk'], [3.2, 'stand'], [4, 'point']], 0.2)
  Worker.poseAt = (t, timeline, dur = 0.2) => {
    let i = 0;
    while (i + 1 < timeline.length && t >= timeline[i + 1][0]) i++;
    const [t0, pose] = timeline[i];
    if (i === 0 || t >= t0 + dur) return { pose, from: null, blend: 1 };
    return { pose, from: timeline[i - 1][1], blend: clamp((t - t0) / dur) };
  };
  // PPE snapping on one item at a time, `gap` seconds apart, each taking `dur`; returns the ppe param.
  Worker.PPE_ORDER = ['hardHat', 'glasses', 'vest', 'gloves', 'boots'];
  Worker.ppeAt = (t, t0, gap = 0.2, dur = 0.3, order = Worker.PPE_ORDER) =>
    Object.fromEntries(order.map((k, i) => [k, clamp((t - t0 - i * gap) / dur)]));
  Worker.POSES = POSE_NAMES;
  // Ground speed (px/s at scale 1, stride 1) at which the walk cycle's planted foot doesn't slide.
  Worker.WALK_SPEED = Math.round(2 * (TH + SH) * Math.sin(20 * D) / STEP);
  // Hip height of the 'sit' pose above the floor (px, negative = up): put a seat top at SEAT_Y + 12.
  Worker.SEAT_Y = Math.round(solve({ pose: 'sit' }, { seed: 0 }).hip[1]);
  Kit.Worker = Worker;

  /* Kit.PPEIcon(parent, {item, size, bg, stroke})
       Standalone PPE icon for icon rows (STYLE.md §6.36), same drawing as the Worker's PPE layers.
     Options: item 'hardHat' | 'glasses' | 'gloves' | 'vest' | 'boots' (also 'hard-hat', 'safety-glasses',
              'hi-vis-vest'); size (default 84 px box); bg true = paper disc with steel ring behind.
     update({p, stroke})  p 0..1 pop-in progress (scale 0 -> 1 with ease-out-back; default 1).
     Origin: centre.
  */
  function PPEIcon(parent, opts = {}) {
    const alias = { 'hard-hat': 'hardHat', hardhat: 'hardHat', 'safety-glasses': 'glasses', 'hi-vis-vest': 'vest', hivis: 'vest', glove: 'gloves', boot: 'boots' };
    const item = alias[opts.item] || opts.item || 'hardHat';
    const L = outlines();
    const g = el('g', {}, parent);
    const inner = el('g', {}, g);
    const k = (opts.size || 84) / 84;
    const art = el('g', { transform: k !== 1 ? `scale(${r2(k)})` : '' }, inner);
    if (opts.bg) shape(L, 'circle', { r: 50, fill: C.paper, stroke: C.steel }, art, 2);
    const S = (tag, attrs, base) => shape(L, tag, attrs, art, base);
    if (item === 'hardHat') {
      S('path', { d: 'M-36 8 C-36 -18 -20 -32 0 -32 C20 -32 36 -18 36 8 Z', fill: C.safety });
      S('path', { d: 'M-8 -31 L8 -31 L9 6 L-9 6 Z', fill: C.safety }, 2);
      S('path', { d: 'M-42 4 L42 4 Q47 4 47 9 Q47 14 42 14 L-42 14 Q-47 14 -47 9 Q-47 4 -42 4 Z', fill: C.safety });
    } else if (item === 'glasses') {
      S('path', { d: 'M-44 -6 L-50 4 M44 -6 L50 4', fill: 'none', 'stroke-linecap': 'round' }, 4);
      S('path', { d: 'M-44 -12 L44 -12 Q46 -12 45 -6 Q42 14 26 15 Q10 15 6 4 Q0 0 -6 4 Q-10 15 -26 15 Q-42 14 -45 -6 Q-46 -12 -44 -12 Z', fill: C.neutral, 'fill-opacity': 0.35 }, 3);
      el('path', { d: 'M-34 -4 L-24 -4 M22 -4 L32 -4', stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'round' }, art);
    } else if (item === 'gloves') {
      const fingers = [[-16, -34], [-5, -40], [6, -38], [16, -30]];
      for (const [x, y] of fingers) { const f = bar(L, art, C.safety, 11); f.d(`M${x} -4 L${x} ${y}`); }
      const th = bar(L, art, C.safety, 12); th.d('M-14 10 L-32 -6');
      S('path', { d: 'M-22 -14 L22 -14 Q24 8 18 22 L-18 22 Q-24 8 -22 -14 Z', fill: C.safety });
      S('rect', { x: -21, y: 20, width: 42, height: 16, rx: 3, fill: C.steel });
    } else if (item === 'vest') {
      S('path', { d: 'M-30 -38 L-14 -38 L0 -6 L14 -38 L30 -38 L32 -18 L38 -12 L38 40 L-38 40 L-38 -12 L-32 -18 Z', fill: C.safety });
      for (const y of [6, 22]) { S('rect', { x: -38, y, width: 34, height: 7, fill: C.paper }, 1.5); S('rect', { x: 4, y, width: 34, height: 7, fill: C.paper }, 1.5); }
      S('path', { d: 'M0 -6 L0 40', fill: 'none' }, 2);
    } else {
      S('path', { d: 'M-30 -36 L2 -36 L4 -6 Q30 -4 38 8 L38 22 L-30 22 Z', fill: C.boots });
      S('rect', { x: -30, y: -36, width: 32, height: 9, fill: C.safety }, 2);
      S('path', { d: 'M18 -3.5 Q33 -1 38 8 L38 12 L18 12 Z', fill: C.steel }, 2);
      S('rect', { x: -31, y: 12, width: 70, height: 10, rx: 3, fill: C.ink }, 2);
    }
    function update(p = {}) {
      L.apply(p.stroke ?? opts.stroke ?? STROKE);
      const pr = p.p == null ? 1 : clamp(p.p);
      Kit.show(inner, pr > 0);
      set(inner, { transform: pr < 1 ? `scale(${r2(Math.max(0, Kit.ease.pop(pr)))})` : '', opacity: r2(clamp(pr * 3)) });
    }
    update({});
    return { g, update };
  }
  Kit.PPEIcon = PPEIcon;

  /* Kit.TagOut(parent, {stroke})
       Red lock-out tag (STYLE.md §6.16), 130 x 166 px including its string, white "DO NOT" (26 px) /
       "OPERATE" (22 px). Wider than the 90 px spec so both lines stay >= 22 px at 1x. Returned object also
       carries width and height.
     update({p, t, stroke})
       p  0..1 swing-on progress: fades in on the hook and swings from 55 deg to rest with damping
          (use about 0.9 s: p = Engine.prog(t, t0, 0.9, Kit.ease.linear)). Default 1.
       t  seconds; a slow 1.5 deg sway once hung.
     Origin: the hook point at the top centre (the tag pivots about it).
  */
  function TagOut(parent, opts = {}) {
    const L = outlines();
    const g = el('g', {}, parent);
    const swing = el('g', {}, g);
    const w2 = Math.ceil(Math.max(90, Kit.measure('OPERATE', 22, 800) + 26, Kit.measure('DO NOT', 26, 800) + 26) / 2);
    const top = 22, bot = 166, ch = 16;
    shape(L, 'path', { d: `M-3 3 L-12 ${top + 14} M3 3 L12 ${top + 14}`, fill: 'none', 'stroke-linecap': 'round' }, swing, 2);
    shape(L, 'path', { d: `M${-w2 + ch} ${top} L${w2 - ch} ${top} L${w2} ${top + ch} L${w2} ${bot - 6} Q${w2} ${bot} ${w2 - 6} ${bot} L${-w2 + 6} ${bot} Q${-w2} ${bot} ${-w2} ${bot - 6} L${-w2} ${top + ch} Z`, fill: C.error }, swing);
    el('rect', { x: -w2 + 7, y: top + 30, width: 2 * w2 - 14, height: bot - top - 37, rx: 4, fill: 'none', stroke: C.paper, 'stroke-width': 2 }, swing);
    shape(L, 'circle', { cx: 0, cy: top + 14, r: 7.5, fill: C.paper }, swing, 2);
    el('circle', { cx: 0, cy: top + 14, r: 3, fill: C.ink }, swing);
    Kit.text(swing, 'DO NOT', { x: 0, y: top + 74, size: 26, weight: 800, fill: C.paper, anchor: 'middle' });
    Kit.text(swing, 'OPERATE', { x: 0, y: top + 104, size: 22, weight: 800, fill: C.paper, anchor: 'middle' });
    el('rect', { x: -w2 + 22, y: top + 118, width: 2 * w2 - 44, height: 5, rx: 2.5, fill: C.paper }, swing);
    shape(L, 'circle', { cx: 0, cy: 0, r: 5, fill: C.steel }, g, 2);
    function update(p = {}) {
      L.apply(p.stroke ?? opts.stroke ?? STROKE);
      const pr = p.p == null ? 1 : clamp(p.p), t = p.t || 0;
      const a = 55 * (1 - pr) ** 1.6 * Math.cos(pr * 3 * Math.PI) + 1.5 * pr * Math.sin(t * TAU / 2.6);
      Kit.show(g, pr > 0);
      set(swing, { transform: `rotate(${r2(a)})`, opacity: r2(clamp(pr * 5)) });
    }
    update({});
    return { g, update, width: 2 * w2, height: bot };
  }
  Kit.TagOut = TagOut;

  /* Kit.Padlock(parent, {size, stroke})
       Lock-out padlock icon (STYLE.md §6.16), default 56 px tall.
     update({open, p, stroke})
       open 0..1  shackle lifts and swings open (0 = locked). p 0..1 pop-in (ease-out-back), default 1.
     Origin: centre (of the whole icon, shackle included).
  */
  function Padlock(parent, opts = {}) {
    const L = outlines();
    const g = el('g', {}, parent);
    const inner = el('g', {}, g);
    const k = (opts.size || 56) / 56;
    const art = el('g', { transform: k !== 1 ? `scale(${r2(k)})` : '' }, inner);
    const shackle = el('g', {}, art);
    const sh = bar(L, shackle, C.steel, 6);
    sh.d('M-11 2 L-11 -14 A11 11 0 0 1 11 -14 L11 2');
    shape(L, 'rect', { x: -19, y: -3, width: 38, height: 31, rx: 6, fill: C.steelDark }, art);
    el('circle', { cx: 0, cy: 9, r: 4, fill: C.paper }, art);
    el('path', { d: 'M-2 10 L2 10 L3 19 L-3 19 Z', fill: C.paper }, art);
    function update(p = {}) {
      L.apply(p.stroke ?? opts.stroke ?? STROKE);
      const o = num(p.open), pr = p.p == null ? 1 : clamp(p.p);
      // Pivot on the right leg: lift 9 px, then swing the free left leg out.
      set(shackle, { transform: `translate(0 ${r2(-9 * Math.min(1, o * 2))}) translate(11 0) rotate(${r2(-35 * clamp(o * 2 - 1))}) translate(-11 0)` });
      Kit.show(inner, pr > 0);
      set(inner, { transform: pr < 1 ? `scale(${r2(Math.max(0, Kit.ease.pop(pr)))})` : '', opacity: r2(clamp(pr * 3)) });
    }
    update({});
    return { g, update };
  }
  Kit.Padlock = Padlock;

  /* Kit.Forklift(parent, {driver, driverVariant, load, tagScale, stroke})
       Side-view counterbalance forklift (STYLE.md §6.15), 420 x 300 px, facing right, steel mast, safety-
       yellow body, overhead guard, optional seated Worker driving it.
     Options: driver true = build a seated Kit.Worker (driverVariant, default 'worker'); load true = build a
              pallet + carton on the forks; tagScale for the TagOut on the column (default 1).
     update({state, t, dist, lift, load, driver, tag, desat, padlock, stroke})
       state   'idle' (engine shiver, beacon steady) | 'driving' (wheels turn, beacon flashes)
               | 'speeding' (fast wheels, speed lines, front lifts, load tilted with a red outline)
               | 'tagged-out' (greyed out, TagOut tag on the steering column, engine still)
       t       seconds (wheel turn, beacon, wobble, tag sway, driver blink/breath)
       dist    px travelled; turns the wheels exactly (else t * DRIVE_SPEED, doubled when speeding).
               Kit.Forklift.DRIVE_SPEED = 260 px/s is the matching ground speed at scale 1.
       lift    0..1 fork height.   load / driver  show or hide what the options built (default shown).
       tag     0..1 TagOut swing-on progress (default 1 when tagged-out, else 0)
       desat   0..1 greying (default 1 when tagged-out, else 0) — tween it for "the forklift desaturates"
       padlock 0..1 padlock pop-in beside the tag (default 0)
     Origin: bottom-centre on the floor line.
  */
  function Forklift(parent, opts = {}) {
    const L = outlines();
    const g = el('g', {}, parent);
    const pal = [];
    const paint = (node, attr, c) => { pal.push([node, attr, c]); set(node, { [attr]: c }); return node; };
    const S = (tag, attrs, par, fill, base) => { const n = shape(L, tag, attrs, par, base); if (fill) paint(n, 'fill', fill); return n; };
    const B = (par, color, w) => { const b = bar(L, par, color, w); paint(b.f, 'stroke', color); return b; };

    Kit.shadow(g, 390);
    const speedLines = el('g', {}, g);
    const lines = [[-70, 70], [-130, 90], [-190, 60]].map(([y, len]) => el('line', { x1: -230 - len, x2: -230, y1: y, y2: y, stroke: C.inkSoft, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '34 22' }, speedLines));
    const puffs = [0, 1, 2].map(() => el('circle', { r: 8, fill: C.floor, stroke: C.inkSoft, 'stroke-width': 2 }, g));
    const rig = el('g', {}, g);

    // Overhead guard rear post, seat, steering (behind the driver).
    const rearPost = B(rig, C.steelDark, 9); rearPost.d('M-112 -121 L-104 -296');
    S('rect', { x: -106, y: -204, width: 16, height: 78, rx: 7 }, rig, C.trousers);
    S('rect', { x: -96, y: -131, width: 56, height: 11, rx: 5 }, rig, C.trousers);
    const column = B(rig, C.steelDark, 9); column.d('M70 -142 L28 -184');
    S('ellipse', { cx: 0, cy: 0, rx: 19, ry: 6, transform: 'translate(26 -188) rotate(32)' }, rig, C.trousers);

    const driverG = el('g', {}, rig);
    const driver = opts.driver ? Worker(driverG, { variant: opts.driverVariant || 'worker', seed: opts.seed }) : null;
    const SEAT = [-62, -141];

    // Body: counterweight, side panel, wheel arches, wheels.
    S('path', { d: 'M-128 -44 L-206 -44 L-206 -128 Q-206 -150 -184 -150 L-128 -150 Z' }, rig, C.steelDark);
    S('path', { d: 'M-132 -44 L-132 -114 Q-132 -121 -125 -121 L-46 -121 Q-40 -121 -38 -115 L-30 -96 L42 -96 L54 -146 Q56 -152 62 -152 L76 -152 Q82 -152 84 -146 L102 -64 L102 -44 Z' }, rig, C.safety);
    S('rect', { x: -128, y: -84, width: 22, height: 10, rx: 3 }, rig, C.accent, 2);
    const wheels = [[-110, -31, 31], [60, -37, 37]].map(([x, y, r]) => {
      S('path', { d: `M${x - r - 8} -44 A${r + 8} ${r + 8} 0 0 1 ${x + r + 8} -44 Z` }, rig, C.trousers);
      const wg = el('g', { transform: tf(x, y) }, rig);
      S('circle', { r }, wg, C.trousers);
      S('circle', { r: r * 0.46 }, wg, C.steel);
      const hub = el('g', {}, wg);
      for (const a of [0, 120, 240]) { const [dx, dy] = rot([0, -r * 0.3], a); S('circle', { cx: r2(dx), cy: r2(dy), r: 3.2 }, hub, C.steelDark, 1.5); }
      S('circle', { r: 4.5 }, hub, C.steelDark, 1.5);
      return { hub, r };
    });

    // Front post + roof + beacon.
    const frontPost = B(rig, C.steelDark, 9); frontPost.d('M70 -150 L54 -296');
    const roof = B(rig, C.steelDark, 10); roof.d('M-114 -296 L64 -296');
    const beacon = S('path', { d: 'M-80 -301 A8 8 0 0 1 -64 -301 Z' }, rig, C.accent, 2);

    // Mast, tilt cylinder, carriage, forks, load.
    const tilt = B(rig, C.steelDark, 7); tilt.d('M92 -70 L106 -100');
    S('rect', { x: 102, y: -298, width: 12, height: 284, rx: 2 }, rig, C.steel);
    S('rect', { x: 114, y: -276, width: 12, height: 262, rx: 2 }, rig, C.steel);
    for (const y of [-40, -272]) S('rect', { x: 102, y, width: 24, height: 7 }, rig, C.steelDark, 1.5);
    const carriage = el('g', {}, rig);
    S('rect', { x: 124, y: -76, width: 14, height: 72, rx: 2 }, carriage, C.steelDark);
    S('path', { d: 'M130 -70 L139 -70 L139 -9 L214 -8 L216 -3 L214 0 L130 0 Z' }, carriage, C.steelDark);
    const load = el('g', {}, carriage);
    S('rect', { x: 142, y: -21, width: 72, height: 6 }, load, C.carton, 2);
    for (const x of [142, 172, 202]) S('rect', { x, y: -15, width: 12, height: 6 }, load, C.cartonEdge, 2);
    const loadBox = S('rect', { x: 145, y: -88, width: 66, height: 67 }, load, C.carton);
    el('rect', { x: 172, y: -88, width: 12, height: 18, fill: '#DDB27C' }, load);
    if (!opts.load) Kit.show(load, false);

    // Tag + padlock hang from the steering column.
    const HOOK = [50, -166];
    const tagG = el('g', { transform: tf(HOOK[0], HOOK[1], 0, opts.tagScale || 1) }, g);
    const tag = TagOut(tagG, { stroke: opts.stroke });
    const lockG = el('g', { transform: tf(HOOK[0] - 26, HOOK[1] + 30) }, g);
    const lock = Padlock(lockG, { size: 46, stroke: opts.stroke });

    let lastDesat = -1;
    function update(p = {}) {
      L.apply(p.stroke ?? opts.stroke ?? STROKE);
      const state = p.state || 'idle', t = p.t || 0;
      const moving = state === 'driving' || state === 'speeding', fast = state === 'speeding', out = state === 'tagged-out';
      const desat = p.desat == null ? (out ? 1 : 0) : clamp(p.desat);
      if (desat !== lastDesat) { lastDesat = desat; for (const [n, a, c] of pal) set(n, { [a]: dim(c, desat) }); }
      const dist = p.dist ?? (moving ? t * Forklift.DRIVE_SPEED * (fast ? 2 : 1) : 0);
      wheels.forEach(w => set(w.hub, { transform: `rotate(${r2((dist / w.r / D) % 360)})` }));
      const shiver = state === 'idle' ? 0.6 * Math.sin(t * TAU * 9) : moving ? 0.8 * Math.sin(t * TAU * (fast ? 7 : 3.5)) : 0;
      set(rig, { transform: fast ? `translate(-110 ${r2(shiver)}) rotate(-1.6) translate(110 0)` : `translate(0 ${r2(shiver)})` });
      // Beacon: steady when idle, flashing when moving, off when tagged out.
      set(beacon, { opacity: out ? 0.35 : moving ? (Math.floor(t * 4) % 2 ? 0.4 : 1) : 1 });
      Kit.show(speedLines, fast);
      if (fast) lines.forEach((l, i) => set(l, { 'stroke-dashoffset': r2((t * 420 + i * 17) % 56) }));
      puffs.forEach((c, i) => {
        const ph = (t * 1.8 + i / 3) % 1;
        Kit.show(c, fast);
        if (fast) set(c, { cx: r2(-150 - ph * 90), cy: r2(-14 - ph * 26), r: r2(5 + ph * 9), opacity: r2(0.9 * (1 - ph)) });
      });
      const lift = num(p.lift);
      set(carriage, { transform: `translate(0 ${r2(-150 * lift)})` });
      const showLoad = (p.load ?? !!opts.load) && true;
      Kit.show(load, showLoad);
      if (showLoad) {
        set(load, { transform: fast ? `translate(214 -15) rotate(${r2(9 + 3 * Math.sin(t * TAU / 0.45))}) translate(-214 15)` : '' });
        const sw = p.stroke ?? opts.stroke ?? STROKE;
        set(loadBox, { stroke: fast ? C.error : C.ink, 'stroke-width': r2(fast ? 1.8 * sw : sw) });
      }
      if (driver) {
        const show = p.driver ?? true;
        Kit.show(driverG, show);
        if (show) {
          set(driverG, { transform: tf(SEAT[0], SEAT[1] - Worker.SEAT_Y) });
          const local = v => [v[0] - SEAT[0], v[1] - (SEAT[1] - Worker.SEAT_Y)];
          driver.update({ pose: 'sit', t, reach: local([14, -194]), reach2: local([36, -181]), stroke: p.stroke ?? opts.stroke });
        }
      }
      tag.update({ p: p.tag == null ? (out ? 1 : 0) : p.tag, t, stroke: p.stroke ?? opts.stroke });
      const pl = num(p.padlock);
      Kit.show(lockG, pl > 0);
      if (pl > 0) lock.update({ p: pl, stroke: p.stroke ?? opts.stroke });
    }
    update({});
    return { g, update, driver };
  }
  Forklift.DRIVE_SPEED = 260;
  Kit.Forklift = Forklift;

  /* Kit.Machine(parent, {stroke})
       Simple excavator (STYLE.md §6.30), 300 x 200 px, facing right, with a visible gear in a porthole on
       the engine housing. Stands beside the 'customer' Worker.
     update({state, t, speed, angle, alert, stroke})
       state  'running' (gear turns, exhaust puffs, boom bobs) | 'stopped' (gear still, boom lowered)
       t      seconds.   speed  gear speed multiplier (1 = 90 deg/s); for a smooth speed-up pass angle.
       angle  explicit gear angle in degrees (overrides t * speed).
       alert  dashed red ring around the stopped gear, the "missing part" cue (default: state 'stopped')
     Origin: bottom-centre on the floor line.
  */
  function Machine(parent, opts = {}) {
    const L = outlines();
    const g = el('g', {}, parent);
    const S = (tag, attrs, par, base) => shape(L, tag, attrs, par, base);
    Kit.shadow(g, 300);
    const puffs = [0, 1, 2].map(() => el('circle', { r: 6, fill: C.inkSoft, opacity: 0.3 }, g));
    // Boom + arm + bucket (behind the cab), pivoting at the cab front.
    const boom = el('g', {}, g);
    const boomBar = bar(L, boom, C.safety, 18); boomBar.d('M2 -104 L84 -182');
    const armBar = bar(L, boom, C.safety, 13); armBar.d('M84 -182 L128 -98');
    const cyl = bar(L, boom, C.steel, 5); cyl.d('M22 -98 L74 -160');
    for (const [x, y] of [[84, -182], [128, -98]]) S('circle', { cx: x, cy: y, r: 4, fill: C.steelDark }, boom, 2);
    const bucket = el('g', {}, boom);
    S('path', { d: 'M-8 -6 L18 -10 Q26 10 14 24 L-4 26 Q-16 12 -8 -6 Z', fill: C.steelDark }, bucket);
    for (const x of [-2, 6, 14]) S('path', { d: `M${x - 3} 25 L${x} 32 L${x + 3} 25`, fill: C.steel }, bucket, 1.5);
    // Tracks.
    S('rect', { x: -150, y: -36, width: 186, height: 36, rx: 18, fill: C.trousers }, g);
    for (const x of [-131, 17]) S('circle', { cx: x, cy: -18, r: 12, fill: C.steel }, g, 2);
    for (const x of [-101, -72, -43, -14]) S('circle', { cx: x, cy: -18, r: 8, fill: C.steel }, g, 2);
    S('rect', { x: -112, y: -46, width: 124, height: 10, fill: C.steelDark }, g, 2);
    // House, counterweight, engine housing with gear porthole, exhaust, cab.
    S('path', { d: 'M-150 -46 L-150 -86 Q-150 -98 -138 -98 L30 -98 L38 -46 Z', fill: C.safety }, g);
    S('path', { d: 'M-152 -50 L-152 -92 Q-152 -100 -144 -100 L-128 -100 L-128 -50 Z', fill: C.steelDark }, g);
    const exhaust = bar(L, g, C.steelDark, 6); exhaust.d('M-74 -150 L-74 -170');
    S('rect', { x: -136, y: -154, width: 76, height: 58, rx: 8, fill: C.safety }, g);
    S('circle', { cx: -98, cy: -125, r: 25, fill: C.steelDark }, g);
    const gear = el('g', {}, g);
    const gp = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 360;
      for (const [r, da] of [[15, 0], [21, 8], [21, 24], [15, 32]]) gp.push(rot([0, -r], a + da));
    }
    S('path', { d: 'M' + gp.map(pt).join(' L') + ' Z', fill: C.steel }, gear, 2);
    S('circle', { r: 5.5, fill: C.steelDark }, gear, 2);
    const ring = L.line(el('circle', { cx: -98, cy: -125, r: 31, fill: 'none', 'stroke-dasharray': '8 6' }, g), 4);
    set(ring, { stroke: C.error });
    S('rect', { x: -56, y: -168, width: 64, height: 72, rx: 8, fill: C.safety }, g);
    S('rect', { x: -47, y: -159, width: 44, height: 36, rx: 5, fill: C.paper }, g, 2);
    el('path', { d: 'M-39 -131 L-23 -153', stroke: C.steel, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);

    function update(p = {}) {
      L.apply(p.stroke ?? opts.stroke ?? STROKE);
      const t = p.t || 0, run = (p.state || 'running') === 'running';
      const ang = p.angle ?? (run ? t * 90 * (p.speed ?? 1) : 0);
      set(gear, { transform: tf(-98, -125, ang % 360) });
      const bob = run ? 2.5 * Math.sin(t * TAU / 1.6) : 7;
      set(boom, { transform: `rotate(${r2(bob)} 2 -104)` });
      set(bucket, { transform: tf(128, -98, run ? 8 * Math.sin(t * TAU / 1.6 + 1) : 14) });
      Kit.show(ring, p.alert ?? !run);
      puffs.forEach((c, i) => {
        Kit.show(c, run);
        if (run) { const ph = (t * 0.9 * (p.speed ?? 1) + i / 3) % 1; set(c, { cx: r2(-74 + ph * 14), cy: r2(-176 - ph * 34), r: r2(4 + ph * 8), opacity: r2(0.35 * (1 - ph)) }); }
      });
    }
    update({});
    return { g, update };
  }
  Kit.Machine = Machine;
})();
