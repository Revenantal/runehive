#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createExperimentLog } from './log.mjs';
import { login } from './login.mjs';
import { runLogoutExperiment } from './logout.mjs';
import { observeView } from './observe.mjs';
import { runSupervisor } from './supervisor.mjs';
import { runChildSupervisor } from './supervisor-children.mjs';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectWebSocket } from './transport.mjs';
import { observeSession } from './session.mjs';

const HELP = `Experimental headless client

Usage:
  node tools/headless-experiment/cli.mjs run     Start the foreground experiment
  node tools/headless-experiment/cli.mjs login   Prompt for an account and connect
  node tools/headless-experiment/cli.mjs session  Observe 75 seconds with keepalives
  node tools/headless-experiment/cli.mjs session-idle  Observe 75 seconds without keepalives
  node tools/headless-experiment/cli.mjs logout  Click the logout button, then test relogin
  node tools/headless-experiment/cli.mjs logout-abrupt  Drop the connection, then test relogin
  node tools/headless-experiment/cli.mjs observe  Report which other players the server says are in view
  node tools/headless-experiment/cli.mjs observe-designed  Same, after accepting the default character design
  node tools/headless-experiment/cli.mjs observe-walking  Same, after walking two tiles north
  node tools/headless-experiment/cli.mjs supervise  One process logs in several clients, tracks their state, and logs them out
  node tools/headless-experiment/cli.mjs supervise-children  Same, with one child process and device id per client
  node tools/headless-experiment/cli.mjs --help  Show this help

Optional environment: RUNEHIVE_EXPERIMENT_TRANSPORT (tcp, the default, or websocket as the browser
connects), RUNEHIVE_EXPERIMENT_CLIENT_ID (client-02 style label for the log) and
RUNEHIVE_EXPERIMENT_DEVICE_ID (experiment-only login device id; defaults to the browser client's).
Supervise also reads RUNEHIVE_EXPERIMENT_ACCOUNT_PREFIX (1 to 10 printable characters; accounts are the prefix plus 1, 2, ...),
RUNEHIVE_EXPERIMENT_CLIENTS (2 to 10, default 6), RUNEHIVE_EXPERIMENT_PACE_SECONDS (1 to 60, default 4) and
RUNEHIVE_EXPERIMENT_FAIL_CLIENT (optional client number to drop, or to kill with supervise-children) and
RUNEHIVE_EXPERIMENT_STALL_CLIENT (supervise-children only: a client to stall on purpose). Its state is written to
.runehive/headless-experiment/clients.json.
Each run writes a private JSONL log under .runehive/headless-experiment/ in the current directory.
Stop a running experiment with Ctrl-C (SIGINT) or SIGTERM.
`;

/** Reads optional experiment-only settings, or returns null after reporting an invalid value. */
function readOptions() {
  const clientId = process.env.RUNEHIVE_EXPERIMENT_CLIENT_ID ?? 'client-01';
  const rawDevice = process.env.RUNEHIVE_EXPERIMENT_DEVICE_ID;
  const deviceId = rawDevice === undefined ? undefined : Number(rawDevice);
  const transport = process.env.RUNEHIVE_EXPERIMENT_TRANSPORT ?? 'tcp';
  const host = process.env.RUNEHIVE_EXPERIMENT_HOST ?? '127.0.0.1';
  const crcFile = process.env.RUNEHIVE_EXPERIMENT_CRC_FILE;
  const rawSeconds = process.env.RUNEHIVE_EXPERIMENT_SECONDS;
  const seconds = rawSeconds === undefined ? 30 : Number(rawSeconds);
  const validSeconds =
    rawSeconds === undefined || (/^\d{1,4}$/.test(rawSeconds) && seconds >= 5 && seconds <= 1800);
  const validDevice =
    rawDevice === undefined || (/^\d{1,10}$/.test(rawDevice) && deviceId <= 0x7fffffff);
  if (
    !/^client-\d{2,3}$/.test(clientId) ||
    !validDevice ||
    !validSeconds ||
    !/^[A-Za-z0-9.-]{1,253}$/.test(host) ||
    (crcFile !== undefined && !crcFile) ||
    !['tcp', 'websocket'].includes(transport)
  ) {
    console.error(
      'RUNEHIVE_EXPERIMENT_CLIENT_ID must look like client-02, and RUNEHIVE_EXPERIMENT_DEVICE_ID must be a non-negative integer, and RUNEHIVE_EXPERIMENT_TRANSPORT must be tcp or websocket, and RUNEHIVE_EXPERIMENT_SECONDS must be 5 to 1800, and RUNEHIVE_EXPERIMENT_HOST must be a host name or address, and RUNEHIVE_EXPERIMENT_CRC_FILE must not be empty.',
    );
    return null;
  }
  return { clientId, deviceId, transport, seconds, host, crcFile };
}

/** Keeps the placeholder process available until an operator stops it. */
function run(options) {
  let log;
  try {
    log = createExperimentLog(process.cwd(), { clientId: options.clientId });
    log.started();
  } catch {
    try {
      log?.close();
    } catch {
      // The startup failure is reported without potentially sensitive system details.
    }
    console.error('Could not create or write the experiment log; no experiment was started.');
    process.exitCode = 1;
    return;
  }
  const keepAlive = setInterval(() => {}, 60_000);
  const stop = (signal) => {
    clearInterval(keepAlive);
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    try {
      log.stopped(signal);
      log.close();
      console.log('Experimental client stopped; no game session was opened.');
    } catch {
      try {
        log.close();
      } catch {
        // The shutdown failure is reported without potentially sensitive system details.
      }
      console.error('Could not finish the experiment log; the experiment stopped.');
      process.exitCode = 1;
    }
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  console.log(
    `Experimental client running; no game session is open. Run ID: ${log.runId}. Press Ctrl-C to stop.`,
  );
}

/** Builds the login function for the chosen device id and transport (raw TCP by default). */
function loginFor(options) {
  return (args) =>
    login({
      ...args,
      host: options.host,
      deviceId: options.deviceId,
      ...(options.crcFile ? { crcs: readFileSync(options.crcFile) } : {}),
      ...(options.transport === 'websocket'
        ? { connect: () => connectWebSocket({ host: options.host }) }
        : {}),
    });
}

/** Prompts for the experimental account without adding it to command history. */
async function promptAccount() {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await input.question('Experimental account: ');
  } finally {
    input.close();
  }
}

/** Connects one experimental account and reports only safe protocol outcomes. */
async function runLogin(mode, options) {
  let account;
  try {
    account = process.env.RUNEHIVE_EXPERIMENT_ACCOUNT ?? (await promptAccount());
  } catch {
    console.error('Could not read the experimental account.');
    process.exitCode = 1;
    return;
  }
  if (!account || !/^[\x20-\x7e]{1,12}$/.test(account)) {
    console.error('Enter a printable account name of 1–12 characters.');
    process.exitCode = 2;
    return;
  }
  let log;
  let socket;
  let session;
  const counts = { bytes: 0 };
  let stopped = false;
  const stop = (signal) => {
    if (stopped) return;
    stopped = true;
    session?.stop();
    if (socket) socket.destroy();
    try {
      log.stopped(signal);
      log.close();
    } catch {
      console.error('Could not finish the experiment log.');
      process.exitCode = 1;
    }
    console.log('Connection closed; no game logout was requested.');
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  try {
    log = createExperimentLog(process.cwd(), { clientId: options.clientId });
    log.started();
    log.loginRequested();
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
    console.log(`Login requested. Run ID: ${log.runId}.`);
    const result = await loginFor(options)({
      account,
      onBytes: (count) => {
        counts.bytes += count;
      },
    });
    socket = result.socket;
    if (stopped) {
      socket.destroy();
      return;
    }
    if (result.kind === 'rejected') {
      log.loginRejected(result.code);
      console.error(`Login rejected (protocol code ${result.code}).`);
      process.exitCode = 1;
      socket.destroy();
      log.close();
    } else {
      log.loginAccepted(result.staffLevel);
      if (result.staffLevel !== 0) {
        console.error('Login accepted with non-player permissions; disconnecting.');
        process.exitCode = 1;
        socket.destroy();
        log.close();
      } else {
        console.log('Login accepted as an ordinary player. Press Ctrl-C to disconnect.');
        if (mode !== 'login') {
          const keepalive = mode === 'session';
          log.sessionStarted(keepalive);
          console.log(
            `Observing for up to 75 seconds (${keepalive ? 'with' : 'without'} keepalives).`,
          );
          session = observeSession({
            socket,
            sendKeepalive: result.sendKeepalive,
            keepalive,
            counts,
            report: ({ elapsedMs, bytes, keepalives }) => {
              try {
                log.sessionObserved(elapsedMs, bytes, keepalives);
              } catch {
                console.error('Could not write the experiment log.');
                process.exitCode = 1;
                socket.destroy();
              }
            },
            finish: (reason, { elapsedMs, bytes, keepalives }) => {
              try {
                log.sessionFinished(reason, elapsedMs, bytes, keepalives);
              } catch {
                console.error('Could not finish the experiment log.');
                process.exitCode = 1;
              }
              if (reason === 'interrupted') return;
              stopped = true;
              process.removeListener('SIGINT', onInterrupt);
              process.removeListener('SIGTERM', onTerminate);
              socket.destroy();
              try {
                log.close();
              } catch {
                console.error('Could not close the experiment log.');
                process.exitCode = 1;
              }
              console.log(
                `Session ended: ${reason}; ${bytes} bytes received, ${keepalives} keepalives queued.`,
              );
              if (reason !== 'deadline') process.exitCode = 1;
            },
          });
          return;
        }
        socket.once('close', () => {
          if (!stopped) {
            try {
              log.loginFailed();
              log.close();
            } catch {
              /* Report the same sanitized failure below. */
            }
            console.error('Connection closed unexpectedly.');
            process.exitCode = 1;
          }
        });
      }
    }
  } catch {
    if (stopped) return;
    try {
      log?.loginFailed();
      log?.close();
    } catch {
      /* Report the same sanitized failure below. */
    }
    socket?.destroy();
    console.error('Login experiment failed; check that the local world is ready.');
    process.exitCode = 1;
  }
}

/**
 * Shared setup for bounded experiments: reads the account, opens the log, handles interruption,
 * runs the experiment and closes the log. `print` shows the summary and returns true on success.
 */
async function runBoundedExperiment({ options, title, execute, print }) {
  let account;
  try {
    account = process.env.RUNEHIVE_EXPERIMENT_ACCOUNT ?? (await promptAccount());
  } catch {
    console.error('Could not read the experimental account.');
    process.exitCode = 1;
    return;
  }
  if (!account || !/^[\x20-\x7e]{1,12}$/.test(account)) {
    console.error('Enter a printable account name of 1–12 characters.');
    process.exitCode = 2;
    return;
  }
  let log;
  try {
    log = createExperimentLog(process.cwd(), { clientId: options.clientId });
    log.started();
    log.loginRequested();
  } catch {
    try {
      log?.close();
    } catch {
      /* The startup failure is reported below without system details. */
    }
    console.error('Could not create or write the experiment log; no experiment was started.');
    process.exitCode = 1;
    return;
  }
  const controller = new AbortController();
  let interruptedBy = null;
  const onSignal = (signal) => {
    interruptedBy ??= signal;
    controller.abort();
  };
  const onInterrupt = () => onSignal('SIGINT');
  const onTerminate = () => onSignal('SIGTERM');
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  const sleep = (ms, cancel) =>
    new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', finish);
        cancel?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      controller.signal.addEventListener('abort', finish, { once: true });
      cancel?.addEventListener('abort', finish, { once: true });
    });
  console.log(`${title}. Run ID: ${log.runId}.`);
  let summary;
  try {
    summary = await execute({
      account,
      log,
      sleep,
      now: () => performance.now(),
      signal: controller.signal,
      loginFn: loginFor(options),
    });
  } catch {
    summary = { stage: 'experiment', outcome: 'error', relogins: [] };
  }
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  try {
    if (interruptedBy) log.stopped(interruptedBy);
    log.close();
  } catch {
    console.error('Could not finish the experiment log.');
    process.exitCode = 1;
  }
  console.log(`Result: ${summary.stage ?? 'done'} / ${summary.outcome}.`);
  if (!print(summary)) process.exitCode = 1;
}

/** Runs the clean-logout or abrupt-disconnect experiment for one account. */
function runLogoutCommand(mode, options) {
  return runBoundedExperiment({
    options,
    title: mode === 'clean' ? 'Clean logout experiment' : 'Abrupt disconnect experiment',
    execute: (deps) => runLogoutExperiment({ ...deps, mode }),
    print(summary) {
      if (summary.close)
        console.log(
          `Connection ${summary.close.reason} ${summary.close.elapsedMs} ms after the request.`,
        );
      for (const r of summary.relogins)
        console.log(
          `Relogin attempt ${r.attempt} at ${r.elapsedMs} ms: ${r.outcome}${r.code === null ? '' : ` (protocol code ${r.code})`}.`,
        );
      return summary.outcome === 'relogin-accepted';
    },
  });
}

/** Logs in for 30 seconds and reports which other players the server says are in view. */
function runObserveCommand(options, { design = false, walk = false } = {}) {
  return runBoundedExperiment({
    options,
    title: `View observation (${options.seconds} seconds${design ? ', after accepting the default character design' : ''}${walk ? ', after walking two tiles' : ''})`,
    execute: (deps) => observeView({ ...deps, design, walk, durationMs: options.seconds * 1000 }),
    print(t) {
      if (t.stage !== 'observe') return false;
      console.log(
        `${t.updates} player-update packets of ${t.packets} packets in ${t.elapsedMs} ms` +
          `${t.malformed ? `; ${t.malformed} could not be decoded` : ''}.`,
      );
      if (t.broken)
        console.log(`Packet stream stopped: ${t.broken.reason} (opcode ${t.broken.opcode}).`);
      console.log(
        `Other players the server reported: ${t.added} added, ${t.removed} removed; in view at the end: ${t.viewSize} (most at once: ${t.maxViewSize}).`,
      );
      console.log(`This client's slot on the server: ${t.ownSlot ?? 'not reported'}.`);
      console.log(
        `Updates about this client's own character: ${
          Object.entries(t.local)
            .map(([k, v]) => `${k} x${v}`)
            .join(', ') || 'none'
        }.`,
      );
      console.log(
        `Packet types received: ${Object.entries(t.names)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} x${v}`)
          .join(', ')}.`,
      );
      for (const s of t.sightings)
        console.log(
          `  first seen at ${s.atMs} ms: slot ${s.pid}, offset (${s.dx}, ${s.dz}) from this client.`,
        );
      return t.outcome === 'deadline' && !t.broken;
    },
  });
}

/** Reads the extra settings of the supervisor experiment, or returns null after reporting a problem. */
function readSuperviseOptions(options, defaultPace = '4') {
  const count = Number(process.env.RUNEHIVE_EXPERIMENT_CLIENTS ?? '6');
  const pace = Number(process.env.RUNEHIVE_EXPERIMENT_PACE_SECONDS ?? defaultPace);
  const rawFail = process.env.RUNEHIVE_EXPERIMENT_FAIL_CLIENT;
  const fail = rawFail === undefined ? null : Number(rawFail);
  const rawStall = process.env.RUNEHIVE_EXPERIMENT_STALL_CLIENT;
  const stall = rawStall === undefined ? null : Number(rawStall);
  const valid =
    Number.isInteger(count) &&
    count >= 2 &&
    count <= 10 &&
    Number.isInteger(pace) &&
    pace >= 1 &&
    pace <= 60 &&
    (fail === null || (/^\d{1,2}$/.test(rawFail) && fail >= 1 && fail <= count)) &&
    (stall === null || (/^\d{1,2}$/.test(rawStall) && stall >= 1 && stall <= count)) &&
    process.env.RUNEHIVE_EXPERIMENT_CLIENTS !== '' &&
    process.env.RUNEHIVE_EXPERIMENT_PACE_SECONDS !== '';
  if (!valid) {
    console.error(
      'RUNEHIVE_EXPERIMENT_CLIENTS must be 2 to 10, RUNEHIVE_EXPERIMENT_PACE_SECONDS 1 to 60, and RUNEHIVE_EXPERIMENT_FAIL_CLIENT and RUNEHIVE_EXPERIMENT_STALL_CLIENT a client number within range.',
    );
    return null;
  }
  return { ...options, count, paceMs: pace * 1000, failNumber: fail, stallNumber: stall };
}

/** One process logs in several clients, tracks them in one state file, and logs them out. */
async function runSuperviseCommand(options, { children = false } = {}) {
  const settings = readSuperviseOptions(options, children ? '1' : '4');
  if (!settings) {
    process.exitCode = 2;
    return;
  }
  let prefix;
  try {
    prefix = process.env.RUNEHIVE_EXPERIMENT_ACCOUNT_PREFIX ?? (await promptAccount());
  } catch {
    console.error('Could not read the account prefix.');
    process.exitCode = 1;
    return;
  }
  if (!prefix || !/^[\x20-\x7e]{1,10}$/.test(prefix)) {
    console.error('Enter a printable account prefix of 1 to 10 characters.');
    process.exitCode = 2;
    return;
  }
  const accounts = Array.from({ length: settings.count }, (_, i) => `${prefix}${i + 1}`);
  let log;
  try {
    log = createExperimentLog(process.cwd(), { clientId: settings.clientId });
    log.started();
  } catch {
    console.error('Could not create or write the experiment log; no experiment was started.');
    process.exitCode = 1;
    return;
  }
  const controller = new AbortController();
  const onSignal = () => controller.abort();
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const sleep = (ms, cancel) =>
    new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', finish);
        cancel?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      controller.signal.addEventListener('abort', finish, { once: true });
      cancel?.addEventListener('abort', finish, { once: true });
    });
  console.log(
    `Supervisor${children ? ' (one child process per client, own device ids)' : ''}: ${settings.count} clients, ${settings.paceMs / 1000} s apart, held ${settings.seconds} s${settings.failNumber ? `, ${children ? 'killing' : 'dropping'} client ${settings.failNumber} on purpose` : ''}${settings.stallNumber ? `, stalling client ${settings.stallNumber}` : ''}. Run ID: ${log.runId}.`,
  );
  let summary;
  try {
    const common = {
      accounts,
      log,
      sleep,
      now: () => performance.now(),
      signal: controller.signal,
      stateFile: path.join(process.cwd(), '.runehive', 'headless-experiment', 'clients.json'),
      paceMs: settings.paceMs,
      holdMs: settings.seconds * 1000,
    };
    summary = children
      ? await runChildSupervisor({
          ...common,
          host: settings.host,
          crcFile: settings.crcFile,
          killNumber: settings.failNumber,
          stallNumber: settings.stallNumber,
          forkWorker: () =>
            fork(fileURLToPath(new URL('./worker.mjs', import.meta.url)), [], {
              stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            }),
        })
      : await runSupervisor({
          ...common,
          loginFn: loginFor(settings),
          failNumber: settings.failNumber,
        });
  } catch {
    console.error('Supervisor experiment failed; see the state file for each client.');
    process.exitCode = 1;
    return;
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    log.close();
  }
  for (const c of summary.clients)
    console.log(
      `  ${c.label}: ${c.state}${c.slot === null ? '' : `, slot ${c.slot}`}${c.code === null ? '' : `, protocol code ${c.code}`}`,
    );
  if (summary.injected)
    console.log(`Dropped ${summary.injected.label} on purpose at ${summary.injected.atMs} ms.`);
  if (summary.killed)
    console.log(
      `Killed ${summary.killed.label}'s process on purpose at ${summary.killed.atMs} ms.`,
    );
  if (summary.stalled)
    console.log(`Stalled ${summary.stalled.label} on purpose at ${summary.stalled.atMs} ms.`);
  console.log(
    `Admitted ${summary.admitted} of ${settings.count}; still in game before logout: ${summary.survivorsBeforeLogout}; finished in ${summary.elapsedMs} ms.`,
  );
  const expectedOut =
    settings.count - [summary.injected, summary.killed, summary.stalled].filter(Boolean).length;
  const ok =
    summary.admitted === settings.count &&
    summary.clients.filter((c) => c.state === 'logged-out').length === expectedOut &&
    summary.clients.filter((c) => ['dropped', 'failed'].includes(c.state)).length ===
      settings.count - expectedOut;
  if (!ok) process.exitCode = 1;
}

/** Validates the small command surface and starts the requested experiment. */
function main(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(HELP);
    return;
  }
  const known = [
    'run',
    'login',
    'session',
    'session-idle',
    'logout',
    'logout-abrupt',
    'observe',
    'observe-designed',
    'observe-walking',
    'supervise',
    'supervise-children',
  ];
  const options = args.length === 1 && known.includes(args[0]) ? readOptions() : undefined;
  if (options === null) {
    process.exitCode = 2;
    return;
  }
  if (args.length === 1 && ['login', 'session', 'session-idle'].includes(args[0])) {
    void runLogin(args[0], options);
    return;
  }
  if (args.length === 1 && ['observe', 'observe-designed', 'observe-walking'].includes(args[0])) {
    void runObserveCommand(options, {
      design: args[0] === 'observe-designed',
      walk: args[0] === 'observe-walking',
    });
    return;
  }
  if (args.length === 1 && args[0] === 'supervise') {
    void runSuperviseCommand(options);
    return;
  }
  if (args.length === 1 && args[0] === 'supervise-children') {
    void runSuperviseCommand(options, { children: true });
    return;
  }
  if (args.length === 1 && ['logout', 'logout-abrupt'].includes(args[0])) {
    void runLogoutCommand(args[0] === 'logout' ? 'clean' : 'abrupt', options);
    return;
  }
  if (args.length !== 1 || args[0] !== 'run') {
    console.error(
      'Expected "run", "login", "session", "session-idle", "logout", "logout-abrupt", "observe", "observe-designed", "observe-walking", "supervise", "supervise-children", or "--help". No experiment was started.',
    );
    process.exitCode = 2;
    return;
  }
  run(options);
}

main(process.argv.slice(2));
