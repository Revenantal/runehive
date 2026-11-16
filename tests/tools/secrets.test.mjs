import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['.git', 'node_modules', 'lostcity', 'dist']);

// Written so that none of these patterns match their own source text.
const PATTERNS = [
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Anthropic API key', pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI-style API key', pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'AWS access key ID', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
];

/** Yields every text file under a directory, skipping vendored and ignored folders. */
function* files(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry === '.env') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (statSync(full).size < 1_000_000) yield full;
  }
}

test('no file in the repository contains a recognizable secret', () => {
  const found = [];
  for (const file of files(root)) {
    const text = readFileSync(file, 'utf8');
    for (const { name, pattern } of PATTERNS) {
      if (pattern.test(text)) found.push(`${path.relative(root, file)}: ${name}`);
    }
  }
  assert.deepEqual(found, []);
});

test('.gitignore keeps real .env files out and .env.example in', () => {
  const ignore = readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n');
  assert.ok(ignore.includes('.env'));
  assert.ok(ignore.includes('.env.*'));
  assert.ok(ignore.includes('!.env.example'));
});

test('.env.example declares names only, never values', () => {
  const lines = readFileSync(path.join(root, '.env.example'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));
  const withValues = lines.filter((l) => /^[A-Z0-9_]+=.+/.test(l));
  assert.deepEqual(withValues, []);
});
