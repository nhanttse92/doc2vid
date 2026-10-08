#!/usr/bin/env node
// Write a deterministic scene from the shared kit when custom animation is unavailable.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const id = process.argv[2];
if (!/^s\d{2}$/.test(id || '')) {
  console.error('usage: node tools/fallback-scene.mjs <sceneId>');
  process.exit(1);
}
const root = process.cwd();
const storyboard = JSON.parse(await readFile(path.join(root, 'storyboard.json'), 'utf8'));
const scene = storyboard.scenes.find(s => s.id === id);
if (!scene) { console.error(`scene ${id} is not in storyboard.json`); process.exit(1); }
const data = scene.beats.map(beat => ({ id: beat.id, lines: beat.onscreen_text }));
const code = String.raw`// Generated fallback for ${id}; all animation derives from scene time and ctx.beat.
(() => {
  const spec = ${JSON.stringify(data)};
  const title = ${JSON.stringify(scene.title)};
  const C = Kit.C;
  const PANEL = { x: 480, width: 1280, textX: 112, textWidth: 1120 };
  const WORKER = { x: 280, y: 880, s: 1.4 }; // approximately 367 px tall
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  function fitWord(word, size, weight, width) {
    if (Kit.measure(word, size, weight) <= width) return word;
    const chars = Array.from(graphemes.segment(word), part => part.segment);
    let lo = 0, hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (Kit.measure(chars.slice(0, mid).join('') + '…', size, weight) <= width) lo = mid;
      else hi = mid - 1;
    }
    return chars.slice(0, lo).join('') + '…';
  }

  // Wrap at whitespace only. A single word wider than a line is shortened, never split.
  function wrap(text, size, weight, width) {
    const lines = [];
    let line = '';
    for (const match of text.matchAll(/(\s*)(\S+)/gu)) {
      const word = fitWord(match[2], size, weight, width);
      const next = line ? line + match[1] + word : word;
      if (line && Kit.measure(next, size, weight) > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Titles have a bounded footprint; shorten an overlong title at a word boundary.
  function titleText(size, width, limit, weight = 700) {
    const lines = wrap(title, size, weight, width);
    if (lines.length <= limit) return lines.join('\n');
    const last = lines[limit - 1].split(/\s+/u);
    while (last.length > 1 && Kit.measure(last.join(' ') + '…', size, weight) > width) last.pop();
    return [...lines.slice(0, limit - 1), fitWord(last.join(' ') + '…', size, weight, width)].join('\n');
  }

  Engine.scene(${JSON.stringify(id)}, {
    build(ctx) {
      Engine.el('rect', { width: 1920, height: 1080, fill: C.bgLight }, ctx.root);
      const heading = Kit.Heading(ctx.root, { text: titleText(48, 1760, 1), size: 48, color: C.ink });
      const plans = spec.map(beat => {
        const labels = beat.lines.filter(line => line.trim());
        let size = labels.length <= 2 ? 44 : labels.length <= 4 ? 40 : 34;
        let rows, height, gap;
        do {
          gap = labels.length <= 3 ? 32 : 8;
          rows = labels.map(line => {
            const lines = wrap(line, size, 600, PANEL.textWidth);
            return { text: lines.join('\n'), height: lines.length * Math.round(size * 1.12) };
          });
          height = rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * gap;
          if (height <= 736 || size === 34) break;
          size = Math.max(34, size - 2);
        } while (true);
        return { id: beat.id, rows, size, gap, height };
      });
      const panelHeight = Math.max(640, Math.min(784, Math.max(...plans.map(plan => plan.height)) + 48));
      const panelY = 576 - panelHeight / 2;
      const panel = Kit.Panel(ctx.root, { width: PANEL.width, height: panelHeight });
      Engine.place(panel.g, { x: PANEL.x, y: panelY });
      const worker = Kit.Worker(ctx.root, { seed: 1, stroke: Kit.STROKE / WORKER.s });
      Engine.place(worker.g, WORKER);
      const poses = [[0, 'stand']], targets = [];
      const beats = plans.map(plan => {
        const timing = ctx.beat(plan.id);
        const group = Kit.group(panel.slot);
        let top = (panelHeight - plan.height) / 2;
        const rows = plan.rows.map((row, j) => {
          const at = timing.start + j * timing.dur * 0.8 / plan.rows.length;
          const label = Kit.Heading(group, { text: row.text, size: plan.size, weight: 600,
            color: C.ink, x: PANEL.textX, y: top + plan.size * 0.9, maxWidth: PANEL.textWidth });
          const mark = Kit.GreenCheck(group, { size: 40 });
          Engine.place(mark.g, { x: 64, y: top + Math.round(plan.size * 1.12) / 2 });
          const targetY = panelY + top + Math.min(row.height / 2, 48);
          const aim = Engine.clamp(Math.atan2(PANEL.x + 64 - WORKER.x,
            targetY - (WORKER.y - 180 * WORKER.s)) * 180 / Math.PI, 25, 155);
          poses.push([at, 'point']);
          targets.push({ at, aim });
          top += row.height + plan.gap;
          return { label, mark, at };
        });
        const empty = rows.length ? null : Kit.Heading(group, {
          text: titleText(48, 1120, 2), size: 48, color: C.ink,
          x: PANEL.width / 2, y: panelHeight / 2, anchor: 'middle', maxWidth: 1120,
        });
        if (empty) poses.push([timing.start, 'stand']);
        return { id: plan.id, group, rows, empty };
      });
      const aims = [[0, 92]];
      targets.forEach((target, i) => {
        const span = Math.min(0.2, (targets[i + 1]?.at ?? ctx.duration) - target.at);
        aims.push([target.at, i ? targets[i - 1].aim : 92], [target.at + Math.max(0, span), target.aim]);
      });
      const intro = Kit.SectionTitleCard(ctx.root, { title: titleText(88, 1680, 2, 800) });
      // Usually wipe at 2.5 s; shorten the intro when the opening beat is very brief.
      const introOut = Math.min(2.5, Math.max(0.5, ctx.beat(spec[0].id).end - 0.8), Math.max(0.5, ctx.duration - 1.1));
      return { heading, panel, worker, beats, intro, introOut, poses, aims };
    },
    render(t, ctx, state) {
      // Hold the composition through the first/last fifteen frames; player handles the fades.
      const time = Engine.clamp(t, 0.5, Math.max(0.5, ctx.duration - 0.5));
      const after = ctx.duration + 1;
      state.heading.update({ t: time, tIn: 0.5, tOut: after });
      state.panel.update({ t: time, tIn: 0.5, tOut: after, from: 'below' });
      state.beats.forEach((beat, i) => {
        const slot = ctx.beat(beat.id);
        const out = i + 1 < state.beats.length ? ctx.beat(state.beats[i + 1].id).start : after;
        Engine.set(beat.group, { opacity: Engine.win(time, slot.start, out, 0.25) });
        beat.rows.forEach(row => {
          row.label.update({ t: time, tIn: row.at, tOut: after });
          row.mark.update({ t: time, tIn: row.at + 0.15, tOut: after });
        });
        if (beat.empty) beat.empty.update({ t: time, tIn: slot.start, tOut: after });
      });
      state.worker.update({ t: time, ...Kit.Worker.poseAt(time, state.poses), aim: Engine.keys(time, state.aims) });
      // Keep the title fully composed beneath the player's opening fade.
      state.intro.update({ t: time, tIn: -1, tWipe: state.introOut });
    },
  });
})();
`;
const folder = path.join(root, 'web', 'scenes');
await mkdir(folder, { recursive: true });
await writeFile(path.join(folder, `${id}.js`), code);
console.log(`wrote web/scenes/${id}.js (${data.length} beats)`);
