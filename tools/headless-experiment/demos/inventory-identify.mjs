import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createInventoryObserver } from '../inventory-observer.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { examineText, listItemActions } from '../item-actions.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node inventory-identify.mjs <directory containing verified obj.idx, obj.dat and interface.dat>
const directory = process.argv[2];
if (!directory) throw new Error('CONFIG_DIRECTORY_REQUIRED');
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
const events = [];
let broken = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487014,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      const event = inventories.apply(packet);
      if (event) events.push(event);
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
  await sleep(8000);
  clearInterval(keepalive);
  const report = inventories.components().map((id) => {
    const definition = components.get(id);
    const slots = inventories.get(id);
    const items = slots
      .map((slot, position) => ({ slot, position }))
      .filter(({ slot }) => slot.item !== null)
      .map(({ slot, position }) => {
        let item;
        try {
          item = decodeObjectDefinition(index, data, slot.item);
        } catch {
          item = null;
        }
        return {
          slot: position,
          id: slot.item,
          count: slot.count,
          name: item?.name ?? 'unknown',
          stackable: item?.stackable ?? 'unknown',
          actions:
            item && definition
              ? listItemActions({ definition: item, component: definition })
              : 'unknown',
          examine: item
            ? examineText({ name: item.name, description: item.description, count: slot.count })
            : 'unknown',
        };
      });
    return {
      component: id,
      layer: definition?.layerId ?? 'unknown',
      slots: slots.length,
      interface: definition
        ? {
            itemDefinedOptions: definition.objectOptions,
            componentOptions: definition.options.filter(Boolean),
          }
        : 'unknown',
      items,
    };
  });
  console.log(JSON.stringify({ broken, updates: events.length, report }, null, 1));
  if (!client.socket.destroyed) {
    client.sendButton(LOGOUT_BUTTON_COMPONENT);
    await Promise.race([
      new Promise((resolve) => client.socket.once('close', resolve)),
      sleep(3000),
    ]);
    client.socket.destroy();
  }
}
