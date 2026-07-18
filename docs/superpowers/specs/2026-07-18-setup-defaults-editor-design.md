# Default setup items per instrument (Advanced Settings) — design

**Date:** 2026-07-18
**Status:** Approved (design), pending build
**File:** `index.html` (Settings → Setup Items tab)

## Problem

The church's default setup items per instrument live in `state.config.setupDefaults[key]`
(keys: `drums, bass, ag, eg, keys, md, strings, vocals`). They can currently be set ONLY by
re-running the first-run wizard's last "Setup" step — there's no way to adjust them afterward.
This bit us on 2026-07-17: an MD's checklist is empty because there are no default MD items and
the only place to set them is buried in the wizard.

## Goal

Add a **"Default setup items per instrument"** section to Advanced Settings so the church
defaults can be viewed and edited any time, reusing the wizard's exact grouped-selector UI.

Scope (per brainstorm): **edit defaults only** — changes apply to people seeded *after* the
change. Non-destructive to anyone's existing setup. (Existing people are edited per-person in the
Setup Items manager right below, which already works.)

## Current model (reference)

- `state.config.setupDefaults[key] = { selections, customOptions }`.
- `churchSetupDefaults(key)` / `defaultSelectionsFor(key)` read it; `seedPersonSetup` applies it
  when a person's bucket is first created (already-seeded buckets are NOT re-seeded).
- Wizard `setup-intro` step renders one `.wiz-setup-inst` card per instrument →
  `renderSetupGroups(groupsEl, key, def.selections, onChange)` + a custom-item add/remove row,
  writing `def.selections` / `def.customOptions` and `saveState()` on change.
- Settings tabs: `.tab[data-tab=…]` + `.tab-panel#tab-…`; `openSettings(tab)` calls the various
  `render*Editor()` fns. The **Setup Items** tab is `#tab-setups`, currently just
  `<div id="setupsEdit"></div>` (the per-person manager, `renderSetupManager`).

## Design

### Home & layout
- In `#tab-setups`, add a new container **above** the per-person manager:
  `<div id="setupDefaultsEditor"></div>` then the existing `#setupsEdit`.
- The section is a **collapsible disclosure** (collapsed by default) titled
  *"Default setup items per instrument"* with a one-line note: *"Applied to new people as they're
  added. Edit someone already on a plan below."* Collapsed keeps the tab tidy (8 cards).

### Component: `renderSetupDefaultsEditor(container)`
- Iterate **all** catalog keys `['drums','bass','ag','eg','keys','md','strings','vocals']` (the
  full master list — unlike the wizard, which filters to added instruments — so MD/strings/etc.
  can be pre-set even when not currently on a plan).
- For each key, render a card (reuse `.wiz-setup-inst` styles or `.si-*`-consistent styling):
  - Title = `setupCatalogFor(key).label` (e.g. "Music Director / Tracks").
  - Grouped selectors: `renderSetupGroups(groupsEl, key, def.selections, newSel => { def.selections = newSel; saveState(); })` where `def = state.config.setupDefaults[key] ||= { selections:{}, customOptions:[] }`.
  - Custom items: list `def.customOptions` as removable chips + an "Add a custom setup item…"
    input/button that pushes `{ text }` to `def.customOptions` and `saveState()`s — mirroring the
    wizard's custom-item handling.
- Nothing is pre-created destructively: `setupDefaults[key]` is created lazily on first edit.
- Persistence: `saveState()` on every change (same as the wizard). `setupDefaults` already
  persists (it's in `state.config`).

### Wiring
- Call `renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'))` from
  `openSettings` alongside the other `render*` calls (and re-render when the Setup Items tab opens).
- Guard for a missing container (harness/jsdom safety), like the other editors.

### Non-goals
- No "apply to current roster" / "fill empties" action (explicitly out per brainstorm).
- No change to `seedPersonSetup`, `churchSetupDefaults`, or the per-person manager.
- No new persistence keys.

## Testing (`tests/setupdefaults.js`, jsdom)

1. `renderSetupDefaultsEditor` renders one card per catalog key, with correct labels incl.
   **MD** ("Music Director / Tracks").
2. Ticking a group option writes `state.config.setupDefaults[key].selections` (e.g. selecting an
   `md` rig option) and calls `saveState` (stubbed → assert the state object).
3. Adding a custom item pushes to `setupDefaults[key].customOptions`; removing it drops it.
4. **Integration (closes the MD loop):** after setting an `md` default here, a NEWLY seeded MD
   bucket (`seedPersonSetup(stableSetupKey(name,'md','md'),'md')`) contains the defaulted item(s).
5. **Non-destructive:** editing a default does not change an already-seeded person's bucket.
6. Full `npm test` green (allow the known `curve.js` false-fail); existing `setupwizard`,
   `setupmgr`, `setupviews` still pass.

## Notes
- Reuses `renderSetupGroups` verbatim, so the settings editor and the wizard stay in lockstep
  (one grouped-selector implementation).
- Because it only edits defaults, the immediate MD fix for *existing* MDs remains the per-person
  manager; this section makes every *future* MD inherit the list automatically.
