# Display Worlds — Phase 0 (World Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 11 color-only "moods" with a curated set of **6 named "worlds"** (Molten, Concrete, Corporate, Terra, Orbit, Atomic) selectable in Settings + the wizard, each recoloring **and re-fonting** the whole app, on the existing dark/light axis — and lay the seam (a per-world display dispatcher) that later phases use to give each world its bespoke *layout*.

**Architecture:** Rename the theming axis from `[data-look="aurora"][data-mood="X"]` to `[data-world="X"]`, curate the 11 mood CSS blocks down to 6 world blocks (each adding `--ff-display`/`--ff-body`), and reuse the existing Aurora token derivation (`--c1/--c2/--c3/--gd` → `--bg/--surface/--text/--accent`). A JS `WORLDS` registry holds each world's label/emoji/fonts/swatch. `setWorld()`/`applyWorld()` replace `setMood()`/`applyLook()`. `renderDisplayView()` gains a dispatcher seam that delegates to `WORLDS[id].renderDisplay` when one exists (none do in Phase 0 — every world uses today's display layout, freshly re-themed). Migration maps any legacy save to Molten.

**Scope note (read this):** Phase 0 ships worlds that **recolor + refont** via the existing engine — the *dramatically different per-world layouts/textures* from the mockups arrive in the follow-up per-world phases (Concrete, Corporate, Atomic, Terra, Orbit), each adding a bespoke `renderDisplay_<world>` + CSS through the seam this phase installs. Phase-0 world palettes are baseline values (mirroring the mockups' hues through the existing derivation); each world's phase refines its exact palette/texture.

**Tech Stack:** Single-file vanilla HTML/CSS/JS (`index.html`, ~12.9k lines), `localStorage`, GitHub Pages. Tests: jsdom via `tests/run-all.js`. No build step, no deps.

**Validation (run after every task):** `npm run check` (JS syntax + CSS brace balance) and `npm test` (jsdom suite; green allowing the known `curve.js` false-fail). Re-grep anchors before each edit — line numbers drift.

---

## File Structure

- **Modify `index.html`** — all app changes (CSS token blocks, `WORLDS` registry + engine fns, two picker call-sites, `renderDisplayView` seam, migration, retire mood machinery, build stamp). Single-file rule (GOLDEN RULE 1) stands.
- **Create `tests/worlds.js`** — the Phase-0 regression suite (registry, `setWorld`/`applyWorld`, migration, pickers, dispatcher seam). Runner auto-discovers it.
- **Modify `tests/aurora.js`** — rewrite mood-era assertions to the world engine (behavior changed intentionally per GOLDEN RULE 3; note why in-file).
- **Modify `tests/wizquickwins.js`** — update the wizard "look" step assertions (mood swatches → world swatches).

No new non-test files (keeps the single-file rule).

---

## Task 1: `WORLDS` registry + curated world CSS (mood axis → world axis)

**Files:**
- Modify `index.html`: the theming block near `const AURORA_MOODS` (~line 8518) and the CSS mood blocks (~lines 1263–1293).
- Test: `tests/worlds.js` (new).

- [ ] **Step 1: Write the failing test** — create `tests/worlds.js` with the standard harness (copy the header from `tests/aurora.js` lines 1–13) and this first check inside the `load` handler:

```js
 check('WORLDS registry: 6 worlds in order, each with fonts + swatch', () => {
   const order = ev('WORLD_ORDER');
   if (!Array.isArray(order) || order.length !== 6) throw new Error('expected 6 worlds, got '+(order&&order.length));
   const expected = ['molten','concrete','corporate','terra','orbit','atomic'];
   if (order.join(',') !== expected.join(',')) throw new Error('order mismatch: '+order.join(','));
   order.forEach(id => {
     const w = ev(`WORLDS['${id}']`);
     if (!w || !w.fonts || !w.fonts.display || !w.fonts.body) throw new Error(id+' missing fonts');
     if (!Array.isArray(w.swatch) || w.swatch.length !== 3) throw new Error(id+' missing swatch');
   });
 });
 check('world CSS: [data-world="molten"] block exists with fonts', () => {
   const css = ev("document.querySelector('style').textContent");
   if (!/\[data-world="molten"\]/.test(css)) throw new Error('no [data-world="molten"] rule');
   if (!/\[data-world="concrete"\]/.test(css)) throw new Error('no [data-world="concrete"] rule');
 });
```

- [ ] **Step 2: Run it, expect FAIL** — `SA_HTML=index.html node tests/worlds.js`
  Expected: FAIL `WORLD_ORDER` is not defined (or `[data-world="molten"]` missing).

- [ ] **Step 3: Add the registry.** Replace the block at `index.html` ~8516–8534 (from `// ---- Look + mood` through the end of `moodSwatchHtml`) with:

```js
// ---- Worlds (the "which look" choice; replaces the 11 color-only moods) ----
// Each world recolors + re-fonts the whole app via the token derivation in the CSS
// [data-world="…"] blocks; `swatch` mirrors that block's --c1/--c2/--c3 for previews.
// `fonts` are loaded on demand (ensureFontLoaded). Bespoke per-world display layouts
// attach later as WORLDS[id].renderDisplay (see renderDisplayView dispatcher).
const WORLDS = {
  molten:   { label:'Molten',    emoji:'🔥', fonts:{display:'Oswald',    body:'Archivo'},    swatch:['#ff6b4a','#ffb020','#ff4d6d'] },
  concrete: { label:'Concrete',  emoji:'🪨', fonts:{display:'Archivo',   body:'Space Mono'}, swatch:['#cbd3dd','#8b95a3','#5b6472'] },
  corporate:{ label:'Corporate', emoji:'🏛', fonts:{display:'Syne',      body:'Archivo'},    swatch:['#c9a27a','#9a8468','#6f5d48'] },
  terra:    { label:'Terra',     emoji:'🌿', fonts:{display:'Spectral',  body:'Mulish'},     swatch:['#9cc27a','#c9a24b','#8ab0a0'] },
  orbit:    { label:'Orbit',     emoji:'🪐', fonts:{display:'Unbounded', body:'Manrope'},    swatch:['#b39cff','#8a6fe0','#67e8f9'] },
  atomic:   { label:'Atomic',    emoji:'🛰', fonts:{display:'Jost',      body:'Jost'},       swatch:['#e2683f','#d99a2b','#3f6f72'] },
};
const WORLD_ORDER = ['molten','concrete','corporate','terra','orbit','atomic'];
const DEFAULT_WORLD = 'molten';
```

(Leave `applyLook`/`setLook`/`setMood` for now — Task 5 replaces them. `moodSwatchHtml` is removed here; Task 3 adds `worldSwatchHtml`, and its two call-sites are swapped in Tasks 6–7, so the interim `npm run check` still parses. If you run the suite between tasks, expect the two picker call-sites + `applyLook` to still reference removed names — that's fixed by Task 5/6/7; do Tasks 1→8 in order.)

- [ ] **Step 4: Rename the CSS axis + curate to 6 worlds.** In `index.html`, change the base selector at ~line 1263 from `[data-look="aurora"]{` to `[data-world]{`, and at ~line 1272 from `[data-look="aurora"][data-theme="light"]{` to `[data-world][data-theme="light"]{`. Then **replace** the 11 mood blocks (~lines 1279–1289) with these 6 world blocks (each adds `--ff-display`/`--ff-body`):

```css
[data-world="molten"]   {--c1:#ff6b4a;--c2:#ffb020;--c3:#ff4d6d;--gd:#140806;--ff-display:'Oswald',system-ui,sans-serif;--ff-body:'Archivo',system-ui,sans-serif}
[data-world="concrete"] {--c1:#cbd3dd;--c2:#8b95a3;--c3:#5b6472;--gd:#0a0b0d;--mix:14%;--ff-display:'Archivo',system-ui,sans-serif;--ff-body:'Space Mono',ui-monospace,monospace}
[data-world="corporate"]{--c1:#c9a27a;--c2:#9a8468;--c3:#6f5d48;--gd:#0d0b09;--mix:16%;--ff-display:'Syne',system-ui,sans-serif;--ff-body:'Archivo',system-ui,sans-serif}
[data-world="terra"]    {--c1:#9cc27a;--c2:#c9a24b;--c3:#8ab0a0;--gd:#0c1109;--mix:20%;--ff-display:'Spectral',Georgia,serif;--ff-body:'Mulish',system-ui,sans-serif}
[data-world="orbit"]    {--c1:#b39cff;--c2:#8a6fe0;--c3:#67e8f9;--gd:#080b16;--ff-display:'Unbounded',system-ui,sans-serif;--ff-body:'Manrope',system-ui,sans-serif}
[data-world="atomic"]   {--c1:#e2683f;--c2:#d99a2b;--c3:#3f6f72;--gd:#12100e;--mix:24%;--ff-display:'Jost',system-ui,sans-serif;--ff-body:'Jost',system-ui,sans-serif}
```

Then update the two follow-on rules that were keyed on `[data-mood]`:
- The light-mode pale-accent rule (~lines 1291–1293): change the three selectors from `[data-look="aurora"][data-theme="light"][data-mood="graphite|platinum|frost"] .dv-list-item .detail` to `[data-world="concrete"][data-theme="light"] .dv-list-item .detail` (concrete is our only pale/mono world now).
- The background-wash rule (~line 1300, `[data-look="aurora"] body, [data-look="aurora"] .display-view`): change both selectors to `[data-world] body, [data-world] .display-view` (keep the gradient as the shared baseline; per-world bespoke backgrounds come in later phases).

- [ ] **Step 5: Run it, expect PASS** — `SA_HTML=index.html node tests/worlds.js`
  Expected: the two checks PASS. (`npm run check` will still FAIL until Task 5/6/7 — removed `moodSwatchHtml`/`AURORA_MOODS` are still referenced at the call-sites. That's expected mid-sequence.)

- [ ] **Step 6: (No commit yet — commit after Task 8 when the suite is green.)**

---

## Task 2: `applyWorld()` + `setWorld()` (replace `applyLook`/`setMood`)

**Files:**
- Modify `index.html`: `applyLook`/`setLook`/`setMood` (~lines 8542–8558).
- Test: `tests/worlds.js`.

- [ ] **Step 1: Add the failing test** (append inside the `load` handler in `tests/worlds.js`):

```js
 check('setWorld sets data-world + state.world + loads the world font link', () => {
   ev("setWorld('orbit')");
   if (ev("document.documentElement.getAttribute('data-world')") !== 'orbit') throw new Error('data-world not orbit');
   if (ev('state.world') !== 'orbit') throw new Error('state.world not orbit');
   if (!ev("!!document.getElementById('brand-font-Unbounded')")) throw new Error('orbit display font link not added');
   // legacy attrs gone
   if (ev("document.documentElement.getAttribute('data-look')")) throw new Error('data-look should be cleared');
   if (ev("document.documentElement.getAttribute('data-mood')")) throw new Error('data-mood should be cleared');
 });
 check('setWorld falls back to DEFAULT_WORLD on a bad id', () => {
   ev("setWorld('nonsense')");
   if (ev('state.world') !== 'molten') throw new Error('bad id should fall back to molten');
 });
```

- [ ] **Step 2: Run it, expect FAIL** — `setWorld is not defined`.

- [ ] **Step 3: Replace `applyLook`/`setLook`/`setMood`** (~lines 8542–8558) with:

```js
// Apply the active world: set data-world, ensure its fonts are loaded, clear the legacy
// look/mood attributes + brand inline vars. Theme (data-theme) is a separate axis (setTheme).
function applyWorld() {
  const html = document.documentElement;
  const id = WORLDS[state.world] ? state.world : DEFAULT_WORLD;
  state.world = id;
  html.setAttribute('data-world', id);
  html.removeAttribute('data-look');
  html.removeAttribute('data-mood');
  BRAND_INLINE_VARS.forEach(p => html.style.removeProperty(p));
  html.style.setProperty('--wl', 'var(--c2)');
  html.style.setProperty('--accent-glow', 'color-mix(in srgb, var(--c1) 35%, transparent)');
  html.style.setProperty('--btn-primary-text', '#0a0f16');
  const f = WORLDS[id].fonts;
  ensureFontLoaded(f.display); ensureFontLoaded(f.body);
}
function setWorld(id) {
  state.world = WORLDS[id] ? id : DEFAULT_WORLD;
  applyWorld(); saveState();
  if (state.viewMode === 'display' && typeof renderDisplayView === 'function') renderDisplayView();
}
// Back-compat shim: older code/tests may still call applyLook(); route it to applyWorld().
function applyLook() { applyWorld(); }
```

- [ ] **Step 4: Re-grep for other callers** — `grep -n "applyLook()\|setMood(\|setLook(" index.html`. Expect callers of `applyLook()` (init/theme paths) — they keep working via the shim. Callers of `setMood(`/`setLook(` are the two pickers (Tasks 6–7) — leave until then.

- [ ] **Step 5: Run it, expect PASS** — `SA_HTML=index.html node tests/worlds.js` (the two new checks pass).

---

## Task 3: `worldSwatchHtml()` (replace `moodSwatchHtml`)

**Files:** Modify `index.html` (near the registry from Task 1). Test: `tests/worlds.js`.

- [ ] **Step 1: Add the failing test:**

```js
 check('worldSwatchHtml renders a labeled, selectable tile per world', () => {
   const html = ev("worldSwatchHtml('atomic', true)");
   if (!/data-world-opt="atomic"/.test(html)) throw new Error('missing data-world-opt');
   if (!/Atomic/.test(html)) throw new Error('missing label');
   if (!/\bsel\b/.test(html)) throw new Error('selected class not applied');
 });
```

- [ ] **Step 2: Run it, expect FAIL** — `worldSwatchHtml is not defined`.

- [ ] **Step 3: Add the function** right after the `WORLDS`/`WORLD_ORDER`/`DEFAULT_WORLD` block (Task 1):

```js
// One preview tile for a world. Reused by the Settings picker + the wizard step.
function worldSwatchHtml(id, selected) {
  const w = WORLDS[id]; if (!w) return '';
  const c = w.swatch;
  const grad = `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 52%, ${c[2]} 100%)`;
  return `<button type="button" class="world-swatch${selected ? ' sel' : ''}" data-world-opt="${id}" title="${w.label}" style="--sw:${grad};font-family:${w.fonts.display},system-ui,sans-serif;">`
    + `<span class="ws-chip" style="background:${grad};"></span>`
    + `<span class="ws-name">${w.emoji} ${w.label}</span></button>`;
}
```

- [ ] **Step 4: Add its CSS** next to the existing `.mood-picker` rule (~line 808 `.mood-picker{display:flex;gap:8px;flex-wrap:wrap}`). Add on the following line:

```css
.world-picker{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.world-swatch{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);cursor:pointer;font-size:14px;text-align:left}
.world-swatch.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.world-swatch .ws-chip{width:26px;height:26px;border-radius:7px;flex:0 0 auto}
.world-swatch .ws-name{font-weight:600;letter-spacing:.01em}
```

- [ ] **Step 5: Run it, expect PASS.**

---

## Task 4: Default + migration (`DEFAULT_STATE` and `loadState`)

**Files:** Modify `index.html`: `DEFAULT_STATE` (~lines 2167–2168) and `loadState` return (~line 2420). Test: `tests/worlds.js`.

- [ ] **Step 1: Add the failing test:**

```js
 check('DEFAULT_STATE.world is molten; legacy look/mood migrate to a world', () => {
   if (ev('DEFAULT_STATE.world') !== 'molten') throw new Error('default world not molten');
   // simulate a legacy save (v3 mood era) and reload state via loadState
   ev("localStorage.setItem('stageAssign.v3', JSON.stringify({ look:'aurora', auroraMood:'nebula', service:{name:'x'} }))");
   ev('state = loadState()');
   if (ev('state.world') !== 'molten') throw new Error('legacy save should migrate to DEFAULT_WORLD molten, got '+ev('state.world'));
 });
```

- [ ] **Step 2: Run it, expect FAIL** — `DEFAULT_STATE.world` undefined.

- [ ] **Step 3a:** In `DEFAULT_STATE` (~line 2167–2168) replace:
```js
  look: 'aurora',
  auroraMood: 'graphite'
```
with:
```js
  world: 'molten'
```
(Drop the root `look`/`auroraMood` defaults — the world axis replaces them.)

- [ ] **Step 3b:** In the `loadState()` return object (spread `{ ...DEFAULT_STATE, ...p, … }`, ~line 2420), add an explicit migration key **after** `...p` so it wins over any legacy value:
```js
    world: (p.world && typeof WORLDS !== 'undefined' && WORLDS[p.world]) ? p.world : 'molten',
```
This ignores legacy `look`/`auroraMood` (any old save → Molten) and honors a real saved `world`.

- [ ] **Step 4: Run it, expect PASS.**

---

## Task 5: Swap the Settings → Display picker

**Files:** Modify `index.html`: `renderLayoutEditor()` — the `.mood-picker` markup (~lines 5603–5605) and its `[data-mood-opt]` handler (~lines 6014–6016). Test: `tests/worlds.js`.

- [ ] **Step 1: Add the failing test:**

```js
 check('Settings Display tab renders world swatches and applies on click', () => {
   ev('toast=function(){};saveState=function(){};renderDisplayView=function(){};renderLayoutEditor()');
   const picker = doc.querySelector('#layoutEdit .world-picker');
   if (!picker) throw new Error('no .world-picker in Display tab');
   const tiles = picker.querySelectorAll('[data-world-opt]');
   if (tiles.length !== 6) throw new Error('expected 6 world tiles, got '+tiles.length);
   const orbit = picker.querySelector('[data-world-opt="orbit"]');
   orbit.click();
   if (ev('state.world') !== 'orbit') throw new Error('clicking a tile did not setWorld');
 });
```

- [ ] **Step 2: Run it, expect FAIL** — no `.world-picker`.

- [ ] **Step 3a:** Replace the markup at ~5603–5605:
```html
    <div class="mood-picker">
      ${AURORA_MOODS.map(m=>moodSwatchHtml(m, state.auroraMood===m)).join('')}
    </div>
```
with:
```html
    <div class="world-picker">
      ${WORLD_ORDER.map(id=>worldSwatchHtml(id, state.world===id)).join('')}
    </div>
```

- [ ] **Step 3b:** Replace the handler at ~6014–6016:
```js
  el.querySelectorAll('[data-mood-opt]').forEach(b => b.addEventListener('click', e => {
    setMood(e.currentTarget.dataset.moodOpt); renderLayoutEditor();
  }));
```
with:
```js
  el.querySelectorAll('[data-world-opt]').forEach(b => b.addEventListener('click', e => {
    setWorld(e.currentTarget.dataset.worldOpt); renderLayoutEditor();
  }));
```

- [ ] **Step 4: Run it, expect PASS.**

---

## Task 6: Swap the wizard "look" step picker

**Files:** Modify `index.html`: wizard look step markup (~lines 11575–11577) and its handler (~lines 12161–12164). Test: `tests/worlds.js` + `tests/wizquickwins.js`.

- [ ] **Step 1: Add the failing test** to `tests/worlds.js`:

```js
 check('wizard look step renders world swatches', () => {
   // renderWizardStep for the "look" step should emit .world-picker with 6 tiles.
   ev("state.wizardStep = WIZARD_STEPS.indexOf('look'); renderWizardStep && renderWizardStep();");
   const picker = doc.querySelector('.wizard-body .world-picker, #wizardBody .world-picker, .world-picker');
   if (!picker) throw new Error('wizard look step has no .world-picker');
   if (picker.querySelectorAll('[data-world-opt]').length !== 6) throw new Error('expected 6 world tiles in wizard');
 });
```
(If `WIZARD_STEPS`/`renderWizardStep` names differ, re-grep `grep -n "renderWizardStep\|WIZARD_STEPS\|'look'" index.html` and adjust the eval to render the look step; the assertion on `.world-picker` is the contract.)

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3a:** Replace the wizard markup at ~11575–11577:
```html
          <div class="mood-picker">
            ${AURORA_MOODS.map(m => moodSwatchHtml(m, (state.auroraMood || 'graphite') === m)).join('')}
          </div>
```
with:
```html
          <div class="world-picker">
            ${WORLD_ORDER.map(id => worldSwatchHtml(id, (state.world || 'molten') === id)).join('')}
          </div>
```

- [ ] **Step 3b:** Replace the wizard handler at ~12161–12164:
```js
  body.querySelectorAll('[data-mood-opt]').forEach(b => b.addEventListener('click', () => {
    setMood(b.dataset.moodOpt);
    renderWizardStep();
  }));
```
with:
```js
  body.querySelectorAll('[data-world-opt]').forEach(b => b.addEventListener('click', () => {
    setWorld(b.dataset.worldOpt);
    renderWizardStep();
  }));
```

- [ ] **Step 4: Run it, expect PASS** (`tests/worlds.js`). Leave `tests/wizquickwins.js` for Task 8.

---

## Task 7: `renderDisplayView()` dispatcher seam

**Files:** Modify `index.html`: top of `renderDisplayView()` (~line 8145). Test: `tests/worlds.js`.

- [ ] **Step 1: Add the failing test:**

```js
 check('renderDisplayView delegates to a world renderer when present', () => {
   ev("window.__ran=null; WORLDS.molten.renderDisplay = function(){ window.__ran='molten'; };");
   ev("state.world='molten'; renderDisplayView();");
   const ran = ev('window.__ran');
   ev("delete WORLDS.molten.renderDisplay;");   // clean up so the default path is restored
   if (ran !== 'molten') throw new Error('dispatcher did not call WORLDS.molten.renderDisplay');
 });
 check('renderDisplayView runs the default layout without throwing when no world renderer', () => {
   ev("state.world='molten'; renderDisplayView();");  // must not throw
 });
```

- [ ] **Step 2: Run it, expect FAIL** — dispatcher not wired (first check fails; `__ran` stays null).

- [ ] **Step 3:** Insert the seam as the **first lines inside** `renderDisplayView()` (right after `function renderDisplayView() {` at ~8145, before `const s = state.service;`):

```js
  // World dispatcher: a world may define its own bespoke display renderer (later phases).
  // If it does, delegate entirely; otherwise fall through to the default layout below.
  const __world = WORLDS[state.world] || WORLDS[DEFAULT_WORLD];
  if (__world && typeof __world.renderDisplay === 'function') { __world.renderDisplay(); return; }
```

- [ ] **Step 4: Run it, expect PASS.**

---

## Task 8: Retire the mood machinery + update the theme-era tests

**Files:** Modify `index.html` (remove dead mood code + stale refs); rewrite `tests/aurora.js`; update `tests/wizquickwins.js`.

- [ ] **Step 1:** Re-grep for every stale reference: `grep -n "AURORA_MOODS\|auroraMood\|moodSwatchHtml\|MOOD_COLORS\|MOOD_LABEL\|setMood\|setLook\|data-mood\|data-look" index.html`. Expect hits only in: (a) `applyWorld` already clears `data-look`/`data-mood` (keep); (b) any remaining `state.auroraMood`/`state.look` reads. Remove/redirect each:
  - Delete `const MOOD_COLORS = {…}` and `const MOOD_LABEL = {…}` if still present (Task 1 removed the block that held them — confirm they're gone; if any survived, delete).
  - Delete `setLook`/`setMood` if any copy remains (Task 2 replaced them; ensure no duplicate).
  - Any `state.auroraMood`/`state.look` reads outside `applyWorld`: replace with `state.world` semantics or delete.

- [ ] **Step 2:** Rewrite `tests/aurora.js` → assert the world engine (keep the filename so the runner + WATCHLIST references hold; add a top comment: "Rewritten 2026-07-07: the 11 moods were replaced by 6 worlds — see worlds.js; this file now asserts the world token axis + applyBrand no-op."). Minimal content:

```js
// Rewritten 2026-07-07: moods → worlds. Asserts the world token axis is applied and
// applyBrand still no-ops (brand inline vars cleared) under a world.
// [copy the harness header from the previous tests/aurora.js lines 1–13]
window.addEventListener('load',()=>setTimeout(()=>{
 const doc=window.document, ev=c=>window.eval(c);
 const errs=[]; function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
 check('default world molten applied to <html>', () => {
   ev("setWorld('molten')");
   if (doc.documentElement.getAttribute('data-world')!=='molten') throw new Error('data-world not set');
   if (doc.documentElement.getAttribute('data-look')) throw new Error('legacy data-look present');
 });
 check('dark/light axis is independent of world', () => {
   ev("setTheme('light')");
   if (doc.documentElement.getAttribute('data-theme')!=='light') throw new Error('theme not light');
   if (doc.documentElement.getAttribute('data-world')!=='molten') throw new Error('world changed with theme');
   ev("setTheme('dark')");
 });
 check('applyBrand is a no-op under a world (no --accent inline clobber)', () => {
   ev("state.brand={accent:'#d4a147'}; if(typeof applyBrand==='function') applyBrand();");
   if (ev("document.documentElement.style.getPropertyValue('--accent')")) throw new Error('applyBrand must not set --accent');
   ev("state.brand={}");
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n')); process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 3:** In `tests/wizquickwins.js`, the look-step check (~lines 44–53) asserts `.mood-picker` / mood swatches. Update those assertions to `.world-picker` and `[data-world-opt]` (6 tiles), matching Task 6. Keep the rest of the file unchanged.

- [ ] **Step 4: Run the full suite** — `npm run check` then `npm test`.
  Expected: `npm run check` → "JS syntax OK; CSS balanced". `npm test` → SUITE GREEN (allowing `curve.js`). Fix any remaining stale-reference errors surfaced here before proceeding.

- [ ] **Step 5: Browser QA (headless).** Serve + screenshot each world in both themes to confirm recolor+refont works and the display renders:
```bash
python3 -m http.server 8099 >/tmp/sa.log 2>&1 &
# then, via the browse tool: goto localhost:8099/index.html, setWorld('molten'|'concrete'|'corporate'|'terra'|'orbit'|'atomic'), toggle setTheme, screenshot each; confirm no console errors.
```
Expected: each world visibly changes palette + display font; no console errors; the display view renders under every world.

---

## Task 9: Build stamp + commit

**Files:** Modify `index.html` (build stamp ~line 1862).

- [ ] **Step 1:** Bump the stamp: change `<div id="buildStamp">build 2026-07-07·c</div>` to `<div id="buildStamp">build 2026-07-08·a</div>` (or next letter for today's date at execution time — re-grep the current value first).

- [ ] **Step 2: Final gates** — `npm run check && npm test`. Both green.

- [ ] **Step 3: Commit** (do NOT push without confirming with Dillon — push = deploy):
```bash
git add index.html tests/worlds.js tests/aurora.js tests/wizquickwins.js
git commit -m "feat(worlds): Phase 0 — world engine replaces the 11 moods

6 curated worlds (Molten/Concrete/Corporate/Terra/Orbit/Atomic) on the
existing dark/light axis: data-world CSS token blocks (+per-world fonts),
WORLDS registry, setWorld/applyWorld, world-swatch picker (Settings +
wizard), loadState migration (legacy → Molten), and a renderDisplayView
dispatcher seam for future per-world layouts. Recolor+refont only this
phase; bespoke per-world layouts land per follow-up phase.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against the spec)

**Spec coverage (§ of `2026-07-07-display-worlds-design.md`):**
- §3.1 `data-world`+`data-theme`, remove `data-look`/`data-mood` → Tasks 1, 2. ✅
- §3.2 `WORLDS` registry, `setWorld`/`applyWorld` → Tasks 1, 2. ✅
- §3.3 CSS token model reusing existing prop names → Task 1 (reuses `--bg/--surface/--text/--accent`; adds `--ff-display/--ff-body` per world). ✅
- §3.4 `renderDisplayView` dispatcher → Task 7 (seam only; per-world renderers are follow-up phases, as scoped). ✅ (partial by design)
- §3.5 on-demand fonts → Task 2 (`ensureFontLoaded` per world). ✅
- §4 migration / retire moods → Tasks 4, 8. ✅
- §5 picker (settings + wizard) → Tasks 5, 6. ✅
- §6 tests green + new `worlds.js` + updated `aurora.js`/`wizquickwins.js` → Tasks 1–8. ✅
- §3.6 textures, §1/§2 per-world bespoke **layouts/faces** → **deferred to follow-up per-world phases** (explicit in the Scope note). Gap is intentional and stated.

**Placeholder scan:** No TBD/TODO; every code step shows the code and exact anchors. The one soft spot is Task 6's wizard eval (function-name dependent) — mitigated with a re-grep instruction and a concrete assertion contract.

**Type/name consistency:** `WORLDS`, `WORLD_ORDER`, `DEFAULT_WORLD`, `state.world`, `setWorld`, `applyWorld`, `worldSwatchHtml`, `data-world`, `data-world-opt`, `.world-picker`, `.world-swatch` used consistently across Tasks 1–9. `applyLook` kept only as a back-compat shim (Task 2). ✅

## Follow-up phases (separate plans)
One per world — Concrete → Corporate → Atomic → Terra → Orbit — each: bespoke `renderDisplay_<world>` wired through the Task-7 seam + its bespoke CSS/texture/radius (dark+light) matching its mockup, editor kept calm, on-demand fonts already handled, tests + browser QA, ship. (Molten's bespoke equal-lineup layout can be its own small plan or fold into Concrete's.)
