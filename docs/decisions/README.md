# Decisions

[Documentation index](../README.md) · [Standards](../standards/README.md)

Short records of project decisions that are costly to reverse or that change a default. They answer "why did we do it this way?" long after the chat is gone. This is not the same as an agent's runtime decision records (the explanations the Approach layer stores), and it is not a [plan](../plans/README.md), which is the task of changing something.

## When to write one

- Adding a runtime dependency, or changing the architecture or a system doc in a way others rely on.
- Adding, changing, or relaxing a standard.
- Choosing between real alternatives, such as the SQLite driver or the schema library.

## Rules

- Copy the template, number it with the next free four-digit number, and give it a short kebab-case name.
- An accepted record is not edited except to mark it superseded. To change a decision, write a new record that supersedes it and link both ways.
- Keep it to a page. Link to the standard, system doc, or plan that carries the details.
- Statuses: `proposed`, `accepted`, `superseded`.

## Template

```markdown
# 0000. Title in plain words

- **Status:** proposed
- **Date:** 2026-01-01

## Context

What forced the decision, and what we considered.

## Decision

What we will do.

## Consequences

What gets easier, what gets harder, and what we must now do.
```

## Index

| Record | Status |
|---|---|
| [0001. TypeScript workspace with LostCity kept external](0001-typescript-workspace-with-external-lostcity.md) | Accepted |
| [0002. Pin LostCity sources to exact commits](0002-pin-lostcity-sources-to-commits.md) | Accepted |
| [0003. Commit to main using Conventional Commits](0003-commit-to-main-with-conventional-commits.md) | Accepted |
| [0004. Enforce quality with ESLint, Prettier, and strict TypeScript](0004-eslint-prettier-and-strict-typescript.md) | Accepted |
| [0005. Generate documentation status from front matter](0005-generate-docs-status-from-front-matter.md) | Accepted |
| [0006. Flat workspace layout](0006-flat-workspace-layout.md) | Accepted |
| [0007. Engineering standards defaults](0007-engineering-standards-defaults.md) | Accepted |
