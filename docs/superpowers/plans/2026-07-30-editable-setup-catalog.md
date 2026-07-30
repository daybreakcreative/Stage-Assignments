# Editable Setup Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit the per-instrument setup questions (rename/add/remove options and sections) and define new instrument types with PCO keyword auto-mapping, without breaking any saved checklist.

**Architecture:** `SETUP_TEMPLATES` stays the read-only factory default. A new `state.config.setupCatalog` overlay holds only edited/custom types; the single `setupCatalogFor(key)` chokepoint reads overlay-then-factory so all consumers respect edits with no other change. Edits preserve option/section IDs (saved answers reference IDs, not text), so nothing breaks. Detection priority becomes `inst.setupKey` → `setupTypeRules` keyword → built-in regex.

**Tech Stack:** Vanilla HTML/CSS/JS single file (`index.html`), localStorage state, jsdom regression tests in `tests/*.js`. No build step. Validate with `npm run check` + `npm test`.

**Spec:** `docs/superpowers/specs/2026-07-30-editable-setup-catalog-design.md`

---

## Conventions for every task

- **Re-grep before editing** — line numbers drift; find anchor text fresh.
- Test harness header: copy from `tests/pcofilter.js` (jsdom + polyfills). Top-level `const`/`let` are reached via `window.eval('…')`; expose nothing new to `window`. End every test file with:
  `console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','==='); process.exit(errs.length?1:0);`
  and structure checks with the `check(label, fn)` helper. The runner auto-discovers files in `tests/`.
- After each task: `npm run check` then `npm test` must be green (allowing the known curve.js false-fail).
- IDs: use `'opt_'+Math.random().toString(36).slice(2,8)`, `'grp_'+…`, `'custom_'+…` (matches existing `instUid` style).

---

## File Structure

- `index.html` — all code. Regions touched:
  - `DEFAULT_STATE.config` (~line 2200 area) — add `setupCatalog`, `setupTypeRules`.
  - `loadState()` config merge (~2578–2619) — defensive coercion of the two new fields.
  - `setupCatalogFor` (line 2408) — read overlay first.
  - New catalog-ops block — insert immediately after `setupCatalogFor`.
  - `detectPresetKey` (2462) — new priority order.
  - `SETUP_DEFAULT_KEYS` / `renderSetupDefaultsEditor` (6916+) — iterate `allSetupKeys()`, add structural editor + rules editor.
  - `BULK_ROLE_OPTS` (7013) — include custom types.
  - Instruments editor add-instrument card (~6383) — "Setup type" override dropdown.
- `tests/setupcatalog.js` — Phase 1 (data model + ops + reset).
- `tests/setuptypes.js` — Phase 2 (detection priority + custom types + rules).
- `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md` — record the feature.

---

## Task 1: Data model — overlay fields, defensive load, chokepoint, enumeration

**Files:**
- Modify: `index.html` — `DEFAULT_STATE.config`, `loadState` config block, `setupCatalogFor`, add `allSetupKeys`/`isCustomSetupKey`.
- Test: `tests/setupcatalog.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/setupcatalog.js` with the standard header (copy from `tests/pcofilter.js` lines 1–13), then:

```js
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('config has setupCatalog(null-ish) and setupTypeRules(array) defaults', ()=>{
   if(ev('typeof state.config.setupTypeRules')!=='object' || !ev('Array.isArray(state.config.setupTypeRules)')) throw new Error('setupTypeRules not an array');
   // setupCatalog may be null or an object; must not throw when read
   ev('state.config.setupCatalog');
 });

 check('setupCatalogFor returns the built-in when no overlay', ()=>{
   ev('state.config.setupCatalog=null;');
   const g=JSON.parse(ev("JSON.stringify(setupCatalogFor('eg').groups.map(x=>x.id))"));
   if(!g.includes('rig')) throw new Error('built-in eg catalog missing rig group');
 });

 check('setupCatalogFor prefers the overlay entry when present', ()=>{
   ev("state.config.setupCatalog={ eg:{ label:'Electric', groups:[{id:'rig',name:'Rig',type:'radio',options:[{id:'x1',text:'Helix'}]}] } };");
   const t=ev("setupCatalogFor('eg').groups[0].options[0].text");
   if(t!=='Helix') throw new Error('overlay not used, got '+t);
   ev('state.config.setupCatalog=null;');
 });

 check('allSetupKeys = 8 built-ins, plus any custom overlay keys', ()=>{
   ev('state.config.setupCatalog=null;');
   const base=JSON.parse(ev('JSON.stringify(allSetupKeys())'));
   ['drums','bass','ag','eg','keys','md','strings','vocals'].forEach(k=>{ if(!base.includes(k)) throw new Error('missing '+k); });
   ev("state.config.setupCatalog={ custom_perc:{ label:'Percussion', groups:[] } };");
   const withCustom=JSON.parse(ev('JSON.stringify(allSetupKeys())'));
   if(!withCustom.includes('custom_perc')) throw new Error('custom key not enumerated');
   ev('state.config.setupCatalog=null;');
 });

 check('isCustomSetupKey true only for non-built-in keys', ()=>{
   if(ev("isCustomSetupKey('eg')")) throw new Error('eg flagged custom');
   if(!ev("isCustomSetupKey('custom_perc')")) throw new Error('custom_perc not flagged custom');
 });

 check('loadState coerces a malformed setupCatalog/rules to safe shapes', ()=>{
   // simulate a bad save round-tripping through loadState
   ev("localStorage.setItem('stageAssignState', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('stageAssignState')||'{}'),{config:Object.assign({},state.config,{setupCatalog:'garbage',setupTypeRules:[{keyword:'x'},{keyword:'p',key:'eg'},null]})})));");
   const s2=ev('(function(){var s=loadState(); return JSON.stringify({cat:s.config.setupCatalog, rules:s.config.setupTypeRules});})()');
   const o=JSON.parse(s2);
   if(o.cat!==null && typeof o.cat!=='object') throw new Error('setupCatalog not coerced, got '+o.cat);
   if(!Array.isArray(o.rules)) throw new Error('rules not array');
   if(o.rules.some(r=>!r||!r.keyword||!r.key)) throw new Error('malformed rule survived: '+JSON.stringify(o.rules));
 });

 setTimeout(()=>{ console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','==='); process.exit(errs.length?1:0); },20);
},60));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "~/Documents/03_Claude/Projects/Stage Assign App" && SA_HTML=index.html node tests/setupcatalog.js`
Expected: FAIL — `allSetupKeys`/`isCustomSetupKey` undefined; `setupTypeRules` missing.

- [ ] **Step 3: Add the config defaults**

Re-grep: `grep -n "shadowPack: 'Misc 2'," index.html` (a stable `DEFAULT_STATE.config` anchor). Immediately after that line, add:

```js
    setupCatalog: null,            // overlay of edited/custom setup catalogs (null = all factory)
    setupTypeRules: [],            // [{id,keyword,key}] — keyword→setup-type auto-map (Phase 2)
```

- [ ] **Step 4: Coerce on load**

Re-grep: `grep -n "shadowPack: stripPackName(loadedConfig.shadowPack" index.html`. In that same `config: { … }` object (the `loadState` merge), add after the `shadowPack:` line:

```js
          setupCatalog: (loadedConfig.setupCatalog && typeof loadedConfig.setupCatalog === 'object')
            ? (function(sc){ const out={}; Object.keys(sc).forEach(k=>{ const c=sc[k]; if(c && typeof c==='object' && Array.isArray(c.groups)) out[k]={ label:String(c.label||k), groups:c.groups.filter(g=>g&&g.id&&Array.isArray(g.options)).map(g=>({ id:g.id, name:String(g.name||''), type:g.type==='radio'?'radio':'check', options:g.options.filter(o=>o&&o.id).map(o=>({ id:o.id, text:String(o.text||''), ...(Array.isArray(o.addItems)?{addItems:o.addItems.slice()}:{}) })) })) }; }); return Object.keys(out).length?out:null; })(loadedConfig.setupCatalog)
            : null,
          setupTypeRules: Array.isArray(loadedConfig.setupTypeRules)
            ? loadedConfig.setupTypeRules.filter(r=>r && r.keyword && r.key).map(r=>({ id:r.id||('rule_'+Math.random().toString(36).slice(2,8)), keyword:String(r.keyword), key:String(r.key) }))
            : [],
```

- [ ] **Step 5: Update the chokepoint + add enumeration helpers**

Re-grep: `grep -n "function setupCatalogFor" index.html`. Replace that one-line function with:

```js
function setupCatalogFor(key) {
  return (state.config.setupCatalog && state.config.setupCatalog[key]) || SETUP_TEMPLATES[key] || null;
}
const BUILTIN_SETUP_KEYS = ['drums','bass','ag','eg','keys','md','strings','vocals'];
function isCustomSetupKey(key) { return !BUILTIN_SETUP_KEYS.includes(key); }
function allSetupKeys() {
  const keys = BUILTIN_SETUP_KEYS.slice();
  const ov = state.config.setupCatalog || {};
  Object.keys(ov).forEach(k => { if (!keys.includes(k)) keys.push(k); });
  return keys;
}
```

Then re-grep `grep -n "const SETUP_DEFAULT_KEYS" index.html` and change that line to reuse the new constant:

```js
const SETUP_DEFAULT_KEYS = BUILTIN_SETUP_KEYS;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `SA_HTML=index.html node tests/setupcatalog.js` → Expected: ALL CHECKS PASSED
Run: `npm run check && npm test` → Expected: suite green.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/setupcatalog.js
git commit -m "feat(setup): setupCatalog overlay + allSetupKeys, read via setupCatalogFor"
```

---

## Task 2: Pure catalog-edit operations

**Files:**
- Modify: `index.html` — insert an ops block right after the `allSetupKeys` helper from Task 1.
- Test: `tests/setupcatalog.js` (extend)

- [ ] **Step 1: Write the failing tests** — append inside the `setupcatalog.js` load handler, before the final summary `setTimeout`:

```js
 const freshEg=()=>ev("state.config.setupCatalog=null; catalogMaterialize('eg');");

 check('catalogMaterialize deep-copies the built-in into the overlay', ()=>{
   ev('state.config.setupCatalog=null;');
   ev("catalogMaterialize('eg');");
   if(!ev("!!(state.config.setupCatalog && state.config.setupCatalog.eg)")) throw new Error('overlay eg not created');
   // mutating overlay must not touch SETUP_TEMPLATES
   ev("state.config.setupCatalog.eg.groups[0].options[0].text='ZZZ';");
   if(ev("SETUP_TEMPLATES.eg.groups[0].options[0].text")==='ZZZ') throw new Error('overlay aliased the factory');
 });

 check('catalogRenameOption keeps the id, changes the text', ()=>{
   freshEg();
   const gid=ev("setupCatalogFor('eg').groups[0].id");
   const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
   ev(`catalogRenameOption('eg','${gid}','${oid}','Helix');`);
   const o=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options[0])`));
   if(o.id!==ev(`'${oid}'`)) {} // id compare below
   if(o.text!=='Helix') throw new Error('text not renamed');
   if(o.id!==oid) throw new Error('id changed on rename');
 });

 check('catalogAddOption appends a new option with a fresh id', ()=>{
   freshEg();
   const gid=ev("setupCatalogFor('eg').groups[0].id");
   const before=ev(`setupCatalogFor('eg').groups[0].options.length`);
   const newId=ev(`catalogAddOption('eg','${gid}','Second rig')`);
   const after=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options)`));
   if(after.length!==before+1) throw new Error('option not added');
   if(after[after.length-1].text!=='Second rig') throw new Error('wrong text');
   if(!after.some(o=>o.id===newId)) throw new Error('returned id not present');
 });

 check('catalogRemoveOption drops it', ()=>{
   freshEg();
   const gid=ev("setupCatalogFor('eg').groups[0].id");
   const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
   ev(`catalogRemoveOption('eg','${gid}','${oid}');`);
   if(ev(`setupCatalogFor('eg').groups[0].options.some(o=>o.id==='${oid}')`)) throw new Error('option not removed');
 });

 check('catalogMoveOption reorders within the group', ()=>{
   freshEg();
   const gid=ev("setupCatalogFor('eg').groups[0].id");
   const first=ev("setupCatalogFor('eg').groups[0].options[0].id");
   ev(`catalogMoveOption('eg','${gid}','${first}',1);`);
   if(ev(`setupCatalogFor('eg').groups[0].options[1].id`)!==first) throw new Error('option not moved down');
 });

 check('catalogAddGroup / RenameGroup / SetGroupType / RemoveGroup / MoveGroup', ()=>{
   freshEg();
   const gid=ev("catalogAddGroup('eg','New Section','check')");
   if(!ev(`setupCatalogFor('eg').groups.some(g=>g.id==='${gid}' && g.type==='check')`)) throw new Error('group not added');
   ev(`catalogRenameGroup('eg','${gid}','Renamed');`);
   if(ev(`setupCatalogFor('eg').groups.find(g=>g.id==='${gid}').name`)!=='Renamed') throw new Error('group not renamed');
   ev(`catalogSetGroupType('eg','${gid}','radio');`);
   if(ev(`setupCatalogFor('eg').groups.find(g=>g.id==='${gid}').type`)!=='radio') throw new Error('type not set');
   ev(`catalogMoveGroup('eg','${gid}',-1);`);
   ev(`catalogRemoveGroup('eg','${gid}');`);
   if(ev(`setupCatalogFor('eg').groups.some(g=>g.id==='${gid}')`)) throw new Error('group not removed');
 });

 check('catalogResetKey (built-in) drops the overlay entry', ()=>{
   freshEg();
   ev("catalogResetKey('eg');");
   if(ev("!!(state.config.setupCatalog && state.config.setupCatalog.eg)")) throw new Error('overlay eg still present after reset');
 });

 check('renaming an option preserves a person\\'s saved selection (id-based)', ()=>{
   freshEg();
   const gid=ev("setupCatalogFor('eg').groups[0].id");
   const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
   const sel=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{'${gid}':'${oid}'},[]).map(x=>x.text))`));
   ev(`catalogRenameOption('eg','${gid}','${oid}','Helix');`);
   const sel2=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{'${gid}':'${oid}'},[]).map(x=>x.text))`));
   if(!sel2.includes('Helix')) throw new Error('rebuilt items do not show renamed text: '+sel2.join(','));
   if(sel.length!==sel2.length) throw new Error('item count changed on rename');
 });
```

Note: `resolveSetupItems(typeKey, selections, customItems)` already exists (used at line ~10245). Confirm its signature with `grep -n "function resolveSetupItems" index.html` before relying on it; if its param order differs, adjust the two calls above to match.

- [ ] **Step 2: Run to verify it fails**

Run: `SA_HTML=index.html node tests/setupcatalog.js` → Expected: FAIL — `catalogMaterialize` undefined.

- [ ] **Step 3: Implement the ops block**

Re-grep: `grep -n "function allSetupKeys" index.html`. After that function's closing brace, insert:

```js
// ── Editable setup catalog operations (all mutate state.config.setupCatalog, then saveState) ──
function catalogMaterialize(key) {
  if (!state.config.setupCatalog) state.config.setupCatalog = {};
  if (!state.config.setupCatalog[key]) {
    const base = SETUP_TEMPLATES[key];
    state.config.setupCatalog[key] = base
      ? structuredClone(base)
      : { label: key, groups: [] };
  }
  return state.config.setupCatalog[key];
}
function _catGroup(key, groupId) { const c = catalogMaterialize(key); return c.groups.find(g => g.id === groupId) || null; }
function _newId(p) { return p + Math.random().toString(36).slice(2, 8); }
function catalogRenameOption(key, groupId, optId, text) {
  const g = _catGroup(key, groupId); if (!g) return;
  const o = g.options.find(x => x.id === optId); if (o) { o.text = text; saveState(); }
}
function catalogAddOption(key, groupId, text) {
  const g = _catGroup(key, groupId); if (!g) return null;
  const id = _newId('opt_'); g.options.push({ id, text: text || 'New option' }); saveState(); return id;
}
function catalogRemoveOption(key, groupId, optId) {
  const g = _catGroup(key, groupId); if (!g) return;
  g.options = g.options.filter(o => o.id !== optId); saveState();
}
function catalogMoveOption(key, groupId, optId, dir) {
  const g = _catGroup(key, groupId); if (!g) return;
  const i = g.options.findIndex(o => o.id === optId); const j = i + dir;
  if (i < 0 || j < 0 || j >= g.options.length) return;
  const [it] = g.options.splice(i, 1); g.options.splice(j, 0, it); saveState();
}
function catalogAddGroup(key, name, type) {
  const c = catalogMaterialize(key); const id = _newId('grp_');
  c.groups.push({ id, name: name || 'New section', type: type === 'radio' ? 'radio' : 'check', options: [] });
  saveState(); return id;
}
function catalogRenameGroup(key, groupId, name) { const g = _catGroup(key, groupId); if (g) { g.name = name; saveState(); } }
function catalogSetGroupType(key, groupId, type) { const g = _catGroup(key, groupId); if (g) { g.type = type === 'radio' ? 'radio' : 'check'; saveState(); } }
function catalogRemoveGroup(key, groupId) { const c = catalogMaterialize(key); c.groups = c.groups.filter(g => g.id !== groupId); saveState(); }
function catalogMoveGroup(key, groupId, dir) {
  const c = catalogMaterialize(key); const i = c.groups.findIndex(g => g.id === groupId); const j = i + dir;
  if (i < 0 || j < 0 || j >= c.groups.length) return;
  const [it] = c.groups.splice(i, 1); c.groups.splice(j, 0, it); saveState();
}
function catalogResetKey(key) {
  if (state.config.setupCatalog) { delete state.config.setupCatalog[key]; if (!Object.keys(state.config.setupCatalog).length) state.config.setupCatalog = null; }
  saveState();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `SA_HTML=index.html node tests/setupcatalog.js` → Expected: ALL CHECKS PASSED
Run: `npm run check && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/setupcatalog.js
git commit -m "feat(setup): pure catalog edit ops (option/section CRUD + reorder + reset)"
```

---

## Task 3: Phase 1 UI — inline structural editor in the Setup Items tab

**Files:**
- Modify: `index.html` — `renderSetupDefaultsEditor` (add an "Edit questions" toggle per type that mounts `renderCatalogEditor`); add `renderCatalogEditor`; add CSS.
- Test: `tests/setupcatalog.js` (extend with render-level checks)

- [ ] **Step 1: Write the failing test** — append before the summary `setTimeout`:

```js
 check('renderCatalogEditor renders a row per option and add-section control', ()=>{
   ev('state.config.setupCatalog=null;');
   const host=document.createElement('div'); host.id='__catEdit'; document.body.appendChild(host);
   ev("renderCatalogEditor(document.getElementById('__catEdit'),'eg');");
   const opts=document.querySelectorAll('#__catEdit .cat-opt-row');
   if(opts.length < 3) throw new Error('expected EG option rows, got '+opts.length);
   if(!document.querySelector('#__catEdit .cat-add-group')) throw new Error('no add-section control');
   if(!document.querySelector('#__catEdit .cat-reset')) throw new Error('no reset control');
 });

 check('editing an option text input writes through to the overlay', ()=>{
   ev('state.config.setupCatalog=null;');
   const host=document.getElementById('__catEdit')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'__catEdit'}));
   ev("renderCatalogEditor(document.getElementById('__catEdit'),'eg');");
   const inp=document.querySelector('#__catEdit .cat-opt-input');
   inp.value='Helix'; inp.dispatchEvent(new window.Event('input',{bubbles:true}));
   if(!ev("JSON.stringify(state.config.setupCatalog.eg).includes('Helix')")) throw new Error('overlay not updated from input');
 });
```

- [ ] **Step 2: Run to verify it fails**

Run: `SA_HTML=index.html node tests/setupcatalog.js` → Expected: FAIL — `renderCatalogEditor` undefined.

- [ ] **Step 3: Add the editor renderer**

Re-grep: `grep -n "function renderSetupDefaultsEditor" index.html`. Immediately BEFORE it, insert `renderCatalogEditor`:

```js
// Inline structural editor for one setup type's catalog (sections + options). Mutates the overlay
// through the catalog* ops and re-renders in place. `onDone` (optional) fires after Reset.
function renderCatalogEditor(container, key, onDone) {
  if (!container) return;
  const cat = setupCatalogFor(key) || { label: key, groups: [] };
  const custom = isCustomSetupKey(key);
  const rerender = () => renderCatalogEditor(container, key, onDone);
  const groupsHtml = cat.groups.map(g => `
    <div class="cat-group" data-gid="${esc(g.id)}">
      <div class="cat-group-head">
        <input class="cat-group-name" value="${esc(g.name)}" />
        <select class="cat-group-type">
          <option value="check"${g.type!=='radio'?' selected':''}>pick any</option>
          <option value="radio"${g.type==='radio'?' selected':''}>pick one</option>
        </select>
        <button class="cat-btn cat-g-up" title="Move up">↑</button>
        <button class="cat-btn cat-g-dn" title="Move down">↓</button>
        <button class="cat-btn cat-g-del" title="Remove section">✕</button>
      </div>
      <div class="cat-opts">
        ${g.options.map(o => `
          <div class="cat-opt-row" data-oid="${esc(o.id)}">
            <input class="cat-opt-input" value="${esc(o.text)}" />
            <button class="cat-btn cat-o-up" title="Move up">↑</button>
            <button class="cat-btn cat-o-dn" title="Move down">↓</button>
            <button class="cat-btn cat-o-del" title="Remove option">✕</button>
          </div>`).join('')}
        <div class="cat-opt-add-row">
          <input class="cat-opt-add-input" placeholder="Add an option…" />
          <button class="cat-btn cat-o-add">+ Add</button>
        </div>
      </div>
    </div>`).join('');
  container.innerHTML = `
    <div class="cat-editor">
      ${groupsHtml}
      <div class="cat-editor-foot">
        <input class="cat-group-add-input" placeholder="New section name…" />
        <select class="cat-group-add-type"><option value="check">pick any</option><option value="radio">pick one</option></select>
        <button class="cat-btn cat-add-group">+ Section</button>
        <button class="cat-btn cat-reset">${custom ? 'Delete this type' : 'Reset to default'}</button>
      </div>
    </div>`;
  // Wire options
  container.querySelectorAll('.cat-group').forEach(gEl => {
    const gid = gEl.dataset.gid;
    gEl.querySelector('.cat-group-name').addEventListener('change', e => { catalogRenameGroup(key, gid, e.target.value.trim()); });
    gEl.querySelector('.cat-group-type').addEventListener('change', e => { catalogSetGroupType(key, gid, e.target.value); });
    gEl.querySelector('.cat-g-up').addEventListener('click', () => { catalogMoveGroup(key, gid, -1); rerender(); });
    gEl.querySelector('.cat-g-dn').addEventListener('click', () => { catalogMoveGroup(key, gid, 1); rerender(); });
    gEl.querySelector('.cat-g-del').addEventListener('click', () => { if (confirm('Remove this section?')) { catalogRemoveGroup(key, gid); rerender(); } });
    gEl.querySelectorAll('.cat-opt-row').forEach(oEl => {
      const oid = oEl.dataset.oid;
      oEl.querySelector('.cat-opt-input').addEventListener('input', e => { catalogRenameOption(key, gid, oid, e.target.value); });
      oEl.querySelector('.cat-o-up').addEventListener('click', () => { catalogMoveOption(key, gid, oid, -1); rerender(); });
      oEl.querySelector('.cat-o-dn').addEventListener('click', () => { catalogMoveOption(key, gid, oid, 1); rerender(); });
      oEl.querySelector('.cat-o-del').addEventListener('click', () => { catalogRemoveOption(key, gid, oid); rerender(); });
    });
    const addInp = gEl.querySelector('.cat-opt-add-input');
    const addOpt = () => { const t = addInp.value.trim(); if (!t) return; catalogAddOption(key, gid, t); rerender(); };
    gEl.querySelector('.cat-o-add').addEventListener('click', addOpt);
    addInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } });
  });
  // Wire footer
  const gAddInp = container.querySelector('.cat-group-add-input');
  const gAddType = container.querySelector('.cat-group-add-type');
  const addGroup = () => { const n = gAddInp.value.trim(); if (!n) return; catalogAddGroup(key, n, gAddType.value); rerender(); };
  container.querySelector('.cat-add-group').addEventListener('click', addGroup);
  gAddInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } });
  container.querySelector('.cat-reset').addEventListener('click', () => {
    const msg = custom ? 'Delete this instrument type entirely?' : 'Reset this instrument’s questions to the built-in default?';
    if (!confirm(msg)) return;
    if (custom) { catalogRemoveType(key); } else { catalogResetKey(key); }
    if (onDone) onDone(); else rerender();
  });
}
```

Note: `catalogRemoveType` is defined in Task 5. For Task 3, guard the custom branch so tests pass before Task 5: replace `catalogRemoveType(key)` with `(typeof catalogRemoveType==='function'?catalogRemoveType(key):catalogResetKey(key))`.

- [ ] **Step 4: Mount an "Edit questions" toggle in `renderSetupDefaultsEditor`**

Re-grep the card template in `renderSetupDefaultsEditor` (`grep -n "wiz-setup-inst-addrow" index.html`). Inside each `.wiz-setup-inst` card template string, after the `</div>` that closes `wiz-setup-inst-addrow`, add a details block:

```js
        <details class="cat-edit-disclosure"><summary class="cat-edit-summary">Edit questions</summary>
          <div class="cat-edit-mount"></div>
        </details>
```

Then, in the per-card wiring loop (the `container.querySelectorAll('.wiz-setup-inst[data-def-key]').forEach(card => {` block), after the existing `renderCustom();` call, add:

```js
    const catMount = card.querySelector('.cat-edit-mount');
    const catDisc = card.querySelector('.cat-edit-disclosure');
    if (catMount && catDisc) {
      catDisc.addEventListener('toggle', () => { if (catDisc.open) renderCatalogEditor(catMount, key, () => renderSetupDefaultsEditor(container)); }, { once: false });
    }
```

- [ ] **Step 5: Add CSS**

Re-grep a setup-defaults CSS anchor: `grep -n ".setup-defaults-summary" index.html`. After that rule's block, add:

```css
.cat-editor{margin-top:8px;display:flex;flex-direction:column;gap:10px}
.cat-group{border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg-inset)}
.cat-group-head{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.cat-group-name{flex:1;background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 7px;font-size:12px;font-weight:600}
.cat-group-type,.cat-group-add-type{background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 6px;font-size:11px}
.cat-opts{display:flex;flex-direction:column;gap:4px;padding-left:6px}
.cat-opt-row,.cat-opt-add-row{display:flex;gap:6px;align-items:center}
.cat-opt-input,.cat-opt-add-input{flex:1;background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 7px;font-size:12px}
.cat-btn{background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text-muted);padding:3px 7px;font-size:11px;cursor:pointer}
.cat-btn:hover{color:var(--text);border-color:var(--accent)}
.cat-editor-foot{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px}
.cat-group-add-input{background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 7px;font-size:12px}
.cat-reset{margin-left:auto}
.cat-edit-summary{cursor:pointer;font-size:12px;color:var(--text-muted);margin-top:6px}
```

- [ ] **Step 6: Run tests + suite**

Run: `SA_HTML=index.html node tests/setupcatalog.js` → ALL CHECKS PASSED
Run: `npm run check && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/setupcatalog.js
git commit -m "feat(setup): inline catalog editor (sections + options) in Setup Items tab"
```

---

## Task 4: Detection priority — `inst.setupKey` → rules → built-in regex

**Files:**
- Modify: `index.html` — `detectPresetKey` (line ~2462).
- Test: `tests/setuptypes.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/setuptypes.js` with the standard header, then:

```js
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('explicit inst.setupKey wins over everything', ()=>{
   ev("state.config.setupTypeRules=[];");
   const k=ev("detectPresetKey({label:'Drums', tag:'drums', setupKey:'custom_perc'})");
   if(k!=='custom_perc') throw new Error('setupKey override ignored, got '+k);
 });

 check('a keyword rule maps a matching label to its key', ()=>{
   ev("state.config.setupTypeRules=[{id:'r1',keyword:'percussion',key:'custom_perc'}];");
   const k=ev("detectPresetKey({label:'Percussion 1', tag:''})");
   if(k!=='custom_perc') throw new Error('keyword rule not applied, got '+k);
 });

 check('built-in regex still works when no override/rule matches', ()=>{
   ev("state.config.setupTypeRules=[];");
   if(ev("detectPresetKey({label:'Bass', tag:'bass'})")!=='bass') throw new Error('built-in bass detection broke');
   if(ev("detectPresetKey({label:'Electric Guitar', tag:''})")!=='eg') throw new Error('built-in eg detection broke');
 });

 check('a rule does not override an explicit setupKey', ()=>{
   ev("state.config.setupTypeRules=[{id:'r1',keyword:'drum',key:'custom_perc'}];");
   const k=ev("detectPresetKey({label:'Drums', tag:'drums', setupKey:'drums'})");
   if(k!=='drums') throw new Error('setupKey should win over rule, got '+k);
   ev("state.config.setupTypeRules=[];");
 });

 setTimeout(()=>{ console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','==='); process.exit(errs.length?1:0); },20);
},60));
```

- [ ] **Step 2: Run to verify it fails**

Run: `SA_HTML=index.html node tests/setuptypes.js` → Expected: FAIL (setupKey/rules ignored).

- [ ] **Step 3: Implement the priority**

Re-grep: `grep -n "function detectPresetKey" index.html`. Replace the opening of the function (keep the existing regex block intact below the insert):

```js
function detectPresetKey(inst) {
  if (!inst) return null;
  // 1) explicit per-instrument override
  if (inst.setupKey && (BUILTIN_SETUP_KEYS.includes(inst.setupKey) || (state.config.setupCatalog && state.config.setupCatalog[inst.setupKey]))) return inst.setupKey;
  const tag = (inst.tag || '').toLowerCase();
  const label = (inst.label || '').toLowerCase();
  // 2) user keyword rules (first match wins)
  const rules = Array.isArray(state.config.setupTypeRules) ? state.config.setupTypeRules : [];
  for (const r of rules) {
    const kw = (r.keyword || '').toLowerCase().trim();
    if (kw && (tag.includes(kw) || label.includes(kw))) return r.key;
  }
  // 3) built-in regex (unchanged below)
```

Verify the remainder of the original function (the `if (/drum/…)` chain through `return null;`) still follows, and that `tag`/`label` are no longer re-declared later (they were declared at the top originally — remove the now-duplicate `const tag`/`const label` lines that used to be the first two lines of the function).

- [ ] **Step 4: Run to verify pass**

Run: `SA_HTML=index.html node tests/setuptypes.js` → ALL CHECKS PASSED
Run: `npm run check && npm test` → green (watch `mdpostpull`, `pcoderive`, `setupresolve`).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/setuptypes.js
git commit -m "feat(setup): detectPresetKey honors inst.setupKey + keyword rules, then regex"
```

---

## Task 5: Custom types — add/remove + enumerate everywhere

**Files:**
- Modify: `index.html` — add `catalogAddType`/`catalogRemoveType`; make `BULK_ROLE_OPTS` dynamic; make `renderSetupDefaultsEditor` iterate `allSetupKeys()`; add "+ New instrument type" control.
- Test: `tests/setuptypes.js` (extend)

- [ ] **Step 1: Write the failing test** — append before the summary:

```js
 check('catalogAddType creates a custom key present in allSetupKeys', ()=>{
   ev("state.config.setupCatalog=null;");
   const k=ev("catalogAddType('Percussion')");
   if(!/^custom_/.test(k)) throw new Error('unexpected key '+k);
   if(!ev(`allSetupKeys().includes('${k}')`)) throw new Error('custom key not enumerated');
   if(ev(`setupCatalogFor('${k}').label`)!=='Percussion') throw new Error('label not set');
 });

 check('bulkRoleOpts() includes custom types', ()=>{
   ev("state.config.setupCatalog=null; var k=catalogAddType('Percussion'); window.__pk=k;");
   const opts=JSON.parse(ev("JSON.stringify(bulkRoleOpts().map(o=>o.v))"));
   if(!opts.includes(ev('window.__pk'))) throw new Error('custom type missing from bulkRoleOpts: '+opts.join(','));
 });

 check('catalogRemoveType deletes the type and its keyword rules', ()=>{
   ev("state.config.setupCatalog=null; var k=catalogAddType('Percussion'); window.__pk=k; state.config.setupTypeRules=[{id:'r',keyword:'perc',key:k}];");
   ev("catalogRemoveType(window.__pk);");
   if(ev(`allSetupKeys().includes(window.__pk)`)) throw new Error('type not removed');
   if(ev("state.config.setupTypeRules.some(r=>r.key===window.__pk)")) throw new Error('dangling rule left behind');
 });
```

- [ ] **Step 2: Run to verify it fails**

Run: `SA_HTML=index.html node tests/setuptypes.js` → FAIL (`catalogAddType`/`bulkRoleOpts` undefined).

- [ ] **Step 3: Implement add/remove type + dynamic role opts**

After `catalogResetKey` (Task 2 block), add:

```js
function catalogAddType(label) {
  if (!state.config.setupCatalog) state.config.setupCatalog = {};
  const key = _newId('custom_');
  state.config.setupCatalog[key] = { label: label || 'New type', groups: [] };
  saveState(); return key;
}
function catalogRemoveType(key) {
  if (!isCustomSetupKey(key)) return; // built-ins can't be deleted, only reset
  if (state.config.setupCatalog) { delete state.config.setupCatalog[key]; if (!Object.keys(state.config.setupCatalog).length) state.config.setupCatalog = null; }
  state.config.setupTypeRules = (state.config.setupTypeRules || []).filter(r => r.key !== key);
  saveState();
}
```

Re-grep `grep -n "const BULK_ROLE_OPTS" index.html`. Replace the `const BULK_ROLE_OPTS = [ … ];` array with a function that appends custom types (and update its 2 callers):

```js
const BUILTIN_BULK_ROLE_OPTS = [
  { v: 'vocalist', label: 'Vocalist' },
  { v: 'drums', label: 'Drums' }, { v: 'bass', label: 'Bass' }, { v: 'keys', label: 'Keys' },
  { v: 'eg', label: 'Electric Gtr' }, { v: 'ag', label: 'Acoustic Gtr' }, { v: 'strings', label: 'Strings' },
  { v: 'md', label: 'MD (tracks, no instrument)' }
];
function bulkRoleOpts() {
  const opts = BUILTIN_BULK_ROLE_OPTS.slice();
  (state.config.setupCatalog ? Object.keys(state.config.setupCatalog) : []).forEach(k => {
    if (isCustomSetupKey(k)) opts.push({ v: k, label: (setupCatalogFor(k).label || k) });
  });
  return opts;
}
```

Re-grep for `BULK_ROLE_OPTS` usages (`grep -n "BULK_ROLE_OPTS" index.html`) and replace each remaining reference with `bulkRoleOpts()`.

- [ ] **Step 4: Iterate allSetupKeys in the defaults editor + add "New type" control**

Re-grep `grep -n "SETUP_DEFAULT_KEYS.map(key" index.html`. Change `SETUP_DEFAULT_KEYS.map(` to `allSetupKeys().map(`. Then, in `renderSetupDefaultsEditor`, re-grep the `bulkPreaddOpenBtn` line and add a sibling button in the template:

```js
    <button class="btn ghost" id="catAddTypeBtn" style="margin-bottom:16px;">＋ New instrument type</button>`;
```

and wire it after the `bulkBtn` wiring:

```js
  const catAddBtn = container.querySelector('#catAddTypeBtn');
  if (catAddBtn) catAddBtn.addEventListener('click', () => {
    const label = prompt('Name for the new instrument type (e.g. Percussion):');
    if (label && label.trim()) { catalogAddType(label.trim()); renderSetupDefaultsEditor(container); }
  });
```

- [ ] **Step 5: Run tests + suite**

Run: `SA_HTML=index.html node tests/setuptypes.js` → ALL CHECKS PASSED
Run: `npm run check && npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/setuptypes.js
git commit -m "feat(setup): custom instrument types (add/remove) enumerated everywhere"
```

---

## Task 6: Keyword-rules editor + per-instrument Setup-type override

**Files:**
- Modify: `index.html` — add a rules editor to the Setup Items tab; add a "Setup type" dropdown to the instruments editor card.
- Test: `tests/setuptypes.js` (extend)

- [ ] **Step 1: Write the failing test** — append before the summary:

```js
 check('renderSetupTypeRules lists rules and adds a new one', ()=>{
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog=null; catalogAddType('Percussion');");
   const host=document.createElement('div'); host.id='__rules'; document.body.appendChild(host);
   ev("renderSetupTypeRules(document.getElementById('__rules'));");
   const kw=document.querySelector('#__rules .rule-kw'); const sel=document.querySelector('#__rules .rule-key'); const add=document.querySelector('#__rules .rule-add');
   if(!kw||!sel||!add) throw new Error('rules editor controls missing');
   kw.value='percussion'; kw.dispatchEvent(new window.Event('input',{bubbles:true}));
   // pick the custom key
   sel.value=Array.from(sel.options).map(o=>o.value).find(v=>/^custom_/.test(v)); sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   add.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
   if(!ev("state.config.setupTypeRules.some(r=>r.keyword==='percussion')")) throw new Error('rule not added');
 });

 check('instrument card exposes a Setup type override that sets inst.setupKey', ()=>{
   ev("state.instruments=[{id:'inst_x',label:'Thing',tag:'',assignedTo:'',pack:''}]; state.config.setupCatalog=null; catalogAddType('Percussion');");
   // renderInstrumentsEditor mounts the instruments UI; find the setup-type select for inst_x
   ev("openSettings && openSettings();");
   ev("renderInstrumentsEditor && renderInstrumentsEditor();");
   const sel=document.querySelector('.inst-setupkey[data-inst-id=\"inst_x\"]');
   if(!sel) throw new Error('no setup-type override select on instrument card');
   const custom=Array.from(sel.options).map(o=>o.value).find(v=>/^custom_/.test(v));
   sel.value=custom; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev("state.instruments.find(i=>i.id==='inst_x').setupKey")!==custom) throw new Error('setupKey not written');
 });
```

Note: confirm the instruments-editor function name first (`grep -n "function renderInstrumentsEditor" index.html`). If it differs, adjust the test call and Step 4 anchor accordingly.

- [ ] **Step 2: Run to verify it fails**

Run: `SA_HTML=index.html node tests/setuptypes.js` → FAIL (`renderSetupTypeRules` undefined; no `.inst-setupkey`).

- [ ] **Step 3: Add the rules editor + mount it**

After `renderCatalogEditor` (Task 3), add:

```js
function renderSetupTypeRules(container) {
  if (!container) return;
  const rules = state.config.setupTypeRules || (state.config.setupTypeRules = []);
  const keyOpts = allSetupKeys().map(k => `<option value="${esc(k)}">${esc((setupCatalogFor(k).label)||k)}</option>`).join('');
  container.innerHTML = `
    <div class="rules-note">Auto-map a Planning Center position to a setup type when its name contains a keyword.</div>
    <div class="rules-list">${rules.map(r => `
      <div class="rule-row" data-rid="${esc(r.id)}">
        <span class="rule-kw-static">“${esc(r.keyword)}”</span> → <span class="rule-key-static">${esc((setupCatalogFor(r.key).label)||r.key)}</span>
        <button class="cat-btn rule-del">✕</button>
      </div>`).join('')}</div>
    <div class="rule-add-row">
      <input class="rule-kw" placeholder="keyword (e.g. percussion)" />
      <select class="rule-key">${keyOpts}</select>
      <button class="cat-btn rule-add">+ Rule</button>
    </div>`;
  container.querySelectorAll('.rule-row').forEach(row => {
    row.querySelector('.rule-del').addEventListener('click', () => {
      state.config.setupTypeRules = rules.filter(r => r.id !== row.dataset.rid); saveState(); renderSetupTypeRules(container);
    });
  });
  const kw = container.querySelector('.rule-kw'); const key = container.querySelector('.rule-key');
  container.querySelector('.rule-add').addEventListener('click', () => {
    const k = kw.value.trim(); if (!k || !key.value) return;
    rules.push({ id: 'rule_' + Math.random().toString(36).slice(2, 8), keyword: k, key: key.value }); saveState(); renderSetupTypeRules(container);
  });
}
```

In `renderSetupDefaultsEditor`, add a mount point in the template (after the `catAddTypeBtn` button):

```js
    <details class="setup-defaults-disclosure"><summary class="setup-defaults-summary">PCO keyword → setup type rules</summary>
      <div id="setupTypeRulesMount"></div>
    </details>`;
```

and wire after the `catAddBtn` wiring:

```js
  const rulesMount = container.querySelector('#setupTypeRulesMount');
  if (rulesMount) renderSetupTypeRules(rulesMount);
```

Add CSS after the `.cat-editor` block from Task 3:

```css
.rules-note{font-size:12px;color:var(--text-muted);margin:6px 0}
.rule-row{display:flex;gap:8px;align-items:center;font-size:12px;padding:3px 0}
.rule-add-row{display:flex;gap:6px;align-items:center;margin-top:6px}
.rule-kw{background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 7px;font-size:12px}
.rule-key{background:var(--bg-elev);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:4px 6px;font-size:11px}
```

- [ ] **Step 4: Add the per-instrument Setup-type override**

Re-grep the instruments-editor card renderer (`grep -n "data-inst-id" index.html` to find where each instrument row is built in the instruments editor — the Advanced Settings instruments UI, NOT the band roster). In that per-instrument card template, add a select (only worth showing when custom types exist, but always render for simplicity):

```js
      <label class="inst-setupkey-wrap">Setup type
        <select class="inst-setupkey" data-inst-id="${esc(inst.id)}">
          <option value="">Auto (by name)</option>
          ${allSetupKeys().map(k => `<option value="${esc(k)}"${inst.setupKey===k?' selected':''}>${esc((setupCatalogFor(k).label)||k)}</option>`).join('')}
        </select>
      </label>
```

and wire it in that editor's event-binding pass:

```js
  container.querySelectorAll('.inst-setupkey').forEach(sel => sel.addEventListener('change', e => {
    const inst = state.instruments.find(i => i.id === e.target.dataset.instId); if (!inst) return;
    inst.setupKey = e.target.value || undefined; saveState();
  }));
```

(If the instruments editor rebuilds via a single `renderInstrumentsEditor()`, place the wiring there next to the existing per-row listeners.)

- [ ] **Step 5: Run tests + suite**

Run: `SA_HTML=index.html node tests/setuptypes.js` → ALL CHECKS PASSED
Run: `npm run check && npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/setuptypes.js
git commit -m "feat(setup): PCO keyword-rule editor + per-instrument setup-type override"
```

---

## Task 7: Docs — WATCHLIST + backlog

**Files:**
- Modify: `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: Add a WATCHLIST entry**

Append under the setup section of `docs/WATCHLIST.md` (match the existing numbered style):

```
- [ ] **Editable setup catalog.** `setupCatalogFor` reads `state.config.setupCatalog` overlay
      then the built-in `SETUP_TEMPLATES`. Editing an option/section preserves ids so saved
      person selections still resolve; removing an option/section leaves dangling selections
      inert. Reset-to-default drops the overlay entry. Custom types appear in `allSetupKeys()`,
      `bulkRoleOpts()`, and the defaults editor. `detectPresetKey` priority:
      `inst.setupKey` → `setupTypeRules` keyword → built-in regex. → `setupcatalog`, `setuptypes`
```

- [ ] **Step 2: Mark the backlog item shipped**

In `docs/StageAssign_Backlog.md`, add under the Setup items section:

```
- ~~**[FEATURE] Editable setup items/questions per instrument.**~~ ✅ SHIPPED 2026-07-30 →
  `setupcatalog`, `setuptypes`. Overlay catalog: rename/add/remove/reorder options + sections,
  reset-to-default, add custom instrument types, PCO keyword auto-map + per-instrument override.
```

- [ ] **Step 3: Commit**

```bash
git add docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "docs: record editable setup catalog feature"
```

---

## Final verification

- [ ] `npm run check` → JS syntax OK; CSS balanced.
- [ ] `npm test` → all green (allowing curve.js known false-fail); `setupcatalog.js` and `setuptypes.js` PASS.
- [ ] Manual booth check: Advanced Settings → Setup Items → an instrument → "Edit questions": rename "House EG rig" → "Helix", add an option, add + remove a section, Reset to default. Add a new type "Percussion", give it a section, add a PCO keyword rule "percussion → Percussion". On an instrument, set Setup type override. Confirm a person's ✓ Items reflect the edits.
```
