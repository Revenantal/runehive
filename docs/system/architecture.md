# Architecture and Repository

[Project overview](../../README.md) · Built in: <!-- built-in -->[M0](../milestones/project-setup.md), [M3](../milestones/execution.md), [M4](../milestones/navigation-and-exploration.md), [M6](../milestones/approach.md), [M7](../milestones/goal.md)<!-- /built-in -->

## Architectural approach

The core intelligence/execution model has **three distinct layers**, supported by simple services.

```text
                       HUMAN WEB CONTROL CENTER
              ┌─────────────┬─────────────┬──────────────┐
              │ Discoveries │ Agents      │ Goals/Log    │
              └──────┬──────┴──────┬──────┴──────┬───────┘
                     │             │             │
                      API + Event Stream
                     │             │             │
          ┌──────────▼─────────────▼─────────────▼─────────┐
          │                 AI RUNTIME                      │
          │                                                │
          │  Goal                 (long-term direction)    │
          │           ↓                                    │
          │  Approach             (next activity or test)  │
          │           ↓                                    │
          │  Execution            (actions and recovery)   │
          │                                                │
          │    ↔ Discovery Memory / Event History (SQLite) │
          │    ↔ Agent Manager / Scheduler                 │
          └───────────────────────┬────────────────────────┘
                                  │
                       Interaction Client
                 (protocol, state, map, actions)
                                  │
                   Stock LostCity Revision 274
                        (private server)
```

The three layers are **roles and interfaces**, not a mandate to run three different LLMs or processes. We can start with a single model invoked at different checkpoints, with deterministic code handling repetitive work.

### Goal — *What am I working toward?*

**Timescale:** Hours, days, entire character lifespan.

Responsibilities:
- Own high-level ambitions, e.g. *complete Dragon Slayer* or *progress across all skills in the available revision*.
- Create and revise a hierarchy of subgoals and dependencies.
- Balance progression, discovery, risk, and opportunity cost.
- Distinguish *confirmed prerequisites* from *agent hypotheses*.
- Re-evaluate the master plan after significant discoveries, milestones, or failure.

Example output: "My long-term objective is to complete Dragon Slayer. I'm investigating whether additional combat training is needed."

**Caution:** Illustrative dependencies are **not authoritative game facts**. For example, "get 30 Woodcutting for Dragon Slayer" is an example of what a bot might believe, not a verified quest requirement. The UI should expose and allow us to challenge unsupported links.

### Approach — *What should I try next?*

**Timescale:** Minutes to hours. Review cadence is in [Agent Runtime](agent-runtime.md#execution-rhythms-and-cost-control).

Responsibilities:
- Choose a bounded activity or experiment, e.g. *investigate the Varrock sword shop*, *train Defence*, *test whether I can equip this item*.
- Consider current goals, available map hints, known discoveries, agent condition, and safety.
- Decide whether to exploit known methods or explore unknown opportunities.
- Validate or reject human suggestions.
- Escalate major changes to the Goal layer.
- Trigger early replanning on relevant events: death, blockage, level unlock, surprising discovery, resource exhaustion, repeated failures.

Output should include a structured plan, stop conditions, and short **decision explanation**.

### Execution — *How do I carry it out?*

**Timescale:** Game ticks through minutes; predominantly deterministic.

Responsibilities:
- Observe live character and local world state.
- Execute generic actions: move, find nearby entities, inspect, interact, use item, select dialogue, bank, buy/sell, attack (when available).
- Manage retries, timeouts, interruptions, inventory-full conditions, route changes and client reconnects.
- Confirm action outcomes using observations rather than assuming an interaction succeeded.
- Emit gameplay events, metrics, and findings for memory.

The executor should use **generic primitives and reusable patterns** rather than hardcoding a unique script for every skill. Some activities may still require bespoke handling where interfaces differ.

## Repository organization

Keep the code we build in one TypeScript workspace in a single GitHub repository. It starts with two local packages, **Headless Client** and **Agent Runtime**, plus the **Control Center** frontend app. Each package has its own `package.json`. The workspace lets the runtime import the client from the same checkout. LostCity stays in a separate upstream checkout pinned to tested Revision 274 commits and runs as its own game server.

The [setup milestone](../milestones/project-setup.md) provisions the Git-ignored `lostcity/` directory inside the workspace and fetches the upstream source so the server and client files can be browsed locally.

Open the project Git checkout as the workspace root. It contains the human entry point in `README.md`, the shared coding-agent instructions in `AGENTS.md`, the Claude Code import in `CLAUDE.md`, and the documentation under `docs/`.

```text
runehive/                           # Runehive workspace root and Git checkout
├── README.md                       # Human entry point
├── AGENTS.md                       # Coding-agent entry point
├── CLAUDE.md                       # Imports AGENTS.md
├── docs/                           # Index, roadmap, milestones, plans, system docs, UI design, guides, standards
├── package.json                    # npm workspace and project CLI
├── eslint.config.mjs, .prettierrc.json, tsconfig.base.json   # lint, format, strict TS
├── .githooks/                      # pre-commit, pre-push, commit-msg
├── .gitignore                      # Excludes /lostcity/ from our Git checkout
├── tools/                          # Project CLI and upstream source manifest
├── tests/                          # cli/, docs/, integration/, gameplay/
├── lostcity/                       # Git-ignored upstream checkout
├── apps/
│   └── control-center/             # Frontend for agent state, goals, discoveries, and history
└── packages/
    ├── headless-client/            # Headless client: protocol, sessions, game state, player actions
    │   └── package.json
    └── agent-runtime/              # Agent behavior and supporting systems
        ├── package.json
        └── src/
            ├── goal/               # Long-term goals and priorities
            ├── approach/           # Next activity or experiment
            ├── execution/          # Workflows, outcome checks, recovery
            ├── perception/         # Observations available to the agent
            ├── navigation/         # Map access and routing
            ├── memory/             # Personal and shared discoveries
            ├── history/            # Events and evidence
            ├── agents/             # Lifecycle, scheduling, budgets
            ├── storage/            # SQLite persistence
            └── api/                # Queries, live events, optional nudge intake
```

### Headless Client

The headless client connects to LostCity as an ordinary player and can run independently for protocol and gameplay experiments.

| Responsibility | What it does |
|---|---|
| Protocol and sessions | Handles login, game messages, and the connection lifecycle for Revision 274. |
| Client state | Turns game updates into usable state, including position, inventory, skills, nearby entities, and open interfaces. |
| Player actions | Sends ordinary movement and interaction requests to LostCity. |

### Agent Runtime package

The Agent Runtime imports the Headless Client and runs one or more agents. Each agent has its own session, goals, and activity history. Agents can draw on shared discoveries.

#### Three core layers

| Module | What it does |
|---|---|
| **Goal** (`goal/`) | Sets long-term goals, tracks possible prerequisites, and revises priorities when new evidence changes the plan. |
| **Approach** (`approach/`) | Chooses the next bounded activity or experiment, sets a stopping condition, and decides when to replan. |
| **Execution** (`execution/`) | Carries out activities through the client, checks outcomes, and handles routine interruptions or reports blockers. |

#### Supporting systems

| Module | What it does |
|---|---|
| **Perception** (`perception/`) | Defines which client observations and map information the agent can use. |
| **Map and Navigation** (`navigation/`) | Provides permitted map data and finds routes to destinations selected by the planner. |
| **Discovery Memory** (`memory/`) | Maintains personal and shared observations, hypotheses, and reusable procedures with links to their evidence. |
| **Event History** (`history/`) | Records what happened during play, including actions, observations, decisions, failures, and outcomes. |
| **Agent Manager** (`agents/`) | Manages agent lifecycles, scheduling, session recovery, and model budgets. |
| **Storage** (`storage/`) | Persists runtime records in SQLite so they remain available across restarts. |
| **Runtime API and Event Stream** (`api/`) | Uses Hono to serve runtime data and Server-Sent Events to deliver live updates to the Control Center. Accepts optional human nudges for the Approach layer to review. |

Exploration uses several runtime modules. Approach picks a question worth investigating, Perception supplies available clues, Navigation finds a route, Execution tries the interaction, and Discovery Memory preserves what the agent learned.

### Control Center frontend app

A React and TypeScript web app built with Vite. It visualizes runtime data through the API and live event stream. Views, features, and stack are in the [Control Center plan](control-center.md).

### LostCity upstream

The private LostCity server supplies the game world, rules, and normal graphical client. Our Headless Client connects to it over the game protocol.

The folders show where responsibilities can land as they are built. Revisit a separate Headless Client repository if the client gains independent users or needs its own release cycle.
