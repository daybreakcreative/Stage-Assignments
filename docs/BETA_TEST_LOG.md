# Stage·Assign — Beta Test Log (first-time-user configure walkthrough)

**Date:** 2026-07-01
**Method:** Headless jsdom drive of `index.html` on a FRESH (cleared) localStorage,
same harness as `tests/smoke2.js` (`runScripts:'dangerously'`, `url:'http://localhost/'`,
polyfills for `structuredClone`/`matchMedia`/`getBoundingClientRect`/pointer capture/
`crypto.randomUUID`/`confirm`/`prompt`). Every thrown error and `jsdomError` was captured
per step. Driver: `/tmp/sa_walkthrough.js` (+ probes `/tmp/sa_probe.js`, `/tmp/sa_probe2.js`).
**Cannot** see rendered pixels — findings are functional/structural/label only. Visual items
are called out in section (f).

Result: **30 PASS / 3 ERROR** across 33 driven steps. Of the 3 ERRORs, **1 is a real
browser bug** (wizard "Look & feel" step), and **2 were harness data-seeding artifacts**
(re-verified as PASS with correct default `wizardData`).

---

## (a) Walkthrough results

| Flow / step | Result | Notes |
|---|---|---|
| `startWizard()` | PASS | wizardData initialized |
| Wizard step [0] `identity` | PASS | "What's your church called?" |
| Wizard step [1] `vocalists` | PASS | "How many vocalists?" |
| Wizard step [2] `instruments` | PASS | "What instruments are on stage?" |
| Wizard step [3] `mics` | PASS* | ERROR in first run was my harness seeding `wizardData.mics` as id-strings; with the real default (`mics: []`) it renders fine. Not a product bug. |
| Wizard step [4] `iems` | PASS | "Assign IEM pack names" |
| Wizard step [5] `stage` | PASS | "Stage shape" |
| Wizard step [6] `stage-layout` | PASS | "Stage layout" (drag positions) |
| Wizard step [7] `look` | **ERROR** | **REAL BUG.** `Cannot read properties of undefined (reading 'then')` — see B1. |
| Wizard step [8] `display-layout` | PASS | "Display layout" (section toggles + card size) |
| Wizard step [9] `setup-intro` | PASS | "Setup checklist" |
| `applyWizardChoices()` | PASS* | ERROR in first run was the same bad-mics seed; with correct defaults it seeds 5 vocalists + 5 instruments cleanly. Not a product bug. |
| `pcoLoadDemo()` | PASS | 4 vocalists, 3 band assigned, 13 service-order rows, hosts populated |
| `buildPostPullSteps()` | PASS | Produced 7 steps |
| `openPostPullPopup()` + walk all steps | PASS | Rendered + saved each step, no throw |
| `autoAssign()` | PASS | 4 vocalists received mics |
| `openSetupChecklistView()` | PASS | |
| `renderSetupItemsView()` | PASS | |
| `renderSetupChecklist()` | PASS | |
| `isSetupComplete()` (go-live gate) | PASS | returned false on fresh config (expected) |
| `enterDisplayMode()` + `renderDisplayView()` | PASS | rendered, no throw |
| Exit display → setup | PASS | |
| `openSettings('inventory')` (Mics) | PASS | |
| `openSettings('layout')` (Display) | PASS | |
| `openSettings('brand')` | PASS | |
| `openSettings('setups')` (Setup Items) | PASS | |
| `openSettings('venues')` | PASS | renders (tab hidden in UI, but function works) |
| `openSettings('data')` | PASS | |
| `openSettings('pco')` | PASS | |
| `closeSettings()` | PASS | |
| `setPreferredName('Jake Williams','Jakey')` | PASS | renamed live vocalist + recorded alias `{jake williams: Jakey}` |
| Add shadow + walk its post-pull step | PASS | shadow step rendered + saved |

`PASS*` = errored only under my incorrect harness seeding; re-verified PASS with the
real default state.

---

## (b) Broken / not working

### B1 — REAL BUG (High): wizard "Look & feel" step crashes on the standard first-run path
- **Where:** `index.html:11577` (in `wireWizardStep`, `step === 'look'`):
  ```js
  ensureFontLoaded(wizardData.fontFamily).then(() => previewLookNow());
  ```
- **Cause:** `ensureFontLoaded()` (`index.html:6175`) **never returns a Promise.** It returns
  `undefined` on every path (`if (!fontName) return;`, `if (document.getElementById(id)) return;`,
  and the implicit return after `appendChild`). So `.then` is called on `undefined` → throws
  `Cannot read properties of undefined (reading 'then')`.
- **Why it fires on the happy path:** `wizardData.fontFamily` defaults to `'Inter'` (`startWizard`,
  line 9729), so the `if (wizardData.fontFamily)` branch is always taken. `preloadAllFonts()`
  runs at startup and injects every font `<link>`, so by the time the user reaches this step the
  `Inter` link already exists → `ensureFontLoaded` hits the early `return;` → `.then` throws.
- **Confirmed real, not jsdom:** probe shows `ensureFontLoaded("Inter") instanceof Promise === false`
  and `typeof ensureFontLoaded("Inter") === 'undefined'` on a fresh load. This is browser behavior.
- **Impact:** the throw aborts `wireWizardStep` at that line, so `previewLookNow()` never runs on
  first display of the step (the live look preview is skipped) and any wiring code placed after
  line 11577 in that block does not execute. The wizard doesn't hard-crash (the error is thrown
  from an event/render call, not a syntax error) but the "Look & feel" step is degraded.
  **This is the single most important finding — it lives on the default new-user path.**
- **Fix (one line):** either make `ensureFontLoaded` return a Promise, or drop the `.then`:
  `ensureFontLoaded(wizardData.fontFamily); previewLookNow();` — every other caller of
  `ensureFontLoaded` (5888, 5907, 5923, 6191, 11562, 11931, 12268) already ignores the return
  value, so making it `return Promise.resolve()` is safe and the minimal fix.

### B2 — Dead code (Low): unreachable wizard step `display-design`
- **Where:** `case 'display-design':` render at `index.html:11027` and wire at `index.html:11606`.
- **`display-design` is NOT in `WIZARD_STEPS`** (`index.html:9677`), so it can never render. It's
  leftover from a superseded design ("Design your display view — drag the borders to resize
  sections"). There's already a precedent comment at line 10655 ("'shadows' case removed — dead
  code") and line 11137, so this is a recurring pattern of orphaned step cases.
- **Impact:** none at runtime; ~80 lines of confusing dead code that a maintainer will trip over
  (two display-ish steps in the switch, only one reachable). Recommend deleting.

### B3 — Not a bug, documented: empty band slots persist after a short roster pull
- After `pcoLoadDemo()` the band array is `Drums→Sam, Bass→"", Electric 2→"", Acoustic→"",
  Electric 1→Daniel, Keys→Carlos`. The default 6-slot template keeps 3 empty slots because the
  demo roster only has 3 instrumentalists. Functionally correct; flagged as UX below (C4).

No other thrown errors or `jsdomError`s were observed anywhere in the driven flows (PCO demo
pull, post-pull popup for vocalists/band/shadow, auto-assign, all setup/checklist views, display
view, all 7 settings tabs, preferred-name rename).

---

## (c) Confusing (first-timer friction)

- **C1 — The wizard is long (10 steps) and front-loads config a first-timer can't answer yet.**
  Order: identity → vocalists → instruments → mics → **iems** → stage → stage-layout → look →
  display-layout → setup-intro. A brand-new user is asked to name IEM packs and drag stage
  positions *before* they've pulled a real roster. Much of this is guessing.
- **C2 — The `iems` step ("Assign IEM pack names") is always shown, with no "Do you use IEMs?"
  opt-out.** A church on wedges/no monitoring still has to page past a screen renaming packs they
  don't have. Every other "do you have X" question (mics, shadows) is opt-in; IEMs is not.
- **C3 — Two adjacent stage steps: `stage` ("Stage shape") then `stage-layout` ("Stage layout").**
  The distinction (outline shape vs. dragging people onto it) is not obvious from the titles;
  a first-timer won't know why there are two stage screens back to back.
- **C4 — Empty band slots (B3) are silent.** After a small pull, the display/stage shows named
  slots plus several blank ones with no hint they're optional/removable. A first-timer may think
  the pull failed to fill them.
- **C5 — "Setup Items" vs the "✓ Items / setup checklist" views.** There are multiple setup
  surfaces: the Settings → **Setup Items** tab (catalog/presets editor), `openSetupChecklistView`
  / `renderSetupItemsView` (per-person items), and `renderSetupChecklist` (the go-live checklist).
  The naming overlap ("Setup Items" the tab vs. the per-person "setup items") makes it unclear
  which screen edits the master catalog vs. this week's checklist. *(Purely a labeling read;
  behavior is correct.)*
- **C6 — Demo vs. real PCO.** `pcoLoadDemo()` toasts "Demo data loaded — this is what a real PCO
  pull gives you" and sets status "Demo data loaded", which is good, but the demo populates real
  `state` (vocalists/band/service order). A first-timer exploring the demo then connecting real
  PCO needs to know the demo data will be replaced/merged — not surfaced. *(Needs a product
  decision, not necessarily a bug.)*

## (d) Redundant

- **D1 — Display configuration exists in three places for a first-timer:** wizard `display-layout`
  step, the (dead) `display-design` step, and Settings → **Display** (`layout` tab). Every wizard
  display control is duplicated in Settings ("You can adjust this any time in Advanced Settings →
  Display" appears twice in the wizard). The wizard step is fine as a fast default, but the dead
  `display-design` step (B2) is pure redundancy.
- **D2 — Font loading has one correct helper (`ensureFontLoaded`) called from 8 sites**, 7 of
  which correctly treat it as void and 1 (line 11577) wrongly treats it as a Promise (B1). Not
  redundant code, but an inconsistent contract that caused the only real bug.
- **D3 — `look` (accent + font) and `display-layout` (sections + card size) are two separate
  "make it look right" steps.** They could reasonably be one "Appearance" step; splitting them
  lengthens the wizard without a clear conceptual boundary for a new user.

## (e) Recommendations (prioritized)

**Quick wins (small, high value):**
1. **Fix B1** — change `ensureFontLoaded` to `return Promise.resolve()` (or remove the `.then` at
   line 11577). One line. Restores the "Look & feel" live preview and removes the only real
   runtime error on the first-run path. *Ship first.*
2. **Delete the dead `display-design` step** (render 11027–~11064 + wire ~11606) and, if desired,
   the older removed-step comment cruft. Removes ~80 lines of misleading code (B2).
3. **Gate the `iems` step** behind a one-tap "Do you use in-ear monitors?" (default yes), matching
   the opt-in pattern of mics/shadows. Skips a whole screen for wedge churches (C2).
4. **Disambiguate the two stage steps** — retitle to e.g. "Stage outline / shape" and "Place people
   on stage" so the back-to-back stage screens read as a sequence (C3).

**Bigger (worth a design pass):**
5. **Re-order / shorten the wizard** so roster-dependent steps (iems pack names, stage-layout
   drag) come *after* the first PCO pull, or are clearly skippable with good auto-defaults. A
   first-timer should be able to finish the wizard in ~4 decisions (church name, vocalist count,
   instruments, mics) and tune stage/display after real data lands (C1).
6. **Surface empty band slots** — after a pull, either hide unfilled default slots or badge them
   "unassigned — remove?" so a short roster doesn't look broken (C4/B3).
7. **Clarify the setup surfaces' names** — "Setup Items" (catalog) vs. per-person "This week's
   setup" vs. the go-live checklist, so the three don't read as the same thing (C5).

## (f) Needs visual / booth QA (could not verify headlessly)

- The "Look & feel" live preview (`previewLookNow`) — even after fixing B1, confirm the accent
  color + font actually apply visually in the wizard preview.
- Display view scaling / per-section hover font-scalers (`dvscalers`) and the fullscreen button —
  layout, overflow, and text legibility on the booth TV can only be checked on a real screen.
- Stage SVG rendering: outline shape, curvature slider, and drag-to-position accuracy (jsdom stubs
  `getBoundingClientRect` to a fixed 800×380, so drag math and clamping need real-viewport QA).
- Print / export-to-PDF of any checklist or run sheet (not exercised).
- Vocalist card sizes (small/medium/large) and auto-wrap vs. single-row on a wide display.
- Real PCO OAuth round-trip and the wizard resume-after-redirect path (only the demo pull was
  driven; the real OAuth flow and `WIZARD_RESUME_KEY` restore need a live browser + PCO creds).
- Drag-to-reorder of mics (⋮⋮ handles) and stage feature resize handles — pointer/drag UX.

---

*Read-only audit: `index.html` was not modified. Only this log and /tmp scratch scripts were written.*
