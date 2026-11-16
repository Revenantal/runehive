---
id: M6
title: "Build the Approach layer"
delivers: "An agent can choose what to try next and explain its choice."
depends_on: [M4, M5]
design: []
builds:
  - { name: "Activity selection with stop conditions", system: architecture, status: in-design }
  - { name: "Decision records and explanations", system: architecture, status: in-design }
  - { name: "Review checkpoints and early replanning triggers", system: agent-runtime, status: in-design }
---
# Build the Approach layer

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M4](navigation-and-exploration.md), [M5](discovery-memory.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Activity selection with stop conditions | [Architecture and Repository](../system/architecture.md) | In design |
| Decision records and explanations | [Architecture and Repository](../system/architecture.md) | In design |
| Review checkpoints and early replanning triggers | [Agent Runtime](../system/agent-runtime.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Given a short-term objective, choose a concrete activity or experiment and explain why it is worth trying.

## Objectives and plan

- Use the character's observed state, map clues, and [Discovery Memory](discovery-memory.md) to choose a bounded activity with a stopping condition.
- Validate the selected activity and hand it to [navigation](navigation-and-exploration.md) and [Execution](execution.md).
- Record the chosen activity, relevant evidence, an explanation, and the outcome. Revisit it at planning checkpoints or when significant events warrant a change.

## Done when

Given “find a better sword,” the agent chooses where to investigate from available clues, carries out the investigation, stores what it finds, and can explain the choice.
