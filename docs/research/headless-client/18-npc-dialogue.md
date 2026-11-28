# NPC identification and dialogue

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can an ordinary-player client identify a nearby NPC from client-visible data, ask to talk to it, and follow the resulting dialogue, reporting only what it observed? Use the owner-prepared disposable main-world character in Lumbridge, the shared server, and client configuration fetched through ordinary client interfaces and checked against the advertised archive checksums. No NPC names, options, or dialogue are preloaded or assumed: the experiment reads them from what the client receives.

## Stage 1: identify, read-only. Success defined before running

Observe the session for a bounded period. The NPC visibility decoder reports indexes, type IDs and positions relative to the character's observed position. Resolve each type ID through the client's NPC configuration (name and visible option slots). Report success if at least one visible NPC resolves to a name and its visible options, and every type ID that cannot be resolved is reported `unknown` rather than guessed. Nothing is sent except keepalives and logout. The nearby list is a snapshot of what the server sent, not a complete census; extended attributes (appearance, animation, chat, damage) remain undecoded.

## Stage 2: talk, one interaction. Success defined before running

Choose a visible NPC whose resolved options include one named exactly `Talk-to` and which is close, decided from the stage 1 output. Send that option once for that NPC index. Record the server packets that follow, in order. Report `completed` only after the dialogue interface closes without the client choosing among options. Stop and report `unknown` (not failure) when: no dialogue-related packet arrives within a bounded time; the dialogue offers choices (the experiment will not pick any); the interface changes in a way the decoder does not understand; the page limit is reached; or the connection ends. Each dialogue page is advanced by clicking the continue button identified from the client's interface data, not by a hard-coded component number. The NPC may walk or move the character; observe that rather than assuming a position.

## Not claimed

This is one NPC and one conversation. It does not establish general NPC targeting, other interaction options, dialogue with choices, quest dialogue, trading, or combat, and it executes no generated code.

## Stage 3: a choice menu. Success defined before running

Hans opened an interface with no continue button. Client interface data describes 2469 as a three-option menu: a title component and three text components with button type 1, whose text the server sets. Stage 3 observes such a menu and answers it once, then follows the reply.

- **Observe:** report `choices` only when each button component under the open interface has non-empty text the server supplied before the interface opened. A menu with a missing text is `unknown`; do not guess.
- **Choose:** choosing is a deliberate parameter of the experiment (a 1-based option number), not agent logic. The disposable character, Hans and the first conversation menu are low risk; the driver clicks exactly one choice per run, and stops with `unknown` at a second menu.
- **Success:** after the click, observe a later dialogue event (a new chat page or a close). Report `completed` only if a close follows. A reply is evidence of an ordering, not proof that the click caused it; repeat with a different option to see whether the reply changes. No reply within the deadline is `unknown`.
- **Not claimed:** which option is best, what any option means, or any effect beyond the dialogue.

## Stage 1 observations

The retained read-only driver is `tools/headless-experiment/demos/npc-identify.mjs`. In a 12-second observation it received 20 NPC update packets without framing or decoding errors and listed 13 visible NPCs, within 14 tiles of the character. Every type ID resolved to a name and visible options; none was `unknown`. Names and options came only from the client configuration, for example a Cook with `Talk-to`; Men and Women with `Talk-to`, `Attack`, `Pickpocket`; a Bob with `Talk-to`, `Trade`; Rats with `Attack`; and a Butterfly with no options. Several nearby NPCs offer options with side effects, so the interaction code sends only an option whose text was resolved from these definitions, and only option 1 in the test below.

## Stage 2 observations

The retained driver is `tools/headless-experiment/demos/npc-talk.mjs`; it sends `Talk-to` only after the nearest NPC's first visible option resolved to exactly that text.

- **A talk request is asynchronous and server-driven.** The character walked toward the NPC (position updates followed the request) and the first dialogue packets arrived some seconds later in the first run, within about a second in later runs when already close. Position at the end of a run cannot be assumed to equal the position at the start.
- **Text arrives before the interface opens.** The server sets each component's text, then opens the chat interface. A decoder that ignores text for an interface that is not yet open loses the first page. The dialogue observer buffers text and attaches it when the interface opens.
- **The next dialogue interface is a new open.** Each page was a separate `IF_OPENCHAT`, alternating between a player-speaking interface and an NPC-speaking interface. The client clears its "already continued" flag on each open, so the driver sends one continue click per open, using the continue button found in the interface data rather than a hard-coded component.
- **Dialogue is not fixed.** The same NPC (a Woman) produced different conversations on three runs, of 2, 3 and 4 pages, and each ended with `IF_CLOSE`. All three reached `completed` under the definition above.
- **A page without a continue button stops the script.** Talking to the Hans NPC produced an NPC page and then an interface with no continue button. The driver stopped with `unknown` (`no-single-continue-button`) without choosing anything. Stage 3 below shows that interface is a three-option menu.
- **Dialogue shows the character's own name.** Player-speaking pages include a line equal to the character's display name, which here equals the disposable account name. The driver masks it before printing, since the name must not be kept in logs or docs.
- **Server packets seen after the request** (excluding player and NPC updates): `IF_OPENCHAT`, `IF_SETTEXT`, `IF_SETNPCHEAD`, `IF_SETPLAYERHEAD`, `IF_SETANIM`, `IF_SETHIDE`, `IF_CLOSE`, `UNSET_MAP_FLAG`, `UPDATE_RUNENERGY`, zone updates, and `OBJ_ADD` in one run.

The interface decoder (`tools/headless-experiment/interface-components.mjs`) decoded all 10,984 components in the client's interface archive without truncation, and found 42 interface roots containing a continue button. The decoder and its structure come from the client source; it is tested with a synthetic buffer, and not otherwise verified against the full archive.

## Limits and open concerns

- `completed` means a close was observed after a chat opened. `IF_CLOSE` may have other causes (for example the character being moved away), and this experiment does not prove that the conversation reached its natural end.
- The character's starting position was not the position the previous session ended in. Something outside these scripts, such as the owner or an earlier session's pending movement, moved it. We do not know which.
- Dialogue choices are not handled: choosing needs the option text and the buttons for each choice, and a policy for whether to choose at all. A later experiment should observe, not invent, a choice policy.
- Only the first NPC option was sent, and only for Talk-to. Trading, combat, pickpocketing and item use are untested.
- The configuration is fetched by `tools/headless-experiment/demos/fetch-config-assets.py`, which verifies archive checksums from the server's `/crc` list and writes to a new empty directory. It is a disposable Python helper for this prototype, not the durable client's acquisition.

## Stage 3 observations

`demos/npc-talk.mjs` accepts an optional NPC name and an optional 1-based choice number. Without a choice number it stops at a menu. With one, it clicks that option once, using the ordinary button packet, and then follows continue-only pages.

- **The menu is readable from client data.** Interface 2469 opened with a title and three options. The server set each option's text before opening the interface; the interface data identified the three option buttons (button type 1). The observer reported the menu only when every button had text, and reported `incomplete` otherwise (covered by a test, not seen live).
- **Options were observed, not assumed.** The three options for Hans were "I'm looking for whoever is in charge of this place.", "I have come to kill everyone in this castle!" and "I don't know. I'm lost. Where am I?".
- **Choosing works through an ordinary button click.** Clicking option 1 produced a player page repeating the chosen text, then Hans replied "Who, the Duke? He's in his study, on the first floor.", then the dialogue closed. Clicking option 3 produced "You are in Lumbridge Castle." and a close. Each run reached `completed` under the stated definition. Option 2 was not sent: an unneeded threatening choice adds no information here.
- **The reply followed the choice in these two runs.** Two samples show the reply differed, but this still does not prove the click caused the reply, and it does not show what other options do.
- **The server walked the character to a moving NPC.** Hans wanders. Chasing him took about 36 seconds in one run and, with a 30-second limit, ended as `unknown` with no chat opened and the character far from its start. A chat request's duration is unbounded in practice, so the deadline must come from the script's patience, not from a fixed number. The first successful runs needed up to a minute; later runs had Hans closer and took a few seconds.
- **Hans was not always visible.** Three runs found no `Talk-to` NPC named Hans in view, and the driver correctly sent nothing.

## Importance for the design

Selection menus are the main mechanism of quest and conversation flow, so dialogue with choices is a central capability, not an edge case. The module doc ([headless-client-modules](../../system/headless-client-modules.md)) treats dialogue as part of Interaction for now; it probably deserves to be its own module, exposing the open dialogue as state (speaker, text, `continue` or a list of choices) and `continue()` / `choose(n)` actions. That decision waits for formal planning. Nothing here proves a choice-handling policy: which option an agent picks is a decision for the agent layer, using what it observes.
