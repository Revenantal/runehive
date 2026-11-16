# Screen spec — Agent View

[Control Center UI index](../README.md) · [Branding](../branding.md) · Mock-up source: [`../mockups/Main.dc.html`](../mockups/Main.dc.html)

**Status:** Draft guidance from rough mock-ups — not final. Every value shown in the mock-ups is **sample data**.

## Purpose

Watch one agent live: where it is, what it's working toward, what it's doing right now, and why. This is the default landing screen.

## Layout

```text
┌──────────────────────────── Header (64px) ─────────────────────────────┐
│ ▲ Control Center │ Agent View │ Discoveries │ Goals │  ● Live · 3s │ Agent: Ashgrove ▾ │
├──────────────────────────────────────────────────┬──────────────────────┤
│ MAP (fills remaining width + full height)        │ SIDEBAR (~380px)     │
│ ┌ Overlay: "<Agent> is working on" ┐  ┌ N ┐      │ [Character|Goals|    │
│ │ GOAL      Reach 60 Woodcutting ▓▓░│  │ + │      │  Journal|Timeline|   │
│ │ APPROACH  Chop oaks… (review 6m) │  │ − │      │  Session]            │
│ │ NOW       Walking to oak tree    │  │Fol│      │                      │
│ └──────────────────────────────────┘  └───┘      │  tab content         │
│            ·  route  ·  ⚑ destination            │  (scrolls)           │
│ ┌ Legend ───────────────┐          ┌ x/z/lvl ┐   │                      │
└──────────────────────────────────────────────────┴──────────────────────┘
```

- **≥ 900px wide:** map and sidebar fill the viewport height under the header, and the sidebar content scrolls.
- **< 900px:** the sidebar stacks under the map, and the map keeps a min-height of ~560px.

## Regions

### Header (shared by all screens)
- Brand mark and "Control Center" in the display font.
- Primary nav: Agent View · Discoveries · Goals (`aria-current="page"` on the active one).
- Connection status: a dot plus "Live · Ns ago" (server-sent events heartbeat and the latest update time).
- **Agent dropdown** (right-aligned): status dot, name and current activity per option. Selecting an agent switches the whole screen.

### Map (main view)
- A **rectangular** Revision 274 map that fills the left area. Choose the tile source after checking the verified map assets (see [control-center.md](../../../system/control-center.md)).
- Layers: the selected agent (white dot with a ring), other agents (blue dots with names), NPCs (yellow dots), labelled points of interest (bank, shops), the planned route (dashed yellow), and the destination (orange flag).
- An action tag above the agent: "Walking to oak · 14 tiles".
- **Overlay card (top-left):** Goal (with progress), Approach (with next review countdown) and Now (current execution step plus a key stat). The "Details" button opens the sidebar's Goals tab.
- **Controls (top-right):** compass, zoom in/out, and a Follow toggle that keeps the map centred on the agent.
- **Legend (bottom-left)** and **coordinates (bottom-right)**.

### Sidebar tabs
| Tab | Content |
|---|---|
| **Character** | Name, combat and total level, HP bar, then game-style sub-tabs: **Inv · Equip · Skills · Quests · Bank** (see below). |
| **Goals** | A compact Goal → Approach → Execution chain; "Why this approach" with the chosen option and alternatives (measured where possible); links to evidence and the Goal Explorer. |
| **Journal** | The pinned current entry (parchment), then recent first-person entries, each linking to its decision, nudge or evidence. Labelled "generated summaries of recorded decisions — not raw reasoning". |
| **Timeline** | Routine events (MOVE, XP, ITEM, ACT, BANK, PLAN), each a time, kind chip and text, with a filter. |
| **Session** | Metric tiles (uptime, XP/hr, LLM calls, tokens, average latency, budget used, replans, failed actions) and the nudge input, which is disabled unless enabled for that agent. |

### Character sub-tabs (game-style)
Use the **layout conventions** of the classic client, drawn with original or placeholder art.

- **Inventory:** stone panel, 4×7 grid with no slot borders, item icons with a drop shadow, and stack counts in game-yellow at the top-left. Caption: "21 of 28 slots used · live".
- **Equipment:** a paperdoll on stone with 56px slots: `Head` / `Cape Neck Ammo` / `Weapon Body Shield` / `Legs` / `Hands Feet Ring`, joined by connecting lines. Empty slots show a faint silhouette.
- **Skills:** stone panel, 3-column grid of `icon  cur/base` in game-yellow. The total level spans the last two cells, the skill being trained gets a gold border, and the tooltip shows the name, level and XP. Skill list (Revision 274, *verify against the server*): Attack, Hitpoints, Mining, Strength, Agility, Smithing, Defence, Herblore, Fishing, Ranged, Thieving, Cooking, Prayer, Crafting, Firemaking, Magic, Fletching, Woodcutting, Runecraft.
- **Quests:** a list of names with a state (Done / Started / Not started) in the display font, colored green, yellow or red.
- **Bank:** the same grid style, with a **staleness banner** ("Last seen 12 min ago, the last time the bank was open. It may have changed since.").

## Data needed (from the Hono API and server-sent events)

| Area | Fields | Notes |
|---|---|---|
| Agent list | id, name, connection state, one-line activity | Feeds the dropdown |
| Position | x, z, level, timestamp; route[]; destination | Sampled positions; routes come from Execution |
| Nearby | other agents, NPCs, POIs (with labels) | Only what the client can observe or what map labels show |
| Goal stack | goal {title, progress}, approach {title, stopConditions[], nextReviewAt}, execution {step, stats} | |
| Character | hp {cur, max}, combat, total; inventory[28]; equipment{slot→item}; skills[{name, cur, base, xp}]; quests[]; bank {items[], observedAt} | Bank and other views that need an open interface **must carry `observedAt`** |
| Journal | entries[{time, text, decisionId, evidenceIds[]}] | Generated from recorded decisions |
| Timeline | events[{time, kind, text}] | Append-only events |
| Session | uptime, xpPerHour, llmCalls, tokens, avgLatency, budgetUsed, replans, failedActions | |

## States

- **Disconnected or reconnecting:** amber dot in the header; the map freezes with a "last update Ns ago" badge.
- **No route:** hide the route and destination; the overlay shows the current step only.
- **Interface not observed yet** (bank, quests): show an empty state that says it hasn't been seen yet.
- **Nudges disabled:** the input is visible but disabled, with the reason given in its label.

## Interactions
- Switching agents keeps the current tab.
- "Details" on the overlay opens the Goals tab.
- Journal links go to the Goal Explorer (decision) or Discoveries (evidence).
- Map: drag to pan, wheel or buttons to zoom, Follow to re-centre.

## Open questions
- Map tile source and licensing for Revision 274.
- Should the map also offer a historical replay scrubber (sampled positions)?
- Live spectator view: is it a separate tab or a replacement for the map?
