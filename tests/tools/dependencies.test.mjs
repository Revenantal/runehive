import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (...p) => JSON.parse(readFileSync(path.join(root, ...p), 'utf8'));

/** Every package.json in the workspace: the root plus each package and app. */
function manifests() {
  const found = [['package.json', readJson('package.json')]];
  for (const group of ['packages', 'apps']) {
    for (const entry of readdirSync(path.join(root, group), { withFileTypes: true })) {
      const file = path.join(group, entry.name, 'package.json');
      if (entry.isDirectory() && existsSync(path.join(root, file)))
        found.push([file, readJson(file)]);
    }
  }
  return found;
}

test('dependencies use exact versions, except references to our own workspace packages', () => {
  const exact = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
  const bad = [];
  for (const [file, manifest] of manifests()) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        const internal = name.startsWith('@runehive/') && range === '*';
        if (!internal && !exact.test(range)) bad.push(`${file}: ${name}@${range}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('.npmrc saves exact versions and the lockfile is committed and current', () => {
  assert.match(readFileSync(path.join(root, '.npmrc'), 'utf8'), /^save-exact=true$/m);
  const lock = readJson('package-lock.json');
  const paths = Object.keys(lock.packages);
  assert.ok(!paths.some((p) => p.includes('runescape-ai')), 'lockfile references a removed path');
  for (const [file] of manifests().slice(1)) {
    assert.ok(paths.includes(path.dirname(file)), `lockfile is missing workspace ${file}`);
  }
});

/** True when an SPDX expression is satisfied by the allowlist. */
function licenseAllowed(expression, allowed) {
  const text = expression.replace(/[()]/g, '').trim();
  if (text.includes(' OR ')) return text.split(' OR ').some((l) => allowed.has(l.trim()));
  if (text.includes(' AND ')) return text.split(' AND ').every((l) => allowed.has(l.trim()));
  return allowed.has(text);
}

test('every installed package has an allowed license', () => {
  const policy = readJson('tools', 'allowed-licenses.json');
  const allowed = new Set(policy.allowed);
  const lock = readJson('package-lock.json');
  const bad = [];
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (location === '' || /^(packages|apps)\//.test(location) || entry.link) continue;
    const name = location.split('node_modules/').pop();
    if (name in policy.exceptions) continue;
    if (!entry.license || !licenseAllowed(entry.license, allowed)) {
      bad.push(`${name}@${entry.version}: ${entry.license ?? 'no license listed'}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the license helper handles OR and AND expressions', () => {
  const allowed = new Set(['MIT', 'ISC']);
  assert.ok(licenseAllowed('MIT', allowed));
  assert.ok(licenseAllowed('(GPL-3.0 OR MIT)', allowed));
  assert.ok(!licenseAllowed('(MIT AND GPL-3.0)', allowed));
  assert.ok(!licenseAllowed('GPL-3.0', allowed));
});
