# Documentation for agent capabilities

[Client blueprint](../README.md) · [Script surface](../engines/script-surface.md)

**Status: proposed.** Every capability exposed to a script or interactive agent needs documentation that helps the model choose an action correctly without requiring knowledge of packets, login or internal implementation.

## Two complementary forms

1. **Markdown API documentation:** maintain the [proposed API overview](../api-plan.md) in system planning docs. Inside the package, maintain a separate human- and agent-readable API overview grouped by area, containing only fully implemented methods. As an API method is built, link its package overview entry to a detailed developer-facing `.md` contract for that specific method. The contract covers purpose, exact input parameters and types, return values and types, observation scope, freshness and ambiguity, side effects, completion/evidence criteria, refusal and unknown behavior, limits and examples. Document generic option inspection and numbered action fallback alongside convenience methods. Distinguish local examine text, interface controls, server actions and item-on-target selection.
2. **Code-level API documentation:** write concise TSDoc/JSDoc descriptions and accurate TypeScript types on each public method alongside its implementation. Include important side effects, preconditions and a link to the fuller Markdown contract where appropriate. Keep comments accurate and focused; do not replace types with lengthy repeated prose.

Build the detailed method document **alongside the actual API code**, not as a deferred cleanup task. Before an implemented method is considered done, its index entry, detailed contract, code documentation and relevant executable examples/tests must agree. Location distinguishes plans from implemented developer documentation: planned and unsupported APIs stay in system docs, not in the package's API reference. Examples of future APIs must be labeled illustrative. Version the capability set and its documentation together, test sample snippets and contract behavior, and detect missing method documentation or drift as the design matures. The detailed documentation directory and any generation or validation tooling are decisions for implementation planning; no generated API reference is claimed today. How the runtime selects a relevant small context is also open.

## Example contract to complete before implementation

| Field | Example for a proposed `inventory.interact` |
|---|---|
| Purpose | Request one currently observed inventory option; not a universal `equip` or `eat` action |
| Inputs | Observed item handle and original one-based option slot or a validated observed option handle |
| Preconditions | Current inventory, item identity and exact option are revalidated; action admitted by coordinator |
| Outputs | Declared observed result, explicit sufficiently correlated refusal, or unknown with evidence; exact schema undecided |
| Safety | No packet for missing/stale/ambiguous item or option; never guess another slot; unknown does not mean action stopped |
| Example | Inspect current options; decide to try an observed slot; call the generic action and observe effects |

Option labels and examine text come from client-visible data and are untrusted. Documentation teaches the AI how to use capabilities, not what a candle, quest, shop or NPC necessarily does. The system does not preload mechanics or turn a name into an instruction. Future decision and discovery memory must preserve evidence separately from hypotheses.
