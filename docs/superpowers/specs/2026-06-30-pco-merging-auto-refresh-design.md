# Merging auto-refresh for the recalled PCO plan — design

_Status: approved design (brainstorming output). Date: 2026-06-30._

## Problem

All app state lives in one browser's `localStorage`. Today the only way to get the
latest Planning Center (PCO) plan into the app is the **Pull Plan** button, which is
**destructive**: `applyPCOPlanData` (`index.html:6900`) wipes `vocalists`,
`assignments`, instrument assignments, `hosts`, `shadows`, and `serviceOrder`,
re-derives everyone from PCO, recomputes stage positions (`computePositions`),
re-runs mic auto-assign, and re-links band↔vocalists. A green-room display can only
stay current by someone manually re-pulling — and a re-pull throws away every manual
edit made since the last pull.

## Goal

Keep the recalled session current automatically (~3 min cadence) by **merging** the
latest PCO data into the existing plan: pull what changed upstream while preserving
the operator's manual edits. "Remember my changes, update everything else."

## What must be preserved (Layer 1 — user-owned, never overwritten by refresh)

PCO has no concept of these, so a refresh never touches them:

- Stage positions (`assignments`, per-person stage XY)
- Mic assignments (per-person `micAssigned`; instrument mic/pack)
- People added by hand (vocalists/band/hosts typed in, not from PCO)
- Host & MD overrides set or corrected manually
- Band↔vocalist links (`inst.vocalistPlayer`)
- Setup checklist check-offs (`checklistState`) — already persists

## What refresh updates (Layer 2 — PCO-owned)

Roster membership and roles, person status, the whole service order, and plan
title/date. Governed by the rule matrix below.

## Architecture

### The PCO baseline (the one new saved field)

```
state.pcoBaseline = {
  planId,
  people: [ { pcoId, name, kind, position, host, isMD, status } ],
  serviceOrder: [ { id, title, key, length, leader, notes, seq } ],
  meta: { title, date }
}
```

- Stores **only PCO's side of the truth** as of the last sync. Never stores user edits.
- Written on **every accepted pull**: the manual **Pull Plan** and after each
  merge-apply. So the baseline always equals "what PCO last told us."
- It is the *base* in a three-way compare (base = baseline, mine = live state,
  theirs = fresh PCO). This is what distinguishes "you edited this" from "PCO changed
  this" from "you added this by hand."

**No per-entity schema change.** The live `vocalists`/`instruments`/`hosts` shapes are
unchanged. The diff compares **PCO-vs-PCO by `pcoId`** (both baseline and fresh pull
carry it via the team-member id). To *apply* a delta to live state, the matching live
entity is located by the **name the baseline recorded** for that `pcoId`. (Edge case:
if the operator manually renamed a PCO person locally, apply-by-name can miss; this is
not an expected workflow and is accepted.)

### Two distinct sync actions

- **Pull Plan** — unchanged. Destructive fresh start (wipes edits, recomputes
  positions/mics). For starting a new week. Also writes the baseline.
- **↻ Refresh + 3-min timer** — new. *Merge*: pull latest, apply per the rules, keep
  all manual work. The existing `#pcoRefreshBtn` (today a destructive re-pull,
  `index.html:11853`) is **repurposed** to trigger this merge.

### Merge flow (each refresh)

1. **Guard** (see Cadence & guards). If blocked, skip this tick — no fetch.
2. **Fetch** fresh PCO (same 3 calls as `pcoPullPlan`: team_members, plan, items).
3. **`derivePcoModel(planData, tmRes, itemsRes)`** — a **pure** function refactored
   out of the parsing half of `applyPCOPlanData`. Returns `{people, serviceOrder,
   meta}` and mutates nothing. (`applyPCOPlanData` is refactored to call it, so the
   destructive Pull Plan path and the merge path share one parser — no divergence.)
4. **`diffPcoModel(baseline, newModel)`** — diff PCO-vs-PCO by `pcoId`. Produces a
   change-list: `added`, `hardRemoved`, `declined`, `roleChanged`, `renamed`,
   `serviceOrderChanged`, `metaChanged`.
5. **Apply** per the rule matrix, locating live entities by the baseline's name.
6. **Commit**: `state.pcoBaseline = newModel`; `saveState()`; re-render; post
   notifications.

### Rule matrix (locked)

| PCO change | Action | Notify |
|---|---|---|
| Song add / remove / reorder / key / length / leader / notes | replace service order | no |
| Plan title / date | apply | no |
| Person **added** | create empty slot, default position, free mic if available | ⚠ needs you (assign mic/position) |
| Person **declined** | auto-remove (frees mic/position) | ⚠ needs you (find a sub) |
| Person **hard-removed** | auto-remove | ℹ FYI (no action) |
| Person **role changed** | re-slot to new role, **keep their stage position** | ℹ FYI |
| Person **renamed** (same `pcoId`) | update name | no |

Everything **auto-applies**; notifications are informational. (This supersedes an
earlier "notify, apply on click" idea — and it means an unattended green-room TV stays
correct with nobody clicking.)

Adding a new person must **not** disturb existing placements: append the person and
give a default position without calling the full `computePositions` re-layout. A free
mic is auto-assigned only if one is available; otherwise the ⚠ item flags it.

Role change re-slots the person's instrument/vocal role but **preserves their stage
position** (Layer 1).

## Notifications UI

- Transient `toast()` per refresh that changed anything ("Synced: +1 vocalist,
  −1 song").
- An **attention banner** near the PCO bar with two tiers:
  - **⚠ needs you** — sticky until addressed/dismissed: adds without a mic/position,
    declines needing a sub.
  - **ℹ FYI** — dismissable/transient: hard-removals, role changes, renames.

## Cadence, guards, controls

- `AUTO_REFRESH_MS = 180000` (3 min). `setInterval` started in `init()` when PCO is
  connected and a plan is selected.
- **Skip a tick** when any of: in Edit Layout (`body.stage-editing`) or a modal/popup
  is open; PCO disconnected or no plan selected; user has paused; a refresh is already
  in flight (no overlapping fetches).
- **Manual pause toggle**, persisted in `state.config` (per-venue display block),
  shown by the PCO bar. ↻ Refresh forces a merge on demand regardless of the timer.
- Token expiry uses the existing `pcoFetch` auto-refresh. A hard failure skips quietly
  and notifies once.
- Tab-hidden is intentionally **not** a guard — the timer keeps checking in the
  background so a backgrounded display still updates.

## Testing (jsdom, existing harness)

`derivePcoModel` and `diffPcoModel` are pure → unit-tested directly with crafted
team-member / items payloads.

Change-detection cases:
- add → change-list `added` + ⚠ notify
- decline → `declined`, removed from live, ⚠ notify
- hard-remove → `hardRemoved`, removed from live, ℹ FYI
- role change → `roleChanged`, re-slotted, stage position kept, ℹ FYI
- rename (same `pcoId`) → `renamed`, name updated (NOT remove+add)
- song reorder/key change → service order replaced

Preservation guarantees (the core promise) — after a merge that changes PCO data:
- a manual stage position survives
- a manual mic assignment survives
- a hand-added person (no `pcoId`) survives
- a host/MD override survives

Guard test: no refresh runs while `body.stage-editing` is set.

Add the new test file(s) to `tests/`; the runner picks them up. `npm run check` and
`npm test` must be green before any commit/deploy.

## Out of scope (YAGNI for this spec)

- The broader green-room TV **data sync** (URL-encoded state / hosted store) — separate
  backlog item; this spec assumes the display runs in a browser that is itself signed
  into PCO.
- Configurable cadence UI — fixed at 3 min via a constant for now.
- Merging manual local renames of PCO people back to PCO.
