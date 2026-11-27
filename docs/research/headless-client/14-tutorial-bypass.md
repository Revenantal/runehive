# Vanilla tutorial bypass research

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question

Does the pinned vanilla world offer a tutorial bypass that could prepare newly created accounts for main-world experiments? This is source research only: no configuration or character state was changed and no bypass was attempted.

## Findings from pinned sources

In the pinned content, accepting the character-design interface queues the initial guide stage. At that stage, interacting with the tutorial guide offers a yes/no tutorial-skip dialogue **only when `map_live` is false** (`lostcity/content/scripts/tutorial/scripts/guides/runescape_guide.rs2`). The pinned engine maps `map_live` to `node.production` (`lostcity/engine/src/engine/script/handlers/ServerOps.ts`). This is therefore an interactive option, not an automatic account-creation setting.

Choosing yes sets tutorial progress complete and calls the existing `tutorial_complete` routine. That routine moves the character to the main world, clears and populates the inventory, clears equipped items and bank, adds some bank currency, resets stats, initializes tabs, and records completion (`lostcity/content/scripts/tutorial/scripts/tutorial.rs2`). These are script effects observed in source, not effects verified in a live session; the routine is destructive to existing character possessions and stats.

In the pinned login thread, non-production mode assigns staff level 4 to logins, described in the source as developer access with destructive commands. Production-only login rate-limit checks also differ. Consequently, switching this shared world to non-production would affect more than the tutorial option; it would not be an ordinary-player session. Exact persistence and privilege behavior after switching back have not been tested.

## Decision needed

The current project rules prohibit teleporting, item grants and direct state changes, and require owner approval for server configuration changes. The vanilla completion routine itself performs a scripted teleport and inventory/state changes, so a test-setup exception and explicit approval are needed before using it. If approved, evaluate a controlled one-server preparation procedure and restore production mode before experiments, then verify the account's saved tutorial state and ordinary staff level through normal client observations. Do not assume this is safe or persistent without testing. Automatic account-creation bypass is not established by this source research.
