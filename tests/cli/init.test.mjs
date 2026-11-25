import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tools',
  'runehive.mjs',
);
const GIT_ID = [
  '-c',
  'user.name=Test',
  '-c',
  'user.email=test@example.invalid',
  '-c',
  'commit.gpgsign=false',
];

/** Returns the environment without GIT_* variables, which Git hooks set and which redirect git commands. */
function cleanGitEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
}

function git(cwd, ...args) {
  return execFileSync('git', [...GIT_ID, ...args], {
    cwd,
    encoding: 'utf8',
    env: cleanGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Create a one-commit upstream fixture on branch "274" and return its URL and commit. */
function makeUpstream(dir, name) {
  const repo = path.join(dir, `upstream-${name}`);
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '--quiet', '--initial-branch=274');
  writeFileSync(path.join(repo, 'README.md'), `${name}\n`);
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'fixture');
  return { url: repo, commit: git(repo, 'rev-parse', 'HEAD') };
}

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: cleanGitEnv(),
  });
  return { code: result.status, out: result.stdout + result.stderr };
}

describe('runehive init', () => {
  let base;
  let root;
  let manifestPath;
  let upstreams;

  const lostcity = (...p) => path.join(root, 'lostcity', ...p);
  const init = () => run(['init', '--root', root, '--manifest', manifestPath]);

  before(() => {
    base = mkdtempSync(path.join(tmpdir(), 'runehive-test-'));
  });
  after(() => rmSync(base, { recursive: true, force: true }));

  // Fresh root, manifest, and upstream fixtures for every test.
  let counter = 0;
  function fresh() {
    const dir = path.join(base, `case-${counter++}`);
    root = path.join(dir, 'project');
    mkdirSync(root, { recursive: true });
    upstreams = { engine: makeUpstream(dir, 'engine'), content: makeUpstream(dir, 'content') };
    manifestPath = path.join(dir, 'sources.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({
        destination: 'lostcity',
        components: ['engine', 'content'].map((name) => ({
          name,
          url: upstreams[name].url,
          branch: '274',
          commit: upstreams[name].commit,
          path: name,
        })),
      }),
    );
  }

  test('fresh run fetches every component at its pinned commit and prints paths and commits', () => {
    fresh();
    const { code, out } = init();
    assert.equal(code, 0, out);
    for (const name of ['engine', 'content']) {
      assert.equal(git(lostcity(name), 'rev-parse', 'HEAD'), upstreams[name].commit);
      assert.match(out, new RegExp(`\\[fetched\\].*${name}.*${upstreams[name].commit}`));
    }
    assert.ok(out.includes(`LostCity destination: ${lostcity()}`));
  });

  test('second run reuses matching checkouts', () => {
    fresh();
    assert.equal(init().code, 0);
    const marker = path.join(lostcity('engine'), '.git', 'marker');
    writeFileSync(marker, 'still here');
    const { code, out } = init();
    assert.equal(code, 0, out);
    assert.equal((out.match(/\[ok\]/g) ?? []).length, 2);
    assert.ok(existsSync(marker), 'existing checkout was replaced');
  });

  test('local edits are reported and preserved', () => {
    fresh();
    init();
    writeFileSync(lostcity('engine', 'README.md'), 'my local work\n');
    writeFileSync(lostcity('engine', 'new-file.txt'), 'untracked\n');
    const { code, out } = init();
    assert.equal(code, 1);
    assert.match(out, /\[local-edits\].*engine/);
    assert.equal(readFileSync(lostcity('engine', 'README.md'), 'utf8'), 'my local work\n');
    assert.ok(existsSync(lostcity('engine', 'new-file.txt')));
  });

  test('a changed commit pin is reported and the checkout is left alone', () => {
    fresh();
    init();
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.components[0].commit = 'f'.repeat(40);
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const { code, out } = init();
    assert.equal(code, 1);
    assert.match(out, /\[commit-mismatch\].*engine/);
    assert.equal(git(lostcity('engine'), 'rev-parse', 'HEAD'), upstreams.engine.commit);
  });

  test('an unexpected origin is reported and preserved', () => {
    fresh();
    init();
    git(lostcity('engine'), 'remote', 'set-url', 'origin', 'https://example.invalid/other.git');
    const { code, out } = init();
    assert.equal(code, 1);
    assert.match(out, /\[wrong-origin\].*engine/);
    assert.equal(
      git(lostcity('engine'), 'remote', 'get-url', 'origin'),
      'https://example.invalid/other.git',
    );
  });

  test('an occupied non-Git path is reported and preserved while other components still fetch', () => {
    fresh();
    mkdirSync(lostcity('engine'), { recursive: true });
    writeFileSync(lostcity('engine', 'mine.txt'), 'keep me\n');
    const { code, out } = init();
    assert.equal(code, 1);
    assert.match(out, /\[occupied\].*engine/);
    assert.ok(existsSync(lostcity('engine', 'mine.txt')));
    assert.equal(git(lostcity('content'), 'rev-parse', 'HEAD'), upstreams.content.commit);
  });

  test('an empty directory at a component path is filled in', () => {
    fresh();
    mkdirSync(lostcity('engine'), { recursive: true });
    const { code, out } = init();
    assert.equal(code, 0, out);
    assert.equal(git(lostcity('engine'), 'rev-parse', 'HEAD'), upstreams.engine.commit);
  });

  test('a failed fetch leaves finished checkouts usable, leaves no partial directory, and resumes next run', () => {
    fresh();
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const goodUrl = manifest.components[0].url;
    manifest.components[0].url = path.join(base, 'does-not-exist');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const first = init();
    assert.equal(first.code, 1);
    assert.match(first.out, /\[failed\].*engine/);
    assert.equal(git(lostcity('content'), 'rev-parse', 'HEAD'), upstreams.content.commit);
    assert.ok(!existsSync(lostcity('engine')));
    assert.deepEqual(
      execFileSync('ls', [lostcity()], { encoding: 'utf8' }).trim().split('\n').sort(),
      ['content'],
    );

    manifest.components[0].url = goodUrl;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const second = init();
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /\[ok\].*content/);
    assert.match(second.out, /\[fetched\].*engine/);
  });

  test('rejects a manifest with a short commit ID or an escaping path', () => {
    fresh();
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.components[0].commit = 'abc123';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.equal(init().code, 1);
    manifest.components[0].commit = 'a'.repeat(40);
    manifest.components[0].path = '../escape';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const { code, out } = init();
    assert.equal(code, 1);
    assert.match(out, /inside the destination/);
  });

  test('--help prints usage and unknown commands fail', () => {
    const help = run(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.out, /Usage: runehive/);
    assert.equal(run(['nope']).code, 2);
  });
});

describe('committed manifest', () => {
  test('pins full commit IDs and unique, contained paths', () => {
    const manifest = JSON.parse(
      readFileSync(path.resolve(path.dirname(cli), 'lostcity-sources.json'), 'utf8'),
    );
    assert.equal(manifest.destination, 'lostcity');
    const paths = manifest.components.map((c) => c.path);
    assert.equal(new Set(paths).size, paths.length);
    for (const c of manifest.components) assert.match(c.commit, /^[0-9a-f]{40}$/);
  });
});
