# Reconnect and dynamic scene follow-up

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Disconnect during movement: criterion before running

Use the shared vanilla world and the owner-prepared ordinary character. On the previously observed open column x=3240, start at (3240, 3261), request one walk to (3240, 3281), and abruptly disconnect only after a subsequent position update shows movement. A later position is not known during the disconnect. Reconnect the same account with bounded retries, recording rejected attempts without attributing a cause; stop on transport errors, unsupported observations, or the retry limit. Record the first reconstructed position, region, inventory and other observable fields separately from prior state. `completed` is warranted only if a later observation reaches the destination; a different position, failed reconnect, timeout or missing data leaves the original walk's outcome `unknown`. Comparing the disconnect position and the reconstructed position may show progress while disconnected, but cannot establish the exact timing or whether movement has stopped. Never send a follow-on action on an unknown original outcome.

The test does not use server logs, database state, or server modifications. The starting position and route must be observed or validated, not assumed.

## Disconnect result

The character started at (3240, 3261) on level 0. A 20-tile northbound walk was requested, and the connection was destroyed after a player update placed it at (3240, 3262). Reconnect attempts at approximately 11 and 21 seconds were rejected; the attempt at 32 seconds was accepted. A new, independent tracker subsequently observed the target (3240, 3281), satisfying the arrival criterion. The pre-disconnect and fresh-session summaries each contained a region, position, energy 100, updates for 21 skills, and full inventory updates for components 1688 and 3214. Component updates were counted, not compared slot by slot. Their presence does not establish that all interface or dynamic scene state was reconstructed.

The position advanced between the last pre-disconnect observation and the later fresh-session observation. Because the character was unobserved during the gap and the reconstructed summary was sampled after reconnect, this does not establish exactly when the remaining movement occurred or prove general disconnect semantics. The driver sent no follow-on walk. The later session requested logout. Reproduction: `demos/reconnect-walk.mjs`, with the ordinary account and host in the documented environment variables and the character observed at the specified starting tile.

## Dynamic scene follow-up: criterion before running

Select a routed tree from verified client assets. The swing message provides evidence that a tree interaction actually began, not that every tile of the initial static scene is current. After a location replacement at that exact tile is observed, apply that one replacement to the static placements and rebuild collision from its client definition. If the resulting target tile is predicted blocked and the observed player is cardinally adjacent, request a single step onto that tile; report the prediction and the observed position separately. A stopped step is evidence consistent with blocking, not proof of its cause; a timeout alone is `unknown`.

This is a deliberately narrow reconciliation of one location, not a general scene tracker. Any later relevant zone reset, location change, rebuild, observation failure, mismatched shape or missing definition prevents the collision comparison. A static archive alone is not evidence of the current scene. A refresh or rebuild must be tested separately: if reconstruction requires a general scene tracker, stop and record the gap rather than pretending the prior single-location projection survived it.

## Dynamic scene result and remaining blocker

With `demos/chop-tree.mjs` in `opclick reconcile-stump` mode, the character observed a swing at the targeted tree at (3246, 3259), then a location replacement at that tile from the tree to location 1342, shape 10, rotation 2. The driver substituted that observed replacement for the matching static placement, loaded its definition and rebuilt the experimental collision grid. The resulting target tile was predicted blocked. From the observed adjacent tile (3245, 3259), the driver requested one step onto the target; six seconds later it remained at (3245, 3259). The attempted movement outcome remains **unknown**: this observation is consistent with the prediction but does not establish why arrival did not occur. No relevant zone reset or rebuild was observed between the replacement and the request.

A separate read-only login after the session observed one initial rebuild and 49 full-zone reset notifications, including one for the zone containing the target; the character was observed at (3245, 3259) and no decode failure was reported. This confirms that the refresh notifications were seen, **not** that the previous projected snapshot was reconstructed or remained valid. The retained `demos/zone-refresh-probe.mjs` repeats the same bounded observation on ground level.

The experiment only projects one event onto a static baseline; it cannot account for prior unseen changes, full-zone reset semantics, timed changes, or other location layers. The existing freshness guard invalidates on relevant packets but does not rebuild a dynamic scene. A general reconciliation mechanism and validation of reconstruction across refresh or rebuild remain open; proceeding as if the projected snapshot remained valid would be unsafe. The unknown movement request was not followed by another movement request in that session.
