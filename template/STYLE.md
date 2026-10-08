# STYLE.md — visual style guide for training videos

Shared by every scene builder. Scenes are built independently in JavaScript (SVG or canvas), rendered frame by frame to 1920×1080 PNGs and assembled into one MP4. Follow this guide exactly so every scene cuts together as one film.

## 1. Canvas, timing, layout

- **Canvas:** 1920×1080, 30 fps. Frame numbers are integers; time in a scene starts at 0 at the scene's first frame.
- **Safe margins:** keep all text and important shapes inside a 1760×960 box (80 px in from every edge). The lower-third band and the progress timeline may touch the bottom safe line but not go below it.
- **Grid:** 12 columns, 120 px each, 40 px gutters, starting at x = 80. Vertical rhythm on 8 px. Common layouts:
  - *Full stage* — one illustration centred, title or caption at the top.
  - *Split 5/7* — text or checklist in columns 1–5, illustration in columns 6–12 (or mirrored).
  - *Three-panel strip* — three 520 px panels with 40 px gaps, centred.
  - *Lower third* — band at y = 900–980, x from 80, width to fit text.
- **Durations:** `web/timing.js` is generated from the measured narration. Use `ctx.beat` and `ctx.cue` for timing. Hold frames are at the end of a beat unless the visual says otherwise (quiz beats put the hold between question and answer).

## 2. Palette

Flat colours, no gradients except a 4 percent vignette on title cards. Every colour has one job.

| Token | Hex | Use |
|---|---|---|
| `bg-dark` | `#14233A` | Title cards, opening, closing, recap |
| `bg-light` | `#F4F1EA` | Default scene background (warm off-white) |
| `floor` | `#D9D4C7` | Floor plane, dock concrete |
| `ink` | `#1E2A3A` | Primary text on light, outlines (2.5 px strokes) |
| `ink-soft` | `#5B6878` | Secondary text, dimmed elements |
| `paper` | `#FFFFFF` | Documents, cards, label faces |
| `accent` | `#F2A93B` | Highlights, section marker, active timeline node, callout fills |
| `steel` | `#7C8A99` | Racks, forklift mast, truck body, equipment |
| `steel-dark` | `#4B5868` | Rack uprights, shadows |
| `carton` | `#C9975B` | Cartons and pallets (plus `#A97A41` for edges) |
| `safety` | `#FFD23F` | Hazard stripes, warning placards, hi-vis vest, PPE call-outs |
| `error` | `#D64545` | Red X, wrong examples, damage outlines, emergency timer, tag-out tag |
| `correct` | `#2E9E6B` | Green check, right examples, completed items |
| `neutral` | `#3F7FBF` | Neutral lanes, timers, information callouts |
| `worker-shirt` | `#2F6FB0` | The Worker's shirt (Supervisor `#6B4FA3`, Driver `#8A5A3C`, Analyst/Manager `#3D8F86`, Customer `#B5651D`) |
| `worker-skin` | `#E8B993` | Single skin tone for all characters (flat, no faces beyond two dot eyes) |

Text on `bg-dark` is `paper`; text on `bg-light` is `ink`. Never put `error` text on `bg-dark` without a `paper` chip behind it.

## 3. Typography

One bundled web font, loaded from a local file so renders are deterministic: **Inter** (Variable or static 400/600/800). Fallback `system-ui`. Numerals use `font-variant-numeric: tabular-nums`.

| Role | Size / weight | Notes |
|---|---|---|
| Section marker | 36 px, 600, letter-spacing 0.18em, uppercase, `accent` | Title cards only |
| Title card title | 88 px, 800 | Line height 1.05, max 2 lines |
| Title card sub-line | 40 px, 400, `ink-soft` on light / `#B9C3D1` on dark | a short section subtitle |
| Scene caption / heading | 48 px, 700 | Top-left of stage |
| Lower-third text | 34 px, 600 | Section name |
| Checklist item | 34 px, 500 | 3–6 words |
| Label on asset (part numbers, tags) | 24–28 px, 600 | Never smaller than 22 px |
| Callout text | 30 px, 600 | Max 2 lines |
| Quiz question | 52 px, 700 | Quiz answer 44 px, 600, `correct` |

Keep on-screen text short: titles, 3–6 word bullets, labels. No sentences on screen except quiz questions and answers.

## 4. Recurring treatments

**Section title card.** `bg-dark`, 4 percent vignette. Optional section marker in small caps at y = 360, title at y = 430, sub-line at y = 560, all centred. A 160 px `accent` rule (4 px thick) draws left to right under the title over 0.5 s. When the subject calls for a warning, a 24 px hazard stripe (`safety` / `ink` 45° stripes) may run along the bottom edge. Card holds for the beat's `hold_seconds`, then **wipes up** (the card translates to y = −1080 with ease-in-out over 0.6 s) to reveal the scene beneath.

**Lower third.** A `paper` chip with 6 px `accent` left bar, 16 px padding, rounded 8 px, bottom-left on the safe margin. Slides in from the left (−40 px, fade) over 0.4 s when a new section begins; it stays until the next lower-third replaces it (crossfade 0.3 s). Only one lower-third at a time.

**Caption / heading.** 48 px heading at top-left (x = 80, baseline y = 150). Fades in with a 12 px rise.

**Checklist.** `paper` card, 16 px radius, 1 px `steel` border, 32 px padding; a 36 px heading if named. Each row: 36 px circle outline (`steel`) + text. Ticking: circle fills `correct`, a check path draws (0.25 s), text goes from `ink-soft` to `ink`. Rows appear 0.35 s apart unless narration says otherwise. Completed checklist holds with a subtle 2 px `correct` border glow.

**Do / Don't comparison (DoDontPanel).** Two equal columns, 40 px gap. Column headers: a 56 px circle with a red X (`error`) on the left, a green check (`correct`) on the right, each with a thin 1 px baseline. Rows slide in from their outer side (−24 px, fade, 0.35 s). Wrong examples use a 3 px `error` outline pulse (opacity 1 → 0.6 → 1 over 1 s, two cycles); right examples get a single green check badge (32 px) at top-right.

**Callout.** Rounded rectangle (`accent` fill, `ink` text, 12 px radius) with a 16 px pointer triangle toward its subject. Pops in (scale 0.9 → 1, fade 0.25 s). Information callouts may use `neutral` fill with `paper` text.

**Badge / counter / stamp.** Badges are 40 px pills (`ink` fill, `paper` text). An emphatic warning stamp is 72 px, 800 weight, `error`, rotated −8°, 4 px border, scales 1.4 → 1 in 0.3 s with a 2-frame white flash.

**Progress timeline.** Horizontal bar across the bottom safe band: 6 px `steel` track, 44 px nodes. Idle node: `paper` fill, `steel` border, grey icon. Active node: `accent` fill. Done node: `correct` fill with white icon. Labels 24 px below nodes. Lighting a node: fill tween 0.3 s + 1.15 scale bounce.

**Quiz card.** `bg-dark` background. Question (52 px, `paper`) at top; illustration centred (max 500 px tall); three dots (16 px, `accent`) pulsing in sequence during the pause; the answer (44 px, `correct` text on a `paper` chip) slides up from +24 px with the illustration completing its animation.

## 5. Motion rules

- **Easing:** `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out-quint-ish) for entrances and moves; `cubic-bezier(0.4, 0, 0.2, 1)` for exits; `ease-out-back` (overshoot 1.2) only for pops of small icons, badges and checks.
- **Typical durations:** enter 0.4 s, move 0.6–1.2 s, exit 0.3 s, pop 0.25 s, tick 0.25 s, stamp 0.3 s. Nothing longer than 1.5 s unless it is a travelling object (truck, worker walk).
- **Enter / exit:** elements enter with fade + 24 px translate (from the side they conceptually come from; default from below). Exit with fade + 16 px translate in the direction of travel. Groups stagger 0.08–0.12 s per item.
- **Characters:** walk cycles at 6 frames per step (two-pose alternation is fine); arm poses switch with a 0.2 s cross-blend. No facial animation beyond eyes blinking every 3–5 s.
- **Idle life:** anything on screen for more than 4 s gets a tiny idle (clock ticking, dust mote drift, 1 px breathing on the character) so holds don't look frozen; keep it under 2 px.
- **Within a scene (beat to beat):** elements that persist stay put; new elements enter per the rules above; elements no longer needed exit in the first 0.4 s of the next beat. Camera "pans" are whole-group translates over 0.8 s. No hard cuts inside a scene unless the visual says "cut to".
- **Between scenes:** every scene starts and ends on a calm hold frame (nothing moving beyond idle life). The assembler applies a 0.5 s crossfade; scene builders don't render it, but the first and last 15 frames must be stable.
- **Red / green reveals:** wrong example first, right example second, always.

## 6. Asset kit

Use `KIT.md` for the actual available factories, options, update parameters and origins. Keep outlines at 2.5 px `ink`, use flat palette fills, and add a 10 percent `ink` ellipse under grounded objects. Scenes may draw small local assets when the kit lacks one; match the same dimensions, palette and motion rules.

## 7. Accessibility and consistency checks before handing in a scene

- All text ≥ 22 px; contrast of text against its background ≥ 4.5:1 (the palette pairs above meet this).
- No photos, no gradients beyond the title vignette, no 3D, no brand logos (carrier names appear as plain text only).
- Red is never the only signal: every `error` state also has an X or outline; every `correct` state has a check.
- The first and last 15 frames of the scene are stable (idle life only).
- Render a contact sheet (one frame per beat) and compare against `storyboard.json` before submitting.
