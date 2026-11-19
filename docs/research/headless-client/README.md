# Headless client experiments

[Documentation index](../../README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

These notes describe a disposable prototype, not the production client or agent Discovery Memory. Each experiment separates observations from interpretation and identifies what remains unknown. Follow the vanilla-server and credential boundaries in the discovery plan.

## Commands

From the repository root, with Node.js 24 or newer:

```sh
npm run experiment:headless -- --help
npm run experiment:headless -- run
```

`run` starts a foreground placeholder and remains active until Ctrl-C or SIGTERM. It does not connect to the game or create accounts. Each run writes a separate JSON Lines file under `.runehive/headless-experiment/` in the current directory, named by the non-secret run ID shown at startup. To stop it from another terminal, send SIGTERM to the Node process running `tools/headless-experiment/cli.mjs`; don't signal an unrelated process. For scripting without npm's wrapper, use `node tools/headless-experiment/cli.mjs run`. Invalid arguments return exit code 2 without echoing the argument. The Node process exits with code 0 on SIGINT or SIGTERM after cleanup; when launched through npm, the wrapper may itself report signal termination.

## Logs and retention

Run from the repository root so `.runehive/` is Git-ignored. Logs are local diagnostic artifacts, retained until an operator chooses to remove them; there is no automatic rotation or cleanup. Files are created exclusively with owner-only permissions where supported. Avoid sharing logs without review. At present the logger accepts only fixed startup and shutdown events; it does not yet log actions, observations, or general errors. It has no generic redactor: extend its schema and add credential-leak tests before introducing credentials or arbitrary protocol data.

## Experiments

- [01 · Bootstrap and baseline](01-bootstrap.md)
- [02 · Diagnostic logging](02-logging.md)
