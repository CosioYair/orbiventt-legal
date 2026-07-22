# Orbiventt — GitHub Pages → Cloudflare Pages migration runbook

> **This document makes no changes by itself.** Every Cloudflare, GitHub,
> GoDaddy and DNS action described here is **manual**. Every production-affecting
> step is **evidence-gated**: do not proceed to the next gate until the prior
> one has produced the required evidence.
>
> **PUBLIC-OUTPUT SAFETY (locked).** Production currently publishes the
> repository root verbatim (see §1). Therefore the branch carrying this runbook
> and `scripts/validate-deployment.mjs` — `chore/cloudflare-migration-prep` —
> **must remain unmerged** while production publishes the repo root. It may be
> integrated only after the deployment output has moved to a controlled
> directory such as `dist/`, or another verified mechanism excludes
> repository-internal files (`scripts/`, `docs/`) from the published site. That
> integration is a later, separate stage — not part of this preparation packet.

---

## 1. Current-state baseline

| Fact | Value |
|---|---|
| GitHub repository | `CosioYair/orbiventt-legal` |
| Local path | `C:\Mis Proyectos\Orbiventt-legal-site` |
| Framework / build | None — pure static HTML/CSS/inline-JS, served from the repo root |
| Deploy pipeline | GitHub Actions (`.github/workflows/deploy-pages.yml`) |
| Deploy trigger | `push` to `main` (plus manual `workflow_dispatch`) |
| Published output | Repository root, verbatim (`upload-pages-artifact` with `path: .`) |
| Custom domain (`CNAME`) | `orbiventt.com` |
| Authoritative nameservers | GoDaddy (`*.domaincontrol.com`) |
| Apex A records | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages) |
| `www` | Redirects to the apex; **exact implementation TBD until the DNS inventory (§4)** |
| Domain registration | Stays at **GoDaddy permanently** — this migration moves DNS only, never the registration |
| Frozen legacy repo | The old Vyvent legal site is separate, frozen, and **not part of this migration** |

**Load-bearing routes that must survive every phase** (validated by
`scripts/validate-deployment.mjs`):

- Static pages: `/`, `/support.html`, `/privacy-policy.html`,
  `/terms-of-service.html`, `/delete-account.html`, `/prensa/`.
- Assets: `/robots.txt`, `/sitemap.xml`, favicons, `/assets/*`, prensa PDF/TXT.
- **`/.well-known/assetlinks.json`** — Android App Links (package
  `com.vyvent.mobile`, two SHA-256 fingerprints). Breaking it breaks app-link
  opening on Android. **Critical gate.**
- **`404.html` catch-all** — doubles as the deep-link preview engine for
  `/(e|u|p)/{id}[/chat]`, the legacy `/orbiventt-legal/...` prefix, `?k=`
  private-preview tokens and `?code=` invitation codes. It must be served with
  an **HTTP 404 status** on unmatched routes. **Critical gate.**

**PUBLIC-OUTPUT SAFETY restated for this repo:** the branch stays unmerged
until the published output moves to a controlled directory (e.g. `dist/`) or an
equivalent verified mechanism keeps `scripts/` and `docs/` out of production.

---

## 2. Cloudflare Pages project settings (intended)

| Setting | Intended value |
|---|---|
| Product | Cloudflare Pages |
| Plan | Free |
| Source | Git integration via the Cloudflare **GitHub App** |
| GitHub App repo access | **Only** `CosioYair/orbiventt-legal` |
| Project name | `orbiventt` |
| Expected preview hostname | `orbiventt.pages.dev` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | Blank if accepted |
| Build command fallback | `exit 0` — **only** if the current dashboard requires a value |
| Build output directory | The **exact repository-root value the dashboard accepts** |
| Environment variables | **None** during the initial static-site migration |
| Preview deployments | Enabled for non-`main` branches |

**Build output directory is provisional.** Expected candidates: `.` or `/`. Do
**not** treat either literal as final until the dashboard confirms it during
project creation. **Record whichever value the dashboard accepts.**

**Repo-privacy note (must be confirmed, not assumed).** The Cloudflare GitHub
App connection is expected to keep working after the repository becomes private,
because the app grant is per-repo and visibility-independent. This must be
**confirmed with a real post-privacy deployment test (§13)** before the
migration is declared complete.

---

## 3. Manual Cloudflare account creation

Perform in order. Record the evidence noted at the end.

1. Create a Cloudflare account on the **Free** plan.
2. Use an email you **control long-term** (this becomes the account owner).
3. Open **Workers & Pages**.
4. **Create** → **Pages** → **Connect to Git**.
5. Authorize the Cloudflare **GitHub App**.
6. Grant access to **only** `CosioYair/orbiventt-legal`.
7. Configure the project using the settings in §2.
8. **Deploy.**

**Do not** add the custom domain yet. **Do not** add the `orbiventt.com` DNS
zone yet. (Those are §5 and §7.)

**Record as evidence:**
- The `*.pages.dev` URL.
- The accepted **build-output-directory** value.
- The build result (success/fail + log summary).
- The deployment commit SHA.

---

## 4. GoDaddy DNS inventory procedure

Before **any** nameserver change, inventory every current record and setting.
Capture screenshots and/or an exported zone file — this is the rollback source
of truth.

Inventory **all** of:

- `A`, `AAAA`
- `CNAME`
- `MX`
- `TXT` (including **SPF**, **DKIM**, **DMARC**)
- `SRV`
- `NS`
- `CAA` (if present)
- **Forwarding rules** / GoDaddy **domain forwarding**
- **`www` behavior** — determine whether it is a DNS record (`CNAME`/`A`) or a
  GoDaddy **forwarding** service
- **Email records** for `contact@orbiventt.com`

Explicit warnings:

- **GoDaddy forwarding does NOT migrate automatically** when nameservers move.
  If `www` (or apex forwarding) is implemented via GoDaddy forwarding, it must
  be **recreated** in Cloudflare (see §9).
- `MX`, `SPF`, `DKIM`, `DMARC` for `contact@orbiventt.com` **must be identified
  and recreated** in the Cloudflare zone, or mail breaks at the nameserver
  switch.
- Screenshots / exported inventory **must be retained** as rollback evidence.
- **No nameserver change may occur until the inventory is reconciled** against
  what Cloudflare imports (§5).

---

## 5. Phase A — nameserver migration while GitHub Pages remains the origin

Goal: move authoritative DNS to Cloudflare **with zero content change**. The
site keeps being served by GitHub Pages throughout Phase A.

1. Add `orbiventt.com` as a **Free** Cloudflare zone.
2. Let Cloudflare **import** the existing DNS records.
3. **Compare** the imported records against the §4 GoDaddy inventory,
   record by record.
4. **Recreate** any records Cloudflare failed to import.
5. **Preserve the four GitHub Pages A records** (`185.199.108–111.153`) so
   GitHub Pages remains the content origin.
6. Keep the relevant records **DNS-only / grey-cloud** during this phase, unless
   current Cloudflare guidance requires another safe configuration.
7. **Recreate `www` behavior** (per §9 decision).
8. **Preserve all email records** (`MX`/SPF/DKIM/DMARC).
9. Obtain the **assigned Cloudflare nameservers**.
10. At GoDaddy, change **only the authoritative nameservers** to the Cloudflare
    pair.
    - **Do not** transfer the domain (registration stays at GoDaddy).
    - **Do not** disable GitHub Pages.
11. Expect **zero content change** — users continue to hit GitHub Pages.

---

## 6. Post-nameserver-switch validation (Phase A gate)

Do not proceed to Phase B until all of the following hold:

- `orbiventt.com` still resolves.
- The site still displays the **GitHub Pages** content.
- **HTTPS valid**, no certificate warnings.
- `node scripts/validate-deployment.mjs https://orbiventt.com` → **exit 0**
  (all automated gates PASS).
- `www` behavior works.
- `contact@orbiventt.com` can **receive** mail.
- `contact@orbiventt.com` can **send** mail.
- **SPF / DKIM / DMARC** continuity checked where applicable.
- **Android App Links** still open from a **real Android device**.
- `/.well-known/assetlinks.json` remains reachable (covered by the validator's
  critical gate, plus the on-device check above).

---

## 7. Phase B — Cloudflare Pages hosting cutover

Goal: switch the content origin from GitHub Pages to Cloudflare Pages, keeping
GitHub Pages fully deployed as instant rollback.

Preconditions: the **pages.dev deployment is validated first** — all critical
automated and manual gates (§ validator + §6) pass.

1. Add `orbiventt.com` as a **custom domain** on the Pages project.
2. Configure `www` using the selected strategy (§9).
3. Follow Cloudflare's **current custom-domain DNS instructions**.
4. Replace or remove the **GitHub Pages A records** only when **Cloudflare
   instructs** to.
5. Keep **GitHub Pages fully deployed** during the soak period.
6. Re-run `node scripts/validate-deployment.mjs https://orbiventt.com` → exit 0.
7. Confirm direct **deep-link routes** (`/e/{id}`, `/e/{id}/chat`, `/u/{id}`,
   `/p/{slug}`, legacy prefix).
8. Confirm **share previews** (OG cards).
9. Confirm **Android App Links** on a real device.
10. Confirm **all current public routes**.

---

## 8. Email continuity validation

Repeat after Phase B — email failure is a **blocker** for declaring cutover
complete:

- **Send** from `contact@orbiventt.com`.
- **Receive** at `contact@orbiventt.com`.
- **Reply** flow works.
- `MX` correct.
- **SPF / DKIM / DMARC** valid.
- No unexpected sender-domain changes.

---

## 9. `www` behavior recreation

Two possible strategies — the **decision is explicitly open** until the §4
GoDaddy inventory reveals how `www` currently works:

- **A. `www` as a Cloudflare Pages custom domain** — add `www.orbiventt.com` as
  a second custom domain on the Pages project.
- **B. `www` redirected to the apex** via a Cloudflare **redirect rule**.

The final behavior **must preserve the current canonical apex URL**
(`https://orbiventt.com/`). If GoDaddy currently uses a **forwarding service**
for `www`, remember it will not migrate with the nameservers and must be
recreated as A or B.

---

## 10. Rollback procedures

**Preview stage** (pages.dev only, before any DNS change):
- No user-facing rollback required — the deployment is invisible to users.
- Delete or disconnect the Pages project if abandoned.

**Phase A — nameserver rollback:**
- Restore the original GoDaddy `*.domaincontrol.com` nameservers.
- Use the retained GoDaddy zone and the §4 DNS export as the source of truth.

**Phase B — hosting rollback:**
- Remove or disable the Pages custom-domain mapping.
- Restore the four GitHub Pages A records inside **Cloudflare DNS**
  (`185.199.108–111.153`); keep TTL low so this is a minutes-scale change.
- GitHub Pages remains deployed and current throughout the soak, so rollback is
  effectively instant.

**Point of no return:** making the repository **private under GitHub Free**
means GitHub Pages can **no longer** be relied upon as rollback hosting. Do not
cross this line until §11 and §12 are satisfied.

---

## 11. Criteria before disabling GitHub Pages

All must be true:

- pages.dev validation passes.
- Phase A validation passes (§6).
- Phase B validation passes (§7).
- Soak period completed.
- Validation script **green** against production.
- Public routes verified.
- Deep-link engine verified.
- OG previews verified.
- Email continuity verified (§8).
- Android App Links verified on a **real Android device**.
- Rollback procedure documented and **conceptually tested**.
- Cloudflare production deployment **stable** over the soak.

---

## 12. Criteria before making the repository private

**All of §11**, plus:

- Explicit acknowledgment that **GitHub Pages on GitHub Free will no longer
  serve** a private repository.
- Cloudflare is the **proven production host**.
- The Cloudflare GitHub App has the **correct repository access**.
- Current `main` **deploys successfully** through Cloudflare.
- Repository-internal operational files (`scripts/`, `docs/`) are **no longer
  publicly exposed** — because the published output has moved to a controlled
  directory (e.g. `dist/`) or an equivalent protection exists. **This is also
  the precondition that lets `chore/cloudflare-migration-prep` finally be
  integrated** (PUBLIC-OUTPUT SAFETY, §1).

---

## 13. Final post-privacy deployment test

After the repo is private, prove Cloudflare still deploys:

1. Push a **trivial, safe** commit to a **non-`main`** branch.
2. Confirm Cloudflare creates a **preview deployment**.
3. After approval, push/merge a **trivial, safe** commit to `main`.
4. Confirm Cloudflare creates a **production deployment**.
5. Verify `orbiventt.com` remains healthy (run the validator).
6. Verify the repository is **private**.
7. Verify **GitHub Pages is no longer relied upon**.
8. **Record** the commit SHAs and Cloudflare deployment IDs as completion
   evidence.

---

## Appendix — the validation script

`scripts/validate-deployment.mjs` (Node ≥ 18, dependency-free, read-only):

```
node scripts/validate-deployment.mjs <baseUrl> [--compare <referenceUrl>]
```

- Baseline (today): `node scripts/validate-deployment.mjs https://orbiventt.com`
- Preview vs live: `node scripts/validate-deployment.mjs https://orbiventt.pages.dev --compare https://orbiventt.com`
- Post-cutover: `node scripts/validate-deployment.mjs https://orbiventt.com`

Exit codes: `0` all gates pass · `1` a required check/critical gate failed ·
`2` usage error. Critical gates: `assetlinks.json` (200 + JSON + package +
both repo fingerprints) and the branded-404 behavior (HTTP 404 + preview-engine
fingerprint on unmatched routes and on the deep-link stub). Supabase-backed
preview **rendering** is listed under MANUAL VALIDATION and is never called by
the script.
