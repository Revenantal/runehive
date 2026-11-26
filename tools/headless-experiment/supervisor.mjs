import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOGOUT_BUTTON_COMPONENT } from './logout.mjs';

export const CLIENT_STATES = [
  'queued',
  'logging-in',
  'in-game',
  'dropped',
  'logging-out',
  'logged-out',
  'rejected',
  'failed',
  'unresponsive',
];

const KEEPALIVE_MS = 1_000;

/** Returns the log label for the one-based client number. */
export function labelFor(number) {
  return `client-${String(number).padStart(2, '0')}`;
}

/** Writes the state file atomically so a reader never sees half a file. */
export function writeState(stateFile, clients, elapsedMs) {
  mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const body = {
    elapsedMs,
    clients: clients.map((c) => ({
      label: c.label,
      state: c.state,
      slot: c.slot,
      code: c.code,
      sinceMs: c.sinceMs,
    })),
  };
  const temporary = `${stateFile}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(body)}\n`, { mode: 0o600 });
  renameSync(temporary, stateFile);
}

/**
 * Throwaway supervisor: one process that logs in several clients one after another with a fixed gap
 * and one shared device id, keeps each alive, tracks every client's state in one file, isolates
 * one deliberately dropped client from the rest, then logs the others out through the logout button.
 * Account names never appear in the state file, the log or the returned summary.
 */
export async function runSupervisor({
  accounts,
  loginFn,
  log,
  sleep,
  now,
  signal,
  stateFile,
  paceMs = 4_000,
  burst = 4,
  quietMs = 16_000,
  holdMs = 30_000,
  failNumber = null,
  failAfterMs = 10_000,
  closeTimeoutMs = 10_000,
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
    socket: null,
    session: null,
    heartbeat: null,
    closed: null,
  }));
  const setState = (client, state) => {
    client.state = state;
    client.sinceMs = elapsed();
    log.clientState(client.label, state);
    writeState(stateFile, clients, client.sinceMs);
  };
  writeState(stateFile, clients, 0);

  const summary = { clients: [], admitted: 0, injected: null, survivorsBeforeLogout: 0 };

  /** Logs one client in and starts its keepalive, or records why it could not be admitted. */
  const admit = async (client) => {
    setState(client, 'logging-in');
    let result;
    try {
      result = await loginFn({
        account: client.account,
        onPacket: (packet) => {
          if (packet.name === 'UPDATE_PID' && packet.payload.length >= 2)
            client.slot = packet.payload.readUInt16BE(0);
        },
      });
    } catch {
      setState(client, 'failed');
      return;
    }
    if (result.kind === 'rejected') {
      client.code = result.code;
      result.socket?.destroy();
      setState(client, 'rejected');
      return;
    }
    if (result.staffLevel !== 0) {
      result.socket.destroy();
      setState(client, 'failed');
      return;
    }
    client.socket = result.socket;
    client.session = result;
    client.closed = new Promise((resolve) => {
      if (result.socket.destroyed) resolve();
      else result.socket.once('close', resolve);
    });
    client.closed.then(() => {
      if (client.state === 'in-game') {
        clearInterval(client.heartbeat);
        setState(client, 'dropped');
      }
    });
    client.heartbeat = setInterval(() => {
      try {
        client.session.sendKeepalive();
      } catch {
        clearInterval(client.heartbeat);
      }
    }, KEEPALIVE_MS);
    summary.admitted++;
    setState(client, 'in-game');
  };

  try {
    // The server counts every login attempt for one device id and address, refused ones included,
    // and clears the count only after 15 s with no attempts. So after `burst` attempts stay quiet.
    let sinceQuiet = 0;
    for (let i = 0; i < clients.length && !signal?.aborted; i++) {
      if (i > 0) {
        if (sinceQuiet >= burst) {
          await sleep(quietMs);
          sinceQuiet = 0;
        } else await sleep(paceMs);
      }
      if (signal?.aborted) break;
      sinceQuiet++;
      await admit(clients[i]);
    }

    if (!signal?.aborted) {
      const failAt = failNumber === null ? holdMs : Math.min(failAfterMs, holdMs);
      await sleep(failAt);
      if (failNumber !== null && !signal?.aborted) {
        const target = clients[failNumber - 1];
        if (target?.state === 'in-game') {
          summary.injected = { label: target.label, atMs: elapsed() };
          target.socket.destroy();
          await target.closed;
        }
        await sleep(holdMs - failAt);
      }
    }
    summary.survivorsBeforeLogout = clients.filter((c) => c.state === 'in-game').length;
  } finally {
    await Promise.all(
      clients
        .filter((c) => c.state === 'in-game')
        .map(async (client) => {
          clearInterval(client.heartbeat);
          setState(client, 'logging-out');
          try {
            client.session.sendButton(LOGOUT_BUTTON_COMPONENT);
          } catch {
            client.socket.destroy();
            setState(client, 'failed');
            return;
          }
          const cancel = new AbortController();
          const closed = await Promise.race([
            client.closed.then(() => true),
            sleep(closeTimeoutMs, cancel.signal).then(() => false),
          ]);
          cancel.abort();
          if (closed) setState(client, 'logged-out');
          else {
            client.socket.destroy();
            setState(client, 'failed');
          }
        }),
    );
    for (const client of clients) clearInterval(client.heartbeat);
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
