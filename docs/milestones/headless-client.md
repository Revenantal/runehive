---
id: M2
title: "Build the Headless Client"
delivers: "A working Headless Client usable through typed commands and TypeScript scripts."
depends_on: [M1]
design: []
builds:
  - { name: "Existing server SQLite diagnostic monitor", system: lostcity-and-headless-client, status: done }
  - { name: "Disposable headless client discovery prototype", system: lostcity-and-headless-client, status: in-design }
  - { name: "Protocol and session layer (login, maintenance, reconnect)", system: headless-client-modules, status: in-design }
  - { name: "Client state (position, nearby targets, inventory, skills, interfaces)", system: headless-client-modules, status: in-design }
  - { name: "Generic interact action", system: headless-client-modules, status: in-design }
  - { name: "Typed CLI and scripting interface", system: headless-client-modules, status: in-design }
---
# Build the Headless Client

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In progress (from its builds)
- **Depends on:** [M1](local-lostcity.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Existing server SQLite diagnostic monitor | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | Done |
| Disposable headless client discovery prototype | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | In design |
| Protocol and session layer (login, maintenance, reconnect) | [Headless client modules](../system/headless-client-modules.md) | In design |
| Client state (position, nearby targets, inventory, skills, interfaces) | [Headless client modules](../system/headless-client-modules.md) | In design |
| Generic interact action | [Headless client modules](../system/headless-client-modules.md) | In design |
| Typed CLI and scripting interface | [Headless client modules](../system/headless-client-modules.md) | In design |

**Plans** (revisions to this milestone's builds)

| Plan | Status |
|---|---|
| [Explore the headless client](../plans/headless-client-discovery.md) | In progress |
<!-- status:end -->

## Goal

Build a TypeScript headless client that connects to the private Revision 274 world as an ordinary player. Make it usable through typed CLI commands and TypeScript scripts.

## Initial work: logging and preliminary discovery

This is the first part of M2, not its complete scope. First improve diagnostic logging; then use a disposable proof of concept to investigate the ordinary-player protocol and the minimum client behavior needed for a real session. The prototype is preliminary discovery, not the production client or the project's durable Discovery Memory. Keep it available for reference while this line of work continues, then decide what to retain or remove. Do not assume that prototype code or exploratory findings are ready for production without review.

### 1. Diagnostic logging

- Prefer the existing LostCity SQLite logger and the human-facing monitor. Inspect and display useful existing records before considering any custom server instrumentation, new logging infrastructure, or an upstream modification.
- Check coverage against the owner's wishlist: successful and failed login attempts, logout, movement, clicks and interactions, opened prompts and dialogue selections, equipment changes, shop purchases, and items collected. Distinguish a request, a server-recorded event, and a confirmed outcome. Verify representative events in play and record missing or filtered events rather than implying complete coverage.
- Keep the default value threshold of 10 to limit logging volume. Upstream emits shop and pickup wealth-event types to `session_wealth`; its value filter applies to pickups and drops, not shop transactions. Verify representative events in the running world and accept that low-value pickups and drops may not be recorded. The read-only monitor displays both session and wealth records; the owner's manual test confirmed shop sales, a purchase, and above-threshold drop and pickup records.
- Source inspection shows `session_log` includes login/logout, some item interactions, and periodic check-ins carrying a packed coordinate. Upstream schedules these every 50 ticks (nominally 30 seconds), so they are position snapshots, not complete movement trails. The human-facing monitor decodes and displays these coordinates.
- Upstream NPC interactions, interface buttons, dialogue continuation, and movement requests have handlers but no general session-log call in those handlers. Some scripts may emit their own events; do not assume complete interaction coverage. Mouse input tracking is separate, binary, and inactive by default, so it is not a readable or complete server-side action log. Verify coverage through normal play and record the gaps.
- Establish a simple way for the prototype to report what it is doing and observing, including errors and action outcomes. Choose the format during the prototype work; do not build a general logging framework or log passwords or authentication payloads.
- Keep diagnostic visibility separate from agent perception: agents must use only normal client-protocol observations, not privileged server logs or database reads. Preserve the unmodified LostCity boundary. If a wishlist item is not available upstream, document the gap and discuss alternatives before building custom server-side tracking.

### 2. Disposable proof of concept: discovery sequence

The [discovery experiment plan](../plans/headless-client-discovery.md) revises this sequence into incremental checkpoints: bootstrap, client logging, account and session lifecycle, multiple clients, movement, NPC and dialogue interaction, and tree interaction. Record intent, requests, observations, outcomes, uncertainties, and reproducible evidence. The prototype is not the production client; stop and discuss blockers rather than modifying the vanilla server.

## Objectives and plan

- Use the [local LostCity setup](local-lostcity.md) to validate login, session handling, movement, and basic state updates.
- Expose position, nearby targets, interaction options, inventory, skills, and relevant interface state as the client learns to decode them.
- Provide a generic `interact` action that accepts an available interaction option for a target. Expose the same client operations to the CLI and scripts.
- Start with a small playable slice. If stock compatibility blocks it, record what failed and evaluate the fallback options in the headless client design.

## Proposed build outline for review

The [client blueprint](../system/headless-client/README.md) sketches subsystem responsibilities, candidate script capabilities and UML-style diagrams. The [end-to-end scenarios](../system/headless-client/examples/plans.md) trace requests, observations and decisions. They are proposals, not an implemented API or a settled execution boundary. Use the [discovery research](../research/headless-client/README.md) as evidence, not as production code to copy wholesale.

1. **Agree contracts and boundaries.** Review what observations are exposed, freshness and action-result semantics, session ownership, credentials and how scripts receive capabilities. Favor domain helpers such as `inventory.find` and `inventory.interact` over making the AI write generic searches and slot-handling code. Design a safe execution boundary before running generated scripts. Choose any new dependencies only after the required review and owner approval. Decide the durable protocol cipher approach independently of the attributed experimental implementation.
2. **One-session vertical slice.** Implement a TypeScript ordinary-player session, lifecycle and bounded reconnect behavior; decode a minimal observed player position and relevant scene inputs; expose a typed read and one bounded movement action to a CLI and a trusted hand-written script. Verify arrival from subsequent updates, and keep timeout and disconnect outcomes unknown. No model calls or untrusted generated code.
3. **Fresh state and action coordination.** Add explicit freshness and evidence, one in-flight mutating action per client, cancellation attempts and safe follow-on gating. Investigate how fresh state is reconstructed after disconnect and how scene updates, zone resets and rebuilds affect collision confidence; fail closed when reconciliation is incomplete.
4. **Target interaction and inventory evidence.** Expose currently observed targets and options, request one generic interaction with a declared observation criterion, and support inventory/skill updates sufficient for a bounded tree interaction. Test explicit refusal, silence and uncorrelated changes separately from completion.
5. **Dialogue, items and broader navigation.** Incrementally cover dialogue choices, equipment and item-on-target actions, then scene-aware navigation, region boundaries and supported door/ladder transitions. Each extension needs synthetic and representative ordinary-player verification; an unsupported path remains unknown.
6. **Review script execution and later integration.** Define and test resource limits, capability isolation, input/output validation and treatment of untrusted game text before any generated script is run. LLM selection and model calls belong to later milestones and remain undecided.

These stages are an initial ordering, not a promise that M2 implements all later navigation, memory or agent capabilities. Exact stage boundaries and acceptance criteria require review. For each implemented method, add it to the grouped package API reference and link to a detailed developer-facing method contract created alongside the API code. Keep proposed or unfinished methods in the separate [system API plan](../system/headless-client/api-plan.md), not in the package's implemented reference. The contract must cover input and return types, side effects, outcomes, evidence, limits and examples, with concise code documentation and verification against implementation. Tests must cover framing and state updates, stale/unknown transitions, action admission, disconnects and representative live observations without server instrumentation or privileged game state.

## Planned UI discovery follow-up

Near the end of the planning/design work, before claiming general interface coverage, run a bounded ordinary-player investigation of **one skill guide and the quest journal**. Dialogue, inventory and equipment have been observed, but these interfaces have not. The [interaction and interface outline](../system/headless-client/engines/interaction-interface.md) describes the proposed general model; this follow-up tests its assumptions rather than assuming those interfaces are already supported.

Before each live request, record the verified client revision, a safe reproducible starting state and the exact success criterion. Use the existing shared server; never start a second server or modify upstream. Use client-visible assets, messages and state only. Avoid saving credentials, account names or unrelated private text. Inspect client code as a protocol/UI reference, not a source of preloaded quest or skill mechanics.

1. **Observe the entry point:** determine whether the ordinary graphical client opens the relevant view locally, sends a button request, or does both. Identify the visible control from client data or a synchronized human browser observation; do not invent an interface ID or assume a server response.
2. **Open and inspect one skill guide:** capture the supported interface root, visible labels and currently available controls. Success means the relevant open state and at least one displayed control/text element can be reconstructed from ordinary-client inputs; otherwise report `unknown` and the missing input.
3. **Open and inspect the quest journal:** apply the same criterion separately. Preserve unknown or unavailable quest content as unknown and do not infer quest requirements.
4. **One safe navigation action per interface:** if an observed control is clearly available and low risk, choose it once and require a subsequent observable UI/state change. A local-only change needs client-side evidence; silence or timeout does not prove refusal. Stop on stale controls or unhandled interface updates.
5. **Compare and document:** ask whether a generic interface tree and control contract can describe both cases, what remains client-local, and how an AI could inspect choices without rendering. Retain a focused, sanitized reproduction and tests for any new decoder. Record unsupported parts and revise the system outline rather than claiming universal UI support.

This is planned work, **not an executed experiment or a blocker to outlining the other engines**. If current observations cannot support it without broad new work, record the limitation and seek review before expanding the prototype.

## Future focused investigations

These are planning notes, not verified mechanics or authorization for an immediate live experiment. Schedule them when the relevant ordinary-player interface, state and action coordination are ready. Before live play, agree safe starting conditions, loss/risk limits and success criteria; use only the one shared vanilla server and observable client data. Stop and report unknown if the required state cannot be observed.

### Bank and shared containers

Investigate one ordinary-player bank interface, its observed item slots, capacity where available and currently exposed deposit/withdraw controls. Compare its update and slot behavior with inventory and reuse a common container model where supported, while preserving bank-specific access, freshness, stacking, control and protocol differences. Do not preload bank locations or contents, or imply bank access when the interface is closed. Set explicit success and resource-risk limits before any live action; missing or stale bank state remains unknown.

### Shop interfaces and prices

Investigate how one ordinary graphical-client shop exposes current items, quantities, buy/sell controls and prices. Establish whether a price is displayed directly or requires selecting an observed option, and record what quantity and transaction side a quote applies to when visible. Compare the headless observations with the ordinary client. Treat absent, stale or ambiguous prices as unknown; do not preload shop stock or infer a transaction price from static item values. Separate an observed quote from evidence of a completed purchase or sale. Define a bounded success criterion and agree any currency or item-spending risk before live transactions.

### Item-on-item interaction: fletching

The owner identified fletching as a useful example of using inventory items together. Investigate the ordinary client's visible item selection and item-on-item interaction, any resulting interface and choices, repeated or ongoing activity, item and skill updates, and refusals. Discover the actual inputs and available options in play; do not hardcode recipes or assume that a successful request necessarily produces an item. Distinguish the requested combination from observed changes and test stale or moved inventory slots, ambiguous items, unavailable options, interruption and full inventory. Record evidence, unknowns and any reusable inventory-use requirements.

### Being attacked during an activity

Investigate how an ordinary client can observe a character being attacked while another action is in progress, including relevant messages, animations, hit or health updates, target and activity changes, and what is or is not sufficient to establish an attack. Do not assume any single signal is conclusive. Compare whether and how the activity stops or continues, and whether a safe follow-on can be established; a timeout or script stop is not physical cancellation.

Design how a sufficiently supported urgent observation reaches the future AI/runtime promptly, including during quiet navigation or an ongoing interaction. Explore stopping the planned script and reporting the evidence so the AI can decide what to do; the client must not silently initiate combat, flee or assume a safe action. A signal that is ambiguous should be labeled as such. Any interrupt, defensive action or continuation is subject to the coordinator's safety gate, and no model calls or generated-code execution are authorized by this note. Define and obtain owner approval for a bounded, low-risk live setup before testing, rather than deliberately exposing a character or another player to unapproved risk. Add synthetic tests for urgent event delivery, uncertain attribution, stale state, gaps, action gating and no automatic reaction.

## Done when

The owner can log in, walk, inspect state, and interact by typing commands. A small script can use the same headless client interface to interact with a tree and confirm an inventory or Woodcutting XP change from the game.
