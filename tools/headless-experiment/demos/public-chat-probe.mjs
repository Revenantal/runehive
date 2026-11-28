import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';
import { createPublicChatObserver } from '../public-chat-observer.mjs';

// Sends only the pre-packed neutral message "hello" from the observed castle-area tile.
// A nearby human observer is needed: a packet write does not prove delivery.
const state = createInitialState();
const observer = createPublicChatObserver();
const expected = Buffer.from([0x61, 0xbb, 0x40]);
let broken = false,
  chatBroken = false,
  ready = false;
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487023,
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
    if (packet.name === 'PLAYER_INFO' && !chatBroken) {
      try {
        for (const message of observer.apply(packet.payload))
          if (ready && message.packed.equals(expected))
            console.log(JSON.stringify({ event: 'matching-chat', source: message.source }));
      } catch {
        chatBroken = true;
        console.log(JSON.stringify({ event: 'chat-observation-broken' }));
      }
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
  try {
    await sleep(6000);
    const p = state.state.position;
    if (broken || !p || p.level !== 0 || p.x !== 3222 || p.z !== 3219) {
      console.log(
        JSON.stringify({ sent: false, reason: 'unexpected-or-unknown-position', position: p }),
      );
      process.exitCode = 1;
    } else {
      ready = true;
      client.sendPublicChat(expected);
      console.log(
        JSON.stringify({
          sent: true,
          message: 'hello',
          position: p,
          delivery: 'unknown',
          chatBroken,
        }),
      );
      await sleep(180000);
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
}
