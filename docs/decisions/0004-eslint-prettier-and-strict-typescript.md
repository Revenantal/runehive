# 0004. Enforce quality with ESLint, Prettier, and strict TypeScript

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Standards written only as prose get ignored, especially by AI agents. We want the important ones to fail a check.

## Decision

Use ESLint with typescript-eslint, plus eslint-plugin-jsdoc, and Prettier for formatting. Turn on strict TypeScript for all packages. Encode rules as lint errors where possible: doc comments on functions, naming, named exports only, no console, no direct clock, randomness, or environment access in application code. Add tests for the rules and for repository policy such as secrets, dependency versions, and licenses. See [code standards](../standards/development-practices.md).

## Consequences

Violations are caught before commit. We take on dev dependencies and a config to maintain. A typecheck step is added when the first TypeScript file lands.
