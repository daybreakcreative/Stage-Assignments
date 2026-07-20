# Display view — Batch B — design

**Date:** 2026-07-19
**Status:** Approved (design), pending build
**File:** `index.html` (`renderDisplayView`, stage-mark render, `applyPCOPlanData`/`distributeBucket`,
a new `placeLinkedInstrumentalists()`, plus `.dv-list-*` CSS)

## Problem / goal

Four display-view relabels/fixes plus a placement heuristic, from Dillon's punch list:

1. A band row for an MD reads **"BASS | Abraham Mata · MD | Bass"** — the "· MD" hangs off the
   *name*. It should read **"BASS · MD | Abraham Mata | Bass"** (tag on the position label).
2. Someone scheduled on both an instrument and vocals is hidden from the Band section and shown
   only as a vocalist. They should **also** appear in the Band section as
   **"Instrument · Vocal N | Name | [their vocal pack]"**.
3. The Band IEM-pack column's gradient/glow is **clipped** at the block edge.
4. Auto-linking a same-person instrument+vocal only happens for **acoustic guitar** today; it
   should happen for **every** instrument on a PCO pull.
5. A musician who also sings should be **auto-placed at the front-line vocal slot nearest where
   their instrument sits** (no conflict with leader centering). **Drums are the exception** — a
   singing drummer stays at the kit.

## Orientation ground-truth

- SVG `viewBox 0 0 800 380`, audience at TOP. **High X = screen-right = STAGE RIGHT (SR)**; low X =
  STAGE LEFT (SL).
- Vocal slot → X: `getVoxPositions(count)[i].x`. Default `vocalDirection='rtl'` → **slot 0
  ("Vocal 1") = stage right**, last slot = stage left, middle = center. Direction-sensitive, so
  nearness is computed from `getVoxPositions` output, never from a hardcoded index.
- Band X: `getBandStagePositions()[instId].x`. **Keys is already forced stage-right**; other
  instruments are order-spread; hand-drags override via `state.config.customStagePositions`.
- Leader centering: `computePositions` centers song-leaders/WL (via `centerFanOutIndices`) and fans
  non-leaders outward. Slot index → X is section-2 mapping; `computePositions` only decides which
  vocalist lands in which slot.
- Link model: `inst.vocalistPlayer` (vocalist id) marks an instrument as "covered by" a vocalist.

## Design

### A. MD relabel (`renderDisplayView` band loop, ~`index.html:9413-9422`; CSS `~1311`)

- Remove the CSS rule `.dv-list-item .name.is-md::after{content:' · MD';…}` and drop the `is-md`
  class from the `.name` span.
- Build the position cell with an optional role tag:
  `<span class="pos">${short}${roleTag}</span>` where `roleTag` wraps in
  `<span class="pos-role"> · MD</span>` (and/or ` · Vocal N`, see B).
- New CSS `.dv-list-item .pos .pos-role{color:var(--accent);font-weight:600;letter-spacing:.1em}`
  (inherits the mono/uppercase of `.pos`), reproducing the accent the `::after` had.
- Uppercase is retained (the `.pos` cell is `text-transform:uppercase`), so it renders
  "BASS · MD" / "BASS · VOCAL 3" — consistent with every other position label.

### B. Linked instrumentalist-vocalist in the Band list (same loop)

- **Stop skipping** linked instruments: the `if (inst.vocalistPlayer) return;` guard at
  `~9414` is removed for the band-list render (the drum-kit stage-mark handling in E is separate).
- For a linked instrument, resolve the person from the vocalist:
  `v = state.vocalists.find(x => x.id === inst.vocalistPlayer)`; `name = v && v.name`. If no named
  vocalist resolves, skip the row (keeps "one entry" honest).
- `slot = state.assignments.indexOf(inst.vocalistPlayer)`; `N = slot + 1`.
- Row composition:
  - **pos:** `shortInstLabel(inst.label)` + role tag ` · Vocal N` (and ` · MD` first if this
    instrument is also `musicDirectorId`, giving `· MD · Vocal N`).
  - **name:** `formatDisplayName(name)`.
  - **detail (pack):** the **vocal** pack — `(state.config.voxIemPacks[slot]) || 'Vocal '+N` — NOT
    `iemPackFor(inst)`.
- Unlinked rows are unchanged except for the MD-tag move in A.
- The vocalist card render (`~9364-9391`) is **untouched** — the person still appears there with
  their instrument tag ("both sections", per Dillon).

### C. IEM-pack gradient clip (CSS `.dv-list` `~1307`, `.dv-side-block` `~1303`)

- `.dv-side-block{…overflow:hidden}` + `.dv-list{overflow-y:auto}` clip the pack's aurora
  `text-shadow` glow at the block's right/top/bottom edge.
- Fix: add interior breathing room on the scroll container so the glowing text isn't flush to the
  clip boundary — `.dv-list{padding:4px 14px}` (and drop the matching amount from row padding if it
  over-indents). The block keeps `overflow:hidden` (needed for the rounded corners); the padding
  moves the content in by more than the ~14px glow radius.
- **Booth-verify only:** the glow exists solely in aurora **dark** mode
  (`[data-look="aurora"][data-theme="dark"] .dv-list-item .detail`); the preview pane can't confirm
  it. Light mode already suppresses the glow (`~1352`), so this is visual-only there.

### D. Auto-link all instruments on PCO pull (`distributeBucket`, `~index.html:8117-8182`)

- The vocalist-link check is currently gated to `positionShort === 'ag'` in two places:
  the existing-slot loop (`~8141-8144`) and the auto-create loop (`~8169-8172`).
- **Ungate to all positions** and match on **`normFullName`** (not the looser `normName`):
  ```js
  const v = state.vocalists.find(x => normFullName(x.name) === normFullName(name));
  if (v) { inst.vocalistPlayer = v.id; inst.assignedTo = ''; continue; }   // existing-slot loop
  ```
  and the analogous `newInst.vocalistPlayer = v.id` in the auto-create loop.
- `normFullName` honors the CLAUDE.md rule: two different people who share only a first name do
  **not** link; a link requires the same full name on both a vocal spot and an instrument in the
  pulled plan (= the same scheduled person).
- The AG-specific first pass (`acousticPlayers`, `~8023-8032`) and the vocalist-creation AG link
  (`~8072-8075`) become redundant but are left in place (harmless; distribution re-links AG the
  same way). No behavior change for AG beyond the `normName`→`normFullName` tightening.

### E. Front-line auto-placement — new `placeLinkedInstrumentalists()`

Runs **after** the normal vocal ordering (so it can override centering for non-leaders), called at
the end of `applyPCOPlanData` (after band distribution + vocal ordering) and at the end of
`autoAssign` (after `computePositions`). It does **not** call `computePositions`/`autoAssign`
afterward (that would re-center and undo the placement); the caller saves/renders.

**Leader protection:** a vocalist is "protected" (leave centered) if `isWL` with a real name, or
`leadsSongs`, or present in `getLeaderFrequencyOrder()`. Protected vocalists are never moved and
their slots are never taken.

**Melodic instruments (keys/bass/eg/ag — NOT drums):**
1. Collect linked instruments where `detectPresetKey(inst) !== 'drums'` and `inst.vocalistPlayer`
   resolves to a **non-protected** vocalist. Sort them by instrument X **descending** (stage-right
   instruments claim first) for deterministic multi-instrumentalist placement.
2. For each, in order:
   - `instX = getBandStagePositions()[inst.id].x`.
   - Candidate slots = occupied vocal slots whose occupant is **not** protected and **not** already
     claimed this pass (and not a linked drummer, see below). Compute each candidate's X from
     `getVoxPositions(frontCount)`.
   - Pick the candidate slot with X nearest `instX`. Swap the instrumentalist's vocalist into that
     slot (swap with the current occupant — both non-protected, so mic priority is unaffected).
     Mark the slot claimed.
   - If no candidate slot exists (all remaining are protected/claimed), leave the instrumentalist
     where they are (best-effort).
- Worked example (Dillon's): 4 vocalists, 2 are song-leaders → leaders take the 2 central slots
  (`centerFanOutIndices(4) = [2,1,3,0]`), non-leaders take slots 3 and 0. A non-leader keys player
  (keys = stage right, high X) → nearest non-leader slot = slot 0 (Vocal 1, stage right). Result:
  **keys player on Vocal 1, stage right.**

**Drums exception (a singing drummer):**
- Excluded from the melodic placement above (never front-lined).
- **Not** given a front-line stage mark: linked-drummer vocalists are excluded from the front-line
  vocal-position distribution (so the remaining singers spread evenly — no gap). The drummer keeps
  their `state.assignments` slot purely so the Band row can read `DRUMS · Vocal N | Name | vocal
  pack` and their vocalist card still renders.
- The **drum-kit stage mark stays** at its normal back-center spot: the stage band-mark render
  (`~index.html:9328-9333`) skips linked instruments, so add a **drums-only exception** — a linked
  drums instrument still renders its kit mark, labelled with the drummer's name resolved from the
  linked vocalist. (Melodic linked instruments remain skipped from stage marks — the player shows
  at their front-line vocal position.)

**"Front-line distribution excludes linked drummers" — mechanism:** where the stage vocal marks are
built (`getVoxPositions` consumers at `~5638`, `~9050`, `~9338`), the list of vocalists to place on
the front edge is the assigned vocalists **minus** any who are the `vocalistPlayer` of a drums
instrument. `getVoxPositions(count)` is called with that filtered count and mapped positionally to
the filtered list. The Band-list "Vocal N" label (B) still uses the raw `state.assignments` index.

## Testing (`tests/dvbatchb.js`, jsdom; extend/patch existing display test if cleaner)

1. **MD relabel:** an MD band row's `.pos` cell text contains "· MD"; its `.name` cell does **not**;
   no `.name.is-md::after` content. A non-MD row has no "· MD".
2. **Linked instrumentalist band row:** with a bass instrument linked to a vocalist in slot 2, the
   band list contains an `<li>` whose `.pos` reads "BASS · VOCAL 3", `.name` is the vocalist's name,
   and `.detail` is `voxIemPacks[2]` (the vocal pack, not the bass pack). The vocalist card still
   renders (both sections).
3. **Auto-link (all instruments):** `distributeBucket('bass', ['Jane Smith'])` with a vocalist
   "Jane Smith" present links the bass to her (`vocalistPlayer` set, `assignedTo` empty). A vocalist
   "Jane Doe" + a bass "Jane Roe" (shared first name only) does **not** link.
4. **Front-line placement:** seed 4 vocalists (2 leaders via service order / `leadsSongs`), link a
   non-leader vocalist to keys; after `placeLinkedInstrumentalists()`, that vocalist occupies the
   non-leader slot whose `getVoxPositions` X is nearest the keys X (stage-right); a leader stays in
   a central slot.
5. **Drums exception:** a vocalist linked to drums is **not** moved by placement; the stage band
   marks still include the drum-kit mark (labelled with the drummer's name); the front-line
   distribution count excludes that vocalist; the Band list still shows `DRUMS · VOCAL N`.
6. `npm run check` + full `npm test` green (allow `curve.js`); no regression in existing display
   tests.

## Scope / non-goals

- No change to the vocalist **card** markup or to mic assignment priority.
- No per-instrument side table beyond the existing keys→stage-right rule; nearness is derived from
  live `getBandStagePositions`/`getVoxPositions`, respecting hand-drag overrides and
  `vocalDirection`.
- Placement is best-effort: if there's no free non-leader slot, the instrumentalist keeps their
  slot. No new persisted config keys.
- Melodic vs drums is decided by `detectPresetKey(inst) === 'drums'`.
