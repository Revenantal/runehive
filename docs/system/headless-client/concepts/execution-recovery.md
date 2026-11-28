# Execution, interruption and recovery

[Client blueprint](../README.md) · [Action coordinator](../engines/action-coordinator.md) · [Session and protocol](../engines/session-protocol.md)

**Status: proposed.** The same coordinator and evidence rules apply whether a future runtime asks for a single interactive action or a script requests a sequence.

## Default sequence

1. A caller supplies a validated bounded action; the host checks capabilities and resources. The coordinator verifies session readiness, relevant freshness, current handles and that no incompatible action is in flight.
2. The appropriate engine performs supported ordinary-player requests. Packet receipt, action progress and declared completion are distinct. A helper reports the evidence-based result to the host.
3. The script continues only after its action's completion criterion is observed and the coordinator establishes safe follow-on. On refusal, unknown, unavailable prerequisites or other unexpected outcomes, stop the script and return a structured result, including observed changes and evidence, to the future AI/runtime for review. This is host-enforced, not a convention relying on the LLM to remember `if` checks.
4. Scripts carry out planned actions; the AI reviews unexpected results and decides whether to revise its plan. Do not add a script-level result-handling escape hatch as part of this design. Reporting an `unknown` result is not authorization to issue another unsafe action. No automatic retries, alternative clicks or interpretation of untrusted text are implied. Any future proposal to allow scripts to handle unexpected action results requires renewed owner review.

## Urgent unexpected observations

An apparent attack during a planned activity is a future investigation, not a verified universal event or an automatic combat policy. If supported observations indicate a potentially urgent change, the future host should promptly surface their source, confidence and evidence to the AI/runtime, including during quiet navigation. The working direction is to stop the planned script for review, but the exact event thresholds and false-positive handling require evidence and owner review. Stopping execution does not establish that the game activity stopped; any follow-on or attempted interruption remains subject to the coordinator's safety gate. The client must not automatically fight or flee. See the [milestone's focused investigation](../../../milestones/headless-client.md#being-attacked-during-an-activity).

## On interruption

A timeout ends waiting, not necessarily the game action. Client-observed plain-walk interruption of two tree cases is useful evidence, not a universal cancel primitive ([21](../../../research/headless-client/21-cancelling-and-legs.md)). Cancellation is an action request with its own evidence and can itself remain unknown. A disconnect invalidates session-bound confidence and transitions any in-flight action into an unresolved state. Do not send a follow-on action merely because the original script exited.

On bounded reconnect, initialize fresh trackers and observe position, region, inventory, interfaces and scene as received. Compare new evidence to the prior action's declared criterion; a later destination observation can establish arrival, but cannot fill in the unobserved route or prove when it occurred. If sufficient safe state cannot be established, report unresolved and stop ([24](../../../research/headless-client/24-reconnect-and-scene.md)). Which observations can admit a new action is a design and testing decision.

## Generated-script boundary

No LLM calls or generated-code execution are authorized by this outline. Before such execution, separately review isolation and least privilege, output and capability validation, wall time, CPU/memory/action limits, process and session cleanup, cancellation and hostile input. In-game text, chat, interface labels and human nudges are untrusted data. A JavaScript type checker or `vm` alone is not an established security boundary. Human-approved hand-written scripts are a distinct earlier test stage, not evidence of isolation.

## Verification

Use deterministic fake clocks and sessions for overlapping requests, deadlines with ongoing movement, late results, refusal attribution, cancellation attempts, reconnect retries and stale/unknown state. Verify logs exclude credentials, authentication payloads and unneeded personal text. Live tests use the single shared vanilla server and ordinary-player actions. Persist explicit decisions and evidence, not hidden reasoning.
