// Throwaway worker: one headless client in its own process, driven by a parent over the IPC channel.
// The parent sends the account in a message (never on the command line or in the environment).
import { readFileSync } from 'node:fs';
import { login } from './login.mjs';
import { LOGOUT_BUTTON_COMPONENT } from './logout.mjs';

const KEEPALIVE_MS = 1_000;
const ALIVE_MS = 1_000;
const PARENT_GONE_LOGOUT_MS = 5_000;

let session = null;
let state = 'starting';
let keepalive = null;

/** Sends one message to the parent, ignoring a closed channel. */
function report(message) {
  try {
    process.send?.(message);
  } catch {
    /* The parent is gone; the disconnect handler cleans up. */
  }
}

/** Records the new state locally and tells the parent. */
function setState(next, extra = {}) {
  state = next;
  report({ type: 'state', state: next, ...extra });
}

/** Clicks the logout button and exits once the server closes the connection, or after a timeout. */
function logoutAndExit(finalState, timeoutMs) {
  clearInterval(keepalive);
  if (!session || session.socket.destroyed) {
    setState(finalState);
    setTimeout(() => process.exit(0), 100);
    return;
  }
  const done = () => {
    setState(finalState);
    setTimeout(() => process.exit(0), 100);
  };
  session.socket.once('close', done);
  setTimeout(() => {
    session.socket.destroy();
    done();
  }, timeoutMs).unref();
  try {
    session.sendButton(LOGOUT_BUTTON_COMPONENT);
  } catch {
    session.socket.destroy();
  }
}

// If the parent dies or closes the channel, leave the game politely instead of lingering.
process.on('disconnect', () => {
  if (state === 'in-game') logoutAndExit('logged-out', PARENT_GONE_LOGOUT_MS);
  else process.exit(0);
});

process.on('message', async (message) => {
  if (message?.type === 'start' && state === 'starting') {
    setInterval(() => report({ type: 'alive' }), ALIVE_MS);
    setState('logging-in');
    try {
      const result = await login({
        account: message.account,
        host: message.host,
        deviceId: message.deviceId,
        crcs: message.crcFile ? readFileSync(message.crcFile) : null,
        onPacket: (packet) => {
          if (packet.name === 'UPDATE_PID' && packet.payload.length >= 2) {
            report({ type: 'slot', slot: packet.payload.readUInt16BE(0) });
          }
        },
      });
      if (result.kind === 'rejected') {
        result.socket?.destroy();
        setState('rejected', { code: result.code });
        process.exit(0);
      }
      if (result.staffLevel !== 0) {
        result.socket.destroy();
        setState('failed');
        process.exit(0);
      }
      session = result;
      keepalive = setInterval(() => {
        try {
          session.sendKeepalive();
        } catch {
          clearInterval(keepalive);
        }
      }, KEEPALIVE_MS);
      session.socket.once('close', () => {
        if (state === 'in-game') {
          clearInterval(keepalive);
          setState('dropped');
          setTimeout(() => process.exit(0), 100);
        }
      });
      setState('in-game');
    } catch {
      setState('failed');
      process.exit(0);
    }
  } else if (message?.type === 'logout' && state === 'in-game') {
    state = 'logging-out';
    logoutAndExit('logged-out', 10_000);
  } else if (message?.type === 'stall') {
    // Test hook: block the event loop so keepalives and heartbeats stop, as a runaway script would.
    setImmediate(() => {
      for (;;);
    });
  }
});
