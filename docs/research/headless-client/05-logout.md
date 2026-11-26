# 05 · Clean logout and abrupt disconnect

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can the client ask the server for a clean in-game logout after login, and how does that differ from just dropping the connection? Setup matches the [session experiments](04-session-maintenance.md): pinned source revisions, the owner-approved production configuration, the existing local world, and one fresh experimental account per run (a human-only read-only check confirmed none existed beforehand). Every login reported staff level 0.

## How a logout is requested (source observations)

- The pinned client has no dedicated logout packet. The logout tab's button sends the ordinary interface-button packet (`IF_BUTTON`, opcode 9, one two-byte component id, opcode ISAAC-encoded like the keepalive).
- The pinned content handles that button in `[if_button,logout:try_logout]`: it closes any open modal, refuses in a few situations (a duel, a particular ball-game area), and otherwise calls `p_logout`. The engine then marks the player as logging out on a following tick, runs the logout script, saves, removes the player and sends the server's `LOGOUT` packet.
- The engine ignores a button whose interface is not visible. The logout tab is set up for both normal players and Tutorial Island players, so the button is expected to be visible on fresh accounts.
- **Experiment-only shortcut:** the client sends component id 2458 (`logout:try_logout`), read from the pinned interface pack. A production client must learn interface layout from the protocol and cache instead of hard-coding it. This is interface layout, not a game mechanic, but it is still preloaded knowledge and is recorded here as such.

## Procedure

Each experiment logs in, waits 5 seconds so the world finishes setting up the player, then either clicks the logout button (`logout`) or closes the socket without any request (`logout-abrupt`, the control). It then tries to log in again with the same account, first after 1 second and then every 16 seconds, stopping on the first acceptance, on any rejection other than code 5, or after a fixed number of attempts. The 16-second spacing stays under the engine's per-device limit of five login attempts per 15 seconds in production mode. The second session, if accepted, is dropped without a logout, so that account stays marked as logged in until the server's own timeout.

```sh
npm run experiment:headless -- logout
npm run experiment:headless -- logout-abrupt
```

## Client observations

| Variant | Run | Connection closed | Relogin result |
|---|---|---|---|
| Clean logout | 1 | 397 ms after the click | accepted at 2.19 s (first attempt) |
| Clean logout | 2 | 402 ms after the click | accepted at 2.19 s (first attempt) |
| Clean logout | 3 | 404 ms after the click | accepted at 2.20 s (first attempt) |
| Abrupt disconnect | 1 | by the client, at the request | code 5 at 1.5 s, code 5 at 18.0 s, accepted at 34.6 s |
| Abrupt disconnect | 2 | by the client, at the request | code 5 at 1.5 s, code 5 at 18.0 s, accepted at 34.6 s |

- After the button click the server closed the connection within about 400 ms, in all three runs. A relogin about a second later was accepted at once.
- After an abrupt disconnect, a relogin about a second later was rejected with code 5, which the pinned browser client labels "already logged in". It was still rejected at 18 seconds and accepted by 34.6 seconds. We only sampled at 1.5, 18.0 and 34.6 seconds, so the real release time lies somewhere between 18.0 and 34.6 seconds.
- In these runs a clean logout therefore freed the account between roughly 16 and 32 seconds sooner than an abrupt disconnect (accepted at about 2.2 s, against a release point somewhere between 18.0 s and 34.6 s).

## Human-only cross-check (not a client observation)

The existing SQLite session log, read with `runehive monitor`, agrees. For a clean logout it records `Logged out` in the same second as the socket closing. For an abrupt disconnect it records `TCP socket closed` first and `Logged out` about 31 seconds later, which matches the engine's 30-second no-connection timeout in the source. The client never read this log, and a server-side record is not evidence the client could have used.

## Interpretation

The evidence that the clean logout worked is two separate client-visible facts: the server closed the connection promptly after the click, and the account was immediately available again. Neither alone would be enough, since a server could close a connection for other reasons. The abrupt control shows what the same relogin looks like without a logout, so the difference is attributable to the button click rather than to the passage of time.

## Limitations and open questions

- At the time of these runs the client did not decode server packets, so "the server confirmed the logout" was inferred from the close and the relogin. The packet framer added later (see [07 · Visibility](07-visibility.md)) shows the server's `LOGOUT` packet arriving once after the button click in every `observe` run, which confirms it directly.
- A click the server ignores would show up as no connection close within the 15-second wait. That outcome is covered by tests but did not occur live, so we have not seen what an ignored or blocked logout looks like in practice. We did not test a logout refused by the content (a duel, combat, a busy player, an open dialogue).
- Only Tutorial Island accounts were tested, with no game actions taken first.
- The plan asks to compare script-driven and CLI-controlled logout. What exists is a CLI command that runs a fixed script (log in, wait, log out). There is no way yet to tell an already-running client to log out, which would need some form of inter-process control. That question belongs with the multiple-client work.
- Character state was not compared before and after logout, so saving was not verified from the client side.
- Two runs of the abrupt control and three of the clean variant are small samples, from one local server.
