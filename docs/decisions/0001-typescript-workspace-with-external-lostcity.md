# 0001. TypeScript workspace with LostCity kept external

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

We want agents to play as ordinary players and to understand the whole stack ourselves. Forking LostCity would give us a maintenance burden and tempt us toward privileged shortcuts.

## Decision

Build everything in one TypeScript workspace in this repository. Run an unmodified upstream LostCity Revision 274 server as a separate, git-ignored checkout. Build our own headless client (Aeris) against the normal game protocol. Do not fork LostCity unless a demonstrated requirement cannot be met externally. See [project goals](../project-goals.md) and the [architecture](../system/architecture.md).

## Consequences

Strong separation and realistic player semantics. The headless client is the highest integration risk and must be proven first. Upstream changes are absorbed by moving pins, not by merging a fork.
