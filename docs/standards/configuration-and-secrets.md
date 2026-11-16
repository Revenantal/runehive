# Configuration and secrets

[Documentation index](../README.md) · [Standards](README.md)

## Configuration

- Configure through environment variables only. Prefix every name with `RUNEHIVE_`.
- Each deployable (runtime, Control Center server) has one config module that reads `process.env` once at startup, validates it against a schema (see [data boundaries](data-boundaries.md)), and exports a typed, read-only object. No other module reads `process.env`. ESLint enforces this outside `config.ts` and `config/`.
- Fail fast on missing or invalid values. The error names the variable and never prints its value.
- Defaults must be safe and local. Anything risky is off by default: human nudges, remote access, spending beyond a model budget.
- List every variable in `.env.example` with its name only.
- LostCity's local world configuration and saves stay under the Git-ignored `lostcity/` directory.

## Secrets

Secrets are API keys, tokens, and passwords, including game account credentials for agent characters.

- Keep them in the environment or a git-ignored `.env`. Never commit a real `.env`, never put a value in `.env.example`, docs, tests, fixtures, or commit messages.
- Never log them, put them in prompts, discovery memory, events, decision records, error messages, or API responses.
- The logger redacts any field whose name contains `key`, `token`, `secret`, `password`, or `credential`.
- Keep the Control Center private and authenticated. Agent action channels must never be reachable by untrusted users.
- A test scans the repository for recognizable secrets and runs in `npm test`, so the pre-commit hook catches them. If one gets committed anyway, treat it as leaked: revoke and rotate it. Do not just delete it from history.
