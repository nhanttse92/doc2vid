// Mounts one scene and exposes window.__seek(t) / window.__duration for render.mjs.
//   index.html?scene=s03          scene s03, frozen at t=0 (render.mjs drives it)
//   index.html?scene=s03&t=42.5   still at 42.5 s
//   index.html?scene=s03&play     real-time preview loop (no audio)
//   &scale=0.5 renders at 960x540; &grid overlays the safe area
//   index.html?kit=ui&t=2         a kit gallery page (web/kit/<name>.gallery.js), at time t
(() => {
  const params = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  const scale = Number(params.get('scale') || 1);
  stage.setAttribute('width', 1920 * scale);
  stage.setAttribute('height', 1080 * scale);
  window.onerror = (message, src, line) => { window.__error = `${message} (${(src || '').split('/').pop()}:${line})`; };

  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(script);
  });

  async function mount(id, timing, src) {
    await load(src);
    const def = Engine.scenes[id];
    if (!def) throw new Error(`${src} did not register Engine.scene('${id}', ...)`);
    const root = Engine.el('g', { id: `scene-${id}` }, stage);
    const ctx = Engine.context(timing, root);
    const state = def.build(ctx) || {};
    // Every scene opens and closes on the background colour, so scenes cut together as dips.
    const veil = Engine.el('rect', { x: 0, y: 0, width: 1920, height: 1080, class: 'veil' }, stage);
    window.__duration = timing.duration;
    window.__seek = t => {
      def.render(t, ctx, state);
      Engine.set(veil, { opacity: 1 - Engine.win(t, 0, timing.duration, 0.5) });
    };
  }

  async function main() {
    // Load Inter explicitly: fonts.ready alone resolves before any text has asked for it.
    await Promise.all([400, 500, 600, 700, 800].map(w => document.fonts.load(`${w} 40px Inter`)));
    await document.fonts.ready;
    if (params.has('kit')) {
      // A gallery script calls Engine.scene('gallery', def) like a scene; duration from def.duration.
      await load(`kit/${params.get('kit')}.gallery.js`);
      const def = Engine.scenes.gallery;
      if (!def) throw new Error('gallery script did not register Engine.scene(\'gallery\', ...)');
      const root = Engine.el('g', { id: 'gallery' }, stage);
      const timing = { id: 'gallery', title: 'Gallery', duration: def.duration || 10, beats: [] };
      const ctx = Engine.context(timing, root);
      const state = def.build(ctx) || {};
      window.__duration = timing.duration;
      window.__seek = t => def.render(t, ctx, state);
    } else {
      const id = params.get('scene');
      const timing = (window.TIMING?.scenes || []).find(s => s.id === id);
      if (!timing) throw new Error(`no scene "${id}" in timing.js`);
      await mount(id, timing, `scenes/${id}.js`);
    }
    if (params.has('grid')) {
      const g = Engine.el('g', { class: 'grid' }, stage);
      Engine.el('rect', { x: 96, y: 54, width: 1728, height: 972 }, g);
      Engine.el('rect', { x: 192, y: 108, width: 1536, height: 864 }, g);
    }
    window.__seek(Number(params.get('t') || 0));
    if (params.has('play')) {
      const t0 = performance.now();
      const tick = () => { window.__seek(((performance.now() - t0) / 1000) % window.__duration); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    window.__ready = true;
  }
  main().catch(e => { window.__error = e.message; console.error(e); });
})();
