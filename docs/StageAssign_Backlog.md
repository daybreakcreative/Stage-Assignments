# Stage·Assign — Backlog

_Last pruned 2026-07-07; **reconciled 2026-07-09** after the "worlds" redesign was built then reverted (see "Reverted" below).
Tags: **[BIG]** = needs a decision · **[FIX]** = concrete bug · **[FEATURE]** = new capability ·
**[POLISH]** = minor. See also `docs/audit-2026-07-06.md` (health snapshot) and
`docs/sidestage-comparison.md` (competitive review + where the new display ideas came from)._

---

## Open

### Punch list — 2026-07-18 (from Dillon, batched review)
**Quick UI fixes (batch A):** ✅ SHIPPED 2026-07-18 (`2f1549e`) → `uifixes`
- ~~✓ Items should stay full screen~~ — `openSetupChecklistView` now requests fullscreen (fixes
  the drop via the lock screen's "Go to setup" → `exitDisplayMode`). _Confirm at booth (fullscreen
  API can't run in the preview pane)._
- ~~Bulk pre-add modal doesn't scroll~~ — `#bulkList` scrolls.
- ~~Name-format preview cards use one sample name~~ — all four show "Marcus Donalson" formatted.
- ~~Remove all decorative emoji~~ — stripped app-wide; functional glyphs kept.

**Display view (batch B):** ✅ SHIPPED 2026-07-19 → `dvbatchb`
- ~~Band IEM-pack column gradient clipped~~ — `.dv-list` interior padding (booth-verify the glow).
- ~~Instrumentalist who is also a vocalist~~ — now shows in the Band section as
  "Instr · Vocal N | Name | <vocal pack>"; also front-lined near their instrument (drums excepted).
- ~~Instrumentalist who is also MD~~ — "Instr · MD | Name | Pack" (tag moved to the position cell).
- ~~Auto-link a vocalist who is also an instrumentalist~~ — full-name auto-link, all instruments.

**Bulk pre-add (batch C):** ✅ SHIPPED 2026-07-20 → `bulkpreadd`, `bulkpreaddpco`
- ~~Show each scheduled position under a person instead of a role dropdown~~ — the grid is now one
  card per person; positions are read-only chips; MD is its own chip; a "+ add position" picker is
  the only remaining dropdown.

**Bigger features (each its own brainstorm):**
- ~~**[FEATURE] Fix PCO host/pastor assignment.**~~ ✅ SHIPPED 2026-07-20 → `hostmics`. Speaker/
  pastor → the "Pastor"-labelled channel; live hosts → HH channels; baptizing pastor → last HH;
  video/communion/prayer positions ignored. Default channels stay relabelable HH 1–HH 4.
- ~~**[FEATURE] PCO service-type filter.**~~ ✅ SHIPPED 2026-07-26 → `pcofilter`. A favorites
  allow-list (`pcoConfig.favoriteServiceTypeIds`, checkbox picker w/ search in Advanced
  Settings → Planning Center) trims the pull dropdown to the service types a room actually
  uses; a live filter box on the PCO-bar dropdown narrows further; empty favorites = show
  everything; the currently-selected service type is always kept.
- ~~**[FEATURE] Cog on each person's ✓ Items card**~~ ✅ SHIPPED 2026-07-20 → `scvcog`. A ⚙ on each
  ✓ Items card opens that person's setup editor inline (a section per role); edits their bucket
  only. Church defaults stay in the Advanced Settings editor.
- ~~**[FEATURE] Bug submission → KHARIS, not GitHub.**~~ ✅ SHIPPED 2026-07-20. `sendBugReport` POSTs
  to the KHARIS `POST /bug` endpoint (→ Basecamp campfire with screenshot + sanitized config
  attached); GitHub-issue flow retained as the offline fallback. KHARIS side in
  `daybreak-production-ai` (`flags/bugFormat.js`, `POST /bug`).

### Setup items
- ~~**[FIX] Vocal mic capsule was read-only outside the vocalist card.**~~ ✅ SHIPPED 2026-08-27
  (overnight) → `micedit`. Reported: "their set up items 'set up' page allows changing everything
  except the mic capsule ... its read only in both places." A mic picker now sits in the
  per-person setup editor and on each ✓ Items vocalist card, honouring inventory capacity.
- ~~**[FIX] Changing a mic left the OLD capsule on the checklist.**~~ ✅ SHIPPED 2026-08-27
  (overnight) → `micstale`. `reconstructSetupBucket` swept the auto-added mic into `customItems`
  (it isn't a catalog option), making it permanent — after switching to SE V7 the checklist read
  `['SE V7','KMS105']`. A tech would have grabbed the wrong mic. Found because this session made
  the mic easy to change.
- ~~**[FIX] People with no setup items vanished from ✓ Items.**~~ ✅ SHIPPED 2026-08-27
  (overnight) → `scvnoitems`. Two gates (per-person and per-section) dropped them, which also
  removed the only ⚙ that could give them setup items. They now show "No setup needed".
- ~~**[FEATURE] Editable setup items/questions per instrument.**~~ ✅ SHIPPED 2026-07-30 →
  `setupcatalog`, `setuptypes`. Overlay catalog (`state.config.setupCatalog`, read via
  `setupCatalogFor`): rename/add/remove/reorder options AND sections (radio↔check), reset-to-default,
  via an "Edit questions" disclosure per instrument in the Setup Items tab **and in the first-run
  wizard's setup-intro step** (added 2026-07-30 on Dillon's request — same editor, lazily mounted;
  both write the one overlay). Plus custom instrument
  types ("＋ New instrument type"), a PCO keyword→type rules editor, and a per-instrument Setup-type
  override — `detectPresetKey` priority is `inst.setupKey` → keyword rule → built-in regex. ID-stable
  edits keep existing people's checklists intact. Built as 7 TDD tasks; spec + plan in
  `docs/superpowers/`. (Answers the "change house rig → Helix / add option / remove sections" bug.)
- ~~**Default setup items per instrument in Advanced Settings.**~~ ✅ SHIPPED 2026-07-18
  (`renderSetupDefaultsEditor` in the Setup Items tab; edits `setupDefaults[key]` for all 8 catalog
  keys incl. MD). → `setupdefaults`
- ~~**Bulk pre-add everyone's setup preferences.**~~ ✅ SHIPPED 2026-07-18. Phase 1 = single-page
  grid (manual rows / "add current plan"). Phase 2 = PCO-linked: "＋ Bulk add regulars on your team
  (anyone scheduled from the last 6 months)" + PCO people search on the name field; tracks-only MD
  → its own row with on/off-stage. → `bulkpreadd`, `bulkpreaddpco`. ~~**Follow-on:** a solo MD isn't
  placed on/off stage on pull.~~ ✅ RESOLVED 2026-07-28 → `mdsolo`. Dillon's rule: a Music Director
  with **no instrument** (runs tracks) does **not** go on the stage — they appear on the **IEM list
  labeled "MD" with a spare pack** (a Misc preset or an unused vocal pack; `pickSpareIemPack`).
  `ensureSoloMdPack` keeps `state.mdSoloPack` in sync on pull/refresh; `findPackConflicts` includes
  the MD so a pack clash still surfaces. (The captured `onStage` marker is now moot for solo MDs —
  they're always off-stage-on-IEM by this rule; an MD who *does* play stays at their instrument.)

### Display / green-room
- **[FEATURE] ~~Live countdown + idle screen~~ — DEPRIORITIZED.** A big clock counting down to
  service time, custom labels ("Band Load", "Rehearsal"), an edge-glow alarm at zero, and an
  idle screen when nothing's live. Pure client-side, uses the service time we already have.
  _Deprioritized 2026-07-10 — Dillon deemed it unnecessary for now; brainstorm cancelled. Left
  here in case it comes back._
- ~~**[FEATURE] Headshots on the display.**~~ ✅ SHIPPED 2026-08-27 (overnight) → `headshots`.
  Was parked over localStorage cost; solved by storing **the PCO photo URL only, never image
  bytes** — a plan pull captures `photo_thumbnail_url` into `state.peoplePhotos[normFullName]`
  (measured: 2 people = 98 bytes). Avatars render on display vocalist cards + band rows; no photo
  → initials; a dead URL falls back to initials via `onerror`. "Show headshots" toggle in
  Advanced Settings → Display, default ON. Offline booth = initials, by design.
- ~~**[POLISH] Export / share the display view.**~~ **Declined 2026-07-10** — Print Summary is the
  only print path needed (the display is the on-screen/TV view).

### Display / green-room — OPEN
- **[FIX] Stage person name clipped at the stage edge.** At narrower stage widths (i.e. when the
  Service Order rail is showing), a person standing at stage-left/right with a long name is cut
  off by `.dv-stage-svg-wrap`'s `overflow:hidden` — "Simon Mugarami" renders as "imon Mugarami"
  on the green-room TV. Reproduced 2026-08-27; **three fix attempts were made and all reverted**
  (see `tools/review/review-2026-08-27-stageassign.html`): a viewBox-space clamp is wrong in
  principle (the card is sized in pixels, so its viewBox width changes with pane size); a pixel
  clamp right after append measures a half-built box (the display settles asynchronously); a
  ResizeObserver clamp worked at wide widths but still clipped at the narrow width that actually
  triggers it. **This needs a design decision from Dillon**, because both real fixes change how
  the stage looks: (a) let the people layer overflow the stage outline — names extend past the
  edge, positions stay exact; or (b) shrink the drawn stage to reserve a name gutter. Cosmetic,
  not data-affecting.

### Stage editor
- ~~**[POLISH] Fixture label overlap.**~~ ✅ SHIPPED 2026-07-28 → `featurelabel`. Two fixtures placed
  close together printed their below-fixture captions (stairs/doors/monitors) at the same top, so
  the labels sat on top of each other. `resolveFeatureLabelLayout` runs a vertical de-overlap pass
  (mirrors the person name-label resolver) — captions are nudged straight down until they clear;
  markers (labels inside their box) are excluded. Applied in every `renderStageFeatures` pass.

### Vocalists
- ~~**[FIX] Vocal numbering skipped a number; couldn't move a vocalist up a slot.**~~ ✅ SHIPPED
  2026-08-02 → `vocalpos`. Reported: "Unable to move vocalists over 1 number. After Evan was removed
  it kept everyone on their same mic/pac number" (screenshot showed VOCAL/PAC **2–5**, VOCAL 1 empty).
  Cause: `VOCAL N`/`PAC N` come from the slot index, and `computePositions` fans people out
  center-first, so a leftover **unnamed** vocalist (a name cleared instead of the card removed) could
  take a low slot — and the display view *hides* unnamed vocalists, so the visible numbering started
  at 2. Fix: `compactAssignments(arr, vocs)` packs filled slots to the front (named ahead of blanks);
  `computePositions` returns through it, so add/remove/PCO-pull all land gap-free.
  `vocalDropOnSlot(vid, toIdx)` swaps on an occupied card and **moves** onto an empty one, with one
  trailing dashed drop slot rendered as the target. Stage placement is untouched (driven by
  `getVoxPositions(count)` + order, not the slot index). Spec in `docs/superpowers/specs/`.
  **Follow-on (not built):** no persistent "pin this person to VOCAL 3" mode — Dillon chose the
  minimal fix and drag covers reassignment. Build it if the same people get re-dragged weekly.
- ~~**[FIX] ✓ Items listed vocalists alphabetically, not in stage order.**~~ ✅ SHIPPED 2026-08-04 →
  `scvorder`. `enumerateSetupRoles` walked `state.vocalists` (insertion/PCO-pull order, which comes
  back alphabetical); now walks `vocalistsInStageOrder()` off `state.assignments`, so the cards read
  VOCAL 1, 2, 3 left-to-right like the stage (easier when swapping capsules). A vocalist holding no
  slot is appended last. Band order unchanged (already instrument-roster = stage left→right) and
  locked by a test. Shared enumeration, so the check-off view + Setup Manager inherit it.
- ✅ **[DONE 2026-07-10 ·f] Seeded WL on an empty slot.** A blank starred vocalist no longer renders
  as a highlighted/centered card (`computePositions` won't center a nameless WL; the card highlight
  is gated on a name). The ★ button still shows the designation.

---

## Reverted — recoverable from `worlds-v1`

- The **"display worlds" redesign** (5 distinct looks — Molten / Concrete / Corporate / Terra /
  Orbit, each its own layout + type + texture) was fully built and shipped, then **reverted
  2026-07-09** (too complex / not loved). Preserved at git tag **`worlds-v1`**, mockups in
  `docs/design-*.html`, spec + plan in `docs/superpowers/`. A candidate basis for a future
  **per-church custom edition**.
- Two useful fixes rode in with that work — both **re-ported into the live app 2026-07-10 (build
  ·d)**, now shipped (no longer pending):
  - ✅ **Stage name-label overlap resolver** (`resolveStageLabelLayout`) — wired into Display + Print.
  - ✅ **Front-of-stage selector + highlight** (`state.config.stageFrontEdge`) — "⚑ Front edge" in
    the outline editor + wizard, highlighted on Display/Print; vocalists spread along the chosen
    edge (fixes the peaked-outline crowding).

---

## Decisions to make (parked — nothing to build until you weigh in)

- **[BIG] Live TV sync — the strategic fork.** Previously dropped because the display runs on the
  same machine that edits (nothing to sync). The SideStage review reopens it: their whole product
  is a live cloud push to any backstage TV with no shared machine. Adopting it means leaving the
  single-file/no-backend/free model. Range of options: a read-only "display link" that encodes
  state in a URL (shareable to a TV, not truly live) → a small hosted store (live, but a backend).
  Tied to this: **PCO auth is per-browser**, so a separate TV needs its own sign-in. _Your call
  whether to stay a free local tool or grow lightweight cloud sync._
- **[DISCUSS] Which SideStage ideas to adopt.** Full review in `docs/sidestage-comparison.md`.
  The countdown/idle screen + headshots are already broken out under Open above; this is the
  broader "do we chase their live-TV moat" conversation.

---

## Shipped (compressed record — so this list stays honest)

- **Theme (current, 2026-07-09):** the app is locked to a single **Platinum** palette with **one
  font (Manrope)** everywhere — bold mixed-case titles, thin uppercase-tracked labels/roles — plus
  the ☾/☀ dark-light toggle. The old 11-color mood picker + its machinery were removed. (Brand tab
  retired earlier; Name Format lives in the Display tab.)
- **IEM pack rework:** dropped the redundant "Pack" suffix + migration; smart conflict engine
  (off-stage shadow lowest priority); resolution dialog on PCO pull / add-person; live ⚠ badge.
- **Report-a-bug v2:** in-app form (description + screenshot) → downloads config + opens a
  prefilled GitHub issue. (Superseded the v1 "submit beta test" mailto button.)
- **Setup checklists:** per-instrument grouped model, church defaults in the wizard, stable keys
  (dup fix), review flow; one merged checklist per person (incl. linked instruments); solo-MD
  setup items; MD setup items for newly-added people.
- **Multi-venue** profiles — all 5 phases (data model + migration + `switchVenue`, top-bar
  switcher, Manage Venues panel, per-venue instrument slots w/ reconciliation, polish). UI hidden
  this release (single venue). Tests: `venues*.js`.
- **3-minute auto-refresh** of the recalled session (merge-refresh — preserves manual edits;
  ↻ Refresh merges, doesn't destroy). Pauses during editing, skips when PCO isn't connected.
  (Shipped 2026-06-30.)
- **Audit-and-fix pass:** PCO pull + mic resolution (rebuilt into one priority model),
  shadows/hosts, templates, and TV-mode rendering — all traced and fixed. Plus a fresh full-app
  runtime audit 2026-07-06 (green, zero console errors) — `docs/audit-2026-07-06.md`.
- **Print Summary** now includes the real stage diagram (shape + fixtures + people in position),
  reordered for one page.
- **Stage editor:** polygon outline editor (Bézier pen removed), corner-drag fix, edge-curve
  capability that persists, upright feature labels, the features system (stairs/doors/risers/
  monitors — drag/resize/rotate/label), duplicate-a-fixture, Text-label fixture, SL/SR captions.
  Features feed the ✓ Items checklist (live, keyed by fixture id).
- **Navigation & naming + touch:** unified to "Advanced Settings" / "✓ Items"; Layout→Display,
  Setups→Setup Items; display scale popups made touch-visible; top-bar reflow at ≤1024px.
- **Checklist state survives renames** (remaps check-offs across plans). **PCO onboarding errors**
  map to actionable messages. **Display lock** gated behind a toggle. Wizard pre-creates vocalist
  slots; Auto-Assign no longer deletes empty slots.

---

## Standing idea
Nothing else queued. When PCO is connected the 3-min refresh keeps a green-room display current;
the open display features above (countdown/idle/headshots) are the natural next layer.
