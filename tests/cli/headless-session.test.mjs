import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { Isaac } from '../../tools/headless-experiment/isaac.mjs';
import { observeSession } from '../../tools/headless-experiment/session.mjs';

class FakeScheduler {
  time = 0;
  next = 1;
  jobs = new Map();
  setInterval(fn, ms) {
    return this.add(fn, ms, true);
  }
  setTimeout(fn, ms) {
    return this.add(fn, ms, false);
  }
  clearTimeout(id) {
    this.jobs.delete(id);
  }
  clearInterval(id) {
    this.jobs.delete(id);
  }
  add(fn, ms, repeat) {
    const id = this.next++;
    this.jobs.set(id, { fn, at: this.time + ms, ms, repeat });
    return id;
  }
  advance(ms) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, job] = next;
      this.time = job.at;
      if (job.repeat) job.at += job.ms;
      else this.jobs.delete(id);
      job.fn();
    }
    this.time = end;
  }
}

test('ISAAC matches the pinned client sample', () => {
  const cipher = new Isaac([1, 2, 3, 4]);
  assert.deepEqual(
    Array.from({ length: 6 }, () => cipher.nextInt),
    [-621246914, 1957022519, -1345000077, -2021884860, -1882702437, 1616913581],
  );
});

test('bounded keepalive session reports counts and stops timers', () => {
  const socket = new EventEmitter();
  const scheduler = new FakeScheduler();
  const counts = { bytes: 23 };
  const observations = [];
  let result;
  observeSession({
    socket,
    counts,
    keepalive: true,
    sendKeepalive: () => {},
    scheduler,
    now: () => scheduler.time,
    report: (entry) => observations.push(entry),
    finish: (reason, entry) => {
      result = { reason, ...entry };
    },
  });
  scheduler.advance(75_000);
  assert.equal(result.reason, 'deadline');
  assert.equal(result.elapsedMs, 75_000);
  assert.equal(result.bytes, 23);
  assert.equal(result.keepalives, 74);
  assert.equal(observations.length, 5);
  assert.equal(scheduler.jobs.size, 0);
});

test('keepalive errors terminate once and release timers', () => {
  const socket = new EventEmitter();
  const scheduler = new FakeScheduler();
  const endings = [];
  const session = observeSession({
    socket,
    counts: { bytes: 0 },
    keepalive: true,
    sendKeepalive: () => {
      throw new Error('write failed');
    },
    scheduler,
    now: () => scheduler.time,
    report: () => {},
    finish: (reason) => endings.push(reason),
  });
  scheduler.advance(1000);
  session.stop();
  socket.emit('close');
  assert.deepEqual(endings, ['send-error']);
  assert.equal(scheduler.jobs.size, 0);
});

test('server closure and operator interruption are distinct and stop timers', () => {
  for (const reason of ['closed', 'interrupted']) {
    const socket = new EventEmitter();
    const scheduler = new FakeScheduler();
    let result;
    const session = observeSession({
      socket,
      counts: { bytes: 0 },
      keepalive: false,
      sendKeepalive: () => {
        throw new Error('unexpected');
      },
      scheduler,
      now: () => scheduler.time,
      report: () => {},
      finish: (value) => {
        result = value;
      },
    });
    scheduler.advance(500);
    if (reason === 'closed') socket.emit('close');
    else session.stop();
    assert.equal(result, reason);
    assert.equal(scheduler.jobs.size, 0);
  }
});
