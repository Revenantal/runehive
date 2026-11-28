import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCrossRegionGrid,
  findCrossRegionRoute,
} from '../../tools/headless-experiment/cross-region.mjs';

const region = (z, placements = []) => ({
  x: 3200,
  z,
  terrain: new Uint8Array(4 * 64 * 64),
  placements,
});
const definition = { width: 1, length: 2, blockwalk: true };
const placement = (z, shape, rotation = 0) => ({ id: 1, x: 10, z, level: 0, shape, rotation });
const start = { x: 3210, z: 3263 },
  target = { x: 3210, z: 3264 };
const grid = (south = [], north = []) =>
  buildCrossRegionGrid([region(3200, south), region(3264, north)], new Map([[1, definition]]));

test('routes across an open seam in both directions', () => {
  const map = grid();
  assert.deepEqual(findCrossRegionRoute(map, start, target), [target]);
  assert.deepEqual(findCrossRegionRoute(map, target, start), [start]);
});

test('walls on either side of the seam block the shared edge in both directions', () => {
  for (const map of [grid([placement(63, 0, 1)]), grid([], [placement(0, 0, 3)])]) {
    assert.equal(findCrossRegionRoute(map, start, target).length, 3);
    assert.equal(findCrossRegionRoute(map, target, start).length, 3);
  }
});

test('a southern footprint blocks the northern seam tile', () => {
  const map = grid([placement(63, 10)]);
  assert.equal(findCrossRegionRoute(map, start, target), null);
});

test('northern ground collision and rotated southern footprints affect seam routes', () => {
  const north = region(3264);
  north.terrain[10 * 64] = 1;
  const terrainMap = buildCrossRegionGrid([region(3200), north], new Map());
  assert.equal(findCrossRegionRoute(terrainMap, start, target), null);
  const rotated = { ...placement(63, 10, 1), x: 9 };
  const map = grid([rotated]);
  assert.equal(findCrossRegionRoute(map, start, target), null);
});

test('missing regions or definitions fail closed and outer boundaries stay unavailable', () => {
  assert.throws(() => buildCrossRegionGrid([region(3200)], new Map()), /INVALID_REGIONS/);
  assert.throws(
    () => buildCrossRegionGrid([region(3200), region(3328)], new Map()),
    /INVALID_REGIONS/,
  );
  assert.throws(
    () => buildCrossRegionGrid([region(3200, [placement(63, 10)]), region(3264)], new Map()),
    /UNKNOWN_LOCATION_DEFINITION/,
  );
  assert.equal(findCrossRegionRoute(grid(), { x: 3200, z: 3263 }, target), null);
});
