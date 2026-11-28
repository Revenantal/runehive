import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
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

  test('rejects readiness followed by a port-binding failure', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(path.join(engine, 'src'), { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(
      path.join(engine, 'src', 'app.ts'),
      "console.log('World ready: Visit http://localhost:1/rs2.cgi'); setTimeout(() => { console.error('EADDRINUSE'); process.exit(1); }, 250);",
    );
    writeFileSync(
      path.join(engine, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { start: 'node src/app.ts' } }),
    );
    const result = run(root, 'start');
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /port conflict during startup/);
    assert.doesNotMatch(result.out, /LostCity is ready/);
    // The fixture exits before readiness; an unresolved lock now requires explicit cleanup.
    rmSync(path.join(root, 'lostcity', '.runehive', 'lostcity.owner'), { force: true });
    rmSync(path.join(root, 'lostcity', '.runehive', 'lostcity.pid'), { force: true });
  });

  test('refuses to stop a manually launched engine', async (t) => {
    if (process.platform !== 'linux') return t.skip('Linux process discovery');
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(path.join(engine, 'src'), { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(
      path.join(engine, 'src', 'app.ts'),
      "console.log('fixture ready'); setInterval(() => {}, 1000);",
    );
    writeFileSync(
      path.join(engine, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { start: 'node src/app.ts' } }),
    );
    const child = spawn(process.execPath, ['src/app.ts'], {
      cwd: engine,
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    t.after(() => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Already exited. */
      }
    });
    await once(child.stdout, 'data');
    assert.match(run(root, 'status').out, /lostcity: unmanaged/);
    assert.equal(run(root, 'start').code, 1);
    const stopped = run(root, 'stop');
    assert.equal(stopped.code, 1);
    assert.match(stopped.out, /No process was signaled/);
    const closed = once(child, 'exit');
    process.kill(-child.pid, 'SIGTERM');
    await closed;
  });

  test('refuses to stop multiple matching process groups', async (t) => {
    if (process.platform !== 'linux') return t.skip('Linux process discovery');
    const engine = path.join(root, 'lostcity', 'engine');
    const children = Array.from({ length: 2 }, () =>
      spawn(process.execPath, ['src/app.ts'], {
        cwd: engine,
        detached: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    t.after(() => {
      for (const child of children) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          /* Already exited. */
        }
      }
    });
    await Promise.all(children.map((child) => once(child.stdout, 'data')));
    assert.match(run(root, 'status').out, /lostcity: ambiguous/);
    const stopped = run(root, 'stop');
    assert.equal(stopped.code, 1);
    assert.match(stopped.out, /No process was signaled/);
    const exited = children.map((child) => once(child, 'exit'));
    for (const child of children) process.kill(-child.pid, 'SIGTERM');
    await Promise.all(exited);
  });

  test('starts a fake engine, reports ready, is idempotent, and stops it', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(engine, { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    mkdirSync(path.join(engine, 'src'), { recursive: true });
    writeFileSync(
      path.join(engine, 'src', 'app.ts'),
      "console.log('World ready: Visit http://localhost:1/rs2.cgi'); setInterval(() => {}, 1000);",
    );
    writeFileSync(
      path.join(engine, 'package.json'),
      JSON.stringify({ name: 'fake-engine', scripts: { start: 'node src/app.ts' } }),
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

    if (process.platform === 'linux') {
      const pidFile = path.join(root, 'lostcity', '.runehive', 'lostcity.pid');
      writeFileSync(pidFile, `${process.pid}\n`);
      const recovered = run(root, 'status');
      assert.equal(recovered.code, 0);
      assert.match(recovered.out, /lostcity: running/);
      const duplicate = run(root, 'start');
      assert.equal(duplicate.code, 1);
      assert.match(duplicate.out, /already running/);
    }
    const stopped = run(root, 'stop');
    assert.equal(stopped.code, 0, stopped.out);
    if (process.platform === 'linux') assert.match(stopped.out, /Recovered a matching/);
    assert.match(stopped.out, /LostCity stopped/);
    assert.match(run(root, 'status').out, /lostcity: stopped/);
  });
  test('preserves same-host and incomplete owner locks until manually resolved', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(engine, { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(path.join(engine, 'package.json'), JSON.stringify({ name: 'fake-engine' }));
    const state = path.join(root, 'lostcity', '.runehive');
    mkdirSync(state, { recursive: true });
    const lock = path.join(state, 'lostcity.owner');
    for (const contents of [
      JSON.stringify({ host: process.env.RUNEHIVE_HOST_ID || hostname(), pid: 1 }),
      '',
    ]) {
      writeFileSync(lock, contents);
      assert.match(run(root, 'status').out, /lostcity: locked/);
      const start = run(root, 'start');
      assert.equal(start.code, 1);
      assert.match(start.out, /ownership is unresolved/);
      const stop = run(root, 'stop');
      assert.equal(stop.code, 1);
      assert.match(stop.out, /ownership is unresolved/);
      assert.equal(existsSync(lock), true);
      rmSync(lock);
    }
  });

  test('refuses to start or stop while another machine holds the lock', () => {
    const engine = path.join(root, 'lostcity', 'engine');
    mkdirSync(engine, { recursive: true });
    mkdirSync(path.join(root, 'lostcity', 'content'), { recursive: true });
    writeFileSync(path.join(engine, 'package.json'), JSON.stringify({ name: 'fake-engine' }));
    const state = path.join(root, 'lostcity', '.runehive');
    mkdirSync(state, { recursive: true });
    const lock = path.join(state, 'lostcity.owner');
    writeFileSync(lock, `${JSON.stringify({ host: 'fixture-other-host', pid: 1 })}\n`);

    const status = run(root, 'status');
    assert.equal(status.code, 1);
    assert.match(status.out, /lostcity: remote.*held by fixture-other-host/);

    const start = run(root, 'start');
    assert.equal(start.code, 1);
    assert.match(start.out, /already running on another machine \(fixture-other-host\)/);
    assert.equal(existsSync(path.join(state, 'lostcity.pid')), false);

    const stop = run(root, 'stop');
    assert.equal(stop.code, 1);
    assert.match(stop.out, /held by another machine/);
    assert.equal(existsSync(lock), true);
    rmSync(lock);
  });
});
