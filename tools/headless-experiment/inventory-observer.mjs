/**
 * Tracks inventory components from full and partial updates; item values on the wire are id + 1.
 * The server sends slots only up to its last non-empty one, so capacity comes from interface data.
 */
export function createInventoryObserver({ capacity = () => null } = {}) {
  const inventories = new Map();
  /** Reads a count that is one byte, or four bytes after a 255 marker. */
  function readCount(payload, cursor) {
    if (cursor.at >= payload.length) throw new Error('TRUNCATED_INVENTORY_PACKET');
    const first = payload[cursor.at++];
    if (first !== 255) return first;
    if (cursor.at + 4 > payload.length) throw new Error('TRUNCATED_INVENTORY_PACKET');
    const value =
      payload[cursor.at] * 2 ** 24 +
      (payload[cursor.at + 1] << 16) +
      (payload[cursor.at + 2] << 8) +
      payload[cursor.at + 3];
    cursor.at += 4;
    return value;
  }
  /** Reads one 16-bit value. */
  function readShort(payload, cursor) {
    if (cursor.at + 2 > payload.length) throw new Error('TRUNCATED_INVENTORY_PACKET');
    const value = (payload[cursor.at] << 8) | payload[cursor.at + 1];
    cursor.at += 2;
    return value;
  }
  return {
    /** Applies one framed server packet and returns a change event, or null for other packets. */
    apply(packet) {
      const payload = packet.payload;
      if (packet.name === 'UPDATE_INV_STOP_TRANSMIT') {
        if (payload?.length !== 2) throw new Error('INVALID_INVENTORY_PACKET');
        const component = (payload[0] << 8) | payload[1];
        inventories.delete(component);
        return { type: 'stopped', component };
      }
      if (packet.name !== 'UPDATE_INV_FULL' && packet.name !== 'UPDATE_INV_PARTIAL') return null;
      if (!(payload instanceof Uint8Array)) throw new Error('INVALID_INVENTORY_PACKET');
      const cursor = { at: 0 };
      const component = readShort(payload, cursor);
      if (packet.name === 'UPDATE_INV_FULL') {
        if (cursor.at >= payload.length) throw new Error('TRUNCATED_INVENTORY_PACKET');
        const size = payload[cursor.at++];
        const slots = [];
        for (let i = 0; i < size; i++) {
          const value = readShort(payload, cursor);
          slots.push({ item: value === 0 ? null : value - 1, count: readCount(payload, cursor) });
        }
        if (cursor.at !== payload.length) throw new Error('TRAILING_INVENTORY_DATA');
        const limit = capacity(component);
        if (limit !== null && size > limit) throw new Error('INVENTORY_SIZE_EXCEEDS_CAPACITY');
        while (limit !== null && slots.length < limit) slots.push({ item: null, count: 0 });
        inventories.set(component, slots);
        return { type: 'full', component, size };
      }
      const known = inventories.get(component);
      if (!known) throw new Error('INVENTORY_OUT_OF_SYNC');
      const next = known.map((slot) => ({ ...slot }));
      const changed = [];
      while (cursor.at < payload.length) {
        const slot = payload[cursor.at++];
        const value = readShort(payload, cursor);
        const count = readCount(payload, cursor);
        if (slot >= next.length) throw new Error('INVENTORY_SLOT_OUT_OF_RANGE');
        next[slot] = { item: value === 0 ? null : value - 1, count };
        changed.push(slot);
      }
      inventories.set(component, next);
      return { type: 'partial', component, slots: changed };
    },
    /** Returns a copy of one inventory component, or null if the server never sent it. */
    get(component) {
      const slots = inventories.get(component);
      return slots ? slots.map((slot) => ({ ...slot })) : null;
    },
    /** Lists known component ids. */
    components() {
      return [...inventories.keys()];
    },
    /** Forgets everything after a disconnect or unrecoverable parse error. */
    reset() {
      inventories.clear();
    },
  };
}
