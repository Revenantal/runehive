# Roadmap

[Project overview](../README.md)

## Milestone index

Read the table in the current build order. Each brief contains its goal, objectives, plan, and a demonstration or completion criteria. To insert or reorder a milestone, update the table and any affected dependencies. Filenames describe the work and can stay the same when the order changes.

| Milestone | What it delivers |
|---|---|
| M0 · [Project organization and setup](milestones/project-setup.md) | Written project guides, workspace folders, and a tested init command that fetches the LostCity sources locally. |
| M1 · [Play LostCity locally](milestones/local-lostcity.md) | A reproducible Revision 274 world the owner can manage from the project CLI and play in the graphical client. |
| M2 · [Build Aeris and its CLI](milestones/aeris-client.md) | A working headless client usable through typed commands and TypeScript scripts. |
| M3 · [Build the Execution layer](milestones/execution.md) | A bot can carry out a supplied task and verify the result in-game. |
| M4 · [Add map navigation and exploration](milestones/navigation-and-exploration.md) | An agent can reach and investigate a supplied location. |
| M5 · [Add Event History and Discovery Memory](milestones/discovery-memory.md) | A real observation becomes a retrievable discovery with evidence that survives a restart. |
| M6 · [Build the Approach layer](milestones/approach.md) | An agent can choose what to try next and explain its choice. |
| M7 · [Build the Goal layer](milestones/goal.md) | An agent can pursue and revise an objective across several activities. |
| M8 · [Build the Control Center](milestones/control-center.md) | One web app shows live agent activity, goal progression, and discoveries. |
| M9 · [Run multiple agents](milestones/multiple-agents.md) | Independent agents share discoveries, resume after restart, and can be selected in the Control Center. |
| M10 · [Explore optional features](milestones/optional-features.md) | Human nudges, replay, richer analysis, and a possible live spectator view. |

## Initial success scenarios

These small, end-to-end demonstrations should guide engineering more than speculative completeness claims.

**Scenario A: Shop discovery**
- Bot is told to find a better weapon.
- Uses game-native map label "sword shop" or other available POI clue.
- Walks normally, opens shop, records stock and location.
- Discovery Explorer shows the evidence.

**Scenario B: Shared learning**
- A second character looks for the same weapon.
- Recalls Agent A's discovery instead of independently exploring the whole map.
- Rechecks stock and makes a normal purchase when possible.

**Scenario C: Goal chain and observability**
- Bot holds a long-term quest/combat objective, creates tentative training subgoals, chooses a bounded activity and executes it.
- UI displays current map position, equipment, observed state, goals, decisions, action outcomes and discovery links.

**Scenario D: Non-binding human nudge**
- Human proposes a Defence training target.
- Agent checks relevance, known safety and priorities.
- It may accept, modify, defer, investigate or reject, with an audit record.

## Key risks and open questions

| Question / risk | Why it matters | First validation |
|---|---|---|
| Is revision 274 fully playable for our targeted historical goals? | Determines meaningful progression scope | Run representative real gameplay tests |
| Can a **stock** protocol-compatible headless client be built affordably? | Highest integration/maintenance risk | Login → movement → tree → XP proof |
| What map/cache labels are actually available to 274 clients? | Defines fair starting navigation knowledge | Inspect client/map data and in-game UI |
| Can we reliably observe shops/dialogues/quest journals without rendering? | Essential for discovery-first learning | Inspect normal client packet/interface state |
| What constitutes an agent's "perception" versus omniscient source knowledge? | Protects validity of the learning experiment | Write and test a perception policy |
| How do we detect failure vs ongoing action? | Prevents bad loops and incorrect memories | Action outcome contracts and tests |
| How do we prevent hallucinated memories and dependencies? | Critical to planner quality | Evidence links, hypotheses, contradiction handling |
| What do we record for map replay without huge storage? | UI usefulness vs performance/storage | Sample positions and event snapshots |
| Do three concurrent clients affect server performance? | Validates scalability | Load testing, tick metrics |
| How do we maintain compatibility with upstream changes? | Avoids long-lived fork burden | Pin commits, test adapter compatibility |
| What is a "verified" discovery? | Prevents overconfident shared facts | Explicit verification rules per observation type |
| Should human nudges be enabled by default? | Autonomy and experiment design | Feature flag, policy, audit |

## Decisions we're leaning toward vs. questions still open

### Preferred direction (still revisable)

- LostCity **Revision 274**, privately hosted.
- TypeScript-first custom ecosystem with **no upstream fork by default**.
- **Three layers** in order of delegation are Goal, Approach, and Execution.
- **No preloaded Game Knowledge Engine**; experiential **Discovery Memory** instead.
- Game-native map/POI access is permitted, subject to actual revision 274 data.
- SQLite for persistent events, memories, goals and state; FTS5 initially.
- React and TypeScript Control Center built with Vite, starting with the Discovery Explorer and adding live agent and goal views incrementally.
- Explainable, structured planner decisions rather than raw hidden reasoning.
- Optional human nudges treated as **untrusted suggestions** and evaluated, never blindly executed.
- Burst planning with roughly 10-minute Approach checkpoints and deterministic execution of normal actions.

### To verify or decide later

- Exact Revision 274 repo/branch/commit compatibility and tooling requirements.
- Feasibility and final design of the ordinary headless protocol client.
- What historical map and interface data are accessible to a headless client.
- The precise API/schema for events, evidence, decisions and memories.
- Whether embeddings, special planners, separate LLMs, or a semantic graph become necessary.
- Whether any narrow upstream integration patches are justified.
- UI interaction permissions and when to enable nudges or controls.
- Detailed costs, hosting footprint, concurrency and backup/retention policy.

## Guidance for a future AI development agent

When this document is used as project context:

1. **Treat it as intent, not immutable requirements.** Flag assumptions, risks and better alternatives.
2. **Investigate current upstream LostCity source and Revision 274 compatibility first.** Don't assume previous research is still accurate.
3. **Do not begin by forking LostCity, parsing the entire RuneScript world, or preloading OSRS wiki data.** Those conflict with the discovery-first experiment unless explicitly reconsidered.
4. **Prove a normal external player session first.** This is the principal technical feasibility gate.
5. **Implement thin vertical slices.** Prefer one real shop discovery saved to the UI over dozens of unfinished framework modules.
6. **Separate direct observations, interpretations, hypotheses and verified facts.** Attach evidence and revision context.
7. **Do not claim hidden chain-of-thought visibility.** Store concise, explicit decision records for inspection.
8. **Keep human nudges optional and advisory.** Never grant untrusted user text automatic execution authority.
9. **Measure and document tradeoffs.** Preserve TypeScript simplicity, external integration, realistic game actions, observability and learnability.
10. **Use the actual Revision 274 game as ground truth**, with the game client as the bot's perception/action boundary.
