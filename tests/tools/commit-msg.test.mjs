import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateCommitMessage } from '../../tools/check-commit-msg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('accepts Conventional Commits headers, with scope, breaking marker, and body', () => {
  for (const message of [
    'feat: add init command',
    'fix(cli): keep local edits on rerun',
    'docs!: move system docs',
    'chore(deps): bump eslint\n\nWhy this matters.\n\nBREAKING CHANGE: none',
    'Merge branch "x"',
    'Revert "feat: add init command"',
  ]) {
    assert.deepEqual(validateCommitMessage(message), [], message);
  }
});

test('rejects headers that are not Conventional Commits', () => {
  for (const message of [
    'Add init command',
    'feature: add init command',
    'feat add init command',
    'feat:no space',
    'feat(Bad Scope): x',
    '',
  ]) {
    assert.ok(validateCommitMessage(message).length > 0, JSON.stringify(message));
  }
});

test('rejects a header over 72 characters and a missing blank line before the body', () => {
  assert.match(validateCommitMessage(`feat: ${'x'.repeat(70)}`).join(), /keep it to 72/);
  assert.match(validateCommitMessage('feat: ok\nbody right away').join(), /blank line/);
});

test('rejects co-author trailers and tool attribution', () => {
  for (const message of [
    'feat: x\n\nCo-authored-by: Someone <a@example.com>',
    'feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    'feat: x\n\nGenerated with a tool',
    'feat: x\n\n🤖',
  ]) {
    assert.ok(validateCommitMessage(message).length > 0, message);
  }
});

test('ignores comment lines that Git adds to the message file', () => {
  assert.deepEqual(validateCommitMessage('feat: x\n# Please enter the commit message'), []);
});

test('the CLI exits 0 for a good message and 1 for a bad one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'commit-msg-'));
  try {
    const file = path.join(dir, 'MSG');
    const run = (text) => {
      writeFileSync(file, text);
      return spawnSync(process.execPath, ['tools/check-commit-msg.mjs', file], {
        cwd: root,
        encoding: 'utf8',
      });
    };
    assert.equal(run('feat: ok\n').status, 0);
    const bad = run('did stuff\n');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /header must be/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Git hooks are tracked and executable', () => {
  for (const hook of ['pre-commit', 'pre-push', 'commit-msg']) {
    const mode = statSync(path.join(root, '.githooks', hook)).mode;
    assert.ok((mode & 0o111) !== 0, `${hook} is not executable`);
  }
});
