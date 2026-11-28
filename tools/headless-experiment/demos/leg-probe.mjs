import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, compressRoute, findConservativeRoute } from '../navigation.mjs';
import { gameMessage } from '../messages.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node leg-probe.mjs <config dir> <home map dir> [distances, default 10,20,30,40,57 | staircase]
// staircase instead sends one walk of 24 one-tile waypoints through an open 13 by 13 area.
// Walks north along the open column x=3240 from z=3261 and back, one single-waypoint leg at a time.
const [configDir, mapDir, distancesText = '10,20,30,40,57', northMapDir] = process.argv.slice(2);
if (!configDir || !mapDir) throw new Error('USAGE: see header');
const staircase = distancesText === 'staircase';
const distances = staircase ? [] : distancesText.split(',').map(Number);
const COLUMN = 3240,
  START_Z = 3261;
const read = (dir, name) => readFileSync(`${dir}/${name}`);
const locIdx = read(configDir, 'loc.idx'),
  locDat = read(configDir, 'loc.dat');
const placed = decodeLocations(read(mapDir, 'region.bin'));
const definitions = new Map(
  [...new Set(placed.map((loc) => loc.id))].map((id) => [
    id,
    decodeLocationDefinition(locIdx, locDat, id),
  ]),
);
const grid = buildConservativeGrid(decodeTerrain(read(mapDir, 'ground.bin')), placed, definitions);
const state = createInitialState();
const events = [];
const started = performance.now();
let broken = false,
  unknownPositionSamples = 0,
  lastRegion = null;
/** Adds a timestamped event. */
const note = (event) => events.push({ ms: Math.round(performance.now() - started), ...event });
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487020,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (packet.name === 'REBUILD_NORMAL') {
        const r = state.state.region;
        note({
          type: 'rebuild',
          region: r ? { baseX: r.baseX, baseZ: r.baseZ } : null,
          position: state.state.position ? { ...state.state.position } : null,
        });
        lastRegion = r;
      }
      if (packet.name === 'PLAYER_INFO' && !state.state.position) unknownPositionSamples++;
      if (packet.name === 'MESSAGE_GAME')
        note({ type: 'message', text: gameMessage(packet.payload) });
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
  const keepalive = setInterval(() => {
    if (!client.socket.destroyed) client.sendKeepalive();
  }, 1000);
  const trials = [];
  /** Sends one plain walk with the given waypoint offsets and judges arrival from observed positions. */
  async function leg(label, steps, target) {
    const from = { ...state.state.position };
    const tiles = steps.reduce(
      (sum, [dx, dz], i) =>
        sum + Math.abs(dx - (steps[i - 1]?.[0] ?? 0)) + Math.abs(dz - (steps[i - 1]?.[1] ?? 0)),
      0,
    );
    const rebuilds = events.filter((e) => e.type === 'rebuild').length;
    const unknownBefore = unknownPositionSamples;
    note({ type: 'leg-start', label, from, target, waypoints: steps.length, tiles });
    client.sendWalk({ startX: from.x, startZ: from.z, steps });
    const deadline = performance.now() + (tiles * 0.6 + 12) * 1000;
    const startedAt = performance.now();
    let arrived = false,
      lastMove = performance.now(),
      last = { ...from };
    while (performance.now() < deadline && !broken) {
      await sleep(150);
      const here = state.state.position;
      if (here && (here.x !== last.x || here.z !== last.z)) {
        last = { ...here };
        lastMove = performance.now();
      }
      if (here && here.x === target.x && here.z === target.z) {
        arrived = true;
        break;
      }
      if (performance.now() - lastMove > 6000) break; // stopped moving short of the target
    }
    const final = state.state.position ? { ...state.state.position } : null;
    const moved = final && (final.x !== from.x || final.z !== from.z);
    const result = {
      label,
      from,
      target,
      tiles,
      waypoints: steps.length,
      outcome: arrived ? 'completed' : moved ? 'partial' : 'unknown',
      final,
      seconds: Math.round((performance.now() - startedAt) / 100) / 10,
      rebuildsDuringLeg: events.filter((e) => e.type === 'rebuild').length - rebuilds,
      unknownPositionSamplesDuringLeg: unknownPositionSamples - unknownBefore,
    };
    note({ type: 'leg-end', ...result });
    trials.push(result);
    return result;
  }
  try {
    await sleep(6000);
    const me = { ...state.state.position };
    const regionX = Math.floor(me.x / 64) * 64,
      regionZ = Math.floor(me.z / 64) * 64;
    const local = (p) => ({ x: p.x - regionX, z: p.z - regionZ });
    const start = { x: COLUMN, z: START_Z };
    // Getting to the start tile is itself a long compressed route.
    if (me.x === COLUMN && me.z > START_Z && me.z <= 3318) {
      // Already on the open column: one straight leg back to the start tile.
      await leg('return-to-start', [[0, START_Z - me.z]], start);
      await sleep(1500);
    } else if (me.x !== start.x || me.z !== start.z) {
      const route = findConservativeRoute(grid, local(me), local(start));
      if (!route) throw new Error('NO_ROUTE_TO_START');
      const corners = compressRoute(local(me), route);
      if (corners.length > 24) throw new Error('TOO_MANY_WAYPOINTS');
      const origin = local(me);
      await leg(
        'approach-start',
        corners.map((c) => [c.x - origin.x, c.z - origin.z]),
        start,
      );
      await sleep(1500);
    }
    if (
      !state.state.position ||
      state.state.position.x !== start.x ||
      state.state.position.z !== start.z
    )
      throw new Error('START_NOT_REACHED');
    if (staircase) {
      // Open fields lie north of the boundary: go up the verified column, then plan inside that region.
      if (!northMapDir) throw new Error('NORTH_MAP_REQUIRED');
      await leg('to-north-region', [[0, 20]], { x: COLUMN, z: START_Z + 20 });
      await sleep(1500);
      const nRegionX = 3200,
        nRegionZ = 3264;
      const nPlaced = decodeLocations(read(northMapDir, 'region.bin'));
      const nDefinitions = new Map(
        [...new Set(nPlaced.map((loc) => loc.id))].map((id) => [
          id,
          decodeLocationDefinition(locIdx, locDat, id),
        ]),
      );
      const nGrid = buildConservativeGrid(
        decodeTerrain(read(northMapDir, 'ground.bin')),
        nPlaced,
        nDefinitions,
      );
      const position = state.state.position;
      const here = { x: position.x - nRegionX, z: position.z - nRegionZ };
      // Only the staircase's own tiles and the steps between them must be open on the static map.
      const stairs = [[0, 0]];
      for (let i = 1; i <= 12; i++) stairs.push([i, i - 1], [i, i]);
      /** Checks every one-tile step of the staircase from a starting tile. */
      const stairsOpen = (x, z) =>
        stairs.every(([dx, dz], index) => {
          if (index === 0) return true;
          const a = { x: x + stairs[index - 1][0], z: z + stairs[index - 1][1] };
          const b = { x: x + dx, z: z + dz };
          return findConservativeRoute(nGrid, a, b)?.length === 1;
        });
      let best = null;
      for (let x = 2; x <= 48; x += 2)
        for (let z = 2; z <= 48; z += 2) {
          if (!stairsOpen(x, z)) continue;
          const route = findConservativeRoute(nGrid, here, { x, z });
          if (route && (!best || route.length < best.route.length)) best = { x, z, route };
        }
      if (!best) throw new Error('NO_OPEN_SQUARE');
      const corner = { x: nRegionX + best.x, z: nRegionZ + best.z };
      if (best.route.length) {
        const corners = compressRoute(here, best.route);
        await leg(
          'to-square',
          corners.map((c) => [c.x - here.x, c.z - here.z]),
          corner,
        );
        await sleep(1500);
      }
      const steps = [];
      for (let i = 1; i <= 12; i++) steps.push([i, i - 1], [i, i]);
      await leg('staircase-24', steps, { x: corner.x + 12, z: corner.z + 12 });
    }
    for (const d of distances) {
      const target = { x: COLUMN, z: START_Z + d };
      const up = await leg(`north-${d}`, [[0, d]], target);
      if (up.outcome === 'unknown' || broken) break;
      await sleep(1500);
      const here = state.state.position;
      const back = await leg(`south-${d}`, [[start.x - here.x, start.z - here.z]], start);
      await sleep(1500);
      if (back.outcome !== 'completed') break;
    }
  } catch (error) {
    note({ type: 'stopped', reason: error.message });
  } finally {
    clearInterval(keepalive);
    if (!client.socket.destroyed) {
      client.sendButton(LOGOUT_BUTTON_COMPONENT);
      await Promise.race([
        new Promise((resolve) => client.socket.once('close', resolve)),
        sleep(3000),
      ]);
      client.socket.destroy();
    }
  }
  console.log(
    JSON.stringify(
      {
        trials,
        broken,
        unknownPositionSamples,
        rebuilds: events.filter((e) => e.type === 'rebuild'),
        notes: events.filter((e) => e.type === 'stopped' || e.type === 'message'),
        lastRegion,
      },
      null,
      1,
    ),
  );
}
