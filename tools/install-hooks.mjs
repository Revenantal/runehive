#!/usr/bin/env node
// Points Git at the tracked .githooks directory. Runs on `npm install`; failure is not fatal.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  console.log('Git hooks installed (core.hooksPath = .githooks).');
} catch {
  console.log('Skipped installing Git hooks. Run `npm run hooks:install` from a Git checkout.');
}
