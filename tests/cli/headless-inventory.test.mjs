import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInventoryObserver } from '../../tools/headless-experiment/inventory-observer.mjs';
import { decodeObjectDefinition } from '../../tools/headless-experiment/object-definitions.mjs';

const packet = (name, ...bytes) => ({ name, payload: Uint8Array.from(bytes) });
const full = packet('UPDATE_INV_FULL', 12, 142, 3, 0, 0, 0, 0, 5, 1, 0, 1, 255, 0, 0, 1, 0);

test('full updates store ids minus one and read large counts', () => {
  const observer = createInventoryObserver();
  assert.deepEqual(observer.apply(full), { type: 'full', component: 3214, size: 3 });
  assert.deepEqual(observer.get(3214), [
    { item: null, count: 0 },
    { item: 4, count: 1 },
    { item: 0, count: 256 },
  ]);
  assert.deepEqual(observer.components(), [3214]);
});

test('partial updates change named slots and fail when out of sync or out of range', () => {
  const observer = createInventoryObserver();
  assert.throws(
    () => observer.apply(packet('UPDATE_INV_PARTIAL', 12, 142, 0, 0, 9, 1)),
    /OUT_OF_SYNC/,
  );
  observer.apply(full);
  assert.deepEqual(observer.apply(packet('UPDATE_INV_PARTIAL', 12, 142, 0, 0, 7, 2)), {
    type: 'partial',
    component: 3214,
    slots: [0],
  });
  assert.deepEqual(observer.get(3214)[0], { item: 6, count: 2 });
  const before = observer.get(3214);
  assert.throws(
    () => observer.apply(packet('UPDATE_INV_PARTIAL', 12, 142, 9, 0, 7, 1)),
    /OUT_OF_RANGE/,
  );
  assert.deepEqual(observer.get(3214), before);
});

test('malformed and stopped inventories are not kept', () => {
  const observer = createInventoryObserver();
  assert.throws(() => observer.apply(packet('UPDATE_INV_FULL', 12, 142, 2, 0, 5, 1)), /TRUNCATED/);
  assert.equal(observer.get(3214), null);
  observer.apply(full);
  assert.deepEqual(observer.apply(packet('UPDATE_INV_STOP_TRANSMIT', 12, 142)), {
    type: 'stopped',
    component: 3214,
  });
  assert.equal(observer.get(3214), null);
  assert.equal(observer.apply(packet('MESSAGE_GAME')), null);
});

/** Builds an index and data pair from encoded records, with the two-byte data header. */
function config(...records) {
  const index = Buffer.alloc(2 + records.length * 2);
  index.writeUInt16BE(records.length, 0);
  records.forEach((record, i) => index.writeUInt16BE(record.length, 2 + i * 2));
  return { index, data: Buffer.concat([Buffer.from([0, records.length]), ...records]) };
}
const text = (value) => Buffer.from(`${value}\n`, 'latin1');

test('item definitions expose names, stackability and both option lists', () => {
  const record = Buffer.concat([
    Buffer.from([1, 0, 9, 2]),
    text('Sword'),
    Buffer.from([11, 12, 0, 0, 0, 5, 30]),
    text('Take'),
    Buffer.from([35]),
    text('Wield'),
    Buffer.from([37]),
    text('Drop'),
    Buffer.from([100, 0, 1, 0, 2, 0]),
  ]);
  const { index, data } = config(record);
  assert.deepEqual(decodeObjectDefinition(index, data, 0), {
    name: 'Sword',
    description: null,
    stackable: true,
    options: ['Take', null, null, null, null],
    inventoryOptions: ['Wield', null, 'Drop', null, null],
  });
});

test('item definitions reject unknown opcodes and bad ids', () => {
  const { index, data } = config(Buffer.from([250, 0]));
  assert.throws(() => decodeObjectDefinition(index, data, 0), /UNKNOWN_OBJECT_OPCODE/);
  assert.throws(() => decodeObjectDefinition(index, data, 1), /INVALID_OBJECT_ID/);
});

test('known capacity pads sparse full updates so later slots can change', () => {
  const observer = createInventoryObserver({ capacity: () => 6 });
  observer.apply(full);
  assert.equal(observer.get(3214).length, 6);
  observer.apply(packet('UPDATE_INV_PARTIAL', 12, 142, 5, 0, 7, 1));
  assert.deepEqual(observer.get(3214)[5], { item: 6, count: 1 });
  assert.throws(
    () => observer.apply(packet('UPDATE_INV_PARTIAL', 12, 142, 6, 0, 7, 1)),
    /OUT_OF_RANGE/,
  );
  const small = createInventoryObserver({ capacity: () => 2 });
  assert.throws(() => small.apply(full), /EXCEEDS_CAPACITY/);
  assert.equal(small.get(3214), null);
});
