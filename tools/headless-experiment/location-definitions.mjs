/** Resolves a single indexed location definition without decoding the entire configuration. */
export function decodeLocationDefinition(index, data, id, { includeText = false } = {}) {
  if (!(index instanceof Uint8Array) || !(data instanceof Uint8Array))
    throw new Error('INVALID_LOCATION_CONFIG');
  if (index.length < 2 || data.length < 2) throw new Error('TRUNCATED_LOCATION_CONFIG');
  const count = (index[0] << 8) | index[1];
  if (index.length !== 2 + count * 2) throw new Error('INVALID_LOCATION_INDEX');
  if (!Number.isInteger(id) || id < 0 || id >= count) throw new Error('INVALID_LOCATION_ID');
  let start = 2;
  for (let i = 0; i < id; i++) start += (index[2 + i * 2] << 8) | index[3 + i * 2];
  const length = (index[2 + id * 2] << 8) | index[3 + id * 2];
  const end = start + length;
  if (end > data.length || length === 0) throw new Error('TRUNCATED_LOCATION_CONFIG');
  let cursor = start;
  /** Reads one record byte without crossing the definition boundary. */
  function byte() {
    if (cursor >= end) throw new Error('TRUNCATED_LOCATION_DEFINITION');
    return data[cursor++];
  }
  /** Skips bounded record bytes. */
  function skip(count) {
    if (cursor + count > end) throw new Error('TRUNCATED_LOCATION_DEFINITION');
    cursor += count;
  }
  /** Reads a newline-terminated client string within the definition boundary. */
  function string() {
    const start = cursor;
    while (byte() !== 10) {
      // Scan to the terminator without crossing the record boundary.
    }
    return includeText ? Buffer.from(data.subarray(start, cursor - 1)).toString('latin1') : null;
  }
  const definition = { width: 1, length: 1, blockwalk: true, blockrange: true, active: false };
  if (includeText) {
    definition.name = null;
    definition.description = null;
    definition.options = Array(5).fill(null);
  }
  let active = null;
  let models = false;
  let firstShape = null;
  let actions = false;
  let breakRoutefinding = false;
  while (true) {
    const opcode = byte();
    if (opcode === 0) break;
    if (opcode === 1 || opcode === 5) {
      const count = byte();
      models = true;
      firstShape = null;
      for (let i = 0; i < count; i++) {
        skip(2);
        if (opcode === 1) {
          const shape = byte();
          if (i === 0) firstShape = shape;
        }
      }
    } else if (opcode === 2 || opcode === 3 || (opcode >= 30 && opcode < 39)) {
      const value = string();
      if (includeText && opcode === 2) definition.name = value;
      if (includeText && opcode === 3) definition.description = value;
      if (opcode >= 30) {
        actions = true;
        if (includeText && opcode < 35 && value.toLowerCase() !== 'hidden')
          definition.options[opcode - 30] = value;
      }
    } else if (opcode === 14) definition.width = byte();
    else if (opcode === 15) definition.length = byte();
    else if (opcode === 17) definition.blockwalk = false;
    else if (opcode === 18) definition.blockrange = false;
    else if (opcode === 19) active = byte();
    else if ([21, 22, 23, 62, 64, 73].includes(opcode)) {
      // No payload and no effect on the fields retained here.
    } else if (opcode === 74) breakRoutefinding = true;
    else if ([28, 29, 39, 69, 75].includes(opcode)) skip(1);
    else if ([24, 60, 65, 66, 67, 68, 70, 71, 72].includes(opcode)) skip(2);
    else if (opcode === 40) skip(byte() * 4);
    else throw new Error('UNKNOWN_LOCATION_OPCODE');
  }
  if (cursor !== end) throw new Error('TRAILING_LOCATION_DEFINITION');
  definition.active =
    active === null
      ? (models && (firstShape === null || firstShape === 10)) || actions
      : active === 1;
  if (breakRoutefinding) {
    definition.blockwalk = false;
    definition.blockrange = false;
  }
  return definition;
}
