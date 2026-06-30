# Session start — Stage·Assign

Paste the block below as your **first message** to Claude Code at the start of each
session. `CLAUDE.md` is auto-loaded and Superpowers injects its own context, but this
guarantees the two things that actually protect the beta: re-reading the rules + the
watchlist, and establishing a green test baseline *before* anything changes.

---

```
Before we touch Stage·Assign:

1. Read CLAUDE.md and docs/WATCHLIST.md in full — these are the rules and the
   regression list. Read docs/SESSION_START.md too if you haven't.

2. Establish a clean baseline: run `npm run check`, then `npm test`. Confirm the suite
   is green. curve.js is a KNOWN false-fail (1 issue from a localStorage stub in the
   harness, not a bug) — that's the only acceptable failure. If anything else fails,
   STOP and tell me before changing a single line.

3. Hold to these the whole session:
   - The app is ONE file: index.html (vanilla HTML/CSS/JS, state in localStorage, no
     build step, no runtime deps).
   - Re-grep for anchor text before every edit — line numbers drift after each change.
   - Don't consider any change done until `npm run check` AND `npm test` both pass
     (green, allowing curve.js).
   - Never regress a behavior listed in docs/WATCHLIST.md. If you intentionally change
     one that a test asserts, update the test and tell me why.
   - Desktop/laptop is the target. Phone is not a concern. Keep tablet touch-drag
     working but don't over-invest there.

4. Work test-first on every change: write or extend a failing jsdom test in tests/,
   make it pass, keep the WHOLE suite green, then summarize what changed and exactly
   what I should smoke-test on the booth computer.

Then wait for my task. Don't write code until I've described it and — for anything
non-trivial — you've shown me a short spec or plan I've signed off on.
```

---

## Using it with Superpowers

Once you've pasted the primer and described what you want to build, drive the work
with the Superpowers flow:

1. `/brainstorm <what you want>` → it teases out a spec in reviewable chunks; sign off.
2. `/write-plan` → a TDD implementation plan. Add: *"failing jsdom test in tests/ first,
   then make it pass, keep `npm test` green."*
3. `/execute-plan` → it executes, validating as it goes.

The primer just guarantees the read-the-rules-and-baseline step happens first, so the
agent never starts editing blind or on top of a red suite.

## When you ship
```
npm run check && npm test     # must be green (curve.js = known false-fail)
git add -A && git commit -m "…"
git push                      # redeploys daybreakcreative.github.io/Stage-Assignments/
```
