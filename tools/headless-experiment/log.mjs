import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Creates an exclusive, private log with only predefined lifecycle records. */
export function createExperimentLog(root) {
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
      clientId: 'client-01',
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
    /** Releases the log file once. */
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  };
}
