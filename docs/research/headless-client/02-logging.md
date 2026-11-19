# 02 · Diagnostic logging

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can the disposable process produce separate, machine-readable lifecycle histories without persisting credentials or arbitrary input? The local environment and pinned revisions are the same as the [bootstrap baseline](01-bootstrap.md). No game connection, accounts, server changes, or privileged game data were used.

## Procedure and observations

1. From the repository root, run `node tools/headless-experiment/cli.mjs run` and stop it with Ctrl-C. The process prints a non-secret run ID.
2. Open `.runehive/headless-experiment/<run-id>.jsonl`, replacing the placeholder with that ID. Each line parses as JSON. The observed run contained `experiment.started` and `experiment.stopped`, with UTC timestamps, severity, component, run ID, client ID, and the stop signal on the latter. This machine created the file with mode `0600`; Git ignores the file.
3. Run `node --test tests/cli/headless-experiment.test.mjs`. Tests cover separate run IDs and files, valid JSON and signal handling, lack of arbitrary input in records, and sanitized error output when an existing file blocks log directory creation.

## Result and interpretation

JSON Lines is adequate for these initial lifecycle events and easy to inspect. The logger only permits predefined event shapes; it does not accept username, password, raw arguments, or arbitrary payload fields. This is narrower than a general-purpose redaction system. Failed log initialization stops the experiment and reports a sanitized error on stderr, because a log that cannot be opened cannot reliably contain its own failure. Later action, observation, and error events are not implemented yet.

## Limitations and follow-up

The experiment cannot demonstrate login/action/outcome diagnostics or credential safety for protocol handling because neither exists yet. Before adding them, define safe allowlisted event fields, exclude account names because they match passwords, and add tests using controlled sensitive values across errors and records. A process killed without a handled signal, a crash, or a disk failure may leave no stop entry; missing an entry is not proof of a game outcome. There is no automatic log cleanup. Files created outside the repository root are not necessarily Git-ignored; treat all logs as local diagnostics and review before sharing.
