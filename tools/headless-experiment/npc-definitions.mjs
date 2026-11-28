/** Fixed byte lengths of NPC definition fields that are skipped. */
const SKIPPED = new Map([
  [12, 1],
  [13, 2],
  [14, 2],
  [90, 2],
  [91, 2],
  [92, 2],
  [95, 2],
  [97, 2],
  [98, 2],
  [100, 1],
  [101, 1],
  [102, 2],
  [103, 2],
]);

/** Resolves one indexed NPC definition's client-visible name, description and option slots. */
export function decodeNpcDefinition(index, data, id) {
  if (!(index instanceof Uint8Array) || !(data instanceof Uint8Array))
    throw new Error('INVALID_NPC_CONFIG');
  if (index.length < 2 || data.length < 2) throw new Error('TRUNCATED_NPC_CONFIG');
  const count = (index[0] << 8) | index[1];
  if (index.length !== 2 + count * 2) throw new Error('INVALID_NPC_INDEX');
  if (!Number.isInteger(id) || id < 0 || id >= count) throw new Error('INVALID_NPC_ID');
  let start = 2;
  for (let i = 0; i < id; i++) start += (index[2 + i * 2] << 8) | index[3 + i * 2];
  const length = (index[2 + id * 2] << 8) | index[3 + id * 2];
  const end = start + length;
  if (end > data.length || length === 0) throw new Error('TRUNCATED_NPC_CONFIG');
  let cursor = start;
  /** Reads one record byte without crossing the definition boundary. */
  function byte() {
    if (cursor >= end) throw new Error('TRUNCATED_NPC_DEFINITION');
    return data[cursor++];
  }
  /** Skips bounded record bytes. */
  function skip(n) {
    if (cursor + n > end) throw new Error('TRUNCATED_NPC_DEFINITION');
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
  const definition = { name: null, description: null, options: Array(5).fill(null) };
  while (true) {
    const opcode = byte();
    if (opcode === 0) break;
    if (opcode === 1 || opcode === 60) skip(byte() * 2);
    else if (opcode === 2) definition.name = string();
    else if (opcode === 3) definition.description = string();
    else if (opcode === 17) skip(8);
    else if (opcode >= 30 && opcode < 40) {
      const text = string();
      definition.options[opcode - 30] = text.toLowerCase() === 'hidden' ? null : text;
    } else if (opcode === 40) skip(byte() * 4);
    else if (opcode === 93 || opcode === 99) continue;
    else if (SKIPPED.has(opcode)) skip(SKIPPED.get(opcode));
    else throw new Error('UNKNOWN_NPC_OPCODE');
  }
  if (cursor !== end) throw new Error('TRAILING_NPC_DEFINITION_DATA');
  return definition;
}
