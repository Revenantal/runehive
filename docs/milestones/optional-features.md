---
id: M10
title: "Explore optional features"
delivers: "Human nudges, replay, richer analysis, and a possible live spectator view."
depends_on: [M6, M8]
design: []
builds:
  - { name: "Human nudges with decision history", system: agent-runtime, status: in-design }
  - { name: "Historical replay", system: control-center, status: in-design }
  - { name: "Live spectator view investigation", system: control-center, status: in-design }
---
# Explore optional features

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M6](approach.md), [M8](control-center.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Human nudges with decision history | [Agent Runtime](../system/agent-runtime.md) | In design |
| Historical replay | [Control Center](../system/control-center.md) | In design |
| Live spectator view investigation | [Control Center](../system/control-center.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Extend the experiment with ways to guide agents, revisit sessions, and see more of their activity.

## Objectives and plan

- Add optional human nudges with a visible decision history. Let Approach accept, modify, defer, investigate, or reject a suggestion.
- Explore historical replay from recorded positions and events, along with strategy comparisons and analysis of changes to shared discoveries.
- Investigate whether the Revision 274 web client or its rendering code can show the selected agent's existing session in a live graphical spectator view.

## Suggested demonstrations

- Submit a misleading nudge and inspect the agent's decision and the activity that follows.
- Replay a recorded activity and follow its timeline to a decision or discovery.
- For the spectator view, demonstrate a live view of an existing agent session if the client supports it.

Refine these into separate milestones as their scope and dependencies become clearer.
