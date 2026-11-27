import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeLocationDefinition } from '../../tools/headless-experiment/location-definitions.mjs';

/** Builds a small synthetic index and data pair with the browser's two-byte header. */
function config(records) {
  const index = Buffer.alloc(2 + records.length * 2);
  index.writeUInt16BE(records.length);
  records.forEach((r, i) => index.writeUInt16BE(r.length, 2 + i * 2));
  return [index, Buffer.concat([Buffer.alloc(2), ...records.map((r) => Buffer.from(r))])];
}

test('reads indexed sizes and collision flags without retaining object text', () => {
  const [index, data] = config([[0], [14, 2, 15, 3, 17, 2, 65, 10, 0]]);
  assert.deepEqual(decodeLocationDefinition(index, data, 1), {
    width: 2,
    length: 3,
    blockwalk: false,
    blockrange: true,
    active: false,
  });
});

test('handles inferred active objects and the break-routefinding override', () => {
  const [index, data] = config([
    [1, 1, 0, 5, 10, 74, 0],
    [30, 120, 10, 0],
    [19, 0, 30, 120, 10, 0],
  ]);
  assert.deepEqual(decodeLocationDefinition(index, data, 0), {
    width: 1,
    length: 1,
    blockwalk: false,
    blockrange: false,
    active: true,
  });
  assert.equal(decodeLocationDefinition(index, data, 1).active, true);
  assert.equal(decodeLocationDefinition(index, data, 2).active, false);
});

test('rejects unknown opcodes, truncated records and inconsistent indexes', () => {
  let [index, data] = config([[99, 0]]);
  assert.throws(() => decodeLocationDefinition(index, data, 0), /UNKNOWN_LOCATION_OPCODE/);
  [index, data] = config([[14]]);
  assert.throws(() => decodeLocationDefinition(index, data, 0), /TRUNCATED_LOCATION_DEFINITION/);
  assert.throws(
    () => decodeLocationDefinition(Buffer.from([0, 1]), data, 0),
    /INVALID_LOCATION_INDEX/,
  );
  assert.throws(() => decodeLocationDefinition(index, data, 1), /INVALID_LOCATION_ID/);
});

test('optionally reads names and visible action slots for nearby objects', () => {
  const [index, data] = config([
    [
      2,
      ...Buffer.from('Door'),
      10,
      30,
      ...Buffer.from('Open'),
      10,
      31,
      ...Buffer.from('Hidden'),
      10,
      0,
    ],
  ]);
  const result = decodeLocationDefinition(index, data, 0, { includeText: true });
  assert.equal(result.name, 'Door');
  assert.deepEqual(result.options, ['Open', null, null, null, null]);
});
