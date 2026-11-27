import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeLocations } from '../../tools/headless-experiment/locations.mjs';

/** Encodes a nonnegative smart integer for synthetic fixtures. */
function smart(value) {
  return value < 128 ? [value] : [(value + 32768) >> 8, (value + 32768) & 255];
}

test('decodes grouped object IDs, position deltas, shape and rotation', () => {
  const first = (1 << 12) | (3 << 6) | 7;
  const second = first + 2;
  const bytes = Buffer.from([
    ...smart(201),
    ...smart(first + 1),
    42,
    ...smart(second - first + 1),
    1,
    0,
    ...smart(2),
    1,
    8,
    0,
    0,
  ]);
  assert.deepEqual(decodeLocations(bytes), [
    { id: 200, level: 1, x: 3, z: 7, shape: 10, rotation: 2 },
    { id: 200, level: 1, x: 3, z: 9, shape: 0, rotation: 1 },
    { id: 202, level: 0, x: 0, z: 0, shape: 2, rotation: 0 },
  ]);
});

test('rejects invalid inputs and truncated or trailing data', () => {
  assert.throws(() => decodeLocations('bad'), /INVALID_LOCATIONS/);
  assert.throws(() => decodeLocations(Buffer.from([128])), /TRUNCATED_LOCATIONS/);
  assert.throws(() => decodeLocations(Buffer.from([1, 1])), /TRUNCATED_LOCATIONS/);
  assert.throws(() => decodeLocations(Buffer.from([0, 0])), /TRAILING_LOCATIONS/);
  assert.throws(
    () => decodeLocations(Buffer.from([1, ...smart(16385), 0])),
    /INVALID_LOCATION_LEVEL/,
  );
});
