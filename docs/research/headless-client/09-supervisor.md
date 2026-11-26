# 09 · One process managing six clients (supervisor experiment)

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md) · [08 · Managing clients](08-managing-clients.md)

A throwaway test of the supervisor idea in [08](08-managing-clients.md): one process logs in several clients, keeps them alive, tracks each client's state in one file, and logs them out. It is `tools/headless-experiment/supervisor.mjs`, run with the `supervise` command. It is not a design for the production client.

## What was decided before running

| Condition | Pass means |
|---|---|
| Admission | One process logs in all six clients with one shared device id and a fixed gap between logins, and every refusal is recorded with its code |
| Isolation | One client is dropped on purpose mid-run. It shows as `dropped`. The other clients stay `in-game` and the supervisor keeps running |
| Cleanup | The remaining clients are logged out through the logout button, and each close is observed |
| State in one place | Every state change is written to `.runehive/headless-experiment/clients.json` with labels and states only, never account names |

All clients were ordinary players (staff level 0) on the owner's server, reached from the sandbox ([08](08-managing-clients.md)).

## Setup

- The supervisor logs clients in one after another and gives each its own keepalive timer, once per second.
- Clients share the default device id, which is the point: this tests whether one process can own the device limit.
- Each client's state is one of `queued`, `logging-in`, `in-game`, `dropped`, `logging-out`, `logged-out`, `rejected` or `failed`.
- Client 3 is dropped by destroying its connection ten seconds into the hold. That imitates a crash, not a clean logout.
- Run from the sandbox against the owner's server with a fresh account prefix each time.

## Run 1: fixed 4-second gap

Result: **admission failed, isolation and cleanup passed.**

| Client | Outcome |
|---|---|
| 1, 2, 3, 4 | Logged in (slots 2 to 5) |
| 5, 6 | Refused with protocol code 16 (the device limit) |
| 3 (dropped on purpose) | `dropped`; clients 1, 2 and 4 stayed in game and logged out cleanly |

I had already written in [06](06-multiple-clients.md) that the server restarts the 15-second window on every login attempt, and still chose a 4-second gap, which can never let the count clear. The failure was predictable from what we knew; the supervisor had no rule for it.

**Cause, from the pinned server source:** the server keeps a counter per `device id @ address` in a cache whose entries last 15 seconds, and each attempt, refused ones included, adds one and restarts that 15 seconds. The fifth attempt is refused. So the counter clears only after 15 seconds with no attempts at all, and a steady trickle of attempts, however slow, locks the device out once it has made four.

## Run 2: four logins, then 16 quiet seconds

The supervisor now waits 16 seconds after every four attempts. Result: **all four conditions passed.**

| Client | Slot | Final state |
|---|---|---|
| 1 | 2 | `logged-out` |
| 2 | 3 | `logged-out` |
| 3 | 4 | `dropped` (on purpose, at 46.8 s) |
| 4 | 5 | `logged-out` |
| 5 | 6 | `logged-out` |
| 6 | 7 | `logged-out` |

- Six of six admitted; five still in game before logout; finished in 67.4 s.
- The state file's final contents matched what the process printed.
- A read-only look at the server's records afterwards (human-only evidence) showed all six accounts offline. The dropped account's session had also cleared by then, roughly 20 seconds after the drop, which fits the 18 to 34.6 s window measured in [05](05-logout.md).
- No client processes were left running.

## What this shows

- **One process can own admission.** The device limit is a rule about the whole fleet, so only something that sees every login can respect it. A shell script with a fixed gap cannot.
- **Isolation held.** A client that died did not disturb the supervisor or its siblings, and the supervisor recorded it as `dropped` without retrying.
- **State in one place is cheap.** One small file updated atomically on every change is enough for something else to read, which is what a future status command needs ([plan](../../plans/headless-client-discovery.md)).
- **The cost of a shared device id is time.** Six clients took about 36 seconds to admit. Distinct device ids would avoid it ([06](06-multiple-clients.md)), and the owner has not chosen between them.

## Limits of this test

- Both runs were one process with in-process clients. It says nothing about child processes, which remain an open design choice.
- The drop was injected by the supervisor's own code. A real network failure, a server restart, or a client that stops responding without closing was not tested.
- After a drop the supervisor did nothing; reconnecting, retrying and backing off across a fleet are still untested.
- The logout button id is a hard-coded experiment shortcut ([05](05-logout.md)).
- The device-limit rule is hard-coded as four attempts and a 16-second quiet gap, taken from the pinned source. A different server configuration would need different numbers, and the server does not announce them.
- Six clients only. Load, decoding cost and the server's capacity at larger sizes were not measured.

## Running it

```sh
RUNEHIVE_EXPERIMENT_HOST=host.microsandbox.internal \
RUNEHIVE_EXPERIMENT_CRC_FILE=lostcity/.runehive/crc.bin \
RUNEHIVE_EXPERIMENT_ACCOUNT_PREFIX=<fresh prefix, 1 to 10 characters> \
RUNEHIVE_EXPERIMENT_SECONDS=30 \
RUNEHIVE_EXPERIMENT_FAIL_CLIENT=3 \
npm run experiment:headless -- supervise
```

Accounts are the prefix plus 1 to the number of clients (`RUNEHIVE_EXPERIMENT_CLIENTS`, 2 to 10, default 6), and each name is also its password. `RUNEHIVE_EXPERIMENT_PACE_SECONDS` (1 to 60, default 4) is the gap between logins within a burst. Omit `RUNEHIVE_EXPERIMENT_FAIL_CLIENT` for no deliberate drop. On the server's own machine, leave out the host and checksum-file settings.
