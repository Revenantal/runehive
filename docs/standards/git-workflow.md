# Git workflow

[Documentation index](../README.md) · [Standards](README.md)

## Rules

- Commit directly to `main`. Do not create branches while the initial build is underway. The owner will say when to start branching.
- Do not commit, push, amend, rebase, or force-push unless asked. Commit only when told to. Pushing needs separate approval.
- **Quality gate:** code must pass lint, formatting, and the test suite before it is committed and before it is pushed. Run `npm run check`. The Git hooks run it automatically (see below).
- One focused change per commit. Do not mix a refactor, a feature, and a docs change.
- Never commit `lostcity/`, secrets, local configuration, or `node_modules/`.
- Never use `--no-verify`, `--force`, or `reset --hard` without explicit approval.
- Do not change Git configuration (global or repo) to get unblocked, other than the hook setup below. Ask.

## Commit messages

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<optional scope>): <description>

<optional body: why, not what>

<optional footers, e.g. BREAKING CHANGE: ...>
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Header: imperative mood, lower case after the colon, no trailing period, 72 characters or fewer.
- Mark breaking changes with `!` before the colon and a `BREAKING CHANGE:` footer.
- Scope is the area changed, such as `cli`, `docs`, `aeris`, `runtime`, `deps`.

```text
feat(cli): add init command for pinned LostCity sources
fix(cli): keep local edits when a checkout is rerun
docs: move system docs under docs/system
build(deps): add eslint, prettier, and typescript
chore(lostcity): pin Engine-TS to 5522cd0
```

## Authorship

- Every commit is authored and committed by the repository owner only, using the Git identity that is already configured. Do not set, override, or invent an identity.
- Never add `Co-authored-by` trailers or any attribution to an AI tool or assistant. No "Generated with" lines, tool names as authors, or marker emoji.

## Enforcement

`.githooks/` is tracked in the repo, and `npm install` points Git at it (`core.hooksPath`). If hooks are not active, run `npm run hooks:install`.

| Hook | Runs |
|---|---|
| `pre-commit` | `npm run check` (lint, format check, tests) |
| `pre-push` | `npm run check` |
| `commit-msg` | `tools/check-commit-msg.mjs`: Conventional Commits header and no co-author or tool attribution |

## LostCity pin changes

Pins live in `tools/lostcity-sources.json`.

1. Edit the component's `commit` (full 40-character ID) and, if needed, `branch`.
2. Run `npm run runehive -- init` on a clean checkout, or follow the update steps in [local development](../guides/local-development.md#updating).
3. Use the `chore(lostcity)` type. Put the component, old and new short commits, the reason, and what was verified (a real launch or gameplay check) in the message.
4. Commit pin changes on their own, separate from feature work.

## Pull requests

Not used while we commit to `main`. When branching starts, the description must include what changed and the milestone or plan it serves, checks run with real results, and remaining gaps and open questions.
