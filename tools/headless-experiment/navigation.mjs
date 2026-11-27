import { terrainGroundBlocks } from './terrain.mjs';

const SIDE = 64;
const PLANE = SIDE * SIDE;
// West, north, east, south; paired opposite bits describe the same shared edge.
const DIRECTIONS = [
  { dx: -1, dz: 0, bit: 1, opposite: 4 },
  { dx: 0, dz: 1, bit: 2, opposite: 8 },
  { dx: 1, dz: 0, bit: 4, opposite: 1 },
  { dx: 0, dz: -1, bit: 8, opposite: 2 },
];

/** Builds a conservative static snapshot; it is not safe after unprocessed world changes. */
export function buildConservativeGrid(terrainFlags, placements, definitions, level = 0) {
  if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error('INVALID_LEVEL');
  const ground = terrainGroundBlocks(terrainFlags);
  const blocked = ground.slice(level * PLANE, (level + 1) * PLANE);
  const edges = new Uint8Array(PLANE);
  /** Marks a cell blocked if it belongs to this region. */
  function mark(x, z) {
    if (x >= 0 && z >= 0 && x < SIDE && z < SIDE) blocked[x * SIDE + z] = 1;
  }
  // The adjacent region is unknown, including objects extending inward across its boundary.
  for (let i = 0; i < SIDE; i++) {
    mark(0, i);
    mark(SIDE - 1, i);
    mark(i, 0);
    mark(i, SIDE - 1);
  }
  for (const p of placements) {
    if (
      !Number.isInteger(p.x) ||
      p.x < 0 ||
      p.x >= SIDE ||
      !Number.isInteger(p.z) ||
      p.z < 0 ||
      p.z >= SIDE ||
      !Number.isInteger(p.level) ||
      p.level < 0 ||
      p.level > 3 ||
      !Number.isInteger(p.rotation) ||
      p.rotation < 0 ||
      p.rotation > 3 ||
      !Number.isInteger(p.shape) ||
      p.shape < 0 ||
      p.shape > 63
    )
      throw new Error('INVALID_PLACEMENT');
    const def = definitions.get(p.id);
    if (
      !def ||
      !Number.isInteger(def.width) ||
      def.width < 1 ||
      !Number.isInteger(def.length) ||
      def.length < 1 ||
      typeof def.blockwalk !== 'boolean'
    )
      throw new Error('UNKNOWN_LOCATION_DEFINITION');
    const bridge = (terrainFlags[PLANE + p.x * SIDE + p.z] & 2) !== 0;
    if (p.level - Number(bridge) !== level || !def.blockwalk) continue;
    // Inactive ground decorations do not block walking in the browser.
    if (p.shape === 22) {
      if (typeof def.active !== 'boolean') throw new Error('UNKNOWN_LOCATION_DEFINITION');
      if (!def.active) continue;
      mark(p.x, p.z);
      continue;
    }
    if (p.shape === 0 || p.shape === 2) {
      // A straight wall has one boundary; an L wall has two adjacent boundaries.
      for (const direction of p.shape === 0 ? [p.rotation] : [p.rotation, (p.rotation + 1) % 4]) {
        const { dx, dz, bit, opposite } = DIRECTIONS[direction];
        edges[p.x * SIDE + p.z] |= bit;
        const x = p.x + dx,
          z = p.z + dz;
        if (x >= 0 && x < SIDE && z >= 0 && z < SIDE) edges[x * SIDE + z] |= opposite;
      }
    } else if (p.shape === 1 || p.shape === 3) {
      // Corner walls only set diagonal flags, which do not affect cardinal movement.
      // Diagonal route search must not be enabled without modeling those flags.
    } else {
      // Treat all other walk-blocking placements as full footprints, even decorations.
      const swap = p.rotation === 1 || p.rotation === 3;
      const width = swap ? def.length : def.width;
      const length = swap ? def.width : def.length;
      for (let dx = 0; dx < width; dx++)
        for (let dz = 0; dz < length; dz++) mark(p.x + dx, p.z + dz);
    }
  }
  return { blocked, edges };
}

/** Searches cardinal neighbors only; null means no route in this conservative snapshot, not blocked in game. */
export function findConservativeRoute(grid, start, target) {
  const { blocked, edges } = grid ?? {};
  if (
    !(blocked instanceof Uint8Array) ||
    blocked.length !== PLANE ||
    !(edges instanceof Uint8Array) ||
    edges.length !== PLANE
  )
    throw new Error('INVALID_GRID');
  const valid = (p) =>
    Number.isInteger(p?.x) &&
    p.x >= 0 &&
    p.x < SIDE &&
    Number.isInteger(p?.z) &&
    p.z >= 0 &&
    p.z < SIDE;
  if (!valid(start) || !valid(target)) throw new Error('INVALID_ROUTE_POINT');
  const source = start.x * SIDE + start.z;
  const destination = target.x * SIDE + target.z;
  if (blocked[source] || blocked[destination]) return null;
  const previous = new Int32Array(PLANE).fill(-1);
  const queue = new Int32Array(PLANE);
  let head = 0,
    tail = 0;
  queue[tail++] = source;
  previous[source] = source;
  while (head < tail && previous[destination] === -1) {
    const current = queue[head++],
      x = Math.floor(current / SIDE),
      z = current % SIDE;
    for (const { dx, dz, bit, opposite } of DIRECTIONS) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= SIDE || nz >= SIDE) continue;
      const next = nx * SIDE + nz;
      if (blocked[next] || edges[current] & bit || edges[next] & opposite || previous[next] !== -1)
        continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[destination] === -1) return null;
  const route = [];
  for (let at = destination; at !== source; at = previous[at])
    route.push({ x: Math.floor(at / SIDE), z: at % SIDE });
  route.reverse();
  return route;
}
