# ✓ Items per-person cog — design

**Date:** 2026-07-20
**Status:** Approved (design), pending build
**File:** `index.html` (`collectChecklistItems`, `renderSetupChecklist`, a new
`openChecklistPersonEditor`, + `.si-cog` CSS) + `tests/scvcog.js`

## Problem / goal

The ✓ Items checklist view shows a card per person but gives no way to change a person's setup
items from there — the only editor lives in Settings → Setup Manager. Add a **cog (⚙) on each
person's card** that opens that person's setup editor inline; for a multi-role person it shows a
section per role. It edits **that person's own bucket(s)** (`state.setupItems[...]`), not the church
defaults.

## What exists (from exploration)

- `renderSetupChecklist()` (`~index.html:10945`) renders sections → `.si-grid` of `.si-card`s. The
  per-person card markup (`~10980-11002`) has `.si-card-head` = `.si-card-id` (name + `.si-card-role`
  badge) + `.si-ring`. **No button today.** Chip toggles are wired after `innerHTML` (`~11032+`).
- `collectChecklistItems()` (`~10712`) merges every setup bucket for a person into one card object
  `{ name, roleLabel, stableKey: <normName>, items, iem, micText }` (`~10820`). It already walks each
  contributing role `en` (`{name, role, typeKey, label, stableKey}`) in `rows.forEach` (`~10759`) and
  aggregates `p.roles` — but does **not** keep the per-role `stableKey`/`typeKey`.
- `renderPersonSetupEditor(container, stableKey, typeKey)` (`~10558`) mounts the grouped selector +
  custom-item add/remove into any container and **saves live** on every change (writes
  `bucket.selections`, `rebuildPersonItems`, `saveState`).
- `openPersonSetupModal(name, stableKey, typeKey, scopeLabel)` (`~7344`) builds a
  `.setup-review-modal` sheet around a SINGLE `renderPersonSetupEditor`, closing to
  `renderSetupManager()`. Good pattern to mirror; it handles only one bucket.
- Stage-fixture cards (`stagePeople`, `~10846`) have `stableKey: 'stage|<id>'` and a single derived
  action — **not** an editable setup bucket. They must NOT get a cog.
- `state.config.setupDefaults[key]` (church defaults) is edited only by `renderSetupDefaultsEditor` —
  untouched here.

## Design

### A. `collectChecklistItems` — carry per-role buckets

- Add `buckets: []` to the per-person accumulator `p` (`~10775`, where `p` is created).
- In `rows.forEach` (`~10759`), after resolving `en`, record its bucket (deduped by `stableKey`):
  ```js
  const bLabel = en.label || (en.role === 'vocalist' ? 'Vocals' : (en.role === 'md' ? 'MD' : (en.typeKey || 'Setup')));
  if (!p.buckets.some(b => b.stableKey === en.stableKey)) {
    p.buckets.push({ stableKey: en.stableKey, typeKey: en.typeKey, label: bLabel });
  }
  ```
- Carry it onto the pushed person object (`~10820`): add `buckets: p.buckets`.
- Stage people (`~10846`) get no `buckets` field (they aren't built from `byPerson`), so the cog is
  naturally absent there.

### B. `renderSetupChecklist` — cog on the card + wiring

- Before the `sections.forEach` render loop (`~10973`), declare a flat lookup:
  `const cogPeople = [];`.
- Inside `groups.map(p => { … })` (`~10980`), before building the card string, capture the index:
  ```js
  const hasBuckets = Array.isArray(p.buckets) && p.buckets.length > 0;
  const cogIdx = cogPeople.length;
  if (hasBuckets) cogPeople.push(p);
  ```
- In `.si-card-head`, after the `.si-ring` span, add the cog (only when `hasBuckets`):
  ```js
  ${hasBuckets ? `<button class="si-cog" data-cog-idx="${cogIdx}" title="Edit setup items" aria-label="Edit setup items">⚙</button>` : ''}
  ```
- After `container.innerHTML = …` (near the chip-wiring block, `~11032`), wire the cogs:
  ```js
  container.querySelectorAll('.si-cog').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      const p = cogPeople[+btn.dataset.cogIdx];
      if (p) openChecklistPersonEditor(p);
    });
  });
  ```
  `e.stopPropagation()` keeps the click off any chip toggling. (`cogPeople` is in scope because the
  wiring runs in the same function body.)

### C. New `openChecklistPersonEditor(person)`

Mirror `openPersonSetupModal`, but mount ONE editor per bucket:

```js
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

- Single-role person → one editor, no section label. Multi-role → a `si-cog-section-label` before
  each editor.
- Closes to `renderSetupChecklist()` (not the manager) so the card's chips + ring resync.

### D. CSS

Add near the other `.si-*` rules:
```css
.si-cog{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;flex:none;opacity:.6}
.si-cog:hover{color:var(--accent);opacity:1}
.si-cog-section-label{font-family:var(--ff-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:4px 0 2px}
```
`.si-card-head` is already a flexbox; the cog sits after the ring. No emoji beyond the functional ⚙.

## Testing (`tests/scvcog.js`, jsdom)

1. **Cog present per person card, absent on stage cards.** Seed a vocalist + a band person with
   setup items and a stage monitor fixture; open the checklist; every `.si-card` in VOCALISTS/BAND
   has a `.si-cog`, the STAGE card does not.
2. **Cog opens the editor modal.** Click a `.si-cog` → a `.setup-review-modal.show` appears titled
   with the person's name, containing at least one `renderPersonSetupEditor` (`.sp-editor`/
   `.sp-groups`).
3. **Multi-role person → a section per role.** A person who sings AND plays a linked instrument →
   the modal shows ≥2 `.sp-groups` editors (and `.si-cog-section-label`s).
4. **Editing writes to the person's bucket + reflects after close.** In the modal, select an extra
   grouped option so `rebuildPersonItems` adds an item; close; re-open the checklist; that person's
   `state.setupItems[stableKey].items` grew and a new `.si-chip` appears on their card.
5. **Church defaults untouched.** After editing a person via the cog, `state.config.setupDefaults`
   is byte-identical to before (JSON compare).
6. **Cog click doesn't toggle a chip.** Clicking `.si-cog` doesn't change any `data-item-key`
   check-off state.
7. Existing `scvredesign.js` / `checklist.js` still pass (card structure intact).

Full `npm run check` + `npm test` green (allow `curve.js`).

## Scope / non-goals

- Person buckets only; `setupDefaults` untouched (that stays the Advanced Settings editor).
- No change to chip toggling, the Display button, progress ring, or `openPersonSetupModal` (the
  Setup Manager keeps its own edit button).
- Stage-fixture cards get no cog (no editable bucket).
- Reuses `renderPersonSetupEditor` verbatim — no new editor logic; live-save behavior unchanged.
