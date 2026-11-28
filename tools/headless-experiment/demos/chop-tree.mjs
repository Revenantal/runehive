import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createInventoryObserver } from '../inventory-observer.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { createGroundObjects } from '../ground-objects.mjs';
import { decodeLocations } from '../locations.mjs';
import { decodeTerrain } from '../terrain.mjs';
import { buildConservativeGrid, compressRoute, findConservativeRoute } from '../navigation.mjs';
import { createMoveAction } from '../move-action.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { gameMessage } from '../messages.mjs';
import { createCapture } from '../capture.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node chop-tree.mjs <config dir> <map dir> [exact object name, default Tree] [seconds, default 60] [skip, default 0] [approach]
// skip chooses the nth-nearest routed object, for example to avoid one already cut down.
// afterwards then-walk-through: once the tree is felled, walk three tiles straight across its tile
// to test a stump. reconcile-stump projects the observed replacement and compares one step.
// then-chop-again asks to chop the same, now felled, tree with its old id, as a
// client with an out-of-date scene would.
// approach request-first (default) asks first and walks only after a refusal; opclick sends the
// planned route as an operation-click walk and then the request, as the browser client does.
const [
  configDir,
  mapDir,
  wantedName = 'Tree',
  secondsText = '60',
  skipText = '0',
  approach = 'request-first',
  afterwards = '',
] = process.argv.slice(2);
if (!['request-first', 'opclick'].includes(approach)) throw new Error('INVALID_APPROACH');
const skip = Number(skipText);
if (!configDir || !mapDir)
  throw new Error('USAGE: chop-tree.mjs <config dir> <map dir> [name] [seconds]');
const seconds = Number(secondsText);
const read = (dir, name) => readFileSync(`${dir}/${name}`);
const components = decodeInterfaces(read(configDir, 'interface.dat'));
const locIdx = read(configDir, 'loc.idx'),
  locDat = read(configDir, 'loc.dat');
const objIdx = read(configDir, 'obj.idx'),
  objDat = read(configDir, 'obj.dat');
const placed = decodeLocations(read(mapDir, 'region.bin'));
const definitions = new Map(
  [...new Set(placed.map((loc) => loc.id))].map((id) => [
    id,
    decodeLocationDefinition(locIdx, locDat, id),
  ]),
);
const grid = buildConservativeGrid(decodeTerrain(read(mapDir, 'ground.bin')), placed, definitions);
const capture = createCapture({
  names: [
    'UPDATE_STAT',
    'MESSAGE_GAME',
    'UPDATE_INV_FULL',
    'UPDATE_INV_PARTIAL',
    'LOC_ADD_CHANGE',
    'LOC_DEL',
    'OBJ_ADD',
    'OBJ_DEL',
    'OBJ_COUNT',
    'OBJ_REVEAL',
    'UPDATE_ZONE_PARTIAL_ENCLOSED',
    'UPDATE_ZONE_PARTIAL_FOLLOWS',
  ],
  limitPerName: 400,
});
const state = createInitialState();
const inventories = createInventoryObserver({
  capacity: (id) => {
    const c = components.get(id);
    return c?.type === 2 ? c.width * c.height : null;
  },
});
const ground = createGroundObjects();
const timeline = [];
const started = performance.now();
let zone = null,
  broken = false,
  requested = false,
  lastPosition = null;
/** Adds a timestamped event, counting time from the login. */
const note = (event) => timeline.push({ ms: Math.round(performance.now() - started), ...event });
/** Names an item id from client definitions, or reports it unknown. */
function itemName(id) {
  try {
    return decodeObjectDefinition(objIdx, objDat, id).name ?? 'unnamed';
  } catch {
    return 'unknown';
  }
}
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487016,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      const skillsBefore = JSON.stringify(state.state.skills);
      state.apply(packet);
      if (requested) capture.record(packet);
      if (packet.name === 'REBUILD_NORMAL') {
        if (requested) note({ type: 'rebuild' });
        zone = createZoneObserver({ ...state.state.region, level: 0, includeObjects: true });
      }
      if (zone) {
        for (const event of zone.apply(packet)) {
          ground.apply(event);
          if (requested) note({ type: 'zone', ...event });
        }
      }
      const inv = inventories.apply(packet);
      if (inv && requested) note({ ...inv, type: 'inventory', change: inv.type });
      if (packet.name === 'MESSAGE_GAME' && requested)
        note({ type: 'message', text: gameMessage(packet.payload) });
      if (
        packet.name === 'UPDATE_STAT' &&
        requested &&
        JSON.stringify(state.state.skills) !== skillsBefore
      )
        note({ type: 'skill', skills: JSON.parse(JSON.stringify(state.state.skills)) });
      const here = state.state.position;
      if (
        requested &&
        here &&
        (!lastPosition || here.x !== lastPosition.x || here.z !== lastPosition.z)
      ) {
        lastPosition = { ...here };
        note({ type: 'position', x: here.x, z: here.z });
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
  const result = { outcome: 'unknown', reason: 'not-started' };
  let target = null,
    carriedBefore = null,
    skillsBefore = null;
  try {
    await sleep(6000);
    const me = state.state.position;
    const region = state.state.region;
    // Region files use coordinates local to their 64x64 region; the character's tile fixes it.
    const regionX = me ? Math.floor(me.x / 64) * 64 : null;
    const regionZ = me ? Math.floor(me.z / 64) * 64 : null;
    const candidates = [];
    for (const loc of placed) {
      if (!me || loc.level !== me.level) continue;
      let definition;
      try {
        definition = decodeLocationDefinition(locIdx, locDat, loc.id, { includeText: true });
      } catch {
        continue;
      }
      const at = definition.options.indexOf('Chop down');
      if (definition.name !== wantedName || at === -1) continue;
      const x = regionX + loc.x,
        z = regionZ + loc.z;
      // Rank by static-map route length to a free tile next to the object. A missing route is
      // unknown, not proof of blockage, but it is a better guide than straight-line distance.
      let best = null,
        bestGoal = null;
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const goalX = x - regionX + dx,
          goalZ = z - regionZ + dz;
        // Routes stay inside the loaded 64x64 region; a goal outside it is simply not considered.
        if (goalX < 0 || goalX > 63 || goalZ < 0 || goalZ > 63) continue;
        const route = findConservativeRoute(
          grid,
          { x: me.x - regionX, z: me.z - regionZ },
          { x: goalX, z: goalZ },
        );
        if (route && (best === null || route.length < best)) {
          best = route.length;
          bestGoal = { x: goalX + regionX, z: goalZ + regionZ };
        }
      }
      candidates.push({
        x,
        z,
        id: loc.id,
        option: at + 1,
        distance: Math.max(Math.abs(x - me.x), Math.abs(z - me.z)),
        routeLength: best,
        standAt: bestGoal,
      });
    }
    const reachable = candidates.filter((c) => c.routeLength !== null);
    reachable.sort((a, b) => a.routeLength - b.routeLength);
    candidates.sort((a, b) => a.distance - b.distance);
    result.nearestByDistance = candidates.slice(0, 4);
    result.nearestByRoute = reachable.slice(0, 4);
    carriedBefore = new Map();
    for (const id of inventories.components())
      for (const slot of inventories.get(id))
        if (slot.item !== null)
          carriedBefore.set(slot.item, (carriedBefore.get(slot.item) ?? 0) + slot.count);
    skillsBefore = JSON.parse(JSON.stringify(state.state.skills));
    if (!region || broken) result.reason = 'observation-unavailable';
    else if (!reachable.length) result.reason = 'no-object-with-a-known-route';
    else if (!reachable[skip]) result.reason = 'no-object-at-that-rank';
    else if (reachable[skip].routeLength > 40) result.reason = 'nearest-routed-object-too-far';
    else {
      target = reachable[skip];
      note({ type: 'request', target, from: { ...me }, definition: wantedName });
      requested = true;
      if (approach === 'opclick') {
        const route = findConservativeRoute(
          grid,
          { x: me.x - regionX, z: me.z - regionZ },
          { x: target.standAt.x - regionX, z: target.standAt.z - regionZ },
        );
        if (!route) throw new Error('NO_ROUTE');
        const start = { x: me.x - regionX, z: me.z - regionZ };
        const corners = compressRoute(start, route);
        if (corners.length > 24) throw new Error('TOO_MANY_WAYPOINTS');
        client.sendWalk({
          startX: me.x,
          startZ: me.z,
          steps: corners.map((tile) => [tile.x - start.x, tile.z - start.z]),
          opClick: true,
        });
        note({ type: 'route-sent', tiles: route.length, waypoints: corners.length });
      }
      client.sendLocationOption({ x: target.x, z: target.z, id: target.id, option: target.option });
      /** Waits for the refusal message, or for any sign of activity, for a few seconds. */
      const refusedWithin = async (ms) => {
        const until = performance.now() + ms;
        const seen = timeline.length;
        while (performance.now() < until && !broken) {
          if (
            timeline
              .slice(seen)
              .some((e) => e.type === 'message' && e.text === "I can't reach that!")
          )
            return true;
          await sleep(100);
        }
        return false;
      };
      if (await refusedWithin(4000)) {
        result.refusedFirstRequest = true;
        // The static map predicted a route, so walk it to see where the live world stops us.
        const moveTo = createMoveAction({
          regionX,
          regionZ,
          level: me.level,
          grid,
          findRoute: findConservativeRoute,
          position: () => state.state.position,
          sendWalk: (request) => client.sendWalk(request),
          invalidated: () => broken,
          stopped: () => client.socket.destroyed,
          sleep,
          now: () => performance.now(),
          timeoutMs: 30000,
        });
        note({ type: 'walk-start', to: { x: target.standAt.x, z: target.standAt.z } });
        result.walk = await moveTo({ x: target.standAt.x, z: target.standAt.z, level: me.level });
        note({ type: 'walk-end', ...result.walk });
        requested = true;
        client.sendLocationOption({
          x: target.x,
          z: target.z,
          id: target.id,
          option: target.option,
        });
        note({ type: 'request-again', target });
      }
      const deadline = performance.now() + seconds * 1000;
      let outcomeAt = null;
      while (performance.now() < deadline && !broken) {
        await sleep(200);
        const saw = (type) =>
          timeline.some(
            (e) => e.type === type && e.ms > timeline.find((r) => r.type === 'request').ms,
          );
        if (outcomeAt === null && saw('inventory') && saw('skill')) outcomeAt = performance.now();
        if (outcomeAt !== null && performance.now() - outcomeAt > 2500) break;
      }
      result.reason = broken
        ? 'observation-broken'
        : outcomeAt === null
          ? 'deadline'
          : 'outcome-evidence-seen';
      if (afterwards === 'reconcile-stump' && outcomeAt !== null) {
        const events = timeline.filter(
          (e) =>
            e.type === 'zone' && e.x === target.x && e.z === target.z && e.kind === 'add-change',
        );
        const change = events.at(-1);
        const source = placed.filter(
          (p) =>
            p.id === target.id &&
            p.level === me.level &&
            p.x === target.x - regionX &&
            p.z === target.z - regionZ &&
            p.shape === change?.shape,
        );
        const changeIndex = timeline.indexOf(change);
        const unsafe = timeline
          .slice(changeIndex + 1)
          .some(
            (e) =>
              e.type === 'rebuild' ||
              (e.type === 'zone' &&
                e.level === me.level &&
                ((e.kind === 'zone-reset' &&
                  e.x <= target.x &&
                  target.x < e.x + 8 &&
                  e.z <= target.z &&
                  target.z < e.z + 8) ||
                  (e.x === target.x &&
                    e.z === target.z &&
                    e.kind !== 'object-add' &&
                    e.kind !== 'object-remove' &&
                    e.kind !== 'object-count' &&
                    e.kind !== 'object-reveal'))),
          );
        const position = state.state.position;
        const adjacent =
          position && Math.abs(position.x - target.x) + Math.abs(position.z - target.z) === 1;
        const swung = timeline.some(
          (e) => e.type === 'message' && e.text === 'You swing your axe at the tree.',
        );
        result.reconciliation = { outcome: 'unknown', reason: 'preconditions-not-met' };
        if (!broken && change && source.length === 1 && !unsafe && adjacent && swung) {
          const replacement = { ...source[0], id: change.id, rotation: change.rotation };
          const projectedDefinitions = new Map(definitions);
          projectedDefinitions.set(change.id, decodeLocationDefinition(locIdx, locDat, change.id));
          const projected = placed.map((p) => (p === source[0] ? replacement : p));
          const projectedGrid = buildConservativeGrid(
            decodeTerrain(read(mapDir, 'ground.bin')),
            projected,
            projectedDefinitions,
            me.level,
          );
          const predictedBlocked = Boolean(
            projectedGrid.blocked[(target.x - regionX) * 64 + target.z - regionZ],
          );
          result.reconciliation = {
            outcome: 'unknown',
            reason: 'step-not-requested',
            change,
            predictedBlocked,
            from: { ...position },
          };
          if (predictedBlocked) {
            client.sendWalk({
              startX: position.x,
              startZ: position.z,
              steps: [[target.x - position.x, target.z - position.z]],
            });
            await sleep(6000);
            result.reconciliation.final = state.state.position ? { ...state.state.position } : null;
            result.reconciliation.outcome =
              !broken &&
              state.state.position?.x === target.x &&
              state.state.position?.z === target.z
                ? 'entered-target'
                : 'unknown';
            result.reconciliation.reason = broken
              ? 'observation-broken'
              : result.reconciliation.outcome === 'entered-target'
                ? 'observed-arrival'
                : 'no-observed-arrival';
          }
        }
      }
      if (afterwards === 'then-chop-again' && outcomeAt !== null) {
        await sleep(1500);
        const mark = timeline.length;
        const before = { ...state.state.position };
        note({ type: 'stale-request', target });
        client.sendLocationOption({
          x: target.x,
          z: target.z,
          id: target.id,
          option: target.option,
        });
        await sleep(8000);
        const after = timeline.slice(mark);
        result.staleRequest = {
          messages: after
            .filter((e) => e.type === 'message')
            .map((e) => ({ ms: e.ms, text: e.text })),
          moved: state.state.position.x !== before.x || state.state.position.z !== before.z,
          events: after
            .filter((e) => e.type !== 'message' && e.type !== 'position')
            .map((e) => e.type),
        };
      }
      if (afterwards === 'then-walk-through' && outcomeAt !== null) {
        // Walk three tiles from the standing tile straight across the felled tree's tile.
        const from = { ...state.state.position };
        const dx = Math.sign(target.x - target.standAt.x),
          dz = Math.sign(target.z - target.standAt.z);
        const goal = { x: from.x + 3 * dx, z: from.z + 3 * dz };
        note({ type: 'stump-walk-start', from, goal });
        client.sendWalk({ startX: from.x, startZ: from.z, steps: [[3 * dx, 3 * dz]] });
        await sleep(6000);
        const end = { ...state.state.position };
        result.stumpWalk = {
          from,
          goal,
          final: end,
          reachedGoal: end.x === goal.x && end.z === goal.z,
          moved: end.x !== from.x || end.z !== from.z,
        };
        note({ type: 'stump-walk-end', ...result.stumpWalk });
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
  // Judge only from observations, keeping each kind of evidence separate.
  const carriedAfter = new Map();
  for (const id of inventories.components())
    for (const slot of inventories.get(id))
      if (slot.item !== null)
        carriedAfter.set(slot.item, (carriedAfter.get(slot.item) ?? 0) + slot.count);
  const gained = [...carriedAfter]
    .filter(([id, count]) => count > (carriedBefore?.get(id) ?? 0))
    .map(([id, count]) => ({
      id,
      name: itemName(id),
      gained: count - (carriedBefore?.get(id) ?? 0),
    }));
  const skillChanges = Object.entries(state.state.skills)
    .filter(
      ([id, s]) =>
        skillsBefore?.[id] &&
        (s.experience !== skillsBefore[id].experience ||
          s.currentLevel !== skillsBefore[id].currentLevel),
    )
    .map(([id, s]) => ({
      skill: Number(id),
      experience: [skillsBefore[id].experience, s.experience],
      level: [skillsBefore[id].currentLevel, s.currentLevel],
    }));
  const objectChanged = target
    ? timeline.some(
        (e) =>
          e.type === 'zone' &&
          e.kind !== 'zone-reset' &&
          e.x === target.x &&
          e.z === target.z &&
          e.kind.includes('add'),
      )
    : false;
  if (target) {
    Object.assign(result, { newItems: gained, skillChanges, objectChangedAtTarget: objectChanged });
    if ((gained.length && skillChanges.length) || objectChanged) result.outcome = 'completed';
  }
  if (process.env.RUNEHIVE_CAPTURE_FILE) capture.write(process.env.RUNEHIVE_CAPTURE_FILE);
  console.log(
    JSON.stringify(
      {
        ...result,
        target,
        finalPosition: state.state.position,
        groundNearby: ground.all().slice(0, 10),
        timeline,
      },
      null,
      1,
    ),
  );
  if (result.outcome !== 'completed') process.exitCode = 1;
}
