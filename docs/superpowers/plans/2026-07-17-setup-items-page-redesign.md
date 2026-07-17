# Setup Items Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the ✓ Items check-off view into grouped, scannable "rich cards" — a responsive card grid where each person shows their setup needs as click-to-toggle chips, with a progress ring, an IEM note, a checkable mic chip, and Vocal 1/2/3 labels.

**Architecture:** Single-file vanilla app (`index.html`). Change only the check-off VIEW (`renderSetupItemsView` / `renderAreaCard` / `renderPersonCard`) + its refresh (`refreshSetupItemsUI`) + the toggle wiring (`wireSetupItemsContent`) + CSS. The bucket/preset data model and Setup Manager are untouched. Chips reuse the existing per-item `doneThisService` + toggle handler; the vocal mic is materialized as an auto-managed item so it counts with zero new persistence.

**Tech Stack:** HTML/CSS/JS, `localStorage` state, jsdom tests via `npm test`, `npm run check`.

**Reference spec:** `docs/superpowers/specs/2026-07-17-setup-items-page-redesign-design.md`

**Golden rules (CLAUDE.md):** ONE file. Re-grep anchors before each edit (line numbers drift). Never ship until `npm run check` AND `npm test` are green (allow the known `curve.js` false-fail). Don't push without confirming with Dillon.

---

## File Structure

- **Modify:** `index.html`
  - New helpers near `renderPersonCard` (~line 9818): `vocalSlotFor`, `iemNoteFor`, `syncAssignedMicItem`, `renderItemChip`.
  - Rewrite `renderPersonCard` (~9818–9874) to the chip card.
  - `renderAreaCard` (~9801) — wrap people in a grid container.
  - `wireSetupItemsContent` toggle handler (~line where `closest('.si-item')` appears) — decouple to `closest('[data-item-id]')`.
  - `refreshSetupItemsUI` (~10153) — update chip `ck` state + ring `--pct`.
  - CSS: add `.si-grid`, `.si-card`, `.si-card-head`, `.si-card-name`, `.si-card-role`, `.si-ring`, `.si-chips`, `.si-chip` (+`.ck`,`.mic`,`.auto`), `.si-iem-note`, `.si-none`, `.si-edit` near the existing `.si-*` block (~line 950–983).
- **Create:** `tests/setupitemsview.js`.
- **Modify:** `docs/WATCHLIST.md`.

---

## Task 1: Helpers — vocal slot, IEM note, mic materialization

**Files:**
- Create: `tests/setupitemsview.js`
- Modify: `index.html` — add helpers directly ABOVE `function renderPersonCard` (re-grep anchor: `function renderPersonCard(p) {`)

- [ ] **Step 1: Write the failing test** — create `tests/setupitemsview.js`:

```javascript
// FEATURE: Setup Items page redesign — grouped rich cards. Helpers + render + toggle.
// Spec: docs/superpowers/specs/2026-07-17-setup-items-page-redesign-design.md
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

// Seed a roster: 1 band MD (keys) + 3 vocalists with mics/packs assigned.
function seed(){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};`);
 ev(`state.setupItems={}; state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
 ev(`state.config.voxIemPacks=['Pack A','Pack B','Pack C','Pack D','Pack E','Pack F','Pack G','Pack H'];`);
 ev(`state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Reed'}];`);
 ev(`state.musicDirectorId='i_keys';`);
 ev(`state.vocalists=[{id:'v1',name:'Ava Chen',isWL:true,micAssigned:'Beta 58 #1'},{id:'v2',name:'Noah Brooks',micAssigned:'Beta 58 #2'},{id:'v3',name:'Mia Torres'}];`);
 ev(`state.assignments=['v1','v2','v3'].concat(new Array(MAX_VOCALISTS-3).fill(null));`);
 ev(`state.service={name:'Sunday Service',date:'2026-07-19'};`);
}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 console.log('--- helpers ---');
 check('vocalSlotFor returns 1-based assignment slot', ()=>{
   seed();
   if(ev(`vocalSlotFor('v1')`)!==1) throw new Error('v1 should be slot 1');
   if(ev(`vocalSlotFor('v3')`)!==3) throw new Error('v3 should be slot 3');
   if(ev(`vocalSlotFor('nope')`)!==0) throw new Error('unknown should be 0');
 });

 check('iemNoteFor returns the vocalist pack by slot', ()=>{
   seed();
   const p=ev(`JSON.stringify(getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'))`);
   if(ev(`iemNoteFor(${p})`)!=='Pack A') throw new Error('v1 IEM should be Pack A, got '+ev(`iemNoteFor(${p})`));
 });

 check('syncAssignedMicItem materializes a checkable mic item for a vocalist', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   ev(`(function(){var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p);})()`);
   const mics=JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(key)}].items||[]).filter(function(i){return i.kind==='mic';}))`));
   if(mics.length!==1) throw new Error('expected 1 mic item, got '+mics.length);
   if(mics[0].text!=='Beta 58 #1') throw new Error('mic text wrong: '+mics[0].text);
   if(mics[0].autoAdded!==true) throw new Error('mic item should be autoAdded');
 });

 check('syncAssignedMicItem removes the mic item when assignment cleared', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   ev(`(function(){var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p); state.vocalists.find(v=>v.id==='v1').micAssigned=''; syncAssignedMicItem(p);})()`);
   const n=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).filter(function(i){return i.kind==='mic';}).length`);
   if(n!==0) throw new Error('mic item should be removed, got '+n);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "$HOME/Documents/03_Claude/Projects/Stage Assign App" && node tests/setupitemsview.js`
Expected: FAIL — `vocalSlotFor is not defined` (helpers don't exist yet).

- [ ] **Step 3: Add the helpers** — insert immediately ABOVE `function renderPersonCard(p) {`:

```javascript
// ── Setup Items card helpers ─────────────────────────────────────────────
// Vocal slot (1-based) from the assignment order — matches renderDisplayView's VOCAL n.
function vocalSlotFor(vocId) {
  const a = state.assignments || [];
  const i = a.indexOf(vocId);
  return i >= 0 ? i + 1 : 0;
}
// The IEM pack to show as a read-only note (never counted). '' when none.
function iemNoteFor(p) {
  if (p.role === 'vocalist' && p.vocId) {
    const slot = vocalSlotFor(p.vocId);
    if (!slot) return '';
    const packs = state.config.voxIemPacks || [];
    return packs[slot - 1] || ('Vocal ' + slot);
  }
  if (p.role === 'band' && p.inst) return iemPackFor(p.inst) || '';
  return '';
}
// Keep the assigned VOCALIST mic mirrored as one auto-managed, checkable item so it counts
// toward X/Y and remembers its done-state with zero new persistence. Band mics are ordinary
// items. IMPORTANT: dedupe by TEXT, not by a `kind` flag — `getStageAreas()` runs
// `reconstructSetupBucket` before every render, which rebuilds `b.items` via `newSetupItem`
// and STRIPS custom fields (`kind`, `autoAdded`) and regenerates ids. A `kind`-based lookup
// would miss the surviving (text-preserved) item and unshift a duplicate each render. So we
// track the current mic text on the bucket (`bucket.micItemText`, an untouched field that
// survives reconstruction), reconcile by text, and re-tag `kind:'mic'` every call (styling
// needs it fresh at render time). This mirrors how the Boom-mic auto-add stays idempotent.
function syncAssignedMicItem(p) {
  if (p.role !== 'vocalist' || !p.vocId) return;
  const v = state.vocalists.find(x => x.id === p.vocId);
  const mic = (v && v.micAssigned) ? v.micAssigned.trim() : '';
  const bucket = ensureSetupBucket(p.key);
  const prev = bucket.micItemText || '';
  // Assignment changed or cleared → drop the stale auto-mic (identified by its tracked text).
  if (prev && prev !== mic) bucket.items = bucket.items.filter(it => it.text !== prev);
  if (!mic) { delete bucket.micItemText; return; }
  let item = bucket.items.find(it => it.text === mic);
  if (!item) {
    item = { id: 'si_mic_' + Math.random().toString(36).slice(2, 9), text: mic, doneThisService: false, scopeOneTime: false };
    bucket.items.unshift(item);
  }
  item.kind = 'mic';       // re-tag every call — survives reconstruction stripping the flag
  item.autoAdded = true;
  bucket.micItemText = mic;
}
// One setup item as a click-to-toggle chip. Reuses data-action="toggle-item"; the chip carries
// data-item-id/data-person-key so the existing handler (closest('[data-item-id]')) finds them.
function renderItemChip(personKey, item) {
  const done = !!item.doneThisService;
  const cls = ['si-chip'];
  if (done) cls.push('ck');
  if (item.kind === 'mic') cls.push('mic');
  if (item.autoAdded) cls.push('auto');
  return `<label class="${cls.join(' ')}" data-item-id="${esc(item.id)}" data-person-key="${esc(personKey)}">
      <input type="checkbox" class="si-chip-cb" data-action="toggle-item" ${done ? 'checked' : ''} hidden>
      <span class="si-chip-box"></span><span class="si-chip-text">${esc(item.text)}</span>
    </label>`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/setupitemsview.js`
Expected: PASS — all four helper checks OK.

- [ ] **Step 5: Commit**

```bash
git add tests/setupitemsview.js index.html
git commit -m "feat(setup-items): card helpers (vocal slot, IEM note, mic sync, chip)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Chip card render + grid layout + CSS

**Files:**
- Test: `tests/setupitemsview.js` (add render checks)
- Modify: `index.html` — `renderPersonCard` (re-grep: `function renderPersonCard(p) {`), `renderAreaCard` (re-grep: `<div class="si-people">`), CSS block (re-grep: `.si-person{background:var(--surface)`)

- [ ] **Step 1: Add failing render checks** — insert into `tests/setupitemsview.js` before the `console.log('\n=== RESULT:'...)` line:

```javascript
 console.log('--- render: chip cards ---');
 function renderItems(){ seed(); ev(`state.viewMode='setup-items'; renderSetupItemsView();`); }

 check('renders a card grid with one card per person', ()=>{
   renderItems();
   if(!doc.querySelector('#si_content .si-grid')) throw new Error('no .si-grid');
   const cards=doc.querySelectorAll('#si_content .si-card');
   if(cards.length!==4) throw new Error('expected 4 cards (Pat + 3 vocals), got '+cards.length);
 });

 check('vocalist card shows Vocal N and a checkable mic chip; band MD shows · MD', ()=>{
   renderItems();
   var ava=[].find.call(doc.querySelectorAll('.si-card'),c=>/Ava Chen/.test(c.textContent));
   if(!/Vocal 1/.test(ava.querySelector('.si-card-role').textContent)) throw new Error('Ava should be Vocal 1');
   var micChip=ava.querySelector('.si-chip.mic');
   if(!micChip) throw new Error('Ava should have a mic chip');
   if(!/Beta 58 #1/.test(micChip.textContent)) throw new Error('mic chip text wrong');
   if(!micChip.querySelector('input[data-action="toggle-item"]')) throw new Error('mic chip should be checkable');
   var pat=[].find.call(doc.querySelectorAll('.si-card'),c=>/Pat Reed/.test(c.textContent));
   if(!/· MD/.test(pat.querySelector('.si-card-role').textContent)) throw new Error('Pat should be · MD');
 });

 check('IEM shows as a note, not a chip and not counted', ()=>{
   renderItems();
   var ava=[].find.call(doc.querySelectorAll('.si-card'),c=>/Ava Chen/.test(c.textContent));
   var note=ava.querySelector('.si-iem-note');
   if(!note||!/Pack A/.test(note.textContent)) throw new Error('Ava IEM note missing');
   // the note must NOT be a toggle-item
   if(note.querySelector('[data-action="toggle-item"]')) throw new Error('IEM note must not be checkable');
 });

 check('person with no items shows the No setup needed state', ()=>{
   seed();
   ev(`state.vocalists.find(v=>v.id==='v3').micAssigned='';`); // Mia: no mic, no items
   ev(`state.viewMode='setup-items'; renderSetupItemsView();`);
   var mia=[].find.call(doc.querySelectorAll('.si-card'),c=>/Mia Torres/.test(c.textContent));
   if(!mia.querySelector('.si-none')) throw new Error('Mia should show .si-none');
   if(mia.querySelector('.si-chip')) throw new Error('Mia should have no chips');
 });
```

- [ ] **Step 2: Run to verify the new checks fail**

Run: `node tests/setupitemsview.js`
Expected: FAIL — `no .si-grid` (render still emits `.si-people`/`.si-person`).

- [ ] **Step 3a: Rewrite `renderPersonCard`** — replace the whole function body (the current version returns `.si-person` markup with `.si-items`/`.si-add-row`). Keep the existing Boom-mic auto-add block verbatim; only the return markup and the additions change:

```javascript
function renderPersonCard(p) {
  const bucket = ensureSetupBucket(p.key);
  // Mirror the assigned vocalist mic as a checkable item BEFORE stats are computed.
  syncAssignedMicItem(p);
  const stats = setupCompletionStats(p.key);
  const items = bucket.items;
  const status = stats.status === 'empty' ? 'empty' : stats.status;
  const presetKey = ('typeKey' in p) ? p.typeKey
    : ((p.role === 'band') ? detectPresetKey(p.inst) : (p.role === 'vocalist' ? 'vocals' : null));
  const spTypeKey = presetKey;
  const spStableKey = spTypeKey ? p.key : null;

  // Feature 1: Auto-add "Boom mic stand" for dual-role / MD players. (UNCHANGED — keep block.)
  {
    const BOOM = 'Boom mic stand';
    const bandNeedsBoom = (p.role === 'band' && p.inst && state.musicDirectorId && state.musicDirectorId === p.inst.id);
    const vocalistNeedsBoom = (p.role === 'vocalist' && p.vocId && state.instruments.some(i => i.vocalistPlayer === p.vocId));
    if (bandNeedsBoom || vocalistNeedsBoom) {
      const b2 = ensureSetupBucket(p.key);
      if (!b2.items.some(it => it.text === BOOM)) {
        b2.items.push({ id: 'si_boom_' + Math.random().toString(36).slice(2,9), text: BOOM, doneThisService: false, scopeOneTime: false, autoAdded: true });
      }
    }
  }

  // Role badge
  let roleLabel = '';
  if (p.role === 'vocalist') { const s = vocalSlotFor(p.vocId); roleLabel = s ? ('Vocal ' + s) : 'Vocal'; }
  else if (p.role === 'band' && p.instLabel) roleLabel = p.instLabel + ((state.musicDirectorId && p.inst && state.musicDirectorId === p.inst.id) ? ' · MD' : '');
  else if (p.role === 'shadow') roleLabel = 'Shadow';

  const iem = iemNoteFor(p);
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const chipsHtml = items.length
    ? items.map(it => renderItemChip(p.key, it)).join('')
    : `<div class="si-none">No setup needed</div>`;

  return `
    <div class="si-card status-${status}" data-person-key="${esc(p.key)}" data-person-name="${esc(p.name)}" data-person-role="${esc(p.role||'')}" ${p.inst ? `data-person-inst-id="${esc(p.inst.id)}"` : ''} ${p.inst && p.inst.tag ? `data-person-inst-tag="${esc(p.inst.tag)}"` : ''}>
      <div class="si-card-head">
        <span class="si-card-name">${p.isWL ? '<span class="wl-star">WL</span>' : ''}${esc(p.name)}</span>
        ${roleLabel ? `<span class="si-card-role">${esc(roleLabel)}</span>` : ''}
        ${stats.total > 0 ? `<span class="si-ring" style="--pct:${pct}"><span class="si-person-count ${stats.status}">${stats.done}/${stats.total}</span></span>` : ''}
      </div>
      <div class="si-chips">${chipsHtml}</div>
      ${iem ? `<div class="si-iem-note"><span class="k">IEM</span> ${esc(iem)}</div>` : ''}
      ${spStableKey ? `<div class="sp-editor-wrap" id="sp_wrap_${esc(p.key)}" style="display:none">
        <div class="si-add-row">
          <input type="text" class="si-add-input" placeholder="Add a setup item…" data-add-input="${esc(p.key)}" />
          <button class="si-add-btn" data-action="add-item" data-person-key="${esc(p.key)}" data-sp-type="${esc(presetKey || '')}">Add</button>
        </div>
      </div>
      <a class="si-edit" data-action="edit-setup" data-sp-key="${esc(spStableKey)}" data-sp-type="${esc(spTypeKey)}" data-person-key="${esc(p.key)}" title="Edit grouped setup options">✎ edit setup</a>` : ''}
    </div>`;
}
```

Note: the ⚙ inline editor (`sp_wrap_*`) and the Add-item row are preserved and now revealed together via the existing `edit-setup` action (which toggles `sp_wrap_*` visibility — unchanged in `wireSetupItemsContent`). `renderItemRow` is now unused by this view but leave it (other callers/tests may reference it).

- [ ] **Step 3b: Grid container in `renderAreaCard`** — replace the `<div class="si-people">…</div>` wrapper with a grid:

```javascript
      <div class="si-grid">
        ${area.people.map(p => renderPersonCard(p)).join('')}
      </div>`;
```
(Keep the rest of `renderAreaCard` — the `.si-area` / `.si-area-header` / stats — unchanged.)

- [ ] **Step 3c: Add CSS** — insert after the existing `.si-item` rules block (re-grep anchor: `.si-item:hover{background:rgba(255,255,255,.02)}`):

```css
.si-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.si-card{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:12px 13px;position:relative;transition:border-color .2s,background .2s}
.si-card.status-green{border-color:rgba(123,169,104,.35);background:rgba(123,169,104,.05)}
.si-card.status-empty{opacity:.72}
.si-card-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.si-card-name{font-family:var(--ff-display);font-size:14.5px;font-weight:600;color:var(--text)}
.si-card-name .wl-star{color:var(--wl-color);font-family:var(--ff-mono);font-size:10px;font-weight:700;letter-spacing:.05em;margin-right:4px}
.si-card-role{font-family:var(--ff-mono);font-size:9.5px;letter-spacing:.08em;color:var(--accent);font-weight:700;text-transform:uppercase}
.si-ring{margin-left:auto;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;flex:none;
  background:conic-gradient(var(--accent) calc(var(--pct,0)*1%),var(--bg-inset) 0)}
.si-ring .si-person-count{background:var(--surface);border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-family:var(--ff-mono);font-size:9px;font-weight:700;color:var(--text-muted);padding:0}
.si-ring .si-person-count.green{color:#7ba968}.si-ring .si-person-count.red{color:#c8554d}
.si-chips{display:flex;flex-wrap:wrap;gap:6px}
.si-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text);background:var(--bg-inset);border:1px solid var(--border);border-radius:20px;padding:3px 9px;cursor:pointer;user-select:none;transition:all .12s}
.si-chip:hover{border-color:var(--accent)}
.si-chip-box{width:12px;height:12px;border:1.5px solid var(--text-faint);border-radius:4px;flex:none}
.si-chip.mic{border-color:rgba(212,161,71,.5);color:var(--accent)}
.si-chip.mic .si-chip-box{border-color:var(--accent)}
.si-chip.auto .si-chip-text::after{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--accent);opacity:.55;margin-left:5px;vertical-align:middle}
.si-chip.ck{color:var(--text-faint);background:transparent;text-decoration:line-through}
.si-chip.ck .si-chip-box{background:#7ba968;border-color:#7ba968;position:relative}
.si-chip.ck .si-chip-box::after{content:"✓";position:absolute;inset:-3px 0 0 0;text-align:center;font-size:9px;color:var(--bg)}
.si-iem-note{margin-top:9px;font-size:11px;color:var(--text-muted)}
.si-iem-note .k{font-family:var(--ff-mono);font-size:9px;letter-spacing:.06em;color:var(--text-faint);font-weight:700;text-transform:uppercase;margin-right:5px}
.si-none{font-size:11.5px;color:var(--text-faint);font-style:italic}
.si-edit{display:inline-block;margin-top:10px;font-family:var(--ff-mono);font-size:10px;color:var(--text-faint);text-decoration:none;cursor:pointer;opacity:0;transition:opacity .15s}
.si-card:hover .si-edit{opacity:1}
.si-edit:hover{color:var(--accent)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/setupitemsview.js`
Expected: PASS — all render checks OK.

- [ ] **Step 5: Commit**

```bash
git add tests/setupitemsview.js index.html
git commit -m "feat(setup-items): grouped rich cards — chips, ring, IEM note, empty state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Make chips toggle + ring/chip live-update

**Files:**
- Test: `tests/setupitemsview.js` (add toggle checks)
- Modify: `index.html` — `wireSetupItemsContent` toggle handler (re-grep: `const row = e.target.closest('.si-item');`), `refreshSetupItemsUI` (re-grep: `card.querySelectorAll('.si-item').forEach(row => {`)

- [ ] **Step 1: Add failing toggle checks** — insert into `tests/setupitemsview.js` before the `console.log('\n=== RESULT:'...)` line:

```javascript
 console.log('--- toggle ---');
 check('clicking a chip toggles doneThisService and updates the count', ()=>{
   renderItems();
   var ava=[].find.call(doc.querySelectorAll('.si-card'),c=>/Ava Chen/.test(c.textContent));
   var chip=ava.querySelector('.si-chip.mic');
   var cb=chip.querySelector('input[data-action="toggle-item"]');
   var key=ava.dataset.personKey, id=chip.dataset.itemId;
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   var item=ev(`state.setupItems[${JSON.stringify(key)}].items.find(i=>i.id===${JSON.stringify(id)})`);
   if(ev(`state.setupItems[${JSON.stringify(key)}].items.find(i=>i.id===${JSON.stringify(id)}).doneThisService`)!==true)
     throw new Error('doneThisService not set true');
   // count element reflects 1/1 for Ava (only the mic item)
   var count=ava.querySelector('.si-person-count');
   if(!/1\/1/.test(count.textContent)) throw new Error('count not updated: '+count.textContent);
 });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/setupitemsview.js`
Expected: FAIL — the change handler uses `closest('.si-item')`, which is null for a chip, so `doneThisService` never flips.

- [ ] **Step 3a: Decouple the toggle handler** — in `wireSetupItemsContent`, change the row lookup:

```javascript
      const row = e.target.closest('[data-item-id]');
```
(from `e.target.closest('.si-item')`). Everything else in that handler stays — it reads `row.dataset.personKey` / `row.dataset.itemId`, which the chip provides.

- [ ] **Step 3b: Extend `refreshSetupItemsUI`** — it currently iterates `card.querySelectorAll('.si-item')`. Add chip + ring updates. Replace the per-card item-update block with:

```javascript
    // Update item rows (legacy) AND chips
    card.querySelectorAll('[data-item-id]').forEach(row => {
      const itemId = row.dataset.itemId;
      const bucket = state.setupItems[key];
      if (!bucket) return;
      const item = bucket.items.find(i => i.id === itemId);
      if (!item) return;
      row.classList.toggle('done', !!item.doneThisService);   // .si-item
      row.classList.toggle('ck', !!item.doneThisService);     // .si-chip
    });
    // Update the progress ring fill
    const ring = card.querySelector('.si-ring');
    if (ring) ring.style.setProperty('--pct', stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0);
```
Also change the card selector at the top of `refreshSetupItemsUI` from `root.querySelectorAll('.si-person')` to `root.querySelectorAll('.si-card, .si-person')` so both old and new cards are covered, and update the `card.querySelector('.si-person-count')` line's surrounding class reset to keep working (the count element still has class `si-person-count`; unchanged).

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/setupitemsview.js`
Expected: PASS — the toggle check passes (doneThisService true, count shows 1/1).

- [ ] **Step 5: Commit**

```bash
git add tests/setupitemsview.js index.html
git commit -m "feat(setup-items): chip toggle + live ring/count update

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Watchlist + full-suite + live verification

**Files:**
- Modify: `docs/WATCHLIST.md`

- [ ] **Step 1: Add a watchlist line** — append after the last item:

```markdown
- [ ] ✓ Items renders as grouped rich cards (responsive grid): each person a card with role
      badge (vocalists = "Vocal N", band MD = "· MD"), a progress ring, setup items as
      click-to-toggle chips, the assigned mic as a checkable chip, IEM as an uncounted note,
      and a "No setup needed" state. Toggling a chip updates doneThisService + counts. → `setupitemsview`
```

- [ ] **Step 2: Syntax/CSS check**

Run: `npm run check`
Expected: `JS syntax OK; CSS balanced (...)`.

- [ ] **Step 3: Full regression suite**

Run: `npm test`
Expected: `SUITE GREEN` — 0 real failures (allow the known `curve.js` false-fail). `setupitemsview.js` PASS; existing `setupviews.js`, `setupcheckoff.js`, `mdsetup.js`, `mdpostpull.js` still PASS.

- [ ] **Step 4: Live verification** — serve + drive the ✓ Items view, confirm the card grid renders, click a chip, screenshot. (Reuse the browser workflow: `python3 -m http.server`, navigate, seed a roster, `renderSetupItemsView`, screenshot; verify a `.si-chip` toggles and the ring updates.)

- [ ] **Step 5: Commit**

```bash
git add docs/WATCHLIST.md
git commit -m "docs: watchlist entry for Setup Items rich-card redesign

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report + confirm before deploy** — summarize; **do not push/merge until Dillon confirms**.

---

## Self-Review notes

- **Spec coverage:** grid+area count (Task 2/3b) ↔ spec §1; chip card + ring + mic chip + IEM note + empty state (Task 2) ↔ §2,§5,§7; vocal slot label (Task 1/2) ↔ §6; chip toggle reuse (Task 3) ↔ §3; mic materialization (Task 1) ↔ §4 + Data model; check-off preserved — top bar/Reset/Mark-all untouched, ⚙ Edit setup + Add-item preserved (Task 2) ↔ §8; tests ↔ §Testing (cases 1–7 represented across Tasks 1–3 + regression in Task 4).
- **Type/name consistency:** helpers `vocalSlotFor`/`iemNoteFor`/`syncAssignedMicItem`/`renderItemChip` used identically across tasks; item flag `kind:'mic'`; classes `si-grid`/`si-card`/`si-chip`(`.ck`,`.mic`,`.auto`)/`si-ring`/`si-iem-note`/`si-none`/`si-edit`/`si-person-count` consistent between render (Task 2), CSS (Task 2), and refresh (Task 3); data attributes `data-item-id`/`data-person-key`/`data-action="toggle-item"` match the decoupled handler.
- **No placeholders:** every code/step block is complete.
- **Known ripple:** `renderItemRow` becomes unused by this view but is left in place (harmless; possibly referenced by tests). `refreshSetupItemsUI` now matches `.si-card, .si-person` so it's back-compatible.
