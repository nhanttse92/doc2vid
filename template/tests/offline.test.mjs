import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, symlink, stat, rm, copyFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const template = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = path.resolve(template, '../examples');
const offline = { DOC2VID_OFFLINE: '1' };
function run(cwd, command, args, env = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 900000, maxBuffer: 10 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\n${result.error || ''}`);
  return result.stdout;
}
async function browserAvailable(t) {
  try { const browser = await chromium.launch(); await browser.close(); return true; }
  catch (e) {
    const reason = /MachPortRendezvousServer.*Permission denied/s.test(e.message)
      ? 'macOS Mach port permission denied' : e.message.split('\n')[0];
    t.skip(`Chromium cannot launch in this sandbox: ${reason}`);
    return false;
  }
}
async function jobDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'doc2vid-job-'));
  await cp(template, dir, { recursive: true, filter: src => !['node_modules', 'build', 'out'].includes(path.basename(src)) });
  await symlink(path.join(template, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return dir;
}

test('offline audio, fallback generation and assembly work with synthetic scene video', { timeout: 180000 }, async () => {
  const dir = await jobDir();
  try {
    await copyFile(path.join(examples, 'mini/storyboard.json'), path.join(dir, 'storyboard.json'));
    run(dir, 'node', ['tools/validate-storyboard.mjs'], offline);
    const noKeyEnv = { ...process.env };
    delete noKeyEnv.OPENROUTER_API_KEY;
    delete noKeyEnv.OPENROUTER_ENV_FILE;
    delete noKeyEnv.DOC2VID_OFFLINE;
    const noKey = spawnSync('python3', ['narrate.py'], { cwd: dir, encoding: 'utf8', env: noKeyEnv });
    assert.equal(noKey.status, 1);
    assert.match(noKey.stderr, /Set OPENROUTER_API_KEY or OPENROUTER_ENV_FILE/);
    assert.doesNotMatch(noKey.stderr, /Traceback/);
    run(dir, 'python3', ['narrate.py'], offline);
    const narrationPath = path.join(dir, 'build/narration.json');
    const first = JSON.parse(await readFile(narrationPath, 'utf8'));
    const storyboardPath = path.join(dir, 'storyboard.json');
    const revised = JSON.parse(await readFile(storyboardPath, 'utf8'));
    revised.scenes[0].beats[0].id = 's01b01a';
    await writeFile(storyboardPath, JSON.stringify(revised));
    run(dir, 'node', ['tools/validate-storyboard.mjs'], offline);
    await writeFile(narrationPath, JSON.stringify({ ...first, obsolete: first.s01b01 }));
    run(dir, 'python3', ['narrate.py'], offline);
    const repeated = JSON.parse(await readFile(narrationPath, 'utf8'));
    assert.equal(repeated.obsolete, undefined);
    assert.equal(repeated.s01b01, undefined);
    assert.equal(repeated.s01b01a.wav, first.s01b01.wav);
    run(dir, 'python3', ['timing.py']);
    run(dir, 'python3', ['music.py'], offline);
    const timing = JSON.parse(await readFile(path.join(dir, 'build/timing.json'), 'utf8'));
    assert.equal(timing.fps, 6);
    await mkdir(path.join(dir, 'build/video'), { recursive: true });
    for (const scene of timing.scenes) {
      run(dir, 'node', ['tools/fallback-scene.mjs', scene.id]);
      run(dir, 'node', ['--check', `web/scenes/${scene.id}.js`]);
      run(dir, 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
        `color=c=navy:s=320x180:r=${timing.fps}`, '-frames:v', String(scene.frames),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `build/video/${scene.id}.mp4`]);
    }
    run(dir, 'python3', ['assemble.py', '--name', 'video', '--clean']);
    assert.ok((await stat(path.join(dir, 'out/video.mp4'))).size > 10000);
    assert.ok((await stat(path.join(dir, 'out/video.srt'))).size > 100);
    const probe = run(dir, 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'out/video.mp4']);
    assert.ok(Math.abs(Number(probe) - timing.total) < 0.5, `ffprobe ${probe}, timing ${timing.total}`);
    await assert.rejects(stat(path.join(dir, 'build/film_video.mp4')));
    await unlink(path.join(dir, 'build/music/m01.wav'));
    assert.match(run(dir, 'python3', ['assemble.py', '--name', 'no_music']), /warning: missing music bed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('offline mini job produces an MP4 and matching SRT with clean intermediates', { timeout: 1200000 }, async t => {
  if (!await browserAvailable(t)) return;
  const dir = await jobDir();
  try {
    await copyFile(path.join(examples, 'mini/storyboard.json'), path.join(dir, 'storyboard.json'));
    run(dir, 'node', ['tools/validate-storyboard.mjs'], offline);
    run(dir, 'python3', ['narrate.py'], offline);
    run(dir, 'python3', ['timing.py']);
    run(dir, 'python3', ['music.py'], offline);
    for (const id of ['s01', 's02']) {
      run(dir, 'node', ['tools/fallback-scene.mjs', id]);
      run(dir, 'node', ['nancheck.mjs', id]);
    }
    run(dir, 'node', ['render.mjs', 's01', 's02'], { JOBS: '2' });
    run(dir, 'python3', ['assemble.py', '--name', 'video', '--clean']);
    assert.ok((await stat(path.join(dir, 'out/video.mp4'))).size > 10000);
    assert.ok((await stat(path.join(dir, 'out/video.srt'))).size > 100);
    const timing = JSON.parse(await readFile(path.join(dir, 'build/timing.json'), 'utf8'));
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dir, 'out/video.mp4')], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    assert.ok(Math.abs(Number(probe.stdout) - timing.total) < 0.5, `ffprobe ${probe.stdout}, timing ${timing.total}`);
    await assert.rejects(stat(path.join(dir, 'build/film_video.mp4')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('warehouse example scene passes nancheck with its saved timing', { timeout: 180000 }, async t => {
  if (!await browserAvailable(t)) return;
  const dir = await jobDir();
  try {
    await copyFile(path.join(examples, 'warehouse/timing.js'), path.join(dir, 'web/timing.js'));
    await mkdir(path.join(dir, 'web/scenes'), { recursive: true });
    await copyFile(path.join(examples, 'warehouse/scenes/s01.js'), path.join(dir, 'web/scenes/s01.js'));
    run(dir, 'node', ['nancheck.mjs', 's01']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
