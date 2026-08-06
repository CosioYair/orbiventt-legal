/**
 * Promote the validated DEV web implementation into the PRODUCTION repository.
 *
 *   node scripts/promote.mjs --prod ../Orbiventt-legal-site            # preview
 *   node scripts/promote.mjs --prod ../Orbiventt-legal-site --apply    # write
 *
 * It COPIES the shared file set and rewrites only the environment tokens
 * defined in web-env.mjs. It never rewrites an implementation, never touches
 * Git, and never deploys — review, commit and push stay manual.
 *
 * FAIL-CLOSED IDENTITY CHECKS (the whole point of this script)
 * Before writing anything it proves the two directories really are what the
 * operator thinks they are, so DEV and PROD configuration can never be
 * confused during a release:
 *
 *   source must look like DEV   → env.js carries the DEV Supabase ref, no CNAME
 *   target must look like PROD  → CNAME present, env.js carries the PROD ref
 *
 * env.js and robots.txt are environment-specific and are NEVER copied.
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import {
  SHARED_FILES, SHARED_DIRS, ENV_ONLY_FILES,
  DEV_SUPABASE_REF, PROD_SUPABASE_REF, devToProd, isBinary,
} from './web-env.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const devRoot = arg('--dev', process.cwd());
const prodRoot = arg('--prod', null);
const apply = process.argv.includes('--apply');

function fail(message) {
  console.error(`REFUSING TO PROMOTE: ${message}`);
  process.exit(2);
}

if (!prodRoot) fail('missing --prod <path-to-orbiventt-legal>');
if (!existsSync(prodRoot)) fail(`production repository not found: ${prodRoot}`);

// ── Identity checks ────────────────────────────────────────────────────────
const devEnvPath = join(devRoot, 'env.js');
if (!existsSync(devEnvPath)) fail('source has no env.js — it does not look like the DEV mirror.');
const devEnv = readFileSync(devEnvPath, 'utf8');
if (!devEnv.includes(DEV_SUPABASE_REF)) fail('source env.js does not carry the DEV Supabase ref.');
if (devEnv.includes(PROD_SUPABASE_REF)) fail('source env.js references the PRODUCTION project — refusing.');
if (existsSync(join(devRoot, 'CNAME'))) fail('source has a CNAME — that is a production marker.');

if (!existsSync(join(prodRoot, 'CNAME'))) fail('target has no CNAME — it does not look like production.');
const prodEnvPath = join(prodRoot, 'env.js');
if (!existsSync(prodEnvPath)) {
  fail(
    'target has no env.js. Create it once, by hand, carrying ONLY the production\n' +
    '  Supabase URL + anon key, basePath "" and devBadge false. It is\n' +
    '  environment-specific and is deliberately never copied by this script.',
  );
}
const prodEnv = readFileSync(prodEnvPath, 'utf8');
if (!prodEnv.includes(PROD_SUPABASE_REF)) fail('target env.js does not carry the PRODUCTION Supabase ref.');
if (prodEnv.includes(DEV_SUPABASE_REF)) fail('target env.js references the DEV project — refusing.');

// ── Collect the shared set ─────────────────────────────────────────────────
function walkShared(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkShared(root, rel));
    else out.push(rel.split(sep).join('/'));
  }
  return out;
}

const paths = [...SHARED_FILES];
for (const dir of SHARED_DIRS) {
  for (const p of walkShared(devRoot, dir)) if (!paths.includes(p)) paths.push(p);
}

const written = [];
const unchanged = [];
const skipped = [];

for (const rel of paths) {
  if (ENV_ONLY_FILES.includes(rel)) { skipped.push(rel); continue; }

  const from = join(devRoot, rel);
  if (!existsSync(from) || !statSync(from).isFile()) { skipped.push(`${rel} (absent in DEV)`); continue; }
  const to = join(prodRoot, rel);

  if (isBinary(rel)) {
    const buf = readFileSync(from);
    if (existsSync(to) && readFileSync(to).equals(buf)) { unchanged.push(rel); continue; }
    if (apply) { mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, buf); }
    written.push(rel);
    continue;
  }

  const next = devToProd(readFileSync(from, 'utf8'));
  if (existsSync(to) && readFileSync(to, 'utf8') === next) { unchanged.push(rel); continue; }
  if (apply) { mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, next); }
  written.push(rel);
}

// A promotion that rewrites nothing is almost certainly a wiring mistake.
if (paths.length < 15) fail(`only ${paths.length} shared paths resolved — check web-env.mjs.`);

console.log(`Promotion ${apply ? 'APPLIED' : 'PREVIEW (no files written — pass --apply)'}`);
console.log(`  from DEV : ${devRoot}`);
console.log(`  to  PROD : ${prodRoot}\n`);
for (const f of written) console.log(`  ${apply ? 'wrote  ' : 'would write'} ${f}`);
if (unchanged.length) console.log(`\n  ${unchanged.length} file(s) already identical.`);
console.log(`  ${skipped.length} environment-specific/absent file(s) skipped: ${skipped.join(', ')}`);
console.log(
  `\nNext: review the diff in the production repository, run\n` +
  `  node scripts/parity-check.mjs --prod ${prodRoot}\n` +
  `(expected: IDENTICAL), then commit and open the production PR.`,
);
