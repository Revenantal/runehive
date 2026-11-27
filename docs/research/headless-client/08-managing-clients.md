# 08 · Running and managing several clients in one world

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

This note answers: how do several headless clients log in and stay logged in together, who manages them, and what must be true of the server setup. It separates **what was run** from **what is only proposed**. There is no master process yet.

## What was run

On 2026-11-26 six clients ran against the owner's server while one browser character was online. Each was started by a shell script as its own operating-system process, three seconds after the previous one, with its own account, log label and device id. They stayed online for 120 seconds and were then ended by their own timers. The owner confirmed on screen that all six were visible.

| Client | Arrived | Slot | Players it was told about (total) | In view at the end |
|---|---|---|---|---|
| fleet1 | first | 2 | 6 (the browser character and five clients) | 6 |
| fleet2 | +3 s | 3 | 6 | 5 |
| fleet3 | +6 s | 4 | 6 | 4 |
| fleet4 | +9 s | 5 | 6 | 3 |
| fleet5 | +12 s | 6 | 6 | 2 |
| fleet6 | +15 s | 7 | 6 | 1 |

Every client saw all six others at the peak. The browser character held slot 1. The "in view at the end" column falls because the clients finished in the same order they arrived, and each saw the earlier ones leave. All six logged out cleanly and no fleet account was left online.

## How it was managed: tested

There was no supervisor. A person (or the agent's shell) started each process. The processes did not know about one another.

```text
   operator's shell script (not part of the product)
        |
        |  starts one process per client, 3 s apart
        v
 +-----------+ +-----------+ +-----------+     +-----------+
 | process 1 | | process 2 | | process 3 | ... | process 6 |
 | client-21 | | client-22 | | client-23 |     | client-26 |
 | device    | | device    | | device    |     | device    |
 |   2001    | |   2002    | |   2003    |     |   2006    |
 +-----+-----+ +-----+-----+ +-----+-----+     +-----+-----+
       |             |             |                 |
       |  each opens its own TCP connection to the game port (43594)
       v             v             v                 v
 +-----------------------------------------------------------+
 |  ONE LostCity server (slots 1..N, one world)              |
 |  slot 1 = browser character, slots 2..7 = the six clients |
 +----------------------------+------------------------------+
                              |
                       one SQLite file
```

Each process owns its own connection, keepalive timer, log file and cleanup. One process dying (including `kill -9`) did not affect the others, and cleanup was per process. The earlier experiment ([06](06-multiple-clients.md)) also ran six clients inside one process and found the same server behaviour.

## How it could be managed: proposed, prototyped once

The recommendation in [06](06-multiple-clients.md) is an embeddable client object with an explicit lifecycle, plus a **supervisor** that owns the things a single client cannot decide alone. A throwaway one-process supervisor with in-process clients was run once ([09](09-supervisor.md)) and met its conditions, but it is not a design for the production client. Child processes were not tried.

```text
                 +--------------------------------+
                 |  agent runtime / operator      |
                 |  "run these N accounts"        |
                 +---------------+----------------+
                                 |
                                 v
                 +--------------------------------+
                 |  SUPERVISOR  (one per server)  |
                 |  - login queue and pacing      |
                 |  - device id assignment        |
                 |  - which accounts are online   |
                 |  - backoff after rejections    |
                 |  - start, stop, restart        |
                 +---+---------+---------+--------+
                     |         |         |
          start/stop |         |         |   status and events
                     v         v         v
              +---------+ +---------+ +---------+
              | client  | | client  | | client  |   in-process objects,
              | account | | account | | account |   or child processes
              |   A     | |   B     | |   C     |   (undecided)
              +----+----+ +----+----+ +----+----+
                   |           |           |
                   v           v           v
              +-------------------------------------+
              |   ONE LostCity server               |
              +-------------------------------------+
```

### Who is responsible for what

| Concern | What was run | Proposed supervisor |
|---|---|---|
| Starting a client | Shell script, one process each | Supervisor starts and stops client objects |
| Login pacing | Fixed 3 s sleep in the script | Queue that spaces logins and counts attempts per device and address |
| Device ids | Distinct id per process, set by environment variable | Supervisor assigns ids so clients do not share a throttle |
| Account freshness | Human checked a read-only query | Open: the supervisor could keep an account registry |
| One account, one session | Script avoided duplicates | Supervisor refuses a second login for an account already online |
| Keepalives | Each process sends its own every second | Each client owns its keepalive |
| Failure of one client | Others continued | Client reports; supervisor decides whether to retry, with backoff |
| Clean stop | Each timer ended its run with a logout | Supervisor asks every client to log out and waits |
| Reconnect after a drop | Not tested | Open: the protocol has a reconnect opcode (18) that was not tested |
| Observation and logs | One log file per process | One log label per client; shared run identifier is open |

## Server rules the manager must respect

All measured against the pinned server in production mode; details in [03](03-login.md), [05](05-logout.md) and [06](06-multiple-clients.md).

| Rule | Measured behaviour | Consequence |
|---|---|---|
| Per-device login limit | The fifth attempt is refused with code 16. Every attempt, refused ones included, restarts a 15-second timer, so the count clears only after 15 s with no attempts | Four logins, then at least 15 quiet seconds; or distinct device ids. A fixed 4 s gap admitted only 4 of 6 ([09](09-supervisor.md)) |
| Per-address login limit | 30 per minute | Fine for small fleets from one machine |
| One session per account | Second login while online is refused with code 5 | The manager must track which accounts are online |
| Stale session after a drop | After an abrupt disconnect the account stays "logged in" for between 18 and 34.6 s | Do not retry a dropped account immediately |
| Idle timeout | An idle session was closed at about 60.6 s; one keepalive per second kept it for the full 75 s | Every client needs a keepalive timer |
| Clean logout | Button click on interface component 2458 (an experiment shortcut); the server closed in about 0.4 s and a relogin was accepted at about 2.2 s | Prefer the clean logout over dropping the connection |
| Privilege | Every login reports staff level 0 in production mode | Clients are ordinary players |
| Device id | The server uses it only as a throttle key and a session record | It is not a security boundary |

## One server only

The first fleet attempts failed because two servers were running from the same mounted checkout, so clients were in different worlds ([07](07-visibility.md)). The rule and its enforcement:

| Item | Detail |
|---|---|
| Rule | One LostCity server per checkout, on one machine ([decision 0008](../../decisions/0008-one-lostcity-server-at-a-time.md)) |
| Enforcement | `start` writes `lostcity/.runehive/lostcity.owner` naming the machine, and refuses to start or stop while another machine holds it |
| Check | `npm run runehive -- status` shows `stopped`, `ready`, `running`, `remote` or `conflict` |
| Crash recovery | If a machine dies without stopping the server, confirm no server runs anywhere, then delete that file |

## Reaching the server from a sandbox

In this setup the agent's sandbox mounts the owner's checkout, but the network is separate.

| Item | Detail |
|---|---|
| Server address | In this environment, the sandbox gateway and the host's LAN address are distinct addresses; discover the latter on the host with `hostname -I` |
| Game port | 43594 was reachable through the gateway and through the host LAN address |
| Web port | 8888 refused connections through the gateway but was reachable through the host LAN address. The reason for the gateway behavior is not established |
| Client bootstrap | Use the reachable server address for both ports. The client fetches `/crc` itself; a saved CRC file is an optional experimental fallback, not the intended requirement |

```sh
# From a machine that can reach the server's game and web ports:
# Substitute the host's reachable address; the client fetches checksums itself.
RUNEHIVE_EXPERIMENT_HOST=<server-address> \
RUNEHIVE_EXPERIMENT_SECONDS=120 \
RUNEHIVE_EXPERIMENT_CLIENT_ID=client-2$i \
RUNEHIVE_EXPERIMENT_DEVICE_ID=200$i \
RUNEHIVE_EXPERIMENT_ACCOUNT=<fresh account name> \
node tools/headless-experiment/cli.mjs observe
```

Use a fresh account name for each client, and wait about three seconds between starts. Account names are passwords in this prototype, so keep them out of shared logs.

## Not yet built or tested

- A production supervisor, a client lifecycle API, and a choice between in-process objects and child processes. The throwaway in [09](09-supervisor.md) used in-process clients only.
- Reconnect after a dropped connection, and retry or backoff behaviour across a fleet.
- Larger fleets. Six were tested; the server allows up to 1000 connections, but load and decode cost were not measured.
- Whether a browser draws a character that never accepted the design. The owner saw the fleet, but the clients had not submitted a design in this run; whether they appeared as default-looking characters or something else was not recorded.
- What a human sees on screen is known only from the owner's reports.
