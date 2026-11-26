# 06 · Multiple clients

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

> A six-client fleet in one shared world, the management diagrams and the owner-facing run commands are in [08 · Running and managing several clients](08-managing-clients.md).

## Question and setup

Can several independent headless clients stay logged in together, and what should run and control them: one process per client, or one manager? Setup matches the [earlier experiments](05-logout.md): the pinned sources, the owner-approved production configuration, the existing local world, and a fresh account per client (checked by a human-only read-only query, not by the clients). All clients ran on one machine, so the server saw one address. Every login reported staff level 0.

To tell clients apart, logs now carry a non-secret label (`RUNEHIVE_EXPERIMENT_CLIENT_ID`, for example `client-02`, previously fixed at `client-01`). An experiment-only setting, `RUNEHIVE_EXPERIMENT_DEVICE_ID`, sets the device id sent at login. By default it is the value the pinned browser client sends, which is the same for every client.

## Server limits that matter (source observations, then measured)

In production mode the engine limits logins from one machine:

- **Per device:** attempts are counted per device id and address. The fifth attempt inside a 15-second window is refused with code 16. The source also restarts the window on every attempt, so a steady trickle of attempts never lets the count fall; we measured the fifth-attempt refusal but did not test the restart.
- **Per address:** the thirtieth connection handshake inside a rolling minute is refused.

Our client sends the same device id every time, as the pinned browser client does, so all our clients look like one device.

## Experiments and client observations

**Six clients started at once, same device id.** Four logged in. The other two (the fifth and sixth to arrive) were refused with code 16 and did nothing further. The four that got in each ran a full 75-second session with 74 keepalives. This matches the source reading. Which clients lose depends on arrival order.

**Six clients started at once, a different device id each.** All six logged in and all six held a full 75-second session with 74 keepalives. So the device limit, not the world or the account, was the constraint in the first run. The address limit was not reached.

**Attribution.** Across the twelve logs from those two runs, every file held exactly one client label and one run id, and the recorded outcome matched what that client printed (accepted with staff level 0, or refused with code 16). No log contained an account name, a password or a device id.

**Isolation between processes.** Four client processes ran together, each with its own account and device id:

| Client | What it did | Observed |
|---|---|---|
| A | held a session | completed the full 75 s with 74 keepalives |
| B | clean logout from 20 s | connection closed 407 ms after the click; relogin accepted at 2.2 s |
| C | abrupt disconnect from 32 s | code 5 at 1.5 s and 18.0 s, accepted at 34.6 s |
| D | hard-killed (`kill -9`) at 20 s | see below |

Clients B and C behaved exactly as they did alone in the [logout experiments](05-logout.md), and A was unaffected by any of them.

**A hard-killed client.** D's log ends after `session.observed`, with no closing entry, which is expected because a killed process cannot write one. A missing closing entry therefore says nothing about the game outcome. The server's own session log (a human-only cross-check, not something a client could read) shows the socket closing at the kill and `Logged out` 30 seconds later, matching the engine's 30-second no-connection timeout. About two and a half minutes later a login on D's account was accepted, so the account was released without any action from us.

**Six clients in one process (throwaway probe).** A short script logged six clients into a single Node process at once, with a different device id each, sent keepalives to all of them every second, and clicked the logout button for one of them after 10 seconds. All six logins were accepted in about 1.1 s. The clicked client closed 204 ms later. The other five stayed open for the full 30 seconds with 29 keepalives each, and the worst event-loop delay was 1 ms. The probe was a temporary script and was not added to the repository. It called the same `login` function the CLI uses, once per client, and then sent keepalives from one timer.

## Comparing the designs

| | One process per client | One manager, clients in-process | Manager that forks a process per client |
|---|---|---|---|
| Shown to work here | yes (up to 6 concurrent, with a hard kill) | yes (6 concurrent, one logout mid-run) | not tried |
| Fault containment | strong: a killed client changed nothing for the others | weaker: a crash or a long synchronous task would affect every client, and keepalives are needed every second | strong |
| Login pacing and device identity | each process is unaware of the others, so a launcher must do it | one place that sees every login | one place |
| Telling a running client to log out | needs a channel we haven't built | a method call | needs a channel (Node's fork gives a built-in message channel) |
| Cost | simplest code | a client object with a clean lifecycle | both of the others' costs |

## Interpretation

Nothing here showed that either model cannot work. Process-per-client isolates failures well but leaves two problems unsolved: pacing logins across processes, and controlling a client that is already running. A manager solves both but concentrates risk. The measurements favour a design where the client is an embeddable object with an explicit lifecycle (connect, log out, close, report status) and a supervisor owns login pacing and control; whether that supervisor hosts clients in its own process or in forked children can then be decided later without rewriting the client. This is a provisional recommendation from small tests, not a settled design.

## Decision for the owner: device identity

The measurements leave one choice that is not technical. To run more than four clients on one machine the options are:

1. **Give each client its own device id.** Six concurrent logins worked. This is what separate installations of the real client would send, and it needs no waiting. It does depend on the server trusting a client-supplied value, and it sidesteps a limit the server applies to that value.
2. **Keep the shared device id and pace logins.** At most four logins per 15-second window, then a quiet gap of at least 15 seconds. It leaves the limit untouched but makes starting a large fleet slow (about four clients per 15 s).

Neither option modifies the server. Both are only tested against this private local world.

## Limitations

- Six concurrent clients at most, over short runs (75 s, 30 s for the in-process probe), on one local server with Tutorial Island accounts. Larger fleets, long runs, CPU and memory use, and the per-address limit were not measured.
- Packets are still not decoded, so "all clients are healthy" means connected and answering keepalives, not that their game state is correct.
- The forked-worker design was not tried.
- Control of an already-running client from outside (for example, a CLI command that tells one client to log out) was not built. The in-process probe only showed that the client object can be commanded.
