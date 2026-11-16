# Data boundaries and storage

[Documentation index](../README.md) · [Standards](README.md) · [Discovery Memory](../system/discovery-memory.md)

## Validate at every boundary

A boundary is anywhere data enters from outside the type system: HTTP and event-stream payloads, human nudge text, game protocol decoding, **LLM output**, configuration, files read from disk, and database rows when the schema may have drifted.

- Parse `unknown` into a typed value once, at the edge, then pass typed values inward. Never pass `unknown` or unchecked casts deeper.
- Define each boundary shape once as a runtime schema and derive the TypeScript type from it. Do not hand-write a parallel type. Keep schemas in a `schemas` module beside the boundary.
- Reject invalid input with a typed error that names the field. Do not coerce silently.
- Treat LLM output as untrusted input. Parse it against a schema, retry a limited number of times, and record a failure in the decision record. Never execute it directly.
- Schema library: Zod is the default. Follow the [dependency checklist](dependencies.md) when first adding it.

## Versioning

- Persisted records and events carry an integer `schemaVersion`.
- Prefer additive changes. A breaking change bumps the version and ships a reader or migration for the old one.

## SQLite

- Schema changes are numbered, forward-only SQL migrations: `migrations/0001-create-events.sql`. Apply them in order inside a transaction and record each in a `schema_migrations` table.
- Never edit a migration once it is on `main`. Add a new one.
- Turn on WAL mode and foreign keys. Back up before migrating real data.
- Tables are plural `snake_case`. Primary keys are text IDs (see [time, IDs, and determinism](time-ids-determinism.md)). Timestamps are ISO-8601 UTC text, named `*_at`.
- Observations and events are append-only: no `UPDATE` or `DELETE`. Derived beliefs, such as discovery status, may be updated and carry `updated_at`.
- Use FTS5 for text search.
- Test by applying every migration to an empty database and asserting the schema, and by checking that data survives a restart.
- The SQLite driver is chosen in the M5 plan, not here.
