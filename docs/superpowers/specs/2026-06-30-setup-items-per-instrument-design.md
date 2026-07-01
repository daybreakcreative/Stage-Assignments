# Per-instrument setup items — design

_Status: approved design (brainstorming output). Date: 2026-06-30._

## Problem

The per-person setup checklist is unreliable: items duplicate per person, content is
inaccurate/out of date, and there's no way to configure per-instrument defaults during
first-run. Setup is normally prepped several days in advance; the exception is a
last-minute roster add, which today arrives with no setup prepped and no prompt to fix it.

## Goals

1. **Grouped, accurate options per instrument** — each instrument exposes its real
   options as groups (pick-one radios + check-any checkboxes).
2. **Church defaults configured in the wizard, per instrument** — instruments do NOT ship
   with defaults; the church selects its default items per instrument in the wizard (and
   may add custom items).
3. **Per-person selection on add** — when people are added, a consolidated dialog lets the
   operator tick/untick each person's items (church defaults pre-checked) and add custom
   ones; saved per person, editable later.
4. **Fix duplicates** — a person never accumulates duplicate items across re-pulls.
5. **Last-minute-add path** — a person added after prep is seeded + flagged for review.

## Architecture — three layers

1. **Option catalog** (built-in, `SETUP_TEMPLATES`): per instrument, the groups → options.
   Defines *what's available*. **No defaults baked in.**
2. **Church defaults** (`state.config.setupDefaults`): per instrument, which options are the
   church's defaults, plus any custom options the church added. Set in the wizard; editable
   in Advanced Settings.
3. **Per-person instances** (`state.setupItems[personKey]`): each person's actual selections
   (seeded from church defaults when first added), plus custom items and day-of done status.
   Editing church defaults does NOT retroactively overwrite a person already saved.

### 1. Option catalog shape (no defaults)

```js
const SETUP_TEMPLATES = {
  keys: {
    label: 'Keys',
    groups: [
      { id:'source', name:'Signal source', type:'radio', options:[
        { id:'k_house',  text:'House keys rig' },
        { id:'k_analog', text:'Sounds from keyboard — analog' },
        { id:'k_iface',  text:'Sounds from computer — interface', addItems:['Needs interface'] },
        { id:'k_dante',  text:'Sounds from computer — Dante', addItems:['Needs network — thunderbolt adapter'] },
      ]},
      { id:'inputs', name:'Stereo inputs', type:'radio', options:[
        { id:'in1', text:'1 stereo input' }, { id:'in2', text:'2 stereo inputs' }, { id:'in3', text:'3 stereo inputs' },
      ]},
      { id:'cabling', name:'Cabling / interface', type:'check', options:[
        { id:'c_di', text:'Stereo DI/DIs & 1/4" cables' }, { id:'c_xlrk', text:'XLR out of keyboard' },
        { id:'c_xlri', text:'XLR out of interface' }, { id:'c_qi', text:'1/4" out of interface' },
        { id:'c_bi', text:'Bringing interface' },
      ]},
      { id:'extras', name:'Extras', type:'check', options:[
        { id:'e_remove', text:'Remove keyboard (bringing own keyboard)' }, { id:'e_laptop', text:'Laptop stand' },
        { id:'e_2nd', text:'2nd keys stand (2 keyboards)' }, { id:'e_music', text:'Music stand' },
      ]},
    ]
  },
  // ...one entry per instrument (full catalog below)
};
```

- `radio` = pick one; `check` = pick any. `addItems` = extra checklist lines an option
  implies when selected. A radio group MAY resolve to "none selected."

### 2. Church defaults shape

```js
state.config.setupDefaults = {
  keys: {
    selections: { source:'k_house', inputs:'in2', cabling:['c_di'], extras:['e_music'] },
    customOptions: [ { id, text, group:'extras' } ]   // church-added options beyond the catalog
  },
  // ...per instrument
};
```

If an instrument has no entry, its default is "nothing selected."

### 3. Per-person instance shape

```js
state.setupItems[personKey] = {
  selections: { source:'k_house', inputs:'in2', cabling:['c_di'], extras:[] },
  customItems: [ { id, text } ],           // person-specific added lines
  items: [ { id, text, doneThisService, scopeOneTime, optionId } ],  // resolved check-off lines
  seeded: true,                            // seeded once from church defaults; never re-seed
  needsReview: false                       // last-minute add awaiting confirmation
};
```

`items` is derived from `selections` + `customItems` (each selected option → its text plus
any `addItems`). Re-selecting a radio swaps that group's line(s); `doneThisService` persists
per surviving line and rolls over per service (existing `maybeRollOverToNewService` kept).

## Config ↔ day-of check-off

Two views over the same per-person data (matches current usage):
- **Person setup editor** = grouped radio/checkbox controls → choose *which* lines apply.
  Done in advance.
- **Check-off view** (red/yellow/green completion) = the resolved `items`, each with a done
  checkbox, used Sunday to track physical setup. Completion stats/badges unchanged.

## Wizard: configure church defaults per instrument

New/updated wizard step. For each instrument the user added (from the instruments step), a
compact collapsible card renders that instrument's groups with **nothing pre-selected**. The
church ticks the options that should be its defaults (radio pick + checkboxes) and may add
custom items. Saved to `state.config.setupDefaults`. An instrument left untouched has an
empty default (people start blank and are filled in the per-person dialog).

## Per-person selection on add (consolidated)

When people are added to instruments:
- **After a PCO pull / merge-refresh add:** one consolidated dialog lists every
  newly-added person. Each person shows their instrument's full grouped option list with the
  **church defaults pre-checked**; the operator ticks/unticks any option and can add custom
  items. Saving writes each person's `selections`/`customItems` and clears `needsReview`.
- **Single manual add:** opens that person's setup editor directly (same grouped selector,
  church defaults pre-checked).
- Non-default options are always available to select. The dialog is skippable (people keep
  the pre-checked defaults, remain flagged `needsReview` until opened).

## Duplicate fix (root cause + remedy)

- **Root cause:** per-person buckets are keyed `name|inst.id`; `inst.id` is volatile
  (auto-created slots, PCO re-pulls mint new ids), so a person accrues buckets under stale +
  current keys and all render → duplicates.
- **Remedy:** key per-person setup by a **stable identity**: `normFullName(name)` +
  instrument *type* (`detectPresetKey`: `drums/bass/ag/eg/keys/md/strings`), not the slot id.
  One bucket per (person, instrument-type). Migration: on load, merge legacy `name|inst.id`
  buckets into the stable key (union items, prefer done-status), then drop legacy keys.
- **Seed once:** the `seeded` flag guards against re-applying defaults on every render/pull.

## Last-minute adds

Setup is prepped days ahead. A person added *after* prep — via PCO merge-refresh (`added`
change-list) or manual add — is seeded from church defaults and marked `needsReview:true`.
Surfaced:
- **PCO adds:** extend the existing merge ⚠ notice to also say "complete setup items" for
  that person (reuses `pcoMergeNotify`), and include them in the consolidated dialog.
- **Any add:** the setup nav badge (`setupNavBadge`) reflects `needsReview` people; the
  person's row shows a "review" marker until opened. `needsReview` clears when the operator
  opens/saves that person's setup.

## Full per-instrument option catalog (VALIDATE THIS)

Groups: **(R)** = radio/pick-one, **(C)** = check/any. No built-in defaults — the church
picks defaults in the wizard. `(confirm)` = a grouping judgment to verify.

**DRUMS**
- Options (C): Remove snare (bringing own) · Remove cymbals (bringing own) · Bringing side
  snare · Bringing tom 3 · Needs music stand · Needs drum sticks

**BASS**
- Rig (R, no default): House bass rig · Player bass rig (XLR for player bass rig)
- Inputs (C): Clean & dirty (2 inputs) · Synth bass (2 inputs)
- Cabling & extras (C): Needs DI · Needs 10' 1/4" cable · Needs talkback mic · Music stand ·
  Guitar stand

**AG (Acoustic)**
- Rig / signal (R): Wireless AG rig · House AG tuner/DI · XLR for player AG rig
- Extras (C): Needs house acoustic guitar · Needs 10' 1/4" cable · Music stand · Power
  needed · Guitar stand
- Conditional: Boom mic stand — auto-added only if the player is a linked vocalist
  (`inst.vocalistPlayer`); keeps current behavior.

**EG (Electric)**
- Rig (R): House EG rig · Mono guitar rig · Stereo guitar rig
  - Mono ⇒ addItems: Mono DI box · Amp & mic setup (mono) · XLR for player EG rig (mono)
  - Stereo ⇒ addItems: Stereo DI box · Amp & mic setup (stereo) · 2 XLRs for player EG rig
- Guitar stand (R): Single guitar stand · Multi guitar stand (bringing multiple EGs)
- Extras (C): Needs 10' 1/4" cable · Needs talkback mic

**KEYS** — see catalog example above (Signal source R; Stereo inputs R; Cabling/interface C;
Extras C incl. Remove keyboard).

**MD / Tracks**
- Rig (C): House tracks computer · House Dante tracks rig · Computer stand · Talkback mic &
  opto gate
- Extras (C): Music stand

**VIOLIN / CELLO (strings)**
- Pickup (R): House clip & mic · Player mic & clip / instrument pickup
- Connection (R): Needs wireless pack · Needs DI box & 1/4" · XLR only  _(available options;
  most relevant when "player pickup" is chosen)_
- Extras (C): Power needed · Music stand · Needs instrument stand

**VOCALS**
- Options (C): Straight mic stand on stage

## Testing (jsdom)

- **Seed-once / no duplicates:** assign an instrument, re-run pulls/renders repeatedly →
  exactly one bucket per (person, type), no duplicated lines.
- **Migration:** a legacy `name|inst.id` bucket merges into the stable key without loss;
  legacy key removed.
- **Radio exclusivity:** selecting a second option in a radio group clears the first.
- **Church defaults from wizard:** a wizard-selected default flows to a newly-added person's
  pre-checked selection.
- **addItems:** selecting "Stereo guitar rig" adds its three component lines; switching to
  "Mono" swaps them.
- **Consolidated dialog:** after a pull adding N people, the dialog lists all N with church
  defaults pre-checked; un/re-ticking persists to `selections`; save clears `needsReview`.
- **Custom items:** a per-person custom item persists and survives re-render.
- **Last-minute add:** a merge-refresh `added` person is seeded, `needsReview:true`, and the
  merge notice mentions setup items.
- **Boom mic:** appears only when the player is a linked vocalist.

## Out of scope (YAGNI)

- Reordering groups/options in the UI (edit text/defaults/custom only).
- Per-venue setup templates (shared/global, like brand + setup templates today).
- Nested/reveal UI (one level of groups).
