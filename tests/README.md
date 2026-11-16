# Tests

[Documentation index](../docs/README.md) · [Testing and verification guide](../docs/standards/testing-and-verification.md)

Run everything in the default suite with `npm test`. It needs only Node.js and Git: no live world, network, or model credentials.

| Folder | What it covers | In `npm test`? |
|---|---|---|
| [`cli/`](cli/) | The `runehive` project CLI, using temporary directories and local Git fixtures | Yes |
| [`tools/`](tools/) | Project tooling other than the CLI, such as the commit-message check | Yes |
| [`docs/`](docs/) | Documentation links, anchors, the docs index, and the generated milestone and plan charts | Yes |
| [`integration/`](integration/) | Cross-package behavior that no single package owns | Yes |
| [`gameplay/`](gameplay/) | Live checks against the private Revision 274 world | No, run explicitly |

Unit tests for a package or app live next to its code, under `packages/` or `apps/`. Name automated test files `*.test.mjs` (or `*.test.ts` once packages have a TypeScript test setup) so the default suite picks them up. Live checks must not use that suffix.
