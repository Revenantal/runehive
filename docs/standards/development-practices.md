# Code standards

[Documentation index](../README.md) · [Standards](README.md) · [Architecture](../system/architecture.md)

## Language and tooling

- Write proper TypeScript throughout packages and the Control Center. `strict` is on (see `tsconfig.base.json`). Do not use `any`, `@ts-ignore`, or non-null assertions to silence the compiler. Model the type correctly instead.
- Root CLI, `tools/`, and `tests/` are plain ESM (`.mjs`) using Node.js built-ins at runtime. Dev tooling dependencies (ESLint, Prettier, TypeScript) are allowed. Ask before adding any other dependency.
- Target Node.js 24 or newer.
- Code must pass lint and formatting: ESLint (with typescript-eslint) and Prettier. Run `npm run lint:fix` and `npm run format` rather than hand-formatting. See [testing](testing-and-verification.md) for the full gate.

## Design

- Build components that are modular and small. One module, one reason to change.
- Follow SOLID:
  - **Single responsibility:** each module, class, and function does one thing.
  - **Open/closed:** extend through new implementations of an interface, not by editing working code.
  - **Liskov substitution:** implementations must honor the interface contract they replace.
  - **Interface segregation:** keep interfaces small and specific to their consumer.
  - **Dependency inversion:** depend on interfaces, and pass dependencies in (clock, random, storage, model, client) so tests can fake them.
- Expose an explicit public interface per module. Do not export internals.
- `agent-runtime` imports `headless-client` through its public interface only.
- `control-center` talks to the runtime through the API and event stream only. Never import runtime internals.
- Match the module layout in [architecture](../system/architecture.md#repository-organization). Do not invent new top-level folders.
- Never modify LostCity or read from `lostcity/` at runtime. Agents act only through the ordinary game protocol.

## Documentation in code

- Every function, method, and class gets a JSDoc/TSDoc comment. ESLint enforces it outside tests.
- Keep it to a short description of what it does and why it exists. One or two sentences. Do not repeat what the types already say, and do not write paragraphs.
- Inline comments are a single line, and only where the code is confusing. Prefer clearer names over comments.
- Do not leave commented-out code, TODOs without an owner, or change-history comments.

```ts
/** Returns the nearest tree the character can chop, or null if none is visible. */
function findNearestTree(state: ClientState): TreeTarget | null {
  // Distance is Chebyshev because the game moves diagonally.
  ...
}
```

## Data

- Keep observation, interpretation, hypothesis, and verified fact as distinct types or states. Never merge them into one loose string.
- Attach evidence IDs, timestamps, and revision context to anything an agent believes.
- Do not preload game facts. Map and navigation data is allowed. Shop stock, quest requirements, and mechanics are discovered in play.

## Errors and retries

- Throw or return typed errors that say what failed and what was attempted.
- Retry only operations that are safe to repeat, with a limit and a timeout. Never loop forever.
- Confirm outcomes from observations. Never assume an action succeeded.
- Code that touches files on disk must not overwrite or delete existing user work. Report the conflict. `runehive init` is the reference implementation.

## Review checklist

- Matches the milestone brief and its completion criteria.
- Typed correctly, modular, and consistent with SOLID.
- Every new function, method, and class has a short doc comment.
- Tests cover new behavior, including failure and rerun cases.
- Lint, formatting, and tests pass.
- No game facts, wiki data, or privileged game access added.
- Docs updated if behavior or structure changed.
- No secrets, local configuration, or `lostcity/` content in the diff.
