# Editable Setup Catalog — Design Spec

**Date:** 2026-07-30
**Source:** Bug report — "allow to edit set up items/questions per instrument so that we can
change house rig to 'helix' or add a second option there, remove sections. etc..."
**Status:** Approved approach (overlay model, both phases in one spec). Awaiting spec review.

---

## 1. Problem

The per-instrument setup questions are a **hardcoded constant** (`SETUP_TEMPLATES`, ~line 2281):
8 instrument types (drums / bass / ag / eg / keys / md / strings / vocals), each with named
**sections** (groups) of **radio** ("pick one") or **check** ("pick any") **options** — e.g. the
Electric Guitar "Rig" section offers "House EG rig", "Mono guitar rig", "Stereo guitar rig".

Today the only per-instrument editing (`renderSetupDefaultsEditor`, Setup Items tab) lets a user
(a) pre-check which options default ON for new people, and (b) add free-text **custom** items. A
user **cannot**:

- rename a built-in option ("House EG rig" → "Helix"),
- add a real option into a built-in section,
- remove or rename a section,
- define a brand-new instrument type.

This spec makes the catalog fully user-editable, and adds user-defined instrument types.

## 2. Current architecture (relevant facts)

- **Catalog shape:** `SETUP_TEMPLATES[key] = { label, groups: [ { id, name, type:'radio'|'check',
  options: [ { id, text, addItems?: string[] } ] } ] }`. `addItems` = extra checklist lines an
  option implies when selected.
- **Single chokepoint:** every consumer reads the catalog through `setupCatalogFor(key)`
  (line 2408). Callers: the group renderer `renderSetupGroups` (10732), the defaults editor
  (6921), per-person setup editor (6875), bucket reconstruction `reconstructSetupBucket` (10271),
  `resolveSetupItems`, and the wizard (13064/13069). **Nothing reads `SETUP_TEMPLATES` directly
  except `setupCatalogFor`.** This is the seam the whole feature hangs on.
- **Selections reference IDs, not text.** A person's saved answers are `selections[groupId] =
  optId` (radio) or `selections[groupId] = [optId, …]` (check). Their visible checklist
  (`bucket.items[].text`) is **rebuilt** from `selections` + the catalog by `resolveSetupItems`.
  **Consequence:** renaming an option's `text` while keeping its `id` does NOT break any saved
  checklist — the rebuild simply emits the new text. This is what makes editing safe.
- **Type detection:** `detectPresetKey(inst)` (2462) maps a band instrument's `tag`/`label` to a
  catalog key via hardcoded regexes. `classifyPosition(name)` (8178) maps a PCO position name to a
  role (band/vocalist/host/md/shadow/ignore); the 5 band buckets are drums/bass/keys/eg/ag.
  `strings` is a catalog key with **no** PCO/classify route — it is reached only by naming a band
  instrument accordingly. This is the precedent the custom-type model follows.
- **Band instruments** have free-form `label` and `tag` (add-instrument seeds "New Instrument";
  the user renames it). So the roster-entry path for any type — built-in or custom — is "a band
  instrument whose label/tag detects to that type."

## 3. Data model — the overlay

Add one optional config field:

```
state.config.setupCatalog        // { [key]: { label, groups:[…] } }  — only EDITED types present
state.config.setupTypeRules      // [ { id, keyword, key } ]           — Phase 2 keyword auto-map
```

Change the chokepoint only:

```js
function setupCatalogFor(key) {
  return (state.config.setupCatalog && state.config.setupCatalog[key])
      || SETUP_TEMPLATES[key]
      || null;
}
```

`SETUP_TEMPLATES` remains the read-only **factory default**. The overlay holds a deep copy of a
type only once the user edits it. Custom types (Phase 2) live only in the overlay (no factory
entry).

**Invariants:**

- **ID stability.** Editing an existing option/section preserves its `id`. New options/sections
  get generated ids (`opt_<rand>`, `grp_<rand>`). Never reuse a deleted id.
- **Reset to default** (built-in types) = delete `state.config.setupCatalog[key]` → falls back to
  `SETUP_TEMPLATES[key]`.
- **Migration / back-compat.** Field absent (all existing saves) ⇒ identical to today. `loadState`
  already spreads unknown config fields; add `setupCatalog:null`, `setupTypeRules:[]` to
  `DEFAULT_STATE.config` and a defensive merge (drop malformed entries).
- **Enumeration helpers.** Introduce `allSetupKeys()` = built-in `SETUP_DEFAULT_KEYS` + custom keys
  from the overlay. `SETUP_DEFAULT_KEYS`, `BULK_ROLE_OPTS`, and the defaults editor iterate
  `allSetupKeys()` so custom types appear everywhere the 8 built-ins do.

---

## 4. Phase 1 — edit the existing catalogs

**Home:** Advanced Settings → **Setup Items** tab, replacing/extending the existing
"Default setup items per instrument" disclosure (`renderSetupDefaultsEditor`). Keep the current
"tick the defaults" behavior; add an **Edit** affordance per instrument that reveals structural
editing (so the common case — just ticking defaults — stays one click and uncluttered).

**Operations (per instrument type):**

- **Options:** rename text · add option to a section · remove option · reorder within a section ·
  (edit `addItems` lines is out of scope for v1 — see Non-goals).
- **Sections (groups):** rename · add section (choose radio/check) · remove section · reorder.
- **Type toggle:** switch a section between radio and check.
- **Reset this instrument to default** (with confirm) — discards the overlay entry.

**Editing mechanics:**

- First structural edit to a built-in type **materializes** a deep copy:
  `state.config.setupCatalog[key] = structuredClone(SETUP_TEMPLATES[key])`, then edits apply to the
  copy. (Ticking defaults still writes `setupDefaults[key]`, unchanged.)
- Removing an option/section leaves any dangling `selections` referencing its id **harmless** —
  `resolveSetupItems` ignores ids not in the catalog. No bucket rewrite needed.
- Renames keep ids ⇒ saved answers and tick history survive.

**UI shape:** a compact inline editor matching the existing `.wiz-setup-inst` card tone — each
section is a titled block with an editable name, a radio/check pill, a list of option rows (text
input + remove + drag handle), an "+ add option" row; below the sections an "+ add section"
control and a "Reset to default" link. No modal; follows the disclosure pattern already there.

---

## 5. Phase 2 — new instrument types + routing

**Add / remove custom types.** In the same Setup Items editor: "+ New instrument type" → prompts a
label (e.g. "Percussion"), creates `state.config.setupCatalog['custom_<rand>'] = { label,
groups:[] }`; the user then builds its sections/options with the Phase-1 editor. Custom types can
be renamed and deleted (delete removes the overlay entry and any keyword rules pointing at it; a
person currently on that type falls back to "no catalog / custom items only").

**Routing a person to a custom type — two paths:**

1. **PCO keyword auto-map.** `state.config.setupTypeRules = [{ id, keyword, key }]`. A tiny rules
   editor (keyword text → pick a type) in the Setup Items tab. `detectPresetKey` consults these
   **first** (user rules win over built-in regex), matching against `inst.tag`/`inst.label`
   case-insensitively. So a PCO-pulled band position whose name contains the keyword, or a
   manually-named instrument, detects to the custom catalog.
2. **Explicit per-instrument override.** In the band instruments editor (and reachable from the ⚙
   per-person setup editor), an optional "Setup type" dropdown listing `allSetupKeys()`. Setting it
   writes `inst.setupKey = key`; `detectPresetKey` returns `inst.setupKey` when present, before any
   rule/regex. This is the deterministic escape hatch for a person the keywords don't catch.

**No stage/mic changes.** Custom types reuse the band-instrument container, so a custom-type person
inherits a stage slot + IEM pack exactly like any band member (the user can leave them unplaced /
mark optional as today). The feature adds **only** setup questions + the routing above — it does
not create new stage geometry, mic logic, or a new roster entity kind.

---

## 6. Non-goals (v1)

- Editing an option's `addItems` (implied extra lines) — keep built-ins; custom options have none.
- New roster entity kinds (a setup-only person with no band-instrument container).
- Auto-classifying custom types into on-stage vs off-stage — inherits band behavior.
- Reordering/renaming the built-in **types** themselves (only their contents).
- Sharing/exporting catalogs between venues/churches (the existing venue machinery is hidden).

## 7. Migration & backward-compatibility

- New saves without the fields behave exactly as today.
- `DEFAULT_STATE.config` gains `setupCatalog:null`, `setupTypeRules:[]`.
- `loadState` merges defensively: coerce `setupCatalog` to an object of well-formed
  `{label, groups:[…]}`; drop rule entries missing `keyword`/`key`; unknown-key rules are inert.
- Existing per-person buckets untouched; they re-resolve through the (possibly edited) catalog on
  next render. A removed option/section simply stops emitting its line.

## 8. Test plan (jsdom, `tests/*.js`)

New file `tests/setupcatalog.js` (Phase 1) and `tests/setuptypes.js` (Phase 2):

- `setupCatalogFor` returns the overlay when present, else the built-in.
- Rename option text (id preserved) ⇒ a person's rebuilt `bucket.items` shows the new text and
  their prior `selections` still resolve (tick survives).
- Add option ⇒ appears in `renderSetupGroups`; selectable; flows into a bucket.
- Remove option / remove section ⇒ dangling selection ids are ignored, no throw, other items
  intact.
- Add section with type radio vs check ⇒ renders with correct single/multi behavior.
- Reset-to-default ⇒ overlay entry gone, built-in restored.
- (P2) `detectPresetKey` honors `inst.setupKey`, then a matching `setupTypeRules` keyword, then the
  built-in regex, in that priority.
- (P2) Add a custom type ⇒ appears in `allSetupKeys()`, the defaults editor, and `BULK_ROLE_OPTS`;
  a band instrument routed to it gets its checklist; deleting it falls back cleanly.
- Regression: the full existing suite stays green (esp. `setupdefaults`, `setupcatalog`-adjacent,
  `mdpostpull`, `scvredesign`, wizard tests).

## 9. Open questions / to confirm at review

1. **Phase 1 UI density** — is an inline expand-to-edit acceptable in the Setup Items tab, or would
   you prefer a dedicated "Edit setup questions" modal? (Recommend inline to match existing tone.)
2. **`addItems` editing** — deferred to keep v1 bounded; confirm that's fine (built-in implied
   lines stay; custom options simply add their own text line).
3. **Custom-type person on stage** — confirm the "reuse band-instrument container (gets a stage
   slot + IEM pack)" model matches your intent, vs. wanting a setup-only, never-on-stage person.
