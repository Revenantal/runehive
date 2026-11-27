import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

const observer = createInitialState();
let broken = false;
const result = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487008,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      observer.apply(packet);
    } catch {
      broken = true;
    }
  },
});
if (result.kind !== 'accepted' || result.staffLevel !== 0) {
  result.socket?.destroy();
  console.log('Demo login not accepted as an ordinary player.');
  process.exit(1);
}
console.log('Demo connected; waiting for the initial position.');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
const started = Date.now();
let previous = '';
let pending = null;
let nextMove = started + 8000;
const a = { x: 3094, z: 3106 },
  b = { x: 3096, z: 3108 };
try {
  while (!stopping && !broken && !result.socket.destroyed && Date.now() - started < 240000) {
    await sleep(1000);
    result.sendKeepalive();
    const p = observer.state.position;
    if (!p) continue;
    const key = `${p.x},${p.z},${p.level}`;
    if (key !== previous) {
      console.log(`Position: ${p.x}, ${p.z}, level ${p.level}`);
      previous = key;
    }
    if (pending && p.x === pending.x && p.z === pending.z) {
      pending = null;
      nextMove = Date.now() + 2500;
    }
    if (pending && Date.now() - pending.sent > 12000) {
      console.log('Movement not confirmed; stopping rather than guessing.');
      break;
    }
    if (!pending && Date.now() >= nextMove) {
      const atA = p.level === 0 && p.x === a.x && p.z === a.z;
      const atB = p.level === 0 && p.x === b.x && p.z === b.z;
      if (!atA && !atB) {
        console.log('Unexpected position; stopping rather than guessing.');
        break;
      }
      const steps = atA
        ? [
            [1, 0],
            [2, 0],
            [2, 1],
            [2, 2],
          ]
        : [
            [0, -1],
            [0, -2],
            [-1, -2],
            [-2, -2],
          ];
      result.sendWalk({ startX: p.x, startZ: p.z, steps });
      pending = { ...(atA ? b : a), sent: Date.now() };
      console.log('Walking to the other end of the loop.');
    }
  }
} finally {
  if (!result.socket.destroyed) {
    result.sendButton(LOGOUT_BUTTON_COMPONENT);
    await Promise.race([
      new Promise((resolve) => result.socket.once('close', resolve)),
      sleep(3000),
    ]);
    result.socket.destroy();
  }
  console.log('Demo stopped.');
}
