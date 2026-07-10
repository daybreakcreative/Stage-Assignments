# Debug sweep — finding #1: go-live checklist check-offs orphaned on rebuild

**Status:** investigated + characterized; **NOT implemented** (needs Dillon's sign-off — it
rewrites persisted check-off data and carries a one-time-reset vs. recovery-migration choice).
Written 2026-07-09 during the autonomous overnight sweep. Everything else from the sweep is either
deployed (12 fixes, build ·f) or staged on `feat/debug-sweep-2` (#6, committed).

---

## Symptom
On the **go-live checklist** (the ✓ Items lock screen / `renderSetupChecklist` / the nav badge),
a check-off resets itself to unchecked after the person's setup is rebuilt — e.g. after toggling a
setup selection, adding/removing a custom item, or a PCO re-pull/reslot. The **editor** check-offs
(the `✓ Items` per-person rows, `item.doneThisService`) do NOT reset — so the two views disagree.

## Root cause
`collectChecklistItems()` keys every go-live item by the setup item's id:

```js
// index.html, in collectChecklistItems()  (~line 9883)
p.items.push({ itemText: text, key: en.stableKey + '|' + it.id });
```

`it.id` is minted fresh by `newSetupItem()` on **every** `rebuildPersonItems()` call. Go-live
check-offs live in `state.checklistState[planKey][key]` keyed by that `stableKey|id`. So the moment
a rebuild re-mints the id, the stored key no longer matches the newly-computed key → the check-off
is orphaned and the box shows empty again. (The comment at ~9842 claims the key "is stable across
relabels" — true for a relabel, false for a rebuild, which is the bug.)

Contrast the **editor** store: `rebuildPersonItems` preserves `item.doneThisService` **by text**
(`doneByText[it.text]`), so it survives rebuilds. Only the **go-live** store (keyed by id) breaks.

## Second, related problem (dead rename-safety)
`remapChecklistKeys()` + `checklistPairsForVocalRename/BandRename` build key pairs in the **retired**
`name|itemText|index` format, read from the **dead legacy** `v.setupItems` / `inst.setupItems`
arrays (the code itself calls them dead at ~9841). Those pairs never match the real `stableKey|id`
keys, so rename-safety for go-live check-offs is effectively absent. Because `stableKey` embeds the
person's name (via `stableSetupKey(name, role, typeKey)`), a rename ALSO changes the key and orphans
the check-off — and the (broken) remap doesn't fix it. This is separate from the rebuild bug; the
rebuild bug is the primary one.

## Fix (the code change is one line)
Key by **text** instead of id — mirroring how the editor store already survives by text (text is
already trimmed and deduped-unique per person at lines ~9880–9883):

```js
p.items.push({ itemText: text, key: en.stableKey + '|' + text });
```

Stage-fixture items (`'stage|' + f.id`, ~9917) are fine as-is — `f.id` is a stable fixture id, not
re-minted — leave them.

## The migration decision (this is what needs Dillon)
Existing saved check-offs are stored under `stableKey|<randomId>`. After the key change they won't
match the new `stableKey|<text>` keys. Two ways to handle it:

### Option A — no migration, accept a one-time reset (RECOMMENDED)
Just change the key. On the deploy, existing go-live check-offs appear reset once; from then on they
are stable. Rationale: those check-offs were **already** flaky (any rebuild reset them), so a single
clean reset is not materially worse, and the code stays simple and safe. **Cost:** if Dillon has
checked items off for the current Sunday, they reset when this deploys — so deploy between services,
not mid-setup.

### Option B — best-effort recovery migration
After load, before any rebuild, walk `checklistState[planKey]` and for each `stableKey|id` whose id
still matches a current item in `state.setupItems[stableKey]`, copy the value to `stableKey|text`
and delete the old key. Preserves check-offs made since the last rebuild; already-orphaned ones stay
dropped (unrecoverable — we can't know a vanished id's text). **Hazard:** `collectChecklistItems`
calls `seedPersonSetup`/`reconstructSetupBucket`, which can rebuild and re-mint ids; the migration
must run FIRST, off the persisted `state.setupItems[*].items` ids, using the same enumeration to
compute old+new keys (no string parsing of keys). More code, more care, benefits from real-data
testing on the booth.

**Recommendation:** Option A. It's the safe, self-healing fix; the only downside is a one-time reset
that's no worse than today's flakiness. Do Option B only if losing the current week's check-offs on
deploy is unacceptable.

## Optional follow-up (separate from the bug)
Restore rename-safety by rewriting `remapChecklistKeys` to move `oldStableKey|text →
newStableKey|text` pairs (drop the dead `v.setupItems`-based machinery), OR explicitly delete the
dead remap code if rename-safety for go-live check-offs isn't needed. Not required for the fix.

## Tests to write / update (in lockstep — the key format is load-bearing)
- **New:** check off a go-live item → `rebuildPersonItems(...)` → assert the check-off SURVIVES
  (this is the regression that proves the fix).
- **Update:** `tests/checklist.js`, `tests/checklistmerge.js`, `tests/setupcheckoff.js` encode the
  `stableKey|id` key format and must be updated to the text key together with the code.

## Files
- `index.html` — `collectChecklistItems` (~9835, key at ~9883); `getChecklistState`/
  `renderSetupChecklist`/`updateSetupProgressBadge` read `cs[it.key]`; `remapChecklistKeys` +
  `checklistPairsFor*` (~9948, dead-format); `newSetupItem` (mints the id).
- Tests: `tests/checklist.js`, `tests/checklistmerge.js`, `tests/setupcheckoff.js`.
