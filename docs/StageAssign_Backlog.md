# Stage·Assign — Edit & Fix Backlog

_Compiled from all our conversations (the project handoff doc, the three UX/bug audits, the screenshot review, and saved ideas). Grouped by type, roughly in priority order. Tags: **[BIG]** = significant/needs a decision · **[FIX]** = concrete bug fix · **[FEATURE]** = new capability · **[AUDIT]** = needs a tracing pass, real bugs likely · **[POLISH]** = minor._

---

## Parked for discussion (after Aurora #8 + pack rework #9)

### Competitive feature review vs sidestage.pro [DISCUSS]
Requested 2026-07-06. A friend built a similar worship-team stage/assignment app at
**https://www.sidestage.pro**. Task: research the site (+ anything findable about it),
list features it has that Stage·Assign doesn't, then discuss with Dillon which (if any)
to add. Purely a research + discussion item — nothing to build yet. Do this in a
dedicated turn (web research on the marketing site + any docs/changelog/screenshots).

### "Report a bug" feedback loop — v2 of the beta button [BIG][FEATURE]
Requested 2026-07-06. Supersedes the `·c` "Submit beta test" button (which just
downloads JSON + opens a mailto — a v1 stepping stone).

Vision: a **"Report a bug"** button in Advanced Settings → opens an in-app form
(free-text description + **screenshot upload**) → the feedback comes back so Claude
can see it firsthand and advise Dillon on fixes (which adjustments to make, etc.).
Email-to-Dillon is an acceptable transport if simpler; he'd relay. Wants it cohesive.

Key constraint to resolve when we design it: the app is a **single static file on
GitHub Pages, no backend**, so the feedback needs a destination. Options to weigh:
- **Email/mailto** (no backend; Dillon pastes reports to Claude) — closest to today.
- **Form service** (Formspree / Google Form / Airtable) — real inbox, screenshots,
  no server to run.
- **GitHub issue via API** — lands in the repo where Claude works, but needs a
  scoped token embedded (public-repo risk) or a tiny proxy.
Screenshot upload without a backend means either drag-into-email, a service that
accepts files, or capturing the app's own DOM to an image client-side.

---

## ✅ Already done (baseline — so the list below is only what's left)
- Removed the Bézier pen tool; built the polygon outline editor.
- Fixed the corner-drag bug (drag now follows the pointer).
- Added edge **curve** capability (drag an edge dot to bow it).
- Fixed the "old curve still drawn on top of a custom outline" bug.
- Curves persist across reload (save/load no longer strips them).
- Feature labels stay **upright** regardless of fixture rotation.
- Surfaced **Outline / Features / Move people** buttons on the stage; made them touch-visible.
- Built the stage **features** system (stairs, doors, risers, monitors, etc.) with drag/resize/rotate/label.
- Wizard now pre-creates vocalist slots from the count.
- Auto-Assign no longer deletes empty vocalist slots.
- Display lock is now gated behind a toggle (off by default) and relabeled.
- **Audit pass** (roadmap step 1): PCO pull + mic resolution, shadows/hosts, templates, and TV display — all traced and fixed; mic-preference system rebuilt into one priority model.
- **Stage diagram in the Print Summary** (step 2): the printout now shows the real stage map — shape, fixtures, and band/vocalists in position.
- **Navigation & naming + touch** (step 3): unified to "Advanced Settings" / "✓ Items"; Layout→Display and Setups→Setup Items tabs; display scale popups made touch-visible.
- **Multi-venue phase 1** (step 5): venue data model, migration, and switching (see below).

---

## 1. Data, sync & live-ness  *(the highest-leverage area)*

- **[BIG] Green-room TV data sync.** All data lives in one browser's `localStorage`, so a separate green-room TV has no way to get it except manual JSON export/import or running the whole workflow on the TV itself. This undercuts the headline display feature. _Blocked on: how your display actually runs (same machine / separate display / cast from a phone)._ Options range from a "copy display link" that encodes state in a URL (read-only TV view) up to a small hosted store.
- **[FEATURE] 3-minute auto-refresh of the recalled session.** Auto re-pull the current plan / re-render every ~3 min so the display stays current without a manual reload. Guard so it pauses during active editing and skips quietly when PCO isn't connected. _(Plugs into the TV sync work.)_
- **[DONE] Multi-venue profiles — COMPLETE (all 5 phases).** Each campus keeps its own room config; this week's roster and global settings are shared.
  - **Model:** a venue = the per-ROOM slice of state. Live `state` reflects the active venue; switching stashes the current room's fields, loads the target's, re-renders. Migration wraps any existing single-config install into a "Main Campus" venue automatically (`ensureVenues`, runs at top of `init()`).
  - **Per-venue:** mic locker (`inventory`), stage geometry (`stageShape/Curvature/Depth`, custom positions/points), `stageFeatures`, `stageAreas`, IEM pack naming (`voxIemPacks/iemPackPresets/shadowPack/enableShadows`), `vocalDirection`, the whole `display`/TV block, `tvMode`, the leader-mic pool (`micPrefs.leaderMics`), and the default PCO service type.
  - **Per-service (shared, never swapped):** service, vocalists, assignments, shadows, MD, hosts, notes, serviceOrder, checklistState.
  - **Global (never swapped):** brand, theme, PCO credentials, and person mic preferences (`micPrefs.people`).
  - **Decisions (locked):** band slots = per-venue (reconcile assignments on switch — phase 4); roster carries across a switch; person prefs global but leader-mic pool per-venue; display/TV per-venue; brand + setup templates shared.
  - **Phases (all done):** ✅ 1 data model + migration + `switchVenue` (venues.js) · ✅ 2 top-bar venue switcher with quick-add (venues2.js) · ✅ 3 Manage Venues panel — rename / duplicate / delete, last-venue guard (venues3.js) · ✅ 4 per-venue instrument slots + assignment reconciliation on switch (venues4.js) · ✅ 5 polish — active-venue tag in Settings header, per-venue PCO service-type preselect, switch-venue prompt when pulling another campus's plan (venues5.js).
- **[FIX] PCO auth is per-browser.** A separate TV would need its own Planning Center sign-in. (Part of the sync story.)

## 2. Print & export

- **[FEATURE] Put the stage diagram in the Print Summary.** The printout is text-only today — the stairs, doors, monitors, and the whole stage layout you place never reach the stage tech on paper.
- **[POLISH] Export options.** Consider a "print/share the display view" or PDF of the layout for posting backstage.

## 3. Features ↔ the rest of the app

- **[DONE] Features feed the setup checklist.** Placing a Monitor or DI/Power fixture now auto-adds a matching item to a new STAGE section of the ✓ Items checklist ("Line-check …" / "Patch & test …"). Derived live from the fixtures and keyed by fixture id, so it appears/disappears as you add/remove them and check-offs survive relabeling. Duplicate-labeled fixtures are now numbered (Monitor #1, #2…) so they're distinguishable. (tested, checklist2.js + fixtures.js)
- **[DONE] Duplicate a fixture.** Selecting a fixture in the stage editor now shows a **Duplicate** button that drops a copy (same type/label/size/rotation) nudged down-right, ready to drag. (tested, fixtures2.js)
- **[DONE] Clarify the "Marker / Label" fixture.** Renamed the palette item to **Text label**, its text now renders **inside** the dashed box (reads as a sign), it starts blank with its label field auto-focused on add, and the inspector field prompts "Sign text…". (tested, fixtures2.js)
- **[POLISH] Feature label overlap.** Labels can overlap an adjacent fixture when the stage is crowded.

## 4. Navigation & naming

- **[FIX] Naming collisions.** "Advanced Settings" (the button) opens a sheet titled "Settings" that contains a "Layout" tab — while the stage has its own "Move people" control and the nav has a "Set Up" checklist. Rename for distinct jobs so first-time users can predict what's where.
- **[DONE] Nav button density.** The shell is now a flex column (so the top bar can be any height and the workspace reflows beneath it — this also fixed a latent overflow when the PCO bar is showing). At ≤1024px the top bar wraps into rows: brand + venue switcher on row 1, the event title on its own full-width row, and the action buttons wrapping below; the brand subtitle hides and the title input drops its 240px min-width. Buttons shrink slightly at ≤520px. (tested, mobile.js)

## 5. Touch & mobile  *(the actual booth/TV context)*

- **[FIX] Remaining hover-only controls.** The run-sheet scale and stage-scale popups appear on hover, which doesn't work on a tablet — needs a tap-friendly path.
- **[MOSTLY DONE] General mobile responsiveness.** Audited the whole app at tablet/phone widths: it already had solid responsive foundations (single-column workspace, aspect-ratio stages, `min-width:0` guards, breakpoints for the wizard/setup-items/display views, and touch-sized fixture handles via `@media (hover:none)`). The one real gap was the top bar (now fixed above). Remaining: spot-check on real devices, since the layout work was verified structurally (CSS rules + markup) rather than by visual render.

## 6. Audit-and-fix passes  *(untraced — this is where live-Sunday bugs most likely hide)*

- **[AUDIT] PCO plan pull + mic resolution.** Core to your workflow and not yet deeply traced — parsing, `resolveVocalistMics`, edge cases (no team, partial team, re-pull).
- **[AUDIT] Shadows / hosts flows.** Adding, naming, IEM packs, display rendering.
- **[AUDIT] Templates feature.** Saving/applying reusable setups.
- **[AUDIT] Display "TV mode" rendering.** Card sizing, section toggles, run-sheet position at real TV resolutions.

## 7. Polish & smaller fixes

- **[POLISH] Seeded WL on an empty slot.** The wizard marks the first vocalist as Worship Leader even if it's left blank; Auto-Assign would then center an empty starred card. Self-resolves once you name/unstar it, but could be cleaner.
- **[DONE] Stage right/left clarity.** Both stage editors now carry a caption under AUDIENCE: "SL = stage left · SR = stage right · as the band sees it", and the fixture-placement editor gained the SL→/←SR side labels it was missing. (tested, fixtures2.js)
- **[DONE] Checklist state lost on rename.** Renaming a vocalist or band member now remaps their check-offs to the new name (across every plan), so the boxes stay ticked. Covers the vocalist-who-plays-an-instrument case too. (tested, checklist.js)
- **[DONE] PCO onboarding errors.** OAuth/token failures now map to actionable messages instead of raw codes — redirect-URI mismatch (shows the exact URI to register), unrecognized Client ID/Secret, declined authorization, missing scopes, and expired codes. (The 5-minute setup guide + Demo Mode already existed.) (tested, fixtures2.js)

---

### Suggested sequencing
1. ✅ **Audit pass** on the PCO pull + the untraced flows.
2. ✅ **Print Summary** stage diagram + features.
3. ✅ **Navigation & naming** + remaining **touch/hover** fixes.
4. ~~Green-room TV sync / 3-min auto-refresh~~ — **dropped**: the display runs on the same machine that edits, so there's nothing to sync.
5. ✅ **Multi-venue** profiles — *complete* (all 5 phases shipped; see the scope above).
