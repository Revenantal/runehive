import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

const initial = createInitialState();
const names = new Set([
  'UPDATE_ZONE_PARTIAL_FOLLOWS',
  'UPDATE_ZONE_FULL_FOLLOWS',
  'UPDATE_ZONE_PARTIAL_ENCLOSED',
  'LOC_ADD_CHANGE',
  'LOC_DEL',
  'P_LOCMERGE',
  'LOC_ANIM',
  'OBJ_DEL',
  'OBJ_REVEAL',
  'OBJ_ADD',
  'OBJ_COUNT',
  'MAP_ANIM',
  'MAP_PROJANIM',
]);
let zone = null,
  lastLevel = null,
  failed = false,
  stopping = false;
let removedClosed = false,
  addedOpen = false,
  removedOpen = false,
  addedClosed = false;
let closedDoorObserved = false,
  openDoorObserved = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487011,
  onPacket(packet) {
    if (packet.broken) {
      failed = true;
      return;
    }
    try {
      initial.apply(packet);
      const position = initial.state.position;
      if (packet.name === 'REBUILD_NORMAL') {
        zone = createZoneObserver({ ...initial.state.region, level: 0 });
        lastLevel = 0;
      }
      if (position && initial.state.region && (zone === null || lastLevel !== position.level)) {
        zone = createZoneObserver({ ...initial.state.region, level: position.level });
        lastLevel = position.level;
      }
      if (!zone || !names.has(packet.name)) return;
      for (const event of zone.apply(packet)) {
        if (
          event.kind === 'zone-reset' &&
          event.level === 0 &&
          event.x <= 3226 &&
          event.x + 8 > 3227 &&
          event.z <= 3214 &&
          event.z + 8 > 3214
        ) {
          closedDoorObserved = true;
          openDoorObserved = false;
          removedClosed = false;
          addedOpen = false;
          removedOpen = false;
          addedClosed = false;
          continue;
        }
        if (event.level !== 0 || event.z !== 3214) continue;
        if (event.x === 3226 && event.shape === 0 && event.kind === 'remove') {
          removedClosed = true;
          addedClosed = false;
          closedDoorObserved = false;
        }
        if (
          event.x === 3227 &&
          event.shape === 0 &&
          event.kind === 'add-change' &&
          event.id === 1531
        ) {
          addedOpen = true;
          removedOpen = false;
        }
        if (event.x === 3227 && event.shape === 0 && event.kind === 'remove') {
          removedOpen = true;
          addedOpen = false;
          openDoorObserved = false;
        }
        if (
          event.x === 3226 &&
          event.shape === 0 &&
          event.kind === 'add-change' &&
          event.id === 1530
        ) {
          addedClosed = true;
          removedClosed = false;
        }
        if (removedClosed && addedOpen) openDoorObserved = true;
        if (removedOpen && addedClosed) closedDoorObserved = true;
      }
    } catch {
      failed = true;
    }
  },
});
if (client.kind !== 'accepted' || client.staffLevel !== 0) {
  client.socket?.destroy();
  console.log('Ordinary-player login unavailable.');
  process.exit(1);
}
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keepalive = setInterval(() => {
  if (!client.socket.destroyed) client.sendKeepalive();
}, 1000);
/** Waits for client-observed evidence or aborts on an unsafe condition. */
async function until(check, label, timeout = 14000) {
  const started = Date.now();
  while (!check()) {
    if (failed || stopping || client.socket.destroyed || Date.now() - started > timeout)
      throw new Error(`Stopped: ${label} not confirmed`);
    await delay(100);
  }
}
const at = (x, z, level) => {
  const p = initial.state.position;
  return p?.x === x && p?.z === z && p?.level === level;
};
/** Sends a bounded route only from the expected observed tile. */
async function walk(start, steps, target) {
  if (!at(...start)) throw new Error('Stopped: unexpected starting position');
  client.sendWalk({ startX: start[0], startZ: start[1], steps });
  await until(() => at(...target), 'arrival');
  await delay(700);
}
/** Requests one ladder action and verifies the resulting level. */
async function climb(option, level) {
  client.sendLocationOption({ x: 3229, z: 3213, id: option === 3 ? 1748 : 1747, option });
  await until(() => initial.state.position?.level === level, 'ladder level change');
  console.log(`Ladder: level ${level}.`);
  await delay(1300);
}
/** Requests the closed door's open option and requires resulting scene changes. */
async function openDoor() {
  removedClosed = false;
  addedOpen = false;
  openDoorObserved = false;
  client.sendLocationOption1({ x: 3226, z: 3214, id: 1530 });
  await until(() => openDoorObserved, 'door open');
  console.log('Door opened.');
}
/** Reopens an interrupted doorway if necessary, closes it, and confirms arrival outside. */
async function outsideAndClose() {
  await walk(
    [3228, 3213, 0],
    [
      [0, 1],
      [-1, 1],
    ],
    [3227, 3214, 0],
  );
  if (closedDoorObserved) await openDoor();
  try {
    await walk([3227, 3214, 0], [[-1, 0]], [3226, 3214, 0]);
  } catch (error) {
    if (failed || stopping || client.socket.destroyed || !at(3227, 3214, 0)) throw error;
    console.log('Arrival unconfirmed; probing the nearby door once.');
    await openDoor();
    await walk([3227, 3214, 0], [[-1, 0]], [3226, 3214, 0]);
  }
  removedOpen = false;
  addedClosed = false;
  closedDoorObserved = false;
  client.sendLocationOption1({ x: 3227, z: 3214, id: 1531 });
  await until(() => closedDoorObserved, 'door close');
  console.log('Door closed from the threshold.');
  await walk([3226, 3214, 0], [[0, 1]], [3226, 3215, 0]);
  await delay(1200);
}
let completed = 0;
try {
  await until(() => at(3226, 3215, 0) || at(3227, 3214, 0), 'known starting position', 12000);
  await delay(3000);
  if (at(3227, 3214, 0)) {
    if (!closedDoorObserved) throw new Error('Stopped: initial closed door not observed');
    console.log('Recovering from the interrupted loop.');
    await openDoor();
    await walk([3227, 3214, 0], [[-1, 0]], [3226, 3214, 0]);
    removedOpen = false;
    addedClosed = false;
    closedDoorObserved = false;
    client.sendLocationOption1({ x: 3227, z: 3214, id: 1531 });
    await until(() => closedDoorObserved, 'door close');
    await walk([3226, 3214, 0], [[0, 1]], [3226, 3215, 0]);
    console.log('Recovered outside with door closed.');
  }
  console.log('Ready for video. Starting in 30 seconds.');
  for (let n = 30; n > 0; n--) {
    if (stopping || failed) throw new Error('Stopped during countdown');
    await delay(1000);
  }
  console.log('Demonstration starting outside.');
  for (let i = 1; i <= 5; i++) {
    console.log(`Loop ${i} of 5.`);
    await openDoor();
    await delay(1000);
    await walk(
      [3226, 3215, 0],
      [
        [0, -1],
        [1, -1],
        [2, -1],
        [2, -2],
      ],
      [3228, 3213, 0],
    );
    await climb(1, 1);
    await climb(3, 0);
    await outsideAndClose();
    completed = i;
    console.log(`Loop ${i} complete.`);
    await delay(1800);
  }
  console.log('Five loops complete; character outside with the door observed closed.');
} catch (error) {
  console.log(error.message);
  process.exitCode = 1;
} finally {
  clearInterval(keepalive);
  console.log(
    JSON.stringify({ completed, position: initial.state.position, closedDoorObserved, failed }),
  );
  if (!client.socket.destroyed) {
    client.sendButton(LOGOUT_BUTTON_COMPONENT);
    await Promise.race([
      new Promise((resolve) => client.socket.once('close', resolve)),
      delay(3000),
    ]);
    client.socket.destroy();
  }
}
