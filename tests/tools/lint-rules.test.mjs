import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: root });

/** Lints source text as if it lived at `file` and returns the ids of the rules that fired. */
async function rulesFired(code, file) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return result.messages.map((m) => m.ruleId);
}

const SRC = 'packages/agent-runtime/src/memory/example.ts';

test('application code may not read the wall clock, randomness, or console directly', async () => {
  const code = [
    '/** Example. */',
    'export function f(): number {',
    '  console.log("x");',
    '  const d = new Date();',
    '  return Date.now() + Math.random() + d.getTime();',
    '}',
  ].join('\n');
  const fired = await rulesFired(code, SRC);
  assert.ok(fired.includes('no-console'), fired.join());
  assert.ok(fired.filter((r) => r === 'no-restricted-properties').length >= 2, fired.join());
  assert.ok(fired.includes('no-restricted-syntax'), fired.join());
});

test('tools and tests may still use console and the clock', async () => {
  const code = '/** Example. */\nexport function f() {\n  console.log(Date.now());\n}\n';
  assert.deepEqual(await rulesFired(code, 'tools/example.mjs'), []);
});

test('default exports are rejected', async () => {
  const fired = await rulesFired('/** Example. */\nexport default function f() {}\n', SRC);
  assert.ok(fired.includes('no-restricted-exports'), fired.join());
});

test('TypeScript naming: types are PascalCase, interfaces have no I prefix, values are camelCase', async () => {
  const bad = [
    'export interface IClient { id: string }',
    'export type bad_type = string;',
    'export const Some_Value = 1;',
  ].join('\n');
  const fired = await rulesFired(bad, SRC);
  assert.equal(fired.filter((r) => r === '@typescript-eslint/naming-convention').length, 3);
  const good = [
    'export interface Client { id: string }',
    'export type ClientId = string;',
    'export const MAX_RETRIES = 3;',
    'export const clientCount = 1;',
  ].join('\n');
  assert.deepEqual(await rulesFired(good, SRC), []);
});

test('type-only imports must use import type', async () => {
  const code = 'import { Foo } from "./foo.js";\nexport const x: Foo | null = null;\n';
  const fired = await rulesFired(code, SRC);
  assert.ok(fired.includes('@typescript-eslint/consistent-type-imports'), fired.join());
});

test('functions, methods, and classes need a description', async () => {
  const code = 'export function f() {}\nexport class C {\n  m() {}\n}\n';
  const fired = await rulesFired(code, SRC);
  assert.ok(fired.filter((r) => r === 'jsdoc/require-jsdoc').length >= 3, fired.join());
});

test('any and non-null assertions are rejected', async () => {
  const code =
    '/** Example. */\nexport function f(x: any, y?: string): number {\n  return y!.length + x;\n}\n';
  const fired = await rulesFired(code, SRC);
  assert.ok(fired.includes('@typescript-eslint/no-explicit-any'), fired.join());
  assert.ok(fired.includes('@typescript-eslint/no-non-null-assertion'), fired.join());
});

test('process.env is only readable in the config module', async () => {
  const code =
    '/** Example. */\nexport function f(): string | undefined {\n  return process.env.HOME;\n}\n';
  assert.ok((await rulesFired(code, SRC)).includes('no-restricted-syntax'));
  assert.deepEqual(await rulesFired(code, 'packages/agent-runtime/src/config.ts'), []);
});
