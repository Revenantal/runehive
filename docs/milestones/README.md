# Milestones

[Documentation index](../README.md) · [Roadmap](../roadmap.md)

One brief per milestone. The [roadmap](../roadmap.md) is the ordered index. A milestone's core build is its list of **builds**: the named components it creates, each tied to the [system doc](../system/) that describes it and carrying its own status. A [plan](../plans/README.md) is a separate revision to something already roughed out or built.

## Front matter

The front matter at the top of each brief is the source of truth. `npm run docs:sync` generates the status block in the brief, the roadmap table, and the "Built in" lines in the system docs from it, and `npm test` fails if they drift. Edit the front matter, never the generated sections.

```yaml
---
id: M3
title: "Build the Execution layer"        # must match the # heading
delivers: "One sentence for the roadmap."
depends_on: [M2]
design: []                                # UI design docs, e.g. [control-center]
builds:
  - { name: "Woodcutting workflow using interact", system: architecture, status: in-design }
  - { name: "Banking workflow", system: architecture, status: not-started }
---
```

| Field | Meaning |
|---|---|
| `builds` | The components this milestone creates. At least one. `system` is a name from `docs/system/` (for example `architecture`) or `none` |
| `status` (per build) | `not-started`, `in-design`, `in-progress`, or `done` |
| `depends_on` | Milestones that must come first |
| `design` | UI design docs this milestone builds, named after a folder in `docs/design/` |

A milestone has no status of its own. It is derived from its builds: all done is **Done**, any build in progress or done is **In progress**, any in design is **In design**, otherwise **Not started**.
