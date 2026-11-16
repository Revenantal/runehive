#!/usr/bin/env node
// Validates a commit message: Conventional Commits 1.0.0 header, and no co-author or tool attribution.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

const HEADER = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?(!)?: \\S.*$`);
const MAX_HEADER = 72;
const FORBIDDEN = [
  { pattern: /^co-authored-by:/im, message: 'remove the Co-authored-by trailer' },
  { pattern: /generated (with|by)\b/i, message: 'remove the "generated with/by" attribution' },
  { pattern: /noreply@(anthropic|openai)\.com/i, message: 'remove the tool attribution address' },
  { pattern: /🤖/u, message: 'remove the robot attribution marker' },
];

/**
 * Returns a list of problems with a commit message, empty when it is acceptable.
 * @param {string} message Full commit message text.
 * @returns {string[]} Human-readable problems.
 */
export function validateCommitMessage(message) {
  const lines = message.split('\n').filter((line) => !line.startsWith('#'));
  const header = (lines[0] ?? '').trim();
  const problems = [];
  if (/^(Merge|Revert) /.test(header)) return problems;
  if (!HEADER.test(header)) {
    problems.push(
      `header must be "<type>(<scope>)?: <description>" with type one of ${TYPES.join(', ')} (got: "${header}")`,
    );
  } else if (header.length > MAX_HEADER) {
    problems.push(`header is ${header.length} characters; keep it to ${MAX_HEADER} or fewer`);
  }
  if (lines.length > 1 && (lines[1] ?? '').trim() !== '') {
    problems.push('leave a blank line between the header and the body');
  }
  const body = lines.join('\n');
  for (const { pattern, message: text } of FORBIDDEN) {
    if (pattern.test(body)) problems.push(text);
  }
  return problems;
}

/**
 * Reads the commit message file Git passes to the hook and exits non-zero on problems.
 * @param {string[]} argv Command-line arguments after the script name.
 * @returns {number} Process exit code.
 */
function main(argv) {
  const file = argv[0];
  if (!file) {
    console.error('usage: check-commit-msg.mjs <commit-message-file>');
    return 2;
  }
  const problems = validateCommitMessage(readFileSync(file, 'utf8'));
  if (problems.length === 0) return 0;
  console.error('Commit message rejected (see docs/standards/git-workflow.md):');
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
