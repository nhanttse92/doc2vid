// Gallery for web/kit/ui.js: every component, state and icon, with time-based animations cycling
// every 10 s (gallery time = t + 0.5 s).   node shoot.mjs "kit=ui" 0,2.5,5,7.5 --sheet
// Extra pages at 1:1 for close inspection (add &page=NAME to the query):
//   big   abstract icons, line icons, marks, badges, callouts, clocks, hazard signs
//   ui    checklist, do/don't panel, timelines, lower third, heading, calendar, panels, tiles
//   card  Part VI section title card          quiz  quiz card
Engine.scene('gallery', {
  duration: 10,
  build(ctx) {
    const { el, place } = Engine, { C } = Kit;
    const root = ctx.root;
    const page = new URLSearchParams(location.search).get('page') || 'grid';
    el('rect', { width: 1920, height: 1080, fill: C.bgLight }, root);
    const runs = [];
    const run = f => runs.push(f);
    const label = (x, y, s, fill = C.inkSoft, size = 15) => Kit.text(root, s, { x, y, size, weight: 600, fill });
    const at = (x, y, s = 1, parent = root) => { const g = el('g', {}, parent); place(g, { x, y, s }); return g; };
    let clipN = 0;
    // A scaled 1920x1080 frame (title card, quiz card), clipped to its edges, with a stand-in scene.
    const frame = (x, y, s) => {
      const id = `gal-clip-${++clipN}`;
      el('rect', { width: 1920, height: 1080 }, el('clipPath', { id }, el('defs', {}, root)));
      const g = at(x, y, s);
      const inner = el('g', { 'clip-path': `url(#${id})` }, g);
      el('rect', { width: 1920, height: 1080, fill: C.bgLight }, inner);
      Kit.text(inner, 'scene beneath', { x: 960, y: 560, size: 80, weight: 700, fill: C.steel, anchor: 'middle' });
      el('rect', { width: 1920, height: 1080, fill: 'none', stroke: C.ink, 'stroke-width': 6 }, g);
      return inner;
    };
    const ABS = ['Shield', 'Target', 'Lightbulb', 'Book', 'Ladder', 'Handshake', 'QuestionMark', 'ExclamationMark', 'Moon', 'Moon', 'Star'];
    const CLOCKS = [
      ['idle', { state: 'idle' }], ['fill 24 h', { state: 'fill', label: '24 h', color: 'neutral' }],
      ['fill 2 h + pulse', { state: 'fill', label: '2 h', color: 'error', pulse: true }],
      ['fill 8 h (to 0.66)', { state: 'fill', label: '8 h', color: 'accent', to: 0.66 }], ['fast-sweep', { state: 'fast-sweep' }],
      ['cut-off', { state: 'cut-off' }], ['end-of-shift', { state: 'end-of-shift' }], ['on-time', { state: 'on-time', label: 'On time' }],
    ];
    const S02 = [['Chock', 'truck'], ['Inspect\nand count', 'magnifier'], ['Sign', 'pen'], ['Sort', 'sort'], ['Check in', 'boxin'], ['Document', 'document'], ['File', 'folder']];
    const timelineTimes = { tIn: 0.2, active: [1.5, 3.5, 5.5], done: [2.5, 4.5, 6.5], pulse: [7.5, 7.75, 8.0, 8.25, 8.5, 8.75, 9.0] };

    if (page === 'grid') {
      // ---- Row 1: title cards, quiz card | lower third, heading, counters, dots, marks ----------
      const s1 = 0.18;
      label(24, 24, 'SectionTitleCard (in 0.3 s, wipes up at 7.6 s)');
      const card = Kit.SectionTitleCard(frame(24, 32, s1), { part: 'Part II', title: 'Receiving, Storing, Shipping', sub: '3. Receiving of Freight' });
      run(c => card.update({ t: c, tIn: 0.3, tWipe: 7.6 }));
      label(384, 24, 'SectionTitleCard hazard: true (Part VI)');
      const card6 = Kit.SectionTitleCard(frame(384, 32, s1), { part: 'Part VI', title: 'Safety', sub: '16. Warehouse Safety', hazard: true });
      run(c => card6.update({ t: c, tIn: -1, tWipe: 9.2 }));
      label(744, 24, 'QuizCard (dots 1 to 4.5 s, answer 4.5 s)');
      const quiz = Kit.QuizCard(frame(744, 32, s1), { question: 'Check in an emergency order within?', answer: '2 hours (stock orders: 24 hours)' });
      const qc1 = Kit.Clock(quiz.stage, { size: 260 }), qc2 = Kit.Clock(quiz.stage, { size: 260 });
      run(c => {
        quiz.update({ t: c, tIn: 0.2, think: [1.0, 4.5], tAnswer: 4.5 });
        qc1.update({ t: c, tIn: 0.4, state: 'fill', tState: 4.5, label: '2 h', color: 'error' });
        qc2.update({ t: c, tIn: 0.5, state: 'fill', tState: 5.5, label: '24 h' });
        place(qc1.g, { x: -220, o: c < 4.5 ? 0.45 : 1 }); place(qc2.g, { x: 220, o: c < 5.5 ? 0.45 : 1 });
      });
      label(1124, 24, 'LowerThird (in 0.5 s, crossfade 4 s, out 9.5 s)');
      const lt = Kit.LowerThird(at(1124, 36, 0.55), { texts: ['5. Storing of Parts', '6. Warehouse Location System'], x: 0, y: 0 });
      run(c => lt.update({ t: c, times: [0.5, 4.0], tOut: 9.5 }));
      label(1124, 108, 'Heading 48 px + sub (in 0.3 s)');
      const hd = Kit.Heading(at(1124, 116, 0.55), { text: 'Receiving of Freight', sub: 'Chock, inspect, count', x: 0, y: 44 });
      run(c => hd.update({ t: c, tIn: 0.3 }));
      label(1610, 24, 'Counter (ticks 1-5) / variant switch');
      const counter = Kit.Counter(at(1650, 58));
      run(c => counter.update({ t: c, tIn: 0.2, ticks: [1, 1.8, 2.6, 3.4, 4.2] }));
      const counter2 = Kit.Counter(at(1780, 58), { from: 6, format: v => `${v} of 6` });
      run(c => counter2.update({ t: c, tIn: 0.2, value: c < 5 ? 6 : 5, variant: c < 5 ? 'correct' : 'error' }));
      label(1610, 108, 'ThinkingDots');
      const dots = Kit.ThinkingDots(at(1660, 134));
      run(c => dots.update({ t: c, tIn: 0.2 }));
      label(1740, 108, 'Badge bump');
      const bb = Kit.Badge(at(1810, 134), { text: 'Daily', variant: 'accent' });
      run(c => bb.update({ t: c, tIn: 0.2, bump: c > 3 ? 3 : null }));
      label(1610, 174, 'GreenCheck / RedX (32 and 56 px)');
      [[Kit.GreenCheck, 32, 1630], [Kit.RedX, 32, 1675], [Kit.GreenCheck, 56, 1740], [Kit.RedX, 56, 1810]].forEach(([f, size, x], i) => {
        const m = f(at(x, 214), { size });
        run(c => m.update({ t: c, tIn: 0.5 + 0.3 * i }));
      });

      // ---- Row 2: checklists, do/don't panel, progress timelines ---------------------------------
      const y2 = 266;
      label(24, y2, 'Checklist (ticks, then glow)');
      const cl = Kit.Checklist(at(24, y2 + 10, 0.5), { title: 'Daily', items: ['Sweep floors and dock', 'Dust cabinets and shelves', 'Empty trash at end of shift'] });
      run(c => cl.update({ t: c, tIn: 0.1, ticks: [1.2, 2.0, 2.8] }));
      label(24, y2 + 168, 'Checklist with a fail (row 2)');
      const cl2 = Kit.Checklist(at(24, y2 + 176, 0.5), { items: ['Tyres', 'Brake fault', 'Lights'], width: 420 });
      run(c => cl2.update({ t: c, tIn: 0.1, ticks: [1.6, null, 3.2], fails: [null, 2.4] }));
      label(330, y2, "DoDontPanel (wrong first, outline pulses, then checks)");
      const dd = Kit.DoDontPanel(at(330, y2 + 12, 0.46), { width: 1000, rowHeight: 150, rows: [{ dont: 'Bin bulging', do: 'Larger bay' }, { dont: 'Basket overloaded', do: 'Normal load' }] });
      [[0, 'dont', 'box'], [0, 'do', 'box'], [1, 'dont', 'rack'], [1, 'do', 'rack']].forEach(([i, side, name]) => {
        const ic = Kit.Icon(dd.slot(i, side), { name, size: 64 });
        place(ic.g, { x: dd.cellW / 2, y: dd.contentH / 2 + 4 });
      });
      run(c => dd.update({ t: c, tIn: 0.2, rows: [{ dont: 0.6, do: 1.6 }, { dont: 2.4, do: 3.4 }] }));
      label(830, y2, 'ProgressTimeline: show 0.3 s+, active 1.5 / 3.5 / 5.5, done 2.5 / 4.5 / 6.5, re-pulse 7.5 s+');
      const tl = Kit.ProgressTimeline(at(870, y2 + 50, 0.6), { nodes: S02.map(([l, icon]) => ({ label: l, icon })), width: 1640 });
      run(c => tl.update({ t: c, ...timelineTimes }));
      el('rect', { x: 830, y: y2 + 116, width: 1066, height: 130, rx: 8, fill: C.bgDark }, root);
      label(846, y2 + 138, 'ProgressTimeline dark: true, numbered nodes, fixed states done / done / active / idle', C.onDarkSoft);
      const tl2 = Kit.ProgressTimeline(at(890, y2 + 174, 0.55), { nodes: ['Receive', 'Order', 'Count', 'Maintain', 'Safety', 'Closing'].map(l => ({ label: l })), width: 1760, dark: true });
      run(c => tl2.update({ t: c, active: [0, 0, 2], done: [0.5, 1.2] }));

      // ---- Row 3: callouts, badges, stamp ------------------------------------------------------
      const y3 = 574;
      label(24, y3, 'Callout: pointer down / up / left / right / none; variants accent, info, paper (pop 0.4 s+; red dot = origin)');
      [
        [{ text: 'Accuracy = credibility', pointer: 'down' }, 130, y3 + 72],
        [{ text: 'Inspect before shipment', pointer: 'up', at: 0.2 }, 300, y3 + 26],
        [{ text: 'Claim discrepancy', pointer: 'left', variant: 'info' }, 550, y3 + 50],
        [{ text: 'Yours to own\nand manage', pointer: 'right' }, 870, y3 + 52],
        [{ text: 'Late paperwork', pointer: 'none', variant: 'paper' }, 980, y3 + 50],
      ].forEach(([o, x, y], i) => {
        const co = Kit.Callout(at(x, y, 0.55), o);
        if (o.pointer !== 'none') el('circle', { cx: x, cy: y, r: 3, fill: C.error }, root);
        run(c => co.update({ t: c, tIn: 0.4 + 0.15 * i, tOut: 9.6 }));
      });
      label(1100, y3, 'Badge variants: ink paper accent neutral / correct error safety');
      ['ink', 'paper', 'accent', 'neutral', 'correct', 'error', 'safety'].forEach((v, i) => {
        const b = Kit.Badge(at(1150 + (i % 4) * 106, y3 + 30 + Math.floor(i / 4) * 44, 0.75), { text: v === 'error' ? '50 lb' : v === 'correct' ? 'Under' : v, variant: v });
        run(c => b.update({ t: c, tIn: 0.3 + 0.1 * i }));
      });
      label(1580, y3, 'Stamp (slams at 1.0 s)');
      const stamp = Kit.Stamp(at(1735, y3 + 50, 0.42));
      run(c => stamp.update({ t: c, tIn: 1.0 }));

      // ---- Row 4: clocks, calendar, hazard signs, stripes -----------------------------------------
      const y4 = 686;
      label(24, y4, 'Clock: ' + CLOCKS.map(c => c[0]).join(' / ') + ' (state at 1 s)');
      CLOCKS.forEach(([, p], i) => {
        const ck = Kit.Clock(at(80 + i * 122, y4 + 70, 0.5));
        run(c => ck.update({ t: c, tIn: 0.1, tState: 1.0, ...p }));
      });
      label(1010, y4, 'Calendar');
      const cal = Kit.Calendar(at(1010, y4 + 18, 0.42), { title: 'December' });
      run(c => cal.update({ t: c, tIn: 0.1 }));
      label(1250, y4, 'HazardSign flame / exclamation');
      const hz1 = Kit.HazardSign(at(1300, y4 + 76, 0.8)), hz2 = Kit.HazardSign(at(1420, y4 + 76, 0.8), { glyph: 'exclamation' });
      run(c => { hz1.update({ t: c, tIn: 0.3, swing: 3 }); hz2.update({ t: c, tIn: 0.5, swing: 3.2 }); });
      label(1530, y4, 'HazardStripe 24 px (moving) / 48 px');
      const st = Kit.HazardStripe(at(1530, y4 + 16), { width: 360, height: 24 });
      run(c => st.update({ t: c, speed: 12 }));
      const st2 = Kit.HazardStripe(at(1530, y4 + 56), { width: 360, height: 48, stripe: 32 });
      run(c => st2.update({ t: c }));

      // ---- Row 5: panels, tiles, abstract icons, line icons -------------------------------------
      const y5 = 888;
      label(24, y5, 'Panel x3 (marks x / check / none)');
      ['Customers rely on availability', 'Accurate and timely', "Everyone's area, done right"].forEach((cap, i) => {
        const pn = Kit.Panel(at(24 + i * 166, y5 + 10, 0.3), { caption: cap });
        const ic = Kit.Icon(pn.slot, { name: ['truck', 'clock', 'hand'][i], size: 160 });
        place(ic.g, { x: pn.areaW / 2, y: pn.areaH / 2 });
        run(c => pn.update({ t: c, tIn: 0.3 + 0.3 * i, mark: ['x', 'check', 'none'][i], tMark: 1.5 + 0.3 * i }));
      });
      label(530, y5, 'Tile (pop 0.5 s+)');
      [['Safe', 'Shield'], ['Efficient and accurate', 'Target'], ['Find better ways', 'Lightbulb'], ['Protects assets', 'box']].forEach(([l, icon], i) => {
        const tile = Kit.Tile(at(530 + i * 150, y5 + 10, 0.39), { label: l, icon });
        run(c => tile.update({ t: c, tIn: 0.5 + 0.25 * i, mark: i === 3 ? 'check' : 'none', tMark: 2.5 }));
      });
      label(1140, y5, 'Shield Target Lightbulb Book Ladder Handshake+Rings ? ! Moon(badge) Moon Star');
      ABS.forEach((name, i) => {
        const x = 1172 + i * 68;
        if (name === 'Handshake') {
          const rings = Kit.Rings(at(x, y5 + 46), { r0: 24, r1: 36, width: 2.5 });
          run(c => rings.update({ t: c, tIn: 0.5 }));
        }
        const ic = Kit[name](at(x, y5 + 46), { size: 56, ...(i === 8 ? { badge: true } : {}) });
        run(c => ic.update({ t: c, tIn: 0.6 + 0.12 * i }));
      });
      label(1140, y5 + 104, `Kit.Icon (${Kit.Icon.names.length} line icons; names on page=big)`);
      Kit.Icon.names.forEach((name, i) => {
        const ic = Kit.Icon(at(1160 + i * 43, y5 + 146), { name, size: 34 });
        run(c => ic.update({ color: c > 5 && i % 3 === 0 ? C.steel : C.ink }));
      });
    }

    if (page === 'big') {
      label(40, 40, 'Abstract icons at 150 px (entrance at 0.3 s + 0.1 i)', C.ink, 22);
      ABS.forEach((name, i) => {
        const ic = Kit[name](at(110 + i * 170, 150), { size: 150, ...(i === 8 ? { badge: true } : {}) });
        run(c => ic.update({ t: c, tIn: 0.3 + 0.1 * i }));
      });
      const rings = Kit.Rings(at(110 + 5 * 170, 150), { r0: 70, r1: 120 });
      run(c => rings.update({ t: c, tIn: 0.5 }));
      label(40, 270, 'Kit.Icon at 72 px, and at 26 px inside 44 px timeline nodes (idle / active / done in turn)', C.ink, 22);
      Kit.Icon.names.forEach((name, i) => {
        const x = 70 + i * 108;
        Kit.Icon(at(x, 330), { name, size: 72 });
        Kit.text(root, name, { x, y: 392, size: 16, weight: 600, fill: C.inkSoft, anchor: 'middle' });
        const [f, s, col] = [[C.paper, C.steel, C.steel], [C.accent, C.ink, C.ink], [C.correct, C.ink, C.paper]][i % 3];
        el('circle', { cx: x, cy: 432, r: 20.75, fill: f, stroke: s, 'stroke-width': 2.5 }, root);
        Kit.Icon(at(x, 432), { name, size: 26, color: col });
      });
      label(40, 480, 'Clock at 200 px: ' + CLOCKS.map(c => c[0]).join(' / ') + ' (state at 1 s)', C.ink, 22);
      CLOCKS.forEach(([, p], i) => {
        const ck = Kit.Clock(at(150 + i * 232, 610));
        run(c => ck.update({ t: c, tIn: 0.1, tState: 1.0, ...p }));
      });
      label(40, 790, 'Badges, marks, callouts, hazard signs at 1:1', C.ink, 22);
      ['ink', 'paper', 'accent', 'neutral', 'correct', 'error', 'safety'].forEach((v, i) => {
        const b = Kit.Badge(at(100 + i * 130, 840), { text: v === 'error' ? '50 lb' : v === 'correct' ? 'Under' : v, variant: v });
        run(c => b.update({ t: c, tIn: 0.3 + 0.1 * i }));
      });
      [[Kit.GreenCheck, 32, 1000], [Kit.RedX, 32, 1050], [Kit.GreenCheck, 56, 1120], [Kit.RedX, 56, 1190]].forEach(([f, size, x], i) => {
        const m = f(at(x, 840), { size });
        run(c => m.update({ t: c, tIn: 0.5 + 0.2 * i }));
      });
      const co1 = Kit.Callout(at(300, 1000), { text: 'One of the company\'s largest assets', pointer: 'down', at: 0.3 });
      const co2 = Kit.Callout(at(760, 950), { text: 'Information callout', pointer: 'left', variant: 'info' });
      const hz = Kit.HazardSign(at(1250, 940)), hz2 = Kit.HazardSign(at(1390, 940), { glyph: 'exclamation' });
      const stamp = Kit.Stamp(at(1690, 960), { size: 48 });
      run(c => { co1.update({ t: c, tIn: 0.4 }); co2.update({ t: c, tIn: 0.6 }); hz.update({ t: c, tIn: 0.3 }); hz2.update({ t: c, tIn: 0.4 }); stamp.update({ t: c, tIn: 1 }); });
    }

    if (page === 'ui') {
      const cl = Kit.Checklist(at(80, 60), { title: 'Before you count', items: ['Stock put away and receipted', 'Credit returns on the shelf', 'Orders pulled'] });
      run(c => cl.update({ t: c, tIn: 0.1, ticks: [1.2, 2.0, 2.8] }));
      const dd = Kit.DoDontPanel(at(780, 60, 0.66), { width: 1600, rowHeight: 200, rows: [{ dont: 'Two similar parts in one bin', do: 'Clearly different parts' }, {}] });
      run(c => dd.update({ t: c, tIn: 0.2 }));
      const tl = Kit.ProgressTimeline(at(160, 500), { nodes: S02.map(([l, icon]) => ({ label: l, icon })), width: 1600 });
      run(c => tl.update({ t: c, ...timelineTimes }));
      const lt = Kit.LowerThird(root, { texts: ['5. Storing of Parts', '6. Warehouse Location System'] });
      run(c => lt.update({ t: c, times: [0.5, 4.0], tOut: 9.5 }));
      const hd = Kit.Heading(root, { text: 'Receiving of Freight', y: 450 });
      run(c => hd.update({ t: c, tIn: 0.3 }));
      const cal = Kit.Calendar(at(1440, 600, 0.8), { title: 'Cycle counts' });
      run(c => cal.update({ t: c, tIn: 0.1 }));
      const pn = Kit.Panel(at(80, 610, 0.45), { caption: 'Customers rely on availability' });
      run(c => pn.update({ t: c, tIn: 0.3, mark: 'check', tMark: 1.5 }));
      [['Weekly safety meeting', 'Moon'], ['Keep learning', 'Book'], ['Career plan', 'Ladder'], ['A good attitude', 'Handshake']].forEach(([l, icon], i) => {
        const tile = Kit.Tile(at(360 + i * 262, 620, 0.68), { label: l, icon });
        run(c => tile.update({ t: c, tIn: 0.5 + 0.25 * i }));
      });
    }

    if (page === 'card') {
      const card = Kit.SectionTitleCard(root, { part: 'Part VI', title: 'Safety', sub: '16. Warehouse Safety', hazard: true });
      run(c => card.update({ t: c, tIn: 0.3, tWipe: 7.6 }));
    }

    if (page === 'quiz') {
      const quiz = Kit.QuizCard(root, { question: 'Pulled 2 of a package of 10?', answer: 'Empty the rest into the bin. Dispose of the packaging.' });
      const ck = Kit.Clock(quiz.stage, { size: 300 });
      run(c => { quiz.update({ t: c, tIn: 0.2, think: [1.0, 4.5], tAnswer: 4.5 }); ck.update({ t: c, tIn: 0.3, state: 'fill', tState: 4.5, label: '2 h', color: 'error', pulse: true }); });
    }

    return { runs };
  },
  render(t, ctx, state) {
    // Offset by 0.5 s so the t = 0 still catches entrances mid-way instead of an empty page.
    const c = (((t + 0.5) % 10) + 10) % 10;
    state.runs.forEach(f => f(c));
  },
});
