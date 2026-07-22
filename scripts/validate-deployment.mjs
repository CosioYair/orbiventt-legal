#!/usr/bin/env node
/**
 * validate-deployment.mjs — read-only deployment validator for orbiventt.com.
 *
 * Purpose
 *   Confirms that a given deployment of the Orbiventt public site serves every
 *   critical route correctly. It is the automated gate used while migrating
 *   hosting from GitHub Pages to Cloudflare Pages: run it against the current
 *   live site (baseline), against the future *.pages.dev preview, and again
 *   against production after cutover. It never mutates anything and never calls
 *   Supabase RPCs — the Supabase-backed preview rendering is validated manually.
 *
 * Requirements
 *   Node.js >= 18 (uses the built-in global fetch; no dependencies, no build).
 *
 * Usage
 *   node scripts/validate-deployment.mjs <baseUrl> [--compare <referenceUrl>]
 *
 *   <baseUrl>          REQUIRED. The deployment to validate. No default target.
 *   --compare <url>    OPTIONAL. A reference deployment; static routes are
 *                      compared for body parity against it.
 *
 * Examples
 *   # Live-site baseline (today, GitHub Pages):
 *   node scripts/validate-deployment.mjs https://orbiventt.com
 *
 *   # Future Cloudflare preview, compared against the live site:
 *   node scripts/validate-deployment.mjs https://orbiventt.pages.dev --compare https://orbiventt.com
 *
 *   # Post-cutover production (Cloudflare Pages serving orbiventt.com):
 *   node scripts/validate-deployment.mjs https://orbiventt.com
 *
 * Exit codes
 *   0  all required checks and critical gates passed (warnings allowed)
 *   1  at least one required check or critical gate failed
 *   2  invalid usage / malformed arguments
 *
 * This is a development and operations utility. It is NEVER part of the
 * deployed site. See PUBLIC-OUTPUT SAFETY in docs/ops/cloudflare-migration.md:
 * because production currently publishes the repository root verbatim, the
 * branch carrying this file must not be merged into main until the deployment
 * output has moved to a controlled directory (e.g. dist/) or an equivalent
 * mechanism excludes internal files from the published site.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Result accounting ────────────────────────────────────────────────────────
const rows = []; // { label, status: PASS|FAIL|WARN|MANUAL, detail }
function record(label, status, detail = '') {
  rows.push({ label, status, detail });
}
const PASS = 'PASS';
const FAIL = 'FAIL';
const WARN = 'WARN';
const MANUAL = 'MANUAL';

// ── Safe logging (never leak query strings / tokens) ─────────────────────────
function safeUrl(u) {
  const i = u.indexOf('?');
  return i === -1 ? u : u.slice(0, i) + '?<omitted>';
}

// ── Arg parsing ──────────────────────────────────────────────────────────────
function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Usage: node scripts/validate-deployment.mjs <baseUrl> [--compare <referenceUrl>]');
  console.error('  <baseUrl>        REQUIRED absolute http(s) URL of the deployment to validate.');
  console.error('  --compare <url>  OPTIONAL reference deployment for static-body parity.');
  process.exit(2);
}

function parseAbsoluteUrl(raw, name) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    usage(`${name} is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    usage(`${name} must be http(s): ${raw}`);
  }
  return parsed;
}

const argv = process.argv.slice(2);
if (argv.length === 0) usage('missing <baseUrl>');

let baseUrlRaw = null;
let compareUrlRaw = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--compare') {
    compareUrlRaw = argv[++i];
    if (!compareUrlRaw) usage('--compare requires a URL argument');
  } else if (a === '-h' || a === '--help') {
    usage();
  } else if (a.startsWith('-')) {
    usage(`unknown option: ${a}`);
  } else if (baseUrlRaw === null) {
    baseUrlRaw = a;
  } else {
    usage(`unexpected extra argument: ${a}`);
  }
}
if (baseUrlRaw === null) usage('missing <baseUrl>');

const baseUrl = parseAbsoluteUrl(baseUrlRaw, '<baseUrl>');
const compareUrl = compareUrlRaw ? parseAbsoluteUrl(compareUrlRaw, '--compare <referenceUrl>') : null;

// Strip a single trailing slash from the origin+path base for clean joins.
const base = baseUrlRaw.replace(/\/+$/, '');
const compareBase = compareUrlRaw ? compareUrlRaw.replace(/\/+$/, '') : null;
const isPagesDev = baseUrl.hostname.endsWith('.pages.dev');

// ── Branded-404 fingerprint ──────────────────────────────────────────────────
// Both markers are structural container elements of the deep-link preview
// engine in 404.html. They are load-bearing (the engine looks them up by id to
// render event/provider previews), present in the raw HTML without JS, and
// verified absent from every ordinary content page — so their joint presence
// uniquely identifies the branded 404 document.
const FP_MARKERS = ['id="eventPreview"', 'id="providerPreview"'];
function has404Fingerprint(body) {
  return FP_MARKERS.every((m) => body.includes(m));
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchRoute(baseStr, path) {
  const url = baseStr + path;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'orbiventt-deploy-validator' } });
    const body = await res.text();
    return { ok: true, status: res.status, headers: res.headers, body, url };
  } catch (err) {
    return { ok: false, status: 0, headers: null, body: '', url, error: String(err && err.message ? err.message : err) };
  }
}

function contentType(res) {
  return (res.headers && res.headers.get('content-type')) || '';
}

// ── Check definitions ────────────────────────────────────────────────────────
// A: static HTML pages (200 + text/html)
const HTML_ROUTES = [
  '/',
  '/support.html',
  '/privacy-policy.html',
  '/terms-of-service.html',
  '/delete-account.html',
  '/prensa/',
];

// B: static assets (200 + sane content-type). Prensa download filenames are
// derived from the repository at runtime below; the rest are fixed.
const ASSET_ROUTES = [
  { path: '/robots.txt', type: /text\/plain/ },
  { path: '/sitemap.xml', type: /(application|text)\/xml/ },
  { path: '/favicon.ico', type: /image\/(x-icon|vnd\.microsoft\.icon|icon)/ },
  { path: '/favicon-96x96.png', type: /image\/png/ },
  { path: '/apple-touch-icon.png', type: /image\/png/ },
  { path: '/assets/favicon.png', type: /image\/png/ },
  { path: '/assets/orbiventt-logo.png', type: /image\/png/ },
];

let overallFailed = false;
function markFail() {
  overallFailed = true;
}

// ── Parity comparison (only when --compare given) ────────────────────────────
function normalizeHtml(s) {
  // Line-ending normalization only. No whitespace stripping, no content removal.
  return s.replace(/\r\n/g, '\n');
}

async function compareBody(path, targetRes, { html }) {
  if (!compareBase) return null;
  const refRes = await fetchRoute(compareBase, path);
  if (!refRes.ok || refRes.status !== 200) {
    return { parity: WARN, detail: `reference unreachable (status ${refRes.status})` };
  }
  let a = targetRes.body;
  let b = refRes.body;
  if (html) {
    a = normalizeHtml(a);
    b = normalizeHtml(b);
  }
  if (a === b) return { parity: PASS, detail: `parity ok (${a.length} bytes)` };
  // Safe diff summary only — never dump bodies.
  let firstDiff = -1;
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) {
    if (a[i] !== b[i]) { firstDiff = i; break; }
  }
  if (firstDiff === -1) firstDiff = min;
  return {
    parity: FAIL,
    detail: `parity MISMATCH target=${a.length}B ref=${b.length}B firstDiffOffset=${firstDiff}`,
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nOrbiventt deployment validator`);
  console.log(`Target:    ${safeUrl(base)}`);
  console.log(`Reference: ${compareBase ? safeUrl(compareBase) : '(none)'}`);
  console.log(`Mode:      ${isPagesDev ? 'pages.dev (noindex header auto-checked)' : 'standard'}\n`);

  // Section A — static HTML pages
  for (const path of HTML_ROUTES) {
    const res = await fetchRoute(base, path);
    if (!res.ok) { record(`A HTML ${path}`, FAIL, res.error); markFail(); continue; }
    const ct = contentType(res);
    const ok = res.status === 200 && /text\/html/i.test(ct);
    if (ok) {
      let detail = `200 ${ct}`;
      const cmp = await compareBody(path, res, { html: true });
      if (cmp) { detail += ` | ${cmp.detail}`; if (cmp.parity === FAIL) markFail(); }
      record(`A HTML ${path}`, cmp && cmp.parity === FAIL ? FAIL : (cmp && cmp.parity === WARN ? WARN : PASS), detail);
    } else {
      record(`A HTML ${path}`, FAIL, `status=${res.status} content-type=${ct}`);
      markFail();
    }
  }

  // Section B — static assets. Derive prensa download filenames from the repo.
  const assetRoutes = ASSET_ROUTES.slice();
  try {
    const { readdir } = await import('node:fs/promises');
    const prensaFiles = await readdir(join(REPO_ROOT, 'prensa'));
    const pdf = prensaFiles.find((f) => f.toLowerCase().endsWith('.pdf'));
    const txt = prensaFiles.find((f) => f.toLowerCase().endsWith('.txt'));
    if (pdf) assetRoutes.push({ path: `/prensa/${pdf}`, type: /application\/pdf/ });
    else record('B prensa PDF', WARN, 'no .pdf found in prensa/ (skipped)');
    if (txt) assetRoutes.push({ path: `/prensa/${txt}`, type: /text\/plain/ });
    else record('B prensa TXT', WARN, 'no .txt found in prensa/ (skipped)');
  } catch (err) {
    record('B prensa downloads', WARN, `could not read prensa/ dir: ${String(err.message || err)}`);
  }

  for (const { path, type } of assetRoutes) {
    const res = await fetchRoute(base, path);
    if (!res.ok) { record(`B asset ${path}`, FAIL, res.error); markFail(); continue; }
    const ct = contentType(res);
    const ctOk = type.test(ct);
    if (res.status === 200 && ctOk) {
      let detail = `200 ${ct}`;
      const cmp = await compareBody(path, res, { html: false });
      if (cmp) { detail += ` | ${cmp.detail}`; if (cmp.parity === FAIL) markFail(); }
      record(`B asset ${path}`, cmp && cmp.parity === FAIL ? FAIL : (cmp && cmp.parity === WARN ? WARN : PASS), detail);
    } else {
      record(`B asset ${path}`, FAIL, `status=${res.status} content-type=${ct}${ctOk ? '' : ' (unexpected type)'}`);
      markFail();
    }
  }

  // Section C — CRITICAL GATE: /.well-known/assetlinks.json
  await checkAssetlinks();

  // Section D — CRITICAL GATE: branded 404 on an unmatched route
  const rand = Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  await check404(`/definitely-not-a-real-page-${rand}`, 'D unmatched-route 404');

  // Section E — deep-link stub receives the catch-all document (placeholder id).
  await check404('/e/00000000-0000-0000-0000-000000000000', 'E deep-link-stub 404');

  // pages.dev informational header check
  if (isPagesDev) {
    const res = await fetchRoute(base, '/');
    const xr = res.headers ? res.headers.get('x-robots-tag') : null;
    if (xr && /noindex/i.test(xr)) record('pages.dev X-Robots-Tag', PASS, `noindex present ("${xr}")`);
    else record('pages.dev X-Robots-Tag', WARN, xr ? `present but no noindex ("${xr}")` : 'header absent (expected on pages.dev)');
  }

  printManualSection();
  printTable();

  const exit = overallFailed ? 1 : 0;
  console.log(`\nExit code: ${exit}`);
  process.exit(exit);
}

// ── Section C implementation ─────────────────────────────────────────────────
async function checkAssetlinks() {
  const path = '/.well-known/assetlinks.json';
  // Read the repository copy as the source of truth (no hardcoded fingerprints).
  let repoJson;
  try {
    const raw = await readFile(join(REPO_ROOT, '.well-known', 'assetlinks.json'), 'utf8');
    repoJson = JSON.parse(raw);
  } catch (err) {
    record('C assetlinks (repo read)', FAIL, `cannot read/parse repo file: ${String(err.message || err)}`);
    markFail();
    return;
  }
  const expected = extractAssetlinks(repoJson);
  if (!expected) {
    record('C assetlinks (repo parse)', FAIL, 'repo assetlinks.json missing package_name or fingerprints');
    markFail();
    return;
  }

  const res = await fetchRoute(base, path);
  if (!res.ok) { record('C assetlinks', FAIL, res.error); markFail(); return; }
  const ct = contentType(res);
  if (res.status !== 200) { record('C assetlinks', FAIL, `status=${res.status}`); markFail(); return; }
  if (!/(application\/json|text\/json|application\/octet-stream)/i.test(ct) && !/json/i.test(ct)) {
    record('C assetlinks', FAIL, `unexpected content-type: ${ct}`);
    markFail();
    return;
  }
  let served;
  try {
    served = extractAssetlinks(JSON.parse(res.body));
  } catch (err) {
    record('C assetlinks', FAIL, `served body is not valid JSON: ${String(err.message || err)}`);
    markFail();
    return;
  }
  if (!served) { record('C assetlinks', FAIL, 'served JSON missing package_name or fingerprints'); markFail(); return; }

  if (served.package !== expected.package) {
    record('C assetlinks', FAIL, `package_name mismatch: served=${served.package} expected=${expected.package}`);
    markFail();
    return;
  }
  const missing = expected.fingerprints.filter((f) => !served.fingerprints.includes(f));
  if (missing.length > 0) {
    record('C assetlinks', FAIL, `missing ${missing.length} expected fingerprint(s)`);
    markFail();
    return;
  }
  record('C assetlinks', PASS, `200 ${ct} | package=${served.package} | ${expected.fingerprints.length} fingerprint(s) match`);
}

// Pull package_name + fingerprint set from an assetlinks statement list.
function extractAssetlinks(json) {
  if (!Array.isArray(json)) return null;
  for (const stmt of json) {
    const t = stmt && stmt.target;
    if (t && t.namespace === 'android_app' && Array.isArray(t.sha256_cert_fingerprints)) {
      return { package: t.package_name, fingerprints: t.sha256_cert_fingerprints.slice() };
    }
  }
  return null;
}

// ── Sections D/E implementation ──────────────────────────────────────────────
async function check404(path, label) {
  const res = await fetchRoute(base, path);
  if (!res.ok) { record(label, FAIL, res.error); markFail(); return; }
  const statusOk = res.status === 404;
  const fpOk = has404Fingerprint(res.body);
  if (statusOk && fpOk) {
    record(label, PASS, `404 + branded fingerprint present`);
  } else {
    record(label, FAIL, `status=${res.status} (want 404) fingerprint=${fpOk ? 'present' : 'MISSING'}`);
    markFail();
  }
}

// ── Manual + reporting ───────────────────────────────────────────────────────
const MANUAL_CHECKS = [
  'Public event preview /e/{id} renders from Supabase (public event)',
  'Private preview /e/{id} WITHOUT ?k= shows the protected stub',
  'Private preview /e/{id} WITH a valid ?k= token shows the limited preview',
  '/e/{id}/chat redirect flow',
  '/u/{id} profile redirect flow',
  '/p/{slug} provider preview renders',
  'Legacy /orbiventt-legal/... prefixed routes still resolve',
  '?code= is forwarded into the vyvent:// deep link (never redeemed on web)',
  'Store CTA correct on Android',
  'Store CTA correct on iOS',
  'Store/desktop CTA correct on desktop',
  'OG share card renders (WhatsApp/iMessage)',
  'HTTPS valid, certificate trusted',
  'No mixed-content warnings',
  'Direct route navigation (paste deep URL fresh) works',
  'pages.dev responses carry X-Robots-Tag: noindex (dual-hosting SEO safety)',
];

function printManualSection() {
  console.log(`\n── MANUAL VALIDATION ${'─'.repeat(40)}`);
  console.log('These require a browser / real device and are NOT auto-checked:');
  for (const m of MANUAL_CHECKS) {
    console.log(`  [ ] ${m}`);
    record(`MANUAL: ${m}`, MANUAL, 'requires manual verification');
  }
}

function printTable() {
  console.log(`\n── RESULTS ${'─'.repeat(50)}`);
  const width = rows.reduce((w, r) => Math.max(w, r.label.length), 0);
  const counts = { PASS: 0, FAIL: 0, WARN: 0, MANUAL: 0 };
  for (const r of rows) {
    counts[r.status]++;
    console.log(`  ${r.status.padEnd(6)} ${r.label.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n  Summary: ${counts.PASS} PASS  ${counts.FAIL} FAIL  ${counts.WARN} WARN  ${counts.MANUAL} MANUAL`);
}

run().catch((err) => {
  console.error(`\nFatal: ${String(err && err.stack ? err.stack : err)}`);
  process.exit(1);
});
