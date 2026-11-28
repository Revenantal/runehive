import { writeFileSync } from 'node:fs';

/**
 * Records selected server packets for use as test fixtures. Payloads are stored as hex; any
 * payload that contains the character's own name has it replaced, since dialogue displays it.
 */
export function createCapture({ names, ownName = '', limitPerName = 20 }) {
  const wanted = new Set(names);
  const packets = [];
  const counts = new Map();
  const needle = ownName ? Buffer.from(ownName, 'latin1') : null;
  /** Replaces every case-insensitive occurrence of the own name with same-length placeholder text. */
  function mask(payload) {
    if (!needle || !needle.length) return Buffer.from(payload);
    const text = Buffer.from(payload).toString('latin1');
    const placeholder = '#'.repeat(needle.length);
    return Buffer.from(
      text.replace(new RegExp(ownName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), placeholder),
      'latin1',
    );
  }
  return {
    /** Records one framed packet when its name was requested and its quota is not used up. */
    record(packet) {
      if (!wanted.has(packet.name) || !packet.payload) return;
      const seen = counts.get(packet.name) ?? 0;
      if (seen >= limitPerName) return;
      counts.set(packet.name, seen + 1);
      packets.push({ name: packet.name, payload: mask(packet.payload).toString('hex') });
    },
    /** Writes the recorded packets in arrival order. */
    write(path) {
      writeFileSync(path, `${JSON.stringify({ packets }, null, 1)}\n`);
      return packets.length;
    },
  };
}
