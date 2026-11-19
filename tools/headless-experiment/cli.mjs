#!/usr/bin/env node
import { createExperimentLog } from './log.mjs';

const HELP = `Experimental headless client (no game connection yet)

Usage:
  node tools/headless-experiment/cli.mjs run     Start the foreground experiment
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

/** Validates the small command surface and starts the requested experiment. */
function main(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(HELP);
    return;
  }
  if (args.length !== 1 || args[0] !== 'run') {
    console.error('Expected "run" or "--help". No experiment was started.');
    process.exitCode = 2;
    return;
  }
  run();
}

main(process.argv.slice(2));
