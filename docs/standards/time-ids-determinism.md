# Time, IDs, and determinism

[Documentation index](../README.md) · [Standards](README.md) · [Testing](testing-and-verification.md)

Application code gets time, randomness, and IDs from injected services, so the same inputs give the same results and tests never wait on the real world. ESLint forbids the direct calls in `packages/` and `apps/`.

## Time

- Store and send timestamps as ISO-8601 UTC strings ending in `Z`, such as `2026-11-12T20:00:00.000Z`. Never use local time.
- Name durations with their unit, as integers: `timeoutMs`.
- Game time is an integer `tick`. Do not mix ticks and wall-clock time without an explicit conversion, and verify the tick length for Revision 274 before depending on it.
- Read the time from an injected `Clock`. Do not call `Date.now()` or `new Date()`. One adapter module implements the system clock and is the only place allowed to disable the rule, with a comment saying why.
- Delays and timers go through an injected scheduler or `sleep`, so tests advance time instead of waiting.

## Randomness and IDs

- Take randomness from an injected, seedable `Random`. Do not call `Math.random()`. Record the seed in a decision record when randomness affected a choice.
- Generate IDs from an injected `IdGenerator`. Do not call `crypto.randomUUID()` in application code.
- ID format is `<prefix>_<ULID>` in lower case, such as `evt_01j9...`. ULIDs sort by creation time. Prefixes: `agt` agent, `ses` session, `evt` event, `mem` memory, `dec` decision, `goal` goal, `ngd` nudge.
- Treat IDs as opaque strings. Do not parse meaning out of them beyond the prefix. IDs in the docs, such as `memory-001`, are illustrative.

## Determinism in tests

- Use a fake clock, a seeded random, a fake ID generator, and a fake model or client. Do not use real time, sleeps, or the network in the default suite.
- Sort unordered results before comparing them. Do not depend on object key order.
- Record what is needed to replay a decision: the seed, the model, and a hash of the prompt.
