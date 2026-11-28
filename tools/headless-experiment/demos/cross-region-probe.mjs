import { readFileSync } from 'node:fs';
import { buildCrossRegionGrid, findCrossRegionRoute } from '../cross-region.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { compressRoute } from '../navigation.mjs';
import { createInitialState } from '../initial-state.mjs';
import { login } from '../login.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: cross-region-probe.mjs <verified config> <verified south map> <verified north map>
// Requires the character at (3240,3261); sends one route to (3240,3281) and never a follow-up.
const [configDir, southDir, northDir] = process.argv.slice(2);
if (!configDir || !southDir || !northDir) throw new Error('USAGE: see header');
const read = (dir, name) => readFileSync(`${dir}/${name}`);
const regions = [southDir, northDir].map((dir, i) => ({
  x: 3200,
  z: 3200 + i * 64,
  terrain: decodeTerrain(read(dir, 'ground.bin')),
  placements: decodeLocations(read(dir, 'region.bin')),
}));
const idx = read(configDir, 'loc.idx'),
  dat = read(configDir, 'loc.dat');
const definitions = new Map(
  [...new Set(regions.flatMap((region) => region.placements.map((p) => p.id)))].map((id) => [
    id,
    decodeLocationDefinition(idx, dat, id),
  ]),
);
const start = { x: 3240, z: 3261 },
  target = { x: 3240, z: 3281 };
const route = findCrossRegionRoute(buildCrossRegionGrid(regions, definitions), start, target);
if (!route) throw new Error('NO_CALCULATED_ROUTE');
const corners = compressRoute(start, route);
if (
  !corners.length ||
  corners.length > 24 ||
  corners.some((p) => Math.abs(p.x - start.x) > 127 || Math.abs(p.z - start.z) > 127)
)
  throw new Error('ROUTE_OUTSIDE_PACKET_BOUNDS');
const state = createInitialState();
const trace = [],
  rebuilds = [];
let broken = false,
  observing = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487022,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (!observing) return;
      if (packet.name === 'REBUILD_NORMAL')
        rebuilds.push({ position: state.state.position && { ...state.state.position } });
      if (packet.name === 'PLAYER_INFO') {
        const position = state.state.position;
        if (!position) {
          broken = true;
          return;
        }
        const last = trace.at(-1);
        if (
          !last ||
          last.x !== position.x ||
          last.z !== position.z ||
          last.level !== position.level
        )
          trace.push({ ...position });
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
  const keepalive = setInterval(() => {
    if (!client.socket.destroyed) client.sendKeepalive();
  }, 1000);
  let outcome = 'unknown',
    reason = 'initial-position-unavailable';
  try {
    await sleep(6000);
    const here = state.state.position;
    if (!broken && here?.level === 0 && here.x === start.x && here.z === start.z) {
      observing = true;
      trace.push({ ...here });
      client.sendWalk({
        startX: start.x,
        startZ: start.z,
        steps: corners.map((p) => [p.x - start.x, p.z - start.z]),
      });
      reason = 'deadline-or-observation-loss';
      const deadline = performance.now() + (route.length * 0.6 + 12) * 1000;
      while (performance.now() < deadline && !broken && !client.socket.destroyed) {
        await sleep(150);
        const p = state.state.position;
        if (p?.level === 0 && p.x === target.x && p.z === target.z) {
          outcome = 'completed';
          reason = 'observed-arrival';
          break;
        }
      }
    } else if (!broken && here) reason = 'unexpected-start';
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
        start,
        target,
        plannedTiles: route.length,
        corners,
        outcome,
        reason,
        trace,
        rebuilds,
        broken,
      },
      null,
      2,
    ),
  );
  if (outcome !== 'completed') process.exitCode = 1;
}
