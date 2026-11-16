---
id: M7
title: "Build the Goal layer"
delivers: "An agent can pursue and revise an objective across several activities."
depends_on: [M6]
design: []
builds:
  - { name: "Goal and prerequisite model with hypothesis status", system: architecture, status: in-design }
  - { name: "Goal-to-Approach hand-off and priority revision", system: architecture, status: in-design }
  - { name: "Goal structure and history in the CLI", system: architecture, status: in-design }
---
# Build the Goal layer

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M6](approach.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Goal and prerequisite model with hypothesis status | [Architecture and Repository](../system/architecture.md) | In design |
| Goal-to-Approach hand-off and priority revision | [Architecture and Repository](../system/architecture.md) | In design |
| Goal structure and history in the CLI | [Architecture and Repository](../system/architecture.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Give an agent a longer-term objective that it can pursue and revise over several activities.

## Objectives and plan

- Represent goals, subgoals, and proposed prerequisites with their supporting evidence or hypothesis status.
- Send the current short-term objective to [Approach](approach.md), then revisit priorities as discoveries, progress, or obstacles change the plan.
- Preserve earlier decisions and expose the current goal structure and its history through the CLI or runtime.

## Done when

The agent pursues a long-term objective across multiple activities and revises a mistaken prerequisite after receiving contradictory evidence. The resulting change and the earlier decision are visible from the CLI.
