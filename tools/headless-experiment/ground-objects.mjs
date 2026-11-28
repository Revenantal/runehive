/** Tracks ground items from decoded zone events, mirroring how the client keeps them per tile. */
export function createGroundObjects() {
  const tiles = new Map();
  /** Builds the map key for one tile. */
  const key = (level, x, z) => `${level},${x},${z}`;
  return {
    /** Applies one decoded zone event; unrelated events are ignored. */
    apply(event) {
      if (event.kind === 'zone-reset') {
        // A full-zone reset clears every ground item in the 8x8 zone before it is rebuilt.
        for (let x = event.x; x < event.x + 8; x++)
          for (let z = event.z; z < event.z + 8; z++) tiles.delete(key(event.level, x, z));
        return;
      }
      if (!String(event.kind).startsWith('object-')) return;
      const id = key(event.level, event.x, event.z);
      const stack = tiles.get(id) ?? [];
      if (event.kind === 'object-add' || event.kind === 'object-reveal')
        stack.push({ id: event.id, count: event.count });
      else if (event.kind === 'object-remove') {
        const at = stack.findIndex((item) => item.id === event.id);
        if (at !== -1) stack.splice(at, 1);
      } else if (event.kind === 'object-count') {
        const item = stack.find((entry) => entry.id === event.id && entry.count === event.from);
        if (item) item.count = event.to;
      }
      if (stack.length) tiles.set(id, stack);
      else tiles.delete(id);
    },
    /** Returns a copy of the items on one tile, oldest first. */
    at(level, x, z) {
      return (tiles.get(key(level, x, z)) ?? []).map((item) => ({ ...item }));
    },
    /** Lists every known ground item as { level, x, z, id, count }. */
    all() {
      return [...tiles].flatMap(([id, stack]) => {
        const [level, x, z] = id.split(',').map(Number);
        return stack.map((item) => ({ level, x, z, ...item }));
      });
    },
  };
}
