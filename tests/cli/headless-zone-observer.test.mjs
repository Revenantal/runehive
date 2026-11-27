import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZoneObserver } from '../../tools/headless-experiment/zone-observer.mjs';
import { PacketStream } from '../../tools/headless-experiment/packets.mjs';

const packet = (name, values) => ({ name, payload: Buffer.from(values) });
const observer = () => createZoneObserver({ baseX: 3000, baseZ: 3100, level: 0 });

test('decodes location updates sent individually after zone header', () => {
  const zone = observer();
  assert.deepEqual(zone.apply(packet('UPDATE_ZONE_PARTIAL_FOLLOWS', [8, 16])), []);
  assert.deepEqual(zone.apply(packet('LOC_ADD_CHANGE', [0x23, 41, 0x12, 0x34])), [
    { kind: 'add-change', level: 0, x: 3010, z: 3119, shape: 10, rotation: 1, id: 0x1234 },
  ]);
  assert.deepEqual(zone.apply(packet('LOC_DEL', [0x23, 41])), [
    { kind: 'remove', level: 0, x: 3010, z: 3119, shape: 10, rotation: 1 },
  ]);
});

test('decodes enclosed operations while skipping known non-location updates', () => {
  const zone = observer();
  const events = zone.apply(
    packet(
      'UPDATE_ZONE_PARTIAL_ENCLOSED',
      [8, 16, 52, 0, 0, 1, 138, 0x23, 40, 0, 5, 173, 0x23, 40],
    ),
  );
  assert.deepEqual(
    events.map((e) => e.kind),
    ['add-change', 'remove'],
  );
  assert.equal(events[0].id, 5);
});

test('rejects missing zone, truncated operations, unknown opcode and invalid shape', () => {
  const zone = observer();
  assert.throws(() => zone.apply(packet('LOC_DEL', [0, 0])), /UNKNOWN_ZONE_ORIGIN/);
  assert.throws(
    () => zone.apply(packet('UPDATE_ZONE_PARTIAL_ENCLOSED', [1, 1, 138, 0])),
    /INVALID_ENCLOSED/,
  );
  assert.throws(
    () => zone.apply(packet('UPDATE_ZONE_PARTIAL_ENCLOSED', [1, 1, 255])),
    /INVALID_ENCLOSED/,
  );
  zone.apply(packet('UPDATE_ZONE_PARTIAL_FOLLOWS', [8, 16]));
  assert.throws(() => zone.apply(packet('LOC_DEL', [0, 255])), /INVALID_LOCATION_SHAPE/);
  assert.equal(zone.apply(packet('UPDATE_ZONE_FULL_FOLLOWS', [8, 16]))[0].kind, 'zone-reset');
  assert.equal(zone.apply(packet('REBUILD_NORMAL', [0, 0, 0, 0]))[0].kind, 'rebuild-required');
});

test('packet stream recognizes standalone zone operations', () => {
  const stream = new PacketStream({
    get nextInt() {
      return 0;
    },
  });
  const packets = stream.push(Buffer.from([138, 0, 40, 0, 5, 173, 0, 40]));
  assert.deepEqual(
    packets.map((p) => p.name),
    ['LOC_ADD_CHANGE', 'LOC_DEL'],
  );
  assert.equal(stream.broken, null);
});
