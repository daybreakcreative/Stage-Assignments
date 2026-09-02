# Stage·Assign — project context for Claude Code

Single-file web app that assigns mics, stage positions, and per-person setup
checklists for a worship team. Built as a generic tool for any worship team (multi-campus capable).
Deployed via GitHub Pages at **daybreakcreative.github.io/Stage-Assignments/**
(served as `index.html`).

It is in **active beta**. The owner (Dillon, Creative Dept Director) tests on a
booth computer and reports bugs by screenshot + exported JSON. He prefers direct,
concise, no-fluff communication and numbered steps.

---

## GOLDEN RULES (do not violate)

1. **It is ONE file: `index.html`.** Vanilla HTML + CSS + JS. No framework, no
   build step, no bundler, no npm runtime deps. All state lives in `localStorage`.
   Everything ships by editing `index.html` and pushing.
2. **Never ship a change until BOTH pass:** `npm run check` (syntax + CSS balance)
   and `npm test` (the jsdom regression suite, green except known false-fails).
3. **Never cause a regression.** The suite in `tests/` is the executable spec.
   `docs/WATCHLIST.md` is the human list of behaviors that must keep working.
   If you change behavior a test asserts, update the test *and* note why.
4. **Re-grep before every edit.** The file is ~12k lines; line numbers drift after
   each edit. Find the anchor text fresh, don't trust an old line number.
5. Keep the UI clean and functional over heavily styled. Match the existing tone.
6. This is a **desktop/laptop** tool. Phone is not a concern. Tablet touch-to-drag
   should keep working (the drag uses pointer events, which cover touch) but is low
   priority.

---

## VALIDATE EVERY CHANGE (the loop)

```bash
npm run check     # extracts the <script>, runs `node --check`, verifies CSS braces balance
npm test          # runs tests/run-all.js → every *.js test against index.html
```

`npm test` prints a PASS/FAIL line per test and a summary. Expected steady state:
**all PASS, allowing the known false-fails below.** A `PASS*` means a known
false-fail. Any `FAIL` is a real regression — fix it before shipping.

### Known false-fails (NOT bugs)
- **curve.js** → 1 issue ("control point not persisted to localStorage"). The test
  harness stubs `onSave`, which never writes localStorage, so the reload assertion
  can't see the value. The feature works in the browser.
- General jsdom quirk: `document.getElementById(...)` can return `null` for an
  element that is still in the DOM *after* `appendChild`/`insertBefore` moves
  (jsdom id-cache bug). This is why `renderDisplayView` guards element access. It is
  a jsdom artifact, not a browser bug — never "fix" it by deleting browser behavior.

### Writing new jsdom tests
Copy the harness header from `tests/editlayout.js` or `tests/smoke2.js`. It loads
`index.html` with `runScripts:'dangerously'` and polyfills (in `beforeParse`):
`structuredClone`, `matchMedia`, `scrollTo`, `Element.prototype.getBoundingClientRect`
→ 800×380, `url:'http://localhost/'` (else localStorage throws), `confirm`, `prompt`,
`setPointerCapture`/`releasePointerCapture`. Top-level `const`/`let` are not on
`window`; reach them via `window.eval('...')`. The HTML path is
`process.env.SA_HTML || ../index.html`. Add the new file to `tests/`; the runner
picks it up automatically.

---

## DEPLOY

GitHub Pages serves `index.html` from the repo. Workflow:

```bash
npm run check && npm test     # must be green
git add -A && git commit -m "…"
git push                      # Pages redeploys daybreakcreative.github.io/Stage-Assignments/
```

Do the validation before every commit. Treat `git push` as a deploy — confirm with
Dillon before pushing if there's any doubt.

---

## ARCHITECTURE CHEAT-SHEET

State: `state` (in `localStorage`), seeded from `DEFAULT_STATE`. `state.config` holds
display + stage settings; `state.instruments` (band, array of objects), `state.vocalists`,
`state.assignments` (vocalist positions), `state.serviceOrder` (run sheet, shared),
`state.inventory` (mics), `state.setupItems` (per-person checklists), `state.savedStages`.
Multi-venue machinery (`state.venues`, `switchVenue`, …) exists but its UI is **hidden
this release** — single venue only.

- **Stage SVG**: `viewBox 0 0 800 380`, **audience at TOP**. `getStageShape()` uses
  `state.config.customStagePoints` if present, else slider-derived shape
  (`seedPolygonPoints`). `rectangleStagePoints()` = the true-rectangle reset.
  `clampStagePosition()` keeps people inside the outline.
- **Edit Layout** (consolidated): one `#stageEditBtn` ("Edit Layout") → inline edit
  mode (`body.stage-editing`), NOT a modal. Toolbar `#stageEditToolbar` has Outline
  (`openPolygonStageEditor`), Features (`openStageFeaturesEditor`), Reset to Auto,
  Done. People drag via `wireSlotForPositionDrag` (pointer events; reads the people
  layer LIVE at drag time — slots are wired before being appended). The old
  `#stageEditModal`/`renderModalStage` is dormant.
- **Mics**: `renderInvEditor` over `state.inventory` (default `DEFAULT_INVENTORY` = 9
  mics, drag-rank via ⋮⋮ handles). Auto-Assign hands best mics to worship leaders first.
- **Setup checklists**: `state.setupItems[key]`; `SETUP_ITEM_PRESETS` (8 keys:
  drums/bass/ag/eg/keys/md/strings/vocals) each `{label, defaults, presets}`;
  `detectPresetKey` maps tags → a key. Boom-mic auto-add fires for a typed-name MD
  band person OR a vocalist who has an instrument explicitly linked to them
  (`inst.vocalistPlayer`) — on a full-name match or an explicit link.
- **Band ↔ vocalist linking**: on a PCO pull, `autoLinkBandToVocalists()` auto-links a band
  position to a vocalist when they are the **same person, matched on FULL name** (`normFullName`).
  Two people who share only a *first* name are NOT linked. The explicit "★ link / also a vocalist"
  control still sets `inst.vocalistPlayer` for manual/edge cases.
- **Display view**: `renderDisplayView` (full-viewport). Renders stage + band/hosts/
  vocalists + the service-order rail (`#dvRunSheetBlock`/`#dvRunSheetList`), gated by
  `d.showServiceOrder && serviceOrder.length && runSheetPosition!=='hidden'`. Element
  accesses are null-guarded so one missing node can't abort the whole render.
- **PCO**: in-app OAuth + Planning Center pull (header `#pcoBtn`, red when not
  connected). Not via MCP.
- **First-run wizard**: `WIZARD_STEPS` incl. stage / stage-layout / setup-intro /
  vocal-mics / iems.

---

## REGRESSION WATCHLIST

The canonical, human-readable list of behaviors that must keep working is in
**`docs/WATCHLIST.md`** (items 1–52). Read it before any non-trivial change. The
executable version is `tests/` — run `npm test`.

---

## PENDING / BACKLOG

See `docs/StageAssign_Backlog.md`. Standing idea: auto-refresh the active session
every ~3 min to keep a green-room display current.

---

## WORKING STYLE

Iterate in small, verified steps. Acknowledge mistakes briefly and fix them. After a
change: re-grep, edit, `npm run check`, `npm test`, then summarize concisely what
changed and what to test on the booth machine.
