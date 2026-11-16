# Add map navigation and exploration

[Roadmap](../roadmap.md) · [Map access and starting knowledge](../lostcity-and-aeris.md)

## Goal

Make the agent able to reach and investigate a supplied location using its map and ordinary player observations.

## Objectives and plan

- Verify which Revision 274 map, collision, and point-of-interest data the agent can access. Use locally observed clues where map labels are unavailable.
- Plan and follow a route, detect blocked movement, and report when the destination cannot be reached.
- Pass the local interaction to [Execution](execution.md). Use a shop as the first example and emit the observed stock and location.

## Done when

Given a destination or area to investigate, the agent navigates there, opens a shop through an ordinary interaction, and reports what the interface shows. Choosing which destination to investigate is part of the [Approach milestone](approach.md).
