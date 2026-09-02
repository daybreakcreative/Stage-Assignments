# Stage·Assign — Regression Watchlist

Behaviors that must keep working. **The executable version of this list is `tests/`
— run `npm test` after every change.** This file is the human-readable companion.

> **Canonical numbered list (items 1–53):** the full, original numbered watchlist also
> lives in Dillon's Claude project instructions/memory. If you want this file to be the
> single source of truth, paste items 1–16 verbatim under the matching areas below. The
> recent items (23–53) are reproduced in full here, and every area maps to a test file.

---

## Recently shipped — must not regress (items 23–53, detailed)

23. **Reset to rectangle** in the outline editor produces a TRUE flat rectangle
    (`rectangleStagePoints()`), not the curvature-derived peaked shape. → `smoke2`,
    `stagepreview`
24. **PCO header button** is a single "Planning Center" button — red + tooltip
    "PCO: Not Connected" when disconnected, blue + "Planning Center — connected" when
    connected. The old separate "not connected" pill is gone.
25. **Full-name auto-linking only** (updated 2026-07-19). On a PCO pull a band position
    auto-links to a vocalist with the SAME full name (`autoLinkBandToVocalists`, matched by
    `normFullName`); a guitarist and a vocalist who share only a *first* name still stay
    separate. The explicit "★ link / also a vocalist" control also sets `inst.vocalistPlayer`.
    → `setuppresets`, `dvbatchb`
26. **Boom-mic auto-add** fires for a typed-name MD band person OR a vocalist who has an
    instrument linked to them (lands on the vocalist's bucket) — via a full-name auto-link
    or an explicit link, never on a shared first name alone. → `setuppresets`
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
    - **Church defaults editable in Advanced Settings.** Setup Items tab has a collapsible
      "Default setup items per instrument" section (`renderSetupDefaultsEditor` → all 8 catalog
      keys incl. MD) that edits `state.config.setupDefaults[key]` via the same grouped selector,
      applying to NEW people as they're seeded — non-destructive to existing buckets. → `setupdefaults`
    - **Bulk pre-add people (Phase 1).** Setup Items tab → "＋ Bulk pre-add people" opens a
      single-page grid (`openBulkPreadd`/`renderBulkPreadd`/`commitBulkPreadd`): add rows (name +
      instrument/role, "also MD") or "Add everyone on the current plan", expand each to set their
      setup (`renderPersonSetupEditor`) + vocal mic, Save writes the stable buckets + a remembered
      mic + `musicianPreferences` "known" markers (so they aren't re-prompted). → `bulkpreadd`
    - **Bulk pre-add — Phase 2 (PCO-linked).** In the bulk grid: "＋ Bulk add regulars on your team
      (anyone scheduled from the last 6 months)" (`fetchPcoRegulars`) walks the selected service
      type's past plans (`filter=past`, stops >6mo), collects `team_members`, and appends deduped
      rows via the pure `bulkRowsFromPcoTeamData` (one row per role; band/vocal/MD only; MD-also-
      plays → `isMD` on the instrument row; MD-only → a `role:'md'` row with an on/off-stage
      select, stored on `musicianPreferences[name|md].onStage` — capture only, no placement yet).
      The manual name field is a PCO people search (`bulkPeopleSearch` → `/people/v2/people`,
      canonical name) when connected; plain text when offline. Button disabled without PCO + a
      service type. → `bulkpreaddpco`
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
35. **Display band rows label roles on the POSITION cell.** An MD reads "BASS · MD | Name | Bass";
    an instrumentalist who also sings reads "BASS · Vocal N | Name | <their vocal pack>" and also
    keeps their vocalist card. (`renderDisplayView` #dvBandList loop; `tests/dvbatchb.js`.)
36. **Full-name auto-link on PCO pull.** Same full name on a vocal spot + any instrument →
    `inst.vocalistPlayer` linked (`autoLinkBandToVocalists`). Shared first name only → NOT linked.
37. **Front-line placement of melodic instrumentalist-vocalists.** After vocal ordering, a
    non-leader instrumentalist-vocalist moves to the vocal slot nearest their instrument's X;
    song-leaders stay centered. Drums excepted (`placeLinkedInstrumentalists`).
38. **Singing drummer stays at the kit.** The drum-kit stage mark renders (labelled with the
    drummer) and the drummer gets NO front-line vocal mark; they still appear in the Band list as
    "DRUMS · Vocal N" and keep their vocalist card.
39. **Bulk pre-add is person-cards.** Each person is one card listing their scheduled positions as
    read-only chips (Vocals / instrument / MD); MD is its own chip (no "also MD" checkbox); the only
    dropdown is a per-card "+ add position" picker. Commit still writes `musicianPreferences`
    markers per position. (`renderBulkPreadd`, `bulkPeople`; `tests/bulkpreadd*.js`.)
40. **Host/pastor channel routing.** On a PCO pull the speaker/pastor lands on the channel whose
    label contains "Pastor" (else the first channel); the baptizing pastor takes the "HH 3" channel
    or the last channel (never the pastor channel); live/welcome hosts fill the rest in order.
    Positions with "video"/"communion"/"pre service prayer" stay ignored. Same pastor-target in
    `pcoAddHost`. Default channels remain the relabelable HH 1–HH 4. (`applyPCOPlanData`,
    `pcoAddHost`; `tests/hostmics.js`.)
41. **✓ Items per-person cog.** Each person card in the ✓ Items view has a ⚙ that opens an inline
    editor for THAT person's setup items — one section per role for a multi-role person
    (`openChecklistPersonEditor` → `renderPersonSetupEditor`). Edits the person's bucket only (church
    `setupDefaults` untouched); the cog click never toggles a check-off chip; stage-fixture cards
    have no cog. (`collectChecklistItems` buckets, `renderSetupChecklist`; `tests/scvcog.js`.)
42. **Bug report goes to KHARIS.** "Report a bug" (button "Submit") POSTs
    `{description, build, serviceDate, config, attachments[]}` to `state.config.bugIntakeUrl`
    (default `daybreak.up.railway.app/bug`); PCO `clientId`/`clientSecret` are stripped from the
    config first. Attachments come from a clickable drag-and-drop zone (any file type, multiple).
    On any failure it falls back to the old download + prefilled-GitHub-issue flow (also sanitized).
    KHARIS `POST /bug` uploads each attachment + config to Basecamp and posts one campfire line.
    (`sendBugReport`/`openBugReportModal`; `tests/bugreport.js`.)
43. **PCO service-type dropdown honors `pcoConfig.favoriteServiceTypeIds`** (checkbox picker
    in Advanced Settings → Planning Center, with search) + a live PCO-bar filter box; empty
    favorites = show all; selected id always kept. (`populateServiceTypeSelect`;
    `tests/pcofilter.js`.)
44. **Editable setup catalog.** `setupCatalogFor` reads the `state.config.setupCatalog`
    overlay first, else the built-in `SETUP_TEMPLATES` (coerced on load by
    `coerceSetupCatalogOverlay`). The "Edit questions" disclosure — in **both** Advanced
    Settings → Setup Items **and** the first-run wizard's setup-intro step, lazily mounted on
    open — renames/adds/removes/reorders options AND sections (radio↔check) and resets to
    default. Edits preserve option/section **ids**, so a person's saved selections still
    resolve (rename "House EG rig" → "Helix" and their checklist keeps its ticks); a removed
    option leaves dangling selections inert. Custom instrument types ("＋ New instrument type")
    appear in `allSetupKeys()`, `bulkRoleOpts()`, and the Setup Items cards. `detectPresetKey`
    priority is `inst.setupKey` → `setupTypeRules` keyword → built-in regex; the per-instrument
    Setup-type override only renders when a custom type exists.
    (`tests/setupcatalog.js`, `tests/setuptypes.js`, `tests/setupwizard.js`.)
45. **Vocal numbering is gap-free; a vocalist can be dragged into an open slot.**
    `VOCAL N`/`PAC N` come from the slot index, and the display view hides unnamed vocalists —
    so a leftover blank slot used to steal a low number and start the visible list at VOCAL 2.
    `compactAssignments(arr, vocs)` packs filled slots to the front preserving order, sorting
    NAMED vocalists ahead of blank placeholders; `computePositions` returns through it, so
    add / remove / PCO pull all land gap-free. `vocalDropOnSlot(vid, toIdx)` swaps on an
    occupied card and MOVES onto an empty one, then re-packs; `renderVocalists` renders one
    trailing dashed `.voc-empty` drop slot as the target. **Stage placement is unaffected** —
    it comes from `getVoxPositions(count)` + order, never the slot index.
    (`tests/vocalpos.js`; `dvempty.js` counts `.voc-card:not(.voc-empty)`.)
53. **Stage person cards never spill outside the stage box.** Cards are centred on the person, so
    someone at stage-left/right with a long name grew OUTWARD and was clipped by
    `.dv-stage-svg-wrap`'s `overflow:hidden` ("Simon Mugarami" → "imon Mugarami" on the TV).
    `stageLabelAnchor(x, span)` buckets each card from its x in the 0..800 viewBox — outer 22%
    anchors left, outer 22% anchors right, middle stays centred — and CSS swaps the transform
    (`translate(0,-50%)` / `translate(-100%,-50%)`). Chosen at render time from coordinates, so it
    needs NO measurement and holds at every pane width; three earlier measurement-based attempts
    all failed because the display settles asynchronously and the card is sized in px, not viewBox
    units. Names are never truncated to achieve this. → `stageclip`
52. **Auto-added lines are removable too, and stay removed.** Some lines are injected straight
    into `bucket.items` rather than coming from the catalog — the MD's "Boom mic stand"
    (`ensureBoom`) and the assigned vocal mic (`syncAssignedMicItem`). Two rules: the editor lists
    any `autoAdded` line so it HAS an ✕ (excluding `kind === 'mic'` — the MIC dropdown is that
    line's control), and every auto-adder checks `setupLineRemoved(bucket, text)` before
    re-adding, or it resurrects the line on the next enumeration. → `keysremove`
51. **Any line on a person's setup list can be removed — including implied `addItems` lines.**
    A radio option can drag in extra lines (EG "Stereo guitar rig" implies "Amp & mic setup
    (stereo)", "Stereo DI box", "2 XLRs…"). Those had no remove control, so dropping one meant
    unticking the whole rig and losing its siblings. The ⚙ per-person editor now lists EVERY
    resolved line with an ✕: a real custom item is deleted, anything catalog-derived is suppressed
    via the existing `customItems` `{text:'', replaces}` override — no new persisted field, no
    migration. Removals show in a "Removed for this person" list with **Restore**, survive
    `rebuildPersonItems` AND `reconstructSetupBucket` (which now carries the markers forward), and
    never disturb a sibling's check-off. `removeSetupLine` / `restoreSetupLine` /
    `removedSetupLines`. → `itemremove`
47. **Vocal mic (capsule) is editable in three places, not just the vocalist card.**
    A mic `<select>` appears in the per-person setup editor (vocals buckets only, via
    `renderPersonSetupEditor`) and on each ✓ Items vocalist card (`.si-mic-select`), backed by
    `vocalistByAnyName` / `micOptionsHtmlFor` / `setVocalistMicByName`. It honors inventory
    capacity exactly like the vocalist card (a mic at capacity is disabled for others, never for
    its owner), remembers the pick via `setMicRemembered`, and keeps the auto-mic checklist item
    in sync. `isVoc` is threaded through `collectChecklistItems` so a sings-and-plays person gets
    ONE picker (on their vocal card), not two. → `micedit`
48. **The auto-added vocal mic is never swept into `customItems`.** `reconstructSetupBucket`
    turns any item whose text isn't a catalog option into a custom item; the capsule isn't a
    catalog option, so it used to become a permanent custom line — and changing someone's mic
    left the OLD capsule on the checklist next to the new one. It is now excluded by
    `kind === 'mic'`, `autoAdded`, or a match on `bucket.micItemText`. Genuine custom items are
    unaffected. → `micstale`
49. **Someone on the plan with NO setup items still gets a ✓ Items card.** Both the per-person
    filter and the per-SECTION filter key off people, not items, so a band member with an empty
    bucket renders the "No setup needed" state (`.si-none`) with a working ⚙ — previously they
    were dropped entirely, which also made their setup unreachable from that page. Zero-item
    people contribute nothing to the progress counts. → `scvnoitems`
50. **Headshots on the display.** A PCO pull captures `photo_thumbnail_url` into
    `state.peoplePhotos[normFullName]` — **the URL only, never image bytes** (that is what kept
    this feature parked). `headshotHtml` renders an avatar on display vocalist cards and band
    rows; no photo → initials (`personInitials`), and a dead URL falls back to initials via
    `onerror` rather than showing a broken-image glyph. "Show headshots" toggle in Advanced
    Settings → Display, default ON. → `headshots`
46. **✓ Items lists vocalists in STAGE order.** `enumerateSetupRoles` walks
    `vocalistsInStageOrder()` (driven by `state.assignments`), not the raw `state.vocalists`
    array — which is insertion/PCO-pull order and comes back alphabetical. Cards read
    VOCAL 1, 2, 3 left-to-right like the stage; a vocalist holding no slot is appended last so
    nobody is dropped. Band order is unchanged (it already follows the instrument roster =
    stage left→right) and is locked by a test. (`tests/scvorder.js`.)

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
- [ ] Vocal positions stay gap-free (VOCAL/PAC 1..N, blanks sort last) and a vocalist can be
      dragged onto another card (swap) or the trailing empty slot (move) — see item **45**.
      Stage placement must NOT shift when only the numbering compacts. → `vocalpos`, `dvempty`
- [ ] Shadows (understudies) render and keep their own setup. → `shadows`
- [ ] `detectPresetKey` maps tags to grouped-catalog keys (incl. md, strings); the
      grouped `SETUP_TEMPLATES` catalog exposes per-instrument options. → `setuppresets`,
      `setupmgr`
- [ ] Flat setup UI + Settings "Templates" tab + old Template feature are RETIRED; the
      person card is grouped-only and "Add item" writes a custom item without data loss. →
      `setupretire`
- [ ] The setup catalog is user-editable (overlay + custom types + PCO keyword rules) — see
      item **44** above for the full contract. → `setupcatalog`, `setuptypes`, `setupwizard`
- [ ] ✓ Items lists vocalists in STAGE order (`vocalistsInStageOrder`), band in instrument-roster
      order — see item **46**. → `scvorder`

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
