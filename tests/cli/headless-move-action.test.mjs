import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMoveAction } from '../../tools/headless-experiment/move-action.mjs';

function fixture() {
  let position = { x: 101, z: 201, level: 0 },
    time = 0,
    dirty = false,
    stopped = false;
  const sent = [];
  let afterSleep = () => {};
  const moveTo = createMoveAction({
    regionX: 64,
    regionZ: 192,
    level: 0,
    grid: {},
    findRoute: () => [{ x: 38, z: 9 }],
    position: () => position,
    sendWalk: (packet) => sent.push(packet),
    invalidated: () => dirty,
    stopped: () => stopped,
    sleep: async (ms) => {
      time += ms;
      afterSleep();
    },
    now: () => time,
    timeoutMs: 300,
  });
  return {
    moveTo,
    sent,
    setPosition: (value) => {
      position = value;
    },
    invalidate: () => {
      dirty = true;
    },
    stop: () => {
      stopped = true;
    },
    onSleep: (fn) => {
      afterSleep = fn;
    },
  };
}

test('reports completed only after client position reaches the target', async () => {
  const f = fixture();
  f.onSleep(() => f.setPosition({ x: 102, z: 201, level: 0 }));
  assert.deepEqual(await f.moveTo({ x: 102, z: 201, level: 0 }), {
    outcome: 'completed',
    position: { x: 102, z: 201, level: 0 },
  });
  assert.deepEqual(f.sent, [{ startX: 101, startZ: 201, steps: [[1, 0]] }]);
});

test('returns unknown for deadline and stale observations rather than blockage', async () => {
  const f = fixture();
  assert.deepEqual(await f.moveTo({ x: 102, z: 201, level: 0 }), {
    outcome: 'unknown',
    reason: 'deadline',
  });
  const g = fixture();
  g.onSleep(() => {
    g.setPosition({ x: 102, z: 201, level: 0 });
    g.invalidate();
  });
  assert.deepEqual(await g.moveTo({ x: 102, z: 201, level: 0 }), {
    outcome: 'unknown',
    reason: 'observation-interrupted',
  });
});

test('does not send if the position, level, region or snapshot is unknown', async () => {
  const f = fixture();
  assert.equal((await f.moveTo({ x: 102, z: 201, level: 1 })).reason, 'outside-snapshot');
  f.setPosition(null);
  assert.equal((await f.moveTo({ x: 102, z: 201, level: 0 })).reason, 'position-unknown');
  f.setPosition({ x: 101, z: 201, level: 0 });
  f.invalidate();
  assert.equal((await f.moveTo({ x: 102, z: 201, level: 0 })).reason, 'snapshot-unavailable');
  assert.deepEqual(f.sent, []);
});

test('returns unknown for a missing route without sending a request', async () => {
  let sent = false;
  const moveTo = createMoveAction({
    regionX: 64,
    regionZ: 192,
    level: 0,
    grid: {},
    findRoute: () => null,
    position: () => ({ x: 101, z: 201, level: 0 }),
    sendWalk: () => {
      sent = true;
    },
    invalidated: () => false,
    stopped: () => false,
    sleep: async () => {},
    now: () => 0,
  });
  assert.deepEqual(await moveTo({ x: 102, z: 201, level: 0 }), {
    outcome: 'unknown',
    reason: 'no-bounded-route',
  });
  assert.equal(sent, false);
});

test('does not send overlapping movement requests', async () => {
  let release;
  let stopped = false;
  const send = [];
  const moveTo = createMoveAction({
    regionX: 64,
    regionZ: 192,
    level: 0,
    grid: {},
    findRoute: () => [{ x: 38, z: 9 }],
    position: () => ({ x: 101, z: 201, level: 0 }),
    sendWalk: (request) => send.push(request),
    invalidated: () => false,
    stopped: () => stopped,
    sleep: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    now: () => 0,
  });
  const first = moveTo({ x: 102, z: 201, level: 0 });
  assert.deepEqual(await moveTo({ x: 102, z: 201, level: 0 }), {
    outcome: 'unknown',
    reason: 'action-in-progress',
  });
  stopped = true;
  release();
  assert.equal((await first).reason, 'observation-interrupted');
  assert.equal(send.length, 1);
});
