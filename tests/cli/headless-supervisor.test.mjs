import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { runSupervisor } from '../../tools/headless-experiment/supervisor.mjs';

class FakeSocket extends EventEmitter {
  destroyed = false;
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    queueMicrotask(() => this.emit('close'));
  }
}

let directory;
before(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'runehive-supervisor-'));
});
after(() => rmSync(directory, { recursive: true, force: true }));

/** Builds a login function whose clients take slots 2, 3, ... unless the account is refused. */
function fakeWorld({ refuse = new Set(), closeOnLogout = true } = {}) {
  const sockets = new Map();
  const logins = [];
  const buttons = [];
  let slot = 2;
  const loginFn = async ({ account, onPacket }) => {
    logins.push(account);
    if (refuse.has(account)) return { kind: 'rejected', code: 16, socket: new FakeSocket() };
    const socket = new FakeSocket();
    sockets.set(account, socket);
    onPacket({ name: 'UPDATE_PID', payload: Buffer.from([0, slot++, 1]) });
    return {
      kind: 'accepted',
      staffLevel: 0,
      socket,
      sendKeepalive() {},
      sendButton(component) {
        buttons.push(component);
        if (closeOnLogout) socket.destroy();
      },
    };
  };
  return { loginFn, sockets, logins, buttons };
}

function harness(world, extra = {}) {
  const states = [];
  const sleeps = [];
  let t = 0;
  return {
    states,
    sleeps,
    args: {
      loginFn: world.loginFn,
      log: { clientState: (label, state) => states.push(`${label}:${state}`) },
      sleep: (ms, cancel) => {
        // A cancellable sleep is the logout timeout: let it lose to a prompt close, as it would live.
        if (cancel)
          return new Promise((resolve) => {
            const timer = setTimeout(resolve, 200);
            cancel.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            });
          });
        sleeps.push(ms);
        t += ms;
        return Promise.resolve();
      },
      now: () => t,
      stateFile: path.join(directory, `${Math.random().toString(36).slice(2)}.json`),
      paceMs: 4000,
      holdMs: 30000,
      ...extra,
    },
  };
}

test('admits every client in order with a fixed gap, then logs them all out by button', async () => {
  const world = fakeWorld();
  const h = harness(world);
  const summary = await runSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.deepEqual(world.logins, ['a1', 'a2', 'a3']);
  assert.equal(summary.admitted, 3);
  assert.deepEqual(
    summary.clients.map((c) => [c.label, c.state, c.slot]),
    [
      ['client-01', 'logged-out', 2],
      ['client-02', 'logged-out', 3],
      ['client-03', 'logged-out', 4],
    ],
  );
  assert.deepEqual(world.buttons, [2458, 2458, 2458]);
  assert.deepEqual(h.sleeps.slice(0, 2), [4000, 4000]);
});

test('after a burst of logins it waits out the device limit before the next one', async () => {
  const world = fakeWorld();
  const h = harness(world, { burst: 2, quietMs: 16000 });
  await runSupervisor({ accounts: ['a1', 'a2', 'a3', 'a4', 'a5'], ...h.args });
  assert.deepEqual(h.sleeps.slice(0, 4), [4000, 16000, 4000, 16000]);
});

test('a deliberately dropped client is isolated; the others stay in game and log out cleanly', async () => {
  const world = fakeWorld();
  const h = harness(world, { failNumber: 2 });
  const summary = await runSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.equal(summary.injected.label, 'client-02');
  assert.equal(summary.survivorsBeforeLogout, 2);
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['logged-out', 'dropped', 'logged-out'],
  );
  assert.deepEqual(world.buttons, [2458, 2458]);
});

test('a refused login is recorded with its code and does not stop the others', async () => {
  const world = fakeWorld({ refuse: new Set(['a2']) });
  const h = harness(world);
  const summary = await runSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.equal(summary.admitted, 2);
  assert.deepEqual(
    summary.clients.map((c) => [c.state, c.code]),
    [
      ['logged-out', null],
      ['rejected', 16],
      ['logged-out', null],
    ],
  );
});

test('a client that ignores the logout request is destroyed and reported as failed', async () => {
  const world = fakeWorld({ closeOnLogout: false });
  const h = harness(world, { closeTimeoutMs: 5 });
  h.args.sleep = (ms, cancel) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, Math.min(ms, 5));
      cancel?.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  const summary = await runSupervisor({ accounts: ['a1', 'a2'], ...h.args, paceMs: 1, holdMs: 1 });
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['failed', 'failed'],
  );
});

test('an abort before the last login stops admitting and still cleans up', async () => {
  const world = fakeWorld();
  const controller = new AbortController();
  const h = harness(world, { signal: controller.signal });
  const originalSleep = h.args.sleep;
  h.args.sleep = async (ms) => {
    await originalSleep(ms);
    if (world.logins.length === 1) controller.abort();
  };
  const summary = await runSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.deepEqual(world.logins, ['a1']);
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['logged-out', 'queued', 'queued'],
  );
});

test('the state file lists labels and states but never account names', async () => {
  const world = fakeWorld();
  const h = harness(world);
  await runSupervisor({ accounts: ['secretname1', 'secretname2'], ...h.args });
  const text = readFileSync(h.args.stateFile, 'utf8');
  assert.equal(text.includes('secretname'), false);
  const state = JSON.parse(text);
  assert.deepEqual(
    state.clients.map((c) => [c.label, c.state]),
    [
      ['client-01', 'logged-out'],
      ['client-02', 'logged-out'],
    ],
  );
  assert.equal(h.states.join(' ').includes('secretname'), false);
});
