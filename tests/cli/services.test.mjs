import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

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

  test('initializes an empty database and stops on migration failure', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(path.join(engine, 'data', 'config'), { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(
      path.join(engine, 'data', 'config', 'world.json'),
      JSON.stringify({ login: { enabled: true }, db: { backend: 'sqlite' } }),
    );
    writeFileSync(
      path.join(engine, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        scripts: { 'sqlite:migrate': 'node -e "process.exit(7)"' },
      }),
    );
    const result = run(root, 'start');
    assert.equal(result.code, 1);
    assert.match(result.out, /Initializing empty LostCity SQLite database/);
    assert.match(result.out, /sqlite:migrate failed/);
    assert.doesNotMatch(result.out, /Starting LostCity \(pid/);
    rmSync(engine, { recursive: true });
  });

  test('refuses to modify an existing partial database', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(path.join(engine, 'data', 'config'), { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(path.join(engine, 'package.json'), JSON.stringify({ name: 'fixture' }));
    writeFileSync(
      path.join(engine, 'data', 'config', 'world.json'),
      JSON.stringify({ login: { enabled: true }, db: { backend: 'sqlite' } }),
    );
    const db = new DatabaseSync(path.join(engine, 'db.sqlite'));
    db.exec('CREATE TABLE custom_data (value TEXT)');
    db.close();
    const result = run(root, 'start');
    assert.equal(result.code, 1);
    assert.match(result.out, /incomplete schema/);
    const check = new DatabaseSync(path.join(engine, 'db.sqlite'), { readOnly: true });
    assert.ok(check.prepare("SELECT name FROM sqlite_master WHERE name = 'custom_data'").get());
    check.close();
    rmSync(path.join(engine, 'data'), { recursive: true });
    rmSync(path.join(engine, 'db.sqlite'));
  });

  test('starts a fake engine, reports ready, is idempotent, and stops it', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(engine, { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
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
