# 04 · Session maintenance

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Does a logged-in client stay connected without sending anything, and does the pinned client's no-timeout packet change the outcome? Experiments used the [baseline](01-bootstrap.md) source revisions, the owner-approved production configuration, six fresh experimental accounts (one per run), and normal game protocol access. A human-only read-only check confirmed the accounts used in the later runs did not exist beforehand; this was not a client observation. Every login reported staff level 0. The first pair of runs overlapped in time; the repeat runs (two idle and two keepalive) were launched together as four concurrent processes.

The service registry reported stopped despite the previously launched server process still listening on both ports. We used that existing process instead of starting another server. This service-management discrepancy remains unresolved.

## Procedure

For each run, launch the chosen command from the project root and enter a fresh account at the prompt. Each runs for at most 75 seconds after login and closes its connection afterward, without requesting an in-game logout.

```sh
npm run experiment:headless -- session-idle
npm run experiment:headless -- session
```

The idle variant sends no post-login packets. The session variant queues an ISAAC-encoded `NO_TIMEOUT` packet once a second. Both count incoming bytes without recording or decoding packet contents, and write progress every 15 seconds to their local JSONL logs. A queued write is not an acknowledgment. An early remote close returns a nonzero exit code; this is an expected observation in the idle experiment, not by itself proof of the cause.

## Client observations

| Variant | Run | Outcome | Elapsed | Bytes received | Keepalives queued |
|---|---|---|---|---|---|
| Idle | 1 | closed | 60,616 ms | 2,555 | 0 |
| Idle | 2 | closed | 60,607 ms | 2,646 | 0 |
| Idle | 3 | closed | 60,602 ms | 2,645 | 0 |
| Keepalive | 1 | deadline | 75,000 ms | 2,822 | 74 |
| Keepalive | 2 | deadline | 75,000 ms | 2,891 | 74 |
| Keepalive | 3 | deadline | 75,000 ms | 2,891 | 74 |

- **Idle:** in all three runs the connection closed between 60.60 and 60.62 seconds after login, which is the same point within about 14 ms. The `closed` outcome is the client's socket close event; the client did not initiate it, but it also did not decode a reason.
- **Keepalive:** in all three runs the connection stayed open until the 75-second deadline and was then closed by the client. In the first run the byte counter was still increasing between the 60-second observation and the deadline.
- Byte totals differ slightly between runs (2,555 to 2,646 idle; 2,822 to 2,891 keepalive). We did not decode the payloads, so we don't know why, and we draw no conclusion from the differences.
- The counts and timings describe these six runs on one local server, not guaranteed server behavior. Since incoming packets are not decoded, the client cannot say what the bytes mean, establish game-state correctness, or directly prove that each keepalive was accepted. It intentionally closed the connection at the deadline.

## Source interpretation and other verification

The pinned browser client sends `NO_TIMEOUT` after a second without outgoing data; the pinned engine declares that opcode as 120 and uses ISAAC for client opcode encoding. The engine source sets a nominal 60-second no-response timeout. These source observations are consistent with, but separate from, the experiment's observations. The experimental ISAAC implementation was adapted from the pinned MIT-licensed LostCity browser client; its license is retained beside the code. A deterministic check compared 1,024 outputs with that pinned implementation, and automated tests exercise the bounded scheduler, connection closure, interrupted run, send error, and an opcode test vector without a live server.

## Limitations and next questions

- The idle close was consistent across three runs and matches the engine's 60-second no-response timeout in the source, but the close reason remains a transport observation, not a decoded game outcome. We did not deliberately shut down the server during a run or decode a server logout packet, so server-initiated closure for other reasons is untested.
- We cannot show that each keepalive was received; we only observed that sessions sending them stayed open and sessions sending nothing did not. A keepalive run longer than 75 seconds was not tried.
- We have not verified longer runs, game-state decoding, reconnection, or a clean in-game logout. No multiple-client manager was tested; the two independent experiment processes happened to overlap.
- Client logs contain aggregate counts only; no credentials, cipher seeds, raw payloads, or account names are logged. They are local diagnostic artifacts, not agent observations or a durable event history.
