# Position map + "not on this plan" check — 2026-11-25

Branch `position-map`. Merge to main AFTER the Thanksgiving Night of Worship (2026-11-25, 6pm).

## Why
Three times in one day the fix for a wrong placement was "teach the app a position name"
(Message, Prayer Host, Ministry Moment). Each needed a code change and a deploy. Planning Center
positions are the team's data; the mapping should be theirs to see and change.

## Goals
1. Every PCO position the app has seen is listed, with what the app does with it.
2. Anyone can change that mapping in Advanced Settings → Planning Center, once, no deploy.
3. A changed mapping can never break the band-slot matching (instrument LABELS keep the built-in rules).
4. When the roster on screen holds someone the selected plan does not, the app says so — once.

## 1. Position map
- [ ] `classifyPositionBuiltin(name)` = today's rules, pure. `classifyPosition(name)` = override first,
      then built-in. Instrument-label callers (`instPositionType`, `instPositionTypeForMerge`, the band
      grid at ~4682) use the BUILT-IN — a label is not a PCO position.
- [ ] `state.config.positionMap = { '<lowercased position>': '<role>' }`; roles: ignore · vocalist · wl ·
      drums · bass · keys · eg · ag · md · speaker · welcome · baptismal · shadow. Absent = automatic.
      Sanitised on load (unknown roles dropped). Global, not per venue (position names are church-wide).
- [ ] `state.positionsSeen = { '<lowercased>': { name, last } }` recorded on every pull and refresh from
      the raw team-member list (all statuses). Capped at 120, oldest dropped. Position names only — no people.
- [ ] Settings UI: "Planning Center positions" table in the PCO tab — position · what it does now ·
      a select (Automatic → shows the automatic result). On-stage roles first, then not-on-stage, then
      unrecognised. Changing one saves immediately and says "applies on the next pull".
- [ ] The static "How position names map" text collapses into a <details> under the table.
- [ ] Tests: override wins; clearing returns to automatic; instrument labels unaffected by a hostile
      override ("Keys" → ignore); seen list fills from pull + refresh, capped; sanitise on load; UI
      select writes the map; a remapped position changes the next pull (Prayer Host → welcome and back).

## 2. Not on this plan
- [ ] After each refresh (and pull), compare who is on screen (vocalists, band, hosts, shadows) with
      the plan's active people. Anyone on screen and not on the plan → ONE dismissable ℹ notice naming them.
- [ ] Dismissing it keeps it gone for that exact set of names for the session; a different set shows again.
- [ ] A hand-typed substitute is the normal case: wording must read as a confirmation, not an alarm.
- [ ] Tests: sub typed in → one notice; dismissed → not re-raised by the next refresh; set changes →
      raised again; nobody off-plan → no notice; full pull → none.

## Ship
- [ ] `npm run check` + `npm test` green; browser-check the settings table at 1024 and phone width.
- [ ] WATCHLIST 85–86, CLAUDE.md pull-rules line, board.
- [ ] Merge after tonight; live-verify by byte compare; the reload strip (WATCHLIST 84) announces it.
