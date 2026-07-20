# Bulk Pre-add Person Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the bulk pre-add modal so each person is one card listing the positions they've actually filled (read-only), with MD as its own position chip and the role dropdown gone — replaced by a per-card "+ add position" picker.

**Architecture:** All in the single `index.html`. Add a person layer (`bulkPeople`) alongside the existing position rows (`bulkPreaddRows`, now carrying a `pid`); drop the `isMD` flag in favor of a standalone `role:'md'` row. Rewrite `renderBulkPreadd` to render grouped person cards; the aggregator/seed/commit paths produce MD-as-own-row and assign `pid`s.

**Tech Stack:** Vanilla HTML/CSS/JS single file. jsdom regression tests in `tests/`. `npm run check` + `npm test` must be green (allow the known `curve.js` false-fail).

---

## Ground rules (read before editing)

- **ONE file:** `index.html`. **Re-grep before every edit** — line numbers drift; match on quoted anchors.
- After every task: `npm run check` then `npm test`. Never commit red. `curve.js` is a KNOWN false-fail — ignore only that.
- The bulk modal is **transient** — `bulkPreaddRows`/`bulkPeople` are reset on `openBulkPreadd()`, never persisted. No migration.
- Existing helpers you'll reuse: `normFullName(n)`, `classifyPosition(pos)`, `detectPresetKey(inst)`, `stableSetupKey(name,role,typeKey)`, `renderPersonSetupEditor(el,key,typeKey)`, `setMicRemembered(name,mic)`, `micPrefFor(name)`, `esc(s)`, `toast(msg,kind)`, `bulkRowSetupKey(r)`, `bulkRowSummary(r)`.

---

## File Structure

- **Modify `index.html`:**
  - Model/helpers near `~6857`: `bulkPreaddRows`, `BULK_ROLE_OPTS`, `addBulkRow`, `seedBulkFromRoster`; add `bulkPeople` + `addBulkPerson`/`bulkFindOrCreatePerson`/`renameBulkPerson`/`removeBulkPerson`/`bulkPersonHasRow`/`bulkPosLabel`.
  - `bulkRowsFromPcoTeamData` (`~7033`) — MD as own row.
  - `commitBulkPreadd` (`~7009`) — drop the `isMD` branch.
  - `fetchPcoRegulars` tail (`~7101`) — assign `pid`s.
  - `openBulkPreadd` (`~6896`) — reset `bulkPeople`, rewire "Add person".
  - `renderBulkPreadd` (`~6935`) — full rewrite to person cards.
  - `bulkPeopleSearch` (`~7113`) — operate on a person.
  - CSS bulk block (`~716-740`) — add `.bulk-person*`, `.bulk-pos*`, `.bulk-addpos*`.
- **Modify tests:** `tests/bulkpreaddpco.js`, `tests/bulkpreadd.js`.
- **Modify docs:** `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`.

---

## Task 1: MD becomes its own row (aggregator + seed + commit)

Removes the `isMD` flag concept everywhere it's produced/consumed. After this task the OLD flat render still works (a `role:'md'` row already renders via the existing `md` path); a band+MD person simply shows as two flat rows instead of an "also MD" checkbox.

**Files:**
- Modify: `index.html` (`bulkRowsFromPcoTeamData`, `seedBulkFromRoster`, `commitBulkPreadd`, `addBulkRow`)
- Test: `tests/bulkpreaddpco.js`, `tests/bulkpreadd.js`

- [ ] **Step 1: Update the aggregator test (fail first).** In `tests/bulkpreaddpco.js`, find the check `'bulkRowsFromPcoTeamData: per-role rows, isMD, md-only, skips, dedupe'` and replace its body's Pat Reed assertion + add MD-row assertion. Replace this line:

```js
   const pat=byName('Pat Reed'); if(pat.length!==1||pat[0].role!=='band'||pat[0].typeKey!=='keys'||pat[0].isMD!==true) throw new Error('Pat should be band/keys + isMD: '+JSON.stringify(pat));
```

with:

```js
   const pat=byName('Pat Reed');
   const patBand=pat.find(r=>r.role==='band'); const patMd=pat.find(r=>r.role==='md');
   if(!patBand||patBand.typeKey!=='keys') throw new Error('Pat should have a band/keys row: '+JSON.stringify(pat));
   if(!patMd||patMd.onStage!==true) throw new Error('Pat should ALSO have a standalone md row (onStage true): '+JSON.stringify(pat));
   if(pat.some(r=>r.isMD)) throw new Error('no row should carry isMD anymore: '+JSON.stringify(pat));
```

Also, in the same file's check `'a vocalist who was also MD is NOT flagged MD — MD becomes its own row'`, it already asserts a separate md row and no isMD — leave it (it stays valid).

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/bulkpreaddpco.js` → FAIL (aggregator still sets `isMD`, emits one Pat row).

- [ ] **Step 3: Rewrite the MD pass in `bulkRowsFromPcoTeamData`.** Grep for `mdNames.forEach((disp, nn) => {`. Replace the whole `mdNames.forEach(...)` block (through its closing `});`) with:

```js
  mdNames.forEach((disp) => {
    // MD is its own position chip: every md_flag person gets a standalone md row (whether or not
    // they also play an instrument or sing). A vocalist row is never turned into the MD.
    const k = keyOf(disp, 'md', '');
    if (!rowMap.has(k) && !existing.has(k)) rowMap.set(k, { name: disp, role: 'md', onStage: true });
  });
```

Also update the comment above the function (grep `// role; band/vocal/MD only`) — change the sentence about "a person seen as MD gets isMD on their instrument row" to "a person seen as MD gets a standalone md row".

- [ ] **Step 4: Drop `isMD` from `addBulkRow`.** Grep for `{ id: 'br_' + Math.random().toString(36).slice(2, 8), name: '', role: 'band', typeKey: 'keys', isMD: false, mic: '', open: false }` and change it to (also adds the `pid` field used in Task 2):

```js
    { id: 'br_' + Math.random().toString(36).slice(2, 8), pid: '', name: '', role: 'band', typeKey: 'keys', mic: '', open: false },
```

- [ ] **Step 5: Update `seedBulkFromRoster` to emit an md row.** Grep for `addBulkRow({ name: n, role: 'band', typeKey: detectPresetKey(i) || 'keys', isMD: state.musicDirectorId === i.id });` and replace that single statement with:

```js
    const tk = detectPresetKey(i) || 'keys';
    addBulkRow({ name: n, role: 'band', typeKey: tk });
    if (state.musicDirectorId === i.id) addBulkRow({ name: n, role: 'md', onStage: true });
```

- [ ] **Step 6: Drop the `isMD` branch in `commitBulkPreadd`.** Grep for `    if (r.isMD) state.musicianPreferences[nn + '|md'] = { askedAt: now, onStage: r.onStage !== false };` and delete that entire line (the `role:'md'` branch already writes the `nn|md` marker).

- [ ] **Step 7: Update the seed test.** In `tests/bulkpreadd.js`, find the check about "Add everyone on the current plan" that asserts `.bulk-md` is checked on the MD person. Replace its MD assertion so it looks for an md row in `bulkPreaddRows` instead of the checkbox. Find the line resembling:

```js
   if(!mdRow || !mdRow.querySelector('.bulk-md') || !mdRow.querySelector('.bulk-md').checked) throw new Error('MD person row should have "also MD" checked');
```

and replace it with:

```js
   if(!ev(`bulkPreaddRows.some(r=>r.role==='md' && normFullName(r.name)===normFullName('<MDNAME>'))`)) throw new Error('MD person should get a standalone md row');
```

Re-grep the actual test to find the MD person's name used in its setup and substitute it for `<MDNAME>` (the test seeds `state.musicDirectorId` onto a specific instrument's `assignedTo` — use that name). If the assertion is structured differently, adapt it to assert a `role:'md'` row exists for that person and no row has `isMD`.

- [ ] **Step 8: Run both test files, expect PASS.**
`SA_HTML=index.html node tests/bulkpreaddpco.js` and `SA_HTML=index.html node tests/bulkpreadd.js` → PASS.

- [ ] **Step 9: Full suite.** `npm run check && npm test` → green (allow `curve.js`).

- [ ] **Step 10: Commit.**

```bash
git add index.html tests/bulkpreaddpco.js tests/bulkpreadd.js
git commit -m "refactor(bulk): MD is its own row, drop the isMD flag"
```

---

## Task 2: Person cards — model layer + grouped render + CSS

The main task. Adds the `bulkPeople` layer and rewrites the render to grouped cards with read-only position chips + a `+ add position` picker.

**Files:**
- Modify: `index.html` (model helpers, `openBulkPreadd`, `renderBulkPreadd`, `bulkPeopleSearch`, `fetchPcoRegulars` tail, `seedBulkFromRoster`, CSS)
- Test: `tests/bulkpreadd.js`, `tests/bulkpreaddpco.js`

- [ ] **Step 1: Write failing render tests.** In `tests/bulkpreadd.js`, find the check that asserts "Add person appends one row with a `.bulk-role` select" (it queries `.bulk-role` and its options). Replace that entire `check(...)` call with these two:

```js
 check('Add person appends a person CARD (no role dropdown)', ()=>{
   ev('openBulkPreadd();');
   ev('addBulkPerson(); renderBulkPreadd();');
   const cards=doc.querySelectorAll('#bulkPreaddModal .bulk-person');
   if(cards.length!==1) throw new Error('expected 1 person card, got '+cards.length);
   if(doc.querySelector('#bulkPreaddModal .bulk-role')) throw new Error('the per-row role dropdown should be gone');
   if(!cards[0].querySelector('.bulk-addpos-select')) throw new Error('card should have a "+ add position" picker');
 });

 check('add a position via the card picker appends a read-only .bulk-pos chip', ()=>{
   ev('openBulkPreadd();');
   ev(`var pid=addBulkPerson({name:'Jo Vane'}); addBulkRow({pid,name:'Jo Vane',role:'band',typeKey:'bass',open:true}); renderBulkPreadd();`);
   const card=doc.querySelector('#bulkPreaddModal .bulk-person');
   const chips=card.querySelectorAll('.bulk-pos');
   if(chips.length!==1) throw new Error('expected 1 position chip, got '+chips.length);
   const label=chips[0].querySelector('.bulk-pos-label').textContent;
   if(!/Bass/i.test(label)) throw new Error('chip label should read Bass, got: '+label);
   // expanding mounts the setup editor; toggling an option writes to the bass bucket
   const opt=card.querySelector('.bulk-editor input,[data-setup-opt],.setup-opt input');
   // (the editor markup is shared; assert the bucket key exists after a toggle in the next check)
 });
```

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/bulkpreadd.js` → FAIL (`addBulkPerson is not defined`, `.bulk-person` absent).

- [ ] **Step 3: Add the model layer + helpers.** Grep for `let bulkPreaddRows = [];`. Immediately after that line (before `const BULK_ROLE_OPTS`), insert:

```js
let bulkPeople = []; // [{ pid, name, pcoId }] — one card per person; rows reference pid
function addBulkPerson(partial) {
  const pid = 'bp_' + Math.random().toString(36).slice(2, 8);
  bulkPeople.push(Object.assign({ pid, name: '', pcoId: '' }, partial || {}));
  return pid;
}
function bulkFindOrCreatePerson(name, pcoId) {
  const nn = normFullName(name || '');
  let p = nn ? bulkPeople.find(x => normFullName(x.name) === nn) : null;
  if (!p) { const pid = addBulkPerson({ name: name || '', pcoId: pcoId || '' }); return pid; }
  if (pcoId && !p.pcoId) p.pcoId = pcoId;
  return p.pid;
}
function renameBulkPerson(pid, name) {
  const p = bulkPeople.find(x => x.pid === pid); if (!p) return;
  p.name = name;
  bulkPreaddRows.forEach(r => { if (r.pid === pid) r.name = name; });
}
function removeBulkPerson(pid) {
  bulkPeople = bulkPeople.filter(x => x.pid !== pid);
  bulkPreaddRows = bulkPreaddRows.filter(r => r.pid !== pid);
}
function bulkPersonHasRow(pid, role, typeKey) {
  return bulkPreaddRows.some(r => r.pid === pid && r.role === role && (role !== 'band' || r.typeKey === typeKey));
}
function bulkPosLabel(r) {
  if (r.role === 'vocalist') return 'Vocals';
  if (r.role === 'md') return 'MD';
  const o = BULK_ROLE_OPTS.find(x => x.v === r.typeKey);
  return o ? o.label : (r.typeKey || 'Band');
}
```

- [ ] **Step 4: Reset `bulkPeople` + rewire "Add person" in `openBulkPreadd`.** Grep for `bulkPreaddRows = [];` inside `openBulkPreadd` and change it to `bulkPreaddRows = []; bulkPeople = [];`. Then grep for `modal.querySelector('#bulkAddRow').addEventListener('click', () => { addBulkRow({ open: true }); renderBulkPreadd(); });` and replace it with:

```js
  modal.querySelector('#bulkAddRow').addEventListener('click', () => { addBulkPerson(); renderBulkPreadd(); });
```

- [ ] **Step 5: Group in `fetchPcoRegulars`.** Grep for `rows.forEach(r => addBulkRow(r));` and replace with:

```js
    rows.forEach(row => { const pid = bulkFindOrCreatePerson(row.name, null); addBulkRow(Object.assign({ pid }, row)); });
```

- [ ] **Step 6: Group in `seedBulkFromRoster`.** Replace the whole `seedBulkFromRoster` function (grep `function seedBulkFromRoster()`) with:

```js
function seedBulkFromRoster() {
  const ensure = (name) => bulkFindOrCreatePerson(name, null);
  (state.vocalists || []).forEach(v => {
    const n = (v.name || '').trim(); if (!n) return;
    const pid = ensure(n);
    if (!bulkPersonHasRow(pid, 'vocalist', null)) addBulkRow({ pid, name: n, role: 'vocalist' });
  });
  (state.instruments || []).forEach(i => {
    if (!i || i.vocalistPlayer) return;
    const n = (i.assignedTo || '').trim(); if (!n) return;
    const pid = ensure(n);
    const tk = detectPresetKey(i) || 'keys';
    if (!bulkPersonHasRow(pid, 'band', tk)) addBulkRow({ pid, name: n, role: 'band', typeKey: tk });
    if (state.musicDirectorId === i.id && !bulkPersonHasRow(pid, 'md', null)) addBulkRow({ pid, name: n, role: 'md', onStage: true });
  });
}
```

- [ ] **Step 7: Rewrite `renderBulkPreadd`.** Replace the entire `renderBulkPreadd` function (grep `function renderBulkPreadd()`, through its final closing `}` before `function closeBulkPreadd` is ABOVE it — the next function after renderBulkPreadd is `commitBulkPreadd`; replace up to but not including `function commitBulkPreadd`) with:

```js
function renderBulkPreadd() {
  const list = document.getElementById('bulkList'); if (!list) return;
  if (!bulkPeople.length) {
    list.innerHTML = `<div class="bulk-empty">No one yet. Use <b>＋ Add person</b> or <b>Add everyone on the current plan</b> to begin.</div>`;
    return;
  }
  const canSearch = !!pcoTokens;
  const micOptsFor = (r) => (state.inventory || []).map(m => `<option value="${esc(m.name)}|${m.wireless ? 'wl' : 'wd'}"${r.mic === m.name ? ' selected' : ''}>${esc(m.name + (m.wireless ? ' (Wireless)' : ''))}</option>`).join('');
  const addOpts = BULK_ROLE_OPTS.map(o => `<option value="${o.v}">${o.label}</option>`).join('');
  list.innerHTML = bulkPeople.map(p => {
    const rows = bulkPreaddRows.filter(r => r.pid === p.pid);
    const chips = rows.map(r => {
      let inline = '';
      if (r.role === 'vocalist') inline = `<select class="bulk-mic"><option value="">— Mic: no preference —</option>${micOptsFor(r)}</select>`;
      else if (r.role === 'md') inline = `<select class="bulk-md-stage"><option value="on"${r.onStage !== false ? ' selected' : ''}>On stage</option><option value="off"${r.onStage === false ? ' selected' : ''}>Off stage</option></select>`;
      const body = r.open ? `<div class="bulk-pos-body"><div class="bulk-editor"></div></div>` : '';
      return `<div class="bulk-pos" data-id="${esc(r.id)}">
        <div class="bulk-pos-head">
          <button class="bulk-pos-expand" data-bulk-expand title="Setup items">${r.open ? '▾' : '▸'}</button>
          <span class="bulk-pos-label">${esc(bulkPosLabel(r))}</span>
          ${inline}
          <span class="bulk-summary">${esc(bulkRowSummary(r))}</span>
          <button class="bulk-pos-remove" data-bulk-posremove title="Remove position">✕</button>
        </div>
        ${body}
      </div>`;
    }).join('');
    return `<div class="bulk-person" data-pid="${esc(p.pid)}">
      <div class="bulk-person-head">
        <div class="bulk-name-wrap"><input type="text" class="bulk-name" placeholder="${canSearch ? 'Search Planning Center people…' : 'Name'}" value="${esc(p.name)}" autocomplete="off" /><div class="bulk-name-results"></div></div>
        <button class="bulk-person-remove" data-bulk-personremove title="Remove person">✕</button>
      </div>
      <div class="bulk-pos-list">${chips || '<div class="bulk-empty" style="padding:8px 0">No positions yet — add one below.</div>'}</div>
      <div class="bulk-addpos">
        <select class="bulk-addpos-select">${addOpts}</select>
        <button class="bulk-addpos-btn" data-bulk-addpos>＋ add position</button>
      </div>
    </div>`;
  }).join('');
  bulkPeople.forEach(p => {
    const card = list.querySelector(`[data-pid="${p.pid}"]`); if (!card) return;
    const nameInp = card.querySelector('.bulk-name');
    nameInp.addEventListener('change', e => { renameBulkPerson(p.pid, e.target.value.trim()); renderBulkPreadd(); });
    if (canSearch) { let t = null; nameInp.addEventListener('input', e => { const q = e.target.value; clearTimeout(t); t = setTimeout(() => bulkPeopleSearch(p, q), 220); }); }
    card.querySelector('[data-bulk-personremove]').addEventListener('click', () => { removeBulkPerson(p.pid); renderBulkPreadd(); });
    const addSel = card.querySelector('.bulk-addpos-select');
    card.querySelector('[data-bulk-addpos]').addEventListener('click', () => {
      const v = addSel.value;
      let role = 'band', typeKey = undefined; const extra = {};
      if (v === 'vocalist') role = 'vocalist';
      else if (v === 'md') { role = 'md'; extra.onStage = true; }
      else { role = 'band'; typeKey = v; }
      if (bulkPersonHasRow(p.pid, role, typeKey || null)) { toast('That position is already listed', 'info'); return; }
      addBulkRow(Object.assign({ pid: p.pid, name: p.name, role, typeKey, open: true }, extra));
      renderBulkPreadd();
    });
    bulkPreaddRows.filter(r => r.pid === p.pid).forEach(r => {
      const chip = card.querySelector(`.bulk-pos[data-id="${r.id}"]`); if (!chip) return;
      chip.querySelector('[data-bulk-expand]').addEventListener('click', () => { r.open = !r.open; renderBulkPreadd(); });
      chip.querySelector('[data-bulk-posremove]').addEventListener('click', () => { bulkPreaddRows = bulkPreaddRows.filter(x => x.id !== r.id); renderBulkPreadd(); });
      const mic = chip.querySelector('.bulk-mic');
      if (mic) mic.addEventListener('change', e => { r.mic = e.target.value ? e.target.value.split('|')[0] : ''; });
      const stage = chip.querySelector('.bulk-md-stage');
      if (stage) stage.addEventListener('change', e => { r.onStage = e.target.value !== 'off'; });
      if (r.open && r.name) {
        const ed = chip.querySelector('.bulk-editor');
        if (ed) {
          if (r.role === 'md') renderPersonSetupEditor(ed, stableSetupKey(r.name, 'md', 'md'), 'md');
          else { const { key, typeKey } = bulkRowSetupKey(r); renderPersonSetupEditor(ed, key, typeKey); }
        }
      }
    });
  });
}
```

- [ ] **Step 8: Rewrite `bulkPeopleSearch` to take a person.** Replace the whole `bulkPeopleSearch` function (grep `async function bulkPeopleSearch(`) with:

```js
// PCO people search for a person card's name field. Renders a results dropdown into the card.
async function bulkPeopleSearch(person, q) {
  const card = document.querySelector(`#bulkPreaddModal [data-pid="${person.pid}"]`);
  const box = card && card.querySelector('.bulk-name-results');
  if (!box) return;
  const query = (q || '').trim();
  if (!pcoTokens || query.length < 2) { box.innerHTML = ''; return; }
  let data = [];
  try {
    const res = await pcoFetch(`/people/v2/people?where[search_name_or_email]=${encodeURIComponent(query)}&per_page=8`);
    data = res.data || [];
  } catch (e) {
    try { const res2 = await pcoFetch(`/people/v2/people?where[search_name]=${encodeURIComponent(query)}&per_page=8`); data = res2.data || []; }
    catch (e2) { box.innerHTML = ''; return; }
  }
  box.innerHTML = data.map(pp => `<button type="button" class="bulk-name-result" data-pid="${esc(pp.id)}" data-name="${esc((pp.attributes && pp.attributes.name) || '')}">${esc((pp.attributes && pp.attributes.name) || '(unnamed)')}</button>`).join('');
  box.querySelectorAll('.bulk-name-result').forEach(b => b.addEventListener('click', () => {
    person.pcoId = b.dataset.pid; renameBulkPerson(person.pid, b.dataset.name); renderBulkPreadd();
  }));
}
```

- [ ] **Step 9: Add CSS.** Grep for `.bulk-md-stage{` (the last bulk rule at `~734`) and insert AFTER that line:

```css
.bulk-person{background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:10px;padding:10px 12px}
.bulk-person-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.bulk-person-remove{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;flex:none}
.bulk-person-remove:hover{color:var(--danger)}
.bulk-pos-list{display:flex;flex-direction:column;gap:6px}
.bulk-pos{background:var(--bg-inset);border:1px solid var(--border);border-radius:7px;overflow:hidden}
.bulk-pos-head{display:flex;align-items:center;gap:8px;padding:6px 8px}
.bulk-pos-expand{background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;width:16px;flex:none}
.bulk-pos-label{font-size:12.5px;font-weight:600;color:var(--text);min-width:70px}
.bulk-pos-remove{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:12px;flex:none}
.bulk-pos-remove:hover{color:var(--danger)}
.bulk-pos-body{padding:2px 10px 10px 28px;border-top:1px solid var(--border)}
.bulk-addpos{display:flex;align-items:center;gap:6px;margin-top:8px}
.bulk-addpos-select{background:var(--bg-inset);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;padding:4px 6px}
.bulk-addpos-btn{background:none;border:1px dashed var(--border-2);border-radius:6px;color:var(--text-muted);cursor:pointer;font-size:12px;padding:4px 10px}
.bulk-addpos-btn:hover{color:var(--accent);border-color:var(--accent)}
```

- [ ] **Step 10: Update the remaining `bulkpreadd.js` checks that used the old flat markup.** Re-grep `tests/bulkpreadd.js` for the band-editor-toggle check and the vocalist-mic check. Update their selectors to the card layout: build state via `addBulkPerson`/`addBulkRow` with a `pid`, render, expand the chip (`.bulk-pos [data-bulk-expand]`), and read the mic from `.bulk-pos .bulk-mic`. The assertions on `state.setupItems[stableSetupKey(name,'band','bass')]`, `micPrefFor(name).remembered`, and `state.musicianPreferences['<nn>|vocal']` stay the same. Concretely, for the vocalist check, set up with:

```js
   ev('openBulkPreadd();');
   ev(`var pid=addBulkPerson({name:'Mia'}); addBulkRow({pid,name:'Mia',role:'vocalist',open:true}); renderBulkPreadd();`);
```

then select the mic via `doc.querySelector('#bulkPreaddModal .bulk-pos .bulk-mic')`, dispatch change, `ev('commitBulkPreadd();')`, and keep the existing `micPrefFor('Mia')` / `musicianPreferences['mia|vocal']` assertions.

- [ ] **Step 11: Update `bulkpreaddpco.js` people-search + md-only + regulars-name checks.**
  - People-search check: replace `ev('openBulkPreadd(); addBulkRow({name:"",role:"band",typeKey:"keys",open:false}); renderBulkPreadd();'); await ev(\`bulkPeopleSearch(bulkPreaddRows[0],'Ava')\`);` with:

```js
   ev('openBulkPreadd(); var pid=addBulkPerson(); renderBulkPreadd();');
   await ev(`bulkPeopleSearch(bulkPeople[0],'Ava')`);
```

  and change the final assertion from `bulkPreaddRows[0].name` to `bulkPeople[0].name` (expect `'Avaline Chen'`).
  - MD-only check: replace `addBulkRow({name:"Dana Lee",role:"md",onStage:true,open:true})` with `var pid=addBulkPerson({name:'Dana Lee'}); addBulkRow({pid,name:'Dana Lee',role:'md',onStage:true,open:true});`, and query the stage select as `doc.querySelector('#bulkPreaddModal .bulk-pos .bulk-md-stage')`. Keep the `state.musicianPreferences['dana lee|md'].onStage===false` assertion after `commitBulkPreadd()`.
  - `fetchPcoRegulars` check: change the resulting-set assertion from `bulkPreaddRows.map(r=>r.name)` to `bulkPeople.map(x=>x.name)` (Pat Reed now has two rows but ONE person). Expect the same sorted five names `['Ava Chen','Dana Lee','Jo Vane','Pat Reed','Sam Fox']`. Keep the "TooOld"/"Declined Person" negative assertions (they can check `bulkPeople.some(x=>x.name==='TooOld')`).
  - `#bulkRegulars disabled without PCO` check: unchanged.

- [ ] **Step 12: Run both bulk test files, expect PASS.**
`SA_HTML=index.html node tests/bulkpreadd.js` and `SA_HTML=index.html node tests/bulkpreaddpco.js` → PASS.

- [ ] **Step 13: Full suite.** `npm run check && npm test` → green (allow `curve.js`).

- [ ] **Step 14: Commit.**

```bash
git add index.html tests/bulkpreadd.js tests/bulkpreaddpco.js
git commit -m "feat(bulk): person cards — positions grouped under each person, no role dropdown"
```

---

## Task 3: Grouping/commit integration tests + docs

**Files:**
- Test: `tests/bulkpreaddpco.js`
- Modify: `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: Add grouping + commit integration checks.** In `tests/bulkpreaddpco.js`, insert before the final `console.log('\n=== RESULT:` line:

```js
 check('two PCO positions for one person render under ONE card as two chips', ()=>{
   ev('openBulkPreadd();');
   ev(`var pid=bulkFindOrCreatePerson('Ava Chen',null);
       addBulkRow({pid,name:'Ava Chen',role:'vocalist'});
       addBulkRow({pid,name:'Ava Chen',role:'band',typeKey:'keys'});
       renderBulkPreadd();`);
   const cards=doc.querySelectorAll('#bulkPreaddModal .bulk-person');
   if(cards.length!==1) throw new Error('expected 1 person card, got '+cards.length);
   const chips=cards[0].querySelectorAll('.bulk-pos');
   if(chips.length!==2) throw new Error('expected 2 position chips under Ava, got '+chips.length);
 });

 check('band+MD person: Bass chip + MD chip; commit writes both markers', ()=>{
   ev('state.setupItems={}; state.musicianPreferences={};');
   ev('openBulkPreadd();');
   ev(`var pid=bulkFindOrCreatePerson('Pat Reed',null);
       addBulkRow({pid,name:'Pat Reed',role:'band',typeKey:'bass'});
       addBulkRow({pid,name:'Pat Reed',role:'md',onStage:true});
       renderBulkPreadd();`);
   const labels=[].slice.call(doc.querySelectorAll('#bulkPreaddModal .bulk-person .bulk-pos-label')).map(n=>n.textContent);
   if(!labels.some(l=>/Bass/i.test(l)) || !labels.some(l=>/MD/i.test(l))) throw new Error('expected Bass + MD chips, got '+labels.join(','));
   ev('commitBulkPreadd();');
   const nn=ev(`normFullName('Pat Reed')`);
   if(!ev(`!!state.musicianPreferences['${nn}|bass']`)) throw new Error('missing bass marker');
   if(!ev(`!!state.musicianPreferences['${nn}|md']`)) throw new Error('missing md marker');
 });
```

- [ ] **Step 2: Run it, expect PASS.** `SA_HTML=index.html node tests/bulkpreaddpco.js` → PASS.

- [ ] **Step 3: Full suite.** `npm run check && npm test` → green.

- [ ] **Step 4: Add a WATCHLIST entry.** In `docs/WATCHLIST.md`, after the highest-numbered item (append the next number — likely 39), add:

```markdown
39. **Bulk pre-add is person-cards.** Each person is one card listing their scheduled positions as
    read-only chips (Vocals / instrument / MD); MD is its own chip (no "also MD" checkbox); the only
    dropdown is a per-card "+ add position" picker. Commit still writes `musicianPreferences`
    markers per position. (`renderBulkPreadd`, `bulkPeople`; `tests/bulkpreadd*.js`.)
```

- [ ] **Step 5: Mark Batch C shipped in the backlog.** In `docs/StageAssign_Backlog.md`, find the `**Bulk pre-add (batch C):**` block and replace it with:

```markdown
**Bulk pre-add (batch C):** ✅ SHIPPED 2026-07-20 → `bulkpreadd`, `bulkpreaddpco`
- ~~Show each scheduled position under a person instead of a role dropdown~~ — the grid is now one
  card per person; positions are read-only chips; MD is its own chip; a "+ add position" picker is
  the only remaining dropdown.
```

- [ ] **Step 6: Final validation.** `npm run check && npm test` → green.

- [ ] **Step 7: Commit.**

```bash
git add tests/bulkpreaddpco.js docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "test+docs: bulk person-card grouping checks; record Batch C shipped"
```

---

## Definition of done

- `npm run check` + `npm test` green (only `curve.js` false-fail).
- Booth checklist for Dillon: open **✓ Items → Bulk pre-add**; (1) click "Bulk add regulars" (PCO connected) → each person is one card with their real positions as chips; (2) a person who played two instruments / sang + played shows multiple chips under one card; (3) a band+MD person shows an MD chip; (4) "+ add position" adds a chip; "✕" removes a position or a whole person; (5) Save, then confirm those people aren't re-prompted on the next pull.
- Do NOT `git push` until Dillon confirms (deploy = push).

---

## Self-review notes (author)

- **Spec coverage:** §A model layer→Task 2 (+`isMD` removal in Task 1); §B aggregator→Task 1; §C seed/fetch grouping→Task 2; §D card render→Task 2; §E commit→Task 1; §F CSS→Task 2; tests→Tasks 1-3; docs→Task 3. All mapped.
- **Type consistency:** `bulkPeople` item `{pid,name,pcoId}`; row gains `pid`, loses `isMD`; helpers `addBulkPerson`/`bulkFindOrCreatePerson`/`renameBulkPerson`/`removeBulkPerson`/`bulkPersonHasRow`/`bulkPosLabel` used consistently across tasks. `bulkPeopleSearch(person,q)` signature updated in Task 2 and its test in Task 2 step 11.
- **Placeholder scan:** one intentional `<MDNAME>` in Task 1 step 7 with explicit instructions to substitute the real seeded name by re-grepping the test — not a code placeholder in shipped source.
- **Ordering:** Task 1 keeps the suite green using the OLD render (md rows already supported), so it's independently shippable; Task 2 swaps the render + model together (they must land together); Task 3 is additive tests + docs.
