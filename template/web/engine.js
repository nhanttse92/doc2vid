// Deterministic, time-driven SVG animation. A scene builds its SVG nodes once, then
// render(t) sets every attribute from the scene-local time t alone, so the renderer can
// seek to any frame in any order and get the same picture.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1920, H = 1080;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = {
    linear: p => p,
    in: p => p * p * p,
    out: p => 1 - (1 - p) ** 3,
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
    back: p => { const c = 1.70158; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; },
  };
  // Progress 0→1 of an animation starting at t0 and lasting d seconds.
  const prog = (t, t0, d = 0.6, fn = ease.inOut) => (d <= 0 ? (t >= t0 ? 1 : 0) : fn(clamp((t - t0) / d)));
  // Visibility window: fades in over f from a, holds, fades out to 0 by b.
  const win = (t, a, b, f = 0.4) => Math.min(prog(t, a, f, ease.out), 1 - prog(t, b - f, f, ease.in));
  // Piecewise-linear keyframes: keys = [[t0, v0], [t1, v1], ...], eased between neighbours.
  const keys = (t, pairs, fn = ease.inOut) => {
    if (t <= pairs[0][0]) return pairs[0][1];
    for (let i = 1; i < pairs.length; i++) {
      const [t0, v0] = pairs[i - 1], [t1, v1] = pairs[i];
      if (t <= t1) return lerp(v0, v1, fn(clamp((t - t0) / Math.max(1e-6, t1 - t0))));
    }
    return pairs[pairs.length - 1][1];
  };

  function set(node, attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'text') { if (node.textContent !== String(v)) node.textContent = v; continue; }
      const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
      if (node.getAttribute(k) !== s) node.setAttribute(k, s);
    }
    return node;
  }
  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    set(node, attrs);
    if (parent) parent.appendChild(node);
    return node;
  }
  // Position a group: x/y translate, s scale (number or [sx, sy]), r rotation in degrees, o opacity.
  function place(node, { x = 0, y = 0, s = 1, r = 0, o } = {}) {
    const [sx, sy] = Array.isArray(s) ? s : [s, s];
    let tf = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
    if (r) tf += ` rotate(${r.toFixed(2)})`;
    if (sx !== 1 || sy !== 1) tf += ` scale(${sx.toFixed(4)} ${sy.toFixed(4)})`;
    set(node, { transform: tf });
    if (o != null) set(node, { opacity: clamp(o) });
    return node;
  }

  const scenes = {};
  const scene = (id, def) => { scenes[id] = def; };

  function context(timing, root) {
    const byId = Object.fromEntries(timing.beats.map(b => [b.id, b]));
    const beat = id => {
      if (!byId[id]) throw new Error(`unknown beat ${id}`);
      return byId[id];
    };
    // Approximate moment a phrase is spoken in a beat, from its character position in the
    // narration (at = a phrase), or a fraction of the narration (at = 0..1).
    const cue = (id, at = 0, nth = 0) => {
      const b = beat(id);
      if (typeof at === 'number') return b.start + b.dur * at;
      const text = b.text.toLowerCase();
      let i = -1;
      for (let k = 0; k <= nth; k++) {
        i = text.indexOf(at.toLowerCase(), i + 1);
        if (i < 0) throw new Error(`"${at}" not found in ${id}`);
      }
      return b.start + b.dur * (i / Math.max(1, text.length));
    };
    return { root, id: timing.id, title: timing.title, duration: timing.duration, beats: timing.beats, beat, cue, W, H };
  }

  window.Engine = { NS, W, H, clamp, lerp, ease, prog, win, keys, set, el, place, scene, scenes, context };
})();
