---
id: M2
title: "Build the Headless Client"
delivers: "A working Headless Client (Aeris) usable through typed commands and TypeScript scripts."
depends_on: [M1]
design: []
builds:
  - { name: "Protocol and session layer (login, maintenance, reconnect)", system: lostcity-and-aeris, status: in-design }
  - { name: "Client state (position, nearby targets, inventory, skills, interfaces)", system: lostcity-and-aeris, status: in-design }
  - { name: "Generic interact action", system: lostcity-and-aeris, status: in-design }
  - { name: "Typed CLI and scripting interface", system: lostcity-and-aeris, status: in-design }
---
# Build the Headless Client

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M1](local-lostcity.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Protocol and session layer (login, maintenance, reconnect) | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| Client state (position, nearby targets, inventory, skills, interfaces) | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| Generic interact action | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| Typed CLI and scripting interface | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Build a TypeScript headless client that connects to the private Revision 274 world as an ordinary player. Make it usable through typed CLI commands and TypeScript scripts.

## Objectives and plan

- Use the [local LostCity setup](local-lostcity.md) to validate login, session handling, movement, and basic state updates.
- Expose position, nearby targets, interaction options, inventory, skills, and relevant interface state as the client learns to decode them.
- Provide a generic `interact` action that accepts an available interaction option for a target. Expose the same client operations to the CLI and scripts.
- Start with a small playable slice. If stock compatibility blocks it, record what failed and evaluate the fallback options in the Aeris design.

## Done when

The owner can log in, walk, inspect state, and interact by typing commands. A small script can use the same Aeris interface to interact with a tree and confirm an inventory or Woodcutting XP change from the game.
