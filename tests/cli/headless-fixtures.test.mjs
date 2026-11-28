import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createDialogueObserver } from '../../tools/headless-experiment/dialogue-observer.mjs';
import { createInventoryObserver } from '../../tools/headless-experiment/inventory-observer.mjs';

// Fixtures are packets recorded from live sessions with an ordinary-player character; the
// character's own name is masked. They check the decoders against what a real server sent.
const load = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/headless/${name}`, import.meta.url)));
const packets = (name) =>
  load(name).packets.map((p) => ({ name: p.name, payload: Buffer.from(p.payload, 'hex') }));

test('recorded login inventory updates decode to a backpack and worn equipment', () => {
  const observer = createInventoryObserver();
  for (const packet of packets('inventory-login.json')) observer.apply(packet);
  assert.deepEqual(
    observer.components().sort((a, b) => a - b),
    [1688, 3214],
  );
  const items = (component) =>
    new Map(
      observer
        .get(component)
        .filter((s) => s.item !== null)
        .map((s) => [s.item, s.count]),
    );
  const backpack = items(3214);
  assert.equal(backpack.size, 12);
  assert.equal(backpack.get(882), 24);
  assert.equal(backpack.get(1351), 1);
  const worn = items(1688);
  assert.equal(worn.size, 2);
  assert.equal(worn.get(1277), 1);
  assert.equal(worn.get(1171), 1);
});

test('a recorded conversation with a choice menu replays as the same dialogue events', () => {
  const components = new Map(load('dialogue-interfaces.json').components.map((c) => [c.id, c]));
  const observer = createDialogueObserver(components);
  const events = packets('hans-dialogue.json')
    .map((packet) => observer.apply(packet))
    .filter((event) => event && event.type !== 'buffered-text');
  assert.deepEqual(
    events.map((e) => (e.type === 'opened' ? e.id : e.type)),
    [4882, 2469, 968, 4882, 'closed'],
  );
  assert.deepEqual(events[0].texts, ['Hans', 'Hello. What are you doing here?']);
  assert.deepEqual(events[0].continueButtons, [4886]);
  assert.equal(events[1].continueButtons.length, 0);
  assert.deepEqual(
    events[1].choices.map((c) => c.component),
    [2471, 2472, 2473],
  );
  assert.equal(events[1].choices[0].text, "I'm looking for whoever is in charge of this place.");
  assert.equal(events[2].texts[0], '####');
  assert.equal(events[4].hadChat, true);
});
