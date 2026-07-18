# Stage·Assign — Regression Watchlist

Behaviors that must keep working. **The executable version of this list is `tests/`
— run `npm test` after every change.** This file is the human-readable companion.

> **Canonical numbered list (items 1–33):** the full, original numbered watchlist also
> lives in Dillon's Claude project instructions/memory. If you want this file to be the
> single source of truth, paste items 1–16 verbatim under the matching areas below. The
> recent items (23–33) are reproduced in full here, and every area maps to a test file.

---

## Recently shipped — must not regress (items 23–33, detailed)

23. **Reset to rectangle** in the outline editor produces a TRUE flat rectangle
    (`rectangleStagePoints()`), not the curvature-derived peaked shape. → `smoke2`,
    `stagepreview`
24. **PCO header button** is a single "Planning Center" button — red + tooltip
    "PCO: Not Connected" when disconnected, blue + "Planning Center — connected" when
    connected. The old separate "not connected" pill is gone.
25. **No name-based auto-linking.** A guitarist and a vocalist who share a first name
    stay separate. Linking only via the explicit "★ link / also a vocalist" control
    (`inst.vocalistPlayer`). → `setuppresets`
26. **Boom-mic auto-add** fires for a typed-name MD band person OR a vocalist who has
    an instrument explicitly linked to them (lands on the vocalist's bucket) — never on
    a name match. → `setuppresets`
27. **Service-order rows reorder** with ▲▼ (disabled at the ends), swapping in state.
    → `summary`, `nav`
28. **Lock Mic / No Mic buttons removed** from vocalist cards. Locking still lives in
    Advanced Settings → mic prefs. → `mic`
29. **All multi-venue UI hidden** this release (switcher, Venues tab, settings venue
    tag). Machinery kept/dormant; single venue works. → `venues2`–`venues5`
30. **Custom outline hides the curve/depth sliders** (Advanced Settings → **Stage**), and
    the two reset buttons are consolidated to one "Reset outline to defaults" (clears
    the custom outline AND resets sliders to defaults). _(Settings split 2026-07-10: stage
    shape/outline live on the new **Stage** tab, instruments/IEMs on **Instruments & IEMs**;
    "Display" is now display-view options only. → `settingstabs`)_
31. **`renderDisplayView` is null-hardened** — band/hosts/shadows/run-sheet element
    accesses are guarded so one missing node can't abort the render; the service-order
    rail renders. → `display`, `summary`
32. **Stage edit consolidation** — one "Edit Layout" button → inline edit mode (no
    modal). Toolbar = Outline + Features + Reset to Auto + Done. Esc exits. → `editlayout`,
    `smoke2`
33. **Move-people drag works** inline (pointer events; reads the people layer live at
    drag time). Tablet touch-drag works (`touch-action:none` on edit-mode slots). →
    `editlayout`
34. **Grouped per-instrument setup-items model.** The setup checklist is driven by a
    grouped catalog and stable per-person keys, replacing the old flat per-person lists:
    - **Grouped catalog.** `SETUP_TEMPLATES` (via `setupCatalogFor`) defines each
      instrument's options as radio/check groups; `resolveSetupItems` turns a selection
      object into the concrete item list. → `setupcatalog`, `setupresolve`
    - **Church defaults in the wizard.** The wizard's per-instrument default cards write
      `state.config.setupDefaults`; `churchSetupDefaults`/`defaultSelectionsFor` read it
      (falling back to catalog defaults). → `setupwizard`
    - **Stable per-person keys, seeded once.** Buckets are keyed
      `stableSetupKey(name, role, typeKey)` (role ∈ band/vocalist/shadow) and seeded a
      single time via `seedPersonSetup`. A re-pull that re-mints instrument ids does NOT
      duplicate a person's bucket. → `setupmgr`, `setupcheckoff`
    - **Legacy buckets migrate on load.** `migrateLegacySetupBuckets` (wired in init)
      folds old `name|instId` / `name|vocal` / `name|shadow` / `name|tag:…` buckets into
      the stable key, preserving items + done state. → `setupmigrate`
    - **Editor + check-off share one bucket.** The grouped per-person editor
      (`renderPersonSetupEditor`/`renderSetupGroups`) and the check-off view
      (`getStageAreas`) read/write the SAME stable-key bucket. → `setupeditor`,
      `setupcheckoff`
    - **New adds are seeded + flagged for review.** A newly added person is seeded and
      marked `needsReview`; the consolidated **review dialog** (`openSetupReviewDialog`)
      surfaces them, and the ⚠ notice/badge mentions setup. → `setupreview`
    - **Auto-refresh pauses while the review dialog is open** (same guard family as edit
      mode / open modals). → `setupreview`, `pcorefresh`
    - **Flat setup UI is RETIRED (grouped-only person card).** The old flat setup UI is
      gone: no "Quick add" preset chips, no "Edit presets" link, no "+ Default setup"
      button, no "+ Template" / "Save…" buttons on the person card; the Settings →
      **Templates** tab and its editor are removed; `SETUP_ITEM_PRESETS`,
      `getSetupPresets`, `renderPresetEditor`, `openSaveOptionsMenu`, `openTemplateMenu`,
      `applyTemplateToPerson`, `saveCurrentItemsAsTemplate`, `renderTemplatesEditor`,
      `maybeAutoLoadPersonDefaults`, `state.setupTemplates`, `state.config.setupPresets`,
      and `state.config.personSetupDefaults` no longer exist. The person card keeps ONLY
      the grouped **⚙ Edit setup** editor, the check-off item rows, and a manual
      **Add item** row. → `setupretire`
    - **"Add item" writes a custom item — no data loss.** The card's Add item pushes
      `{id,text}` to `bucket.customItems` and calls `rebuildPersonItems`; editing the
      grouped selections (which also rebuilds items from `selections`+`customItems`) must
      NOT wipe manually-added items. This was the confirmed data-loss bug the retirement
      fixes. → `setupretire`, `setupeditor`

---

## Core behaviors by area (maps to items 1–22 + the test suite)

### Mic engine & assignment
- [ ] Auto-Assign hands the best-ranked mics to worship leaders first; respects locks
      and "no mic". → `micengine`, `aa`, `mic`, `micorder`
- [ ] Mic inventory shows the default mics with ⋮⋮ drag-rank (Advanced Settings AND
      wizard). List order = priority. → `micorder`, `mic`
- [ ] Per-person mic prefs (Always / Usually / No mic) persist and apply. → `mic`

### People, naming & checklists
- [ ] Renaming a vocalist or band member keeps their checklist check-offs (including a
      person who is both a vocalist and an instrumentalist). → `checklist`, `setupmgr`
- [ ] Adding/removing/reordering instruments works; optional instruments behave. →
      `newinst`
- [ ] Shadows (understudies) render and keep their own setup. → `shadows`
- [ ] `detectPresetKey` maps tags to grouped-catalog keys (incl. md, strings); the
      grouped `SETUP_TEMPLATES` catalog exposes per-instrument options. → `setuppresets`,
      `setupmgr`
- [ ] Flat setup UI + Settings "Templates" tab + old Template feature are RETIRED; the
      person card is grouped-only and "Add item" writes a custom item without data loss. →
      `setupretire`

### Stage & layout
- [ ] Stage renders D-shape; curve/depth sliders reshape it; custom outline overrides. →
      `stagepreview`, `stagelayout`
- [ ] Custom outline editor: drag corners, add/remove, curve edges; Reset to rectangle. →
      `smoke2`, `stagepreview`
- [ ] Front edge supports MULTIPLE edges (an angled/peaked front): the Front-edge tool is a
      multi-select toggle with an active indication (pressed button + crosshair cursor + hint),
      `state.config.stageFrontEdges` (array; legacy `stageFrontEdge` kept synced to the first),
      and vocalists spread by ARC LENGTH across the combined front polyline. Single edge / slider
      shape unchanged; saved-stage round-trips `frontEdges`. → `frontedge`
- [ ] Stage features (stairs/doors/risers/wedges) place and persist. → `fixtures`,
      `fixtures2`
- [ ] Move-people drag repositions and saves; Reset to Auto clears. → `editlayout`
- [ ] Saved-stage library: save/load/delete named stages. → `savedstages`
- [ ] Wizard stage + stage-layout steps mirror the live stage (custom outline, fixtures,
      people-drag). → `wizcheck`, `stagelayout`

### Display, run sheet & output
- [ ] Display view shows stage + band/hosts/vocalists + service-order rail. →
      `display`, `summary`
- [ ] Service order (run sheet) edit: add/delete/reorder/edit items + headers. →
      `summary`, `nav`
- [ ] Print Summary is unbranded black-and-white. → `summary`
- [ ] Navigation between Assign / Display / Settings works. → `nav`, `mobile`
- [ ] **Single look, locked.** The app uses ONE font (**Manrope**) everywhere and is locked to
      the **Platinum** palette — bold mixed-case titles, thin uppercase-tracked labels/roles — with
      NO color/mood picker in Settings or the wizard; the ☾/☀ dark-light toggle still works. (The
      multi-"worlds" redesign was reverted 2026-07-09; it lives at tag `worlds-v1`.) → `aurora`,
      `wizquickwins`

### Persistence & data
- [ ] State persists across reload; `loadState` merges new defaults onto old saved
      state without dropping fields. → `persist`
- [ ] Export / Import JSON (Advanced Settings → Data → Download JSON). → `persist`
- [ ] Labels/formatting helpers render names correctly. → `label2`

### PCO auto-refresh & merging refresh
- [ ] **↻ Refresh** performs a MERGING refresh (preserves manual edits) via
      `pcoMergeRefresh()`, NOT a destructive re-pull. **Pull Plan** remains the
      destructive fresh start. → `pcorefresh`
- [ ] A 3-minute auto-refresh timer runs while connected; it merges upstream PCO
      changes preserving stage positions, mics, hand-added people, and host/MD
      overrides. Timer starts from `showPCOBar()` (NOT `init()`), so tests never start
      it. → `pcorefresh`
- [ ] Refresh guards: no refresh while editing layout, while a modal (`.overlay.show`)
      is open, when disconnected/no plan, when paused, or when a refresh is already in
      flight. → `pcorefresh`
- [ ] **Pause auto-refresh** checkbox reflects + persists `state.config.autoRefreshPaused`. →
      `pcorefresh`
- [ ] On a service pull, a person on an instrument who is also the MD is asked for BOTH
      instrument and MD setup on the same post-pull card; a player promoted to MD is asked
      for MD setup even if already set up on their instrument; the MD section never duplicates
      when the instrument itself is the MD/tracks preset; the popup's MD edits share the items
      layer bucket (`stableSetupKey(name,'md','md')`). → `mdpostpull`
- [ ] The ✓ Items page — the LIVE checklist opened by the ✓ Items nav button
      (`openSetupChecklistView` → `renderSetupChecklist`, `#setupChecklistView`) — renders as
      grouped rich cards: a responsive `.si-grid` of `.si-card` person cards, each with a role
      badge (vocalists = "Vocal N" by assignment slot), a progress ring, setup items as
      click-to-toggle `.si-chip`s, the assigned vocal mic as a highlighted chip, and IEM as an
      uncounted note. Toggling a chip persists to `getChecklistState()` and updates the ring +
      counts in place. Done-state marks the chip with the `ck` class. → `scvredesign`
      (Note: the old unreachable `renderSetupItemsView`/`renderPersonCard`/`enterSetupItemsView`
      `.si-*` card view was removed 2026-07-18; `renderSetupChecklist` is now the only path.
      The `.si-*` CSS and shared helpers — `vocalSlotFor`, `syncAssignedMicItem`,
      `renderPersonSetupEditor`, `refreshSetupItemsUI` — remain in use.)
