// Gallery for web/kit/objects.js: every component, state and pose on one 1920×1080 page, with
// animations cycling over 10 s. Add &focus=<tile id> to see one tile filling the frame, e.g.
//   node shoot.mjs "kit=objects&focus=truck" 0,2.5,5 --sheet
(() => {
  const { el, clamp } = Engine;
  const { C, text } = Kit;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const cyc = (t, period, off = 0) => (((t + off) % period) + period) % period;
  // up 0->1 over [a, b], hold, back down over [c, d]
  const hold = (k, a, b, c, d) => (k < c ? seg(k, a, b) : 1 - seg(k, c, d));

  Engine.scene('gallery', {
    duration: 10,
    build(ctx) {
      const root = ctx.root;
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, root);
      const focus = new URLSearchParams(location.search).get('focus');
      const renders = [];
      const defs = el('defs', {}, root);
      let n = 0;
      // tile(id, label, x, y, w, h, box = [bx, by, bw, bh] in component coords, make(g) -> render(t))
      const tile = (id, label, x, y, w, h, box, make) => {
        if (focus && focus !== id) return;
        if (focus) { x = 80; y = 60; w = 1760; h = 960; }
        const lh = focus ? 44 : 20;
        const s = Math.min(w / box[2], (h - lh) / box[3]);
        const ox = x + (w - box[2] * s) / 2 - box[0] * s, oy = y + lh + (h - lh - box[3] * s) / 2 - box[1] * s;
        const cid = `gal-clip-${++n}`;
        el('rect', { x, y, width: w, height: h }, el('clipPath', { id: cid }, defs));
        el('rect', { x: x + 0.75, y: y + 0.75, width: w - 1.5, height: h - 1.5, rx: 6, fill: 'none', stroke: C.floor, 'stroke-width': 1.5 }, root);
        text(root, label, { x: x + 6, y: y + (focus ? 34 : 15), size: focus ? 30 : 13, weight: 600, fill: C.inkSoft });
        const clip = el('g', { 'clip-path': `url(#${cid})` }, root);
        const g = el('g', { transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(4)})` }, clip);
        renders.push(make(g));
      };

      // ---- Row 1: truck, dock door, racks, stacked pallet ----
      const R1 = 6, H1 = 252;
      tile('truck', 'BoxTruck: arrive, door-open, chocked, chock missing', 6, R1, 362, H1, [-380, -330, 760, 350], g => {
        const tr = Kit.BoxTruck(g, { from: -520 });
        return t => { const k = cyc(t, 10); tr.update({ arrive: seg(k, 0, 1.9), door: hold(k, 2.2, 3.2, 9.2, 9.8), chock: k < 7 ? seg(k, 4, 5.3) : 0, chockMissing: k >= 7, t }); };
      });
      tile('dock', 'DockDoor: closed / open', 372, R1, 168, H1, [-215, -528, 430, 534], g => {
        const d = Kit.DockDoor(g, { number: 3 });
        return t => d.update({ open: hold(cyc(t, 10), 1, 2.4, 6, 7.4), t });
      });
      tile('rack-stocked', 'PalletRack: empty -> stocked (fill)', 544, R1, 212, H1, [-280, -600, 600, 616], g => {
        const r = Kit.PalletRack(g);
        return t => r.update({ state: 'stocked', fill: 9 * seg(cyc(t, 10), 0.3, 4.8), t });
      });
      tile('rack-over', 'PalletRack: overstocked', 760, R1, 212, H1, [-280, -600, 600, 616], g => {
        const r = Kit.PalletRack(g);
        return t => r.update({ state: 'overstocked', t });
      });
      tile('rack-perm', 'PalletRack: permanent + overstock', 976, R1, 212, H1, [-280, -600, 600, 616], g => {
        const r = Kit.PalletRack(g);
        return t => r.update({ state: 'permanent', t });
      });
      tile('rack-mixed', 'PalletRack: parts, baskets, labels', 1192, R1, 212, H1, [-280, -600, 600, 616], g => {
        const r = Kit.PalletRack(g, { parts: [['bolt', 'bolt'], ['bolt', 'hosecoil'], ['bearing', 'sealring'], ['shaft'], ['brakeshoe'], ['part', 'bolt'], ['bolt'], ['bolt'], ['bolt']] });
        return t => {
          const k = cyc(t, 10);
          r.update({ state: 'stocked', t, bins: {
            0: { content: 'parts' }, 1: { content: 'parts' }, 2: { content: 'basket', basket: hold(k, 1, 2.5, 8, 9) },
            3: { labelState: 'worn' }, 4: { replace: seg(k, 2, 3.6) }, 5: { content: 'none', labelState: 'missing' },
            6: { carton: { label: '123-A', turn: seg(k, 4, 5.5) } }, 7: { carton: { damaged: 1 } }, 8: { content: 'parts' },
          } });
        };
      });
      tile('rack-3bay', 'PalletRack {bays: 3, contents: [carton]}', 1408, R1, 330, H1, [-800, -600, 1650, 616], g => {
        const r = Kit.PalletRack(g, { bays: 3, contents: ['carton'] });
        return t => r.update({ state: 'stocked', t });
      });
      tile('pallet-stack', 'Pallet: stacked 0-6', 1742, R1, 172, H1, [-135, -420, 340, 440], g => {
        const p = Kit.Pallet(g);
        return t => p.update({ count: 6 * seg(cyc(t, 10), 0.2, 6.2), cartons: [{}, {}, { label: '123-A' }], t });
      });

      // ---- Row 2: cartons, crate, package, broken pallet ----
      const R2 = 264, H2 = 172, W2 = 158.5;
      const cbox = [-80, -176, 196, 186];
      const carton = (i, id, label, opts, fn) => tile(id, label, 6 + i * (W2 + 1), R2, W2, H2, cbox, g => {
        const c = Kit.Carton(g, { shadow: true, ...opts });
        return t => c.update({ ...fn(cyc(t, 10)), t });
      });
      carton(0, 'carton-plain', 'Carton: plain', {}, () => ({}));
      carton(1, 'carton-labelled', 'Carton: labelled', { label: '123-A' }, () => ({}));
      carton(2, 'carton-damaged', 'Carton: damaged', {}, k => ({ damaged: hold(k, 1, 1.6, 8.5, 9.2) }));
      carton(3, 'carton-open', 'Carton: open', {}, k => ({ open: hold(k, 0.5, 1.8, 6, 7.3) }));
      carton(4, 'carton-sealed', 'Carton: sealed (tape)', {}, k => ({ tape: seg(k, 1, 3) }));
      carton(5, 'carton-scuffed', 'Carton: clean -> scuffed', {}, k => ({ scuff: hold(k, 2, 3, 8, 9) }));
      carton(6, 'carton-empty', 'Carton: empty', {}, () => ({ empty: true }));
      carton(7, 'carton-turn', 'Carton: turn to label', { label: 'B-02-3' }, k => ({ turn: hold(k, 1, 2.4, 7, 8.4) }));
      carton(8, 'carton-bulge', 'Carton: bulge + error', {}, k => ({ bulge: hold(k, 0.5, 1.5, 8, 9), outline: 'error' }));
      tile('crate', 'WeatherproofCrate', 6 + 9 * (W2 + 1), R2, W2, H2, [-76, -160, 196, 170], g => {
        const c = Kit.Crate(g, { shadow: true });
        return t => c.update({ beads: 1, t });
      });
      tile('package', 'Package: -2, tip, shrink', 6 + 10 * (W2 + 1), R2, W2, H2, [-120, -210, 400, 220], g => {
        const p = Kit.Package(g, { n: 10, label: 'PKG OF 10' });
        return t => { const k = cyc(t, 10); p.update({ count: k < 3 ? 10 : 8, tip: hold(k, 5, 6.2, 9.4, 9.9), shrink: seg(k, 7, 8.5) * (k < 9.4 ? 1 : 0), t }); };
      });
      tile('pallet-broken', 'Pallet: broken', 6 + 11 * (W2 + 1), R2, W2, H2, [-135, -260, 340, 280], g => {
        const p = Kit.Pallet(g);
        return t => p.update({ count: 2, broken: hold(cyc(t, 10), 2, 3, 8.5, 9.5), t });
      });

      // ---- Row 3: straps, scissors, splinters, tags, labels, markers, aisle sign ----
      const R3 = 442, H3 = 150, W3 = 146.4;
      const x3 = i => 6 + i * (W3 + 1);
      tile('strap-carton', 'Strap on Carton: cut', x3(0), R3, W3, H3, [-160, -160, 330, 190], g => {
        const c = Kit.Carton(g, { shadow: true });
        const s = Kit.Strap(g, {});
        return t => { const k = cyc(t, 10); c.update({}); s.update({ cut: hold(k, 2, 3.4, 9, 9.6), t }); };
      });
      tile('strap-pallet', 'Strap on Pallet (box)', x3(1), R3, W3, H3, [-190, -300, 420, 330], g => {
        const p = Kit.Pallet(g);
        const b = p.box(4);
        const s = Kit.Strap(g, { ...b, at: [-58, 58] });
        return t => { const k = cyc(t, 10); p.update({ count: 4 }); s.update({ cut: hold(k, 3, 4.5, 9, 9.6), t }); };
      });
      tile('scissors', 'Scissors: snip', x3(2), R3, W3, H3, [-90, -60, 180, 120], g => {
        const s = Kit.Scissors(g);
        return t => s.update({ open: 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / 0.9) });
      });
      tile('splinters', 'Splinters: spread', x3(3), R3, W3, H3, [-110, -80, 220, 160], g => {
        const s = Kit.Splinters(g);
        return t => s.update({ spread: hold(cyc(t, 10), 1, 2.4, 7, 8.4) });
      });
      tile('tag', 'Tag: write, remove', x3(4), R3, W3, H3, [-20, -20, 200, 130], g => {
        const tg = Kit.Tag(g, { lines: ['P/N 123-A', 'QTY 2'] });
        return t => { const k = cyc(t, 10); tg.update({ on: seg(k, 0, 1), write: seg(k, 1, 3), remove: seg(k, 7.5, 8.7), t }); };
      });
      tile('overstock', 'OverstockTag + arrow', x3(5), R3, W3, H3, [-20, -20, 200, 150], g => {
        const tg = Kit.OverstockTag(g);
        return t => tg.update({ on: seg(cyc(t, 10), 0, 1.2), t });
      });
      tile('pricetag', 'PriceTag: swings on', x3(6), R3, W3, H3, [-20, -20, 230, 110], g => {
        const tg = Kit.PriceTag(g);
        return t => tg.update({ on: seg(cyc(t, 5), 0.3, 2.3), t });
      });
      const lbl = (i, id, label, fn) => tile(id, label, x3(i), R3, W3, H3, [-100, -60, 200, 120], g => {
        const l = Kit.LocationLabel(g, { text: 'B-02-3' });
        return t => l.update({ ...fn(cyc(t, 10)), t });
      });
      lbl(7, 'label-good', 'LocationLabel: good', () => ({ state: 'good' }));
      lbl(8, 'label-worn', 'LocationLabel: worn', () => ({ state: 'worn' }));
      lbl(9, 'label-missing', 'LocationLabel: missing', () => ({ state: 'missing' }));
      lbl(10, 'label-replace', 'LocationLabel: replace', k => ({ state: 'worn', replace: seg(k, 1.5, 3.2) }));
      tile('section', 'SectionMarker 01 02 03', x3(11), R3, W3, H3, [-60, -80, 120, 160], g => {
        const ms = ['01', '02', '03'].map((s, i) => { const gg = el('g', { transform: `translate(0 ${-48 + i * 48})` }, g); return Kit.SectionMarker(gg, { text: s }); });
        return t => ms.forEach((m, i) => m.update({ on: seg(cyc(t, 10), 0.5 + i * 0.3, 1.1 + i * 0.3) }));
      });
      tile('aisle', 'AisleSign: drop + swing', x3(12), R3, W3, H3, [-90, -10, 180, 240], g => {
        const a = Kit.AisleSign(g, { letter: 'B' });
        return t => a.update({ on: seg(cyc(t, 10), 0.4, 2.8), t });
      });

      // ---- Row 4: part icons and their states ----
      const R4 = 598, H4 = 150, W4 = 135.9;
      const x4 = i => 6 + i * (W4 + 1);
      const part = (i, id, label, kind, fn, box = [-66, -66, 132, 132]) => tile(id, label, x4(i), R4, W4, H4, box, g => {
        const p = Kit.Part(g, { kind });
        return t => p.update({ ...fn(cyc(t, 10)), t });
      });
      ['bolt', 'bearing', 'brakeshoe', 'shaft', 'hosecoil', 'sealring', 'part'].forEach((k, i) =>
        part(i, `part-${k}`, `Part ${k}`, k, () => ({})));
      part(7, 'part-new', 'state new (+tag)', 'bearing', k => ({ state: 'new', tagOn: seg(k, 0.5, 1.5) }), [-60, -80, 200, 150]);
      part(8, 'part-core', 'state core (+tag)', 'bearing', k => ({ state: 'core', tagOn: seg(k, 0.5, 1.5) }), [-60, -80, 200, 150]);
      part(9, 'part-rust', 'rusted (grows)', 'bolt', k => ({ rust: hold(k, 1, 4, 8.5, 9.5) }));
      part(10, 'part-wrap', 'wrapped -> torn', 'brakeshoe', k => ({ wrap: hold(k, 0.5, 2, 9.4, 9.8), torn: hold(k, 5, 6.4, 9.4, 9.8) }), [-80, -66, 180, 140]);
      part(11, 'part-cradle', 'shaft on cradle', 'shaft', () => ({ cradle: true }), [-70, -40, 140, 100]);
      part(12, 'part-scratched', 'shaft scratched', 'shaft', () => ({ scratched: 1, outline: 'error' }), [-70, -40, 140, 100]);
      part(13, 'part-missing', 'missing', 'bearing', () => ({ missing: true }));

      // ---- Row 5: baskets, housekeeping, chock ----
      const R5 = 754, H5 = 160, W5 = 189.4;
      const x5 = i => 6 + i * (W5 + 1);
      tile('basket', 'WireBasket: normal', x5(0), R5, W5, H5, [-90, -130, 210, 145], g => {
        const b = Kit.WireBasket(g);
        return t => b.update({ over: 0, t });
      });
      tile('basket-over', 'WireBasket: overloaded', x5(1), R5, W5, H5, [-100, -150, 230, 200], g => {
        const b = Kit.WireBasket(g);
        return t => b.update({ over: hold(cyc(t, 10), 0.5, 2, 9, 9.8), t });
      });
      tile('broom', 'Broom: sweeping', x5(2), R5, W5, H5, [-110, -230, 220, 240], g => {
        const b = Kit.Broom(g);
        return t => b.update({ sweeping: true, t });
      });
      tile('dustpan', 'Dustpan', x5(3), R5, W5, H5, [-70, -130, 180, 140], g => {
        const d = Kit.Dustpan(g);
        return t => d.update({ angle: 0, t });
      });
      tile('mop', 'Mop: wiping', x5(4), R5, W5, H5, [-70, -240, 140, 250], g => {
        const m = Kit.Mop(g);
        return t => m.update({ wiping: true, t });
      });
      tile('spill', 'Spill: shrinks, error outline', x5(5), R5, W5, H5, [-120, -50, 240, 100], g => {
        const s = Kit.Spill(g);
        return t => s.update({ size: 1 - seg(cyc(t, 10), 3, 6.5), outline: 'error', t });
      });
      tile('debris', 'Debris: cleared L->R', x5(6), R5, W5, H5, [-135, -45, 270, 90], g => {
        const d = Kit.Debris(g);
        return t => d.update({ clear: seg(cyc(t, 10), 2, 6.5), t });
      });
      tile('trash', 'TrashCan: lid, tip', x5(7), R5, W5, H5, [-150, -175, 330, 185], g => {
        const c = Kit.TrashCan(g);
        return t => { const k = cyc(t, 10); c.update({ lid: hold(k, 1, 1.6, 3.5, 4.1), tip: hold(k, 5, 6.4, 8.6, 9.6), t }); };
      });
      tile('chock', 'WheelChock: place', x5(8), R5, W5, H5, [-130, -70, 220, 80], g => {
        const c = Kit.WheelChock(g);
        el('circle', { cx: 48, cy: -40, r: 40, fill: C.ink, opacity: 0.85 }, g);
        return t => c.update({ place: seg(cyc(t, 10), 1, 2.4), t });
      });
      tile('chock-missing', 'WheelChock: missing', x5(9), R5, W5, H5, [-100, -70, 200, 80], g => {
        const c = Kit.WheelChock(g);
        return t => c.update({ missing: true, t });
      });

      // ---- Row 6: hose shop, cart ----
      const R6 = 920, H6 = 154;
      tile('hosepress', 'HosePress: press', 6, R6, 330, H6, [-265, -380, 510, 390], g => {
        const h = Kit.HosePress(g);
        return t => h.update({ press: hold(cyc(t, 3), 0.4, 1.4, 2, 2.6), t });
      });
      tile('hosesaw', 'HoseSaw: spin, cut', 340, R6, 220, H6, [-95, -80, 190, 140], g => {
        const h = Kit.HoseSaw(g);
        return t => h.update({ cut: 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.5), t });
      });
      tile('hosehook', 'HoseHook: wind up', 564, R6, 420, H6, [-450, -395, 510, 405], g => {
        const h = Kit.HoseHook(g);
        return t => h.update({ wind: hold(cyc(t, 10), 0.5, 4.5, 7, 9.5), t });
      });
      tile('cart', 'Cart: load cartons + parts, roll', 988, R6, 330, H6, [-170, -220, 350, 232], g => {
        const c = Kit.Cart(g);
        return t => { const k = cyc(t, 10); c.update({ cartons: 2 * seg(k, 0.5, 2.5), parts: 2 * seg(k, 3, 5), roll: 60 * t, t }); };
      });
      tile('carton-inside', 'Carton.inside + open (bolts)', 1322, R6, 200, H6, [-80, -170, 190, 180], g => {
        const c = Kit.Carton(g, { shadow: true, w: 130, h: 96, d: 56 });
        const ps = [0, 1, 2].map(i => { const gg = el('g', { transform: `translate(${-26 + i * 34} ${-96 - 6 - i * 4}) rotate(-80) scale(0.55)` }, c.inside); return Kit.Bolt(gg); });
        return t => { c.update({ open: 1, t }); ps.forEach(p => p.update({ t })); };
      });
      tile('iso-check', 'Iso angle check: Carton on Pallet in a rack bin', 1526, R6, 388, H6, [-300, -330, 760, 340], g => {
        const p = Kit.Pallet(g);
        const r = Kit.PalletRack(el('g', { transform: 'translate(260 0) scale(0.6)' }, g));
        return t => { p.update({ count: 3, t }); r.update({ state: 'stocked', t }); };
      });
      return { renders };
    },
    render(t, ctx, state) {
      for (const r of state.renders || []) r(t);
    },
  });
})();
