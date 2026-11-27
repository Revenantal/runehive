import { BitReader } from './packets.mjs';

const DIRECTIONS = [
  [-1, 1],
  [0, 1],
  [1, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const signed5 = (value) => (value > 15 ? value - 32 : value);

/** Tracks only the NPC visibility bit section; extended attributes are deliberately not decoded. */
export function createNpcObserver() {
  let visible = [];
  return {
    /** Applies one NPC_INFO payload atomically using the client's observed local position. */
    apply(payload, playerPosition) {
      if (!(payload instanceof Uint8Array)) throw new Error('INVALID_NPC_PACKET');
      const bits = new BitReader(payload),
        count = bits.read(8);
      if (count > visible.length) throw new Error('NPC_VISIBILITY_OUT_OF_SYNC');
      const next = [];
      for (let i = 0; i < count; i++) {
        const npc = { ...visible[i] };
        if (bits.read(1)) {
          const operation = bits.read(2);
          if (operation === 3) continue;
          if (operation === 0) npc.attributesUnverified = true;
          if (operation === 1 || operation === 2) {
            const steps = operation === 2 ? 2 : 1;
            for (let j = 0; j < steps; j++) {
              const [dx, dz] = DIRECTIONS[bits.read(3)];
              if (npc.x !== null) {
                npc.x += dx;
                npc.z += dz;
              }
            }
            if (bits.read(1)) npc.attributesUnverified = true;
          }
        }
        next.push(npc);
      }
      const seen = new Set(next.map((npc) => npc.index));
      while (bits.remaining > 21) {
        const index = bits.read(14);
        if (index === 16383) break;
        if (seen.has(index)) throw new Error('DUPLICATE_NPC_INDEX');
        const typeId = bits.read(11),
          dx = signed5(bits.read(5)),
          dz = signed5(bits.read(5));
        bits.read(1); // jump flag
        const attributesUnverified = Boolean(bits.read(1));
        const knownPosition =
          Number.isInteger(playerPosition?.x) &&
          Number.isInteger(playerPosition?.z) &&
          Number.isInteger(playerPosition?.level);
        next.push({
          index,
          typeId,
          x: knownPosition ? playerPosition.x + dx : null,
          z: knownPosition ? playerPosition.z + dz : null,
          level: knownPosition ? playerPosition.level : null,
          attributesUnverified,
        });
        seen.add(index);
      }
      visible = next;
      return next.map((npc) => ({ ...npc }));
    },
    /** Discards prior visibility after a disconnect or unrecoverable parsing error. */
    reset() {
      visible = [];
    },
  };
}
