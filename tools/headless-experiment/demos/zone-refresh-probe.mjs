import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createZoneObserver } from '../zone-observer.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';

// Observe initial ground-level rebuild and full-zone refreshes; this does not reconstruct the scene.
// Optional target coordinates identify whether one of the refreshed zones covers that tile.
const [xText, zText] = process.argv.slice(2);
const target =
  xText !== undefined && zText !== undefined ? { x: Number(xText), z: Number(zText) } : null;
if (target && (!Number.isInteger(target.x) || !Number.isInteger(target.z)))
  throw new Error('INVALID_TARGET');
const state = createInitialState(),
  resets = [];
let zone = null,
  broken = false,
  rebuilds = 0;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487025,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (packet.name === 'REBUILD_NORMAL') {
        rebuilds++;
        zone = createZoneObserver({ ...state.state.region, level: 0 });
      }
      if (state.state.position && state.state.position.level !== 0) broken = true;
      if (zone)
        for (const event of zone.apply(packet)) if (event.kind === 'zone-reset') resets.push(event);
    } catch {
      broken = true;
    }
  },
});
if (client.kind !== 'accepted' || client.staffLevel !== 0) {
  client.socket?.destroy();
  throw new Error('ORDINARY_LOGIN_UNAVAILABLE');
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keepalive = setInterval(() => {
  if (!client.socket.destroyed) client.sendKeepalive();
}, 1000);
try {
  await sleep(8000);
  const targetResets = target
    ? resets.filter(
        (e) => e.x <= target.x && target.x < e.x + 8 && e.z <= target.z && target.z < e.z + 8,
      ).length
    : null;
  console.log(
    JSON.stringify({
      position: state.state.position,
      rebuilds,
      zoneResets: resets.length,
      targetZoneResets: targetResets,
      broken,
    }),
  );
  if (broken) process.exitCode = 1;
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
