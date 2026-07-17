# Setup Items page redesign (prep/planning) — design

**Date:** 2026-07-17
**Status:** Approved (direction), pending spec review → plan
**Files:** `index.html` (single-file app) + `tests/` + `docs/WATCHLIST.md`

## Problem

The ✓ Items page (`renderSetupItemsView` → `renderAreaCard` → `renderPersonCard`) renders
each area as a full-width, single-file stack of person rows, each with a tall checkbox list.
Dillon's feedback: **hard to scan** (weak hierarchy, low contrast), **feels empty/aimless**
(acres of dark space, full-width rows), and **grouping felt wrong** (really: it looked wrong,
not organized wrong). The page is used primarily for **prep/planning** — reviewing what
everyone needs before a service — so clarity and a "full, purposeful" feel matter most, even
though the page still supports check-off.

Direction chosen (via mockups): **Option A — grouped rich cards**, area grouping only (Band,
Vocals, MD, Hosts, Shadows…), no secondary "by gear" view.

## Goals

1. Replace full-width rows with a **responsive card grid** (2–3 cols desktop, 1 narrow),
   grouped under existing area sections with a per-area count.
2. Each person = a **compact card**: name (+WL), role badge, progress ring, needs as **chips**.
3. **Chips are the setup items** — click a chip to toggle done (reuses `doneThisService`).
4. **Mic**: surface the assigned mic as a **checkable, highlighted chip** (counts toward X/Y).
5. **IEM pack**: an **informational note** on the card — NOT checkable, NOT counted.
6. **Vocalists** labeled **Vocal 1 / 2 / 3** by their assignment slot (matches Display view).
7. A person with no setup items shows a **"No setup needed"** state, never a blank card.
8. Keep check-off intact: top progress bar + X/Y, bottom **Reset all / Mark all done**, and
   the existing inline **⚙ Edit setup** + "Add a setup item" affordances.

Non-goal: the Setup Manager (`renderSetupManager`) and the underlying bucket/preset data model
are unchanged. This is a re-skin + interaction change of the check-off VIEW only.

## Data model (unchanged, with two additions)

- **Setup items** live in `state.setupItems[key].items` (`{id, text, doneThisService,
  scopeOneTime, autoAdded, …}`). These become the checkable chips. Counts come from
  `setupCompletionStats(key)` (unchanged).
- **IEM pack** is assignment data, read-only for display:
  - Vocalist: `state.config.voxIemPacks[slot]` (fallback `Vocal N`).
  - Band: `iemPackFor(inst)`.
- **Vocal slot number**: derived from `state.assignments` order (the index where the
  vocalist's id sits, `+1`), mirroring how `renderDisplayView` computes `VOCAL ${i+1}`.
  Build a `vocId → slot` map once per render; fall back to the vocals-area sequence if a
  vocalist isn't in an assignment slot.
- **Mic (addition):** the assigned **vocalist** mic (`v.micAssigned`) is materialized as a
  checkable item so it counts and persists its done-state, reusing the existing auto-add
  pattern already in `renderPersonCard` (the Boom-mic block). The item carries
  `autoAdded:true` and a new `kind:'mic'` flag; its `text` is kept in sync with
  `v.micAssigned` on each render (create if missing, update text if the assignment changed,
  remove if the mic assignment is cleared). It is not user-removable (no ✕). Band mics are
  already ordinary setup items (e.g. "Kick · Beta 91") and stay as-is.

## Components / changes (all in `index.html`)

### 1. `renderSetupItemsView` / `renderAreaCard`
- Area section header: icon + name + `done/total` count (from area stats). Add a thin rule.
- Replace the per-area people stack with `<div class="si-grid">` (CSS grid, responsive).

### 2. `renderPersonCard` → chip-based card
- Header: WL star (if `p.isWL`) + name; role badge:
  - vocalist → `Vocal {slot}`; band → `p.instLabel` (+ ` · MD` when
    `state.musicDirectorId === p.inst.id`); shadow → `Shadow`.
  - progress ring (SVG) + `done/total` on the right (hidden when total 0).
- Body: `items.map(renderItemChip)` — each item a chip (`doneThisService` → checked/dimmed
  with ✓). The materialized mic chip gets a `mic` style class (accent). `autoAdded` items keep
  a subtle dot; `scopeOneTime`/`last-done` flags carry over as small markers/titles.
- **IEM note** (if a pack resolves): a muted `IEM · <pack>` line under the chips. Read-only.
- **Empty state:** if `items.length === 0`, render a "No setup needed" line instead of chips
  (card gets a `.none` dimmed style). IEM note still shows if present.
- Footer affordances: keep **⚙ Edit setup** (opens the existing inline grouped editor) and the
  **Add a setup item** row. Edit renders as a bottom-right hover link, clear of the ring (per
  feedback). The Add-item row reveals when the card's inline editor is open (via ⚙ Edit setup),
  keeping the resting card clean while preserving the ability to add items.

### 3. Toggling
- Reuse the existing `data-action="toggle-item"` wiring in `wireSetupItemsContent` — the chip
  carries the same `data-item-id`/`data-person-key`, so a click flips `doneThisService`, saves,
  and re-renders/refreshes counts (top bar, area count, ring) exactly as today. No new
  persistence path.

### 4. CSS
- New classes: `.si-grid`, `.si-card`, `.si-chip` (+ `.mic`, `.done`, `.auto`), `.si-ring`,
  `.si-iem-note`, `.si-none`. Dark theme, warm accent, matches the app. Card min-width ~200px;
  grid `repeat(auto-fill, minmax(210px, 1fr))` so it reflows 1→3 columns.

## Testing (`tests/setupitemsview.js`, jsdom harness like `tests/setupviews.js`)

1. Area renders a **grid** with one `.si-card` per person; area header shows the area count.
2. A card renders **one chip per setup item**; clicking a chip toggles `doneThisService` and
   updates the card's `done/total` + the global count.
3. **Vocalist** card shows role `Vocal N` matching its `state.assignments` slot; **band MD**
   shows `· MD`.
4. **IEM** renders as a note (present in DOM, not a checkbox/chip, not in the count).
5. **Mic**: a vocalist with `micAssigned` gets a checkable **mic chip** (counted); clearing
   `micAssigned` removes it; changing it updates the chip text.
6. **Empty person** (no items) shows the "No setup needed" state, no chips, no ✕.
7. **Regression:** existing setup check-off tests still pass (toggle, reset all, mark all done,
   auto-added boom mic, per-service scope). Run full `npm test` green (allow `curve.js`).

## Open decision for spec review

- The **mic-as-materialized-item** approach (§Data model) is the one nuanced call: it writes an
  auto-managed item into the vocalist's bucket so the mic can be checked/counted with zero new
  persistence plumbing. Alternative would be a separate per-service "mic done" store (more
  code). Recommending the materialized-item approach; flag if you'd rather the mic be a note
  after all (simplest) or stored separately.

## Out of scope / queued

- **Bug submission → KHARIS** (the second request) is a separate spec/plan cycle; not covered
  here.
- Setup Manager redesign, gear pull-sheet view, stage-position grouping — explicitly dropped.
