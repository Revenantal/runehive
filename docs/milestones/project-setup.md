# Project organization and setup

[Roadmap](../roadmap.md) · [Repository organization](../architecture.md) · [LostCity and Aeris](../lostcity-and-aeris.md)

## Goal

Prepare the TypeScript workspace, establish where project documentation and planning belong, and make the Revision 274 server and client source available locally through one setup command.

## Investigation findings

- LostCity's setup repository is an interactive launcher. For Revision 274 it checks out Engine-TS, Content, Client-TS, and Client-Java into `engine/`, `content/`, `webclient/`, and `javaclient/`. It clones by branch name, so our init should record exact commits for repeatable setup. The launcher and engine specify Node.js 24 or newer. [Launcher README](https://github.com/LostCityRS/Server/blob/main/README.md) · [Launcher source](https://github.com/LostCityRS/Server/blob/main/start.js) · [Engine package manifest](https://github.com/LostCityRS/Engine-TS/blob/274/package.json)
- The engine checkout includes a bundled browser client for the first local play test. Fetch Client-TS as the local source reference for Aeris. Fetch Client-Java separately if a later investigation needs it. Leave Bun and web client build submodules to a milestone that needs to rebuild the browser client. [Bundled client](https://github.com/LostCityRS/Engine-TS/tree/274/public/client) · [Client-TS build scripts](https://github.com/LostCityRS/Client-TS/blob/274/package.json) · [Client-TS submodules](https://github.com/LostCityRS/Client-TS/blob/274/.gitmodules)
- First-time engine configuration is a separate upstream setup step. The engine setup source writes configuration to `data/config/world.json`, and the engine ignores local configuration, player data, and database files. Treat the engine checkout as the home of the local world once M1 configures it. The exact save locations should be confirmed against the chosen M1 configuration. [Engine setup](https://github.com/LostCityRS/Engine-TS/blob/274/src/setup.ts) · [Engine ignore rules](https://github.com/LostCityRS/Engine-TS/blob/274/.gitignore)

## Proposed layout

The outer folder is both our Git checkout and project workspace root. Open it for development and run project commands there. `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/`, and `package.json` live at this level. `runescape-ai/` contains the code we build, and `lostcity/` contains the upstream checkout provisioned by init.

```text
runehive/                        # Runehive workspace root and Git checkout
├── README.md                    # Project overview and first-run commands
├── AGENTS.md                    # Shared coding-agent instructions and doc map
├── CLAUDE.md                    # Imports AGENTS.md
├── package.json                 # Private npm workspace, script, and CLI bin
├── .gitignore                   # Excludes /lostcity/ from our Git checkout
├── tools/
│   ├── runehive.mjs              # Node entry point for npm and the direct command
│   └── lostcity-sources.json    # Upstream URLs, relative paths, and commit pins
├── tests/                       # Project CLI and cross-package tests
├── docs/
│   ├── README.md                # Documentation index
│   ├── roadmap.md               # Ordered milestone index
│   ├── milestones/
│   │   ├── *.md                 # One brief per milestone
│   │   └── plans/               # Technical plans linked from the briefs
│   │       ├── architecture.md
│   │       ├── lostcity-and-aeris.md
│   │       ├── agent-runtime.md
│   │       ├── discovery-memory.md
│   │       └── control-center.md # Web app requirements and technical plan
│   ├── guides/
│   │   ├── repository-guide.md  # Folder purposes and ownership
│   │   ├── local-development.md # Setup and troubleshooting
│   │   ├── development-practices.md # TypeScript and code review
│   │   ├── git-workflow.md      # Commits and pull requests
│   │   ├── ai-assisted-development.md # Working with coding agents
│   │   └── testing-and-verification.md # Test commands, fixtures, and gameplay scenarios
│   └── design/
│       └── control-center/      # UI guidance, branding, tokens, screens, mockups
├── runescape-ai/                # Application source within our Git checkout
│   ├── packages/
│   │   ├── headless-client/     # Aeris
│   │   └── agent-runtime/
│   └── apps/
│       └── control-center/
└── lostcity/                    # Git-ignored checkout of LostCityRS/Server
    ├── engine/                  # Engine-TS and local world data after M1
    ├── content/                 # Revision 274 game content
    └── webclient/               # Client-TS source for local reference
```

Commit the workspace structure, minimal package manifests, and source manifest. Scaffold the source folders and runtime module directories listed in the [repository architecture](../architecture.md#repository-organization). Give otherwise-empty directories a short tracked README so the scaffold is present on a fresh clone. Use the local `lostcity/` directory for reading upstream sources in an editor or with `rg`. Keep upstream code, local configuration, and saves under the Git-ignored `/lostcity/` path. The web client source checkout can be recreated from the manifest if it contains no local work.

## Documentation and planning

Draft these guides as part of M0. Link the root README to the documentation index, then use the index to point readers to the guide they need. Start with short guidance and add commands and examples as the tooling lands.

| Document | What belongs there |
|---|---|
| `docs/README.md` | A map of the roadmap, milestone briefs and their technical plans, Control Center visual designs, and guides. Keep the root README focused on the project overview and first-run commands. |
| `docs/guides/repository-guide.md` | Purpose and ownership of the workspace folders and their key subfolders. Explain which files belong in Git, what init fetches into the local LostCity checkout, and where local configuration and saves live. |
| `docs/guides/local-development.md` | Prerequisites, first-run commands, the local checkout layout, how to link the CLI, and how to diagnose a failed fetch or checkout mismatch. M1 adds server commands and verified save locations. |
| `docs/guides/development-practices.md` | TypeScript conventions, package boundaries and public interfaces, error handling, safe retries, and what to look for in code review. Update the relevant design or guide when implementation changes how the system works. |
| `docs/guides/git-workflow.md` | Keep commits focused and write messages that explain the change. Include a few examples, how to record LostCity pin changes, and what to put in a pull request description, including checks run and any remaining gaps. Keep the initial conventions lightweight. |
| `docs/guides/ai-assisted-development.md` | Give coding agents the relevant milestone, desired behavior, and completion criteria. Review the diff and actual check output before accepting generated changes. Record assumptions and open questions in the owning doc when they affect subsequent work. |
| `docs/guides/testing-and-verification.md` | Explain where to put tests, how to run them, what fixtures to use, and how to verify gameplay and agent behavior. |

### Testing and verification

| Kind of check | Location and approach |
|---|---|
| Unit tests | Place tests alongside the package or app code they exercise. Use controlled inputs to check behavior such as interpreting an observation or deciding when an activity should stop. |
| CLI and cross-package integration tests | Use the root `tests/` folder. For M0, run init against temporary directories and small local Git fixtures. Verify a fresh setup, a repeat run, and preservation of an existing checkout with local edits. |
| Live gameplay checks | Document prerequisites and steps in the testing guide or relevant milestone. Run these explicitly against the private Revision 274 world. Record the starting character state, available observations, expected result, and in-game evidence. |

Document the actual commands as they land. Keep the default automated suite runnable without a live world or model credentials. For later model-driven tests, check observable outcomes and evidence rather than exact journal wording. Keep test fixtures clearly identified and outside runtime discovery data.

### Where the existing documents live

During M0, move the technical planning documents into `docs/milestones/plans/` and link them from their relevant briefs. The architecture and runtime plans can support several milestones. Keep the Control Center UI guidance directory intact under `docs/design/` so its branding, tokens, screen specs, and mockup sources stay together.

| Current location | M0 destination | Related work |
|---|---|---|
| [`docs/architecture.md`](../architecture.md) | `docs/milestones/plans/architecture.md` | Workspace setup and shared system architecture |
| [`docs/lostcity-and-aeris.md`](../lostcity-and-aeris.md) | `docs/milestones/plans/lostcity-and-aeris.md` | Local LostCity, Aeris, and navigation |
| [`docs/agent-runtime.md`](../agent-runtime.md) | `docs/milestones/plans/agent-runtime.md` | Runtime layers, scheduling, and multi-agent operation |
| [`docs/discovery-memory.md`](../discovery-memory.md) | `docs/milestones/plans/discovery-memory.md` | Event History and Discovery Memory |
| [`docs/control-center.md`](../control-center.md) | `docs/milestones/plans/control-center.md` | Control Center requirements and technical plan |
| [`docs/control-center/`](../control-center/README.md) | `docs/design/control-center/` | Visual guidance, branding, tokens, screen specs, and mockups |
| [`docs/roadmap.md`](../roadmap.md) and `docs/milestones/*.md` | Keep their current paths. | Master roadmap and individual milestone briefs |

Update relative links in the root README, milestone briefs, technical plans, and visual design documents when moving files. Verify that the new documentation index reaches the guides, briefs, plans, and visual designs.

### Coding-agent instructions

- Create a root `AGENTS.md` with concise repository-wide instructions and a map of the documentation. Point coding agents to the roadmap and the relevant milestone first, then to the documentation index for the relevant design or guide. Summarize the private LostCity checkout boundary and ordinary-player integration. Link to the AI-assisted development, Git, and verification guides for task-specific detail.
- Create a root `CLAUDE.md` containing `@AGENTS.md` so Claude Code loads the shared instructions from the same source. [Claude Code project instructions](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)

## First run and updates

Use `git clone` or `git pull` to get our project files, including the CLI and its source manifest. Then run `npm run runehive -- init` from the project root. Init fetches any missing LostCity server, content, and client checkouts into the Git-ignored `lostcity/` directory alongside `runescape-ai/`. It reuses checkouts that already match. If a later pull changes a commit pin, init reports the mismatch and preserves the existing checkout.

## Objectives and plan

1. **Scaffold the workspace and CLI.** Register `runescape-ai/packages/*` and `runescape-ai/apps/*` in the root npm workspace. Start with a small Node.js entry point using built-in modules so `npm run runehive -- init` can run from a fresh checkout with Node.js, npm, and Git available. Resolve `lostcity/` under the project root and print the resolved destination.
2. **Record and fetch the source set.** Put the launcher, Engine-TS, Content, and Client-TS URLs, their expected branch labels, and full commit IDs in the source manifest. Record an initial Revision 274 source set in M0. M1 validates that set through a real launch and updates pins if needed. Init fetches missing sources and prints each component's path and actual commit so the TypeScript client source can be found locally.
3. **Make reruns safe.** Reuse a matching checkout at the expected origin and commit. Report changed commits, local edits, unexpected origins, and occupied paths without resetting or replacing them. If a fetch fails midway, leave completed checkouts usable and make the failed component clear so the next run can resume.
4. **Expose the direct command.** Point npm's `scripts.runehive` and `bin.runehive` at the same entry point. Document `npm link` as the one-time linking option and retain the npm command for first-run setup. The npm global bin location needs to be on the user's PATH for the direct command. [npm package binaries](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin) · [npm link](https://docs.npmjs.com/cli/v11/commands/npm-link/)

## M1 handoff

[Play LostCity locally](local-lostcity.md) runs upstream engine configuration and verifies the bundled browser client. Use the engine's setup and start commands because opening the launcher's interactive menu triggers a Java checkout. M1 adds `runehive start lostcity`, `runehive status lostcity`, and `runehive stop lostcity` using the same workspace paths.

## Done when

1. **The guides are written and linked.** The root README leads to the documentation index, all six written guides, the organized design documents, and the milestone briefs. Root `AGENTS.md` points coding agents to that material, and `CLAUDE.md` imports it.
2. **The project init tool works from a fresh checkout.** The agreed workspace folders are present, and `npm run runehive -- init` fetches the pinned LostCity launcher, engine, content, and TypeScript client into the Git-ignored `lostcity/` directory. The command prints their local paths and exact revisions. A second run reuses matching checkouts and preserves and reports local changes or conflicts. Verify the real fetch once and cover reruns and conflicts with repeatable tests using local Git fixtures. After the documented linking step, `runehive --help` runs the same CLI.
