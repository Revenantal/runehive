# Runehive documentation

[Project overview](../README.md)

This is the map of the docs. Planning documents are a work in progress: they describe intent, not final specifications.

## Start here

- [Project goals and constraints](project-goals.md) — Vision, goals, non-goals, and the historical-completeness requirement.
- [Roadmap](roadmap.md) — Ordered milestones with status and plans, success scenarios, risks, and open questions. Each milestone links to its brief, and each brief lists its builds and plans with their status. See [how milestones are tracked](milestones/README.md).

## Plans

- [Plans](plans/README.md) — Units of work with their own status: building something new, or revisiting and rewriting something already built. Each plan points at a milestone and the system docs it changes.

## System

How the system works, shared across milestones. Each system doc lists the milestones that build it, and each milestone brief lists the system docs it relies on.

- [Architecture and repository](system/architecture.md)
- [LostCity and the Headless Client](system/lostcity-and-headless-client.md)
- [Agent Runtime](system/agent-runtime.md)
- [Discovery Memory](system/discovery-memory.md)
- [Control Center](system/control-center.md)

## Guides

- [Repository guide](guides/repository-guide.md) — What each folder is for and what belongs in Git.
- [Local development](guides/local-development.md) — Prerequisites, first run, and troubleshooting.

## Decisions

- [Decisions](decisions/README.md) — Short records of why we chose what we chose. Read these before reversing a choice.

## Standards

Rules for how we work, written mainly for AI agents. Start at the [standards index](standards/README.md).

- [Code](standards/development-practices.md)
- [Git workflow](standards/git-workflow.md)
- [Testing and verification](standards/testing-and-verification.md)
- [Configuration and secrets](standards/configuration-and-secrets.md)
- [Logging and errors](standards/logging-and-errors.md)
- [Data boundaries and storage](standards/data-boundaries.md)
- [Dependencies](standards/dependencies.md)
- [Naming and exports](standards/naming-and-exports.md)
- [Time, IDs, and determinism](standards/time-ids-determinism.md)
- [LLM usage for game agents](standards/llm-usage.md) — To be determined.
- [Documentation](standards/documentation.md)
- [AI-assisted development](standards/ai-assisted-development.md)

## Design

Visual design for the web app, separate from the system docs above.

- [Control Center UI guidance](design/control-center/README.md) — Branding, design tokens, screen specs, and mock-up sources.
