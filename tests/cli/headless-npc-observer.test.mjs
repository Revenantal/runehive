import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNpcObserver } from '../../tools/headless-experiment/npc-observer.mjs';

function packet(fields) {
  let bits = fields.map(([v, n]) => v.toString(2).padStart(n, '0')).join('');
  bits += '0'.repeat((8 - (bits.length % 8)) % 8);
  return Buffer.from(bits.match(/.{8}/g).map((v) => parseInt(v, 2)));
}

test('adds a nearby NPC from client-visible fields and tracks its movement', () => {
  const o = createNpcObserver();
  const added = packet([
    [0, 8],
    [42, 14],
    [17, 11],
    [31, 5],
    [2, 5],
    [0, 1],
    [0, 1],
    [16383, 14],
  ]);
  assert.deepEqual(o.apply(added, { x: 100, z: 200, level: 0 }), [
    { index: 42, typeId: 17, x: 99, z: 202, level: 0, attributesUnverified: false },
  ]);
  const moved = packet([
    [1, 8],
    [1, 1],
    [1, 2],
    [4, 3],
    [0, 1],
  ]);
  assert.equal(o.apply(moved, { x: 100, z: 200, level: 0 })[0].x, 100);
  assert.deepEqual(o.apply(packet([[0, 8]]), null), []);
});

test('does not invent position or verify undecoded attributes', () => {
  const o = createNpcObserver();
  const added = packet([
    [0, 8],
    [9, 14],
    [10, 11],
    [0, 5],
    [0, 5],
    [0, 1],
    [1, 1],
    [16383, 14],
    [0, 8],
  ]);
  const [npc] = o.apply(added, null);
  assert.equal(npc.x, null);
  assert.equal(npc.attributesUnverified, true);
});

test('rejects out-of-sync and truncated packets without corrupting previous state', () => {
  const o = createNpcObserver();
  const added = packet([
    [0, 8],
    [42, 14],
    [17, 11],
    [0, 5],
    [0, 5],
    [0, 1],
    [0, 1],
    [16383, 14],
  ]);
  o.apply(added, { x: 100, z: 200, level: 0 });
  assert.throws(() => o.apply(packet([[2, 8]]), null), /NPC_VISIBILITY_OUT_OF_SYNC/);
  assert.throws(() => o.apply(Buffer.from([1]), null), /PACKET_TRUNCATED/);
  assert.equal(
    o.apply(
      packet([
        [1, 8],
        [0, 1],
      ]),
      null,
    )[0].index,
    42,
  );
  o.reset();
  assert.throws(() => o.apply(packet([[1, 8]]), null), /NPC_VISIBILITY_OUT_OF_SYNC/);
});
