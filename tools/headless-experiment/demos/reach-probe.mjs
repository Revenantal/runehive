import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { buildConservativeGrid, findConservativeRoute } from '../navigation.mjs';
import { createMoveAction } from '../move-action.mjs';
import { gameMessage } from '../messages.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node reach-probe.mjs <config dir> <map dir> <tree x> <tree z> [distances, default 2,4,6,9,12,9,4,2]
// A semicolon list such as "3225,3231;3225,3229" instead names the exact standing tiles to test.
const [configDir, mapDir, treeXText, treeZText, distancesText = '2,4,6,9,12,9,4,2'] =
  process.argv.slice(2);
if (!configDir || !mapDir || !treeXText || !treeZText) throw new Error('USAGE: see header');
const tree = { x: Number(treeXText), z: Number(treeZText) };
const exactTiles =
  distancesText.includes(';') ||
  (/^\d+,\d+$/.test(distancesText) && distancesText.split(',')[0].length === 4)
    ? distancesText.split(';').map((pair) => pair.split(',').map(Number))
    : null;
const distances = exactTiles ? exactTiles.map(() => 0) : distancesText.split(',').map(Number);
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
const timeline = [];
const started = performance.now();
let broken = false;
/** Adds a timestamped event. */
const note = (event) => timeline.push({ ms: Math.round(performance.now() - started), ...event });
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487018,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
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
  try {
    await sleep(5000);
    const start = state.state.position;
    const regionX = Math.floor(start.x / 64) * 64,
      regionZ = Math.floor(start.z / 64) * 64;
    // A tile can hold several placed objects; use the one that offers Chop down.
    let treeId,
      optionAt = -1;
    for (const loc of placed) {
      if (regionX + loc.x !== tree.x || regionZ + loc.z !== tree.z || loc.level !== start.level)
        continue;
      const definition = decodeLocationDefinition(locIdx, locDat, loc.id, { includeText: true });
      const at = definition.options.indexOf('Chop down');
      if (at !== -1) {
        treeId = loc.id;
        optionAt = at;
        break;
      }
    }
    if (treeId === undefined || optionAt === -1) throw new Error('NO_CHOPPABLE_OBJECT_AT_TILE');
    const moveTo = createMoveAction({
      regionX,
      regionZ,
      level: start.level,
      grid,
      findRoute: findConservativeRoute,
      position: () => state.state.position,
      sendWalk: (request) => client.sendWalk(request),
      invalidated: () => broken,
      stopped: () => client.socket.destroyed,
      sleep,
      now: () => performance.now(),
      timeoutMs: 40000,
    });
    /** Finds a reachable tile at exactly the given Chebyshev distance from the tree. */
    function standTile(distance) {
      const me = state.state.position;
      let best = null;
      for (let dx = -distance; dx <= distance; dx++)
        for (let dz = -distance; dz <= distance; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== distance) continue;
          const x = tree.x + dx,
            z = tree.z + dz;
          const lx = x - regionX,
            lz = z - regionZ;
          if (lx < 0 || lx > 63 || lz < 0 || lz > 63) continue;
          const route =
            lx === me.x - regionX && lz === me.z - regionZ
              ? []
              : findConservativeRoute(
                  grid,
                  { x: me.x - regionX, z: me.z - regionZ },
                  { x: lx, z: lz },
                );
          if (route && route.length <= 24 && (best === null || route.length < best.length))
            best = { x, z, length: route.length };
        }
      return best;
    }
    /** Returns an explicit standing tile with its route length, or null when no route is known. */
    function exactStand([x, z]) {
      const me = state.state.position;
      const route =
        x === me.x && z === me.z
          ? []
          : findConservativeRoute(
              grid,
              { x: me.x - regionX, z: me.z - regionZ },
              { x: x - regionX, z: z - regionZ },
            );
      return route && route.length <= 24 ? { x, z, length: route.length } : null;
    }
    for (const [index, distance] of distances.entries()) {
      const tile = exactTiles ? exactStand(exactTiles[index]) : standTile(distance);
      if (!tile) {
        trials.push({
          index,
          distance,
          outcome: 'unknown',
          reason: 'no-reachable-tile-at-distance',
        });
        continue;
      }
      const walk = await moveTo({ x: tile.x, z: tile.z, level: start.level });
      if (walk.outcome !== 'completed') {
        trials.push({ index, distance, outcome: 'unknown', reason: `walk-${walk.reason}` });
        break;
      }
      await sleep(2500);
      const me = { ...state.state.position };
      const mark = timeline.length;
      client.sendLocationOption({ x: tree.x, z: tree.z, id: treeId, option: optionAt + 1 });
      let verdict = 'no-response';
      const until = performance.now() + 4500;
      while (performance.now() < until && verdict === 'no-response' && !broken) {
        await sleep(100);
        const messages = timeline
          .slice(mark)
          .filter((e) => e.type === 'message')
          .map((e) => e.text);
        if (messages.includes("I can't reach that!")) verdict = 'refused';
        else if (messages.some((t) => t.startsWith('You swing'))) verdict = 'accepted';
        else if (state.state.position.x !== me.x || state.state.position.z !== me.z)
          verdict = 'accepted-moving';
      }
      trials.push({
        index,
        distance: Math.max(Math.abs(me.x - tree.x), Math.abs(me.z - tree.z)),
        offset: { dx: me.x - tree.x, dz: me.z - tree.z },
        from: me,
        routeLengthToStand: tile.length,
        verdict,
        messages: timeline
          .slice(mark)
          .filter((e) => e.type === 'message')
          .map((e) => e.text),
      });
      if (verdict.startsWith('accepted')) {
        // Cancel by walking one tile away before the tree is felled.
        const here = state.state.position;
        const step = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].find(([dx, dz]) => {
          const lx = here.x + dx - regionX,
            lz = here.z + dz - regionZ;
          return (
            lx >= 0 &&
            lx <= 63 &&
            lz >= 0 &&
            lz <= 63 &&
            findConservativeRoute(
              grid,
              { x: here.x - regionX, z: here.z - regionZ },
              { x: lx, z: lz },
            )?.length === 1
          );
        });
        if (step) client.sendWalk({ startX: here.x, startZ: here.z, steps: [step] });
        await sleep(3500);
        trials.at(-1).cancelledByWalking = Boolean(step);
        trials.at(-1).positionAfterCancel = { ...state.state.position };
        trials.at(-1).laterMessages = timeline
          .slice(mark)
          .filter((e) => e.type === 'message')
          .map((e) => e.text);
      }
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
  console.log(JSON.stringify({ tree, trials, broken }, null, 1));
}
