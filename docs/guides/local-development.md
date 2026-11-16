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
