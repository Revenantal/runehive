import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { STATUSES, deriveStatus, parseFrontMatter, sync } from '../../tools/docs-sync.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Copy just the docs tree so a test can break it without touching the real files. */
function scratchDocs() {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-sync-'));
  cpSync(path.join(root, 'docs'), path.join(dir, 'docs'), { recursive: true });
  return dir;
}

function run(dir, check = true) {
  const lines = [];
  const code = sync({ root: dir, check, log: (l) => lines.push(l) });
  return { code, out: lines.join('\n') };
}

const read = (dir, ...p) => readFileSync(path.join(dir, ...p), 'utf8');

/** Rewrite one file in a scratch copy; throws if the expected text is not there. */
function edit(dir, file, from, to) {
  const full = path.join(dir, file);
  const text = readFileSync(full, 'utf8');
  assert.ok(text.includes(from), `${file} does not contain: ${from}`);
  writeFileSync(full, text.replace(from, to));
}

const b = (...status) => status.map((s) => ({ status: s }));

test('the statuses are not-started, in-design, in-progress, and done, in that order', () => {
  assert.deepEqual(Object.keys(STATUSES), ['not-started', 'in-design', 'in-progress', 'done']);
});

test('a milestone status is derived from its builds', () => {
  assert.equal(deriveStatus(b('not-started', 'not-started')), 'not-started');
  assert.equal(deriveStatus(b('not-started', 'in-design')), 'in-design');
  assert.equal(deriveStatus(b('in-design', 'in-progress')), 'in-progress');
  assert.equal(deriveStatus(b('done', 'in-design')), 'in-progress');
  assert.equal(deriveStatus(b('done', 'done')), 'done');
  assert.equal(deriveStatus([]), 'not-started');
});

test('front matter parser reads scalars, quoted strings, lists, and block lists of maps', () => {
  const data = parseFrontMatter(
    [
      'id: M3',
      'title: "Build it, now: please"',
      'depends_on: [M1, M2]',
      'design: []',
      'builds:',
      '  - { name: "Plan, one", system: architecture, status: in-design }',
      '  - { name: Two, system: none, status: done }',
    ].join('\n'),
  );
  assert.equal(data.title, 'Build it, now: please');
  assert.deepEqual(data.depends_on, ['M1', 'M2']);
  assert.deepEqual(data.design, []);
  assert.deepEqual(data.builds, [
    { name: 'Plan, one', system: 'architecture', status: 'in-design' },
    { name: 'Two', system: 'none', status: 'done' },
  ]);
});

test('the committed docs are in sync with the front matter', () => {
  const { code, out } = run(root);
  assert.equal(code, 0, out);
});

test('changing a build status updates the milestone, the roadmap, and nothing is stale after sync', () => {
  const dir = scratchDocs();
  try {
    edit(
      dir,
      'docs/milestones/execution.md',
      'name: "Banking workflow", system: architecture, status: in-design',
      'name: "Banking workflow", system: architecture, status: in-progress',
    );
    const stale = run(dir);
    assert.equal(stale.code, 1);
    assert.match(stale.out, /docs\/milestones\/execution\.md/);
    assert.match(stale.out, /docs\/roadmap\.md/);

    assert.equal(run(dir, false).code, 0);
    assert.equal(run(dir).code, 0);
    assert.match(read(dir, 'docs/roadmap.md'), /execution\.md\) \| In progress \| 0\/4 done \|/);
    assert.match(
      read(dir, 'docs/milestones/execution.md'),
      /\| Banking workflow \| .*\| In progress \|/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('finishing every build marks the milestone done in the roadmap', () => {
  const dir = scratchDocs();
  try {
    const file = path.join(dir, 'docs/milestones/project-setup.md');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replaceAll('status: in-progress', 'status: done'),
    );
    assert.equal(run(dir, false).code, 0);
    assert.match(read(dir, 'docs/roadmap.md'), /project-setup\.md\) \| Done \| 3\/3 done \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PLAN = [
  '---',
  'title: "Revisit the init command"',
  'status: in-design',
  'milestone: M0',
  'system: [lostcity-and-headless-client]',
  '---',
  '# Revisit the init command',
  '',
  '<!-- status:start -->',
  '<!-- status:end -->',
  '',
].join('\n');

test('a plan against a finished milestone shows in its brief, the roadmap, and the plans index', () => {
  const dir = scratchDocs();
  try {
    const brief = path.join(dir, 'docs/milestones/project-setup.md');
    writeFileSync(
      brief,
      readFileSync(brief, 'utf8').replaceAll('status: in-progress', 'status: done'),
    );
    const plan = path.join(dir, 'docs/plans/revisit-init.md');
    writeFileSync(plan, PLAN);

    assert.equal(run(dir, false).code, 0);
    assert.equal(run(dir).code, 0);

    assert.match(
      read(dir, 'docs/milestones/project-setup.md'),
      /\| \[Revisit the init command\]\(\.\.\/plans\/revisit-init\.md\) \| In design \|/,
    );
    assert.match(
      read(dir, 'docs/roadmap.md'),
      /project-setup\.md\) \| Done \| 3\/3 done \| 1 open \|/,
    );
    assert.match(
      read(dir, 'docs/plans/README.md'),
      /\| \[Revisit the init command\]\(revisit-init\.md\) \| \[M0\]\(\.\.\/milestones\/project-setup\.md\) \| In design \|/,
    );
    const planText = read(dir, 'docs/plans/revisit-init.md');
    assert.match(planText, /\*\*Milestone:\*\* \[M0 · Project organization and setup\]/);
    assert.match(planText, /\*\*System docs changed:\*\* \[LostCity and the Headless Client\]/);

    // Finishing the plan updates every view.
    writeFileSync(plan, planText.replace('status: in-design', 'status: done'));
    assert.equal(run(dir, false).code, 0);
    assert.match(read(dir, 'docs/roadmap.md'), /\| 3\/3 done \| 1 done \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a plan with a bad milestone, status, system doc, title, key, or missing markers is rejected', () => {
  const dir = scratchDocs();
  try {
    const plan = path.join(dir, 'docs/plans/bad.md');
    for (const [from, to, message] of [
      ['milestone: M0', 'milestone: M99', /milestone M99 does not exist/],
      ['status: in-design', 'status: blocked', /status "blocked" must be one of/],
      ['system: [lostcity-and-headless-client]', 'system: [nope]', /unknown system doc "nope"/],
      ['title: "Revisit the init command"', 'title: "Something else"', /title does not match/],
      [
        'system: [lostcity-and-headless-client]',
        'system: []\nkind: revisit',
        /unknown front matter key "kind"/,
      ],
      ['<!-- status:start -->\n<!-- status:end -->\n', '', /missing <!-- status:start -->/],
    ]) {
      assert.ok(PLAN.includes(from), from);
      writeFileSync(plan, PLAN.replace(from, to));
      const { code, out } = run(dir);
      assert.equal(code, 1);
      assert.match(out, message);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid builds, dependencies, designs, and leftover fields are rejected', () => {
  const dir = scratchDocs();
  try {
    const brief = 'docs/milestones/goal.md';
    const original = read(dir, brief);
    for (const [from, to, message] of [
      [
        'status: in-design }',
        'status: blocked }',
        /build "Goal and prerequisite model with hypothesis status" has invalid status "blocked"/,
      ],
      ['depends_on: [M6]', 'depends_on: [M99]', /depends_on M99 does not exist/],
      ['design: []', 'design: [nope]', /unknown design "nope"/],
      [
        'system: architecture, status: in-design }',
        'system: nope, status: in-design }',
        /unknown system doc "nope"/,
      ],
      ['design: []', 'design: []\nstatus: done', /unknown front matter key "status"/],
      ['design: []', 'design: []\nsystem: [architecture]', /unknown front matter key "system"/],
    ]) {
      assert.ok(original.includes(from), from);
      writeFileSync(path.join(dir, brief), original.replace(from, to));
      const { code, out } = run(dir);
      assert.equal(code, 1, `${from} -> ${to}`);
      assert.match(out, message);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a milestone with no builds is rejected', () => {
  const dir = scratchDocs();
  try {
    const file = path.join(dir, 'docs/milestones/goal.md');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(/builds:\n( {2}- .*\n)+/, 'builds: []\n'),
    );
    const { code, out } = run(dir);
    assert.equal(code, 1);
    assert.match(out, /a milestone needs at least one build/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
