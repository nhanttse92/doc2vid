// Gallery for web/kit/docs.js: every component and state on one 1920×1080 page, animations
// cycling over 10 s. Add &focus=<tile id> to the URL to see one tile scaled up, e.g.
//   node shoot.mjs "kit=docs&focus=picktag" 3 --full
(() => {
  const { el, set, clamp, lerp } = Engine;
  const { C, ease, text } = Kit;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const cyc = (t, period, off = 0) => (((t + off) % period) + period) % period;

  Engine.scene('gallery', {
    duration: 10,
    build(ctx) {
      const root = ctx.root;
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, root);
      const focus = new URLSearchParams(location.search).get('focus');
      const renders = [];
      // tile(id, label, x, y, s, box = [bx, by, bw, bh] in component coords, make(g) -> render(t), dark)
      const tile = (id, label, x, y, s, box, make, dark = false) => {
        if (focus && focus !== id) return;
        if (focus) {
          s = Math.min(1700 / box[2], 880 / box[3]);
          x = 960 - (box[2] * s) / 2; y = 140 + (880 - box[3] * s) / 2;
        }
        if (dark) el('rect', { x: x - 10, y: y - 10, width: box[2] * s + 20, height: box[3] * s + 20, rx: 8, fill: C.bgDark }, root);
        text(root, label, { x: focus ? 80 : x, y: focus ? 90 : y - 12, size: focus ? 34 : 17, weight: 600, fill: C.inkSoft });
        const g = el('g', { transform: `translate(${x - box[0] * s} ${y - box[1] * s}) scale(${s})` }, root);
        renders.push(make(g));
      };

      // ---- Row A: maps and the pick tag ----
      tile('map-line', 'WarehouseMap lineArt dark: draw', 30, 52, 0.38, [0, 0, 1200, 620], g => {
        const m = Kit.WarehouseMap(g, { lineArt: true, theme: 'dark' });
        return t => m.update({ draw: seg(cyc(t, 5, 1), 0, 3) });
      }, true);
      tile('map-rows', 'WarehouseMap: draw, rows, zones, route', 510, 52, 0.38, [0, 0, 1200, 620], g => {
        const m = Kit.WarehouseMap(g);
        return t => {
          const k = cyc(t, 10, 1);
          m.update({ draw: seg(k, 0, 1.5), rows: 6 * seg(k, 1.5, 4.5), zones: seg(k, 4, 5), route: seg(k, 5, 8.5) });
        };
      });
      tile('map-zones', 'WarehouseMap: lit, overflow, markers, ping', 990, 52, 0.38, [0, 0, 1200, 620], g => {
        const m = Kit.WarehouseMap(g);
        const keys = ['willcall', 'shop', 'outbound', 'overflow'];
        return t => m.update({
          route: 1, overflow: 1, lit: keys[Math.floor(t / 2.5) % 4], litP: seg(cyc(t, 2.5), 0, 0.3),
          markers: Math.min(3, cyc(t, 10, 2) * 1.5), ping: cyc(t, 1.2) / 1.2,
        });
      });
      tile('picktag', 'PickTag: dim + highlight', 1474, 52, 0.59, [0, 0, 700, 440], g => {
        const p = Kit.PickTag(g);
        const keys = ['location', 'part', 'qty', 'desc', 'item'];
        return t => p.update({ dim: 1, highlight: { [keys[Math.floor(t / 2) % 5]]: seg(cyc(t, 2), 0, 0.5) } });
      });

      // ---- Row B: clipboards and paperwork ----
      const RB = 380, SD = 0.72;
      tile('clip', 'Clipboard', 30, RB, SD, [0, -14, 300, 414], g => {
        const c = Kit.Clipboard(g);
        return t => {
          const k = cyc(t, 10, 0.5);
          c.update({ checks: k / 0.6, unlock: seg(k, 3.3, 3.8), sign: seg(k, 3.9, 5.1), note: seg(k, 5.5, 6.6) });
        };
      });
      tile('clip-late', 'Clipboard late', 270, RB, SD, [0, -14, 314, 470], g => {
        const c = Kit.Clipboard(g);
        return t => c.update({ checks: 3, note: 1, late: seg(cyc(t, 5, 1), 0, 0.8) });
      });
      tile('slip-cust', 'Slip customer', 520, RB, SD, [0, -24, 284, 364], g => {
        const s = Kit.PackingSlip(g, { variant: 'customer' });
        return t => s.update({ pending: seg(cyc(t, 5, 1), 0, 0.4) });
      });
      tile('slip-shop', 'Slip shop, notes', 735, RB, SD, [0, -24, 284, 364], g => {
        const s = Kit.PackingSlip(g, { variant: 'shop' });
        return t => {
          const k = cyc(t, 10, 0.5);
          s.update({ notes: 2 * seg(k, 0.5, 3.5), row: 3, rowGlow: k > 4 ? 0.5 + 0.5 * Math.sin((k - 4) * 5) : 0 });
        };
      });
      tile('pickdoc', 'PickDocument', 950, RB, SD, [0, 0, 260, 340], g => {
        const d = Kit.PickDocument(g);
        return t => { const n = 5 * seg(cyc(t, 10, 0.5), 0, 7); d.update({ ticks: n, active: n < 5 ? Math.floor(n) : null }); };
      });
      tile('recount', 'RecountReport', 1150, RB, SD, [0, 0, 260, 340], g => {
        const r = Kit.RecountReport(g);
        return t => { const k = cyc(t, 5, 1.5); r.update({ rows: 6 * seg(k, 0, 1.5), highlight: seg(k, 1.6, 3) }); };
      });
      tile('count', 'CountSheet', 1350, RB, SD, [0, 0, 260, 340], g => {
        const c = Kit.CountSheet(g);
        return t => { const k = cyc(t, 10, 0.5); c.update({ write: 6 * seg(k, 0, 6), notes: 3 * seg(k, 6.2, 8) }); };
      });
      tile('sds', 'SDS', 1550, RB, SD, [0, 0, 260, 340], g => {
        const s = Kit.SDS(g);
        return t => s.update({ pulse: seg(cyc(t, 2.5), 0, 0.6) });
      });
      tile('camera', 'Camera flash', 1790, RB + 30, 1, [-50, -60, 100, 100], g => {
        const c = Kit.Camera(g);
        return t => c.update({ flash: Kit.Camera.flashAt(cyc(t, 2.5), 1) || (cyc(t, 2.5) < 0.5 ? 1 : 0) });
      });
      tile('camera-off', 'Camera', 1790, RB + 180, 1, [-50, -40, 100, 80], g => {
        const c = Kit.Camera(g);
        return () => c.update({ flash: 0 });
      });

      // ---- Row C: terminals, drawer, book, certificate, small icons ----
      const RC = 770, ST = 0.62;
      tile('term-onhands', 'Terminal onhands', 30, RC, ST, [0, 0, 360, 300], g => {
        const m = Kit.Terminal(g);
        return t => { const k = cyc(t, 5, 1); m.update({ screen: 'onhands', value: 12 + Math.round(5 * seg(k, 0.5, 2.5)), flash: k > 2.5 ? 1 - seg(k, 2.6, 3.2) : 0 }); };
      });
      tile('term-covered', 'Terminal covered', 275, RC, ST, [0, 0, 360, 300], g => {
        const m = Kit.Terminal(g);
        return t => { const k = cyc(t, 10, 1); m.update({ screen: 'covered', cover: seg(k, 0.3, 0.9) * (1 - seg(k, 5.5, 6.1)), value: '14', typed: k < 5.5 ? 1 : seg(k, 6.3, 7.3), t }); };
      });
      tile('term-report', 'Terminal off/report', 520, RC, ST, [0, 0, 360, 300], g => {
        const m = Kit.Terminal(g);
        return t => m.update({ screen: cyc(t, 5) < 1.2 ? 'off' : 'report' });
      });
      tile('term-print', 'Terminal print', 765, RC, ST, [0, -140, 360, 440], g => {
        const m = Kit.Terminal(g);
        return t => m.update({ screen: 'print', print: seg(cyc(t, 5, 2), 0, 2.5), paper: Math.floor((t + 2) / 5) % 2 ? 'report' : 'slip' });
      });
      tile('drawer', 'FolderDrawer', 1010, RC, 0.66, [0, -150, 320, 390], g => {
        const d = Kit.FolderDrawer(g);
        return t => {
          const k = cyc(t, 10, 2);
          d.update({ open: seg(k, 0.3, 1) * (1 - seg(k, 5, 5.7)), docIn: seg(k, 1.3, 2.1), docOut: seg(k, 2.5, 3.3), badge: seg(k, 6, 6.3) });
        };
      });
      tile('book', 'PolicyBook', 1240, RC + 30, 0.56, [-180, -118, 360, 236], g => {
        const b = Kit.PolicyBook(g);
        return t => { const k = cyc(t, 5, 1); b.update({ open: ease.enter(seg(k, 1, 1.8)) * (1 - ease.exit(seg(k, 4, 4.6))) }); };
      });
      tile('cert', 'Certificate loop', 1478, RC + 50, 0.42, [-70, -70, 440, 360], g => {
        const c = Kit.Certificate(g, { loop: true });
        return t => { const k = cyc(t, 5, 1); c.update({ seal: seg(k, 0, 0.4), loop: seg(k, 0.6, 2.2), check: seg(k, 2.4, 2.7) }); };
      });
      tile('plane', 'Plane', 1660, RC + 10, 0.8, [-230, -50, 300, 100], g => {
        const a = Kit.Plane(el('g', { transform: 'translate(0 -10)' }, g), { carrier: 'UPS' });
        return t => a.update({ t });
      });
      tile('plane2', 'Plane dir -1', 1660, RC + 110, 0.8, [-70, -50, 300, 100], g => {
        const a = Kit.Plane(g, { carrier: 'FEDEX', dir: -1 });
        return t => a.update({ t: t + 1, tag: seg(cyc(t, 5), 0, 0.6) });
      });
      tile('mag', 'Magnifier', 1660, RC + 220, 1, [-40, -40, 230, 80], g => {
        const m = Kit.Magnifier(g, { label: 'Research' });
        return t => m.update({ glint: seg(cyc(t, 2.5), 0, 0.8), tilt: Math.sin(t * 2) * 4, badge: seg(cyc(t, 5, 1), 0, 0.4) });
      });
      return { renders };
    },
    render(t, ctx, state) { for (const r of state.renders) r(t); },
  });
})();
