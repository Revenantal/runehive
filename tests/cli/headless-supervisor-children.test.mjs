import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
  deviceIdFor,
  runChildSupervisor,
} from '../../tools/headless-experiment/supervisor-children.mjs';

let directory;
before(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'runehive-children-'));
});
after(() => rmSync(directory, { recursive: true, force: true }));

/** A fake worker process that follows the same message protocol as the real one. */
class FakeChild extends EventEmitter {
  constructor(behaviour) {
    super();
    this.behaviour = behaviour;
    this.alive = true;
    this.starts = [];
    this.heartbeat = null;
  }
  emitMessage(message) {
    if (this.alive) queueMicrotask(() => this.emit('message', message));
  }
  die(signal = null) {
    if (!this.alive) return;
    this.alive = false;
    clearInterval(this.heartbeat);
    queueMicrotask(() => this.emit('exit', signal === null ? 0 : null, signal));
  }
  send(message) {
    if (!this.alive) return;
    if (message.type === 'start') {
      this.starts.push(message);
      this.emitMessage({ type: 'state', state: 'logging-in' });
      if (this.behaviour.refuse) {
        this.emitMessage({ type: 'state', state: 'rejected', code: 16 });
        this.die();
        return;
      }
      this.emitMessage({ type: 'slot', slot: this.behaviour.slot });
      this.emitMessage({ type: 'state', state: 'in-game' });
      this.heartbeat = setInterval(() => this.emitMessage({ type: 'alive' }), 10);
    } else if (message.type === 'logout') {
      this.emitMessage({ type: 'state', state: 'logged-out' });
      setTimeout(() => this.die(), 5);
    } else if (message.type === 'stall') {
      clearInterval(this.heartbeat); // A stalled process sends nothing more.
    }
  }
  kill(signal) {
    this.die(signal);
  }
}

function harness({ refuse = new Set(), ...extra } = {}) {
  const children = [];
  const states = [];
  let slot = 2;
  const args = {
    forkWorker: () => {
      const child = new FakeChild({ refuse: refuse.has(children.length + 1), slot: slot++ });
      children.push(child);
      return child;
    },
    log: { clientState: (label, state) => states.push(`${label}:${state}`) },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => performance.now(),
    stateFile: path.join(directory, `${Math.random().toString(36).slice(2)}.json`),
    host: 'fixture-host',
    paceMs: 5,
    holdMs: 100,
    injectAfterMs: 30,
    watchdogMs: 60,
    watchdogCheckMs: 10,
    closeTimeoutMs: 500,
    ...extra,
  };
  return { args, children, states };
}

test('device ids are stable, distinct and fit the protocol field', () => {
  const ids = ['client-01', 'client-02', 'client-03', 'client-10'].map(deviceIdFor);
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], deviceIdFor('client-01'));
  for (const id of ids) assert.ok(Number.isInteger(id) && id >= 0 && id <= 0x7fffffff);
});

test('each client runs in its own child with its own device id, then logs out', async () => {
  const h = harness();
  const summary = await runChildSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.equal(summary.admitted, 3);
  assert.deepEqual(
    summary.clients.map((c) => [c.label, c.state, c.slot]),
    [
      ['client-01', 'logged-out', 2],
      ['client-02', 'logged-out', 3],
      ['client-03', 'logged-out', 4],
    ],
  );
  const sent = h.children.map((c) => c.starts[0]);
  assert.deepEqual(
    sent.map((m) => m.account),
    ['a1', 'a2', 'a3'],
  );
  assert.equal(new Set(sent.map((m) => m.deviceId)).size, 3);
  assert.ok(h.children.every((c) => !c.alive));
});

test('a killed child fails alone; the others stay in game and log out', async () => {
  const h = harness({ killNumber: 2 });
  const summary = await runChildSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.equal(summary.killed.label, 'client-02');
  assert.equal(summary.survivorsBeforeLogout, 2);
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['logged-out', 'failed', 'logged-out'],
  );
});

test('a stalled child is called unresponsive, killed, and does not disturb the others', async () => {
  const h = harness({ stallNumber: 2 });
  const summary = await runChildSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
  assert.equal(summary.stalled.label, 'client-02');
  assert.ok(h.states.includes('client-02:unresponsive'));
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['logged-out', 'failed', 'logged-out'],
  );
  assert.ok(h.children.every((c) => !c.alive));
});

test('a refused login is recorded and later clients still start', async () => {
  const h = harness({ refuse: new Set([2]) });
  const summary = await runChildSupervisor({ accounts: ['a1', 'a2', 'a3'], ...h.args });
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

test('a child that ignores the logout request is killed rather than left behind', async () => {
  const h = harness({ closeTimeoutMs: 40 });
  const original = h.args.forkWorker;
  h.args.forkWorker = () => {
    const child = original();
    const send = child.send.bind(child);
    child.send = (message) => {
      if (message.type !== 'logout') send(message);
    };
    return child;
  };
  const summary = await runChildSupervisor({ accounts: ['a1', 'a2'], ...h.args });
  assert.deepEqual(
    summary.clients.map((c) => c.state),
    ['failed', 'failed'],
  );
  assert.ok(h.children.every((c) => !c.alive));
});

test('the state file never contains account names', async () => {
  const h = harness();
  await runChildSupervisor({ accounts: ['secretname1', 'secretname2'], ...h.args });
  const text = readFileSync(h.args.stateFile, 'utf8');
  assert.equal(text.includes('secretname'), false);
  assert.equal(h.states.join(' ').includes('secretname'), false);
});
