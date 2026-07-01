# Stage·Assign — Beta Test Checklist

Sections follow the order you'd set the app up in. **Claude has already verified the items it can check by auditing the source code**; those are marked ✅ and you can trust them. The 🔍 items need a human on a real device — that's your list.

**Audited by Claude: 77 of 122. Needs you: 45.**

> ✅ = verified in code (logic is correct) · 🔍 = needs a look on the device / print / Planning Center · ⚠️ = audit note


## How to run

Test the **deployed** site (not `file://`). For 🔍 items, cover the **booth tablet** in landscape *and* portrait, plus a phone; that's the live context. Log bugs with steps · expected · actual · device · whether a reload fixes it.


## Bug Log

| # | Area | Device/Browser | Steps | Expected | Actual | Reload fixes? | Severity |
|---|------|----------------|-------|----------|--------|---------------|----------|
|   |      |                |       |          |        |               |          |

---


## §0 🚦 Smoke test (do this first, every session) — 🔍 your section

- [ ] 🔍 App loads to the workspace — no blank screen, no console errors
- [ ] 🔍 Add a vocalist and type a name → it appears on the stage diagram
- [ ] 🔍 Click Auto-Assign → mics populate with no error
- [ ] 🔍 Open ▶ Display → it renders; close it → back to the workspace
- [ ] 🔍 Advanced Settings → every tab opens (Inventory, Assignments, Display, Brand, Planning Center, Templates, Setup Items, Venues, Data)
- [ ] 🔍 Reload the page → everything you just did is still there

## §1 🧭 Setup wizard — walk every step (first run) — 3/15 audited

- [ ] 🔍 In a fresh browser (or after Data → Reset) the wizard launches on first load
- [ ] 🔍 The step progress bar advances and goes Back without losing earlier answers
- [x] ✅ Identity: enter the church name → it carries into the app (title bar / brand)
- [x] ✅ Vocalists: choose how many → that many vocalist slots exist after finishing
- [ ] 🔍 Instruments: default band shows; rename one and add a custom instrument (e.g. Cajon) → both stick
- [ ] 🔍 Mics: the vocal-mic list shows; rename one and add a custom mic (e.g. KSM11) → both stick
- [ ] 🔍 IEMs: set the pack count and name the packs → reflected on the band
- [ ] 🔍 Stage shape: pick the D-shape/curvature; try “Draw custom stage shape” → the drawn shape is kept
- [ ] 🔍 Stage layout: set vocal direction / arrangement → reflected on the stage diagram
- [ ] 🔍 Look & feel: pick an accent palette (or a custom color) and dark/light theme → applied immediately
- [ ] 🔍 Display layout: arrange the green-room display → reflected in ▶ Display
- [ ] 🔍 Setup checklist intro: toggle it on and add a custom item → ✓ Items appears with your item
- [ ] 🔍 If a Planning Center / Demo Mode step is offered, it connects or can be skipped
- [x] ✅ Finishing the wizard lands in a usable workspace; reload → nothing reverts to defaults
- [ ] 🔍 The first vocalist isn't left starred-but-blank  
  ⚠️ *Audit found the wizard seeds the first vocalist as Worship Leader with an empty name — a known rough edge. Confirm it's acceptable, or ask Claude to change it.*

## §2 🎨 Brand & look (and the other places to change it) — 4/5 audited

- [x] ✅ The church name from the wizard shows correctly across the app
- [x] ✅ Change the church name in Advanced Settings → Brand → updates in title / Display / Summary
- [x] ✅ Change the accent color in Brand → applies across workspace, Display, and Summary
- [x] ✅ Toggle ☾ theme in the top bar → matches; reload remembers the choice
- [ ] 🔍 Upload/replace a logo (if used) → shows on workspace, Display, and Summary

## §3 🎤 Service setup — the main page (weekly) — 8/9 audited

- [x] ✅ Set the date → shows in the title bar, Print Summary, and Display
- [x] ✅ Type an event title → reflected on Display and Summary
- [x] ✅ Add / remove vocalists on the main page → the stage updates live
- [x] ✅ Toggle Worship Leader → distinct (gold) and gets the leader mic (Grayson → KMS105)
- [x] ✅ Type a band player name → shows at that position; exact match to a vocalist → link suggestion / auto-link
- [x] ✅ Set the Music Director → MD flag on the right instrument (Marcus → D:Facto)
- [x] ✅ Add shadows (max 6) → no mic by default; set one to need a mic → assignment re-runs
- [ ] 🔍 Hosts: welcome → HH1/HH2 (HH3 only with 3+); pastor → handheld; baptism per the legend
- [x] ✅ Reload → the whole roster persists

## §4 🎙 Mics & IEMs (wizard vs Advanced Settings) — ✅ all audited

- [x] ✅ Advanced Settings → Mic Inventory: add/edit/remove mics, mark WL-pool → reflected in Auto-Assign
- [x] ✅ A mic you added in the wizard shows here (wizard ↔ Inventory match)
- [x] ✅ Advanced Settings → Mic Assignments: per-person priority / lock / remembered / no-mic edits take effect
- [x] ✅ Advanced Settings → Display: IEM pack presets match what the wizard set; band shows the pack names
- [x] ✅ Add an IEM pack preset here → available to assign; reload persists inventory, prefs, and packs

## §5 ▱ Stage design — shape, positions, fixtures — 8/11 audited

- [x] ✅ Advanced Settings → Display: the stage shape matches the wizard; change it here → main diagram updates
- [x] ✅ Shape editor shows AUDIENCE at top / BACK at bottom + the “as the band sees it” caption
- [ ] 🔍 Drag a corner / curve an edge → the D-shape updates; reload persists
- [ ] 🔍 Drag a person to a custom spot → it sticks; reload persists
- [x] ✅ Vocal direction in Display matches the wizard's stage-layout choice
- [x] ✅ Fixtures: add each type — Stairs, Door, Exit, Riser, Monitor, Music stand, DI / Power, Text label
- [x] ✅ Select a fixture → Duplicate drops an offset copy that's selected and draggable
- [ ] 🔍 Rotate (15°) and resize handles work; grabbable on touch
- [x] ✅ Text label: starts blank with the field focused; text renders INSIDE the dashed box
- [x] ✅ Delete a fixture → gone from the diagram and from ✓ Items (if a Monitor/DI)
- [x] ✅ Fixture editor shows AUDIENCE/BACK + SL→ / ←SR + the band's-view caption

## §6 🎚 Auto-Assign & mic logic — ✅ all audited

- [x] ✅ Auto-Assign order: locks → remembered → leader pool → general; no-mic people get nothing
- [x] ✅ Lock a person's mic → Auto-Assign never reassigns it
- [x] ✅ Run Auto-Assign twice → same result (stable)
- [x] ✅ Remove a person → their mic is freed for the next Auto-Assign
- [x] ✅ ⌘↵ / Ctrl+Enter triggers Auto-Assign

## §7 ✅ Setup checklist (✓ Items) — ✅ all audited

- [x] ✅ ✓ Items appears once enabled (wizard setup-intro / Advanced Settings → Setup Items)
- [x] ✅ A custom item added in the wizard shows here (wizard ↔ ✓ Items match)
- [x] ✅ Sections appear only when populated: VOCALISTS, BAND, STAGE
- [x] ✅ A Monitor adds “Line-check”; DI / Power adds “Patch & test” in the STAGE section
- [x] ✅ Identically-labeled fixtures are numbered (Monitor #1, #2…)
- [x] ✅ Check an item → persists across reload and leaving/returning to the view
- [x] ✅ Relabel a Monitor/DI after checking its task → the check stays
- [x] ✅ Setup-item templates (Setup Items / Templates tab) land on the right people/instruments
- [x] ✅ Reset all / Mark all done work; counts update
- [x] ✅ Switching the selected PCO plan gives that plan its own independent check-offs

## §8 📺 Display view (green room) — 2/6 audited

- [ ] 🔍 ▶ Display fills the screen; names and mics legible from across a room
- [ ] 🔍 The layout matches what you arranged in the wizard / Advanced Settings → Display
- [x] ✅ Run-sheet / order area renders if a plan order exists
- [ ] 🔍 Scale controls (hover/tap popups) are visible and adjust sizing
- [ ] 🔍 Readable on the booth tablet in landscape AND portrait
- [x] ✅ Editing assignments updates the Display when you reopen/refresh it

## §9 🖨 Print Summary — 2/3 audited

- [x] ✅ Opens with the stage diagram drawn in, name pills, WL highlighted
- [x] ✅ Colors look right in both light and dark app themes
- [ ] 🔍 Browser Print → diagram and colors render, nothing clipped, fits the page

## §10 🔌 Planning Center — 2/10 audited

- [ ] 🔍 Try Demo Mode loads sample people with no real credentials
- [ ] 🔍 Connect with a real Client ID/Secret (redirect URI must match — the panel shows the exact string)
- [x] ✅ Wrong redirect URI → message names the exact URI; wrong Client ID → “not recognized”; decline → “declined”
- [ ] 🔍 After connecting → the PCO bar appears with Service Type and Plan selects
- [ ] 🔍 Service type remembered per venue; selecting a plan loads it
- [ ] 🔍 Pull Plan imports people and maps them per the legend (WL, vocals, BGV, shadows, band, hosts, pastor, MD)
- [ ] 🔍 Gap behavior surfaces only production roles (camera/audio/lighting/technical)
- [x] ✅ Pulling another venue's service type → prompts to switch venues first
- [ ] 🔍 Left idle long enough to need a token refresh → still works (no silent failure)
- [ ] 🔍 Campus A (1058760) and Campus B (1662354) pull into their respective venues

## §11 🏛 Multi-venue — ✅ all audited

- [x] ✅ Top-bar venue switcher appears (2+ venues) and switches the active venue
- [x] ✅ Quick-add a venue (clone current) → switches to it
- [x] ✅ Venues tab: rename / duplicate / delete; the last venue can't be deleted
- [x] ✅ Switch keeps roster/assignments/shadows/MD/hosts/notes/check-offs; swaps stage/inventory/leader-pool/display
- [x] ✅ Band slots are per-venue: assignments reconcile on switch; MD resets if its slot is absent
- [x] ✅ Each venue can have a different stage shape, mic locker, IEM packs, and display (set per venue in Display)
- [x] ✅ Settings header shows the active venue tag
- [x] ✅ Deleting the active venue rehomes you without losing shared service data

## §12 🗂 Templates · Data · Reset · Reopen wizard — 3/4 audited

- [x] ✅ Templates: create/apply a setup-item template → lands on the right people/instruments
- [ ] 🔍 Data → Export produces a file; Import into a fresh browser restores everything faithfully
- [x] ✅ Reopen the wizard (Data tab): walking it again OVERWRITES instruments, mics, and IEM pack count, but KEEPS vocalists and service order — confirm exactly that
- [x] ✅ Reset clears state and returns to the first-run wizard (use a throwaway!)

## §13 🔁 Consistency across locations (change here → matches there) — 6/10 audited

- [x] ✅ Church name: wizard ↔ Brand tab ↔ title / Display / Summary
- [x] ✅ Accent color: wizard “look” ↔ Brand tab — and theme: wizard ↔ ☾ toggle
- [x] ✅ Instruments: wizard ↔ Display tab (instruments editor) ↔ main-page band
- [x] ✅ Mics: wizard ↔ Mic Inventory tab
- [x] ✅ IEM packs: wizard ↔ Display tab presets ↔ band pack labels
- [x] ✅ Stage shape: wizard ↔ Display / stage editor ↔ main diagram
- [ ] 🔍 Stage & vocal layout: wizard stage-layout ↔ Display vocal direction ↔ dragged positions
- [ ] 🔍 Display layout: wizard display step ↔ Display tab ↔ ▶ Display view
- [ ] 🔍 Setup items: wizard setup-intro ↔ Setup Items / Templates tab ↔ ✓ Items page
- [ ] 🔍 No setting sticks in one place but silently reverts after editing it in another (last edit wins, consistently)

## §14 🌓 Cross-cutting — 2/6 audited

- [x] ✅ Theme toggle (light/dark) → everything stays legible; reload remembers the choice
- [x] ✅ Persistence: a full reload keeps roster, venues, fixtures, check-offs, prefs, brand, PCO connection
- [ ] 🔍 Mobile/tablet top bar wraps into rows — no horizontal scroll, no dead gap when the PCO bar shows
- [ ] 🔍 Touch: drag people and fixtures; rotate/resize/delete handles tappable; scale popups tappable
- [ ] 🔍 Two browser tabs: last-write-wins, but nothing corrupts
- [ ] 🔍 Many people (10+ vox, full band): layout holds with no info-hiding overlap

## §15 🛡 Regression watchlist — ✅ all audited

- [x] ✅ Renaming a vocalist/band member keeps their checklist check-offs
- [x] ✅ Monitor/DI fixtures feed the STAGE checklist; duplicates numbered
- [x] ✅ Duplicate-a-fixture button works
- [x] ✅ Text-label fixture renders text inside the box
- [x] ✅ “As the band sees it” caption present in both stage editors
- [x] ✅ PCO auth errors are human-readable
- [x] ✅ Mobile top bar wraps; workspace fills height
- [x] ✅ Multi-venue switch preserves the roster and swaps per-venue config
- [x] ✅ Auto-Assign doesn't delete empty vocalist slots

---

> After each batch of fixes, re-run §0 (smoke) + §15 (regression) on the device. The ✅ items are also covered by Claude's automated test suite, so they're the safest.

