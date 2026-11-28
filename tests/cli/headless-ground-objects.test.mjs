import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGroundObjects } from '../../tools/headless-experiment/ground-objects.mjs';
import { gameMessage } from '../../tools/headless-experiment/messages.mjs';
import { createZoneObserver } from '../../tools/headless-experiment/zone-observer.mjs';

const origin = { baseX: 3200, baseZ: 3200, level: 0 };
const header = { name: 'UPDATE_ZONE_PARTIAL_FOLLOWS', payload: Uint8Array.from([48, 24]) };
const op = (name, ...bytes) => ({ name, payload: Uint8Array.from(bytes) });

test('ground item packets decode only when objects are requested', () => {
  const plain = createZoneObserver(origin);
  plain.apply(header);
  assert.deepEqual(plain.apply(op('OBJ_ADD', 0x23, 5, 7, 0, 24)), []);
  const observer = createZoneObserver({ ...origin, includeObjects: true });
  observer.apply(header);
  assert.deepEqual(observer.apply(op('OBJ_ADD', 0x23, 5, 7, 0, 24)), [
    { kind: 'object-add', level: 0, x: 3250, z: 3227, id: 1287, count: 24 },
  ]);
  assert.deepEqual(observer.apply(op('OBJ_DEL', 0x23, 0x85, 7)), [
    { kind: 'object-remove', level: 0, x: 3250, z: 3227, id: 1287 },
  ]);
  assert.deepEqual(observer.apply(op('OBJ_COUNT', 0x23, 5, 7, 0, 24, 0, 25)), [
    { kind: 'object-count', level: 0, x: 3250, z: 3227, id: 1287, from: 24, to: 25 },
  ]);
  assert.deepEqual(observer.apply(op('OBJ_REVEAL', 0x23, 5, 7, 0, 1, 1, 2)), [
    { kind: 'object-reveal', level: 0, x: 3250, z: 3227, id: 1287, count: 1, owner: 258 },
  ]);
});

test('the tracker adds, stacks, removes, recounts and clears a zone like the client', () => {
  const objects = createGroundObjects();
  const at = { level: 0, x: 3251, z: 3227 };
  objects.apply({ kind: 'object-add', ...at, id: 5, count: 1 });
  objects.apply({ kind: 'object-add', ...at, id: 6, count: 2 });
  objects.apply({ kind: 'object-count', ...at, id: 6, from: 2, to: 3 });
  assert.deepEqual(objects.at(0, 3251, 3227), [
    { id: 5, count: 1 },
    { id: 6, count: 3 },
  ]);
  objects.apply({ kind: 'object-remove', ...at, id: 5 });
  assert.deepEqual(objects.all(), [{ level: 0, x: 3251, z: 3227, id: 6, count: 3 }]);
  objects.apply({ kind: 'object-count', ...at, id: 6, from: 99, to: 1 });
  assert.equal(objects.at(0, 3251, 3227)[0].count, 3);
  objects.apply({ kind: 'zone-reset', level: 0, x: 3248, z: 3224 });
  assert.deepEqual(objects.all(), []);
  objects.apply({ kind: 'add-change', level: 0, x: 1, z: 1 });
  assert.deepEqual(objects.all(), []);
});

test('game messages read up to the first newline', () => {
  assert.equal(gameMessage(Buffer.from('You swing your axe.')), 'You swing your axe.');
  assert.equal(gameMessage(Buffer.from('Hi\nrest')), 'Hi');
  assert.throws(() => gameMessage('text'), /INVALID_MESSAGE_PACKET/);
});
