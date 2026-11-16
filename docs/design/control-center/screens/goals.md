# Screen spec — Goal Explorer

[Control Center UI index](../README.md) · [Branding](../branding.md) · Mock-up source: [`../mockups/Goals.dc.html`](../mockups/Goals.dc.html)

**Status:** Draft guidance from rough mock-ups — not final. Goals and dependencies shown are **illustrative**, not verified game requirements.

## Purpose

Show an agent's hierarchy of goals, hypotheses, approaches and executions, mark clearly which links are backed by evidence and which are the agent's own guesses, and show the decision record behind each node. It also holds the agent's nudge history.

## Layout

```text
┌ Sub-bar: Goals · Bram · 1 master goal · 3 branches   ● backed by evidence ● agent's hypothesis ┐
├──────────────────────────────┬───────────────────────────────────────────────────────────┤
│ GOAL TREE (~380px)           │ [Decision record] [Nudges (4)]                            │
│ [Master goal] Complete …     │ [Approach] [Active]                    D-231 · 18m ago     │
│ ├─[Hypothesis] Improve Def…  │ Train Defence on a discovered safe enemy                  │
│ │  └─[Approach] Train Def… ▌ │ Parent: Hypothesis — Improve Defence…                     │
│ │     └─[Execution] Nav→…    │ ┆ Unverified link: … (dashed amber box)                   │
│ ├─[Subgoal] Investigate …    │ Why · Options considered (Chosen / Considered cards)      │
│ │  └─[Approach] Re-read …    │ Evidence | Stop or review when (parchment)                │
│ └─[Subgoal] Get a better …   │ See this in <agent>'s timeline                            │
│    └─[Approach] Investigate… │                                                           │
└──────────────────────────────┴───────────────────────────────────────────────────────────┘
```

## Goal tree
- Rows are indented 26px per level and joined by tree connector lines (elbows plus vertical continuations).
- Each node shows a **kind chip** (Master goal, Hypothesis, Subgoal, Approach, Execution, each colored by kind), a title, and a status line with a **source dot**: green when backed by evidence, yellow when it's the agent's hypothesis.
- Clicking a node selects it (gold border) and shows its record on the right.
- There is **no "mark as disputed" control**; that was removed on purpose. Unverified links are flagged, not voted on.

## Decision record
- Header: kind and state chips, id, time, title, parent.
- **Unverified link** banner (dashed amber) when the node or its parent rests on a hypothesis.
- **Why:** one or two sentences of rationale.
- **Options considered:** cards marked *Chosen* (green border) or *Considered*, each with a short trade-off note.
- **Evidence** (links to discoveries and events) and **Stop or review when** (stop conditions) on parchment.
- A link to the matching moment in the Agent View timeline.

## Nudges tab
- Explainer: "Nudges are advice, not commands…"
- A composer (parchment): a textarea and **Send nudge**, noting when it will be considered ("next review · in 6m").
- History cards: an outcome chip (**Accepted, Modified, Deferred, Investigate, Rejected**), the time, the quoted suggestion, and the agent's first-person reply.
- When a nudge is rejected and its repeats are muted, the reply says so.

## Data model

| Entity | Fields |
|---|---|
| GoalNode | id, agentId, parentId, kind, title, state (Active / Queued / Testing / Running / Done / Not started), sourced (bool), createdAt |
| DecisionRecord | nodeId, rationale, options[{title, note, chosen}], evidenceIds[], stopConditions[], unverifiedLinkNote? |
| Nudge | id, agentId, text, submittedAt, expiresAt?, outcome, reply, decidedAt |

## Interactions
- The agent dropdown switches the whole tree.
- Selecting a node switches the right pane to Decision record.
- Evidence links go to Discoveries (Browse).

## Open questions
- Should the tree also be shown as a node canvas, like Discoveries' Connections?
- Show completed branches collapsed by default?
- Should nudge rate limits and "muted" state be visible in the UI?
