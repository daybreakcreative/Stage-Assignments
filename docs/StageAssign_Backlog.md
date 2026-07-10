# Stage·Assign — Backlog

_Last pruned 2026-07-07; **reconciled 2026-07-09** after the "worlds" redesign was built then reverted (see "Reverted" below).
Tags: **[BIG]** = needs a decision · **[FIX]** = concrete bug · **[FEATURE]** = new capability ·
**[POLISH]** = minor. See also `docs/audit-2026-07-06.md` (health snapshot) and
`docs/sidestage-comparison.md` (competitive review + where the new display ideas came from)._

---

## Open

### Display / green-room
- **[FEATURE] ~~Live countdown + idle screen~~ — DEPRIORITIZED.** A big clock counting down to
  service time, custom labels ("Band Load", "Rehearsal"), an edge-glow alarm at zero, and an
  idle screen when nothing's live. Pure client-side, uses the service time we already have.
  _Deprioritized 2026-07-10 — Dillon deemed it unnecessary for now; brainstorm cancelled. Left
  here in case it comes back._
- **[FEATURE] ~~Headshots on the display~~ — PARKED.** People photos so anyone can run a mic
  check without asking who's who. Client-side is doable but photos bloat `localStorage` — weigh
  the storage cost / cap it / downscale. Best angle if revisited: **pull photos from the PCO
  People API on the plan pull** (zero manual work). Parked 2026-07-10 with the countdown above.
- ~~**[POLISH] Export / share the display view.**~~ **Declined 2026-07-10** — Print Summary is the
  only print path needed (the display is the on-screen/TV view).

### Stage editor
- **[POLISH] Fixture label overlap.** A FIXTURE's label (stairs/doors/monitors) can overlap an
  adjacent fixture on a crowded stage. (Distinct from the person name-label resolver — that shipped
  2026-07-10 ·d.)

### Vocalists
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
