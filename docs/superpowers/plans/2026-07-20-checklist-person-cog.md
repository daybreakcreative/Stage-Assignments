# ✓ Items Per-Person Cog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⚙ cog to each person's card in the ✓ Items checklist view that opens an inline editor for that person's own setup items (a section per role for multi-role people).

**Architecture:** All in the single `index.html`. `collectChecklistItems` gains a per-person `buckets` list; `renderSetupChecklist` renders a cog on cards that have buckets and wires it to a new `openChecklistPersonEditor`, which mounts the existing `renderPersonSetupEditor` once per bucket in a `.setup-review-modal` sheet. Person buckets only — church `setupDefaults` untouched.

**Tech Stack:** Vanilla HTML/CSS/JS single file. jsdom tests in `tests/`. `npm run check` + `npm test` must be green (allow the known `curve.js` false-fail).

---

## Ground rules

- ONE file: `index.html`. **Re-grep before every edit** (line numbers drift). Never commit red. After edits run `npm run check` then `npm test`; `curve.js` is a KNOWN false-fail (ignore only that).
- Reused as-is (do not modify): `renderPersonSetupEditor(container, stableKey, typeKey)` (saves live), `.setup-review-modal`/`.setup-review-sheet` CSS.

## File Structure

- **Modify `index.html`:** `collectChecklistItems` (`~10712`); `renderSetupChecklist` (`~10945`); add `openChecklistPersonEditor` (near `openPersonSetupModal`, `~7383`); CSS near the `.si-*` rules.
- **Create `tests/scvcog.js`.**
- **Modify docs:** `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`.

---

## Task 1: Per-person `buckets` in `collectChecklistItems`

**Files:**
- Modify: `index.html` (`collectChecklistItems`)
- Test: `tests/scvcog.js`

- [ ] **Step 1: Write the failing test (create `tests/scvcog.js`).**

```js
// ✓ Items per-person cog: each person card carries their setup buckets; a cog opens a per-person
// editor (one section per role); editing writes the person's bucket; church defaults untouched.
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

// Seed one vocalist and one band member (keys), each with a setup bucket, then return the sections.
function seedPeople(){
  ev('renderAll=function(){};saveState=function(){};toast=function(){};');
  ev(`
    state.vocalists=[{id:'v1',name:'Ava Chen',leadsSongs:false,isWL:false,micAssigned:''}];
    state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v1';
    state.instruments=[{id:'inst_keys',label:'Keys',pack:'',assignedTo:'Ben Rowe',vocalistPlayer:null}];
    state.musicDirectorId='';
    seedPersonSetup(stableSetupKey('Ava Chen','vocalist','vocals'),'vocals');
    seedPersonSetup(stableSetupKey('Ben Rowe','band','keys'),'keys');
  `);
  return JSON.parse(ev('JSON.stringify(collectChecklistItems())'));
}

window.addEventListener('load',()=>setTimeout(()=>{

 check('collectChecklistItems: each person entry carries a buckets[] with stableKey/typeKey/label', ()=>{
   const secs=seedPeople();
   const people=[].concat(...secs.filter(s=>s.key==='vocalists'||s.key==='band').map(s=>s.people||[]));
   if(!people.length) throw new Error('no people rendered');
   people.forEach(p=>{
     if(!Array.isArray(p.buckets)||!p.buckets.length) throw new Error('person '+p.name+' has no buckets');
     const b=p.buckets[0];
     if(!b.stableKey||!('typeKey' in b)||!b.label) throw new Error('bucket missing fields: '+JSON.stringify(b));
   });
   // stage cards (if any) must NOT carry buckets
   const stage=[].concat(...secs.filter(s=>s.key==='stage').map(s=>s.people||[]));
   stage.forEach(p=>{ if(p.buckets&&p.buckets.length) throw new Error('stage card should have no buckets'); });
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/scvcog.js` → FAIL (`person … has no buckets`).

- [ ] **Step 3: Add the accumulator field.** Grep for `if (!p) { p = { name: en.name, isVoc: false, roles: [], items: [], seen: new Set() };`. Change that object literal to include `buckets: []`:

```js
    if (!p) { p = { name: en.name, isVoc: false, roles: [], items: [], seen: new Set(), buckets: [] }; byPerson.set(nn, p); order.push(nn); }
```

- [ ] **Step 4: Record each role's bucket.** Grep for `if (en.label && p.roles.indexOf(en.label) === -1) p.roles.push(en.label);`. Immediately AFTER that line, add:

```js
    {
      const bLabel = en.label || (en.role === 'vocalist' ? 'Vocals' : (en.role === 'md' ? 'MD' : (en.typeKey || 'Setup')));
      if (!p.buckets.some(b => b.stableKey === en.stableKey)) {
        p.buckets.push({ stableKey: en.stableKey, typeKey: en.typeKey, label: bLabel });
      }
    }
```

- [ ] **Step 5: Carry buckets onto the person object.** Grep for `(p.isVoc ? vocPeople : bandPeople).push({ name: p.name, roleLabel, stableKey: nn, items: p.items, iem, micText });`. Change it to add `buckets`:

```js
    (p.isVoc ? vocPeople : bandPeople).push({ name: p.name, roleLabel, stableKey: nn, items: p.items, iem, micText, buckets: p.buckets });
```

- [ ] **Step 6: Run the test, expect PASS.** `SA_HTML=index.html node tests/scvcog.js` → `ALL CHECKS PASSED`.

- [ ] **Step 7: Full suite.** `npm run check && npm test` → green (allow `curve.js`). Watch `checklist.js`, `scvredesign.js`, `checklistmerge.js` — adding a field is additive; fix any real regression.

- [ ] **Step 8: Commit.**

```bash
git add index.html tests/scvcog.js
git commit -m "feat(checklist): carry per-person setup buckets in collectChecklistItems"
```

---

## Task 2: Cog on the card + `openChecklistPersonEditor` + CSS

**Files:**
- Modify: `index.html` (`renderSetupChecklist`; new `openChecklistPersonEditor`; CSS)
- Test: `tests/scvcog.js`

- [ ] **Step 1: Add failing interaction checks to `tests/scvcog.js`.** Insert before the final `console.log('\n=== RESULT:` line:

```js
 function openChecklist(){
   ev('renderAll=function(){};saveState=function(){};toast=function(){};');
   ev(`
     state.vocalists=[{id:'v1',name:'Ava Chen',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v1';
     state.instruments=[{id:'inst_keys',label:'Keys',pack:'',assignedTo:'Ben Rowe',vocalistPlayer:null}];
     state.musicDirectorId='';
     seedPersonSetup(stableSetupKey('Ava Chen','vocalist','vocals'),'vocals');
     seedPersonSetup(stableSetupKey('Ben Rowe','band','keys'),'keys');
   `);
   ev('renderSetupChecklist();');
 }

 check('each person card has a cog; stage cards do not', ()=>{
   openChecklist();
   const cards=[].slice.call(doc.querySelectorAll('#setupChecklistView .si-card'));
   if(!cards.length) throw new Error('no cards');
   cards.forEach(c=>{ if(!c.querySelector('.si-cog')) throw new Error('a person card is missing its cog'); });
 });

 check('clicking the cog opens a per-person editor modal', ()=>{
   openChecklist();
   const cog=doc.querySelector('#setupChecklistView .si-cog');
   cog.dispatchEvent(new window.Event('click',{bubbles:true}));
   const modal=doc.querySelector('.setup-review-modal.show');
   if(!modal) throw new Error('no modal opened');
   if(!modal.querySelector('.sp-groups')) throw new Error('modal should mount a setup editor (.sp-groups)');
 });

 check('editing via the cog grows the person bucket and leaves church defaults untouched', ()=>{
   openChecklist();
   const before=ev('JSON.stringify(state.config.setupDefaults||{})');
   const key=ev(`stableSetupKey('Ben Rowe','band','keys')`);
   const n0=ev(`(state.setupItems['${key}'].items||[]).length`);
   // open Ben Rowe's cog: find his card
   const cards=[].slice.call(doc.querySelectorAll('#setupChecklistView .si-card'));
   const benCard=cards.find(c=>/Ben Rowe/.test((c.querySelector('.si-card-name')||{}).textContent||''));
   benCard.querySelector('.si-cog').dispatchEvent(new window.Event('click',{bubbles:true}));
   // toggle the FIRST unchecked checkbox option in the modal editor to add an item
   const modal=doc.querySelector('.setup-review-modal.show');
   const opt=[].slice.call(modal.querySelectorAll('.sp-opt input[type=checkbox]')).find(i=>!i.checked);
   if(!opt) throw new Error('no checkbox option to toggle in the editor');
   opt.checked=true; opt.dispatchEvent(new window.Event('change',{bubbles:true}));
   const n1=ev(`(state.setupItems['${key}'].items||[]).length`);
   if(!(n1>n0)) throw new Error('bucket items should grow after checking an option ('+n0+'→'+n1+')');
   const after=ev('JSON.stringify(state.config.setupDefaults||{})');
   if(after!==before) throw new Error('church setupDefaults must be untouched');
 });
```

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/scvcog.js` → FAIL (no `.si-cog`).

- [ ] **Step 3: Add the `cogPeople` lookup + cog markup in `renderSetupChecklist`.** Grep for `let sectionsHtml = '';`. Immediately AFTER that line, add:

```js
  const cogPeople = [];
```

Then grep for `bodyHtml = '<div class="si-grid">' + groups.map(p => {`. Immediately AFTER that line (inside the map callback, before `const pTotal = p.items.length;`), add:

```js
          const hasBuckets = Array.isArray(p.buckets) && p.buckets.length > 0;
          const cogIdx = cogPeople.length;
          if (hasBuckets) cogPeople.push(p);
```

Then grep for the ring line `${pTotal > 0 ? `<span class="si-ring" style="--pct:${pct}"><span class="si-person-count">${pDone}/${pTotal}</span></span>` : ''}`. Immediately AFTER that line (still inside `.si-card-head`), add:

```js
              ${hasBuckets ? `<button class="si-cog" data-cog-idx="${cogIdx}" title="Edit setup items" aria-label="Edit setup items">⚙</button>` : ''}
```

- [ ] **Step 4: Wire the cogs.** Grep for the chip-wiring block — find `container.querySelectorAll('.si-chip')` (the forEach that toggles check-off). Immediately BEFORE that `container.querySelectorAll('.si-chip')` line, add the cog wiring:

```js
  container.querySelectorAll('.si-cog').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      const p = cogPeople[+btn.dataset.cogIdx];
      if (p) openChecklistPersonEditor(p);
    });
  });
```

(If the chip wiring lives inside `openSetupChecklistView` rather than `renderSetupChecklist`, place this cog wiring at the end of `renderSetupChecklist`, right after `container.innerHTML = ...` is set — `cogPeople` must be in the same function scope where it was declared in Step 3. Re-grep to confirm the wiring runs in `renderSetupChecklist`; if the chip toggles are wired in a separate function that re-selects the container, still add the cog wiring at the end of `renderSetupChecklist` where `cogPeople` is in scope.)

- [ ] **Step 5: Add `openChecklistPersonEditor`.** Grep for `function openPersonSetupModal(name, stableKey, typeKey, scopeLabel) {`. Immediately BEFORE that function, insert:

```js
// Per-person setup editor launched from the ✓ Items card cog. Shows one editor section per role
// bucket (Vocals / an instrument / MD). Edits the person's OWN buckets (renderPersonSetupEditor
// saves live); never touches church setupDefaults. Closes back to the checklist so it resyncs.
function openChecklistPersonEditor(person) {
  if (!person || !Array.isArray(person.buckets) || !person.buckets.length) return;
  const overlay = document.createElement('div');
  overlay.className = 'setup-review-modal show';
  const sheet = document.createElement('div');
  sheet.className = 'setup-review-sheet';
  overlay.appendChild(sheet);
  const close = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    renderSetupChecklist();
    if (typeof updateSetupProgressBadge === 'function') updateSetupProgressBadge();
  };
  const head = document.createElement('div');
  head.className = 'setup-review-head';
  const title = document.createElement('div');
  title.className = 'setup-review-title';
  title.textContent = person.name || 'Setup items';
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'setup-review-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  x.addEventListener('click', close);
  head.appendChild(title); head.appendChild(x); sheet.appendChild(head);
  const sub = document.createElement('p');
  sub.className = 'setup-review-sub';
  sub.textContent = 'Edit this person’s setup items. Changes save automatically.';
  sheet.appendChild(sub);
  const body = document.createElement('div');
  body.className = 'setup-review-body';
  body.style.overflow = 'auto'; body.style.flex = '1'; body.style.minHeight = '0';
  person.buckets.forEach(b => {
    if (person.buckets.length > 1) {
      const h = document.createElement('div');
      h.className = 'si-cog-section-label';
      h.textContent = b.label;
      body.appendChild(h);
    }
    const sec = document.createElement('div');
    body.appendChild(sec);
    renderPersonSetupEditor(sec, b.stableKey, b.typeKey);
  });
  sheet.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'setup-review-actions';
  const done = document.createElement('button');
  done.type = 'button'; done.className = 'btn primary'; done.textContent = 'Done';
  done.addEventListener('click', close);
  actions.appendChild(done); sheet.appendChild(actions);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  return overlay;
}
```

- [ ] **Step 6: Add CSS.** Grep for a `.si-card-head` rule (or `.si-ring`) in the CSS. After the nearest `.si-*` rule, add:

```css
.si-cog{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;flex:none;opacity:.6}
.si-cog:hover{color:var(--accent);opacity:1}
.si-cog-section-label{font-family:var(--ff-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:4px 0 2px}
```

- [ ] **Step 7: Run the test, expect PASS.** `SA_HTML=index.html node tests/scvcog.js` → `ALL CHECKS PASSED`. If the "editing grows the bucket" check can't find a checkbox option (some catalogs are radio-only), adjust the toggle to select a non-selected radio in a group that adds an item; the intent is "make a change that adds an item." Prefer the keys catalog which has checkable extras.

- [ ] **Step 8: Full suite.** `npm run check && npm test` → green (allow `curve.js`). Confirm `scvredesign.js`, `checklist.js`, `setupcheckoff.js`, `scvdisplaybtn.js` all still pass.

- [ ] **Step 9: Commit.**

```bash
git add index.html tests/scvcog.js
git commit -m "feat(checklist): per-person cog opens an inline setup editor (a section per role)"
```

---

## Task 3: Docs

**Files:**
- Modify: `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: WATCHLIST entry.** In `docs/WATCHLIST.md`, append the next integer after the current highest (should be 40 → use 41; adjust if different) and bump the header counts:

```markdown
41. **✓ Items per-person cog.** Each person card in the ✓ Items view has a ⚙ that opens an inline
    editor for THAT person's setup items — one section per role for a multi-role person
    (`openChecklistPersonEditor` → `renderPersonSetupEditor`). Edits the person's bucket only (church
    `setupDefaults` untouched); the cog click never toggles a check-off chip; stage-fixture cards
    have no cog. (`collectChecklistItems` buckets, `renderSetupChecklist`; `tests/scvcog.js`.)
```

- [ ] **Step 2: Backlog.** In `docs/StageAssign_Backlog.md`, find the bullet `**[FEATURE] Cog on each person's ✓ Items card**` and replace it with:

```markdown
- ~~**[FEATURE] Cog on each person's ✓ Items card**~~ ✅ SHIPPED 2026-07-20 → `scvcog`. A ⚙ on each
  ✓ Items card opens that person's setup editor inline (a section per role); edits their bucket
  only. Church defaults stay in the Advanced Settings editor.
```

- [ ] **Step 3: Final validation.** `npm run check && npm test` → green.

- [ ] **Step 4: Commit.**

```bash
git add docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "docs: record ✓ Items per-person cog shipped"
```

---

## Definition of done

- `npm run check` + `npm test` green (only `curve.js` false-fail); `tests/scvcog.js` passes.
- Booth checklist for Dillon: open **✓ Items**; each person card shows a ⚙; clicking it opens their setup editor (multi-role people get a section per role); adding/removing an item there updates their card's chips after you close; the gear never accidentally checks off an item; stage-fixture cards have no gear.
- Do NOT `git push` until Dillon confirms.

---

## Self-review notes (author)

- **Spec coverage:** §A buckets → Task 1; §B cog + wiring → Task 2; §C `openChecklistPersonEditor` → Task 2; §D CSS → Task 2; tests → Tasks 1-2; docs → Task 3. All mapped.
- **Placeholder scan:** none. WATCHLIST "41" flagged to adjust. Step 4 of Task 2 has a conditional about wiring location — it's an explicit re-grep instruction, not a placeholder (the scope requirement is stated precisely).
- **Type consistency:** `buckets: [{stableKey, typeKey, label}]`, `cogPeople`, `openChecklistPersonEditor(person)` names consistent across tasks; reuses `renderPersonSetupEditor(container, stableKey, typeKey)` verbatim.
