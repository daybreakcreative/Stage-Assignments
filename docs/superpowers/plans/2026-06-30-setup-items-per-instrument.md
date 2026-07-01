# Per-instrument Setup Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat setup-items model with a grouped, per-instrument catalog whose defaults are configured per church in the wizard, seeded once per person (no duplicates), edited via a per-person option selector, and reviewed for last-minute adds.

**Architecture:** Three layers — a built-in **option catalog** (`SETUP_TEMPLATES`, grouped radio/check options, no defaults), **church defaults** (`state.config.setupDefaults`, chosen in the wizard), and **per-person instances** (`state.setupItems[stableKey]` with `selections`/`customItems`/`items`/`seeded`/`needsReview`). Pure resolve/seed/migrate functions form the core; the editor, check-off view, wizard step, and post-pull dialog are thin renderers over them.

**Tech Stack:** Vanilla single-file `index.html`; `localStorage` state; jsdom tests in `tests/`; validate with `npm run check` and `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-30-setup-items-per-instrument-design.md`

---

## Golden constraints (from CLAUDE.md)

- Everything ships in `index.html`. No build step.
- Re-grep for anchors before each edit — line numbers drift.
- Commit locally on the current branch; do NOT push (deploy is a separate, user-approved step). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Subagent git safety:** only `git add/commit/rev-parse/log/diff/show/status`. NEVER `git checkout/reset/restore/stash/clean/revert/rebase/branch/switch` (a prior agent corrupted the tree this way).
- After any timer/interval work, confirm `npm test` exits promptly (not relevant here, but keep in mind).

## Existing anchors (re-grep before editing)

- `detectPresetKey(inst)` ~2188 → returns `drums|bass|eg|ag|keys|md|strings|null`. Reuse as the instrument-type resolver.
- `SETUP_ITEM_PRESETS` ~2074 (flat, being replaced); `SETUP_PRESETS` (wizard chips, being replaced); `getSetupPresets()` ~2184.
- Per-person keys: `setupKeyForBand(name,instId)` ~2515-region (~8515), `setupKeyForVocal` ~8518, `setupKeyForShadow` ~8521, `setupTagKey` ~8525. Volatile `name|inst.id` keying is the duplicate bug source.
- `ensureSetupBucket(key)` ~8559; `newSetupItem(text,scopeOneTime)` ~8567; `maybeRollOverToNewService()` ~8579; `setupCompletionStats(key)` ~8612.
- `getStageAreas()` ~8625; `renderSetupItemsView()` ~8749; `renderAreaCard`/`renderPersonCard`; `wireSetupItemsContent()` ~8905; `refreshSetupItemsUI()` ~9095.
- `renderPresetEditor(wrap,pKey)` ~9328 (Advanced Settings preset editor, being replaced); `openSaveOptionsMenu` ~9406; `renderSetupManager()` ~6065.
- `updateSetupProgressBadge()` ~9659 + `#setupNavBadge` (~1496).
- Wizard: `WIZARD_STEPS` ~9875 (includes `setup-intro`); `renderWizardStepBody` `case 'setup-intro'` ~11104; wizard wiring `if (step === 'setup-intro')` ~11789.
- `openPostPullPopup(planContext)` ~10072 (post-pull dialog — the consolidated review hooks in near here).
- PCO merge: `applyPcoMerge`/`pcoMergeNotify`/`pcoMergeRefresh` (added-people list) — from the prior feature.
- Existing setup tests to update: `tests/setuppresets.js`, `tests/setupmgr.js`, `tests/checklist.js`, `tests/checklist2.js` (if present), `tests/shadows.js` (shadow setup).

## Test harness header (copy into every new test file)

```js
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'http://localhost/',
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
  // checks
  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
```

---

# PHASE A — Data model, seeding, migration (no UI)

## Task 1: `SETUP_TEMPLATES` catalog

**Files:** Modify `index.html` (add constant next to `SETUP_ITEM_PRESETS` ~2074). Test: `tests/setupcatalog.js`.

- [ ] **Step 1: Write the failing test** — `tests/setupcatalog.js` (harness + checks):

```js
  console.log('--- SETUP_TEMPLATES catalog ---');
  check('all 8 instrument keys present', ()=>{
    const keys = ev('Object.keys(SETUP_TEMPLATES).sort().join(",")');
    if (keys !== 'ag,bass,drums,eg,keys,md,strings,vocals') throw new Error('keys: '+keys);
  });
  check('every group is well-formed (id, name, type radio|check, unique option ids)', ()=>{
    const bad = ev(`(function(){
      const errs=[];
      for (const k in SETUP_TEMPLATES){
        const t=SETUP_TEMPLATES[k];
        if(!t.label) errs.push(k+':no label');
        (t.groups||[]).forEach(g=>{
          if(!g.id||!g.name) errs.push(k+':group missing id/name');
          if(g.type!=='radio'&&g.type!=='check') errs.push(k+'/'+g.id+':bad type');
          const ids=(g.options||[]).map(o=>o.id);
          if(ids.some(x=>!x)) errs.push(k+'/'+g.id+':option missing id');
          if(new Set(ids).size!==ids.length) errs.push(k+'/'+g.id+':dup option ids');
          (g.options||[]).forEach(o=>{ if(!o.text) errs.push(k+'/'+g.id+':option missing text'); });
        });
      }
      return errs.join('|');
    })()`);
    if (bad) throw new Error(bad);
  });
  check('no built-in defaults (defaults come from church config)', ()=>{
    const hasDefault = ev(`Object.values(SETUP_TEMPLATES).some(t=>(t.groups||[]).some(g=>(g.options||[]).some(o=>o.default)))`);
    if (hasDefault) throw new Error('a catalog option has a built-in default');
  });
  check('bass rig is radio; bass inputs is check; eg stereo option carries addItems', ()=>{
    const bassRig = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='rig').type`);
    if (bassRig !== 'radio') throw new Error('bass rig not radio');
    const bassInputs = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='inputs').type`);
    if (bassInputs !== 'check') throw new Error('bass inputs not check');
    const egStereo = ev(`SETUP_TEMPLATES.eg.groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_stereo').addItems.length`);
    if (egStereo !== 3) throw new Error('eg stereo addItems wrong');
  });
```

- [ ] **Step 2: Run, confirm FAIL:** `SA_HTML=index.html node tests/setupcatalog.js` → `SETUP_TEMPLATES is not defined`.

- [ ] **Step 3: Implement** — insert immediately AFTER the `SETUP_ITEM_PRESETS` object's closing `};` (~2181):

```js
// Grouped option catalog per instrument. NO built-in defaults — the church selects its
// defaults per instrument in the wizard (state.config.setupDefaults). type:'radio'=pick one,
// type:'check'=pick any. addItems = extra checklist lines an option implies when selected.
const SETUP_TEMPLATES = {
  drums: { label:'Drums', groups:[
    { id:'options', name:'Options', type:'check', options:[
      { id:'d_rmsnare', text:'Remove snare (bringing own snare)' },
      { id:'d_rmcym',   text:'Remove cymbals (bringing own cymbals)' },
      { id:'d_side',    text:'Bringing side snare' },
      { id:'d_tom3',    text:'Bringing tom 3' },
      { id:'d_music',   text:'Needs music stand' },
      { id:'d_sticks',  text:'Needs drum sticks' },
    ]},
  ]},
  bass: { label:'Bass', groups:[
    { id:'rig', name:'Rig', type:'radio', options:[
      { id:'b_house',  text:'House bass rig' },
      { id:'b_player', text:'XLR for player bass rig' },
    ]},
    { id:'inputs', name:'Inputs', type:'check', options:[
      { id:'b_clean', text:'Clean & dirty setup (2 inputs)' },
      { id:'b_synth', text:'Synth bass (2 inputs)' },
    ]},
    { id:'extras', name:'Cabling & extras', type:'check', options:[
      { id:'b_di',    text:'Needs DI' },
      { id:'b_10',    text:"Needs 10' 1/4\" cable" },
      { id:'b_talk',  text:'Needs talkback mic' },
      { id:'b_music', text:'Music stand' },
      { id:'b_stand', text:'Guitar stand' },
    ]},
  ]},
  ag: { label:'Acoustic Guitar', groups:[
    { id:'rig', name:'Rig / signal', type:'radio', options:[
      { id:'ag_wireless', text:'Wireless AG rig' },
      { id:'ag_tunerdi',  text:'House AG tuner/DI' },
      { id:'ag_xlr',      text:'XLR for player AG rig' },
    ]},
    { id:'extras', name:'Extras', type:'check', options:[
      { id:'ag_house', text:'Needs house acoustic guitar' },
      { id:'ag_10',    text:"Needs 10' 1/4\" cable" },
      { id:'ag_music', text:'Music stand' },
      { id:'ag_power', text:'Power needed' },
      { id:'ag_stand', text:'Guitar stand' },
    ]},
  ]},
  eg: { label:'Electric Guitar', groups:[
    { id:'rig', name:'Rig', type:'radio', options:[
      { id:'eg_house',  text:'House EG rig' },
      { id:'eg_mono',   text:'Mono guitar rig', addItems:['Mono DI box','Amp & mic setup (mono)','XLR for player EG rig (mono)'] },
      { id:'eg_stereo', text:'Stereo guitar rig', addItems:['Stereo DI box','Amp & mic setup (stereo)','2 XLRs for player EG rig'] },
    ]},
    { id:'stand', name:'Guitar stand', type:'radio', options:[
      { id:'eg_single', text:'Single guitar stand' },
      { id:'eg_multi',  text:'Multi guitar stand (bringing multiple EGs)' },
    ]},
    { id:'extras', name:'Extras', type:'check', options:[
      { id:'eg_10',   text:"Needs 10' 1/4\" cable" },
      { id:'eg_talk', text:'Needs talkback mic' },
    ]},
  ]},
  keys: { label:'Keys', groups:[
    { id:'source', name:'Signal source', type:'radio', options:[
      { id:'k_house',  text:'House keys rig' },
      { id:'k_analog', text:'Sounds from keyboard — analog' },
      { id:'k_iface',  text:'Sounds from computer — interface', addItems:['Needs interface'] },
      { id:'k_dante',  text:'Sounds from computer — Dante', addItems:['Needs network — thunderbolt adapter'] },
    ]},
    { id:'inputs', name:'Stereo inputs', type:'radio', options:[
      { id:'k_in1', text:'1 stereo input' },
      { id:'k_in2', text:'2 stereo inputs' },
      { id:'k_in3', text:'3 stereo inputs' },
    ]},
    { id:'cabling', name:'Cabling / interface', type:'check', options:[
      { id:'k_di',   text:'Stereo DI/DIs & 1/4" cables' },
      { id:'k_xlrk', text:'XLR out of keyboard' },
      { id:'k_xlri', text:'XLR out of interface' },
      { id:'k_qi',   text:'1/4" out of interface' },
      { id:'k_bi',   text:'Bringing interface' },
    ]},
    { id:'extras', name:'Extras', type:'check', options:[
      { id:'k_remove', text:'Remove keyboard (bringing own keyboard)' },
      { id:'k_laptop', text:'Laptop stand' },
      { id:'k_2nd',    text:'2nd keys stand (2 keyboards)' },
      { id:'k_music',  text:'Music stand' },
    ]},
  ]},
  md: { label:'Music Director / Tracks', groups:[
    { id:'rig', name:'Rig', type:'check', options:[
      { id:'md_tracks', text:'House tracks computer' },
      { id:'md_dante',  text:'House Dante tracks rig' },
      { id:'md_stand',  text:'Computer stand' },
      { id:'md_talk',   text:'Talkback mic & opto gate' },
    ]},
    { id:'extras', name:'Extras', type:'check', options:[
      { id:'md_music', text:'Music stand' },
    ]},
  ]},
  strings: { label:'Violin / Cello', groups:[
    { id:'pickup', name:'Pickup', type:'radio', options:[
      { id:'s_house',  text:'House clip & mic' },
      { id:'s_player', text:'Player mic & clip / instrument pickup' },
    ]},
    { id:'conn', name:'Connection', type:'radio', options:[
      { id:'s_wireless', text:'Needs wireless pack' },
      { id:'s_di',       text:'Needs DI box & 1/4"' },
      { id:'s_xlr',      text:'XLR only' },
    ]},
    { id:'extras', name:'Extras', type:'check', options:[
      { id:'s_power', text:'Power needed' },
      { id:'s_music', text:'Music stand' },
      { id:'s_stand', text:'Needs instrument stand' },
    ]},
  ]},
  vocals: { label:'Vocals', groups:[
    { id:'options', name:'Options', type:'check', options:[
      { id:'v_stand', text:'Straight mic stand on stage' },
    ]},
  ]},
};
```

- [ ] **Step 4: Run, confirm PASS.** `SA_HTML=index.html node tests/setupcatalog.js` → ALL CHECKS PASSED.
- [ ] **Step 5: `npm run check` then commit** `index.html tests/setupcatalog.js` — `feat(setup): add grouped SETUP_TEMPLATES option catalog`.

---

## Task 2: Pure resolve + church-defaults helpers

**Files:** Modify `index.html` (insert after `SETUP_TEMPLATES`). Test: `tests/setupresolve.js`.

Functions:
- `setupCatalogFor(key)` → `SETUP_TEMPLATES[key] || null`.
- `churchSetupDefaults(key)` → `state.config.setupDefaults?.[key] || { selections:{}, customOptions:[] }`.
- `defaultSelectionsFor(key)` → church selections clone, or `{}` if none.
- `resolveSetupItems(key, selections, customItems)` → array of `{ text }` lines: for each group, for each selected option include its `text` and any `addItems`; append `customItems` texts. Radio selection is a single id; check is an array of ids. Deterministic order (catalog order, then customs).

- [ ] **Step 1: Write `tests/setupresolve.js`:**

```js
  console.log('--- resolveSetupItems / church defaults ---');
  check('resolve turns selections into ordered lines incl addItems + customs', ()=>{
    const sel = JSON.stringify({ rig:'eg_stereo', stand:'eg_single', extras:['eg_10'] });
    const lines = ev(`resolveSetupItems('eg', ${sel}, [{text:'Custom pedalboard power'}]).map(i=>i.text)`);
    // stereo rig expands to 3 addItems (+ the rig label), single stand, 10' cable, custom last
    if (!lines.includes('Stereo guitar rig')) throw new Error('missing rig label: '+lines.join('|'));
    if (!lines.includes('Stereo DI box') || !lines.includes('2 XLRs for player EG rig')) throw new Error('missing addItems');
    if (!lines.includes('Single guitar stand')) throw new Error('missing stand');
    if (lines[lines.length-1] !== 'Custom pedalboard power') throw new Error('custom not last');
  });
  check('empty selections resolve to just customs', ()=>{
    const lines = ev(`resolveSetupItems('bass', {}, [{text:'X'}]).map(i=>i.text).join(",")`);
    if (lines !== 'X') throw new Error('got: '+lines);
  });
  check('churchSetupDefaults reads state.config.setupDefaults', ()=>{
    ev(`state.config.setupDefaults = { bass:{ selections:{ rig:'b_house', extras:['b_di'] }, customOptions:[] } };`);
    const d = ev(`JSON.stringify(churchSetupDefaults('bass').selections)`);
    if (!/b_house/.test(d)) throw new Error('defaults not read: '+d);
    ev(`state.config.setupDefaults = null;`);
    const empty = ev(`JSON.stringify(churchSetupDefaults('bass'))`);
    if (empty !== '{"selections":{},"customOptions":[]}') throw new Error('empty default wrong: '+empty);
  });
```

- [ ] **Step 2: Run, confirm FAIL.**
- [ ] **Step 3: Implement** (insert after `SETUP_TEMPLATES`):

```js
function setupCatalogFor(key) { return SETUP_TEMPLATES[key] || null; }
function churchSetupDefaults(key) {
  const d = (state.config.setupDefaults && state.config.setupDefaults[key]) || null;
  return d ? { selections: d.selections || {}, customOptions: d.customOptions || [] }
           : { selections: {}, customOptions: [] };
}
function defaultSelectionsFor(key) { return JSON.parse(JSON.stringify(churchSetupDefaults(key).selections || {})); }

// Pure: (key, selections, customItems[]) -> [{text}] resolved checklist lines, catalog order.
function resolveSetupItems(key, selections, customItems) {
  const cat = setupCatalogFor(key);
  const out = [];
  const push = t => { if (t) out.push({ text: t }); };
  if (cat) {
    cat.groups.forEach(g => {
      const sel = selections ? selections[g.id] : undefined;
      const chosenIds = g.type === 'radio' ? (sel ? [sel] : []) : (Array.isArray(sel) ? sel : []);
      g.options.forEach(o => {
        if (chosenIds.indexOf(o.id) === -1) return;
        push(o.text);
        (o.addItems || []).forEach(push);
      });
    });
  }
  (customItems || []).forEach(ci => push(ci.text));
  return out;
}
```

- [ ] **Step 4: Run, confirm PASS.** **Step 5:** `npm run check`; commit `feat(setup): pure resolveSetupItems + church-default helpers`.

---

## Task 3: Stable per-person keys, seeding, and legacy migration

**Files:** Modify `index.html`. Test: `tests/setupmigrate.js`.

Functions:
- `stableSetupKey(name, role, typeKey)` → `` `${normFullName(name)}|${role}|${typeKey||'none'}` `` (role ∈ `band|vocalist|shadow`). Replaces volatile `name|inst.id`.
- `seedPersonSetup(stableKey, typeKey)` → if bucket missing OR not `seeded`, create `{ selections: defaultSelectionsFor(typeKey), customItems:[], items: resolveSetupItems(...), seeded:true, needsReview:false }`; never re-seed if `seeded`.
- `rebuildPersonItems(stableKey, typeKey)` → recompute `.items` from `.selections`+`.customItems`, preserving `doneThisService` by matching on `text` (carry done across re-selection).
- `migrateLegacySetupBuckets()` → for each existing key containing `|` where the segment after `|` is NOT `band/vocalist/shadow` (i.e. legacy `name|inst.id` or `name|tag:x`), map to a stable key by resolving the instrument type, union `.items` (dedupe by text, prefer done), set `seeded:true`, delete legacy key. Idempotent. Call once in `init()` after `ensureVenues`.

- [ ] **Step 1: Write `tests/setupmigrate.js`:**

```js
  console.log('--- stable keys, seed-once, migration ---');
  check('seedPersonSetup seeds once from church defaults, never re-seeds', ()=>{
    ev(`state.config.setupDefaults = { bass:{ selections:{ rig:'b_house', extras:['b_di'] }, customOptions:[] } };`);
    ev(`state.setupItems = {};`);
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    ev(`seedPersonSetup('${k}','bass')`);
    const n1 = ev(`state.setupItems['${k}'].items.length`);
    // mutate then re-seed: must NOT wipe/duplicate
    ev(`state.setupItems['${k}'].items.push({id:'x',text:'manual',doneThisService:false});`);
    ev(`seedPersonSetup('${k}','bass')`);
    const n2 = ev(`state.setupItems['${k}'].items.length`);
    if (n2 !== n1 + 1) throw new Error('re-seed changed items ('+n1+'->'+n2+')');
  });
  check('migration merges legacy name|instId bucket into stable key, no loss, dedupe', ()=>{
    ev(`state.instruments = [{id:'inst_bass', label:'Bass', tag:'Bass', assignedTo:'Sam Lee'}];`);
    ev(`state.setupItems = { 'sam lee|inst_bass': { items:[{id:'a',text:'Needs DI',doneThisService:true},{id:'b',text:'Needs DI',doneThisService:false}] } };`);
    ev(`migrateLegacySetupBuckets()`);
    const legacy = ev(`!!state.setupItems['sam lee|inst_bass']`);
    if (legacy) throw new Error('legacy key not removed');
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    const items = ev(`state.setupItems['${k}'].items`);
    const diCount = items.filter(i=>i.text==='Needs DI').length;
    if (diCount !== 1) throw new Error('dup not merged: '+diCount);
    if (!items.find(i=>i.text==='Needs DI').doneThisService) throw new Error('done-status not preferred');
  });
```

- [ ] **Step 2: Run, confirm FAIL.**
- [ ] **Step 3: Implement** the three functions (insert near the other setup helpers ~8515). Complete code:

```js
function stableSetupKey(name, role, typeKey) {
  return `${normFullName(name)}|${role}|${typeKey || 'none'}`;
}
function seedPersonSetup(stableKey, typeKey) {
  const b = state.setupItems[stableKey];
  if (b && b.seeded) return b;
  const selections = defaultSelectionsFor(typeKey);
  const bucket = state.setupItems[stableKey] || {};
  bucket.selections = selections;
  bucket.customItems = bucket.customItems || [];
  bucket.seeded = true;
  if (!('needsReview' in bucket)) bucket.needsReview = false;
  bucket.items = resolveSetupItems(typeKey, selections, bucket.customItems).map(l => newSetupItem(l.text, false));
  state.setupItems[stableKey] = bucket;
  return bucket;
}
function rebuildPersonItems(stableKey, typeKey) {
  const b = state.setupItems[stableKey];
  if (!b) return;
  const doneByText = {};
  (b.items || []).forEach(it => { if (it.doneThisService) doneByText[it.text] = true; });
  b.items = resolveSetupItems(typeKey, b.selections || {}, b.customItems || []).map(l => {
    const it = newSetupItem(l.text, false);
    if (doneByText[l.text]) it.doneThisService = true;
    return it;
  });
}
function migrateLegacySetupBuckets() {
  const store = state.setupItems || {};
  const ROLES = { band:1, vocalist:1, shadow:1 };
  Object.keys(store).forEach(key => {
    const parts = key.split('|');
    if (parts.length < 2) return;
    // already-stable keys have a known role as the 2nd segment
    if (ROLES[parts[1]]) return;
    const name = parts[0];
    const tail = parts.slice(1).join('|'); // inst id, or "tag:xyz"
    // resolve instrument type
    let typeKey = null, role = 'band';
    if (tail.startsWith('tag:')) { typeKey = detectPresetKey({ tag: tail.slice(4) }); }
    else {
      const inst = (state.instruments || []).find(i => i.id === tail);
      typeKey = inst ? detectPresetKey(inst) : null;
    }
    if (key.endsWith('|vocal') || tail === 'vocal') { role = 'vocalist'; typeKey = 'vocals'; }
    if (key.endsWith('|shadow') || tail === 'shadow') { role = 'shadow'; typeKey = null; }
    const stable = stableSetupKey(name, role, typeKey);
    if (stable === key) return;
    const dst = store[stable] || { selections:{}, customItems:[], items:[], seeded:true, needsReview:false };
    const seen = new Set(dst.items.map(i => (i.text||'').toLowerCase()));
    (store[key].items || []).forEach(it => {
      const t = (it.text||'').toLowerCase();
      const existing = dst.items.find(x => (x.text||'').toLowerCase() === t);
      if (existing) { if (it.doneThisService) existing.doneThisService = true; }
      else { dst.items.push(it); seen.add(t); }
    });
    dst.seeded = true;
    store[stable] = dst;
    delete store[key];
  });
}
```

Note the vocal/shadow key formats: current `setupKeyForVocal` = `name|vocal`? (re-grep ~8518 to confirm the exact suffix and adjust the `endsWith` checks to match reality.)

- [ ] **Step 4:** Wire `migrateLegacySetupBuckets()` into `init()` right after `ensureVenues(state);` (~12125).
- [ ] **Step 5: Run, confirm PASS.** **Step 6:** `npm run check`; **Step 7:** full `npm test` (expect some OLD setup tests to fail now — that's addressed in Phase E; note which fail). Commit `feat(setup): stable keys + seed-once + legacy bucket migration`.

---

## Task 4: State defaults + load-merge

**Files:** Modify `index.html` `DEFAULT_STATE.config` (~1985) and load-merge (~2266). Test: extend `tests/setupmigrate.js`.

- [ ] **Step 1:** Add to `DEFAULT_STATE.config`: `setupDefaults: null,` (after `autoRefreshPaused`).
- [ ] **Step 2:** In the load-merge config literal (~2266, where `pcoConfig`/`display` are merged), preserve: `setupDefaults: (loadedConfig.setupDefaults && typeof loadedConfig.setupDefaults==='object') ? loadedConfig.setupDefaults : null,`.
- [ ] **Step 3:** Add check to `tests/setupmigrate.js`:

```js
  check('state.config.setupDefaults persists shape', ()=>{
    ev(`state.config.setupDefaults = { keys:{ selections:{source:'k_house'}, customOptions:[] } };`);
    ev(`saveState()`);
    const reloaded = ev(`(function(){ const p=JSON.parse(localStorage.getItem(STORAGE_KEY)); return (p.config.setupDefaults&&p.config.setupDefaults.keys.selections.source)||''; })()`);
    if (reloaded !== 'k_house') throw new Error('not persisted: '+reloaded);
  });
```

- [ ] **Step 4: Run, confirm PASS.** **Step 5:** `npm run check`; commit `feat(setup): persist state.config.setupDefaults`.

---

# PHASE B — Per-person editor + check-off view

## Task 5: Grouped per-person setup editor

**Files:** Modify `index.html`. Test: `tests/setupeditor.js`.

Add `renderPersonSetupEditor(container, stableKey, typeKey)` — renders each catalog group as a labeled fieldset: `radio` groups as radio inputs (name=`${stableKey}:${groupId}`), `check` groups as checkboxes, reflecting `bucket.selections`. A "＋ add custom item" input appends to `bucket.customItems`. Any change updates `bucket.selections`/`customItems`, calls `rebuildPersonItems`, `saveState()`, and re-renders the check-off area (`refreshSetupItemsUI()` if present). This replaces the flat quick-add editor (`renderPresetEditor` and the per-person item list in `wireSetupItemsContent`). The implementer MUST read `wireSetupItemsContent` (~8905) and `renderPersonCard` to wire this into the existing person card, following existing class/markup conventions.

- [ ] **Step 1: Write `tests/setupeditor.js`** (drives the function directly):

```js
  console.log('--- per-person grouped editor ---');
  ev(`state.config.setupDefaults = { keys:{ selections:{ source:'k_house', inputs:'k_in2', cabling:['k_di'], extras:[] }, customOptions:[] } };`);
  const k = ev(`stableSetupKey('Jordan Kim','band','keys')`);
  ev(`state.setupItems={}; seedPersonSetup('${k}','keys');`);
  ev(`var wrap=document.createElement('div'); wrap.id='__ed'; document.body.appendChild(wrap); renderPersonSetupEditor(wrap,'${k}','keys');`);

  check('editor renders radio + check groups reflecting seeded church defaults', ()=>{
    const wrap = doc.getElementById('__ed');
    const src = wrap.querySelector('input[type=radio][value="k_house"]');
    if (!src || !src.checked) throw new Error('house source radio not checked');
    const di = wrap.querySelector('input[type=checkbox][value="k_di"]');
    if (!di || !di.checked) throw new Error('DI checkbox not checked');
  });
  check('changing a radio swaps selection + rebuilds items (done preserved by text)', ()=>{
    const wrap = doc.getElementById('__ed');
    ev(`state.setupItems['${k}'].items.forEach(it=>{ if(it.text==='Stereo DI/DIs & 1/4\\" cables') it.doneThisService=true; });`);
    const dante = wrap.querySelector('input[type=radio][value="k_dante"]');
    dante.checked = true; dante.dispatchEvent(new window.Event('change',{bubbles:true}));
    if (ev(`state.setupItems['${k}'].selections.source`) !== 'k_dante') throw new Error('source not updated');
    const texts = ev(`state.setupItems['${k}'].items.map(i=>i.text)`);
    if (!texts.includes('Needs network — thunderbolt adapter')) throw new Error('dante addItem missing');
    if (texts.includes('House keys rig')) throw new Error('old source line lingered');
  });
  check('adding a custom item appends and persists', ()=>{
    const wrap = doc.getElementById('__ed');
    const inp = wrap.querySelector('.sp-custom-input'); const btn = wrap.querySelector('.sp-custom-add');
    inp.value = 'Bring extra sustain pedal'; btn.click();
    if (!ev(`state.setupItems['${k}'].customItems.some(c=>c.text==='Bring extra sustain pedal')`)) throw new Error('custom not saved');
    if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Bring extra sustain pedal')`)) throw new Error('custom not in items');
  });
```

- [ ] **Step 2: Run FAIL.** **Step 3: Implement** `renderPersonSetupEditor` (use classes `sp-group`, `sp-opt`, `sp-custom-input`, `sp-custom-add`; radios grouped by `name="sp:${stableKey}:${groupId}"`). Read `wireSetupItemsContent`/`renderPersonCard` and swap the old per-person item list for a "⚙ Edit setup" affordance that mounts this editor (inline expander or existing modal pattern). **Step 4: Run PASS.** **Step 5:** `npm run check`; commit `feat(setup): grouped per-person setup editor`.

---

## Task 6: Check-off view over the new model

**Files:** Modify `index.html` `getStageAreas`/`renderPersonCard`/`wireSetupItemsContent`/`setupCompletionStats`. Test: `tests/setupcheckoff.js`.

Point the check-off view at stable keys: for each band person resolve `typeKey=detectPresetKey(inst)` and `stableSetupKey(name,'band',typeKey)`; vocalists → `stableSetupKey(name,'vocalist','vocals')`; shadows → `stableSetupKey(name,'shadow',null)`. `seedPersonSetup` on first encounter (seed-once). Render `.items` as done-toggle lines (existing red/yellow/green). Completion stats unchanged. Remove reliance on `getSetupItemsForBand`'s volatile fallback.

- [ ] **Step 1: Write `tests/setupcheckoff.js`:**

```js
  console.log('--- check-off view uses stable keys, no duplicates ---');
  check('two pulls that re-mint inst ids do not duplicate a person bucket', ()=>{
    ev(`state.config.setupDefaults={ bass:{selections:{rig:'b_house'},customOptions:[]} };`);
    ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null);`);
    ev(`state.instruments=[{id:'inst_bass_1',label:'Bass',tag:'Bass',assignedTo:'Sam Lee'}];`);
    ev(`getStageAreas();`);            // first render seeds
    ev(`state.instruments=[{id:'inst_bass_2',label:'Bass',tag:'Bass',assignedTo:'Sam Lee'}];`); // id changed
    ev(`getStageAreas();`);            // second render must reuse stable key
    const keys = ev(`Object.keys(state.setupItems).filter(x=>/sam lee/.test(x))`);
    if (keys.length !== 1) throw new Error('duplicate buckets: '+JSON.stringify(keys));
  });
  check('completion stats count resolved items', ()=>{
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    const s = ev(`JSON.stringify(setupCompletionStats('${k}'))`);
    if (!/"total"/.test(s)) throw new Error('no stats: '+s);
  });
```

- [ ] **Step 2: FAIL → Step 3: Implement** (read `getStageAreas` ~8625 and update person entries to carry `stableKey`+`typeKey`; seed on encounter; render from `bucket.items`). **Step 4: PASS. Step 5:** `npm run check`; commit `feat(setup): check-off view on stable keys (fixes duplicates)`.

---

# PHASE C — Wizard per-instrument defaults

## Task 7: Wizard "setup defaults per instrument" step

**Files:** Modify `index.html` `renderWizardStepBody` `case 'setup-intro'` (~11104) and wizard wiring `if (step === 'setup-intro')` (~11789). Test: `tests/setupwizard.js`.

Keep the yes/no "use setup checklist" toggle. When yes, replace the single flat quick-add chip list with **one collapsible card per instrument the user added** (derive from `wizardData.instruments` selected → `detectPresetKey`/key). Each card renders that instrument's catalog groups with **nothing pre-checked**; ticking writes `state.config.setupDefaults[key].selections`; a per-card custom-add appends to `customOptions`. Reuse `renderPersonSetupEditor`'s group-rendering by extracting a shared `renderSetupGroups(container, catalogKey, selections, onChange)` helper (refactor Task 5 to use it too — DRY).

- [ ] **Step 1: Write `tests/setupwizard.js`:**

```js
  console.log('--- wizard sets church defaults per instrument ---');
  check('ticking a wizard option writes state.config.setupDefaults', ()=>{
    ev(`state.config.setupDefaults=null;`);
    ev(`startWizard(); wizardData.instruments=[{key:'keys',selected:true,label:'Keys'}]; wizardData.useSetupChecklist=true;`);
    ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
    const body = doc.getElementById('wizardBody');
    const houseRadio = body.querySelector('input[type=radio][value="k_house"]');
    if (!houseRadio) throw new Error('keys card not rendered with options');
    houseRadio.checked = true; houseRadio.dispatchEvent(new window.Event('change',{bubbles:true}));
    if (ev(`(state.config.setupDefaults&&state.config.setupDefaults.keys.selections.source)`) !== 'k_house') throw new Error('default not written');
  });
```

(If `startWizard`/`wizardData` shape differs, re-grep and adapt the seeding; the assertion on `state.config.setupDefaults` is the contract.)

- [ ] **Step 2: FAIL → Step 3: Implement** (extract `renderSetupGroups`, refactor Task 5 to call it, render per-instrument cards). **Step 4: PASS.** **Step 5:** `npm run check` + `npm test` (wizard tests). Commit `feat(setup): wizard configures church defaults per instrument`.

---

# PHASE D — Consolidated add dialog + last-minute integration

## Task 8: Consolidated per-person review dialog

**Files:** Modify `index.html` (new `openSetupReviewDialog(entries)` near `openPostPullPopup` ~10072). Test: `tests/setupreview.js`.

`openSetupReviewDialog(entries)` where `entries=[{name, role, typeKey, stableKey}]`: a modal listing each person with `renderSetupGroups` (church defaults pre-checked via their seeded selections) + custom add. "Save" writes each `selections`/`customItems`, `rebuildPersonItems`, clears `needsReview`, `saveState()`, closes. Skippable (leaves defaults + `needsReview`).

- [ ] **Step 1: Write `tests/setupreview.js`:**

```js
  console.log('--- consolidated review dialog ---');
  check('dialog lists new people with defaults pre-checked; save clears needsReview', ()=>{
    ev(`state.config.setupDefaults={ bass:{selections:{rig:'b_house'},customOptions:[]} };`);
    ev(`state.setupItems={};`);
    const k = ev(`stableSetupKey('New Guy','band','bass')`);
    ev(`seedPersonSetup('${k}','bass'); state.setupItems['${k}'].needsReview=true;`);
    ev(`openSetupReviewDialog([{name:'New Guy',role:'band',typeKey:'bass',stableKey:'${k}'}])`);
    const modal = doc.querySelector('.setup-review-modal');
    if (!modal) throw new Error('no dialog');
    if (!modal.querySelector('input[value="b_house"]').checked) throw new Error('default not pre-checked');
    modal.querySelector('.srv-save').click();
    if (ev(`state.setupItems['${k}'].needsReview`) !== false) throw new Error('needsReview not cleared');
  });
```

- [ ] **Step 2: FAIL → Step 3: Implement** (classes `setup-review-modal`, `srv-save`; reuse `renderSetupGroups`). **Step 4: PASS.** **Step 5:** `npm run check`; commit `feat(setup): consolidated per-person setup review dialog`.

---

## Task 9: Wire adds → seed + review + notify

**Files:** Modify `index.html`: `applyPCOPlanData` tail (seed all assigned people, collect new ones), `pcoMergeRefresh`/`applyPcoMerge` added-people path, `pcoMergeNotify` (append "complete setup items"), `updateSetupProgressBadge` (reflect `needsReview`), and the manual add-person path. Test: extend `tests/setupreview.js` + `tests/pcorefresh.js`.

- On a full PCO pull: after assignments settle, `seedPersonSetup` every assigned band/vocalist; open `openSetupReviewDialog` with the people (via the existing post-pull popup flow — chain after `openPostPullPopup`, or add a step to it).
- On merge-refresh `added`: mark each added person's bucket `needsReview=true` and include in the ⚠ notice text ("… — assign mic/position & complete setup items"); optionally auto-open the review dialog for just those people.
- `updateSetupProgressBadge`: badge shows a review indicator if any bucket has `needsReview`.

- [ ] **Step 1: Add checks:**

```js
  // in tests/pcorefresh.js (merge path)
  check('a merge-added person is flagged needsReview and notice mentions setup', ()=>{
    ev(`state.config.setupDefaults={ vocals:{selections:{options:['v_stand']},customOptions:[]} };`);
    ev(`pcoMergeNotices={needs:[],fyi:[]};`);
    ev(`applyPcoMerge({added:[{pcoId:'tmZ',name:'Late Add',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false}],declined:[],hardRemoved:[],roleChanged:[],renamed:[],serviceOrderChanged:false,metaChanged:false,hasChanges:true}, {meta:{},people:[],serviceOrder:[]})`);
    const k = ev(`stableSetupKey('Late Add','vocalist','vocals')`);
    if (ev(`!(state.setupItems['${k}']&&state.setupItems['${k}'].needsReview)`)) throw new Error('not flagged needsReview');
    ev(`pcoMergeNotify({added:[{pcoId:'tmZ',name:'Late Add'}],declined:[],hardRemoved:[],roleChanged:[],renamed:[],serviceOrderChanged:false,metaChanged:false,hasChanges:true})`);
    if (!/setup/i.test(document.getElementById('pcoMergeBanner').textContent)) throw new Error('notice lacks setup mention');
  });
```

- [ ] **Step 2: FAIL → Step 3: Implement.** **Step 4: PASS.** **Step 5:** `npm run check` + full `npm test`; commit `feat(setup): seed + review + notify on new adds`.

---

# PHASE E — Retire old machinery, tests, watchlist

## Task 10: Remove superseded code, update old tests, WATCHLIST

**Files:** `index.html` (remove `SETUP_ITEM_PRESETS`, `SETUP_PRESETS`, `getSetupPresets`, `renderPresetEditor`, the flat quick-add wizard chips, and the parts of `openSaveOptionsMenu`/`saveCurrentItemsAsTemplate` that target the old model — keep reusable-template save only if still wanted; confirm with a grep that nothing else references removed symbols). Tests: update `tests/setuppresets.js`, `tests/setupmgr.js`, `tests/checklist.js`, `tests/shadows.js` to the new model (or delete assertions that tested removed behavior, replacing with equivalent new-model assertions). `docs/WATCHLIST.md`.

- [ ] **Step 1:** Grep every reference to each removed symbol; remove definitions + call sites; replace behavior with new-model equivalents.
- [ ] **Step 2:** Update the old setup tests so they assert the new grouped model (seed-once, resolve, editor, wizard defaults). Do not leave dead tests referencing removed globals.
- [ ] **Step 3:** `docs/WATCHLIST.md`: add — setup items are grouped per instrument; defaults configured in wizard (`state.config.setupDefaults`); per-person seeded once via stable keys (no duplicates); legacy buckets migrate on load; new adds seed + flag `needsReview` + consolidated review dialog + ⚠ notice mentions setup.
- [ ] **Step 4:** `npm run check && npm test` — full suite green (only `curve.js` known false-fail). Fix any real failure.
- [ ] **Step 5:** Commit `refactor(setup): retire flat setup-items model; update tests + watchlist`.
- [ ] **Step 6: Manual booth smoke (report, don't deploy):** run wizard → set keys/eg/bass defaults; pull a plan → review dialog pre-checks defaults, per-person tick/untick + custom works; re-pull → no duplicates; add a person via merge-refresh → ⚠ "complete setup items" + review; Sunday check-off red/yellow/green intact.

---

## Self-review (author check vs spec)

- **Grouped catalog (spec §1):** Task 1. ✓  **No built-in defaults:** Task 1 test asserts it. ✓
- **Church defaults in wizard (§2, Wizard):** Tasks 4, 7. ✓
- **Per-person selector, defaults pre-checked, add/remove, saved (§3, On add):** Tasks 5, 8. ✓
- **Config↔check-off split:** Tasks 5 (editor) + 6 (check-off). ✓
- **Duplicate fix (stable keys, seed-once, migration):** Tasks 3, 6. ✓
- **Last-minute add (seed + needsReview + notice + dialog):** Task 9. ✓
- **Bass rig no default / inputs checkboxes / eg addItems / keys flattened:** Task 1 catalog + test. ✓
- **Boom mic conditional on linked vocalist:** preserved — Task 6/9 must keep existing boom-mic rule (grep current logic; do not regress). Flagged in Task 9 implementation.
- **Type consistency:** `stableSetupKey`, `seedPersonSetup`, `resolveSetupItems`, `rebuildPersonItems`, `renderSetupGroups`, `renderPersonSetupEditor`, `openSetupReviewDialog`, `churchSetupDefaults`, `defaultSelectionsFor` — names used consistently across tasks. Bucket shape `{selections,customItems,items,seeded,needsReview}` consistent. ✓
- **Gap noted:** exact vocal/shadow legacy key suffixes must be confirmed by grep in Task 3 (the plan flags this).
