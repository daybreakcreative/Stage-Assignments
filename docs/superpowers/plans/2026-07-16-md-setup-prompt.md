# MD Setup Prompt on the Post-Pull Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a service is pulled, a person who is on an instrument **and** is the Music Director is asked for both their instrument setup and their MD setup on the same post-pull card; a player promoted to MD is asked for MD setup even if already set up on their instrument.

**Architecture:** Single-file vanilla app (`index.html`). Add MD as a second setup section on the existing `pref-band` post-pull card, bound to the EXISTING MD bucket `stableSetupKey(name,'md','md')` (the same key `getStageAreas`/`enumerateSetupRoles` already use, so edits round-trip to the ✓ Items page). Three edit sites — step building (`buildPostPullSteps`), rendering (`renderPostPullStep`), saving (`savePostPullStep`) — plus a new jsdom test file.

**Tech Stack:** HTML/CSS/JS, `localStorage` state, jsdom regression tests via `npm test`, `npm run check` for syntax/CSS.

**Reference spec:** `docs/superpowers/specs/2026-07-16-md-setup-prompt-design.md`

**Golden rules (from CLAUDE.md):** ONE file. Re-grep anchors before each edit (line numbers drift). Never ship until `npm run check` AND `npm test` are green (allowing the known `curve.js` false-fail). Do not push without confirming with Dillon.

---

## File Structure

- **Modify:** `index.html`
  - `buildPostPullSteps` band loop (currently ~line 10820) — compute MD flags, attach to the `pref-band` step.
  - `renderPostPullStep` `pref-band` branch (currently ~line 11162) — adaptive header + conditional instrument/MD sections.
  - `savePostPullStep` `pref-band` branch (currently ~line 11281) — mark instrument and/or MD prefs asked.
- **Create:** `tests/mdpostpull.js` — jsdom coverage for step-building, render, and save/dedup.
  (NOTE: `tests/mdpostpull.js` already exists and covers the items-layer MD bucket — leave it untouched.)
- **Modify:** `docs/WATCHLIST.md` — add a behavior line.

---

## Task 1: Step-building logic in `buildPostPullSteps`

**Files:**
- Test: `tests/mdpostpull.js` (create)
- Modify: `index.html` — `buildPostPullSteps` band loop (re-grep anchor: `const role = roleTagFromInstLabel(inst.label);` inside `state.instruments.forEach`)

- [ ] **Step 1: Write the failing test** — create `tests/mdpostpull.js`:

```javascript
// FEATURE: post-pull popup asks a band member who is ALSO the Music Director for both their
// instrument setup and their MD setup on one card (buildPostPullSteps + renderPostPullStep +
// savePostPullStep). Spec: docs/superpowers/specs/2026-07-16-md-setup-prompt-design.md
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// Reset to a clean roster with a single band instrument. `mdOn` => that instrument is the MD.
// prefs => a musicianPreferences object (already-asked markers). Returns the pref-band step
// for the person, or null.
function bandStep(instLabel, mdOn, prefs){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
 ev(`state.vocalists=[]; state.assignments=[]; state.shadows=[];`);
 ev(`state.instruments=[{id:'inst_x',label:${JSON.stringify(instLabel)},assignedTo:'Sophia Martinez'}];`);
 ev(`state.musicDirectorId=${mdOn?"'inst_x'":'null'};`);
 ev(`state.musicianPreferences=${JSON.stringify(prefs||{})};`);
 const steps=JSON.parse(ev(`JSON.stringify(buildPostPullSteps(null))`));
 return steps.find(s=>s.kind==='pref-band'&&s.personName==='Sophia Martinez')||null;
}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};');

 check('function exists', ()=>{ if(ev('typeof buildPostPullSteps')!=='function') throw new Error('not a function'); });

 check('MD + new on instrument -> one card asking BOTH sections', ()=>{
   const s=bandStep('Bass', true, {});
   if(!s) throw new Error('no pref-band step');
   if(s.showInstrument!==true) throw new Error('showInstrument should be true');
   if(s.showMD!==true) throw new Error('showMD should be true');
   if(s.isMD!==true) throw new Error('isMD should be true');
   if(!/\\|md$/.test(s.mdPrefKey)) throw new Error('mdPrefKey should end in |md: '+s.mdPrefKey);
 });

 check('promoted player (instrument known, newly MD) -> MD-only card', ()=>{
   const s=bandStep('Bass', true, {'sophia martinez|bass':{askedAt:'x'}});
   if(!s) throw new Error('expected an MD-only step, got none');
   if(s.showInstrument!==false) throw new Error('showInstrument should be false');
   if(s.showMD!==true) throw new Error('showMD should be true');
 });

 check('both prefs already known -> no step', ()=>{
   const s=bandStep('Bass', true, {'sophia martinez|bass':{askedAt:'x'},'sophia martinez|md':{askedAt:'x'}});
   if(s) throw new Error('should produce no step, got '+JSON.stringify(s));
 });

 check('non-MD band player -> no MD section', ()=>{
   const s=bandStep('Bass', false, {});
   if(!s) throw new Error('no pref-band step');
   if(s.showMD!==false) throw new Error('showMD should be false for non-MD');
   if(s.isMD!==false) throw new Error('isMD should be false');
 });

 check('MD whose instrument IS the MD/tracks preset -> no duplicate MD section', ()=>{
   const s=bandStep('Tracks', true, {});   // detectPresetKey('Tracks') === 'md'
   if(!s) throw new Error('no pref-band step');
   if(s.isMD!==true) throw new Error('isMD should be true');
   if(s.showMD!==false) throw new Error('showMD should be false (instrument already IS md)');
   if(s.showInstrument!==true) throw new Error('showInstrument should be true');
 });

 console.log('\\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\\n'));
 process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "$HOME/Documents/03_Claude/Projects/Stage Assign App" && node tests/mdpostpull.js`
Expected: FAIL — the "MD + new on instrument" check fails with "showMD should be true" (current step has no `showMD`/`isMD` fields, so `s.showMD` is `undefined`).

- [ ] **Step 3: Implement the step-building change**

Re-grep the anchor first: `grep -n "const role = roleTagFromInstLabel(inst.label);" index.html`. Replace the current band-loop body:

```javascript
  state.instruments.forEach(inst => {
    const name = (inst.assignedTo || '').trim();
    if (!name) return;
    if (inst.vocalistPlayer) return;
    const nName = normFullName(name);
    const role = roleTagFromInstLabel(inst.label);
    const prefKey = `${nName}|${role}`;
    if (state.musicianPreferences[prefKey]) return;
    if (seen.has(prefKey)) return;
    seen.add(prefKey);
    steps.push({
      kind: 'pref-band',
      personName: name,
      instLabel: inst.label,
      instId: inst.id,
      prefKey
    });
  });
```

with:

```javascript
  state.instruments.forEach(inst => {
    const name = (inst.assignedTo || '').trim();
    if (!name) return;
    if (inst.vocalistPlayer) return;
    const nName = normFullName(name);
    const role = roleTagFromInstLabel(inst.label);
    const prefKey = `${nName}|${role}`;
    const isMD = state.musicDirectorId === inst.id;
    const instIsMdType = detectPresetKey(inst) === 'md';
    const mdPrefKey = `${nName}|md`;
    const instKnown = !!state.musicianPreferences[prefKey];
    const mdMissing = isMD && !state.musicianPreferences[mdPrefKey];
    // The MD role has its own setup ("Music Director / Tracks"). Show it as a SECOND section on
    // this person's card — unless the instrument itself IS the MD/tracks preset, in which case
    // its own section already covers MD (don't render a duplicate over the same bucket).
    const showMD = mdMissing && !instIsMdType;
    if (instKnown && !mdMissing) return; // nothing new to ask
    if (seen.has(prefKey)) return;
    seen.add(prefKey);
    steps.push({
      kind: 'pref-band',
      personName: name,
      instLabel: inst.label,
      instId: inst.id,
      prefKey,
      showInstrument: !instKnown,
      isMD,
      showMD,
      mdPrefKey
    });
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/mdpostpull.js`
Expected: PASS — all five checks OK, `=== RESULT: ALL CHECKS PASSED ===`.

- [ ] **Step 5: Commit**

```bash
git add tests/mdpostpull.js index.html
git commit -m "feat(setup): flag MD on the post-pull band step

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Render the MD section on the card

**Files:**
- Test: `tests/mdpostpull.js` (add render checks)
- Modify: `index.html` — `renderPostPullStep` `pref-band` branch (re-grep anchor: `<div class="pp-step-person-tag">New on ${esc(step.instLabel)}</div>`)

- [ ] **Step 1: Add failing render checks** — insert these checks into `tests/mdpostpull.js` immediately before the `console.log('\n=== RESULT:'...)` line:

```javascript
 // ---- render: the card shows the right sections ----
 // Render a pref-band step directly by seeding postPullState, then inspect #postPullContent.
 function renderBandStep(step){
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}];`);
   ev(`postPullState={steps:[${JSON.stringify(step)}],idx:0,onClose:null};`);
   ev(`renderPostPullStep();`);
 }

 check('render: MD + new instrument shows BOTH editors', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   if(!doc.querySelector('#pp_setup_editor')) throw new Error('instrument editor missing');
   const md=doc.querySelector('#pp_md_setup_editor');
   if(!md) throw new Error('MD editor container missing');
   if(md.children.length===0) throw new Error('MD editor not populated');
 });

 check('render: non-MD player shows NO MD editor', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:false,showMD:false,mdPrefKey:'sophia martinez|md'});
   if(!doc.querySelector('#pp_setup_editor')) throw new Error('instrument editor missing');
   if(doc.querySelector('#pp_md_setup_editor')) throw new Error('MD editor should NOT be present');
 });

 check('render: MD-only card shows MD editor, no instrument editor', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:false,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   if(doc.querySelector('#pp_setup_editor')) throw new Error('instrument editor should NOT be present');
   if(!doc.querySelector('#pp_md_setup_editor')) throw new Error('MD editor missing');
 });
```

- [ ] **Step 2: Run the test to verify the new checks fail**

Run: `node tests/mdpostpull.js`
Expected: FAIL — "render: MD + new instrument shows BOTH editors" fails with "MD editor container missing" (current render only emits `#pp_setup_editor`).

- [ ] **Step 3: Implement the render change**

Re-grep the anchor, then replace the entire current `pref-band` render branch:

```javascript
  } else if (step.kind === 'pref-band') {
    content.innerHTML = `
      <div class="pp-step-person-tag">New on ${esc(step.instLabel)}</div>
      <h2 class="pp-step-title">${esc(step.personName)}</h2>
      <p class="pp-step-sub">First time seeing ${esc(firstName(step.personName))} on ${esc(step.instLabel)}. Select their setup — your defaults are pre-checked. Tick what they need (e.g. brings their own rig, needs the house rig) and add anything custom. These become checklist items on the ✓ Items page.</p>
      <div class="pp-row">
        <div class="pp-row-label">Name (what they go by)</div>
        <input type="text" id="pp_name" value="${esc(step.personName)}" />
      </div>
      <div class="pp-row">
        <div class="pp-row-label">Setup for ${esc(step.instLabel)}</div>
        <div id="pp_setup_editor"></div>
      </div>
    `;
    // Grouped per-instrument setup, seeded from the church's wizard defaults.
    const spEd = content.querySelector('#pp_setup_editor');
    if (spEd) {
      const typeKey = detectPresetKey(instById(step.instId)) || null;
      renderPersonSetupEditor(spEd, stableSetupKey(step.personName, 'band', typeKey), typeKey);
    }
  } else if (step.kind === 'shadow') {
```

with:

```javascript
  } else if (step.kind === 'pref-band') {
    const showInstrument = step.showInstrument !== false; // default true (legacy steps)
    const showMD = !!step.showMD;
    // Header + subtitle adapt to what this card is actually asking for.
    let tag, sub;
    if (showInstrument && showMD) {
      tag = `New on ${esc(step.instLabel)} · MD`;
      sub = `First time seeing ${esc(firstName(step.personName))} on ${esc(step.instLabel)} — and they're the Music Director. Set their instrument setup and what the MD role needs. These become checklist items on the ✓ Items page.`;
    } else if (showMD) {
      tag = `Now Music Director`;
      sub = `${esc(firstName(step.personName))} is the Music Director this week. Set what the MD role needs — these become checklist items on the ✓ Items page.`;
    } else {
      tag = `New on ${esc(step.instLabel)}`;
      sub = `First time seeing ${esc(firstName(step.personName))} on ${esc(step.instLabel)}. Select their setup — your defaults are pre-checked. Tick what they need (e.g. brings their own rig, needs the house rig) and add anything custom. These become checklist items on the ✓ Items page.`;
    }
    const instSection = showInstrument ? `
      <div class="pp-row">
        <div class="pp-row-label">Setup for ${esc(step.instLabel)}</div>
        <div id="pp_setup_editor"></div>
      </div>` : '';
    const mdSection = showMD ? `
      <div class="pp-row">
        <div class="pp-row-label">Setup as Music Director</div>
        <div id="pp_md_setup_editor"></div>
      </div>` : '';
    content.innerHTML = `
      <div class="pp-step-person-tag">${tag}</div>
      <h2 class="pp-step-title">${esc(step.personName)}</h2>
      <p class="pp-step-sub">${sub}</p>
      <div class="pp-row">
        <div class="pp-row-label">Name (what they go by)</div>
        <input type="text" id="pp_name" value="${esc(step.personName)}" />
      </div>
      ${instSection}
      ${mdSection}
    `;
    // Grouped per-instrument setup, seeded from the church's wizard defaults.
    if (showInstrument) {
      const spEd = content.querySelector('#pp_setup_editor');
      if (spEd) {
        const typeKey = detectPresetKey(instById(step.instId)) || null;
        renderPersonSetupEditor(spEd, stableSetupKey(step.personName, 'band', typeKey), typeKey);
      }
    }
    // The MD role's own setup bucket, shown as a second section on the same card.
    if (showMD) {
      const mdEd = content.querySelector('#pp_md_setup_editor');
      if (mdEd) renderPersonSetupEditor(mdEd, stableSetupKey(step.personName, 'md', 'md'), 'md');
    }
  } else if (step.kind === 'shadow') {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/mdpostpull.js`
Expected: PASS — all checks OK.

- [ ] **Step 5: Commit**

```bash
git add tests/mdpostpull.js index.html
git commit -m "feat(setup): render MD setup section on the post-pull card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Save/dedup the MD pref on advance

**Files:**
- Test: `tests/mdpostpull.js` (add save checks)
- Modify: `index.html` — `savePostPullStep` `pref-band` branch (re-grep anchor: `// just record that we've asked so this person isn't prompted again.`)

- [ ] **Step 1: Add failing save checks** — insert into `tests/mdpostpull.js` immediately before the `console.log('\n=== RESULT:'...)` line:

```javascript
 // ---- save: advancing marks both prefs asked so neither re-prompts ----
 function saveBandStep(step){
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}];`);
   ev(`state.musicianPreferences={};`);
   ev(`postPullState={steps:[${JSON.stringify(step)}],idx:0,onClose:null};`);
   ev(`renderPostPullStep(); savePostPullStep();`);
   return JSON.parse(ev(`JSON.stringify(state.musicianPreferences)`));
 }

 check('save: MD + new instrument marks BOTH instrument and md asked', ()=>{
   const prefs=saveBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   if(!prefs['sophia martinez|bass']) throw new Error('instrument pref not marked');
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked');
 });

 check('save: MD whose instrument IS md-type still marks md asked (isMD, not showMD)', ()=>{
   const prefs=saveBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Tracks',instId:'inst_x',prefKey:'sophia martinez|tracks',showInstrument:true,isMD:true,showMD:false,mdPrefKey:'sophia martinez|md'});
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked when instrument is md-type');
 });

 check('save: MD-only card does NOT overwrite the known instrument pref', ()=>{
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}];`);
   ev(`state.musicianPreferences={'sophia martinez|bass':{askedAt:'ORIGINAL'}};`);
   ev(`postPullState={steps:[${JSON.stringify({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:false,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'})}],idx:0,onClose:null};`);
   ev(`renderPostPullStep(); savePostPullStep();`);
   const prefs=JSON.parse(ev(`JSON.stringify(state.musicianPreferences)`));
   if(prefs['sophia martinez|bass'].askedAt!=='ORIGINAL') throw new Error('instrument pref was overwritten');
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked');
 });
```

- [ ] **Step 2: Run the test to verify the new checks fail**

Run: `node tests/mdpostpull.js`
Expected: FAIL — "save: MD + new instrument marks BOTH..." fails with "md pref not marked" (current save writes only `step.prefKey`).

- [ ] **Step 3: Implement the save change**

Re-grep the anchor, then replace the current `pref-band` save branch:

```javascript
  } else if (step.kind === 'pref-band') {
    // Setup selections are saved live by the grouped editor into the person's stable bucket;
    // just record that we've asked so this person isn't prompted again.
    state.musicianPreferences[step.prefKey] = {
      askedAt: new Date().toISOString()
    };
  } else if (step.kind === 'shadow') {
```

with:

```javascript
  } else if (step.kind === 'pref-band') {
    // Setup selections are saved live by the grouped editor into each person's stable bucket;
    // just record that we've asked so this person isn't prompted again.
    // Only mark the instrument pref when the instrument section was actually shown, so an
    // MD-only card doesn't stamp (or overwrite) an instrument pref we never asked about.
    if (step.showInstrument !== false) {
      state.musicianPreferences[step.prefKey] = { askedAt: new Date().toISOString() };
    }
    // If they're the MD, mark the MD prefs asked too. Keyed on isMD (not showMD) so it also
    // covers an MD whose instrument is itself the MD/tracks preset. Recompute the key from the
    // current (possibly renamed) name so it matches the next pull's lookup.
    if (step.isMD) {
      state.musicianPreferences[`${normFullName(step.personName)}|md`] = { askedAt: new Date().toISOString() };
    }
  } else if (step.kind === 'shadow') {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/mdpostpull.js`
Expected: PASS — all checks OK, `=== RESULT: ALL CHECKS PASSED ===`.

- [ ] **Step 5: Commit**

```bash
git add tests/mdpostpull.js index.html
git commit -m "feat(setup): mark instrument + MD prefs asked on advance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Watchlist + full suite verification

**Files:**
- Modify: `docs/WATCHLIST.md`

- [ ] **Step 1: Add a watchlist line**

Open `docs/WATCHLIST.md`, find the last numbered item (items 1–33), and add the next-numbered item:

```markdown
- [ ] A person on an instrument who is also the MD is asked for BOTH instrument and MD setup on
      the same post-pull card; a player promoted to MD is asked for MD setup even if already set
      up on their instrument; the MD section never duplicates when the instrument itself is the
      MD/tracks preset. → `mdsetup.js`
```

- [ ] **Step 2: Run the syntax/CSS check**

Run: `npm run check`
Expected: `JS syntax OK; CSS balanced (...)`.

- [ ] **Step 3: Run the full regression suite**

Run: `npm test`
Expected: `SUITE GREEN` — 0 real failures (the only allowed non-pass is the known `curve.js` false-fail). `mdsetup.js` shows PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/WATCHLIST.md
git commit -m "docs: watchlist entry for MD post-pull setup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Report and confirm before deploy**

Summarize what changed and what to test on the booth machine (pull a service where someone is on an instrument and MD → one card with both sections; a promoted player → MD-only card; the ✓ Items page shows the MD items under "MD"). **Do not `git push` until Dillon confirms** (push redeploys GitHub Pages).

---

## Self-Review notes

- **Spec coverage:** step-building (Task 1) ↔ spec §Components/1; render (Task 2) ↔ §2; save/dedup (Task 3) ↔ §3; MD-type-instrument edge ↔ Tasks 1/3 checks; tests ↔ §Testing (cases 1–6 all represented); watchlist ↔ §Watchlist. Vocalist-linked MD is the documented out-of-scope limit — no task, by design.
- **Type/name consistency:** step fields `showInstrument`/`isMD`/`showMD`/`mdPrefKey`/`prefKey`/`instId`/`instLabel`/`personName` are identical across build, render, and save. Container ids `pp_setup_editor` / `pp_md_setup_editor` match between render and tests. Bucket key `stableSetupKey(name,'band','md')` and asked-marker key `${normFullName(name)}|md` are used consistently.
- **No placeholders:** every code/step block is complete.
