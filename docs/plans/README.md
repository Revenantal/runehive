# Plans

[Documentation index](../README.md) · [Roadmap](../roadmap.md)

A plan is a **revision**: one unit of work to change something that has already been roughed out or built, including the system docs that describe it. The core build of each milestone is its list of **builds** (named components, each with its own status), which lives in the milestone's brief. A plan is what you write when you come back to change one of those, even long after the milestone is done.

Plans are not system design. System docs describe what the system is, and a plan is the task of changing it. A plan points at one milestone, so that milestone's brief can list its plans and their status. Plans are identified by filename and live flat in this folder.

## Status

The same four statuses are used for builds and plans. A milestone's status is derived from its builds.

| Status | Meaning |
|---|---|
| `not-started` | Identified, not yet worked on |
| `in-design` | Roughed out, being ironed out and decided |
| `in-progress` | Design settled, being built |
| `done` | Built and verified |

## Fields

The front matter is the source of truth. `npm run docs:sync` generates the status block in the plan, the plan list in each milestone brief, the open-revision counts in the roadmap, and the table below. `npm test` fails if they drift.

| Field | Values |
|---|---|
| `title` | Must match the `#` heading |
| `status` | One of the statuses above |
| `milestone` | A milestone id such as `M0` |
| `system` | System docs this plan changes, such as `[architecture]`; `[]` for none |

## Template

Copy this into `docs/plans/<short-name>.md`. Keep the two marker comments, because the generator fills them in.

````markdown
---
title: "Revisit the init command"
status: not-started
milestone: M0
system: [lostcity-and-headless-client]
---
# Revisit the init command

[Roadmap](../roadmap.md)

<!-- status:start -->
<!-- status:end -->

## Why

What prompted this and what is wrong or missing today.

## Plan

What will change, in order.

## Done when

How we will know it worked.

## Implementation

Commits, pull requests, and files that carried it out. Fill this in as the work lands.
````

## All plans

<!-- plans:start -->
| Plan | Milestone | Status | System docs changed |
|---|---|---|---|
| [Explore the headless client](headless-client-discovery.md) | [M2](../milestones/headless-client.md) | In progress | [LostCity and the Headless Client](../system/lostcity-and-headless-client.md) |
<!-- plans:end -->
