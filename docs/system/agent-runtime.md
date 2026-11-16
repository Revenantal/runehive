# Agent Runtime

[Project overview](../../README.md) · Built in: <!-- built-in -->[M6](../milestones/approach.md), [M9](../milestones/multiple-agents.md), [M10](../milestones/optional-features.md)<!-- /built-in -->

## Running multiple agents

The **Agent Manager** is a supporting deterministic service, not another planner level.

Responsibilities:
- Own independent bot identities and LostCity sessions.
- Restart/reconnect bots and reconcile actual game state with stored workflow checkpoints.
- Ensure each agent's goals, current approach, personal memory, and decision history remain isolated where intended.
- Provide access to shared discoveries across agents.
- Enforce model/provider budgets, request rate, concurrent workflow limits, resource and scheduling policies.
- Monitor server tick health and client connectivity.

Start with **one bot**, then progress to **three bots** for shared-memory demonstrations. Measure performance rather than assuming a large fleet will work.

## Execution rhythms and cost control

The default design is **burst reasoning, continuous deterministic play**:

- **Goal** is re-evaluated after major milestones, meaningful discoveries, or repeated dead ends.
- **Approach** is reviewed approximately every **10 minutes** initially, with configurable timing and earlier reviews triggered by events.
- **Execution** runs normal actions continuously and checks their outcomes without an LLM call per click.
- **Memory consolidation:** Deterministic for obvious facts; selective LLM calls for ambiguous episodes or useful summaries.
- **Nudge handling** happens at the Approach review unless a different policy is explicitly chosen.

Track LLM tokens, latency, decision outcome, and impact on progress. Preserve cancellation, retry limits and failure handling so a bad plan cannot loop forever.

## Optional human guidance: Agent Nudges

Plan underlying support even if the button/control is initially **hidden** in the UI.

**Definition:** A user submits a contextual suggestion to a specific bot, e.g. "Your Defence is low; consider fighting guards or another suitable enemy to train it."

A nudge is **advisory, not authoritative**. It must never directly execute actions or automatically overwrite a plan.

Suggested outcomes:

| Outcome | Meaning |
|---|---|
| Accept | Evidence and priorities support the suggestion |
| Modify | Related objective makes sense; a different method is better |
| Defer | Worth considering later; current activity has priority |
| Investigate | Claim or proposed target needs firsthand verification |
| Reject | Not useful, infeasible, unsupported, or too risky |

Workflow:

1. Human submits nudge from UI/API (target agent, text, time, optional expiration).
2. Store nudge as **untrusted external advice**; it is not a game fact and not a developer/system instruction.
3. The Approach layer considers it at the next planning checkpoint (or earlier only when explicitly configured).
4. Check fit with goals, factual support, agent capabilities, safety, opportunity cost, and alternatives.
5. Record the decision and a concise explanation. Optionally adjust the activity or ask the Goal layer to revise major priorities.
6. Show outcome in the nudge history and agent decision timeline.

Prevent repeated pressure from the same rejected nudge, prompt injection via nudge text, automatic game actions, and privilege escalation. Allow opt-in nudge enablement, per-agent policy and rate limits.

This is **human-in-the-loop guidance without removing autonomy**. We may later run experiments comparing performance with and without nudges.
