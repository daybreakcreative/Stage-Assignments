# Bug report — drag-drop multi-attachments — design

**Date:** 2026-07-20
**Status:** Approved (design), pending build
**Spans two repos** (folds into the not-yet-deployed "bug → KHARIS" batch):
- **KHARIS** — `~/daybreak-production-ai` `POST /bug`: accept an `attachments[]` array (back-compat with the single `screenshot`).
- **Stage·Assign** — `index.html` bug modal: a clickable drop zone accepting multiple files of any type; button "Submit".

## Problem / goal

The bug modal accepts a single screenshot via a `<input type=file>` and the button reads
"Download & open GitHub issue". Dillon wants: **drag-and-drop**, **multiple attachments of any
type**, and a button that just says **Submit** (sending straight to KHARIS). The KHARIS repoint
(POST to `/bug`, "Send to KHARIS" copy) is already built + merged locally but NOT deployed — this
change lands in the same batch, one deploy.

## Current state (post-repoint, unpushed)

- **Stage·Assign** `openBugReportModal()` (`index.html:~11621`): sheet has `<input type="file"
  id="brf_shot" accept="image/*">` + `#brf_shot_preview`; a change handler reads ONE file to a data
  URL into closure vars `shotDataUrl`/`shotName`. `#brf_send` handler calls
  `sendBugReport({desc, shotDataUrl, shotName})`. `sendBugReport` (async) POSTs
  `{description, build, serviceDate, config, screenshot:{dataUrl,name}}` to `state.config.bugIntakeUrl`
  (default `https://daybreak.up.railway.app/bug`); `sendBugReportFallback` downloads config +
  screenshot and opens a GitHub issue; `sanitizedConfigJSON()` strips PCO secrets.
- **KHARIS** (deployed) `POST /bug` (`index.js`): reads `{description, build, serviceDate, config,
  screenshot}`; uploads `screenshot` (if `data:image/`) + config via `basecamp.uploadAttachment`,
  embeds both in one `createCampfireLine(KHARIS_CHAT_PROJECT_ID, formatBugContent(...))`.
  `uploadAttachment(name, contentType, bytes)` handles any content-type. `formatBugContent(...)`
  emits one `<bc-attachment sgid>` per `attachments[]` entry (already array-shaped).

## Design — Stage·Assign (`index.html`)

### A. Multi-file drop zone in `openBugReportModal`

Replace the `#brf_shot` input + `#brf_shot_preview` block with:
- A hidden `<input type="file" id="brf_files" multiple>` (no `accept` restriction — any file).
- A clickable dashed drop zone `#brf_drop` (label "Drag files here, or click to choose — screenshots,
  logs, exported config…"). Clicking it triggers `#brf_files.click()`.
- A list container `#brf_list` rendering the current attachments (image → thumbnail; other → a file
  chip with name); each row has a ✕ remove button.

State: a closure array `attachments = []` of `{ dataUrl, name, type }`.

Handlers:
- `#brf_files` `change`: for each `e.target.files`, `FileReader.readAsDataURL` → push
  `{dataUrl, name:f.name, type:f.type||'application/octet-stream'}`; re-render `#brf_list`; reset the
  input value so re-selecting the same file re-fires.
- `#brf_drop`: `dragover`/`dragenter` → `preventDefault` + add a `.drag` class; `dragleave` → remove
  it; `drop` → `preventDefault`, read `e.dataTransfer.files` the same way; click → `#brf_files.click()`.
- Remove (✕): splice that index out of `attachments`, re-render.
- **Size guard:** track total base64 bytes; if adding a file would push the total over ~8 MB, skip it
  and `toast('That attachment is too large to send','warn')` (server cap is 10 MB).

A small helper `addBugFiles(fileList)` (shared by change + drop) does the read/push/re-render, and
`renderBugAttachments()` redraws `#brf_list`. Keep them local to `openBugReportModal` (closure) — no
new globals.

### B. `#brf_send` → "Submit"; payload uses `attachments`

- Button label: **`Submit`** (was "Download & open GitHub issue"/"Send to KHARIS").
- Handler: still validates non-empty description, then
  `sendBugReport({ desc, attachments })` and `close()`.

### C. `sendBugReport` + fallback take `attachments[]`

```js
async function sendBugReport(r) {
  const build = ((document.getElementById('buildStamp') || {}).textContent || '').trim();
  const dateStr = (state.service && state.service.date) || '';
  const url = (state.config && state.config.bugIntakeUrl) || 'https://daybreak.up.railway.app/bug';
  const atts = (r.attachments || []).map(a => ({ dataUrl: a.dataUrl, name: a.name, type: a.type }));
  const payload = { description: r.desc, build, serviceDate: dateStr, config: sanitizedConfigJSON(), attachments: atts };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    toast('Bug report sent to KHARIS ✓', 'success');
    return { ok: true };
  } catch (e) {
    return sendBugReportFallback(r, build, dateStr);
  }
}
```

`sendBugReportFallback(r, build, dateStr)`: download `sanitizedConfigJSON()` + **each** attachment
(decode its data URL → bytes → `downloadBlob(bytes, a.name, a.type)`), then build/open the GitHub
issue URL (same as now; the body note becomes "…the config JSON and N attachment(s)"). No secrets in
any downloaded file.

## Design — KHARIS (`~/daybreak-production-ai` `POST /bug`)

Change the route to loop an `attachments[]` array (keep the config upload; fold a legacy single
`screenshot` in for back-compat):

```js
const { description, build, serviceDate, config, attachments, screenshot } = req.body || {};
if (!description || !String(description).trim()) return res.status(400).json({ ok:false, error:"description required" });
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
if (config) { /* unchanged: upload stageassign-config.json → push its sgid to `uploaded` */ }
const content = formatBugContent({ description, build, serviceDate, attachments: uploaded });
await basecamp.createCampfireLine(scanTargets.KHARIS_CHAT_PROJECT_ID, content);
res.json({ ok: true, attachments: uploaded.length });
```

- `formatBugContent` is unchanged (already renders one `<bc-attachment>` per `attachments[]` entry).
- Non-image files upload fine (any content-type) and render as download links in the campfire line.
- Back-compat: an old client sending `screenshot` still works.

## Testing

**KHARIS (`node --test`):**
- Extend/keep `tests/bugFormat.test.js` (unchanged — still valid). The route loop isn't unit-tested
  (mirrors existing route coverage); verified by the existing `formatBugContent` test + a post-deploy
  curl with a 2-item `attachments` array (coordinator).

**Stage·Assign (`tests/bugreport.js`, jsdom):**
- Drop zone renders: `#brf_drop` present, `#brf_files` is `multiple`, old `#brf_shot` gone.
- Adding two files (simulate via `addBugFiles` or dispatching a `change` with a stubbed `files` list
  of two `{name,type}` + a `FileReader` that yields a data URL) → `#brf_list` shows 2 removable rows;
  removing one → 1 row.
- Submit POSTs `attachments` as an ARRAY of `{dataUrl,name,type}` (length 2), `config` a sanitized
  string with no `clientSecret`/`clientId`. Button reads "Submit".
- Fetch-failure → fallback opens the GitHub URL and `downloadBlob` was called for config + each
  attachment (stub `downloadBlob`, count calls).
- Empty description → no submit.

`npm run check` + `npm test` green (allow `curve.js`).

## Build / deploy order

1. **KHARIS first:** update `POST /bug` to the `attachments[]` loop (back-compat), `npm test`, merge,
   **push → Railway** (confirm with Dillon), verify a 2-attachment curl posts a campfire line.
2. **Stage·Assign second:** build the modal + payload + tests, `npm run check && npm test`, merge
   (on top of the already-merged repoint), **push → Pages** (confirm with Dillon) — one deploy
   carries the repoint + drag-drop + "Submit".

## Scope / non-goals

- Any file type; total payload soft-capped ~8 MB client-side (server hard cap 10 MB).
- Config JSON stays an auto-bundled separate upload (not a user attachment).
- Still a campfire line (attachments embedded); no card/message.
- No new persisted config beyond the existing `bugIntakeUrl`.
- Booth-verify the embedded image renders in the campfire line (one-line switch to a message post if
  not).
