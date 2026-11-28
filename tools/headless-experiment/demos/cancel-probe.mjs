import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createInventoryObserver } from '../inventory-observer.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { buildConservativeGrid, compressRoute, findConservativeRoute } from '../navigation.mjs';
import { gameMessage } from '../messages.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node cancel-probe.mjs <config dir> <map dir> <activity|approach>
//   activity: cancel with a plain walk right after "You swing your axe".
//   approach: cancel three seconds after a route and request toward a tree at least 12 tiles away.
const [configDir, mapDir, mode] = process.argv.slice(2);
if (!configDir || !mapDir || !['activity', 'approach'].includes(mode))
  throw new Error('USAGE: cancel-probe.mjs <config dir> <map dir> <activity|approach>');
const read = (dir, name) => readFileSync(`${dir}/${name}`);
const components = decodeInterfaces(read(configDir, 'interface.dat'));
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
const inventories = createInventoryObserver({
  capacity: (id) => {
    const c = components.get(id);
    return c?.type === 2 ? c.width * c.height : null;
  },
});
const timeline = [];
const started = performance.now();
let zone = null,
  broken = false,
  recording = false;
/** Adds a timestamped event. */
const note = (event) => timeline.push({ ms: Math.round(performance.now() - started), ...event });
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487019,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (packet.name === 'REBUILD_NORMAL')
        zone = createZoneObserver({ ...state.state.region, level: 0 });
      if (zone)
        for (const event of zone.apply(packet))
          if (recording && event.kind !== 'zone-reset') note({ type: 'zone', ...event });
      const inv = inventories.apply(packet);
      if (inv && recording) note({ ...inv, type: 'inventory', change: inv.type });
      if (packet.name === 'MESSAGE_GAME' && recording)
        note({ type: 'message', text: gameMessage(packet.payload) });
      const here = state.state.position;
      if (recording && here) note({ type: 'position', x: here.x, z: here.z });
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
  const report = { mode, outcome: 'unknown', reason: 'not-started' };
  try {
    await sleep(6000);
    const me = { ...state.state.position };
    const regionX = Math.floor(me.x / 64) * 64,
      regionZ = Math.floor(me.z / 64) * 64;
    const local = (p) => ({ x: p.x - regionX, z: p.z - regionZ });
    // Rank choppable trees by static route length to a free neighbouring tile.
    const ranked = [];
    for (const loc of placed) {
      if (loc.level !== me.level) continue;
      const definition = definitions.get(loc.id);
      let withText;
      try {
        withText = decodeLocationDefinition(locIdx, locDat, loc.id, { includeText: true });
      } catch {
        continue;
      }
      const at = withText.options.indexOf('Chop down');
      if (withText.name !== 'Tree' || at === -1 || !definition) continue;
      const x = regionX + loc.x,
        z = regionZ + loc.z;
      let best = null;
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const gx = x - regionX + dx,
          gz = z - regionZ + dz;
        if (gx < 0 || gx > 63 || gz < 0 || gz > 63) continue;
        const route = findConservativeRoute(grid, local(me), { x: gx, z: gz });
        if (route && (!best || route.length < best.route.length))
          best = { route, stand: { x: gx + regionX, z: gz + regionZ } };
      }
      if (best) ranked.push({ x, z, id: loc.id, option: at + 1, ...best });
    }
    ranked.sort((a, b) => a.route.length - b.route.length);
    const pick =
      mode === 'activity'
        ? ranked[0]
        : ranked.find((t) => t.route.length >= 12 && t.route.length <= 30);
    if (!pick || broken) {
      report.reason = broken ? 'observation-broken' : 'no-suitable-tree';
    } else {
      recording = true;
      const corners = compressRoute(local(me), pick.route);
      note({
        type: 'request',
        tree: { x: pick.x, z: pick.z },
        routeTiles: pick.route.length,
        waypoints: corners.length,
      });
      client.sendWalk({
        startX: me.x,
        startZ: me.z,
        steps: corners.map((c) => [c.x - local(me).x, c.z - local(me).z]),
        opClick: true,
      });
      client.sendLocationOption({ x: pick.x, z: pick.z, id: pick.id, option: pick.option });
      /** Waits for a message starting with the given text. */
      const sawMessage = (prefix) =>
        timeline.some((e) => e.type === 'message' && e.text.startsWith(prefix));
      /** Chooses a free single step from the current position that is not the tree's own tile. */
      function oneStep() {
        const here = state.state.position;
        return [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].find(([dx, dz]) => {
          const t = { x: here.x + dx - regionX, z: here.z + dz - regionZ };
          if (t.x < 0 || t.x > 63 || t.z < 0 || t.z > 63) return false;
          return findConservativeRoute(grid, local(here), t)?.length === 1;
        });
      }
      let cancelAt = null;
      if (mode === 'activity') {
        const until = performance.now() + 45000;
        while (performance.now() < until && !sawMessage('You swing')) await sleep(100);
        if (!sawMessage('You swing')) report.reason = 'never-started-chopping';
      } else await sleep(3000);
      if (report.reason === 'not-started') {
        const here = { ...state.state.position };
        const step = oneStep();
        if (!step) report.reason = 'no-free-step';
        else {
          cancelAt = performance.now();
          note({ type: 'cancel-walk', from: here, step });
          client.sendWalk({ startX: here.x, startZ: here.z, steps: [step] });
          await sleep(mode === 'activity' ? 25000 : 30000);
          const after = timeline.filter((e) => e.ms > Math.round(cancelAt - started));
          const logs = after.some((e) => e.type === 'message' && e.text.startsWith('You get'));
          const swungAfter = after.some(
            (e) => e.type === 'message' && e.text.startsWith('You swing'),
          );
          const treeChanged = after.some(
            (e) =>
              e.type === 'zone' &&
              e.x >= pick.x &&
              e.x <= pick.x + 1 &&
              e.z >= pick.z &&
              e.z <= pick.z + 1,
          );
          const movedTo = state.state.position;
          const asked = { x: here.x + step[0], z: here.z + step[1] };
          const moved = mode === 'activity' ? movedTo.x === asked.x && movedTo.z === asked.z : true;
          Object.assign(report, {
            cancelledFrom: here,
            asked,
            finalPosition: movedTo,
            logsAfterCancel: logs,
            swingAfterCancel: swungAfter,
            treeChangedAfterCancel: treeChanged,
          });
          report.outcome =
            !logs && !treeChanged && moved && (mode === 'activity' || !swungAfter)
              ? 'cancelled'
              : 'unknown';
          report.reason =
            report.outcome === 'cancelled'
              ? 'no-continuation-observed-in-window'
              : 'continuation-or-unexpected-position';
        }
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
  const events = timeline.filter((e) => e.type !== 'position' || true);
  console.log(
    JSON.stringify(
      {
        ...report,
        timeline: events.filter(
          (e, i) => e.type !== 'position' || events[i - 1]?.type !== 'position' || i % 4 === 0,
        ),
      },
      null,
      1,
    ),
  );
}
