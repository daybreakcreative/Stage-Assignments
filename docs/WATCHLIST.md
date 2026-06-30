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
30. **Custom outline hides the curve/depth sliders** (Advanced Settings → Display), and
    the two reset buttons are consolidated to one "Reset outline to defaults" (clears
    the custom outline AND resets sliders to defaults).
31. **`renderDisplayView` is null-hardened** — band/hosts/shadows/run-sheet element
    accesses are guarded so one missing node can't abort the render; the service-order
    rail renders. → `display`, `summary`
32. **Stage edit consolidation** — one "Edit Layout" button → inline edit mode (no
    modal). Toolbar = Outline + Features + Reset to Auto + Done. Esc exits. → `editlayout`,
    `smoke2`
33. **Move-people drag works** inline (pointer events; reads the people layer live at
    drag time). Tablet touch-drag works (`touch-action:none` on edit-mode slots). →
    `editlayout`

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
- [ ] Per-instrument setup presets + "+ Default setup" add the right items;
      `detectPresetKey` maps tags (incl. md, strings). → `setuppresets`, `setupmgr`
- [ ] Setup templates save/apply. → `templates`

### Stage & layout
- [ ] Stage renders D-shape; curve/depth sliders reshape it; custom outline overrides. →
      `stagepreview`, `stagelayout`
- [ ] Custom outline editor: drag corners, add/remove, curve edges; Reset to rectangle. →
      `smoke2`, `stagepreview`
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

### Persistence & data
- [ ] State persists across reload; `loadState` merges new defaults onto old saved
      state without dropping fields. → `persist`
- [ ] Export / Import JSON (Advanced Settings → Data → Download JSON). → `persist`
- [ ] Labels/formatting helpers render names correctly. → `label2`
