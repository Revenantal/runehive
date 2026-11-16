# Build the Execution layer

[Roadmap](../roadmap.md) · [Architecture](../architecture.md)

## Goal

Turn a bounded, supplied task into ordinary game actions and report the observed result.

## Objectives and plan

- Use [Aeris](aeris-client.md) to run a Woodcutting workflow from the CLI. Start from a known local task area and choose among observed targets.
- Select the tree's available option through `interact`. Observe ongoing chopping and count logs from inventory changes. Interact again when a new attempt is needed.
- Handle a depleted tree, full inventory, interruption, and timeout. Emit basic progress and outcome events for later use by Event History.
- Reuse the workflow structure for other interactions and add banking as a follow-up execution workflow.

## Done when

Given a task such as collecting five logs from nearby trees, the bot reports success based on observed inventory changes or stops with a clear reason and the amount collected.
