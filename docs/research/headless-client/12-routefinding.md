# 12 · Routefinding and turn-waypoint experiment

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and source observations

Can the prototype send a multi-turn route in the format used by the pinned browser? This is a prerequisite to a meaningful detour experiment, not proof that an arbitrary destination is unreachable.

The pinned browser's `Client.tryMove` runs a breadth-first search over its current build area's collision flags. It checks cardinal and diagonal moves, including corner-cutting conditions. Where requested, it can select a nearby reachable tile if the exact destination cannot be reached. It backtracks the search and sends turning points, capped at 25 waypoints, in the movement packet. Its collision map is constructed from loaded map terrain and location data and location definitions, and can change when in-game locations change. A client needs the relevant protocol/cache state and updates; it cannot infer collision just from another player's position.

The server's `MoveClickDecoder` interprets the packet's first absolute coordinate as the first waypoint and subsequent signed byte pairs as offsets from it. With the approved current `clientRoutefinder` setting, the handler queues those waypoints rather than finding a route to the last one. The server validates individual steps against collision. The existing experiment writes the current tile first, followed by offsets, a tested shortcut rather than an implementation of the browser's routefinder.

## Controlled experiment defined before running

Two fresh ordinary-player clients start at the same position. Each receives one bounded movement request and observes for 12 seconds:

- **Direct control:** a waypoint at offset (2, 2).
- **Turn trial:** a waypoint at offset (0, 2), then one at (2, 2), both relative to the same packet start.

Success requires each client to receive player updates placing it at the requested final destination, not merely for the observation deadline to pass. If one stops short or position becomes unknown, its outcome remains `unknown`. A difference could reflect collision along the particular paths; neither outcome establishes that all routes are blocked. Human diagnostic data, if used, is separate corroboration, not client input. This experiment does not use the owner's reference position or preload a map.

## Results

Both fresh clients received the requested destination, level 0 at (3096, 3108), with zero state-decoding errors and no framing failure. The direct control observed two walk updates; the turn trial observed four. Both reported `completed`. The different update counts are consistent with the intended two-segment route, but this observer does not retain a per-step coordinate trace, so it does not independently prove every intermediate tile.

A later fresh-client repeat of the turn trial recorded client-observed positions after the request: (3094, 3107), (3094, 3108), (3095, 3108), and (3096, 3108), at approximately 1016, 1613, 2199, and 2826 ms respectively. It reported four walk updates, completion, no decode errors and no framing failure. This confirms the intermediate positions in this run, not merely the final destination.

The experimental observer now records up to 128 changed positions after a request, with a truncation flag and elapsed time. A trace entry corresponds to a received player update, not necessarily a single game step: a running update can contain two steps. A region rebuild or malformed update can make position unknown. The trace is output in the bounded observer summary, not persisted to the existing allowlisted diagnostic logs.

This supports that our experimental packet can carry more than one waypoint, but neither trial deliberately crossed or avoided an obstacle. It does not validate the browser's routefinding, the reference location, or a `blocked` outcome. Next, construct or observe a collision map from normal player-accessible map data before claiming an obstacle-avoiding route; map changes and unknown tiles must be accounted for.
