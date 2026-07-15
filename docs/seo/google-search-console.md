# Google Search Console — manual setup checklist (orbiventt.com)

One-time, manual steps to get `orbiventt.com` indexed. None of this can be
automated from the repository; it requires the Google account that will own
the property and access to the GoDaddy DNS panel.

> Never commit the DNS verification token, credentials, or any Search Console
> export to this repository.

## 1. Create the property

1. Open <https://search.google.com/search-console> with the owner account.
2. Add a **Domain** property (not URL-prefix) for: `orbiventt.com`.
   A Domain property covers `https://`, `http://`, `www.` and all paths at once.

## 2. Verify ownership via DNS

1. Search Console shows a **TXT** value like `google-site-verification=…`.
2. In **GoDaddy → DNS for orbiventt.com**, add a new **TXT** record:
   - Host/Name: `@`
   - Value: the exact string Google shows
   - TTL: default
3. **Do not delete or edit** the existing records that serve the website
   (the GitHub Pages `A`/`AAAA`/`CNAME` records) or any email (MX) records.
4. Back in Search Console, press **Verify** (DNS can take minutes to hours to
   propagate; retry later if it fails the first time).

## 3. Submit the sitemap

1. Search Console → **Sitemaps**.
2. Submit: `https://orbiventt.com/sitemap.xml`
3. Confirm status becomes **Success** and 6 URLs are discovered.

## 4. Inspect and request indexing

1. Use **URL Inspection** on `https://orbiventt.com/`.
2. Check **View crawled page** → the rendered HTML must show the H1 and the
   product description, and **User-declared canonical** must be
   `https://orbiventt.com/`.
3. Press **Request indexing** for, in this order:
   - `https://orbiventt.com/`
   - `https://orbiventt.com/prensa/`
   - `https://orbiventt.com/support.html`

## 5. Monitor (first weeks)

Check periodically under the property:

- **Indexing → Pages** (which URLs are indexed / why some are excluded)
- **Experience → HTTPS** and **Core Web Vitals**
- **Sitemaps** (stays green after redeploys)
- **Enhancements / structured data** reports (Organization / SoftwareApplication /
  Article detections and any errors)
- **Security & Manual Actions** (should both stay empty)

## 6. Expectations

- Do **not** re-request indexing every day — once per URL is enough; repeat
  only after a meaningful content change.
- A brand-new domain typically takes **days to a few weeks** to appear, and
  brand queries ("orbiventt") may show the app stores first until Google
  learns the official site. The sitemap + structured data + press coverage
  linking to `orbiventt.com` are what accelerate that.
- Rich results are never guaranteed; the structured data here is intentionally
  truthful (no ratings/reviews), which may limit some rich-result types.
