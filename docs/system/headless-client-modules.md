# Headless client modules

[Project overview](../../README.md) · [LostCity and the Headless Client](lostcity-and-headless-client.md) · Built in: <!-- built-in -->[M2](../milestones/headless-client.md)<!-- /built-in -->

**Status: concept, not a specification.** This describes the intended shape of the durable headless client so humans and agents share one vocabulary. Method names are illustrative. Boundaries are examples, not strict limits, and will be settled when the client is formally planned. The experimental code in `tools/headless-experiment/` does not follow this layout. The proposed [engine blueprint](headless-client/README.md) adds UML-style diagrams and script examples; [end-to-end scenarios](headless-client/examples/plans.md) show how the pieces might work together.

## Two audiences

| Reader | Needs | Sees |
|---|---|---|
| **Script author** (an LLM writing a short script) | What it can ask the game to do | Only the [script surface](#the-script-surface): `moveTo`, `navigateTo`, state questions, interactions |
| **Client developer** (a human or coding agent) | How the pieces fit | Every module below |

A script author never needs to know about sessions, packets, collision data or the fleet. Keeping that true is the main purpose of this structure.

## Layers

The list shows a conceptual stack, not a settled call graph. Requests generally flow from the script surface toward protocol; decoded observations flow back toward state and the script. Navigation and interaction must coordinate through the action coordinator rather than issuing overlapping actions.

```text
Script surface      what a script can use (moveTo, navigateTo, state, interact)
Navigation          get from A to B
Interaction         act on doors, ladders, NPCs, objects, items, dialogue
World state         what is known about the character and its surroundings
Session             login, keepalive, reconnect, logout
Protocol            bytes, packet framing, encoding, decoding
```

An **action coordinator** sits beside Navigation and Interaction. It makes sure only one action runs at a time and owns cancellation and the rule for when the next action may start. See [Actions and outcomes](#actions-and-outcomes).

## Layout and naming

The agreed starting direction is a flat layout under the package source directory. These paths are a plan, not existing modules; create them when their first implemented slice needs them:

```text
packages/headless-client/
  README.md
  src/
    index.ts        Public API exports
    session/        Connection and session lifecycle
    protocol/       Packet framing, encoding and decoding
    state/          Observed player, world and interfaces
    actions/        Action coordination and supported interactions
    navigation/     Movement and route planning
    api/            Developer- and script-facing helpers
  docs/             Documentation for implemented APIs only
  tests/            Package unit tests, subject to test discovery
```

The coordinator and interaction responsibilities described below live under `actions/`, not separate top-level packages. The `api/` layer delegates to shared observed state and coordinated actions rather than maintaining its own copy. Credentials and process lifecycle remain with the supervisor; goal selection and AI decisions remain outside this package.

The durable client code and its implemented usage documentation belong under `packages/headless-client/`; its package API reference and detailed per-method developer docs will be built under the package's `docs/` alongside implemented methods. Planned methods are not listed as available in package documentation. The [proposed API overview](headless-client/api-plan.md), broader project design and research remain in the root `docs/` tree. Package-level unit tests belong with the package code under repository testing standards; cross-package integration and live gameplay tests remain in their designated root test areas. The precise placement and discovery of package tests must be confirmed as implementation is planned.

Folders use plain names. The word "engine" is already used by LostCity's server (`lostcity/engine`), so do not assume an `...Engine` suffix on class names. Exact class names and deeper subpaths remain open.

## Modules

### Session

**Owns:** one client's connection to the game server: connecting, login, keepalive, logout, reconnect and the transport underneath.

**Illustrative methods:** `login()`, `logout()`, `isReady()`, `onDisconnect(handler)`.

**Does not:** decide what the character does, or accept credentials from scripts.

Scripts do not use this module. A script runs inside a session that is already ready.

### World state

**Owns:** what the client has observed about the character and what is around it: position, level, skills, energy, inventory and equipment, nearby NPCs, objects, and open interfaces. It also owns how confident the client is in each observation.

**Illustrative methods:** `position()`, `objectAt(tile)`, `nearestNpc(filter)`, `inventory()`, `skill(name)`.

**Every answer says how much to trust it.** The client often does not know. A door's state comes from observed changes. A map snapshot can go stale. So a question returns one of three kinds of answer, never a bare true or false:

| Answer | Meaning |
|---|---|
| `known` | Observed, with a value and when it was observed |
| `stale` | Was observed, but something since then may have changed it |
| `unknown` | Never observed, or lost |

For example, "is this door open?" can be `known` open, `stale`, or `unknown`. A script must handle the non-`known` cases. Missing or stale data is never treated as walkable, open, or safe.

This module stores observations. Whether something is an "enemy", "edible" or "valuable" is a game fact the agent discovers through play, not something the client hard-codes.

### Interaction

**Owns:** acting on things in the world and observing what happened: opening doors, climbing ladders, talking to NPCs, using objects and items, equipping, dialogue.

**Illustrative methods:** `open(door)`, `climb(ladder, direction)`, `talkTo(npc)`, `use(object, option)`, `equip(item)`.

**Does not:** plan routes. It reports what it observed afterwards, not what it hoped for.

**Options are data.** Every item, NPC and object reports its options as numbered labels taken from the client definitions, plus where each came from, because labels vary (`Talk-to`, `Talk to`, `Talk`) and an agent will meet options it has not seen. Examining something is a local lookup that returns the definition's text, with no server request ([19](../research/headless-client/19-inventory-equipment.md)).

Inventory, equipment and dialogue may become separate modules. Observed inventories are sparse and slot positions shift, so state should expose items by what they are, with the current slot reported by the latest update ([19](../research/headless-client/19-inventory-equipment.md)). Dialogue is the strongest candidate: quests and conversations are driven by choice menus, so the open dialogue (speaker, text, and either a continue or a list of choices) is likely its own state, with `continue()` and `choose(n)` actions ([18](../research/headless-client/18-npc-dialogue.md)).

### Approach before acting

A distant tree request was refused with "I can't reach that!" in the tested case; a client-planned operation-click route followed by the interaction succeeded in a separate case ([20](../research/headless-client/20-world-object-tree.md)). This supports planning and sending an approach before some interactions, not a universal rule about the server's routing or proof that a refused target is unreachable. Where the approach lives (inside an interaction call, or in the script) remains open. The experiment's packet format supports up to 24 relative waypoints; practical reach and routing limits are not generally established.

### What navigation has been shown to need

From [21](../research/headless-client/21-cancelling-and-legs.md): a route is sent as corner points (one straight leg is one waypoint), at most 24 per packet, and legs up to 57 tiles were accepted at about 0.6 seconds per tile; position is read back from the server, since a blocked leg stops silently; a plain walk cancels an interaction in progress and is the way to stop one; a scene rebuild moves the loaded area without moving the player, so the tracker must keep absolute positions across it; and a refusal can be a message, or silence. Obstacles that change matter: a stump blocks, a fire and ashes do not, and the client definition's walking flag predicted both.

### Navigation

**Owns:** moving the character.

| Method | Behavior |
|---|---|
| `moveTo(tile)` | The simple one. Walks a bounded route over the known map. Does not open doors or climb. Returns an observed outcome. |
| `navigateTo(tile)` | The smart one. Plans across doors, ladders, levels and regions by using Interaction. May take several actions. |

Even `moveTo` confirms arrival before reporting it. It does not merely send a request.

### Action coordinator

**Owns:** one action at a time, cancellation, and when it is safe to issue the next action.

**Why it exists:** observed behavior showed that a timeout, or logging out, does **not** cancel a walk the server has already accepted ([16](../research/headless-client/16-move-a-to-b.md), [17](../research/headless-client/17-multi-action-session.md)). Stopping to wait is not stopping the character. Navigation and Interaction both need this, so it is a separate piece.

## The script surface

A script is a short body with supplied capabilities and nothing else. It has no imports, login, host settings, packet handling or logging. The following is illustrative, not an implemented API:

```js
const start = state.position();
if (start.status !== 'known') return { status: 'unknown', reason: 'position-unknown' };

const result = await navigateTo(task.destination);
if (result.status !== 'completed') return result;
return moveTo(start.value);
```

The script author learns only: state questions, `moveTo`, `navigateTo`, and interactions. Everything below is hidden. The exact surface is decided in formal planning. How generated scripts are isolated and limited is a separate design that needs its own review; see [16](../research/headless-client/16-move-a-to-b.md#observations-and-open-concerns).

### Actions and outcomes

Every action returns an outcome that separates what was asked from what was observed:

| Outcome | Meaning |
|---|---|
| `completed` | The expected change was **observed** |
| `unknown` | Not confirmed: a timeout, interrupted observation, stale data, or unsupported situation, with a `reason` |

A timeout is `unknown`, not blocked. `unknown` also does not mean the action stopped. A script that gets `unknown` should stop or re-observe, not carry on as if it succeeded. A confirmed refusal or failure outcome may be added once we have observed real ones.

## Fleet and sessions

There are many characters, each in its own client process. The fleet supervisor is a separate, host-level system, not a module in this list:

- It owns credentials and configuration, and starts one client process per character.
- It spaces logins to respect the server's throttle, and uses a distinct device id for each client ([decision 0009](../decisions/0009-distinct-device-ids-per-client.md)).
- It watches client health and stops or restarts clients.
- Each client process creates its own Session module and logs in with what the supervisor provided.
- It starts scripts inside a ready client. Scripts never see credentials.

Experiments: [06](../research/headless-client/06-multiple-clients.md), [09](../research/headless-client/09-supervisor.md), [10](../research/headless-client/10-child-processes.md).

## Rules that apply to every module

- **Ordinary player only.** Everything goes through the game protocol like any player. No teleporting, item grants or state edits. Never modify the LostCity server.
- **No preloaded game knowledge.** Maps and labeled points of interest are fine. Shop stock, quest requirements and mechanics are discovered in play.
- **Keep apart** what was requested, what was observed, what is believed and what is verified. Missing, stale or invalid data is `unknown`, never assumed safe.
- **The real game is the ground truth.** The static map is a baseline, not the current scene.

## Where the experiments point

| Module | Experimental evidence |
|---|---|
| Session | [03](../research/headless-client/03-login.md), [04](../research/headless-client/04-session-maintenance.md), [05](../research/headless-client/05-logout.md) |
| World state | [07](../research/headless-client/07-visibility.md), [11](../research/headless-client/11-initial-state.md), [13](../research/headless-client/13-tutorial-npcs.md) |
| Navigation | [12](../research/headless-client/12-routefinding.md), [16](../research/headless-client/16-move-a-to-b.md) |
| Interaction | [15](../research/headless-client/15-main-world-interactions.md) |
| Coordinator | [16](../research/headless-client/16-move-a-to-b.md), [17](../research/headless-client/17-multi-action-session.md) |

## Open questions

- Whether inventory, equipment and dialogue are part of Interaction or modules of their own.
- How freshness of the collision snapshot and observed locations reaches Navigation.
- The exact script surface and the shape of `unknown` reasons.
- Whether a failure outcome beyond `completed` and `unknown` is needed, and what evidence would justify it.
- Class naming and the exact package layout.
- How scripts are isolated and limited. This is a separate reviewed design.
