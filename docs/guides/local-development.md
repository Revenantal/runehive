# Local development

[Documentation index](../README.md) · [M0 brief](../milestones/project-setup.md)

## Prerequisites

- **Node.js 24 or newer.** The LostCity engine requires it.
- **npm** (bundled with Node.js).
- **Git.**
- Network access to GitHub for the first fetch.

## First run

```sh
git clone https://github.com/Revenantal/runehive.git
cd runehive
npm install                # dev tooling and Git hooks
npm run runehive -- init
```

`init` creates the Git-ignored `lostcity/` directory and prints each component's path and exact commit. Fetch order and pins come from `tools/lostcity-sources.json`.

Re-running is safe. Matching checkouts are reused. Anything else is reported and left untouched.

## Start and stop services

```sh
npm start                          # start every service and wait until ready
npm run runehive -- status         # stopped, starting, or ready, with the URL
npm stop                           # stop every service cleanly
npm run runehive -- start lostcity # or name one service
```

`start` runs the engine in the background and prints the browser URL (normally http://localhost:8888/rs2.cgi). The first start packs the cache and takes longer. The engine's log is `lostcity/.runehive/lostcity.log`. `stop` signals the whole process group and waits for the engine to save, and it never force-kills. LostCity is the only service for now. New services register in `tools/runehive.mjs`.

When local support services use SQLite, `npm start` initializes a missing or empty `lostcity/engine/db.sqlite` with the upstream SQLite migration. It leaves initialized databases alone; a partial or unexpected schema stops startup for manual investigation. MySQL setup is not automated. The engine's readiness message does not independently verify that every support service is healthy.

The engine sometimes prints a V8 fatal-error trace at exit, after `Server shutdown complete`. Save persistence after such an error has not been independently verified.

## Optional: the `runehive` command

Link the CLI once so `runehive` works without `npm run`:

```sh
npm link
runehive --help
```

npm's global bin directory must be on your `PATH`. `npm config get prefix` shows where it is. Keep using `npm run runehive -- init` if you prefer not to link.

## Updating

After `git pull`, run `init` again. If a pull changed a commit pin, `init` reports `commit-mismatch` and keeps your checkout. To move to the new pin, check that the checkout has no local work you need, remove that component's directory under `lostcity/`, and run `init`.

## Troubleshooting

| `init` output | Meaning | What to do |
|---|---|---|
| `[failed]` | The fetch did not finish (network, URL, or missing commit). Other components are unaffected and no partial directory is left | Fix the cause and re-run; it resumes with the missing component |
| `[commit-mismatch]` | The checkout is at a different commit than the manifest pins | Decide whether to keep it or remove it and re-run |
| `[local-edits]` | The checkout matches the pin but has uncommitted changes | Commit, stash, or discard them yourself |
| `[wrong-origin]` | The checkout's `origin` is not the manifest URL | Point `origin` at the expected URL or remove the directory |
| `[occupied]` | The path holds something that is not a Git checkout | Move or remove it |
| `fatal: detected dubious ownership` from Git | The checkout is owned by a different user than the one running Git | Run as the owning user, or add the path to `safe.directory` yourself |

M1 adds the server commands and the verified save locations to this guide.
