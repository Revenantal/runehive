---
id: M9
title: "Run multiple agents"
delivers: "Independent agents share discoveries, resume after restart, and can be selected in the Control Center."
depends_on: [M5, M8]
design: []
builds:
  - { name: "Agent Manager (sessions, recovery, budgets)", system: agent-runtime, status: in-design }
  - { name: "Shared discovery use across agents", system: discovery-memory, status: in-design }
  - { name: "Character switcher and restart recovery", system: control-center, status: in-design }
---
# Run multiple agents

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M5](discovery-memory.md), [M8](control-center.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Agent Manager (sessions, recovery, budgets) | [Agent Runtime](../system/agent-runtime.md) | In design |
| Shared discovery use across agents | [Discovery Memory](../system/discovery-memory.md) | In design |
| Character switcher and restart recovery | [Control Center](../system/control-center.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Run multiple ordinary player sessions with independent goals and shared discoveries.

## Objectives and plan

- Give each agent its own session, work queue, goals, and recovery checkpoint. Track connectivity, model budgets, and server tick health.
- Demonstrate one agent discovering a shop and another using the shared finding to guide its own attempt. Recheck stock live.
- Add a character switcher to the [Control Center](control-center.md). Verify that a restart restores the agents' independent state and shared evidence.

## Done when

Three agents can pursue independent goals and reuse shared discoveries. The user can switch between them, and the agents can resume after a restart.
