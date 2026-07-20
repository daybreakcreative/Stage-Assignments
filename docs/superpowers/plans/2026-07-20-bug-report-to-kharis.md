# Bug Report → KHARIS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repoint the Stage·Assign in-app bug report from a GitHub issue to a KHARIS `POST /bug` endpoint that posts the report (with screenshot + sanitized config as Basecamp attachments) into the KHARIS chat campfire.

**Architecture:** Two repos. **KHARIS** (`~/daybreak-production-ai`, Express on Railway): a `uploadAttachment` Basecamp helper + a pure `formatBugContent` helper + an open `POST /bug` route (raised body limit, per-route CORS). **Stage·Assign** (`index.html`, static Pages): `sendBugReport` POSTs sanitized JSON to a configurable intake URL, with today's download+GitHub flow kept as the failure fallback.

**Tech Stack:** KHARIS = Node ESM, Express, `node --test`. Stage·Assign = vanilla single-file `index.html`, jsdom tests (`npm run check` + `npm test`).

---

## Ground rules

- **Two working directories.** Tasks 1–2 run in `/Users/dillonthomas/daybreak-production-ai` (KHARIS). Tasks 3–4 run in `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App` (Stage·Assign). Each subagent works in ONE repo; never cross-edit.
- **Re-grep before every edit** in both repos (line numbers drift).
- KHARIS: `import * as basecamp from "./integrations/basecamp.js"`, `import * as scanTargets from "./flags/scanTargets.js"` (namespace imports). Tests: `npm test` (`node --test`). Deploy: push `main` → Railway auto-deploy (~40s), `https://daybreak.up.railway.app`.
- Stage·Assign: `npm run check` + `npm test`; `curve.js` is a KNOWN false-fail (ignore only that). Deploy: push `main` → GitHub Pages.
- **Deploys are the coordinator's job with Dillon's confirmation** — subagents never push.

## File Structure

- **KHARIS:** `integrations/basecamp.js` (+`uploadAttachment`); new `flags/bugFormat.js` (`formatBugContent`); `index.js` (+`OPTIONS /bug`, `POST /bug`); new `tests/bugFormat.test.js`.
- **Stage·Assign:** `index.html` (config field + `sanitizedConfigJSON` + `sendBugReport`/`sendBugReportFallback` + modal copy); `tests/bugreport.js` (rewrite transport asserts); `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`.

---

## Task 1: KHARIS — `uploadAttachment` + `formatBugContent` helpers (+ tests)

**Repo:** `/Users/dillonthomas/daybreak-production-ai`
**Files:** Modify `integrations/basecamp.js`; Create `flags/bugFormat.js`, `tests/bugFormat.test.js`

- [ ] **Step 1: Write the failing test — create `tests/bugFormat.test.js`.**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBugContent } from "../flags/bugFormat.js";

test("formatBugContent: heading, escaped description, build/service, one bc-attachment per sgid", () => {
  const html = formatBugContent({
    description: "IEM column <blank> after pull\nsecond line",
    build: "build-abc",
    serviceDate: "2026-07-20",
    attachments: [{ sgid: "SG1" }, { sgid: "SG2" }],
  });
  assert.match(html, /Bug report/);
  assert.match(html, /IEM column &lt;blank&gt; after pull/);   // escaped, no raw <blank>
  assert.ok(!/<blank>/.test(html), "raw angle brackets must be escaped");
  assert.match(html, /second line/);
  assert.match(html, /build-abc/);
  assert.match(html, /2026-07-20/);
  assert.equal((html.match(/<bc-attachment sgid=/g) || []).length, 2);
});

test("formatBugContent: no service line when serviceDate is empty; no attachments block when none", () => {
  const html = formatBugContent({ description: "x", build: "b", serviceDate: "", attachments: [] });
  assert.ok(!/Service:/.test(html));
  assert.ok(!/bc-attachment/.test(html));
});
```

- [ ] **Step 2: Run it, expect FAIL.** `cd ~/daybreak-production-ai && node --test tests/bugFormat.test.js` → FAIL (module not found).

- [ ] **Step 3: Create `flags/bugFormat.js`.**

```js
// Pure formatter for a Stage·Assign bug report → Basecamp campfire HTML content.
// Kept separate from the route so it's unit-testable without HTTP/Basecamp.
export function formatBugContent({ description, build, serviceDate, attachments }) {
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = [
    `<strong>🐛 Bug report — Stage·Assign</strong>`,
    esc(description).replace(/\n/g, "<br>"),
    `<em>Build:</em> ${esc(build || "unknown")}` +
      (serviceDate ? ` · <em>Service:</em> ${esc(serviceDate)}` : ""),
  ];
  (attachments || []).forEach((a) => {
    if (a && a.sgid) parts.push(`<bc-attachment sgid="${esc(a.sgid)}"></bc-attachment>`);
  });
  return parts.join("<br><br>");
}
```

- [ ] **Step 4: Add `uploadAttachment` to `integrations/basecamp.js`.** Grep for `export async function createCampfireLine`. Immediately BEFORE that line, insert:

```js
// Upload a file to Basecamp → { attachable_sgid } to embed in rich text via <bc-attachment>.
export async function uploadAttachment(name, contentType, bytes) {
  const stored = getTokens("basecamp");
  if (!stored?.access_token) throw new Error("Basecamp not authorized.");
  const res = await fetch(`${BC_BASE}/attachments.json?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stored.access_token}`,
      "User-Agent": "KHARIS - Daybreak Production (dillonthomas@daybreakchurch.org)",
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Basecamp attachment error ${res.status}: ${await res.text()}`);
  return res.json();
}
```

(`getTokens` and `BC_BASE` are already in scope at the top of `basecamp.js`. Node's `fetch` sets Content-Length automatically for a Buffer body.)

- [ ] **Step 5: Run the test, expect PASS.** `cd ~/daybreak-production-ai && node --test tests/bugFormat.test.js` → 2 pass.

- [ ] **Step 6: Full KHARIS suite.** `cd ~/daybreak-production-ai && npm test` → all pass (no pre-existing failures introduced). If the repo has unrelated failing tests, confirm they fail identically on `git stash` (pre-existing) — do not fix unrelated failures.

- [ ] **Step 7: Commit.**

```bash
cd ~/daybreak-production-ai
git add integrations/basecamp.js flags/bugFormat.js tests/bugFormat.test.js
git commit -m "feat(bug): Basecamp uploadAttachment + formatBugContent helper"
```

---

## Task 2: KHARIS — `POST /bug` route

**Repo:** `/Users/dillonthomas/daybreak-production-ai`
**Files:** Modify `index.js`

- [ ] **Step 1: Add the import.** Grep for `import * as scanTargets from "./flags/scanTargets.js";`. Immediately AFTER it, add:

```js
import { formatBugContent } from "./flags/bugFormat.js";
```

- [ ] **Step 2: Add the route.** Grep for `app.post("/prf/submit"`. Immediately BEFORE that line, insert:

```js
const BUG_ALLOW_ORIGIN = "https://daybreakcreative.github.io";
function bugCors(res) {
  res.set("Access-Control-Allow-Origin", BUG_ALLOW_ORIGIN);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}
app.options("/bug", (req, res) => { bugCors(res); res.status(204).end(); });
app.post("/bug", express.json({ limit: "10mb" }), async (req, res) => {
  bugCors(res);
  try {
    const { description, build, serviceDate, config, screenshot } = req.body || {};
    if (!description || !String(description).trim()) {
      return res.status(400).json({ ok: false, error: "description required" });
    }
    const attachments = [];
    if (screenshot && screenshot.dataUrl && /^data:image\//.test(screenshot.dataUrl)) {
      try {
        const b64 = screenshot.dataUrl.split(",")[1] || "";
        const bytes = Buffer.from(b64, "base64");
        const ct = (screenshot.dataUrl.match(/^data:([^;]+)/) || [])[1] || "image/png";
        const up = await basecamp.uploadAttachment(screenshot.name || "screenshot.png", ct, bytes);
        if (up && up.attachable_sgid) attachments.push({ sgid: up.attachable_sgid });
      } catch (e) { console.error("[bug] screenshot upload failed:", e.message); }
    }
    if (config) {
      try {
        const text = typeof config === "string" ? config : JSON.stringify(config, null, 2);
        const up = await basecamp.uploadAttachment("stageassign-config.json", "application/json", Buffer.from(text, "utf8"));
        if (up && up.attachable_sgid) attachments.push({ sgid: up.attachable_sgid });
      } catch (e) { console.error("[bug] config upload failed:", e.message); }
    }
    const content = formatBugContent({ description, build, serviceDate, attachments });
    await basecamp.createCampfireLine(scanTargets.KHARIS_CHAT_PROJECT_ID, content);
    res.json({ ok: true, attachments: attachments.length });
  } catch (err) {
    console.error("[bug] submit error:", err.message);
    res.status(500).json({ ok: false, error: "server error" });
  }
});
```

- [ ] **Step 3: Syntax check.** `cd ~/daybreak-production-ai && node --check index.js` → no error. Then `npm test` → still green (route isn't unit-tested; this confirms nothing else broke).

- [ ] **Step 4: Local smoke (optional but preferred).** If the repo can boot locally with tokens, `node index.js` and in another shell:
  `curl -i -X OPTIONS http://localhost:8080/bug` → `204` with `Access-Control-Allow-Origin: https://daybreakcreative.github.io`;
  `curl -i -X POST http://localhost:8080/bug -H 'Content-Type: application/json' -d '{"description":"test"}'` → `200 {"ok":true,...}` (posts a real campfire line — only run if Dillon is OK with a test line, else skip and rely on post-deploy verification). If it can't boot locally (missing tokens), SKIP and note it.

- [ ] **Step 5: Commit.**

```bash
cd ~/daybreak-production-ai
git add index.js
git commit -m "feat(bug): POST /bug intake → Basecamp campfire (CORS + 10mb limit)"
```

- [ ] **Step 6: STOP for coordinator deploy.** Report DONE. The coordinator merges the KHARIS branch, confirms the push→Railway with Dillon, and verifies `OPTIONS /bug` returns the CORS header against the live URL before Stage·Assign work begins.

---

## Task 3: Stage·Assign — repoint `sendBugReport` to KHARIS (+ fallback, config, tests)

**Repo:** `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App`
**Files:** Modify `index.html`, `tests/bugreport.js`

- [ ] **Step 1: Update the test to the new transport.** Open `tests/bugreport.js`. It currently stubs `window.open` and asserts a GitHub URL. Replace the two transport checks (the "window.open fires with github URL + description" check and the "sendBugReport return contains labels=bug/Build" check) with these, and ADD a `fetch` stub. Keep the "modal renders `#brf_desc`/`#brf_shot`/`#brf_send`" and "empty description → no submit" checks. New checks:

```js
 check('submitting POSTs sanitized JSON to the KHARIS intake URL', async ()=>{
   ev(`state.pcoConfig=state.pcoConfig||{}; state.pcoConfig.clientId='CID'; state.pcoConfig.clientSecret='SECRET';`);
   let captured=null;
   window.fetch=(url,opts)=>{ captured={url,opts}; return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})}); };
   ev('openBugReportModal();');
   doc.getElementById('brf_desc').value='display went blank';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await new Promise(r=>setTimeout(r,20));
   if(!captured) throw new Error('fetch was not called');
   if(!/\/bug$/.test(captured.url)) throw new Error('should POST to the /bug intake URL, got '+captured.url);
   const body=JSON.parse(captured.opts.body);
   if(body.description!=='display went blank') throw new Error('description not sent');
   if(typeof body.config!=='string') throw new Error('config should be a JSON string');
   if(/SECRET|CID/.test(body.config)) throw new Error('PCO secrets must be stripped from config');
 });

 check('on fetch failure it falls back to the download + GitHub issue flow', async ()=>{
   let opened=null; window.open=(u)=>{ opened=u; return {}; };
   window.fetch=()=>Promise.reject(new Error('network'));
   ev('openBugReportModal();');
   doc.getElementById('brf_desc').value='still broken';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await new Promise(r=>setTimeout(r,20));
   if(!opened||!/github\.com\/daybreakcreative\/Stage-Assignments\/issues\/new/.test(opened)) throw new Error('fallback should open the GitHub issue URL, got '+opened);
 });
```

Ensure the harness stubs `downloadBlob` (or allows it) so the fallback doesn't error in jsdom — add near the top of the test body: `ev('downloadBlob=function(){};');`. Also stub `toast`: `ev('toast=function(){};');`. Make the `window.addEventListener('load', ...)` callback `async` if it isn't, so `await` works.

- [ ] **Step 2: Run it, expect FAIL.** `cd "…/Stage Assign App" && SA_HTML=index.html node tests/bugreport.js` → FAIL (still opens GitHub, no fetch).

- [ ] **Step 3: Add the config default.** Grep for `DEFAULT_STATE` config block — find where `state.config` defaults are defined (grep `pcoConfig: { clientId`). In the `config: { … }` object literal of `DEFAULT_STATE`, add a field (pick a spot among other config scalars):

```js
      bugIntakeUrl: 'https://daybreak.up.railway.app/bug',
```

(Confirm it's inside `DEFAULT_STATE.config` so the load-time config spread merges it into existing saves.)

- [ ] **Step 4: Rewrite `sendBugReport` + add `sanitizedConfigJSON` + rename the old body to a fallback.** Grep for `function sendBugReport(r) {`. Replace the ENTIRE function with the three functions below (the fallback is the OLD body, adjusted to use the sanitized config and take build/date args):

```js
function sanitizedConfigJSON() {
  let clone;
  try { clone = JSON.parse(JSON.stringify(state)); } catch (e) { clone = {}; }
  if (clone && clone.pcoConfig) { delete clone.pcoConfig.clientId; delete clone.pcoConfig.clientSecret; }
  return JSON.stringify(clone, null, 2);
}
function sendBugReportFallback(r, build, dateStr) {
  const safe = (state.service && state.service.name ? state.service.name : 'stageassign').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadBlob(sanitizedConfigJSON(), `${safe}-config.json`, 'application/json');
  if (r.shotDataUrl) {
    try {
      const bin = atob(r.shotDataUrl.split(',')[1]); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      downloadBlob(arr, r.shotName || 'screenshot.png', 'image/png');
    } catch (e) { /* ignore a bad screenshot */ }
  }
  const title = 'Bug: ' + (r.desc.split('\n')[0] || 'report').slice(0, 70);
  const body = [
    r.desc, '', '---',
    '**Build:** ' + (build || 'unknown'),
    dateStr ? ('**Service date:** ' + dateStr) : '',
    '', '_Drag in the files that just downloaded: the config JSON' + (r.shotDataUrl ? ' and the screenshot' : '') + '._'
  ].filter(Boolean).join('\n');
  const url = `https://github.com/${BUG_REPORT_REPO}/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
  toast('Couldn’t reach KHARIS — files downloaded, drag them into the GitHub issue', 'warn');
  return url;
}
async function sendBugReport(r) {
  const build = ((document.getElementById('buildStamp') || {}).textContent || '').trim();
  const dateStr = (state.service && state.service.date) || '';
  const url = (state.config && state.config.bugIntakeUrl) || 'https://daybreak.up.railway.app/bug';
  const payload = {
    description: r.desc, build, serviceDate: dateStr,
    config: sanitizedConfigJSON(),
    screenshot: r.shotDataUrl ? { dataUrl: r.shotDataUrl, name: r.shotName || 'screenshot.png' } : null
  };
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

(`BUG_REPORT_REPO` and `downloadBlob` already exist — keep them. Do not remove `BUG_REPORT_REPO`.)

- [ ] **Step 5: Update the send-button handler + modal copy.** Grep for `sheet.querySelector('#brf_send').addEventListener('click', () => {`. It calls `sendBugReport({ desc, shotDataUrl, shotName }); close();`. `sendBugReport` is now async; leave the call un-awaited but keep `close()` after it (the toast/fetch resolve independently):

```js
  sheet.querySelector('#brf_send').addEventListener('click', () => {
    const desc = (sheet.querySelector('#brf_desc').value || '').trim();
    if (!desc) { toast('Add a short description first', 'warn'); return; }
    sendBugReport({ desc, shotDataUrl, shotName });
    close();
  });
```

Then grep for the modal sub-text `Submitting opens a GitHub issue draft` and the button label `Download &amp; open GitHub issue`. Change the sub-text to: `Describe what went wrong — your current setup + app version get bundled so it can be reproduced. Sent straight to KHARIS.` and the button label to `Send to KHARIS`.

- [ ] **Step 6: Run the test, expect PASS.** `SA_HTML=index.html node tests/bugreport.js` → ALL CHECKS PASSED.

- [ ] **Step 7: Full suite.** `npm run check && npm test` → green (allow `curve.js`).

- [ ] **Step 8: Commit.**

```bash
cd "/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App"
git add index.html tests/bugreport.js
git commit -m "feat(bug): submit to KHARIS /bug (sanitized config); keep GitHub flow as fallback"
```

---

## Task 4: Stage·Assign — docs

**Repo:** `/Users/dillonthomas/Documents/03_Claude/Projects/Stage Assign App`
**Files:** Modify `docs/WATCHLIST.md`, `docs/StageAssign_Backlog.md`

- [ ] **Step 1: WATCHLIST entry.** In `docs/WATCHLIST.md`, append the next integer after the current highest (should be 41 → use 42; adjust if different) and bump the header counts:

```markdown
42. **Bug report goes to KHARIS.** "Report a bug" POSTs `{description, build, serviceDate, config,
    screenshot}` to `state.config.bugIntakeUrl` (default `daybreak.up.railway.app/bug`); PCO
    `clientId`/`clientSecret` are stripped from the config first. On any failure it falls back to
    the old download + prefilled-GitHub-issue flow (also sanitized). (`sendBugReport`; `tests/bugreport.js`.)
```

- [ ] **Step 2: Backlog.** In `docs/StageAssign_Backlog.md`, find the bullet `**[FEATURE] Bug submission → KHARIS`, and replace it with:

```markdown
- ~~**[FEATURE] Bug submission → KHARIS, not GitHub.**~~ ✅ SHIPPED 2026-07-20. `sendBugReport` POSTs
  to the KHARIS `POST /bug` endpoint (→ Basecamp campfire with screenshot + sanitized config
  attached); GitHub-issue flow retained as the offline fallback. KHARIS side in
  `daybreak-production-ai` (`flags/bugFormat.js`, `POST /bug`).
```

- [ ] **Step 3: Final validation.** `npm run check && npm test` → green.

- [ ] **Step 4: Commit.**

```bash
git add docs/WATCHLIST.md docs/StageAssign_Backlog.md
git commit -m "docs: record bug-report → KHARIS shipped"
```

---

## Definition of done

- KHARIS: `npm test` green; `POST /bug` deployed and returns `{ok:true}`; a campfire line lands in the KHARIS chat.
- Stage·Assign: `npm run check` + `npm test` green; `tests/bugreport.js` passes (POST + sanitization + fallback).
- Booth checklist for Dillon: in the app, **Advanced Settings → Report a bug** → type a description, attach a screenshot, **Send to KHARIS** → confirm a 🐛 line appears in the KHARIS Basecamp chat with the screenshot + `stageassign-config.json` attached **and the config contains no PCO client secret**. Verify the embedded screenshot actually renders in the campfire line — if not, that's the one-line switch to a message-board post.
- Deploys: KHARIS push→Railway and Stage·Assign push→Pages each confirmed with Dillon (coordinator handles pushes; subagents never push).

---

## Self-review notes (author)

- **Spec coverage:** §A uploadAttachment → Task 1; §B route → Task 2; §C KHARIS tests → Task 1 (formatBugContent) [route not unit-tested — noted, verified by curl/booth]; §D config → Task 3; §E sendBugReport+fallback → Task 3; §F Stage tests → Task 3; docs → Task 4. All mapped.
- **Placeholder scan:** none. WATCHLIST "42" flagged to adjust; the local-smoke curl (Task 2 Step 4) is explicitly optional/skippable when tokens are absent.
- **Type consistency:** payload `{description, build, serviceDate, config, screenshot:{dataUrl,name}}` sent by Task 3 matches the route's destructuring in Task 2; `formatBugContent({description,build,serviceDate,attachments:[{sgid}]})` identical in Task 1 (impl+test) and Task 2 (caller); `basecamp.uploadAttachment(name,contentType,bytes)` identical in Task 1 (impl) and Task 2 (caller). `sanitizedConfigJSON` used by both `sendBugReport` and `sendBugReportFallback`.
- **Cross-repo:** Task boundaries never mix repos; deploy gate between Task 2 and Task 3 is explicit.
