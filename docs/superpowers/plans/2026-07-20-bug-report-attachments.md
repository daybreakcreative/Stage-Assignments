# Bug Report Drag-Drop Multi-Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the in-app bug report accept multiple files of any type via a clickable drag-and-drop zone, send them all to KHARIS as an `attachments[]` array, and label the button "Submit".

**Architecture:** Two repos. **KHARIS** (`~/daybreak-production-ai`): generalize `POST /bug` from a single `screenshot` to an `attachments[]` loop (back-compat with `screenshot`). **Stage·Assign** (`index.html`): replace the single file input with a drop zone tracking an `attachments` array; `sendBugReport`/fallback send/download all attachments; button "Submit".

**Tech Stack:** KHARIS = Node ESM, Express, `node --test`. Stage·Assign = vanilla single-file `index.html`, jsdom tests.

---

## Ground rules

- **Two working dirs.** Task 1 = `/Users/dillonthomas/daybreak-production-ai` (KHARIS). Tasks 2–3 = `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App`. Never cross-edit.
- **Re-grep before every edit.** Never commit red. Stage·Assign: `npm run check` + `npm test` (`curve.js` known false-fail — ignore only that). KHARIS: `npm test` (`node --test`).
- KHARIS pre-existing uncommitted files (`.gitignore`, `vacancyTracker.json`, `views/inventory.html`) are NOT yours — never stage them; use explicit `git add <file>`.
- **Deploys are the coordinator's job with Dillon's confirmation.** Subagents never push. Deploy gate between Task 1 (KHARIS) and Task 2 (Stage).

## File Structure

- **KHARIS:** `index.js` (`POST /bug` route body).
- **Stage·Assign:** `index.html` (`sendBugReport`, `sendBugReportFallback`, `openBugReportModal`, `.brf-*` CSS); `tests/bugreport.js`; `docs/WATCHLIST.md`.

---

## Task 1: KHARIS — `POST /bug` accepts `attachments[]`

**Repo:** `/Users/dillonthomas/daybreak-production-ai`
**Files:** Modify `index.js`

- [ ] **Step 1: Replace the route body's upload logic.** Grep for `app.post("/bug", express.json({ limit: "10mb" })`. Inside that handler, replace everything from `const { description, build, serviceDate, config, screenshot } = req.body || {};` through the line that builds `const content = formatBugContent(...)` (i.e. the destructure + validation + the screenshot-upload `if` block + the config-upload `if` block + the `content` line) with:

```js
    const { description, build, serviceDate, config, attachments, screenshot } = req.body || {};
    if (!description || !String(description).trim()) {
      return res.status(400).json({ ok: false, error: "description required" });
    }
    const list = Array.isArray(attachments) ? attachments.slice() : [];
    if (screenshot && screenshot.dataUrl) list.unshift(screenshot); // legacy single-screenshot support
    const uploaded = [];
    for (const a of list) {
      if (!a || !a.dataUrl || !/^data:/.test(a.dataUrl)) continue;
      try {
        const b64 = a.dataUrl.split(",")[1] || "";
        const bytes = Buffer.from(b64, "base64");
        const ct = (a.dataUrl.match(/^data:([^;]+)/) || [])[1] || a.type || "application/octet-stream";
        const up = await basecamp.uploadAttachment(a.name || "attachment", ct, bytes);
        if (up && up.attachable_sgid) uploaded.push({ sgid: up.attachable_sgid });
      } catch (e) { console.error("[bug] attachment upload failed:", e.message); }
    }
    if (config) {
      try {
        const text = typeof config === "string" ? config : JSON.stringify(config, null, 2);
        const up = await basecamp.uploadAttachment("stageassign-config.json", "application/json", Buffer.from(text, "utf8"));
        if (up && up.attachable_sgid) uploaded.push({ sgid: up.attachable_sgid });
      } catch (e) { console.error("[bug] config upload failed:", e.message); }
    }
    const content = formatBugContent({ description, build, serviceDate, attachments: uploaded });
```

Leave the surrounding lines (`bugCors(res);`, the `try {`, the `await basecamp.createCampfireLine(...)`, `res.json({ ok: true, attachments: uploaded.length });`, the `catch`) intact. Confirm the final `res.json` references `uploaded.length` (rename if the old code used a different var).

- [ ] **Step 2: Syntax check.** `cd ~/daybreak-production-ai && node --check index.js` → no error.

- [ ] **Step 3: Full suite.** `npm test` → still green (no new failures; the route isn't unit-tested — `formatBugContent`'s test already covers the content shape). If a failure appears, confirm pre-existing via `git stash`/`npm test`/`git stash pop`.

- [ ] **Step 4: Commit ONLY index.js.**

```bash
cd ~/daybreak-production-ai
git add index.js
git commit -m "feat(bug): POST /bug accepts attachments[] (back-compat with screenshot)"
```

- [ ] **Step 5: STOP for coordinator deploy.** Report DONE. The coordinator merges + confirms push→Railway with Dillon, then verifies a 2-attachment curl posts a campfire line, before Stage·Assign work begins.

---

## Task 2: Stage·Assign — drop zone, multi-attachment payload, "Submit"

**Repo:** `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App`
**Files:** Modify `index.html`, `tests/bugreport.js`

- [ ] **Step 1: Rewrite the transport + drop-zone tests in `tests/bugreport.js`.** Read the file. Keep the "empty description → no submit" check. Ensure the load callback is `async`, and near its top it has `ev('downloadBlob=function(){};'); ev('toast=function(){};');`. Replace the modal-render check and the two transport checks with these (a helper adds files by directly invoking the drop handler path via a synthetic `drop` event carrying a `dataTransfer.files`, then waits for `FileReader`):

```js
 // Build a jsdom File with a known data URL result.
 function mkFile(name, type, text){ return new window.File([text||'x'], name, {type:type||'application/octet-stream'}); }
 function fireDrop(zone, files){
   const ev2 = new window.Event('drop', {bubbles:true, cancelable:true});
   Object.defineProperty(ev2, 'dataTransfer', { value: { files } });
   zone.dispatchEvent(ev2);
 }
 const wait = ms => new Promise(r=>setTimeout(r, ms));

 check('modal shows a clickable drop zone + hidden multi-file input; old single input gone', ()=>{
   ev('openBugReportModal();');
   if(!doc.getElementById('brf_drop')) throw new Error('drop zone #brf_drop missing');
   const inp=doc.getElementById('brf_files');
   if(!inp || !inp.multiple) throw new Error('#brf_files should be a multiple file input');
   if(doc.getElementById('brf_shot')) throw new Error('old single #brf_shot input should be gone');
   if(!/Submit/i.test(doc.getElementById('brf_send').textContent)) throw new Error('send button should read Submit');
 });

 check('dropping two files lists two removable rows; removing one leaves one', async ()=>{
   ev('openBugReportModal();');
   const zone=doc.getElementById('brf_drop');
   fireDrop(zone, [mkFile('a.png','image/png'), mkFile('log.txt','text/plain')]);
   await wait(40);
   let rows=doc.querySelectorAll('#brf_list [data-att-idx]');
   if(rows.length!==2) throw new Error('expected 2 attachment rows, got '+rows.length);
   rows[0].querySelector('[data-att-remove]').dispatchEvent(new window.Event('click',{bubbles:true}));
   rows=doc.querySelectorAll('#brf_list [data-att-idx]');
   if(rows.length!==1) throw new Error('expected 1 row after remove, got '+rows.length);
 });

 check('Submit POSTs attachments[] + sanitized config to the intake URL', async ()=>{
   ev(`state.pcoConfig=state.pcoConfig||{}; state.pcoConfig.clientId='CID'; state.pcoConfig.clientSecret='SECRET';`);
   let captured=null;
   window.fetch=(url,opts)=>{ captured={url,opts}; return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})}); };
   ev('openBugReportModal();');
   fireDrop(doc.getElementById('brf_drop'), [mkFile('a.png','image/png'), mkFile('b.log','text/plain')]);
   await wait(40);
   doc.getElementById('brf_desc').value='multi attach test';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await wait(40);
   if(!captured) throw new Error('fetch not called');
   if(!/\/bug$/.test(captured.url)) throw new Error('should POST to /bug, got '+captured.url);
   const body=JSON.parse(captured.opts.body);
   if(!Array.isArray(body.attachments)||body.attachments.length!==2) throw new Error('attachments should be an array of 2');
   if(!body.attachments[0].dataUrl||!body.attachments[0].name) throw new Error('attachment missing dataUrl/name');
   if(typeof body.config!=='string'||/SECRET|CID/.test(body.config)) throw new Error('config must be sanitized string');
 });

 check('on fetch failure it falls back to download + GitHub issue', async ()=>{
   let opened=null; window.open=(u)=>{opened=u;return{};};
   let dl=0; ev('downloadBlob=function(){window.__dl=(window.__dl||0)+1;};');
   window.fetch=()=>Promise.reject(new Error('network'));
   ev('openBugReportModal(); window.__dl=0;');
   fireDrop(doc.getElementById('brf_drop'), [mkFile('a.png','image/png')]);
   await wait(40);
   doc.getElementById('brf_desc').value='fallback test';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await wait(40);
   if(!opened||!/github\.com\/daybreakcreative\/Stage-Assignments\/issues\/new/.test(opened)) throw new Error('fallback should open GitHub URL');
   if((window.__dl||0) < 2) throw new Error('fallback should download config + the attachment (>=2 downloadBlob calls), got '+(window.__dl||0));
 });
```

(If jsdom's `FileReader` doesn't resolve within 40ms, bump the `wait` to 80ms. `window.File`/`Blob`/`FileReader` exist in jsdom.)

- [ ] **Step 2: Run it, expect FAIL.** `SA_HTML=index.html node tests/bugreport.js` → FAIL (no `#brf_drop`).

- [ ] **Step 3: Replace the modal file-input markup + handler.** Grep for `<label class="brf-field"><span class="brf-lbl">Screenshot (optional)</span>`. Replace that `<label>…</label>` line AND the next line `<div id="brf_shot_preview"></div>` with:

```html
      <div class="brf-field"><span class="brf-lbl">Attachments (optional)</span>
        <div id="brf_drop" class="brf-drop" tabindex="0">Drag files here, or click to choose — screenshots, logs, exported config…</div>
        <input type="file" id="brf_files" multiple style="display:none" />
        <div id="brf_list" class="brf-list"></div></div>
```

- [ ] **Step 4: Replace the modal state + change handler with the drop-zone logic.** Grep for `let shotDataUrl = '', shotName = '';` (inside `openBugReportModal`) and replace it with:

```js
  const attachments = []; // { dataUrl, name, type }
```

Then grep for `sheet.querySelector('#brf_shot').addEventListener('change', e => {` and replace that whole `addEventListener('change', …)` block (through its closing `});`) with:

```js
  const MAX_TOTAL = 8 * 1024 * 1024; // ~8MB soft cap (server hard cap 10MB)
  const totalBytes = () => attachments.reduce((n, a) => n + Math.floor(((a.dataUrl || '').length) * 0.75), 0);
  function renderBugAttachments() {
    const list = sheet.querySelector('#brf_list'); if (!list) return;
    list.innerHTML = attachments.map((a, i) => {
      const thumb = /^data:image\//.test(a.dataUrl)
        ? `<img src="${a.dataUrl}" class="brf-thumb" alt="">`
        : `<span class="brf-file-ic">📄</span>`;
      return `<div class="brf-att" data-att-idx="${i}">${thumb}<span class="brf-att-name">${esc(a.name)}</span><button type="button" class="brf-att-x" data-att-remove aria-label="Remove">✕</button></div>`;
    }).join('');
    list.querySelectorAll('[data-att-remove]').forEach(btn => btn.addEventListener('click', () => {
      const row = btn.closest('[data-att-idx]'); const idx = row && +row.getAttribute('data-att-idx');
      if (idx > -1) { attachments.splice(idx, 1); renderBugAttachments(); }
    }));
  }
  function addBugFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    let remaining = files.length;
    if (!remaining) return;
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev2 => {
        const dataUrl = ev2.target.result;
        const approxBytes = Math.floor(((dataUrl || '').length) * 0.75);
        if (totalBytes() + approxBytes > MAX_TOTAL) { toast('That attachment is too large to send', 'warn'); }
        else attachments.push({ dataUrl, name: f.name || 'attachment', type: f.type || 'application/octet-stream' });
        if (--remaining === 0) renderBugAttachments();
      };
      reader.onerror = () => { if (--remaining === 0) renderBugAttachments(); };
      reader.readAsDataURL(f);
    });
  }
  const drop = sheet.querySelector('#brf_drop');
  const fileInput = sheet.querySelector('#brf_files');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', e => { addBugFiles(e.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'dragend'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('drag')));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); addBugFiles(e.dataTransfer && e.dataTransfer.files); });
```

- [ ] **Step 5: Update the send button label + handler.** Grep for `<button type="button" class="btn primary" id="brf_send">Send to KHARIS</button>` → change the label to `Submit`. Then grep for `sendBugReport({ desc, shotDataUrl, shotName });` and replace with `sendBugReport({ desc, attachments });`.

- [ ] **Step 6: Update `sendBugReport` payload.** Grep for `async function sendBugReport(r) {`. Replace the `const payload = { … };` inside it with:

```js
  const atts = (r.attachments || []).map(a => ({ dataUrl: a.dataUrl, name: a.name, type: a.type }));
  const payload = { description: r.desc, build, serviceDate: dateStr, config: sanitizedConfigJSON(), attachments: atts };
```

- [ ] **Step 7: Update `sendBugReportFallback` to download each attachment.** Grep for `function sendBugReportFallback(r, build, dateStr) {`. Replace the `if (r.shotDataUrl) { … }` block (the single-screenshot download) with a loop, and update the body note. New body of the function (replace whole function):

```js
function sendBugReportFallback(r, build, dateStr) {
  const safe = (state.service && state.service.name ? state.service.name : 'stageassign').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadBlob(sanitizedConfigJSON(), `${safe}-config.json`, 'application/json');
  const atts = r.attachments || [];
  atts.forEach(a => {
    try {
      const bin = atob((a.dataUrl || '').split(',')[1] || ''); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      downloadBlob(arr, a.name || 'attachment', a.type || 'application/octet-stream');
    } catch (e) { /* ignore a bad attachment */ }
  });
  const title = 'Bug: ' + (r.desc.split('\n')[0] || 'report').slice(0, 70);
  const body = [
    r.desc, '', '---',
    '**Build:** ' + (build || 'unknown'),
    dateStr ? ('**Service date:** ' + dateStr) : '',
    '', '_Drag in the files that just downloaded: the config JSON' + (atts.length ? ` and ${atts.length} attachment${atts.length === 1 ? '' : 's'}` : '') + '._'
  ].filter(Boolean).join('\n');
  const url = `https://github.com/${BUG_REPORT_REPO}/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
  toast('Couldn’t reach KHARIS — files downloaded, drag them into the GitHub issue', 'warn');
  return url;
}
```

- [ ] **Step 8: Add CSS.** Grep for `.brf-thumb` (existing bug-modal CSS). After the nearest `.brf-*` rule, add:

```css
.brf-drop{border:1.5px dashed var(--border-2);border-radius:9px;padding:16px;text-align:center;font-size:12.5px;color:var(--text-muted);cursor:pointer;transition:border-color .15s,background .15s}
.brf-drop:hover,.brf-drop.drag{border-color:var(--accent);background:var(--bg-inset);color:var(--text)}
.brf-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.brf-att{display:flex;align-items:center;gap:8px;background:var(--bg-inset);border:1px solid var(--border);border-radius:7px;padding:5px 8px}
.brf-att .brf-thumb{width:34px;height:34px;object-fit:cover;border-radius:5px;flex:none}
.brf-att .brf-file-ic{width:34px;text-align:center;flex:none;font-size:16px}
.brf-att-name{flex:1;font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.brf-att-x{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:12px;flex:none}
.brf-att-x:hover{color:var(--danger)}
```

- [ ] **Step 9: Run the test, expect PASS.** `SA_HTML=index.html node tests/bugreport.js` → ALL CHECKS PASSED. (If `FileReader` timing flakes, bump the `wait()` values in the test to 80.)

- [ ] **Step 10: Full suite.** `npm run check && npm test` → green (allow `curve.js`).

- [ ] **Step 11: Commit.**

```bash
cd "/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App"
git add index.html tests/bugreport.js
git commit -m "feat(bug): drag-drop multi-file attachments; button reads Submit"
```

---

## Task 3: Stage·Assign — docs

**Repo:** `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App`
**Files:** Modify `docs/WATCHLIST.md`

- [ ] **Step 1: Amend WATCHLIST item 42** (the bug→KHARIS entry). Grep for `Bug report goes to KHARIS`. Replace the sentence fragment about the single screenshot so it reads (adjust the existing item's wording to include the multi-attachment/drop-zone + Submit button — keep it one item, don't add a new number):

```markdown
42. **Bug report goes to KHARIS.** "Report a bug" (button "Submit") POSTs
    `{description, build, serviceDate, config, attachments[]}` to `state.config.bugIntakeUrl`
    (default `daybreak.up.railway.app/bug`); PCO `clientId`/`clientSecret` are stripped from the
    config first. Attachments come from a clickable drag-and-drop zone (any file type, multiple).
    On any failure it falls back to the old download + prefilled-GitHub-issue flow (also sanitized).
    KHARIS `POST /bug` uploads each attachment + config to Basecamp and posts one campfire line.
    (`sendBugReport`/`openBugReportModal`; `tests/bugreport.js`.)
```

- [ ] **Step 2: Validate.** `npm run check && npm test` → green.

- [ ] **Step 3: Commit.**

```bash
git add docs/WATCHLIST.md
git commit -m "docs: bug report — drag-drop multi-attachments + Submit"
```

---

## Definition of done

- KHARIS: `npm test` green; `POST /bug` accepts `attachments[]`; deployed; a 2-attachment curl posts a campfire line.
- Stage·Assign: `npm run check` + `npm test` green; `tests/bugreport.js` passes (drop zone, 2-file add/remove, attachments[] POST + sanitized config, fallback downloads all).
- Booth checklist for Dillon: Report a bug → **drag 2 files** (e.g. a screenshot + a text file) onto the zone (or click to pick) → both appear as removable rows → **Submit** → confirm a 🐛 line with both attachments + `stageassign-config.json` lands in the KHARIS chat (and the image renders inline).
- Deploys: KHARIS push→Railway, then Stage·Assign push→Pages (the Stage push also carries the already-merged "Send to KHARIS" repoint) — each confirmed with Dillon.

---

## Self-review notes (author)

- **Spec coverage:** §A drop zone → Task 2 (steps 3–4, 8); §B Submit label + payload call → Task 2 (step 5); §C sendBugReport attachments → Task 2 (step 6); fallback → Task 2 (step 7); KHARIS route → Task 1; tests → Tasks 1–2; docs → Task 3. All mapped.
- **Placeholder scan:** none. The KHARIS config-upload block is shown in full in Task 1 (not "unchanged").
- **Type consistency:** payload `attachments: [{dataUrl,name,type}]` sent in Task 2 step 6 matches the route destructure in Task 1; `addBugFiles`/`renderBugAttachments`/`attachments` closure names consistent within Task 2; fallback reads `r.attachments`. `formatBugContent({attachments:[{sgid}]})` unchanged from the prior shipped helper.
- **Cross-repo:** deploy gate between Task 1 and Task 2 explicit; back-compat (`screenshot` folded into `list`) means the live endpoint tolerates either client during the transition.
