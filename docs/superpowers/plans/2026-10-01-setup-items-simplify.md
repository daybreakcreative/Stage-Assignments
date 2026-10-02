# Setup Items — simplify (Dillon's three answers, 2026-10-01)

Source: bug_34d61961 ("set up items is a big mess"), diagnosed 2026-09-30 from his export.
Already live (6bb060f): whole-person remove/restore, doubled auto-mic repair, |none guard.

## 1. Legacy |band|none sweep  — ✅ shipped db690fb (deleted at the source: migrateLegacySetupBuckets)
- [x] repairSetupBuckets(): drop any bucket keyed `<name>|band|none`. Return count. Test.
- Why delete: inert, hold MD lines under a nonsense key, produced a false lead on 09-30.

## 2. Implied-only lines  — ✅ shipped db690fb
- [x] resolveSetupItems(): for a RADIO group, do NOT push o.text; push o.addItems only.
      CHECK groups keep pushing o.text (+ addItems) — the item IS the task.
- [x] Edge, flagged to Dillon: `k_remove` ("Remove keyboard") is a check item → still prints.
- [x] Tests: radio choice emits only its addItems; check item still emits its text; a radio
      choice with no addItems emits nothing; existing per-person `replaces` removals still apply.
- [x] Existing removal records for radio texts become dead weight (harmless) — leave them.

## 3. One checklist per person, every MD-assigned position  — "yes & do the same for every position"
Collision: MD groups = rig, extras. Every instrument has `extras`; bass/ag/eg/strings have `rig`.
→ MD selections live NAMESPACED in the instrument bucket: `selections.md = {rig:[…], extras:[…]}`.
- [ ] enumerateSetupRoles(): when the MD has an instrument, push ONE row (the instrument's),
      flagged `mdFolded:true`; do NOT push a separate md|md row. mdSoloName keeps its md|md row.
- [ ] resolveSetupItems(typeKey, selections, customItems): if `selections.md`, also resolve the
      MD catalog against `selections.md` and append (same customItems/replaces apply to both).
- [ ] rebuildPersonItems(): unchanged if resolve handles it.
- [ ] renderPersonSetupEditor(): when bucket is MD-folded, render the MD catalog's groups as an
      "MD" block UNDER the instrument's groups, writing to `selections.md`. One editor, one bucket.
- [ ] Card label stays "Keys · MD" (already does via roles[]).
- [ ] Migration (in repairSetupBuckets): for each `<name>|md|md` where `<name>|band|<type>` exists
      for this week's MD instrument → move md selections to `band.selections.md`, union customItems,
      drop the md|md bucket. Guard: only when the person IS the MD on an instrument.
- [ ] Reroute callers that build stableSetupKey(name,'md','md') when the MD has an instrument:
      line ~8199 (setup manager), ~13536 (wizard). Route to the instrument bucket.
- [ ] Boom mic: ensureBoom already targets the MD's instrument bucket. Check it doesn't double.
- [ ] Tests: one row per MD-with-instrument; items include both catalogs; one remove kills a shared
      line everywhere; editor renders one section set; migration folds and drops; solo MD untouched.
- [ ] Verify on Dillon's export in the scratchpad sandbox: Keys·MD card lines, one editor, remove
      → gone, reload → stays gone.

## Ship order
1+2 → one commit. 3 → its own commit (revertable alone). Then `watch.js done bug_34d61961`.
