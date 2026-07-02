# Booth smoke test — verify today's changes

Run on the live app (`daybreakcreative.github.io/Stage-Assignments/`) after it rebuilds.
Work top-down; report any ❌ (and what you saw). Ideally test with a real PCO pull.

## P0 — most likely to be broken / visual (test these first)

- [ ] **Print → PDF.** Open Print Summary → Print → Save as PDF (8.5×11). **Expected:** the summary (stage diagram, band/vocalists/hosts, service order) renders — NOT a blank page. _(If still blank, tell me — I'll switch to a dedicated print window.)_
- [ ] **Display exit.** Enter Display view → find the **"✕ Exit"** button (top-right) → click it → returns to setup. Also try **Esc** → exits. **Expected:** both work; the button clearly says Exit (not a gear).
- [ ] **Display section scalers.** In Display view, hover each section — **Title, Stage, Vocal cards, Service order** — a small resize tab should appear on hover (hidden otherwise) and open a size slider. Change each; text scales, no upper/lower limit. **Expected:** all four have their own scaler; hidden until hover.
- [ ] **No TV/Computer mode** anywhere in Settings → Display (removed).
- [ ] **Stage drag placement.** In Edit Layout, drag a vocalist/band member off the stage outline — **Expected:** allowed (not snapped back inside).

## P1 — Mics (big restructure)

- [ ] Settings has **one "Mics" tab** (no separate "Mic Assignments"); it shows the ranked inventory + a per-person table.
- [ ] **No "Leader Mics"** section; **no "No mic"** option anywhere.
- [ ] The per-person table header reads **"Preferred Mic"** (not "Mic Now").
- [ ] Priority text reads: song leaders → remembered mic, then locked mic, then best available.
- [ ] **Auto-Assign** (⌘↵ or after a pull): worship leaders keep their usual mic; locked people keep locked; others fill down the ranked list. No top-right Auto-Assign button (removed).

## P1 — Setup Items

- [ ] Settings → **Setup Items**: people listed by **specific instrument / Vocals / MD** (a Keys+EG+vocals+MD person appears multiple times), no **"REMOVED INSTRUMENT"** label.
- [ ] The **✓ Items** view (day-of): shows each person's grouped setup; the **MD** shows MD setup; no false **"No setup items configured"** when items exist.
- [ ] Someone scheduled on the current plan shows an on-plan indicator.

## P1 — Post-pull notifications (do a PCO pull)

- [ ] New **vocalist** popup: has a **Name / goes-by** field, grouped **Vocals** setup (mic stand, music stand), and **NO "No mic"** option.
- [ ] New **on-instrument** popup: grouped setup for that instrument, church defaults pre-checked (brings own rig / house rig / etc.).
- [ ] **Preferred name:** set "Catherine" → "Cat" in the popup (or on the card); it shows everywhere; pull again → still "Cat" and not re-prompted.

## P1 — Shadows

- [ ] Schedule a shadow → the shadow step **always asks which IEM pack**; a shadow vocalist can be on-mic/on-stage or off; an on-stage-playing instrument shadow gets setup items. No enable/disable setting (always on).

## P2 — Wizard (re-run it: Settings → Data → re-run wizard, or fresh)

- [ ] **"Look & feel"** step loads without issue (font preview works) — this was crashing.
- [ ] Church-name step: **Enter** advances (not just the Next button).
- [ ] **IEMs** step has a **Yes/Skip** toggle and comes near the END (after Display), before Setup.
- [ ] Two distinct stage steps: **"Stage shape & size"** then **"Place your team on stage."**
- [ ] Per-instrument setup step: each instrument card lets you tick default items **+ add a custom item**.
- [ ] **"Reset shape to defaults"** clears a custom shape in one click; no separate "Remove custom shape" button.
- [ ] **Edit stage outline** starts from your current curve/depth shape (not a generic "house").

## P2 — Settings & misc

- [ ] **Planning Center** is the **far-right** settings tab.
- [ ] Clicking **outside** Advanced Settings does NOT close it (must use ✕).
- [ ] Display view does **not** highlight worship leaders.
- [ ] Empty optional band slots (Electric 2, Acoustic) are hidden with a **"+ Add"** chip until needed; a pull auto-fills them.
- [ ] **Keys** auto-places to **far stage right** (SR).
- [ ] In Edit Layout, **"Edit Outline or Features"** opens Advanced Settings → Display.

---
_Report ❌s with a quick note of what you saw; I'll fix and redeploy._
