import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCollisionFreshness } from '../../tools/headless-experiment/collision-freshness.mjs';

test('static archives alone cannot establish a current snapshot', () => {
  const guard = createCollisionFreshness();
  assert.equal(guard.commitCapture(guard.beginCapture()), null);
  assert.equal(guard.commitCapture({}, { dynamicSceneReconciled: true }), null);
});

test('each relevant change invalidates both in-flight capture and committed snapshots', () => {
  for (const name of [
    'REBUILD_NORMAL',
    'UPDATE_ZONE_FULL_FOLLOWS',
    'UPDATE_ZONE_PARTIAL_FOLLOWS',
    'UPDATE_ZONE_PARTIAL_ENCLOSED',
    'LOC_ADD_CHANGE',
    'LOC_DEL',
    'P_LOCMERGE',
    'LOC_ANIM',
  ]) {
    const guard = createCollisionFreshness();
    const current = guard.commitCapture(guard.beginCapture(), { dynamicSceneReconciled: true });
    const pending = guard.beginCapture();
    guard.onPacket({ name });
    assert.equal(current.isCurrent(), false, name);
    assert.equal(guard.commitCapture(pending, { dynamicSceneReconciled: true }), null, name);
  }
});

test('framing failure and disconnect invalidate snapshots while unrelated packets do not', () => {
  const guard = createCollisionFreshness();
  const snapshot = guard.commitCapture(guard.beginCapture(), { dynamicSceneReconciled: true });
  guard.onPacket({ name: 'PLAYER_INFO' });
  assert.equal(snapshot.isCurrent(), true);
  guard.onPacket({ broken: { reason: 'unknown-opcode' } });
  assert.equal(snapshot.isCurrent(), false);
  assert.equal(guard.commitCapture(guard.beginCapture(), { dynamicSceneReconciled: true }), null);
  const other = createCollisionFreshness();
  const next = other.commitCapture(other.beginCapture(), { dynamicSceneReconciled: true });
  other.invalidate();
  assert.equal(next.isCurrent(), false);
  other.disconnect();
  assert.equal(other.commitCapture(other.beginCapture(), { dynamicSceneReconciled: true }), null);
});
