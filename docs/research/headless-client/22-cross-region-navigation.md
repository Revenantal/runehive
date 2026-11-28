# Cross-region navigation experiment

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md) · [Previous movement experiments](21-cancelling-and-legs.md)

## Question and status

Can a route calculated from two adjacent client map regions be followed across their shared boundary? The previous experiment crossed a boundary on a known straight line, but did not calculate a route over both maps. One calculated straight route has now been followed in the shared world; a cross-boundary detour remains untested.

## Preconditions and limits

Use the existing ordinary-player session and shared server, with the owner-prepared disposable character. Obtain both regions' ground and location archives through ordinary client asset interfaces, validate them, and decode their referenced client definitions. Record the asset revisions and the observed starting position, not credentials. Missing or invalid assets, a missing definition, an unknown position or broken observations stop the attempt. Neither server state nor server-side collision data is an input.

The existing single-region grid deliberately blocks all boundary tiles. Simply joining two such grids cannot find a route; simply clearing their edges is unsafe. A placement in either region can extend across the seam, and walls can affect the shared edge. Outer boundaries must remain unknown, including any influence from unloaded neighboring regions. Dynamic scene changes and collision freshness remain separate, unresolved limitations: static archives alone cannot establish a current collision map.

An offline prototype, `tools/headless-experiment/cross-region.mjs`, models a south–north pair, including shared-edge walls and footprints crossing their seam. It blocks its outermost tiles, as the earlier single-region approximation does. **This does not account for footprints extending inward from unloaded surrounding regions**, so even its other tiles are not guaranteed safe. It is an exploratory snapshot, not a generally conservative or production collision map; more neighboring data or an independently justified bound is needed to resolve that limitation.

## Proposed controlled trial, defined before execution

1. Choose a short cardinal route across a shared boundary, with a start and end in the two loaded regions. Prefer the previously observed open column as a control, but first observe the character's actual position and verify applicable map data rather than assuming either is current.
2. Offline tests must cover an unobstructed seam, a wall on either side, a footprint extending across it, and missing neighboring data. A missing route is `unknown`, not evidence of an impassable destination.
3. Send a bounded movement request only after the planned route and expected endpoints are recorded. Observe position updates, scene rebuilds and observation failures. Stop rather than sending a follow-on request if the position or outcome becomes unknown.
4. Report `completed` only if a subsequent player update reaches the target. Preserve the actual observed trace and distinguish it from the planned route. Non-arrival, timeout, or observation loss remains `unknown`; a timeout does not cancel the walk.

A successful control demonstrates only that this particular calculated route was followed on this occasion. It does not validate general multi-region routing, dynamic obstacles, unseen map data, or the safety of executing generated scripts. A separate detour case would be required to demonstrate obstacle-aware planning across a seam.

## Offline observations

Synthetic tests cover an open seam in both directions, a wall on either side in both directions, a southern footprint extending across the seam, missing region or definition data, and an unavailable outermost boundary. These exercise the approximation, not the server.

A local calculation using the two previously acquired map directories and configuration decoded 243 referenced location definitions. From (3240, 3261) to (3240, 3281), the prototype returned 20 cardinal steps compressed to one straight waypoint. The asset files were not freshly acquired or revalidated for this run. No movement request was sent and no live result is claimed. The prior straight-line crossing in [21](21-cancelling-and-legs.md) is historical context, not verification of this calculation's current snapshot.

## Live observation

The existing shared `devserver` was used; no server was started or changed. Fresh client configuration and both map regions passed the retained acquisition scripts' advertised CRC and version checks. The disposable ordinary-player character was first observed at (3245, 3256), and reached the trial start (3240, 3261) on a separately calculated single-region approach. The trial used the pinned sources and client assets described in [12](12-routefinding.md); the Runehive baseline was `3bf39b077013` with the experimental changes in the working tree.

`demos/cross-region-probe.mjs` calculated a 20-tile cardinal path from (3240, 3261) to (3240, 3281), compressed it to one waypoint, and sent one plain walk. Subsequent player updates showed every tile in order, including (3240, 3263), (3240, 3264), and the target (3240, 3281). No scene rebuild or decoding failure was observed during this trial. Outcome: **completed**, based on observed arrival. This is a single straight control, not evidence of a detour or a general solution to the missing-neighbor and dynamic-scene limitations above.

For reproduction, fetch verified configuration and both region archives into separate empty directories with the retained `fetch-config-assets.py` and `fetch-map-assets.py` scripts. Supply their paths to `demos/cross-region-probe.mjs`, with `RUNEHIVE_EXPERIMENT_ACCOUNT` and `RUNEHIVE_EXPERIMENT_HOST` in its environment. The driver sends nothing unless the observed character is on the expected start tile, and stops after one request. Do not store or print the account value; do not start another server. Freshly acquired archives still do not reconstruct dynamic scene changes.
