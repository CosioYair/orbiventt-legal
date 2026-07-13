#!/usr/bin/env node
/**
 * build-press-release.mjs — development-only helper for the press room.
 *
 * Source of truth: the repository-root file `post.txt` (the final approved
 * Spanish press release). This script NEVER modifies it.
 *
 * What it does:
 *   1. Regenerates prensa/Orbiventt_Nota_de_Prensa_Lanzamiento.txt from
 *      `post.txt` (exact content, UTF-8, LF line endings).
 *   2. Validates that prensa/index.html contains the complete approved text:
 *      - the embedded "Copiar nota completa" block must match `post.txt`
 *        exactly (after newline normalization), and
 *      - every paragraph/heading of `post.txt` must appear in the rendered
 *        article body.
 *   3. With --pdf, prints the page to PDF using headless Microsoft Edge or
 *      Google Chrome (whichever is installed). The PDF uses the page's
 *      @media print stylesheet.
 *
 * Usage (from the repository root):
 *   node scripts/build-press-release.mjs          # regenerate TXT + validate
 *   node scripts/build-press-release.mjs --pdf    # also regenerate the PDF
 *
 * No production runtime dependency: this script is never loaded by the site.
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'post.txt');
const PAGE = path.join(ROOT, 'prensa', 'index.html');
const TXT_OUT = path.join(ROOT, 'prensa', 'Orbiventt_Nota_de_Prensa_Lanzamiento.txt');
const PDF_OUT = path.join(ROOT, 'prensa', 'Orbiventt_Nota_de_Prensa_Lanzamiento.pdf');

const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✅ ${msg}`);

// ── 1. Read the approved source ─────────────────────────────────────────────
if (!existsSync(SOURCE)) {
    fail(`Source file not found: ${SOURCE} — \`post.txt\` is the approved press release and must exist.`);
    process.exit(1);
}
const sourceRaw = readFileSync(SOURCE, 'utf8');
if (sourceRaw.charCodeAt(0) === 0xFEFF) {
    fail('post.txt starts with a BOM; expected plain UTF-8 without BOM.');
}
const source = sourceRaw.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');

// ── 2. Regenerate the downloadable TXT ──────────────────────────────────────
writeFileSync(TXT_OUT, source.trimEnd() + '\n', 'utf8');
ok(`TXT regenerated: ${path.relative(ROOT, TXT_OUT)} (${statSync(TXT_OUT).size} bytes)`);

// ── 3. Validate the press page ──────────────────────────────────────────────
if (!existsSync(PAGE)) {
    fail(`Press page not found: ${PAGE}`);
    process.exit(1);
}
const html = readFileSync(PAGE, 'utf8');

// 3a. The embedded copy block must equal post.txt exactly.
const blockMatch = html.match(/<script type="text\/plain" id="press-release-text">([\s\S]*?)<\/script>/);
if (!blockMatch) {
    fail('Embedded press-release text block (#press-release-text) not found in prensa/index.html.');
} else {
    const embedded = blockMatch[1].replace(/\r\n/g, '\n').trim();
    if (embedded === source.trim()) {
        ok('Embedded "Copiar nota completa" text matches post.txt exactly.');
    } else {
        fail('Embedded "Copiar nota completa" text does NOT match post.txt.');
        const a = embedded.split('\n'), b = source.trim().split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (a[i] !== b[i]) {
                console.error(`   first difference at line ${i + 1}:`);
                console.error(`   post.txt : ${JSON.stringify(b[i] ?? '<missing>')}`);
                console.error(`   embedded : ${JSON.stringify(a[i] ?? '<missing>')}`);
                break;
            }
        }
    }
}

// 3b. Every paragraph of post.txt must appear in the visible article body.
const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/);
if (!articleMatch) {
    fail('<article> element not found in prensa/index.html.');
} else {
    const articleText = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ');
    const paragraphs = source.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    // The last block groups contact lines; the "Disponibilidad" label/URL pairs
    // are also compared as normalized single-space strings.
    const missing = paragraphs.filter((p) => !articleText.includes(p));
    if (missing.length === 0) {
        ok(`Article body contains all ${paragraphs.length} paragraphs of post.txt verbatim.`);
    } else {
        for (const p of missing) fail(`Paragraph missing or altered in article body: "${p.slice(0, 90)}…"`);
    }
}

// ── 4. Optional PDF generation (development machine only) ───────────────────
if (process.argv.includes('--pdf')) {
    const browsers = [
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ].filter(existsSync);
    if (browsers.length === 0) {
        fail('No headless-capable browser (Edge/Chrome) found — export the PDF via the browser print dialog instead.');
    } else {
        const profile = mkdtempSync(path.join(tmpdir(), 'orbiventt-pdf-'));
        try {
            execFileSync(browsers[0], [
                '--headless=new',
                '--disable-gpu',
                `--user-data-dir=${profile}`,
                '--no-pdf-header-footer',
                `--print-to-pdf=${PDF_OUT}`,
                pathToFileURL(PAGE).href,
            ], { stdio: 'pipe', timeout: 60000 });
            const size = statSync(PDF_OUT).size;
            ok(`PDF regenerated: ${path.relative(ROOT, PDF_OUT)} (${(size / 1024).toFixed(0)} KB)`);
            if (size > 5 * 1024 * 1024) fail('PDF exceeds the 5 MB limit — investigate.');
        } catch (e) {
            fail(`PDF generation failed: ${e.message}`);
        } finally {
            rmSync(profile, { recursive: true, force: true });
        }
    }
}

process.exit(process.exitCode ?? 0);
