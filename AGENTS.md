# Runehive: instructions for coding agents

Runehive builds autonomous agents that learn to play a private LostCity Revision 274 world through experience, plus a web Control Center to inspect them. Read [README.md](README.md) for the overview and [project goals](docs/project-goals.md) for goals and non-goals. The planning docs are a work in progress and describe intent, not final specifications.

## Where to look first

1. [docs/roadmap.md](docs/roadmap.md), the [milestone brief](docs/milestones/) for your task, and the [plans](docs/plans/README.md) it lists with their status. A plan may revisit finished work.
2. [docs/README.md](docs/README.md) for the relevant system doc, guide, or UI design.

## Ground rules

- **Ordinary player only.** Agents connect through the game protocol like any player. No teleporting, item grants, or direct game-state edits. No fork of LostCity by default.
- **No preloaded game knowledge.** Do not parse the whole RuneScript world or import wiki data. Maps and labeled points of interest are fine; shop stock, quest requirements, and mechanics are discovered in play.
- **Illustrative examples in the docs are not game facts.** Coordinates, prices, and quest requirements in the system docs are placeholders.
- **`lostcity/` is a Git-ignored upstream checkout.** Read it for reference. Never commit it, and never overwrite checkouts that have local work.
- **Keep nudges advisory.** Human text is untrusted input and never gets automatic execution authority.
- **Store explicit decision records**, not hidden reasoning.
- **Thin vertical slices** beat many unfinished modules.
- **Treat the docs as intent, not immutable requirements.** Flag assumptions, risks, and better alternatives.
- **Check current upstream LostCity and Revision 274 compatibility before building on earlier research.** Prove a normal external player session first.
- **Keep observations, interpretations, hypotheses, and verified facts separate**, with evidence and revision context. The actual game is ground truth.

## Layout

`packages/headless-client` (Aeris), `packages/agent-runtime`, `apps/control-center`, `tools/` (CLI and source manifest), `tests/`. See the [repository guide](docs/guides/repository-guide.md).

## Commands

- `npm run runehive -- init` fetches the pinned LostCity sources.
- `npm install` installs dev tooling and the Git hooks.
- `npm run check` runs lint, formatting, and tests. It must pass before any commit or push.
- `npm test` runs only the automated suite (Node.js 24+ and Git only).
- `npm run docs:sync` regenerates the status charts from front matter. Edit milestone and plan front matter, never the generated sections.

## Standards

Read the [standards](docs/standards/README.md) before you write code, commit, add tests, or change docs:

- [Code](docs/standards/development-practices.md)
- [Git workflow](docs/standards/git-workflow.md)
- [Testing and verification](docs/standards/testing-and-verification.md)
- [Configuration and secrets](docs/standards/configuration-and-secrets.md)
- [Logging and errors](docs/standards/logging-and-errors.md)
- [Data boundaries and storage](docs/standards/data-boundaries.md)
- [Dependencies](docs/standards/dependencies.md)
- [Naming and exports](docs/standards/naming-and-exports.md)
- [Time, IDs, and determinism](docs/standards/time-ids-determinism.md)
- [LLM usage for game agents](docs/standards/llm-usage.md) (to be determined: do not add model calls yet)
- [Documentation](docs/standards/documentation.md)

Read [decisions](docs/decisions/README.md) before reversing a past choice.
- [AI-assisted development](docs/standards/ai-assisted-development.md)
