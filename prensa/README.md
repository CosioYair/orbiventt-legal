# Sala de prensa — Orbiventt

Public URL: **https://orbiventt.com/prensa/**
(legacy `https://cosioyair.github.io/orbiventt-legal/prensa/` now 301-redirects here)

## Source of truth

The final approved press release lives in the repository-root file **`post.txt`**.
It must never be rewritten, summarized, or edited as part of build work — every
public artifact is derived from it:

| Artifact | What it is |
|---|---|
| `prensa/index.html` | The press page (full article rendered as static HTML) |
| `prensa/Orbiventt_Nota_de_Prensa_Lanzamiento.txt` | Plain-text download (generated from `post.txt`) |
| `prensa/Orbiventt_Nota_de_Prensa_Lanzamiento.pdf` | PDF download (printed from the page's `@media print` styles) |

## Updating the press release

1. Update `post.txt` with the newly approved copy.
2. Update the article body and the embedded `#press-release-text` block in
   `prensa/index.html` to match.
3. Regenerate + validate everything:

   ```
   node scripts/build-press-release.mjs --pdf
   ```

   The script regenerates the TXT, verifies the page contains the approved text
   **verbatim** (it fails loudly on any drift), and re-prints the PDF using
   headless Edge/Chrome. Run without `--pdf` to only regenerate the TXT and
   validate. If no headless browser is available, open
   `prensa/index.html` in a browser and print to PDF (A4, no headers/footers,
   default margins) — the print stylesheet produces the same document.
4. Commit the regenerated artifacts together with the page. GitHub Pages
   deploys the repo root as-is (see `.github/workflows/deploy-pages.yml`);
   no build step runs at deploy time, so generated files must be committed.

The script is development-only; nothing in it ships to visitors.

## Media assets exposed on the page

Only official assets already in the repo, served directly from `assets/`:

- `assets/orbiventt-logo.png` — logo, PNG 1398 × 493
- `assets/favicon.png` — app icon, PNG 1024 × 1024

Additional material is offered "mediante solicitud" (by request) — do not add
placeholders. A press-kit ZIP was intentionally omitted while the kit is only
these two files.

## Notes

- The page is fully static: the complete article is in the HTML (indexable,
  readable without JavaScript). JavaScript only powers the copy/share buttons.
- Social profiles are mentioned by platform name only (per `post.txt`); no
  profile URLs existed in the project, so none were invented.
- `sitemap.xml` (repo root) lists the page; submit it in Google Search Console
  for indexing. Now that the site is served from the root of `orbiventt.com`,
  a root `robots.txt` WOULD be honored (it wasn't as a project page) — none is
  strictly needed, but one can be added later to point crawlers at the sitemap.
