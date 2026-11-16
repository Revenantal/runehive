# Control Center — Branding & Visual Identity

[Control Center UI index](README.md) · [Project overview](../../../README.md)

**Status:** Draft guidance — **not a final specification.** These rules come from the first round of mock-ups and are meant to keep work consistent until a proper refinement pass.
Machine-readable values: [`design-tokens.json`](design-tokens.json) · [`tokens.css`](tokens.css)

---

## 1. Direction in one sentence

> A **2004-era fantasy game client** brought to a web dashboard: earthy browns, muted gold trim, beveled stone panels and parchment, with a pixel font for short labels and a plain, readable sans-serif for everything people actually read.

### Principles

1. **Familiar to players, readable for everyone.** Borrow the *layout conventions* of the classic client (minimap, inventory grid, equipment paperdoll, skills grid, quest list). Never let the theme cost legibility.
2. **Pixel font is seasoning, not the meal.** Use it for headings, tabs, buttons, chips and labels. Body text, journal entries, tables and long descriptions use the sans-serif.
3. **Evidence is visible.** Status (verified / observed / hypothesis / stale / disproven) always has a color *and* a text label. Don't present a guess as a fact.
4. **Calm by default.** Dark leather background, few accents. Gold marks what's selected or active. Animation only for things that are live, like the selected path in a graph.
5. **Original assets only.** Don't copy proprietary game art, logos or UI sprites into this project. Use the drawn placeholder icons, or sprites read from the user's own client cache once their licensing is checked.

---

## 2. Color

All colors are tokens. Use the token name in code, never a raw hex value.

### 2.1 Surfaces

| Token | Hex | Use |
|---|---|---|
| `bg.app` | `#1A140E` | Page background (dark leather) |
| `bg.sunken` | `#221A12` | Sidebars and nav panes |
| `bg.subbar` | `#241C14` | Sub-header bars, graph canvas |
| `bg.well` | `#2A2119` | Rows, list items, inset wells |
| `bg.panel` | `#3A2F23` | Raised panels (beveled) |
| `bg.panel-hi` | `#4A3B2B` | Buttons, hovered rows |
| `bg.selected` | `#6B5434` | Active tab or button |
| `bg.stone` | `#4B4236` | Game-style stone panels (inventory, equipment, skills, bank) |
| `bg.slot` | `#3A3127` | Equipment and skill slots |
| `parchment` | `#E8DCB8` | Parchment cards (decision records, evidence boxes) |
| `parchment.light` | `#F4ECD3` | Inputs and chips on parchment |

### 2.2 Lines and bevels

| Token | Hex | Use |
|---|---|---|
| `line.outer` | `#120D08` | Outer borders of panels and controls |
| `bevel.light` | `#6E5A3D` | Inset top-left highlight |
| `bevel.dark` | `#231B12` | Inset bottom-right shadow |
| `line.divider` | `#4C3E2C` | Row dividers |
| `line.parchment` | `#6B5634` | Parchment borders |

**Bevel recipe** (panels and buttons): `border: 2px solid line.outer; box-shadow: inset 2px 2px 0 bevel.light, inset -2px -2px 0 bevel.dark;`

### 2.3 Text

| Token | Hex | On | Contrast (approx.) |
|---|---|---|---|
| `text.primary` | `#F0E2B6` | `bg.app` | > 12:1 |
| `text.strong` | `#F6EACB` | dark surfaces | > 12:1 |
| `text.secondary` | `#CDBF9C` | `bg.app`, `bg.panel` | ≥ 7:1 |
| `text.muted` | `#A89878` | `bg.app`, `bg.well` | ≥ 4.5:1 (not for tiny text on `bg.panel`) |
| `text.ink` | `#2E2010` | parchment | > 10:1 |
| `text.ink-muted` | `#4A3820` / `#6B4A1E` | parchment | ≥ 4.5:1 |
| `text.game-yellow` | `#FFE14D` + 1px black shadow | stone panels | Game-style numbers (levels, stack counts) |

### 2.4 Accent

| Token | Hex | Use |
|---|---|---|
| `accent.gold` | `#D9B861` | Headings, brand mark, section titles |
| `accent.gold-bright` | `#E3C26A` | Links, selection rings, active graph edges |
| `accent.gold-hover` | `#F6DFA0` | Link hover |
| `focus.ring` | `#F2D35B` | `:focus-visible` outline, 2px, offset 2px |

### 2.5 Discovery status (semantic, fixed)

Always show the label next to the color. The colors differ in lightness as well as hue.

| Status | Token | Hex | Extra treatment in lists |
|---|---|---|---|
| Verified | `status.verified` | `#9FD07A` | none |
| Observed | `status.observed` | `#8CC0EA` | none |
| Hypothesis | `status.hypothesis` | `#D2B8F0` | *italic* |
| Stale | `status.stale` | `#C4BBA8` | dimmed text |
| Disproven | `status.disproven` | `#F0A58C` | ~~strikethrough~~, dashed border in graphs |

Sort order wherever discoveries are grouped: **Verified → Observed → Hypothesis → Stale → Disproven**.

### 2.6 Discovery category (graph node headers, filters)

| Category | Hex |
|---|---|
| Location | `#C8B27A` |
| Shop | `#D9A066` |
| NPC | `#A9C3D9` |
| Item | `#C9B3DE` |
| Procedure | `#A9D1B8` |

### 2.7 Goal-layer kinds

| Kind | Hex |
|---|---|
| Master goal | `#D9B861` |
| Hypothesis | `#F2D35B` |
| Subgoal | `#E8C09A` |
| Approach | `#C9A0E8` |
| Execution | `#8CC0EA` |

Each goal link also has a source dot: **green `#9FD07A`** when it's backed by evidence, **yellow `#F2D35B`** when it's the agent's own hypothesis.

### 2.8 Agent and connection state

| State | Hex |
|---|---|
| Online / live | `#8FD16A` |
| Reconnecting / degraded | `#E0A040` |
| Hitpoints bar | `#C8463A` |
| This agent (map) | `#FFFFFF` |
| Other agents (map) | `#7FB3E6` |
| Route (map) | `#F2D35B`, dashed |
| Destination (map) | `#E0813A` |

### 2.9 Light mode

There isn't one yet; the theme is dark-first by design. If a light mode is added later, use **parchment** as the base surface and keep the status colors.

---

## 3. Typography

| Role | Family | Sizes | Notes |
|---|---|---|---|
| Display / labels | **RuneScape Plain 12** (`RSPlain`), falling back to **Pixelify Sans**, then `monospace` | **16, 20, 24, 32 px** | Pixel font: use multiples of its native 16px. No faux bold (`font-synthesis: none`, `font-weight: 400`). |
| Body / data | **Source Sans 3** (Google Fonts), falling back to `system-ui` | 13–20 px; body 15–17 | Weights 400, 600, 700. Used for journal entries, claims, tables and form inputs. |
| Raw data | `ui-monospace` | 13–14 px | Event payloads (`<pre>`). |

**Where the pixel font goes:** app title, nav buttons, tab labels, chips and status pills, section headings, stat labels, map labels, game-panel numbers.
**Where it doesn't:** sentences, paragraphs, table cells, inputs, tooltips.

### Font licensing

- *RuneScape Plain 12* came from onlinewebfonts.com under **CC BY 4.0**. **Every page that loads it must show this credit:**
  `Fonts made from <a href="http://www.onlinewebfonts.com">Web Fonts</a> is licensed by CC BY 4.0`
- The download warns that some fonts on that site carry other terms. **Check this one's provenance before shipping**, and keep Pixelify Sans as a drop-in fallback.
- Don't commit the font file until that's settled. Load it from `/fonts/rs-plain-12.woff2` (and `.woff`) as a local asset.

---

## 4. Surfaces and components

### 4.1 Surface types

| Surface | Look | Use for |
|---|---|---|
| **Panel** | `bg.panel` + bevel | Headers, toolbars, popovers, sidebars |
| **Parchment card** | `parchment` + `line.parchment` border + 2px inner highlight | Decision records, evidence, "why" boxes, stat tiles |
| **Stone panel** | `bg.stone` + subtle diagonal texture + bevel | Game-native views only: inventory, equipment, skills, bank |
| **Well / row** | `bg.well` + 1px `line.outer` | List rows, journal entries, timeline rows |
| **Overlay (on map)** | `rgba(32,24,16,.9)` + 2px `line.outer` + 1px highlight | Floating cards over the map or graph |

### 4.2 Components (current vocabulary)

- **Button (`.btn`)**: pixel font 16px, `bg.panel-hi`, bevel, min-height 40px. The active state uses `bg.selected` with `#FFF1C4` text.
- **Chip / pill (`.chip`)**: pixel font 16px, 2px × 8px padding, 1px `line.outer`. The fill is a semantic color with `#120D08` text.
- **Tabs**: segmented bevel buttons for primary tabs, or a flat underline (3px gold) for detail tabs.
- **Agent dropdown**: lives in the header on the right of every page. Each option shows a status dot, the agent's name and a one-line current activity.
- **Tree nav (docs-style)**: collapsible category headers (gold, 20px pixel font, chevron) → status sub-headings (16px pixel, muted, color square) → plain items (sans 15px). The current item gets a gold left border and a lighter background.
- **Trail + Back**: breadcrumbs in the pixel font, separated by `›`, with a Back button when there's history.
- **Map overlay card**: Goal / Approach / Now rows, each with a colored kind chip.
- **Graph node**: 220×92px, a category-colored header strip with the status pill, title and two-line claim, gold connection handles left and right.
- **Game slots**: inventory has no slot borders (items sit on stone) and yellow stack counts top-left. Equipment uses 56px slots in a paperdoll with connecting lines; empty slots show a faint silhouette. Skills sit in a 3-column grid of `icon + cur/base` in game-yellow, with the total level spanning the last two cells.

### 4.3 Spacing and shape

- Spacing scale: **4, 6, 8, 10, 12, 16, 20, 24, 32** px.
- **Square corners everywhere** (radius 0). The only round shapes are status dots, the compass and map pins.
- Touch targets ≥ 40px (≥ 44px for primary list items).
- The page shell is a 64px header, an optional 52px sub-bar, and content that fills the rest of the viewport. Panes scroll independently on screens ≥ 900px wide and stack below that.

---

## 5. Iconography

- Use simple filled shapes on a 32×32 grid with a 1.2–1.4px dark outline (`#120D08`). Item icons get a 1px drop shadow.
- Skill and item icons in the mock-ups are **original placeholders**. Replace them with sprites from the self-hosted Revision 274 client cache only after licensing is confirmed.
- UI icons (chevrons, zoom, fit view) are 2px stroke line icons in `text.primary` or `accent.gold`.
- No emoji.

---

## 6. Voice and copy

- **Journal entries** are short, first-person and grounded in recorded events: “I switched to the oaks because…”. Always link to the decision and its evidence.
- **Never imply hidden reasoning.** Label summaries as *"generated summaries of recorded decisions — not raw reasoning"*.
- **Name uncertainty**: "Unverified link", "Seen once", "Not yet tested", "Last seen 12 min ago".
- **Nudges** are advice, not commands. Outcome labels are: *Accepted, Modified, Deferred, Investigate, Rejected*. The agent's reply is written in first person.
- Pages using sample data say so in the footer: *"Sample data for layout only — not verified game facts."*

---

## 7. Accessibility checklist

- Every interactive element is a real `<button>`, `<a>` or `<input>`, with `aria-label` on icon-only controls.
- Visible `:focus-visible` ring (`focus.ring`, 2px, offset 2px).
- Body-text contrast ≥ 4.5:1, so never put `text.muted` on `bg.panel` below 14px.
- Status and category are never shown by color alone.
- Interactive canvases (map, graph) need keyboard alternatives: zoom and fit buttons, node lists and inspector links.
