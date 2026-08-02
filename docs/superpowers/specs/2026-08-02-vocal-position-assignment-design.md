# Vocal Position Assignment — Design Spec

**Date:** 2026-08-02
**Source:** Bug report (KHARIS, 2026-08-02) — "Unable to move vocalists over 1 number. After Evan was
removed it kept everyone on their same mic/pac number. Would like the ability to assign who's in
which position." Screenshot showed 4 vocalists on VOCAL 2–5 / PAC 2–5, with VOCAL 1 empty.
**Status:** Design approved (option: "just fix removal + let me drag freely", always gap-free).

---

## 1. Problem

A vocalist's **slot index** in `state.assignments` drives two visible things:

- the card label `VOCAL ${i+1}` (`renderVocalists`), and
- the IEM pack `state.config.voxIemPacks[i]` (default `Vocal N` → displayed `PAC N`).

Two behaviors combine into the reported bug:

1. **`computePositions` centers people.** It fans vocalists out from the middle
   (`centerFanOutIndices`) so the worship leader lands center-stage. With 4 vocalists in an
   8-slot array, they occupy middle slots — leaving slot 0 (VOCAL 1 / PAC 1) empty. Removing a
   vocalist (`removeVocalist` → `computePositions`) re-ran the same centering, so everyone stayed
   shifted up a number.
2. **Empty slots are not drop targets.** `renderVocalists` does `if (!vid) continue`, so an empty
   slot renders nothing, and the drag handler is **swap-only** between two occupied cards
   (`drop` looks up `fromIdx`/`toIdx` via `state.assignments.findIndex`). There is therefore no way
   to drag someone into the empty VOCAL 1 — the "can't move over 1 number" symptom.

## 2. Key finding — compaction is safe for stage layout

Physical on-stage placement does **not** read the raw slot index. `applyLinkedVocalistPlacement`
(and the render path) build `filledIdx`/`ids` from the filled slots and place people via
`getVoxPositions(count)` — i.e. placement is a function of **how many** vocalists are filled and
**their left-to-right order**, not which absolute indices they sit in.

**Consequence:** packing vocalists down into slots `0..N-1` preserves where everyone physically
stands. It only tightens the *numbering* (VOCAL N / PAC N). This is what makes the minimal fix
viable.

## 3. Design

### 3.1 `compactAssignments()` — always gap-free

A small pure-ish helper that rewrites `state.assignments` so the filled entries occupy
`0..N-1` in their existing order, with the remainder `null`:

```
in:  [null, A, B, null, C, null, null, null]
out: [A, B, C, null, null, null, null, null]
```

Properties:
- **Order-preserving** — relative left-to-right order is unchanged (so stage spread and who-is-next-to-whom are unchanged).
- **Idempotent** — running it on already-compact input is a no-op.
- **Length-preserving** — the array stays `MAX_VOCALISTS` long, padded with `null`.

Called after every mutation that can leave a hole:
- `removeVocalist` (the reported case),
- `addVocalist`,
- the PCO pull / merge-refresh path that rebuilds assignments,
- after a drag-drop move.

Result: vocalists always read VOCAL 1..N / PAC 1..N, with no gap. This directly fixes the
screenshot (PAC 2–5 → PAC 1–4).

The WL still gets centered **on stage** by the existing placement logic; centering no longer
strands the numbering.

### 3.2 Drag into any slot (move-or-swap)

Two changes in `renderVocalists` / its drop handler:

1. **Render empty placeholder slots.** Render slots up to `filledCount + 1` (capped at
   `MAX_VOCALISTS`) so there is always at most one trailing "drop here" target. Placeholders are
   visually light (dashed, muted) and carry `data-slot="${i}"`. They are drop targets only — no
   mic select, no WL star, no remove button.
2. **Drop = move OR swap.** Today's handler swaps two occupied slots. New behavior:
   - drop on an **occupied** card → swap the two ids (unchanged behavior),
   - drop on an **empty** slot → move the dragged id into that slot, clearing its old slot,
   - then `compactAssignments()` + `saveState()` + `renderAll()`.

This is what lets a vocalist move "over 1 number" (e.g. Kaeli from VOCAL 2 into VOCAL 1).

## 4. Non-goals

- No new persisted "manual mode" flag, and no change to the auto-arrange philosophy
  (`computePositions` keeps centering the WL on stage).
- No change to mic assignment logic (`assignMicsToVocalists`), mic capacity, or pack **names**
  (`state.config.voxIemPacks` is untouched — only which index a person occupies changes).
- No change to shadows, band, or hosts.
- No drag-reordering of the pack names themselves.

## 5. Migration / back-compat

None required — `state.assignments` keeps its existing shape (length `MAX_VOCALISTS`, ids or
`null`). Existing saves are compacted the first time a mutation runs; a save that is already
gap-free is unaffected (idempotent). No new state fields.

## 6. Test plan (`tests/vocalpos.js`, jsdom)

- `compactAssignments` squeezes `[null,A,B,null,C]` → `[A,B,C,null,null]`, preserves order,
  is idempotent, keeps array length, and handles all-empty / all-full inputs.
- `removeVocalist` on a middle vocalist leaves the rest gap-free starting at slot 0 (the reported
  bug: 5 vocalists → remove the first → remaining 4 sit at VOCAL 1–4, packs PAC 1–4).
- `addVocalist` lands the new person in the first free slot with no gap.
- Drag/drop: dropping on an **occupied** card swaps; dropping on an **empty** placeholder moves,
  then compacts.
- Placeholder rendering: exactly one trailing empty drop slot when under `MAX_VOCALISTS`; none when
  full.
- Stage placement is unchanged by compaction: capture vocalist x-positions before/after a compaction
  that changes indices but not order, and assert they match.
- Regression: existing suites stay green — especially `vocalists`-touching tests, `micorder`,
  `mic`, `micengine`, `display`, `summary`, `pcorefresh`.
