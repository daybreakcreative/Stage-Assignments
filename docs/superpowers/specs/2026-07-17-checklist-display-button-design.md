# ✓ Items checklist: Display button + card-header polish — design

**Date:** 2026-07-17
**Status:** Approved (design), pending build
**File:** `index.html` (live checklist view `renderSetupChecklist` + `.si-*` card CSS)

## Problem

On the live ✓ Items checklist (`renderSetupChecklist` / `#setupChecklistView`), two things need polish:

1. **Footer "Mark all done" isn't the useful action.** The real "am I ready?" signal is
   whether every setup item is checked, and the next step is going to the Display view. Dillon
   wants the footer to reflect that: a **Display** button that illuminates when the checklist is
   complete — replacing "Mark all done".
2. **Card header wraps awkwardly.** Name (left) + role badge (right) share one line, so longer
   names (e.g. "Kaeli Hearn VOCAL 2") wrap mid-header and are hard to scan.

## Goals

### A. Card header — stacked identity
- **Name** on top, full width, prominent (display font).
- **Role/position** on its own line below, in a distinct quieter style: small, uppercase,
  letter-spaced mono, muted color (a subtitle, not competing with the name).
- **Progress ring** stays pinned top-right, aligned to the name row.
- Result: a consistent two-line identity block regardless of name length; no mid-name wrapping.

### B. Footer — illuminating Display button
- Replace the **Mark all done** button (`#scvMarkAllBtn`) with a **▶ Display** button
  (`#scvDisplayBtn`). Keep **Reset all** (`#scvResetBtn`).
- The button is muted by default and gains a `.ready` class (accent fill + soft glow) when
  every item is checked: `total > 0 && done === total`. Computed at render, and toggled live in
  the existing chip-click handler as counts change (lights up the instant the last item is
  checked; dims again if unchecked).
- **Click is always active.** It closes the checklist overlay and enters Display mode, reusing
  the existing "block until setup" gate — if `state.config.blockDisplayUntilSetup` is on and
  items remain (and not `sessionSetupBypass`), it enters Display then shows the lock screen,
  exactly like the nav ▶ Display button. Otherwise it enters Display directly.

## Design

**Shared display-entry helper (DRY).** Extract the nav ▶ Display button's click logic
(currently inline at the `displayBtn` listener) into `goToDisplay()`:

```
function goToDisplay() {
  if (!sessionSetupBypass && state.config.blockDisplayUntilSetup && !isSetupComplete()) {
    enterDisplayMode();
    showSetupLockScreen();
  } else {
    enterDisplayMode();
  }
}
```

- The nav `displayBtn` listener calls `goToDisplay()`.
- The footer `#scvDisplayBtn` listener first closes the checklist overlay
  (`#setupChecklistView` display:none + remove `body.setup-items-mode`), then calls
  `goToDisplay()`.

**Header markup** (`renderSetupChecklist`, the per-person `.si-card`):
```
<div class="si-card-head">
  <div class="si-card-id">
    <span class="si-card-name">{name}</span>
    {roleLabel ? <span class="si-card-role">{roleLabel}</span> : ''}
  </div>
  {ring}
</div>
```

**Footer markup** (`.scv-footer`):
```
<button class="scv-btn" id="scvResetBtn">Reset all</button>
<button class="scv-btn scv-display{ ready?}" id="scvDisplayBtn">▶ Display</button>
```

**CSS** (adjust the shared `.si-*` card classes + add footer button states):
- `.si-card-head { display:flex; align-items:flex-start; gap:8px }`
- `.si-card-id { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 }`
- `.si-card-name { display-font, 14.5px, 600, line-height 1.15 }`
- `.si-card-role { mono, 9.5px, uppercase, letter-spacing .1em, color var(--text-faint) }` — the
  quieter subtitle look.
- `.si-ring { margin-left:auto; flex:none }` (unchanged position, now aligns to the name row).
- `.scv-btn.scv-display.ready { background:var(--accent); color:#000; border-color:var(--accent); box-shadow:0 0 10px rgba(212,161,71,.45) }` — the illuminated state. Default `.scv-display` uses the neutral `.scv-btn` look.

**Live toggle update.** In the existing `[data-item-key]` click handler in `renderSetupChecklist`,
after recomputing the global `allDone/allRows`, toggle the footer button's `.ready` class:
`container.querySelector('#scvDisplayBtn')?.classList.toggle('ready', allRows > 0 && allDone === allRows)`.

## Testing (`tests/scvdisplaybtn.js`, jsdom)

1. Footer renders `#scvDisplayBtn` and NO `#scvMarkAllBtn`; `#scvResetBtn` still present.
2. When all items are done at render, `#scvDisplayBtn` has `.ready`; when some remain, it does not.
3. Checking the last remaining item toggles `.ready` on live (and unchecking removes it).
4. Clicking `#scvDisplayBtn` sets `state.viewMode === 'display'` (and hides `#setupChecklistView`).
5. Header renders `.si-card-name` and `.si-card-role` as separate stacked elements inside
   `.si-card-id` (name and role are distinct nodes, not one line).
6. Regression: `scvredesign`, `checklist`, `setupviews`, `setupcheckoff` still pass; full
   `npm test` green (allow the known `curve.js` false-fail).

## Notes / scope

- The global nav ▶ Display button stays; this adds a second entry point on the checklist and
  shares its logic via `goToDisplay()`.
- The `.si-*` CSS is shared with the (being-removed) legacy `renderSetupItemsView`; that view is
  unreachable, so header restyle there is cosmetically irrelevant. Build on a separate branch;
  reconcile with the dead-view-removal branch at merge.
- `blockDisplayUntilSetup` / `sessionSetupBypass` / the lock screen are existing mechanisms —
  unchanged, just reused.
