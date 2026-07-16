# MD setup preferences on the post-pull card — design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**File touched:** `index.html` (single-file app), plus `tests/mdsetup.js` and `docs/WATCHLIST.md`

## Problem

When a service is pulled, the post-pull popup asks each newly-seen person for their
setup preferences. For band members it shows **one** card per instrument
(`pref-band` step) with that instrument's setup bucket. The Music Director role is
tracked separately (`state.musicDirectorId` → an instrument id) and its setup items
are **never surfaced** — even though a full `md` preset ("Music Director / Tracks":
house tracks computer, Dante rig, interface, laptop stand, talkback mic + opto gate,
music stand, confirm channels) already exists in `SETUP_ITEM_PRESETS`.

So when someone is on an instrument **and** is the MD, they are only asked about the
instrument and never about what the MD needs.

## Goal

When a service is pulled and a person is on an instrument **and** is the MD, ask for
both their instrument setup preferences and their MD setup preferences, on the **same
card**. If a person who is already set up on their instrument becomes MD, still ask
them for MD preferences (on a card showing only the MD section).

## Approach

Render the MD needs as their **own section** on the person's post-pull card, backed by
a separate `md` setup bucket (`stableSetupKey(name, 'band', 'md')`) — not merged into
the instrument's list.

Rationale:
- Reuses the existing `md` preset and the existing "MD" grouping on the ✓ Items page
  (`roleLabelFor`/`POS_ORDER` already handle a `md` typeKey).
- Keeps MD items grouped and independently editable; they move cleanly if the MD role
  changes players.
- Merging MD items into the instrument bucket was rejected: it pollutes the instrument
  checklist and loses the MD grouping/reusability.

## Data model

- **Setup buckets** (`state.setupItems`, keyed `normFullName|role|typeKey`):
  - instrument bucket: `name|band|<instTypeKey>` (unchanged).
  - MD bucket: `name|band|md` (new; seeded from the `md` preset).
- **"Asked" markers** (`state.musicianPreferences`, keyed `normFullName|role`):
  - instrument: `name|<role>` (unchanged; role via `roleTagFromInstLabel`).
  - MD: `name|md` (new).

No migration needed — new keys are additive; existing installs simply have no `name|md`
marker yet, so current MDs will be asked once on the next pull.

## Components / changes (all in `index.html`)

### 1. `buildPostPullSteps` — band loop (~line 10820)

For each assigned, non-vocalist-linked instrument:

```
nName        = normFullName(name)
role         = roleTagFromInstLabel(inst.label)
instPrefKey  = `${nName}|${role}`
isMD         = state.musicDirectorId === inst.id
instIsMdType = detectPresetKey(inst) === 'md'   // instrument itself IS the MD/tracks preset
mdPrefKey    = `${nName}|md`
instKnown    = !!state.musicianPreferences[instPrefKey]
mdMissing    = isMD && !state.musicianPreferences[mdPrefKey]
// If the instrument is already the MD/tracks preset, its own section covers MD — never
// render a second MD section over the same bucket. Its card is enough; the md marker is
// written on advance (see §3) so no MD-only card appears next pull.
showMD       = mdMissing && !instIsMdType

if (instKnown && !mdMissing) return;   // nothing new to ask
if (seen.has(instPrefKey)) return;
seen.add(instPrefKey);

steps.push({
  kind: 'pref-band',
  personName: name,
  instLabel: inst.label,
  instId: inst.id,
  prefKey: instPrefKey,
  showInstrument: !instKnown,
  isMD,
  showMD,
  mdPrefKey
});
```

This covers the promoted-player case: `instKnown && mdMissing && !instIsMdType` → a card
with `showInstrument:false, showMD:true`. And for an MD whose instrument is already the
MD/tracks preset, `showMD` stays false (no duplicate section) — but `isMD` is still true,
so the md marker is written on advance.

### 2. `renderPostPullStep` — `pref-band` branch (~line 11162)

- **Header** adapts to the flags:
  - `showInstrument && showMD` → tag `New on ${instLabel} · MD`; subtitle references both.
  - `!showInstrument && showMD` → tag `Now Music Director`; subtitle: first time as MD for
    this person, set what the MD role needs.
  - `showInstrument && !showMD` → current copy, unchanged.
- **Body**:
  - When `showInstrument`: render the instrument section into `#pp_setup_editor` via
    `renderPersonSetupEditor(el, stableSetupKey(name,'band',instTypeKey), instTypeKey)`
    (unchanged path).
  - When `showMD`: render a second labeled section "Setup as Music Director" into
    `#pp_md_setup_editor` via
    `renderPersonSetupEditor(el, stableSetupKey(name,'band','md'), 'md')`.
- Both editors save selections live into their own buckets (existing behavior of
  `renderPersonSetupEditor`).

### 3. Advance/save — `pref-band` branch (~line 11281)

- The `#pp_name` rename logic already re-keys the person's buckets and recomputes
  `step.prefKey`. MD keys are derived from the same name.
- On advance:
  - If `step.showInstrument`: `state.musicianPreferences[step.prefKey] = {askedAt}` (as today).
  - If `step.isMD`: `state.musicianPreferences[`${normFullName(step.personName)}|md`] = {askedAt}`
    (recomputed from the possibly-renamed name). Keyed on `isMD` — not `showMD` — so the md
    marker is also written when the instrument is itself the MD/tracks preset (§1), preventing a
    stray MD-only card on the next pull.

## Testing (`tests/mdsetup.js`, jsdom harness like `tests/setupreview.js`)

1. **Both new:** keys player who is MD, no prefs → `buildPostPullSteps` yields one
   `pref-band` step with `showInstrument:true` and `showMD:true`.
2. **Promoted player:** keys player with `name|keys` marker present but no `name|md`,
   set as MD → one step with `showInstrument:false, showMD:true`.
3. **Render:** a `showMD` step renders a `#pp_md_setup_editor` container populated with
   MD preset groups; a non-MD step renders no MD section (regression).
4. **Dedup after completion:** simulate completing the card (write both markers) →
   a second `buildPostPullSteps` yields no step for that person.
5. **Non-MD regression:** ordinary band player → step has `showMD:false`, no MD section.
6. **MD-typed instrument:** a player whose instrument is itself the MD/tracks preset and
   who is MD → `showMD:false` (no duplicate section), and after advancing, the `name|md`
   marker is written so no MD-only card appears on a second pull.

Run `npm run check` and `npm test`; suite must stay green (allowing the known
`curve.js` false-fail).

## Watchlist

Add to `docs/WATCHLIST.md`: "A person on an instrument who is also MD is asked for
both instrument and MD setup on the same post-pull card; a player promoted to MD is
asked for MD setup even if already set up on their instrument."

## Known scope limits

- The MD section attaches to the **band** card. If the MD is ever a vocalist-linked
  player (`inst.vocalistPlayer`), that path is not covered. MD is normally keys/tracks
  (a band position), so this is out of scope for now and noted here rather than built.
