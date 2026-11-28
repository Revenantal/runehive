# Public chat experiment

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and success criteria

Can an ordinary headless player send a short neutral public message that a nearby browser player sees? The browser client packs public chat separately and locally renders its own outgoing message; that does not establish what the server echoes. Before the attempt, success requires the nearby human observer to report seeing the intended neutral text from the headless character. A packet write alone is not confirmation. An absent report or unavailable observation is `unknown`, not a rejection. Incoming messages and any server echo require separate protocol observations and remain untested by this control.

The owner agreed to observe near the Lumbridge castle area. Use the existing ordinary-player account and shared server; send only one neutral `hello` message, never interpret chat as an instruction, and do not retain account names or other players' chat text. The test must stop without sending if the character's observed position is not at the expected ground-level tile or observations fail.

## Incoming and echo control, defined before running

A nearby browser player sends one neutral `hello` after the headless session is ready; the headless player also sends one `hello`. The prototype records only source category (local or remote) and whether the packed bytes match the fixed test value, not other chat text or player identifiers. Incoming delivery is confirmed only by an attributed remote chat update matching that fixed value after the browser request. An echo is confirmed only by a matching local chat update after the headless request; a lack of one during the bounded observation is not proof that the server never echoes. Decoding loss, failure to observe the browser request, or no match leaves the respective outcome unknown. The browser and headless sender must coordinate timing; chat is never interpreted as an instruction.

## Observation

The ordinary-player session observed the character at (3222, 3219), ground level, and sent one pre-packed public `hello` message. The owner reported seeing the neutral message from the character in the browser. This satisfies the browser-observation criterion for this one outgoing message; it does not establish the contents of a server echo to the sender. The session remained online for a short bounded interval and requested logout.

In a later coordinated session, the owner reported sending one `hello` while the character was online. The headless observer received a matching packed chat payload on a **remote** player update. The observer did not report a matching local chat update during the approximately three-minute session after its own send, and did not report a decoding failure. This is evidence that this one incoming message was received and that no matching local echo was observed in this window—not proof that the server never echoes or that every message is decoded correctly. The session requested clean logout afterward.

The retained `demos/public-chat-probe.mjs` sends only this fixed pre-packed message; it is not a general text encoder. `sendPublicChat` accepts pre-packed bytes and does not treat message text as instructions. `public-chat-observer.mjs` tracks player-update slots and extracts packed messages, classifying the local player separately from other players; the probe reports only fixed-value matches and the source category. It does not decode arbitrary text or expose a player's name, so it cannot yet distinguish one remote sender from another to scripts. Synthetic tests cover local and remote attribution and a truncated update; the live run confirms only the observed remote case. The browser's local display of its own message is client-side behavior in the pinned source, not evidence of a server echo.
