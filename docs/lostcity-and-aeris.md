# LostCity and Aeris

[Project overview](../README.md)

## LostCity integration: external by default

### Primary approach: ordinary headless client

- Run **stock LostCity** using compatible, pinned Revision 274 engine/content/client components.
- Build our **own TypeScript headless game client** outside upstream.
- Implement the minimum necessary network/protocol subset: login, session maintenance, incoming game state, movement, inventory/skills, scene/entity information, game messages, interfaces, actions.
- Read necessary game cache/map metadata to support navigation and visible map information.
- Connect to the server like any other player. The AI platform must not modify the player's skills/items/position directly.

**Why:** Strong separation, realistic player semantics, learning value, no need for a permanently maintained game-server fork.

**Highest integration risk:** Protocol/session correctness, world-state updates, collisions and pathfinding, UI-based interactions (shops/dialogue/quests), reconnect handling, and multi-client reliability. A fully functional graphical client does **not** imply an existing headless API.

### Contingencies

1. Investigate the stock TypeScript client as a protocol and cache reference.
2. Build a minimal headless proof of concept before designing a broad API.
3. If a protocol client becomes prohibitively expensive, investigate an **external wrapper around client logic** or a **narrow server-side bridge** that enforces ordinary gameplay rules.
4. Only consider a small maintained patch set/fork if a demonstrated requirement cannot be met externally. Do not fork preemptively.

Existing RS-SDK/LostCity-derived projects may serve as learning references; do not assume drop-in revision 274 compatibility or copy their privileged enhancements into our gameplay contract.

## Starting knowledge: navigation, not mechanics

The bot starts without a preloaded RuneScape strategy/wiki/gameplay database. **However, the map is not intentionally hidden.**

| Information | Proposed starting access | Reason |
|---|---|---|
| Terrain, collision, walkable paths | Yes, as provided by client/cache | Basic navigation |
| Cities and named regions | Yes, if exposed by historical map | Orientation |
| Labeled points of interest, e.g. sword shop | Yes, if exposed by historical map | Productive exploration |
| Nearby NPCs, objects, and visible options | When observed in-game | Normal player perception |
| Shop inventory, prices, NPC services | **No preloaded facts**; discover by interaction | Experiential knowledge |
| Quest requirements/rewards | Learn through journal, dialogue, gameplay | Experiential knowledge |
| Equipment restrictions/training methods | Learn through experiments and feedback | Experiential knowledge |
| Prior agents' discoveries | Yes, from shared memory | Collaborative learning |

**Boundary:** Do not silently provide global hidden NPC/shop/item information under the label of "map data." Audit what historical map, cache, and ordinary client actually expose. If later we intentionally offer extra navigation information, label it as such and measure how it changes the learning experiment.

### Exploration is a legitimate activity

Example: "Find a better sword."

1. The Approach layer uses known city/shop labels to choose Varrock.
2. The Execution layer navigates there using real paths.
3. Bot investigates a nearby shopkeeper and opens a shop interface.
4. Event recorder saves observed inventory and prices.
5. Memory consolidation records useful facts and possibly a reusable purchasing method.
6. A second bot can retrieve the discovery and attempt the same purchase; availability and price are rechecked live.

Exploration policy can balance **relevance, novelty, expected information gain, travel cost, and danger**. We are exploring game *mechanics and opportunities*, not deliberately withholding ordinary cartographic information.
