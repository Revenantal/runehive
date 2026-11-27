const MAX_RECORDS = 100_000;

/** Decodes the placements in one 64-by-64 location archive; rejects incomplete or invalid data. */
export function decodeLocations(data) {
  if (!(data instanceof Uint8Array)) throw new Error('INVALID_LOCATIONS');
  let offset = 0;
  /** Reads an unsigned byte, refusing to interpret missing data as a terminator. */
  function byte() {
    if (offset >= data.length) throw new Error('TRUNCATED_LOCATIONS');
    return data[offset++];
  }
  /** Reads the browser protocol's unsigned one- or two-byte smart integer. */
  function smart() {
    const first = byte();
    return first < 128 ? first : ((first << 8) | byte()) - 32768;
  }
  const placements = [];
  let id = -1;
  while (true) {
    const delta = smart();
    if (delta === 0) break;
    id += delta;
    let packed = 0;
    while (true) {
      const positionDelta = smart();
      if (positionDelta === 0) break;
      packed += positionDelta - 1;
      const level = packed >> 12;
      if (level > 3) throw new Error('INVALID_LOCATION_LEVEL');
      const info = byte();
      if (placements.length >= MAX_RECORDS) throw new Error('TOO_MANY_LOCATIONS');
      placements.push({
        id,
        level,
        x: (packed >> 6) & 63,
        z: packed & 63,
        shape: info >> 2,
        rotation: info & 3,
      });
    }
  }
  if (offset !== data.length) throw new Error('TRAILING_LOCATIONS');
  return placements;
}
