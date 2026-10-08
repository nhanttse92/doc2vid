// Sample scene frames and fail if any SVG attribute contains a non-finite value.
import { chromium } from 'playwright';
import { readFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
if (args.length !== 1 || (args[0] !== '--all' && !/^s\d{2}$/.test(args[0]))) {
  console.error('usage: node nancheck.mjs <sceneId> | --all');
  process.exit(1);
}
let timing;
try {
  timing = JSON.parse((await readFile(path.join(root, 'web/timing.js'), 'utf8')).replace(/^[\s\S]*?window\.TIMING = /, '').replace(/;\s*$/, ''));
} catch (e) { console.error(`web/timing.js missing or invalid: ${e.message}`); process.exit(1); }
const scenes = args[0] === '--all' ? timing.scenes : timing.scenes.filter(s => s.id === args[0]);
if (!scenes.length) { console.error(`scene ${args[0]} is not in web/timing.js`); process.exit(1); }
for (const scene of scenes) {
  try { await access(path.join(root, 'web/scenes', `${scene.id}.js`)); }
  catch { console.error(`missing web/scenes/${scene.id}.js`); process.exit(1); }
}
const browser = await chromium.launch();
let failed = false;
try {
  for (const scene of scenes) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      const url = pathToFileURL(path.join(root, 'web/index.html'));
      url.search = `?scene=${scene.id}&scale=0.5`;
      await page.goto(url.href);
      await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 30000 });
      const bad = await page.evaluate(({ frames, fps }) => {
        if (window.__error) return [`player: ${window.__error}`];
        const found = new Map();
        for (let i = 0; i < frames; i++) {
          const t = i / fps;
          window.__seek(t);
          for (const el of document.querySelectorAll('#stage *')) {
            for (const attr of el.attributes) if (/NaN|undefined|Infinity/.test(attr.value)) {
              const key = `${el.tagName}[${attr.name}]=${attr.value.slice(0, 70)}`;
              if (!found.has(key)) found.set(key, t.toFixed(2));
            }
          }
        }
        return [...found].map(([key, time]) => `${time}s ${key}`).slice(0, 12);
      }, { frames: scene.frames, fps: timing.fps });
      if (bad.length || errors.length) {
        failed = true;
        console.error(`${scene.id}: ${[...bad, ...errors].join('; ')}`);
      } else console.log(`${scene.id}: clean (${scene.frames} frames, ${timing.fps} fps)`);
    } catch (e) { failed = true; console.error(`${scene.id}: ${e.message}`); }
    finally { await page.close(); }
  }
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
