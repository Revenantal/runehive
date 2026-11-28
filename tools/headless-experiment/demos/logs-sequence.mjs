import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createInventoryObserver } from '../inventory-observer.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { createGroundObjects } from '../ground-objects.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { listGroundActions, listItemActions } from '../item-actions.mjs';
import { gameMessage } from '../messages.mjs';
import { createCapture } from '../capture.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node logs-sequence.mjs <config dir> [exact item name, default Logs] [mode]
// mode ground-option (default): drop, take, drop, light with the ground Light option.
// mode use-on-ground: drop, then use the tinderbox on the dropped item. Each step is judged alone.
const [configDir, itemName = 'Logs', mode = 'ground-option'] = process.argv.slice(2);
if (!['ground-option', 'use-on-ground'].includes(mode)) throw new Error('INVALID_MODE');
if (!configDir) throw new Error('USAGE: logs-sequence.mjs <config dir> [item name]');
const read = (name) => readFileSync(`${configDir}/${name}`);
const components = decodeInterfaces(read('interface.dat'));
const objIdx = read('obj.idx'),
  objDat = read('obj.dat'),
  locIdx = read('loc.idx'),
  locDat = read('loc.dat');
const define = (id) => decodeObjectDefinition(objIdx, objDat, id);
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
  recording = false;
/** Adds a timestamped event. */
const note = (event) => timeline.push({ ms: Math.round(performance.now() - started), ...event });
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487017,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      const skills = JSON.stringify(state.state.skills);
      state.apply(packet);
      if (recording) capture.record(packet);
      if (packet.name === 'REBUILD_NORMAL')
        zone = createZoneObserver({ ...state.state.region, level: 0, includeObjects: true });
      if (zone)
        for (const event of zone.apply(packet)) {
          ground.apply(event);
          if (recording && event.kind !== 'zone-reset') note({ type: 'zone', ...event });
        }
      const inv = inventories.apply(packet);
      if (inv && recording) note({ type: 'inventory', ...inv });
      if (packet.name === 'MESSAGE_GAME' && recording)
        note({ type: 'message', text: gameMessage(packet.payload) });
      if (
        packet.name === 'UPDATE_STAT' &&
        recording &&
        JSON.stringify(state.state.skills) !== skills
      )
        note({ type: 'skill', skills: JSON.parse(JSON.stringify(state.state.skills)) });
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
  /** Polls until a condition holds or time runs out. */
  async function until(condition, ms) {
    const end = performance.now() + ms;
    while (performance.now() < end && !broken) {
      if (condition()) return true;
      await sleep(100);
    }
    return condition();
  }
  /** Counts an item across item-option inventories such as the backpack. */
  function carried(id) {
    let sum = 0;
    for (const component of inventories.components()) {
      if (components.get(component)?.objectOptions !== true) continue;
      for (const slot of inventories.get(component)) if (slot.item === id) sum += slot.count;
    }
    return sum;
  }
  /** Finds the first slot in a backpack-style component that holds the named item. */
  function findCarried(name) {
    for (const component of inventories.components()) {
      if (components.get(component)?.objectOptions !== true) continue;
      const slots = inventories.get(component);
      for (let slot = 0; slot < slots.length; slot++) {
        if (slots[slot].item === null) continue;
        try {
          if (define(slots[slot].item).name === name)
            return { item: slots[slot].item, slot, component };
        } catch {
          // Unresolvable items are skipped, never guessed.
        }
      }
    }
    return null;
  }
  /** Lists known ground items of one id within a distance of the character. */
  function groundNear(id, distance) {
    const me = state.state.position;
    return ground
      .all()
      .filter(
        (g) =>
          g.id === id &&
          g.level === me.level &&
          Math.max(Math.abs(g.x - me.x), Math.abs(g.z - me.z)) <= distance,
      );
  }
  const steps = [];
  let item = null;
  try {
    await sleep(6000);
    recording = true;
    const first = findCarried(itemName);
    if (!first || broken) {
      steps.push({
        step: 'start',
        outcome: 'unknown',
        reason: first ? 'observation-broken' : 'item-not-carried',
      });
    } else {
      item = first.item;
      const definition = define(item);
      const dropSlot = () => findCarried(itemName);

      /** Step: drop through the numbered Drop action, then expect backpack loss and a ground item. */
      const drop = async (label) => {
        const found = dropSlot();
        if (!found) return { step: label, outcome: 'unknown', reason: 'item-not-carried' };
        const action = listItemActions({
          definition,
          component: components.get(found.component),
        }).find((a) => a.label === 'Drop' && a.kind === 'held');
        if (!action) return { step: label, outcome: 'unknown', reason: 'no-drop-action' };
        const before = carried(item),
          groundBefore = groundNear(item, 1).length;
        note({
          type: 'request',
          step: label,
          action: action.label,
          option: action.option,
          ...found,
        });
        client.sendHeldOption({ ...found, option: action.option });
        const ok = await until(
          () => carried(item) < before && groundNear(item, 1).length > groundBefore,
          8000,
        );
        return {
          step: label,
          outcome: ok ? 'completed' : 'unknown',
          reason: ok
            ? 'item-left-backpack-and-appeared-on-ground'
            : 'no-confirming-pair-of-updates',
          carriedDelta: carried(item) - before,
          groundDelta: groundNear(item, 1).length - groundBefore,
        };
      };
      /** Step: take it back through the ground action the client supplies. */
      const take = async (label) => {
        const tiles = groundNear(item, 3);
        const action = listGroundActions({ definition }).find((a) => a.label === 'Take');
        if (!tiles.length || !action)
          return { step: label, outcome: 'unknown', reason: 'nothing-to-take' };
        const tile = tiles[0],
          before = carried(item),
          groundBefore = groundNear(item, 3).length;
        note({
          type: 'request',
          step: label,
          action: action.label,
          option: action.option,
          ...tile,
        });
        client.sendGroundOption({ x: tile.x, z: tile.z, id: item, option: action.option });
        const ok = await until(
          () => carried(item) > before && groundNear(item, 3).length < groundBefore,
          10000,
        );
        return {
          step: label,
          outcome: ok ? 'completed' : 'unknown',
          reason: ok
            ? 'item-left-ground-and-returned-to-backpack'
            : 'no-confirming-pair-of-updates',
          carriedDelta: carried(item) - before,
          groundDelta: groundNear(item, 3).length - groundBefore,
        };
      };
      /** Step: light it through the ground option, expecting the item to go and a world object to appear. */
      const light = async (label) => {
        const tiles = groundNear(item, 2);
        const action = listGroundActions({ definition }).find((a) => a.label === 'Light');
        if (!tiles.length || !action)
          return { step: label, outcome: 'unknown', reason: 'nothing-to-light' };
        const tile = tiles[0],
          mark = timeline.length;
        note({
          type: 'request',
          step: label,
          action: action.label,
          option: action.option,
          ...tile,
        });
        if (mode === 'use-on-ground') {
          const tinderbox = findCarried('Tinderbox');
          if (!tinderbox) return { step: label, outcome: 'unknown', reason: 'no-tinderbox' };
          client.sendUseOnGroundItem({
            x: tile.x,
            z: tile.z,
            id: item,
            useItem: tinderbox.item,
            useSlot: tinderbox.slot,
            useComponent: tinderbox.component,
          });
          note({ type: 'use-on-ground', tinderbox });
        } else client.sendGroundOption({ x: tile.x, z: tile.z, id: item, option: action.option });
        /** Looks for a world object added at or beside the item's tile after the request. */
        const objectAppeared = () =>
          timeline
            .slice(mark)
            .some(
              (e) =>
                e.type === 'zone' &&
                e.kind === 'add-change' &&
                Math.abs(e.x - tile.x) <= 1 &&
                Math.abs(e.z - tile.z) <= 1,
            );
        const ok = await until(() => groundNear(item, 2).length === 0 && objectAppeared(), 20000);
        const added = timeline
          .slice(mark)
          .filter((e) => e.type === 'zone' && e.kind === 'add-change')
          .map((e) => ({ id: e.id, x: e.x, z: e.z }));
        const names = added.map((a) => {
          try {
            return decodeLocationDefinition(locIdx, locDat, a.id, { includeText: true }).name;
          } catch {
            return 'unknown';
          }
        });
        return {
          step: label,
          outcome: ok ? 'completed' : 'unknown',
          reason: ok ? 'item-left-ground-and-object-appeared' : 'no-confirming-pair-of-updates',
          objectsAdded: added.map((a, i) => ({ ...a, name: names[i] })),
        };
      };

      const plan =
        mode === 'use-on-ground'
          ? [
              ['drop', drop],
              ['light', light],
            ]
          : [
              ['drop', drop],
              ['take', take],
              ['drop-again', drop],
              ['light', light],
            ];
      for (const [label, run] of plan) {
        const result = await run(label);
        steps.push(result);
        if (result.outcome !== 'completed') break;
        await sleep(1500);
      }
      // Let a lit fire's later changes show up before logging out.
      if (steps.at(-1)?.step === 'light') await sleep(8000);
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
  if (process.env.RUNEHIVE_CAPTURE_FILE) capture.write(process.env.RUNEHIVE_CAPTURE_FILE);
  console.log(
    JSON.stringify(
      { item: item && define(item).name, steps, finalPosition: state.state.position, timeline },
      null,
      1,
    ),
  );
  if (steps.length === 0 || steps.some((s) => s.outcome !== 'completed')) process.exitCode = 1;
}
