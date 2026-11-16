---
id: M4
title: "Add map navigation and exploration"
delivers: "An agent can reach and investigate a supplied location."
depends_on: [M3]
design: []
builds:
  - { name: "Map, collision, and point-of-interest access", system: lostcity-and-aeris, status: in-design }
  - { name: "Route planning and blocked-movement detection", system: architecture, status: in-design }
  - { name: "Shop investigation hand-off to Execution", system: architecture, status: in-design }
---
# Add map navigation and exploration

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M3](execution.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Map, collision, and point-of-interest access | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| Route planning and blocked-movement detection | [Architecture and Repository](../system/architecture.md) | In design |
| Shop investigation hand-off to Execution | [Architecture and Repository](../system/architecture.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Make the agent able to reach and investigate a supplied location using its map and ordinary player observations.

## Objectives and plan

- Verify which Revision 274 map, collision, and point-of-interest data the agent can access. Use locally observed clues where map labels are unavailable.
- Plan and follow a route, detect blocked movement, and report when the destination cannot be reached.
- Pass the local interaction to [Execution](execution.md). Use a shop as the first example and emit the observed stock and location.

## Done when

Given a destination or area to investigate, the agent navigates there, opens a shop through an ordinary interaction, and reports what the interface shows. Choosing which destination to investigate is part of the [Approach milestone](approach.md).
