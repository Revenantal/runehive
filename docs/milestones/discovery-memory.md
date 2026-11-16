# Add Event History and Discovery Memory

[Roadmap](../roadmap.md) · [Discovery Memory design](../discovery-memory.md)

## Goal

Turn gameplay observations into durable, retrievable discoveries with evidence.

## Objectives and plan

- Store events in SQLite, beginning with the action and observation records emitted by [Execution](execution.md) and [exploration](navigation-and-exploration.md).
- Record a shop discovery with the source agent, observation time, location, revision, status, and links to the underlying evidence.
- Support personal and shared discovery scopes. Keep time-sensitive observations such as shop stock tied to the time they were observed.
- Provide a CLI or runtime query to retrieve a discovery and inspect the evidence.

## Done when

A real shop visit produces an evidence-backed discovery. After a runtime restart, the discovery and source observations can be retrieved together.
