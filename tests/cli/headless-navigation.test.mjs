import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildConservativeGrid,
  findConservativeRoute,
} from '../../tools/headless-experiment/navigation.mjs';

const flags = () => new Uint8Array(4 * 64 * 64);
const def = { width: 1, length: 2, blockwalk: true };

test('route bends around a blocked object and never crosses a region edge', () => {
  const map = buildConservativeGrid(
    flags(),
    [{ id: 5, level: 0, x: 4, z: 4, shape: 10, rotation: 0 }],
    new Map([[5, def]]),
  );
  const route = findConservativeRoute(map, { x: 3, z: 4 }, { x: 5, z: 4 });
  assert.ok(route.length > 2);
  assert.deepEqual(route.at(-1), { x: 5, z: 4 });
  assert.ok(route.every((p) => map.blocked[p.x * 64 + p.z] === 0));
  assert.equal(findConservativeRoute(map, { x: 3, z: 4 }, { x: 0, z: 4 }), null);
});

test('diagonal walls leave cardinal cells clear and rotated footprints swap dimensions', () => {
  const placements = [
    { id: 5, level: 0, x: 10, z: 10, shape: 1, rotation: 0 },
    { id: 5, level: 0, x: 20, z: 20, shape: 10, rotation: 1 },
  ];
  const map = buildConservativeGrid(flags(), placements, new Map([[5, def]]));
  assert.equal(map.blocked[9 * 64 + 9], 0);
  assert.equal(map.blocked[21 * 64 + 20], 1);
  assert.equal(map.blocked[20 * 64 + 21], 0);
});

test('missing definitions fail closed and no path is not proof of game blockage', () => {
  assert.throws(
    () =>
      buildConservativeGrid(
        flags(),
        [{ id: 5, level: 0, x: 4, z: 4, shape: 10, rotation: 0 }],
        new Map(),
      ),
    /UNKNOWN_LOCATION_DEFINITION/,
  );
  const map = { blocked: new Uint8Array(64 * 64).fill(1), edges: new Uint8Array(64 * 64) };
  assert.equal(findConservativeRoute(map, { x: 2, z: 2 }, { x: 3, z: 3 }), null);
});

test('inactive ground decorations do not block, while unknown activity fails closed', () => {
  const placement = { id: 5, level: 0, x: 4, z: 4, shape: 22, rotation: 0 };
  const inactive = buildConservativeGrid(
    flags(),
    [placement],
    new Map([[5, { ...def, active: false }]]),
  );
  assert.equal(inactive.blocked[4 * 64 + 4], 0);
  const active = buildConservativeGrid(
    flags(),
    [placement],
    new Map([[5, { ...def, active: true }]]),
  );
  assert.equal(active.blocked[4 * 64 + 4], 1);
  assert.throws(
    () => buildConservativeGrid(flags(), [placement], new Map([[5, def]])),
    /UNKNOWN_LOCATION_DEFINITION/,
  );
});

test('straight walls block their shared edge in both directions for each rotation', () => {
  const offsets = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];
  for (let rotation = 0; rotation < 4; rotation++) {
    const map = buildConservativeGrid(
      flags(),
      [{ id: 5, level: 0, x: 10, z: 10, shape: 0, rotation }],
      new Map([[5, def]]),
    );
    const [dx, dz] = offsets[rotation];
    const a = { x: 10, z: 10 },
      b = { x: 10 + dx, z: 10 + dz };
    assert.equal(findConservativeRoute(map, a, b).length, 3);
    assert.equal(findConservativeRoute(map, b, a).length, 3);
  }
});

test('L walls block both adjacent edges without blocking the tile', () => {
  const map = buildConservativeGrid(
    flags(),
    [{ id: 5, level: 0, x: 10, z: 10, shape: 2, rotation: 0 }],
    new Map([[5, def]]),
  );
  assert.equal(map.blocked[10 * 64 + 10], 0);
  assert.ok(map.edges[10 * 64 + 10] & 1);
  assert.ok(map.edges[10 * 64 + 10] & 2);
  assert.ok(map.edges[9 * 64 + 10] & 4);
  assert.ok(map.edges[10 * 64 + 11] & 8);
});

test('route compression keeps only the corners and rejects non-cardinal steps', async () => {
  const { compressRoute } = await import('../../tools/headless-experiment/navigation.mjs');
  const start = { x: 0, z: 0 };
  const route = [
    { x: 1, z: 0 },
    { x: 2, z: 0 },
    { x: 3, z: 0 },
    { x: 3, z: 1 },
    { x: 3, z: 2 },
    { x: 4, z: 2 },
  ];
  assert.deepEqual(compressRoute(start, route), [
    { x: 3, z: 0 },
    { x: 3, z: 2 },
    { x: 4, z: 2 },
  ]);
  assert.deepEqual(compressRoute(start, []), []);
  assert.throws(() => compressRoute(start, [{ x: 1, z: 1 }]), /ROUTE_STEP_NOT_CARDINAL/);
  assert.throws(() => compressRoute(start, [{ x: 'a', z: 0 }]), /INVALID_ROUTE_POINT/);
});
