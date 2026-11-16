# 0003. Commit to main using Conventional Commits

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

This is a young repository with one owner. Branches and pull requests add ceremony without a second reviewer.

## Decision

Commit directly to `main` during the initial build and revisit branching later. Write commit messages in Conventional Commits 1.0.0 format. Every commit is authored by the repository owner with no co-author or tool attribution. Lint, formatting, and tests must pass before a commit and before a push, enforced by tracked Git hooks. See [Git workflow](../standards/git-workflow.md).

## Consequences

Fast history with a readable log, and a clean gate on every commit. There is no review step beyond the gate, so the gate must stay strict and agents must not bypass it.
