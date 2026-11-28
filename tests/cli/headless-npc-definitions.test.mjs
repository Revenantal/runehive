import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeNpcDefinition } from '../../tools/headless-experiment/npc-definitions.mjs';

/** Builds an index and data pair from encoded records. */
function config(...records) {
  const index = Buffer.alloc(2 + records.length * 2);
  index.writeUInt16BE(records.length, 0);
  records.forEach((record, i) => index.writeUInt16BE(record.length, 2 + i * 2));
  return { index, data: Buffer.concat([Buffer.from([0, records.length]), ...records]) };
}
const text = (value) => Buffer.from(`${value}\n`, 'latin1');

test('reads names, descriptions and visible options, skipping other fields', () => {
  const record = Buffer.concat([
    Buffer.from([1, 2, 0, 5, 0, 6]),
    Buffer.from([2]),
    text('Guide'),
    Buffer.from([3]),
    text('A person.'),
    Buffer.from([12, 1, 30]),
    text('Talk-to'),
    Buffer.from([31]),
    text('hidden'),
    Buffer.from([34]),
    text('Examine'),
    Buffer.from([40, 1, 0, 1, 0, 2, 93, 95, 0, 3, 0]),
  ]);
  const { index, data } = config(Buffer.from([0]), record);
  assert.deepEqual(decodeNpcDefinition(index, data, 1), {
    name: 'Guide',
    description: 'A person.',
    options: ['Talk-to', null, null, null, 'Examine'],
  });
});

test('rejects unknown opcodes, truncated records and bad ids', () => {
  const unknown = config(Buffer.from([250, 0]));
  assert.throws(() => decodeNpcDefinition(unknown.index, unknown.data, 0), /UNKNOWN_NPC_OPCODE/);
  const truncated = config(Buffer.from([30, 65, 66]));
  assert.throws(
    () => decodeNpcDefinition(truncated.index, truncated.data, 0),
    /TRUNCATED_NPC_DEFINITION/,
  );
  const empty = config(Buffer.from([0]));
  assert.throws(() => decodeNpcDefinition(empty.index, empty.data, 1), /INVALID_NPC_ID/);
  assert.throws(() => decodeNpcDefinition(empty.index, Buffer.alloc(1), 0), /TRUNCATED_NPC_CONFIG/);
});
