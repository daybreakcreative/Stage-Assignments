# SideStage (sidestage.pro) vs Stage·Assign — feature review

_Researched 2026-07-06 (headless render of the live marketing site: home, /display, /pricing).
Written for Dillon to review; we discuss what's worth adopting before building anything._

## What SideStage is

A **paid, cloud, account-based** SaaS built by a church production director, pitched narrowly at
the **backstage TV display** for production teams. Tagline: *"For the people behind the moment."*

- **Pricing:** $9/mo (1 campus, 1 display) · $29/mo (up to 5 campuses/displays) · **$199 hardware
  "Display Kit"** (plug-and-play HDMI box). No contracts.
- **Positioning:** *"Your volunteers deserve better than a wrinkled paper printout."* Named customers:
  Flatirons, Lakepointe, Sagebrush.
- **The whole product is the display** — a URL you point a backstage TV at (`sidestage.pro/display/<church>/main`),
  updated live from a laptop. Crew needs no login, no app — just the URL on a screen.

## Feature-by-feature

| Capability | SideStage | Stage·Assign (today) |
|---|---|---|
| Backstage TV display | ✅ core | ✅ (display view) |
| **Real-time push to any TV** (no shared machine) | ✅ *the whole pitch* | ❌ single-browser localStorage; TV must run the editing machine |
| **Headshots / people photos** on display | ✅ People Library | ❌ names/initials only |
| **Live countdown** to service time + glow alarm + idle screen | ✅ "Smart Countdown" | ❌ has service order, no countdown clock |
| **Recurring + one-time schedule** (auto-advancing) | ✅ | ⚠️ single service date (+ PCO pull), no recurring engine |
| Stage plot with name positions | ✅ | ✅ (richer: outline editor, features, drag) |
| Mic + pack number on display | ✅ | ✅ (+ IEM pack **conflict engine**) |
| **Multi-campus / multi-display** | ✅ (up to 5, per-venue URLs, one dashboard) | ⚠️ multi-venue model exists but UI hidden this release; single-machine |
| **Accounts / cloud / multi-device** | ✅ | ❌ local only |
| **Team roles + activity log** | ✅ ($29 tier) | ❌ |
| Hardware display kit | ✅ $199 | ❌ (n/a) |
| **Planning Center integration** | ❌ (own scheduling) | ✅ deep OAuth pull (plans, teams, songs) |
| **Auto mic assignment** (priority engine, leader-first, locks/prefs) | ❌ | ✅ |
| **Per-person setup checklists** (rig/cabling, MD/tracks) | ❌ | ✅ |
| **Print summary** (paper for stage techs) | ❌ (anti-paper pitch) | ✅ |
| Themes / visual moods | — | ✅ Aurora + moods |
| Price | $9–29/mo + $199 | **Free** |

## What SideStage does that Stage·Assign doesn't — the real gaps

1. **Real-time cloud → any TV.** Their entire reason to exist. Change on the laptop, the stage TV
   updates instantly with no refresh, no shared machine. This is exactly our long-standing
   **"green-room TV sync"** backlog gap. It's an **architectural** change for us — the app is a
   single static file with `localStorage`, no backend.
2. **Headshots on the display.** A People Library with photos so "anyone can run a mic check without
   asking." We show names/initials only.
3. **Live countdown + idle screen.** A big clock counting down to the next service (per-day times,
   custom "Band Load"/"Rehearsal" labels, edge-glow alarm at zero, idle screen when nothing's live).
4. **Recurring schedule engine.** Set weekend times once; it auto-advances to the next service.
5. **Crew-facing zero-login URL** + hardware kit — a productized display appliance.

## What Stage·Assign already does better (your edges)

- **Deep Planning Center integration** (they roll their own scheduling — no PCO).
- **Automatic mic assignment** + the **IEM pack conflict engine** we just built (they only *show*
  mic/pack numbers).
- **Per-person setup checklists** and **printable summary** for stage techs.
- **Free.** No subscription, no hardware lock-in.

## My recommendation (for our discussion)

Ranked by value × feasibility given the free/no-backend/single-file constraint:

- **🟢 Easy, high polish — do these:**
  - **Live countdown + idle screen on the display** (#3). Pure client-side, big "wow," low effort.
    Uses the service date/time you already have. Add custom labels + a zero alarm.
- **🟡 Feasible, worth weighing:**
  - **Headshots** (#2). Client-side is possible but photos bloat `localStorage`; works for a small
    team. Decide if it's worth the storage cost.
  - **Recurring schedule** (#4). Some overlap with PCO (which already gives the plan/date), so maybe
    lower priority for a PCO-connected church.
- **🔴 Architectural — needs a real decision:**
  - **Real-time TV push** (#1). The headline SideStage feature, and the one thing we structurally
    lack. Options range from a **read-only "display link" that encodes state in a URL** (shareable
    to a TV, but not *live*) up to a **small hosted store / backend** (live, but abandons the
    single-file, no-account, free model). This is the strategic fork: stay a free local tool, or
    grow a lightweight cloud sync.

**Bottom line:** SideStage is a polished paid product doing *one* thing (the live TV display) very
well. Stage·Assign is a deeper, free, PCO-native *assignment + setup* tool that happens to also have
a display. The cheap wins to borrow are the **countdown/idle screen** and maybe **headshots**; the
real strategic question is whether you want to chase their **live-TV-sync** moat — which means
picking up a backend.

## Sources
- https://www.sidestage.pro/ · /display · /pricing (rendered 2026-07-06)
