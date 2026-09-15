# Tomorrow — 2026-09-15

Audit surface for last night's work (8 judgment calls, 1 low-confidence):
`~/Documents/03_Claude/tools/review/review-2026-09-14-stageassign.html`

Everything below is live already. These are checks and one decision, not builds.

## 1. Booth TV, real Sunday plan — the whole point (10 min)
Open a real plan in Display on the booth machine. Looking for:
- all band players listed (this was showing 4 of 6 at 1920 before yesterday)
- both host names readable from the back of the room
- nobody's name sitting on top of anyone else's on the stage plot
- everyone inside the stage outline

## 2. Hosts type — the one call I made for you (2 min) ⚠ DECISION
HANDHELDS text went 17px → 14px so BAND could show all 6 players at 20px instead of
4 at 17px. Measured alternatives: bias 2 → band 22 / hosts 12; **bias 6 → 20 / 14
(shipped)**; bias 10 → 19 / 15. If 14px reads small from the back, it is one constant
(`DV_SIDE_GROW_BIAS`).

## 3. Print Summary (3 min)
Print or preview a full-team plan. Names on the stage diagram should not overlap —
they did before last night, on any team of ~14. Check a 2-page plan prints sanely.

## 4. AGENTS.md (1 min) ⚠ DECISION
Untracked file in the repo, added Sep 13 — a Codex context file, not mine. Commit it,
delete it, or leave it? I have not touched it.

## 5. Known limit — confirm you don't care (1 min)
22 people (12 vocalists + 10 band) on a 1280×720 screen still degrades: 7 overlaps,
band 8/10 at 7px. 1920 handles it cleanly. Recorded as an accepted limit — say if it
is actually a real scenario for you and I will take it.
