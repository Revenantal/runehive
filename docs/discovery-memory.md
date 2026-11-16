# Discovery Memory

[Project overview](../README.md)

## Discovery Memory: the learning system

Do **not** implement a precomputed Game Knowledge Engine for the first version. Implement a lean **Discovery Memory** service recording what agents genuinely observe or infer.

### Three logical types

1. **Episodic memory:** What happened — timestamped game actions, observations, messages, position, outcomes.
2. **Semantic memory:** What we believe — reusable facts such as "This shop sells iron swords," backed by events.
3. **Procedural memory:** What worked — route/action patterns and measured success, such as how to buy an item or bank gathered resources.

### Memory scopes

- **Personal:** Character-specific goals, experiments, failures, capabilities, and strategies.
- **Shared:** Observed world services, locations, reusable facts, reproducible methods.
- Each shared discovery preserves original discoverer(s) and evidence; a human or another agent can inspect it.

### Memory lifecycle and evidence

Suggested statuses:
- `hypothesis` — plausible but untested interpretation.
- `observed` — directly seen via client state, messages or interface.
- `verified` — confirmed by a defined reproducible interaction or repeated corroboration.
- `disproven` — contradicted by reliable evidence; retain the historical record.
- Optionally `stale` for time-sensitive observations such as stock or prices.

Do not infer universal constraints from a single character's failure. Preserve context, timestamps, agent state and conflicting evidence. **Facts may be revision-specific**, and even a verified observation may become stale after upgrades.

### Proposed storage

Start with **SQLite** (WAL mode, backups, indexed queries and FTS5 text search), not a heavyweight vector database or general knowledge graph.

Possible logical tables:

```text
agents
sessions
observations / events
memories
memory_evidence
procedures
goals
goal_dependencies
planning_decisions
human_nudges
agent_state_snapshots
position_samples
```

This is conceptual, not a finalized schema. Use IDs, foreign keys, versioning and a clear distinction between append-only observations and derived/updatable beliefs.

### Example discovery record (illustrative, not verified game data)

```json
{
  "id": "memory-001",
  "scope": "shared",
  "category": "shop",
  "subject": "Varrock sword shop",
  "claim": "Offers iron swords",
  "status": "observed",
  "firstDiscoveredBy": "agent-01",
  "firstObservedAt": "2026-11-12T20:00:00Z",
  "lastObservedAt": "2026-11-12T20:00:00Z",
  "location": { "x": 0, "z": 0, "level": 0 },
  "evidenceIds": ["event-1042"],
  "details": { "price": "illustrative value only" }
}
```

Coordinates above are placeholders; **never treat example values as actual game records**.

### How memory is created

- Deterministically record ordinary client observations (shop opened, item bought, XP gained, quest journal changed).
- Derive obvious facts mechanically when possible, e.g. an item was listed in a shop interface.
- Optionally ask an LLM to summarize difficult episodes (quest dialogue, blockers, competing explanations), with source event IDs.
- Prefer compact, evidenced memories over dumping full conversations into prompts.
- Retrieve relevant memories only when needed, filtered by goal, category, location, scope and recency.
