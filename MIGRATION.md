# Moving Stage·Assign to Claude Code (in Cursor) + Superpowers

Goal: continue Stage·Assign development in Claude Code inside Cursor, with the
Superpowers methodology — without losing the test suite, the watchlist, or the
beta-testing rhythm.

You already have Claude Code installed (npm `@anthropic-ai/claude-code`) on the M4
MacBook, so most of this is wiring, not installing.

---

## Phase 1 — Get the project into a local repo

Your app already lives in the GitHub repo behind
`daybreakcreative.github.io/Stage-Assignments/` (served as `index.html`). Bring it
local and drop this kit on top of it.

1. Clone the repo (skip if you already have it locally):
   ```bash
   cd ~/code            # or wherever you keep projects
   git clone https://github.com/daybreakcreative/Stage-Assignments.git
   cd Stage-Assignments
   ```
2. Unzip this kit and copy its contents into the repo root, **merging** with what's
   there. It contains: `index.html` (latest build), `CLAUDE.md`, `tests/`, `docs/`,
   `package.json`, `.gitignore`, this file.
   - `index.html` is the current shipped build — confirm it matches your deployed copy
     (or just use this one; it's the latest).
3. Install the test dependency (jsdom) and confirm the suite runs:
   ```bash
   npm install
   npm run check        # JS syntax + CSS balance
   npm test             # full regression suite — expect all PASS (curve = known PASS*)
   ```
4. Commit the new scaffolding:
   ```bash
   git add -A
   git commit -m "Add CLAUDE.md, regression test suite, docs, npm scripts"
   ```

> Now the repo carries everything: the app, the executable regression suite, the
> watchlist, and the beta checklists. That's the momentum, preserved.

---

## Phase 2 — Open it in Cursor with Claude Code

"Claude Code in Cursor" = run the Claude Code CLI inside Cursor's editor. (This is
different from Cursor's own built-in AI agent.)

1. Open the folder in Cursor: `File → Open Folder…` → the `Stage-Assignments` repo.
2. Open Cursor's integrated terminal (`View → Terminal`).
3. Start Claude Code at the repo root:
   ```bash
   claude
   ```
   It auto-loads `CLAUDE.md`, so it starts with the full project context.
4. (Optional, nicer UX) Install the **Claude Code** extension from the Cursor/VS Code
   extension marketplace for inline diffs and a side panel. Setup specifics live in the
   official docs: https://docs.claude.com/en/docs/claude-code/overview
   (docs map: https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md)

---

## Phase 3 — Install Superpowers (for Claude Code)

Run these as slash commands **inside the Claude Code session** (the `claude` prompt),
not in the shell. Two options — the official marketplace is simplest:

**Option A — official Anthropic plugin marketplace:**
```text
/plugin install superpowers@claude-plugins-official
```

**Option B — Superpowers' own marketplace (also bundles related plugins):**
```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Then restart Claude Code so the plugin's session-start hook runs. Verify with
`/help` (you should see Superpowers commands) or just type `/brainstorm`.

> Heads-up on naming: the Superpowers README also has a **Cursor** section that uses
> `/add-plugin superpowers` — that installs into *Cursor's own agent*, not Claude
> Code. Since you want Claude Code, use the `/plugin …` commands above. (Source:
> github.com/obra/superpowers — check it for the latest, it moves fast.)

What you get: 20+ skills, the commands `/brainstorm`, `/write-plan`, `/execute-plan`,
a skills-search tool, and SessionStart context injection. The skills also fire
**automatically** when Claude sees you're building something — you often don't need a
command at all.

---

## Phase 4 — Use Superpowers well on Stage·Assign

Superpowers' method is: **spec → plan → subagent-driven TDD execution.** That pairs
perfectly with this repo, because the jsdom suite is already your red/green harness.

For the next change (e.g., a watchlist item or a new feature):

1. **Brainstorm the spec.** In Claude Code:
   ```text
   /brainstorm  I want to <the change>. Read CLAUDE.md and docs/WATCHLIST.md first.
   ```
   It interviews you and produces a short spec in reviewable chunks. Sign off chunk by
   chunk.
2. **Write the plan.** `/write-plan` turns the spec into a TDD implementation plan.
   Tell it explicitly: *"write a failing jsdom test in `tests/` first, then make it
   pass, and keep the whole suite green (`npm test`)."*
3. **Execute.** `/execute-plan` runs it, often autonomously, writing the test, then the
   code, validating as it goes.
4. **Gate every change** on the existing loop (CLAUDE.md tells it this, but reinforce):
   ```text
   Run `npm run check` and `npm test`. Don't consider it done until the suite is green
   (curve.js is a known false-fail).
   ```
5. **Deploy** when green:
   ```bash
   git add -A && git commit -m "…" && git push
   ```
   Pages redeploys `daybreakcreative.github.io/Stage-Assignments/`.

Tips for best results:
- Point it at `CLAUDE.md` + `docs/WATCHLIST.md` at the start of a session so it has the
  rules and the regression list.
- Keep changes small and verified — same rhythm you've been using.
- Let Superpowers write the failing test first; the suite is the safety net that lets it
  work autonomously without regressing.
- Use a git branch or worktree for bigger features so `main` stays deployable.

---

## Phase 5 — Keep the beta-testing rhythm

- After each fix batch: `npm test` (regression), then smoke-test on the booth computer
  (landscape + portrait), log bugs by screenshot + exported JSON.
- `docs/StageAssign_BetaTest_Checklist.md` / `docs/StageAssign_BetaTest.html` = the full
  beta checklist; `docs/StageAssign_FixRetest.html` = the fast retest console.
- `docs/WATCHLIST.md` = the don't-regress list; add a line whenever you ship something
  new and add a matching test.
- Desktop/laptop is the target. Phone isn't a concern; tablet touch-drag should keep
  working but is low priority.
