# 12 · Routefinding and turn-waypoint experiment

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and source observations

Can the prototype send a multi-turn route in the format used by the pinned browser? This is a prerequisite to a meaningful detour experiment, not proof that an arbitrary destination is unreachable.

The pinned browser's `Client.tryMove` runs a breadth-first search over its current build area's collision flags. It checks cardinal and diagonal moves, including corner-cutting conditions. Where requested, it can select a nearby reachable tile if the exact destination cannot be reached. It backtracks the search and sends turning points, capped at 25 waypoints, in the movement packet. Its collision map is constructed from loaded map terrain and location data and location definitions, and can change when in-game locations change. A client needs the relevant protocol/cache state and updates; it cannot infer collision just from another player's position.

The server's `MoveClickDecoder` interprets the packet's first absolute coordinate as the first waypoint and subsequent signed byte pairs as offsets from it. With the approved current `clientRoutefinder` setting, the handler queues those waypoints rather than finding a route to the last one. The server validates individual steps against collision. The existing experiment writes the current tile first, followed by offsets, a tested shortcut rather than an implementation of the browser's routefinder.

## Collision-data access investigation

At the pinned engine `5522cd0cd82f` and web client `7d6ca61abda2`, the browser builds a local collision map from the current region's ground and location archives plus location definitions from the client configuration. Its version-list archive contains `map_index`, whose entries map a region to land and location file identifiers. The browser requests those files through its on-demand transport and applies later location updates to collision. Missing region data, level changes, and dynamic changes must not silently become walkable tiles.

The browser's on-demand worker opens an ordinary connection and sends handshake byte 15; subsequent requests include an archive, file number, and priority. A bounded probe against the owner's single running server received the expected eight handshake bytes. **Only the handshake was tested**: no map archive has yet been requested, decoded, or used to generate a path. The browser normally obtains the version-list and config archives through web endpoints; the sandbox could not reach that web port in the earlier network test. The existing saved CRC response does not contain those archives.

The sandbox could not reach the web port through its gateway alias, but can reach both game and web ports through the owner's LAN address. A direct ordinary HTTP fetch returned the 40-byte CRC response and both the configuration and version-list archives (HTTP 200). A fresh headless session also logged in using the same address and fetched its own CRC without a saved file. This corrects the earlier assumption that sandbox policy prevented web access; the cause of the gateway refusal is unknown. The server's on-demand worker maps archive numbers 0–3 to cache indexes 1–4, while the browser's version-list and configuration archives are served through HTTP from cache index 0. The on-demand handshake alone does not provide those bootstrap archives.

A disposable, read-only acquisition probe subsequently fetched the CRC response and both bootstrap archives from the ordinary HTTP endpoints. The configuration archive was 180,928 bytes and the version-list archive 33,496 bytes; both matched their advertised CRCs. The probe decompressed their Jag containers and used the version-list's map index to look up the single region containing the position reported by the headless client. It then requested that region's two files over the ordinary on-demand connection; both passed the version and CRC checks advertised in the version list and decompressed successfully (28,928 bytes of ground data and 8,437 bytes of location data). It did not read server-side collision or decode the entire world.

The one-off probe used Python's standard library for BZip2, CRC and gzip; it is not a production implementation or retained CLI. It initially encountered the sandbox's HTTP proxy and succeeded by explicitly connecting directly to the host.

A bounded experimental terrain decoder now consumes one decompressed 64-by-64 ground archive across four levels. Synthetic tests cover floor flag opcodes, explicit heights, overlays, link-below handling, and malformed inputs. A fresh read-only probe retrieved the current-region ground file through the normal on-demand protocol, verified its advertised version and CRC, and decoded all 16,384 tile records. The resulting ground-only block counts were 513, 0, 0, 0 by level. This is an observed decoder result, not an independent collision-map validation.

The experimental location decoder reads the browser's delta-encoded location IDs and positions, including object shape and rotation, without assigning names or collision semantics. Synthetic tests cover grouped IDs, multi-byte values and malformed inputs. In a fresh read-only acquisition, the current-region location archive passed its advertised version and CRC checks and decoded into 3,782 placement records referencing 179 distinct definition IDs; the record counts by level were 2,431, 756, 402 and 193. These are parser observations, not independently validated object identities or a map of the world.

A bounded definition decoder now reads only the indexed client location definitions referenced by the observed region. It extracts size, walk/range blocking and the browser's active flag, skipping names and interaction text; unknown opcodes and incomplete records fail rather than defaulting to open. A live read-only probe verified both HTTP bootstrap CRCs and the region archive's version and CRC, and decoded all 179 referenced definitions. Of those, 169 carried the walk-blocking flag and 115 were active. These are definition properties, not counts of blocked tiles or verified object names.

**Ground flags and definitions alone are not a walkability map.** The experiments below apply a subset of the browser's collision rules and compare calculated paths with client-observed movement. Missing regions, unknown data, dynamic location updates, region rebuilds, and integrity failures must remain unknown. Production-quality acquisition, collision coverage and updating remain open.

## Conservative calculated-route experiment

The initial prototype built a static, single-region grid from verified terrain, location placements and the referenced client definitions. It searched cardinal neighbors only, marked region edges unavailable, and over-blocked cells around walls rather than attempting full directional wall collision. Inactive ground decorations do not block. Missing definitions are errors. This is a deliberately conservative experiment: no route in this grid does not prove a destination is blocked in game, and unprocessed dynamic changes or neighboring-region objects can invalidate the snapshot.

Before running: for a fresh client, calculate a path from the observed start tile to a nearby destination two tiles east and two north, send the calculated steps as waypoints, and report `completed` only if subsequent client player updates reach that destination. Record the actual trace and preserve `unknown` on failure. This is a static-snapshot test, not proof of safe production navigation or of a route around an obstacle.

The live run fetched and validated current-region client assets, decoded referenced definitions, and calculated the relative waypoints (1,0), (2,0), (2,1), (2,2). The client observed those four positions in order and reported `completed`; no state-decoding or framing error was reported. Acquisition and execution used a disposable local script and are not yet a retained end-to-end client API.

During development, treating every ground decoration with a walk-blocking definition as blocking also marked the client's known start tile blocked. The browser additionally requires a ground decoration to be active, and after modeling that condition the control route was found. This illustrates why conservative approximation can cause false negatives; the owner's earlier reference destination still produced no route in this snapshot and remains `unknown`, not proven blocked. The snapshot also cannot guarantee safety: it does not model live location updates, objects extending into the region from neighbors, or all browser collision details. Do not use it as an authoritative walkability map.

## Directional-wall detour experiment

The prototype models cardinal edges for straight and L-shaped walls. Diagonal wall shapes do not block cardinal movements according to the browser's masks; diagonal movement is not searched. Synthetic tests check each straight-wall rotation in both directions and the two edges of an L wall. This remains a partial static single-region approximation, not a production collision map.

Before a live test: acquire and validate current-region assets through ordinary client interfaces, then search nearby for a target whose calculated cardinal route is longer than its Manhattan distance, indicating that the computed grid requires a detour. Bound the route to at most 12 steps. Send those steps to a fresh ordinary client. Success requires its subsequent position-update trace to match the planned route and reach the destination; a missing route or non-arrival remains `unknown`. This comparison does not prove the cause of an obstruction or the correctness of all collision rules.

The first live snapshot search found no qualifying destination within 24 steps; no movement request was sent. After checking the pinned browser's collision masks, the prototype was refined: diagonal corner walls affect diagonal movement but not cardinal movement, so cardinal-only search no longer blocks their neighboring cells. The same bounded search of fresh validated client assets then found three candidates within 12 steps; the shortest is four tiles west in Manhattan distance but requires six cardinal steps in the model.

The fresh client was sent the six calculated steps. Its position updates matched every waypoint in order, from (3094, 3106) through (3093, 3106), (3092, 3106), (3091, 3106), (3091, 3105), (3090, 3105), to (3090, 3106). It reported `completed`, with no state-decoding or framing errors. The path is a detour in the calculated collision grid; the experiment did not independently establish the obstacle's identity or prove that every alternative is impassable. It does not prove all collision or dynamic-update behavior is correct.

## Collision snapshot invalidation research

In the pinned browser, `LOC_ADD_CHANGE`, `LOC_DEL`, and `P_LOCMERGE` create location changes, while `UPDATE_ZONE_PARTIAL_ENCLOSED` carries zone operations inside one packet. `UPDATE_ZONE_FULL_FOLLOWS` can expire existing location changes for the zone. `REBUILD_NORMAL` changes the build area and triggers region loading. A reliable client must account for these while acquiring a snapshot and throughout its use, including changes arriving inside enclosed zone updates and locally scheduled transitions; a framing failure, disconnect, or unhandled relevant packet must invalidate its confidence. Merely re-fetching static map archives does not reconstruct the current dynamic scene.

The experimental `collision-freshness.mjs` guard can track packet continuity and invalidate capture tickets and committed snapshots conservatively. It refuses to commit unless the caller explicitly attests that the dynamic scene was reconciled, and it cannot itself verify that attestation, reconstruct changes, or schedule timed invalidations. It must receive every packet and timed transition in order. It is not yet connected to navigation or a scene reconciler; the live movement tests do not establish that the static scene was current.

The experimental zone observer now recognizes standalone zone packets and decodes location additions, replacements and removals both standalone and inside enclosed updates. It reports full-zone resets and timed player/location merges without pretending to apply them, and rejects malformed or unknown enclosed operations. Its build origin and level must come from current client observations and be refreshed on changes. In a 12-second fresh ordinary-client observation, it received 49 full-zone notifications with no decoding or framing errors; no location-add or location-delete event was observed, so those decoders have synthetic tests but no live verification yet. Scene reconciliation, timed changes, and integration with route planning remain open.

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
