import { readFileSync } from 'node:fs';
import { decodeNpcDefinition } from '../npc-definitions.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';
import { decodeInterfaces } from '../interface-components.mjs';

// Usage: node validate-config.mjs <directory written by fetch-config-assets.py>
const directory = process.argv[2];
if (!directory) throw new Error('CONFIG_DIRECTORY_REQUIRED');
const read = (name) => readFileSync(`${directory}/${name}`);
const failures = {};
/** Decodes every record of one definition kind and tallies results without stopping at errors. */
function sweep(kind, idx, dat, decode) {
  const count = (idx[0] << 8) | idx[1];
  const summary = { count, decoded: 0, unnamed: 0, errors: {} };
  for (let id = 0; id < count; id++) {
    try {
      const definition = decode(idx, dat, id);
      summary.decoded++;
      if (definition.name === null || definition.name === undefined) summary.unnamed++;
    } catch (error) {
      summary.errors[error.message] = (summary.errors[error.message] ?? 0) + 1;
    }
  }
  failures[kind] = summary;
  return summary;
}
const objects = sweep('objects', read('obj.idx'), read('obj.dat'), decodeObjectDefinition);
sweep('npcs', read('npc.idx'), read('npc.dat'), decodeNpcDefinition);
sweep('locations', read('loc.idx'), read('loc.dat'), (i, d, id) =>
  decodeLocationDefinition(i, d, id, { includeText: true }),
);
let interfaces;
try {
  interfaces = { components: decodeInterfaces(read('interface.dat')).size };
} catch (error) {
  interfaces = { error: error.message };
}
// Option text found by definition, to show which action words exist in this revision's items.
const optionWords = new Map();
const idx = read('obj.idx'),
  dat = read('obj.dat');
for (let id = 0; id < objects.count; id++) {
  try {
    for (const text of decodeObjectDefinition(idx, dat, id).inventoryOptions)
      if (text) optionWords.set(text, (optionWords.get(text) ?? 0) + 1);
  } catch {
    // Already counted by the sweep above.
  }
}
console.log(
  JSON.stringify(
    { ...failures, interfaces, itemInventoryOptions: Object.fromEntries(optionWords) },
    null,
    1,
  ),
);
const bad = Object.values(failures).some((s) => Object.keys(s.errors).length) || interfaces.error;
if (bad) process.exitCode = 1;
