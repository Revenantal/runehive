# 10 · One child process per client, with distinct device ids

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md) · [09 · Supervisor](09-supervisor.md)

A throwaway test of the child-process option left open in [08](08-managing-clients.md) and [09](09-supervisor.md): a parent process starts one worker process per client (`worker.mjs`, started by `supervise-children`), each with its own device id ([decision 0009](../../decisions/0009-distinct-device-ids-per-client.md)). The account name goes to each worker over its message channel only, never the command line or environment. The parent tracks every client's state in the same state file and runs a heartbeat watchdog. All clients were ordinary players (staff level 0) on the owner's server, reached from the sandbox ([08](08-managing-clients.md)).

## Conditions decided before running

| Condition | Pass means |
|---|---|
| Admission | Six clients admitted one second apart with no quiet gap, because device ids differ |
| Killed child | A child killed with `SIGKILL` shows as `failed`; the others stay `in-game` |
| Stalled child | A child stuck in a busy loop stops sending heartbeats, is marked `unresponsive` and killed; the others stay `in-game` |
| Cleanup | The rest are logged out by the logout button and no worker process is left |
| Parent killed | If the parent is killed with `SIGKILL`, no worker is left running, and the accounts leave the game |

## Run A: kill one child, stall another

Six clients, one second apart, held 30 seconds. Client 3's process was killed and client 5 was told to loop forever, both at 20.1 s.

| Client | Slot | Result |
|---|---|---|
| 1, 2, 4, 6 | 2, 3, 5, 7 | `logged-out` |
| 3 | 4 | `failed`, 16.2 s after it was killed |
| 5 | 6 | `unresponsive`, then `failed`, 21.1 s |

Admission passed: all six in about 4.4 s of supervisor time, with no refusals. Isolation passed: the other four kept their sessions and logged out. No worker process was left and all six accounts were offline afterwards.

Two things in the timings are worth keeping:

- The stalled client was caught about 5 s after the stall, which is the watchdog threshold I set. The server would have closed an idle session at about 60 s ([04](04-session-maintenance.md)), so the watchdog acts well before the server does.
- The killed child was marked `failed` at 16.2 s on the supervisor's own clock, which is when the earlier clients' logouts completed, not the moment of the kill. The state was correct but its timestamp was late. I did not find out why.

## Run B: kill the parent with SIGKILL

Six clients, one second apart, held 120 s, then the parent was killed at about 14 s. A first attempt had a broken timing loop and was discarded. The second attempt tracked the six worker processes by their process ids from before the kill, and polled the server's records each second.

| Observation | Result |
|---|---|
| Worker processes after the kill | 0 within one second |
| Accounts offline within one second | 5 of 6 (logged out cleanly, "Logged out" then "TCP socket closed") |
| The sixth account (client 3) | "TCP socket closed" at the same second, but "Logged out" only about 30 s later; it stayed online that long |

A worker leaves the game when its message channel closes: it clicks the logout button and exits when the server closes the connection, or after five seconds. So **no orphans** was confirmed, and the clean logout worked for five of six.

**Unexplained:** client 3 closed its connection at the same moment but the server logged it out 30 seconds later, as after an abrupt disconnect ([05](05-logout.md)). Possibilities I did not test: the logout click was not honoured for that character at that moment (the server may defer a logout in some states), or the worker's connection closed before the server processed the click. The server's records show only the outcome. Until it is understood, a supervisor cannot assume a parent crash always produces a clean logout; it should treat a client that stays "online" after its worker is gone as stale for up to about 35 s, as in [05](05-logout.md).

## What this shows

- Child processes work. The supervisor stays small because each worker owns its connection, its keepalive and its own cleanup.
- A stalled client is isolated by the process boundary, and the watchdog is a few lines. With in-process clients, the same stall would have blocked every client's keepalive ([09](09-supervisor.md)).
- Distinct device ids remove the 16-second quiet gaps. Six clients were admitted in about 4.4 s, not about 36 s.
- A dead parent leaves no processes behind, and clean logout usually follows.

## Limits of this test

- One run of each failure case.
- Workers' output is discarded, so a worker's own error cannot be seen. The parent knows only a state and a heartbeat.
- The stall was a requested busy loop, not a defect in real agent code.
- Parent crash with `SIGKILL` was tested. A parent that hangs, a worker that leaks memory, and a restart of the server underneath running clients were not.
- Reconnecting after a drop, retry and backoff, and fleets larger than six were not tested.
- Memory per worker was not measured.
- The logout button id is a hard-coded experiment shortcut ([05](05-logout.md)).

## Running it

```sh
RUNEHIVE_EXPERIMENT_HOST=host.microsandbox.internal \
RUNEHIVE_EXPERIMENT_CRC_FILE=lostcity/.runehive/crc.bin \
RUNEHIVE_EXPERIMENT_ACCOUNT_PREFIX=<fresh prefix> \
RUNEHIVE_EXPERIMENT_SECONDS=30 \
RUNEHIVE_EXPERIMENT_FAIL_CLIENT=3 \
RUNEHIVE_EXPERIMENT_STALL_CLIENT=5 \
npm run experiment:headless -- supervise-children
```

The settings are the same as for `supervise` ([09](09-supervisor.md)), with the default gap shortened to one second. `RUNEHIVE_EXPERIMENT_FAIL_CLIENT` kills that client's process; `RUNEHIVE_EXPERIMENT_STALL_CLIENT` stalls it.
