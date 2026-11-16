# 0005. Generate documentation status from front matter

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The roadmap, milestone briefs, plans, and system docs were repeating the same status and relationship information by hand, and it drifted.

## Decision

Milestone briefs and plans carry front matter as the single source of truth. A script generates the status blocks, the roadmap table, the plans index, and the "Built in" lines, and a test fails when they are stale. A milestone's status is derived from its builds. Plans are revisions to builds, kept apart from system docs (how it works), design (UI visuals), and decisions (why). See [documentation standards](../standards/documentation.md).

## Consequences

Navigation from roadmap to milestone to plans stays accurate and is easy for tools to parse. Editing generated sections by hand is an error, and the front matter format is a small strict subset we maintain.
