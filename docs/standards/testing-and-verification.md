# Testing and verification

[Documentation index](../README.md) · [Standards](README.md) · [Tests overview](../../tests/README.md)

## Rules

- Add or update tests with every behavior change, including failure and rerun cases.
- Code must pass lint, formatting, and tests before it is committed and pushed. Run `npm run check`.
- Run the relevant checks before claiming work is done. Quote failures verbatim. Never weaken or delete a test to make it pass.
- The default suite needs only Node.js and Git: no live world, network, or model credentials.
- Test file names end in `.test.mjs`. Live gameplay checks end in `.live.mjs` so `npm test` skips them.
- Keep fixtures clearly labeled and apart from runtime discovery data. Example values in system docs are illustrative, never fixtures for game facts.
- For model-driven tests, assert on observable outcomes and evidence, not exact wording.

## Commands

```sh
npm run check            # the gate: lint, format check, then tests
npm run lint             # ESLint, zero warnings allowed (lint:fix to auto-fix)
npm run format:check     # Prettier (npm run format to rewrite)
npm test                 # default suite
npm run docs:sync        # regenerate status charts after editing front matter
```

Prettier covers code and config, not Markdown or `docs/`. Generated docs are verified by the docs tests.

## Where tests go

| Kind | Location | Notes |
|---|---|---|
| Unit | Next to the package or app code | Controlled inputs |
| CLI | `tests/cli/` | Temporary directories and local Git fixtures: fresh run, rerun, local edits, changed pin, wrong origin, occupied path, failed fetch then resume |
| Tooling | `tests/tools/` | Scripts in `tools/` other than the CLI, such as the commit-message check |
| Documentation | `tests/docs/` | Links and anchors resolve, the index reaches what it should, generated charts match front matter |
| Integration | `tests/integration/` | Behavior spanning packages |
| Live gameplay | `tests/gameplay/` | Against the private Revision 274 world. Not in `npm test` |

## Real fetch check

The default suite does not contact GitHub. After a pin change, run `npm run runehive -- init` and confirm each printed commit matches `tools/lostcity-sources.json`.

## Live gameplay checks

Document for each: starting character state, available observations, expected result, and in-game evidence.
