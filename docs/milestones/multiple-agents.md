# Run multiple agents

[Roadmap](../roadmap.md) · [Agent Runtime](../agent-runtime.md)

## Goal

Run multiple ordinary player sessions with independent goals and shared discoveries.

## Objectives and plan

- Give each agent its own session, work queue, goals, and recovery checkpoint. Track connectivity, model budgets, and server tick health.
- Demonstrate one agent discovering a shop and another using the shared finding to guide its own attempt. Recheck stock live.
- Add a character switcher to the [Control Center](control-center.md). Verify that a restart restores the agents' independent state and shared evidence.

## Done when

Three agents can pursue independent goals and reuse shared discoveries. The user can switch between them, and the agents can resume after a restart.
