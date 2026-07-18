# Bulk pre-add — Phase 2 (PCO-linked) — design

**Date:** 2026-07-18
**Status:** Approved (design), pending build
**File:** `index.html` (bulk pre-add grid + PCO helpers)

## Problem / goal

Phase 1's bulk grid takes free-text names, which don't reliably line up with future PCO pulls
(a bucket keyed "Ava" won't match a pulled "Ava Chen"). Phase 2 makes the grid **PCO-linked**:
- A headline button, **"Bulk add regulars on your team (anyone scheduled from the last 6 months)"**,
  that auto-populates the grid from who's actually been scheduled.
- The manual "Add person" name field becomes a **PCO people search**, so typed people resolve to
  real PCO identities (canonical names that match pulls).
- Proper handling for a **tracks-only MD** (no instrument): an MD row with an on-stage/off-stage
  choice, not a fake instrument.

## What already exists (reuse)

- `pcoFetch(path)` — authenticated GET (auto token-refresh). Scope already includes **`people`**
  (`PCO_SCOPES = 'services people'`).
- Plans list: `/services/v2/service_types/{id}/plans?filter=past&order=-sort_date&per_page=…`
  (`d.attributes.sort_date`, `links.next` for paging).
- Team members: `/services/v2/service_types/{id}/plans/{planId}/team_members?per_page=100` →
  `data[].attributes` has `.name` (canonical person name), `.team_position_name`, `.status`
  (`'D'` = declined).
- `classifyPosition(name)` → `{ kind:'vocalist'|'band'|'md_flag'|'host'|'ignore'|'shadow',
  position?, isWL? }`.
- Phase 1 grid: `bulkPreaddRows` (array of `{id,name,role,typeKey,isMD,mic,open}`),
  `openBulkPreadd`/`renderBulkPreadd`/`commitBulkPreadd`, `renderPersonSetupEditor`,
  `stableSetupKey`, `setMicRemembered`, `musicianPreferences` markers.

## Design

### A. Row model additions
- New role **`'md'`** (tracks-only MD, no instrument): fields `{ role:'md', onStage:true }` (no
  `typeKey`). Its expanded editor mounts only the MD setup (`stableSetupKey(name,'md','md')`, 'md')
  plus an **on-stage / off-stage** select. Existing `vocalist` and `band`(+`typeKey`, optional
  `isMD`) rows are unchanged.
- Manual role `<select>` gains an **"MD (tracks, no instrument)"** option that sets `role:'md'`.

### B. `renderBulkPreadd` changes
- **PCO people search on the name field** (when `pcoTokens` present): the `.bulk-name` input is a
  search box; on debounced input (≥2 chars), call
  `pcoFetch('/people/v2/people?where[search_name_or_email]=<q>&per_page=8')`, show a dropdown of
  `data[].attributes.name` (+ id); selecting one sets `r.name` (canonical) and `r.pcoId`. When
  `pcoTokens` is absent, the field stays a plain text input (offline fallback).
- **MD row body:** for `role==='md'`, render `<select class="bulk-md-stage">` (On stage / Off
  stage, bound to `r.onStage`) + the MD editor. For `band`/`vocalist`, unchanged (with the "also
  MD" checkbox still available on band/vocal rows).

### C. Regulars button (`fetchPcoRegulars`)
- Header button **"＋ Bulk add regulars on your team (anyone scheduled from the last 6 months)"**;
  disabled (with tooltip) unless `pcoTokens` and `state.pcoConfig.selectedServiceTypeId` are set.
- Flow:
  1. `cutoff = today − 6 months`.
  2. Page past plans (`filter=past&order=-sort_date&per_page=50`, follow `links.next`), collecting
     plan ids whose `sort_date >= cutoff`; stop at the first older plan.
  3. For each plan **sequentially** (progress: "Scanning plan N of M…"), fetch `team_members`;
     collect `{ name, position, declined }` (skip `status==='D'`). A plan that throws is skipped
     and counted.
  4. Hand the collected list to the pure aggregator (below); append its rows to `bulkPreaddRows`
     (skipping any whose identity+role already exists in the grid); `renderBulkPreadd()`.
  5. Toast summary: "Added N regulars from M plans" (+ "(K plans couldn't be read)" if any).

### D. `bulkRowsFromPcoTeamData(members, existingKeys)` — pure, testable
- Input: `members = [{ name, position }]` (deduped across plans is not required — the function
  dedupes). Output: `[{ name, role, typeKey?, isMD?, onStage? }]`.
- For each member, `classifyPosition(position)`:
  - `vocalist` → key `name|vocalist` → row `{name, role:'vocalist'}`.
  - `band` (pos X) → key `name|band|X` → row `{name, role:'band', typeKey:X}` (**one row per
    distinct instrument**).
  - `md_flag` → add `normFullName(name)` to an MD set (not a row yet).
  - `host`/`ignore`/`shadow` → skipped.
- After the pass, for each MD-set person:
  - if they have ≥1 band/vocal row → set `isMD:true` on their first row.
  - else (MD-only) → emit one row `{name, role:'md', onStage:true}` (default on stage).
- Drop rows whose `name|role|typeKey` is in `existingKeys` (dedupe vs the current grid).

### E. `commitBulkPreadd` additions
- `role==='md'` rows: mark `musicianPreferences[`${nn}|md`] = { askedAt, onStage: r.onStage }`
  (the on/off-stage captured preference). The MD setup bucket is saved live by the editor.
- `isMD` on band/vocal rows already writes `${nn}|md` — extend to also carry `onStage` when set
  (default true for an instrument-playing MD).
- Everything else (mic remembered, vocal/band markers) unchanged.
- **Note:** `onStage` is captured for future use — no code places a solo MD on/off stage yet.

## Testing (`tests/bulkpreaddpco.js`, jsdom; stub `pcoFetch`)

1. `bulkRowsFromPcoTeamData`: multi-role person → one row per instrument; a person who is band +
   md_flag → instrument row(s) with `isMD:true`; an md_flag-only person → one `role:'md'` row with
   `onStage:true`; host/ignore/shadow positions skipped; dedupe vs `existingKeys`.
2. Vocalist WL and non-WL positions both → a single `name|vocalist` row.
3. `fetchPcoRegulars` (with `pcoFetch` stubbed to return 2 past plans in-window + 1 older, and
   team_members per plan): appends the expected rows, stops at the >6-month plan, skips a plan
   whose fetch rejects (counted), and dedupes against existing grid rows.
4. MD-only row: expanding shows an on/off-stage select + the md editor; Save writes
   `musicianPreferences[name|md].onStage` and the `name|md|md` bucket.
5. People-search: with `pcoFetch` stubbed for `/people/v2/people`, typing in `.bulk-name` yields a
   dropdown; selecting sets the row's canonical name.
6. Regulars button disabled without PCO connected / no service type.
7. Full `npm test` green (allow `curve.js`); Phase 1 `bulkpreadd` test still passes.

## Scope / non-goals

- Fixed **6-month** window (no picker). Button label verbatim: *"Bulk add regulars on your team
  (anyone scheduled from the last 6 months)"*.
- No placement behavior for on/off-stage MD (captured only).
- No new persistence keys beyond `onStage` on the existing `musicianPreferences[name|md]` marker
  and an optional `pcoId` on a grid row (transient; not persisted).
- People-search uses `where[search_name_or_email]`; if a PCO instance rejects it, fall back to
  `where[search_name]` (try/catch), else the plain text field.
