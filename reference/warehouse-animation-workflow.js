export const meta = {
  name: 'warehouse-training-animation',
  description: 'Build the shared SVG asset kit, then animate the nine storyboard scenes in parallel',
  phases: [
    { title: 'Kit', detail: '4 agents build shared SVG components and gallery pages' },
    { title: 'Scenes', detail: 'one agent per scene, verified with stills and a full 1080p render' },
  ],
}

const ROOT = '/Users/nhantrinh/Projects/warehouse-training-video'

const KITS = [
  { name: 'characters', scope: `STYLE.md §6 items 1 (Worker: every pose and variant listed, walk and sweep cycles, eye blink every 3-5 s, 1 px breathing idle, and a hard-hat option), 36 (PPE set: HardHat, SafetyGlasses, Gloves, HiVisVest, Boots as switchable layers on the Worker that can snap on one at a time, plus a standalone Kit.PPEIcon(parent, {item}) for icon rows), 15 (Forklift, states idle/driving/speeding/tagged-out, with an optional seated Worker), 16 (TagOut tag "DO NOT OPERATE" + Padlock icon), 30 (Machine: simple excavator with a gear that turns or stops). The Worker must draw its own simple hand-held props (clipboard, magnifier, broom, carried carton, a pointing hand) inside characters.js, because the other kit files are being written at the same time and you cannot depend on them. The Worker is the most-reused asset in the film (all nine scenes), so make it read clearly at 120-260 px tall and look friendly and consistent.` },
  { name: 'ui', scope: `STYLE.md §4 recurring treatments and §6 item 40 (SectionTitleCard incl. the Part VI hazard stripe and the wipe-up exit, LowerThird with crossfade replacement, Heading/caption, Checklist with timed ticks, DoDontPanel, Callout with pointer direction, Badge/Counter, Stamp, ProgressTimeline with icon nodes and idle/active/done states, QuizCard with ThinkingDots, Panel (three-panel strip frames), Tile, GreenCheck/RedX at 32 and 56 px), plus items 20 (Clock/Timer, all states), 21 (Calendar), 35 (HazardSign + hazard stripe band) and 39 (abstract icons: Shield, Target, Lightbulb, Book, Ladder, Handshake/radiating rings, QuestionMark, ExclamationMark, Moon, Star). Also provide a small line-icon set for ProgressTimeline nodes and Tiles (truck, magnifier, pen/signature, sort arrows, box check-in, document, folder, clock, broom, shield, box, hand) as Kit.Icon(parent, {name, size, color}). Time-driven components should take times in update params (for example update({t, tIn, tOut}) or update({t, ticks: [t1, t2, ...]})) so scenes can drive them from narration cues.` },
  { name: 'objects', scope: `STYLE.md §6 items 2 (BoxTruck), 3 (WheelChock), 4 (DockDoor), 5 (Pallet), 6 (Carton, all variants incl. WeatherproofCrate and the package form), 7 (Banding strap + Scissors), 8 (Tag, OverstockTag, PriceTag), 9 (LocationLabel/BinTag incl. the replace animation), 10 (PalletRack: 3 shelves x 3 bins, each bin can show a Carton, Part icons or a WireBasket and carries a LocationLabel; overstocked and permanent+overstock states), 11 (WireBasket), 12 (AisleSign, SectionMarker), 28 (Part icons: Bolt, Bearing, BrakeShoe, Shaft with cradle and scratched variants, HoseCoil, SealRing, generic Part; states new/core/rusted/wrapped/unwrapped), 31 (housekeeping basics: Broom, Dustpan, Mop, Spill, Debris, TrashCan), 32 (HosePress, HoseSaw icon, HoseHook with a HoseCoil hanging), 38 (Cart). Isometric items use a consistent isometric angle (30 degrees) across Carton, Pallet and PalletRack contents.` },
  { name: 'docs', scope: `STYLE.md §6 items 13 (Warehouse Map: line-art self-drawing, rows A-F dropping in, route path drawing, zones (Will Call, Shop / Field, Outbound, optional Overflow), location markers), 22 (Clipboard/Manifest with check circles, signature line, padlock that unlocks, handwritten-style "Damage noted" line), 23 (PackingSlip family: customer, shop, pending badge, red-notes; PickDocument with ascending locations that tick off; RecountReport; CountSheet with typed-on numbers; SDS; PolicyBook open/closed; Certificate with ribbon seal and optional "1 year" loop), 24 (PickTag: the exact generic ticket with fields LOCATION, PART NUMBER, PICK QTY, DESCRIPTION, ITEM and sample values B-02-3, 123-A, 6, BEARING, 04, per-field highlight), 25 (Terminal with all screen states incl. the printer slot), 26 (FolderDrawer with In/Out folders and Daily badge), 27 (Camera with flash, Plane gliding with a plain-text carrier tag, Magnifier). Handwriting can be a slightly slanted Inter italic-style rendering (skewX) in error red; text "writes on" via a clip-path reveal driven by a progress param.` },
]

const SCENES = [
  ['s01', 'Welcome and Purpose'], ['s02', 'Receiving of Freight'], ['s03', 'Packaging and Storing of Parts'],
  ['s04', 'Locations, Mezzanine, Packing and Shipping'], ['s05', 'Stock Orders and Order Filling'],
  ['s06', 'Returns and Inventory Counts'], ['s07', 'Housekeeping and Equipment'], ['s08', 'Attitude and Safety'],
  ['s09', 'Recap and Knowledge Check'],
]

const KIT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          call: { type: 'string', description: 'factory call with options, e.g. Kit.Worker(parent, {variant})' },
          update: { type: 'string', description: 'update params and allowed values' },
          origin: { type: 'string' },
        },
        required: ['name', 'call', 'update', 'origin'],
      },
    },
    gallery_checked: { type: 'boolean' },
    issues: { type: 'string', description: 'known limitations, or empty' },
  },
  required: ['file', 'components', 'gallery_checked', 'issues'],
}

const SCENE_SCHEMA = {
  type: 'object',
  properties: {
    scene: { type: 'string' },
    render_ok: { type: 'boolean', description: 'node render.mjs <id> finished with no errors' },
    video: { type: 'string' },
    beats_covered: { type: 'integer' },
    kit_workarounds: { type: 'string', description: 'kit bugs or gaps you worked around locally, or empty' },
    deviations: { type: 'string', description: 'anything shown differently from the storyboard and why, or empty' },
    notes: { type: 'string' },
  },
  required: ['scene', 'render_ok', 'video', 'beats_covered', 'kit_workarounds', 'deviations', 'notes'],
}

const kitPrompt = k => `You are building one file of the shared SVG asset kit for a 20-minute animated warehouse training video.

Project: ${ROOT}. First read build/AGENT_BRIEF.md (architecture, the component contract, file ownership, how to check your work), STYLE.md (binding visual spec), web/engine.js and web/kit/base.js. Skim STORYBOARD.md to see how scenes will use your components.

Your file: web/kit/${k.name}.js (replace the stub) and its gallery web/kit/${k.name}.gallery.js. Do not edit any other file. Three other agents are writing the other kit files at the same time, so do not depend on their components.

Scope: ${k.scope}

Requirements:
- Follow the component contract exactly: factory on window.Kit returning {g, update(params)}, all nodes created in the factory, update idempotent and deterministic, a header comment per factory documenting options, update params and origin.
- Match STYLE.md: palette via Kit.C, 2.5 px ink outlines, flat fills, Inter text via Kit.text, sizes from §6, easing via Kit.ease.
- The gallery must show every component and every state/pose, laid out in a grid with small Inter labels, with time-based animations cycling so a few screenshots at different t show the motion (set duration ~10 s).
- Check by eye: run node shoot.mjs "kit=${k.name}" 0,2.5,5,7.5 --sheet and node shoot.mjs "kit=${k.name}" 3 --full, open the PNGs with the Read tool, and iterate until the drawings are clean, legible, on-palette and consistent. Fix any page errors.

Return the structured result: one entry per public factory with its exact call signature, update params and origin. Scene builders will rely on this list, so make it accurate.`

const scenePrompt = (id, title, kitRef) => `You are animating scene ${id} ("${title}") of a 20-minute animated warehouse training video.

Project: ${ROOT}. First read build/AGENT_BRIEF.md (architecture, determinism rule, timing via ctx.beat/ctx.cue, file ownership, how to check your work) and STYLE.md (binding visual spec). Then read every beat of scene ${id} in storyboard.json (narration, visual, onscreen_text, hold_seconds) and its section in STORYBOARD.md. The source packet text is in source/packet.txt if you need context. Do not change the teaching content.

Your only file: web/scenes/${id}.js, registering Engine.scene('${id}', { build(ctx), render(t, ctx, state) }). Do not edit anything else; eight other agents are building the other scenes at the same time.

The shared kit is done. Read the header comments in web/kit/*.js before drawing anything yourself, and use these components wherever they fit (the Worker especially, so the character looks the same in every scene):
${kitRef}

Assets STYLE.md lists that the kit does not provide are drawn locally in your scene file to the STYLE.md spec.

Requirements:
- Every beat's visual from the storyboard, timed with ctx.beat(beatId) and ctx.cue(beatId, 'phrase') so animations land on the words they illustrate. Never hard-code times from est_seconds: web/timing.js is regenerated from the real narration during your run.
- Every onscreen_text item present, spelled exactly. Text at least 22 px, inside the 80 px safe margins.
- Persistent elements stay put between beats; things that leave exit in the first 0.4 s of the next beat; idle life on long holds; calm first and last 15 frames.
- Check by eye as you go: node shoot.mjs "scene=${id}" <all beat ids, comma-separated> --sheet, plus extra times around key moments; open the PNGs with Read; fix problems (overlaps, clipped text, off-palette colours, empty-looking frames, things popping without easing).
- Check motion with node render.mjs --draft ${id} and a few ffmpeg frame grids.
- Finish with the full render: node render.mjs ${id} must complete without errors (build/video/${id}.mp4). If it fails, fix and re-run.

Return the structured result.`

phase('Kit')
const kits = await parallel(KITS.map(k => () =>
  agent(kitPrompt(k), { label: `kit:${k.name}`, phase: 'Kit', schema: KIT_SCHEMA })))
const built = kits.filter(Boolean)
log(`kit ready: ${built.map(k => `${k.file} (${k.components.length} components)`).join(', ')}`)
const missing = KITS.filter((k, i) => !kits[i]).map(k => k.name)
if (missing.length) log(`kit agents that returned nothing: ${missing.join(', ')}; scene agents will draw those assets locally`)
const kitRef = built.map(k => `- ${k.file}:\n` + k.components.map(c => `  - ${c.call} | update: ${c.update} | origin: ${c.origin}`).join('\n') + (k.issues ? `\n  (kit notes: ${k.issues})` : '')).join('\n')

phase('Scenes')
const scenes = await parallel(SCENES.map(([id, title]) => () =>
  agent(scenePrompt(id, title, kitRef), { label: `scene:${id}`, phase: 'Scenes', schema: SCENE_SCHEMA })))

return { kits: built.map(k => ({ file: k.file, components: k.components.length, issues: k.issues })), scenes: scenes.map((s, i) => s || { scene: SCENES[i][0], render_ok: false, notes: 'agent returned nothing' }) }
