# Naming and exports

[Documentation index](../README.md) · [Standards](README.md) · [Code standards](development-practices.md)

## Names

| Thing | Style | Example |
|---|---|---|
| Files and folders | kebab-case | `agent-manager.ts`, `shop-discovery/` |
| Types, interfaces, classes, enums | PascalCase | `ClientState`, `Discovery` |
| Interfaces | No `I` prefix | `Logger`, not `ILogger` |
| Enum members | PascalCase | `Status.InDesign` |
| Functions, methods, variables, parameters | camelCase | `findNearestTree` |
| Module-level constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Booleans | `is`, `has`, `can`, or `should` prefix | `isConnected` |
| Durations and time | Unit in the name | `timeoutMs`, `observedAt` |
| Environment variables | `RUNEHIVE_` prefix, UPPER_SNAKE_CASE | `RUNEHIVE_DATABASE_PATH` |
| Database tables and columns | `snake_case`, tables plural | `memory_evidence`, `created_at` |

ESLint enforces the TypeScript rows, and a test enforces kebab-case files and folders under `packages/` and `apps/`. Name things for what they are in the domain, not how they are implemented. Spell words out; avoid abbreviations except common ones like `id` and `url`.

## Exports and imports

- Use named exports only. No `export default`. ESLint enforces this.
- Each package has one public entry, `src/index.ts`, that re-exports its public interface. Do not add other barrel files.
- Import another package only through its entry. Never reach into its `src/`.
- Use the `node:` prefix for built-ins and `import type` for type-only imports (ESLint enforces the latter).
- Relative imports in TypeScript include the `.js` extension, as NodeNext requires.
- Order imports in groups, separated by a blank line: Node built-ins, third-party, other packages, then relative.
- Test files sit beside the code as `name.test.ts`.
