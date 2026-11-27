import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../../tools/headless-experiment/demos/programs/move-to-point.mjs';

test('simple program delegates its destination to the host action', async () => {
  const calls = [];
  const result = { outcome: 'unknown', reason: 'example' };
  assert.equal(
    await main({
      moveTo: async (target) => {
        calls.push(target);
        return result;
      },
    }),
    result,
  );
  assert.deepEqual(calls, [{ x: 3222, z: 3217, level: 0 }]);
});
