import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicChatObserver } from '../../tools/headless-experiment/public-chat-observer.mjs';

function bits(values) {
  let s = '';
  for (const [value, width] of values) s += value.toString(2).padStart(width, '0');
  s = s.padEnd(Math.ceil(s.length / 8) * 8, '0');
  return Buffer.from(s.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
}

test('extracts remote chat after tracking a new player', () => {
  const observer = createPublicChatObserver();
  const added = bits([
    [0, 1],
    [0, 8],
    [42, 11],
    [0, 5],
    [0, 5],
    [0, 1],
    [0, 1],
    [2047, 11],
  ]);
  assert.deepEqual(observer.apply(added), []);
  const existing = bits([
    [0, 1],
    [1, 8],
    [1, 1],
    [0, 2],
    [2047, 11],
  ]);
  const payload = Buffer.concat([existing, Buffer.from([0x40, 0, 0, 0, 3, 0x61, 0xbb, 0x40])]);
  const [message] = observer.apply(payload);
  assert.equal(message.source, 'remote');
  assert.deepEqual([...message.packed], [0x61, 0xbb, 0x40]);
});

test('extracts local chat and rejects a truncated update atomically', () => {
  const observer = createPublicChatObserver();
  const local = bits([
    [1, 1],
    [0, 2],
    [0, 8],
    [2047, 11],
  ]);
  assert.throws(() => observer.apply(Buffer.concat([local, Buffer.from([0x40, 0])])), /TRUNCATED/);
  const [message] = observer.apply(Buffer.concat([local, Buffer.from([0x40, 0, 0, 0, 1, 0x10])]));
  assert.equal(message.source, 'local');
});
