import { readFileSync } from 'node:fs';
import { decodeNpcDefinition } from '../npc-definitions.mjs';
import { decodeObjectDefinition } from '../object-definitions.mjs';
import { decodeLocationDefinition } from '../location-definitions.mjs';

// Usage: node survey-definitions.mjs <directory written by fetch-config-assets.py>
const directory = process.argv[2];
if (!directory) throw new Error('CONFIG_DIRECTORY_REQUIRED');
const read = (name) => readFileSync(`${directory}/${name}`);

/** Visits every definition of one kind, skipping records that fail to decode. */
function each(idx, dat, decode, visit) {
  const count = (idx[0] << 8) | idx[1];
  for (let id = 0; id < count; id++) {
    try {
      visit(id, decode(idx, dat, id));
    } catch {
      // The validation script reports decode failures; the survey only needs decodable records.
    }
  }
}
/** Counts how often each text appears in each option position. */
function vocabulary() {
  return new Map();
}
/** Records one option text at one position. */
function tally(map, text, position) {
  if (!map.has(text)) map.set(text, [0, 0, 0, 0, 0]);
  map.get(text)[position]++;
}
/** Flags text that does not look like an ordinary short verb phrase. */
const unusual = (text) =>
  text.length > 24 || /[^A-Za-z \-']/.test(text) || text !== text.trim() || text === '';

const itemInventory = vocabulary(),
  itemGround = vocabulary(),
  npcOptions = vocabulary(),
  locOptions = vocabulary();
const oddItems = [],
  oddNpcs = [],
  oddLocs = [],
  tags = [],
  empty = { inventory: 0, ground: 0 };
const itemShapes = new Map();
each(read('obj.idx'), read('obj.dat'), decodeObjectDefinition, (id, d) => {
  const shape = d.inventoryOptions.map((t) => (t ? 'x' : '.')).join('');
  itemShapes.set(shape, (itemShapes.get(shape) ?? 0) + 1);
  d.inventoryOptions.forEach((t, i) => {
    if (!t) return;
    tally(itemInventory, t, i);
    if (unusual(t))
      oddItems.push({ id, name: d.name, where: 'inventory', position: i + 1, text: t });
  });
  d.options.forEach((t, i) => {
    if (!t) return;
    tally(itemGround, t, i);
    if (unusual(t)) oddItems.push({ id, name: d.name, where: 'ground', position: i + 1, text: t });
  });
  if (d.inventoryOptions.some((t) => t === '')) empty.inventory++;
  for (const field of [d.name, d.description])
    if (field && /@\w{2,4}@|<|>|\\/.test(field)) tags.push({ id, name: d.name, text: field });
});
each(read('npc.idx'), read('npc.dat'), decodeNpcDefinition, (id, d) =>
  d.options.forEach((t, i) => {
    if (!t) return;
    tally(npcOptions, t, i);
    if (unusual(t)) oddNpcs.push({ id, name: d.name, position: i + 1, text: t });
  }),
);
each(
  read('loc.idx'),
  read('loc.dat'),
  (i, d, id) => decodeLocationDefinition(i, d, id, { includeText: true }),
  (id, d) =>
    d.options.forEach((t, i) => {
      if (!t) return;
      tally(locOptions, t, i);
      if (unusual(t)) oddLocs.push({ id, name: d.name, position: i + 1, text: t });
    }),
);
/** Summarizes a vocabulary as text → total and positions, rarest first. */
const summarize = (map) =>
  [...map.entries()]
    .map(([text, positions]) => ({ text, total: positions.reduce((a, b) => a + b, 0), positions }))
    .sort((a, b) => a.total - b.total || a.text.localeCompare(b.text));
console.log(
  JSON.stringify(
    {
      itemInventoryOptionShapes: Object.fromEntries(itemShapes),
      itemInventoryOptions: summarize(itemInventory),
      itemGroundOptions: summarize(itemGround),
      npcOptions: summarize(npcOptions),
      locationOptions: summarize(locOptions),
      unusualText: {
        items: oddItems.slice(0, 40),
        itemCount: oddItems.length,
        npcs: oddNpcs.slice(0, 20),
        npcCount: oddNpcs.length,
        locations: oddLocs.slice(0, 20),
        locationCount: oddLocs.length,
      },
      markupInNamesOrDescriptions: { count: tags.length, samples: tags.slice(0, 8) },
      emptyOptionTexts: empty,
    },
    null,
    1,
  ),
);
