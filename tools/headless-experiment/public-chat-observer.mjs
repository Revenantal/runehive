import { BitReader } from './packets.mjs';

/** Tracks anonymous player slots and extracts packed chat bytes from complete player updates. */
export function createPublicChatObserver() {
  let visible = [];
  return {
    /** Returns chat payloads with a local-or-remote source, rejecting unsupported or malformed data. */
    apply(payload) {
      if (!Buffer.isBuffer(payload)) throw new Error('INVALID_PLAYER_INFO');
      const bits = new BitReader(payload),
        updates = [],
        next = [];
      /** Reads the movement flags and queues the corresponding extended update. */
      function movement(id, local) {
        if (!bits.read(1)) return true;
        const operation = bits.read(2);
        if (operation === 3 && !local) return false;
        if (operation === 0) updates.push(id);
        else {
          if (operation === 1) bits.read(3);
          else if (operation === 2) bits.read(6);
          else bits.read(17);
          if (bits.read(1)) updates.push(id);
        }
        return true;
      }
      movement(null, true);
      const count = bits.read(8);
      if (count > visible.length) throw new Error('PLAYER_VISIBILITY_OUT_OF_SYNC');
      for (let i = 0; i < count; i++) if (movement(visible[i], false)) next.push(visible[i]);
      while (bits.remaining >= 11) {
        const id = bits.read(11);
        if (id === 2047) break;
        bits.read(11);
        if (bits.read(1)) updates.push(id);
        next.push(id);
      }
      let offset = Math.ceil(bits.bit / 8);
      /** Reads a bounded byte range so malformed fields cannot silently advance state. */
      function take(length) {
        if (!Number.isInteger(length) || length < 0 || offset + length > payload.length)
          throw new Error('TRUNCATED_PLAYER_INFO');
        const result = payload.subarray(offset, offset + length);
        offset += length;
        return result;
      }
      const messages = [];
      for (const id of updates) {
        let mask = take(1)[0];
        if (mask & 0x80) mask |= take(1)[0] << 8;
        if (mask & ~0x7ff) throw new Error('UNKNOWN_PLAYER_MASK');
        if (mask & 1) take(take(1)[0]);
        if (mask & 2) take(3);
        if (mask & 4) take(2);
        if (mask & 8) {
          while (take(1)[0] !== 10) {
            /* Skip the server-provided string. */
          }
        }
        if (mask & 0x10) take(4);
        if (mask & 0x20) take(4);
        if (mask & 0x40) {
          const header = take(4),
            data = take(header[3]);
          messages.push({
            source: id === null ? 'local' : 'remote',
            colour: header[0],
            effect: header[1],
            rights: header[2],
            packed: Buffer.from(data),
          });
        }
        if (mask & 0x100) take(6);
        if (mask & 0x200) take(9);
        if (mask & 0x400) take(4);
      }
      if (offset !== payload.length) throw new Error('TRAILING_PLAYER_INFO');
      visible = next;
      return messages;
    },
  };
}
