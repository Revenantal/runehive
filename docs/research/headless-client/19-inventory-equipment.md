# Inventory and equipment

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can an ordinary-player client observe what a character carries and wears, resolve items to names and visible options from client data, request a client-visible equip option, and confirm the result from later updates? Use the owner-prepared disposable character, the shared server, and client configuration checked against the advertised archive checksums. No item names, prices, requirements, or equip rules are preloaded; item definitions come from the same configuration an ordinary client reads.

## Stage 1: observe, read-only. Success defined before running

Log in, collect the inventory updates the server sends, and for a bounded period report each inventory component that received data: its component ID, slot count, and every non-empty slot with the item's name and visible options from the client definitions. Treat an item ID with no definition as `unknown`. Success: every update decodes without framing or length errors, at least one non-empty inventory is reported, and which component is the backpack and which is worn equipment is reported only from client interface data (not hard-coded). The observed snapshot reflects what the server sent after login; it is not proof that nothing changed afterwards.

## Stage 2: equip one item. Success defined before running (revised after stage 1, before any equip request)

Choose an item in a component the interface data marks as having item options, whose resolved option list contains exactly `Wear` or `Wield`. Send that option once for that item and slot, using the item and slot reported by the server. Report `completed` only after later updates show the item's count in the worn component rose by the count that left the backpack component. Stage 1 showed that the character already wields a sword and that every wieldable backpack item is a weapon, so equipping one will replace the worn weapon. Report where the replaced item went, as an observation, not an expectation. Afterwards, restore the character by wielding the original weapon again, and check the same way. Report `unknown` if only one of those changes is observed, if nothing changes before a bounded deadline, or if a game message suggests refusal. Record any message text. A rejection cannot be separated from an unknown outcome unless the server reports a distinct message.

## Stage 3: remove it again. Success defined before running

Return the character to its prior state using an option the client data lists for the worn component (expected to be `Remove`, checked from data, not assumed). Report `completed` when the item reappears in the backpack and leaves the worn component. If the backpack is full or anything unexpected happens, report `unknown` and stop.

## Not claimed

This tests one item and one option. It does not establish requirements, stat effects, two-handed behavior, replacement of an already-worn item, stackable items, banking, or dropping. It does not execute generated code.

## Stage 1 observations

`tools/headless-experiment/demos/inventory-identify.mjs` observed two inventory updates, with no framing or length errors. Both were full updates, one per inventory component. Component 3214 (28 interface slots, though the update listed only 16) held 12 items and component 1688 (15 interface slots, update listed 6) held two. All 14 item IDs resolved to names and item options from the verified configuration. The interface data classified the components: 3214 has `objectOptions` true and no component options, so its item actions come from item definitions; 1688 has a component-level `Remove` option. Slot positions in 1688 (a sword in slot 3, a shield in slot 5) are reported from the server and not interpreted here.

An update's slot count is not the component's capacity; it is the number of slots the server chose to send.

## Stage 2 and 3 observations

`tools/headless-experiment/demos/equip.mjs` takes an exact item name and an action (`wield` or `remove`). It finds the item in the server-reported inventory, resolves the option from client definitions and interface data, sends it once, and compares totals before and after.

- **Wield.** Wielding the Bronze dagger reported `completed`: its count in the worn component rose by one as its backpack count fell by one. The previously worn Bronze sword moved to the first free backpack slot. Wielding the sword again reversed the swap. No game messages were received in any run.
- **Option numbers come from the definition.** `Wield` was the second item option for these items, so the request used option 2, not option 1. The option number is the position of the text in the item definition's inventory-option list, and the packet's opcode is chosen by that number.
- **Remove is a component-level option.** The worn component's own `Remove` option (from interface data) was sent through the inventory-button packet. The shield left the worn component and appeared in the first free backpack slot (6). Wielding it again returned it to the same worn slot (5).
- **Slot positions are not stable.** After the sequence the character holds the same items as before, but the dagger is in backpack slot 3 (previously 8) because it took the slot the sword vacated. A script must read the current slot from the latest update, never reuse an old one.
- **Inventory persists across logout.** Each change was still present in a fresh login, observed through the next session's first inventory updates.
- **Server updates are sparse.** An update lists slots only up to the last non-empty one, not the component's capacity. My first observer treated the sent size as capacity and rejected a later update for an empty slot beyond it. That made one wield run report `unknown` (`observation-broken`) even though the server had applied it: the next session found the shield already worn. The observer now pads to the capacity (width × height) from the interface data. Lesson: **an observation failure does not mean an action failed, and a request's effect can outlive a broken observer.**

## Limits and open concerns

- One weapon swap and one shield removal. Stackable items, items with requirements, two-handed weapons, full backpacks, dropping, using one item on another, and banking were not tested.
- An invalid or unavailable action was not tested. An ordinary client never offers an option the definitions do not list, so deliberately sending one would go beyond ordinary-player behavior for no strong reason.
- Success is judged by counts moving between components. It does not check stats, appearance, or the animation of equipping.
- The experiment resolves items by exact name in this one character's inventory. It is not a general item-selection policy.

## Added confidence checks

- **Full-archive validation.** `tools/headless-experiment/demos/validate-config.mjs` decodes every record in the verified configuration without stopping at errors. All 3,894 item definitions, 1,359 NPC definitions, 4,671 location definitions and all 10,984 interface components decoded with no errors. 1,276 items and 1,812 locations have no name field, as expected for placeholders and unnamed objects. This shows the decoders do not choke on this revision's data; it does not prove every field is interpreted correctly, only that every record parses to its recorded length.
- **Where actions sit in item definitions.** Across all items, `Wield` (264 items) and `Wear` (389) appear only as the second item option. `Eat` appears as the first option on 143 items and the second on two. `Drink` appears as first (132) or third (4). Every one falls within the first three options, which is the range the driver accepts, so the restriction does not exclude them. `Drop` is not an item-definition option at all (one unrelated item has it), so the ordinary drop action is handled by the client, not by definitions.
- **Stackable items.** Wielding the 24 Bronze arrows moved the whole stack to the worn component, into a different worn slot than the weapon or shield, and removing it returned all 24 to the first free backpack slot. Both reported `completed` with no messages.
- **Eating is not tested.** The character carries no food, and food may not be added except through ordinary play. Food items offer `Eat` as option 1 in the definitions, so the existing held-option path should apply, but that is an inference from definitions, not an observation. Eating also changes hit points, so verifying it needs the skill and hit-point update packets, which are not decoded for this purpose yet.

## Options are data, and examine is local

An agent will meet items, NPCs and objects whose options it has never seen. The client therefore reports each option as a numbered label from the definitions, never from a fixed vocabulary, and says where each option came from.

**How the real client builds an item's options.** For an item in a backpack-style component it offers the item's first five options, with `Drop` supplied by the client as option five when the item defines none; `Use` when the component allows it; and `Examine`. A component such as worn equipment instead offers its own options (here `Remove`). Options one to five go to the server as the held-option packet (or the component button packet) numbered one to five. `Examine` never reaches the server. The protocol has no examine packet: the client shows the definition's description, or "It's a <name>." when there is none (and "N x name" for stacks of 100,000 or more). The same holds for NPCs and objects. `tools/headless-experiment/item-actions.mjs` reproduces these rules, and `inventory-identify.mjs` and `npc-identify.mjs` now report numbered actions and examine text, with the source (item, component or client) of each action. `Use` is listed but marked unsupported, since using an item on something needs a packet we do not send yet.

**Survey of the real definitions** (`demos/survey-definitions.mjs`):

| Kind | Distinct labels | Used by only one record | Appear at more than one position |
|---|---|---|---|
| Item inventory options | 50 | 26 | 7 |
| NPC options | 34 | 10 | 3 |
| Location options | 148 | 45 | 25 |

- **Labels are not standardized.** NPCs offer `Talk-to`, `Talk to` and `Talk` for the same idea; objects offer `Climb_over` (with an underscore) beside `Climb-across` and `Jump-over`; items use `Wield`, `Wear`, `Equip` and `Hold`. A script cannot match a fixed word like `Talk-to`. Matching and learning must work on labels as the definitions provide them, with the numbered position as the thing sent.
- **Position matters and varies.** `Attack` is usually option 2 on NPCs but option 5 on one; `Empty` is option 1 on nine items but option 4 on 93; `Rub`, `Locate`, `Teleport` and `Bait` also occupy different positions on different records. The same label can need a different option number.
- **Options four and five exist.** 128 items define an option four and 73 define an option five (72 of those put `Move` there), and one item puts `Drop` at option one. My equip driver accepted only options one to three, which was fine for `Wield`, `Wear`, `Eat` and `Drink`, but it would have missed many options. The shared action list now covers all five.
- **Rare and odd verbs are common enough to matter.** 26 of 50 item labels belong to a single item, for example `Blow`, `Dig`, `Ring`, `Swing`, `Rub-together`, `Cast Bloom` and `Check kills`. An agent cannot be told what each does; it must learn from trying and observing.
- **Plain markup is absent.** No names or descriptions contained colour tags or angle brackets, and no option text was empty, so the text can be shown as it is. One location label contains an underscore.
- **Item decoding gaps.** Descriptions are optional, so examine uses a fallback for items that have none.

This addresses discovery, not meaning. The client can list and send any numbered option and report what changed; it cannot say what `Rub` or `Ring` should do. Whether the agent tries an unfamiliar option is an agent decision, and trying one can have effects (an option such as `Drop` removes an item), so a durable client should return the option list first and let policy decide.

## Cross-check against a real client

The owner examined items and NPCs in a real browser client. A Bronze sword showed "A razor sharp sword." and Hans showed "Servant of the Duke of Lumbridge." Both match, word for word, the text our decoders produce from the verified definitions. That is two data points (one item, one NPC), so examine is confirmed for items and NPCs; world objects use the same rule in the client source but were not cross-checked.

## Recorded packets as fixtures

`tests/fixtures/headless/` holds packets recorded from live sessions: the login inventory updates, and a full Hans conversation with a choice menu, plus the small set of interface components those packets refer to, copied from the client's interface data. The character's own name is masked in the recorded dialogue. `tests/cli/headless-fixtures.test.mjs` replays them through the inventory and dialogue observers and checks the result against what the live runs reported. This guards against the earlier risk that tests written from our own reading of the source agree with a decoder that misreads the real format. The capture is optional in the drivers: set `RUNEHIVE_CAPTURE_FILE` when running `inventory-identify.mjs` or `npc-talk.mjs`. Inventory slot positions in the fixture are those at the time of recording and are not asserted.
