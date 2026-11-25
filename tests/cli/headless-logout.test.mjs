import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createExperimentLog } from '../../tools/headless-experiment/log.mjs';
import {
  LOGOUT_BUTTON_COMPONENT,
  runLogoutExperiment,
} from '../../tools/headless-experiment/logout.mjs';

class FakeSocket extends EventEmitter {
  destroyed = false;
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    queueMicrotask(() => this.emit('close'));
  }
}

/** Builds an accepted login whose button click optionally makes the server close the socket. */
function acceptedLogin({ staffLevel = 0, closeOnButton = true } = {}) {
  const socket = new FakeSocket();
  const buttons = [];
  return {
    kind: 'accepted',
    staffLevel,
    socket,
    buttons,
    sendButton(component) {
      buttons.push(component);
      if (closeOnButton) queueMicrotask(() => socket.destroy());
    },
  };
}

/** Creates fakes: a log that records calls, a clock that advances with sleeps, and queued logins. */
function harness(logins) {
  let time = 0;
  const events = [];
  const queue = [...logins];
  const log = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args) =>
          events.push([name, ...args]),
    },
  );
  return {
    events,
    log,
    now: () => time,
    sleep: (ms, cancel) =>
      new Promise((resolve) => {
        let done = false;
        const timer = setImmediate(() => {
          if (done) return;
          done = true;
          time += ms;
          resolve();
        });
        cancel?.addEventListener(
          'abort',
          () => {
            if (done) return;
            done = true;
            clearImmediate(timer);
            resolve();
          },
          { once: true },
        );
      }),
    loginFn: async () => {
      const next = queue.shift();
      if (!next) throw new Error('unexpected extra login');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const rejected = (code) => ({ kind: 'rejected', code, socket: new FakeSocket() });

test('clean logout clicks the button, sees the server close, and the next login is accepted', async () => {
  const first = acceptedLogin();
  const second = acceptedLogin();
  const h = harness([first, second]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'clean', ...h });
  assert.deepEqual(first.buttons, [LOGOUT_BUTTON_COMPONENT]);
  assert.equal(summary.outcome, 'relogin-accepted');
  assert.equal(summary.close.reason, 'closed');
  assert.equal(summary.relogins.length, 1);
  assert.equal(summary.reloginAfterMs, 1_000);
  assert.equal(second.socket.destroyed, true);
  assert.deepEqual(
    h.events.map((event) => event[0]),
    ['loginAccepted', 'logoutRequested', 'logoutObserved', 'reloginAttempted'],
  );
});

test('abrupt disconnect never clicks the button and retries only while the account is still logged in', async () => {
  const first = acceptedLogin();
  const h = harness([first, rejected(5), rejected(5), acceptedLogin()]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'abrupt', ...h });
  assert.deepEqual(first.buttons, []);
  assert.equal(first.socket.destroyed, true);
  assert.deepEqual(
    summary.relogins.map((r) => [r.outcome, r.code]),
    [
      ['rejected', 5],
      ['rejected', 5],
      ['accepted', null],
    ],
  );
  assert.equal(summary.outcome, 'relogin-accepted');
  assert.equal(summary.reloginAfterMs, 1_000 + 16_000 + 16_000);
});

test('a rejection other than "already logged in" stops retrying', async () => {
  const h = harness([acceptedLogin(), rejected(16)]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'abrupt', ...h });
  assert.equal(summary.outcome, 'relogin-not-accepted');
  assert.equal(summary.relogins.length, 1);
});

test('retries are bounded when the account never frees up', async () => {
  const h = harness([acceptedLogin(), rejected(5), rejected(5), rejected(5)]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'clean', ...h });
  assert.equal(summary.outcome, 'relogin-not-accepted');
  assert.equal(summary.relogins.length, 3);
});

test('a button click that the server ignores is reported as no-close, not as success', async () => {
  const first = acceptedLogin({ closeOnButton: false });
  const h = harness([first, rejected(5), rejected(5), rejected(5)]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'clean', ...h });
  assert.equal(summary.close.reason, 'no-close');
  assert.equal(summary.close.elapsedMs, 15_000);
  assert.equal(first.socket.destroyed, true);
  assert.equal(summary.outcome, 'relogin-not-accepted');
});

test('a connection that closes during the dwell is reported before any request', async () => {
  const first = acceptedLogin();
  first.socket.destroy();
  const h = harness([first]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'clean', ...h });
  assert.equal(summary.outcome, 'closed-before-request');
  assert.deepEqual(first.buttons, []);
});

test('rejected, failed and elevated-permission logins stop the experiment', async () => {
  const rejectedRun = await runLogoutExperiment({
    account: 'x',
    mode: 'clean',
    ...harness([rejected(3)]),
  });
  assert.deepEqual(
    [rejectedRun.stage, rejectedRun.outcome, rejectedRun.code],
    ['login', 'rejected', 3],
  );
  const failedRun = await runLogoutExperiment({
    account: 'x',
    mode: 'clean',
    ...harness([new Error('sensitive fixture')]),
  });
  assert.equal(failedRun.outcome, 'failed');
  assert.doesNotMatch(JSON.stringify(failedRun), /sensitive/);
  const elevated = acceptedLogin({ staffLevel: 2 });
  const elevatedRun = await runLogoutExperiment({
    account: 'x',
    mode: 'clean',
    ...harness([elevated]),
  });
  assert.equal(elevatedRun.outcome, 'not-ordinary');
  assert.equal(elevated.socket.destroyed, true);
  assert.deepEqual(elevated.buttons, []);
});

test('a relogin with elevated permissions is not treated as success', async () => {
  const h = harness([acceptedLogin(), acceptedLogin({ staffLevel: 2 })]);
  const summary = await runLogoutExperiment({ account: 'x', mode: 'clean', ...h });
  assert.equal(summary.outcome, 'not-ordinary');
});

test('cancellation during the dwell closes the connection and sends nothing', async () => {
  const first = acceptedLogin();
  const controller = new AbortController();
  const h = harness([first]);
  const sleep = async (ms, cancel) => {
    controller.abort();
    return h.sleep(ms, cancel);
  };
  const summary = await runLogoutExperiment({
    account: 'x',
    mode: 'clean',
    ...h,
    sleep,
    signal: controller.signal,
  });
  assert.equal(summary.outcome, 'cancelled');
  assert.equal(first.socket.destroyed, true);
  assert.deepEqual(first.buttons, []);
});

test('the real log accepts only allowlisted logout fields and no account data', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'experiment-logout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const log = createExperimentLog(root);
  log.logoutRequested('clean');
  log.logoutObserved('closed', 120);
  log.reloginAttempted(1, 'rejected', 5, 1000);
  log.reloginAttempted(2, 'accepted', null, 17000);
  assert.throws(() => log.logoutRequested('sensitive-input'), /Invalid logout mode/);
  assert.throws(() => log.logoutObserved('sensitive-input', 1), /Invalid logout observation/);
  assert.throws(() => log.reloginAttempted(1, 'sensitive-input', null, 1), /Invalid relogin/);
  assert.throws(() => log.reloginAttempted(1, 'rejected', 999, 1), /Invalid relogin/);
  log.close();
  const dir = path.join(root, '.runehive', 'headless-experiment');
  const text = readFileSync(path.join(dir, readdirSync(dir)[0]), 'utf8');
  assert.doesNotMatch(text, /sensitive-input/);
  assert.deepEqual(
    text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).msg),
    ['logout.requested', 'logout.observed', 'relogin.attempted', 'relogin.attempted'],
  );
});
