// Gallery for kit/characters.js: every factory, pose, variant and state on one 1920x1080 sheet.
// Motion is time-driven over a 10 s loop (walk, sweep, wave, blink, PPE snap-on, tag swing, padlock,
// forklift desaturation, gear), so stills at different t show the animation.
(() => {
  const { el, place } = Engine;
  const { C } = Kit;
  const loop = (t, period) => ((t % period) + period) % period;

  Engine.scene('gallery', {
    duration: 10,
    build(ctx) {
      const R = ctx.root;
      const items = [];
      el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.bgLight }, R);
      const label = (str, x, y) => Kit.text(R, str, { x, y, size: 16, weight: 600, fill: C.inkSoft, anchor: 'middle' });
      const heading = (str, y) => Kit.text(R, str, { x: 60, y, size: 20, weight: 700, fill: C.ink });
      const floor = y => el('line', { x1: 50, x2: 1870, y1: y, y2: y, stroke: C.floor, 'stroke-width': 4 }, R);
      const at = (x, y, s = 1) => { const g = el('g', {}, R); place(g, { x, y, s }); return g; };

      // Row 1: every pose, default Worker, scale 0.5 (130 px tall).
      heading('Kit.Worker — poses (scale 0.5)', 40);
      floor(300);
      const S1 = 0.5;
      Kit.Worker.POSES.forEach((pose, i) => {
        const x = 104 + i * 122;
        const w = Kit.Worker(at(x, 300, S1), { stroke: 2.5 / S1 });
        items.push(t => w.update({ pose, t, chair: pose === 'sit', typing: true }));
        label(pose, x, 328);
      });

      // Row 2: variants, hats, PPE, combinations, scale 0.58.
      heading('Variants, hats, PPE, walking with props, facing, nod, pose blend, IK reach (scale 0.58)', 370);
      floor(590);
      const S2 = 0.58, step = 136, x0 = 100;
      const row2 = [
        ['worker', { variant: 'worker' }, t => ({ pose: 'stand', t })],
        ['supervisor', { variant: 'supervisor' }, t => ({ pose: 'thumbs-up', t })],
        ['driver (cap)', { variant: 'driver' }, t => ({ pose: 'walk', t })],
        ['analyst (sit)', { variant: 'analyst' }, t => ({ pose: 'sit', t, typing: true })],
        ['manager (tie)', { variant: 'manager' }, t => ({ pose: 'point', t, aim: 120 })],
        ['customer', { variant: 'customer' }, t => ({ pose: 'wave', t })],
        ['hat: hardhat', { hat: 'hardhat' }, t => ({ pose: 'hold-clipboard', t })],
        ['PPE snap-on', {}, t => ({ pose: 'stand', t, ppe: Kit.Worker.ppeAt(loop(t, 5), 0.6) })],
        ['ppe: true', {}, t => ({ pose: 'walk', t, ppe: true })],
        ['walking + writing', {}, t => ({ pose: 'hold-clipboard', walking: 1, writing: true, t })],
        ['facing -1 + nod', { variant: 'supervisor' }, t => ({ pose: 'stand', t, facing: -1, nod: Math.max(0, Math.sin(loop(t, 2.5) / 2.5 * Math.PI * 2)) })],
        ['poseAt blend', {}, t => ({ ...Kit.Worker.poseAt(loop(t, 5), [[0, 'stand'], [1, 'point'], [2.2, 'thumbs-up'], [3.4, 'carry-carton']]), t })],
        ['reach (IK)', {}, t => ({ pose: 'stand', t, reach: [70 + 30 * Math.cos(t * 2), -150 + 40 * Math.sin(t * 2)] })],
      ];
      row2.forEach(([name, opts, params], i) => {
        const x = x0 + i * step;
        const w = Kit.Worker(at(x, 590, S2), { ...opts, stroke: 2.5 / S2 });
        items.push(t => w.update(params(t)));
        label(name, x, 618);
      });

      // Row 3: Forklift states, Machine states, TagOut, Padlock.
      heading('Kit.Forklift (0.5) · Kit.Machine (0.6) · Kit.TagOut · Kit.Padlock', 660);
      floor(880);
      const S3 = 0.5;
      const lifts = [
        ['idle', {}, t => ({ state: 'idle', t })],
        ['driving + driver', { driver: true }, t => ({ state: 'driving', t, lift: 0.15 + 0.15 * Math.sin(t) })],
        ['speeding + load', { driver: true, driverVariant: 'driver', load: true }, t => ({ state: 'speeding', t })],
        ['tagged-out (tag, desat, padlock)', {}, t => {
          const u = loop(t, 5);
          return { state: 'tagged-out', t, tag: Engine.prog(u, 0.3, 0.9, Kit.ease.linear), desat: Engine.prog(u, 0.9, 0.8), padlock: Engine.prog(u, 1.8, 0.3, Kit.ease.linear) };
        }],
      ];
      lifts.forEach(([name, opts, params], i) => {
        const x = 170 + i * 250;
        const f = Kit.Forklift(at(x, 880, S3), { ...opts, stroke: 2.5 / S3 });
        items.push(t => f.update(params(t)));
        label(name, x, 908);
      });
      const S4 = 0.6;
      [['running', 'running'], ['stopped (missing part)', 'stopped']].forEach(([name, state], i) => {
        const x = 1180 + i * 215;
        const m = Kit.Machine(at(x, 880, S4), { stroke: 2.5 / S4 });
        items.push(t => m.update({ state, t }));
        label(name, x, 908);
      });
      const cust = Kit.Worker(at(1270, 880, 0.5), { variant: 'customer', stroke: 5 });
      items.push(t => cust.update({ pose: 'stand', t, facing: -1 }));
      const tag = Kit.TagOut(at(1600, 700, 0.8), { stroke: 2.5 / 0.8 });
      items.push(t => tag.update({ p: Engine.prog(loop(t, 5), 0.3, 0.9, Kit.ease.linear), t }));
      label('TagOut swing-on', 1600, 908);
      const lock = Kit.Padlock(at(1760, 780), {});
      items.push(t => lock.update({ open: Engine.prog(loop(t, 5), 1.5, 0.6) - Engine.prog(loop(t, 5), 3.5, 0.4) }));
      label('Padlock open', 1760, 908);

      // Row 4: PPE icons, plus the smallest Worker size the film uses.
      heading('Kit.PPEIcon', 950);
      ['hardHat', 'glasses', 'gloves', 'vest', 'boots'].forEach((item, i) => {
        const x = 330 + i * 120;
        const ic = Kit.PPEIcon(at(x, 1000), { item, size: 76, bg: true });
        items.push(t => ic.update({ p: Engine.prog(loop(t, 5), 0.2 + i * 0.2, 0.3, Kit.ease.linear) }));
        label(item, x, 1062);
      });
      Kit.text(R, 'Worker at 120 px tall:', { x: 1040, y: 1010, size: 16, weight: 600, fill: C.inkSoft });
      const small = [['walk', {}], ['carry-carton', {}], ['hold-clipboard', { variant: 'supervisor' }], ['point', { variant: 'manager' }], ['sweep', {}], ['lift-bad', {}]];
      small.forEach(([pose, opts], i) => {
        const s = 120 / 260, x = 1250 + i * 105;
        const w = Kit.Worker(at(x, 1060, s), { ...opts, stroke: 2.5 / s });
        items.push(t => w.update({ pose, t }));
      });
      return { items };
    },
    render(t, ctx, state) { for (const f of state.items) f(t); },
  });
})();
