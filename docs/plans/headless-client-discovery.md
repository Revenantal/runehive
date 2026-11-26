---
title: "Explore the headless client"
status: in-progress
milestone: M2
system: [lostcity-and-headless-client]
---
# Explore the headless client

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In progress
- **Milestone:** [M2 · Build the Headless Client](../milestones/headless-client.md)
- **System docs changed:** [LostCity and the Headless Client](../system/lostcity-and-headless-client.md)
<!-- status:end -->

## Why

Revise M2's preliminary discovery sequence into small experiments that test an ordinary-player session and inform the eventual production client. The prototype is disposable: keep it available for education during this work, then decide what to retain. Findings are not production design until reviewed.

The longer-term client should expose game actions to a controller that can write JavaScript and use feedback to decide what to do next. This discovery work investigates what feedback is possible; it does not implement an LLM, execute generated code, or settle the production API. Human nudges remain advisory, not execution authority.

## Boundaries

- Keep the server fully vanilla. Never modify LostCity server source to make an experiment work; change server configuration only with explicit owner approval. The owner approved setting the existing world's `node.production` to true to test ordinary-player sessions. Stop and discuss other server changes. Normal upstream-generated runtime state and ordinary player actions are distinct from server modification.
- The experimental client uses only ordinary player protocol observations and actions. No teleporting, item grants, direct game-state edits, privileged server logs, or database reads as client observations. The existing server monitor is a separate human debugging aid.
- Use the pinned Revision 274 sources and record revisions and environment per experiment. Verify compatibility and ordinary-player permissions rather than assuming them.
- Use fresh characters for independent test rounds, starting with `HX0000` and incrementing. Verify username restrictions. Reusing an account is intentional for reconnect and persistence tests. Each account's password matches its username; these accounts are disposable and local only.
- Treat account names as credentials because they equal passwords. Do not persist them, authentication payloads, or raw sensitive packet data in prototype logs or findings. Use separate non-secret client/run IDs, redact errors, and keep local logs out of Git. The existing server and its monitor may expose usernames independently; handle their output accordingly. Inspect sensitive data only when needed for local debugging; do not retain it.
- No new server instrumentation or general logging framework. Do not preload game mechanics or use server internals as a substitute for gameplay observation; source is a protocol reference, not agent knowledge.

## Plan

Run these sequentially as short experiments. At each checkpoint document the question, setup, exact reproduction steps without credentials, observations, results, uncertainties, failures, source revisions, and implications. Pause for review before progressing; refine later experiments as evidence warrants. Record evidence in `docs/research/headless-client/`, with an index and individual Markdown experiment notes; link the index from the documentation index when created. Distinguish observed facts, hypotheses, and interpretations.

1. **Bootstrap and baseline:** create a minimal disposable client, commands to start and stop experiments, and command documentation. Record the runtime and environment; verify clean shutdown and actionable startup failures. Prefer a small CLI to launch scripted experiments initially; defer a persistent manager until there is evidence for it.
2. **Client diagnostic logging:** write structured JSON Lines locally, attributed by non-secret run and client IDs. Capture lifecycle, actions, observations, outcomes and errors without credentials. Determine retention and safe cleanup; logs are diagnostic, not durable agent Event History. Test redaction and useful failure context.
3. **Account and login:** use a fresh experimental account and investigate normal creation and login; confirm an accepted session through client-visible evidence. Test a controlled rejected login, differentiating authentication, transport and protocol failures. Reconnect an existing character to investigate identity and persistence.
4. **Session maintenance:** hold a session open for a bounded period, observe required maintenance and relevant updates, and investigate server-initiated closure.
5. **Logout and disconnect:** schedule a clean logout after login; compare script-driven and CLI control where practical. Separately test abrupt disconnect and reconnect. Do not assume either saves or immediately releases the session.
6. **Multiple clients:** connect multiple independent accounts concurrently. Compare one process per client and a single manager if useful; verify attribution, isolation, failure handling and cleanup before choosing a control approach.
7. **Initial state and movement:** identify what position, surroundings and interface state the client can actually decode. Request one nearby move and observe its outcome, then try bounded, reproducible seeded movement. Investigate an obstructed or unreachable destination and interruption by another action when safely testable.
8. **NPC:** identify an NPC from client-visible state, request an interaction, and observe the response; compare intent with outcome.
9. **Dialogue and tutorial exit:** identify the relevant NPC and prompt through normal observations, make a selection, and verify the resulting state. The proposed tutorial-skip route is a hypothesis, not a known game fact.
10. **Tree:** in the main world, identify and interact with a tree. Look for client-observed evidence such as an inventory or skill change; distinguish this from merely sending a request.

For every action experiment define a success condition before the attempt. Record intent, request, client-visible observations, and an outcome linked to the attempt. Explore progress, rejection, blocking, interruption, and deadlines where relevant. Distinguish observed success or clear failure from an **unknown** outcome; a timeout alone is not proof of failure. Record what evidence is available and where correlation between request and outcome remains uncertain. This is experimental vocabulary, not a settled production schema.

## Done when

- Each applicable checkpoint is reproducible and its results, gaps, and lessons are recorded; blocked phases identify the blocker and stop rather than modifying the server.
- The prototype demonstrates the achievable sequence through tree interaction, or documents a reviewed blocker and the owner's decision on how to proceed.
- Findings identify what action and feedback semantics the future client can support, including unresolved uncertainty, without relying on privileged diagnostics.
- Experimental code and logs have an explicit retention or removal decision, and any proposed production design is reviewed separately.

## Implementation

Bootstrap, initial lifecycle logging, and the first ordinary-player login experiments are documented in the [experiment index](../research/headless-client/README.md). The prototype can authenticate, has completed a bounded idle-versus-keepalive comparison, and can request a clean logout through the logout button, which it compares with an abrupt disconnect (logout is inferred from the connection close and a prompt relogin, not from a decoded server packet; there is no control of an already-running client yet). Six concurrent clients have been run as separate processes, in one process, and against the owner's server from another machine ([08 · Running and managing several clients](../research/headless-client/08-managing-clients.md)); the design choice between a manager and process-per-client, and the device-identity policy, are open questions recorded in [06 · Multiple clients](../research/headless-client/06-multiple-clients.md). The prototype now also frames the server's packet stream and decodes who a client is told about; browser characters and clients started from the sandbox did not see each other because they were on two separate game servers; only the owner's server is kept running ([07 · Visibility](../research/headless-client/07-visibility.md)). Account freshness was checked for one experiment by a human diagnostic; character-state persistence remains unverified from client observations. It decodes only the player-visibility section of server packets; action, observation, and protocol-error logging need further work as those behaviors are explored. No production client or LLM integration is implied by this plan.
