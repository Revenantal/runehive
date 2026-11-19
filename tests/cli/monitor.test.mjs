import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools/runehive.mjs');

test('monitor filters events, limits snapshots, and handles missing databases', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'runehive-monitor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const manifest = path.join(root, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ destination: 'lostcity' }));
  const run = (...args) =>
    spawnSync(process.execPath, [cli, 'monitor', '--root', root, '--manifest', manifest, ...args], {
      encoding: 'utf8',
    });
  assert.equal(run('--once').status, 1);
  assert.equal(run('--interval', '0').status, 2);
  assert.equal(run('--limit', 'wat').status, 2);
  const dir = path.join(root, 'lostcity', 'engine');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'db.sqlite'));
  db.exec(`CREATE TABLE account (id INTEGER, username TEXT);
    CREATE TABLE session (uuid TEXT, account_id INTEGER);
    CREATE TABLE session_log (id INTEGER, session_uuid TEXT, timestamp TEXT, event TEXT, coord INTEGER);
    CREATE TABLE session_wealth (id INTEGER, session_uuid TEXT, timestamp TEXT, event_type INTEGER, account_items TEXT, account_value INTEGER, coord INTEGER);
    INSERT INTO account VALUES (1, 'Alice'), (2, 'Bob');
    INSERT INTO session VALUES ('a', 1), ('b', 2);
    INSERT INTO session_log VALUES (1, 'a', 't1', 'Logged in', 0), (2, 'b', 't2', 'Logged in', 0), (3, 'a', 't3', 'Logged out', 0), (4, 'a', 't4', 'Server check in', 268468227);
    INSERT INTO session_wealth VALUES (1, 'a', 't5', 6, '[{"name":"fixture","count":1}]', 12, 0);`);
  db.close();
  const result = run('--once', '--player', 'ALICE', '--event', 'LOGGED', '--limit', '1');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Alice \| session \| Logged out/);
  assert.doesNotMatch(result.stdout, /Bob|Logged in/);
  assert.doesNotMatch(run('--once', '--limit', '0').stdout, /Alice|Bob/);
  assert.match(run('--once', '--category', 'position').stdout, /level 1, x 2, z 3/);
  assert.match(
    run('--once', '--category', 'wealth', '--event', 'shop buy').stdout,
    /Shop buy:.*fixture.*value 12/,
  );
  assert.doesNotMatch(run('--once', '--category', 'wealth').stdout, /Logged/);
  assert.equal(run('--category', 'invalid').status, 2);
});

test('monitor streams events added after it starts', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'runehive-watch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'lostcity', 'engine');
  mkdirSync(dir, { recursive: true });
  const manifest = path.join(root, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ destination: 'lostcity' }));
  const db = new DatabaseSync(path.join(dir, 'db.sqlite'));
  t.after(() => db.close());
  db.exec(
    'CREATE TABLE account (id INTEGER, username TEXT); CREATE TABLE session (uuid TEXT, account_id INTEGER); CREATE TABLE session_log (id INTEGER, session_uuid TEXT, timestamp TEXT, event TEXT, coord INTEGER); CREATE TABLE session_wealth (id INTEGER, session_uuid TEXT, timestamp TEXT, event_type INTEGER, account_items TEXT, account_value INTEGER, coord INTEGER);',
  );
  const child = spawn(
    process.execPath,
    [cli, 'monitor', '--root', root, '--manifest', manifest, '--interval', '0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(() => child.kill('SIGTERM'));
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  for (let i = 0; i < 50 && !output.includes('Watching for new events'); i++) await delay(50);
  assert.match(output, /Watching for new events/);
  db.exec(
    "INSERT INTO session_log VALUES (1, 'missing', 'now', 'Logged in', 0); INSERT INTO session_wealth VALUES (1, 'missing', 'now', 5, '[]', 50, 0)",
  );
  for (let i = 0; i < 50 && !output.includes('Logged in'); i++) await delay(50);
  assert.match(output, /now \| \(unknown\) \| session \| Logged in/);
  assert.match(output, /wealth \| Pickup/);
});
