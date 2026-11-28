import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createInventoryObserver } from '../inventory-observer.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node equip.mjs <config directory> <wield|remove> "<exact item name>"
const [directory, action, wantedName] = process.argv.slice(2);
if (!directory || !['wield', 'remove'].includes(action) || !wantedName)
  throw new Error('USAGE: equip.mjs <config directory> <wield|remove> "<exact item name>"');
const index = readFileSync(`${directory}/obj.idx`);
const data = readFileSync(`${directory}/obj.dat`);
const components = decodeInterfaces(readFileSync(`${directory}/interface.dat`));
const state = createInitialState();
const inventories = createInventoryObserver({
  capacity: (id) => {
    const component = components.get(id);
    return component?.type === 2 ? component.width * component.height : null;
  },
});
const messages = [];
let broken = false,
  lastUpdate = 0,
  updatesAfterRequest = 0,
  requested = false;
/** Resolves one item id from client definitions; failure is reported as unknown. */
function define(id) {
  try {
    return decodeObjectDefinition(index, data, id);
  } catch {
    return null;
  }
}
/** Copies every known inventory component. */
function snapshot() {
  return new Map(inventories.components().map((id) => [id, inventories.get(id)]));
}
/** Sums an item's counts over components where the interface data supports the given kind. */
function total(view, itemId, kind) {
  let sum = 0;
  for (const [id, slots] of view) {
    const component = components.get(id);
    const carried = component?.objectOptions === true;
    if ((kind === 'carried') !== carried) continue;
    for (const slot of slots) if (slot.item === itemId) sum += slot.count;
  }
  return sum;
}
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487015,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      const event = inventories.apply(packet);
      if (event) {
        lastUpdate = performance.now();
        if (requested) updatesAfterRequest++;
      }
      if (packet.name === 'MESSAGE_GAME' && requested)
        messages.push(Buffer.from(packet.payload).toString('latin1'));
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
  let request = null,
    before,
    after;
  try {
    // Wait for the post-login snapshot to settle.
    const waitUntil = performance.now() + 10000;
    while (performance.now() < waitUntil && (!lastUpdate || performance.now() - lastUpdate < 1500))
      await sleep(100);
    before = snapshot();
    // Find the item and the option, using only client-visible definitions and interface data.
    for (const [id, slots] of before) {
      const component = components.get(id);
      if (!component) continue;
      slots.forEach((slot, position) => {
        if (request || slot.item === null) return;
        const item = define(slot.item);
        if (item?.name !== wantedName) return;
        if (action === 'wield' && component.objectOptions) {
          const at = item.inventoryOptions.findIndex((text) => text === 'Wield' || text === 'Wear');
          if (at !== -1 && at < 3)
            request = {
              kind: 'held',
              item: slot.item,
              slot: position,
              component: id,
              option: at + 1,
            };
        }
        if (action === 'remove' && !component.objectOptions) {
          const at = component.options.findIndex((text) => text === 'Remove');
          if (at !== -1)
            request = {
              kind: 'button',
              item: slot.item,
              slot: position,
              component: id,
              option: at + 1,
            };
        }
      });
    }
    if (broken) result.reason = 'observation-broken';
    else if (!request) result.reason = 'no-matching-item-and-option';
    else {
      requested = true;
      if (request.kind === 'held') client.sendHeldOption(request);
      else client.sendInventoryButton(request);
      const deadline = performance.now() + 10000;
      while (performance.now() < deadline && !broken) {
        await sleep(100);
        if (updatesAfterRequest && performance.now() - lastUpdate > 1500) break;
      }
      after = snapshot();
      const carriedDelta =
        total(after, request.item, 'carried') - total(before, request.item, 'carried');
      const wornDelta = total(after, request.item, 'worn') - total(before, request.item, 'worn');
      const expected =
        action === 'wield'
          ? carriedDelta < 0 && wornDelta === -carriedDelta
          : wornDelta < 0 && carriedDelta === -wornDelta;
      if (broken) result.reason = 'observation-broken';
      else if (expected)
        Object.assign(result, {
          outcome: 'completed',
          reason: 'counts-moved',
          carriedDelta,
          wornDelta,
        });
      else
        Object.assign(result, {
          reason: updatesAfterRequest ? 'counts-did-not-match' : 'no-update-observed',
          carriedDelta,
          wornDelta,
        });
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
  /** Lists slots whose item or count changed, with client-resolved names. */
  const changes = [];
  if (before && after)
    for (const [id, slots] of after) {
      const old = before.get(id) ?? [];
      for (let position = 0; position < Math.max(slots.length, old.length); position++) {
        const a = old[position] ?? { item: null, count: 0 },
          b = slots[position] ?? { item: null, count: 0 };
        if (a.item === b.item && a.count === b.count) continue;
        /** Names one slot's contents. */
        const label = (slot) =>
          slot.item === null ? 'empty' : `${define(slot.item)?.name ?? 'unknown'} x${slot.count}`;
        changes.push({ component: id, slot: position, from: label(a), to: label(b) });
      }
    }
  console.log(
    JSON.stringify(
      { action, wantedName, request, ...result, updatesAfterRequest, messages, changes },
      null,
      1,
    ),
  );
  if (result.outcome !== 'completed') process.exitCode = 1;
}
