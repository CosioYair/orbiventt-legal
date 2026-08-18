/**
 * Stamp the canonical WEB_BUILD version onto every executable edge of the
 * invitation module graph — or verify that it already is.
 *
 *   node scripts/set-web-build.mjs                 # restamp with the current value
 *   node scripts/set-web-build.mjs 20260819a       # bump + restamp everything
 *   node scripts/set-web-build.mjs --check         # verify only; exit 1 on drift
 *
 * WHAT COUNTS AS AN EDGE. Three shapes, and only these three:
 *
 *   1. The entry documents' asset references (script src / stylesheet href)
 *      for the site-root scripts and the invitation entry module + base CSS.
 *   2. Every STATIC relative import in a module under `invitation/`:
 *         import { x } from './y.js?v=<BUILD>';
 *   3. Every DYNAMIC relative import in the same tree:
 *         await import('./y.js?v=<BUILD>');
 *
 * Absolute URLs never appear in the tree (paths.js exists so they cannot), and
 * the tests assert that separately — so stamping relative `.js` specifiers IS
 * stamping the whole executable graph.
 *
 * WHY A SCRIPT AND NOT HANDS. The 2026-08-18 incident's second wave was caused
 * by exactly one module being versioned while its parents were not: the stale
 * parent graph simply never imported the fresh module. Coherence across ~40
 * edges is not a thing to maintain by hand; it is a thing to generate and to
 * verify. This file is both the generator and (via --check, which the test
 * suite runs) the verifier.
 *
 * The value itself lives in ONE place — `WEB_BUILD` in scripts/web-env.mjs —
 * and this script rewrites that constant too when given a new value, so the
 * declaration and the stamps can never disagree for longer than one run.
 *
 * SCOPE GUARDS. `scripts/` is never touched (its imports run under Node, not
 * the site). `env.js` is stamped ONLY where the shared HTML references it —
 * the file itself is environment-specific and never copied. Nothing here
 * reads or writes the share thumbnail's `&v=`, which versions an image for
 * crawlers, not code for browsers.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_ENV = join(ROOT, 'scripts', 'web-env.mjs');

/* Query-safe, attribute-safe, and short enough to stay readable in a URL. */
const TOKEN_SHAPE = /^[a-z0-9][a-z0-9.-]{0,31}$/;

/* The entry-document references that participate in the build version. */
const HTML_ENTRIES = ['invitation/index.html', '404.html'];
const HTML_ASSETS = /(src|href)="(env\.js|app-return\.js|app-store-links\.js|invitation\/js\/main\.js|invitation\/css\/base\.css)(\?v=[^"]*)?"/g;

/* A relative .js specifier inside a static `from '…'` or dynamic `import('…')`. */
const IMPORT_EDGE = /((?:from\s*|import\()\s*')(\.\.?\/[^']+?\.js)(\?v=[^']*)?(')/g;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const requested = args.find((a) => a !== '--check') || null;

function fail(message) {
  console.error(`set-web-build: ${message}`);
  process.exit(checkOnly ? 1 : 2);
}

/* ── The canonical value ───────────────────────────────────────────────────── */
let envSource = readFileSync(WEB_ENV, 'utf8');
const declared = /export const WEB_BUILD = '([^']*)';/.exec(envSource);
if (!declared) fail('scripts/web-env.mjs no longer declares WEB_BUILD.');

const build = requested || declared[1];
if (!TOKEN_SHAPE.test(build)) fail(`"${build}" is not a valid build token (${TOKEN_SHAPE}).`);
if (requested && checkOnly) fail('--check takes no new value; bump first, then check.');

if (requested && requested !== declared[1]) {
  envSource = envSource.replace(declared[0], `export const WEB_BUILD = '${build}';`);
  writeFileSync(WEB_ENV, envSource);
  console.log(`WEB_BUILD: ${declared[1]} -> ${build}`);
}

/* ── The graph ─────────────────────────────────────────────────────────────── */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.js$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const moduleFiles = walk('invitation');
const drift = [];
let stamped = 0;
let filesChanged = 0;

function stampFile(rel, pattern, rebuild) {
  const abs = join(ROOT, rel);
  const before = readFileSync(abs, 'utf8');
  let touched = 0;
  const after = before.replace(pattern, (...m) => {
    const next = rebuild(...m);
    if (next !== m[0]) touched += 1;
    return next;
  });
  if (touched === 0 && before === after) return;
  if (checkOnly) {
    drift.push(`${rel}: ${touched} edge(s) not on ${build}`);
    return;
  }
  writeFileSync(abs, after);
  filesChanged += 1;
  stamped += touched;
}

for (const rel of HTML_ENTRIES) {
  stampFile(rel, HTML_ASSETS, (whole, attr, path) => `${attr}="${path}?v=${build}"`);
}
for (const rel of moduleFiles) {
  stampFile(rel, IMPORT_EDGE, (whole, head, spec, _old, tail) => `${head}${spec}?v=${build}${tail}`);
}

/* ── Verification pass (always, both modes) ────────────────────────────────── */
let edges = 0;
for (const rel of moduleFiles) {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  for (const m of source.matchAll(IMPORT_EDGE)) {
    edges += 1;
    if (m[3] !== `?v=${build}`) drift.push(`${rel}: ${m[2]}${m[3] || ''} (want ?v=${build})`);
  }
}
for (const rel of HTML_ENTRIES) {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  for (const m of source.matchAll(HTML_ASSETS)) {
    edges += 1;
    if (m[3] !== `?v=${build}`) drift.push(`${rel}: ${m[2]}${m[3] || ''} (want ?v=${build})`);
  }
}

/* A graph this small is a scan bug, not a small graph. */
if (edges < 40) fail(`only ${edges} edges found — the scan is no longer seeing the graph.`);

if (drift.length) {
  for (const line of drift) console.error(`  DRIFT ${line}`);
  fail(`${drift.length} edge(s) are not on WEB_BUILD=${build}.`);
}

console.log(
  checkOnly
    ? `COHERENT — ${edges} executable edges all on WEB_BUILD=${build}.`
    : `Stamped WEB_BUILD=${build}: ${edges} edges coherent (${stamped} rewritten in ${filesChanged} file(s)).`,
);
