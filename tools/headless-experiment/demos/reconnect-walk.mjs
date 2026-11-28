import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Requires the observed ground-level start (3240,3261). One walk, one abrupt disconnect,
// then at most 12 reconnect attempts at ten-second intervals; never sends a follow-on walk.
const start = { x: 3240, z: 3261 },
  target = { x: 3240, z: 3281 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Creates fresh state and records which inventory components receive full updates. */
function tracker() {
  const state = createInitialState(),
    fullInventories = new Set();
  let broken = false;
  return {
    state: state.state,
    get broken() {
      return broken;
    },
    fullInventories,
    /** Applies observed packets without carrying old session state forward. */
    apply(packet) {
      if (packet.broken) {
        broken = true;
        return;
      }
      try {
        state.apply(packet);
        if (packet.name === 'UPDATE_INV_FULL' && packet.payload.length >= 3)
          fullInventories.add(packet.payload.readUInt16BE(0));
      } catch {
        broken = true;
      }
    },
  };
}
/** Summarizes only observed state and inventory component availability. */
function summary(t) {
  return {
    position: t.state.position ? { ...t.state.position } : null,
    region: t.state.region ? { ...t.state.region } : null,
    energy: t.state.energy,
    skillCount: Object.keys(t.state.skills).length,
    fullInventoryComponents: [...t.fullInventories].sort((a, b) => a - b),
    broken: t.broken,
  };
}
/** Opens the same ordinary-player account without printing identity or credentials. */
function connect(t) {
  return login({
    account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
    host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
    deviceId: 487024,
    onPacket: (packet) => t.apply(packet),
  });
}
const before = tracker(),
  first = await connect(before);
if (first.kind !== 'accepted' || first.staffLevel !== 0) {
  first.socket?.destroy();
  throw new Error('ORDINARY_LOGIN_UNAVAILABLE');
}
const keepalive = setInterval(() => {
  if (!first.socket.destroyed) first.sendKeepalive();
}, 1000);
let disconnectedAt = null,
  beforeSnapshot;
try {
  await sleep(6000);
  const p = before.state.position;
  if (before.broken || !p || p.level !== 0 || p.x !== start.x || p.z !== start.z)
    throw new Error('UNEXPECTED_START');
  beforeSnapshot = summary(before);
  first.sendWalk({ startX: start.x, startZ: start.z, steps: [[0, target.z - start.z]] });
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline && !before.broken && !first.socket.destroyed) {
    await sleep(50);
    const position = before.state.position;
    if (position && (position.x !== start.x || position.z !== start.z)) {
      disconnectedAt = { ...position };
      break;
    }
  }
} finally {
  clearInterval(keepalive);
  first.socket.destroy();
}
if (!disconnectedAt || before.broken) {
  console.log(
    JSON.stringify({
      outcome: 'unknown',
      reason: 'movement-not-confirmed-before-disconnect',
      before: beforeSnapshot,
      disconnectedAt,
    }),
  );
  process.exitCode = 1;
} else {
  const attempts = [],
    started = performance.now();
  let second = null,
    after = null;
  for (let n = 0; n < 12; n++) {
    await sleep(10000);
    const candidate = tracker();
    let result;
    try {
      result = await connect(candidate);
    } catch {
      attempts.push({
        seconds: Math.round((performance.now() - started) / 1000),
        result: 'transport-or-login-error',
      });
      break;
    }
    if (result.kind === 'accepted' && result.staffLevel === 0) {
      attempts.push({
        seconds: Math.round((performance.now() - started) / 1000),
        result: 'accepted',
      });
      second = result;
      after = candidate;
      break;
    }
    result.socket?.destroy();
    attempts.push({
      seconds: Math.round((performance.now() - started) / 1000),
      result: result.kind === 'rejected' ? 'rejected' : 'not-ordinary',
    });
  }
  if (!second) {
    console.log(
      JSON.stringify({
        outcome: 'unknown',
        reason: 'reconnect-not-confirmed',
        before: beforeSnapshot,
        disconnectedAt,
        attempts,
      }),
    );
    process.exitCode = 1;
  } else {
    const timer = setInterval(() => {
      if (!second.socket.destroyed) second.sendKeepalive();
    }, 1000);
    try {
      await sleep(8000);
      const reconstructed = summary(after),
        p = after.state.position;
      const arrived = !after.broken && p?.level === 0 && p.x === target.x && p.z === target.z;
      console.log(
        JSON.stringify(
          {
            outcome: arrived ? 'completed' : 'unknown',
            before: beforeSnapshot,
            disconnectedAt,
            attempts,
            reconstructed,
            target,
          },
          null,
          2,
        ),
      );
      if (!arrived) process.exitCode = 1;
    } finally {
      clearInterval(timer);
      if (!second.socket.destroyed) {
        second.sendButton(LOGOUT_BUTTON_COMPONENT);
        await Promise.race([
          new Promise((resolve) => second.socket.once('close', resolve)),
          sleep(3000),
        ]);
        second.socket.destroy();
      }
    }
  }
}
