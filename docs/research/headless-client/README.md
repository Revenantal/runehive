# Headless client experiments

[Documentation index](../../README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

These notes describe a disposable prototype, not the production client or agent Discovery Memory. Each experiment separates observations from interpretation and identifies what remains unknown. Follow the vanilla-server and credential boundaries in the discovery plan.

## Commands

From the repository root, with Node.js 24 or newer:

```sh
npm run experiment:headless -- --help
npm run experiment:headless -- run
npm run experiment:headless -- login
npm run experiment:headless -- session       # 75 seconds with keepalives
npm run experiment:headless -- session-idle  # 75 seconds without keepalives
npm run experiment:headless -- logout        # click the logout button, then test relogin
npm run experiment:headless -- logout-abrupt # drop the connection (control), then test relogin
```

`run` starts a foreground placeholder. `login` prompts for the account with visible input, uses the same value as its password, connects to the local world, and reports the client-visible login result. Because the name is also the password, anyone who sees the prompt can see the credential; use disposable local accounts only. For automation, `RUNEHIVE_EXPERIMENT_ACCOUNT` can supply the value instead of prompting. Choose a fresh account manually; the naming convention in the plan is recommended but not enforced. Automatic allocation and verification of freshness are not implemented. The prototype accepts printable ASCII names of 1–12 characters; the server may apply further normalization or restrictions. The account name is a password, so do not put its value in documentation, logs, shell history, or a shared terminal. Each run writes a separate JSON Lines file under `.runehive/headless-experiment/` in the current directory, named by the non-secret run ID shown at startup. To stop it from another terminal, send SIGTERM to the Node process running `tools/headless-experiment/cli.mjs`; don't signal an unrelated process. For scripting without npm's wrapper, use `node tools/headless-experiment/cli.mjs run`. Invalid arguments return exit code 2 without echoing the argument. The Node process exits with code 0 on SIGINT or SIGTERM after cleanup; when launched through npm, the wrapper may itself report signal termination. Stopping `login` closes the connection; it does not request a clean game logout. Incoming post-login game packets are counted but not decoded. The separate session experiments compare bounded operation with and without keepalives; the basic `login` command does not send them.

## Logs and retention

Run from the repository root so `.runehive/` is Git-ignored. Logs are local diagnostic artifacts, retained until an operator chooses to remove them; there is no automatic rotation or cleanup. Files are created exclusively with owner-only permissions where supported. Avoid sharing logs without review. At present the logger accepts fixed startup, shutdown, login-result, aggregate session-observation and logout/relogin events; it does not yet log general game actions, decoded game observations, or detailed errors. It has no generic redactor: extend its schema and add credential-leak tests before introducing credentials or arbitrary protocol data.

## Experiments

- [01 · Bootstrap and baseline](01-bootstrap.md)
- [02 · Diagnostic logging](02-logging.md)
- [03 · Login investigation](03-login.md) — ordinary-player login, rejection, and service findings
- [04 · Session maintenance](04-session-maintenance.md) — bounded idle and keepalive comparison
- [05 · Clean logout](05-logout.md) — logout button versus abrupt disconnect
