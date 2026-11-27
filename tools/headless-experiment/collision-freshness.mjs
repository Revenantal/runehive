const INVALIDATING_PACKETS = new Set([
  'REBUILD_NORMAL',
  'UPDATE_ZONE_FULL_FOLLOWS',
  'UPDATE_ZONE_PARTIAL_FOLLOWS',
  'UPDATE_ZONE_PARTIAL_ENCLOSED',
  'LOC_ADD_CHANGE',
  'LOC_DEL',
  'P_LOCMERGE',
  'LOC_ANIM',
]);

/**
 * Tracks continuity during and after capture. It cannot reconstruct dynamic locations: callers
 * must not attest reconciliation unless their capture includes the current dynamic scene.
 * Start tracking before login and pass every framed packet in order.
 */
export function createCollisionFreshness() {
  let generation = 0;
  let connected = true;
  const tickets = new WeakMap();
  return {
    onPacket(packet) {
      if (!packet || packet.broken || typeof packet.name !== 'string') {
        connected = false;
        generation++;
      } else if (INVALIDATING_PACKETS.has(packet.name)) generation++;
    },
    invalidate() {
      generation++;
    },
    disconnect() {
      connected = false;
      generation++;
    },
    beginCapture() {
      const ticket = {};
      tickets.set(ticket, generation);
      return ticket;
    },
    /** A successful commit is only as sound as the caller's dynamic-scene reconciliation. */
    commitCapture(ticket, { dynamicSceneReconciled = false } = {}) {
      const captured = tickets.get(ticket);
      tickets.delete(ticket);
      if (
        !connected ||
        captured === undefined ||
        captured !== generation ||
        dynamicSceneReconciled !== true
      )
        return null;
      const committed = generation;
      return { isCurrent: () => connected && generation === committed };
    },
  };
}
