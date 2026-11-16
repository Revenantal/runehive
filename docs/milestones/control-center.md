# Build the Control Center

[Roadmap](../roadmap.md) · [Control Center plan](../control-center.md) · [Screen designs and mockups](../control-center/README.md)

## Goal

Build one web app for following an agent's activity and investigating what it has learned.

## Objectives and plan

- Connect the React, TypeScript, and Vite frontend to the Runtime API and live event stream. Start with one character and real runtime data.
- Build the RuneScape-inspired Agent View around the Revision 274 minimap. Show observed inventory, equipment, skills, bank, and quest log, with timestamps or unavailable states where appropriate.
- Show **Goal → Approach → Execution** at a glance. Link the Agent Journal and goal history to the recorded decisions and events.
- Build a searchable Discovery Explorer with filters and links through observations, attempts, confirmations, and corrections.

## Done when

A user can open the Control Center, follow one live character, inspect its current goal and activity, and trace a persisted discovery back to the game observation that produced it.
