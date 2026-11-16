# LLM usage for game agents

[Documentation index](../README.md) · [Standards](README.md) · [Agent Runtime](../system/agent-runtime.md)

**Status: to be determined.** Nothing below is a decision yet. This covers the models the game agents call at runtime, not the coding agents that build the repo (see [AI-assisted development](ai-assisted-development.md)). The first milestone that calls a model is [M6](../milestones/approach.md).

## Direction so far

- Keep token cost as low as possible.
- Track how many tokens each agent uses.
- When an agent hits its limit, the character logs out and a status flag is set. Details to be worked out.
- Put hard caps on retries and loops. Details to be worked out.

## Interim rules

- Do not add model calls or choose a provider yet. Ask the owner first.
- Keep the deterministic layers free of model calls. [Execution](../milestones/execution.md) does not call a model per action.

## Open questions

- Budget: per agent, global, or both? Over what window, and what are the defaults?
- At the limit: exactly what does "log out" mean, what does the status flag look like, and how does an agent resume?
- Caps: how many retries and how long a loop before stopping, and what is recorded when a cap trips?
- Usage tracking: which fields per call (model, tokens in and out, latency, outcome) and where they are stored and shown.
- Models: one model for every layer, or different tiers for Goal, Approach, and Execution?
- Prompts: where they live, how they are versioned, and how untrusted text (human nudges, in-game chat, discoveries) is kept out of instructions.
- Output: schema validation, retry limits, and how a failure shows up in the decision record (see [data boundaries](data-boundaries.md)).
- Reproducibility: what a decision record stores so a choice can be explained or replayed.
- Testing: a model interface with a fake for unit tests and recorded fixtures, so `npm test` needs no credentials.

Record each choice in [decisions](../decisions/README.md) as it is made, then replace this page with the rules.
