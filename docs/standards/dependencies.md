# Dependencies

[Documentation index](../README.md) · [Standards](README.md)

## Adding one

- Prefer Node.js built-ins and what is already installed. Do not add a package to save a few lines.
- Ask the owner before adding any runtime dependency. Dev tooling follows the same checklist.
- State in the commit body what it is for, the alternatives considered, and the result of the checklist:
  - actively maintained, with a release in the last 12 months
  - license on the allowlist in `tools/allowed-licenses.json`
  - ships its own types and supports Node.js 24
  - small transitive footprint and no install scripts, unless needed and reviewed
- Planned and expected, but still subject to the checklist when first added: Hono, React, Vite, a schema library, and a SQLite driver.

## Versions and the lockfile

- Use exact versions only. `.npmrc` sets `save-exact=true`, and a test fails on ranges (`^`, `~`). Our own workspace packages use `*`.
- Commit `package-lock.json` and keep it current after every change.
- Keep tooling in `devDependencies`. A package belongs in `dependencies` only if shipped code imports it.

## Updating

- Update in dedicated `build(deps)` commits, one dependency or one tight group at a time.
- Run `npm run check` after each. Run `npm audit` and read the result.
- Do not run `npm audit fix --force`. Record any risk you accept in the commit body. The current accepted one is a dev-only `minimatch` advisory in the linter chain.
- Never vendor or copy code from `lostcity/`.

## Licenses

A test checks every package in the lockfile against the allowlist, including `OR` and `AND` expressions. Adding a license to the allowlist or an exception needs the owner's approval and a commit that explains why.
