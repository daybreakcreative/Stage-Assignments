# Host / pastor channel routing — design

**Date:** 2026-07-20
**Status:** Approved (design), pending build
**File:** `index.html` (the host-fill block in `applyPCOPlanData`; `pcoAddHost`) + `tests/hostmics.js`

## Problem / goal

On a PCO pull, the speaker/pastor should land on the channel labeled **"Pastor"**, live hosts should
fill the **HH** channels, and the baptizing pastor should take the **last HH**. Today the speaker is
placed positionally in channel 0 (whatever its label), and baptism falls back to the 3rd channel.
Classification is already correct for Daybreak's positions — only the channel **routing** is wrong.

## Verified (no change needed): classification

`classifyPosition` already returns the right `kind` for every Daybreak host position (confirmed
against the exact PCO names):

| PCO `team_position_name` | classify → | intended channel |
|---|---|---|
| Announcement Video Host | `ignore` (contains "video") | none |
| Pre Service Communion | `ignore` (contains "communion") | none |
| Pre Service Prayer | `ignore` (contains "pre service prayer") | none |
| Speaker | `host: 'speaker'` | Pastor |
| Welcome Host | `host: 'welcome'` | HH1 (first free HH) |
| Pastor Baptizing | `host: 'baptismal'` (exact `n === 'pastor baptizing'`) | last HH |

Ordering is safe: the `baptism`/`video`/`communion`/`pre service prayer` ignore checks and the exact
`pastor baptizing` baptismal check all run before the generic `pastor`→speaker and `host`→welcome
branches. No classification edits; a test will lock these six names.

## Default host channels: unchanged

`DEFAULT_HOST_CHANNELS()` stays four generic channels **HH 1 … HH 4** (relabelable in Advanced
Settings). No migration — Daybreak relabels to `Pastor, HH 1, HH 2, HH 3` themselves, and routing
keys off the labels. Adding/removing channels ("+ Add host mic") continues to work.

## Design — routing in `applyPCOPlanData`

Replace the current host-fill block (the one building `baptismCh`/`queue`/`state.hosts`, currently
`~index.html:8197-8213`). New logic:

```js
{
  const chs = hostChannels();
  const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
  // Pastor/speaker → a channel labelled "Pastor" (else the first channel).
  const pastorCh = speakerName ? (chs.find(ch => norm(ch.label).includes('pastor')) || chs[0] || null) : null;
  // Baptizing pastor → a channel labelled "HH 3" (else the LAST channel, never the pastor channel).
  let baptismCh = null;
  if (baptismalName) {
    baptismCh = chs.find(ch => norm(ch.label) === 'hh3')
      || [...chs].reverse().find(ch => !pastorCh || ch.id !== pastorCh.id)
      || null;
    if (pastorCh && baptismCh && baptismCh.id === pastorCh.id) baptismCh = null; // collision guard
  }
  state.hosts = {};
  if (pastorCh && speakerName) state.hosts[pastorCh.id] = speakerName;
  if (baptismCh && baptismalName) state.hosts[baptismCh.id] = baptismalName;
  // Live/welcome hosts fill the remaining channels in order; then any un-placed speaker/baptismal.
  const taken = new Set([pastorCh && pastorCh.id, baptismCh && baptismCh.id].filter(Boolean));
  const queue = welcomeNames.slice();
  if (speakerName && !pastorCh) queue.push(speakerName);
  if (baptismalName && !baptismCh) queue.push(baptismalName);
  let qi = 0;
  chs.forEach(ch => {
    if (taken.has(ch.id)) return;
    if (qi < queue.length) state.hosts[ch.id] = queue[qi++];
  });
}
```

Behavior:
- **Pastor** on the "Pastor"-labeled channel (fallback: first channel — matches today's behavior when
  no channel is relabeled, so existing default-label saves are unaffected).
- **Baptism** on "HH 3" if present, else the last channel (excluding the pastor channel), never
  colliding with the pastor channel.
- **Welcome/live hosts** fill the rest in PCO order.
- Extra people beyond the channel count are dropped (unchanged).

## Design — routing in `pcoAddHost` (merge/refresh single-add)

`pcoAddHost(p)` (`~index.html:8577`) currently puts `host:'speaker'` in channel 0. Update it to
target the "Pastor"-labeled channel first:

```js
function pcoAddHost(p) {
  const channels = hostChannels();
  const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
  const isFree = id => !((state.hosts[id] || '').trim());
  if (p.host === 'speaker') {
    const pastorCh = channels.find(ch => norm(ch.label).includes('pastor')) || channels[0];
    if (pastorCh && isFree(pastorCh.id)) { state.hosts[pastorCh.id] = p.name; return; }
  }
  const free = channels.find(ch => isFree(ch.id));
  if (free) state.hosts[free.id] = p.name;
}
```

(Baptismal single-adds are rare on refresh; they fall through to the first free channel as today.)

## Testing (`tests/hostmics.js`)

Extend the existing suite:

1. **Classification lock** — `classifyPosition` returns: `Announcement Video Host`→`ignore`,
   `Pre Service Communion`→`ignore`, `Pre Service Prayer`→`ignore`, `Speaker`→`host/speaker`,
   `Welcome Host`→`host/welcome`, `Pastor Baptizing`→`host/baptismal`.
2. **Pastor-label routing** — with channels relabeled `['Pastor','HH 1','HH 2','HH 3']` and a plan
   whose team members include `Speaker`=X, `Welcome Host`=Y (and Z), `Pastor Baptizing`=W: after the
   pull, X is on the Pastor channel, Y on HH 1, and W on HH 3 (the last / "HH 3" channel). Drive it
   via the same `applyPCOPlanData`/demo path the existing baptism test uses.
3. **Default-labels fallback** — with the default `['HH 1','HH 2','HH 3','HH 4']` (no "Pastor"
   label), the speaker still lands on channel 0 (`h1`) — i.e. the existing baptism-placement test
   keeps passing unchanged (speaker→h1, welcome→h2+h4, baptism→h3 via the "HH 3" label).
4. `pcoAddHost`: a `host:'speaker'` add lands on the "Pastor"-labeled channel when present/free.

Full `npm run check` + `npm test` green (allow `curve.js`).

## Scope / non-goals

- No classification changes; no default-channel or migration changes.
- No new UI. Host channels remain user-relabelable in Advanced Settings.
- The baptism fallback changes from "3rd channel" to "last channel" only when there is no channel
  labeled "HH 3" (Daybreak's HH 3 is the last channel, so no visible change for them).
