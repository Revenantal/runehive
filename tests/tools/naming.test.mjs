import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEBAB_DIR = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*(\.(test|d))?\.(ts|tsx)$/;

/** Returns the naming problems for every folder and TypeScript file under a source root. */
function problems(dir, rel = path.relative(root, dir)) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    const here = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (!KEBAB_DIR.test(entry.name)) found.push(`${here}: folder names are kebab-case`);
      found.push(...problems(full, here));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !KEBAB_FILE.test(entry.name)) {
      found.push(`${here}: TypeScript file names are kebab-case`);
    }
  }
  return found;
}

test('folders and TypeScript files under packages/ and apps/ are kebab-case', () => {
  const all = ['packages', 'apps'].flatMap((d) => problems(path.join(root, d)));
  assert.deepEqual(all, []);
});

test('the kebab-case patterns accept and reject the right names', () => {
  for (const ok of ['agent-runtime.ts', 'goal.test.ts', 'types.d.ts', 'view.tsx']) {
    assert.ok(KEBAB_FILE.test(ok), ok);
  }
  for (const bad of ['AgentRuntime.ts', 'agent_runtime.ts', 'agentRuntime.ts']) {
    assert.ok(!KEBAB_FILE.test(bad), bad);
  }
  assert.ok(statSync(root).isDirectory());
});
