# Documentation standards

[Documentation index](../README.md) · [Standards](README.md)

## Where things live

| Folder or file | Owns | Do not put here |
|---|---|---|
| `README.md` | Pitch, overview, getting started | Goals lists, design detail |
| `docs/project-goals.md` | Vision, goals, non-goals, historical-completeness requirement | Build order, design |
| `docs/roadmap.md` | Milestone order and status (generated), scenarios, risks, open decisions | Per-milestone detail |
| `docs/milestones/` | One brief per milestone: goal, builds, done-when | Design that spans milestones |
| `docs/plans/` | Revisions: work to change something already roughed out or built | New-build detail already in a brief |
| `docs/system/` | How the system works, shared across milestones | Build order, UI visuals |
| `docs/design/` | UI design only: branding, tokens, screens, mock-ups | System architecture |
| `docs/decisions/` | Why we chose what we chose: short, numbered, immutable records | The task of changing something (a plan), or how the system works |
| `docs/guides/` | How-to: repository layout, local setup | Rules and conventions |
| `docs/standards/` | Rules for code, commits, tests, docs, AI work | Project background |
| `AGENTS.md` | Short entry point and ground rules for coding agents | Anything that belongs in a standard |

## Rules

- One owner per fact. Link to the owner instead of copying.
- Use these words precisely: **system** is how it works, **design** is UI visuals only, **builds** are the components a milestone creates, **plans** are revisions.
- Statuses are `not-started`, `in-design`, `in-progress`, `done`. A milestone's status is derived from its builds.
- Never edit generated sections (between `<!-- ...:start -->` and `<!-- ...:end -->`, or `<!-- built-in -->`). Edit the front matter, then run `npm run docs:sync`.
- Use relative links. Every link and anchor must resolve. `npm test` checks this.
- Keep headers to one breadcrumb line. Put the title first, then the breadcrumb, then generated status where present.
- Label illustrative values as illustrative.
- When you add a doc, link it from its folder's owner (docs index, roadmap, or plans index) so the index tests pass.
- Update the owning doc when behavior or structure changes. Do not leave decisions only in chat.
