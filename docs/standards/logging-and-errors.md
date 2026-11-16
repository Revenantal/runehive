# Logging and errors

[Documentation index](../README.md) · [Standards](README.md) · [Code standards](development-practices.md)

## Logging

- Log through an injected `Logger` with `debug`, `info`, `warn`, and `error` methods that take a message and a fields object. Application code under `packages/` and `apps/` must not call `console`. ESLint enforces this. Tools and tests may print.
- Output structured JSON lines in the runtime. A readable format is fine for local development.
- Every entry carries `ts` (from the injected clock), `level`, `msg`, and `component`. Add `agentId`, `sessionId`, and `runId` whenever they apply.
- Name events `noun.verb` in `msg` or an `event` field, for example `shop.opened`, and keep the message constant. Put variable data in fields, not in the message string.
- Levels: `error` is a failure that needs attention. `warn` is unexpected but handled. `info` is a lifecycle or milestone event. `debug` is detail for developers.
- Do not log secrets or full model prompts and responses by default. See [configuration and secrets](configuration-and-secrets.md).
- Logs are operational. **Event History** in SQLite is the durable record of what an agent did. Never rebuild agent behavior or the Control Center from logs.

## Errors

- Expected game outcomes are results, not exceptions: a blocked path, a depleted tree, a full inventory. Return a typed result such as `{ ok: false, reason }`.
- Throw for programmer mistakes and unexpected failures. Throw `Error` subclasses only, never strings.
- Derive errors from one base class with a stable `code` (such as `CLIENT_DISCONNECTED`), the original `cause`, and context fields. The message states what failed and what was being attempted.
- Do not swallow errors. Catch only to handle it, to add context and rethrow with `cause`, or to translate at a boundary.
- Log an error once, at the boundary that handles it. Do not log and rethrow.
- API and CLI responses return the stable code and a human message, never a stack trace.
- CLI exit codes: `0` success, `1` failure, `2` usage error.
