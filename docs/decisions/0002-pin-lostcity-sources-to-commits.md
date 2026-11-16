# 0002. Pin LostCity sources to exact commits

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The upstream launcher clones by branch name, so two people running it on different days get different code. The engine, content, and our client must match.

## Decision

Record each source's URL, branch, and full 40-character commit in `tools/lostcity-sources.json`. `runehive init` fetches exactly those commits into the git-ignored `lostcity/` folder and never overwrites an existing checkout. The upstream launcher is not used. Branches are followed manually, in dedicated `chore(lostcity)` commits.

## Consequences

Setup is reproducible. Moving to newer upstream code is a deliberate, reviewed step, and M1 validates the first set of pins. We may revisit letting a reference-only component follow its branch.
