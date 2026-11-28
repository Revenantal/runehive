# Observations, freshness and action outcomes

[Client blueprint](../README.md) · [World state](../engines/world-state.md) · [Action coordinator](../engines/action-coordinator.md)

**Status: proposed contracts for review, not final TypeScript types.**

## Separate what happened from what it means

- A **request** records intent, target, selected option and declared criterion; a packet write is not proof of execution.
- An **observation** records what the ordinary client actually received or derived from validated client assets, with source, scope, session and evidence reference. A label or item description is client-visible text, not proof of a mechanic.
- An **interpretation** explains how observations relate to a criterion; it may remain uncertain when another actor or an unrelated event could have caused a change.
- A **hypothesis or verified fact** is future agent/memory work, backed by appropriate observations; the deterministic client must not silently turn an interpretation into gameplay knowledge.

## Freshness and absence

| State | Meaning | Permitted inference |
|---|---|---|
| `known` | Observed and current under a defined scope/revision | Use the value within that scope, after action-time revalidation |
| `stale` | Previously known but invalidated or no longer reliable | Do not use as current evidence |
| `unknown` | Not observed, unsupported or observation continuity lost | Do not infer absence, safety or failure |

A `null`, `false`, zero or empty list from a convenience helper means no match **only** for a known, current and explicitly searched scope. For unavailable state, the proposed default stops the script with a structured `unknown`. Exact implementation—typed result, managed control-flow signal or another reviewed mechanism—is open. A scope can be incomplete: no nearby target observed does not mean none exists elsewhere.

## Action outcomes

`completed` requires the action's **specific, declared criterion** and supporting subsequent evidence; `unknown` means that criterion could not be established. An explicitly observed and sufficiently correlated refusal may be a `refused` outcome; whether this is separate from other variants is undecided. A generic interaction that observes an interface open or a change is not automatically success at a larger task, nor proof every concurrent change was caused by the request.

A timeout is not `blocked`, cancellation or proof of failure. A returned `unknown` does not mean an action ended on the server. Progress may be recorded without completion. A known refusal may still be unsafe to correlate with a particular request. Reconnect gives new observations, not a retroactive complete trace. Gate subsequent mutating actions until safe according to [execution and recovery](execution-recovery.md).

## Contract examples

- **Walk:** observed position reaches the target on the requested level; no observed arrival by deadline is `unknown`.
- **Equipment:** a relevant equipment update demonstrates the specified item is worn; a request alone is not completion.
- **Unfamiliar interaction:** report the exact observed change, refusal or lack of conclusion; do not invent a domain-specific success criterion from the option label.
- **Dialogue:** an open prompt, changed text, choice control and close are separate observations; close does not prove natural conversation or quest completion.

For all examples, the correlation rules, evidence IDs, timestamp policy, known-unavailable capability variants and outcome serialization need a concrete reviewed schema. Preserve decision records and evidence, not private model reasoning. Research: [17](../../../research/headless-client/17-multi-action-session.md), [18](../../../research/headless-client/18-npc-dialogue.md), [19](../../../research/headless-client/19-inventory-equipment.md), [24](../../../research/headless-client/24-reconnect-and-scene.md).
