# Bug report → KHARIS — design

**Date:** 2026-07-20
**Status:** Approved (design), pending build
**Spans two repos:**
- **KHARIS** — `~/daybreak-production-ai` (Node/Express on Railway, `daybreak.up.railway.app`): new
  `POST /bug` intake + a Basecamp attachment-upload helper.
- **Stage·Assign** — `index.html` (static GitHub Pages): repoint `sendBugReport` to POST to KHARIS.

## Problem / goal

The in-app "Report a bug" flow currently downloads the config JSON + screenshot and opens a
prefilled **GitHub issue**. Dillon wants bug reports to go through **KHARIS** instead — landing in
the KHARIS Basecamp chat (campfire) so he sees them where he already works, with the screenshot and
config attached.

## Current state (verified)

- **Stage·Assign** `sendBugReport(r)` (`index.html:~11597`) is the single transport seam: it
  `downloadBlob`s `JSON.stringify(state)` + the screenshot, then `window.open`s a GitHub issue URL
  (`BUG_REPORT_REPO = 'daybreakcreative/Stage-Assignments'`). Form (`openBugReportModal`, `~11621`)
  collects a description + one optional screenshot (held as a data URL). Build stamp
  (`#buildStamp`) + `state.service.date` are auto-attached. `tests/bugreport.js` stubs `window.open`
  and asserts the GitHub URL + body.
- **The exported `state` includes `state.pcoConfig.clientId`/`clientSecret`** (PCO OAuth secrets) —
  must be stripped before sending anywhere.
- **KHARIS** `index.js`: `app.use(express.json())` with the **default 100 kb** body cap (too small
  for a base64 screenshot). **No CORS anywhere.** `/prf/submit` (`index.js:~1057`) is the template:
  a fully-open `app.post` that validates then best-effort posts to Basecamp. Basecamp posting is in
  `integrations/basecamp.js`: `bcPost(path, body)` (OAuth bearer, auto-refresh on 401),
  `createCampfireLine(projectId, content)` (`~243`, HTML content). Target project id
  `KHARIS_CHAT_PROJECT_ID` (`flags/scanTargets.js:~101`). Tests: `node --test`, helper-level (no
  HTTP harness).

## Design — KHARIS side (`~/daybreak-production-ai`)

### A. `uploadAttachment(name, contentType, bytes)` in `integrations/basecamp.js`

Basecamp two-step attach: upload raw bytes → get an `attachable_sgid` to embed in rich text.

```js
// Upload a file to Basecamp; returns { attachable_sgid } for embedding via <bc-attachment>.
export async function uploadAttachment(name, contentType, bytes) {
  const stored = getTokens("basecamp");
  if (!stored?.access_token) throw new Error("Basecamp not authorized.");
  const res = await fetch(`${BC_BASE}/attachments.json?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stored.access_token}`,
      "User-Agent": "KHARIS - Daybreak Production (dillonthomas@daybreakchurch.org)",
      "Content-Type": contentType || "application/octet-stream",
      "Content-Length": String(bytes.length),
    },
    body: bytes, // a Buffer
  });
  if (!res.ok) throw new Error(`Basecamp attachment error ${res.status}: ${await res.text()}`);
  return res.json(); // { attachable_sgid }
}
```

(Uses the same `BC_BASE`/token pattern as `bcPost`; no 401-retry for v1 — a bug upload failing is
best-effort. If desired, wrap the token-refresh like `bcPost`.)

### B. `POST /bug` in `index.js`

Placed near `/prf/submit`. Per-route raised body limit + per-route CORS + preflight.

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
    // Screenshot (optional) → attachment
    if (screenshot && screenshot.dataUrl && /^data:image\//.test(screenshot.dataUrl)) {
      try {
        const b64 = screenshot.dataUrl.split(",")[1] || "";
        const bytes = Buffer.from(b64, "base64");
        const ct = (screenshot.dataUrl.match(/^data:([^;]+)/) || [])[1] || "image/png";
        const { attachable_sgid } = await basecamp.uploadAttachment(screenshot.name || "screenshot.png", ct, bytes);
        if (attachable_sgid) attachments.push({ sgid: attachable_sgid, name: screenshot.name || "screenshot.png", ct });
      } catch (e) { console.error("[bug] screenshot upload failed:", e.message); }
    }
    // Config JSON (optional) → attachment
    if (config) {
      try {
        const bytes = Buffer.from(typeof config === "string" ? config : JSON.stringify(config, null, 2), "utf8");
        const { attachable_sgid } = await basecamp.uploadAttachment("stageassign-config.json", "application/json", bytes);
        if (attachable_sgid) attachments.push({ sgid: attachable_sgid, name: "stageassign-config.json", ct: "application/json" });
      } catch (e) { console.error("[bug] config upload failed:", e.message); }
    }
    const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const parts = [
      `<strong>🐛 Bug report — Stage·Assign</strong>`,
      esc(description).replace(/\n/g, "<br>"),
      `<em>Build:</em> ${esc(build || "unknown")}${serviceDate ? ` · <em>Service:</em> ${esc(serviceDate)}` : ""}`,
    ];
    attachments.forEach(a => { parts.push(`<bc-attachment sgid="${a.sgid}"></bc-attachment>`); });
    const content = parts.join("<br><br>");
    await basecamp.createCampfireLine(scanTargets.KHARIS_CHAT_PROJECT_ID, content);
    res.json({ ok: true, attachments: attachments.length });
  } catch (err) {
    console.error("[bug] submit error:", err.message);
    res.status(500).json({ ok: false, error: "server error" });
  }
});
```

Notes:
- **Open** (like `/prf/submit`); server validates + best-effort. No client-baked secret (it wouldn't
  be secret in a public static site).
- Screenshot/config uploads are best-effort — a failed upload still posts the text line.
- If a Basecamp **campfire line doesn't render `<bc-attachment>`**, the text still posts and the
  fix is a one-line switch to `createMessage(...)` — flagged for booth verification on first real bug.

### C. KHARIS tests (`node --test`)

- `tests/bugFormat.test.js`: a small pure helper `formatBugContent({description, build, serviceDate, attachments})` extracted from the route (so it's unit-testable without HTTP/Basecamp) — asserts the heading, escaped description, build/service line, and one `<bc-attachment sgid=…>` per attachment. (Refactor the route to call this helper.)
- Confirm `uploadAttachment` is exported and shaped like the other `basecamp.js` helpers (mirror `tests/basecampHelpers.test.js` style — assert it builds the right path/headers using a stubbed `fetch`, if that file's pattern supports it; otherwise a minimal export-presence test).

## Design — Stage·Assign side (`index.html`)

### D. Configurable intake URL

- Add `bugIntakeUrl: 'https://daybreak.up.railway.app/bug'` to `DEFAULT_STATE.config` (so stored
  states merge the default via the existing config spread).
- Advanced Settings: a text field (mirror the PCO Client ID field pattern) under the Report-a-bug
  section — label "Bug intake URL (KHARIS)", `input` → `state.config.bugIntakeUrl = value.trim(); saveState();`.

### E. Rewrite `sendBugReport(r)`

```js
function sanitizedConfigJSON() {
  let clone;
  try { clone = JSON.parse(JSON.stringify(state)); } catch (e) { clone = {}; }
  if (clone && clone.pcoConfig) { delete clone.pcoConfig.clientId; delete clone.pcoConfig.clientSecret; }
  return JSON.stringify(clone, null, 2);
}
async function sendBugReport(r) {
  const build = ((document.getElementById('buildStamp') || {}).textContent || '').trim();
  const serviceDate = (state.service && state.service.date) || '';
  const url = (state.config && state.config.bugIntakeUrl) || 'https://daybreak.up.railway.app/bug';
  const payload = {
    description: r.desc, build, serviceDate,
    config: sanitizedConfigJSON(),
    screenshot: r.shotDataUrl ? { dataUrl: r.shotDataUrl, name: r.shotName || 'screenshot.png' } : null
  };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    toast('Bug report sent to KHARIS ✓', 'success');
    return { ok: true };
  } catch (e) {
    toast('Couldn’t reach KHARIS — falling back to a downloadable report', 'warn');
    return sendBugReportFallback(r, build, serviceDate); // the OLD download + GitHub-issue flow, preserved
  }
}
```

- `sendBugReportFallback` = today's exact behavior (rename the current body): `downloadBlob` the
  **sanitized** config + screenshot, `window.open` the GitHub issue URL, return that url. Reuses
  `sanitizedConfigJSON()` so secrets never hit a downloaded file either.
- The modal send button + copy update: button "Send to KHARIS"; sub-text drops the "opens a GitHub
  issue draft" wording (mention the fallback only in the warn toast).
- `openBugReportModal`'s send handler becomes `await sendBugReport(...)` (it's now async; the
  handler can call it without awaiting since it just closes after).

### F. Stage·Assign tests (`tests/bugreport.js` — rewrite the transport asserts)

- Stub `window.fetch` to resolve `{ ok:true }`; clicking send with a description calls `fetch` with
  the intake URL and a JSON body whose `description` matches, `config` is a string, and
  **contains no `clientSecret`/`clientId`** (seed `state.pcoConfig.clientSecret='x'` then assert the
  payload's config omits it).
- Empty description → no `fetch`.
- **Fallback:** stub `fetch` to reject; assert `window.open` fires with the GitHub URL (fallback
  path) and the downloaded config is sanitized.
- Keep the modal-renders-fields check (`#brf_desc`, `#brf_shot`, `#brf_send`).

## Build / deploy order

1. **KHARIS first:** build A+B+C on a branch, `npm test`, merge, **push → Railway** (confirm with
   Dillon). Verify `OPTIONS /bug` + a curl POST returns `{ok:true}` and a campfire line appears.
2. **Stage·Assign second:** build D+E+F against the now-live endpoint, `npm run check && npm test`,
   merge, **push → Pages** (confirm with Dillon).

## Scope / non-goals

- v1 posts a **campfire line** (with embedded attachments) to `KHARIS_CHAT_PROJECT_ID` — no card,
  no message board. (Easy to switch later.)
- Endpoint is **open** (consistent with `/prf/submit`); no auth/rate-limit in v1.
- Secrets stripped: `pcoConfig.clientId`/`clientSecret` only (rest of config kept for repro).
- Not fixing the two flagged security issues (KHARIS git-remote embedded token; broader secret
  hygiene) — surfaced to Dillon separately.
- The GitHub-issue path is **retained as the offline/failure fallback**, not deleted.
