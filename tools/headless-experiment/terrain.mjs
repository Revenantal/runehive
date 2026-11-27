const LEVELS = 4;
const SIDE = 64;
const PLANE_SIZE = SIDE * SIDE;
const TOTAL_TILES = LEVELS * PLANE_SIZE;
const BLOCK = 1;
const LINK_BELOW = 2;

/** Decodes ground flags for one 64-by-64 region, or rejects a malformed archive. */
export function decodeTerrain(data) {
  if (!(data instanceof Uint8Array)) throw new Error('INVALID_TERRAIN');
  const flags = new Uint8Array(TOTAL_TILES);
  let offset = 0;
  /** Reads one byte without interpreting missing bytes as empty terrain. */
  function byte() {
    if (offset >= data.length) throw new Error('TRUNCATED_TERRAIN');
    return data[offset++];
  }
  for (let tile = 0; tile < TOTAL_TILES; tile++) {
    while (true) {
      const opcode = byte();
      if (opcode === 0) break;
      if (opcode === 1) {
        byte(); // Explicit height; not needed for ground collision.
        break;
      }
      if (opcode <= 49)
        byte(); // Overlay ID.
      else if (opcode <= 81) flags[tile] = opcode - 49;
      // Remaining opcodes are underlay IDs and have no extra byte.
    }
  }
  if (offset !== data.length) throw new Error('TRAILING_TERRAIN');
  return flags;
}

/** Builds ground-only collision flags, accounting for level-one link-below terrain. */
export function terrainGroundBlocks(flags) {
  if (!(flags instanceof Uint8Array) || flags.length !== TOTAL_TILES)
    throw new Error('INVALID_TERRAIN_FLAGS');
  const blocks = new Uint8Array(TOTAL_TILES);
  for (let level = 0; level < LEVELS; level++) {
    for (let tile = 0; tile < PLANE_SIZE; tile++) {
      if (!(flags[level * PLANE_SIZE + tile] & BLOCK)) continue;
      const effectiveLevel = level - (flags[PLANE_SIZE + tile] & LINK_BELOW ? 1 : 0);
      if (effectiveLevel >= 0) blocks[effectiveLevel * PLANE_SIZE + tile] = 1;
    }
  }
  return blocks;
}
