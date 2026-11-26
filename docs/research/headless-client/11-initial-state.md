# 11 · Initial state discovery

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

**Status: initial stationary session verified; movement remains open.** The goal is to learn the character's initial position and other state from ordinary server packets, not the server database. The success condition was that a fresh character receives a region and local position, the decoder derives a plausible world position, and independent human-only diagnostics corroborate it. Missing, stale or undecodable state must remain unknown. No movement outcome is claimed here.

## Pinned-source observations

- `REBUILD_NORMAL` contains two big-endian unsigned 16-bit centre-zone coordinates. The pinned browser calculates the map base as `(zone - 6) * 8` independently for each axis.
- `PLAYER_INFO` starts with a local-player update. A teleport update contains a two-bit level, seven-bit local X and seven-bit local Z, followed by jump and extended-info flags. The browser uses those local coordinates with the map base; idle updates contain no new position. Walking and running instead carry direction codes.
- `UPDATE_STAT` contains a stat index, a big-endian four-byte experience value and the current level. The server encoder divides its internal experience value by ten before sending it. The prototype stores the wire value; it does not infer a base level or identify skill names.
- `UPDATE_RUNENERGY` contains one byte. The server encoder divides its internal value by 100 before sending it.
- `UPDATE_INV_FULL` describes an interface component and slots, not a complete semantic inventory. Item IDs alone do not establish item names or actions. Inventory interpretation is deferred.

## Prototype and limitations

`tools/headless-experiment/initial-state.mjs` is a packet accumulator tested with synthetic packets and integrated into the bounded `observe` command. It derives a world position only after both a region and a local teleport; it retains that position through idle updates, applies server-reported walk and run direction codes, and marks it unknown on a region rebuild. It records received skill values and energy without filling in missing fields. The coordinate sample in its unit test is a fixture, not an independent game observation.

A fresh ordinary-player session against the owner's server reported centre zones (386, 388), base (3040, 3056), and position level 0, x 3094, z 3106. It received energy 100 and 21 indexed stat updates; one had current level 10 and wire experience 1154, the others had level 1 and zero wire experience. The packet accumulator reported no state decode errors, and saw one local teleport followed by 13 idle updates. A separate human-only read of the server's final session record reported the same level and coordinates; it was not used by the client. This is one stationary run, not proof of general movement tracking.

A subsequent fresh-client test requested a two-tile northward walk. The client observed two walk updates and calculated a final position of level 0, x 3094, z 3108; the independent human-only final session record matched. A second fresh client repeated the request, again reporting two walk updates and the same final position; the owner independently confirmed seeing it appear and walk in the browser. These runs verify a bounded walk, not general routing or action outcome semantics. Run-direction decoding is synthetic-tested but not live-verified.

The observer now records the position at request time, the hard-coded experimental destination, and a `completed` outcome only when a subsequent player update reports that destination. A further fresh-client run reported start (3094, 3106), destination (3094, 3108), two walk updates and `completed`. If the destination is not observed, the outcome is `unknown`; elapsed time alone does not establish a blocked path. The shortcut assumes the fresh-character start tile and is not a general movement API.

A separate timed live run measured approximately 0.041 ms from entry into the observer's callback for the arriving packet through state decoding and destination comparison. Across 235 callbacks the total was approximately 0.947 ms, with a maximum of 0.194 ms. These are single-run wall-clock measurements using `performance.now()`, not a benchmark: they exclude socket transport, ISAAC packet framing, scheduling before the callback, command generation, and game movement. The CLI prints the summary after the observation window, not immediately at arrival.

For an unreachable-target experiment, the owner offered a stationary browser character as a reference. A fresh headless observer saw one player at offset (2, 6) from its starting position; that is a player sighting, not proof that the destination tile is blocked. Pinned server source shows `clientRoutefinder` controls whether incoming click waypoints are used or the server calculates a route; the current approved server configuration enables the former. The prototype does not yet implement a client routefinder.

A bounded direct-waypoint comparison used two fresh accounts and 12-second observation windows. The control requested offset (0, 2), observed two walk updates and reached (3094, 3108), so reported `completed`. The reference trial requested offset (2, 6), observed four walk updates and stopped being observed at (3096, 3110), two tiles short of the requested (3096, 3112); its outcome remained `unknown`. Both clients saw a player at offset (2, 6), and neither reported a state decode or packet framing error. These are client-visible packet observations, not proof that every route to the target is blocked: the supplied direct waypoint may not describe a valid route around intervening geometry, and the server could still retain a pending waypoint. No blocked outcome is inferred.

Open questions include blocked and interrupted movement, ordering around region rebuilds, live run-direction decoding, level changes, partial inventory updates, and the appropriate interface-to-inventory mapping. Never use diagnostic database values as client observations; any independent database check is human-only corroboration.
