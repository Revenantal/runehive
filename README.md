# Runehive

**Status:** Exploratory architecture / planning guidance — **not a final specification**  
**Prepared:** November 12, 2026  
**Target game:** Privately hosted LostCity, targeting historical **Revision 274**, subject to compatibility and completeness verification  
**Primary language:** TypeScript  
**Intended audience:** Human collaborators and future AI coding/research agents

> **Central vision:** Build a set of autonomous agents that **learn to play a historically bounded RuneScape world through firsthand experience**, rather than beginning with a prepopulated encyclopedia of game mechanics. Give them the ability to perceive a normal game client, read its map, plan at different timescales, perform legitimate game actions, learn from outcomes, and share discoveries. Make their activities and decisions inspectable through a human-facing web application.

## Planning documents

- [Architecture and Repository](docs/architecture.md) — System diagram, the Goal → Approach → Execution layers, and the workspace layout.
- [LostCity and Aeris](docs/lostcity-and-aeris.md) — Revision 274 integration, the headless client, and what agents can observe and use to explore.
- [Discovery Memory](docs/discovery-memory.md) — Personal and shared memory, evidence, verification, and storage.
- [Agent Runtime](docs/agent-runtime.md) — Agent scheduling, planning rhythms, budgets, and optional human nudges.
- [Control Center](docs/control-center.md) — Agent views, minimap, journal, Discovery Explorer, frontend stack, and visual identity.
  - [Control Center UI guidance](docs/control-center/README.md) — Draft branding, design tokens, per-screen specs and mock-up sources.
- [Roadmap](docs/roadmap.md) — Milestones, success scenarios, open questions, and guidance for implementation.

## Purpose and guiding constraints

This is primarily a **learning and systems-design project**. We want to implement and understand autonomous planning, agent execution, persistent memory, exploration, coordination, client networking, and observability ourselves. Fastest-possible bot deployment is **not** the central optimization target.

### Project goals

- Run a private LostCity world that human players can access through its normal graphical client.
- Operate multiple autonomous characters that act as **ordinary players**, with the same gameplay rules and progression restrictions.
- Build our AI ecosystem **outside** the LostCity repositories wherever possible.
- Let agents discover shops, training methods, NPC capabilities, quest requirements, equipment constraints, and strategies through gameplay.
- Provide the agents with game-native **map/navigation information**, potentially including labeled locations and shop-type points of interest; knowing a sword shop exists does **not** reveal its inventory or mechanics.
- Persist discoveries so future decisions and other agents can benefit from experience.
- Expose knowledge, agent activity, goals, planned actions, outcomes, and explanations through an accessible web UI.
- Optionally accept **human nudges** that agents assess critically rather than obeying automatically.

### Non-goals for the initial version

- Building a full RuneScape server from scratch.
- Recreating a modern OSRS ruleset or adding modern skills absent from Revision 274.
- Creating a comprehensive extracted **Game Knowledge Engine** by parsing all LostCity definitions or RuneScript.
- Preloading a complete wiki of game facts into agent memory.
- Allowing gameplay bots to use privileged server actions, teleportation, item grants, or direct game-state edits.
- Showing raw, hidden model reasoning. Instead show explicit, generated **decision records** with decisions, evidence, tradeoffs, and succinct rationales.
- Perfect autonomy, exhaustive world knowledge, or completion of all quests on day one.

### Historical-completeness requirement

Judge the chosen LostCity revision on whether its **own historically available systems function**, **not** on whether it includes later RuneScape/OSRS features. Revision 274 is the *target*, not an assumption that every obscure interaction is bug-free. Verify upstream release status, matching source revisions, client compatibility, and representative gameplay before committing.
