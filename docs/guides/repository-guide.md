# Repository guide

[Documentation index](../README.md) · [Architecture](../system/architecture.md)

The outer folder is both the Git checkout and the workspace root. Open it for development and run project commands from it.

| Path | Purpose | In Git? |
|---|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md` | Human overview, coding-agent instructions, and the Claude Code import of `AGENTS.md` | Yes |
| `package.json` | Private npm workspace, scripts, and the `runehive` CLI bin | Yes |
| `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `tsconfig.base.json` | Lint, formatting, and strict TypeScript configuration shared by every package | Yes |
| `.githooks/` | `pre-commit`, `pre-push`, and `commit-msg` hooks; `npm install` activates them | Yes |
| `docs/` | Index, roadmap, milestone briefs, [plans](../plans/README.md), system docs, UI design, guides, [standards](../standards/README.md), and [decisions](../decisions/README.md) | Yes |
| `tools/` | CLI entry point (`runehive.mjs`), the LostCity source manifest (`lostcity-sources.json`), and the docs generator (`docs-sync.mjs`) | Yes |
| `tests/` | Project tests, split into `cli/`, `docs/`, `integration/`, and `gameplay/` | Yes |
| `packages/headless-client/` | Aeris: protocol, sessions, game state, player actions | Yes |
| `packages/agent-runtime/` | Goal, Approach, Execution, and supporting modules (`src/*`) | Yes |
| `apps/control-center/` | React and Vite web app | Yes |
| `lostcity/` | Upstream LostCity checkouts, local world configuration, and saves | **No** (ignored) |

## What `runehive init` puts in `lostcity/`

Each component is pinned by full commit ID in `tools/lostcity-sources.json`.

| Folder | Source | Use |
|---|---|---|
| `lostcity/engine/` | Engine-TS, branch `274` | The game server and bundled browser client. Local world configuration and saves live here after M1 |
| `lostcity/content/` | Content, branch `274` | Revision 274 game content |
| `lostcity/webclient/` | Client-TS, branch `274` | Protocol and cache reference for Aeris |

Treat `lostcity/` as read-only reference except for the local configuration and saves M1 documents. Do not commit anything from it. Exact save locations are confirmed in M1.

## Empty scaffold directories

Directories with no code yet contain a short `README.md` so they exist on a fresh clone. Replace the placeholder when real code lands.
