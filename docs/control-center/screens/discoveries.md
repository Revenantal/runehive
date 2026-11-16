# Screen spec — Discoveries

[Control Center UI index](../README.md) · [Branding](../branding.md) · Mock-up source: [`../mockups/Discovery.dc.html`](../mockups/Discovery.dc.html)

**Status:** Draft guidance from rough mock-ups — not final. Every value shown is **sample data**, not verified game facts.

## Purpose

Browse, search and inspect everything the agents have discovered, see the evidence behind each claim, and see how discoveries connect. There are two views: **Browse** (docs-style) and **Connections** (node canvas).

## Shared chrome
- Same header as every screen (nav plus agent dropdown, which here also offers **All agents**).
- **Sub-bar (52px):** "Discoveries", a count and a **Browse | Connections** toggle.

---

## View 1 — Browse (docs-style, like devdocs.io)

```text
┌ Sub-bar: Discoveries · 15 shared · sample data        [Browse][Connections] ┐
├──────────────────────┬──────────────────────────────────────────────────────┤
│ [Search…]            │ ← Back   Sword shop › event-1042 › Shopkeeper        │
│ ▾ Locations      3   │ [Observed] [Shop] [Shared]               memory-118  │
│ ▸ Shops          3   │ Sword shop                                            │
│   VERIFIED           │ Sells iron swords                                     │
│     …                │ First discovered by Bram · 2d ago · last seen 3h ago  │
│   OBSERVED           │ ── Observation ───────────── [map thumbnail]          │
│   ▌ Sword shop       │ ── History (goal → approach → observed → reused)      │
│   STALE              │ ── Evidence | Conflicting evidence (parchment)        │
│     Sword shop stock │ ── Related [chips] · See it in Connections            │
│   DISPROVEN          │                                                       │
│     ~~General store~~│                                                       │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

### Left nav
- A search input that filters by subject and claim. When search is active, every category with a match opens.
- **Collapsible categories:** Locations, Shops, NPCs, Items, Procedures, each with a count.
- Inside each category, **status sub-groups in fixed order: Verified → Observed → Hypothesis → Stale → Disproven**. Empty groups are hidden.
- Items are plain text, sorted A–Z within each group. Hypotheses are *italic*, stale items dimmed and disproven ones ~~struck through~~. The current item gets a gold left border.

### Detail pane (max width ~860px)
- **Trail and Back:** navigation history inside the pane. Following evidence or related links pushes onto the trail.
- **Discovery page:** chips (status, category, scope), id, title, claim, discoverer, first/last seen, observation text, a status note ("why not verified yet"), map thumbnail, **History** timeline, **Evidence**, **Conflicting evidence**, **Related** (each chip shows the relationship, e.g. "· sells"), and a "See it in Connections" link.
- **Event page** (when an evidence link is followed): the append-only event's title, agent, time, the raw payload in a `<pre>`, "Used as evidence by" (marking conflicts), and a link to that moment in the agent's timeline.

---

## View 2 — Connections (node canvas)

The mock-up imitates **React Flow**. **Use `@xyflow/react` for the real build.**

- **Canvas:** dotted grid background; drag the background to pan, scroll to zoom toward the cursor (0.3×–2×), drag nodes to rearrange.
- **Nodes (220×92):** a category-colored header with the category name and status pill, the subject (bold) and a two-line claim, with handles on both sides. Disproven nodes get a dashed border.
- **Edges:** curved, labelled with the relationship type (located in, sells, runs, produces, done at, stock of, compared to, followed by…). Selecting a node highlights its edges with **animated gold dashes** and dims everything else.
- **Overlays:** category filter toggles (top-left), inspector panel for the selected node (top-right: summary, connections list, **Open details**, which goes to the Browse page), controls (zoom in/out, fit view, reset layout; bottom-left), zoom percentage, a **minimap** with the visible area outlined (bottom-right), and a hint line.
- Double-clicking a node opens its details in Browse.
- Initial layout: columns by category (Location → Shop/NPC → Item → Procedure). Consider auto-layout (dagre or ELK) for real data, and saving positions per user.

---

## Data model (from Discovery Memory)

| Entity | Fields |
|---|---|
| Discovery | id, scope (personal or shared), category, subject, claim, status, firstDiscoveredBy, firstObservedAt, lastObservedAt, location {x,z,level}, evidenceIds[], conflictingEvidenceIds[], relatedIds[] (with relationship type), history[{kind, agent, at, text}], revision |
| Event | id, type, agentId, at, payload (raw), position |
| Relationship | sourceId, targetId, type, evidenceIds[] |

The relationship type should be stored rather than inferred from category pairs, as the mock-up does now.

## States
- Empty search shows "No discoveries match."
- A hypothesis with no evidence shows "None yet — this is an untested hypothesis."
- Stale data says why it's time-sensitive (stock, prices).
- Agent filter: "All agents" by default; selecting an agent limits results to what that agent discovered or reused.

## Open questions
- Should personal (non-shared) discoveries appear here, or only on the Agent View?
- Should we add a map view of discoveries (pins), as listed in control-center.md?
- Graph size limits: cluster or collapse by category once there are hundreds of nodes?
