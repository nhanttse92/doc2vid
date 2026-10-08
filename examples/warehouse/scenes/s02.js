// Scene s02: Receiving of Freight (storyboard s02b01–s02b09, STYLE.md).
//
// One long world that the camera pans across (a whole-group translate of `world`):
//   x 140..860    BoxTruck backing in from the left (floor line FLOOR)
//   x 810..1230   DockDoor
//   x 1270..1790  "Receiving" staging area with the pallet (foreground floor line FG)
//   x 1830..2290  blue "Stock orders" lane, then the rack (2340..2730), then the red
//                 "Emergency orders" lane (2770..3110)
//   x 2240..2710  analyst's desk and terminal (appear in b07, after the rack has gone)
//   x 3250..3800  shipping destinations (b07); filing drawer at 2900 (b08)
// Screen-fixed layers on top: headings, stamp, manifest, the progress timeline and the title card.
// Every time is derived from ctx.beat / ctx.cue, so the scene follows the measured narration.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const { C } = Kit;
  const EZ = Kit.ease;
  const INOUT = Engine.ease.inOut;
  const lin = (t, t0, d) => clamp((t - t0) / d);
  const ez = (t, t0, d, fn = EZ.enter) => fn(lin(t, t0, d));
  const WALK = Kit.Worker.WALK_SPEED;
  const INF = Infinity;

  const FLOOR = 780;          // truck, dock door, rack
  const FG = 856;             // characters, pallet, desk, drawer (nearer the viewer)
  const LANE_Y = 842;         // cartons waiting in the sorting lanes
  const CAM = { dock: 0, unload: 320, sort: 1280, red: 2080, office: 1680 };

  const X_T = 500, X_D = 1020, X_P = 1560;        // truck, dock door, pallet
  const WX0 = 1250, WX1 = 1790;                    // worker at the dock, worker by the pallet
  const DX0 = 330, DX1 = 520;                      // driver: out of the cab, at the rear tyre
  const RX = 2520, RY = 846, RS = 0.7;             // rack origin and scale
  const BLUE = [2200, 2050, 1900], RED = [2990, 2840];
  const A = 2240, TX = A + 50, TY = FG - 377;      // analyst hip x, terminal top-left (keyboard at hand height)
  const DRW = 2900;                                // filing drawer (top-left x)
  const SHOP = [3330, 560], CUST = 3640;           // destinations (b07)

  // Stamp-free easing for a flying carton: smooth travel with a hop.
  const hop = (u, a, b, arc) => {
    const e = INOUT(clamp(u));
    return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - arc * Math.sin(Math.PI * clamp(u))];
  };
  // Opacity of a world element visible from tIn (fade + 24 px rise) to tOut (fade + 16 px).
  const pres = (t, tIn, tOut = INF) => Kit.presence(t, tIn, tOut);

  // Worker inside a wrapper group: the wrapper carries position, opacity and the left/right flip
  // (a scale-x tween through 0 reads as the character turning round).
  function character(parent, opts) {
    const wrap = el('g', {}, parent);
    const w = Kit.Worker(wrap, { ...opts, facing: 1 });
    return { wrap, w };
  }
  // Reach blended in by k: start from the pose's own hand position so arms never jump.
  function updateReach(w, params, key, target, k) {
    if (!target || k <= 0) return w.update(params);
    const a = w.update(params);
    const nat = key === 'reach' ? a.hand : a.hand2;
    return w.update({ ...params, [key]: [lerp(nat[0], target[0], k), lerp(nat[1], target[1], k)] });
  }
  // A facing scale that turns over `d` seconds at time tf (from `a` to `b`). It never collapses
  // below 0.2 wide: it narrows, flips at the midpoint and widens again.
  const turn = (t, tf, a, b, d = 0.22) => {
    const p = INOUT(lin(t, tf, d)), v = lerp(a, b, p);
    return Math.abs(v) >= 0.2 ? v : (p < 0.5 ? Math.sign(a) : Math.sign(b)) * 0.2;
  };

  Engine.scene('s02', {
    build(ctx) {
      const B = id => ctx.beat(id);
      const cue = (id, w, n) => ctx.cue(id, w, n);
      const [b1, b2, b3, b4, b5, b6, b7, b8, b9] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => B(`s02b0${i}`));
      const T = {};

      // ---------- b01: title card, dock reveal, timeline
      T.cardIn = 0.5;
      T.wipe = b1.start + 3.2;
      T.nodes0 = Math.max(T.wipe + 1.0, cue('s02b01', 'everything downstream') - 0.1);
      T.tlIn = T.nodes0 - 0.45;

      // ---------- b02: truck, chock, stamp
      T.truck = b2.start + 0.15;
      T.truckDur = 1.7;
      T.stamp = cue('s02b02', 'no exception') + 0.05;
      T.chock = Math.max(T.truck + 3.4, cue('s02b02', 'chocked') - 0.55);
      T.click = T.chock + 0.56;
      T.drvIn = T.chock - 1.55;
      T.drvWalk = T.drvIn + 0.1;
      T.drvWalkDur = (DX1 - DX0) / WALK;
      T.kneel = T.drvWalk + T.drvWalkDur + 0.05;
      T.point = cue('s02b02', 'every delivery truck') + 0.2;
      T.pointEnd = T.click + 1.6;
      T.know = cue('s02b02', 'drivers know');
      T.everyTime = cue('s02b02', 'every time');
      T.h2 = T.click + 0.15;

      // ---------- b03: unload, count, compare, sign
      T.pan1 = b3.start;
      T.drvOut = b3.start + 0.1;
      T.wWalk1 = b3.start + 0.25;
      T.wWalk1Dur = (WX1 - WX0) / WALK;
      T.door = b3.start + 0.5;
      T.palletIn = b3.start + 0.35;
      T.h3 = b3.start + 0.5;
      T.man = b3.start + 1.0;
      T.u0 = Math.max(b3.start + 1.7, cue('s02b03', 'unloaded'));
      T.gap = clamp((cue('s02b03', 'compared') - 0.6 - T.u0) / 4, 0.8, 1.5);
      T.u = [0, 1, 2, 3, 4].map(i => T.u0 + T.gap * i);
      T.land = T.u.map(u => u + 1.0);
      T.unlock = T.land[4] + 0.35;
      T.sign = Math.max(cue('s02b03', 'before signing') + 0.2, T.unlock + 0.8);
      T.signEnd = T.sign + 1.1;

      // ---------- b04: damage, note, claim, timeliness, photos
      T.dmg = cue('s02b04', 'find damage');
      T.h4 = T.dmg + 0.5;
      T.note = cue('s02b04', 'note it on the manifest') + 0.15;
      T.claim = cue('s02b04', 'follow the carrier') + 0.15;
      T.clock = cue('s02b04', 'Timeliness');
      T.cam = cue('s02b04', 'taking photos') - 0.1;

      // ---------- b05: pan to sorting, lanes, sort, 24 h clock, rack
      T.pan2 = b5.start + 0.1;
      T.wWalk2 = b5.start + 0.15;
      T.wWalk2Dur = (WX1 - 1060) / WALK;
      T.lanes = b5.start + 1.0;
      T.chipS = Math.max(T.lanes + 0.3, cue('s02b05', 'stock orders'));
      T.chipE = Math.max(T.lanes + 0.5, cue('s02b05', 'emergency orders'));
      T.sort0 = Math.max(b5.start + 1.5, cue('s02b05', 'for sorting'));
      T.sortOrder = [4, 3, 2, 1, 0];
      T.sortDest = { 4: [RED[0], 'red'], 3: [BLUE[0], 'blue'], 2: [BLUE[1], 'blue'], 1: [RED[1], 'red'], 0: [BLUE[2], 'blue'] };
      T.sortStart = {}; T.sortDur = {};
      T.sortOrder.forEach((c, k) => {
        T.sortStart[c] = T.sort0 + 0.55 * k;
        T.sortDur[c] = 0.75 + Math.abs(T.sortDest[c][0] - X_P) / 1700;
      });
      T.sortEnd = Math.max(...T.sortOrder.map(c => T.sortStart[c] + T.sortDur[c]));
      T.clockB = Math.max(T.sortEnd - 0.6, cue('s02b05', 'different clocks'));
      T.fillB = Math.max(T.clockB + 0.5, cue('s02b05', 'Stock orders are checked'));
      T.fillBDur = Math.max(1.6, cue('s02b05', 'after receiving') - T.fillB);
      T.h5 = T.fillB;
      T.rack = cue('s02b05', 'proper locations') - 0.4;
      T.binOf = { 3: 0, 2: 1, 0: 2 };
      T.bin = {};
      [3, 2, 0].forEach((c, k) => { T.bin[c] = Math.max(T.rack + 0.5, cue('s02b05', 'within twenty')) + 0.35 * k; });

      // ---------- b06: red lane focus, 2 h clock, slips, freight charges
      T.pan3 = b6.start + 0.1;
      T.dimBlue = b6.start;
      T.clockR = b6.start + 0.9;
      T.fillR = Math.max(T.clockR + 0.4, cue('s02b06', 'two hours') - 0.3);
      T.h6 = cue('s02b06', 'within two hours');
      T.slipC = cue('s02b06', 'customers');
      T.slipS = Math.max(T.slipC + 0.35, cue('s02b06', 'shop orders'));
      T.pending = cue('s02b06', 'waiting on them');
      T.price = cue('s02b06', 'Freight charges');
      T.addCall = cue('s02b06', 'added to');

      // ---------- b07: terminal prints the slip, destinations, planes
      T.office = b7.start + 0.4;
      T.shop = Math.max(T.office + 0.3, cue('s02b07', 'to the shop'));
      T.cust = Math.max(T.shop + 0.35, cue('s02b07', 'customer destinations'));
      T.print = Math.max(T.cust + 0.6, cue('s02b07', 'packing slips') - 0.3);
      T.fly = T.print + 1.05;
      T.stick = T.fly + 0.7;
      T.air = cue('s02b07', 'Air shipments');
      T.planeDur = 2.6;

      // ---------- b08: hand-off to the analyst, on-hands tick, filing
      T.pan4 = b8.start + 0.1;
      T.wWalk3 = b8.start + 0.2;
      T.wFrom3 = 1520; T.wTo3 = 2080;
      T.wArrive = T.wWalk3 + (T.wTo3 - T.wFrom3) / WALK;
      T.swivel = T.wArrive - 0.15;
      T.hand = Math.max(T.wArrive + 0.45, cue('s02b08', 'Inventory Analyst') + 0.2);
      T.back = T.hand + 0.55;
      T.tick = Math.max(T.back + 0.6, cue('s02b08', 'updates the inventory'));
      T.h8a = b8.start + 0.5;
      T.daily = cue('s02b08', 'every day');
      T.drawer = T.daily - 0.3;
      T.open = Math.max(T.drawer + 0.6, cue('s02b08', 'incoming') - 0.45);
      T.docIn = Math.max(T.open + 0.45, cue('s02b08', 'incoming'));
      T.docOut = Math.max(T.docIn + 0.6, cue('s02b08', 'outgoing'));
      T.close = Math.max(T.docOut + 0.9, cue('s02b08', 'appropriate folders'));

      // ---------- b09: recap on the timeline
      T.rise = Math.max(T.close + 1.0, b9.start - 0.8);
      T.pulse = ['Chock', 'inspect and count', 'sign', 'sort', 'check in', 'document', 'file'].map(w => cue('s02b09', w) + 0.1);

      T.b = { b1, b2, b3, b4, b5, b6, b7, b8, b9 };
      T.camKeys = [
        [0, CAM.dock], [T.pan1, CAM.dock], [T.pan1 + 0.9, CAM.unload],
        [T.pan2, CAM.unload], [T.pan2 + 1.1, CAM.sort],
        [T.pan3, CAM.sort], [T.pan3 + 0.95, CAM.red],
        [T.pan4, CAM.red], [T.pan4 + 0.9, CAM.office],
      ];

      // =====================================================================================
      // Layers
      const root = ctx.root;
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, root);
      const dimmable = el('g', {}, root);                     // fades to 30 % in b09
      const floor = el('g', {}, dimmable);
      el('rect', { x: 0, y: FLOOR, width: 1920, height: 1080 - FLOOR, fill: C.floor }, floor);
      el('line', { x1: 0, x2: 1920, y1: FLOOR, y2: FLOOR, stroke: C.steelDark, 'stroke-width': 3 }, floor);
      const world = el('g', {}, dimmable);
      const ui = el('g', {}, dimmable);
      const headLayer = el('g', {}, root);
      const tlLayer = el('g', {}, root);
      const cardLayer = el('g', {}, root);

      // ---------- world: wall seams and floor joints (they make the camera pans readable)
      const deco = el('g', {}, world);
      let seams = '', joints = '';
      for (let x = 160; x < 4200; x += 400) seams += `M${x} 120V${FLOOR - 6}`;
      for (let x = 60; x < 4200; x += 400) joints += `M${x} 1080L${x + 520} ${FLOOR}`;
      el('path', { d: seams, stroke: C.steel, 'stroke-width': 2, opacity: 0.16 }, deco);
      el('path', { d: joints, stroke: C.steelDark, 'stroke-width': 2, opacity: 0.12 }, deco);
      el('rect', { x: -400, y: FLOOR - 34, width: 4600, height: 10, fill: C.steel, opacity: 0.14 }, deco);

      // ---------- world: floor markings
      const marks = el('g', {}, world);
      const stage = el('g', {}, marks);
      const stageRect = el('rect', { x: 1270, y: 792, width: 520, height: 84, rx: 10, fill: 'none', stroke: C.inkSoft, 'stroke-width': 3, 'stroke-dasharray': '14 10' }, stage);
      Kit.text(stage, 'Receiving', { x: 1292, y: 846, size: 26, weight: 700, fill: C.ink });
      const laneB = el('g', {}, marks), laneR = el('g', {}, marks);
      el('rect', { x: 1830, y: 794, width: 460, height: 80, rx: 10, fill: C.neutral, opacity: 0.16 }, laneB);
      el('rect', { x: 1830, y: 794, width: 460, height: 80, rx: 10, fill: 'none', stroke: C.neutral, 'stroke-width': 3 }, laneB);
      el('rect', { x: 2770, y: 794, width: 340, height: 80, rx: 10, fill: C.error, opacity: 0.13 }, laneR);
      el('rect', { x: 2770, y: 794, width: 340, height: 80, rx: 10, fill: 'none', stroke: C.error, 'stroke-width': 3 }, laneR);

      // ---------- world: dock
      const doorG = el('g', {}, world);
      const door = Kit.DockDoor(doorG, { number: 3 });
      place(doorG, { x: X_D, y: FLOOR });
      const truckG = el('g', {}, world);
      const truck = Kit.BoxTruck(truckG, { from: -1100, cargo: true });
      place(truckG, { x: X_T, y: FLOOR });

      // ---------- world: rack (bottom shelf empty for the stock cartons; labels hidden at this scale)
      const rackG = el('g', {}, world);
      const rackIn = el('g', {}, rackG);
      const rack = Kit.PalletRack(rackIn, { bays: 1, contents: ['carton', 'parts'], parts: ['bearing', 'bolt'] });
      const rackBins = {};
      for (let i = 0; i < 9; i++) rackBins[i] = { label: null };
      [0, 1, 2].forEach(i => { rackBins[i].content = 'none'; });
      rackBins[4].content = 'parts';
      rackBins[8].content = 'parts';

      // ---------- world: lane signs, clocks
      const chipSG = el('g', {}, world), chipEG = el('g', {}, world);
      const chipS = Kit.Badge(chipSG, { text: 'Stock orders', variant: 'neutral', icon: 'none', height: 44, size: 26 });
      const chipE = Kit.Badge(chipEG, { text: 'Emergency orders', variant: 'error', icon: 'none', height: 44, size: 26 });
      place(chipSG, { x: 2060, y: 640 }); place(chipEG, { x: 2940, y: 640 });
      const clockBG = el('g', {}, world), clockRG = el('g', {}, world);
      const clockB = Kit.Clock(clockBG, { size: 200, color: 'neutral', label: '24 h' });
      const clockR = Kit.Clock(clockRG, { size: 200, color: 'error', label: '2 h' });
      place(clockBG, { x: 2060, y: 400 }); place(clockRG, { x: 2940, y: 400 });

      // ---------- world: office (desk, terminal, analyst), printed slip
      const officeG = el('g', {}, world);
      const desk = el('g', {}, officeG);
      el('rect', { x: TX - 20, y: TY + 300, width: 440, height: 14, rx: 3, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, desk);
      [TX - 6, TX + 398].forEach(x => el('rect', { x, y: TY + 314, width: 12, height: FG - TY - 314, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2.5 }, desk));
      Kit.shadow(desk, 460, { x: TX + 200, y: FG });
      const termG = el('g', {}, officeG);
      const term = Kit.Terminal(termG, { rows: [['123-A', 12], ['B-07', 4], ['C-33', 9]] });
      place(termG, { x: TX, y: TY });
      const deskClipG = el('g', {}, officeG);        // the manifest after the hand-off
      const analyst = character(officeG, { variant: 'analyst', seed: 7 });

      // ---------- world: destinations (b07)
      const destG = el('g', {}, world);
      const shopG = el('g', {}, destG), shopPop = el('g', {}, shopG);
      el('circle', { r: 62, fill: C.neutral, stroke: C.ink, 'stroke-width': 2.5 }, shopPop);
      const wrench = el('g', { transform: 'rotate(-45)' }, shopPop);
      el('path', { d: 'M-7 -18 L-7 34 A7 7 0 0 0 7 34 L7 -18 Z', fill: C.paper, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, wrench);
      el('path', { d: 'M-20 -30 A21 21 0 1 0 20 -30 L9 -30 L9 -44 L-9 -44 L-9 -30 Z', fill: C.paper, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, wrench);
      const shopLblG = el('g', {}, shopPop);
      Kit.Badge(shopLblG, { text: 'Shop', variant: 'paper', icon: 'none' });
      place(shopLblG, { y: 100 });
      const custG = el('g', {}, destG);
      const machine = Kit.Machine(custG, {});
      const custLblG = el('g', {}, custG);
      Kit.Badge(custLblG, { text: 'Customer', variant: 'paper', icon: 'none' });
      place(custLblG, { y: -250 });
      const routes = [0, 1].map(() => el('path', { fill: 'none', stroke: C.inkSoft, 'stroke-width': 4, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round' }, destG));
      const routeHeads = [0, 1].map(() => el('path', { d: 'M-14 -9 L0 0 L-14 9', fill: 'none', stroke: C.inkSoft, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, destG));

      // ---------- world: drawer (b08)
      const drawerG = el('g', {}, world);
      const drawer = Kit.FolderDrawer(drawerG);

      // ---------- world: pallet and the five cartons that travel through the scene
      const palletG = el('g', {}, world);
      const pallet = Kit.Pallet(palletG, { shadow: true });
      const slots = [0, 1, 2, 3, 4].map(i => { const s = pallet.slot(i); return [X_P + s.x, FG + s.y]; });
      const cartonLayer = el('g', {}, world);
      const cartons = [0, 1, 2, 3, 4].map(() => {
        const g = el('g', {}, cartonLayer);
        return { g, c: Kit.Carton(g, { w: 104, h: 96, d: 44 }) };
      });
      // packing slip that prints, flies and sticks onto the near red carton
      const slipG = el('g', {}, world);
      const slipBody = el('g', {}, slipG);
      el('rect', { x: 0, y: 0, width: 52, height: 130, rx: 3, fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, slipBody);
      el('rect', { x: 8, y: 11, width: 30, height: 6, rx: 3, fill: C.ink, opacity: 0.6 }, slipBody);
      for (let i = 0; i < 5; i++) el('rect', { x: 8, y: 29 + i * 18, width: 22 + ((i * 7) % 14), height: 6, rx: 3, fill: C.inkSoft, opacity: 0.7 }, slipBody);
      const tape = el('rect', { x: 10, y: -8, width: 32, height: 16, rx: 2, fill: C.safety, stroke: C.ink, 'stroke-width': 2, opacity: 0.9 }, slipG);

      // ---------- world: characters
      const driver = character(world, { variant: 'driver', seed: 3 });
      const worker = character(world, { variant: 'worker', seed: 1 });

      // ---------- world: UI attached to world objects
      const counterG = el('g', {}, world);
      const counter = Kit.Counter(counterG, { from: 0, format: v => `${v}`, height: 52, size: 30 });
      place(counterG, { x: X_P + 30, y: 458 });
      const camG = el('g', {}, world);
      const camera = Kit.Camera(camG);
      const photosG = el('g', {}, world);
      const photos = Kit.Callout(photosG, { text: 'Photos help', pointer: 'right' });
      const slipsG = el('g', {}, world);
      const slipCG = el('g', {}, slipsG), slipSG = el('g', {}, slipsG);
      const slipC = Kit.PackingSlip(slipCG, { variant: 'customer' });
      const slipS = Kit.PackingSlip(slipSG, { variant: 'shop' });
      const priceG = [el('g', {}, slipsG), el('g', {}, slipsG)];
      const prices = priceG.map(g => Kit.PriceTag(g, { text: 'Freight charges' }));
      const addG = el('g', {}, world);
      const addCall = Kit.Callout(addG, { text: 'Add freight charges', pointer: 'up' });

      // ---------- screen UI
      const stampG = el('g', {}, ui);
      const stamp = Kit.Stamp(stampG, { text: 'NO EXCEPTION' });
      const manG = el('g', {}, ui);
      const manifest = Kit.Clipboard(manG, { title: 'Manifest', items: 5, noteText: 'Damage noted' });
      const signCallG = el('g', {}, ui);
      const signCall = Kit.Callout(signCallG, { text: 'Then sign', pointer: 'up' });
      const claimG = el('g', {}, ui);
      const claim = Kit.Callout(claimG, { text: "Follow carrier's\nclaim guidelines", pointer: 'down' });
      const onTimeClockG = el('g', {}, ui);
      const onTimeClock = Kit.Clock(onTimeClockG, { size: 120, color: 'correct' });
      const onTimeG = el('g', {}, ui);
      const onTime = Kit.Badge(onTimeG, { text: 'On time', variant: 'correct' });
      const planeG = [el('g', {}, ui), el('g', {}, ui)];
      const planes = [Kit.Plane(planeG[0], { carrier: 'UPS' }), Kit.Plane(planeG[1], { carrier: 'FEDEX' })];
      const airG = el('g', {}, ui);
      const air = Kit.Badge(airG, { text: 'Air: UPS, FEDEX', variant: 'neutral', icon: 'none', height: 48, size: 28 });

      const heads = {
        b2: Kit.Heading(headLayer, { text: 'Wheels chocked' }),
        b3: Kit.Heading(headLayer, { text: 'Count  •  Inspect  •  Compare' }),
        b4: Kit.Heading(headLayer, { text: 'Note damage on the manifest' }),
        b5: Kit.Heading(headLayer, { text: 'Stock orders: 24 hours' }),
        b6: Kit.Heading(headLayer, { text: 'Emergency orders: 2 hours' }),
        b7: Kit.Heading(headLayer, { text: 'Packing slip attached' }),
        b8a: Kit.Heading(headLayer, { text: 'Inventory Analyst updates on-hands' }),
        b8b: Kit.Heading(headLayer, { text: 'File paperwork daily' }),
      };
      set(heads.b3.g, { style: 'white-space: pre' });

      // ---------- progress timeline on a paper tray
      const tray = el('rect', { rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1.5 }, tlLayer);
      const tlG = el('g', {}, tlLayer);
      const timeline = Kit.ProgressTimeline(tlG, {
        width: 1400,
        nodes: [
          { label: 'Chock', icon: 'truck' }, { label: 'Inspect and count', icon: 'magnifier' }, { label: 'Sign', icon: 'pen' },
          { label: 'Sort', icon: 'sort' }, { label: 'Check in', icon: 'clock' }, { label: 'Document', icon: 'document' },
          { label: 'File', icon: 'folder' },
        ],
      });

      // ---------- title card
      const card = Kit.SectionTitleCard(cardLayer, { part: 'Part II', title: 'Receiving, Storing, Shipping', sub: '3. Receiving of Freight' });

      return {
        T, dimmable, floor, world, deco, stage, stageRect, laneB, laneR, door, truck, truckG, rackG, rackIn, rack, rackBins,
        chipSG, chipEG, chipS, chipE, clockBG, clockRG, clockB, clockR, officeG, termG, term, deskClipG, analyst,
        destG, shopG, shopPop, custG, machine, routes, routeHeads, drawerG, drawer, palletG, pallet, slots, cartons, slipG, slipBody, tape,
        driver, worker, counter, camG, camera, photosG, photos, slipCG, slipSG, slipC, slipS, priceG, prices, addG, addCall,
        stampG, stamp, manG, manifest, signCallG, signCall, claimG, claim, onTimeClockG, onTimeClock, onTimeG, onTime,
        planeG, planes, airG, air, heads, tray, tlG, timeline, card,
        deskClip: buildDeskClip(deskClipG),
      };
    },

    render(t, ctx, S) {
      const T = S.T, { b2, b3, b4, b5, b6, b7, b8, b9 } = T.b;
      const camX = Engine.keys(t, T.camKeys, EZ.enter);
      place(S.world, { x: -camX });

      // b09: everything but the timeline fades to 30 %.
      const dimP = ez(t, T.rise, 0.7, EZ.exit);
      set(S.dimmable, { opacity: 1 - 0.7 * dimP });

      // ---------------------------------------------------------------- title card
      S.card.update({ t, tIn: T.cardIn, tWipe: T.wipe });

      // ---------------------------------------------------------------- floor marks
      set(S.stageRect, { 'stroke-dashoffset': -(t * 6) % 24 });       // slow crawl: idle life on the empty dock
      // Blue side dims when focus moves to the red lane (b06) and leaves in b07; red side leaves in b08.
      const blueDim = 1 - 0.7 * ez(t, T.dimBlue, 0.6);
      const blueGone = 1 - ez(t, b7.start, 0.4, EZ.exit);
      const blueOut = 1 - ez(t, b6.start, 0.4, EZ.exit);
      const redExit = 1 - ez(t, b8.start, 0.35, EZ.exit);
      set(S.laneB, { opacity: ez(t, T.lanes, 0.5) * blueOut });
      set(S.laneR, { opacity: ez(t, T.lanes + 0.2, 0.5) * redExit });

      // ---------------------------------------------------------------- dock door and truck
      S.door.update({ open: 1, t });
      const arrive = lin(t, T.truck, T.truckDur);
      S.truck.update({ arrive, door: ez(t, T.door, 0.8, EZ.linear), chock: lin(t, T.chock, 0.9), t });
      Kit.show(S.truckG, arrive > 0);
      // "Every truck, every time": the stamp settles a small beat on the line.
      const bumpS = 1 + 0.05 * Math.sin(Math.PI * lin(t, T.everyTime, 0.35));
      S.stamp.update({ t, tIn: T.stamp, tOut: b3.start + 0.3 });
      place(S.stampG, { x: 1450, y: 174, s: bumpS });

      // ---------------------------------------------------------------- driver
      {
        const { wrap, w } = S.driver;
        const visible = t >= T.drvIn && t < T.drvOut + 1.4;
        Kit.show(wrap, visible);
        if (visible) {
          let x = DX0, dir = 1, walking = 0;
          if (t < T.drvWalk + T.drvWalkDur) {
            x = lerp(DX0, DX1, lin(t, T.drvWalk, T.drvWalkDur));
            walking = t > T.drvWalk ? 1 : 0;
          } else if (t < T.drvOut) x = DX1;
          else {
            const d = (DX1 - 120) / WALK;
            x = lerp(DX1, 120, lin(t, T.drvOut + 0.2, d));
            dir = turn(t, T.drvOut, 1, -1);
            walking = t > T.drvOut + 0.2 && t < T.drvOut + 0.2 + d ? 1 : 0;
          }
          const o = lin(t, T.drvIn, 0.25) * (1 - lin(t, T.drvOut + 0.9, 0.4));
          place(wrap, { x, y: FLOOR, s: [dir, 1], o });
          const pose = Kit.Worker.poseAt(t, [[0, 'walk'], [T.kneel, 'kneel'], [T.know - 0.25, 'stand'], [T.know + 0.15, 'thumbs-up'], [T.everyTime + 0.5, 'stand'], [T.drvOut + 0.2, 'walk']]);
          const params = { ...pose, t, walking: pose.pose === 'walk' ? walking : 0 };
          // While kneeling, the near hand pushes the chock in and rests on it.
          const pl = lin(t, T.chock, 0.9);
          const chockX = X_T + 152 - 90 * (1 - EZ.enter(clamp(pl / 0.7)));
          const target = [chockX - 24 - x, -30];
          const k = ez(t, T.kneel + 0.1, 0.35) * (1 - ez(t, T.know - 0.3, 0.25));
          updateReach(w, params, 'reach', target, pose.pose === 'kneel' || pose.from === 'kneel' ? k : 0);
        }
      }

      // ---------------------------------------------------------------- worker
      {
        const { wrap, w } = S.worker;
        let x = WX0, dir = -1, walking = 0, y = FG, o = 1;
        const d1 = T.wWalk1Dur, d2 = T.wWalk2Dur;
        if (t >= T.wWalk1 && t < T.wWalk2) {
          x = lerp(WX0, WX1, lin(t, T.wWalk1, d1));
          walking = t < T.wWalk1 + d1 ? 1 : 0;
          dir = t < T.wWalk1 + d1 ? turn(t, T.wWalk1 - 0.22, -1, 1) : turn(t, T.wWalk1 + d1, 1, -1);
        } else if (t >= T.wWalk2 && t < T.wWalk3) {
          x = lerp(WX1, 1060, lin(t, T.wWalk2, d2));
          walking = t < T.wWalk2 + d2 ? 1 : 0;
          o = 1 - lin(t, T.wWalk2 + d2 - 0.3, 0.3);
        } else if (t >= T.wWalk3) {
          const d3 = (T.wTo3 - T.wFrom3) / WALK;
          x = lerp(T.wFrom3, T.wTo3, lin(t, T.wWalk3, d3));
          walking = t < T.wWalk3 + d3 ? 1 : 0;
          dir = 1;
        }
        place(wrap, { x, y, s: [dir, 1], o });
        Kit.show(wrap, o > 0.001);
        const poseKeys = [
          [0, 'stand'], [T.point, 'point'], [T.pointEnd, 'stand'],
          [T.wWalk1, 'hold-clipboard'],
          [T.dmg + 0.15, 'inspect'], [T.note - 0.15, 'hold-clipboard'],
          [T.hand + 0.35, 'stand'],
        ];
        const pose = Kit.Worker.poseAt(t, poseKeys);
        const writing = (t > T.land[0] - 0.2 && t < T.signEnd) || (t > T.note && t < T.note + 1.4);
        const nodK = Math.sin(Math.PI * lin(t, T.know + 0.25, 0.6));
        const params = {
          ...pose, t, walking, aim: 72, writing, nod: nodK,
          lean: pose.pose === 'inspect' ? 10 * ez(t, T.dmg + 0.15, 0.4) : 0,
          prop: t < T.hand ? undefined : false,
        };
        // b08: hold the clipboard out to the analyst.
        const kOut = ez(t, T.wArrive, 0.3) * (1 - ez(t, T.hand + 0.1, 0.3));
        const a = updateReach(w, params, 'reach2', [92, -150], t > T.wWalk3 ? kOut : 0);
        S.workerAnchors = { x, y, dir, a };
      }

      // ---------------------------------------------------------------- staging: pallet and cartons
      {
        const pp = Kit.presence(t, T.palletIn, b6.start + 0.4);
        place(S.palletG, { x: X_P, y: FG + pp.dy, o: pp.o });
        Kit.show(S.palletG, pp.o > 0.001);
        S.pallet.update({ count: 0, t });
        set(S.stage, { opacity: 1 - ez(t, b6.start, 0.4, EZ.exit) });
      }
      const rackP = Kit.presence(t, T.rack, INF);
      const rackFade = (1 - 0.7 * ez(t, T.dimBlue, 0.6)) * (1 - ez(t, b7.start, 0.4, EZ.exit));
      const binPos = {};
      [0, 1, 2].forEach(i => { const b = S.rack.bin(i); binPos[i] = [RX + b.x * RS, RY + b.y * RS]; });
      const truckOut = [X_T + 312, FLOOR - 80];
      S.cartons.forEach(({ g, c }, i) => {
        let pos = null, s = 1, o = 1;
        if (t >= T.u[i]) {
          const u = lin(t, T.u[i], 1.0);
          pos = u < 1 ? hop(u, truckOut, S.slots[i], 46) : S.slots[i];
          if (u < 1) o = clamp(u / 0.12);
        }
        const ts = T.sortStart[i];
        if (pos && t >= ts) {
          const [dx, lane] = T.sortDest[i];
          const dest = [dx, LANE_Y];
          const u = lin(t, ts, T.sortDur[i]);
          pos = u < 1 ? hop(u, S.slots[i], dest, 50 + Math.abs(dx - S.slots[i][0]) * 0.035) : dest;
          if (lane === 'blue' && t >= T.bin[i]) {
            const bu = lin(t, T.bin[i], 0.9);
            const bp = binPos[T.binOf[i]];
            pos = bu < 1 ? hop(bu, dest, bp, 50) : bp;
            s = lerp(1, RS * 92 / 104, INOUT(bu));
          }
          if (lane === 'blue') o = t >= T.bin[i] ? rackFade : blueDim;
          else o = redExit;
        }
        Kit.show(g, !!pos && o > 0.001);
        if (!pos) return;
        place(g, { x: pos[0], y: pos[1], s, o });
        const damaged = i === 3 ? lin(t, T.dmg, 0.6) : 0;
        c.update({ damaged, outline: i === 3 && t >= b5.start ? null : undefined, t });
      });

      // counter above the pallet
      S.counter.update({ t, tIn: T.land[0] - 0.05, tOut: b4.start + 0.3, ticks: T.land });

      // ---------------------------------------------------------------- manifest (screen)
      {
        const p = Kit.presence(t, T.man, b5.start + 0.3);
        place(S.manG, { x: 1510, y: 230 + p.dy, o: p.o });
        Kit.show(S.manG, p.o > 0.001);
        const checks = T.land.reduce((n, l) => n + clamp((t - l - 0.05) / 0.25), 0);
        S.manifest.update({ checks, unlock: lin(t, T.unlock, 0.5), sign: lin(t, T.sign, 1.1), note: lin(t, T.note, 1.4) });
      }
      S.signCall.update({ t, tIn: T.sign - 0.45, tOut: b4.start + 0.3 });
      place(S.signCallG, { x: 1660, y: 640 });

      // ---------------------------------------------------------------- b04 extras
      S.claim.update({ t, tIn: T.claim, tOut: b5.start + 0.3 });
      place(S.claimG, { x: 1660, y: 214 });
      S.onTimeClock.update({ t, tIn: T.clock, tOut: b5.start + 0.3, state: 'on-time', tState: T.clock + 0.4, time: [9, 50] });
      place(S.onTimeClockG, { x: 1400, y: 300 });
      S.onTime.update({ t, tIn: T.clock + 0.55, tOut: b5.start + 0.3 });
      place(S.onTimeG, { x: 1400, y: 394 });
      {
        const pc = EZ.pop(lin(t, T.cam, 0.3)), oc = lin(t, T.cam, 0.12) * (1 - ez(t, b5.start, 0.3, EZ.exit));
        place(S.camG, { x: 1622, y: 452, s: Math.max(0.001, pc), o: oc });
        Kit.show(S.camG, oc > 0.001);
        S.camera.update({ flash: Math.max(Kit.Camera.flashAt(t, T.cam + 0.45), Kit.Camera.flashAt(t, T.cam + 1.25)) });
        S.photos.update({ t, tIn: T.cam + 0.3, tOut: b5.start + 0.3 });
        place(S.photosG, { x: 1568, y: 452 });
      }

      // ---------------------------------------------------------------- b05: lanes, chips, clock, rack
      S.chipS.update({ t, tIn: T.chipS });
      set(S.chipSG, { opacity: blueOut });
      Kit.show(S.chipSG, t >= T.chipS && blueOut > 0.001);
      S.chipE.update({ t, tIn: T.chipE });
      set(S.chipEG, { opacity: redExit });
      Kit.show(S.chipEG, t >= T.chipE && redExit > 0.001);
      S.clockB.update({ t, tIn: T.clockB, tOut: b6.start + 0.3, state: 'fill', tState: T.fillB, dur: T.fillBDur, label: `${Math.round(24 * lin(t, T.fillB, T.fillBDur))} h` });
      S.clockR.update({ t, tIn: T.clockR, tOut: b7.start + 0.3, state: 'fill', tState: T.fillR, dur: 0.7, label: '2 h', pulse: t >= T.fillR + 0.7 });
      {
        const o = rackP.o * rackFade;
        place(S.rackG, { x: RX, y: RY + rackP.dy, s: RS, o });
        Kit.show(S.rackG, o > 0.001);
        if (o > 0.001) S.rack.update({ state: 'stocked', bins: S.rackBins, t });
      }

      // ---------------------------------------------------------------- b06: slips and freight charges
      {
        const out = b7.start + 0.3;
        const pc = Kit.presence(t, T.slipC, out), ps = Kit.presence(t, T.slipS, out);
        place(S.slipCG, { x: 3210, y: 330 + pc.dy, o: pc.o }); Kit.show(S.slipCG, pc.o > 0.001);
        place(S.slipSG, { x: 3540, y: 330 + ps.dy, o: ps.o }); Kit.show(S.slipSG, ps.o > 0.001);
        S.slipC.update({ pending: lin(t, T.pending, 0.4) });
        S.slipS.update({ pending: lin(t, T.pending + 0.2, 0.4) });
        [[S.slipCG, pc, T.price], [S.slipSG, ps, T.price + 0.4]].forEach(([, p], i) => {
          const tg = S.priceG[i];
          const x = (i ? 3540 : 3210) + 22, y = 330 + 340 + p.dy;
          place(tg, { x, y, o: p.o });
          Kit.show(tg, t >= (i ? T.price + 0.4 : T.price) && p.o > 0.001);
          S.prices[i].update({ on: lin(t, i ? T.price + 0.4 : T.price, 0.9), t });
        });
        S.addCall.update({ t, tIn: T.addCall, tOut: out });
        place(S.addG, { x: 3505, y: 752 });
      }

      // ---------------------------------------------------------------- b07: office, print, destinations
      {
        const op = Kit.presence(t, T.office, INF);
        place(S.officeG, { y: op.dy, o: op.o });
        Kit.show(S.officeG, op.o > 0.001);
        const printing = t >= T.print - 0.3 && t < T.fly + 0.4;
        const value = Math.round(lerp(12, 17, ez(t, T.tick, 1.0, EZ.linear)));
        S.term.update({
          screen: printing ? 'print' : 'onhands', print: t < T.fly ? lin(t, T.print, 1.0) : 0, paper: 'slip',
          row: 0, value, flash: t >= T.tick + 1.0 ? 1 - lin(t, T.tick + 1.0, 0.7) : 0, t,
        });
        // analyst: seated, typing; swivels round in b08 to take the manifest
        const { wrap, w } = S.analyst;
        const dir = t < T.back ? turn(t, T.swivel, 1, -1, 0.3) : turn(t, T.back, -1, 1, 0.3);
        place(wrap, { x: A, y: FG, s: [dir, 1] });
        const typing = (t > T.office && t < T.swivel) || t > T.back + 0.3;
        const kTake = ez(t, T.hand - 0.25, 0.25) * (1 - ez(t, T.hand + 0.15, 0.3));
        updateReach(w, { pose: 'sit', t, typing }, 'reach', [70, -150], kTake);

        // printed slip: leaves the printer and sticks onto the near red carton
        const top = S.term.paperTop ? S.term.paperTop(1) : { x: 296, y: 79 };
        const from = [TX + top.x, TY + top.y];
        const to = [RED[1] - 46, LANE_Y - 84];
        const u = lin(t, T.fly, 0.7);
        const vis = t >= T.fly && t < b8.start + 0.4;
        Kit.show(S.slipG, vis);
        if (vis) {
          const pp = hop(u, from, to, 70);
          place(S.slipG, { x: pp[0], y: pp[1], s: lerp(1, 0.6, INOUT(u)), r: lerp(0, -4, u), o: redExit });
          set(S.tape, { opacity: 0.9 * lin(t, T.stick, 0.15) });
        }
      }
      {
        const out = b8.start + 0.3;
        const ps = EZ.pop(lin(t, T.shop, 0.3)), os = lin(t, T.shop, 0.12) * (1 - ez(t, out - 0.3, 0.3, EZ.exit));
        place(S.shopG, { x: SHOP[0], y: SHOP[1], o: os });
        place(S.shopPop, { s: Math.max(0.001, ps) });
        Kit.show(S.shopG, os > 0.001);
        const pc = Kit.presence(t, T.cust, out);
        place(S.custG, { x: CUST, y: FG + pc.dy, o: pc.o });
        Kit.show(S.custG, pc.o > 0.001);
        S.machine.update({ state: 'running', t, alert: false });
        // dotted routes from the emergency lane to each destination
        const paths = [
          [[3125, 720], [3200, 640], [SHOP[0] - 74, SHOP[1] + 6]],
          [[3125, 800], [3300, 800], [CUST - 160, 800]],
        ];
        paths.forEach(([a, c, b], i) => {
          const p = ez(t, (i ? T.cust : T.shop) + 0.3, 0.6);
          const o = lin(t, (i ? T.cust : T.shop) + 0.3, 0.1) * (1 - ez(t, out - 0.3, 0.3, EZ.exit));
          const q = (k, uu) => lerp(lerp(a[k], c[k], uu), lerp(c[k], b[k], uu), uu);
          let d = '';
          const n = 24;
          for (let j = 0; j <= n * p; j++) d += `${j ? 'L' : 'M'}${q(0, j / n).toFixed(1)} ${q(1, j / n).toFixed(1)}`;
          set(S.routes[i], { d: d || 'M0 0', opacity: o });
          const e = Math.max(0.001, p);
          const hx = q(0, e), hy = q(1, e), hx0 = q(0, Math.max(0, e - 0.04)), hy0 = q(1, Math.max(0, e - 0.04));
          const ang = Math.atan2(hy - hy0, hx - hx0) * 180 / Math.PI;
          set(S.routeHeads[i], { transform: `translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${ang.toFixed(1)})`, opacity: o * (p > 0.05 ? 1 : 0) });
        });
      }
      // planes and the air badge (screen)
      S.planes.forEach((pl, i) => {
        const t0 = T.air + 0.15 + 0.75 * i;
        const u = lin(t, t0, T.planeDur);
        const vis = t >= t0 && u < 1;
        Kit.show(S.planeG[i], vis);
        if (vis) {
          place(S.planeG[i], { x: lerp(-200, 2300, u), y: i ? 352 : 280 });
          pl.update({ t, tag: lin(t, t0, 0.4) });
        }
      });
      S.air.update({ t, tIn: T.air + 0.3, tOut: b8.start + 0.3 });
      place(S.airG, { x: 1580, y: 200 });

      // ---------------------------------------------------------------- b08: hand-off, drawer
      {
        // The manifest clipboard travels from the worker's hand to the desk.
        const wa = S.workerAnchors;
        const handW = [wa.x + wa.dir * (wa.a.hand2[0] + 4), wa.y + wa.a.hand2[1]];
        const deskSpot = [TX + 400, TY + 300 - 4];
        const u1 = lin(t, T.hand, 0.3), u2 = lin(t, T.back + 0.1, 0.5);
        const vis = t >= T.hand;
        Kit.show(S.deskClipG, vis);
        if (vis) {
          let p = handW;
          if (u2 > 0) p = hop(u2, [A - 70, FG - 150], deskSpot, 30);
          else p = [lerp(handW[0], A - 70, INOUT(u1)), lerp(handW[1], FG - 150, INOUT(u1))];
          place(S.deskClipG, { x: p[0], y: p[1], r: lerp(-6, 0, INOUT(u2)), o: 1 });
        }
        const dp = Kit.presence(t, T.drawer, INF);
        place(S.drawerG, { x: DRW, y: FG - 240 + dp.dy, o: dp.o });
        Kit.show(S.drawerG, dp.o > 0.001);
        const open = t < T.close ? lin(t, T.open, 0.6) : 1 - lin(t, T.close, 0.5);
        S.drawer.update({ open, docIn: lin(t, T.docIn, 0.7), docOut: lin(t, T.docOut, 0.7), badge: lin(t, T.drawer + 0.5, 0.3) });
      }

      // ---------------------------------------------------------------- headings
      const H = S.heads;
      H.b2.update({ t, tIn: T.h2, tOut: b3.start + 0.3 });
      H.b3.update({ t, tIn: T.h3, tOut: b4.start + 0.3 });
      H.b4.update({ t, tIn: T.h4, tOut: b5.start + 0.3 });
      H.b5.update({ t, tIn: T.h5, tOut: b6.start + 0.3 });
      H.b6.update({ t, tIn: T.h6, tOut: b7.start + 0.3 });
      H.b7.update({ t, tIn: T.stick + 0.15, tOut: b8.start + 0.3 });
      H.b8a.update({ t, tIn: T.h8a, tOut: T.daily });
      H.b8b.update({ t, tIn: T.daily + 0.2, tOut: T.rise + 0.4 });

      // ---------------------------------------------------------------- timeline
      {
        const up = ez(t, T.rise, 1.0);
        const s = lerp(1, 1.15, up);
        const cy = lerp(926, 520, up);
        const x0 = 960 - 700 * s;
        const breathe = Math.sin(t * Math.PI * 2 / 4) * 0.8 * up;
        place(S.tlG, { x: x0, y: cy + breathe, s });
        const pad = 60;
        const tp = Kit.presence(t, T.tlIn, INF);
        set(S.tray, {
          x: x0 - pad * s, y: cy + breathe - 40 * s + tp.dy, width: (1400 + 2 * pad) * s, height: 112 * s, opacity: tp.o,
        });
        const shows = [0, 1, 2, 3, 4, 5, 6].map(i => T.nodes0 + 0.2 * i);
        const active = [T.truck + 1.4, T.u[0], T.unlock, T.sort0, T.clockR, T.hand, T.open];
        const done = [T.click + 0.15, T.land[4] + 0.25, T.signEnd, T.sortEnd + 0.1, T.addCall + 0.3, T.tick + 1.0, T.close + 0.5];
        S.timeline.update({ t, tIn: T.tlIn, show: shows, active, done, pulse: T.pulse });
      }
    },
  });

  // The manifest clipboard as a loose object (same drawing as the Worker's held clipboard).
  function buildDeskClip(parent) {
    const g = el('g', {}, parent);
    const ink = { stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' };
    el('rect', { x: -23, y: -30, width: 46, height: 60, rx: 4, fill: C.cartonEdge, ...ink }, g);
    el('rect', { x: -18, y: -23, width: 36, height: 48, fill: C.paper, ...ink, 'stroke-width': 2 }, g);
    for (const [y, w] of [[-12, 24], [-2, 26], [8, 20], [18, 24]]) el('line', { x1: -13, x2: -13 + w, y1: y, y2: y, stroke: C.inkSoft, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    el('rect', { x: -8, y: -34, width: 16, height: 9, rx: 2, fill: C.steel, ...ink, 'stroke-width': 2 }, g);
    return g;
  }
})();
