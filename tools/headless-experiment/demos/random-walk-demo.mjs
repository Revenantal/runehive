import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, findConservativeRoute } from '../navigation.mjs';

const file = (name) => readFileSync(`/tmp/rhdemo-${name}.bin`);
const placements = decodeLocations(file('region'));
const index = file('index'),
  data = file('data');
const definitions = new Map(
  [...new Set(placements.map((p) => p.id))].map((id) => [
    id,
    decodeLocationDefinition(index, data, id),
  ]),
);
const grid = buildConservativeGrid(decodeTerrain(file('ground')), placements, definitions);
const initial = createInitialState();
let broken = false,
  moving = false;
const dynamic = new Set([
  'LOC_ADD_CHANGE',
  'LOC_DEL',
  'P_LOCMERGE',
  'UPDATE_ZONE_PARTIAL_ENCLOSED',
  'UPDATE_ZONE_FULL_FOLLOWS',
  'REBUILD_NORMAL',
]);
const result = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487008,
  onPacket(packet) {
    if (packet.broken || (moving && dynamic.has(packet.name))) {
      broken = true;
      return;
    }
    try {
      initial.apply(packet);
    } catch {
      broken = true;
    }
  },
});
if (result.kind !== 'accepted' || result.staffLevel !== 0) {
  result.socket?.destroy();
  console.log('Demo login failed.');
  process.exit(1);
}
console.log('Random-walk demo connected.');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stop = false;
process.on('SIGINT', () => {
  stop = true;
});
process.on('SIGTERM', () => {
  stop = true;
});
const startTime = Date.now();
let lastPosition = '',
  pending = null,
  nextMove = startTime + 6000;
try {
  while (!stop && !broken && !result.socket.destroyed && Date.now() - startTime < 300000) {
    await sleep(1000);
    result.sendKeepalive();
    const p = initial.state.position;
    if (!p) continue;
    const pos = `${p.x},${p.z},${p.level}`;
    if (lastPosition !== pos) {
      console.log(`Position: ${p.x}, ${p.z}, level ${p.level}`);
      lastPosition = pos;
    }
    if (pending && p.x === pending.x && p.z === pending.z) {
      console.log('Destination reached.');
      pending = null;
      nextMove = Date.now() + 2000;
    }
    if (pending && Date.now() - pending.sent > 18000) {
      console.log('Arrival unconfirmed; stopping.');
      break;
    }
    if (!pending && Date.now() >= nextMove) {
      if (p.level !== 0 || Math.floor(p.x / 64) !== 48 || Math.floor(p.z / 64) !== 48) {
        console.log('Outside the mapped region; stopping.');
        break;
      }
      const source = { x: p.x % 64, z: p.z % 64 },
        candidates = [];
      for (let x = 14; x <= 30; x++)
        for (let z = 26; z <= 42; z++) {
          const route = findConservativeRoute(grid, source, { x, z });
          if (route && route.length >= 3 && route.length <= 12) candidates.push({ x, z, route });
        }
      if (!candidates.length) {
        console.log('No bounded candidate; stopping.');
        break;
      }
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      result.sendWalk({
        startX: p.x,
        startZ: p.z,
        steps: target.route.map((q) => [q.x - source.x, q.z - source.z]),
      });
      pending = { x: 3072 + target.x, z: 3072 + target.z, sent: Date.now() };
      moving = true;
      console.log(`Walking to ${pending.x}, ${pending.z} (${target.route.length} steps).`);
    }
  }
} finally {
  if (broken) console.log('Stream or scene changed; stopping.');
  if (!result.socket.destroyed) {
    result.sendButton(LOGOUT_BUTTON_COMPONENT);
    await Promise.race([
      new Promise((resolve) => result.socket.once('close', resolve)),
      sleep(3000),
    ]);
    result.socket.destroy();
  }
  console.log('Random-walk demo stopped.');
}
