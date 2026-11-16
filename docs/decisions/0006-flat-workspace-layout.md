# 0006. Flat workspace layout

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The code lived under a wrapper folder named `runescape-ai/`, which did not describe it and added a level the repository root already provides.

## Decision

Put `packages/` and `apps/` at the repository root, with `tools/`, `tests/`, `docs/`, and the ignored `lostcity/` beside them. Register `packages/*` and `apps/*` as npm workspaces. See the [architecture](../system/architecture.md#repository-organization).

## Consequences

A conventional monorepo layout with shorter paths. Packages cannot be confused with documentation or tooling folders.
