---
id: M8
title: "Build the Control Center"
delivers: "One web app shows live agent activity, goal progression, and discoveries."
depends_on: [M5]
design: [control-center]
builds:
  - { name: "Runtime API and live event stream", system: control-center, status: in-design }
  - { name: "Agent View with minimap and character panels", system: control-center, status: in-design }
  - { name: "Agent Journal and goal history", system: control-center, status: in-design }
  - { name: "Discovery Explorer", system: control-center, status: in-design }
---
# Build the Control Center

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M5](discovery-memory.md)
- **Design:** [Control Center — UI Guidance](../design/control-center/README.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Runtime API and live event stream | [Control Center](../system/control-center.md) | In design |
| Agent View with minimap and character panels | [Control Center](../system/control-center.md) | In design |
| Agent Journal and goal history | [Control Center](../system/control-center.md) | In design |
| Discovery Explorer | [Control Center](../system/control-center.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Build one web app for following an agent's activity and investigating what it has learned.

## Objectives and plan

- Connect the React, TypeScript, and Vite frontend to the Runtime API and live event stream. Start with one character and real runtime data.
- Build the RuneScape-inspired Agent View around the Revision 274 minimap. Show observed inventory, equipment, skills, bank, and quest log, with timestamps or unavailable states where appropriate.
- Show **Goal → Approach → Execution** at a glance. Link the Agent Journal and goal history to the recorded decisions and events.
- Build a searchable Discovery Explorer with filters and links through observations, attempts, confirmations, and corrections.

## Done when

A user can open the Control Center, follow one live character, inspect its current goal and activity, and trace a persisted discovery back to the game observation that produced it.
