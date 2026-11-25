#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { createExperimentLog } from './log.mjs';
import { login } from './login.mjs';
import { runLogoutExperiment } from './logout.mjs';
import { observeSession } from './session.mjs';

const HELP = `Experimental headless client

Usage:
  node tools/headless-experiment/cli.mjs run     Start the foreground experiment
  node tools/headless-experiment/cli.mjs login   Prompt for an account and connect
  node tools/headless-experiment/cli.mjs session  Observe 75 seconds with keepalives
  node tools/headless-experiment/cli.mjs session-idle  Observe 75 seconds without keepalives
  node tools/headless-experiment/cli.mjs logout  Click the logout button, then test relogin
  node tools/headless-experiment/cli.mjs logout-abrupt  Drop the connection, then test relogin
  node tools/headless-experiment/cli.mjs --help  Show this help

Each run writes a private JSONL log under .runehive/headless-experiment/ in the current directory.
Stop a running experiment with Ctrl-C (SIGINT) or SIGTERM.
`;

/** Keeps the placeholder process available until an operator stops it. */
function run() {
  let log;
  try {
    log = createExperimentLog(process.cwd());
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
async function runLogin(mode = 'login') {
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
    log = createExperimentLog(process.cwd());
    log.started();
    log.loginRequested();
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
    console.log(`Login requested. Run ID: ${log.runId}.`);
    const result = await login({
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

/** Runs the clean-logout or abrupt-disconnect experiment for one account. */
async function runLogoutCommand(mode) {
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
    log = createExperimentLog(process.cwd());
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
  console.log(
    `${mode === 'clean' ? 'Clean logout' : 'Abrupt disconnect'} experiment. Run ID: ${log.runId}.`,
  );
  let summary;
  try {
    summary = await runLogoutExperiment({
      account,
      mode,
      loginFn: login,
      log,
      sleep,
      now: () => performance.now(),
      signal: controller.signal,
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
  if (summary.close)
    console.log(
      `Connection ${summary.close.reason} ${summary.close.elapsedMs} ms after the request.`,
    );
  for (const r of summary.relogins)
    console.log(
      `Relogin attempt ${r.attempt} at ${r.elapsedMs} ms: ${r.outcome}${r.code === null ? '' : ` (protocol code ${r.code})`}.`,
    );
  if (summary.outcome !== 'relogin-accepted') process.exitCode = 1;
}

/** Validates the small command surface and starts the requested experiment. */
function main(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(HELP);
    return;
  }
  if (args.length === 1 && ['login', 'session', 'session-idle'].includes(args[0])) {
    void runLogin(args[0]);
    return;
  }
  if (args.length === 1 && ['logout', 'logout-abrupt'].includes(args[0])) {
    void runLogoutCommand(args[0] === 'logout' ? 'clean' : 'abrupt');
    return;
  }
  if (args.length !== 1 || args[0] !== 'run') {
    console.error(
      'Expected "run", "login", "session", "session-idle", "logout", "logout-abrupt", or "--help". No experiment was started.',
    );
    process.exitCode = 2;
    return;
  }
  run();
}

main(process.argv.slice(2));
