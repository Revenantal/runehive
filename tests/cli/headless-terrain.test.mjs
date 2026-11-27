import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeTerrain, terrainGroundBlocks } from '../../tools/headless-experiment/terrain.mjs';

const PLANE = 64 * 64;
const TILES = 4 * PLANE;

/** Builds synthetic ground data with selected per-tile opcode sequences. */
function terrain(entries = new Map()) {
  return Buffer.concat(Array.from({ length: TILES }, (_, i) => Buffer.from(entries.get(i) ?? [0])));
}

test('decodes flags with overlays, underlays, and explicit heights', () => {
  const flags = decodeTerrain(terrain(new Map([[1, [2, 255, 50, 82, 1, 7]]])));
  assert.equal(flags.length, TILES);
  assert.equal(flags[0], 0);
  assert.equal(flags[1], 1);
  assert.equal(flags[2], 0);
});

test('ground collision applies link-below to the effective level', () => {
  const tile = 71;
  const flags = decodeTerrain(
    terrain(
      new Map([
        [tile, [50, 0]],
        [PLANE + tile, [51, 0]],
        [2 * PLANE + tile, [50, 0]],
      ]),
    ),
  );
  const blocks = terrainGroundBlocks(flags);
  assert.equal(blocks[tile], 0); // Level-zero block moves below the map.
  assert.equal(blocks[PLANE + tile], 1); // Level-two block moves down to level one.
  assert.equal(blocks[2 * PLANE + tile], 0);
});

test('rejects truncated, trailing and invalid inputs rather than treating them as open', () => {
  assert.throws(() => decodeTerrain(Buffer.alloc(TILES - 1)), /TRUNCATED_TERRAIN/);
  assert.throws(
    () => decodeTerrain(Buffer.concat([terrain(), Buffer.from([0])])),
    /TRAILING_TERRAIN/,
  );
  assert.throws(() => decodeTerrain('not bytes'), /INVALID_TERRAIN/);
  assert.throws(() => terrainGroundBlocks(Buffer.alloc(1)), /INVALID_TERRAIN_FLAGS/);
});
