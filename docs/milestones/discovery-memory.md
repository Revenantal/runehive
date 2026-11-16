---
id: M5
title: "Add Event History and Discovery Memory"
delivers: "A real observation becomes a retrievable discovery with evidence that survives a restart."
depends_on: [M3, M4]
design: []
builds:
  - { name: "Event History in SQLite", system: discovery-memory, status: in-design }
  - { name: "Discovery records with evidence and status", system: discovery-memory, status: in-design }
  - { name: "Personal and shared scopes", system: discovery-memory, status: in-design }
  - { name: "Discovery query CLI", system: discovery-memory, status: in-design }
---
# Add Event History and Discovery Memory

[Roadmap](../roadmap.md)

<!-- status:start -->
- **Status:** In design (from its builds)
- **Depends on:** [M3](execution.md), [M4](navigation-and-exploration.md)

**Builds**

| Component | System doc | Status |
|---|---|---|
| Event History in SQLite | [Discovery Memory](../system/discovery-memory.md) | In design |
| Discovery records with evidence and status | [Discovery Memory](../system/discovery-memory.md) | In design |
| Personal and shared scopes | [Discovery Memory](../system/discovery-memory.md) | In design |
| Discovery query CLI | [Discovery Memory](../system/discovery-memory.md) | In design |

**Plans** (revisions to this milestone's builds)

No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).
<!-- status:end -->

## Goal

Turn gameplay observations into durable, retrievable discoveries with evidence.

## Objectives and plan

- Store events in SQLite, beginning with the action and observation records emitted by [Execution](execution.md) and [exploration](navigation-and-exploration.md).
- Record a shop discovery with the source agent, observation time, location, revision, status, and links to the underlying evidence.
- Support personal and shared discovery scopes. Keep time-sensitive observations such as shop stock tied to the time they were observed.
- Provide a CLI or runtime query to retrieve a discovery and inspect the evidence.

## Done when

A real shop visit produces an evidence-backed discovery. After a runtime restart, the discovery and source observations can be retrieved together.
