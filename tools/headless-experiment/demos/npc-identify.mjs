import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createNpcObserver } from '../npc-observer.mjs';
import { decodeNpcDefinition } from '../npc-definitions.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Usage: node npc-identify.mjs <directory containing verified npc.idx and npc.dat>
const directory = process.argv[2];
if (!directory) throw new Error('CONFIG_DIRECTORY_REQUIRED');
const index = readFileSync(`${directory}/npc.idx`);
const data = readFileSync(`${directory}/npc.dat`);
const state = createInitialState();
const npcs = createNpcObserver();
let visible = [],
  packets = 0,
  broken = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487012,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (packet.name === 'NPC_INFO') {
        packets++;
        visible = npcs.apply(packet.payload, state.state.position);
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
  await sleep(12000);
  clearInterval(keepalive);
  const me = state.state.position;
  const rows = visible.map((npc) => {
    let definition;
    try {
      definition = decodeNpcDefinition(index, data, npc.typeId);
    } catch {
      definition = null;
    }
    return {
      index: npc.index,
      typeId: npc.typeId,
      name: definition?.name ?? 'unknown',
      options: definition ? definition.options.filter(Boolean) : 'unknown',
      x: npc.x,
      z: npc.z,
      distance:
        me && npc.x !== null ? Math.max(Math.abs(npc.x - me.x), Math.abs(npc.z - me.z)) : null,
    };
  });
  console.log(
    JSON.stringify({ position: me, npcInfoPackets: packets, broken, npcs: rows }, null, 1),
  );
  if (!client.socket.destroyed) {
    client.sendButton(LOGOUT_BUTTON_COMPONENT);
    await Promise.race([
      new Promise((resolve) => client.socket.once('close', resolve)),
      sleep(3000),
    ]);
    client.socket.destroy();
  }
}
