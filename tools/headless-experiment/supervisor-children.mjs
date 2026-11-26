import { writeState, labelFor } from './supervisor.mjs';

const LOGIN_TIMEOUT_MS = 30_000;

/** Derives a stable, distinct 31-bit device id from a client label (FNV-1a). */
export function deviceIdFor(label) {
  let hash = 0x811c9dc5;
  for (const char of label) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0x7fffffff;
}

/**
 * Throwaway supervisor that runs every client in its own child process. It starts them a short gap
 * apart, each with its own device id, tracks their states in one file, watches each child's
 * heartbeat, and can kill one child or stall one on purpose to show that the others carry on.
 * Account names travel to a child only over its IPC channel and never appear in state or logs.
 */
export async function runChildSupervisor({
  accounts,
  forkWorker,
  log,
  sleep,
  now,
  signal,
  stateFile,
  host,
  crcFile,
  paceMs = 1_000,
  holdMs = 30_000,
  killNumber = null,
  stallNumber = null,
  injectAfterMs = 10_000,
  closeTimeoutMs = 15_000,
  watchdogMs = 5_000,
  watchdogCheckMs = 1_000,
}) {
  const started = now();
  const elapsed = () => Math.max(0, Math.floor(now() - started));
  const clients = accounts.map((account, index) => ({
    label: labelFor(index + 1),
    account,
    state: 'queued',
    slot: null,
    code: null,
    sinceMs: 0,
    child: null,
    exited: false,
    lastAliveMs: 0,
    waiters: [],
  }));
  const setState = (client, state) => {
    if (client.state === state) return;
    client.state = state;
    client.sinceMs = elapsed();
    log.clientState(client.label, state);
    writeState(stateFile, clients, client.sinceMs);
  };
  writeState(stateFile, clients, 0);

  const summary = {
    clients: [],
    admitted: 0,
    killed: null,
    stalled: null,
    survivorsBeforeLogout: 0,
  };

  /** Starts one child and returns once it has a final login outcome or has failed to start. */
  const start = (client) =>
    new Promise((resolve) => {
      const settle = () => {
        const waiters = client.waiters;
        client.waiters = [];
        for (const w of waiters) w();
      };
      const child = forkWorker();
      client.child = child;
      client.lastAliveMs = elapsed();
      setState(client, 'logging-in');
      child.on('message', (message) => {
        if (message?.type === 'alive') client.lastAliveMs = elapsed();
        else if (message?.type === 'slot') client.slot = message.slot;
        else if (message?.type === 'state') {
          if (message.code !== undefined) client.code = message.code;
          if (
            ['in-game', 'rejected', 'failed', 'dropped', 'logged-out'].includes(message.state) &&
            // After the supervisor has already called a child unresponsive or failed, keep that.
            !['unresponsive', 'failed'].includes(client.state)
          ) {
            if (message.state === 'in-game') summary.admitted++;
            setState(client, message.state);
            settle();
          }
        }
      });
      child.on('exit', () => {
        client.exited = true;
        if (['logging-in', 'in-game', 'logging-out', 'unresponsive'].includes(client.state))
          setState(client, 'failed');
        settle();
      });
      client.waiters.push(resolve);
      child.send({
        type: 'start',
        account: client.account,
        host,
        crcFile,
        deviceId: deviceIdFor(client.label),
      });
      const timer = setTimeout(() => {
        if (client.state === 'logging-in') {
          child.kill('SIGKILL');
          setState(client, 'failed');
          settle();
        }
      }, LOGIN_TIMEOUT_MS);
      timer.unref();
    });

  // A child that stops sending heartbeats is stuck (for example in a busy loop). Kill it so it
  // cannot linger, and leave every other client alone.
  const watchdog = setInterval(() => {
    for (const client of clients) {
      if (client.state !== 'in-game' || client.exited) continue;
      if (elapsed() - client.lastAliveMs > watchdogMs) {
        setState(client, 'unresponsive');
        client.child.kill('SIGKILL');
      }
    }
  }, watchdogCheckMs);

  try {
    for (let i = 0; i < clients.length && !signal?.aborted; i++) {
      if (i > 0) await sleep(paceMs);
      if (signal?.aborted) break;
      await start(clients[i]);
    }

    if (!signal?.aborted) {
      const injectAt =
        killNumber === null && stallNumber === null ? holdMs : Math.min(injectAfterMs, holdMs);
      await sleep(injectAt);
      if (!signal?.aborted) {
        const killed = killNumber === null ? null : clients[killNumber - 1];
        if (killed?.state === 'in-game') {
          summary.killed = { label: killed.label, atMs: elapsed() };
          killed.child.kill('SIGKILL');
        }
        const stalled = stallNumber === null ? null : clients[stallNumber - 1];
        if (stalled?.state === 'in-game') {
          summary.stalled = { label: stalled.label, atMs: elapsed() };
          stalled.child.send({ type: 'stall' });
        }
        await sleep(Math.max(0, holdMs - injectAt));
        // Give the watchdog time to act on a stalled child before counting survivors.
        if (stalled && stalled.state === 'in-game') await sleep(watchdogMs + 2 * watchdogCheckMs);
      }
    }
    summary.survivorsBeforeLogout = clients.filter((c) => c.state === 'in-game').length;
  } finally {
    clearInterval(watchdog);
    await Promise.all(
      clients
        .filter((c) => c.state === 'in-game' && !c.exited)
        .map(
          (client) =>
            new Promise((resolve) => {
              setState(client, 'logging-out');
              const timer = setTimeout(() => {
                client.child.kill('SIGKILL');
                setState(client, 'failed');
                resolve();
              }, closeTimeoutMs);
              client.child.once('exit', () => {
                clearTimeout(timer);
                resolve();
              });
              client.child.send({ type: 'logout' });
            }),
        ),
    );
    // Never leave a child behind, whatever happened above.
    for (const client of clients) if (client.child && !client.exited) client.child.kill('SIGKILL');
  }

  summary.clients = clients.map((c) => ({
    label: c.label,
    state: c.state,
    slot: c.slot,
    code: c.code,
  }));
  summary.elapsedMs = elapsed();
  return summary;
}
