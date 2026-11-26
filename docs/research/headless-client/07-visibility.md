# 07 · Why browser characters and our headless clients did not see each other

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

**Status: explained.** The two groups were in two different game worlds. The cause was the setup, not the client or the server.

## Question

Browser characters could not see our headless clients, and our clients were never told about the browser characters. Clients that the owner started from their own shell did see the browser characters.

## Method

To measure what the server sends, the prototype frames the server's packet stream (incoming ISAAC cipher plus a length table generated from the pinned `ServerGameProt.ts`) and decodes the bit section of the player-update packet. That section lists which players the server adds to or drops from a client's view. The client's own slot comes from the `UPDATE_PID` packet. Appearance and other extended data are not decoded. This shows what the server *says*, not what a browser draws.

## Cause

Two LostCity servers were running, one in the agent's sandbox and one on the owner's host (`devserver`), and each had its own slots and players. Clients started in the sandbox connected to the sandbox server. The owner's browser and the clients started from the owner's shell connected to the owner's server. The agent's sandbox mounts the owner's checkout, so both servers ran from the same directory and used the same SQLite file. That is why accounts from both showed up in the same queries. The service manager could not tell, because it decided from a PID file and process scan, which only work on one machine.

The control test that showed it, with the owner's server and the sandbox server both running:

| Player | Server | Slot | Told about |
|---|---|---|---|
| sandbox client A (14:46:27) | sandbox | not recorded | only B |
| sandbox client B (14:46:37) | sandbox | not recorded | only A |
| owner's browser character (14:52:55) | owner's | 1 | not recorded |
| owner's headless client (14:53:48) | owner's | 2 | one player: slot 1 at offset (-1, 4) |

The offset matches the owner's browser character exactly: it stood at x 3093, z 3110, and the owner's client at the start tile x 3094, z 3106. The sandbox clients, four tiles from that position in coordinates, were never told about the browser character, because it was on another server. Listening processes confirmed it: the sandbox server held port 43594 as process 3549 and the owner's as process 2680535 (the host's process numbers are independent of the sandbox's).

This also explains the earlier "headless01" and "headless02" runs: the three players each was told about were the owner's browsers plus the owner's other clients, never the sandbox clients.

## Ruled out along the way

These were not the cause; each was tested before the cause was found.

| Candidate | Evidence |
|---|---|
| Our client code regressed | The first-login commit (`766c0ed`), run unchanged, behaved the same. |
| Stale server state | A graceful restart changed nothing. |
| Several clients at once | A single client behaved the same. |
| Raw TCP versus WebSocket | A WebSocket client saw nobody either. |
| Account name, skipping the design, never moving | Plain and `HX####` names, a submitted default design, and walking two tiles behaved alike. |

## Source reading (not verified by experiment)

- The engine builds each viewer's list from a shared zone map, with no per-connection branch that was found.
- A viewer is not sent the appearance of a character whose appearance version is still 0. Whether that affects how a browser draws a headless client that skipped the design was not tested. It is a separate question from the one above.

## Decision

The owner chose to run one server, theirs. The sandbox server was stopped on 2026-11-26. All clients, whoever starts them, must connect to the owner's server. The rule and a lock that enforces it across machines are recorded in [decision 0008](../../decisions/0008-one-lostcity-server-at-a-time.md).

## Limitations

- What a browser receives is known only from the owner's reports.
- Two servers wrote the same SQLite file for a while. No corruption was observed, but it is unsafe and was not checked.
- Whether a headless client that never accepts the character design is drawn by a browser is still untested.
