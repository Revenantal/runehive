#!/usr/bin/env node
// Keeps generated documentation in sync with the front matter of milestone briefs and plans.
//
//   node tools/docs-sync.mjs           rewrite generated sections
//   node tools/docs-sync.mjs --check   exit 1 if anything is out of date or invalid
//
// Sources of truth:
//   - docs/milestones/*.md   each milestone and the named components it builds, with a status per build
//   - docs/plans/*.md        revisions: units of work that change something already roughed out or built
//
// A milestone's status is derived from its builds. Plans point at one milestone and the system docs they change.
//
// Generated sections:
//   - each milestone brief and plan: status block between <!-- status:start --> and <!-- status:end -->
//   - docs/plans/README.md: plan table between <!-- plans:start --> and <!-- plans:end -->
//   - docs/roadmap.md: milestone table between <!-- milestones:start --> and <!-- milestones:end -->
//   - system docs and the UI design index: "Built in" list between <!-- built-in --> and <!-- /built-in -->
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = {
  'not-started': 'Not started',
  'in-design': 'In design',
  'in-progress': 'In progress',
  done: 'Done',
};

export const NO_SYSTEM_DOC = 'none';

const MILESTONE_KEYS = ['id', 'title', 'delivers', 'depends_on', 'design', 'builds'];
const PLAN_KEYS = ['title', 'status', 'milestone', 'system'];

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- minimal front matter parser (a strict YAML subset, no dependencies) ----------

/** Splits text on top-level commas, ignoring commas inside quotes, brackets, and braces. */
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let inQuote = false;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      current += c;
      if (c === '\\') current += text[++i] ?? '';
      else if (c === '"') inQuote = false;
    } else if (c === '"') {
      inQuote = true;
      current += c;
    } else if (c === '[' || c === '{') {
      depth++;
      current += c;
    } else if (c === ']' || c === '}') {
      depth--;
      current += c;
    } else if (c === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += c;
  }
  if (current.trim() !== '') parts.push(current);
  return parts.map((p) => p.trim());
}

/** Parses a bare or double-quoted scalar value. */
function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) return JSON.parse(v);
  return v;
}

/** Parses an inline `[a, b]` list of scalars. */
function flowList(raw) {
  const v = raw.trim();
  if (!v.startsWith('[') || !v.endsWith(']')) throw new Error(`expected a [list], got: ${raw}`);
  return splitTop(v.slice(1, -1)).map(scalar);
}

/** Parses an inline `{ key: value }` map of scalars. */
function flowMap(raw) {
  const v = raw.trim();
  if (!v.startsWith('{') || !v.endsWith('}')) throw new Error(`expected a {map}, got: ${raw}`);
  const out = {};
  for (const pair of splitTop(v.slice(1, -1))) {
    const i = pair.indexOf(':');
    if (i < 0) throw new Error(`bad map entry: ${pair}`);
    out[pair.slice(0, i).trim()] = scalar(pair.slice(i + 1));
  }
  return out;
}

/** Separates leading `---` front matter from the document body, or returns null. */
export function splitFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  return { raw: m[1], body: text.slice(m[0].length) };
}

/** Supports `key: scalar`, `key: [a, b]`, and a block list of `- { a: b }` maps under `key:`. */
export function parseFrontMatter(raw) {
  const data = {};
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) throw new Error(`unsupported front matter line: ${line}`);
    const [, key, value] = m;
    if (value === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s+- /.test(lines[i + 1])) {
        items.push(flowMap(lines[++i].replace(/^\s+- /, '')));
      }
      data[key] = items;
    } else if (value.startsWith('[')) {
      data[key] = flowList(value);
    } else {
      data[key] = scalar(value);
    }
  }
  return data;
}

// ---------- derived values ----------

/** all done -> done; any started or finished build -> in progress; any in design -> in design; else not started. */
export function deriveStatus(builds) {
  const s = builds.map((b) => b.status);
  if (s.length > 0 && s.every((x) => x === 'done')) return 'done';
  if (s.some((x) => x === 'in-progress' || x === 'done')) return 'in-progress';
  if (s.some((x) => x === 'in-design')) return 'in-design';
  return 'not-started';
}

/** Returns the distinct system docs used by a milestone's builds. */
export function systemsOf(milestone) {
  return [
    ...new Set(milestone.data.builds.map((b) => b.system).filter((s) => s && s !== NO_SYSTEM_DOC)),
  ];
}

/** Returns the numeric part of a milestone id such as M3. */
function milestoneNumber(id) {
  return Number((id ?? 'M0').slice(1));
}

/** Returns a path relative to the project root for messages. */
function rel(root, p) {
  return path.relative(root, p);
}

/** Returns the text of the first top-level heading. */
function h1(text) {
  const m = text.match(/^# (.+)$/m);
  return m ? m[1].trim() : null;
}

// ---------- loading and validation ----------

/** Reads every Markdown file in a folder and parses its front matter. */
function readDocs(root, dir, errors, skip = []) {
  const docs = [];
  const full = path.join(root, dir);
  if (!existsSync(full)) return docs;
  for (const file of readdirSync(full)
    .filter((f) => f.endsWith('.md') && !skip.includes(f))
    .sort()) {
    const abs = path.join(full, file);
    const text = readFileSync(abs, 'utf8');
    const fm = splitFrontMatter(text);
    if (!fm) {
      errors.push(`${rel(root, abs)}: missing front matter`);
      continue;
    }
    try {
      docs.push({ file, full: abs, text, body: fm.body, data: parseFrontMatter(fm.raw) });
    } catch (error) {
      errors.push(`${rel(root, abs)}: ${error.message}`);
    }
  }
  return docs;
}

/** Records an error for each front matter key that is not allowed. */
function checkKeys(data, allowed, where, errors) {
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) errors.push(`${where}: unknown front matter key "${key}"`);
  }
}

/** Loads and validates milestones, plans, system docs, and design docs. */
export function load(root) {
  const errors = [];
  const milestones = readDocs(root, path.join('docs', 'milestones'), errors, ['README.md']);
  const plans = readDocs(root, path.join('docs', 'plans'), errors, ['README.md']);

  const systemDocs = new Map();
  const systemDir = path.join(root, 'docs', 'system');
  for (const f of readdirSync(systemDir).filter((x) => x.endsWith('.md'))) {
    const full = path.join(systemDir, f);
    systemDocs.set(f.replace(/\.md$/, ''), { full, text: readFileSync(full, 'utf8') });
  }
  const designDocs = new Map();
  const designDir = path.join(root, 'docs', 'design');
  for (const f of readdirSync(designDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const full = path.join(designDir, f.name, 'README.md');
    if (existsSync(full)) designDocs.set(f.name, { full, text: readFileSync(full, 'utf8') });
  }

  const ids = new Map();
  for (const m of milestones) {
    const d = m.data;
    const where = rel(root, m.full);
    checkKeys(d, MILESTONE_KEYS, where, errors);
    for (const key of ['id', 'title', 'delivers']) {
      if (typeof d[key] !== 'string' || d[key] === '')
        errors.push(`${where}: "${key}" is required`);
    }
    for (const key of ['depends_on', 'design', 'builds']) {
      if (!Array.isArray(d[key]))
        errors.push(`${where}: "${key}" must be a list (use [] for none, except builds)`);
    }
    if (typeof d.id === 'string') {
      if (!/^M\d+$/.test(d.id)) errors.push(`${where}: id must look like M3`);
      if (ids.has(d.id)) errors.push(`${where}: duplicate id ${d.id}`);
      ids.set(d.id, m);
    }
    if (d.title && h1(m.body) !== d.title)
      errors.push(`${where}: title does not match the "# " heading`);
    if (Array.isArray(d.builds)) {
      if (d.builds.length === 0) errors.push(`${where}: a milestone needs at least one build`);
      const names = new Set();
      for (const b of d.builds) {
        for (const key of ['name', 'system', 'status']) {
          if (!b[key]) errors.push(`${where}: each build needs "${key}"`);
        }
        if (b.status && !(b.status in STATUSES)) {
          errors.push(
            `${where}: build "${b.name}" has invalid status "${b.status}" (use ${Object.keys(STATUSES).join(', ')})`,
          );
        }
        if (b.system && b.system !== NO_SYSTEM_DOC && !systemDocs.has(b.system)) {
          errors.push(
            `${where}: build "${b.name}" uses unknown system doc "${b.system}" (use a docs/system name or "${NO_SYSTEM_DOC}")`,
          );
        }
        if (names.has(b.name)) errors.push(`${where}: duplicate build "${b.name}"`);
        names.add(b.name);
      }
    }
  }
  milestones.sort((a, b) => milestoneNumber(a.data.id) - milestoneNumber(b.data.id));

  for (const m of milestones) {
    const d = m.data;
    const where = rel(root, m.full);
    for (const dep of d.depends_on ?? []) {
      if (!ids.has(dep)) errors.push(`${where}: depends_on ${dep} does not exist`);
      if (dep === d.id) errors.push(`${where}: depends on itself`);
    }
    for (const s of d.design ?? [])
      if (!designDocs.has(s)) errors.push(`${where}: unknown design "${s}"`);
  }

  for (const p of plans) {
    const d = p.data;
    const where = rel(root, p.full);
    checkKeys(d, PLAN_KEYS, where, errors);
    for (const key of ['title', 'status', 'milestone']) {
      if (typeof d[key] !== 'string' || d[key] === '')
        errors.push(`${where}: "${key}" is required`);
    }
    if (!Array.isArray(d.system))
      errors.push(`${where}: "system" must be a list (use [] for none)`);
    if (d.status && !(d.status in STATUSES))
      errors.push(
        `${where}: status "${d.status}" must be one of ${Object.keys(STATUSES).join(', ')}`,
      );
    if (d.milestone && !ids.has(d.milestone))
      errors.push(`${where}: milestone ${d.milestone} does not exist`);
    for (const s of d.system ?? [])
      if (!systemDocs.has(s)) errors.push(`${where}: unknown system doc "${s}"`);
    if (d.title && h1(p.body) !== d.title)
      errors.push(`${where}: title does not match the "# " heading`);
  }
  plans.sort(
    (x, y) =>
      milestoneNumber(x.data.milestone) - milestoneNumber(y.data.milestone) ||
      x.file.localeCompare(y.file),
  );

  return { milestones, plans, systemDocs, designDocs, ids, errors };
}

// ---------- rendering ----------

/** Replaces the text between two marker comments, or throws if a marker is missing. */
function replaceBetween(text, start, end, content, where) {
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < 0 || j < i) throw new Error(`${where}: missing ${start} … ${end} markers`);
  return text.slice(0, i + start.length) + content + text.slice(j);
}

/** Renders a link to a system doc, or a dash when there is none. */
function sysLink(ctx, name, prefix) {
  return name === NO_SYSTEM_DOC
    ? '—'
    : `[${h1(ctx.systemDocs.get(name).text)}](${prefix}${name}.md)`;
}

/** Summarizes how many builds are done, such as "1/3 done". */
function buildsSummary(builds) {
  const done = builds.filter((b) => b.status === 'done').length;
  return `${done}/${builds.length} done`;
}

/** Summarizes open and finished plans for the roadmap. */
function revisionsSummary(plans) {
  if (plans.length === 0) return '—';
  const open = plans.filter((p) => p.data.status !== 'done').length;
  return open > 0 ? `${open} open` : `${plans.length} done`;
}

/** Returns the plans that point at a milestone. */
function plansOf(ctx, m) {
  return ctx.plans.filter((p) => p.data.milestone === m.data.id);
}

/** Renders the generated status block for a milestone brief. */
function milestoneBlock(m, ctx) {
  const d = m.data;
  const dep = d.depends_on.length
    ? d.depends_on.map((id) => `[${id}](${ctx.ids.get(id).file})`).join(', ')
    : 'None';
  const lines = [
    '',
    `- **Status:** ${STATUSES[deriveStatus(d.builds)]} (from its builds)`,
    `- **Depends on:** ${dep}`,
  ];
  if (d.design.length) {
    lines.push(
      `- **Design:** ${d.design.map((s) => `[${h1(ctx.designDocs.get(s).text)}](../design/${s}/README.md)`).join(', ')}`,
    );
  }
  lines.push('', '**Builds**', '', '| Component | System doc | Status |', '|---|---|---|');
  for (const b of d.builds)
    lines.push(`| ${b.name} | ${sysLink(ctx, b.system, '../system/')} | ${STATUSES[b.status]} |`);
  lines.push('', "**Plans** (revisions to this milestone's builds)", '');
  const mine = plansOf(ctx, m);
  if (mine.length === 0) {
    lines.push(
      'No plans yet. Add one in `docs/plans/` when something needs to change (see the [plans guide](../plans/README.md)).',
    );
  } else {
    lines.push('| Plan | Status |', '|---|---|');
    for (const p of mine)
      lines.push(`| [${p.data.title}](../plans/${p.file}) | ${STATUSES[p.data.status]} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Renders the roadmap milestone table. */
function roadmapTable(ctx) {
  const rows = [
    '',
    '| Milestone | Status | Builds | Revisions | What it delivers |',
    '|---|---|---|---|---|',
  ];
  for (const m of ctx.milestones) {
    const d = m.data;
    rows.push(
      `| ${d.id} · [${d.title}](milestones/${m.file}) | ${STATUSES[deriveStatus(d.builds)]} | ${buildsSummary(d.builds)} | ${revisionsSummary(plansOf(ctx, m))} | ${d.delivers} |`,
    );
  }
  rows.push('');
  return rows.join('\n');
}

/** Renders the generated status block for a plan. */
function planBlock(p, ctx) {
  const d = p.data;
  const m = ctx.ids.get(d.milestone);
  const sys = d.system.length
    ? d.system.map((n) => sysLink(ctx, n, '../system/')).join(', ')
    : 'None';
  return [
    '',
    `- **Status:** ${STATUSES[d.status]}`,
    `- **Milestone:** [${d.milestone} · ${m.data.title}](../milestones/${m.file})`,
    `- **System docs changed:** ${sys}`,
    '',
  ].join('\n');
}

/** Renders the table of all plans. */
function plansIndex(ctx) {
  if (ctx.plans.length === 0) return '\nNo plans yet.\n';
  const rows = ['', '| Plan | Milestone | Status | System docs changed |', '|---|---|---|---|'];
  for (const p of ctx.plans) {
    const d = p.data;
    const m = ctx.ids.get(d.milestone);
    const sys = d.system.length
      ? d.system.map((n) => sysLink(ctx, n, '../system/')).join(', ')
      : '—';
    rows.push(
      `| [${d.title}](${p.file}) | [${d.milestone}](../milestones/${m.file}) | ${STATUSES[d.status]} | ${sys} |`,
    );
  }
  rows.push('');
  return rows.join('\n');
}

/** Renders the "Built in" milestone links for a system or design doc. */
function builtIn(ctx, test, prefix) {
  const hits = ctx.milestones.filter(test);
  return hits.length
    ? hits.map((m) => `[${m.data.id}](${prefix}${m.file})`).join(', ')
    : 'no milestone yet';
}

/** Returns Map<absolute path, desired contents> for every generated file. */
export function render(root, ctx) {
  const out = new Map();
  for (const m of ctx.milestones) {
    out.set(
      m.full,
      replaceBetween(
        m.text,
        '<!-- status:start -->',
        '<!-- status:end -->',
        milestoneBlock(m, ctx),
        rel(root, m.full),
      ),
    );
  }
  for (const p of ctx.plans) {
    out.set(
      p.full,
      replaceBetween(
        p.text,
        '<!-- status:start -->',
        '<!-- status:end -->',
        planBlock(p, ctx),
        rel(root, p.full),
      ),
    );
  }
  const plansReadme = path.join(root, 'docs', 'plans', 'README.md');
  out.set(
    plansReadme,
    replaceBetween(
      readFileSync(plansReadme, 'utf8'),
      '<!-- plans:start -->',
      '<!-- plans:end -->',
      plansIndex(ctx),
      'docs/plans/README.md',
    ),
  );
  const roadmapPath = path.join(root, 'docs', 'roadmap.md');
  out.set(
    roadmapPath,
    replaceBetween(
      readFileSync(roadmapPath, 'utf8'),
      '<!-- milestones:start -->',
      '<!-- milestones:end -->',
      roadmapTable(ctx),
      'docs/roadmap.md',
    ),
  );
  for (const [name, doc] of ctx.systemDocs) {
    out.set(
      doc.full,
      replaceBetween(
        doc.text,
        '<!-- built-in -->',
        '<!-- /built-in -->',
        builtIn(ctx, (m) => systemsOf(m).includes(name), '../milestones/'),
        rel(root, doc.full),
      ),
    );
  }
  for (const [name, doc] of ctx.designDocs) {
    out.set(
      doc.full,
      replaceBetween(
        doc.text,
        '<!-- built-in -->',
        '<!-- /built-in -->',
        builtIn(ctx, (m) => m.data.design.includes(name), '../../milestones/'),
        rel(root, doc.full),
      ),
    );
  }
  return out;
}

/** Regenerates generated docs, or only checks them when `check` is true. Returns an exit code. */
export function sync({ root = defaultRoot, check = false, log = console.log } = {}) {
  const ctx = load(root);
  if (ctx.errors.length) {
    for (const e of ctx.errors) log(`error: ${e}`);
    return 1;
  }
  let desired;
  try {
    desired = render(root, ctx);
  } catch (error) {
    log(`error: ${error.message}`);
    return 1;
  }
  const stale = [];
  for (const [file, text] of desired) {
    if (readFileSync(file, 'utf8') !== text) {
      stale.push(rel(root, file));
      if (!check) writeFileSync(file, text);
    }
  }
  if (check) {
    if (stale.length) {
      log(`Out of date (run: npm run docs:sync):\n  ${stale.join('\n  ')}`);
      return 1;
    }
    log('Generated docs are up to date.');
    return 0;
  }
  log(stale.length ? `Updated:\n  ${stale.join('\n  ')}` : 'Nothing to update.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = sync({ check: process.argv.includes('--check') });
}
