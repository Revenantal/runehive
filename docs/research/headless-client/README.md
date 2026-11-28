# Headless client experiments

[Documentation index](../../README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

These notes describe a disposable prototype, not the production client or agent Discovery Memory. Each experiment separates observations from interpretation and identifies what remains unknown. Follow the vanilla-server and credential boundaries in the discovery plan.

## Findings so far

| Question | Answer | Where |
|---|---|---|
| Can an ordinary player log in from outside the browser? | Yes, over raw TCP with the pinned client's checksums and RSA key; production mode gives staff level 0 | [03](03-login.md) |
| How long does an idle session last? | About 60.6 s; one keepalive per second kept it for the full 75 s | [04](04-session-maintenance.md) |
| How does a client log out cleanly? | Click interface component 2458; the server closes in about 0.4 s. Dropping the connection leaves the account "online" for 18 to 34.6 s | [05](05-logout.md) |
| How many clients can run together, and what limits them? | Six tested. Per-device limit refuses the fifth attempt until 15 s pass with no attempts; per-address 30 per minute; one session per account | [06](06-multiple-clients.md), [08](08-managing-clients.md) |
| Can clients see each other and browser characters? | Yes, when they are on the same server. Our decoder reads who the server says is in view | [07](07-visibility.md), [08](08-managing-clients.md) |
| Why did it fail at first? | Two servers ran from the same mounted checkout. Now one server only, enforced by a lock | [07](07-visibility.md), [decision 0008](../../decisions/0008-one-lostcity-server-at-a-time.md) |
| How are several clients managed? | Tested: independent processes from a shell script, and a throwaway one-process supervisor with six in-process clients, and one with a child process per client. Child processes handled kill, stall and parent crash with no orphans; a production design is not chosen | [08](08-managing-clients.md), [09](09-supervisor.md), [10](10-child-processes.md) |

## Commands

From the repository root, with Node.js 24 or newer:

```sh
npm run experiment:headless -- --help
npm run experiment:headless -- run
npm run experiment:headless -- login
npm run experiment:headless -- session       # 75 seconds with keepalives
npm run experiment:headless -- session-idle  # 75 seconds without keepalives
npm run experiment:headless -- logout        # click the logout button, then test relogin
npm run experiment:headless -- logout-abrupt # drop the connection (control), then test relogin
npm run experiment:headless -- observe       # report which players the server says are in view
npm run experiment:headless -- observe-designed  # same, after accepting the default character design
npm run experiment:headless -- observe-walking   # same, after walking two tiles north
npm run experiment:headless -- supervise     # one process logs in several clients, tracks state, logs them out
npm run experiment:headless -- supervise-children  # same, one child process and device id per client
```

`run` starts a foreground placeholder. `login` prompts for the account with visible input, uses the same value as its password, connects to the local world, and reports the client-visible login result. Because the name is also the password, anyone who sees the prompt can see the credential; use disposable local accounts only. For automation, `RUNEHIVE_EXPERIMENT_ACCOUNT` can supply the value instead of prompting. Choose a fresh account manually; the naming convention in the plan is recommended but not enforced. Automatic allocation and verification of freshness are not implemented. The prototype accepts printable ASCII names of 1–12 characters; the server may apply further normalization or restrictions. The account name is a password, so do not put its value in documentation, logs, shell history, or a shared terminal. Each run writes a separate JSON Lines file under `.runehive/headless-experiment/` in the current directory, named by the non-secret run ID shown at startup. To stop it from another terminal, send SIGTERM to the Node process running `tools/headless-experiment/cli.mjs`; don't signal an unrelated process. For scripting without npm's wrapper, use `node tools/headless-experiment/cli.mjs run`. Invalid arguments return exit code 2 without echoing the argument. The Node process exits with code 0 on SIGINT or SIGTERM after cleanup; when launched through npm, the wrapper may itself report signal termination. Stopping `login` closes the connection; it does not request a clean game logout. Incoming post-login game packets are counted but not decoded. The separate session experiments compare bounded operation with and without keepalives; the basic `login` command does not send them.

## Optional settings for several clients

Six environment variables apply to every command. `RUNEHIVE_EXPERIMENT_HOST` (default `127.0.0.1`) names the server to connect to, and `RUNEHIVE_EXPERIMENT_CRC_FILE` points at a saved copy of the server's 40-byte `/crc` response, so the client does not need the web port. Save it on the server's machine with `curl -s http://localhost:8888/crc -o lostcity/.runehive/crc.bin`; it changes only when the cache is repacked. `RUNEHIVE_EXPERIMENT_SECONDS` (5 to 1800, default 30) sets how long the `observe` commands stay online, and `RUNEHIVE_EXPERIMENT_TRANSPORT` is `tcp` (default) or `websocket`. `RUNEHIVE_EXPERIMENT_CLIENT_ID` (for example `client-02`) labels that client's log so clients can be told apart. `RUNEHIVE_EXPERIMENT_DEVICE_ID` (a non-negative integer) sets the device id sent at login; by default every client sends the same value as the pinned browser client, which the server counts as one device. Neither is a credential and neither is logged. Invalid values are rejected without being echoed. See [06 · Multiple clients](06-multiple-clients.md) for what these change.

## Retained movement demonstrations

The following focused drivers are retained for reference and reuse, not as production navigation APIs. They require a disposable ordinary-player account supplied through `RUNEHIVE_EXPERIMENT_ACCOUNT` and a host supplied through `RUNEHIVE_EXPERIMENT_HOST`. Account names are credentials in this experiment; avoid placing them in source, shell history, or logs. Each driver uses fixed world-specific coordinates and stops on unexpected observations.

- `tools/headless-experiment/demos/walking-loop-demo.mjs` repeats a short route at the tutorial-area starting position.
- `tools/headless-experiment/demos/random-walk-demo.mjs` chooses bounded paths in the tutorial-area region. It requires previously validated client asset files `/tmp/rhdemo-ground.bin`, `/tmp/rhdemo-region.bin`, `/tmp/rhdemo-index.bin` and `/tmp/rhdemo-data.bin`; the one-off acquisition script used in the original experiment was not retained. It does not verify those files itself, so do not treat them as current or use this driver without independently validating and preparing them.
- `tools/headless-experiment/demos/door-ladder-demo.mjs` exercises a particular main-world door and ladder. See [15](15-main-world-interactions.md) for its prerequisites, observations and limitations.
- `tools/headless-experiment/demos/move-a-to-b.mjs` is the explicit one-move baseline. `demos/programs/move-to-point.mjs` is the import-free action-only comparison, statically loaded by `demos/run-move-program.mjs`. Both require pre-acquired validated region assets, and the host is not a sandbox for generated scripts. See [16](16-move-a-to-b.md).
- `tools/headless-experiment/demos/run-round-trip.mjs` runs a trusted two-action script in `normal` mode or the synthetic `invalidate` mode. Both modes require separately prepared and verified `/tmp/abmove-*.bin` assets and the documented starting position; see [17](17-multi-action-session.md).
- `tools/headless-experiment/demos/fetch-config-assets.py` fetches and verifies NPC, location and interface configuration; `demos/npc-identify.mjs` and `demos/npc-talk.mjs` use it for the read-only and one-conversation stages. See [18](18-npc-dialogue.md).

Some earlier one-off probes were deleted before the decision to retain scripts; their findings are preserved in the experiment notes, but the deleted drivers are not claimed as retained.

## Logs and retention

Run from the repository root so `.runehive/` is Git-ignored. Logs are local diagnostic artifacts, retained until an operator chooses to remove them; there is no automatic rotation or cleanup. Files are created exclusively with owner-only permissions where supported. Avoid sharing logs without review. At present the logger accepts fixed startup, shutdown, login-result, aggregate session-observation and logout/relogin events; it does not yet log general game actions, decoded game observations, or detailed errors. It has no generic redactor: extend its schema and add credential-leak tests before introducing credentials or arbitrary protocol data.

## Experiments

- [01 · Bootstrap and baseline](01-bootstrap.md)
- [02 · Diagnostic logging](02-logging.md)
- [03 · Login investigation](03-login.md) — ordinary-player login, rejection, and service findings
- [04 · Session maintenance](04-session-maintenance.md) — bounded idle and keepalive comparison
- [05 · Clean logout](05-logout.md) — logout button versus abrupt disconnect
- [06 · Multiple clients](06-multiple-clients.md) — server limits, isolation, and process-versus-manager comparison
- [07 · Visibility](07-visibility.md) — why browser characters and our clients did not see each other (two separate servers)
- [08 · Running and managing several clients](08-managing-clients.md) — the six-client fleet, tested versus proposed management, server rules, and remote access
- [09 · Supervisor experiment](09-supervisor.md) — one process admitting, tracking and logging out six clients
- [10 · Child processes](10-child-processes.md) — one worker process per client, distinct device ids, kill, stall and parent-crash cases
- [11 · Initial state discovery](11-initial-state.md) — protocol research and live position and movement observations
- [12 · Routefinding](12-routefinding.md) — browser collision data and a bounded turn-waypoint comparison
- [13 · Tutorial NPC perception](13-tutorial-npcs.md) — client-visible NPC updates and tutorial progress
- [14 · Vanilla tutorial bypass](14-tutorial-bypass.md) — existing non-production option, effects, and risks
- [15 · Main-world navigation interactions](15-main-world-interactions.md) — door and ladder experiments
- [16 · One A-to-B movement script](16-move-a-to-b.md) — baseline before simplifying the script API
- [17 · Multiple actions in one session](17-multi-action-session.md) — sequential actions and controlled invalidation
- [18 · NPC identification and dialogue](18-npc-dialogue.md) — config-resolved NPCs and an observed conversation
- [19 · Inventory and equipment](19-inventory-equipment.md) — observed inventories, wield and remove
- [20 · World objects and ground items](20-world-object-tree.md) — chopping, dropping, picking up and lighting, and why the client must send its own route
- [21 · Cancelling, long legs and obstacles](21-cancelling-and-legs.md) — cancelling, leg length, region crossing, blocking, refusal messages
- [22 · Cross-region navigation](22-cross-region-navigation.md) — calculated two-region straight-route control and collision limitations
- [23 · Public chat](23-public-chat.md) — browser-confirmed outgoing and headless-observed incoming control
- `tools/headless-experiment/demos/inventory-identify.mjs` observes inventories read-only, and `demos/equip.mjs` wields or removes one named item and checks the result. Both need the directory written by `fetch-config-assets.py`. See [19](19-inventory-equipment.md).
- `tools/headless-experiment/demos/validate-config.mjs` decodes every definition in the verified configuration and reports any record that does not parse. See [19](19-inventory-equipment.md).
- `tools/headless-experiment/demos/survey-definitions.mjs` summarizes the option vocabulary and unusual text in the verified configuration, and `tools/headless-experiment/item-actions.mjs` builds the numbered action list and examine text. See [19](19-inventory-equipment.md).
- `tools/headless-experiment/demos/fetch-map-assets.py` fetches and verifies one map region's ground and location files. `demos/chop-tree.mjs` (chop one tree, optionally route-first), `demos/logs-sequence.mjs` (drop, take and light) and `demos/reach-probe.mjs` (when a request is refused) use them. See [20](20-world-object-tree.md).
- `tools/headless-experiment/demos/cancel-probe.mjs` (does a plain walk cancel a chop), `demos/leg-probe.mjs` (how long one walk may be, the waypoint limit and region crossing) and `demos/walk-legs.mjs` (straight or planned walks to a list of tiles) are described in [21](21-cancelling-and-legs.md).
