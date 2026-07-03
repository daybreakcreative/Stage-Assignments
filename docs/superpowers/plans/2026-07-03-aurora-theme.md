# Aurora Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Aurora" — a luminous frosted-glass look with selectable color *moods* and dark/light modes — as an **opt-in, selectable theme** in Stage·Assign, without changing the current default look.

**Architecture:** Introduce a second theming axis. Today `data-theme` on `<html>` carries dark/light. Add an independent `data-look` attribute (`classic` = today's look, default; `aurora` = new) plus `data-mood` for Aurora's color palette. All Aurora CSS is scoped under `[data-look="aurora"]`, so with `data-look` absent/`classic` the app renders **exactly as it does today** (beta-safe). Aurora re-defines the existing CSS custom properties (`--bg`, `--surface`, `--text`, `--accent`, `--border`, …) so the 1402 existing `var(--…)` usages recolor automatically; targeted rules add the glass + drifting-light atmosphere. A settings control switches look + mood; the existing `#themeBtn` still toggles dark/light.

**Tech Stack:** Single-file vanilla `index.html` (HTML/CSS/JS, `localStorage` state). Google Fonts. Test harness = jsdom via `tests/*.js` (`npm test`); syntax/CSS-balance via `npm run check`. Visual fidelity is verified on the booth (jsdom cannot compute layout/`backdrop-filter`).

**Decisions locked from brainstorming:**
- Look chosen: **Aurora** (drifting aurora gradient + frosted glass). Reference mocks: `docs/design-aurora.html`, `docs/design-aurora-moods.html`, `docs/design-aurora-moods-2.html`.
- Dark is primary; light must remain legible.
- Moods are **selectable "looks."** The final mood shortlist + default are chosen by the user from the galleries. **Nebula** is used below as the concrete default; every other mood is a pure data addition (one CSS rule + one switcher option). Adding the user's shortlist is mechanical — see Task 4.
- Fonts: display **Bricolage Grotesque**, body **Familjen Grotesk** (Aurora only; classic keeps Fraunces/Geist/JetBrains).
- IEM assignment stays visually prominent (already fixed in classic; carried into Aurora).
- **Print is never Aurora** — `@media print` must render the plain print layout regardless of look.

**Non-goals (YAGNI):** No per-venue theming (theme is a device/global preference like `state.theme`). No animated backdrop in the editor beyond a static tint (motion lives on the display). No new build step.

---

## File Structure

Everything lives in `index.html` (single-file constraint — GOLDEN RULE 1). Logical regions touched:

- **`<head>` fonts** (line ~9): add two families.
- **State defaults** (`DEFAULT_STATE`, ~line 2084 `theme:'dark'`): add `look`, `auroraMood`.
- **Theme JS** (`setTheme`/`toggleTheme`, ~lines 8475–8485; startup `setTheme` call ~12410): add `applyLook()`, `setLook()`, `setMood()`; call at startup.
- **Topbar control** (`#themeBtn`, ~line 1486; wiring ~12360): add a look/mood picker button + popover.
- **Settings** (display settings block, ~lines 5403–5434): add a "Look & theme" section.
- **CSS — new Aurora block** (append near end of `<style>`, before `@media print` at ~1233 so print overrides win): tokens, atmosphere, glass, per-surface rules, all scoped `[data-look="aurora"]`.
- **Tests:** new `tests/aurora.js`.

New test file:
- Create: `tests/aurora.js` — theme/look/mood persistence, attribute application, switcher wiring, classic-theme regression, print guard.

---

## Task 1: Theme plumbing — `look` + `mood` state, apply, persist

**Files:**
- Modify: `index.html` — `DEFAULT_STATE` (~2084), theme functions (~8475–8485), startup call (~12410)
- Test: `tests/aurora.js`

- [ ] **Step 1: Write the failing test**

Create `tests/aurora.js` using the standard harness header (copy from `tests/setupmgr.js` lines 1–14: JSDOM + VirtualConsole + polyfills + `ev`/`doc`/`check`). Then:

```js
window.addEventListener('load',()=>setTimeout(()=>{
  const html=doc.documentElement;

  check('defaults: look=classic, theme=dark, auroraMood=nebula', ()=>{
    if(ev('state.look')!=='classic') throw new Error('look default not classic: '+ev('state.look'));
    if(ev('state.auroraMood')!=='nebula') throw new Error('mood default not nebula: '+ev('state.auroraMood'));
  });

  check('applyLook sets data-look + data-mood on <html>; classic leaves no aurora attrs', ()=>{
    ev('setLook("classic")');
    if(html.getAttribute('data-look')!=='classic') throw new Error('data-look not classic');
    ev('setLook("aurora")');
    if(html.getAttribute('data-look')!=='aurora') throw new Error('data-look not aurora');
    if(html.getAttribute('data-mood')!=='nebula') throw new Error('data-mood not applied');
  });

  check('setMood persists + applies', ()=>{
    ev('setLook("aurora"); setMood("dusk")');
    if(ev('state.auroraMood')!=='dusk') throw new Error('mood not saved');
    if(html.getAttribute('data-mood')!=='dusk') throw new Error('data-mood attr not dusk');
    ev('setMood("nebula")'); // restore
  });

  check('dark/light still independent of look (setTheme unchanged)', ()=>{
    ev('setLook("aurora"); setTheme("light")');
    if(html.getAttribute('data-theme')!=='light') throw new Error('theme axis broke');
    if(html.getAttribute('data-look')!=='aurora') throw new Error('look lost on theme change');
    ev('setTheme("dark")');
  });

  console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
  if(errs.length) console.log(errs.join('\n'));
  process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/aurora.js`
Expected: FAIL — `setLook`/`setMood` not defined, `state.look` undefined.

- [ ] **Step 3: Add state defaults**

In `DEFAULT_STATE`, change the theme line (~2084) from:

```js
  theme: 'dark'
```

to:

```js
  theme: 'dark',
  look: 'classic',        // 'classic' (current look) | 'aurora'
  auroraMood: 'nebula'    // active Aurora color mood; ignored unless look==='aurora'
```

- [ ] **Step 4: Add apply/set functions**

Immediately after `toggleTheme()` (~line 8485), add:

```js
const AURORA_MOODS = ['nebula'];  // extended in Task 4 with the user's shortlist
function applyLook() {
  const html = document.documentElement;
  const look = (state.look === 'aurora') ? 'aurora' : 'classic';
  html.setAttribute('data-look', look);
  if (look === 'aurora') {
    const mood = AURORA_MOODS.includes(state.auroraMood) ? state.auroraMood : 'nebula';
    html.setAttribute('data-mood', mood);
  } else {
    html.removeAttribute('data-mood');
  }
}
function setLook(look) {
  state.look = (look === 'aurora') ? 'aurora' : 'classic';
  applyLook(); saveState();
  if (state.viewMode === 'display' && typeof renderDisplayView === 'function') renderDisplayView();
}
function setMood(mood) {
  state.auroraMood = AURORA_MOODS.includes(mood) ? mood : 'nebula';
  applyLook(); saveState();
  if (state.viewMode === 'display' && typeof renderDisplayView === 'function') renderDisplayView();
}
```

- [ ] **Step 5: Apply at startup**

At the startup `setTheme` call (~line 12410), change:

```js
  setTheme(state.theme || 'dark');
```

to:

```js
  setTheme(state.theme || 'dark');
  applyLook();
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node tests/aurora.js`
Expected: PASS — all 4 checks OK.
Then `npm run check` (expect `JS syntax OK; CSS balanced`) and `npm test` (expect SUITE GREEN).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/aurora.js
git commit -m "feat(theme): add look/mood theming axis (classic default, aurora opt-in)"
```

---

## Task 2: Load Aurora fonts

**Files:**
- Modify: `index.html` line ~9 (Google Fonts `<link>`)

- [ ] **Step 1: Extend the fonts link**

Replace the `href` on line ~9 so it also requests the two Aurora families (append to the existing `family=` list — keep Fraunces/JetBrains Mono/Geist):

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Familjen+Grotesk:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify**

Run: `npm run check` (Expected: `JS syntax OK; CSS balanced`). Fonts only load when Aurora rules reference them, so classic is unaffected (verify visually later).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore(theme): request Bricolage Grotesque + Familjen Grotesk for Aurora"
```

---

## Task 3: Aurora token layer + atmosphere (dark + light, Nebula)

**Files:**
- Modify: `index.html` — append a new Aurora CSS block INSIDE `<style>`, positioned **just before** `@media print{` (~line 1233) so print rules always win.

- [ ] **Step 1: Add the Aurora token + atmosphere block**

Insert before `@media print{`:

```css
/* ===================== AURORA LOOK (opt-in: [data-look="aurora"]) ===================== */
/* Re-defines core tokens so existing var(--…) usages recolor. Mood sets --c1/--c2/--c3. */
[data-look="aurora"]{
  --ff-display:'Bricolage Grotesque',system-ui,sans-serif;
  --ff-body:'Familjen Grotesk',system-ui,sans-serif;
  --mix:24%;
  /* dark tokens */
  --bg:var(--gd);--bg-elev:rgba(255,255,255,.05);--bg-inset:rgba(255,255,255,.03);
  --surface:rgba(255,255,255,.055);--surface-2:rgba(255,255,255,.08);
  --border:rgba(255,255,255,.13);--border-2:rgba(255,255,255,.2);
  --text:#eef2ff;--text-muted:#9aa3c4;--text-faint:#5c6488;
  --accent:var(--c1);--accent-2:var(--c2);--accent-dim:color-mix(in srgb,var(--c1) 16%,transparent);
}
[data-look="aurora"][data-theme="light"]{
  --mix:36%;--gd:#eef1f8;
  --bg-elev:rgba(255,255,255,.6);--bg-inset:rgba(255,255,255,.5);
  --surface:rgba(255,255,255,.62);--surface-2:rgba(255,255,255,.8);
  --border:rgba(30,40,90,.14);--border-2:rgba(30,40,90,.24);
  --text:#141834;--text-muted:#5b6288;--text-faint:#98a0c4;
}
/* --- moods (Task 4 appends the user's shortlist here) --- */
[data-look="aurora"][data-mood="nebula"]{--c1:#67e8f9;--c2:#b39cff;--c3:#f7a8d8;--gd:#080b16}

/* drifting aurora backdrop on the app ground */
[data-look="aurora"] body{
  background:
    radial-gradient(52% 60% at 12% 6%, color-mix(in srgb,var(--c1) var(--mix),transparent), transparent 60%),
    radial-gradient(56% 66% at 90% 16%, color-mix(in srgb,var(--c2) var(--mix),transparent), transparent 62%),
    radial-gradient(62% 62% at 58% 104%, color-mix(in srgb,var(--c3) calc(var(--mix) - 5%),transparent), transparent 60%),
    var(--gd);
  background-attachment:fixed;background-size:200% 200%;animation:auroraDrift 22s ease-in-out infinite}
@keyframes auroraDrift{0%,100%{background-position:0% 0%,100% 0%,50% 100%}50%{background-position:22% 26%,72% 12%,42% 82%}}
@media (prefers-reduced-motion:reduce){[data-look="aurora"] body{animation:none}}

/* frosted-glass treatment for the surfaces that were solid panels */
[data-look="aurora"] .dv-voc-card,
[data-look="aurora"] .dv-side-block,
[data-look="aurora"] .voc-card,
[data-look="aurora"] .setup-review-sheet,
[data-look="aurora"] .stage-box{
  background:var(--surface);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 34px rgba(0,0,0,.22)}
```

- [ ] **Step 2: Verify balance + no regression**

Run: `npm run check` (Expected: `JS syntax OK; CSS balanced` — brace count must still match). Then `npm test` (Expected: SUITE GREEN — jsdom ignores the visual rules).

- [ ] **Step 3: Booth-visual check (manual, note in commit)**

In a browser: toggle Aurora via console `setLook('aurora')`. Confirm the app ground drifts, cards frost, text stays readable in dark and light (`setTheme('light')`). Classic look (`setLook('classic')`) must be pixel-identical to before.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(theme): Aurora token layer + drifting-glass atmosphere (dark/light, Nebula)"
```

---

## Task 4: Add the user's chosen moods

> Do this task **after the user selects moods** from `docs/design-aurora-moods*.html`. Each mood = one CSS rule + one array entry + (Task 5) one switcher chip. Values below are the full candidate set from the galleries; **keep only the shortlist the user picked.**

**Files:**
- Modify: `index.html` — mood CSS rules (Task 3 block) + `AURORA_MOODS` array (Task 1)

- [ ] **Step 1: Append chosen mood CSS rules**

After the `nebula` rule, add one line per chosen mood (copy exact triads from the gallery; examples):

```css
[data-look="aurora"][data-mood="northern"]{--c1:#4ade80;--c2:#2dd4bf;--c3:#a78bfa;--gd:#060f0c}
[data-look="aurora"][data-mood="dusk"]    {--c1:#8b9cff;--c2:#c08cff;--c3:#7fb0ff;--gd:#090a1a}
[data-look="aurora"][data-mood="vesper"]  {--c1:#9a86f5;--c2:#e6b45a;--c3:#6a8cff;--gd:#0b0913}
[data-look="aurora"][data-mood="ember"]   {--c1:#ffb865;--c2:#ff8fa3;--c3:#ffd98a;--gd:#130c09}
[data-look="aurora"][data-mood="graphite"]{--c1:#cbd3dd;--c2:#8b95a3;--c3:#5b6472;--gd:#0a0b0d;--mix:14%}
/* …only the ones the user shortlisted… */
```

Note: minimal/mono moods (e.g. `graphite`, `ink`, `slate`, `platinum`, `pearl`) also set a lower `--mix`; in `[data-theme="light"]` their near-white `--c1` should fall back so IEM stays legible — add if any mono mood is chosen:

```css
[data-look="aurora"][data-theme="light"][data-mood="graphite"] .dv-voc-line .val{color:var(--text)}
```

- [ ] **Step 2: Extend the AURORA_MOODS array**

Update the array from Task 1 to list every chosen mood id, e.g.:

```js
const AURORA_MOODS = ['nebula','dusk','vesper','ember'];  // ← user's shortlist
```

- [ ] **Step 3: Verify**

Run: `npm run check` then `npm test` (Expected: both green). In browser, `setMood('<each>')` cycles palettes live.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(theme): add selected Aurora moods (<list>)"
```

---

## Task 5: Look & mood switcher UI

**Files:**
- Modify: `index.html` — topbar (~1486 near `#themeBtn`), settings block (~5424), wiring (~12360)
- Test: `tests/aurora.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/aurora.js` before the RESULT block:

```js
  check('settings renders a look picker with classic + aurora', ()=>{
    if(typeof window.renderDisplaySettings==='function') ev('renderDisplaySettings()');
    else if(typeof window.renderLayoutEditor==='function') ev('renderLayoutEditor()');
    const opts=[...doc.querySelectorAll('[data-look-opt]')].map(b=>b.getAttribute('data-look-opt'));
    if(!opts.includes('classic')||!opts.includes('aurora')) throw new Error('look options missing: '+JSON.stringify(opts));
  });
  check('clicking the aurora look option switches state.look', ()=>{
    const a=doc.querySelector('[data-look-opt="aurora"]'); if(!a) throw new Error('no aurora option');
    a.click();
    if(ev('state.look')!=='aurora') throw new Error('look not switched by UI');
    const c=doc.querySelector('[data-look-opt="classic"]'); if(c) c.click(); // restore
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/aurora.js` — Expected: FAIL (`[data-look-opt]` not found).

- [ ] **Step 3: Add the settings UI**

In the display-settings template (after the existing show/hide toggles ~5434), add a "Look & theme" section. (Confirm the enclosing render fn name by grepping `setupsEdit`/`layoutEdit`/`data-display` — reuse the file's existing pattern.) Insert:

```js
    `<div class="section-label" style="margin-bottom:8px;">Look &amp; theme</div>
    <div class="look-picker" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <button class="btn ghost${state.look!=='aurora'?' primary':''}" data-look-opt="classic">Classic</button>
      <button class="btn ghost${state.look==='aurora'?' primary':''}" data-look-opt="aurora">Aurora</button>
    </div>
    <div class="mood-picker" style="display:${state.look==='aurora'?'flex':'none'};gap:6px;flex-wrap:wrap;">
      ${AURORA_MOODS.map(m=>`<button class="btn ghost${state.auroraMood===m?' primary':''}" data-mood-opt="${m}">${m}</button>`).join('')}
    </div>`
```

- [ ] **Step 4: Wire the buttons**

In the same render fn's wiring section (near the `[data-display]` handler), add:

```js
  el.querySelectorAll('[data-look-opt]').forEach(b=>b.addEventListener('click',e=>{
    setLook(e.currentTarget.dataset.lookOpt);
    (typeof renderDisplaySettings==='function'?renderDisplaySettings:renderLayoutEditor)();
  }));
  el.querySelectorAll('[data-mood-opt]').forEach(b=>b.addEventListener('click',e=>{
    setMood(e.currentTarget.dataset.moodOpt);
    (typeof renderDisplaySettings==='function'?renderDisplaySettings:renderLayoutEditor)();
  }));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/aurora.js` (Expected: PASS). Then `npm run check` + `npm test` (Expected: green).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/aurora.js
git commit -m "feat(theme): Look & theme picker (classic/aurora + mood) in settings"
```

---

## Task 6: Per-surface Aurora polish + print guard

**Files:**
- Modify: `index.html` — Aurora CSS block (per-surface rules) + verify `@media print`
- Test: `tests/aurora.js`

- [ ] **Step 1: Write the print-guard test**

Add to `tests/aurora.js`:

```js
  check('print stylesheet is not scoped to a look (prints plain regardless)', ()=>{
    const css=ev('document.querySelector("style").textContent');
    const printIdx=css.indexOf('@media print');
    if(printIdx<0) throw new Error('no @media print block');
    // No aurora-scoped selectors should live inside the print block.
    const printBlock=css.slice(printIdx, printIdx+2000);
    if(/data-look/.test(printBlock)) throw new Error('print block must not depend on look');
  });
```

- [ ] **Step 2: Run to verify (should PASS already)**

Run: `node tests/aurora.js` — Expected: PASS (print block predates Aurora and has no `data-look`). This test locks that in.

- [ ] **Step 3: Add per-surface polish rules**

Append to the Aurora CSS block (scoped `[data-look="aurora"]`): glowing IEM, gradient section labels, glass inputs. Example:

```css
[data-look="aurora"] .dv-voc-line .val{color:var(--text)}
[data-look="aurora"][data-theme="dark"] .dv-list-item .detail{color:var(--c1);text-shadow:0 0 14px color-mix(in srgb,var(--c1) 55%,transparent)}
[data-look="aurora"] .dv-section-label{background:linear-gradient(90deg,var(--c1),var(--c2));-webkit-background-clip:text;background-clip:text;color:transparent}
[data-look="aurora"] select,[data-look="aurora"] input[type=text]{background:var(--bg-inset);border:1px solid var(--border-2);color:var(--text)}
```

- [ ] **Step 4: Verify + booth-visual pass**

Run: `npm run check` + `npm test` (green). Booth: in Aurora, walk display view, editor, wizard, setup manager, and **File→Print / print summary** — confirm print is the plain classic layout (no glass, no glow, no dark ground).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/aurora.js
git commit -m "feat(theme): Aurora per-surface polish + lock print to plain layout"
```

---

## Task 7: Build-stamp bump, full QA, ship

**Files:**
- Modify: `index.html` (`#buildStamp`)

- [ ] **Step 1: Bump the build stamp**

Update `#buildStamp` to the next letter for the deploy day (e.g. `build 2026-07-03·g`), matching the project's stamp convention.

- [ ] **Step 2: Full validation**

Run: `npm run check` (Expected: `JS syntax OK; CSS balanced`). Run: `npm test` (Expected: `SUITE GREEN`, only known curve.js false-fail).

- [ ] **Step 3: Regression sweep against WATCHLIST**

Read `docs/WATCHLIST.md`; in the browser confirm classic look is unchanged (default), and Aurora doesn't break: display render, drag dividers, print one-page, setup checklist, PCO bar.

- [ ] **Step 4: Commit + deploy (with user confirmation)**

```bash
git add index.html
git commit -m "feat(theme): ship Aurora selectable theme — build 2026-07-03·g"
```

Per CLAUDE.md, treat `git push` as deploy — confirm with Dillon before pushing.

---

## Self-Review notes (author)

- **Spec coverage:** dark+light ✓ (Task 3), selectable moods ✓ (Tasks 4–5), dark-first ✓ (defaults), editor legibility ✓ (Task 6 inputs), IEM prominence ✓ (Task 6), beta-safe/no-regression ✓ (`data-look` opt-in + classic default + regression tests).
- **Deferred by design:** exact mood shortlist + default (Task 4) — awaiting user selection; Nebula is the concrete stand-in so Tasks 1–3,5–7 are fully executable now.
- **Risk:** `backdrop-filter` + `color-mix` need a modern engine (booth Chrome/Safari OK). If a target browser lacks them, cards fall back to `--surface` solid (still legible) — acceptable, note in booth check.
- **jsdom limit:** visual correctness is booth-verified; automated tests cover state/attribute/switcher/print-guard logic only. Stated honestly in each task.
