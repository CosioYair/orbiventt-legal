# Orbiventt — Backend security verification (read-only)

This folder holds the manual, **read-only** verification used to confirm the
Supabase backend is safe **before connecting the `orbiventt.com` custom domain**.

## What is here

- **`prod-readonly-verification.sql`** — a diagnostic pack of `SELECT`/catalog
  queries. It **does not modify data**: no `INSERT`/`UPDATE`/`DELETE`/`ALTER`/
  `DROP`/`CREATE`/`GRANT`/`REVOKE`/`TRUNCATE`/`CALL` and no mutating `DO` blocks.
  It only reads catalog metadata and function *definitions*; it never calls
  application functions. It does **not** require the service-role key.

## How to run

1. Open the **Supabase PROD project → SQL Editor**.
2. Paste the contents of `prod-readonly-verification.sql` and run it (as the
   default SQL Editor role — no elevated/service-role credential needed).
3. Copy the full output of each numbered query.
4. Review against the criteria below **before** connecting `orbiventt.com`.

> Do not publish the raw results. Function definitions (query 9) can reveal
> backend implementation details. Share them only in a trusted channel.

## Why this matters

The public site exposes the anon (publishable) Supabase key by design. That key
is safe **only if** the backend authorizes correctly. The entire anonymous API
surface is three RPCs — `get_public_event_preview`, `get_private_event_preview`,
`get_public_provider_preview` — plus public Storage reads. This pack confirms the
anon role can reach nothing else and that those RPCs leak nothing private.

## Review criteria

**`get_public_event_preview`** — only feed-public events; **no** exact address or
latitude/longitude; no participant list; no invitation data; no private media; no
private contact info; minimal organizer identity; gallery limited to approved
public media; cannot enumerate anything beyond intentionally public events.

**`get_private_event_preview`** — requires a valid preview token; token is
verified **server-side** and **bound to that specific event**; missing/expired/
wrong-event/invalid tokens reveal nothing; private and non-existent events are
**indistinguishable** (no enumeration); no exact location; no participant or
invitation details; no private gallery; returned fields are minimal.

**`get_public_provider_preview`** — only approved public provider fields; **no**
private email/phone/address; no unnecessary account identifiers; only approved
portfolio/event info; no private-event leakage.

**Security model** — a preview RPC may be `SECURITY INVOKER` (relies on RLS/grants)
**or** `SECURITY DEFINER`. `SECURITY DEFINER` is acceptable for a controlled
preview **only if** it validates input, pins a safe `search_path` (query 8),
restricts `EXECUTE`, and selects only public columns. Do not assume one model;
evaluate whichever is in use.

**Storage** — is `event-photos` public? Can a private-event file be fetched by a
guessed/known object path? Are object paths unpredictable? Do private media need
signed URLs or a private bucket? Are avatars intentionally public? Do uploads
restrict MIME type and size? Could SVG/HTML uploads execute active content?

**Do not declare the backend safe until the real output has been reviewed.**

## Frontend fixes already applied (for cross-reference)

The pre-domain frontend hardening (F-01, F-02, F-04, F-05) is implemented in the
repo (see `404.html` and the `<meta>` CSP on every page). This backend review
(F-03) is the remaining gate before the domain launch.

## GitHub Pages header limitations (documented, not fixable here)

GitHub Pages serves static files and does **not** allow custom HTTP response
headers. Therefore the site uses a `<meta http-equiv="Content-Security-Policy">`
tag, which the browser honors for most directives. The following protections
**cannot** be delivered from this host and require a reverse proxy / different
host (e.g. Cloudflare, Netlify) to add real response headers:

- `X-Frame-Options` / CSP `frame-ancestors` (anti-clickjacking / anti-framing —
  **note:** `frame-ancestors` is *ignored* when delivered via a `<meta>` tag, so
  it is intentionally **not** in our meta CSP; framing protection needs a header)
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` /
  `Cross-Origin-Embedder-Policy`

`Referrer-Policy` **is** delivered via a supported `<meta name="referrer">` tag.
