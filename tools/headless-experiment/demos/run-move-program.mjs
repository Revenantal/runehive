import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, findConservativeRoute } from '../navigation.mjs';
import { createMoveAction } from '../move-action.mjs';
import { main as program } from './programs/move-to-point.mjs';

// These current-region files must be fetched and verified separately for this experiment.
const asset = (name) => readFileSync(`/tmp/abmove-${name}.bin`);
const locations = decodeLocations(asset('region'));
const index = asset('index'),
  data = asset('data');
const definitions = new Map(
  [...new Set(locations.map((location) => location.id))].map((id) => [
    id,
    decodeLocationDefinition(index, data, id),
  ]),
);
const grid = buildConservativeGrid(decodeTerrain(asset('ground')), locations, definitions);
const state = createInitialState();
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
let zone = null,
  broken = false,
  changed = false,
  monitoring = false,
  stopping = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487011,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (packet.name === 'REBUILD_NORMAL') {
        if (monitoring) changed = true;
        zone = createZoneObserver({ ...state.state.region, level: 0 });
      }
      if (zonePackets.has(packet.name)) {
        if (!zone) throw new Error('UNKNOWN_ZONE');
        if (zone.apply(packet).length && monitoring) changed = true;
      }
    } catch {
      broken = true;
    }
  },
});
if (client.kind !== 'accepted' || client.staffLevel !== 0) {
  client.socket?.destroy();
  console.error('Ordinary-player login unavailable.');
  process.exitCode = 1;
} else {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const keepalive = setInterval(() => {
    if (!client.socket.destroyed) client.sendKeepalive();
  }, 1000);
  try {
    for (
      let i = 0;
      i < 100 && !state.state.position && !broken && !stopping && !client.socket.destroyed;
      i++
    )
      await sleep(100);
    const start = state.state.position;
    if (
      !start ||
      start.x !== 3222 ||
      start.z !== 3219 ||
      start.level !== 0 ||
      broken ||
      stopping ||
      client.socket.destroyed
    )
      throw new Error('POSITION_NOT_AVAILABLE');
    console.log('Experimental session ready; executing the trusted movement example.');
    monitoring = true;
    const moveTo = createMoveAction({
      regionX: 3200,
      regionZ: 3200,
      level: 0,
      grid,
      findRoute: findConservativeRoute,
      position: () => state.state.position,
      sendWalk: (request) => client.sendWalk(request),
      invalidated: () => changed || broken,
      stopped: () => stopping || client.socket.destroyed,
      sleep,
      now: () => performance.now(),
    });
    const result = await program({ moveTo });
    console.log(JSON.stringify(result));
    if (result.outcome !== 'completed') process.exitCode = 1;
  } catch (error) {
    console.error(`Experiment stopped: ${error.message}`);
    process.exitCode = 1;
  } finally {
    clearInterval(keepalive);
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
