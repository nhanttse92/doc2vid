# STYLE.md — visual style guide for the Warehouse Training Packet video

Shared by every scene builder. Scenes are built independently in JavaScript (SVG or canvas), rendered frame by frame to 1920×1080 PNGs and assembled into one MP4. Follow this guide exactly so the nine scenes cut together as one film.

## 1. Canvas, timing, layout

- **Canvas:** 1920×1080, 30 fps. Frame numbers are integers; time in a scene starts at 0 at the scene's first frame.
- **Safe margins:** keep all text and important shapes inside a 1760×960 box (80 px in from every edge). The lower-third band and the progress timeline may touch the bottom safe line but not go below it.
- **Grid:** 12 columns, 120 px each, 40 px gutters, starting at x = 80. Vertical rhythm on 8 px. Common layouts:
  - *Full stage* — one illustration centred, title or caption at the top.
  - *Split 5/7* — text or checklist in columns 1–5, illustration in columns 6–12 (or mirrored).
  - *Three-panel strip* — three 520 px panels with 40 px gaps, centred.
  - *Lower third* — band at y = 900–980, x from 80, width to fit text.
- **Durations:** each beat's `est_seconds` in `storyboard.json` is the budget for that beat; the audio for that beat will be laid under it. Narration-synced moments ("on the word X") can be approximated at word_index / word_count × beat duration. Hold frames are at the end of a beat unless the visual says otherwise (quiz beats put the hold between question and answer).

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
| `neutral` | `#3F7FBF` | Stock-order lane, neutral timers, information callouts |
| `worker-shirt` | `#2F6FB0` | The Worker's shirt (Supervisor `#6B4FA3`, Driver `#8A5A3C`, Analyst/Manager `#3D8F86`, Customer `#B5651D`) |
| `worker-skin` | `#E8B993` | Single skin tone for all characters (flat, no faces beyond two dot eyes) |

Text on `bg-dark` is `paper`; text on `bg-light` is `ink`. Never put `error` text on `bg-dark` without a `paper` chip behind it.

## 3. Typography

One bundled web font, loaded from a local file so renders are deterministic: **Inter** (Variable or static 400/600/800). Fallback `system-ui`. Numerals use `font-variant-numeric: tabular-nums`.

| Role | Size / weight | Notes |
|---|---|---|
| Part number ("Part II") | 36 px, 600, letter-spacing 0.18em, uppercase, `accent` | Title cards only |
| Title card title | 88 px, 800 | Line height 1.05, max 2 lines |
| Title card sub-line | 40 px, 400, `ink-soft` on light / `#B9C3D1` on dark | e.g. "3. Receiving of Freight" |
| Scene caption / heading | 48 px, 700 | Top-left of stage |
| Lower-third text | 34 px, 600 | Section name, e.g. "5. Storing of Parts" |
| Checklist item | 34 px, 500 | 3–6 words |
| Label on asset (part numbers, tags) | 24–28 px, 600 | Never smaller than 22 px |
| Callout text | 30 px, 600 | Max 2 lines |
| Quiz question | 52 px, 700 | Quiz answer 44 px, 600, `correct` |

Keep on-screen text short: titles, 3–6 word bullets, labels. No sentences on screen except quiz questions and answers.

## 4. Recurring treatments

**Section title card.** `bg-dark`, 4 percent vignette. Part number in small caps at y = 360, title at y = 430, sub-line at y = 560, all centred. A 160 px `accent` rule (4 px thick) draws left to right under the title over 0.5 s. Part VI adds a 24 px hazard stripe (`safety` / `ink` 45° stripes) along the bottom edge. Card holds for the beat's `hold_seconds`, then **wipes up** (the card translates to y = −1080 with ease-in-out over 0.6 s) to reveal the scene beneath.

**Lower third.** A `paper` chip with 6 px `accent` left bar, 16 px padding, rounded 8 px, bottom-left on the safe margin. Slides in from the left (−40 px, fade) over 0.4 s when a new packet section begins; it stays until the next lower-third replaces it (crossfade 0.3 s). Only one lower-third at a time.

**Caption / heading.** 48 px heading at top-left (x = 80, baseline y = 150). Fades in with a 12 px rise.

**Checklist.** `paper` card, 16 px radius, 1 px `steel` border, 32 px padding; a 36 px heading if named. Each row: 36 px circle outline (`steel`) + text. Ticking: circle fills `correct`, a check path draws (0.25 s), text goes from `ink-soft` to `ink`. Rows appear 0.35 s apart unless narration says otherwise. Completed checklist holds with a subtle 2 px `correct` border glow.

**Do / Don't comparison (DoDontPanel).** Two equal columns, 40 px gap. Column headers: a 56 px circle with a red X (`error`) on the left, a green check (`correct`) on the right, each with a thin 1 px baseline. Rows slide in from their outer side (−24 px, fade, 0.35 s). Wrong examples use a 3 px `error` outline pulse (opacity 1 → 0.6 → 1 over 1 s, two cycles); right examples get a single green check badge (32 px) at top-right.

**Callout.** Rounded rectangle (`accent` fill, `ink` text, 12 px radius) with a 16 px pointer triangle toward its subject. Pops in (scale 0.9 → 1, fade 0.25 s). Information callouts may use `neutral` fill with `paper` text.

**Badge / counter / stamp.** Badges are 40 px pills (`ink` fill, `paper` text). The "NO EXCEPTION" stamp is 72 px, 800 weight, `error`, rotated −8°, 4 px border, scales 1.4 → 1 in 0.3 s with a 2-frame white flash.

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

Each asset is one SVG symbol (or a small factory function) with named states or poses. Build only what your scene needs, but build it to this spec so parts can be shared. Dimensions are the default footprint at 1× (scale as needed). Outlines are 2.5 px `ink` unless noted; fills are flat palette colours; shadows are a 10 percent `ink` ellipse under grounded objects.

1. **Worker** — the recurring associate, 260 px tall, flat body, round head, two dot eyes, `worker-shirt` shirt, dark trousers, boots. Poses: `stand`, `walk` (2-frame cycle), `wave`, `point` (arm out, index finger), `kneel`, `inspect` (holds a Magnifier at face), `hold-clipboard`, `carry-carton`, `push-cart`, `sweep` (holds Broom, 2-frame cycle), `lift-bent-knees` (straight back, bent knees, carton close to body), `lift-bad` (bent back, straight legs, with a twisting arrow and a red flash at the lower back), `thumbs-up`, `neat` (standing, hands at sides, small sparkle). Variants by shirt colour and a hat: `supervisor` (purple shirt, clipboard), `driver` (brown shirt, cap), `analyst` (teal shirt, seated at Terminal), `manager` (teal shirt, tie stripe), `customer` (orange shirt, hard hat). Optional PPE layer (see 36).
2. **BoxTruck** — side view, 720×300, `steel` body, dark cab, two wheels, rear roll door. States: `arriving` (slides in, settle bounce), `parked`, `door-open`, `chocked` (WheelChock in place).
3. **WheelChock** — 70×50 yellow (`safety`) wedge with grip lines. Animations: `place` (slides in and clicks with 3 motion lines), `missing` (dashed outline with red X).
4. **DockDoor** — 420×520 roll-up door frame with black rubber bumpers and a dock number plate. States: `open`, `closed`.
5. **Pallet** — isometric, 300×120, `carton` wood tones. States: `intact`, `broken` (one cracked board, slight tilt), `stacked` (holds 1–6 Cartons). Pieces: `splinter` fragments for disposal.
6. **Carton** — isometric box 160×140. Variants: `plain`, `labelled` (front LocationLabel-style part number), `damaged` (crushed corner, `error` outline), `open` (flaps rotated), `sealed` (tape strip animates on), `clean` vs `scuffed` (grey smudges), `empty` (lighter, open). Also `WeatherproofCrate` (slatted crate with sealed lid) and the `package` form (small box holding N Part icons).
7. **Banding strap** — thin dark band around a Pallet or Carton; `cut` state springs loose onto the floor with a trip-hazard `error` outline. Paired with a **Scissors** icon.
8. **Tag** — hanging paper tag on a string, 90×60, writes text (part number and quantity); `remove` animation (pulled off, fades). **OverstockTag** — `accent` variant with "Overstock" text and an optional down-arrow. **PriceTag** — small tag reading "Freight charges" that swings onto a document.
9. **LocationLabel / BinTag** — 150×44 `paper` label with a part number or location code. States: `good`, `worn` (torn corner, faded digits), `missing` (dashed outline). Animation: `replace` (worn peels off, new slides in).
10. **PalletRack** — rack bay 520×560 with `steel-dark` uprights and 3 shelves of 3 bins; each bin can hold a Carton, Part icons or a WireBasket and carries a LocationLabel. States: `empty`, `stocked`, `overstocked` (cartons bulging beyond bin edges with `error` outline), `permanent + overstock` (lower bins labelled, top shelf cartons with OverstockTag).
11. **WireBasket** — 180×110 mesh basket on a shelf. States: `normal`, `overloaded` (sagging floor, parts spilling, `error` outline).
12. **AisleSign** — hanging placard 120×140 with a letter (A, B, C…), drops from the top with a swing. **SectionMarker** — 80×36 numeric label (01, 02, 03) on a rack upright. Together they assemble a location code like "B-02-3".
13. **Warehouse Map** — top-down isometric plan, 1200×620. States: `line-art` (outline only, draws itself for title/closing cards), `rows` (rack blocks drop in row by row, labelled A–F), `route` (dotted path draws through rows), `zones` (three labelled floor zones along the bottom: Will Call, Shop / Field, Outbound; plus optional "Overflow" dashed zone), `markers` (location pins for emergency equipment).
14. **Mezzanine** — side elevation, 1100×520: upper deck on columns, railing, a staircase, shelving on the deck. Builds bottom-up. Accepts `WeightLimitSign` (yellow placard, scale icon, text "MAX LOAD", no number) bolted to the railing.
15. **Forklift** — side view 420×300, `steel` mast, `safety` body accents, driver seat for a Worker. States: `idle`, `driving` (wheels rotate), `speeding` (speed lines, tilted load, `error`), `tagged-out` (desaturated, TagOut tag on the column, optional padlock icon).
16. **TagOut tag** — red tag 90×140 with white "DO NOT OPERATE", swings on from a hook; optional **Padlock** icon for lock-out.
17. **Vehicle** — simple van or pickup outline 520×260; states `clean` (sparkles), `inspect` (dotted walk-around circle), `damage-note` (small dent with `error` note).
18. **FuelGauge** — semicircular gauge 240×140 with E, ½, F marks; red zone below ½; needle tween; **FuelNozzle** icon for the fill animation.
19. **Scale** — platform scale 320×200 with a dial; needle climbs; a red line and a "50 lb" badge (`error` when exceeded, `correct` when under).
20. **Clock / Timer** — 200 px dial. States: `fill` (coloured arc sweeps clockwise with a label such as "24 h", "2 h", "8 h"; `neutral` for stock, `error` for emergency, `accent` for the eight-hour goal), `fast-sweep` (hand spins for "late"), `cut-off` (red wedge labelled "Cut off"), `end-of-shift` (moon badge), `on-time` (green check).
21. **Calendar** — month grid 420×360 with weekly markers that pulse in sequence and a highlighted "Year end" cell.
22. **Clipboard / Manifest** — 300×400 clipboard with 5 line items, check circles, a signature line with a `Padlock` that unlocks, and a handwritten-style `error` note line ("Damage noted") that writes on.
23. **PackingSlip / documents** — 260×340 `paper` sheet with header, 5 rows and a barcode band. Variants: `customer`, `shop` (header text), `pending` badge, `red-notes` (one or two `error` handwritten lines), **PickDocument** (rows show ascending locations and tick off), **RecountReport** (rows with amber highlights), **CountSheet** (count columns plus a "Notes" area; handwritten numbers type on), **SDS** (document with a HazardSign corner, "Safety Data Sheet"), **PolicyBook** (small closed/open book), **Certificate** (sheet with a ribbon seal; optional "1 year" loop arrow).
24. **PickTag** — 700×440 generic white ticket (no vendor name or logo): grey header "Order Ticket", a 2×3 grid of fields labelled LOCATION, PART NUMBER, PICK QTY, DESCRIPTION, ITEM with sample values ("B-02-3", "123-A", "6", "BEARING", "04"), a decorative barcode band. Each field has a `highlight` state (`accent` fill behind the value) and attaches to a Callout.
25. **Terminal** — desk monitor + keyboard 360×300. Screen states: `on-hands table` (3 rows, a quantity that ticks up with a green flash), `covered` (grey panel with eye-slash icon over the on-hands column), `report` (list), `print` (a document slides up out of a printer slot in the base).
26. **FolderDrawer** — filing drawer 320×240 that opens; folders labelled "In" and "Out"; documents drop in; a "Daily" badge.
27. **Camera icon** — 80×60 with a two-frame white flash. **Plane icon** — 120×60 generic outline that glides across the top with a plain-text tag (UPS, FEDEX). **Magnifier** — 70 px, used by the Worker's `inspect` pose and as a "Research" badge.
28. **Part icons** — 60–120 px flat silhouettes: `Bolt`, `Bearing` (ring with balls), `BrakeShoe` (curved shoe), `Shaft` (machined cylinder with a cradle variant and a scratched variant), `HoseCoil`, `SealRing`, `generic Part` (rounded block). States: `new` (bright, "NEW" tag), `core` (dull grey, wear marks, "CORE" tag), `rusted` (orange speckles), `wrapped` (protective wrap on) / `unwrapped`.
29. **Kit / Set / Multipack diagram** — three states built from Carton and Part icons: `multipack` (open carton, 2×5 grid of Bolts, badge "Package qty 10", one bolt lifts out with tag "Sold as 1 unit"); `set` (two BrakeShoes, bracket, stamp "= QTY 1 SET"); `kit` (**HydraulicCylinder** outline 520×160 with dotted slots; SealRings, SealBearings, OilBearings fly in; bracket "= 1 KIT").
30. **Machine** — simple excavator outline 300×200 beside the `customer` Worker, with a visible gear that turns (running) or stops (missing part).
31. **Housekeeping set** — `Broom` and `Dustpan`, `Mop`, `Spill` (dark puddle that shrinks), `Debris` specks, `TrashCan` (tips), `Dumpster`, `Cabinet` (with dust puffs and a duster swipe), `CoffeeCup` and `Can` icons.
32. **HosePress** — bench with a press head 420×260; **HoseSaw** icon; **HoseHook** wall hook labelled "Hose" where a HoseCoil winds up and hangs.
33. **Clearance set** — `FireHydrant`, `Doorway`, `ElectricalPanel`, each with a dashed clearance zone that flashes `correct` when clear.
34. **Emergency set** — `FireExtinguisher`, `EyeWash` station, `FirstAid` cross, mounted on a wall panel; each pings a location marker on the Warehouse Map.
35. **HazardSign** — diamond placard 120 px (`safety` with `ink` border and a generic flame/exclamation glyph, no UN numbers). **Hazard stripe** — 45° `safety`/`ink` stripe band for title card and hazmat bay.
36. **PPE set** — `HardHat`, `SafetyGlasses`, `Gloves`, `HiVisVest`, `Boots`; each snaps onto the Worker in sequence (0.2 s apart) or sits as a row of icons.
37. **Tools** — `BoxCutter` (blade retracts with a click; cut-direction arrows green away / red toward body), `TapeGun`, `HandTruck`, `CrackedTool` (hand tool with a crack sliding into a "Removed from service" bin), `TrafficSign` (stop sign plus pedestrian floor marking).
38. **Cart** — order-picking cart 260×200 that the Worker pushes; holds Cartons and loose Parts.
39. **Abstract icons** — `Shield` with check, `Target` with arrow, `Lightbulb`, `Book` with a rising line, `Ladder` steps (career plan), `Handshake`/radiating rings (attitude), `QuestionMark`, `ExclamationMark`, `Moon`, `Star`.
40. **UI components** — `SectionTitleCard`, `LowerThird`, `Checklist`, `DoDontPanel`, `Callout`, `Badge`/`Counter`, `Stamp`, `ProgressTimeline`, `QuizCard`, `ThinkingDots`, `Panel` (three-panel strip frames), `Tile` (icon + 2–4 word label, used for the Part V and Part VI reveals), and `GreenCheck` / `RedX` marks (32 px badge and 56 px header sizes).

## 7. Accessibility and consistency checks before handing in a scene

- All text ≥ 22 px; contrast of text against its background ≥ 4.5:1 (the palette pairs above meet this).
- No photos, no gradients beyond the title vignette, no 3D, no brand logos (carrier names appear as plain text only).
- Red is never the only signal: every `error` state also has an X or outline; every `correct` state has a check.
- The first and last 15 frames of the scene are stable (idle life only).
- Render a contact sheet (one frame per beat) and compare against `STORYBOARD.md` before submitting.
