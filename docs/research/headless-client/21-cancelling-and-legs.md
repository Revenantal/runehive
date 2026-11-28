# Cancelling, long legs, region crossing and obstacles

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Why

[20](20-world-object-tree.md) showed that the client must send its own route before it interacts, and that the server does not route-find for players. Long-distance navigation depends on four things we have not measured, plus a catalogue of the refusals a script must be ready for. Each test below has its success rule written before it runs. The owner has told us a tree stump blocks walking and ashes do not; the client definitions say the Fire we make does not block. These are claims to test, not facts to build on.

## Test 1: cancelling. Success defined before running

The server source says a plain walk cancels a pending interaction and an operation-click walk does not. We have never watched either.

- **1a, mid-activity.** Send a chop request with its route. When "You swing your axe" appears, send a plain one-tile walk. Observe 25 seconds (an undisturbed chop gave logs 6 to 11 seconds after the swing message). Report `cancelled` only if the character moved as asked, no "You get some logs" message appeared, and the tree did not change. Absence over a window is weaker evidence than a positive observation, and the report must say so.
- **1b, mid-approach.** Send a route and a chop request toward a tree at least 12 tiles away. Three seconds later send a plain walk elsewhere. Observe 30 seconds. Report `cancelled` only if the character reaches the new tile and no swing or log message appears.
- **Control.** The undisturbed runs in 20 are the control: the swing message after arrival and logs 6 to 11 seconds later.

## Test 2: how long can one walk leg be? Success defined before running

On the straight, open column x=3240 (z 3261 to 3318, which crosses the region boundary at z=3264 and is open on both sides on the static map), send a plain walk with a single waypoint at 10, 20, 30, 40 and 57 tiles north of the start, walking back between trials with one waypoint. Report for each trial: `completed` if the observed position reaches the target within the tiles times 0.6 seconds plus 10 seconds; `partial` with the stopping tile if it stops short; `unknown` if there is no movement. Then send a staircase route of exactly 24 waypoints through an open area and report whether it reaches its final tile. Record the packet's accepted size from what the server did, not what we sent.

## Test 3: crossing a region boundary. Success defined before running

The same column crosses the boundary between two 64 by 64 map regions. For every trial that crosses it, record whether the server sent a scene rebuild, whether our position decoding stayed correct (the observed position matches the target) or became unknown, and whether the walk still completed. Missing or unknown position at any moment is `unknown`, never assumed. This does not test collision data across regions, only whether state tracking and movement survive the crossing.

## Test 4: obstacles that change. Success defined before running

- **Fire.** Make a fire on a tile (chop, drop, light), then walk straight over that tile before it burns out. Report whether the character passed through, was stopped beside it, or was refused. Record when and how the fire disappears (the events and the object that replaces it).
- **Stump.** Walk straight over the stump of a felled tree. Report the same three outcomes.
- **Ashes.** The owner says ashes do not block. After a fire burns out, walk over the tile once and report the result.

## Test 5: what the server says when it refuses. Success defined before running

Record the exact text, and the time after the request, for each case that is safe to produce: requesting a chop on a tree we know is already a stump (with the stale object id, as a client with an out-of-date scene would send); requesting a chop on an `Oak`, which may need a higher level; lighting logs on a tile that already has a fire; and any other refusal that appears while running the tests above. A refusal we cannot produce safely (a full backpack needs about sixteen more items) is listed as untested.

## Not claimed

Single samples on one character. No claim about walking speed across terrain, running, other levels, or collision beyond what the static map shows.

## Results

### Test 1: cancelling

`demos/cancel-probe.mjs` runs both cases against a real tree.

- **1a, mid-activity: cancelled.** A plain one-tile walk, sent 31 ms after "You swing your axe at the tree.", moved the character as asked. Over the next 25 seconds there was no "You get some logs." message and no change to the tree. Undisturbed chops produced logs 6 to 11 seconds after the swing message, so the window is more than twice the longest control.
- **1b, mid-approach: cancelled.** A route and chop request toward a tree 22 tiles away were sent. Three seconds later, with the character at (3230, 3231), a plain walk moved it one tile as asked. Over 30 seconds there was no swing message, no logs and no tree change.
- **Limits.** Both are evidence by absence over a window, not a positive "stopped" signal; the server sends nothing when it cancels. Only the plain walk was tested as the canceller. The server source says the operation-click walk does not cancel, but we did not observe that. A cancel command for scripts is therefore "send a plain walk", and a script must still treat the cancelled state as `unknown` until it sees no continuation.

### Test 2: long legs

`demos/leg-probe.mjs` sends single-waypoint plain walks along the open column x=3240, north and back.

| Leg | Result | Time |
|---|---|---|
| 10, 20, 30, 40 tiles | completed, both directions | about 0.6 seconds per tile |
| 57 tiles (the whole open column) | completed, both directions | 34.4 and 34.6 seconds |
| 55-tile planned route, 13 waypoints | completed | 33.7 seconds |
| 36-tile planned route, 14 waypoints (in 20) | completed | 23 seconds to the tree |
| 24 waypoints of one tile each (staircase) | completed | 14.6 seconds |

- **No leg limit was found up to 57 tiles**, the longest open straight line available. A single waypoint can reach 127 tiles by the packet format, so the real ceiling is untested, and so are legs through unseen obstacles beyond the plan.
- **The 24-waypoint maximum holds.** The server accepted all 24. By the server decoder a 25th would be dropped; we did not send one.
- **A blocked straight leg stops silently.** A single-waypoint walk west along row 3314 stopped at (3246, 3314), two tiles short, because something lay in the way. No message came. The only signal was the observed position.
- **Walking speed was steady** at about 0.6 seconds per tile on open ground.

### Test 3: crossing a region boundary

- **The boundary itself caused nothing visible.** The column crosses between two map regions at z=3264, and legs through it completed.
- **A scene rebuild happens later, when the character gets far from the loaded area's centre.** Going north it came at (3240, 3303), moving the area base from z=3216 to z=3256; coming back it came at (3240, 3272), moving it back. Every 57-tile leg had exactly one rebuild, and shorter legs had none.
- **Bug found and fixed: our state tracker lost the position after a rebuild.** The first run's position became unknown at the first rebuild and never came back. The browser client shifts every entity's coordinates when it rebuilds, so the player's absolute position is kept, and the server then sends only relative movement. The tracker now keeps a known position across a rebuild (a teleport still replaces it), with a test. With the fix, ten legs and two rebuilds produced zero unknown positions.
- **Not tested here:** collision data for a second region. The static map covers one region at a time. For this test two regions' maps were fetched separately, and no code plans across them.

### Test 4: obstacles that change

- **A fire does not block walking.** The character walked straight across a burning fire's tile (3239 to 3241 on the same row), as the client definition said (`blockwalk` false).
- **A fire burns out in about 68 seconds and leaves a ground item.** The fire was removed 67.8 seconds after it was lit, with no replacement object. Six tenths of a second later a ground item named Ashes (id 592, no options) appeared on the tile and stayed about two minutes before disappearing.
- **Ashes do not block.** The second crossing after the fire was removed completed. (As a ground item, they could not block.)
- **A stump blocks.** After a tree was felled, a walk straight across the stump's tile did not move the character at all, and gave no message. The stump (2x2) and the fire were both predicted correctly by their definitions' walk-blocking flag.
- **Messages name the skills.** "Congratulations, you just advanced a woodcutting level." and "...a fire making level." identify skills 8 and 11.

### Test 5: what the server says when it refuses

| Case | Server response | When |
|---|---|---|
| Chop request with no route sent, from a distance | "I can't reach that!" | at once (about 0.6 seconds) |
| Chop request on a felled tree, using the tree's old id | nothing: no message, no movement | |
| Plain walk into a stump | nothing | |
| Chop an oak at too low a level | "You need a Woodcutting level of 15 to chop down this tree." | on arrival at the oak, not at the request |
| Light logs on a tile that already has a fire | "You can't light a fire here." | about 0.6 seconds |
| Level gained | "Congratulations, you just advanced a ... level." | with the outcome |

- **Silence is a real answer.** Two of the five refusals produce no message. A script cannot wait for an error; it must treat no change within a bounded time as `unknown` and check state.
- **The timing differs by cause.** An approach problem refuses at once, while a requirement is only checked once the character has arrived, so a message can come many seconds after the request.
- **Not produced:** a full backpack needs about sixteen more items.

## Open from this experiment

Legs beyond 57 tiles and routes through obstacles our map does not show; collision data across regions in one plan; observing the operation-click walk's non-cancelling behaviour; the full-backpack message; and what a script should do when it receives silence.
