// LostCity service control: start, status, and stop the engine from the project root.
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const READY_PATTERN = /World ready: Visit (\S+)/;
const START_TIMEOUT_MS = 180_000;
const STOP_TIMEOUT_MS = 60_000;
const POLL_MS = 500;

/** Pauses for the given number of milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns the engine directory and the Git-ignored state files for this root. */
export function servicePaths(root, destination = 'lostcity') {
  const base = path.resolve(root, destination);
  const stateDir = path.join(base, '.runehive');
  return {
    engineDir: path.join(base, 'engine'),
    contentDir: path.join(base, 'content'),
    stateDir,
    pidFile: path.join(stateDir, 'lostcity.pid'),
    logFile: path.join(stateDir, 'lostcity.log'),
  };
}

/** Returns true when the process exists and has not already exited (zombies count as exited). */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    return error.code === 'EPERM';
  }
  try {
    // Linux only; an unreaped orphan stays visible to kill(0) until its parent collects it.
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
  } catch {
    return true;
  }
}

/** Returns true while any live process remains in the group led by `pid` (npm exits before the engine saves). */
function groupAlive(pid) {
  if (!existsSync('/proc/self/stat')) return isAlive(pid);
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (fields[0] !== 'Z' && Number(fields[2]) === pid) return true;
    } catch {
      // The process exited while scanning.
    }
  }
  return false;
}

/** Reads the recorded process ID, or null when none is recorded or it is stale. */
function readPid(pidFile) {
  if (!existsSync(pidFile)) return null;
  const pid = Number.parseInt(readFileSync(pidFile, 'utf8'), 10);
  return Number.isInteger(pid) && pid > 0 && groupAlive(pid) ? pid : null;
}

/** Returns the browser URL from the log once the engine reports ready, else null. */
function readyUrl(logFile) {
  if (!existsSync(logFile)) return null;
  return READY_PATTERN.exec(readFileSync(logFile, 'utf8'))?.[1] ?? null;
}

/** Reports whether the world is stopped, starting, or ready. */
export function status({ root, destination }) {
  const p = servicePaths(root, destination);
  const pid = readPid(p.pidFile);
  if (pid === null) return { state: 'stopped', logFile: p.logFile };
  const url = readyUrl(p.logFile);
  return url
    ? { state: 'ready', pid, url, logFile: p.logFile }
    : { state: 'starting', pid, logFile: p.logFile };
}

/** Initializes an empty local SQLite database when configured support services require it. */
function initializeDatabase(engineDir, log) {
  const configPath = path.join(engineDir, 'data', 'config', 'world.json');
  if (!existsSync(configPath)) {
    if (existsSync(path.join(engineDir, '.env'))) {
      throw new Error('Legacy LostCity .env configuration requires manual database setup.');
    }
    return;
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!config.login?.enabled && !config.friend?.enabled && !config.logger?.enabled) return;
  if ((config.db?.backend ?? 'sqlite') !== 'sqlite') return;
  const dbPath = path.join(engineDir, 'db.sqlite');
  if (existsSync(dbPath) && statSync(dbPath).size > 0) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
      const names = new Set(tables.map((table) => table.name));
      const required = [
        '_prisma_migrations',
        'ipban',
        'account',
        'account_login',
        'hiscore',
        'hiscore_large',
        'friendlist',
        'ignorelist',
        'session',
        'session_log',
        'session_wealth',
        'public_chat',
        'private_chat',
        'report',
        'input_report',
      ];
      if (required.every((name) => names.has(name))) {
        const unfinished = db
          .prepare(
            'SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL LIMIT 1',
          )
          .get();
        if (!unfinished) return;
      }
      if (names.size > 0)
        throw new Error(
          'SQLite database already contains data or an incomplete schema; initialize it manually.',
        );
    } finally {
      db.close();
    }
  }
  log('Initializing empty LostCity SQLite database...');
  for (const args of [['install'], ['run', 'sqlite:migrate']]) {
    const result = spawnSync('npm', args, { cwd: engineDir, stdio: 'inherit' });
    if (result.error || result.status !== 0)
      throw new Error(`npm ${args.join(' ')} failed; database initialization did not complete.`);
  }
}

/** Starts the engine in the background and waits until it reports ready. Returns an exit code. */
export async function start({
  root,
  destination,
  log = console.log,
  timeoutMs = START_TIMEOUT_MS,
}) {
  const p = servicePaths(root, destination);
  if (!existsSync(path.join(p.engineDir, 'package.json')) || !existsSync(p.contentDir)) {
    log('LostCity sources are missing. Run `runehive init` first.');
    return 1;
  }
  const current = status({ root, destination });
  if (current.state !== 'stopped') {
    log(`LostCity is already ${current.state} (pid ${current.pid}).`);
    if (current.url) log(`Open ${current.url}`);
    return current.state === 'ready' ? 0 : 1;
  }

  try {
    initializeDatabase(p.engineDir, log);
  } catch (error) {
    log(`LostCity database setup failed: ${error.message}`);
    return 1;
  }

  mkdirSync(p.stateDir, { recursive: true });
  rmSync(p.logFile, { force: true });
  const out = openSync(p.logFile, 'a');
  // Detached so it gets its own process group, letting stop signal npm and the engine together.
  const child = spawn('npm', ['start'], {
    cwd: p.engineDir,
    detached: true,
    stdio: ['ignore', out, out],
  });
  closeSync(out);
  child.unref();
  const spawnError = new Promise((resolve) => child.once('error', resolve));
  if (!child.pid) {
    log(`Could not start npm: ${(await spawnError).message}`);
    return 1;
  }
  writeFileSync(p.pidFile, `${child.pid}\n`);
  log(`Starting LostCity (pid ${child.pid}). The first start takes a minute or more.`);
  log(`Log: ${p.logFile}`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = readyUrl(p.logFile);
    if (url) {
      log(`LostCity is ready. Open ${url}`);
      return 0;
    }
    if (!isAlive(child.pid)) {
      rmSync(p.pidFile, { force: true });
      log(`LostCity exited before it was ready. See ${p.logFile}`);
      return 1;
    }
    await sleep(POLL_MS);
  }
  log(`LostCity is still starting after ${timeoutMs / 1000}s. Check \`runehive status lostcity\`.`);
  return 1;
}

/** Stops the engine started by `start`, giving it time to save. Returns an exit code. */
export async function stop({ root, destination, log = console.log, timeoutMs = STOP_TIMEOUT_MS }) {
  const p = servicePaths(root, destination);
  const pid = readPid(p.pidFile);
  if (pid === null) {
    rmSync(p.pidFile, { force: true });
    log('LostCity is not running (no process started by runehive).');
    return 0;
  }
  log(`Stopping LostCity (pid ${pid})...`);
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    process.kill(pid, 'SIGTERM');
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!groupAlive(pid)) {
      rmSync(p.pidFile, { force: true });
      log('LostCity stopped.');
      return 0;
    }
    await sleep(POLL_MS);
  }
  log(`LostCity did not stop within ${timeoutMs / 1000}s. It was not force-killed (pid ${pid}).`);
  return 1;
}
