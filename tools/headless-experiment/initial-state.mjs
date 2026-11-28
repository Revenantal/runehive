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

/** Accumulates only fields explicitly received from the server; missing values remain unknown. */
export function createInitialState() {
  const state = { region: null, position: null, energy: null, skills: {} };
  return {
    state,
    /** Applies a supported packet; malformed packets throw rather than inventing state. */
    apply(packet) {
      const p = packet.payload;
      if (packet.name === 'REBUILD_NORMAL') {
        if (p.length !== 4) throw new Error('INVALID_REBUILD');
        const zoneX = p.readUInt16BE(0);
        const zoneZ = p.readUInt16BE(2);
        state.region = { zoneX, zoneZ, baseX: (zoneX - 6) * 8, baseZ: (zoneZ - 6) * 8 };
        // A rebuild re-centres the loaded area but does not move the player: the browser client
        // shifts every entity's local coordinates by the change in base so absolute positions are
        // kept, and the server then sends only relative movement. A position already known stays
        // known; a teleport still replaces it with the absolute position the server sends.
      } else if (packet.name === 'PLAYER_INFO') {
        const bits = new BitReader(p);
        if (!bits.read(1)) return;
        const type = bits.read(2);
        if (type === 3) {
          const level = bits.read(2);
          const localX = bits.read(7);
          const localZ = bits.read(7);
          bits.read(2); // jump and extended-info flags
          if (state.region) {
            state.position = {
              level,
              x: state.region.baseX + localX,
              z: state.region.baseZ + localZ,
            };
          }
        } else if (type === 1 || type === 2) {
          const directions = [bits.read(3)];
          if (type === 2) directions.push(bits.read(3));
          bits.read(1); // extended-info flag
          if (state.position) {
            for (const direction of directions) {
              const [dx, dz] = DIRECTIONS[direction];
              state.position.x += dx;
              state.position.z += dz;
            }
          }
        }
      } else if (packet.name === 'UPDATE_STAT') {
        if (p.length !== 6) throw new Error('INVALID_STAT');
        state.skills[p[0]] = { experience: p.readInt32BE(1), currentLevel: p[5] };
      } else if (packet.name === 'UPDATE_RUNENERGY') {
        if (p.length !== 1) throw new Error('INVALID_ENERGY');
        state.energy = p[0];
      }
    },
  };
}
