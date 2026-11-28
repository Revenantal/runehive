import { terrainGroundBlocks } from './terrain.mjs';

const SIDE = 64;
const PLANE = SIDE * SIDE;
const DIRECTIONS = [
  { dx: -1, dz: 0, bit: 1, opposite: 4 },
  { dx: 0, dz: 1, bit: 2, opposite: 8 },
  { dx: 1, dz: 0, bit: 4, opposite: 1 },
  { dx: 0, dz: -1, bit: 8, opposite: 2 },
];

/** Builds a static cardinal collision snapshot for exactly two south-to-north adjacent regions. */
export function buildCrossRegionGrid(regions, definitions, level = 0) {
  if (
    !Array.isArray(regions) ||
    regions.length !== 2 ||
    !Number.isInteger(level) ||
    level < 0 ||
    level > 3
  )
    throw new Error('INVALID_REGIONS');
  const [south, north] = regions;
  if (
    !Number.isInteger(south?.x) ||
    !Number.isInteger(south?.z) ||
    south.x % SIDE !== 0 ||
    south.z % SIDE !== 0 ||
    north?.x !== south.x ||
    north?.z !== south.z + SIDE ||
    !(definitions instanceof Map) ||
    regions.some((r) => !Array.isArray(r.placements))
  )
    throw new Error('INVALID_REGIONS');
  const height = 2 * SIDE;
  const blocked = new Uint8Array(SIDE * height);
  const edges = new Uint8Array(SIDE * height);
  const index = (x, z) => x * height + z;
  const inside = (x, z) => x >= 0 && x < SIDE && z >= 0 && z < height;
  for (let r = 0; r < 2; r++) {
    const region = regions[r];
    const ground = terrainGroundBlocks(region.terrain);
    for (let x = 0; x < SIDE; x++)
      for (let z = 0; z < SIDE; z++)
        blocked[index(x, z + r * SIDE)] = ground[level * PLANE + x * SIDE + z];
  }
  // Keep the outer boundary unavailable because adjacent region data is missing.
  for (let x = 0; x < SIDE; x++) blocked[index(x, 0)] = blocked[index(x, height - 1)] = 1;
  for (let z = 0; z < height; z++) blocked[index(0, z)] = blocked[index(SIDE - 1, z)] = 1;
  for (let r = 0; r < 2; r++) {
    const region = regions[r];
    for (const p of region.placements) {
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
      const bridge = (region.terrain[PLANE + p.x * SIDE + p.z] & 2) !== 0;
      if (p.level - Number(bridge) !== level || !def.blockwalk) continue;
      const x = p.x,
        z = p.z + r * SIDE;
      if (p.shape === 22) {
        if (typeof def.active !== 'boolean') throw new Error('UNKNOWN_LOCATION_DEFINITION');
        if (def.active) blocked[index(x, z)] = 1;
      } else if (p.shape === 0 || p.shape === 2) {
        for (const direction of p.shape === 0 ? [p.rotation] : [p.rotation, (p.rotation + 1) % 4]) {
          const { dx, dz, bit, opposite } = DIRECTIONS[direction];
          edges[index(x, z)] |= bit;
          if (inside(x + dx, z + dz)) edges[index(x + dx, z + dz)] |= opposite;
        }
      } else if (p.shape !== 1 && p.shape !== 3) {
        const swap = p.rotation === 1 || p.rotation === 3;
        const width = swap ? def.length : def.width;
        const length = swap ? def.width : def.length;
        for (let dx = 0; dx < width; dx++)
          for (let dz = 0; dz < length; dz++)
            if (inside(x + dx, z + dz)) blocked[index(x + dx, z + dz)] = 1;
      }
    }
  }
  return { x: south.x, z: south.z, blocked, edges };
}

/** Finds a cardinal route through the two-region snapshot; null does not prove game blockage. */
export function findCrossRegionRoute(grid, start, target) {
  const height = SIDE * 2,
    size = SIDE * height;
  if (
    !(grid?.blocked instanceof Uint8Array) ||
    grid.blocked.length !== size ||
    !(grid.edges instanceof Uint8Array) ||
    grid.edges.length !== size ||
    !Number.isInteger(grid.x) ||
    !Number.isInteger(grid.z)
  )
    throw new Error('INVALID_GRID');
  const point = (p) => ({ x: p?.x - grid.x, z: p?.z - grid.z });
  const a = point(start),
    b = point(target);
  const valid = (p) =>
    Number.isInteger(p.x) &&
    p.x >= 0 &&
    p.x < SIDE &&
    Number.isInteger(p.z) &&
    p.z >= 0 &&
    p.z < height;
  if (!valid(a) || !valid(b)) throw new Error('INVALID_ROUTE_POINT');
  const source = a.x * height + a.z,
    destination = b.x * height + b.z;
  if (grid.blocked[source] || grid.blocked[destination]) return null;
  const previous = new Int32Array(size).fill(-1),
    queue = new Int32Array(size);
  let head = 0,
    tail = 0;
  queue[tail++] = source;
  previous[source] = source;
  while (head < tail && previous[destination] === -1) {
    const current = queue[head++],
      x = Math.floor(current / height),
      z = current % height;
    for (const { dx, dz, bit, opposite } of DIRECTIONS) {
      const nx = x + dx,
        nz = z + dz;
      if (!valid({ x: nx, z: nz })) continue;
      const next = nx * height + nz;
      if (
        grid.blocked[next] ||
        grid.edges[current] & bit ||
        grid.edges[next] & opposite ||
        previous[next] !== -1
      )
        continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[destination] === -1) return null;
  const route = [];
  for (let at = destination; at !== source; at = previous[at])
    route.push({ x: grid.x + Math.floor(at / height), z: grid.z + (at % height) });
  return route.reverse();
}
