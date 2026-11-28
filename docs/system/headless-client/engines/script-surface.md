# Script surface and capability host

[Client blueprint](../README.md) · [Agent-facing documentation](../concepts/agent-documentation.md) · [End-to-end examples](../examples/plans.md)

**Status: proposed, not a safe runtime or implemented API.** The intent is for the agent to describe decisions and actions, not write generic lookup, slot, route or packet code. A host supplies a small capability set to a ready client session; credentials, raw sockets, filesystem, process control and server administration are not script capabilities.

## Candidate capabilities

| Capability | Illustrative calls | Client responsibilities |
|---|---|---|
| Inventory | `inventory.find(name)`, `.has(name)`, `.count(name)`, `.full()`, `.freeSlots()`, `.slot(number)`, `.options(item)`, `.equip(name)`, `.interact(item, optionSlot)`, `.use(item, target)` | Search current observed inventory, count item quantities and free slots, inspect a slot, expose numbered client options, and revalidate before action |
| Equipment | `equipment.has(name)`; later removal | Query current equipment, not assumed player capabilities |
| Skills | `state.skills()`, `skills.get(nameOrId)` | Inspect known experience and current/base levels with explicit freshness and unknown fields |
| Player resources | `player.getRemainingHp()`, `.getMaxHp()`, `.getRemainingPrayer()`, `.getMaxPrayer()`, `.getRunEnergy()` | Read observed or verified-derived current and maximum values; unavailable values remain unknown |
| Run mode | `player.isRunEnabled()`, `player.setRunEnabled(enabled)` | Inspect or request an explicit run setting; verify state and never blindly toggle |
| Nearby targets | `nearby.find(name)`, `nearby.findInArea(name, area)`, `nearby.findAt(name, tile)` | Find an observed target nearby, within a specified area or at a specific tile; disambiguate and revalidate |
| Dialogue and UI | `dialogue.continue()`, `.choose(text)`; interface inspection | Surface current controls and text; select only supported, observed controls |
| Movement | `moveTo(tile)`, `navigateTo(destination)`, `exploreTo(destination)` | Plan and verify movement; routine navigation is compact, exploration provides richer travel observations |
| Generic exploration | inspect target; select its observed numbered option | Provide a fallback for unusual client-visible actions without a hardcoded helper per mechanic |

These are design sketches. A named helper is not evidence that the game supports a given action; options still come from current client-visible data. `find`/`has`/`count` can return absence only for a current known scope. Unknown or stale input must propagate as `unknown`. Duplicate matches must not be guessed when identity matters. The agreed direction keeps `nearby.find(name)` for the simple case, adds `nearby.findInArea(name, area)` for a bounded area, and `nearby.findAt(name, tile)` for a specific tile; the caller then interacts with the returned target. The area can be a distance around an anchor or a rectangle defined by two corners. Other shapes are a possible extension, not yet designed. A direct `interact.at(...)` shortcut is not chosen because multiple targets can occupy one tile. The API must define the distance metric, floor, selection and ties, coverage and what happens when the target moves or disappears. A target-area restriction does not automatically restrict the travel path; a separate travel constraint is needed if the agent intends both. The generic option path is essential for discovery across items, NPCs, ground objects, doors and interfaces.

## Planned flow and unexpected outcomes

Normal actions should let a script read like a sequence of planned actions. The host stops the script with a structured outcome if an action is refused, becomes unknown, prerequisites are unavailable or it cannot safely proceed; the future AI/runtime reviews that evidence and can revise the plan. The client does not automatically try another action. A script-level escape hatch for handling unexpected action results is not part of the agreed design; any future proposal requires owner review. Define exact API names, result typing and safety criteria before implementation.

```js
await inventory.equip(task.itemName);
await navigateTo(task.destination);
```

This is an example of intended ergonomics, not runnable code or a guarantee that navigation and equipping are implemented. A proposed `exploreTo(destination)` uses the same navigation machinery with richer observation reporting; neither mode suppresses safety-relevant state updates. Inventory slot numbers in the proposed surface are one-based; they are distinct from the one-based **option slot** supplied to `inventory.interact`. `inventory.slot(4)` reports the observed contents or a known empty slot, while `inventory.count('Logs')` sums quantities across matching stacks and individual slots. `inventory.freeSlots()` requires known capacity and a current complete inventory snapshot; correctly applied partial updates can maintain that snapshot. Stale or incomplete data returns `unknown`, not zero or a guessed empty slot. A generic item example is `await inventory.interact(item, 4)` only after option 4 was actually observed for that item. Revalidate at execution; the slot number is not a universal mechanic.

## Execution boundary

The LLM is future runtime work, not a dependency of the deterministic client. No generated script may run until a separately reviewed isolation boundary exists. Type checking or Node's `vm` alone is not established as a security boundary. Define capability injection, resource/time/action limits, cancellation, output/schema validation, no ambient access, process isolation, untrusted game text handling, and lifecycle/cleanup; test escape and resource-exhaustion cases. The host must independently enforce the same gates for interactive tools and scripts.

Every exposed method needs concise code-level documentation and an LLM-facing Markdown contract with inputs, outputs, examples, errors, freshness, ambiguity and evidence criteria. Version and test those documents against the exposed capabilities; how to select relevant context remains an open runtime design. No model calls or provider choice are authorized by this outline.
