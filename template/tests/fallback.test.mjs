import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const template = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Run the real scene and kit code without Chromium. Text measurement is an estimate;
// browser tests remain responsible for actual font layout and rendering.
class SvgNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.textContent = ''; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  appendChild(node) { this.children.push(node); return node; }
  getComputedTextLength() {
    return Array.from(this.textContent).reduce((width, char) =>
      width + (/\s/u.test(char) ? 0.3 : char.codePointAt(0) > 255 ? 1 : 0.6), 0) * Number(this.attrs['font-size']);
  }
}
function nodes(root) { return [root, ...root.children.flatMap(nodes)]; }
const sources = await Promise.all(['engine.js', 'kit/base.js', 'kit/characters.js', 'kit/ui.js']
  .map(file => readFile(path.join(template, 'web', file), 'utf8')));

test('fallback handles one to twelve beats with readable, finite and deterministic kit scenes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'doc2vid-fallback-'));
  try {
    for (let count = 1; count <= 12; count++) {
      const labels = [[], ['', '  '], ['Ask for help when needed', 'Keep  spaces  exact'],
        ['界'.repeat(70), '👷🏽'.repeat(12), 'Café équipe – prêt'],
        Array(6).fill(Array(3).fill('界'.repeat(22)).join(' '))];
      const beats = Array.from({ length: count }, (_, i) => ({
        id: `s01b${String(i + 1).padStart(2, '0')}`,
        narration: 'Look at the route and prepare the load before moving safely.',
        visual: 'A worker points to the route.',
        onscreen_text: labels[i % labels.length],
      }));
      const title = count === 12 ? 'A'.repeat(200) : 'Before the Lift';
      const sb = { meta: { title, voice: 'Charon', persona: 'Calm', audience: 'new employees', target_seconds: count * 4.8 },
        music: [{ id: 'm01', prompt: 'Quiet instrumental', scenes: ['s01'] }],
        scenes: [{ id: 's01', title, mood: 'Calm', music: 'm01', beats }] };
      await writeFile(path.join(dir, 'storyboard.json'), JSON.stringify(sb));
      for (const [tool, ...args] of [['validate-storyboard.mjs'], ['fallback-scene.mjs', 's01']]) {
        const result = spawnSync('node', [path.join(template, 'tools', tool), ...args], { cwd: dir, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
      const stage = new SvgNode('svg'), root = stage.appendChild(new SvgNode('g'));
      const sandbox = vm.createContext({ Intl, document: {
        createElementNS: (_, tag) => new SvgNode(tag), getElementById: () => stage,
      } });
      sandbox.window = sandbox;
      for (const source of sources) vm.runInContext(source, sandbox);
      vm.runInContext(await readFile(path.join(dir, 'web/scenes/s01.js'), 'utf8'), sandbox);
      const duration = 1 + count * 5;
      const ctx = sandbox.Engine.context({ id: 's01', title, duration,
        beats: beats.map((beat, i) => ({ id: beat.id, start: 0.8 + i * 5, dur: 4.5, end: 5.8 + i * 5, slot: 5 })),
      }, root);
      const scene = sandbox.Engine.scenes.s01, state = scene.build(ctx);
      assert.equal(state.beats.length, count);
      assert.ok(state.beats[0].empty);
      assert.equal(root.children[0].attrs.fill, '#F4F1EA');
      assert.match(state.worker.g.attrs.transform, /scale\(1\.4000 1\.4000\)/);
      const introText = nodes(state.intro.g).filter(node => node.tag === 'text' && node.attrs['font-size'] === '88');
      assert.ok(introText.length > 0);
      assert.ok(introText.every(node => node.attrs.fill === '#FFFFFF'));
      const texts = state.beats.flatMap(beat => beat.rows.flatMap(row => nodes(row.label.g).filter(node => node.tag === 'text')));
      for (const node of texts) {
        assert.ok(Number(node.attrs['font-size']) >= 34);
        assert.ok(node.getComputedTextLength() <= 1120, node.textContent);
      }
      if (count >= 3) {
        assert.ok(texts.some(node => node.textContent === 'Ask for help when needed'));
        assert.ok(texts.some(node => node.textContent === 'Keep  spaces  exact'));
      }
      if (count >= 4) assert.ok(texts.some(node => /^界+…$/u.test(node.textContent)));
      if (count >= 5) {
        const wrapped = state.beats[4].rows.flatMap(row => nodes(row.label.g).filter(node => node.tag === 'text'));
        assert.ok(wrapped.length > 6, 'long labels wrap onto multiple lines');
        for (const node of wrapped) {
          assert.equal(node.textContent, '界'.repeat(22), 'wrap only between the original words');
          const baseline = Number(node.attrs.y);
          assert.ok(baseline >= 34 && baseline <= state.panel.h - 16, 'wrapped labels stay inside the panel');
        }
      }
      const snapshot = t => {
        scene.render(t, ctx, state);
        for (const node of nodes(root)) for (const [attr, value] of Object.entries(node.attrs)) {
          assert.doesNotMatch(value, /NaN|undefined|Infinity/, `${count} beats at ${t}: ${attr}`);
        }
        return JSON.stringify(root);
      };
      assert.equal(snapshot(0), snapshot(14 / 30), 'first fifteen frames must hold');
      assert.equal(snapshot(duration - 0.5), snapshot(duration - 1 / 30), 'last fifteen frames must hold');
      for (const time of [3.5, duration / 2, ...ctx.beats.flatMap(beat => [beat.start - 0.01, beat.start, beat.start + 0.3])]) {
        const first = snapshot(time);
        snapshot(duration);
        snapshot(0);
        assert.equal(snapshot(time), first, `seeking at ${time} must be deterministic`);
      }
      for (let i = 1; i < count; i++) {
        snapshot(ctx.beats[i].start + 0.5);
        assert.equal(state.beats[i - 1].group.attrs.opacity, '0');
        assert.equal(state.beats[i].group.attrs.opacity, '1');
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
