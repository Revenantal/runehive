---
id: M0
title: "Project organization and setup"
delivers: "Written project guides, workspace folders, and a tested init command that fetches the LostCity sources locally."
depends_on: []
design: []
builds:
  - { name: "Workspace scaffold and npm workspaces", system: architecture, status: done }
  - { name: "LostCity source manifest and init CLI", system: lostcity-and-headless-client, status: done }
  - { name: "Project guides and agent instructions", system: none, status: done }
---
# Project organization and setup

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** Done (from its builds)
- **Depends on:** None

**Builds**

| Component | System doc | Status |
|---|---|---|
| Workspace scaffold and npm workspaces | [Architecture and Repository](../system/architecture.md) | Done |
| LostCity source manifest and init CLI | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | Done |
| Project guides and agent instructions | — | Done |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Prepare the TypeScript workspace, establish where project documentation and planning belong, and make the Revision 274 server and client source available locally through one setup command.

## Investigation findings

- LostCity's setup repository is an interactive launcher. For Revision 274 it checks out Engine-TS, Content, Client-TS, and Client-Java into `engine/`, `content/`, `webclient/`, and `javaclient/`. It clones by branch name, so our init should record exact commits for repeatable setup. The launcher and engine specify Node.js 24 or newer. [Launcher README](https://github.com/LostCityRS/Server/blob/main/README.md) · [Launcher source](https://github.com/LostCityRS/Server/blob/main/start.js) · [Engine package manifest](https://github.com/LostCityRS/Engine-TS/blob/274/package.json)
- The engine checkout includes a bundled browser client for the first local play test. Fetch Client-TS as the local source reference for headless client. Fetch Client-Java separately if a later investigation needs it. Leave Bun and web client build submodules to a milestone that needs to rebuild the browser client. [Bundled client](https://github.com/LostCityRS/Engine-TS/tree/274/public/client) · [Client-TS build scripts](https://github.com/LostCityRS/Client-TS/blob/274/package.json) · [Client-TS submodules](https://github.com/LostCityRS/Client-TS/blob/274/.gitmodules)
- First-time engine configuration is a separate upstream setup step. The engine setup source writes configuration to `data/config/world.json`, and the engine ignores local configuration, player data, and database files. Treat the engine checkout as the home of the local world once M1 configures it. The exact save locations should be confirmed against the chosen M1 configuration. [Engine setup](https://github.com/LostCityRS/Engine-TS/blob/274/src/setup.ts) · [Engine ignore rules](https://github.com/LostCityRS/Engine-TS/blob/274/.gitignore)

## Layout and documentation

The workspace layout is in the [architecture](../system/architecture.md#repository-organization) and each folder's purpose and Git status is in the [repository guide](../guides/repository-guide.md). Give otherwise-empty directories a short tracked README so the scaffold is present on a fresh clone.

Draft the guides and standards as part of M0 and link them from the [documentation index](../README.md), which also lists the briefs and system docs. The testing approach is in [testing and verification](../standards/testing-and-verification.md).

### Coding-agent instructions

- Create a root `AGENTS.md` with concise repository-wide instructions and a map of the documentation. Point coding agents to the roadmap and the relevant milestone first, then to the documentation index for the relevant design or guide. Summarize the private LostCity checkout boundary and ordinary-player integration. Link to the AI-assisted development, Git, and verification guides for task-specific detail.
- Create a root `CLAUDE.md` containing `@AGENTS.md` so Claude Code loads the shared instructions from the same source. [Claude Code project instructions](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)

## First run and updates

See [local development](../guides/local-development.md).

## Objectives and plan

1. **Scaffold the workspace and CLI.** Register `packages/*` and `apps/*` in the root npm workspace. Start with a small Node.js entry point using built-in modules so `npm run runehive -- init` can run from a fresh checkout with Node.js, npm, and Git available. Resolve `lostcity/` under the project root and print the resolved destination.
2. **Record and fetch the source set.** Put the Engine-TS, Content, and Client-TS URLs, their expected branch labels, and full commit IDs in the source manifest. Record an initial Revision 274 source set in M0. M1 validates that set through a real launch and updates pins if needed. Init fetches missing sources and prints each component's path and actual commit so the TypeScript client source can be found locally.
3. **Make reruns safe.** Reuse a matching checkout at the expected origin and commit. Report changed commits, local edits, unexpected origins, and occupied paths without resetting or replacing them. If a fetch fails midway, leave completed checkouts usable and make the failed component clear so the next run can resume.
4. **Expose the direct command.** Point npm's `scripts.runehive` and `bin.runehive` at the same entry point. Document `npm link` as the one-time linking option and retain the npm command for first-run setup. The npm global bin location needs to be on the user's PATH for the direct command. [npm package binaries](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin) · [npm link](https://docs.npmjs.com/cli/v11/commands/npm-link/)

## M1 handoff

[Play LostCity locally](local-lostcity.md) runs upstream engine configuration and verifies the bundled browser client. Use the engine's setup and start commands because opening the launcher's interactive menu triggers a Java checkout. M1 adds `runehive start lostcity`, `runehive status lostcity`, and `runehive stop lostcity` using the same workspace paths.

## Done when

1. **The guides are written and linked.** The root README leads to the documentation index, the written guides and standards, the system docs and UI design, and the milestone briefs. Root `AGENTS.md` points coding agents to that material, and `CLAUDE.md` imports it.
2. **The project init tool works from a fresh checkout.** The agreed workspace folders are present, and `npm run runehive -- init` fetches the pinned LostCity engine, content, and TypeScript client into the Git-ignored `lostcity/` directory. The command prints their local paths and exact revisions. A second run reuses matching checkouts and preserves and reports local changes or conflicts. Verify the real fetch once and cover reruns and conflicts with repeatable tests using local Git fixtures. After the documented linking step, `runehive --help` runs the same CLI.
