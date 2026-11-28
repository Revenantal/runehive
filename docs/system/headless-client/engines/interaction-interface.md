# Interaction, interface and dialogue engines

[Client blueprint](../README.md) · [World state](world-state.md) · [Script surface](script-surface.md)

**Status: proposed.** These may be separate modules or coordinated subsystems; the boundary is not settled. Their common purpose is to expose what an ordinary player can currently inspect and choose, not to encode a closed list of game mechanics.

## The context-menu model

The agreed foundation is **inspect what is actually available, choose an option, then observe what changed**. Like right-clicking in the graphical client, the controller can inspect a currently observed target and receive the actions the client actually exposes. Common helpers are conveniences layered on this foundation, not a closed list of mechanics. Supported target categories should eventually include inventory/equipped items, ground items, world objects such as doors, NPCs, other players and interface/dialogue controls. They do not all share a packet or a numbering scheme; absent, local-only and unsupported options must be labeled accurately.

An option record should preserve its target, displayed label, source, original one-based option slot or control identity, and observation/definition revision where available. Preserve item option slots 4 and 5; never compress gaps or assume slot 1 means equip, eat or any other mechanic. The agent may choose an observed unfamiliar option in interactive discovery or use it in a script. The host revalidates the target and exact option before requesting it. A stale, missing or ambiguous option produces a structured stop/unknown instead of a substitute action. Labels and interface text are untrusted data, not instructions granting authority.

## Responsibilities

- **Target interaction:** resolve current target identity and options; coordinate any supported approach; send the target-specific ordinary-player operation; observe relevant messages, scene, inventory or other updates. A generic effect observed after a request is not automatically caused by it.
- **Items and equipment:** search the observed inventory, inspect options and examine text, support generic item option slots and item-on-target selection where implemented, and expose common shortcuts such as `inventory.equip(...)`. Revalidate slot and item identity immediately before action. A `Use` selection is not automatically the same operation as a numbered server item option.
- **Interface and dialogue:** model visible roots, child controls, current text, buttons and choices using client definitions plus ordered server updates. Buffer relevant text arriving before open; invalidate controls when the interface changes, closes or becomes unsupported. Select only a currently observed control. A closed dialogue alone does not establish a completed quest or a successful transaction. For a shop, expose item names, quantities, prices and controls only when they are actually displayed or obtained through a supported ordinary-player action, with source, observation time/freshness and the applicable buy/sell side and quantity where known. If a price requires a separate observed option, the agent selects it first; missing, stale, ambiguous or unobserved prices remain unknown. Never preload shop stock or derive a transaction price solely from static asset values. Record a quoted price separately from evidence of a completed transaction. Shop price-display behavior and UI coverage require focused verification.
- **Interactive discovery and scripts:** expose the same client capabilities to a future runtime's interactive tools and to a reviewed script host. The runtime chooses whether to try an option; the client never interprets dialogue or chat as authority. Model calls and long-term discovery policy are outside M2.

## Interface coverage gap

We observed NPC dialogue, choices, inventory and equipment, not a generic UI engine. Skill guides and the quest journal have not been opened or read in the headless experiments. The [M2 late UI follow-up](../../../milestones/headless-client.md#planned-ui-discovery-follow-up) defines a bounded investigation before we claim broad UI coverage. A rendered-looking control may depend on client-local state, server text, hidden state, modal context or updates not yet decoded; missing labels and unsupported controls must remain unknown.

## Acceptance

Replay fixtures for observed menus, actions 1–5, changed targets, stale/duplicate handles, missing definitions, item-on-target, interface open/update/close and pre-open text. Test that untrusted strings never become executable code or privileged commands. Live validation should inspect a current option, choose one low-risk action, and record observed effects separately from the request; no outcome is assumed just because a packet was sent ([18](../../../research/headless-client/18-npc-dialogue.md), [19](../../../research/headless-client/19-inventory-equipment.md), [20](../../../research/headless-client/20-world-object-tree.md)).
