// Shared foundation for the asset kit (STYLE.md): palette, easing curves, text and shape helpers.
// Kit files (characters.js, ui.js, objects.js, docs.js) add their factories to window.Kit.
(() => {
  const { el, set, clamp } = Engine;

  const C = {
    bgDark: '#14233A', bgLight: '#F4F1EA', floor: '#D9D4C7', ink: '#1E2A3A', inkSoft: '#5B6878',
    paper: '#FFFFFF', accent: '#F2A93B', steel: '#7C8A99', steelDark: '#4B5868',
    carton: '#C9975B', cartonEdge: '#A97A41', safety: '#FFD23F', error: '#D64545',
    correct: '#2E9E6B', neutral: '#3F7FBF', onDarkSoft: '#B9C3D1',
    shirt: { worker: '#2F6FB0', supervisor: '#6B4FA3', driver: '#8A5A3C', analyst: '#3D8F86', manager: '#3D8F86', customer: '#B5651D' },
    skin: '#E8B993', trousers: '#2B3442', boots: '#3A2E26',
  };
  const STROKE = 2.5;

  // STYLE.md §5 cubic-bezier curves, solved numerically (Newton + bisection fallback).
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return p => {
      p = clamp(p);
      let t = p;
      for (let i = 0; i < 8; i++) {
        const err = sx(t) - p, d = dx(t);
        if (Math.abs(err) < 1e-6) return sy(t);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1; t = p;
      for (let i = 0; i < 30; i++) { const x = sx(t); if (Math.abs(x - p) < 1e-6) break; if (x < p) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  }
  const ease = {
    enter: bezier(0.2, 0.8, 0.2, 1),   // entrances and moves
    exit: bezier(0.4, 0, 0.2, 1),      // exits
    pop: p => { const c = 1.2 * 1.525; p = clamp(p); return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; }, // ease-out-back for small pops
    linear: p => clamp(p),
  };
  // Standard enter/exit progress for an element visible from tIn to tOut (STYLE: enter 0.4 s, exit 0.3 s).
  // Returns {p, o, dy}: p = 0..1 presence, o = opacity, dy = vertical offset (24 px rise in, 16 px out).
  function presence(t, tIn, tOut = Infinity, { enter = 0.4, exit = 0.3, rise = 24, fall = 16 } = {}) {
    const pin = ease.enter(clamp((t - tIn) / enter));
    const pout = ease.exit(clamp((t - (tOut - exit)) / exit));
    return { p: pin * (1 - pout), o: pin * (1 - pout), dy: (1 - pin) * rise - pout * fall };
  }

  function text(parent, str, { x = 0, y = 0, size = 34, weight = 600, fill = C.ink, anchor = 'start', spacing, upper = false, family } = {}) {
    const node = el('text', {
      x, y, 'font-size': size, 'font-weight': weight, fill, 'text-anchor': anchor,
      'font-family': family || 'Inter, system-ui, sans-serif',
      'letter-spacing': spacing != null ? `${spacing}em` : null,
      style: 'font-variant-numeric: tabular-nums',
    }, parent);
    node.textContent = upper ? String(str).toUpperCase() : str;
    return node;
  }
  // Width of a string in the kit font, for sizing chips and cards (measured once, cached).
  const widths = new Map();
  let probe;
  function measure(str, size = 34, weight = 600) {
    const key = `${size}|${weight}|${str}`;
    if (!widths.has(key)) {
      if (!probe) probe = el('text', { x: -9999, y: -9999, 'font-family': 'Inter, system-ui, sans-serif' }, document.getElementById('stage'));
      set(probe, { 'font-size': size, 'font-weight': weight, text: str });
      widths.set(key, probe.getComputedTextLength());
    }
    return widths.get(key);
  }
  // 10 percent ink ellipse under grounded objects.
  const shadow = (parent, w, { x = 0, y = 0 } = {}) => el('ellipse', { cx: x, cy: y, rx: w / 2, ry: Math.max(6, w * 0.06), fill: C.ink, opacity: 0.1 }, parent);
  const group = (parent, attrs = {}) => el('g', attrs, parent);
  // Show/hide a node cheaply (display none skips layout and paint).
  const show = (node, on) => set(node, { display: on ? 'inline' : 'none' });

  window.Kit = { C, STROKE, bezier, ease, presence, text, measure, shadow, group, show };
})();
