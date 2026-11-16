# Build Aeris and its CLI

[Roadmap](../roadmap.md) · [LostCity and Aeris](../lostcity-and-aeris.md)

## Goal

Build a TypeScript headless client that connects to the private Revision 274 world as an ordinary player. Make it usable through typed CLI commands and TypeScript scripts.

## Objectives and plan

- Use the [local LostCity setup](local-lostcity.md) to validate login, session handling, movement, and basic state updates.
- Expose position, nearby targets, interaction options, inventory, skills, and relevant interface state as the client learns to decode them.
- Provide a generic `interact` action that accepts an available interaction option for a target. Expose the same client operations to the CLI and scripts.
- Start with a small playable slice. If stock compatibility blocks it, record what failed and evaluate the fallback options in the Aeris design.

## Done when

The owner can log in, walk, inspect state, and interact by typing commands. A small script can use the same Aeris interface to interact with a tree and confirm an inventory or Woodcutting XP change from the game.
