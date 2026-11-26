import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { LOGOUT_BUTTON_COMPONENT } from '../../tools/headless-experiment/logout.mjs';
import {
  DEFAULT_DESIGN,
  DESIGN_ACCEPT_COMPONENT,
  observeView,
} from '../../tools/headless-experiment/observe.mjs';

// Synthetic fixtures built to mirror the engine's player-update layout; not captured from a server.
class BitWriter {
  bits = [];
  write(width, value) {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
    return this;
  }
  toBuffer() {
    const bytes = Buffer.alloc(Math.ceil(this.bits.length / 8) + 1);
    this.bits.forEach((bit, i) => {
      if (bit) bytes[i >> 3] |= 1 << (7 - (i & 7));
    });
    return bytes;
  }
}

/** An update that keeps `before` players, drops `removed`, and adds the given pids. */
function update({ before, removed = 0, added = [] }) {
  const w = new BitWriter().write(1, 0).write(8, before);
  for (let i = 0; i < before; i++) {
    if (i < removed) w.write(1, 1).write(2, 3);
    else w.write(1, 0);
  }
  for (const pid of added) w.write(11, pid).write(5, 2).write(5, 30).write(1, 0).write(1, 1);
  w.write(11, 2047);
  return { opcode: 167, name: 'PLAYER_INFO', payload: w.toBuffer() };
}

class FakeSocket extends EventEmitter {
  destroyed = false;
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    queueMicrotask(() => this.emit('close'));
  }
}

/** Builds a harness: a fake clock, scripted packets keyed by elapsed ms, and a recording log. */
function harness({ script = [], staffLevel = 0, closeOnButton = true, closeAtMs = null } = {}) {
  let time = 0;
  const calls = [];
  const events = [];
  const socket = new FakeSocket();
  const result = {
    kind: 'accepted',
    staffLevel,
    socket,
    sendKeepalive: () => calls.push('keepalive'),
    sendWalk: (w) => calls.push(`walk:${w.startX},${w.startZ},${JSON.stringify(w.steps)}`),
    sendDesign: (d) => calls.push(`design:${JSON.stringify(d) === JSON.stringify(DEFAULT_DESIGN)}`),
    sendButton: (component) => {
      calls.push(`button:${component}`);
      if (closeOnButton && component === LOGOUT_BUTTON_COMPONENT)
        queueMicrotask(() => socket.destroy());
    },
  };
  let onPacket;
  const pending = [...script];
  const fire = () => {
    while (pending.length && pending[0].at <= time) onPacket(pending.shift().packet);
    if (closeAtMs !== null && time >= closeAtMs) socket.destroy();
  };
  return {
    calls,
    events,
    socket,
    log: new Proxy(
      {},
      {
        get:
          (_t, name) =>
          (...args) =>
            events.push([name, ...args]),
      },
    ),
    now: () => time,
    sleep: (ms, cancel) =>
      new Promise((resolve) => {
        const finish = () => {
          time += ms;
          fire();
          resolve();
        };
        if (ms >= 5000) {
          const timer = setImmediate(finish);
          cancel?.addEventListener('abort', () => {
            clearImmediate(timer);
            resolve();
          });
        } else finish();
      }),
    loginFn: async (args) => {
      onPacket = args.onPacket;
      return result;
    },
  };
}

test('the observer tallies who the server reports, keeps the session alive and logs out cleanly', async () => {
  const h = harness({
    script: [
      { at: 1000, packet: update({ before: 0, added: [10, 11, 12] }) },
      { at: 2000, packet: update({ before: 3, removed: 1, added: [11, 20] }) },
      { at: 3000, packet: { opcode: 171, name: 'IF_CLOSE', payload: Buffer.alloc(0) } },
    ],
  });
  const summary = await observeView({ account: 'x', durationMs: 5000, ...h });
  assert.equal(summary.outcome, 'deadline');
  assert.equal(summary.updates, 2);
  assert.equal(summary.packets, 3);
  assert.equal(summary.added, 5);
  assert.equal(summary.removed, 1);
  assert.equal(summary.viewSize, 4);
  assert.equal(summary.maxViewSize, 4);
  assert.deepEqual(
    summary.sightings.map((s) => s.pid).sort((a, b) => a - b),
    [10, 11, 12, 20],
  );
  assert.deepEqual(
    summary.sightings.find((s) => s.pid === 20),
    { pid: 20, dx: 2, dz: -2, atMs: 2000 },
  );
  assert.equal(h.calls.filter((c) => c === 'keepalive').length, 5);
  assert.deepEqual(h.calls.at(-1), `button:${LOGOUT_BUTTON_COMPONENT}`);
});

test('with design enabled the default design is accepted once, after a delay, before logout', async () => {
  const h = harness();
  const summary = await observeView({ account: 'x', durationMs: 6000, design: true, ...h });
  assert.equal(summary.designed, true);
  const actions = h.calls.filter((c) => c !== 'keepalive');
  assert.deepEqual(actions, [
    'design:true',
    `button:${DESIGN_ACCEPT_COMPONENT}`,
    `button:${LOGOUT_BUTTON_COMPONENT}`,
  ]);
  assert.ok(h.calls.indexOf('design:true') >= 2, 'not sent in the first second');
  assert.equal(h.events.filter((e) => e[0] === 'designSubmitted').length, 1);
  const plain = harness();
  const control = await observeView({ account: 'x', durationMs: 6000, ...plain });
  assert.equal(control.designed, false);
  assert.deepEqual(
    plain.calls.filter((c) => c.startsWith('design')),
    [],
  );
});

test('the observer counts updates about its own character and the packet types it received', async () => {
  const own = (kind) => {
    const w = new BitWriter();
    if (kind === 'extend') w.write(1, 1).write(2, 0);
    else w.write(1, 0);
    w.write(8, 0).write(11, 2047);
    return { opcode: 167, name: 'PLAYER_INFO', payload: w.toBuffer() };
  };
  const h = harness({
    script: [
      { at: 1000, packet: own('idle') },
      { at: 2000, packet: own('extend') },
      { at: 3000, packet: own('idle') },
      { at: 3000, packet: { opcode: 171, name: 'IF_CLOSE', payload: Buffer.alloc(0) } },
    ],
  });
  const summary = await observeView({ account: 'x', durationMs: 4000, ...h });
  assert.deepEqual(summary.local, { idle: 2, extend: 1 });
  assert.deepEqual(summary.names, { PLAYER_INFO: 3, IF_CLOSE: 1 });
});

test('with walking enabled one short walk from the start tile is requested after a delay', async () => {
  const h = harness();
  const summary = await observeView({ account: 'x', durationMs: 6000, walk: true, ...h });
  assert.equal(summary.walked, true);
  const walks = h.calls.filter((c) => c.startsWith('walk'));
  assert.deepEqual(walks, ['walk:3094,3106,[[0,2]]']);
  assert.ok(h.calls.indexOf(walks[0]) >= 2, 'not sent in the first second');
  assert.equal(h.events.filter((e) => e[0] === 'walkRequested').length, 1);
  const still = harness();
  assert.equal((await observeView({ account: 'x', durationMs: 6000, ...still })).walked, false);
});

test('the observer reports its own slot from the login packet', async () => {
  const h = harness({
    script: [
      {
        at: 1000,
        packet: { opcode: 133, name: 'UPDATE_PID', payload: Buffer.from([0x01, 0x2c, 1]) },
      },
    ],
  });
  const summary = await observeView({ account: 'x', durationMs: 2000, ...h });
  assert.equal(summary.ownSlot, 300);
  const none = await observeView({ account: 'x', durationMs: 2000, ...harness() });
  assert.equal(none.ownSlot, null);
});

test('a client that is never told about anyone reports an empty view', async () => {
  const h = harness({ script: [{ at: 1000, packet: update({ before: 0 }) }] });
  const summary = await observeView({ account: 'x', durationMs: 3000, ...h });
  assert.equal(summary.updates, 1);
  assert.equal(summary.maxViewSize, 0);
  assert.deepEqual(summary.sightings, []);
});

test('a server close ends the observation without any logout click', async () => {
  const h = harness({ closeAtMs: 2000 });
  const summary = await observeView({ account: 'x', durationMs: 30_000, ...h });
  assert.equal(summary.outcome, 'closed');
  assert.deepEqual(
    h.calls.filter((c) => c.startsWith('button')),
    [],
  );
});

test('a framing failure and an undecodable update are reported without crashing', async () => {
  const bad = { opcode: 167, name: 'PLAYER_INFO', payload: Buffer.alloc(0) };
  const h = harness({
    script: [
      { at: 1000, packet: bad },
      { at: 2000, packet: { broken: { reason: 'unknown-opcode', opcode: 3 } } },
    ],
  });
  const summary = await observeView({ account: 'x', durationMs: 3000, ...h });
  assert.equal(summary.malformed, 1);
  assert.equal(summary.updates, 0);
  assert.equal(summary.packets, 1);
  assert.deepEqual(summary.broken, { reason: 'unknown-opcode', opcode: 3 });
});

test('progress is logged every ten seconds and once more at the end, with counts only', async () => {
  const h = harness({ script: [{ at: 1000, packet: update({ before: 0, added: [5] }) }] });
  await observeView({ account: 'x', durationMs: 25_000, ...h });
  const reports = h.events.filter((e) => e[0] === 'viewObserved');
  assert.deepEqual(
    reports.map((e) => e[1]),
    [10000, 20000, 25000],
  );
  assert.deepEqual(reports[0].slice(2), [1, 1, 1, 0]);
  assert.equal(JSON.stringify(h.events).includes('"pid"'), false);
});

test('cancellation stops early and still logs the client out', async () => {
  const controller = new AbortController();
  const h = harness();
  const sleep = async (ms, cancel) => {
    controller.abort();
    return h.sleep(ms, cancel);
  };
  const summary = await observeView({
    account: 'x',
    durationMs: 30_000,
    ...h,
    sleep,
    signal: controller.signal,
  });
  assert.equal(summary.outcome, 'cancelled');
  assert.deepEqual(h.calls.at(-1), `button:${LOGOUT_BUTTON_COMPONENT}`);
});

test('rejected, failed and elevated-permission logins stop before observing', async () => {
  const base = harness();
  const rejected = await observeView({
    account: 'x',
    ...base,
    loginFn: async () => ({ kind: 'rejected', code: 16, socket: new FakeSocket() }),
  });
  assert.deepEqual([rejected.stage, rejected.outcome, rejected.code], ['login', 'rejected', 16]);
  const failed = await observeView({
    account: 'x',
    ...base,
    loginFn: async () => {
      throw new Error('sensitive fixture');
    },
  });
  assert.equal(failed.outcome, 'failed');
  assert.doesNotMatch(JSON.stringify(failed), /sensitive/);
  const elevated = harness({ staffLevel: 2 });
  const refused = await observeView({ account: 'x', ...elevated });
  assert.equal(refused.outcome, 'not-ordinary');
  assert.equal(elevated.socket.destroyed, true);
  assert.deepEqual(elevated.calls, []);
});
