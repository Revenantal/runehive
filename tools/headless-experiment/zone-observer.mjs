import { SERVER_PACKETS } from './server-packets.mjs';

const ZONE_NAMES = new Set([
  'P_LOCMERGE',
  'LOC_ANIM',
  'OBJ_DEL',
  'OBJ_REVEAL',
  'LOC_ADD_CHANGE',
  'MAP_PROJANIM',
  'LOC_DEL',
  'OBJ_COUNT',
  'MAP_ANIM',
  'OBJ_ADD',
]);
const ZONE_OPS = new Map([...SERVER_PACKETS].filter(([, value]) => ZONE_NAMES.has(value.name)));

/** Decodes zone location changes relative to a known browser build-area origin and level. */
export function createZoneObserver({ baseX, baseZ, level, includeObjects = false }) {
  if (
    !Number.isInteger(baseX) ||
    !Number.isInteger(baseZ) ||
    !Number.isInteger(level) ||
    level < 0 ||
    level > 3
  )
    throw new Error('INVALID_BUILD_AREA');
  let zone = null;
  /** Extracts the build-area-relative zone origin. */
  function header(payload) {
    if (payload.length < 2 || payload[0] >= 104 || payload[1] >= 104)
      throw new Error('INVALID_ZONE_HEADER');
    return { x: payload[0], z: payload[1] };
  }
  /** Extracts collision-relevant location operations and flags timed changes. */
  function operation(name, payload, origin) {
    if (!origin) throw new Error('UNKNOWN_ZONE_ORIGIN');
    const isObject = name.startsWith('OBJ_');
    if (isObject && !includeObjects) return null;
    if (!isObject && name !== 'LOC_ADD_CHANGE' && name !== 'LOC_DEL' && name !== 'P_LOCMERGE')
      return null;
    const x = origin.x + ((payload[0] >> 4) & 7),
      z = origin.z + (payload[0] & 7);
    if (x >= 104 || z >= 104) throw new Error('ZONE_TILE_OUTSIDE_BUILD');
    if (isObject) {
      const at = { level, x: baseX + x, z: baseZ + z };
      const short = (offset) => payload[offset] * 256 + payload[offset + 1];
      if (name === 'OBJ_ADD') return { kind: 'object-add', ...at, id: short(1), count: short(3) };
      if (name === 'OBJ_DEL') return { kind: 'object-remove', ...at, id: short(1) & 0x7fff };
      if (name === 'OBJ_COUNT')
        return { kind: 'object-count', ...at, id: short(1) & 0x7fff, from: short(3), to: short(5) };
      return { kind: 'object-reveal', ...at, id: short(1), count: short(3), owner: short(5) };
    }
    if (name === 'P_LOCMERGE')
      return { kind: 'unknown-timed-location-change', level, x: baseX + x, z: baseZ + z };
    const shape = payload[1] >> 2;
    if (shape > 22) throw new Error('INVALID_LOCATION_SHAPE');
    return {
      kind: name === 'LOC_DEL' ? 'remove' : 'add-change',
      level,
      x: baseX + x,
      z: baseZ + z,
      shape,
      rotation: payload[1] & 3,
      ...(name === 'LOC_ADD_CHANGE' ? { id: payload[2] * 256 + payload[3] } : {}),
    };
  }
  return {
    /** Returns decoded events; malformed or unsupported zone data must invalidate the snapshot. */
    apply(packet) {
      if (!packet || packet.broken || !(packet.payload instanceof Uint8Array))
        throw new Error('INVALID_PACKET');
      const { name, payload } = packet;
      if (name === 'REBUILD_NORMAL') {
        zone = null;
        return [{ kind: 'rebuild-required' }];
      }
      if (name === 'UPDATE_ZONE_PARTIAL_FOLLOWS' || name === 'UPDATE_ZONE_FULL_FOLLOWS') {
        if (payload.length !== 2) throw new Error('INVALID_ZONE_HEADER');
        zone = header(payload);
        return name === 'UPDATE_ZONE_FULL_FOLLOWS'
          ? [{ kind: 'zone-reset', level, x: baseX + zone.x, z: baseZ + zone.z }]
          : [];
      }
      if (name === 'UPDATE_ZONE_PARTIAL_ENCLOSED') {
        const nextZone = header(payload),
          events = [];
        let offset = 2;
        while (offset < payload.length) {
          const info = ZONE_OPS.get(payload[offset++]);
          if (!info || offset + info.length > payload.length)
            throw new Error('INVALID_ENCLOSED_ZONE_OPERATION');
          const event = operation(
            info.name,
            payload.subarray(offset, offset + info.length),
            nextZone,
          );
          if (event) events.push(event);
          offset += info.length;
        }
        zone = nextZone;
        return events;
      }
      if (ZONE_NAMES.has(name)) {
        const info = [...ZONE_OPS.values()].find((value) => value.name === name);
        if (payload.length !== info.length) throw new Error('INVALID_ZONE_OPERATION');
        const event = operation(name, payload, zone);
        return event ? [event] : [];
      }
      return [];
    },
  };
}
