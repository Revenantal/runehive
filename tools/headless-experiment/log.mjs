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
  function record(event, signal) {
    const entry = {
      ts: new Date().toISOString(),
      level: 'info',
      msg: event,
      component: 'headless-experiment',
      runId,
      clientId: 'client-01',
      ...(signal ? { signal } : {}),
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
      record('experiment.stopped', signal);
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
