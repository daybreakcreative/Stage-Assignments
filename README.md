# Stage·Assign

Single-file web app for assigning mics, stage positions, and per-person setup
checklists for a worship team. The entire app is `index.html`
(vanilla HTML/CSS/JS, state in `localStorage`, no build step). Deployed via GitHub
Pages at `daybreakcreative.github.io/Stage-Assignments/`.

## Develop

```bash
npm install        # one-time: installs jsdom (test-only dependency)
npm run check      # JS syntax + CSS balance
npm test           # regression suite (tests/) — keep green before committing
```

Edit `index.html`, validate, commit, push.

## Map

- `index.html` — the app (everything).
- `tests/` — jsdom regression suite; `npm test` runs `tests/run-all.js`.
- `CLAUDE.md` — context + rules for Claude Code (read this first).
- `MIGRATION.md` — how this project is developed with Claude Code + Superpowers.
- `docs/` — regression watchlist + beta-test checklists + backlog.

See `CLAUDE.md` for conventions and the validation loop.
