// Scene s09: Recap and Knowledge Check (Closing). Navy throughout: the recap timeline (b01), nine
// QuizCards (b02 to b06d) and the closing card (b07). Every time comes from ctx.beat / the `say`
// helper below, so the scene stretches with the narration.
(() => {
  const { el, set, place, clamp, lerp } = Engine;
  const C = Kit.C, E = Kit.ease, show = Kit.show;
  const INF = Infinity;
  const pr = (t, t0, d, fn = E.enter) => fn(clamp((t - t0) / Math.max(1e-6, d)));
  const lin = (t, t0, d) => clamp((t - t0) / Math.max(1e-6, d));
  const bump = (t, t0, d = 0.3, amt = 0.15) => 1 + amt * Math.sin(Math.PI * lin(t, t0, d));
  const r2 = v => Math.round(v * 100) / 100;
  const INK = (sw = 2.5) => ({ stroke: C.ink, 'stroke-width': sw, 'stroke-linejoin': 'round' });

  // When a phrase is spoken. Like ctx.cue, but punctuation counts as pause time (weights fitted to
  // this scene's takes: the quiz pause follows the question mark), so answers land on their words.
  function speaker(ctx) {
    const W = { ',': 14, '.': 12, '?': 34, ':': 12, ';': 12 };
    return (id, at, nth = 0) => {
      const b = ctx.beat(id), text = b.text, low = text.toLowerCase();
      let i = -1;
      for (let k = 0; k <= nth; k++) {
        i = low.indexOf(at.toLowerCase(), i + 1);
        if (i < 0) throw new Error(`"${at}" not found in ${id}`);
      }
      let before = 0, total = 0;
      for (let k = 0; k < text.length; k++) { const x = 1 + (W[text[k]] || 0); total += x; if (k < i) before += x; }
      const lead = Math.min(0.2, b.dur * 0.05);
      return b.start + lead + (b.dur - lead) * (before / total);
    };
  }

  // Entrance used for scene-local groups: fade + rise in 0.4 s at tIn, fade + 16 px up by tOut.
  function enter(node, t, tIn, tOut = INF, { x = 0, y = 0, s = 1, rise = 24 } = {}) {
    const p = Kit.presence(t, tIn, tOut, { rise });
    place(node, { x, y: y + p.dy, s, o: p.o });
    show(node, p.o > 0.001);
    return p.o;
  }

  // A QuizCard for one beat: question rises in once the previous beat's content has faded
  // (first 0.3 s of the beat); dots pulse from the end of the question to the answer.
  function quiz(root, ctx, say, id, nextId, question, answer, ansAt) {
    const tIn = ctx.beat(id).start + 0.3;
    const tOut = nextId ? ctx.beat(nextId).start + 0.3 : INF;
    const tA = say(id, ansAt);
    const tQ = say(id, '?');
    const think = [Math.max(tIn + 0.8, tQ - 0.5), tA];
    const card = Kit.QuizCard(root, { question, answer });
    show(card.g, false);
    return {
      stage: card.stage, tIn, tOut, tA,
      update(t) {
        const on = t >= tIn - 1e-6 && t < tOut;
        show(card.g, on);
        if (on) card.update({ t, tIn, tOut, think, tAnswer: tA });
        return on;
      },
    };
  }

  // Rack bin seen front-on: two steel-dark uprights, an upper beam, a shelf deck and a front beam.
  // Returns groups so scenes can layer items between the deck and the front beam.
  function rackBin(parent, { x0, x1, top, deck, beamH = 46, floor }) {
    const back = el('g', {}, parent), mid = el('g', {}, parent), front = el('g', {}, parent);
    const w = x1 - x0;
    el('path', { d: `M${x0} ${deck} L${x0 + 20} ${deck - 14} L${x1 + 10} ${deck - 14} L${x1} ${deck} Z`, fill: '#B9C2CC', ...INK() }, back);
    el('rect', { x: x0 + 13, y: top - 14, width: w - 26, height: 22, fill: C.steel, ...INK() }, back);
    for (const x of [x0, x1]) {
      el('rect', { x: x - 13, y: top - 24, width: 26, height: floor - top + 24, fill: C.steelDark, ...INK() }, front);
      for (let y = top + 6; y < floor - 10; y += 30) el('rect', { x: x - 4, y, width: 8, height: 12, rx: 2, fill: C.ink, opacity: 0.55 }, front);
      el('rect', { x: x - 22, y: floor - 8, width: 44, height: 8, fill: C.steelDark, ...INK() }, front);
    }
    el('rect', { x: x0, y: top - 8, width: w, height: 24, fill: C.steel, ...INK() }, front);
    el('rect', { x: x0, y: deck - 4, width: w, height: beamH, fill: C.steel, ...INK() }, front);
    el('rect', { x: x0 + 6, y: deck + 2, width: w - 12, height: 5, fill: C.paper, opacity: 0.25 }, front);
    return { back, mid, front };
  }

  // The Worker's own carton prop, redrawn so a carton can sit on the scale and hand over to the
  // Worker's lift poses without a jump (same paths as characters.js; origin = carton bottom-centre).
  function propCarton(parent, sw) {
    const g = el('g', {}, parent);
    const k = sw / 2.5;
    el('path', { d: 'M-30 -46 L-20 -56 L40 -56 L30 -46 Z', fill: '#DDB27C', ...INK(sw) }, g);
    el('path', { d: 'M30 0 L40 -10 L40 -56 L30 -46 Z', fill: C.cartonEdge, ...INK(sw) }, g);
    el('rect', { x: -30, y: -46, width: 60, height: 46, fill: C.carton, ...INK(sw) }, g);
    el('path', { d: 'M-25 -51 L35 -51', fill: 'none', ...INK(1.5 * k) }, g);
    el('rect', { x: -6, y: -46, width: 12, height: 14, fill: '#DDB27C', ...INK(1.5 * k) }, g);
    return g;
  }

  // Platform scale (STYLE §6.19; not in the shared kit). Bench platform on a pedestal, a post with a
  // dial: ticks 0 to 60 lb over 240 degrees, red zone and red line at 50 lb, ink needle.
  // Origin: floor under the pedestal. platTop = y of the platform's top edge (negative).
  function makeScale(parent, { platTop, x0, x1, dialX, dialY, R = 84 }) {
    const g = el('g', {}, parent);
    const ang = lb => -120 + 240 * (lb / 60);
    const pt = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
    Kit.shadow(g, 260, { x: (x0 + x1) / 2 + 30, y: 0 });
    // post from the platform's right end up to the dial
    el('rect', { x: dialX - 10, y: dialY, width: 20, height: platTop - dialY + 4, fill: C.steelDark, ...INK() }, g);
    // pedestal and foot
    el('rect', { x: (x0 + x1) / 2 - 18, y: platTop + 20, width: 36, height: -platTop - 28, fill: C.steel, ...INK() }, g);
    el('rect', { x: (x0 + x1) / 2 - 90, y: -14, width: 180, height: 14, rx: 4, fill: C.steelDark, ...INK() }, g);
    // platform: top face (iso depth up-right) and front edge
    el('path', { d: `M${x0} ${platTop} L${x0 + 16} ${platTop - 10} L${x1 + 16} ${platTop - 10} L${x1} ${platTop} Z`, fill: '#C9D1DA', ...INK() }, g);
    el('path', { d: `M${x1} ${platTop} L${x1 + 16} ${platTop - 10} L${x1 + 16} ${platTop + 10} L${x1} ${platTop + 20} Z`, fill: C.steelDark, ...INK() }, g);
    el('rect', { x: x0, y: platTop, width: x1 - x0, height: 20, fill: C.steel, ...INK() }, g);
    // dial
    const dial = el('g', { transform: `translate(${dialX} ${dialY})` }, g);
    el('circle', { r: R + 12, fill: C.steelDark, ...INK() }, dial);
    el('circle', { r: R, fill: C.paper, ...INK(2) }, dial);
    const [a0, a1] = [ang(50), ang(60)];
    const [p0, p1] = [pt(a0, R - 14), pt(a1, R - 14)];
    el('path', { d: `M${r2(p0[0])} ${r2(p0[1])} A${R - 14} ${R - 14} 0 0 1 ${r2(p1[0])} ${r2(p1[1])}`, fill: 'none', stroke: C.error, 'stroke-width': 12, opacity: 0.35 }, dial);
    for (let lb = 0; lb <= 60; lb += 5) {
      const major = lb % 10 === 0, [ax, ay] = pt(ang(lb), R - 6), [bx, by] = pt(ang(lb), R - (major ? 22 : 14));
      el('line', { x1: r2(ax), y1: r2(ay), x2: r2(bx), y2: r2(by), stroke: lb >= 50 ? C.error : C.ink, 'stroke-width': major ? 3.5 : 2, 'stroke-linecap': 'round' }, dial);
    }
    const [rx, ry] = pt(ang(50), R + 4), [sx, sy] = pt(ang(50), R - 34);
    el('line', { x1: r2(rx), y1: r2(ry), x2: r2(sx), y2: r2(sy), stroke: C.error, 'stroke-width': 6, 'stroke-linecap': 'round' }, dial);
    const needle = el('g', {}, dial);
    el('path', { d: `M-5 10 L0 ${-(R - 18)} L5 10 Z`, fill: C.ink, ...INK(1.5) }, needle);
    el('circle', { r: 9, fill: C.steelDark, ...INK(2) }, dial);
    return {
      g,
      update({ lb = 0 }) { set(needle, { transform: `rotate(${r2(ang(lb))})` }); },
    };
  }

  // ------------------------------------------------------------------------------- b01 recap
  function buildRecap(root, ctx, say) {
    const id = 's09b01', g = el('g', {}, root);
    const tOut = ctx.beat('s09b02').start + 0.3;
    const X0 = 240, W = 1440, Y = 676, CW = 248, CH = 236, CY = Y - 66 - CH;
    const labels = ['Purpose', 'Receive, store, ship', 'Order, fill, return', 'Count', 'Maintain', 'Stay safe'];
    const icons = ['box', 'truck', 'tag', 'document', 'broom', 'hazard'];
    const tl = Kit.ProgressTimeline(g, { nodes: labels.map((label, i) => ({ label, icon: icons[i] })), width: W, dark: true, nodeSize: 52, iconSize: 30 });
    place(tl.g, { x: X0, y: Y });
    const t0 = 0.55;
    const act = [t0 + 0.9, say(id, 'Receive'), say(id, 'Order'), say(id, 'Count'), say(id, 'Maintain'), say(id, 'Stay safe')];
    const done = [act[0], act[2], act[3], act[4], act[5], act[5] + 0.9];
    const active = [null, act[1], act[2], act[3], act[4], act[5]];
    const wave = act[5] + 2.2;
    const pulse = labels.map((_, i) => [wave + 0.12 * i]);

    // Picture cards above the nodes, each popping in as its part is named.
    const cards = labels.map((_, i) => {
      const cg = el('g', {}, g), pop = el('g', {}, cg);
      const cid = `s09-card-${i}`;
      el('rect', { width: CW, height: CH, rx: 16 }, el('clipPath', { id: cid }, el('defs', {}, pop)));
      el('rect', { width: CW, height: CH, rx: 16, fill: C.paper, stroke: C.steel, 'stroke-width': 1 }, pop);
      const art = el('g', { 'clip-path': `url(#${cid})` }, pop);
      return { cg, pop, art, x: X0 + i * (W / 5) - CW / 2 };
    });
    const floorBand = art => el('rect', { x: 0, y: CH - 30, width: CW, height: 30, fill: C.floor }, art);
    // I Purpose: target
    const target = Kit.Target(cards[0].art, { size: 136 });
    place(target.g, { x: CW / 2, y: CH / 2 });
    // II Receiving, storing, shipping: rack with a box truck in front
    floorBand(cards[1].art);
    const rackG = el('g', {}, cards[1].art);
    const rack = Kit.PalletRack(rackG, { bays: 1, contents: ['carton'] });
    place(rackG, { x: 150, y: CH - 26, s: 0.3 });
    const truckG = el('g', {}, cards[1].art);
    const truck = Kit.BoxTruck(truckG, { from: -520 });
    place(truckG, { x: 98, y: CH - 18, s: 0.21 });
    const noLabels = Array.from({ length: 9 }, () => ({ labelOn: 0 }));
    // III Ordering: pick tag
    const tagG = el('g', {}, cards[2].art);
    const pickTag = Kit.PickTag(tagG, {});
    place(tagG, { x: (CW - 700 * 0.32) / 2, y: (CH - 440 * 0.32) / 2, s: 0.32 });
    // IV Counts: count sheet
    const sheetG = el('g', {}, cards[3].art);
    const sheet = Kit.CountSheet(sheetG, {});
    place(sheetG, { x: (CW - 260 * 0.6) / 2, y: (CH - 340 * 0.6) / 2, s: 0.6 });
    // V Maintenance: broom and forklift
    floorBand(cards[4].art);
    const forkG = el('g', {}, cards[4].art);
    const fork = Kit.Forklift(forkG, { driver: false, load: false });
    place(forkG, { x: 166, y: CH - 22, s: 0.31 });
    const broomG = el('g', {}, cards[4].art);
    const broom = Kit.Broom(broomG, {});
    place(broomG, { x: 72, y: CH - 18, s: 0.62 });
    // VI Safety: hazard sign
    const hz = Kit.HazardSign(cards[5].art, { size: 150, glyph: 'flame' });
    place(hz.g, { x: CW / 2, y: CH / 2 });

    return t => {
      const on = t < tOut;
      show(g, on);
      if (!on) return;
      tl.update({ t, tIn: t0, tOut, active, done, pulse });
      cards.forEach((c, i) => {
        const tc = act[i];
        const pin = pr(t, tc, 0.35), pout = pr(t, tOut - 0.3, 0.3, E.exit);
        const s = lerp(0.9, 1, pin), o = lin(t, tc, 0.25) * (1 - pout);
        const bob = Math.sin(2 * Math.PI * (t / 3.2 + i * 0.17));
        place(c.cg, { x: c.x, y: CY + 16 * (1 - pin) - 16 * pout + bob });
        place(c.pop, { x: (CW / 2) * (1 - s), y: (CH / 2) * (1 - s), s, o });
        show(c.cg, o > 0.001);
      });
      target.update({ t, tIn: act[0] + 0.1 });
      rack.update({ state: 'stocked', bins: noLabels, t });
      truck.update({ arrive: lin(t, act[1] + 0.05, 1.3), t });
      pickTag.update({ dim: 0.6 * pr(t, act[2] + 0.5, 0.5), highlight: { location: pr(t, act[2] + 0.5, 0.5) } });
      sheet.update({ write: 6 * lin(t, act[3] + 0.2, 1.6) });
      fork.update({ state: 'idle', t });
      broom.update({ angle: -8, sweeping: t > act[4], t });
      hz.update({ t, tIn: act[5] + 0.05, swing: act[5] + 0.4 });
    };
  }

  // ------------------------------------------------------------------------------- b02 truck
  function buildTruck(q, say) {
    const id = 's09b02', st = q.stage, FL = 215;
    const dockG = el('g', {}, st);
    const dock = Kit.DockDoor(dockG, { number: 3 });
    place(dockG, { x: 370, y: FL, s: 0.92 });
    const truckG = el('g', {}, st);
    const truck = Kit.BoxTruck(truckG, { from: -1300 });
    place(truckG, { x: -160, y: FL, s: 0.92 });
    const stampG = el('g', {}, st);
    const stamp = Kit.Stamp(stampG, {});
    place(stampG, { x: -350, y: -178 });
    const tArr = say(id, 'A truck') + 0.1, tChock = q.tA + 0.05, tNo = say(id, 'No exception') + 0.05, tOpen = tNo + 1.3;
    return t => {
      truck.update({ arrive: lin(t, tArr, 2.0), chock: lin(t, tChock, 0.9), door: lin(t, tOpen + 0.4, 1.1), t });
      dock.update({ open: lin(t, tOpen, 1.2), t });
      stamp.update({ t, tIn: tNo });
    };
  }

  // ------------------------------------------------------------------------------- b03 timers
  function buildClocks(q, say) {
    const id = 's09b03', st = q.stage;
    const redG = el('g', {}, st), blueG = el('g', {}, st);
    const red = Kit.Clock(redG, { size: 280, color: 'error', label: '2 h' });
    const blue = Kit.Clock(blueG, { size: 280, color: 'neutral', label: '24 h' });
    // what each timer is for: emergency (hazard) and stock (box), lit with their timer
    const icons = [['hazard', -270], ['box', 270]].map(([name, x]) => {
      const ig = el('g', {}, st), pop = el('g', {}, ig);
      const icon = Kit.Icon(pop, { name, size: 64, color: C.paper });
      place(ig, { x, y: -232 });
      return { pop, icon };
    });
    const tR = q.tA, tB = say(id, 'Stock orders');
    return t => {
      place(redG, { x: -270, y: -20, o: lerp(0.45, 1, pr(t, tR, 0.3)) });
      place(blueG, { x: 270, y: -20, o: lerp(0.45, 1, pr(t, tB, 0.3)) });
      [tR, tB].forEach((tt, i) => {
        const o = lerp(0.35, 1, pr(t, tt, 0.3));
        place(icons[i].pop, { s: bump(t, tt, 0.35, 0.18) });
        icons[i].icon.update({ color: C.paper, o: o * pr(t, q.tIn + 0.3 + 0.1 * i, 0.4) });
      });
      red.update({ t, tIn: q.tIn + 0.25, state: t >= tR ? 'fill' : 'idle', tState: tR, to: 1, dur: 1.2, pulse: t >= tR + 1.2, time: [10, 10] });
      blue.update({ t, tIn: q.tIn + 0.35, state: t >= tB ? 'fill' : 'idle', tState: tB, to: 1, dur: 1.6, time: [2, 40] });
    };
  }

  // ------------------------------------------------------------------------------- b04 worn label
  function buildLabel(q, say) {
    const id = 's09b04', st = q.stage, FL = 215;
    const bin = rackBin(st, { x0: -360, x1: 360, top: -230, deck: 70, beamH: 100, floor: FL });
    const cartons = [[-205, 66], [205, 66]].map(([x, y]) => {
      const cg = el('g', {}, bin.mid);
      const c = Kit.Carton(cg, { w: 150, h: 128, d: 56 });
      place(cg, { x, y });
      return c;
    });
    const labelG = el('g', {}, bin.front);
    const label = Kit.LocationLabel(labelG, { text: '123-A', oldText: '123-A' });
    place(labelG, { x: 0, y: 116, s: 1.8 });
    const checkG = el('g', {}, bin.front);
    const check = Kit.GreenCheck(checkG, { size: 56 });
    place(checkG, { x: 168, y: 64 });
    const wG = el('g', {}, st);
    const worker = Kit.Worker(wG, { seed: 7, facing: -1 });
    place(wG, { x: 500, y: FL, s: 1.05 });
    const tWorn = say(id, 'worn'), tRep = q.tA, tOk = tRep + 1.4, tMark = say(id, 'clearly marked');
    return t => {
      cartons.forEach(c => c.update({ t }));
      label.update({ state: 'worn', replace: lin(t, tRep, 1.4), outline: t >= tMark ? 'correct' : null, t });
      check.update({ t, tIn: tOk });
      const P = Kit.Worker.poseAt(t, [[0, 'stand'], [tWorn, 'point'], [tOk, 'thumbs-up']]);
      worker.update({ ...P, t, aim: 58, facing: -1, stroke: 2.5 / 1.05 });
    };
  }

  // ------------------------------------------------------------------------------- b05 forklift
  function buildForklift(q, say) {
    const id = 's09b05', st = q.stage, FL = 215;
    const FS = 1.2;
    const forkG = el('g', {}, st);
    const fork = Kit.Forklift(forkG, { driver: false, load: false });
    place(forkG, { x: -330, y: FL, s: FS });
    const warnG = el('g', {}, st);
    const warn = Kit.ExclamationMark(warnG, { size: 96 });
    place(warnG, { x: -350, y: -218 });
    const supG = el('g', {}, st);
    const sup = Kit.Worker(supG, { variant: 'supervisor', clipboard: true, seed: 5, facing: -1 });
    const SS = 1.25;
    place(supG, { x: 470, y: FL, s: SS });
    // Report arrow: draws from the tag on the forklift to the supervisor.
    const arrowG = el('g', {}, st);
    const arrow = el('path', { d: 'M-235 10 Q80 -300 392 -40', fill: 'none', stroke: C.accent, 'stroke-width': 7, 'stroke-linecap': 'round' }, arrowG);
    const len = arrow.getTotalLength();
    const end = arrow.getPointAtLength(len), before = arrow.getPointAtLength(len - 12);
    const ang = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI;
    const head = el('path', { d: 'M8 0 L-14 -13 L-14 13 Z', fill: C.accent, ...INK(2), transform: `translate(${r2(end.x)} ${r2(end.y)}) rotate(${r2(ang)})` }, arrowG);
    set(arrow, { 'stroke-dasharray': `${r2(len)} ${r2(len)}` });
    const tFault = say(id, 'safety related') - 0.1, tTag = q.tA, tLock = say(id, 'not used'), tRep = say(id, 'and reported');
    return t => {
      const tagged = t >= tTag;
      fork.update({ state: tagged ? 'tagged-out' : 'idle', t, tag: lin(t, tTag, 0.9), desat: pr(t, tTag + 0.5, 0.8), padlock: lin(t, tLock, 0.35), stroke: 2.5 / FS });
      warn.update({ t, tIn: tFault, tOut: tTag + 0.5 });
      const pa = pr(t, tRep, 0.7);
      set(arrow, { 'stroke-dashoffset': r2(len * (1 - pa)) });
      show(arrowG, pa > 0);
      set(head, { opacity: r2(lin(t, tRep + 0.55, 0.15)) });
      const tGot = tRep + 0.7;
      const nod = Math.sin(Math.PI * lin(t, tGot, 0.5)) + Math.sin(Math.PI * lin(t, tGot + 0.5, 0.5));
      sup.update({ pose: 'hold-clipboard', t, writing: t > tGot + 1.0 && t < tGot + 3.2, nod: 0.7 * nod, facing: -1, stroke: 2.5 / SS });
    };
  }

  // ------------------------------------------------------------------------------- b06 package
  function buildPackage(q, say) {
    const id = 's09b06', st = q.stage, FL = 215;
    const DECK = 50;
    // cart (left), bin (centre), trash can (right)
    const cartG = el('g', {}, st);
    const cart = Kit.Cart(cartG, {});
    const CS = 1.2, CX = -600;
    place(cartG, { x: CX, y: FL, s: CS });
    const trashG = el('g', {}, st);
    const trash = Kit.TrashCan(trashG);
    const TS = 1.6, TX = 600;
    place(trashG, { x: TX, y: FL, s: TS });
    const bin = rackBin(st, { x0: -240, x1: 240, top: -200, deck: DECK, beamH: 52, floor: FL });
    const PS = 1.25;
    const pkgW = el('g', {}, st);       // above the bin while it lifts, tips and flies off
    const pkg = Kit.Package(pkgW, { n: 10, cols: 5, kind: 'bolt', label: 'PKG OF 10' });
    // eight loose bolts that land on the deck (behind the front beam's top edge)
    const BS = 0.62;
    const restX = [-150, -108, -66, -24, 18, 60, 102, 144];
    const loose = restX.map((x, i) => {
      const lg = el('g', {}, bin.mid);
      const b = Kit.Bolt(lg, {});
      return { lg, b, x: x + (i % 2 ? 6 : -6), y: DECK - 10 - (i % 3 === 1 ? 7 : 0), r: (i % 2 ? 1 : -1) * (6 + 12 * ((i * 37) % 5) / 5) };
    });
    // two bolts that go to the cart
    const fly = [0, 1].map(() => { const fg = el('g', {}, st); return { fg, b: Kit.Bolt(fg, {}) }; });
    const tPull = Math.max(q.tIn + 0.7, say(id, 'two parts')), tP = [tPull, tPull + 0.45];
    const tA = q.tA, tLift = tA - 0.1, tTip = tA + 0.35, tDisp = say(id, 'packaging') - 0.1;
    // package centre path (stage coords); the box turns about its own centre to pour
    const rest = [-80, DECK - 55 * PS], hold = [70, -125], over = [TX, -70], into = [TX, FL - 100 * TS + 30];
    return t => {
      cart.update({ t });
      // bolts to the cart
      fly.forEach((f, i) => {
        const s0 = pkg.slot(9 - i);
        const p = lin(t, tP[i], 0.75);
        show(f.fg, p > 0);
        if (p <= 0) return;
        const a = [rest[0] + s0.x * PS, rest[1] + (s0.y + 55) * PS];
        const b = [CX - 30 + i * 60, FL - 128 * CS - 12];
        const e = E.enter(p);
        const x = lerp(a[0], b[0], e), y = lerp(a[1], b[1], e) - 150 * Math.sin(Math.PI * e);
        place(f.fg, { x, y, s: lerp(PS * s0.s, BS, e) * (1 + 0.6 * Math.sin(Math.PI * e)), r: lerp(90, i ? 8 : -6, e) + 180 * e });
        f.b.update({ t });
      });
      const gone = (t >= tP[0] ? 1 : 0) + (t >= tP[1] ? 1 : 0);
      // package: lift, tip, then off to the trash
      const pl = pr(t, tLift, 0.5), pd = pr(t, tDisp, 0.8, E.exit), pdrop = pr(t, tDisp + 0.8, 0.3, E.exit);
      const tipA = 125 * pr(t, tTip, 0.6);
      let cx = lerp(rest[0], hold[0], pl), cy = lerp(rest[1], hold[1], pl);
      cx = lerp(cx, over[0], pd); cy = lerp(cy, over[1], pd) - 120 * Math.sin(Math.PI * pd);
      cx = lerp(cx, into[0], pdrop); cy = lerp(cy, into[1], pdrop);
      const s = PS * lerp(1, 0.5, pd) * lerp(1, 0.3, pdrop);
      const poured = t >= tTip + 0.35;
      set(pkgW, { transform: `translate(${r2(cx)} ${r2(cy)}) rotate(${r2(tipA)}) scale(${r2(s)}) translate(0 55)`, opacity: r2(1 - lin(t, tDisp + 0.95, 0.15)) });
      show(pkgW, t < tDisp + 1.1);
      pkg.update({ count: poured ? 0 : 10 - gone, t });
      trash.update({ lid: pr(t, tDisp + 0.2, 0.3) * (1 - pr(t, tDisp + 1.3, 0.3)), t });
      // loose bolts pour from the tipped package's mouth onto the deck
      loose.forEach((l, i) => {
        const t0 = tTip + 0.32 + 0.07 * i;
        const p = lin(t, t0, 0.45);
        show(l.lg, p > 0);
        if (p <= 0) return;
        const x = lerp(hold[0] + 30 + 6 * i, l.x, E.enter(p)), y = lerp(hold[1] + 50, l.y, p * p);
        const bounce = p >= 1 ? -5 * Math.max(0, Math.sin(Math.PI * lin(t, t0 + 0.45, 0.18))) : 0;
        place(l.lg, { x, y: y + bounce, s: BS, r: lerp(90, l.r, p) });
        l.b.update({ t });
      });
    };
  }

  // ------------------------------------------------------------------------------- b06a scale
  function buildScale(q, say) {
    const id = 's09b06a', st = q.stage, FL = 215;
    const WS = 1.5, WX = -290;
    const wG = el('g', {}, st);
    const worker = Kit.Worker(wG, { seed: 11 });
    const crouch = worker.update({ pose: 'lift-bent-knees', t: 0 });
    // carton bottom-centre while crouched: the prop anchor is the carton centre, 28 px above its base
    const cx = WX + crouch.prop[0] * WS, cBase = FL + (crouch.prop[1] + 28) * WS;
    const scaleG = el('g', {}, st);
    st.insertBefore(scaleG, wG);
    const dialX = cx + 280, dialY = -140;
    const sc = makeScale(scaleG, { platTop: cBase - FL, x0: cx - 60, x1: cx + 300, dialX, dialY: dialY - FL, R: 100 });
    place(scaleG, { x: 0, y: FL });
    const boxG = el('g', {}, st);
    st.insertBefore(boxG, wG);
    propCarton(boxG, 2.5 / WS);
    place(boxG, { x: cx, y: cBase, s: WS });
    const badgeG = el('g', {}, st);
    const badge = Kit.Badge(badgeG, { text: '50 lb', variant: 'correct', icon: 'check', height: 64, size: 40 });
    place(badgeG, { x: dialX + 112 + 100, y: dialY });
    const tA = q.tA, tLift = say(id, 'carton must') - 0.2;
    const tHold = tLift + 0.45, tUp = tLift + 1.2;
    return t => {
      const climb = pr(t, tA + 0.1, 1.3);
      const settle = climb >= 1 ? 0.3 * Math.sin(2 * Math.PI * t / 2.3) : 0;
      sc.update({ lb: 48 * climb + settle });
      badge.update({ t, tIn: tA + 1.1 });
      const P = Kit.Worker.poseAt(t, [[0, 'stand'], [tLift, 'lift-bent-knees'], [tUp, 'carry-carton']], 0.45);
      const held = t >= tHold;
      place(wG, { x: WX, y: FL, s: WS });
      worker.update({ ...P, t, prop: held, stroke: 2.5 / WS });
      show(boxG, !held);
    };
  }

  // ------------------------------------------------------------------------------- b06b discrepancy
  function buildDiscrepancy(q, say) {
    const id = 's09b06b', st = q.stage, FL = 215;
    const tagG = el('g', {}, st);
    const tag = Kit.PickTag(tagG, {});
    place(tagG, { x: -880, y: -236 });
    const boxG = el('g', {}, st);
    const box = Kit.Carton(boxG, { w: 150, h: 122, d: 60, shadow: true });
    place(boxG, { x: -10, y: 170 });
    const bolts = [[-44, -150, -70], [-16, -158, -98], [12, -148, -82], [38, -156, -110], [60, -146, -64]].map(([x, y, r]) => {
      const bg = el('g', { transform: `translate(${x} ${y}) rotate(${r}) scale(0.8)` }, box.inside);
      return Kit.Bolt(bg, {});
    });
    const xG = el('g', {}, st);
    const redX = Kit.RedX(xG, { size: 56 });
    place(xG, { x: 140, y: -60 });
    const slipG = el('g', {}, st), slipIn = el('g', {}, slipG);
    const slip = Kit.PackingSlip(slipIn, { variant: 'plain', notes: ['Wrong part'] });
    const mG = el('g', {}, st);
    const MS = 1.25, MX = 680;
    const mgr = Kit.Worker(mG, { variant: 'manager', seed: 9, facing: -1 });
    place(mG, { x: MX, y: FL, s: MS });
    const tDesc = say(id, 'says bearing') - 0.1, tBolts = say(id, 'holds bolts') - 0.2;
    const tSlip = say(id, 'Note it'), tGive = say(id, 'give the packing') + 0.1, tThumb = say(id, 'Parts Manager') + 0.4;
    const SLIP = [196, -232], SLS = 1, HELD = 0.36;
    return t => {
      const hd = pr(t, tDesc, 0.5);
      tag.update({ dim: 0.65 * hd, highlight: { desc: hd } });
      box.update({ open: lin(t, tBolts, 0.6), t });
      bolts.forEach(b => b.update({ t }));
      redX.update({ t, tIn: tBolts + 0.6 });
      // the manager raises the far hand for the slip, then gives a thumbs-up with the near hand
      const P = Kit.Worker.poseAt(t, [[0, 'stand'], [tThumb, 'thumbs-up']]);
      const rp = pr(t, tGive + 0.2, 0.45);
      const reach2 = rp > 0 ? [lerp(32, 52, rp), lerp(-100, -130, rp)] : null;
      const a = mgr.update({ ...P, t, facing: -1, reach2, stroke: 2.5 / MS, nod: 0.6 * Math.sin(Math.PI * lin(t, tGive + 0.9, 0.5)) });
      // slip: appears, note writes on, then slides into the manager's hand and stays there
      const pg = pr(t, tGive, 0.9);
      const hx = MX + a.hand2[0] * MS, hy = FL + a.hand2[1] * MS;
      const tx = hx - (260 * HELD) / 2, ty = hy - 340 * HELD + 24;
      const sx = lerp(SLIP[0], tx, pg), sy = lerp(SLIP[1], ty, pg) - 70 * Math.sin(Math.PI * pg);
      enter(slipIn, t, tSlip, INF, { s: 1 });
      place(slipG, { x: sx, y: sy, s: lerp(SLS, HELD, pg) });
      slip.update({ notes: lin(t, tSlip + 0.4, 1.0) });
    };
  }

  // ------------------------------------------------------------------------------- b06c cycle count
  function buildCount(q, say) {
    const id = 's09b06c', st = q.stage, FL = 215;
    const termG = el('g', {}, st);
    const term = Kit.Terminal(termG, { rows: [['123-A', 7], ['B-07', 4], ['C-33', 9]] });
    place(termG, { x: -760, y: -175 });
    const BX0 = -330, BX1 = 70, DECK = 70, BC = (BX0 + BX1) / 2;
    const bin = rackBin(st, { x0: BX0, x1: BX1, top: -150, deck: DECK, beamH: 56, floor: FL });
    const labelG = el('g', {}, bin.front);
    const label = Kit.LocationLabel(labelG, { text: 'B-02-3' });
    place(labelG, { x: BC, y: DECK + 24 });
    // six bearings: back row (drawn first) then front row; counted front-left to back-right
    const spots = [[-66, 0], [0, 0], [66, 0], [-36, -20], [30, -20], [96, -20]];
    const order = [3, 4, 5, 0, 1, 2];
    const parts = order.map(k => {
      const [dx, dy] = spots[k];
      const pg = el('g', {}, bin.mid), inner = el('g', {}, pg);
      const ring = el('circle', { r: 34, fill: 'none', stroke: C.accent, 'stroke-width': 4 }, pg);
      const b = Kit.Bearing(inner, {});
      return { k, pg, inner, ring, b, x: BC - 16 + dx, y: DECK - 32 + dy };
    }).sort((a, b) => a.k - b.k);
    const cntG = el('g', {}, st);
    const counter = Kit.Counter(cntG, { from: 0, variant: 'accent', height: 56, size: 32 });
    place(cntG, { x: BC, y: -104 });
    const WSc = 1.2, WX = 250;
    const wG = el('g', {}, st);
    const worker = Kit.Worker(wG, { seed: 13, facing: -1 });
    place(wG, { x: WX, y: FL, s: WSc });
    const sheetG = el('g', {}, st);
    const sheet = Kit.CountSheet(sheetG, { rows: [['123-A', 'Bearing', '6'], ['', '', ''], ['', '', '']] });
    place(sheetG, { x: 430, y: -232 });
    const tCover = q.tA, tC0 = say(id, 'Count without') + 0.2;
    const ticks = parts.map((_, i) => tC0 + 0.38 * i);
    const tW = say(id, 'write the physical'), tE = say(id, 'and enter');
    return t => {
      const lift = pr(t, tE, 0.5);
      const typed = lin(t, tE + 0.5, 0.35);
      term.update({ screen: 'covered', cover: pr(t, tCover, 0.6) * (1 - lift), value: t >= tE ? 6 : 7, typed: t >= tE ? typed : 1, flash: t >= tE + 0.85 ? 1 - lin(t, tE + 0.85, 0.7) : 0, t });
      label.update({ t });
      parts.forEach((p, i) => {
        const tk = ticks[i];
        place(p.pg, { x: p.x, y: p.y });
        place(p.inner, { s: 0.68 * bump(t, tk, 0.3, 0.18) });
        const u = lin(t, tk, 0.5);
        set(p.ring, { r: r2(30 + 16 * u), opacity: r2(0.9 * (1 - u)) });
        show(p.ring, u > 0 && u < 1);
        p.b.update({ t });
      });
      counter.update({ t, tIn: tC0 - 0.35, ticks });
      const nod = ticks.reduce((a, tk) => a + Math.sin(Math.PI * lin(t, tk, 0.3)), 0);
      worker.update({ pose: 'hold-clipboard', t, facing: -1, nod: 0.5 * nod, writing: t >= tW && t < tW + 1.8, stroke: 2.5 / WSc });
      sheet.update({ write: 2 + lin(t, tW + 0.3, 0.6) });
    };
  }

  // ------------------------------------------------------------------------------- b06d lifting
  function buildLifting(q, say) {
    const id = 's09b06d', st = q.stage, FL = 215;
    // Phase 1: worker beside a heavy carton
    const p1 = el('g', {}, st);
    const w0G = el('g', {}, p1);
    const w0 = Kit.Worker(w0G, { seed: 17 });
    place(w0G, { x: -140, y: FL, s: 1.25 });
    const heavyG = el('g', {}, p1);
    const heavy = Kit.Carton(heavyG, { w: 170, h: 140, d: 64, shadow: true });
    place(heavyG, { x: 110, y: FL });
    const qmG = el('g', {}, p1);
    const qm = Kit.QuestionMark(qmG, { size: 76 });
    place(qmG, { x: -120, y: -170 });
    // Phase 2: three panels (wrong, right, ask for assistance)
    const xs = Kit.stripX(3, 520, 40).map(x => x - 960);
    const PH = 440, FLP = 336;
    const panels = [null, null, 'Ask for assistance'].map(caption => Kit.Panel(st, { width: 520, height: PH, caption }));
    panels.forEach((p, i) => place(p.g, { x: xs[i], y: -250 }));
    panels.forEach(p => el('rect', { x: 0, y: FLP, width: 520, height: PH, fill: C.floor }, p.slot));
    const bad = Kit.Worker(el('g', {}, panels[0].slot), { seed: 21 });
    place(bad.g.parentNode, { x: 196, y: FLP, s: 1.25 });
    const good = Kit.Worker(el('g', {}, panels[1].slot), { seed: 23 });
    place(good.g.parentNode, { x: 214, y: FLP, s: 1.25 });
    // two-person lift
    const teamS = 1.0, AX = 150, BX = 372;
    const boxG = el('g', {}, panels[2].slot);
    const teamBox = Kit.Carton(boxG, { w: 120, h: 92, d: 44 });
    const A = Kit.Worker(el('g', {}, panels[2].slot), { seed: 25 });
    const B = Kit.Worker(el('g', {}, panels[2].slot), { variant: 'worker', seed: 27, facing: -1 });
    const tQm = say(id, 'How do you') , tA = q.tA, tGood = tA + 0.9, tAsk = say(id, 'and ask'), tSerious = say(id, 'Serious');
    const tWalk = tAsk + 0.25, walkD = 0.75, tCrouch = tWalk + walkD + 0.15, tLiftUp = tCrouch + 0.8;
    const bStart = 640;
    return t => {
      // phase 1 exits as the panels arrive
      const o1 = 1 - pr(t, tA - 0.35, 0.3, E.exit);
      place(p1, { y: -16 * (1 - o1), o: o1 });
      show(p1, o1 > 0.001);
      if (o1 > 0.001) {
        w0.update({ pose: 'stand', t, stroke: 2.5 / 1.25, nod: 0.4 * Math.sin(Math.PI * lin(t, tQm, 0.6)) });
        heavy.update({ t, bulge: 0.25 });
        qm.update({ t, tIn: tQm });
      }
      const tIns = [tA, tGood, tAsk];
      panels.forEach((p, i) => {
        const marks = ['x', 'check', 'check'];
        const tMarks = [tA + 0.45, tGood + 0.45, tLiftUp + 0.5];
        p.update({ t, tIn: tIns[i], from: i === 0 ? 'left' : i === 1 ? 'below' : 'right', mark: marks[i], tMark: tMarks[i] });
        show(p.g, t >= tIns[i]);
      });
      // a bump on the wrong panel when the narration warns about injury
      place(panels[0].g, { x: xs[0] + 260 * (1 - bump(t, tSerious, 0.5, 0.04)), y: -250 + 220 * (1 - bump(t, tSerious, 0.5, 0.04)), s: bump(t, tSerious, 0.5, 0.04) });
      if (t >= tA) bad.update({ pose: 'lift-bad', t, stroke: 2 });
      if (t >= tGood) {
        const P = Kit.Worker.poseAt(t, [[0, 'lift-bent-knees'], [tGood + 1.3, 'carry-carton']], 0.45);
        good.update({ ...P, t, stroke: 2 });
      }
      if (t >= tAsk) {
        const wp = lin(t, tWalk, walkD);
        const bx = lerp(bStart, BX, wp);
        const walking = wp > 0 && wp < 1 ? 1 : 0;
        const crouchP = pr(t, tCrouch, 0.4);
        const upP = pr(t, tLiftUp, 0.6);
        const hy = lerp(-40, -128, upP);  // hand height on the box sides
        const reachA = [lerp(36, 52, crouchP), hy], reachB = [lerp(36, 52, crouchP), hy];
        const poseA = Kit.Worker.poseAt(t, [[0, 'stand'], [tCrouch, 'lift-bent-knees'], [tLiftUp, 'stand']], 0.45);
        const poseB = Kit.Worker.poseAt(t, [[0, 'walk'], [tWalk + walkD, 'stand'], [tCrouch, 'lift-bent-knees'], [tLiftUp, 'stand']], 0.3);
        const holding = t >= tCrouch + 0.2;
        place(A.g.parentNode, { x: AX, y: FLP, s: teamS });
        place(B.g.parentNode, { x: bx, y: FLP, s: teamS });
        A.update({ ...poseA, t, prop: false, reach: holding ? reachA : null, reach2: holding ? [reachA[0] + 6, reachA[1] - 4] : null, stroke: 2 });
        B.update({ ...poseB, t, facing: -1, walking, prop: false, reach: holding ? reachB : null, reach2: holding ? [reachB[0] + 6, reachB[1] - 4] : null, stroke: 2 });
        place(boxG, { x: (AX + BX) / 2 - 10, y: FLP + lerp(0, -82, upP) });
        teamBox.update({ t });
      }
    };
  }

  // ------------------------------------------------------------------------------- b07 closing
  function buildClosing(root, ctx, say) {
    const id = 's09b07', b = ctx.beat(id), g = el('g', {}, root);
    const t0 = b.start + 0.3;
    const mapG = el('g', {}, g);
    const map = Kit.WarehouseMap(mapG, { lineArt: true, theme: 'dark' });
    const MS = 0.8;
    place(mapG, { x: 960 - 600 * MS, y: 396, s: MS });
    const titleG = el('g', {}, g);
    Kit.text(titleG, 'Warehouse Training Packet', { x: 960, y: 206, size: 88, weight: 800, fill: C.paper, anchor: 'middle' });
    const rule = el('rect', { x: 880, y: 236, width: 0, height: 4, rx: 2, fill: C.accent }, g);
    const subG = el('g', {}, g);
    Kit.text(subG, 'Questions? Ask your supervisor.', { x: 960, y: 306, size: 40, weight: 400, fill: C.onDarkSoft, anchor: 'middle' });
    const WS = 1.2;
    const wG = el('g', {}, g), sG = el('g', {}, g);
    const worker = Kit.Worker(wG, { seed: 31 });
    const sup = Kit.Worker(sG, { variant: 'supervisor', clipboard: true, seed: 33, facing: -1 });
    const tSub = say(id, 'When a question'), tWelcome = say(id, 'Welcome to the team') + 0.1, tWaveEnd = say(id, 'Accuracy') + 0.6;
    return t => {
      const on = t >= t0 - 1e-6;
      show(g, on);
      if (!on) return;
      map.update({ draw: lin(t, t0, 2.2) });
      set(mapG, { opacity: 0.85 });
      enter(titleG, t, t0 + 0.5, INF, { rise: 12 });
      set(rule, { width: r2(160 * pr(t, t0 + 0.95, 0.5)) });
      enter(subG, t, tSub, INF, { rise: 12 });
      enter(wG, t, t0 + 1.0, INF, { x: 870, y: 940, s: WS });
      enter(sG, t, t0 + 1.15, INF, { x: 1070, y: 940, s: WS });
      const Pw = Kit.Worker.poseAt(t, [[0, 'wave'], [tWaveEnd, 'stand'], [tWelcome, 'thumbs-up']]);
      const Ps = Kit.Worker.poseAt(t, [[0, 'hold-clipboard'], [tWelcome, 'thumbs-up']]);
      worker.update({ ...Pw, t, stroke: 2.5 / WS });
      sup.update({ ...Ps, t, facing: -1, stroke: 2.5 / WS });
    };
  }

  Engine.scene('s09', {
    build(ctx) {
      const say = speaker(ctx);
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgDark }, ctx.root);
      const parts = [];
      parts.push({ upd: buildRecap(ctx.root, ctx, say) });
      const Q = [
        ['s09b02', 's09b03', 'Before unloading?', 'Wheels chocked. No exception.', 'Its wheels', buildTruck],
        ['s09b03', 's09b04', 'Check in an emergency order within?', '2 hours (stock orders: 24 hours)', 'Two hours', buildClocks],
        ['s09b04', 's09b05', 'Worn bin label?', 'Replace it. Correct part number, clearly marked.', 'Replace it', buildLabel],
        ['s09b05', 's09b06', 'Safety related fault?', 'Tag out. Do not use. Report immediately.', 'It is tagged', buildForklift],
        ['s09b06', 's09b06a', 'Pulled 2 of a package of 10?', 'Empty the rest into the bin. Dispose of the packaging.', 'They are emptied', buildPackage],
        ['s09b06a', 's09b06b', 'Most a single carton should weigh?', 'General rule: 50 lb. Varies with size, shape, dimensions.', 'Fifty pounds', buildScale],
        ['s09b06b', 's09b06c', 'Tag says bearing, box holds bolts?', 'Claim discrepancy. Note on packing list, give to Parts Manager.', 'That is a claim', buildDiscrepancy],
        ['s09b06c', 's09b06d', 'Check the computer on-hands before counting?', 'No. Count first, note it on the count sheet, enter as counted.', 'No. Count', buildCount],
        ['s09b06d', 's09b07', 'Heavy carton. How do you move it?', 'Follow the lifting guidelines. Ask for assistance.', 'Follow the lifting', buildLifting],
      ];
      for (const [id, next, question, answer, ansAt, fn] of Q) {
        const q = quiz(ctx.root, ctx, say, id, next, question, answer, ansAt);
        const upd = fn(q, say);
        parts.push({ upd: t => { if (q.update(t)) upd(t); } });
      }
      parts.push({ upd: buildClosing(ctx.root, ctx, say) });
      return { parts };
    },
    render(t, ctx, state) {
      for (const p of state.parts) p.upd(t);
    },
  });
})();
