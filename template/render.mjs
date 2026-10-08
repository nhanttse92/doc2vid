// Render scenes frame by frame: headless Chromium seeks the player to each frame time,
// captures it, and pipes the frames to ffmpeg. Each scene gets its own browser so scenes
// render in parallel on separate renderer processes.
//
//   node render.mjs                  # every scene in web/timing.js, JOBS at a time
//   node render.mjs s03 s07          # just these
//   node render.mjs --draft s03      # 960x540 at 15 fps, for quick checks
//   node render.mjs --stills s03     # one PNG per beat midpoint in build/stills/
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const draft = args.includes('--draft'), stills = args.includes('--stills');
const timing = JSON.parse((await readFile(path.join(root, 'web/timing.js'), 'utf8')).replace(/^[\s\S]*?window\.TIMING = /, '').replace(/;\s*$/, ''));
const ids = args.filter(a => !a.startsWith('--'));
const scenes = timing.scenes.filter(s => !ids.length || ids.includes(s.id));
const JOBS = Number(process.env.JOBS || Math.max(2, Math.min(8, os.cpus().length - 4)));
const fps = draft ? 15 : timing.fps;
const scale = draft ? 0.5 : 1;

async function renderScene(scene) {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920 * scale, height: 1080 * scale }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const url = pathToFileURL(path.join(root, 'web/index.html'));
    url.search = `?scene=${scene.id}${draft ? '&scale=0.5' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 30000 });
    const failure = await page.evaluate(() => window.__error);
    if (failure) throw new Error(`${scene.id}: ${failure}`);
    const cdp = await page.context().newCDPSession(page);
    const capture = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');

    if (stills) {
      const dir = path.join(root, 'build/stills');
      await mkdir(dir, { recursive: true });
      const { writeFile } = await import('node:fs/promises');
      for (const beat of scene.beats) {
        const t = beat.start + beat.slot * 0.6;
        await page.evaluate(t => window.__seek(t), t);
        await writeFile(path.join(dir, `${beat.id}.png`), await capture());
      }
      return { id: scene.id, stills: scene.beats.length, errors };
    }

    const out = path.join(root, draft ? 'build/draft' : 'build/video', `${scene.id}.mp4`);
    await mkdir(path.dirname(out), { recursive: true });
    const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'medium', '-crf', draft ? '26' : '16', '-pix_fmt', 'yuv420p',
      '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const frames = Math.round(scene.duration * fps);
    const started = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate(t => window.__seek(t), f / fps);
      if (!ffmpeg.stdin.write(await capture())) await once(ffmpeg.stdin, 'drain');
      if (errors.length) throw new Error(`${scene.id} at frame ${f}: ${errors[0]}`);
    }
    ffmpeg.stdin.end();
    const [code] = await once(ffmpeg, 'close');
    if (code !== 0) throw new Error(`${scene.id}: ffmpeg exited ${code}`);
    return { id: scene.id, frames, seconds: Math.round((Date.now() - started) / 1000), out: path.relative(root, out) };
  } finally {
    await browser.close();
  }
}

const queue = [...scenes], results = [];
let failed = false;
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) {
    const scene = queue.shift();
    try {
      const r = await renderScene(scene);
      results.push(r);
      console.log(JSON.stringify(r));
    } catch (e) {
      failed = true;
      console.error(`FAILED ${scene.id}: ${e.message}`);
    }
  }
}));
process.exit(failed ? 1 : 0);
