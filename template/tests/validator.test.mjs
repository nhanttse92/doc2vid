import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const template = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = path.resolve(template, '../examples');
const validator = path.join(template, 'tools/validate-storyboard.mjs');
async function check(sb, env = { DOC2VID_OFFLINE: '1' }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'doc2vid-validate-'));
  try {
    await writeFile(path.join(dir, 'storyboard.json'), typeof sb === 'string' ? sb : JSON.stringify(sb));
    return spawnSync('node', [validator], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const fixture = name => readFile(path.join(examples, name, 'storyboard.json'), 'utf8').then(JSON.parse);

test('warehouse and mini storyboards validate', async () => {
  for (const name of ['warehouse', 'mini']) {
    const result = await check(await fixture(name));
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.match(result.stdout, /valid: \d+ scenes, \d+ beats, \d+ words, [\d.]+ estimated seconds/);
  }
});

test('invalid JSON and missing metadata fail clearly', async () => {
  assert.match((await check('{ broken')).stderr, /invalid JSON/);
  const sb = await fixture('mini');
  delete sb.meta.voice;
  delete sb.meta.audience;
  const result = await check(sb);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /meta.voice: required non-empty string/);
  assert.match(result.stderr, /meta.audience: required non-empty string/);
});

test('scene ids, music references, beat limits and text limits are enforced', async () => {
  const cases = [
    [sb => { sb.scenes[1].id = 's03'; }, /expected s02 in scene order/],
    [sb => { sb.scenes[0].music = 'missing'; }, /unknown music cue missing/],
    [sb => { sb.scenes[0].beats = []; }, /expected 1–12 beats/],
    [sb => { sb.scenes[0].beats[0].id = 'bad'; }, /expected s01bNN/],
    [sb => { sb.scenes[0].beats[0].narration += ' 42'; }, /digits are not allowed/],
    [sb => { sb.scenes[0].beats[0].narration += ' ' + 'word '.repeat(70); }, /exceeds 60/],
    [sb => { sb.scenes[0].beats[0].onscreen_text = Array(7).fill('item'); }, /at most 6 printable strings/],
    [sb => { sb.scenes[0].beats[0].visual = ''; }, /visual: required non-empty string/],
    [sb => { sb.meta.target_seconds = 1000; }, /word budget: .*expected .*allowed/],
  ];
  for (const [mutate, message] of cases) {
    const sb = await fixture('mini');
    mutate(sb);
    const result = await check(sb);
    assert.equal(result.status, 1, `expected failure for ${message}`);
    assert.match(result.stderr, message);
  }
});

test('printable Unicode and empty onscreen text are accepted', async () => {
  const sb = await fixture('mini');
  sb.scenes[0].beats[0].onscreen_text = [];
  sb.scenes[0].beats[0].narration += ' Café.';
  assert.equal((await check(sb)).status, 0);
});

test('production requires thirty fps and offline mode allows valid test frame rates', async () => {
  const sb = await fixture('mini');
  for (const value of ['', '0', 'true']) {
    const result = await check(sb, { DOC2VID_OFFLINE: value });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /meta.timing.fps: must be 30 unless DOC2VID_OFFLINE=1/);
  }
  assert.equal((await check(sb, { DOC2VID_OFFLINE: '1' })).status, 0);
  sb.meta.timing.fps = 0;
  assert.equal((await check(sb, { DOC2VID_OFFLINE: '1' })).status, 1);
  sb.meta.timing.fps = 30;
  assert.equal((await check(sb, { DOC2VID_OFFLINE: '' })).status, 0);
  delete sb.meta.timing;
  assert.equal((await check(sb, { DOC2VID_OFFLINE: '' })).status, 0);
});
