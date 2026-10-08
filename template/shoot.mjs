// Screenshot the player at given times, for checking scenes and kit galleries by eye.
//   node shoot.mjs "scene=s03" 0,12.5,40            -> build/shots/s03-0.png, ... (960x540)
//   node shoot.mjs "kit=characters" 0,1,2 --full     -> full 1920x1080
//   node shoot.mjs "scene=s03" 0,12.5,40 --sheet     -> also build/shots/s03-sheet.png (3 per row)
// Prints any page errors. Times may be beat ids (frame at 60% of the beat's slot).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const [query, times = '0', ...flags] = process.argv.slice(2);
if (!query || !/^(scene=s\d{2}|kit=[a-z]+)$/.test(query)) { console.error('usage: node shoot.mjs "scene=s01" <times> [--sheet] [--full]'); process.exit(1); }
const full = flags.includes('--full'), sheet = flags.includes('--sheet');
const scale = full ? 1 : 0.5;
let timing;
try {
  timing = JSON.parse((await readFile(path.join(root, 'web/timing.js'), 'utf8')).replace(/^[\s\S]*?window\.TIMING = /, '').replace(/;\s*$/, ''));
} catch (e) { console.error(`web/timing.js missing or invalid: ${e.message}`); process.exit(1); }
const sceneId = new URLSearchParams(query).get('scene');
const target = sceneId ? `web/scenes/${sceneId}.js` : `web/kit/${new URLSearchParams(query).get('kit')}.gallery.js`;
try { await access(path.join(root, target)); }
catch { console.error(`missing ${target}`); process.exit(1); }
const beats = Object.fromEntries(timing.scenes.flatMap(s => s.beats.map(b => [b.id, b])));
const at = times.split(',').map(x => (beats[x] ? beats[x].start + beats[x].slot * 0.6 : Number(x)));
if (at.some(t => !Number.isFinite(t) || t < 0)) { console.error(`invalid time or beat id: ${times}`); process.exit(1); }
const name = new URLSearchParams(query).get('scene') || `kit-${new URLSearchParams(query).get('kit')}`;
const dir = path.join(root, 'build/shots');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920 * scale, height: 1080 * scale } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const url = pathToFileURL(path.join(root, 'web/index.html'));
url.search = `?${query}&scale=${scale}`;
await page.goto(url.href);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 30000 });
const failure = await page.evaluate(() => window.__error);
if (failure) errors.push(failure);
const files = [];
if (!failure) for (const t of at) {
  await page.evaluate(t => window.__seek(t), t);
  const file = path.join(dir, `${name}-${t}.png`);
  await page.screenshot({ path: file });
  files.push(file);
}
await browser.close();
if (sheet && files.length) {
  const out = path.join(dir, `${name}-sheet.png`);
  const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex',
    `${files.map((_, i) => `[${i}:v]scale=640:360[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|')}:fill=black`,
    '-frames:v', '1', out].concat(files.length === 1 ? [] : []));
  files.push(out);
}
for (const f of files) console.log(path.relative(root, f));
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
