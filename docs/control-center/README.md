# Control Center — UI Guidance

[Project overview](../../README.md) · [Control Center requirements](../control-center.md)

**Status:** Draft, high-level guidance from the first round of mock-ups (November 12, 2026). **Not final**; expect a refinement pass. Where this folder and [control-center.md](../control-center.md) disagree, the requirements doc wins on *what* to build and this folder wins on *how it should look and behave*.

Live mock-up canvas (private until shared): https://claude.ai/artifact/Uvth6itrQ7e8d2Xb4ehMo4

## Files

| File | For | What it holds |
|---|---|---|
| [branding.md](branding.md) | Humans + agents | Visual identity: principles, color roles, typography and font licensing, surfaces, components, icons, copy voice, accessibility |
| [design-tokens.json](design-tokens.json) | Agents / build tooling | Every color, font, spacing and size value, in machine-readable form |
| [tokens.css](tokens.css) | Frontend | The same tokens as CSS custom properties, plus reference component recipes |
| [screens/agent-view.md](screens/agent-view.md) | Humans + agents | Agent View: map, overlay, sidebar tabs, game-style character panels |
| [screens/discoveries.md](screens/discoveries.md) | Humans + agents | Discoveries: docs-style Browse and the Connections node canvas |
| [screens/goals.md](screens/goals.md) | Humans + agents | Goal Explorer: goal tree, decision records, nudges |
| [mockups/](mockups/) | Reference only | Source of the clickable mock-ups (see below) |

## Guidance for coding agents

1. **Stack:** React + TypeScript + Vite, data from the Hono API with server-sent events (see [control-center.md](../control-center.md)). Load `tokens.css` globally and use the `--cc-*` variables. Don't hard-code hex values.
2. **Graphs:** build the Discoveries Connections view with **React Flow (`@xyflow/react`)**: custom node type, labelled bezier edges, MiniMap, Controls, Background (dots).
3. **Game-style panels** (inventory, equipment, skills, bank) copy the *layout conventions* of the 2004 client but must use **original or properly licensed art**. The icons in the mock-ups are placeholders.
4. **Sample data:** everything in the mock-ups is invented for layout. **Never seed it as real game knowledge.**
5. **Font:** RuneScape Plain 12 (CC BY 4.0 via onlinewebfonts.com) needs an on-page credit. Use Pixelify Sans as the fallback. See branding.md §3.
6. When in doubt, choose readability and accessibility over looking authentic.

## About `mockups/`

These `.dc.html` files are **prototype markup for a design-canvas tool, not production code**. They use a small templating dialect (`{{holes}}`, `<sc-for>`, `<sc-if>`, a `DCLogic` class) and won't run as plain HTML. Read them for exact layout, spacing and sample content, and re-implement in React.

| File | Screen |
|---|---|
| `Main.dc.html` | Agent View |
| `Discovery.dc.html` | Discoveries (Browse plus Connections; the `view` prop switches between them) |
| `DiscoveryGraph.dc.html` | Wrapper showing Discoveries in Connections view |
| `Goals.dc.html` | Goal Explorer |
| `canvas.json` | Artboard layout of the canvas |

The mock-ups load the font and icons from the canvas's own asset store (`/_blob/...` URLs); those won't resolve outside it.

## Decisions so far

- The map is the main view, as a large rectangle with a "what it's working on" overlay. Everything else lives in a tabbed right sidebar.
- The agent selector is a dropdown in the header on every screen.
- Discoveries Browse is a docs-style left tree (category → status group → subject) with a detail pane. Evidence and related links navigate inside the pane, with a back trail.
- Discoveries Connections is a navigable node canvas, not a static chart.
- Goal Explorer has no "mark as disputed" control. Unverified links are flagged instead.
- The pixel font is for labels only; body text is Source Sans 3.
