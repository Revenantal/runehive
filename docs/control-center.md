# Control Center

[Project overview](../README.md) · [UI guidance: branding, tokens, screen specs](control-center/README.md)

## Human-facing web platform

**Control Center** is the working name for the single web app. It brings agent views, discoveries, and goal history together in one place. Use the character switcher to check in on another agent and the main navigation to move between the Agent View and Discovery Explorer.

### Discovery Explorer

Users can browse, search and inspect all agent discoveries and memories.

Features:
- Search across agents or scope results to the selected character. Filter by category, location, agent, status, discovery date, and last verification.
- Show the observation, status, evidence, timestamps, source agent, and revision on each discovery page.
- Follow a discovery's history from the goal or question that prompted it through the attempts, findings, and later confirmations or corrections. Branches can show different attempts at the same question or how another agent used the finding.
- Link related items, shops, NPCs, locations, and procedures. Let users jump from a discovery to the relevant moment in an agent's timeline.
- Inspect supporting event history and contradictory evidence.
- Search and optionally view discoveries on the game map.
- Identify stale/unverified hypotheses; no silent promotion of guesses into facts.

### Agent View

Use a RuneScape-inspired layout with a **Revision 274 minimap as the main view**. Show the selected character's location and, when available, its destination and route. Keep the character switcher visible, along with connection status and the time of the latest update.

- **At a glance.** Show a compact hierarchy of the current **Goal → Approach → Execution** next to the minimap. For example, reach 99 Woodcutting → train at a nearby stand of trees → chopping a tree now.
- **Agent Journal.** Add short, first-person decision summaries grounded in recorded events. An entry could read, “I’m working toward 99 Woodcutting. I’m trying these trees because they’re nearby, and I’ll check how much XP I gain.” Link the entry to the decision and evidence. Keep routine events such as moves and XP gains available in the timeline so they can be inspected without crowding the journal. The journal and summary can start in the same panel, with the current activity pinned above recent entries.
- **Character panels.** Let users browse bank contents, inventory, equipment, stats and skills, XP, health, and the quest log. Use state observed through the ordinary client. For views that rely on a previous interaction, such as the bank, show when the data was last observed and indicate when it is unavailable.
- **Session details.** Include performance and model usage metrics where they help explain an agent's activity.

The Agent Journal shows generated summaries of the agent's recorded decisions and evidence. Historical replay can later use recorded positions, snapshots, and events. A separate stretch goal is a **live graphical spectator view** using the Revision 274 web client or its rendering code, subject to verifying how it could show the selected agent's existing session.

### Goal Explorer

For example, the UI might show:

```text
Master goal: Complete Dragon Slayer
 ├─ Hypothesis: Improve Defence before challenging a difficult fight
 │    └─ Approach: Train against a discovered safe enemy
 │         └─ Execution: Navigate → Attack → Observe → Recover
 └─ Investigate quest entry requirements
```

The dependency above is **illustrative**. Each dependency should carry a source or be identified as an unverified hypothesis. Clicking a node opens its decision, evidence and history.

### Control Center stack

- **React with TypeScript** for the Control Center frontend and **Vite** for local development and production builds. The browser loads runtime data through the API and subscribes to live updates.
- **Hono API** in the Agent Runtime serving discoveries, events, goals and current agent state to the frontend.
- **Server-Sent Events** initially for live updates; WebSockets later if bidirectional controls or high-frequency data justify them.
- **SQLite** for durable events, state snapshots and memory; avoid overengineering early.
- Map tile/viewer solution should be selected based on **verified** revision 274 map assets and licensing, not assumptions that a current OSRS map matches the 2004 world.
- Keep the web service private and authenticated; agent action channels must not be exposed to untrusted users.

### Visual identity

Use the 2004 RuneScape client as the visual reference for the entire Control Center. Carry its earthy browns, muted gold trim, beveled panels, and parchment tones across the Agent View, journal, and Discovery Explorer.

- Use the classic RuneScape interface font for headings, tabs, and short labels where the font can be used. Choose a close pixel-font alternative if needed. Keep longer journal entries, filters, and data tables readable at typical browser sizes.
- Take cues from the original minimap frame, inventory slots, equipment panel, and quest journal so the character views feel familiar to RuneScape players.
