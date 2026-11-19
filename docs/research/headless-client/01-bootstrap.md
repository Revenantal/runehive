# 01 · Bootstrap and baseline

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question

Can a disposable, dependency-free experimental process start, report its limited state, stop cleanly, and provide an actionable error for invalid commands before we add logging or a game connection?

## Setup

Observed locally on Linux x86_64, Node.js v24.22.3 and npm 11.19.1. The checked-out source revisions matched the pinned manifest:

- Engine: `5522cd0cd82f0df07d99c142574d4706815f1c9c`
- Content: `65b754f768b79b941b21b2a1eb3b0d1ecae3cdfe`
- Web client: `7d6ca61abda277cfed87d542e9e4aa3fe383b38d`

The test did not require a running world, inspect server configuration, change server files, or create a character. Its entry point is `tools/headless-experiment/cli.mjs`, separate from the production client package.

## Procedure and observations

1. Run `npm run experiment:headless -- --help`: usage explains `run` and stopping the process.
2. Run `npm run experiment:headless -- run`: the foreground process reports that no game session is open. Press Ctrl-C: it reports it stopped. In this terminal npm itself reported SIGINT, even though the underlying Node process handles the signal.
3. Automated CLI tests verify the underlying Node process exits with code 0 after SIGINT and SIGTERM, and invalid/missing commands exit with code 2 and actionable usage guidance without echoing input.
4. Run `node --test tests/cli/headless-experiment.test.mjs` for the isolated checks.

## Result and interpretation

The process lifecycle and command surface work for a local bootstrap. This is a placeholder shell, **not yet a functioning game client**: no network connection, authentication, accounts, protocol, or game state was tested. An npm foreground wrapper has different signal reporting from the child process; direct Node invocation is available for scripts that need the child exit status.

## Open questions

- What structured diagnostic records and redaction are useful for the next phase?
- What connection and account mechanisms are needed for the later ordinary-player login experiment? No conclusion is implied by this bootstrap.
