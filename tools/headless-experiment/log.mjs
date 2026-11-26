import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Creates an exclusive, private log with only predefined lifecycle records for one client. */
export function createExperimentLog(root, { clientId = 'client-01' } = {}) {
  if (!/^client-\d{2,3}$/.test(clientId)) throw new Error('Invalid client id');
  const runId = randomUUID();
  const directory = path.join(root, '.runehive', 'headless-experiment');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const fd = openSync(path.join(directory, `${runId}.jsonl`), 'wx', 0o600);
  let closed = false;

  /** Writes a fixed event schema without accepting credentials or raw inputs. */
  function record(event, details = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level: 'info',
      msg: event,
      component: 'headless-experiment',
      runId,
      clientId,
      ...details,
    };
    writeFileSync(fd, `${JSON.stringify(entry)}\n`);
  }

  return {
    runId,
    /** Records a successfully initialized process. */
    started() {
      record('experiment.started');
    },
    /** Records an operator-requested shutdown. */
    stopped(signal) {
      if (signal !== 'SIGINT' && signal !== 'SIGTERM') throw new Error('Invalid stop signal');
      record('experiment.stopped', { signal });
    },
    /** Records the beginning of a login attempt without credentials. */
    loginRequested() {
      record('login.requested');
    },
    /** Records an accepted login and the client-visible permission level. */
    loginAccepted(staffLevel) {
      if (!Number.isInteger(staffLevel) || staffLevel < 0 || staffLevel > 255)
        throw new Error('Invalid staff level');
      record('login.accepted', { staffLevel });
    },
    /** Records a protocol rejection without any server-provided text. */
    loginRejected(code) {
      if (!Number.isInteger(code) || code < 0 || code > 255)
        throw new Error('Invalid response code');
      record('login.rejected', { code });
    },
    /** Records an unexpected end to the connection without raw error details. */
    loginFailed() {
      record('login.failed');
    },
    /** Records which bounded session variant was started. */
    sessionStarted(keepalive) {
      if (typeof keepalive !== 'boolean') throw new Error('Invalid session mode');
      record('session.started', { keepalive });
    },
    /** Records aggregated transport observations with no packet contents. */
    sessionObserved(elapsedMs, bytes, keepalives) {
      if (![elapsedMs, bytes, keepalives].every((n) => Number.isSafeInteger(n) && n >= 0))
        throw new Error('Invalid session counters');
      record('session.observed', { elapsedMs, bytes, keepalives });
    },
    /** Records how the bounded session experiment ended. */
    sessionFinished(reason, elapsedMs, bytes, keepalives) {
      if (
        !['deadline', 'closed', 'send-error', 'interrupted'].includes(reason) ||
        ![elapsedMs, bytes, keepalives].every((n) => Number.isSafeInteger(n) && n >= 0)
      )
        throw new Error('Invalid session outcome');
      record('session.finished', { reason, elapsedMs, bytes, keepalives });
    },
    /** Records aggregate counts of what the server said about nearby players; no identities. */
    viewObserved(elapsedMs, packets, viewSize, added, removed) {
      if (
        ![elapsedMs, packets, viewSize, added, removed].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        )
      )
        throw new Error('Invalid view observation');
      record('view.observed', { elapsedMs, packets, viewSize, added, removed });
    },
    /** Records that a short walk was requested; the outcome is observed separately. */
    walkRequested() {
      record('walk.requested');
    },
    /** Records that the default character design was submitted and accepted by click. */
    designSubmitted() {
      record('design.submitted');
    },
    /** Records that a logout (clean button click or abrupt disconnect) was requested. */
    logoutRequested(mode) {
      if (!['clean', 'abrupt'].includes(mode)) throw new Error('Invalid logout mode');
      record('logout.requested', { mode });
    },
    /** Records what the client observed after the logout request. */
    logoutObserved(reason, elapsedMs) {
      if (
        !['closed', 'no-close', 'closed-before-request', 'send-failed'].includes(reason) ||
        !Number.isSafeInteger(elapsedMs) ||
        elapsedMs < 0
      )
        throw new Error('Invalid logout observation');
      record('logout.observed', { reason, elapsedMs });
    },
    /** Records one login attempt made after logout, with the protocol-visible result only. */
    reloginAttempted(attempt, outcome, code, elapsedMs) {
      if (
        !Number.isSafeInteger(attempt) ||
        attempt < 1 ||
        !['accepted', 'rejected', 'failed'].includes(outcome) ||
        !(code === null || (Number.isInteger(code) && code >= 0 && code <= 255)) ||
        !Number.isSafeInteger(elapsedMs) ||
        elapsedMs < 0
      )
        throw new Error('Invalid relogin observation');
      record('relogin.attempted', { attempt, outcome, code, elapsedMs });
    },
    /** Records a supervised client's state change; labels only, never account names. */
    clientState(label, state) {
      if (
        !/^client-\d{2,3}$/.test(label) ||
        ![
          'queued',
          'logging-in',
          'in-game',
          'dropped',
          'logging-out',
          'logged-out',
          'rejected',
          'failed',
          'unresponsive',
        ].includes(state)
      )
        throw new Error('Invalid client state');
      record('client.state', { label, state });
    },
    /** Releases the log file once. */
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  };
}
