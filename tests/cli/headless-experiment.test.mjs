import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createExperimentLog } from '../../tools/headless-experiment/log.mjs';

const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tools/headless-experiment/cli.mjs',
);

test('experiment help and invalid startup are actionable without echoing inputs', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Experimental headless client/);
  for (const args of [[], ['unknown-input'], ['run', 'unknown-input']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(
      result.stderr,
      /Expected "run", "login", "session", "session-idle", "logout", "logout-abrupt", "observe", "observe-designed", "observe-walking", or "--help"/,
    );
    assert.doesNotMatch(result.stderr, /unknown-input/);
  }
});

test('invalid account configuration is rejected without echoing its value', () => {
  const marker = 'fixture-invalid-sensitive';
  const result = spawnSync(process.execPath, [cli, 'login'], {
    encoding: 'utf8',
    env: { ...process.env, RUNEHIVE_EXPERIMENT_ACCOUNT: marker },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /printable account name/);
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-invalid-sensitive/);
});

test('login prompts for an account and rejects invalid input', () => {
  const env = { ...process.env };
  delete env.RUNEHIVE_EXPERIMENT_ACCOUNT;
  const result = spawnSync(process.execPath, [cli, 'login'], {
    encoding: 'utf8',
    env,
    input: 'fixture-too-long-to-be-valid\n',
  });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Experimental account:/);
  assert.match(result.stderr, /printable account name/);
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-too-long-to-be-valid/);
});

test('log entries carry the configured client label and reject malformed ones', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'experiment-client-id-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const log = createExperimentLog(root, { clientId: 'client-07' });
  log.started();
  log.close();
  const dir = path.join(root, '.runehive', 'headless-experiment');
  const entry = JSON.parse(readFileSync(path.join(dir, readdirSync(dir)[0]), 'utf8'));
  assert.equal(entry.clientId, 'client-07');
  for (const bad of ['', 'client-1', 'HX0000', 'client-001x', '../client-01'])
    assert.throws(() => createExperimentLog(root, { clientId: bad }), /Invalid client id/);
});

test('invalid experiment settings are rejected without echoing them', () => {
  for (const [name, value] of [
    ['RUNEHIVE_EXPERIMENT_CLIENT_ID', 'fixture-bad-label'],
    ['RUNEHIVE_EXPERIMENT_DEVICE_ID', 'fixture-bad-device'],
    ['RUNEHIVE_EXPERIMENT_DEVICE_ID', '99999999999'],
    ['RUNEHIVE_EXPERIMENT_DEVICE_ID', ''],
    ['RUNEHIVE_EXPERIMENT_TRANSPORT', 'fixture-bad-transport'],
    ['RUNEHIVE_EXPERIMENT_SECONDS', 'fixture-bad-seconds'],
    ['RUNEHIVE_EXPERIMENT_SECONDS', '4'],
    ['RUNEHIVE_EXPERIMENT_SECONDS', '1801'],
    ['RUNEHIVE_EXPERIMENT_SECONDS', ''],
  ]) {
    const result = spawnSync(process.execPath, [cli, 'login'], {
      encoding: 'utf8',
      env: { ...process.env, RUNEHIVE_EXPERIMENT_ACCOUNT: 'x', [name]: value },
    });
    assert.equal(result.status, 2, `${name}=${value}`);
    assert.match(result.stderr, /RUNEHIVE_EXPERIMENT_CLIENT_ID must look like/);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture-bad|99999999999/);
  }
});

test('every command listed in the help reads and validates the experiment settings', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }).stdout;
  const commands = [...help.matchAll(/cli\.mjs (?!--)(\S+)/g)].map((m) => m[1]);
  assert.ok(commands.length >= 9, `found ${commands.join(', ')}`);
  for (const command of commands) {
    const result = spawnSync(process.execPath, [cli, command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNEHIVE_EXPERIMENT_ACCOUNT: 'x',
        RUNEHIVE_EXPERIMENT_CLIENT_ID: 'fixture-bad-label',
      },
    });
    assert.equal(result.status, 2, `${command} did not validate its settings`);
    assert.match(result.stderr, /RUNEHIVE_EXPERIMENT_CLIENT_ID must look like/, command);
  }
});

test('logs isolate runs and reject unrecognized stop details', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'experiment-runs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = createExperimentLog(root);
  const second = createExperimentLog(root);
  assert.notEqual(first.runId, second.runId);
  first.started('sensitive-input');
  assert.throws(() => first.stopped('sensitive-input'), /Invalid stop signal/);
  first.close();
  second.close();
  const files = readdirSync(path.join(root, '.runehive', 'headless-experiment'));
  assert.equal(files.length, 2);
  for (const file of files)
    assert.doesNotMatch(
      readFileSync(path.join(root, '.runehive', 'headless-experiment', file), 'utf8'),
      /sensitive-input/,
    );
});

test('unwritable log location fails safely without exposing paths', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'experiment-sensitive-path-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, '.runehive'));
  const blocker = path.join(root, '.runehive', 'headless-experiment');
  writeFileSync(blocker, 'existing data');
  const result = spawnSync(process.execPath, [cli, 'run'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not create or write the experiment log/);
  assert.doesNotMatch(result.stderr, /experiment-sensitive-path/);
  assert.equal(readFileSync(blocker, 'utf8'), 'existing data');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(
    `experiment runs in foreground and shuts down cleanly on ${signal}`,
    { timeout: 5000 },
    async (t) => {
      const root = mkdtempSync(path.join(tmpdir(), 'experiment-private-'));
      t.after(() => rmSync(root, { recursive: true, force: true }));
      const child = spawn(process.execPath, [cli, 'run'], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      t.after(() => child.kill('SIGKILL'));
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      await once(child.stdout, 'data');
      assert.match(output, /no game session is open/);
      const exited = once(child, 'exit');
      child.kill(signal);
      const [code, exitSignal] = await exited;
      assert.equal(code, 0);
      assert.equal(exitSignal, null);
      assert.match(output, /stopped; no game session was opened/);
      const directory = path.join(root, '.runehive', 'headless-experiment');
      const files = readdirSync(directory);
      assert.equal(files.length, 1);
      const file = path.join(directory, files[0]);
      const entries = readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.deepEqual(
        entries.map((entry) => entry.msg),
        ['experiment.started', 'experiment.stopped'],
      );
      assert.equal(entries[1].signal, signal);
      assert.equal(entries[0].runId, entries[1].runId);
      assert.equal(entries[0].clientId, 'client-01');
      assert.match(entries[0].ts, /^\d{4}-\d\d-\d\dT.*Z$/);
      assert.equal(entries[0].level, 'info');
      assert.equal(entries[0].component, 'headless-experiment');
      assert.doesNotMatch(JSON.stringify(entries), /experiment-private|credential|password/);
      if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o077, 0);
    },
  );
}
