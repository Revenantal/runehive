# Build the Goal layer

[Roadmap](../roadmap.md) · [Architecture](../architecture.md)

## Goal

Give an agent a longer-term objective that it can pursue and revise over several activities.

## Objectives and plan

- Represent goals, subgoals, and proposed prerequisites with their supporting evidence or hypothesis status.
- Send the current short-term objective to [Approach](approach.md), then revisit priorities as discoveries, progress, or obstacles change the plan.
- Preserve earlier decisions and expose the current goal structure and its history through the CLI or runtime.

## Done when

The agent pursues a long-term objective across multiple activities and revises a mistaken prerequisite after receiving contradictory evidence. The resulting change and the earlier decision are visible from the CLI.
