---
id: M3
title: "Build the Execution layer"
delivers: "A bot can carry out a supplied task and verify the result in-game."
depends_on: [M2]
design: []
builds:
  - { name: "Woodcutting workflow using interact", system: architecture, status: in-design }
  - { name: "Interruption, timeout, and recovery handling", system: architecture, status: in-design }
  - { name: "Progress and outcome events", system: architecture, status: in-design }
  - { name: "Banking workflow", system: architecture, status: in-design }
---
# Build the Execution layer

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M2](headless-client.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Woodcutting workflow using interact | [Architecture and Repository](../system/architecture.md) | In design |
| Interruption, timeout, and recovery handling | [Architecture and Repository](../system/architecture.md) | In design |
| Progress and outcome events | [Architecture and Repository](../system/architecture.md) | In design |
| Banking workflow | [Architecture and Repository](../system/architecture.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Turn a bounded, supplied task into ordinary game actions and report the observed result.

## Objectives and plan

- Use the [Headless Client](headless-client.md) to run a Woodcutting workflow from the CLI. Start from a known local task area and choose among observed targets.
- Select the tree's available option through `interact`. Observe ongoing chopping and count logs from inventory changes. Interact again when a new attempt is needed.
- Handle a depleted tree, full inventory, interruption, and timeout. Emit basic progress and outcome events for later use by Event History.
- Reuse the workflow structure for other interactions and add banking as a follow-up execution workflow.

## Done when

Given a task such as collecting five logs from nearby trees, the bot reports success based on observed inventory changes or stops with a clear reason and the amount collected.
