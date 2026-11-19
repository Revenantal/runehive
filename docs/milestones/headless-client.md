---
id: M2
title: "Build the Headless Client"
delivers: "A working Headless Client usable through typed commands and TypeScript scripts."
depends_on: [M1]
design: []
builds:
  - { name: "Existing server SQLite diagnostic monitor", system: lostcity-and-headless-client, status: done }
  - { name: "Disposable headless client discovery prototype", system: lostcity-and-headless-client, status: in-design }
  - { name: "Protocol and session layer (login, maintenance, reconnect)", system: lostcity-and-headless-client, status: in-design }
  - { name: "Client state (position, nearby targets, inventory, skills, interfaces)", system: lostcity-and-headless-client, status: in-design }
  - { name: "Generic interact action", system: lostcity-and-headless-client, status: in-design }
  - { name: "Typed CLI and scripting interface", system: lostcity-and-headless-client, status: in-design }
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
| Protocol and session layer (login, maintenance, reconnect) | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | In design |
| Client state (position, nearby targets, inventory, skills, interfaces) | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | In design |
| Generic interact action | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | In design |
| Typed CLI and scripting interface | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) | In design |

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

## Done when

The owner can log in, walk, inspect state, and interact by typing commands. A small script can use the same headless client interface to interact with a tree and confirm an inventory or Woodcutting XP change from the game.
