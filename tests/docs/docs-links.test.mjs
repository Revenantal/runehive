import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'lostcity']);

function markdownFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...markdownFiles(full));
    else if (entry.endsWith('.md')) found.push(full);
  }
  return found;
}

function localTargets(text) {
  const targets = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    targets.push(target.split('#')[0]);
  }
  return targets;
}

function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}

function anchors(file) {
  return new Set(
    [...readFileSync(file, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])),
  );
}

function fragmentLinks(text) {
  const links = [];
  for (const match of text.matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(match[1])) continue;
    links.push({ target: match[1], fragment: match[2] });
  }
  return links;
}

test('every relative Markdown link points at an existing file or directory', () => {
  const broken = [];
  for (const file of markdownFiles(root)) {
    for (const target of localTargets(readFileSync(file, 'utf8'))) {
      if (target === '') continue;
      if (!existsSync(path.resolve(path.dirname(file), decodeURIComponent(target)))) {
        broken.push(`${path.relative(root, file)} -> ${target}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test('every Markdown link fragment matches a heading in its target', () => {
  const broken = [];
  for (const file of markdownFiles(root)) {
    for (const { target, fragment } of fragmentLinks(readFileSync(file, 'utf8'))) {
      const dest = target === '' ? file : path.resolve(path.dirname(file), target);
      if (!dest.endsWith('.md') || !existsSync(dest)) continue;
      if (!anchors(dest).has(fragment))
        broken.push(`${path.relative(root, file)} -> ${target}#${fragment}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('the documentation index reaches the roadmap, every guide, every standard, every system doc, and the UI design index', () => {
  const index = path.join(root, 'docs', 'README.md');
  assert.ok(existsSync(index), 'docs/README.md is missing');
  const linked = new Set(
    localTargets(readFileSync(index, 'utf8')).map((t) => path.resolve(path.dirname(index), t)),
  );
  const expected = [
    ...readdirSync(path.join(root, 'docs', 'guides')).map((f) => path.join('docs', 'guides', f)),
    ...readdirSync(path.join(root, 'docs', 'standards')).map((f) =>
      path.join('docs', 'standards', f),
    ),
    ...readdirSync(path.join(root, 'docs', 'system'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join('docs', 'system', f)),
    path.join('docs', 'roadmap.md'),
    path.join('docs', 'project-goals.md'),
    path.join('docs', 'plans', 'README.md'),
    path.join('docs', 'decisions', 'README.md'),
    path.join('docs', 'milestones', 'README.md'),
    path.join('docs', 'design', 'control-center', 'README.md'),
  ];
  const missing = expected.filter((f) => !linked.has(path.join(root, f)));
  assert.deepEqual(missing, []);
});

test('the decisions index links every decision record', () => {
  const index = path.join(root, 'docs', 'decisions', 'README.md');
  const linked = new Set(
    localTargets(readFileSync(index, 'utf8')).map((t) => path.resolve(path.dirname(index), t)),
  );
  const missing = readdirSync(path.dirname(index))
    .filter((f) => /^\d{4}-.+\.md$/.test(f))
    .filter((f) => !linked.has(path.join(path.dirname(index), f)));
  assert.deepEqual(missing, []);
});

test('the roadmap links every milestone brief', () => {
  const roadmap = path.join(root, 'docs', 'roadmap.md');
  const linked = new Set(
    localTargets(readFileSync(roadmap, 'utf8')).map((t) => path.resolve(path.dirname(roadmap), t)),
  );
  const missing = readdirSync(path.join(root, 'docs', 'milestones'))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .filter((f) => !linked.has(path.join(root, 'docs', 'milestones', f)));
  assert.deepEqual(missing, []);
});

test('AGENTS.md and CLAUDE.md exist and CLAUDE.md imports AGENTS.md', () => {
  assert.ok(existsSync(path.join(root, 'AGENTS.md')));
  assert.equal(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').trim(), '@AGENTS.md');
});
