#!/usr/bin/env node
// Runehive project CLI. Built-in Node.js modules only, so it runs from a fresh checkout.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(toolsDir, '..');

const HELP = `Usage: runehive <command> [options]

Commands:
  init     Fetch the pinned LostCity sources into the Git-ignored lostcity/ directory.
           Reuses matching checkouts; reports (and never overwrites) mismatches,
           local edits, unexpected origins, and occupied paths.

Options:
  --root <dir>       Project root (default: the checkout containing this file)
  --manifest <file>  Source manifest (default: tools/lostcity-sources.json)
  -h, --help         Show this help
`;

/** Runs a Git command and returns trimmed stdout. */
function git(args, cwd, opts = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...opts,
  }).trim();
}

/** Normalizes a remote URL so equivalent forms compare equal. */
function normalizeUrl(url) {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .toLowerCase();
}

/** Returns true when the path is a directory with no entries. */
function isEmptyDir(dir) {
  return statSync(dir).isDirectory() && readdirSync(dir).length === 0;
}

/** Returns the checkout's top-level path if `dir` is itself a Git work tree root, else null. */
function gitRootOf(dir) {
  try {
    const top = git(['rev-parse', '--show-toplevel'], dir);
    return realpathSync(top) === realpathSync(dir) ? top : null;
  } catch {
    return null;
  }
}

/** Inspect an existing path without changing it. */
export function inspectComponent(component, dir) {
  if (!existsSync(dir)) return { state: 'missing' };
  if (!statSync(dir).isDirectory())
    return { state: 'occupied', detail: 'path exists and is not a directory' };
  if (isEmptyDir(dir)) return { state: 'missing', emptyDir: true };
  if (!gitRootOf(dir))
    return { state: 'occupied', detail: 'directory is not empty and is not a Git checkout' };

  let origin;
  try {
    origin = git(['remote', 'get-url', 'origin'], dir);
  } catch {
    return { state: 'wrong-origin', detail: 'checkout has no origin remote' };
  }
  if (normalizeUrl(origin) !== normalizeUrl(component.url)) {
    return { state: 'wrong-origin', detail: `origin is ${origin}, expected ${component.url}` };
  }

  let head;
  try {
    head = git(['rev-parse', 'HEAD'], dir);
  } catch {
    return { state: 'occupied', detail: 'checkout has no commits' };
  }
  const dirty = git(['status', '--porcelain'], dir) !== '';
  if (head !== component.commit) {
    return {
      state: 'commit-mismatch',
      head,
      dirty,
      detail: `at ${head}, manifest pins ${component.commit}`,
    };
  }
  if (dirty)
    return { state: 'local-edits', head, detail: 'matches the pin but has uncommitted changes' };
  return { state: 'ok', head };
}

/** Fetch into a temporary sibling directory, then rename into place so a failure leaves nothing half-made. */
function fetchComponent(component, dir) {
  const parent = path.dirname(dir);
  mkdirSync(parent, { recursive: true });
  const tmp = `${dir}.partial-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  try {
    git(['init', '--quiet'], tmp);
    git(['remote', 'add', 'origin', component.url], tmp);
    try {
      git(['fetch', '--quiet', '--depth', '1', 'origin', component.commit], tmp);
    } catch {
      // Some hosts refuse fetching an arbitrary commit; fall back to the whole branch.
      git(['fetch', '--quiet', 'origin', `refs/heads/${component.branch}`], tmp);
    }
    git(['checkout', '--quiet', '--detach', component.commit], tmp);
    const head = git(['rev-parse', 'HEAD'], tmp);
    if (head !== component.commit) throw new Error(`fetched ${head}, expected ${component.commit}`);
    if (existsSync(dir)) rmdirSync(dir); // only reached for an empty directory
    renameSync(tmp, dir);
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true });
    throw error;
  }
}

/** Throws if the source manifest is malformed or unsafe. */
function validateManifest(manifest) {
  if (
    !manifest ||
    typeof manifest.destination !== 'string' ||
    !Array.isArray(manifest.components)
  ) {
    throw new Error('manifest must contain "destination" and a "components" array');
  }
  for (const c of manifest.components) {
    for (const key of ['name', 'url', 'branch', 'commit', 'path']) {
      if (typeof c[key] !== 'string' || c[key] === '')
        throw new Error(`component is missing "${key}"`);
    }
    if (!/^[0-9a-f]{40}$/.test(c.commit))
      throw new Error(`${c.name}: commit must be a full 40-character ID`);
    if (path.isAbsolute(c.path) || c.path.split(/[\\/]/).includes('..')) {
      throw new Error(`${c.name}: path must stay inside the destination`);
    }
  }
}

/** Fetches missing LostCity components and reports the state of existing ones. Returns an exit code. */
export function init({ root, manifestPath, log = console.log }) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  const destination = path.resolve(root, manifest.destination);
  log(`LostCity destination: ${destination}`);

  const problems = [];
  for (const component of manifest.components) {
    const dir = path.join(destination, component.path);
    const label = component.name.padEnd(10);
    const found = inspectComponent(component, dir);
    switch (found.state) {
      case 'ok':
        log(`[ok]        ${label} ${dir}  ${found.head}`);
        break;
      case 'missing':
        try {
          fetchComponent(component, dir);
          log(`[fetched]   ${label} ${dir}  ${component.commit}`);
        } catch (error) {
          const reason = String(error.stderr || error.message)
            .trim()
            .split('\n')
            .pop();
          log(`[failed]    ${label} ${dir}  ${reason}`);
          problems.push(component.name);
        }
        break;
      default:
        log(`[${found.state}] ${label} ${dir}  ${found.detail}`);
        problems.push(component.name);
    }
  }

  if (problems.length > 0) {
    log(
      `\nInit finished with problems in: ${problems.join(', ')}. Nothing existing was modified; resolve each path and re-run.`,
    );
    return 1;
  }
  log('\nInit complete.');
  return 0;
}

/** Parses command-line arguments. */
function parseArgs(argv) {
  const args = { root: defaultRoot, manifest: null, command: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--root') args.root = path.resolve(argv[++i] ?? '');
    else if (a === '--manifest') args.manifest = path.resolve(argv[++i] ?? '');
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (!args.command) args.command = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  args.manifest ??= path.join(args.root, 'tools', 'lostcity-sources.json');
  return args;
}

/** Runs the CLI and returns an exit code. */
function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`runehive: ${error.message}\n\n${HELP}`);
    return 2;
  }
  if (args.help || !args.command) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }
  if (args.command === 'init') {
    try {
      return init({ root: args.root, manifestPath: args.manifest });
    } catch (error) {
      console.error(`runehive init: ${error.message}`);
      return 1;
    }
  }
  console.error(`runehive: unknown command "${args.command}"\n\n${HELP}`);
  return 2;
}

// Resolve symlinks so the check also works when launched through `npm link`.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
