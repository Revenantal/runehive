import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

function run(root, ...args) {
  const manifest = path.join(root, 'manifest.json');
  const result = spawnSync(
    process.execPath,
    [cli, ...args, '--root', root, '--manifest', manifest],
    { encoding: 'utf8' },
  );
  return { code: result.status, out: result.stdout + result.stderr };
}

describe('runehive start/status/stop', () => {
  let root;

  before(() => {
    root = mkdtempSync(path.join(tmpdir(), 'runehive-svc-'));
    writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify({ destination: 'lostcity', components: [] }),
    );
  });

  after(() => {
    run(root, 'stop');
    rmSync(root, { recursive: true, force: true });
  });

  test('start reports missing sources', () => {
    const result = run(root, 'start');
    assert.equal(result.code, 1);
    assert.match(result.out, /runehive init/);
  });

  test('rejects unknown services', () => {
    const result = run(root, 'start', 'nope');
    assert.equal(result.code, 2);
    assert.match(result.out, /unknown service "nope"/);
  });

  test('starts a fake engine, reports ready, is idempotent, and stops it', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(engine, { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'));
    writeFileSync(
      path.join(engine, 'package.json'),
      JSON.stringify({
        name: 'fake-engine',
        scripts: {
          start:
            'node -e "console.log(\'World ready: Visit http://localhost:1/rs2.cgi\'); setInterval(() => {}, 1000)"',
        },
      }),
    );

    assert.equal(run(root, 'status').code, 1);

    const started = run(root, 'start');
    assert.equal(started.code, 0, started.out);
    assert.match(started.out, /ready\. Open http:\/\/localhost:1\/rs2\.cgi/);

    const status = run(root, 'status', 'lostcity');
    assert.equal(status.code, 0);
    assert.match(status.out, /lostcity: ready/);

    const again = run(root, 'start');
    assert.equal(again.code, 0);
    assert.match(again.out, /already ready/);

    const stopped = run(root, 'stop');
    assert.equal(stopped.code, 0, stopped.out);
    assert.match(stopped.out, /LostCity stopped/);
    assert.match(run(root, 'status').out, /lostcity: stopped/);
  });
});
