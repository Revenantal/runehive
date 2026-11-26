import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState } from '../../tools/headless-experiment/initial-state.mjs';

/** Packs bit fields most significant bit first, as in the protocol. */
function bits(fields) {
  const text = fields.map(([value, width]) => value.toString(2).padStart(width, '0')).join('');
  const padded = text.padEnd(Math.ceil(text.length / 8) * 8, '0');
  return Buffer.from(padded.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
}

test('rebuild and local teleport combine into a world position', () => {
  const decoder = createInitialState();
  const rebuild = Buffer.alloc(4);
  rebuild.writeUInt16BE(386, 0);
  rebuild.writeUInt16BE(388, 2);
  decoder.apply({ name: 'REBUILD_NORMAL', payload: rebuild });
  decoder.apply({
    name: 'PLAYER_INFO',
    payload: bits([
      [1, 1],
      [3, 2],
      [0, 2],
      [54, 7],
      [50, 7],
      [1, 1],
      [0, 1],
    ]),
  });
  assert.deepEqual(decoder.state.position, { level: 0, x: 3094, z: 3106 });
  decoder.apply({ name: 'PLAYER_INFO', payload: Buffer.from([0]) });
  assert.equal(decoder.state.position.x, 3094);
  decoder.apply({
    name: 'PLAYER_INFO',
    payload: bits([
      [1, 1],
      [1, 2],
      [1, 3],
      [0, 1],
    ]),
  });
  assert.deepEqual(decoder.state.position, { level: 0, x: 3094, z: 3107 });
  decoder.apply({
    name: 'PLAYER_INFO',
    payload: bits([
      [1, 1],
      [2, 2],
      [4, 3],
      [6, 3],
      [0, 1],
    ]),
  });
  assert.deepEqual(decoder.state.position, { level: 0, x: 3095, z: 3106 });
});

test('position remains unknown without region and malformed state is rejected', () => {
  const decoder = createInitialState();
  decoder.apply({
    name: 'PLAYER_INFO',
    payload: bits([
      [1, 1],
      [3, 2],
      [0, 2],
      [1, 7],
      [2, 7],
      [0, 1],
      [0, 1],
    ]),
  });
  assert.equal(decoder.state.position, null);
  assert.throws(() => decoder.apply({ name: 'REBUILD_NORMAL', payload: Buffer.alloc(3) }));
  assert.throws(() => decoder.apply({ name: 'UPDATE_STAT', payload: Buffer.alloc(5) }));
});

test('skill and energy values are recorded only when received', () => {
  const decoder = createInitialState();
  assert.equal(decoder.state.energy, null);
  decoder.apply({ name: 'UPDATE_STAT', payload: Buffer.from([3, 0, 0, 0, 42, 10]) });
  decoder.apply({ name: 'UPDATE_RUNENERGY', payload: Buffer.from([100]) });
  assert.deepEqual(decoder.state.skills[3], { experience: 42, currentLevel: 10 });
  assert.equal(decoder.state.energy, 100);
});
