import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, findConservativeRoute } from '../navigation.mjs';

// The inputs for this one experiment are independently fetched and integrity-checked first.
const readAsset = (name) => readFileSync(`/tmp/abmove-${name}.bin`);
const locations = decodeLocations(readAsset('region'));
const index = readAsset('index');
const data = readAsset('data');
const definitions = new Map(
  [...new Set(locations.map((location) => location.id))].map((id) => [
    id,
    decodeLocationDefinition(index, data, id),
  ]),
);
const collision = buildConservativeGrid(decodeTerrain(readAsset('ground')), locations, definitions);
const start = { x: 3222, z: 3217, level: 0 };
const destination = { x: 3222, z: 3219, level: 0 };
const regionX = Math.floor(start.x / 64) * 64;
const regionZ = Math.floor(start.z / 64) * 64;
const localStart = { x: start.x - regionX, z: start.z - regionZ };
const localDestination = { x: destination.x - regionX, z: destination.z - regionZ };
const route = findConservativeRoute(collision, localStart, localDestination);
if (!route || route.length === 0 || route.length > 24) throw new Error('NO_BOUNDED_ROUTE');

const initial = createInitialState();
let failed = false;
let requested = false;
let changed = false;
let arrived = false;
const trace = [];
let zone = null;
const zonePackets = new Set([
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
      const before = initial.state.position ? { ...initial.state.position } : null;
      initial.apply(packet);
      const position = initial.state.position;
      if (packet.name === 'REBUILD_NORMAL') {
        if (requested) changed = true;
        zone = createZoneObserver({ ...initial.state.region, level: start.level });
      }
      if (zonePackets.has(packet.name)) {
        if (!zone) throw new Error('UNKNOWN_ZONE');
        const events = zone.apply(packet);
        if (requested && events.length > 0) changed = true;
      }
      if (
        requested &&
        position &&
        before &&
        (position.x !== before.x || position.z !== before.z || position.level !== before.level)
      ) {
        trace.push({ ...position });
        if (
          position.x === destination.x &&
          position.z === destination.z &&
          position.level === destination.level
        )
          arrived = true;
      }
    } catch {
      failed = true;
    }
  },
});
if (client.kind !== 'accepted' || client.staffLevel !== 0) {
  client.socket?.destroy();
  console.error('Ordinary-player login unavailable.');
  process.exitCode = 1;
} else {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    for (let i = 0; i < 5 && !failed && !client.socket.destroyed; i++) {
      await sleep(1000);
      client.sendKeepalive();
    }
    const position = initial.state.position;
    if (
      !position ||
      position.x !== start.x ||
      position.z !== start.z ||
      position.level !== start.level ||
      failed ||
      client.socket.destroyed
    )
      throw new Error('START_NOT_CONFIRMED');
    console.log(
      `Ready to move from (${start.x}, ${start.z}) to (${destination.x}, ${destination.z}) in 10 seconds.`,
    );
    for (let i = 0; i < 10 && !failed && !stopping && !client.socket.destroyed; i++) {
      await sleep(1000);
      client.sendKeepalive();
    }
    if (
      failed ||
      stopping ||
      client.socket.destroyed ||
      initial.state.position?.x !== start.x ||
      initial.state.position?.z !== start.z ||
      initial.state.position?.level !== start.level
    )
      throw new Error('START_NOT_CONFIRMED');
    requested = true;
    client.sendWalk({
      startX: start.x,
      startZ: start.z,
      steps: route.map((tile) => [tile.x - localStart.x, tile.z - localStart.z]),
    });
    for (
      let i = 0;
      i < 20 && !arrived && !failed && !changed && !stopping && !client.socket.destroyed;
      i++
    ) {
      await sleep(1000);
      client.sendKeepalive();
    }
    console.log(
      JSON.stringify({
        outcome: arrived && !failed && !changed ? 'completed' : 'unknown',
        trace,
        sceneChanged: changed,
      }),
    );
    if (!arrived || failed || changed) process.exitCode = 1;
  } catch (error) {
    console.error(`Movement not confirmed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (!client.socket.destroyed) {
      client.sendButton(LOGOUT_BUTTON_COMPONENT);
      await Promise.race([
        new Promise((resolve) => client.socket.once('close', resolve)),
        sleep(3000),
      ]);
      client.socket.destroy();
    }
  }
}
