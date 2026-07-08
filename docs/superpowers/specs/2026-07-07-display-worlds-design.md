# Stage·Assign — "Display Worlds" design spec

_Date: 2026-07-07. Status: approved for planning. Supersedes the 11 color-only "moods."_

**Goal:** Replace the single themable layout (one display view recolored by 11 moods) with
**six distinct "worlds"** — each a genuinely different *skeleton* (layout, type system, stage
rendering, texture, palette), not a recolor. Each world ships a dark and a light face. The
Display view gets the world's full treatment; the editor gets a calm, legible version of it.

**Visual source of truth:** the approved mockups in `docs/`:
- `design-corporate-fonts.html` (Corporate, font = Syne / "C")
- `design-world-concrete.html` (Concrete)
- `design-worlds-terra-orbit.html` (Terra + Orbit — final: Terra extra-textured, Orbit functional stage)
- `design-worlds-redo.html` (Atomic — the "original" the user chose; also Molten v2)
- The build must match these; where this doc and a mockup disagree, the mockup wins for visuals.

---

## 1. The six worlds

Every world is a **layout skeleton + type system + texture + palette**, with a **dark** and a
**light** face. All are heavily grained. **No world emphasizes the worship leader** — all
vocalists are equal (the app still tracks WL internally for mic auto-assign; it is never shown).

| World | Layout DNA | Display fonts | Native / other face |
|---|---|---|---|
| 🏛 **Corporate** | editorial typographic **list** (no cards), huge whitespace, thin-line stage, bracketed labels | **Syne** (display) + Archivo (mono labels) | light (cream) native; dark = charcoal editorial |
| 🪨 **Concrete** | **brutalist modular grid** of boxed cells, exposed hairline rules, **blueprint** stage (grid + dimension ticks), mono manifest | Archivo 800 + Space Mono | dark (charcoal) native; light = poured-concrete |
| 🌿 **Terra** | organic **staggered "river-stone"** roster (no grid), **topographic-contour** stage, linen weave, heavy grain | Spectral + Mulish | light (cream/sage) native; dark = deep loam |
| 🪐 **Orbit** | **radial constellation** — real functional stage as a glowing star-map, vocalists as nodes at true positions, run sheet = vertical **timeline** | Unbounded + Manrope | dark (deep space) native; light = "dawn" |
| 🛰 **Atomic** | mid-century **flat color-block pills**, starburst motif, graphic (no glass) | Jost | dark-charcoal header native; light face too |
| 🔥 **Molten** | warm **equal lineup** (big condensed names, mic badges), ember-from-below | Oswald + Archivo | dark (ember) native; light = "forge-bright" |

**Benched (not built now):** Frost (crystalline), Surf ('70s), Deco (dropped), Speedway,
Road Case, and the MCM spin-offs (Palm Springs / Googie / Harvest). Real photos are also out
(Tier-1 CSS/SVG texture only — keeps the single-file rule).

**Stage stays functional in every world.** Each world's stage is rendered from the *real*
geometry (`getStageShape()` / `state.config` stage fields / clamped people positions), only
*styled* differently (stroke, node style, frame). Orbit was the test case: cosmic look, real
positions.

---

## 2. System rules

- **Two faces per world.** A global light/dark toggle (the existing ☾/☀ button) flips
  `data-theme` between `dark`/`light`; each world defines both.
- **Display = full world; editor = calm.** The Display view renders the world's bespoke layout
  at full intensity (texture, glow, bespoke composition). The **editor keeps its current
  functional layout** but adopts the world's palette, accent, button shape, curve radius, and
  fonts — with texture dialed down and heavy glow removed. (Heavy effects are scoped under
  `.display-view`.)
- **Grain everywhere**, stronger on Display, subtle in the editor.
- **No WL emphasis** anywhere in any world.

---

## 3. Architecture

### 3.1 State + attributes
- Add `state.config.world` (e.g. `'molten'`), default on migration (see §4). Keep
  `state.config` theme handling (`data-theme` dark/light) as-is.
- On `<html>`: set `data-world="<id>"` and `data-theme="<dark|light>"`. **Remove**
  `data-look`/`data-mood`.

### 3.2 WORLDS registry (JS)
A single source-of-truth object near the current mood code:
```js
const WORLDS = {
  molten: {
    label: 'Molten', emoji: '🔥',
    fonts: { display: 'Oswald', body: 'Archivo' },   // loaded on demand via ensureFontLoaded
    render: renderDisplay_molten,                    // per-world Display renderer (§3.4)
    // palette/tokens live in CSS (§3.3), keyed by [data-world][data-theme]
  },
  concrete: { label:'Concrete', emoji:'🪨', fonts:{display:'Archivo', body:'Space Mono'}, render: renderDisplay_concrete },
  terra:    { label:'Terra',    emoji:'🌿', fonts:{display:'Spectral', body:'Mulish'},     render: renderDisplay_terra },
  orbit:    { label:'Orbit',    emoji:'🪐', fonts:{display:'Unbounded', body:'Manrope'},   render: renderDisplay_orbit },
  atomic:   { label:'Atomic',   emoji:'🛰', fonts:{display:'Jost', body:'Jost'},           render: renderDisplay_atomic },
  corporate:{ label:'Corporate',emoji:'🏛', fonts:{display:'Syne', body:'Archivo'},         render: renderDisplay_corporate },
};
const WORLD_ORDER = ['molten','concrete','terra','orbit','atomic','corporate'];
```
Functions `setWorld(id)` / `applyWorld()` replace `setLook`/`setMood`/`applyLook`:
- `applyWorld()` sets `data-world` + ensures the world's fonts are loaded, then re-renders.
- `setWorld(id)` writes `state.config.world`, saves, applies, re-renders (live, like `setMood` did).

### 3.3 CSS token model (per world × face)
Hand-authored CSS blocks (one per world × face) define the palette + shape tokens the whole app
consumes:
```css
[data-world="molten"][data-theme="dark"]{
  --bg:#0c0605; --surface:…; --text:#ffe7d6; --accent:#ff6b35;
  --radius:12px; --ff-display:'Oswald'; --ff-body:'Archivo';
  --grain:.05;            /* editor grain; display scopes its own stronger value */
}
[data-world="molten"][data-theme="light"]{ … }
```
Reuse the existing custom-property names where possible (`--bg/--surface/--text/--accent/--ff-display/--ff-body`) so the editor's existing styles inherit the world automatically. Add
`--radius` and texture vars. Heavy per-world Display styling lives under
`.display-view[data-world="molten"] …` (or body scope) so it never bleeds into the editor.

### 3.4 Display rendering (the core change)
Today `renderDisplayView()` builds one DOM for all moods. New model:
- `renderDisplayView()` becomes a **dispatcher**: resolve the active world, call
  `WORLDS[world].render(ctx)` where `ctx` is the shared, already-computed data
  (vocalists+assignments, band/hosts/shadows, stage geometry, serviceOrder, inventory, display
  config). All existing null-guards / `runSheetPosition` gating stay.
- Each `renderDisplay_<world>(ctx)` produces that world's bespoke markup (matching its mockup).
  Shared helpers: a `stageSvg(ctx, styleOpts)` that draws the real stage geometry with
  per-world styling; a `nameFmt()` (existing display-name-format) applied consistently.
- Keep everything **data-driven** from the same `ctx` so worlds can't drift out of sync with the
  real roster/stage.

### 3.5 Fonts
Load the **active world's** fonts on demand (existing `ensureFontLoaded` / Google Fonts
`<link>` pattern), not all at once. Union across worlds: Oswald, Archivo, Space Mono, Spectral,
Mulish, Unbounded, Manrope, Jost, Syne. Switching worlds loads the new pair if not present.

### 3.6 Textures
Tier-1 only: inline SVG `feTurbulence` grain + CSS pattern data-URIs (breeze-block, fan, floral,
etc. as used per world), embedded in CSS. No image assets → single-file rule intact.

---

## 4. Migration (retiring the 11 moods)
- On load, if `state.config` has legacy `look`/`mood` and no `world`: set
  `state.config.world = 'molten'` (safe, well-liked default) and `data-theme` from the existing
  theme. Drop `look`/`mood` on next save.
- Remove: `AURORA_MOODS`, `MOOD_LABEL`, `MOOD_COLORS`, `moodSwatchHtml`, `setMood`, `setLook`,
  `applyLook`, the `[data-look="aurora"][data-mood=…]` CSS blocks, and the drifting-gradient
  background rule. `applyBrand`/`BRAND_INLINE_VARS`/`state.brand` were already inert under
  Aurora — remove or leave dormant (decide during Phase 0; prefer remove for clarity).
- `DEFAULT_STATE.config.world = 'molten'`.

---

## 5. Picker UI (wizard + settings)
- Replace the mood-swatch picker (currently in the Display settings tab and the wizard look step)
  with **world swatches**: six tiles, each a mini preview (emoji + name + a 2-3 swatch palette +
  its display font sampled). Selecting one calls `setWorld(id)` → whole app + Display recolor and
  **re-lay-out** live. Dark/light stays on the global ☾/☀ toggle.
- Wizard "look" step becomes "Pick your look (world)"; same six tiles.

---

## 6. Testing
- **Keep `npm run check` + `npm test` green at every phase** (Golden Rule 2).
- Update: `aurora.js` (moods retired → world engine), `wizquickwins.js` (look step = world
  tiles), any test asserting `data-mood`/`setMood`/mood swatches. Update, don't delete; note why.
- Add `worlds.js`: for each world — `setWorld(id)` sets `data-world`; `renderDisplayView()`
  runs without throwing in both faces; the stage SVG contains the real people/positions; the
  editor picks up the world's `--accent`/`--ff-display`. jsdom can't judge visual layout — those
  checks stay browser-only (documented), asserting DOM structure + no console errors instead.
- Browser QA per world (headless screenshots, both faces) before each phase ships.

---

## 7. Phased build plan (each phase ships green + deployable)

- **Phase 0 — World engine.** `WORLDS` registry, `data-world`+`data-theme`, `setWorld`/
  `applyWorld`, on-demand font loading, migration off moods, the world-swatch picker (settings +
  wizard). `renderDisplayView()` becomes the dispatcher. Implement **Molten** (its equal-lineup
  layout, dark + light) as the seed/default world — it *replaces* today's single display, it is
  not the old layout kept as-is. Retire the mood machinery. Tests green.
- **Phases 1–5 — one world each**, in this order (most-loved / lowest-risk first):
  **Concrete → Corporate → Atomic → Terra → Orbit.** Each phase: per-world Display renderer +
  CSS (dark+light) matching its mockup, editor theming (calm), on-demand fonts, tests + browser
  QA, ship.
- Molten refinement (equal lineup, ember, grain) folds into Phase 0 since it's the seed world.
- Each phase is independently shippable; the app always has a working set of worlds.

---

## 8. Risks & constraints
- **Single file / no build / GitHub Pages** — unchanged. All CSS/JS/fonts(links)/SVG textures in
  `index.html`. This is the biggest structural change the app has taken; the dispatcher + per-world
  renderers add size — acceptable per Golden Rule 1, but keep renderers focused.
- **File growth:** six display renderers + six CSS token/layout blocks is sizable. Keep each
  renderer small and data-driven; share `stageSvg`/format helpers.
- **Font weight:** on-demand loading avoids pulling all nine families at once.
- **Legibility in the editor:** the calm rule exists precisely so a grainy/condensed world doesn't
  hurt the working UI; verify per world.
- **No regressions:** the executable spec is `tests/`; `docs/WATCHLIST.md` is the human list.

## 9. Out of scope
Frost, Surf, Deco, Speedway, Road Case, MCM spin-offs (benched — easy to add later as new
`WORLDS` entries). Real photo backgrounds. Any change to the underlying data model, PCO, mics,
or setup checklists.
