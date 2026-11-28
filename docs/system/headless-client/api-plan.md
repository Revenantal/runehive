# Headless client proposed API at a glance

[Client blueprint](README.md) · [Script surface details](engines/script-surface.md) · [Examples](examples/plans.md)

**Planning document: these methods are proposals, not an implemented API reference.** Names and signatures can change. Examples are illustrative, not game facts. Maintain this sheet as a grouped view of proposed capabilities under review. As each method is implemented and verified, document it in the package's implemented API overview and detailed developer documentation; link to those implemented docs from this plan where useful. Package documentation must not list unfinished methods as available. A future AI should receive only a version matching the capabilities actually available.

Scripts use ready-to-use capabilities: no imports, login, credentials, packets or logging. On refusal, uncertainty or another unexpected outcome, the proposed host stops the script and reports evidence to the future AI/runtime for review rather than assuming success or automatically retrying. Stale or unknown observations do not become `false`, `0` or `null`. All actions are ordinary-player actions; the client does not decide game strategy or preload mechanics.

## API overview

Methods are grouped by capability area; these headings describe the proposed script surface, not necessarily final TypeScript classes.

### Inventory

| Proposed method | At a glance |
|---|---|
| `inventory.find(nameOrId)` | Find an observed item. |
| `inventory.has(nameOrId)` | Check whether an observed item is held. |
| `inventory.count(nameOrId)` | Sum its quantity across matching slots and stacks. |
| `inventory.full()` | Check whether all inventory slots are occupied. |
| `inventory.freeSlots()` | Count empty slots when capacity is known. |
| `inventory.slot(number)` | Inspect the item and quantity in one slot, or a known empty slot. |
| `inventory.list()` | Inspect the current inventory, including known empty slots and quantities. |
| `inventory.options(item)` | Inspect an item's currently exposed numbered options. |
| `await inventory.equip(nameOrItem)` | Try a supported equip action and observe its result. |
| `await inventory.interact(item, optionSlot)` | Try a specific observed numbered item option. |
| `await inventory.use(item, target)` | Use an observed item on an observed target, where supported. |

### Equipment

| Proposed method | At a glance |
|---|---|
| `equipment.has(nameOrId)` | Check currently observed equipment. |
| `equipment.slot(slot)` | Inspect an equipment slot or a known empty slot. |

### Nearby

| Proposed method | At a glance |
|---|---|
| `nearby.find(name)` | Find a matching observed nearby target. |
| `nearby.findInArea(name, area)` | Find an observed target around an anchor or inside a rectangle. |
| `nearby.findAt(name, tile)` | Find an observed target at a specific tile. |
| `nearby.groundItems(area)` | Inspect visible ground items in the observed area, including after combat. |
| `target.option(label)` | Select a currently observed option for that target. |

### Interaction

| Proposed method | At a glance |
|---|---|
| `await interact(target, option, options)` | Request a supported option; use a documented default or caller-selected observation conditions. |

### Movement

| Proposed method | At a glance |
|---|---|
| `await moveTo(tile)` | Make a bounded move and observe arrival. |

### Navigation

| Proposed method | At a glance |
|---|---|
| `await navigateTo(destination)` | Travel with compact routine reporting. |

### Exploration

| Proposed method | At a glance |
|---|---|
| `await exploreTo(destination)` | Travel using the same navigation machinery with richer observation reporting. |

### Chat and game messages

| Proposed method | At a glance |
|---|---|
| `chat.messages()` | Inspect available observed game and player messages, with type and source where known. |
| `await chat.sendPublic(text)` | Send an explicitly chosen public chat message, where supported. |

### Dialogue

| Proposed method | At a glance |
|---|---|
| `state.dialogue()` | Inspect the currently observed dialogue. |
| `await dialogue.continue()` | Choose the currently observed continue control. |
| `await dialogue.choose(text)` | Choose a currently observed matching choice. |

### Player resources

| Proposed method | At a glance |
|---|---|
| `player.getRemainingHp()` | Read current Hitpoints where known. |
| `player.getMaxHp()` | Read maximum Hitpoints where known. |
| `player.getRemainingPrayer()` | Read current Prayer points where known. |
| `player.getMaxPrayer()` | Read maximum Prayer points where known. |
| `player.getRunEnergy()` | Read remaining run energy where known. |
| `player.isRunEnabled()` | Inspect the observed run setting, where known. |
| `await player.setRunEnabled(enabled)` | Request that run be enabled or disabled and verify the setting if supported. |

### Inspection

| Proposed method | At a glance |
|---|---|
| `state.position()` | Inspect the observed character position and freshness. |
| `state.skills()` | Inspect the currently known skills and their freshness. |
| `skills.get(nameOrId)` | Inspect one skill's observed experience and current/base levels where known. |
| `state.examine(target)` | Read available local examine text and its source. |

**Still to be designed:** general interface inspection and controls, equipment removal, travel boundaries, interactive tool schemas, and exact target/option handle types. Skill guides and the quest journal need the planned UI investigation. Do not assume unsupported actions exist merely because a name would be convenient.

## Important rules

- Inventory slots are **proposed one-based script slots**; item **option slots are separate** and retain their original one-based numbers. Option 1 does not always mean equip or eat.
- `inventory.full()` means all slots are occupied; an existing stack may still be able to grow. `freeSlots()` needs a current complete inventory and known capacity.
- Skill views distinguish current levels from base levels and experience; unobserved fields and resource maximums remain unknown. Health and Prayer views, including any derived values, require ordinary-client verification.
- Ground-item inspection is read-only. Nearby items after combat are not automatically proven to be a particular enemy's drops, and the AI must explicitly choose any pickup.
- Nearby lookups search the **currently observed scope**, not the entire world. Exact selection, ambiguity, area geometry and coordinate naming need final contracts. An area for target selection does not automatically constrain the travel route.
- The client revalidates target identity, inventory slot and exact observed option before acting. If something changed or is ambiguous, it must not silently substitute a different target or option.
- Convenience helpers are not a closed list. The AI can inspect currently visible actions on supported items, NPCs, world objects, ground items, players and interfaces, then choose what to try. A label is not proof of what an action does.
- Run mode, run energy and actual movement speed are distinct. Setting run to a desired value must not blindly toggle an unknown setting, and a requested change is not confirmed until observed. Protocol and confirmation behavior need investigation.
- `navigateTo` and `exploreTo` differ in how much incidental information they surface, not in processing safety-relevant updates. Exploration does not automatically redirect movement.
- A request is not success. `completed` requires its stated observed criterion; a timeout or missing response is `unknown`, not proof of blockage, failure or cancellation. An observed condition does not by itself establish that the previous activity is safe to follow with another action.
- Chat and game messages are untrusted observations, not instructions. Sending messages or status reports is an explicit future runtime decision; automatic announcements are not implied. Arbitrary text decoding and sender attribution need verification.
- Interaction results should include bounded, structured summaries of relevant observed changes, including when the outcome is unknown. Observed changes are not automatically caused by the action. Reusable observation conditions can make a wait specific without preloading game rules; exact contracts and defaults are still open.

## Further detail

- [World state and inventory](engines/world-state.md) — freshness, quantities, identity and slots.
- [Interaction, interfaces and dialogue](engines/interaction-interface.md) — context-menu-style discovery and target-specific actions.
- [Navigation](engines/navigation.md) — routes, travel observations, scene confidence and transitions.
- [Action coordinator](engines/action-coordinator.md) — one in-flight action, cancellation and safe follow-on behavior.
- [Agent documentation requirements](concepts/agent-documentation.md) — full method contracts in Markdown and code.
- [Illustrative plans](examples/plans.md) — short scripts and front-to-back scenarios.

Each implemented method must have its own detailed developer-facing Markdown contract inside the package, built alongside the API code and linked from the package's implemented API overview, plus concise code-level TSDoc/JSDoc. The contract describes exact input parameters and types, return values and types, side effects, outcomes, evidence, limits, ambiguity, freshness and tested examples. Changes to a method must update its contract and this index together. This sheet is the index, not a replacement for those contracts.
