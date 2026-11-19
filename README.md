# Runehive

Autonomous AI agents that learn to play a RuneScape world by playing it.

Runehive runs on a privately hosted [LostCity](https://github.com/LostCityRS) server, targeting historical **Revision 274**. Agents start with a map and no wiki. They log in as ordinary players, explore, try things, and remember what they learn. A web app lets you watch what they're doing and why.

> **Status:** Early planning. The docs describe intent, not a final spec, and none of the game-facing code exists yet.

## What it is

A learning and systems-design project. Agents play as ordinary players with the same rules as humans, discover how the game works instead of being told, and share what they find. Their goals, decisions, and discoveries are visible in the web app. See [project goals and constraints](docs/project-goals.md) for the full list of goals and non-goals.

## How it works

Each agent plans on three timescales:

| Layer | Question | Timescale |
|---|---|---|
| **Goal** | What am I working toward? | Hours to days |
| **Approach** | What should I try next? | Minutes to hours |
| **Execution** | How do I carry it out? | Game ticks to minutes |

The main pieces, all TypeScript:

- **Headless client:** a client that connects to LostCity like a normal player.
- **Agent Runtime:** the three layers, plus Discovery Memory and Event History in SQLite.
- **Control Center:** a React and Vite web app for watching agents and browsing discoveries.
- **LostCity:** an unmodified upstream Revision 274 server, kept outside this codebase.

See the [architecture](docs/system/architecture.md) for the full picture.

## Getting started

Setup steps are being written as the milestones land. The repo can fetch the pinned LostCity sources into a Git-ignored `lostcity/` folder and run the local world. This needs Node.js 24 or newer and Git:

```sh
npm install
npm run runehive -- init   # fetch the pinned LostCity sources
npm start                  # start all services in the background; prints the browser URL
npm run runehive -- status # stopped, starting, or ready
npm stop                   # stop all services cleanly
```

Open the printed URL (normally http://localhost:8888/rs2.cgi) to play. See [local development](docs/guides/local-development.md) for details. See [M1](docs/milestones/local-lostcity.md) for the local-world milestone and its verification scope.

## Documentation

- [Documentation index](docs/README.md): roadmap, milestone briefs, system docs, and guides.
- [Project goals and constraints](docs/project-goals.md): goals, non-goals, and the Revision 274 completeness requirement.
- [Roadmap](docs/roadmap.md): the milestones, success scenarios, and open questions.
- [Local development](docs/guides/local-development.md): prerequisites and troubleshooting.
- [AGENTS.md](AGENTS.md): instructions for AI coding agents working in this repo.
