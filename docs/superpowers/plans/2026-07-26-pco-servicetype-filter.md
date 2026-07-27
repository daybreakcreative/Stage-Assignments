# PCO Service-Type Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Trim the long PCO service-type dropdown to the few a room uses — a persisted favorites allow-list (checkbox picker in Advanced Settings, with search) + a live filter box on the PCO-bar dropdown.

**Architecture:** All in `index.html`. Add `pcoConfig.favoriteServiceTypeIds`. `populateServiceTypeSelect()` applies (favorites → then bar-search) to the rendered `<option>`s. A favorites checkbox+search UI lives in `renderPCOSettings`. A small filter input sits in the PCO bar.

**Tech Stack:** Vanilla single-file JS; jsdom tests. `npm run check` + `npm test` green (allow `curve.js`).

---

## Ground rules
- ONE file `index.html`. **Re-grep before every edit** (line numbers drift). Never commit red. No decorative emoji. `tests/venues5.js` exercises `populateServiceTypeSelect`/`syncPcoServiceTypeUI` — must stay green.

## Design (approved)
- Base dropdown list = favorites if any (`pcoConfig.favoriteServiceTypeIds`), else ALL service types. The currently-selected id is ALWAYS kept (so it never vanishes). Then the PCO-bar search term narrows by name.
- Favorites picker in Advanced Settings → Planning Center: search box + scrollable checkbox list of all service types (folder-grouped). Toggling persists + updates the bar. "Clear" button. Hint: leave all unchecked = show everything.

---

## Task 1: State + dropdown filtering (`populateServiceTypeSelect`) + PCO-bar search

**Files:** Modify `index.html`. Test: `tests/pcofilter.js` (new).

- [ ] **Step 1 — Failing test.** Create `tests/pcofilter.js` (jsdom harness like `tests/venues5.js`). Assert:
  - With `pcoServiceTypes` = 4 items and `pcoConfig.favoriteServiceTypeIds` = [id1,id3], `populateServiceTypeSelect()` renders a `#pcoServiceTypeSelect` whose `<option>` values (excluding the empty placeholder) are exactly {id1,id3} (order aside).
  - With favorites [] → all 4 options present.
  - With favorites [id1,id3] AND the currently-selected id2 → options include id1,id3,id2 (selected kept).
  - Set the bar filter (`pcoStFilter='sun'` via `ev`, or dispatch input on `#pcoServiceTypeSearch`) then `populateServiceTypeSelect()` → only name-matching options (+selected) remain.
  Use `ev('pcoServiceTypes=[...]; state.pcoConfig.favoriteServiceTypeIds=[...]; populateServiceTypeSelect()')` and read `#pcoServiceTypeSelect` options via the DOM.

- [ ] **Step 2 — Run, expect FAIL** (`favoriteServiceTypeIds`/filter not implemented): `SA_HTML=index.html node tests/pcofilter.js`.

- [ ] **Step 3 — State field.** Grep `pcoConfig: { clientId:''`. Add `favoriteServiceTypeIds: []` to that DEFAULT_STATE.pcoConfig literal (the load-time spread `{ ...DEFAULT_STATE.pcoConfig, ...(p.pcoConfig||{}) }` migrates it). Also confirm it's preserved across the "New Service"/reset path (the block that keeps `pcoConfig`) — no change needed if it copies the whole object.

- [ ] **Step 4 — Module var for the bar filter.** Grep `let pcoServiceTypes = [];`. Immediately after, add `let pcoStFilter = '';`.

- [ ] **Step 5 — Filter in `populateServiceTypeSelect`.** Grep `function populateServiceTypeSelect()`. At the TOP of the function (before the `byFolder` grouping), replace the source list `pcoServiceTypes` with a filtered `list`:
```js
  const favSet = new Set(state.pcoConfig.favoriteServiceTypeIds || []);
  const selId = state.pcoConfig.selectedServiceTypeId || '';
  const q = (pcoStFilter || '').trim().toLowerCase();
  let list = pcoServiceTypes.slice();
  if (favSet.size) list = list.filter(s => favSet.has(s.id) || s.id === selId);
  if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q) || s.id === selId);
```
Then change the grouping loop to iterate `list` instead of `pcoServiceTypes` (the `forEach(s => …)` that builds `byFolder`). Everything else (optgroups, alphabetize) unchanged. At the END of the function (after `sel.innerHTML = html; sel.disabled = false;`) add:
```js
  if (selId) sel.value = selId; // keep the current selection across re-renders
```

- [ ] **Step 6 — PCO-bar search input.** Grep the pco-bar markup `<select id="pcoServiceTypeSelect" disabled>`. Immediately BEFORE it, add:
```html
<input type="text" id="pcoServiceTypeSearch" class="pco-filter" placeholder="Filter…" autocomplete="off" disabled />
```
In `populateServiceTypeSelect`, also enable it: after `sel.disabled = false;` add `const fInp=document.getElementById('pcoServiceTypeSearch'); if(fInp) fInp.disabled=false;`. Wire it: grep the service-type change-handler wiring `document.getElementById('pcoServiceTypeSelect').addEventListener('change'`. Immediately after that line add:
```js
  { const f = document.getElementById('pcoServiceTypeSearch'); if (f) f.addEventListener('input', e => { pcoStFilter = e.target.value; populateServiceTypeSelect(); }); }
```

- [ ] **Step 7 — CSS.** Grep `.pco-label`. After the nearest `.pco-*` rule add:
```css
.pco-filter{background:var(--bg-inset);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;padding:4px 8px;width:96px}
.pco-filter:focus{border-color:var(--accent);outline:none;width:140px}
```

- [ ] **Step 8 — Run test, expect PASS.** `SA_HTML=index.html node tests/pcofilter.js`.

- [ ] **Step 9 — Full suite.** `npm run check && npm test` → green (allow `curve.js`). `tests/venues5.js` MUST still pass (it sets `selectedServiceTypeId` then asserts `sel.value`; the new `if(selId) sel.value=selId` supports it; favorites default [] shows all).

- [ ] **Step 10 — Commit.**
```bash
git add index.html tests/pcofilter.js
git commit -m "feat(pco): favorites + search filter the service-type dropdown"
```

---

## Task 2: Favorites picker UI in Advanced Settings (`renderPCOSettings`)

**Files:** Modify `index.html`. Test: extend `tests/pcofilter.js`.

- [ ] **Step 1 — Failing checks.** In `tests/pcofilter.js`, add (before the RESULT line): open settings PCO tab / call `renderPCOSettings()` with `pcoServiceTypes` seeded; assert `#stFavList` renders one checkbox per service type; checking a box adds its id to `state.pcoConfig.favoriteServiceTypeIds` and unchecking removes it; the `#stFavSearch` input filters visible rows (hide non-matching). If `renderPCOSettings` needs the settings DOM, call it directly and read `#pcoSettingsContent`.

- [ ] **Step 2 — Run, expect FAIL.**

- [ ] **Step 3 — Add the section to `renderPCOSettings`.** Grep `function renderPCOSettings()`. Find where it builds its HTML into `#pcoSettingsContent` (the container). Append a section AFTER the existing content:
```js
  // --- Service-type filter (favorites) ---
  const favWrap = document.createElement('div');
  favWrap.className = 'pco-fav-section';
  if (!pcoServiceTypes.length) {
    favWrap.innerHTML = `<div class="section-label">Service types in the pull dropdown</div>
      <p class="subtitle" style="font-size:12px;">Connect to Planning Center to choose which service types appear in the dropdown.</p>`;
  } else {
    const fav = new Set(state.pcoConfig.favoriteServiceTypeIds || []);
    const rows = [...pcoServiceTypes].sort((a,b)=>(a.folderName||'').localeCompare(b.folderName||'')||a.name.localeCompare(b.name))
      .map(s => `<label class="st-fav-row" data-name="${esc((s.name+' '+(s.folderName||'')).toLowerCase())}">
        <input type="checkbox" class="st-fav-cb" value="${esc(s.id)}"${fav.has(s.id)?' checked':''}/>
        <span class="st-fav-name">${esc(s.name)}</span>${s.folderName?`<span class="st-fav-folder">${esc(s.folderName)}</span>`:''}</label>`).join('');
    favWrap.innerHTML = `<div class="section-label">Service types in the pull dropdown</div>
      <p class="subtitle" style="font-size:12px;">Check the service types this room uses — only those show in the pull dropdown. Leave all unchecked to show everything.</p>
      <div class="st-fav-controls"><input type="text" id="stFavSearch" class="setup-mgr-search" placeholder="Search service types…" autocomplete="off"/>
      <button type="button" class="btn ghost" id="stFavClear">Clear</button></div>
      <div class="st-fav-list" id="stFavList">${rows}</div>`;
  }
  // (append favWrap to the settings container element used by this function)
  <CONTAINER>.appendChild(favWrap);
```
Replace `<CONTAINER>` with the actual element `renderPCOSettings` appends to (re-grep — it renders into `#pcoSettingsContent`; use that element variable). Then wire (after appending):
```js
  favWrap.querySelectorAll('.st-fav-cb').forEach(cb => cb.addEventListener('change', e => {
    const id = e.target.value; let arr = state.pcoConfig.favoriteServiceTypeIds || (state.pcoConfig.favoriteServiceTypeIds = []);
    if (e.target.checked) { if (arr.indexOf(id) === -1) arr.push(id); } else { state.pcoConfig.favoriteServiceTypeIds = arr.filter(x => x !== id); }
    saveState();
    if (typeof populateServiceTypeSelect === 'function') populateServiceTypeSelect();
  }));
  const favSearch = favWrap.querySelector('#stFavSearch');
  if (favSearch) favSearch.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    favWrap.querySelectorAll('.st-fav-row').forEach(r => { r.style.display = (!q || (r.dataset.name||'').includes(q)) ? '' : 'none'; });
  });
  const favClear = favWrap.querySelector('#stFavClear');
  if (favClear) favClear.addEventListener('click', () => {
    state.pcoConfig.favoriteServiceTypeIds = []; saveState();
    if (typeof populateServiceTypeSelect === 'function') populateServiceTypeSelect();
    renderPCOSettings();
  });
```

- [ ] **Step 4 — CSS.** Near the `.pco-*` rules add:
```css
.pco-fav-section{margin-top:20px}
.st-fav-controls{display:flex;gap:8px;align-items:center;margin:8px 0}
.st-fav-list{max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px}
.st-fav-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:12.5px;color:var(--text)}
.st-fav-row:hover{background:var(--bg-inset)}
.st-fav-name{flex:1}
.st-fav-folder{font-size:10.5px;color:var(--text-faint);font-family:var(--ff-mono)}
```

- [ ] **Step 5 — Run test, expect PASS.** `SA_HTML=index.html node tests/pcofilter.js`.

- [ ] **Step 6 — Full suite.** `npm run check && npm test` → green.

- [ ] **Step 7 — Commit.**
```bash
git add index.html tests/pcofilter.js
git commit -m "feat(pco): favorites picker (search + checkboxes) in Advanced Settings"
```

---

## Task 3: Docs
- [ ] WATCHLIST: append next item — "PCO service-type dropdown honors `pcoConfig.favoriteServiceTypeIds` (checkbox picker in Advanced Settings → Planning Center, with search) + a live PCO-bar filter box; empty favorites = show all; selected id always kept. (`populateServiceTypeSelect`; `tests/pcofilter.js`)". Bump header counts.
- [ ] Backlog: mark the PCO host/pastor item's sibling — add "PCO service-type filter ✅ SHIPPED 2026-07-26 → pcofilter".
- [ ] `npm run check && npm test` green; commit `docs: record PCO service-type filter`.

## Definition of done
- Suite green; `tests/pcofilter.js` + `tests/venues5.js` pass.
- Booth: Advanced Settings → Planning Center → check a few service types → the PCO-bar dropdown shows only those; the bar Filter box narrows live; Clear resets to all.
