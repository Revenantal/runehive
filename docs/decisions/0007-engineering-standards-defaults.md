# 0007. Engineering standards defaults

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Before writing application code we needed defaults for cross-cutting concerns so agents and people make the same choices.

## Decision

Adopt the standards for [configuration and secrets](../standards/configuration-and-secrets.md), [logging and errors](../standards/logging-and-errors.md), [data boundaries and storage](../standards/data-boundaries.md), [dependencies](../standards/dependencies.md), [naming and exports](../standards/naming-and-exports.md), and [time, IDs, and determinism](../standards/time-ids-determinism.md). Notable defaults: environment-variable configuration read in one module, exact dependency versions, schema validation at every boundary with Zod as the default library, forward-only SQLite migrations, kebab-case files with named exports only, UTC ISO-8601 timestamps, and ULID-based prefixed IDs from injected services.

## Consequences

Application code is testable and deterministic by construction. Several defaults, such as the schema library and the SQLite driver, are confirmed when first used and may produce a superseding record.
