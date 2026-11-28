import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDialogueObserver } from '../../tools/headless-experiment/dialogue-observer.mjs';
import { findContinueButtons } from '../../tools/headless-experiment/interface-components.mjs';

const components = new Map([
  [10, { id: 10, layerId: 10, type: 0, buttonType: 0, children: [11, 12], text: null }],
  [11, { id: 11, layerId: 10, type: 4, buttonType: 0, children: [], text: '' }],
  [12, { id: 12, layerId: 10, type: 4, buttonType: 6, children: [], text: '' }],
  [20, { id: 20, layerId: 20, type: 0, buttonType: 0, children: [21], text: null }],
  [21, { id: 21, layerId: 20, type: 4, buttonType: 1, children: [], text: '' }],
]);
const packet = (name, ...bytes) => ({ name, payload: Uint8Array.from(bytes) });

test('finds continue buttons only below the requested root', () => {
  assert.deepEqual(findContinueButtons(components, 10), [12]);
  assert.deepEqual(findContinueButtons(components, 20), []);
});

test('tracks an open chat, its text and its close', () => {
  const observer = createDialogueObserver(components);
  assert.deepEqual(observer.apply(packet('IF_SETTEXT', 0, 12, 66, 10)), {
    type: 'buffered-text',
    component: 12,
  });
  assert.deepEqual(observer.apply(packet('IF_OPENCHAT', 0, 10)), {
    type: 'opened',
    id: 10,
    known: true,
    continueButtons: [12],
    texts: ['B'],
    choices: [],
  });
  assert.deepEqual(observer.apply(packet('IF_SETTEXT', 0, 11, 72, 105, 10)), {
    type: 'text',
    component: 11,
    text: 'Hi',
  });
  assert.deepEqual(observer.apply(packet('IF_SETTEXT', 0, 99, 88, 10)), {
    type: 'buffered-text',
    component: 99,
  });
  assert.deepEqual(observer.current(), { id: 10, continueButtons: [12], texts: ['B', 'Hi'] });
  assert.deepEqual(observer.apply(packet('IF_CLOSE')), { type: 'closed', hadChat: true });
  assert.equal(observer.current(), null);
  assert.equal(observer.apply(packet('MESSAGE_GAME')), null);
});

test('unknown interfaces are reported, not guessed, and malformed packets fail', () => {
  const observer = createDialogueObserver(components);
  assert.deepEqual(observer.apply(packet('IF_OPENCHAT', 3, 232)), {
    type: 'opened',
    id: 1000,
    known: false,
  });
  assert.equal(observer.current(), null);
  assert.throws(() => observer.apply(packet('IF_OPENCHAT', 1)), /INVALID_CHAT_PACKET/);
  assert.throws(() => observer.apply(packet('IF_SETTEXT', 1)), /INVALID_TEXT_PACKET/);
});

test('reports a choice menu only when every button has server text', () => {
  const complete = createDialogueObserver(components);
  complete.apply(packet('IF_SETTEXT', 0, 21, 89, 101, 115, 10));
  const opened = complete.apply(packet('IF_OPENCHAT', 0, 20));
  assert.deepEqual(opened.choices, [{ component: 21, text: 'Yes' }]);
  const missing = createDialogueObserver(components);
  assert.equal(missing.apply(packet('IF_OPENCHAT', 0, 20)).choices, 'incomplete');
});
