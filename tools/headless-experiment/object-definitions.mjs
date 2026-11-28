/** Fixed byte lengths of item definition fields whose values are skipped. */
const SKIPPED = new Map([
  [1, 2],
  [4, 2],
  [5, 2],
  [6, 2],
  [7, 2],
  [8, 2],
  [10, 2],
  [12, 4],
  [23, 3],
  [24, 2],
  [25, 3],
  [26, 2],
  [78, 2],
  [79, 2],
  [90, 2],
  [91, 2],
  [92, 2],
  [93, 2],
  [95, 2],
  [97, 2],
  [98, 2],
  [110, 2],
  [111, 2],
  [112, 2],
  [113, 1],
  [114, 1],
]);

/** Resolves one indexed item definition's name, description and visible option slots. */
export function decodeObjectDefinition(index, data, id) {
  if (!(index instanceof Uint8Array) || !(data instanceof Uint8Array))
    throw new Error('INVALID_OBJECT_CONFIG');
  if (index.length < 2 || data.length < 2) throw new Error('TRUNCATED_OBJECT_CONFIG');
  const count = (index[0] << 8) | index[1];
  if (index.length !== 2 + count * 2) throw new Error('INVALID_OBJECT_INDEX');
  if (!Number.isInteger(id) || id < 0 || id >= count) throw new Error('INVALID_OBJECT_ID');
  let start = 2;
  for (let i = 0; i < id; i++) start += (index[2 + i * 2] << 8) | index[3 + i * 2];
  const length = (index[2 + id * 2] << 8) | index[3 + id * 2];
  const end = start + length;
  if (end > data.length || length === 0) throw new Error('TRUNCATED_OBJECT_CONFIG');
  let cursor = start;
  /** Reads one record byte without crossing the definition boundary. */
  function byte() {
    if (cursor >= end) throw new Error('TRUNCATED_OBJECT_DEFINITION');
    return data[cursor++];
  }
  /** Skips bounded record bytes. */
  function skip(n) {
    if (cursor + n > end) throw new Error('TRUNCATED_OBJECT_DEFINITION');
    cursor += n;
  }
  /** Reads a newline-terminated client string within the definition boundary. */
  function string() {
    const first = cursor;
    while (byte() !== 10) {
      // Scan to the terminator without crossing the record boundary.
    }
    return Buffer.from(data.subarray(first, cursor - 1)).toString('latin1');
  }
  const definition = {
    name: null,
    description: null,
    stackable: false,
    options: Array(5).fill(null),
    inventoryOptions: Array(5).fill(null),
  };
  while (true) {
    const opcode = byte();
    if (opcode === 0) break;
    if (opcode === 2) definition.name = string();
    else if (opcode === 3) definition.description = string();
    else if (opcode === 11) definition.stackable = true;
    else if (opcode === 16) continue;
    else if (opcode >= 30 && opcode < 35) {
      const text = string();
      definition.options[opcode - 30] = text.toLowerCase() === 'hidden' ? null : text;
    } else if (opcode >= 35 && opcode < 40) definition.inventoryOptions[opcode - 35] = string();
    else if (opcode === 40) skip(byte() * 4);
    else if (opcode >= 100 && opcode < 110) skip(4);
    else if (SKIPPED.has(opcode)) skip(SKIPPED.get(opcode));
    else throw new Error('UNKNOWN_OBJECT_OPCODE');
  }
  if (cursor !== end) throw new Error('TRAILING_OBJECT_DEFINITION_DATA');
  return definition;
}
