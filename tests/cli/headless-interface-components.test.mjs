import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeInterfaces,
  findContinueButtons,
} from '../../tools/headless-experiment/interface-components.mjs';

const u16 = (n) => [n >> 8, n & 255];
const text = (value) => [...Buffer.from(`${value}\n`, 'latin1')];
const header = (id, type, button) => [
  ...u16(id),
  type,
  button,
  ...u16(0),
  ...u16(10),
  ...u16(10),
  0, // transparency
  0, // over layer
  0, // script comparators
  0, // scripts
];

/** Builds a root layer containing one text component with a continue button. */
function sample() {
  return Uint8Array.from([
    ...u16(2),
    ...u16(65535),
    ...u16(0),
    ...header(0, 0, 0),
    ...u16(0),
    0,
    ...u16(1),
    ...u16(1),
    ...u16(0),
    ...u16(0),
    ...header(1, 4, 6),
    0,
    1,
    0,
    ...text('Hello'),
    ...text(''),
    ...Array(16).fill(0),
    ...text('Continue'),
  ]);
}

test('decodes layer children, text and continue buttons', () => {
  const components = decodeInterfaces(sample());
  assert.deepEqual(components.get(0).children, [1]);
  assert.equal(components.get(1).text, 'Hello');
  assert.equal(components.get(1).buttonText, 'Continue');
  assert.deepEqual(findContinueButtons(components, 0), [1]);
});

test('rejects truncated and malformed interface data', () => {
  assert.throws(() => decodeInterfaces(sample().subarray(0, 30)), /TRUNCATED_INTERFACE_DATA/);
  assert.throws(() => decodeInterfaces(new Uint8Array(1)), /INVALID_INTERFACE_DATA/);
});
