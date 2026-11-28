# World objects and ground items: a tree, then logs

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Goal

Learn the general pattern of acting on a world object and recognizing the outcome, using a tree as the first example. Earlier experiments had a fast, one-step reply (a door opens, a dialogue page appears). Here the action is a **process**: the character walks to the object, performs an activity over several game ticks, and may or may not produce a result. The questions are about evidence:

1. Which observations separate "the request was accepted", "the activity is in progress", and "the outcome was achieved"?
2. Which of those can the client actually see (messages, inventory changes, skill updates, a change to the object), and which cannot (for example animations, which sit in extended update data we do not decode)?
3. How does the activity end, and how does a client tell a normal end from an interruption?

This is not a woodcutting guide. It must not assume how trees work, what a good tree is, or what the character needs, only record what is observed.

## Setup and starting facts

The owner-prepared disposable character, the shared server, and client configuration checked against the advertised checksums. From that configuration alone (no wiki, no preloaded rules): 47 location definitions offer a `Chop down` option, and the character's current region contains 52 placed locations of those types. The character carries a Bronze axe, and our definitions say it has a `Wield` option; we do not yet know whether chopping needs the axe worn, carried, or neither.

## Success defined before running

Pick a placed location whose definition offers a `Chop down` option, close to the character on the same level, and send that numbered option once for that location's coordinates and id. Observe a bounded period (60 seconds, or until a clear end). Record, with times, the client-visible evidence: game messages, inventory updates, skill updates, changes to that location, and the character's position.

- **Accepted:** the character moves toward the tree or a game message reacts. Evidence only, not success.
- **In progress:** repeated messages or skill/inventory updates that do not yet include a result.
- **Outcome achieved:** report `completed` only when a later update shows a **new item** in an inventory component that was not there before **and** a skill update for a related skill, or the location is replaced by a different one. Report each piece of evidence separately, since the outcome may not produce all of them.
- **Anything else** is `unknown`: no change, a timeout, an unfamiliar message, or an interruption. A timeout is not a failure of the tree.

If the character cannot chop with what it carries, a message may say so. Record it as observed text, and do not infer a rule from it. If the axe needs to be wielded, that is a second experiment step: wield it using the verified equip path, retry, and record the difference.

## Stage A observations

`tools/headless-experiment/demos/chop-tree.mjs` picks the tree whose neighbouring tile has the shortest route on the static map, sends `Chop down` once, and records a timeline.

- **A request from a distance was refused; from the adjacent tile it worked.** From 14 tiles away the server answered "I can't reach that!" within 0.6 seconds and the character did not move. A second tree only 4 tiles away was refused the same way. In both cases the driver then walked a route planned on our static grid to the tile beside the tree (the owner confirmed only a wall with a gap lay between the character and the first tree, with no closed door), and the same request was then accepted. The mechanism is explained below under "Why requests from a distance fail".
- **The axe did not need to be wielded.** "You swing your axe at the tree." appeared with the axe in the backpack.
- **Accepted and in progress are nearly invisible.** One message ("You swing your axe at the tree.") a second after the request, then nothing for about 11 seconds. We do not decode the animation, so the activity itself cannot be seen.
- **The outcome arrived as one burst.** At one moment: the message "You get some logs.", the tree's tile changing to a different object (named "Tree stump" in the definitions, "This tree has been cut down."), a backpack slot update adding Logs, and a skill update (skill 8, experience 0 to 25). The stage criteria were met with all three kinds of evidence. The activity ended when the tree was replaced, which was also the normal end.
- **Refusal is explicit.** The refusal was a game message, not silence, so a refused request can be told apart from a timeout. It is not a refusal to chop for ever: the same target was fine once close.
- **Our static route predicted the path correctly here**, although the refusal looked like blockage. Interpreting it as "no route" would have been wrong.

## Why requests from a distance fail (from the server source, confirmed by observation)

The server runs with `node.clientRoutefinder` on (its default). Players then use the **naive** move strategy: to reach a location the server queues a single step toward the object's own tile and walks straight at it, with no route-finding around walls or other obstacles. If that approach takes no step and has no waypoints, the server sends "I can't reach that!" and cancels the request. The real browser client avoids this by finding the route itself and sending it first, using the walk packet's **operation-click** variant (opcode 138), which the server documents as "always paired with a following op packet" and which, unlike a plain walk, does not cancel a pending interaction.

- **Observed, controlled:** a reach probe sent the chop request from 2, 4, 6, 9 and 12 tiles, going up then back down, with the character standing still for 2.5 seconds first. All eight were refused, so the refusal does not depend on order or on the character having just moved. (This probe's tiles were picked by shortest route, not by distance from one side, and the tree it used had no reachable neighbouring tiles on our static grid, so it shows the refusal pattern, not a clean distance threshold.) A follow-up with explicit tiles found no standing tile beside that tree at all, and refused at 3 tiles straight south, 5 tiles straight south and 3 tiles west.
- **Observed, decisive:** sending the planned route as an operation-click walk and then the chop request, from 13 tiles away with a 36-tile route, was **not refused**. The server walked the whole route (about 0.6 seconds per tile) and then began chopping. The 36-tile route compressed to 14 waypoints. The same request without a route was refused.
- **Packet limits (from the server decoder):** a walk packet carries at most 24 waypoints after its start tile, and each waypoint is a signed byte offset from the start (-128 to 127). Only the corners of a route need to be waypoints, because the server walks straight lines between them, so a long straight stretch is one waypoint. `compressRoute` in `tools/headless-experiment/navigation.mjs` does this for the cardinal routes our grid produces.
- **Measured afterwards in [21](21-cancelling-and-legs.md):** single legs of up to 57 tiles, a 24-waypoint route, and legs across a region boundary all completed. Still unmeasured: legs through something our map did not show, and planning across regions.
- **What this does not tell us:** whether any distance limit exists at all, since a route sent first removes the question. The earlier thought that the refusal showed a range limit (or an out-of-sight limit) is not what the evidence shows. The refusal showed that the server will not find the route for us.

## Stage B: drop what was produced. Success defined before running

Use the numbered `Drop` action from the item's action list (the client supplies it as option five when an item defines none). Observe the backpack slot empty and a ground item appear at or near the character's tile. Report `completed` only when both are observed after the request. Ground items arrive as zone updates; we frame those packets today but do not yet decode their contents, so this stage needs a decoder for ground item add, remove and count changes. Record whether the dropped item is visible to the client as the same item and count.

## Stage C: pick it back up. Success defined before running

Take the item from the ground with the ordinary ground-item option. The client supplies `Take` as ground option three when the item defines none; the definitions we have show no `Take`, so confirm in client behavior, not just data. Report `completed` only when the ground item disappears and the same item returns to a backpack slot. If the pickup does not complete before a deadline, report `unknown`.

## Stage D: light it. Success defined before running

Two client-visible routes exist: the `Light` option that the definitions give logs on the ground (option four), and using the tinderbox on the logs (an item-on-item packet and an item-on-ground-item packet exist in the protocol; we send neither yet). Try the ground option first. Report `completed` only when the ground item is removed and a world object appears at or next to its tile. Record every message. Treat the later burn-out of the fire as a separate observation, not an assumption. If the first route does not work, try the item-on-item route and compare, and record which route the evidence supports.

Dropped and lit objects change the shared world: a fire occupies a tile until it burns out. Use an open spot away from doors, and do not light more than one. Neither fire nor ground items should be left behind; a fire burns out on its own.

## Stage B, C and D observations

`demos/logs-sequence.mjs` runs the steps in one session, judging each on its own evidence and stopping at the first step it cannot confirm.

- **Drop:** the numbered `Drop` action (the client's option five) removed the Logs from the backpack and, 0.6 seconds later, a ground item for the same id and count appeared on the character's tile. Ground items arrive as zone updates, which we now decode (`OBJ_ADD`, `OBJ_DEL`, `OBJ_COUNT`, `OBJ_REVEAL`).
- **Pick up:** the ground action `Take`, which the client supplies as option three and the item definition does not list, removed the ground item 0.2 seconds after the request and returned the Logs to the backpack. This confirms the client default in behavior, not just in the source.
- **Light, route one (the ground `Light` option, option four):** "You attempt to light the logs." came 0.3 seconds after the request. 4.8 seconds later "The fire catches and the logs begin to burn." arrived at the same instant as the ground logs disappearing, an object named Fire (id 2732) appearing on the character's tile, and skill 11 gaining 40 experience. The character then stepped one tile aside.
- **Light, route two (using the tinderbox on the dropped logs):** the same evidence, with experience for the same skill going from 40 to 80. Both routes work. The tinderbox route sends "use inventory item on ground item" with the target first and the selected item second.
- **What the client can see:** the intermediate step ("you attempt") is a message, and the outcome is a burst of an object change, an item removal and an experience update. Between them there was nothing to observe.

## What this needs that we do not have

These were built: ground item decoding, game message text, ground-item options one to five, the two use-item packets, the operation-click walk, and route compression. Still missing: a script-level view of observations over time, separated into accepted, in progress and outcome achieved, and a measurement of the longest leg a single walk packet may carry.

## Not claimed

One tree, one session. The experiment does not establish success rates, tree respawn, other tree types, experience values, level requirements, or whether a better tree exists. It does not execute generated code.
