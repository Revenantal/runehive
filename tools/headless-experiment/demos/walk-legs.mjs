import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { readFileSync } from 'node:fs';
import { decodeLocations } from '../locations.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, compressRoute, findConservativeRoute } from '../navigation.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node walk-legs.mjs "x,z;x,z;..." [<config dir> <map dir> <region x> <region z>]
// With the optional arguments each target is reached by a route planned on that region's static map
// and compressed to corner points; without them each target must lie on a straight open line.
// Walks the character to each tile in turn with one straight single-waypoint walk, so every pair of
// consecutive points must lie on one row or column of open ground that the caller has checked.
const legs = (process.argv[2] ?? '').split(';').map((pair) => pair.split(',').map(Number));
if (!legs.length || legs.some((p) => p.length !== 2 || p.some((n) => !Number.isInteger(n))))
  throw new Error('USAGE: walk-legs.mjs "x,z;x,z"');
const [, configDir, mapDir, regionXText, regionZText] =
  process.argv.slice(2).length >= 5 ? [null, ...process.argv.slice(3)] : [];
let planning = null;
if (configDir && mapDir) {
  const locIdx = readFileSync(`${configDir}/loc.idx`),
    locDat = readFileSync(`${configDir}/loc.dat`);
  const placed = decodeLocations(readFileSync(`${mapDir}/region.bin`));
  const definitions = new Map(
    [...new Set(placed.map((loc) => loc.id))].map((id) => [
      id,
      decodeLocationDefinition(locIdx, locDat, id),
    ]),
  );
  planning = {
    regionX: Number(regionXText),
    regionZ: Number(regionZText),
    grid: buildConservativeGrid(
      decodeTerrain(readFileSync(`${mapDir}/ground.bin`)),
      placed,
      definitions,
    ),
  };
}
const state = createInitialState();
let broken = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487021,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
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
  const results = [];
  try {
    await sleep(5000);
    for (const [x, z] of legs) {
      const from = { ...state.state.position };
      const tiles = Math.abs(x - from.x) + Math.abs(z - from.z) + (planning ? 20 : 0);
      if (planning) {
        const start = { x: from.x - planning.regionX, z: from.z - planning.regionZ };
        const route = findConservativeRoute(planning.grid, start, {
          x: x - planning.regionX,
          z: z - planning.regionZ,
        });
        if (!route) {
          results.push({ target: { x, z }, outcome: 'unknown', reason: 'no-route', from });
          break;
        }
        const corners = compressRoute(start, route);
        if (corners.length > 24) {
          results.push({
            target: { x, z },
            outcome: 'unknown',
            reason: 'too-many-waypoints',
            from,
          });
          break;
        }
        client.sendWalk({
          startX: from.x,
          startZ: from.z,
          steps: corners.map((c) => [c.x - start.x, c.z - start.z]),
        });
      } else {
        if (x !== from.x && z !== from.z) {
          results.push({
            target: { x, z },
            outcome: 'unknown',
            reason: 'not-a-straight-leg',
            from,
          });
          break;
        }
        client.sendWalk({ startX: from.x, startZ: from.z, steps: [[x - from.x, z - from.z]] });
      }
      const deadline = performance.now() + (tiles * 0.6 + 10) * 1000;
      while (performance.now() < deadline && !broken) {
        await sleep(150);
        const here = state.state.position;
        if (here && here.x === x && here.z === z) break;
      }
      const final = { ...state.state.position };
      const arrived = final.x === x && final.z === z;
      results.push({ target: { x, z }, from, final, outcome: arrived ? 'completed' : 'unknown' });
      if (!arrived) break;
    }
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
  console.log(JSON.stringify({ results, broken }, null, 1));
}
