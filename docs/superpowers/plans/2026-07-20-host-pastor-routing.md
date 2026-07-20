# Host / Pastor Channel Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the PCO speaker/pastor to the channel labeled "Pastor" (else the first channel), the baptizing pastor to the last HH channel (else "HH 3"), and live hosts to the remaining channels — without changing classification, the default channels, or any UI.

**Architecture:** Two functions in the single `index.html`: the host-fill block in `applyPCOPlanData` and the merge/refresh `pcoAddHost`. Routing keys off channel **labels** (relabelable by the user); default channels stay generic HH 1–HH 4.

**Tech Stack:** Vanilla HTML/CSS/JS single file. jsdom tests in `tests/`. `npm run check` + `npm test` must be green (allow the known `curve.js` false-fail).

---

## Ground rules

- ONE file: `index.html`. **Re-grep before every edit** (line numbers drift). Never commit red. After edits run `npm run check` then `npm test`; `curve.js` is a KNOWN false-fail (ignore only that).
- No classification changes, no default-channel changes, no migration, no UI.

## File Structure

- **Modify `index.html`:** the host-fill block in `applyPCOPlanData` (`~8197-8213`); `pcoAddHost` (`~8577`).
- **Modify `tests/hostmics.js`:** add classification-lock + pastor-routing + pcoAddHost checks.
- **Modify docs:** `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`.

---

## Task 1: Pastor-label routing + baptism last-HH (applyPCOPlanData) + classification lock

**Files:**
- Modify: `index.html` (host-fill block in `applyPCOPlanData`)
- Test: `tests/hostmics.js`

- [ ] **Step 1: Add failing tests to `tests/hostmics.js`.** Insert these two checks immediately BEFORE the final `console.log('\n=== RESULT:` line (near the end of the file):

```js
 check('classify: Daybreak host positions map to the right kind', ()=>{
   const c = n => JSON.parse(ev(`JSON.stringify(classifyPosition(${JSON.stringify(n)}))`));
   if(c('Announcement Video Host').kind!=='ignore') throw new Error('Announcement Video Host should be ignore');
   if(c('Pre Service Communion').kind!=='ignore') throw new Error('Pre Service Communion should be ignore');
   if(c('Pre Service Prayer').kind!=='ignore') throw new Error('Pre Service Prayer should be ignore');
   const sp=c('Speaker'); if(sp.kind!=='host'||sp.host!=='speaker') throw new Error('Speaker should be host/speaker: '+JSON.stringify(sp));
   const wh=c('Welcome Host'); if(wh.kind!=='host'||wh.host!=='welcome') throw new Error('Welcome Host should be host/welcome: '+JSON.stringify(wh));
   const pb=c('Pastor Baptizing'); if(pb.kind!=='host'||pb.host!=='baptismal') throw new Error('Pastor Baptizing should be host/baptismal: '+JSON.stringify(pb));
 });

 check('pco: speaker → the "Pastor"-labelled channel; live hosts → HH; baptism → last HH', ()=>{
   ev('renderAll=function(){};saveState=function(){};toast=function(){};');
   ev('state.config.hostChannels=[{id:"h1",label:"Pastor",capsule:""},{id:"h2",label:"HH 1",capsule:""},{id:"h3",label:"HH 2",capsule:""},{id:"h4",label:"HH 3",capsule:""}]; state.hosts={};');
   const roster=JSON.stringify({data:[
     {id:'t1',attributes:{name:'Jeff Speaker',team_position_name:'Speaker',status:'C'}},
     {id:'t2',attributes:{name:'Logan Kelley',team_position_name:'Welcome Host',status:'C'}},
     {id:'t3',attributes:{name:'Second Host',team_position_name:'Welcome Host',status:'C'}},
     {id:'t4',attributes:{name:'Jeff Myers',team_position_name:'Pastor Baptizing',status:'C'}}
   ]});
   ev(`applyPCOPlanData({attributes:{}}, ${roster}, {data:[],included:[]})`);
   if(ev('state.hosts.h1')!=='Jeff Speaker') throw new Error('speaker should be on the Pastor channel h1, got '+ev('state.hosts.h1'));
   if(ev('state.hosts.h2')!=='Logan Kelley') throw new Error('first live host should be HH 1 (h2), got '+ev('state.hosts.h2'));
   if(ev('state.hosts.h3')!=='Second Host') throw new Error('second live host should be HH 2 (h3), got '+ev('state.hosts.h3'));
   if(ev('state.hosts.h4')!=='Jeff Myers') throw new Error('baptizing pastor should be on the last HH (h4), got '+ev('state.hosts.h4'));
 });
```

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/hostmics.js` → the routing check FAILS (today the speaker lands on h1 only because it's channel 0; relabeling doesn't matter, and welcome hosts don't line up as asserted). The classify check should already PASS (no classification change) — that's fine, it's a lock.

- [ ] **Step 3: Rewrite the host-fill block.** Grep for the anchor `const baptismCh = baptismalName` inside `applyPCOPlanData`. Replace the whole block `{ ... }` (from the `{` on the line before `const chs = hostChannels();` through its matching closing `}` — currently lines `~8197-8213`) with:

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

- [ ] **Step 4: Run the hostmics test, expect PASS.** `SA_HTML=index.html node tests/hostmics.js` → ALL CHECKS PASSED, including the existing "baptizing pastor is reserved to HH 3" check (default labels HH 1–4: pastorCh falls back to h1, baptismCh matches "HH 3"→h3, welcome hosts fill h2+h4 — unchanged) and the new routing check.

- [ ] **Step 5: Full suite.** `npm run check && npm test` → green (allow `curve.js`). Watch `pcomerge.js`, `pcoatomic.js`, `namealias.js` (they touch `state.hosts`) — they assert override/rename, not routing, so they should stay green; fix any real regression.

- [ ] **Step 6: Commit.**

```bash
git add index.html tests/hostmics.js
git commit -m "fix(pco): speaker → Pastor-labelled channel; baptism → last HH; classification lock"
```

---

## Task 2: `pcoAddHost` pastor-label routing + docs

**Files:**
- Modify: `index.html` (`pcoAddHost`)
- Test: `tests/hostmics.js`
- Modify: `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: Add a failing test.** In `tests/hostmics.js`, insert before the final `console.log('\n=== RESULT:` line:

```js
 check('pcoAddHost: a speaker add lands on the "Pastor"-labelled channel when free', ()=>{
   ev('state.config.hostChannels=[{id:"h1",label:"HH 1",capsule:""},{id:"h2",label:"Pastor",capsule:""},{id:"h3",label:"HH 2",capsule:""}]; state.hosts={};');
   ev(`pcoAddHost({name:'Rev Green', host:'speaker'})`);
   if(ev('state.hosts.h2')!=='Rev Green') throw new Error('speaker add should target the Pastor channel h2, got '+JSON.stringify(ev('JSON.stringify(state.hosts)')));
   if(ev('state.hosts.h1')) throw new Error('speaker should NOT land on h1 when a Pastor channel exists');
 });
```

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/hostmics.js` → FAIL (current `pcoAddHost` puts a speaker on `channels[0]` = h1, not the Pastor-labeled h2).

- [ ] **Step 3: Rewrite `pcoAddHost`.** Grep for `function pcoAddHost(p) {`. Replace the whole function with:

```js
function pcoAddHost(p) {
  const channels = hostChannels();
  const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
  const isFree = id => !((state.hosts[id] || '').trim());
  // Speaker/pastor prefers the channel labelled "Pastor" (else channel 0); otherwise first free.
  if (p.host === 'speaker') {
    const pastorCh = channels.find(ch => norm(ch.label).includes('pastor')) || channels[0];
    if (pastorCh && isFree(pastorCh.id)) { state.hosts[pastorCh.id] = p.name; return; }
  }
  const free = channels.find(ch => isFree(ch.id));
  if (free) state.hosts[free.id] = p.name;
}
```

- [ ] **Step 4: Run the hostmics test, expect PASS.** `SA_HTML=index.html node tests/hostmics.js` → ALL CHECKS PASSED.

- [ ] **Step 5: Full suite.** `npm run check && npm test` → green (allow `curve.js`).

- [ ] **Step 6: Add a WATCHLIST entry.** In `docs/WATCHLIST.md`, append the next number after the current highest (it should be 39 → use 40; adjust if different) under "Recently shipped", and bump the "items 23–NN"/"items 1–NN" header counts:

```markdown
40. **Host/pastor channel routing.** On a PCO pull the speaker/pastor lands on the channel whose
    label contains "Pastor" (else the first channel); the baptizing pastor takes the "HH 3" channel
    or the last channel (never the pastor channel); live/welcome hosts fill the rest in order.
    Positions with "video"/"communion"/"pre service prayer" stay ignored. Same pastor-target in
    `pcoAddHost`. Default channels remain the relabelable HH 1–HH 4. (`applyPCOPlanData`,
    `pcoAddHost`; `tests/hostmics.js`.)
```

- [ ] **Step 7: Mark it in the backlog.** In `docs/StageAssign_Backlog.md`, find the `**[FEATURE] Fix PCO host/pastor assignment.**` bullet and replace it with:

```markdown
- ~~**[FEATURE] Fix PCO host/pastor assignment.**~~ ✅ SHIPPED 2026-07-20 → `hostmics`. Speaker/
  pastor → the "Pastor"-labelled channel; live hosts → HH channels; baptizing pastor → last HH;
  video/communion/prayer positions ignored. Default channels stay relabelable HH 1–HH 4.
```

- [ ] **Step 8: Final validation.** `npm run check && npm test` → green.

- [ ] **Step 9: Commit.**

```bash
git add index.html tests/hostmics.js docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "fix(pco): pcoAddHost targets Pastor channel; record host-routing shipped"
```

---

## Definition of done

- `npm run check` + `npm test` green (only `curve.js` false-fail).
- Booth checklist for Dillon: with host channels labeled `Pastor, HH 1, HH 2, HH 3`, pull a plan → the Speaker appears on **Pastor**, Welcome Host(s) on **HH 1/HH 2…**, the Pastor Baptizing on **HH 3**, and Announcement Video Host / Pre Service Communion / Pre Service Prayer get **no** mic and don't appear as hosts.
- Do NOT `git push` until Dillon confirms (deploy = push).

---

## Self-review notes (author)

- **Spec coverage:** pastor-label routing → Task 1; baptism last-HH → Task 1; welcome fill → Task 1; classification lock → Task 1; `pcoAddHost` → Task 2; docs → Task 2. Default-labels fallback verified by the existing baptism test staying green (Task 1 step 4). All spec sections mapped.
- **Placeholder scan:** none. WATCHLIST number "40" flagged to adjust if the current highest differs.
- **Type consistency:** `norm`, `pastorCh`, `baptismCh`, `taken`, `queue` used consistently; `state.hosts` remains a channel-id→name map; no new state keys.
- **Regression guard:** default-label case (no "Pastor" channel) → `pastorCh` falls back to `chs[0]`, reproducing today's speaker→channel-0 behavior, so `pcomerge`/`pcoatomic`/`namealias`/existing baptism test are unaffected.
