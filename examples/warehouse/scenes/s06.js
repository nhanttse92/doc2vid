// Scene s06: Returns and Inventory Counts (storyboard s06b01 to s06b08).
// Every time below comes from ctx.beat / ctx.cue, so the scene follows the measured narration.
// Layout: floor line at y = 850 for the whole scene. b01 to b03 are separate stagings for
// Parts Returns; b04 is the Part IV title card and a calendar reveal; b05 to b08 share one set
// (rack on the left, the Worker, a desk with the Terminal, a document inset, the Parts Manager).
(() => {
  const { el, set, place, prog, clamp, lerp } = Engine;
  const C = Kit.C, E = Kit.ease;
  const FLOOR = 850;
  const INF = Infinity;
  const show = Kit.show;

  // ---------------------------------------------------------------- small helpers
  // Standard enter / exit (fade + rise in, fade + drop out) applied to a group at (x, y).
  function enter(node, t, tIn, tOut, { x = 0, y = 0, s = 1, rise = 24, fall = 16 } = {}) {
    const p = Kit.presence(t, tIn, tOut == null ? INF : tOut, { rise, fall });
    place(node, { x, y: y + p.dy, s, o: p.o });
    show(node, p.o > 0.001);
    return p.o;
  }
  // Quadratic hop from a to b, lifted by h px at the middle.
  const hop = (p, a, b, h) => [lerp(a[0], b[0], p), lerp(a[1], b[1], p) - h * 4 * p * (1 - p)];
  // Facing as an x scale: [[t0, dir], [t1, dir], ...]; each change squashes through 0 in 0.2 s (a turn).
  function facingAt(t, list) {
    let sx = list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [ts, d] = list[i], prev = list[i - 1][1];
      if (t < ts) break;
      const p = clamp((t - ts) / 0.2);
      sx = p < 0.5 ? prev * (1 - 2 * p) : d * (2 * p - 1);
      if (Math.abs(sx) < 0.05) sx = 0.05 * (p < 0.5 ? prev : d);
    }
    return sx;
  }
  const ptxt = (parent, str, o) => Kit.text(parent, str, o);
  // Small paper document glyph (hand-offs and possible-cause icons), centred on 0,0.
  function miniDoc(parent, w = 46, h = 60) {
    const g = el('g', {}, parent);
    const f = 12;
    el('path', { d: `M${-w / 2} ${-h / 2}H${w / 2 - f}L${w / 2} ${-h / 2 + f}V${h / 2}H${-w / 2}Z`, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${w / 2 - f} ${-h / 2}V${-h / 2 + f}H${w / 2}`, fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    return g;
  }

  Engine.scene('s06', {
    build(ctx) {
      const root = ctx.root;
      const B = id => ctx.beat(id);
      const cue = (id, at, nth) => ctx.cue(id, at, nth);
      const out = id => B(id).start + 0.35; // exits finish inside the first 0.4 s of beat `id`

      // ---------------------------------------------------------------- timeline
      const T = {};
      const b1 = B('s06b01'), b2 = B('s06b02'), b3 = B('s06b03'), b4 = B('s06b04');
      const b5 = B('s06b05'), b6 = B('s06b06'), b7 = B('s06b07'), b8 = B('s06b08');
      // b01: cartons placed at the counter, reviewed, flagged, sent to the Parts Manager.
      T.place = [cue('s06b01', 'Accepting'), cue('s06b01', 'important'), cue('s06b01', 'business')].map(v => v + 0.1);
      T.review = cue('s06b01', 'review the condition');
      T.flag = [cue('s06b01', 'Broken packages'), cue('s06b01', 'broken seals'), cue('s06b01', 'soiled')];
      T.toPM = cue('s06b01', 'go to the attention');
      T.pmCall = cue('s06b01', 'Parts Manager') - 0.2;
      // b02
      T.verify = b2.start + 0.35; // new content enters once the previous beat has finished exiting
      T.ticks = [cue('s06b02', 'quantity') + 0.2, cue('s06b02', 'description') + 0.2, cue('s06b02', 'condition') + 0.2];
      T.cores = cue('s06b02', 'Be cautious');
      T.lensA = cue('s06b02', 'easy to mistake') - 0.3;
      T.lensB = cue('s06b02', 'for a new part') - 0.1;
      T.policy = cue('s06b02', 'know the return policy');
      T.bookOpen = cue('s06b02', 'return policy') + 0.2;
      T.varies = cue('s06b02', 'criteria vary');
      // b03
      T.route = b3.start + 0.7;
      T.tagOff = cue('s06b03', 'tags to remove');
      T.allOf = cue('s06b03', 'all of a particular');
      T.partial = cue('s06b03', 'partial shipment');
      T.directs = cue('s06b03', 'Pull the return');
      // b04: title card, wipe, calendar
      T.card = b4.start;
      T.wipe = Math.max(b4.start + 2.9, cue('s06b04', 'scheduled') - 0.7);
      T.reveal = T.wipe + 0.45;
      T.cycle = Math.max(T.reveal + 0.3, cue('s06b04', 'cycle counts'));
      T.yearEnd = Math.max(T.cycle + 1.6, cue('s06b04', 'end of year'));
      T.policy4 = cue('s06b04', 'Refer to');
      T.supIn = cue('s06b04', 'take questions') - 0.3;
      T.supCall = cue('s06b04', 'Supervisor') - 0.6;
      // b05
      T.set = b5.start;
      T.find = cue('s06b05', 'find a part') + 0.2;
      T.fields = [cue('s06b05', 'part number'), cue('s06b05', 'description'), cue('s06b05', 'quantity')];
      T.toPM5 = cue('s06b05', 'to the Parts Manager');
      T.research = cue('s06b05', 'research') - 0.1;
      // b06
      T.before = cue('s06b06', 'Before the weekly');
      T.rows6 = [cue('s06b06', 'all stock'), cue('s06b06', 'credit returns'), cue('s06b06', 'orders to be pulled')];
      T.ticks6 = [cue('s06b06', 'and receipted') + 0.4, cue('s06b06', 'are shelved') + 0.3, cue('s06b06', 'are done') + 0.2];
      T.receive = cue('s06b06', 'Receive the count report');
      T.handoff = T.receive + 0.25;
      T.landed = T.handoff + 0.9;
      T.termIn = T.landed + 0.1;
      T.noView = cue('s06b06', 'count without viewing');
      T.cover = cue('s06b06', 'computer on-hands');
      T.writeQ = cue('s06b06', 'write the physical count');
      // b07
      T.count7 = b7.start + 0.4;
      T.issues = [cue('s06b07', 'needs improvement'), cue('s06b07', 'needs improvement') + 0.6];
      T.notes = [cue('s06b07', 'note it on'), cue('s06b07', 'note it on') + 0.5];
      T.enter = cue('s06b07', 'Then enter');
      T.lift = T.enter + 0.6;
      T.typed = T.lift + 0.6;
      T.asCounted = cue('s06b07', 'exactly as counted');
      // b08
      T.print = b8.start + 0.5;
      T.report = T.print + 1.4;
      T.amber = cue('s06b08', 'recount report');
      T.recount = cue('s06b08', 'When recounting');
      T.target = cue('s06b08', 'find the cause') - 0.2;
      T.nearby = cue('s06b08', 'Check the locations');
      T.scan = [0, 1, 2, 3].map(k => cue('s06b08', 'in and around') + 0.45 * k);
      T.causes = [cue('s06b08', 'credits'), cue('s06b08', 'stock orders'), cue('s06b08', 'not yet processed')];
      T.resolve = T.causes.map(v => v + 1.0);
      T.reportOut = T.causes[0] - 0.5;

      // ---------------------------------------------------------------- background
      el('rect', { width: 1920, height: 1080, fill: C.bgLight }, root);
      el('rect', { y: FLOOR, width: 1920, height: 1080 - FLOOR, fill: C.floor }, root);
      el('rect', { y: FLOOR - 1, width: 1920, height: 2, fill: C.steel, opacity: 0.35 }, root);

      // ================================================================ b01: returns counter
      const g1 = el('g', {}, root);
      // The counter staging is drawn at 1x coordinates and scaled up 1.25 about the floor centre.
      const ST1 = 1.25;
      const stage1 = el('g', { transform: `translate(960 ${FLOOR}) scale(${ST1}) translate(-960 ${-FLOOR})` }, g1);
      const counter = el('g', {}, stage1);
      const CX0 = 470, CX1 = 1440, CTOP = FLOOR - 142;
      el('rect', { x: CX0, y: CTOP + 14, width: CX1 - CX0, height: FLOOR - CTOP - 14, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, counter);
      el('rect', { x: CX0 + 10, y: FLOOR - 22, width: CX1 - CX0 - 20, height: 22, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2 }, counter);
      for (let x = CX0 + 240; x < CX1 - 60; x += 240) el('line', { x1: x, y1: CTOP + 24, x2: x, y2: FLOOR - 30, stroke: C.steelDark, 'stroke-width': 3, 'stroke-linecap': 'round' }, counter);
      el('rect', { x: CX0 - 14, y: CTOP, width: CX1 - CX0 + 28, height: 16, rx: 5, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, counter);

      const customer = Kit.Worker(stage1, { variant: 'customer', stroke: 2.5 / ST1 });
      const pm1 = Kit.Worker(stage1, { variant: 'manager', facing: -1, stroke: 2.5 / ST1 });
      // Three returned cartons: final spots left to right = broken package, broken seal, soiled.
      const SPOT = [660, 860, 1060], START_X = 545, SHIFT = 190;
      const PLACE_ORDER = [2, 1, 0]; // first carton placed slides furthest
      const cartons1 = SPOT.map((_, i) => {
        const wrap = el('g', {}, stage1);
        const carton = Kit.Carton(wrap, {});
        const seal = el('g', {}, wrap);
        const x = Kit.RedX(el('g', { transform: 'translate(96 -138)' }, wrap), { size: 40 });
        return { wrap, carton, seal, x };
      });
      // Seal sticker across the tape of the middle carton; its halves split when flagged.
      const sealL = el('path', { d: `M0 -19 A19 19 0 0 0 0 19 L3 11 L-3 4 L3 -4 L-3 -11 Z`, fill: C.accent, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, cartons1[1].seal);
      const sealR = el('path', { d: `M0 -19 A19 19 0 0 1 0 19 L3 11 L-3 4 L3 -4 L-3 -11 Z`, fill: C.accent, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, cartons1[1].seal);
      const lens1 = Kit.Magnifier(el('g', {}, stage1), {});
      // Heading built piece by piece as each condition is named.
      const H1 = el('g', {}, g1);
      const h1Parts = ['Broken package', '•', 'Broken seal', '•', 'Soiled'];
      const h1Gap = 22;
      let hx = 80;
      const h1Nodes = h1Parts.map(s => {
        const g = el('g', {}, H1);
        ptxt(g, s, { x: hx, y: 150, size: 48, weight: 700 });
        hx += Kit.measure(s, 48, 700) + h1Gap;
        return g;
      });
      const h1Times = [T.flag[0], T.flag[1] - 0.05, T.flag[1], T.flag[2] - 0.05, T.flag[2]];
      const call1 = Kit.Callout(el('g', {}, g1), { text: 'To the Parts Manager', pointer: 'down', at: 0.78 });

      // ================================================================ b02: verify, core vs new, policy
      const g2 = el('g', {}, root);
      const H2 = Kit.Heading(g2, { text: 'Verify quantity, description, condition' });
      const list2 = Kit.Checklist(g2, { items: ['Quantity', 'Description', 'Condition'] });
      const coreG = el('g', {}, g2);
      ptxt(coreG, 'Core or new? Look closely', { x: 950, y: 342, size: 34, weight: 700, anchor: 'middle' });
      const PART_Y = 530, PX = [745, 1045], PS = 1.6;
      const partSlots = PX.map(x => el('g', { transform: `translate(${x} ${PART_Y}) scale(${PS})` }, coreG));
      const plain = partSlots.map(sl => Kit.Part(el('g', {}, sl), { kind: 'bearing' }));
      const real = partSlots.map(sl => Kit.Part(el('g', {}, sl), { kind: 'bearing' }));
      PX.forEach(x => Kit.shadow(coreG, 150, { x, y: PART_Y + 96 }));
      const lens2G = el('g', {}, coreG);
      const lens2 = Kit.Magnifier(lens2G, {});
      const polG = el('g', {}, g2);
      ptxt(polG, 'Return policy varies', { x: 1570, y: 342, size: 34, weight: 700, anchor: 'middle' });
      const book2G = el('g', {}, polG);
      const book2 = Kit.PolicyBook(book2G, { title: 'RETURNS' });
      const variesG = el('g', {}, polG);
      ptxt(variesG, 'Varies by vendor and part type', { x: 1570, y: 730, size: 30, weight: 600, fill: C.inkSoft, anchor: 'middle' });

      // ================================================================ b03: vendor returns
      const g3 = el('g', {}, root);
      const H3 = Kit.Heading(g3, { text: 'Vendor returns: like filling an order' });
      const S3 = Kit.Heading(g3, { text: 'Pull as the Parts Manager directs', size: 34, weight: 500, color: C.inkSoft, y: 205 });
      const mapG = el('g', {}, g3);
      const map3 = Kit.WarehouseMap(mapG, {});
      // At half scale the map's own labels fall far below the 22 px minimum; the route carries the idea.
      mapG.querySelectorAll('text').forEach(n => set(n, { display: 'none' }));
      const tagPartG = el('g', {}, g3);
      Kit.shadow(tagPartG, 120, { x: 0, y: 70 });
      const tagPart = Kit.Part(el('g', { transform: 'scale(1.3)' }, tagPartG), { kind: 'bearing' });
      const tag3 = Kit.Tag(el('g', { transform: 'translate(40 -46)' }, tagPartG), { lines: ['Vendor tag'] });
      const divider = el('line', { x1: 800, y1: 250, x2: 800, y2: FLOOR - 20, stroke: C.steel, 'stroke-width': 2, 'stroke-dasharray': '10 10', opacity: 0.7 }, g3);
      const CART_X = [1040, 1420], CS3 = 1.3;
      const box3 = CART_X.map((x, k) => {
        const g = el('g', {}, g3);
        const c = Kit.Carton(g, { label: k === 0 ? '123-A' : 'Partial', shadow: true });
        // Parts inside the open box, peeking over the rim: a full stack vs a few.
        const spots = k === 0
          ? [[-34, -124], [6, -124], [46, -124], [-20, -156], [22, -156], [62, -150], [2, -186]]
          : [[-18, -142], [26, -138]];
        const parts = spots.map(([px, py]) => Kit.Part(el('g', { transform: `translate(${px} ${py}) scale(0.42)` }, c.inside), { kind: 'bearing' }));
        return { g, c, parts };
      });
      const lineG = el('g', {}, g3);
      const midX = (CART_X[0] + CART_X[1]) / 2 + 30;
      const pieceA = el('g', {}, lineG), dot3 = el('g', {}, lineG), pieceB = el('g', {}, lineG);
      ptxt(pieceA, 'All of a part number', { x: midX - 26, y: 520, size: 34, weight: 700, anchor: 'end' });
      ptxt(dot3, '•', { x: midX, y: 520, size: 34, weight: 700, anchor: 'middle' });
      ptxt(pieceB, 'Partial shipment', { x: midX + 26, y: 520, size: 34, weight: 700, anchor: 'start' });
      const pm3 = Kit.Worker(g3, { variant: 'manager', facing: -1 });
      const call3 = Kit.Callout(el('g', {}, g3), { text: 'As directed', pointer: 'down', at: 0.6 });

      // ================================================================ b04: calendar, policy, supervisor
      const g4 = el('g', {}, root);
      const H4 = el('g', {}, g4);
      const h4a = el('g', {}, H4), h4dot = el('g', {}, H4), h4b = el('g', {}, H4);
      const wA = Kit.measure('Weekly cycle counts', 48, 700);
      ptxt(h4a, 'Weekly cycle counts', { x: 80, y: 150, size: 48, weight: 700 });
      ptxt(h4dot, '•', { x: 80 + wA + 22, y: 150, size: 48, weight: 700 });
      ptxt(h4b, 'Year end physical count', { x: 80 + wA + 22 + Kit.measure('•', 48, 700) + 22, y: 150, size: 48, weight: 700 });
      const calG = el('g', {}, g4);
      const cal = Kit.Calendar(calG, {});
      const book4G = el('g', {}, g4);
      const book4 = Kit.PolicyBook(el('g', {}, book4G), { title: 'POLICY' });
      const book4Label = el('g', {}, g4);
      ptxt(book4Label, 'Inventory Count policy', { x: 1010, y: 720, size: 34, weight: 600, anchor: 'middle' });
      const sup = Kit.Worker(g4, { variant: 'supervisor' });
      const call4 = Kit.Callout(el('g', {}, g4), { text: 'Questions?', pointer: 'down', at: 0.4 });

      // ================================================================ b05 to b08: the count set
      const set5 = el('g', {}, root);
      const RACK_X = 440;
      const rackG = el('g', {}, set5);
      const rack = Kit.PalletRack(rackG, { contents: ['carton'] });
      const floorBoxG = el('g', {}, set5);
      const floorBox = Kit.Carton(el('g', { transform: 'scale(0.8)' }, floorBoxG), { shadow: true });
      const strayG = el('g', {}, set5);
      const stray = Kit.Part(el('g', { transform: 'scale(0.62)' }, strayG), { kind: 'sealring' });
      // Bin highlight frames for the recount (target bin 4 and its neighbours 3, 5, 7, 1).
      const binRect = i => {
        const b = rack.bin(i), shelf = Math.floor((i % 9) / 3);
        const top = shelf === 2 ? -545 : -[235, 410][shelf] + 40;
        return { x: RACK_X + b.x - 76, y: FLOOR + top + 4, w: 152, h: (FLOOR + b.y) - (FLOOR + top + 4) - 2 };
      };
      const hiG = el('g', {}, set5);
      const NB = [3, 5, 7, 1];
      const mkHi = (i, dash) => {
        const r = binRect(i);
        return el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: 'none', stroke: C.accent, 'stroke-width': 5, 'stroke-dasharray': dash || null }, hiG);
      };
      const targetFill = (() => { const r = binRect(4); return el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: C.accent, opacity: 0.22 }, hiG); })();
      const targetHi = mkHi(4);
      const nbHi = NB.map(i => mkHi(i, '12 8'));
      const scanHi = el('rect', { rx: 10, fill: C.accent, opacity: 0.3, stroke: C.accent, 'stroke-width': 5 }, hiG);

      // Desk and Terminal (enter in b06).
      const TX = 930, TY = 440, DESK_TOP = TY + 300;
      const deskG = el('g', {}, set5);
      el('rect', { x: TX - 22, y: DESK_TOP, width: 404, height: 16, rx: 4, fill: C.steel, stroke: C.ink, 'stroke-width': 2.5 }, deskG);
      el('rect', { x: TX - 6, y: DESK_TOP + 16, width: 14, height: FLOOR - DESK_TOP - 16, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2.5 }, deskG);
      el('rect', { x: TX + 352, y: DESK_TOP + 16, width: 14, height: FLOOR - DESK_TOP - 16, fill: C.steelDark, stroke: C.ink, 'stroke-width': 2.5 }, deskG);
      const termG = el('g', {}, deskG);
      const term = Kit.Terminal(termG, {});
      const termCheck = Kit.GreenCheck(el('g', {}, set5), { size: 44 });

      const worker = Kit.Worker(set5, { variant: 'worker' });
      const pm5 = Kit.Worker(set5, { variant: 'manager', facing: -1 });

      // Document inset (top right of the set).
      const DOC = { x: 1380, y: 270 }, DOC5 = { x: 1080, y: 290 };
      const sheet5G = el('g', {}, set5);
      const sheet5 = Kit.CountSheet(sheet5G, { rows: [['123-A', 'Bearing', '6'], ['B-07', 'Bolt', '10'], ['C-33', 'Seal', '1']] });
      const sheet6G = el('g', {}, set5);
      const sheet6 = Kit.CountSheet(sheet6G, { rows: [['123-A', 'Bearing', '6'], ['B-07', 'Bolt', '10'], ['', '', '']] });
      const qtyRing = el('ellipse', { rx: 26, ry: 22, fill: 'none', stroke: C.accent, 'stroke-width': 4 }, sheet6G);
      const reportG = el('g', {}, set5);
      const report = Kit.RecountReport(reportG, {});

      // Flying pieces: count report hand-off, note icons.
      const handDoc = miniDoc(set5, 40, 52);
      for (let k = 0; k < 3; k++) el('line', { x1: -12, x2: 12, y1: -10 + k * 9, y2: -10 + k * 9, stroke: C.steel, 'stroke-width': 3, 'stroke-linecap': 'round' }, handDoc);
      const noteFly = [0, 1].map(() => {
        const ng = el('g', {}, set5);
        el('path', { d: 'M-19 -19 H11 L19 -11 V19 H-19 Z', fill: C.accent, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, ng);
        el('path', { d: 'M11 -19 V-11 H19', fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, ng);
        el('path', { d: 'M-11 -4 H9 M-11 5 H4', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, ng);
        return ng;
      });

      // Possible causes for a recount (b08): three documents with a question that resolves to a check.
      const causesG = el('g', {}, set5);
      const CAUSE = [
        { label: 'Credits', x: 1045, glyph: 'credit' },
        { label: 'Stock orders', x: 1318, glyph: 'truck' },
        { label: 'Unprocessed orders', x: 1655, glyph: 'clock' },
      ];
      const causes = CAUSE.map(c => {
        const g = el('g', {}, causesG);
        const icon = el('g', {}, g);
        miniDoc(icon, 74, 94);
        if (c.glyph === 'credit') {
          // Return arrow: the credit for a returned part.
          el('path', { d: 'M12 8 A14 14 0 1 0 -6 13', fill: 'none', stroke: C.neutral, 'stroke-width': 5, 'stroke-linecap': 'round' }, icon);
          el('path', { d: 'M-14 6 L-6 14 L-15 19', fill: 'none', stroke: C.neutral, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, icon);
        } else {
          Kit.Icon(el('g', { transform: 'translate(-2 6)' }, icon), { name: c.glyph, size: 40, color: C.neutral });
        }
        const q = el('g', { transform: 'translate(40 -44)' }, g);
        const qPop = el('g', {}, q);
        el('circle', { r: 20, fill: C.accent, stroke: C.ink, 'stroke-width': 2.5 }, qPop);
        ptxt(qPop, '?', { x: 0, y: 9, size: 26, weight: 800, anchor: 'middle' });
        const chk = Kit.GreenCheck(el('g', { transform: 'translate(40 -44)' }, g), { size: 40 });
        const lab = el('g', {}, g);
        ptxt(lab, c.label, { x: 0, y: 100, size: 30, weight: 700, anchor: 'middle' });
        return { g, icon, qPop, chk, lab, x: c.x };
      });
      const causeDots = [0, 1].map(k => {
        const g = el('g', {}, causesG);
        const xa = CAUSE[k].x + Kit.measure(CAUSE[k].label, 30, 700) / 2;
        const xb = CAUSE[k + 1].x - Kit.measure(CAUSE[k + 1].label, 30, 700) / 2;
        ptxt(g, '•', { x: (xa + xb) / 2, y: 395, size: 30, weight: 700, anchor: 'middle' });
        return g;
      });

      // Callout on the stray part, Research badge.
      const call5 = Kit.Callout(el('g', {}, set5), { text: '?', pointer: 'down' });
      const researchG = el('g', {}, set5);
      const research = Kit.Magnifier(el('g', {}, researchG), { label: 'Research' });

      // Headings for the count set.
      const hset = el('g', {}, root);
      const H5 = Kit.Heading(hset, { text: 'Found part: note P/N, description, qty' });
      const S5 = Kit.Heading(hset, { text: 'To the Parts Manager for research', size: 34, weight: 500, color: C.inkSoft, y: 205 });
      const H6a = Kit.Heading(hset, { text: 'Before counting: stock put away, credits shelved, orders pulled' });
      const H6b = Kit.Heading(hset, { text: 'Count without viewing on-hands' });
      const H7a = Kit.Heading(hset, { text: 'Note warehousing issues nearby' });
      const H7b = Kit.Heading(hset, { text: 'Enter counts as counted' });
      const H8 = Kit.Heading(hset, { text: 'Recount: find the cause' });
      const S8 = Kit.Heading(hset, { text: 'Check nearby locations', size: 34, weight: 500, color: C.inkSoft, y: 205 });
      const list6G = el('g', {}, root);
      const list6 = Kit.Checklist(list6G, { title: 'Before you count', items: ['Stock put away and receipted', 'Credit returns on the shelf', 'Orders pulled'] });

      // ---------------------------------------------------------------- lower thirds and title card
      const lt1 = Kit.LowerThird(root, { texts: ['11. Parts Returns'] });
      const lt2 = Kit.LowerThird(root, { texts: ['12. Inventory Counts', 'Attachment 1: Cycle Count Guidelines'] });
      // Kit.measure sizes the chip without the tabular-nums style the label renders with, so labels
      // with digits overflow the chip's right padding; proportional digits make them match.
      [lt1, lt2].forEach(lt => lt.g.querySelectorAll('text').forEach(n => set(n, { style: 'font-variant-numeric: normal' })));
      const cardG = el('g', {}, root);
      const card = Kit.SectionTitleCard(cardG, { part: 'Part IV', title: 'Inventory Counts', sub: '12. Inventory Counts' });

      return {
        T, b1, b2, b3, b4, b5, b6, b7, b8, out,
        g1, ST1, customer, pm1, cartons1, SPOT, START_X, SHIFT, PLACE_ORDER, sealL, sealR, lens1, h1Nodes, h1Times, call1, CTOP,
        g2, H2, list2, coreG, PX, PART_Y, PS, plain, real, lens2G, lens2, polG, book2G, book2, variesG,
        g3, H3, S3, mapG, map3, tagPartG, tagPart, tag3, divider, box3, CART_X, CS3, lineG, pieceA, dot3, pieceB, pm3, call3,
        g4, h4a, h4dot, h4b, calG, cal, book4G, book4, book4Label, sup, call4,
        set5, RACK_X, rackG, rack, floorBoxG, floorBox, strayG, stray, targetFill, targetHi, nbHi, NB, scanHi, binRect,
        TX, TY, deskG, termG, term, termCheck, worker, pm5, DOC, DOC5, sheet5G, sheet5, sheet6G, sheet6, qtyRing, reportG, report,
        handDoc, noteFly, causesG, causes, causeDots, call5, researchG, research,
        H5, S5, H6a, H6b, H7a, H7b, H8, S8, list6G, list6, lt1, lt2, cardG, card,
      };
    },

    render(t, ctx, S) {
      const { T } = S;

      // ================================================================ lower thirds and title card
      S.lt1.update({ t, tIn: S.b1.start, tOut: T.card + 0.45 });
      S.lt2.update({ t, tIn: T.reveal + 0.3, times: [T.reveal + 0.3, S.b6.start + 0.2] });
      const cardOn = t >= T.card - 0.01 && t < T.wipe + 0.7;
      show(S.cardG, cardOn);
      if (cardOn) {
        place(S.cardG, { o: prog(t, T.card, 0.4, E.enter) });
        S.card.update({ t, tIn: T.card + 0.15, tWipe: T.wipe });
      }

      renderB1(t, S);
      renderB2(t, S);
      renderB3(t, S);
      renderB4(t, S);
      renderSet(t, S);
    },
  });

  // ==================================================================== b01
  function renderB1(t, S) {
    const { T } = S;
    const tOut = S.out('s06b02');
    const on = t < tOut + 0.05;
    show(S.g1, on);
    if (!on) return;
    const o = 1 - prog(t, tOut - 0.3, 0.3, E.exit);
    place(S.g1, { y: 16 * (1 - o), o });

    // Customer: steps the near hand onto the counter top each time a carton is set down.
    let reachK = 0;
    T.place.forEach(tp => { reachK = Math.max(reachK, prog(t, tp - 0.35, 0.3, E.enter) * (1 - prog(t, tp + 0.45, 0.3, E.exit))); });
    place(S.customer.g, { x: 395, y: 850 });
    S.customer.update({ pose: 'stand', t, reach: [lerp(-6, 74, reachK), lerp(-99, -146, reachK)] });

    // Parts Manager: nods as the flagged cartons arrive.
    const nod = Math.sin(Math.PI * clamp((t - (T.toPM + 0.7)) / 0.6));
    place(S.pm1.g, { x: 1600, y: 850 });
    S.pm1.update({ pose: 'stand', t, facing: -1, nod: Math.max(0, nod) * 0.8 });

    // Cartons: set down at the left, slide to their spot, flagged, then shifted toward the manager.
    S.cartons1.forEach((c, i) => {
      const k = S.PLACE_ORDER.indexOf(i), tp = T.place[k];
      const pIn = Kit.presence(t, tp - 0.3, INF, { rise: 14 });
      const slide = prog(t, tp + 0.05, 0.8, E.enter);
      const shift = prog(t, T.toPM + 0.12 * (2 - i), 0.8, E.enter);
      const x = lerp(S.START_X, S.SPOT[i], slide) + S.SHIFT * shift;
      place(c.wrap, { x, y: S.CTOP + pIn.dy, o: pIn.o });
      show(c.wrap, pIn.o > 0.001);
      const tf = T.flag[i], fl = t >= tf;
      const params = { t, outline: fl ? 'error' : null };
      if (i === 0) Object.assign(params, { damaged: prog(t, tf, 0.35, E.enter), open: 0.18 * prog(t, tf + 0.1, 0.35, E.enter) });
      if (i === 1) params.tape = 1;
      if (i === 2) params.scuff = prog(t, tf, 0.35, E.enter);
      c.carton.update(params);
      c.x.update({ t, tIn: tf + 0.1 });
      if (i === 1) {
        const b = prog(t, tf, 0.3, E.enter);
        place(c.seal, { x: 0, y: -66 });
        set(S.sealL, { transform: `translate(${(-6 * b).toFixed(2)} ${(3 * b).toFixed(2)}) rotate(${(-10 * b).toFixed(2)})` });
        set(S.sealR, { transform: `translate(${(6 * b).toFixed(2)} ${(-2 * b).toFixed(2)}) rotate(${(12 * b).toFixed(2)})` });
      }
    });

    // Magnifier sweeps the three cartons while the narration says "review the condition".
    const lp = prog(t, T.review, 1.6, E.linear);
    const lo = Math.min(prog(t, T.review - 0.2, 0.25), 1 - prog(t, T.review + 1.55, 0.3));
    show(S.lens1.g.parentNode, lo > 0.001);
    place(S.lens1.g.parentNode, { x: lerp(S.SPOT[0] + 20, S.SPOT[2] + 40, E.enter(lp)), y: S.CTOP - 58 + 6 * Math.sin(lp * Math.PI * 3), s: 1.5, o: lo });
    S.lens1.update({ glint: (lp * 3) % 1, tilt: -8 + 10 * Math.sin(lp * Math.PI * 2) });

    // Heading words land with the narration.
    S.h1Nodes.forEach((g, i) => enter(g, t, S.h1Times[i], tOut, { rise: 12 }));
    place(S.call1.g, { x: 960 + (1600 - 4 - 960) * S.ST1, y: 850 - 272 * S.ST1 });
    S.call1.update({ t, tIn: T.pmCall, tOut });
  }

  // ==================================================================== b02
  function renderB2(t, S) {
    const { T } = S;
    const t0 = S.b2.start, tOut = S.out('s06b03');
    const on = t > t0 - 0.05 && t < tOut + 0.05;
    show(S.g2, on);
    if (!on) return;
    S.H2.update({ t, tIn: T.verify, tOut });
    place(S.list2.g, { x: 80, y: 390 });
    S.list2.update({ t, tIn: T.verify + 0.15, tOut, ticks: T.ticks });

    // Core vs new: two plain bearings; under the lens each shows its true state and its tag swings in.
    enter(S.coreG, t, T.cores - 0.2, tOut);
    const passes = [T.lensA, T.lensB];
    S.real.forEach((p, i) => {
      const r = prog(t, passes[i], 0.35, E.enter);
      set(p.g, { opacity: r.toFixed(3) });
      show(p.g, r > 0.001);
      p.update({ state: i === 0 ? 'new' : 'core', tag: i === 0 ? 'new' : 'core', tagOn: prog(t, passes[i] + 0.1, 0.9, E.linear), t });
      set(S.plain[i].g, { opacity: (1 - r).toFixed(3) });
      show(S.plain[i].g, r < 0.999);
      S.plain[i].update({ state: null, tag: false, t });
    });
    // The lens glides in from the left, pauses over each part, then parks below them.
    const L = [[S.PX[0] - 130, S.PART_Y + 60], [S.PX[0] + 22, S.PART_Y + 22], [S.PX[1] + 22, S.PART_Y + 22], [S.PX[1] + 90, S.PART_Y + 120]];
    const k = Engine.keys;
    const lx = k(t, [[T.cores, L[0][0]], [T.lensA, L[1][0]], [T.lensA + 0.5, L[1][0]], [T.lensB, L[2][0]], [T.lensB + 0.6, L[2][0]], [T.lensB + 1.3, L[3][0]]], E.enter);
    const ly = k(t, [[T.cores, L[0][1]], [T.lensA, L[1][1]], [T.lensA + 0.5, L[1][1]], [T.lensB, L[2][1]], [T.lensB + 0.6, L[2][1]], [T.lensB + 1.3, L[3][1]]], E.enter);
    const lo = Math.min(prog(t, T.cores, 0.3), 1 - prog(t, T.lensB + 1.0, 0.4, E.exit));
    place(S.lens2G, { x: lx, y: ly, s: 2.1, o: lo });
    show(S.lens2G, lo > 0.001);
    S.lens2.update({ glint: ((t - T.cores) / 1.4) % 1, tilt: 4 * Math.sin(t * 1.3) });

    // Return policy book opens; the variation line appears with "criteria vary".
    enter(S.polG, t, T.policy - 0.3, tOut);
    place(S.book2G, { x: 1570, y: 530, s: 1.1 });
    S.book2.update({ open: prog(t, T.bookOpen, 0.6, E.enter) });
    enter(S.variesG, t, T.varies, tOut, { rise: 12 });
  }

  // ==================================================================== b03
  function renderB3(t, S) {
    const { T } = S;
    const t0 = S.b3.start, tOut = S.out('s06b04');
    const on = t > t0 - 0.05 && t < tOut + 0.05;
    show(S.g3, on);
    if (!on) return;
    S.H3.update({ t, tIn: t0 + 0.35, tOut });
    S.S3.update({ t, tIn: T.directs, tOut });
    // Left: the order-filling map from s05, its route redrawing.
    enter(S.mapG, t, t0 + 0.4, tOut, { x: 80, y: 250, s: 0.5 });
    S.map3.update({ draw: 1, rows: 6, zones: 1, route: prog(t, T.route, 2.2, E.linear) });
    // A vendor tag comes off the part.
    enter(S.tagPartG, t, t0 + 0.5, tOut, { x: 290, y: 720 });
    S.tagPart.update({ t });
    S.tag3.update({ t, remove: prog(t, T.tagOff, 0.9, E.linear) });
    set(S.divider, { opacity: (0.7 * Kit.presence(t, t0 + 0.4, tOut).o).toFixed(3) });
    // Right: two return cartons, highlighted as the manager points to each.
    S.box3.forEach((b, k) => {
      enter(b.g, t, t0 + 0.55 + 0.12 * k, tOut, { x: S.CART_X[k], y: 850, s: S.CS3 });
      const tp = k === 0 ? T.allOf : T.partial;
      const lit = t >= tp && t < (k === 0 ? T.partial : T.directs + 1.4);
      b.c.update({ open: 1, outline: lit ? 'accent' : null, t });
      b.parts.forEach(p => p.update({ t }));
    });
    enter(S.pieceA, t, T.allOf, tOut, { rise: 12 });
    enter(S.dot3, t, T.partial - 0.1, tOut, { rise: 12 });
    enter(S.pieceB, t, T.partial, tOut, { rise: 12 });
    // Parts Manager directs: points at each carton in turn.
    const PMX = 1715;
    enter(S.pm3.g, t, t0 + 0.7, tOut, { x: PMX, y: 850 });
    const pose = Kit.Worker.poseAt(t, [[0, 'stand'], [T.allOf - 0.2, 'point'], [T.directs + 1.6, 'stand']]);
    const aim = lerp(84, 70, prog(t, T.partial - 0.3, 0.5, E.enter));
    S.pm3.update({ ...pose, t, facing: -1, aim });
    place(S.call3.g, { x: PMX - 6, y: 850 - 276 });
    S.call3.update({ t, tIn: T.directs + 0.2, tOut });
  }

  // ==================================================================== b04
  function renderB4(t, S) {
    const { T } = S;
    const tOut = S.out('s06b05');
    const on = t > T.wipe - 0.7 && t < tOut + 0.05;
    show(S.g4, on);
    if (!on) return;
    enter(S.h4a, t, T.cycle, tOut, { rise: 12 });
    enter(S.h4dot, t, T.yearEnd - 0.1, tOut, { rise: 12 });
    enter(S.h4b, t, T.yearEnd, tOut, { rise: 12 });
    place(S.calG, { x: 150, y: 270, s: 1.2 });
    const marks = [0, 1, 2, 3, 4].map(i => T.cycle + 0.2 + 0.25 * i);
    // Calendar and book are already in place under the card, so the wipe reveals them.
    S.cal.update({ t, tIn: T.wipe - 0.6, tOut, markers: marks, tYearEnd: T.yearEnd + 0.2, period: 0.6 });
    enter(S.book4G, t, T.wipe - 0.6, tOut, { x: 1010, y: 520, s: 1.1 });
    S.book4.update({ open: prog(t, T.policy4 + 0.3, 0.6, E.enter) });
    enter(S.book4Label, t, T.policy4, tOut, { rise: 12 });
    // Supervisor walks in from the right and offers to take questions.
    const SX = 1500, from = 2010, dur = (from - SX) / Kit.Worker.WALK_SPEED;
    const wp = clamp((t - T.supIn) / dur);
    const x = lerp(from, SX, wp);
    const walking = wp > 0 && wp < 1 ? 1 : 0;
    const so = 1 - prog(t, tOut - 0.3, 0.3, E.exit);
    place(S.sup.g, { x, y: 850 + 16 * (1 - so), o: so });
    show(S.sup.g, t > T.supIn && so > 0.001);
    S.sup.update({ pose: walking ? 'walk' : 'stand', t, facing: -1, walking });
    place(S.call4.g, { x: SX - 6, y: 850 - 278 });
    S.call4.update({ t, tIn: Math.max(T.supCall, T.supIn + dur + 0.2), tOut });
  }

  // ==================================================================== b05 to b08: the count set
  function renderSet(t, S) {
    const { T } = S;
    const t5 = S.b5.start;
    const on = t > t5 - 0.05;
    show(S.set5, on);
    show(S.list6G, on);
    if (!on) {
      [S.H5, S.S5, S.H6a, S.H6b, S.H7a, S.H7b, S.H8, S.S8].forEach(h => h.update({ t, tIn: INF }));
      return;
    }
    const o6 = S.out('s06b06'), o7 = S.out('s06b07'), o8 = S.out('s06b08');

    // Rack, floor carton (an issue noted in b07), stray part (found in b05).
    enter(S.rackG, t, t5 + 0.35, null, { x: S.RACK_X, y: 850 });
    const issue = i => (t >= T.issues[i] && t < o8 ? (t - T.issues[i] < 0.5 ? (Math.floor((t - T.issues[i]) / 0.1) % 2 === 0 ? 'error' : null) : 'error') : null);
    const bins = { 0: { content: 'none' }, 2: { content: 'none' }, 6: { labelState: 'worn', labelOutline: issue(0) } };
    S.rack.update({ state: 'stocked', bins, t });
    enter(S.floorBoxG, t, t5 + 0.4, null, { x: S.RACK_X - 310, y: 850 });
    S.floorBox.update({ t, outline: issue(1) });
    const strayX = S.RACK_X + 200, strayY = 850 - 60 - 24;
    enter(S.strayG, t, t5 + 0.45, o6, { x: strayX, y: strayY });
    S.stray.update({ t, outline: t >= T.find && t < o6 ? 'accent' : null });
    place(S.call5.g, { x: strayX, y: strayY - 30 });
    S.call5.update({ t, tIn: T.find, tOut: o6 });

    // Recount highlights (b08): the target bin, then a scan through left, right, above, below.
    const hiOut = INF;
    const pT = prog(t, T.target, 0.35, E.enter);
    set(S.targetHi, { opacity: pT.toFixed(3) }); show(S.targetHi, pT > 0.001 && t < hiOut);
    set(S.targetFill, { opacity: (0.22 * pT).toFixed(3) }); show(S.targetFill, pT > 0.001);
    S.nbHi.forEach((r, k) => { const p = prog(t, T.scan[k] + 0.25, 0.3); set(r, { opacity: (0.85 * p).toFixed(3) }); show(r, p > 0.001); });
    let scanOn = false;
    const flashes = [[T.count7 + 1.8, 5, 0.6], [T.count7 + 3.0, 8, 0.6], ...T.scan.map((a, k) => [a, S.NB[k], 0.45])];
    flashes.forEach(([a, bin, d]) => {
      if (t >= a && t < a + d) {
        const r = S.binRect(bin), o = Math.sin(Math.PI * (t - a) / d);
        set(S.scanHi, { x: r.x, y: r.y, width: r.w, height: r.h, opacity: (0.35 * o).toFixed(3) });
        scanOn = true;
      }
    });
    show(S.scanHi, scanOn);

    // Desk + Terminal enter in b06 once the count report is in hand.
    enter(S.deskG, t, T.termIn, null);
    let screen = 'onhands', cover = 0, typed = 1, value, flash = 0, print = 0, paper = 'report';
    if (t >= T.cover) { screen = 'covered'; cover = prog(t, T.cover + 0.1, 0.6, E.enter); }
    if (t >= T.lift) { cover = 1 - prog(t, T.lift, 0.5, E.enter); screen = cover > 0.001 ? 'covered' : 'onhands'; typed = prog(t, T.typed, 0.8, E.linear); value = 6; }
    if (t >= T.typed + 0.8) flash = 1 - prog(t, T.typed + 0.85, 0.6, E.linear);
    if (t >= T.print) { screen = 'print'; print = prog(t, T.print, 1.2, E.enter); typed = 1; value = 6; }
    if (t >= T.report) { screen = 'report'; print = 0; }
    place(S.termG, { x: S.TX, y: S.TY });
    S.term.update({ screen, cover, typed, value, flash: clamp(flash), print, paper, t });
    place(S.termCheck.g, { x: S.TX + 300, y: S.TY + 30 });
    S.termCheck.update({ t, tIn: T.asCounted, tOut: o8 });

    // Worker: kneels at the bin (b05), stands, takes the count report, counts, types, recounts.
    const COUNT_X = 790, KNEEL_X = 745, TYPE_X = 862;
    const xKeys = [[0, KNEEL_X], [o6, KNEEL_X], [o6 + 0.3, COUNT_X], [T.enter + 0.2, COUNT_X], [T.enter + 0.6, TYPE_X], [T.recount + 0.2, TYPE_X], [T.recount + 0.6, COUNT_X]];
    const wx = Engine.keys(t, xKeys, E.linear);
    const moving = (t > o6 && t < o6 + 0.3) || (t > T.enter + 0.2 && t < T.enter + 0.6) || (t > T.recount + 0.2 && t < T.recount + 0.6);
    const facing = facingAt(t, [[0, -1], [T.receive, 1], [T.writeQ - 0.6, -1], [T.enter, 1], [T.recount, -1]]);
    const poseTL = [[0, 'kneel'], [o6 - 0.3, 'stand'], [T.landed, 'hold-clipboard'], [T.enter + 0.1, 'stand'], [T.recount + 0.5, 'inspect']];
    const pose = Kit.Worker.poseAt(t, poseTL);
    const typing = t > T.lift - 0.2 && t < T.typed + 0.9;
    const writing = (t > T.writeQ && t < T.writeQ + 1.6) || (t > T.count7 && t < T.count7 + 1.6);
    let reach;
    if (pose.pose === 'kneel' && t > T.find - 0.3) {
      const k = prog(t, T.find - 0.3, 0.4, E.enter);
      reach = [lerp(76, 70, k), lerp(-108, -84, k)];
    }
    if (pose.pose === 'stand' && t > T.enter + 0.3 && t < T.recount) {
      const k = prog(t, T.enter + 0.3, 0.4, E.enter) * (1 - prog(t, T.recount - 0.4, 0.3));
      const j = typing ? 3 * Math.sin(t * 2 * Math.PI * 3.2) : 0;
      reach = [lerp(-6, 82 + j, k), lerp(-99, -128 + Math.abs(j), k)];
    }
    let nod = 0;
    [T.count7 + 1.8, T.count7 + 3.0].forEach(tn => { nod = Math.max(nod, Math.sin(Math.PI * clamp((t - tn) / 0.5))); });
    const wIn = Kit.presence(t, t5 + 0.45, INF);
    place(S.worker.g, { x: wx, y: 850 + wIn.dy, s: [facing, 1], o: wIn.o });
    const wa = S.worker.update({ ...pose, t, facing: 1, walking: moving ? 1 : 0, stride: 0.5, writing, reach, nod: nod * 0.7 });

    // Parts Manager on the right (b05 and b06).
    const PMX = 1760;
    const pmOut = o7;
    enter(S.pm5.g, t, t5 + 0.65, pmOut, { x: PMX, y: 850 });
    const pmPose = Kit.Worker.poseAt(t, [[0, 'stand'], [T.toPM5 + 0.65, 'hold-clipboard'], [T.handoff - 0.15, 'point'], [T.handoff + 0.8, 'stand']]);
    S.pm5.update({ ...pmPose, t, facing: -1, aim: 100 });

    // b05: the found part's line is written on the count sheet, which then goes to the manager.
    const s5o = Kit.presence(t, t5 + 0.55, INF).o;
    const fp = prog(t, T.toPM5, 0.65, E.enter);
    const pmClip = [PMX - 28, 850 - 173];
    const docTo = [pmClip[0] - 26 * 0.2, pmClip[1] - 34 * 0.2];
    const sx = lerp(S.DOC5.x, docTo[0], fp), sy = lerp(S.DOC5.y, docTo[1], fp) - 60 * Math.sin(Math.PI * fp);
    place(S.sheet5G, { x: sx, y: sy + Kit.presence(t, t5 + 0.55, INF).dy, s: lerp(1, 0.2, fp), o: s5o * (1 - prog(t, T.toPM5 + 0.55, 0.12)) });
    show(S.sheet5G, t < T.toPM5 + 0.7 && s5o > 0.001);
    const wrote = 6 + [0, 1, 2].reduce((a, i) => a + prog(t, T.fields[i], 0.45, E.linear), 0);
    S.sheet5.update({ write: wrote, notes: 0 });
    // Research badge pops above the manager.
    const rp = prog(t, T.research, 0.3, E.pop) * (1 - prog(t, o6 - 0.3, 0.3, E.exit));
    place(S.researchG, { x: 1590, y: 500, s: Math.max(0.001, rp), o: clamp(rp * 3) });
    show(S.researchG, rp > 0.001);
    S.research.update({ glint: ((t - T.research) / 1.8) % 1, badge: prog(t, T.research + 0.15, 0.3, E.enter) });

    // b06: the manager hands over the count report; it lands on the Worker's clipboard.
    const hp = prog(t, T.handoff, 0.85, E.enter);
    const hFrom = [PMX - 88, 850 - 182], hTo = [COUNT_X + 28, 850 - 173];
    const hpos = hop(hp, hFrom, hTo, 160);
    place(S.handDoc, { x: hpos[0], y: hpos[1], s: lerp(1.5, 1, hp), r: -12 * Math.sin(Math.PI * hp) });
    show(S.handDoc, t >= T.handoff && t < T.landed);
    // The Worker's count sheet in the inset: P/N and description printed, the count written in.
    const s6p = Kit.presence(t, T.landed, o8);
    place(S.sheet6G, { x: S.DOC.x, y: S.DOC.y + s6p.dy, o: s6p.o });
    show(S.sheet6G, s6p.o > 0.001);
    const w6 = 2 + prog(t, T.writeQ + 0.2, 0.5, E.linear) + 3 * prog(t, T.count7 + 0.2, 1.4, E.linear);
    // Notes: two issue icons fly from the rack into the Notes slots.
    const issueAt = [
      { x: S.RACK_X + S.rack.labelAt(6).x, y: 850 + S.rack.labelAt(6).y },
      { x: S.RACK_X - 310 + 20, y: 850 - 100 },
    ];
    let notes = 0;
    S.noteFly.forEach((ng, i) => {
      const np = prog(t, T.notes[i], 0.7, E.enter);
      const slot = S.sheet6.notePos(i);
      const to = [S.DOC.x + slot.x, S.DOC.y + slot.y];
      const p = hop(np, [issueAt[i].x, issueAt[i].y - 40], to, 140);
      const pop = prog(t, T.notes[i] - 0.25, 0.25, E.pop);
      place(ng, { x: p[0], y: p[1], s: Math.max(0.001, pop), r: -8 * Math.sin(Math.PI * np) });
      show(ng, t >= T.notes[i] - 0.25 && np < 1);
      notes += prog(t, T.notes[i] + 0.7, 0.25, E.linear);
    });
    S.sheet6.update({ write: w6, notes });
    const ringP = prog(t, T.asCounted, 0.3, E.pop) * (1 - prog(t, o8 - 0.3, 0.3));
    const qf = S.sheet6.fieldPos(0, 2);
    place(S.qtyRing, { x: qf.x + 9, y: qf.y - 9, s: Math.max(0.001, ringP) });
    show(S.qtyRing, ringP > 0.001);

    // b08: the recount report prints, grows into the inset, amber rows highlight.
    const pt = S.term.paperTop(1);
    const gp = prog(t, T.report, 0.6, E.enter);
    const rpres = 1 - prog(t, T.reportOut - 0.3, 0.3, E.exit);
    place(S.reportG, { x: lerp(S.TX + pt.x, S.DOC.x, gp), y: lerp(S.TY + pt.y, S.DOC.y, gp), s: lerp(52 / 260, 1, gp), o: rpres });
    show(S.reportG, t >= T.report && rpres > 0.001);
    S.report.update({ highlight: prog(t, T.amber, 1.0, E.linear) });

    // Possible causes: documents pop in turn; each question resolves to a check.
    S.causes.forEach((c, i) => {
      const p = prog(t, T.causes[i], 0.3, E.pop);
      place(c.g, { x: c.x, y: 300 });
      show(c.g, p > 0.001);
      place(c.icon, { s: Math.max(0.001, p) });
      const lo = prog(t, T.causes[i] + 0.1, 0.3, E.enter);
      place(c.lab, { y: 12 * (1 - lo), o: lo });
      const qp = prog(t, T.causes[i] + 0.15, 0.25, E.pop) * (1 - prog(t, T.resolve[i], 0.15, E.linear));
      place(c.qPop, { s: Math.max(0.001, qp), r: t >= T.causes[i] + 0.4 && t < T.resolve[i] ? 6 * Math.sin((t - T.causes[i]) * 5) : 0 });
      show(c.qPop, qp > 0.001);
      c.chk.update({ t, tIn: T.resolve[i] });
    });
    S.causeDots.forEach((d, k) => enter(d, t, T.causes[k + 1] + 0.05, null, { rise: 12 }));

    // Headings and the b06 checklist.
    S.H5.update({ t, tIn: t5 + 0.35, tOut: o6 });
    S.S5.update({ t, tIn: T.toPM5 - 0.2, tOut: o6 });
    S.H6a.update({ t, tIn: S.b6.start + 0.35, tOut: T.receive + 0.3 });
    S.H6b.update({ t, tIn: Math.min(T.noView - 0.1, T.receive + 0.35), tOut: o7 });
    S.H7a.update({ t, tIn: S.b7.start + 0.35, tOut: T.enter - 0.05 });
    S.H7b.update({ t, tIn: T.enter + 0.25, tOut: o8 });
    S.H8.update({ t, tIn: S.b8.start + 0.35 });
    S.S8.update({ t, tIn: T.nearby });
    place(S.list6G, { x: 1060, y: 280 });
    S.list6.update({ t, tIn: T.before - 0.2, tOut: T.receive + 0.1, rows: T.rows6.map(v => v - 0.15), ticks: T.ticks6 });
    void wa;
  }
})();
