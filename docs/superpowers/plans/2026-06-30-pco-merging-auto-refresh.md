# PCO Merging Auto-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-minute auto-refresh (and a manual ↻ Refresh) that pulls the latest Planning Center plan and *merges* it into the recalled session — applying upstream changes per a fixed rule matrix while preserving all manual edits.

**Architecture:** Two new pure functions (`derivePcoModel` parses a raw PCO pull into a normalized model; `diffPcoModel` three-way-diffs a stored baseline vs. a fresh model into a change-list) plus a set of live-state apply helpers, an orchestrator (`pcoMergeRefresh`) with guards, a non-blocking notification banner, and a timer. A new top-level `state.pcoBaseline` stores PCO's last-known side of the truth; no per-entity schema changes. The destructive **Pull Plan** path (`applyPCOPlanData`) is left intact and only gains a baseline write.

**Tech Stack:** Vanilla HTML/CSS/JS single file (`index.html`), `localStorage` state, jsdom regression tests in `tests/`. No build step. Validate with `npm run check` and `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-30-pco-merging-auto-refresh-design.md`

---

## Key existing anchors (re-grep before editing — line numbers drift)

- `DEFAULT_STATE` object: search `const DEFAULT_STATE = {` (~line 1971). `config:` block ~1985, `customStagePositions: {}` ~1995, `pcoConfig:` ~1983.
- Load/migration merge of pcoConfig: search `pcoConfig: { ...DEFAULT_STATE.pcoConfig` (~2264).
- `classifyPosition(name)` ~6804 — returns `{kind, position?, host?, isWL?, leadsSongs?}`; `kind` ∈ `vocalist|band|md_flag|host|shadow|ignore|unknown`.
- `normFullName(n)` ~2595, `normName(n)` ~2593, `uid()` ~2591, `instUid()` ~3310, `instById(id)` ~3292.
- `ensureVocalCapacity()` ~1930, `getMicPool()` ~2701, `computePositions(vocs)` ~2809.
- `pcoPullPlan(planId)` ~6860, `applyPCOPlanData(planData, tmRes, itemsRes)` ~6900 (service-order parse ~7116-7172).
- `pcoFetch(path)` ~6663, `setPCOStatus(text,kind)` ~6702, `toast(msg,kind)` ~7525, `saveState()` ~2327, `renderAll()` ~8134, `isStageEditing()` ~4453.
- PCO bar HTML: search `<div class="pco-bar" id="pcoBar"` (~1497); `#pcoRefreshBtn` button ~1502.
- init() wiring of `#pcoRefreshBtn`: search `pcoRefreshBtn').addEventListener` (~11853). init() starts ~11754.
- Position model: `state.assignments` = array length `MAX_VOCALISTS` of vocalist-id|null (slot index = layout position). Custom drag XY in `state.config.customStagePositions`, keyed by `customKeyForVocal(i)` = `'vocal_'+i` (~4690) and `customKeyForBand(instId)` = `instId` (~4689).
- `MAX_VOCALISTS` ~1929 (mutable, grows). `MAX_SHADOWS` — grep `MAX_SHADOWS`.

## Conventions for every test file in this plan

Copy this exact harness header (matches `tests/smoke2.js`). Save each test as `tests/<name>.js`; the runner (`tests/run-all.js`) auto-discovers it. Each file MUST end by printing the result line the runner parses.

```js
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(window){
    window.structuredClone = window.structuredClone || (v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
    window.matchMedia = window.matchMedia || (()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
    window.scrollTo=()=>{};
    if(!window.crypto) window.crypto={};
    if(!window.crypto.randomUUID) window.crypto.randomUUID=()=>'x'+Math.random().toString(16).slice(2);
    window.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
    window.Element.prototype.setPointerCapture=function(){};
    window.Element.prototype.releasePointerCapture=function(){};
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{

  // ---- checks go here ----

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
```

Top-level `const`/`let` (e.g. `derivePcoModel`, `state`) are reachable via `ev('...')` because they are function declarations / on `window` after script eval. Use `ev('derivePcoModel(...)')` and `ev('JSON.stringify(...)')` to inspect.

---

## File structure

Everything ships in `index.html`. New code is added as a cohesive block of function declarations placed **immediately after `applyPCOPlanData` ends** (after its closing `}` ~line 7186, before `function pcoLoadDemo()`). The block defines, in order: `derivePcoModel`, `diffPcoModel`, the apply helpers, `applyPcoMerge`, `pcoMergeRefresh`, `pcoMergeNotify`, `renderPcoMergeBanner`, `startPcoAutoRefresh`. Schema additions go in `DEFAULT_STATE`. Wiring goes in `init()` and the PCO-bar HTML.

New tests: `tests/pcoderive.js`, `tests/pcodiff.js`, `tests/pcomerge.js`, `tests/pcorefresh.js`.

---

## Task 1: `derivePcoModel` — pure parser

Parses raw PCO responses into a normalized model. Includes ALL team members regardless of `status` (so a later decline `C→D` is detectable). Does **not** mutate state.

**Files:**
- Modify: `index.html` (insert after `applyPCOPlanData`'s closing brace, ~7186)
- Test: `tests/pcoderive.js`

- [ ] **Step 1: Write the failing test** — create `tests/pcoderive.js` with the harness header and these checks:

```js
  console.log('--- derivePcoModel ---');
  const TM = JSON.stringify({ data: [
    { id:'tm1', attributes:{ name:'Jake Williams', team_position_name:'Worship Leader', status:'C' } },
    { id:'tm2', attributes:{ name:'Sophia Davis',  team_position_name:'Vocals',         status:'C' } },
    { id:'tm3', attributes:{ name:'Sam Rodriguez',  team_position_name:'Drums',          status:'D' } },
    { id:'tm4', attributes:{ name:'Carlos Brown',   team_position_name:'Keys',           status:'C' } },
    { id:'tm5', attributes:{ name:'Pat Usher',      team_position_name:'Usher',          status:'C' } }
  ]});
  const PLAN = JSON.stringify({ data:{ attributes:{ series_title:'Grace', sort_date:'2026-07-05T10:00:00Z' } } });
  const ITEMS = JSON.stringify({ data:[
    { id:'i1', attributes:{ sequence:2, item_type:'song', title:'Song B', length:300, key_name:'G' } },
    { id:'i2', attributes:{ sequence:1, item_type:'song', title:'Song A', length:240, key_name:'C' } }
  ], included:[] });

  check('derivePcoModel returns people with pcoId + status, ignores Ushers', ()=>{
    const m = ev(`derivePcoModel(${PLAN}, ${TM}, ${ITEMS})`);
    const ids = m.people.map(p=>p.pcoId).sort().join(',');
    if (ids !== 'tm1,tm2,tm3,tm4') throw new Error('people wrong: '+ids);   // tm5 Usher ignored
    const jake = m.people.find(p=>p.pcoId==='tm1');
    if (jake.kind!=='vocalist' || !jake.isWL) throw new Error('Jake not WL vocalist');
    const sam = m.people.find(p=>p.pcoId==='tm3');
    if (sam.status!=='D' || sam.kind!=='band' || sam.position!=='drums') throw new Error('Sam not declined drummer');
  });
  check('derivePcoModel meta + service order sorted by sequence', ()=>{
    const m = ev(`derivePcoModel(${PLAN}, ${TM}, ${ITEMS})`);
    if (m.meta.title!=='Grace' || m.meta.date!=='2026-07-05') throw new Error('meta wrong: '+JSON.stringify(m.meta));
    if (m.serviceOrder.map(s=>s.title).join(',')!=='Song A,Song B') throw new Error('order wrong');
    if (m.serviceOrder[0].key!=='C') throw new Error('key not parsed');
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `SA_HTML=index.html node tests/pcoderive.js`
Expected: FAIL lines `derivePcoModel is not defined` (or similar), result `2 ISSUE(S)`.

- [ ] **Step 3: Implement `derivePcoModel`** — insert into `index.html` after `applyPCOPlanData`'s closing `}`:

```js
// ===== PCO MERGE REFRESH (auto-refresh that preserves manual edits) =====
// derivePcoModel: pure parser. Raw PCO responses -> normalized {meta, people, serviceOrder}.
// Includes ALL team members (any status) so a later C->D decline is detectable. No state mutation.
function derivePcoModel(planData, tmRes, itemsRes) {
  const meta = { title:'', date:'' };
  if (planData && planData.attributes) {
    const a = planData.attributes;
    meta.title = a.series_title || a.title || a.plan_title || '';
    if (a.sort_date) meta.date = a.sort_date.slice(0,10);
  }
  const people = [];
  ((tmRes && tmRes.data) || []).forEach(tm => {
    const a = tm.attributes || {};
    const name = a.name || '';
    if (!name) return;
    const cls = classifyPosition(a.team_position_name || '');
    if (cls.kind === 'ignore' || cls.kind === 'unknown') return;
    people.push({
      pcoId: tm.id,
      name,
      kind: cls.kind === 'md_flag' ? 'md' : cls.kind,   // vocalist|band|host|shadow|md
      position: cls.position || '',
      host: cls.host || '',
      isWL: !!cls.isWL,
      leadsSongs: !!cls.leadsSongs,
      status: a.status || ''
    });
  });
  // Service order — mirror of applyPCOPlanData's parse, but pure.
  const serviceOrder = [];
  if (itemsRes && itemsRes.data) {
    const noteByItemId = {};
    (itemsRes.included || []).forEach(inc => {
      if (inc.type === 'ItemNote') {
        const itemId = inc.relationships && inc.relationships.item && inc.relationships.item.data && inc.relationships.item.data.id;
        if (itemId) { (noteByItemId[itemId] = noteByItemId[itemId] || []).push(inc.attributes); }
      }
    });
    const sorted = [...itemsRes.data].sort((a,b)=>(a.attributes.sequence||0)-(b.attributes.sequence||0));
    sorted.forEach(item => {
      const a = item.attributes || {};
      const notes = noteByItemId[item.id] || [];
      let leader = null; const other = [];
      notes.forEach(n => {
        const cat = (n.category_name||'').toLowerCase(); const content = (n.content||'').trim();
        if (!content) return;
        if (!leader && cat.includes('leader')) leader = content; else other.push(content);
      });
      const descPieces = [];
      if (a.description && a.description.trim()) descPieces.push(a.description.trim());
      if (other.length) descPieces.push(...other);
      serviceOrder.push({
        id: item.id, kind: a.item_type || 'item', title: a.title || '',
        length: a.length || 0, key: a.key_name || null, leader,
        notes: descPieces.join('\n').trim(), seq: a.sequence || 0
      });
    });
  }
  return { meta, people, serviceOrder };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcoderive.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 5: Commit**

```bash
npm run check
git add index.html tests/pcoderive.js
git commit -m "feat(pco): add derivePcoModel pure parser for merge refresh"
```

---

## Task 2: `diffPcoModel` — pure three-way differ

Diffs a stored baseline model vs. a fresh model, **by `pcoId`**, into a change-list.

**Files:**
- Modify: `index.html` (immediately after `derivePcoModel`)
- Test: `tests/pcodiff.js`

- [ ] **Step 1: Write the failing test** — `tests/pcodiff.js`:

```js
  console.log('--- diffPcoModel ---');
  const base = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1'}], people:[
    {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},
    {pcoId:'tm2',name:'Sophia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'},
    {pcoId:'tm3',name:'Sam',kind:'band',position:'drums',host:'',isWL:false,leadsSongs:false,status:'C'},
    {pcoId:'tm4',name:'Carl',kind:'band',position:'eg',host:'',isWL:false,leadsSongs:false,status:'C'}
  ]});

  check('add / decline / hardRemove / roleChange / rename / serviceOrder all detected', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1 NEW'}], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},   // unchanged
      {pcoId:'tm2',name:'Sophia R',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'}, // renamed
      {pcoId:'tm3',name:'Sam',kind:'band',position:'drums',host:'',isWL:false,leadsSongs:false,status:'D'},   // declined
      {pcoId:'tm4',name:'Carl',kind:'band',position:'keys',host:'',isWL:false,leadsSongs:false,status:'C'},   // role eg->keys
      {pcoId:'tm5',name:'Mia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'}     // added
    ]});
    const d = ev(`diffPcoModel(${base}, ${next})`);
    if (d.added.map(p=>p.pcoId).join(',')!=='tm5') throw new Error('added: '+JSON.stringify(d.added));
    if (d.declined.map(p=>p.pcoId).join(',')!=='tm3') throw new Error('declined: '+JSON.stringify(d.declined));
    if (d.roleChanged.map(c=>c.to.pcoId).join(',')!=='tm4') throw new Error('roleChanged: '+JSON.stringify(d.roleChanged));
    if (d.renamed.map(c=>c.to.pcoId).join(',')!=='tm2') throw new Error('renamed: '+JSON.stringify(d.renamed));
    if (!d.serviceOrderChanged) throw new Error('serviceOrderChanged not set');
    if (!d.hasChanges) throw new Error('hasChanges false');
  });
  check('hardRemove detected when member absent from next', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1'}], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},
      {pcoId:'tm2',name:'Sophia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'},
      {pcoId:'tm4',name:'Carl',kind:'band',position:'eg',host:'',isWL:false,leadsSongs:false,status:'C'}
    ]});
    const d = ev(`diffPcoModel(${base}, ${next})`);
    if (d.hardRemoved.map(p=>p.pcoId).join(',')!=='tm3') throw new Error('hardRemoved: '+JSON.stringify(d.hardRemoved));
    if (d.serviceOrderChanged) throw new Error('serviceOrder falsely changed');
  });
  check('no baseline => everything is an add, no churn flags', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'}
    ]});
    const d = ev(`diffPcoModel(null, ${next})`);
    if (d.added.length!==1 || d.hardRemoved.length || d.declined.length) throw new Error('null-baseline diff wrong');
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `SA_HTML=index.html node tests/pcodiff.js`
Expected: FAIL `diffPcoModel is not defined`, result `3 ISSUE(S)`.

- [ ] **Step 3: Implement `diffPcoModel`** — insert after `derivePcoModel`:

```js
// diffPcoModel: three-way diff by pcoId. baseline = PCO's last-known truth; next = fresh pull.
// Returns a change-list. A person is "active" when status !== 'D'.
function diffPcoModel(baseline, next) {
  const out = { added:[], declined:[], hardRemoved:[], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:false };
  const basePeople = (baseline && baseline.people) || [];
  const nextPeople = (next && next.people) || [];
  const baseById = {}; basePeople.forEach(p => { baseById[p.pcoId] = p; });
  const nextById = {}; nextPeople.forEach(p => { nextById[p.pcoId] = p; });
  const active = p => p && p.status !== 'D';

  nextPeople.forEach(np => {
    const bp = baseById[np.pcoId];
    if (active(np)) {
      if (!bp || !active(bp)) { out.added.push(np); return; }   // new, or came back from declined
      // both active & known: detect role/name changes
      if (np.kind !== bp.kind || np.position !== bp.position || np.host !== bp.host) {
        out.roleChanged.push({ from:bp, to:np });
      }
      if (normFullName(np.name) !== normFullName(bp.name)) {
        out.renamed.push({ from:bp, to:np });
      }
    } else { // np declined
      if (bp && active(bp)) out.declined.push(np);   // newly declined
      // (declined->declined, or first-seen-as-declined: nothing to do)
    }
  });
  // hard-removed: was active in baseline, absent entirely from next
  basePeople.forEach(bp => {
    if (active(bp) && !nextById[bp.pcoId]) out.hardRemoved.push(bp);
  });
  // service order + meta: shallow JSON compare
  const baseSO = JSON.stringify((baseline && baseline.serviceOrder) || []);
  const nextSO = JSON.stringify((next && next.serviceOrder) || []);
  out.serviceOrderChanged = baseSO !== nextSO;
  const baseMeta = JSON.stringify((baseline && baseline.meta) || {});
  const nextMeta = JSON.stringify((next && next.meta) || {});
  out.metaChanged = baseMeta !== nextMeta;

  out.hasChanges = !!(out.added.length || out.declined.length || out.hardRemoved.length ||
    out.roleChanged.length || out.renamed.length || out.serviceOrderChanged || out.metaChanged);
  return out;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcodiff.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 5: Commit**

```bash
npm run check
git add index.html tests/pcodiff.js
git commit -m "feat(pco): add diffPcoModel three-way differ"
```

---

## Task 3: Persist the baseline on every accepted pull

Add `state.pcoBaseline` to `DEFAULT_STATE` and write it at the end of the existing destructive pull, so the first merge has a base.

**Files:**
- Modify: `index.html` — `DEFAULT_STATE` (~1971), `applyPCOPlanData` tail (~7180), load-merge (~2264)
- Test: `tests/pcoderive.js` (extend)

- [ ] **Step 1: Add the field to `DEFAULT_STATE`.** Find the `pcoConfig:` line (~1983) in `DEFAULT_STATE` and add immediately after it:

```js
  pcoBaseline: null,
```

- [ ] **Step 2: Preserve it across load/migration.** Find the merge near `pcoConfig: { ...DEFAULT_STATE.pcoConfig` (~2264). Add a sibling line in that same merged-object literal:

```js
        pcoBaseline: (p.pcoBaseline && typeof p.pcoBaseline === 'object') ? p.pcoBaseline : null,
```

- [ ] **Step 3: Write the baseline at the end of `applyPCOPlanData`.** Find the tail (~7180-7185):

```js
  saveState();
  state.assignments = computePositions(state.vocalists);
  assignMicsToVocalists();
  autoLinkBandToVocalists(); // catch any band positions that match a vocalist's name
  saveState();
  renderAll();
}
```

Insert the baseline write just before the final `saveState(); renderAll();`. The function still has `planData, tmRes, itemsRes` in scope:

```js
  // Record PCO's side of the truth so the next merge-refresh can diff against it.
  state.pcoBaseline = derivePcoModel(planData, tmRes, itemsRes);
  state.pcoBaseline.planId = state.pcoConfig.selectedPlanId || '';
  saveState();
  renderAll();
}
```

- [ ] **Step 4: Add a check to `tests/pcoderive.js`** (inside the same harness, after the existing checks):

```js
  check('a destructive pull writes state.pcoBaseline with planId + people', ()=>{
    ev(`state.pcoConfig.selectedPlanId='p9';`);
    ev(`applyPCOPlanData(${PLAN}, ${TM}, ${ITEMS})`);
    if (!ev('state.pcoBaseline')) throw new Error('baseline not written');
    if (ev('state.pcoBaseline.planId')!=='p9') throw new Error('planId missing');
    if (ev('state.pcoBaseline.people.length') < 1) throw new Error('no people in baseline');
  });
```

- [ ] **Step 5: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcoderive.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 6: Run full regression to confirm no Pull-Plan regression**

Run: `npm run check && npm test`
Expected: all PASS (curve.js may show `PASS*` known false-fail).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/pcoderive.js
git commit -m "feat(pco): persist pcoBaseline on every accepted pull"
```

---

## Task 4: Live-state apply helpers + `applyPcoMerge`

Mutate live state per a change-list, **preserving** stage positions, mics, hand-added people, host/MD overrides, and links. Locates live entities by the baseline-recorded name. Adds never call the full `computePositions` re-layout.

**Files:**
- Modify: `index.html` (after `diffPcoModel`)
- Test: `tests/pcomerge.js`

- [ ] **Step 1: Write the failing test** — `tests/pcomerge.js`. It seeds live state, runs `applyPcoMerge`, and asserts both the upstream change AND the preservation guarantees.

```js
  console.log('--- applyPcoMerge: apply changes, preserve edits ---');

  // Seed a known live state: 2 vocalists (Jake WL, Sophia), drummer Sam, EG Carl, plus a HAND-ADDED vocalist Zoe.
  function seed(){
    ev(`
      state.vocalists = [
        {id:'vJ',name:'Jake',isWL:true,leadsSongs:true,micAssigned:'Beta 58 #1'},
        {id:'vS',name:'Sophia',isWL:false,leadsSongs:false,micAssigned:'Beta 58 #2'},
        {id:'vZ',name:'Zoe',isWL:false,leadsSongs:false,micAssigned:'Beta 58 #3'}
      ];
      state.assignments = new Array(MAX_VOCALISTS).fill(null);
      state.assignments[2]='vJ'; state.assignments[3]='vS'; state.assignments[4]='vZ';
      state.config.customStagePositions = { vocal_2:{x:400,y:120}, vocal_3:{x:300,y:140} };
      var dr = instById('inst_drums'); if(dr){ dr.assignedTo='Sam'; }
      var eg = state.instruments.find(i=>i.label && /electric/i.test(i.label)); if(eg){ eg.assignedTo='Carl'; eg.id='inst_eg1'; }
      state.hosts = {speaker:'',welcomeHost1:'',welcomeHost2:'',hh3:'',hh3IsBaptismal:false};
    `);
  }

  check('hard-remove + decline drop people; positions/mics of others preserved; hand-added kept', ()=>{
    seed();
    const cl = { added:[], declined:[{pcoId:'tm3',name:'Sam',kind:'band',position:'drums'}],
      hardRemoved:[{pcoId:'tm2',name:'Sophia',kind:'vocalist'}],
      roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    const names = ev('state.vocalists.map(v=>v.name).join(",")');
    if (/Sophia/.test(names)) throw new Error('Sophia not removed: '+names);
    if (!/Zoe/.test(names)) throw new Error('hand-added Zoe lost: '+names);
    // Jake preserved in slot 2 with custom position + mic
    if (ev('state.assignments[2]')!=='vJ') throw new Error('Jake slot moved');
    if (ev('state.config.customStagePositions.vocal_2.x')!==400) throw new Error('Jake custom pos lost');
    if (ev("state.vocalists.find(v=>v.id==='vJ').micAssigned")!=='Beta 58 #1') throw new Error('Jake mic lost');
    if (ev("instById('inst_drums').assignedTo")!=='') throw new Error('Sam not cleared from drums');
  });

  check('add creates a vocalist in a free slot without disturbing existing placements', ()=>{
    seed();
    const cl = { added:[{pcoId:'tm9',name:'Mia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false}],
      declined:[], hardRemoved:[], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (!/Mia/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('Mia not added');
    if (ev('state.assignments[2]')!=='vJ' || ev('state.assignments[3]')!=='vS') throw new Error('existing slots disturbed');
    const mia = ev("state.vocalists.find(v=>v.name==='Mia')");
    if (ev(`state.assignments.indexOf("${mia.id}")`) < 0) throw new Error('Mia not placed in a slot');
  });

  check('role change re-slots a band member (eg->keys) and keeps a free keys slot filled', ()=>{
    seed();
    const cl = { added:[], declined:[], hardRemoved:[],
      roleChanged:[{ from:{pcoId:'tm4',name:'Carl',kind:'band',position:'eg'},
                     to:{pcoId:'tm4',name:'Carl',kind:'band',position:'keys'} }],
      renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (ev("instById('inst_eg1').assignedTo")==='Carl') throw new Error('Carl still on EG');
    const onKeys = ev(`state.instruments.some(i=>i.assignedTo==='Carl' && /key/i.test(i.label))`);
    if (!onKeys) throw new Error('Carl not moved to a keys slot');
  });

  check('rename updates the live name in place (host/MD override untouched)', ()=>{
    seed();
    ev(`state.hosts.speaker='Pastor Dave';`);
    const cl = { added:[], declined:[], hardRemoved:[], roleChanged:[],
      renamed:[{ from:{pcoId:'tm2',name:'Sophia',kind:'vocalist'}, to:{pcoId:'tm2',name:'Sophia Reyes',kind:'vocalist'} }],
      serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (!/Sophia Reyes/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('rename not applied');
    if (ev('state.hosts.speaker')!=='Pastor Dave') throw new Error('host override clobbered');
  });

  check('service order + meta replaced only when flagged', ()=>{
    seed();
    ev(`state.serviceOrder=[{id:'old',title:'Old'}]; state.service={name:'X',date:'2026-01-01'};`);
    const cl = { added:[], declined:[], hardRemoved:[], roleChanged:[], renamed:[],
      serviceOrderChanged:true, metaChanged:true, hasChanges:true };
    const next = { meta:{title:'New Series',date:'2026-07-05'}, people:[],
      serviceOrder:[{id:'i1',kind:'song',title:'Song A',length:240,key:'C',leader:null,notes:'',seq:1}] };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, ${JSON.stringify(next)})`);
    if (ev('state.serviceOrder[0].title')!=='Song A') throw new Error('service order not replaced');
    if (ev('state.service.name')!=='New Series' || ev('state.service.date')!=='2026-07-05') throw new Error('meta not applied');
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `SA_HTML=index.html node tests/pcomerge.js`
Expected: FAIL `applyPcoMerge is not defined`, result `5 ISSUE(S)`.

- [ ] **Step 3: Implement the apply helpers + `applyPcoMerge`** — insert after `diffPcoModel`:

```js
// ---- live-state apply helpers (locate live entities by the baseline-recorded name) ----

// Find first empty vocal slot index (or grow capacity). Returns an index in state.assignments.
function pcoFirstFreeVocalSlot() {
  ensureVocalCapacity();
  for (let i = 0; i < state.assignments.length; i++) if (!state.assignments[i]) return i;
  // grow
  state.assignments.push(null);
  return state.assignments.length - 1;
}

// Pick a mic not currently assigned to anyone (vocalist or instrument). Returns name or ''.
function pcoFreeMic() {
  const used = new Set();
  state.vocalists.forEach(v => { if (v.micAssigned) used.add(v.micAssigned); });
  state.instruments.forEach(i => { if (i.micAssigned) used.add(i.micAssigned); });
  const pool = getMicPool();
  const free = pool.find(m => !used.has(m.name));
  return free ? free.name : '';
}

function pcoAddVocalist(p) {
  if (state.vocalists.some(v => normFullName(v.name) === normFullName(p.name))) return;
  const v = { id: uid(), name: p.name, isWL: false, leadsSongs: !!p.leadsSongs, micAssigned: '' };
  state.vocalists.push(v);
  ensureVocalCapacity();
  const slot = pcoFirstFreeVocalSlot();
  state.assignments[slot] = v.id;
  v.micAssigned = pcoFreeMic();   // "" if none free; the ⚠ notice still flags it
}

function pcoAddBand(p) {
  // fill first empty slot of this position; else auto-create for keys/eg/ag
  const empty = state.instruments.find(i => instPositionTypeForMerge(i) === p.position && !i.assignedTo && !i.vocalistPlayer);
  if (empty) { empty.assignedTo = p.name; return true; }
  const ALLOW = { keys:['Keys','Keys Pack','Keys'], eg:['Electric','EG Pack','EG'], ag:['Acoustic','Acoustic Pack','AG'] };
  if (ALLOW[p.position] && state.instruments.length < MAX_INSTRUMENTS) {
    const [base, pack, ph] = ALLOW[p.position];
    const count = state.instruments.filter(i => instPositionTypeForMerge(i) === p.position).length + 1;
    state.instruments.push({ id: instUid(), label: `${base} ${count}`, pack, placeholder: `${ph} ${count}`, tag: base, assignedTo: p.name, vocalistPlayer: null, optional: true });
    return true;
  }
  // drums/bass with the single slot occupied: overwrite is wrong; leave for operator (flagged by notice)
  return false;
}

function pcoAddHost(p) {
  const h = state.hosts;
  if (p.host === 'speaker') { if (!h.speaker) h.speaker = p.name; }
  else if (p.host === 'baptismal') { if (!h.hh3) { h.hh3 = p.name; h.hh3IsBaptismal = true; } }
  else { // welcome
    if (!h.welcomeHost1) h.welcomeHost1 = p.name;
    else if (!h.welcomeHost2) h.welcomeHost2 = p.name;
    else if (!h.hh3) h.hh3 = p.name;
  }
}

function pcoAddShadow(p) {
  if (!state.config.enableShadows) return;
  if (state.shadows.length >= (typeof MAX_SHADOWS !== 'undefined' ? MAX_SHADOWS : 6)) return;
  if (state.shadows.some(s => normFullName(s.name) === normFullName(p.name))) return;
  state.shadows.push({ id:'sh_'+Math.random().toString(36).slice(2,8), name:p.name, pack: state.config.shadowPack || 'Misc 2 Pack' });
}

// position-type for an instrument (label-based, with legacy id fallback) — local copy for merge use
function instPositionTypeForMerge(inst) {
  const cls = classifyPosition(inst.label || '');
  if (cls.kind === 'band') return cls.position;
  if (inst.id === 'inst_drums') return 'drums';
  if (inst.id === 'inst_bass') return 'bass';
  if (inst.id === 'inst_keys') return 'keys';
  if (inst.id === 'inst_eg1' || inst.id === 'inst_eg2') return 'eg';
  if (inst.id === 'inst_ag') return 'ag';
  return null;
}

function pcoAddPerson(p) {
  if (p.kind === 'vocalist') pcoAddVocalist(p);
  else if (p.kind === 'band') pcoAddBand(p);
  else if (p.kind === 'host') pcoAddHost(p);
  else if (p.kind === 'shadow') pcoAddShadow(p);
  else if (p.kind === 'md') { const inst = state.instruments.find(i => normFullName(i.assignedTo) === normFullName(p.name)); if (inst) state.musicDirectorId = inst.id; }
}

function pcoRemovePerson(p) {
  if (p.kind === 'vocalist') {
    const idx = state.vocalists.findIndex(v => normFullName(v.name) === normFullName(p.name));
    if (idx === -1) return;
    const vid = state.vocalists[idx].id;
    state.vocalists.splice(idx, 1);
    // null the slot in place (do NOT compact — keeps everyone else's slot index + custom position)
    state.assignments = state.assignments.map(id => id === vid ? null : id);
    state.instruments.forEach(i => { if (i.vocalistPlayer === vid) i.vocalistPlayer = null; });
  } else if (p.kind === 'band') {
    const inst = state.instruments.find(i => normFullName(i.assignedTo) === normFullName(p.name));
    if (inst) { inst.assignedTo = ''; if (state.musicDirectorId === inst.id) state.musicDirectorId = null; }
  } else if (p.kind === 'host') {
    const h = state.hosts;
    ['speaker','welcomeHost1','welcomeHost2','hh3'].forEach(k => { if (normFullName(h[k]) === normFullName(p.name)) { h[k] = ''; if (k === 'hh3') h.hh3IsBaptismal = false; } });
  } else if (p.kind === 'shadow') {
    state.shadows = state.shadows.filter(s => normFullName(s.name) !== normFullName(p.name));
  } else if (p.kind === 'md') {
    const inst = state.instruments.find(i => normFullName(i.assignedTo) === normFullName(p.name));
    if (inst && state.musicDirectorId === inst.id) state.musicDirectorId = null;
  }
}

function pcoRenamePerson(from, to) {
  if (from.kind === 'vocalist') {
    const v = state.vocalists.find(x => normFullName(x.name) === normFullName(from.name));
    if (v) v.name = to.name;
  } else if (from.kind === 'band' || from.kind === 'md') {
    const inst = state.instruments.find(i => normFullName(i.assignedTo) === normFullName(from.name));
    if (inst) inst.assignedTo = to.name;
  } else if (from.kind === 'host') {
    const h = state.hosts;
    ['speaker','welcomeHost1','welcomeHost2','hh3'].forEach(k => { if (normFullName(h[k]) === normFullName(from.name)) h[k] = to.name; });
  } else if (from.kind === 'shadow') {
    const s = state.shadows.find(x => normFullName(x.name) === normFullName(from.name));
    if (s) s.name = to.name;
  }
}

// Role change = remove from old role, add to new role, then carry any custom stage XY across.
function pcoReslotPerson(from, to) {
  const oldKey = from.kind === 'band' ? from.pcoId && (state.instruments.find(i => normFullName(i.assignedTo) === normFullName(from.name)) || {}).id : null;
  const oldCustom = oldKey && state.config.customStagePositions ? state.config.customStagePositions[oldKey] : null;
  pcoRemovePerson(from);
  pcoAddPerson(to);
  if (oldCustom) {
    const newInst = state.instruments.find(i => normFullName(i.assignedTo) === normFullName(to.name));
    if (newInst) { state.config.customStagePositions = state.config.customStagePositions || {}; state.config.customStagePositions[newInst.id] = oldCustom; }
  }
}

// applyPcoMerge: apply the change-list to live state. `next` is the fresh derivePcoModel (for service order/meta).
function applyPcoMerge(changeList, next) {
  if (changeList.metaChanged && next && next.meta) {
    if (next.meta.title) state.service.name = next.meta.title;
    if (next.meta.date) state.service.date = next.meta.date;
  }
  if (changeList.serviceOrderChanged && next) {
    state.serviceOrder = (next.serviceOrder || []).map(s => ({ id:s.id, kind:s.kind, title:s.title, length:s.length, key:s.key, leader:s.leader, notes:s.notes }));
  }
  changeList.hardRemoved.forEach(pcoRemovePerson);
  changeList.declined.forEach(pcoRemovePerson);
  changeList.renamed.forEach(c => pcoRenamePerson(c.from, c.to));
  changeList.roleChanged.forEach(c => pcoReslotPerson(c.from, c.to));
  changeList.added.forEach(pcoAddPerson);
}
```

> Note: `MAX_INSTRUMENTS` is an existing constant (grep `MAX_INSTRUMENTS`); `instPositionTypeForMerge` deliberately duplicates the inline `instPositionType` from `applyPCOPlanData` because that one is a closure-local function, not reachable here.

- [ ] **Step 4: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcomerge.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 5: Commit**

```bash
npm run check
git add index.html tests/pcomerge.js
git commit -m "feat(pco): add merge apply helpers that preserve manual edits"
```

---

## Task 5: `pcoMergeRefresh` orchestrator + guards

Ties it together: guard → fetch → derive → diff → apply → update baseline → save/render → notify. Adds the manual-pause flag.

**Files:**
- Modify: `index.html` — `DEFAULT_STATE.config` (~1985, add `autoRefreshPaused`), after `applyPcoMerge`
- Test: `tests/pcorefresh.js`

- [ ] **Step 1: Add the pause flag to `DEFAULT_STATE.config`.** Inside the `config: {` block (~1985), add:

```js
    autoRefreshPaused: false,
```

- [ ] **Step 2: Write the failing test** — `tests/pcorefresh.js`. Guards are testable without network by stubbing `pcoFetch` and forcing conditions.

```js
  console.log('--- pcoMergeRefresh guards ---');

  // Stub network: derive-able fixed responses. Track whether a fetch happened.
  ev(`
    window.__fetchCount = 0;
    window.__nextTM = { data:[ {id:'tm1',attributes:{name:'Jake',team_position_name:'Worship Leader',status:'C'}} ] };
    pcoFetch = async function(p){
      window.__fetchCount++;
      if (/team_members/.test(p)) return window.__nextTM;
      if (/\\/plans\\//.test(p) && !/items/.test(p)) return { data:{ attributes:{ title:'T', sort_date:'2026-07-05T00:00:00Z' } } };
      return { data:[], included:[] };
    };
    state.pcoConfig.selectedServiceTypeId='st1';
    state.pcoConfig.selectedPlanId='p1';
  `);

  check('skips quietly when no plan selected', async()=>{
    ev(`state.pcoConfig.selectedPlanId=''; window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    if (ev('window.__fetchCount')!==0) throw new Error('fetched with no plan');
    ev(`state.pcoConfig.selectedPlanId='p1';`);
  });
  check('skips while editing layout', async()=>{
    ev(`document.body.classList.add('stage-editing'); window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    ev(`document.body.classList.remove('stage-editing');`);
    if (ev('window.__fetchCount')!==0) throw new Error('fetched while editing');
  });
  check('skips when paused', async()=>{
    ev(`state.config.autoRefreshPaused=true; window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    ev(`state.config.autoRefreshPaused=false;`);
    if (ev('window.__fetchCount')!==0) throw new Error('fetched while paused');
  });
  check('a real refresh fetches, merges, and updates the baseline', async()=>{
    ev(`state.pcoBaseline = { planId:'p1', meta:{title:'T',date:'2026-07-05'}, serviceOrder:[], people:[] };
        state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    if (ev('window.__fetchCount') < 1) throw new Error('did not fetch');
    if (!/Jake/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('Jake not merged in');
    if (ev('state.pcoBaseline.people.length')!==1) throw new Error('baseline not updated');
  });
```

> Note: checks here are `async` — the harness `check()` runs `fn()` synchronously, so wrap each async body and `await` it. Replace the harness `check` in THIS file with an async-aware version:
> ```js
> async function check(label, fn){ try{ await fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
> ```
> and make the outer `setTimeout` callback `async` and `await` each check in sequence.

- [ ] **Step 3: Run test, verify it fails**

Run: `SA_HTML=index.html node tests/pcorefresh.js`
Expected: FAIL `pcoMergeRefresh is not defined`.

- [ ] **Step 4: Implement `pcoMergeRefresh`** — insert after `applyPcoMerge`:

```js
let pcoMergeInFlight = false;

// Returns true if a refresh is allowed to run right now.
function pcoCanRefresh() {
  if (pcoMergeInFlight) return false;
  if (!pcoTokens) return false;                                  // not connected
  if (!state.pcoConfig.selectedPlanId) return false;             // no plan
  if (state.config.autoRefreshPaused) return false;              // user paused
  if (isStageEditing()) return false;                            // mid-edit
  if (document.querySelector('.overlay[style*="display: block"], .overlay[style*="display:block"]')) return false; // a sheet/modal open
  return true;
}

// Pull latest plan, merge into live state preserving edits, update baseline, notify.
async function pcoMergeRefresh() {
  if (!pcoCanRefresh()) return;
  pcoMergeInFlight = true;
  try {
    const stId = state.pcoConfig.selectedServiceTypeId;
    const planId = state.pcoConfig.selectedPlanId;
    const tmRes = await pcoFetch(`/services/v2/service_types/${stId}/plans/${planId}/team_members?per_page=100`);
    const planRes = await pcoFetch(`/services/v2/service_types/${stId}/plans/${planId}`);
    let itemsRes = { data:[], included:[] };
    try { itemsRes = await pcoFetch(`/services/v2/service_types/${stId}/plans/${planId}/items?include=song,item_notes&per_page=100`); } catch(e){ console.warn('items fetch failed', e); }

    const next = derivePcoModel(planRes.data, tmRes, itemsRes);
    next.planId = planId;
    // If the stored baseline is for a different plan, treat as no baseline (everything is "add").
    const baseline = (state.pcoBaseline && state.pcoBaseline.planId === planId) ? state.pcoBaseline : null;
    const changeList = diffPcoModel(baseline, next);

    if (changeList.hasChanges) {
      applyPcoMerge(changeList, next);
    }
    state.pcoBaseline = next;
    saveState();
    if (changeList.hasChanges) { renderAll(); pcoMergeNotify(changeList); }
    setPCOStatus('Synced ✓','ok');
  } catch (e) {
    console.warn('merge refresh failed', e);
    setPCOStatus('Auto-refresh failed','err');
  } finally {
    pcoMergeInFlight = false;
  }
}
```

- [ ] **Step 5: Add a temporary no-op `pcoMergeNotify`** so the orchestrator test runs before Task 6 builds the real one. Insert right after `pcoMergeRefresh`:

```js
function pcoMergeNotify(changeList) { /* implemented in Task 6 */ }
```

- [ ] **Step 6: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcorefresh.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 7: Commit**

```bash
npm run check
git add index.html tests/pcorefresh.js
git commit -m "feat(pco): add pcoMergeRefresh orchestrator with guards"
```

---

## Task 6: Notification banner (⚠ needs you / ℹ FYI)

Replace the stub `pcoMergeNotify`. Build a toast summary plus a non-blocking banner. Needs-you items are sticky; FYI items are dismissable.

**Files:**
- Modify: `index.html` — PCO-bar HTML (~1497, add banner container), CSS (near `.pco-bar` rules), replace `pcoMergeNotify`, add `renderPcoMergeBanner`
- Test: `tests/pcorefresh.js` (extend)

- [ ] **Step 1: Add the banner container to the HTML.** Immediately after the closing `</div>` of `<div class="pco-bar" id="pcoBar" ...>` (~line 1503), add:

```html
<div class="pco-merge-banner" id="pcoMergeBanner" style="display:none;"></div>
```

- [ ] **Step 2: Add CSS.** Find the `.pco-bar{` rule (grep `.pco-bar{`) and add after it:

```css
.pco-merge-banner{display:flex;flex-wrap:wrap;gap:8px;padding:8px 20px;background:var(--bg-elev);border-bottom:1px solid var(--border);font-size:12.5px}
.pmn-item{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:8px;border:1px solid var(--border)}
.pmn-item.warn{border-color:var(--accent);background:var(--accent-dim)}
.pmn-item.fyi{color:var(--text-muted)}
.pmn-x{cursor:pointer;border:none;background:transparent;color:inherit;font-family:var(--ff-mono);font-size:13px;line-height:1;padding:0 2px}
```

- [ ] **Step 3: Replace the stub `pcoMergeNotify` and add `renderPcoMergeBanner`.** Ephemeral notices live in a module var (not persisted). Replace `function pcoMergeNotify(changeList) { /* implemented in Task 6 */ }` with:

```js
let pcoMergeNotices = { needs: [], fyi: [] };   // {id, text} entries; ephemeral

function pcoMergeNotify(changeList) {
  // Sticky ⚠ needs-you: adds (assign mic/position) + declines (find a sub)
  changeList.added.forEach(p => pcoMergeNotices.needs.push({ id:'n_'+p.pcoId, text:`⚠ ${p.name} added — assign mic/position` }));
  changeList.declined.forEach(p => pcoMergeNotices.needs.push({ id:'d_'+p.pcoId, text:`⚠ ${p.name} declined — find a sub` }));
  // ℹ FYI (dismissable): hard removals, role changes, renames
  changeList.hardRemoved.forEach(p => pcoMergeNotices.fyi.push({ id:'r_'+p.pcoId, text:`ℹ ${p.name} removed from plan` }));
  changeList.roleChanged.forEach(c => pcoMergeNotices.fyi.push({ id:'rc_'+c.to.pcoId, text:`ℹ ${c.to.name} role changed → ${c.to.position||c.to.kind}` }));
  changeList.renamed.forEach(c => pcoMergeNotices.fyi.push({ id:'rn_'+c.to.pcoId, text:`ℹ renamed → ${c.to.name}` }));
  // de-dupe by id (a re-fire shouldn't stack)
  const dedupe = arr => { const seen=new Set(); return arr.filter(n=>!seen.has(n.id)&&seen.add(n.id)); };
  pcoMergeNotices.needs = dedupe(pcoMergeNotices.needs);
  pcoMergeNotices.fyi = dedupe(pcoMergeNotices.fyi);
  // transient toast summary
  const bits = [];
  if (changeList.added.length) bits.push(`+${changeList.added.length} person`);
  if (changeList.declined.length) bits.push(`${changeList.declined.length} declined`);
  if (changeList.hardRemoved.length) bits.push(`-${changeList.hardRemoved.length} removed`);
  if (changeList.serviceOrderChanged) bits.push('service order');
  if (bits.length) toast('Synced: ' + bits.join(', '), 'success');
  renderPcoMergeBanner();
}

function renderPcoMergeBanner() {
  const el = document.getElementById('pcoMergeBanner');
  if (!el) return;
  const all = [
    ...pcoMergeNotices.needs.map(n => ({ ...n, cls:'warn' })),
    ...pcoMergeNotices.fyi.map(n => ({ ...n, cls:'fyi' }))
  ];
  if (!all.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  el.innerHTML = all.map(n => `<span class="pmn-item ${n.cls}"><span>${n.text}</span><button class="pmn-x" data-notice="${n.id}" title="Dismiss">×</button></span>`).join('');
  el.querySelectorAll('.pmn-x').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.notice;
    pcoMergeNotices.needs = pcoMergeNotices.needs.filter(n => n.id !== id);
    pcoMergeNotices.fyi = pcoMergeNotices.fyi.filter(n => n.id !== id);
    renderPcoMergeBanner();
  }));
}
```

- [ ] **Step 4: Add banner checks to `tests/pcorefresh.js`** (after the existing checks):

```js
  check('notify renders sticky ⚠ for adds and dismissable ℹ for removals', async()=>{
    ev(`pcoMergeNotices={needs:[],fyi:[]};`);
    ev(`pcoMergeNotify({added:[{pcoId:'tmA',name:'Mia'}], declined:[], hardRemoved:[{pcoId:'tmB',name:'Sam'}], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true})`);
    const b = doc.getElementById('pcoMergeBanner');
    if (b.style.display==='none') throw new Error('banner hidden');
    if (!/Mia added/.test(b.textContent)) throw new Error('missing add notice');
    if (!/Sam removed/.test(b.textContent)) throw new Error('missing fyi notice');
    if (b.querySelectorAll('.pmn-item.warn').length!==1) throw new Error('warn count wrong');
  });
  check('dismiss removes a notice', async()=>{
    const b = doc.getElementById('pcoMergeBanner');
    b.querySelector('.pmn-item.fyi .pmn-x').click();
    if (/Sam removed/.test(b.textContent)) throw new Error('fyi notice not dismissed');
  });
```

- [ ] **Step 5: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcorefresh.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 6: Commit**

```bash
npm run check
git add index.html tests/pcorefresh.js
git commit -m "feat(pco): add merge notification banner (needs-you / fyi)"
```

---

## Task 7: Wire the timer, repurpose ↻ Refresh, add the pause toggle

Start the 3-min interval, point the existing ↻ Refresh button at `pcoMergeRefresh`, and add a pause checkbox to the PCO bar.

**Files:**
- Modify: `index.html` — PCO-bar HTML (~1502), `init()` (~11853 refresh wiring; end of init for interval)
- Test: `tests/pcorefresh.js` (extend)

- [ ] **Step 1: Add the constant + starter.** Insert after `pcoMergeRefresh` (or near the other PCO functions):

```js
const AUTO_REFRESH_MS = 180000;   // 3 minutes
let pcoAutoRefreshTimer = null;
function startPcoAutoRefresh() {
  if (pcoAutoRefreshTimer) return;
  pcoAutoRefreshTimer = setInterval(() => { pcoMergeRefresh(); }, AUTO_REFRESH_MS);
}
```

- [ ] **Step 2: Add the pause toggle to the PCO bar HTML.** Find the `#pcoRefreshBtn` button (~1502) and add immediately after it:

```html
  <label class="pco-pause" title="Pause auto-refresh"><input type="checkbox" id="pcoAutoPause"> Pause auto-refresh</label>
```

- [ ] **Step 3: Repurpose the ↻ Refresh wiring.** Find in `init()` (~11853):

```js
  document.getElementById('pcoRefreshBtn').addEventListener('click', () => { if (state.pcoConfig.selectedPlanId) pcoPullPlan(state.pcoConfig.selectedPlanId); });
```

Replace with:

```js
  document.getElementById('pcoRefreshBtn').addEventListener('click', () => { pcoMergeRefresh(); });
  const autoPause = document.getElementById('pcoAutoPause');
  if (autoPause) {
    autoPause.checked = !!state.config.autoRefreshPaused;
    autoPause.addEventListener('change', e => { state.config.autoRefreshPaused = e.target.checked; saveState(); });
  }
  startPcoAutoRefresh();
```

> Behavior change to record in `docs/WATCHLIST.md`: ↻ Refresh now does a **merging** refresh (preserves edits), not a destructive re-pull. Pull Plan remains the destructive fresh start.

- [ ] **Step 4: Add wiring checks to `tests/pcorefresh.js`** (after existing checks):

```js
  check('↻ Refresh button wired to pcoMergeRefresh (not destructive pull)', ()=>{
    // crude source check: the destructive call should no longer be wired to the refresh button
    if (/pcoRefreshBtn'\)\.addEventListener\('click', \(\) => \{ if \(state\.pcoConfig\.selectedPlanId\) pcoPullPlan/.test(html))
      throw new Error('refresh button still calls destructive pcoPullPlan');
    if (!/pcoRefreshBtn'\)\.addEventListener\('click', \(\) => \{ pcoMergeRefresh\(\)/.test(html))
      throw new Error('refresh button not wired to pcoMergeRefresh');
  });
  check('pause checkbox reflects + persists state.config.autoRefreshPaused', ()=>{
    const cb = doc.getElementById('pcoAutoPause');
    if (!cb) throw new Error('no pause checkbox');
    cb.checked = true; cb.dispatchEvent(new window.Event('change'));
    if (!ev('state.config.autoRefreshPaused')) throw new Error('pause not persisted');
    cb.checked = false; cb.dispatchEvent(new window.Event('change'));
  });
```

- [ ] **Step 5: Run test, verify it passes**

Run: `SA_HTML=index.html node tests/pcorefresh.js`
Expected: `=== RESULT: ALL CHECKS PASSED ===`

- [ ] **Step 6: Commit**

```bash
npm run check
git add index.html tests/pcorefresh.js docs/WATCHLIST.md
git commit -m "feat(pco): wire 3-min auto-refresh timer, repurpose Refresh button, add pause toggle"
```

---

## Task 8: Full regression + watchlist

**Files:**
- Modify: `docs/WATCHLIST.md` (add the new behaviors)

- [ ] **Step 1: Add watchlist entries** for: (a) ↻ Refresh merges instead of destroying; (b) auto-refresh preserves positions/mics/hand-added/host overrides; (c) decline→auto-remove+notify, hard-remove→auto-remove+FYI, add→notify, role-change→reslot+notify; (d) guards (no refresh while editing/paused/disconnected/in-flight); (e) baseline written on every accepted pull.

- [ ] **Step 2: Run the whole suite**

Run: `npm run check && npm test`
Expected: every test PASS; only `curve.js` may be a known `PASS*`. Any other FAIL is a regression — fix before shipping.

- [ ] **Step 3: Commit**

```bash
git add docs/WATCHLIST.md
git commit -m "docs: add PCO merge auto-refresh to regression watchlist"
```

- [ ] **Step 4: Manual booth-machine smoke test (report to Dillon, do not auto-deploy):**
  1. Pull a plan, drag a couple of vocalists, hand-assign a mic, type in one extra vocalist.
  2. In Planning Center: add a person, decline another, reorder a song, change a key.
  3. Click ↻ Refresh (or wait 3 min). Confirm: your drags/mic/added person survive; the new person + decline show ⚠ in the banner; the removed/role/rename show ℹ; songs/keys update.
  4. Enter Edit Layout, wait past a tick → confirm no refresh fires. Toggle Pause → confirm timer stops.

---

## Self-review notes (author check against spec)

- **Spec §2 baseline (what/when/why):** Task 3 (write on pull) + Task 5 (write on merge) + `DEFAULT_STATE.pcoBaseline`. ✓
- **Spec §3 merge flow (derive→diff→apply→commit→notify):** Tasks 1,2,4,5,6. ✓
- **Spec §4 rule matrix:** add→Task4 `pcoAddPerson` + Task6 ⚠; decline→`pcoRemovePerson` + ⚠; hard-remove→`pcoRemovePerson` + ℹ; role→`pcoReslotPerson` + ℹ; rename→`pcoRenamePerson`; service order/meta→`applyPcoMerge`. ✓
- **Spec preservation guarantees:** Task 4 tests assert position (slot + customStagePositions), mic, hand-added, host override survive. ✓
- **Spec §6 guards/cadence/controls:** Task 5 `pcoCanRefresh` (editing/disconnected/paused/in-flight/modal) + Task 7 timer + pause toggle + repurposed Refresh. Tab-hidden intentionally NOT guarded. ✓
- **Identity by pcoId:** `derivePcoModel` records `pcoId`; `diffPcoModel` keys by it; apply locates live by baseline name. ✓
- **Type consistency:** change-list keys (`added/declined/hardRemoved/roleChanged/renamed/serviceOrderChanged/metaChanged/hasChanges`) identical across Tasks 2,4,5,6. Helper names consistent (`pcoAddPerson/pcoRemovePerson/pcoRenamePerson/pcoReslotPerson/applyPcoMerge/pcoMergeRefresh/pcoMergeNotify/renderPcoMergeBanner`). ✓
- **Out of scope honored:** no hosted sync, no configurable-cadence UI. One small spec deviation: adds attempt a free mic via `pcoFreeMic()` and still always flag ⚠ (spec said "free mic if available"). ✓
