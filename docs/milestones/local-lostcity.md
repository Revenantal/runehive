---
id: M1
title: "Play LostCity locally"
delivers: "A reproducible Revision 274 world the owner can manage from the project CLI and play in the graphical client."
depends_on: [M0]
design: []
builds:
  - { name: "Verified Revision 274 source pins and startup steps", system: lostcity-and-aeris, status: in-design }
  - { name: "CLI service commands to start, check, and stop LostCity", system: lostcity-and-aeris, status: in-design }
  - { name: "Representative gameplay verification of the local world", system: lostcity-and-aeris, status: in-design }
---
# Play LostCity locally

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M0](project-setup.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Verified Revision 274 source pins and startup steps | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| CLI service commands to start, check, and stop LostCity | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |
| Representative gameplay verification of the local world | [LostCity and Aeris](../system/lostcity-and-aeris.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Run a private stock Revision 274 world that the project owner can play locally through the normal graphical client and manage from the project CLI.

## Objectives and plan

- Use the checkouts provisioned by [Project organization and setup](project-setup.md). Verify that the engine, content, client, and relevant tooling work together and record the tested commit pins, prerequisites, startup steps, and save location.
- Configure and start the engine using its upstream commands, then test the browser client bundled with the engine. The upstream launcher's interactive flow also fetches the legacy Java client.
- Extend the repo-root project CLI with service commands. Start with LostCity and use the same command pattern for the Agent Runtime and Control Center as they come online.
- Start LostCity from the CLI and print the browser URL when it is ready. Connect through the graphical client and create a character.
- Track the processes started by the CLI so status reflects what is running and stop shuts those processes down cleanly, giving LostCity time to save progress.
- Check representative gameplay, including movement, banking, shops, Woodcutting, combat, and an introductory quest. Record any gaps that affect later milestones.

## Proposed commands

Run these from the project root after the [M0 npm bootstrap](project-setup.md).

| Command | Purpose |
|---|---|
| `runehive start lostcity` | Start the local world and show how to connect. |
| `runehive status lostcity` | Show whether the world is stopped, starting, or ready. |
| `runehive stop lostcity` | Shut down the local world cleanly. |

As other services are added, the CLI can accept their names and offer a single command to start or stop the full local stack. These commands now exist: with no service name, `runehive start`, `status`, and `stop` act on every registered service, and `npm start` and `npm stop` are shortcuts. Verifying save persistence and representative gameplay remains open.

## Done when

From the project root, the owner can start LostCity, check its status, open the graphical client, and make progress. After stopping and starting LostCity through the same CLI, the character and progress are still there.
