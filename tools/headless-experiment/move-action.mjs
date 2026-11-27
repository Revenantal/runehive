/** Creates a single-flight movement action over an externally supplied experimental snapshot. */
export function createMoveAction({
  regionX,
  regionZ,
  level,
  grid,
  findRoute,
  position,
  sendWalk,
  invalidated,
  stopped,
  sleep,
  now,
  timeoutMs = 20_000,
}) {
  let busy = false;
  return async function moveTo(target) {
    if (busy) return { outcome: 'unknown', reason: 'action-in-progress' };
    busy = true;
    try {
      const start = position();
      const valid = (p) =>
        Number.isInteger(p?.x) && Number.isInteger(p?.z) && Number.isInteger(p?.level);
      if (!valid(start) || !valid(target))
        return { outcome: 'unknown', reason: 'position-unknown' };
      if (
        start.level !== level ||
        target.level !== level ||
        Math.floor(start.x / 64) * 64 !== regionX ||
        Math.floor(start.z / 64) * 64 !== regionZ ||
        Math.floor(target.x / 64) * 64 !== regionX ||
        Math.floor(target.z / 64) * 64 !== regionZ
      )
        return { outcome: 'unknown', reason: 'outside-snapshot' };
      if (invalidated() || stopped()) return { outcome: 'unknown', reason: 'snapshot-unavailable' };
      if (start.x === target.x && start.z === target.z)
        return { outcome: 'completed', position: { ...start } };
      const localStart = { x: start.x - regionX, z: start.z - regionZ };
      const route = findRoute(grid, localStart, { x: target.x - regionX, z: target.z - regionZ });
      if (!route || !route.length || route.length > 24)
        return { outcome: 'unknown', reason: 'no-bounded-route' };
      sendWalk({
        startX: start.x,
        startZ: start.z,
        steps: route.map((tile) => [tile.x - localStart.x, tile.z - localStart.z]),
      });
      const deadline = now() + timeoutMs;
      while (now() < deadline) {
        if (invalidated() || stopped())
          return { outcome: 'unknown', reason: 'observation-interrupted' };
        const observed = position();
        if (!valid(observed)) return { outcome: 'unknown', reason: 'position-unknown' };
        if (observed.x === target.x && observed.z === target.z && observed.level === target.level)
          return { outcome: 'completed', position: { ...observed } };
        await sleep(100);
      }
      return { outcome: 'unknown', reason: 'deadline' };
    } finally {
      busy = false;
    }
  };
}
