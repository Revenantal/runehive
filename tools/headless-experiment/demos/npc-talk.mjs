import { readFileSync } from 'node:fs';
import { login } from '../login.mjs';
import { createInitialState } from '../initial-state.mjs';
import { createNpcObserver } from '../npc-observer.mjs';
import { decodeNpcDefinition } from '../npc-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';
import { createDialogueObserver } from '../dialogue-observer.mjs';
import { LOGOUT_BUTTON_COMPONENT } from '../logout.mjs';
import { createCapture } from '../capture.mjs';

// Usage: node npc-talk.mjs <directory containing verified npc.idx, npc.dat and interface.dat> [exact NPC name] [choice number to click once]
const directory = process.argv[2];
if (!directory) throw new Error('CONFIG_DIRECTORY_REQUIRED');
const wantedName = process.argv[3] ?? null;
const choiceNumber = process.argv[4] ? Number(process.argv[4]) : null;
if (
  choiceNumber !== null &&
  !(Number.isInteger(choiceNumber) && choiceNumber >= 1 && choiceNumber <= 5)
)
  throw new Error('INVALID_CHOICE_NUMBER');
const npcIndex = readFileSync(`${directory}/npc.idx`);
const npcData = readFileSync(`${directory}/npc.dat`);
const dialogue = createDialogueObserver(
  decodeInterfaces(readFileSync(`${directory}/interface.dat`)),
);
const state = createInitialState();
const npcs = createNpcObserver();
const started = performance.now();
const events = [];
// Optional: RUNEHIVE_CAPTURE_FILE saves dialogue packets as a test fixture, with the own name masked.
const capture = createCapture({
  names: ['IF_OPENCHAT', 'IF_SETTEXT', 'IF_CLOSE'],
  ownName: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT ?? '',
  limitPerName: 200,
});
const pages = [];
const names = new Set();
let visible = [],
  broken = false,
  requested = false,
  opened = 0,
  choicesMade = 0,
  closed = false,
  stopReason = null,
  lastX = null,
  lastZ = null;
const ownName = (process.env.RUNEHIVE_EXPERIMENT_ACCOUNT ?? '').toLowerCase();
/** Replaces the character's own display name, which dialogue shows, before anything is printed. */
const maskOwnName = (text) => (text.toLowerCase() === ownName ? '[own name]' : text);
/** Adds a timestamped, secret-free event. */
const note = (event) => events.push({ ms: Math.round(performance.now() - started), ...event });
const client = await login({
  account: process.env.RUNEHIVE_EXPERIMENT_ACCOUNT,
  host: process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1',
  deviceId: 487013,
  onPacket(packet) {
    if (packet.broken) {
      broken = true;
      return;
    }
    try {
      state.apply(packet);
      if (requested) capture.record(packet);
      if (packet.name === 'NPC_INFO') visible = npcs.apply(packet.payload, state.state.position);
      if (requested && !['PLAYER_INFO', 'NPC_INFO'].includes(packet.name)) names.add(packet.name);
      if (packet.name === 'MESSAGE_GAME' && requested)
        note({
          type: 'game-message',
          text: Buffer.from(packet.payload).toString('latin1'),
        });
      const here = state.state.position;
      if (requested && here && (here.x !== lastX || here.z !== lastZ)) {
        lastX = here.x;
        lastZ = here.z;
        note({ type: 'position', x: here.x, z: here.z });
      }
      const event = dialogue.apply(packet);
      if (!event || !requested) return;
      note(event);
      if (event.type === 'opened') {
        opened++;
        const menu = Array.isArray(event.choices) && event.choices.length ? event.choices : null;
        pages.push({
          interface: event.id,
          known: event.known,
          texts: event.texts ?? [],
          ...(menu && { choices: menu.map((choice) => choice.text) }),
        });
        if (!event.known) stopReason = 'unknown-interface';
        else if (event.choices === 'incomplete') stopReason = 'incomplete-choice-menu';
        else if (menu) {
          if (choiceNumber && choicesMade === 0 && choiceNumber <= menu.length) {
            choicesMade++;
            const choice = menu[choiceNumber - 1];
            setTimeout(() => {
              if (!client.socket.destroyed) {
                client.sendButton(choice.component);
                note({ type: 'choice-sent', option: choiceNumber, component: choice.component });
              }
            }, 400);
          } else stopReason = 'choice-menu-not-answered';
        } else if (event.continueButtons.length !== 1) stopReason = 'no-single-continue-button';
        else if (pages.length <= 8) {
          const button = event.continueButtons[0];
          setTimeout(() => {
            if (!client.socket.destroyed) {
              client.sendContinue(button);
              note({ type: 'continue-sent', component: button });
            }
          }, 400);
        } else stopReason = 'page-limit';
      }
      if (event.type === 'text' && pages.length) pages[pages.length - 1].texts.push(event.text);
      if (event.type === 'closed' && opened > 0) closed = true;
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
  let target = null;
  try {
    await sleep(4000);
    const me = state.state.position;
    const candidates = visible
      .map((npc) => {
        try {
          return { npc, definition: decodeNpcDefinition(npcIndex, npcData, npc.typeId) };
        } catch {
          return null;
        }
      })
      .filter(
        (c) =>
          c &&
          c.definition.options[0] === 'Talk-to' &&
          (wantedName === null || c.definition.name === wantedName) &&
          me &&
          c.npc.x !== null,
      )
      .map((c) => ({
        ...c,
        distance: Math.max(Math.abs(c.npc.x - me.x), Math.abs(c.npc.z - me.z)),
      }))
      .filter((c) => c.distance <= 30)
      .sort((a, b) => a.distance - b.distance);
    if (!candidates.length || broken) {
      result.reason = broken ? 'observation-broken' : 'no-talk-to-npc-nearby';
    } else {
      target = candidates[0];
      note({
        type: 'request',
        npcIndex: target.npc.index,
        name: target.definition.name,
        option: 1,
        distance: target.distance,
        from: me,
      });
      requested = true;
      client.sendNpcOption({ index: target.npc.index, option: 1 });
      const deadline = performance.now() + 60000;
      while (performance.now() < deadline && !closed && !stopReason && !broken) await sleep(100);
      result.outcome = closed && !broken ? 'completed' : 'unknown';
      result.reason = closed
        ? 'chat-closed-after-open'
        : (stopReason ??
          (broken ? 'observation-broken' : opened ? 'deadline-with-chat' : 'no-chat-opened'));
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
      {
        ...result,
        target: target && { index: target.npc.index, name: target.definition.name },
        finalPosition: state.state.position,
        packetNamesAfterRequest: [...names].sort(),
        pages: pages.map((page) => ({ ...page, texts: page.texts.map(maskOwnName) })),
        events: events.map((e) => ({
          ...e,
          ...(e.text && { text: maskOwnName(e.text) }),
          ...(e.texts && { texts: e.texts.map(maskOwnName) }),
        })),
      },
      null,
      1,
    ),
  );
  if (result.outcome !== 'completed') process.exitCode = 1;
}
