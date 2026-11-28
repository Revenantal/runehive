import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../../tools/headless-experiment/demos/programs/round-trip.mjs';

const start = { x: 3222, z: 3217, level: 0 };
const destination = { x: 3222, z: 3219, level: 0 };

test('requests both legs sequentially using the observed starting position', async () => {
  const calls = [];
  const result = await main({
    state: { position: () => ({ ...start }) },
    moveTo: async (target) => {
      calls.push(target);
      return { outcome: 'completed', position: { ...target } };
    },
  });
  assert.deepEqual(calls, [destination, start]);
  assert.deepEqual(result, { outcome: 'completed', completedLegs: 2, position: start });
});

test('an unknown outbound outcome prevents the return request', async () => {
  const calls = [];
  const result = await main({
    state: { position: () => ({ ...start }) },
    moveTo: async (target) => {
      calls.push(target);
      return { outcome: 'unknown', reason: 'observation-interrupted' };
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(result, {
    outcome: 'unknown',
    reason: 'observation-interrupted',
    completedLegs: 0,
  });
});

test('an unknown return leg reports only the first leg complete', async () => {
  let count = 0;
  const result = await main({
    state: { position: () => ({ ...start }) },
    moveTo: async () =>
      ++count === 1 ? { outcome: 'completed' } : { outcome: 'unknown', reason: 'deadline' },
  });
  assert.deepEqual(result, { outcome: 'unknown', reason: 'deadline', completedLegs: 1 });
});

test('unknown starting position prevents all action requests', async () => {
  let called = false;
  const result = await main({
    state: { position: () => null },
    moveTo: async () => {
      called = true;
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { outcome: 'unknown', reason: 'position-unknown', completedLegs: 0 });
});
