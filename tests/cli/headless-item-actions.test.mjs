import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  examineText,
  listGroundActions,
  listItemActions,
  numberOptions,
} from '../../tools/headless-experiment/item-actions.mjs';

const backpack = { objectOptions: true, objectUse: true, options: [] };
const worn = {
  objectOptions: false,
  objectUse: false,
  options: ['Remove', null, null, null, null],
};
const definition = (inventoryOptions) => ({ name: 'Thing', inventoryOptions });

test('item actions follow the client menu, including the default Drop and Use', () => {
  const actions = listItemActions({
    definition: definition([null, 'Wield', null, null, null]),
    component: backpack,
  });
  assert.deepEqual(
    actions.map((a) => [a.label, a.kind, a.option, a.source]),
    [
      ['Wield', 'held', 2, 'item'],
      ['Drop', 'held', 5, 'client'],
      ['Use', 'use', null, 'client'],
      ['Examine', 'examine', null, 'client'],
    ],
  );
});

test('unusual options at positions four and five replace the default Drop', () => {
  const actions = listItemActions({
    definition: definition(['Rub', null, null, 'Empty', 'Move']),
    component: backpack,
  });
  assert.deepEqual(
    actions.filter((a) => a.kind === 'held').map((a) => [a.label, a.option]),
    [
      ['Rub', 1],
      ['Empty', 4],
      ['Move', 5],
    ],
  );
  assert.equal(
    actions.some((a) => a.label === 'Drop'),
    false,
  );
});

test('worn components offer their own options and no item options', () => {
  const actions = listItemActions({
    definition: definition(['Wield', null, null, null, null]),
    component: worn,
  });
  assert.deepEqual(
    actions.map((a) => [a.label, a.kind, a.option]),
    [
      ['Remove', 'button', 1],
      ['Examine', 'examine', null],
    ],
  );
});

test('examine uses the description, a fallback, or a large-stack count', () => {
  assert.equal(examineText({ name: 'Net', description: 'For fishing.' }), 'For fishing.');
  assert.equal(examineText({ name: 'Net', description: null }), "It's a Net.");
  assert.equal(
    examineText({ name: 'Coins', description: 'Money.', count: 100000 }),
    '100000 x Coins',
  );
});

test('numbered options keep their protocol positions', () => {
  assert.deepEqual(numberOptions(['Talk to', null, 'Trade', null, null]), [
    { label: 'Talk to', option: 1 },
    { label: 'Trade', option: 3 },
  ]);
});

test('ground items offer a client-supplied Take unless the item defines option three', () => {
  const logs = { name: 'Logs', options: [null, null, null, 'Light', null] };
  assert.deepEqual(
    listGroundActions({ definition: logs }).map((a) => [a.label, a.option, a.source]),
    [
      ['Take', 3, 'client'],
      ['Light', 4, 'item'],
      ['Examine', null, 'client'],
    ],
  );
  const custom = { name: 'Odd', options: [null, null, 'Grab', null, null] };
  assert.deepEqual(
    listGroundActions({ definition: custom }).map((a) => [a.label, a.option]),
    [
      ['Grab', 3],
      ['Examine', null],
    ],
  );
});
