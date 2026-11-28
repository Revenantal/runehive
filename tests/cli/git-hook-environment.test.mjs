import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const initTests = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'init.test.mjs');
const ID = [
  // Detached background maintenance would be orphaned and, on a host whose PID 1 does not reap, leak a zombie.
  '-c',
  'maintenance.auto=false',
  '-c',
  'user.name=Test',
  '-c',
  'user.email=test@example.invalid',
  '-c',
  'commit.gpgsign=false',
];

/** Runs git in a directory with a minimal environment so the decoy is inspected, not redirected. */
function git(cwd, ...args) {
  const { PATH } = process.env;
  return execFileSync('git', [...ID, ...args], { cwd, encoding: 'utf8', env: { PATH } }).trim();
}

/** Drops the runner marker so the nested `node --test` actually executes the suite. */
function withoutTestContext(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
}

test('init tests ignore GIT_* variables that Git hooks export', (t) => {
  const decoy = mkdtempSync(path.join(tmpdir(), 'runehive-decoy-'));
  t.after(() => rmSync(decoy, { recursive: true, force: true }));
  git(decoy, 'init', '--quiet', '--initial-branch=main');
  git(decoy, 'commit', '--quiet', '--allow-empty', '-m', 'decoy');
  const before = {
    head: git(decoy, 'rev-parse', 'HEAD'),
    bare: git(decoy, 'config', '--local', 'core.bare'),
    refs: git(decoy, 'for-each-ref'),
  };
  const gitDir = path.join(decoy, '.git');
  const result = spawnSync(process.execPath, ['--test', initTests], {
    encoding: 'utf8',
    env: {
      ...withoutTestContext(process.env),
      GIT_DIR: gitDir,
      GIT_WORK_TREE: decoy,
      GIT_INDEX_FILE: path.join(gitDir, 'index'),
    },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(decoy, 'rev-parse', 'HEAD'), before.head);
  assert.equal(git(decoy, 'config', '--local', 'core.bare'), before.bare);
  assert.equal(git(decoy, 'for-each-ref'), before.refs);
  assert.equal(git(decoy, 'rev-list', '--count', 'HEAD'), '1');
});
