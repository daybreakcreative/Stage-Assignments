# Display View Batch B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relabel the display-view band rows (MD tag on the position; instrumentalist-who-sings shown in the Band section with their vocal pack), fix the clipped IEM-pack glow, auto-link same-full-name instrument+vocal on a PCO pull, and auto-place melodic instrumentalist-vocalists at the front-line slot nearest their instrument (drums excepted).

**Architecture:** All changes live in the single `index.html`. Display relabels + drums exception are in `renderDisplayView` (the `#dvBandList` loop + the two stage-mark loops) and a couple of `.dv-list-*` CSS rules. Auto-linking extends the existing `autoLinkBandToVocalists()` (runs post-distribution). Placement is a new `placeLinkedInstrumentalists()` called after vocal ordering in both `applyPCOPlanData` and `autoAssign`.

**Tech Stack:** Vanilla HTML/CSS/JS single file. jsdom regression tests in `tests/`. `npm run check` (syntax + CSS braces) and `npm test` must both be green (allow the known `curve.js` false-fail).

---

## Ground rules (read before editing)

- **ONE file.** Everything is `index.html`. No build step.
- **Re-grep before every edit** — line numbers in this plan are approximate and drift after each
  edit. Match on the quoted anchor text.
- After every task: `npm run check` then `npm test`. Never commit red.
- Orientation: SVG `viewBox 0 0 800 380`, audience at top. **High X = stage right (SR).** Vocal
  slot 0 ("Vocal 1") = stage right by default (`vocalDirection='rtl'`). Nearness is computed from
  live `getVoxPositions`/`getBandStagePositions`, never a hardcoded index.
- Helpers you'll reuse (already defined): `normFullName(n)` (`~2879`), `detectPresetKey(inst)`
  (`~2431`, returns `'drums'|'bass'|'keys'|'eg'|'ag'|…`), `getBandStagePositions()` (`~3991`, id→
  `{x,y}`), `getVoxPositions(count)` (`~4317`, array of `{x,y}` for the filled vocalists in order),
  `getLeaderFrequencyOrder()` (`~3082`), `shortInstLabel(label)`, `formatDisplayName(name)`,
  `iemPackFor(inst)`, `esc(s)`.

---

## File Structure

- **Modify `index.html`:**
  - CSS `.dv-list-item .name.is-md::after` rule (`~1311`) → replaced by `.pos .pos-role`.
  - CSS `.dv-list` (`~1307`) → interior padding so the pack glow isn't clipped.
  - `renderDisplayView` `#dvBandList` loop (`~9413-9422`) → new labels + linked rows.
  - `renderDisplayView` stage band-mark loop (`~9327-9334`) → drums-only kit exception.
  - `renderDisplayView` stage vocal-mark loop (`~9335-9349`) → exclude linked drummers.
  - `autoLinkBandToVocalists()` (`~3708`) → full-name auto-link all instruments.
  - New `placeLinkedInstrumentalists()` (add near `autoLinkBandToVocalists`) + two call sites
    (`applyPCOPlanData` `~8305`, `autoAssign` `~3269`).
- **Create `tests/dvbatchb.js`** — jsdom checks for the band-list labels, auto-link, placement,
  drums exception.
- **Modify docs:** `CLAUDE.md` (auto-link invariant reversal), `docs/WATCHLIST.md` (new entries),
  `docs/StageAssign_Backlog.md` (mark Batch B shipped).

---

## Task 1: CSS — MD position tag + fix clipped IEM-pack glow

**Files:**
- Modify: `index.html` (CSS `~1307` and `~1311`)

- [ ] **Step 1: Replace the `is-md::after` rule with a `.pos-role` rule**

Grep for the anchor `.dv-list-item .name.is-md::after` and replace that whole line:

```css
/* OLD (delete): */
.dv-list-item .name.is-md::after{content:' · MD';color:var(--accent);font-family:var(--ff-mono);font-size:.7em;font-weight:600;letter-spacing:.1em}
/* NEW: role tag now lives on the position cell (see renderDisplayView band loop) */
.dv-list-item .pos .pos-role{color:var(--accent);font-weight:600}
```

(The `.pos` cell already provides mono font, uppercase, and letter-spacing, so `.pos-role` only
needs the accent color + weight.)

- [ ] **Step 2: Add interior padding to `.dv-list` so the pack glow isn't clipped**

Grep for the anchor `.dv-list{list-style:none;display:flex;flex-direction:column;gap:6px;overflow-y:auto}` and change it to:

```css
.dv-list{list-style:none;display:flex;flex-direction:column;gap:6px;overflow-y:auto;padding:6px 16px}
```

The aurora dark-mode pack glow is a ~14px `text-shadow`; `.dv-side-block{overflow:hidden}` +
`.dv-list{overflow-y:auto}` clip it at the edge. 16px of interior padding gives the shadow room
inside the clip region. (Booth-verify: the glow only exists in aurora **dark** mode; jsdom and the
light-mode preview can't show it.)

- [ ] **Step 3: Verify syntax + CSS balance**

Run: `npm run check`
Expected: `OK` / no brace-balance error.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style(display): MD tag moves to position cell; unclip IEM-pack glow"
```

---

## Task 2: Band list — MD tag on position + linked instrumentalist rows (items A + B)

**Files:**
- Modify: `index.html` (`renderDisplayView` `#dvBandList` loop, `~9413-9422`)
- Test: `tests/dvbatchb.js`

- [ ] **Step 1: Write the failing test (create `tests/dvbatchb.js`)**

Create the file with this harness + first two checks:

```js
// Batch B display-view: band-row relabels (MD tag on position, instrumentalist-who-sings shown in
// the Band section with their vocal pack), full-name auto-link, front-line placement, drums except.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// Build a known band+vocalist state, then render the display view and return #dvBandList <li>s.
function renderBandRows(setup){
  ev('renderAll=function(){};saveState=function(){};toast=function(){};');
  ev(setup);
  ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup";');
  return [].slice.call(doc.querySelectorAll('#dvBandList .dv-list-item'));
}

window.addEventListener('load',()=>setTimeout(()=>{

 check('MD band row: "· MD" is on the .pos cell, NOT the .name cell', ()=>{
   const rows=renderBandRows(`
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'Abraham Mata',vocalistPlayer:null}];
     state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null);
     state.musicDirectorId='inst_bass';
   `);
   if(rows.length!==1) throw new Error('expected 1 band row, got '+rows.length);
   const pos=rows[0].querySelector('.pos').textContent;
   const name=rows[0].querySelector('.name').textContent;
   if(!/·\\s*MD/i.test(pos)) throw new Error('pos should contain "· MD": '+pos);
   if(/·\\s*MD/i.test(name)) throw new Error('name must NOT contain "· MD": '+name);
   if(rows[0].querySelector('.name.is-md')) throw new Error('.name should no longer carry is-md');
 });

 check('linked instrumentalist appears in Band list as "Instr · Vocal N | Name | vocal pack"', ()=>{
   const rows=renderBandRows(`
     state.vocalists=[{id:'v1',name:'Jane Smith',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[2]='v1';
     state.config.voxIemPacks=state.config.voxIemPacks||[]; state.config.voxIemPacks[2]='Vocal C';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'BassPack',assignedTo:'',vocalistPlayer:'v1'}];
     state.musicDirectorId='inst_keys';
   `);
   const li=rows.find(r=>/BASS/i.test(r.querySelector('.pos').textContent));
   if(!li) throw new Error('no bass row rendered for the linked instrumentalist');
   const pos=li.querySelector('.pos').textContent;
   const detail=li.querySelector('.detail').textContent;
   if(!/·\\s*VOCAL\\s*3/i.test(pos)) throw new Error('pos should read "· Vocal 3": '+pos);
   if(!/Jane/.test(li.querySelector('.name').textContent)) throw new Error('name should be the vocalist');
   if(detail!=='Vocal C') throw new Error('detail should be the VOCAL pack (Vocal C), got: '+detail);
 });

 console.log('\\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\\n'));
 process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: FAIL — the linked bass is currently skipped (no bass row) and "· MD" is on `.name`.

- [ ] **Step 3: Rewrite the `#dvBandList` loop**

Grep for the anchor `if (inst.vocalistPlayer) return;` inside the band-list block (it's the one
immediately after `if (bandList) bandList.innerHTML = '';`). Replace the whole `state.instruments.forEach(...)` block (from that anchor's `state.instruments.forEach(inst => {` through its closing `});`) with:

```js
  state.instruments.forEach(inst => {
    const linkedVoc = inst.vocalistPlayer
      ? state.vocalists.find(v => v.id === inst.vocalistPlayer)
      : null;
    let name, packName, slot = -1;
    if (inst.vocalistPlayer) {
      // Instrumentalist who also sings: one entry, shown here with their VOCAL pack.
      if (!linkedVoc || !(linkedVoc.name || '').trim()) return;
      name = linkedVoc.name;
      slot = state.assignments.indexOf(inst.vocalistPlayer);
      packName = (state.config.voxIemPacks && state.config.voxIemPacks[slot]) || ('Vocal ' + (slot + 1));
    } else {
      name = (inst.assignedTo || '').trim();
      if (!name) return; // Display: skip unassigned positions
      packName = iemPackFor(inst);
    }
    const isMD = state.musicDirectorId === inst.id;
    const roleParts = [];
    if (isMD) roleParts.push('· MD');
    if (inst.vocalistPlayer && slot >= 0) roleParts.push('· Vocal ' + (slot + 1));
    const roleTag = roleParts.length ? `<span class="pos-role"> ${roleParts.join(' ')}</span>` : '';
    const li = document.createElement('li');
    li.className = 'dv-list-item';
    li.innerHTML = `<span class="pos">${esc(shortInstLabel(inst.label))}${roleTag}</span><span class="name">${esc(formatDisplayName(name)||'—')}</span><span class="detail">${esc(packName)}</span>`;
    if (bandList) bandList.appendChild(li);
  });
```

Notes: the `is-md` class is gone from `.name`; the MD/Vocal tags are static strings (not user
input) so they're inlined safely; `shortInstLabel`, `name`, and `packName` stay `esc()`-wrapped.

- [ ] **Step 4: Run the test, expect PASS**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Run the full suite**

Run: `npm run check && npm test`
Expected: all PASS (allow `curve.js`). Pay attention to `display.js`, `dvempty.js` — no new
failures.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/dvbatchb.js
git commit -m "feat(display): MD tag on position cell; linked instrumentalist shows in Band list with vocal pack"
```

---

## Task 3: Full-name auto-link on PCO pull (item D)

**Files:**
- Modify: `index.html` (`autoLinkBandToVocalists()` `~3708`)
- Test: `tests/dvbatchb.js`

- [ ] **Step 1: Add failing checks to `tests/dvbatchb.js`**

Insert these two checks before the final `console.log('\\n=== RESULT:` line:

```js
 check('autoLinkBandToVocalists links a same-FULL-name instrument to its vocalist', ()=>{
   ev(`
     state.vocalists=[{id:'v9',name:'Jane Smith',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v9';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'Jane Smith',vocalistPlayer:null}];
   `);
   ev('autoLinkBandToVocalists();');
   const bass=ev(`JSON.stringify(state.instruments.find(i=>i.id==='inst_bass'))`);
   const b=JSON.parse(bass);
   if(b.vocalistPlayer!=='v9') throw new Error('bass should link to v9, got '+b.vocalistPlayer);
   if((b.assignedTo||'')!=='') throw new Error('assignedTo should be cleared after linking');
 });

 check('shared FIRST name only does NOT auto-link', ()=>{
   ev(`
     state.vocalists=[{id:'v10',name:'Jane Doe',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v10';
     state.instruments=[{id:'inst_eg1',label:'Electric 1',pack:'EG',assignedTo:'Jane Roe',vocalistPlayer:null}];
   `);
   ev('autoLinkBandToVocalists();');
   const eg=JSON.parse(ev(`JSON.stringify(state.instruments.find(i=>i.id==='inst_eg1'))`));
   if(eg.vocalistPlayer) throw new Error('must NOT link Jane Roe(EG) to Jane Doe(vocal)');
 });
```

- [ ] **Step 2: Run the test, expect FAIL on the first new check**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: FAIL — `autoLinkBandToVocalists` currently only clears stale links, so the bass never
links.

- [ ] **Step 3: Extend `autoLinkBandToVocalists()`**

Grep for `function autoLinkBandToVocalists() {`. Also update the comment directly above it. Replace
the function (and its leading comment block) with:

```js
// Runs after a PCO pull's band distribution + vocal ordering. Two jobs:
//   1) drop any vocalistPlayer link that points to a deleted vocalist;
//   2) auto-link a band position to a vocalist when they are the SAME person, matched on FULL name
//      (normFullName). Two people who share only a first name are NOT linked. This is the only
//      name-based auto-link in the app; the "★ link" control still handles manual/edge cases.
function autoLinkBandToVocalists() {
  let changed = false;
  state.instruments.forEach(inst => {
    // Drop stale links to deleted vocalists
    if (inst.vocalistPlayer && !state.vocalists.some(v => v.id === inst.vocalistPlayer)) {
      inst.vocalistPlayer = null; changed = true;
    }
  });
  state.instruments.forEach(inst => {
    if (inst.vocalistPlayer) return;
    const nm = (inst.assignedTo || '').trim();
    if (!nm) return;
    const v = state.vocalists.find(x => normFullName(x.name) === normFullName(nm));
    if (v) { inst.vocalistPlayer = v.id; inst.assignedTo = ''; changed = true; }
  });
  return changed;
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Full suite**

Run: `npm run check && npm test`
Expected: all PASS (allow `curve.js`). Watch `pco*.js` / any pull tests — the demo pull now links
same-full-name people; confirm no test asserted the old "typed name stays typed" behavior. If one
does, update it and note why (this is an intended behavior change).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/dvbatchb.js
git commit -m "feat(pco): auto-link same-full-name instrument+vocal for all instruments"
```

---

## Task 4: Front-line auto-placement for melodic instrumentalist-vocalists (item E, melodic)

**Files:**
- Modify: `index.html` (new `placeLinkedInstrumentalists()` near `~3708`; call sites at
  `autoAssign` `~3269` and `applyPCOPlanData` `~8305`)
- Test: `tests/dvbatchb.js`

- [ ] **Step 1: Add a failing placement check to `tests/dvbatchb.js`**

Insert before the final `console.log('\\n=== RESULT:` line:

```js
 check('placeLinkedInstrumentalists moves a non-leader keys player to the stage-right-nearest non-leader slot', ()=>{
   // 4 vocalists; v-lead1/v-lead2 are song leaders (centered), v-keys & v-edge are not.
   // Keys is forced stage-right (high x) by getBandStagePositions, so the keys player should
   // land in the non-leader slot whose x is nearest stage-right.
   ev(`
     state.vocalists=[
       {id:'vk',name:'Kay Board',leadsSongs:false,isWL:false,micAssigned:''},
       {id:'vl1',name:'Lea One',leadsSongs:true,isWL:true,micAssigned:''},
       {id:'vl2',name:'Lou Two',leadsSongs:true,isWL:false,micAssigned:''},
       {id:'ve',name:'Ed Edge',leadsSongs:false,isWL:false,micAssigned:''}
     ];
     state.serviceOrder=[];
     state.assignments=computePositions(state.vocalists);
     state.instruments=[{id:'inst_keys',label:'Keys',pack:'Keys',assignedTo:'',vocalistPlayer:'vk'}];
     state.musicDirectorId='inst_keys';
   `);
   // capture slot X's + the non-leader slot nearest stage-right BEFORE placement
   const before=JSON.parse(ev(`(function(){
     var filled=state.assignments.filter(a=>a!==null);
     var vp=getVoxPositions(filled.length);
     var byId={}; var k=0;
     for(var i=0;i<state.assignments.length;i++){ if(state.assignments[i]) byId[state.assignments[i]]=vp[k++].x; }
     // non-leader ids: vk, ve
     var target = byId['vk']!==undefined && byId['ve']!==undefined ? (byId['vk']>=byId['ve']?'right':'left') : null;
     return JSON.stringify(byId);
   })()`));
   ev('placeLinkedInstrumentalists();');
   const after=JSON.parse(ev(`(function(){
     var filled=state.assignments.filter(a=>a!==null);
     var vp=getVoxPositions(filled.length);
     var byId={}; var k=0;
     for(var i=0;i<state.assignments.length;i++){ if(state.assignments[i]) byId[state.assignments[i]]=vp[k++].x; }
     return JSON.stringify(byId);
   })()`));
   // keys player's slot X after placement must be >= the other non-leader's slot X (stage-right)
   if(!(after['vk'] >= after['ve'])) throw new Error('keys player not moved stage-right: vk='+after['vk']+' ve='+after['ve']);
   // a leader stays central: vl1/vl2 keep non-extreme x (not the max, not the min)
   const xs=Object.keys(after).map(k=>after[k]).sort((a,b)=>a-b);
   const maxX=xs[xs.length-1], minX=xs[0];
   if(after['vl1']===maxX && after['vk']!==maxX) throw new Error('leader vl1 should not sit at the stage-right extreme');
 });
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: FAIL — `placeLinkedInstrumentalists is not defined`.

- [ ] **Step 3: Add `placeLinkedInstrumentalists()`**

Immediately AFTER the `autoLinkBandToVocalists()` function (grep for its closing `return changed;\n}`), add:

```js
// After vocal ordering, move each linked instrumentalist-vocalist to the FRONT-LINE vocal slot
// nearest where their instrument sits — WITHOUT displacing song-leaders (who stay centered). Drums
// are excluded: a singing drummer stays at the kit (see renderDisplayView). Operates only on the
// front-line singers (linked drummers are excluded from the ordered domain). Do NOT re-run
// computePositions afterwards — it would re-center and undo this.
function isLinkedDrummerVid(vid) {
  return state.instruments.some(i => i.vocalistPlayer === vid && detectPresetKey(i) === 'drums');
}
function placeLinkedInstrumentalists() {
  const leaderNames = new Set(getLeaderFrequencyOrder().map(n => normFullName(n)));
  const isProtected = (vid) => {
    const v = state.vocalists.find(x => x.id === vid);
    if (!v) return false;
    if (v.leadsSongs) return true;
    if (v.isWL && (v.name || '').trim()) return true;
    return leaderNames.has(normFullName(v.name));
  };
  // Front-line domain = filled slots that are NOT linked drummers, in slot order.
  const frontIdx = [];
  for (let i = 0; i < state.assignments.length; i++) {
    const id = state.assignments[i];
    if (id && !isLinkedDrummerVid(id)) frontIdx.push(i);
  }
  const ordered = frontIdx.map(i => state.assignments[i]); // ordered[k] ↔ voxPos[k]
  const count = ordered.length;
  if (count < 2) return;
  const voxPos = getVoxPositions(count);
  const bandPos = getBandStagePositions();
  // Melodic (non-drums) linked instrumentalists whose vocalist is on the front line and unprotected.
  const movers = state.instruments
    .filter(inst => inst.vocalistPlayer && detectPresetKey(inst) !== 'drums')
    .filter(inst => ordered.indexOf(inst.vocalistPlayer) !== -1 && !isProtected(inst.vocalistPlayer))
    .map(inst => ({ vid: inst.vocalistPlayer, x: (bandPos[inst.id] || {}).x }))
    .filter(m => typeof m.x === 'number')
    .sort((a, b) => b.x - a.x); // stage-right instruments claim first
  const claimed = new Set(); // ordered-position indices already taken
  movers.forEach(m => {
    let best = -1, bestD = Infinity;
    for (let k = 0; k < count; k++) {
      if (claimed.has(k)) continue;
      if (isProtected(ordered[k])) continue;
      const d = Math.abs(voxPos[k].x - m.x);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best < 0) return;
    const cur = ordered.indexOf(m.vid);
    if (cur < 0) return;
    if (cur !== best) { const t = ordered[best]; ordered[best] = ordered[cur]; ordered[cur] = t; }
    claimed.add(best);
  });
  // Write the reordered front-line ids back into their slot indices (drummer slots untouched).
  frontIdx.forEach((slotI, k) => { state.assignments[slotI] = ordered[k]; });
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Wire the two call sites**

(a) In `autoAssign()` — grep for `assignMicsToVocalists(true);   // deliberate click`. Add the
placement call immediately after it:

```js
  state.assignments = computePositions(state.vocalists);
  assignMicsToVocalists(true);   // deliberate click — seed the "usual" mic (FIX #9)
  placeLinkedInstrumentalists();  // Batch B: front-line melodic instrumentalist-vocalists
  saveState();
```

(b) In `applyPCOPlanData` — grep for `autoLinkBandToVocalists(); // catch any band positions`. Add
placement right after that line (links must exist first):

```js
  autoLinkBandToVocalists(); // catch any band positions that match a vocalist's name
  placeLinkedInstrumentalists();  // Batch B: front-line melodic instrumentalist-vocalists
  saveState();
```

(Only add the `placeLinkedInstrumentalists()` line — the surrounding lines already exist; do not
duplicate `saveState()`.)

- [ ] **Step 6: Full suite**

Run: `npm run check && npm test`
Expected: all PASS (allow `curve.js`). Watch any test that pulls the demo plan and asserts vocalist
slot order — placement may reorder non-leaders. Update + annotate if needed (intended).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/dvbatchb.js
git commit -m "feat(stage): front-line melodic instrumentalist-vocalists near their instrument"
```

---

## Task 5: Drums exception on the stage diagram (item E, drums)

**Files:**
- Modify: `index.html` (`renderDisplayView` stage band-mark loop `~9327-9334` and vocal-mark loop
  `~9335-9349`)
- Test: `tests/dvbatchb.js`

- [ ] **Step 1: Add failing checks to `tests/dvbatchb.js`**

Insert before the final `console.log('\\n=== RESULT:` line. This renders the display and inspects the
stage-people layer `#dvStagePeople`:

```js
 function renderStageMarks(setup){
   ev('renderAll=function(){};saveState=function(){};toast=function(){};');
   ev(setup);
   ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup";');
   return [].slice.call(doc.querySelectorAll('#dvStagePeople .dv-sp')).map(el=>({
     role:(el.querySelector('.dv-sp-role')||{}).textContent||'',
     name:(el.querySelector('.dv-sp-name')||{}).textContent||''
   }));
 }

 check('a singing drummer keeps the kit mark and gets NO front-line vocal mark', ()=>{
   const marks=renderStageMarks(`
     state.vocalists=[{id:'vd',name:'Drew Kit',leadsSongs:false,isWL:false,micAssigned:''},
                      {id:'vs',name:'Sam Sing',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='vd'; state.assignments[1]='vs';
     state.instruments=[{id:'inst_drums',label:'Drums',pack:'Drum',assignedTo:'',vocalistPlayer:'vd'}];
     state.musicDirectorId='inst_keys';
   `);
   const kit=marks.find(m=>/DRUMS/i.test(m.role) && m.kind!=='vocal');
   const drummerVocal=marks.filter(m=>/VOCAL/i.test(m.role) && /Drew Kit/.test(m.name));
   const drumKit=marks.find(m=>/DRUMS/i.test(m.role));
   if(!drumKit) throw new Error('drum-kit stage mark should still render for a singing drummer');
   if(!/Drew Kit/.test(drumKit.name)) throw new Error('drum-kit mark should be labelled with the drummer name, got: '+drumKit.name);
   if(drummerVocal.length) throw new Error('drummer must NOT get a front-line VOCAL mark');
   // the other singer still gets a vocal mark
   if(!marks.some(m=>/VOCAL/i.test(m.role) && /Sam Sing/.test(m.name))) throw new Error('non-drummer singer should still show at a vocal position');
 });

 check('a linked MELODIC instrument still has NO kit-style band mark (player shows at vocal pos)', ()=>{
   const marks=renderStageMarks(`
     state.vocalists=[{id:'vb',name:'Bo Bass',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='vb';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'',vocalistPlayer:'vb'}];
     state.musicDirectorId='inst_keys';
   `);
   if(marks.some(m=>/BASS/i.test(m.role))) throw new Error('a linked bass should NOT get a band stage mark');
 });
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: FAIL — currently a linked drums instrument is skipped (no kit mark), and the drummer is
drawn at a front-line vocal position.

- [ ] **Step 3: Add the drums-only kit exception to the band-mark loop**

Grep for `if (inst.vocalistPlayer) return; // covered by vocalist — gets a /TAG instead`. Replace
the `state.instruments.forEach(...)` block that starts there (through its closing `});`) with:

```js
  state.instruments.forEach(inst => {
    const linkedVoc = inst.vocalistPlayer
      ? state.vocalists.find(v => v.id === inst.vocalistPlayer)
      : null;
    const isDrums = detectPresetKey(inst) === 'drums';
    let name;
    if (inst.vocalistPlayer) {
      // Melodic linked instrument → skip (the player shows at their vocal position). A singing
      // drummer is the exception: keep the kit mark at its spot, labelled with the drummer.
      if (!(isDrums && linkedVoc)) return;
      name = (linkedVoc.name || '').trim();
    } else {
      name = (inst.assignedTo || '').trim();
    }
    if (!name) return; // Display: only show positions that are actually filled
    const pos = bandPositions[inst.id]; if (!pos) return;
    const isMD = state.musicDirectorId === inst.id;
    dvMarks.push({ x: pos.x, y: pos.y, name: formatDisplayName(name), role: shortInstLabel(inst.label) + (isMD ? ' · MD' : ''), kind: 'band' });
  });
```

- [ ] **Step 4: Exclude linked drummers from the front-line vocal marks**

Grep for `const filledIds = state.assignments.filter(a => a !== null);`. Replace that line through
the end of its `if (count > 0) { … }` block with:

```js
  const filledIds = state.assignments.filter(a => a !== null && !isLinkedDrummerVid(a));
  const count = filledIds.length;
  if (count > 0) {
    const voxPositions = getVoxPositions(count);
    let posIdx = 0;
    for (let i=0; i<MAX_VOCALISTS; i++) {
      const id = state.assignments[i]; if (!id) continue;
      if (isLinkedDrummerVid(id)) continue; // singing drummer stays at the kit — no front mark
      const v = state.vocalists.find(x => x.id === id); if (!v) continue;
      const pos = voxPositions[posIdx++];
      const tags = vocalistInstrumentTags(v.id);
      const tagSuffix = tags.length ? ` / ${tags.join(', ')}` : '';
      // Display view intentionally does NOT highlight worship leaders (no is-wl).
      dvMarks.push({ x: pos.x, y: pos.y, name: formatDisplayName(v.name) || '—', role: `VOCAL ${i+1}${tagSuffix}`, kind: 'vocal' });
    }
  }
```

(`isLinkedDrummerVid` was defined in Task 4. It is a top-level function, so it's in scope here.)

- [ ] **Step 5: Run the test, expect PASS**

Run: `SA_HTML=index.html node tests/dvbatchb.js`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 6: Full suite**

Run: `npm run check && npm test`
Expected: all PASS (allow `curve.js`).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/dvbatchb.js
git commit -m "feat(display): singing drummer keeps the kit mark, no front-line vocal mark"
```

---

## Task 6: Docs — reverse the auto-link invariant + record Batch B

**Files:**
- Modify: `CLAUDE.md`, `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: Update the auto-link invariant in `CLAUDE.md`**

Grep for `**Band ↔ vocalist linking**: only the explicit`. Replace that bullet with:

```markdown
- **Band ↔ vocalist linking**: on a PCO pull, `autoLinkBandToVocalists()` auto-links a band
  position to a vocalist when they are the **same person, matched on FULL name** (`normFullName`).
  Two people who share only a *first* name are NOT linked. The explicit "★ link / also a vocalist"
  control still sets `inst.vocalistPlayer` for manual/edge cases.
```

Also grep for the boom-mic sentence `Boom-mic auto-add fires for a typed-name MD` — it's still
correct (leave it), but if it references "never on a mere name match", update that clause to "on a
full-name match or an explicit link" to stay consistent.

- [ ] **Step 2: Add WATCHLIST entries**

Open `docs/WATCHLIST.md`, find the highest-numbered item (they run 1–33). Append the next numbers:

```markdown
34. **Display band rows label roles on the POSITION cell.** An MD reads "BASS · MD | Name | Bass";
    an instrumentalist who also sings reads "BASS · Vocal N | Name | <their vocal pack>" and also
    keeps their vocalist card. (`renderDisplayView` #dvBandList loop; `tests/dvbatchb.js`.)
35. **Full-name auto-link on PCO pull.** Same full name on a vocal spot + any instrument →
    `inst.vocalistPlayer` linked (`autoLinkBandToVocalists`). Shared first name only → NOT linked.
36. **Front-line placement of melodic instrumentalist-vocalists.** After vocal ordering, a
    non-leader instrumentalist-vocalist moves to the vocal slot nearest their instrument's X;
    song-leaders stay centered. Drums excepted (`placeLinkedInstrumentalists`).
37. **Singing drummer stays at the kit.** The drum-kit stage mark renders (labelled with the
    drummer) and the drummer gets NO front-line vocal mark; they still appear in the Band list as
    "DRUMS · Vocal N" and keep their vocalist card.
```

- [ ] **Step 3: Mark Batch B shipped in the backlog**

Open `docs/StageAssign_Backlog.md`, find the `**Display view (batch B):**` block under the
2026-07-18 punch list. Replace its heading + bullets with a shipped record:

```markdown
**Display view (batch B):** ✅ SHIPPED 2026-07-19 → `dvbatchb`
- ~~Band IEM-pack column gradient clipped~~ — `.dv-list` interior padding (booth-verify the glow).
- ~~Instrumentalist who is also a vocalist~~ — now shows in the Band section as
  "Instr · Vocal N | Name | <vocal pack>"; also front-lined near their instrument (drums excepted).
- ~~Instrumentalist who is also MD~~ — "Instr · MD | Name | Pack" (tag moved to the position cell).
- ~~Auto-link a vocalist who is also an instrumentalist~~ — full-name auto-link, all instruments.
```

- [ ] **Step 4: Final full validation**

Run: `npm run check && npm test`
Expected: all PASS (allow `curve.js`).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "docs: record Batch B; reverse auto-link invariant to full-name linking"
```

---

## Definition of done

- `npm run check` and `npm test` both green (only `curve.js` false-fail allowed).
- `tests/dvbatchb.js` passes all checks.
- Manual booth checklist for Dillon (things jsdom can't confirm):
  1. Display view, aurora dark mode: the IEM-pack text glow is no longer clipped at the block edge.
  2. Pull a plan where someone sings AND plays (non-drums): they show in the Band list as
     "Instr · Vocal N | Name | <vocal pack>", appear at the front-line slot on their instrument's
     side, and still have a vocalist card.
  3. An MD band row reads "Instr · MD | Name | Pack".
  4. A drummer who also sings: the drum kit stays at the back with their name; no front-line vocal
     dot for them; they still appear in the Band list as "DRUMS · Vocal N".
- Do NOT `git push` until Dillon confirms (deploy = push, per CLAUDE.md).

---

## Self-review notes (author)

- **Spec coverage:** A→Task 1+2; B→Task 2; C→Task 1; D→Task 3; E-melodic→Task 4; E-drums→Task 5;
  docs/invariant→Task 6. All spec sections mapped.
- **Type consistency:** `placeLinkedInstrumentalists()`, `isLinkedDrummerVid(vid)`,
  `autoLinkBandToVocalists()` names are used identically across tasks. `state.config.voxIemPacks`,
  `state.assignments`, `inst.vocalistPlayer`, `detectPresetKey(inst)` match the codebase.
- **Placeholder scan:** none — every code step shows full code; every run step shows the command +
  expected result.
- **Deviation from spec (item D seam):** implemented via `autoLinkBandToVocalists()` (dedicated
  post-distribution hook) instead of ungating `distributeBucket`; behavior identical, spec §D
  updated to match.
