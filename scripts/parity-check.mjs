/**
 * Detect accidental divergence between the DEV mirror and the PRODUCTION web
 * repository. Read-only: it never writes, deploys, or touches Git.
 *
 *   node scripts/parity-check.mjs --prod ../Orbiventt-legal-site
 *
 * It normalizes the four allowed environment differences (see web-env.mjs) and
 * then compares every shared file byte-for-byte. Two distinct uses:
 *
 *   • BEFORE a promotion — the report is a promotion PREVIEW: exactly what will
 *     change in production. Expected to be non-empty while a feature is being
 *     developed DEV-first.
 *   • AFTER a promotion — must be clean. Anything reported then is drift: an
 *     edit made directly in production, or a file the promotion missed.
 *
 * Exit codes: 0 = identical, 1 = differences found, 2 = usage/IO error.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  SHARED_FILES, SHARED_DIRS, ENV_ONLY_FILES, PROD_ONLY_PATHS,
  devToProd, isBinary,
} from './web-env.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const devRoot = arg('--dev', process.cwd());
const prodRoot = arg('--prod', null);

if (!prodRoot) {
  console.error('usage: node scripts/parity-check.mjs --prod <path-to-orbiventt-legal> [--dev <path>]');
  process.exit(2);
}
if (!existsSync(prodRoot)) {
  console.error(`Production repository not found: ${prodRoot}`);
  process.exit(2);
}

/** Every file under a shared directory, relative to the repo root. */
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

const sharedPaths = [...SHARED_FILES];
for (const dir of SHARED_DIRS) {
  // Union of both sides so a file added to only one repo is still reported.
  for (const p of [...walkShared(devRoot, dir), ...walkShared(prodRoot, dir)]) {
    if (!sharedPaths.includes(p)) sharedPaths.push(p);
  }
}

const differences = [];
const missingInProd = [];
const missingInDev = [];

for (const rel of sharedPaths) {
  const devPath = join(devRoot, rel);
  const prodPath = join(prodRoot, rel);
  const devExists = existsSync(devPath) && statSync(devPath).isFile();
  const prodExists = existsSync(prodPath) && statSync(prodPath).isFile();

  if (!devExists && !prodExists) continue;
  if (!prodExists) { missingInProd.push(rel); continue; }
  if (!devExists) { missingInDev.push(rel); continue; }

  if (isBinary(rel)) {
    if (!readFileSync(devPath).equals(readFileSync(prodPath))) differences.push(rel);
    continue;
  }

  const expected = devToProd(readFileSync(devPath, 'utf8')).replace(/\r\n/g, '\n');
  const actual = readFileSync(prodPath, 'utf8').replace(/\r\n/g, '\n');
  if (expected !== actual) differences.push(rel);
}

// Guard the guard: a typo'd path list would silently "pass".
if (sharedPaths.length < 15) {
  console.error(`Parity check is not covering enough files (${sharedPaths.length}) — check web-env.mjs.`);
  process.exit(2);
}

console.log(`Parity check — DEV: ${devRoot}`);
console.log(`               PROD: ${prodRoot}`);
console.log(`Compared ${sharedPaths.length} shared paths.`);
console.log(`Ignored (environment-specific): ${ENV_ONLY_FILES.join(', ')}`);
console.log(`Ignored (production-only): ${PROD_ONLY_PATHS.join(', ')}`);

const total = differences.length + missingInProd.length + missingInDev.length;
if (total === 0) {
  console.log('\nIDENTICAL — every shared file matches after environment normalization.');
  process.exit(0);
}

console.log('\nDIFFERENCES FOUND');
for (const f of differences) console.log(`  changed          ${f}`);
for (const f of missingInProd) console.log(`  only in DEV      ${f}`);
for (const f of missingInDev) console.log(`  only in PROD     ${f}  <-- unexpected: production-side drift`);
console.log(`\n${total} path(s) differ. Before a promotion this is the preview of what will change.`);
console.log('After a promotion, any output here is drift and must be explained.');
process.exit(1);
