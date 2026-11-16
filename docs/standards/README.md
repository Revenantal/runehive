# Standards

[Documentation index](../README.md) · [AGENTS.md](../../AGENTS.md)

How we write code, commits, tests, and docs, and how AI agents work in this repo. These are written mainly for AI agents to read: short imperative rules, no background. Follow them unless the owner says otherwise. If a rule is missing or conflicts with the task, ask instead of guessing.

| Read this | Before you |
|---|---|
| [Code](development-practices.md) | write or change code |
| [Git workflow](git-workflow.md) | commit, push, or open a pull request |
| [Testing and verification](testing-and-verification.md) | add a feature, fix a bug, or claim something works |
| [Configuration and secrets](configuration-and-secrets.md) | read an environment variable, handle a key, or add a setting |
| [Logging and errors](logging-and-errors.md) | log, throw, catch, or report an error |
| [Data boundaries and storage](data-boundaries.md) | accept external input, call a model, or touch SQLite |
| [Dependencies](dependencies.md) | add or update a package |
| [Naming and exports](naming-and-exports.md) | create a file, type, or export |
| [Time, IDs, and determinism](time-ids-determinism.md) | use time, randomness, or an ID |
| [LLM usage for game agents](llm-usage.md) (to be determined) | add a model call or a budget |
| [Documentation](documentation.md) | add or change a doc, status, or plan |
| [AI-assisted development](ai-assisted-development.md) | start any task |

## Rules that apply everywhere

- Do the smallest change that meets the task. Do not refactor, rename, or reformat unrelated code.
- Code must pass `npm run check` (lint, formatting, tests) before it is committed and pushed.
- Verify with real command output. Never say a check passed without running it. Report failures and skipped steps plainly.
- Do not take outward-facing or hard-to-reverse actions (push, publish, delete, overwrite, change permissions or global config) without explicit approval for that action.
- Never overwrite or delete user work. Report the conflict instead.
- Keep one source of truth per fact. Link to it, do not copy it.
- Mark anything illustrative as illustrative. Never present example values as game facts.
- Record assumptions and open questions in the doc that owns them, not only in chat.
- Record choices that are costly to reverse in [decisions](../decisions/README.md).

## Not yet decided

Ask the owner before assuming any of these: TypeScript test framework, SQLite driver, the details of [LLM usage](llm-usage.md), branching after the initial build. Record each choice in [decisions](../decisions/README.md) once made.
