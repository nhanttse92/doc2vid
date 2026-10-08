import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.cwd();
const timing = JSON.parse((await readFile('web/timing.js', 'utf8')).replace(/^[\s\S]*?window\.TIMING = /, '').replace(/;\s*$/, ''));
const browser = await chromium.launch();
await Promise.all(timing.scenes.map(async s => {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const url = pathToFileURL(path.join(root, 'web/index.html')); url.search = `?scene=${s.id}&scale=0.5`;
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready || window.__error);
  const bad = await page.evaluate(d => {
    const found = new Map();
    for (let i = 0; i < 150; i++) {
      const t = (i / 149) * d; window.__seek(t);
      for (const el of document.querySelectorAll('#stage *')) {
        for (const a of el.attributes) if (/NaN|undefined|Infinity/.test(a.value)) {
          const visible = el.getBoundingClientRect().width > 0 || el.closest('[display="none"]') === null;
          const key = `${el.tagName}[${a.name}]=${a.value.slice(0, 40)}${visible ? '' : ' (hidden)'}`;
          if (!found.has(key)) found.set(key, t.toFixed(1));
        }
      }
    }
    return [...found].slice(0, 6);
  }, s.frames / 30);
  const n = await readFile(`build/video/${s.id}.mp4`).then(() => true, () => false);
  console.log(s.id, 'frames', s.frames, bad.length ? 'BAD ' + JSON.stringify(bad) : 'clean');
  await page.close();
}));
await browser.close();
