# Digital invitations — web renderer

The page that draws an Orbiventt digital invitation, served at `/invitation/`.

Plain HTML, CSS and ES modules. No framework, no bundler, no build step, no
Node runtime in the deployed site, no server-side rendering. It is copied
verbatim into the production repository by `scripts/promote.mjs` (the whole
directory is registered in `SHARED_DIRS`), so **nothing here may contain a
deployment-specific value**.

---

## Milestone status

**Milestone A (this commit range): the demonstration route only.**

`?demo=…` renders bundled data. There is no database table, no RPC, no
migration, no editor and no network call of any kind — `connect-src 'none'` in
the page's CSP means the browser would refuse one. The draft and published
routes are recognized and answer with a controlled "not available" state; they
are not simulated, and no mock payload exists.

Milestone B replaces two branches in `js/main.js` with real lookups and widens
exactly two CSP directives (`connect-src`, `img-src`). Everything else below
already renders real invitations.

---

## Routes

| Query | Mode | Status |
|---|---|---|
| `?demo={registryId}` | demo | **implemented** — bundled data |
| `?d={invitationId}&t={previewToken}` | draft | reserved |
| `?i={slug}` | published | reserved |
| `?i={slug}&code={smartInvitationCode}` | published + pass claim | reserved |

Live demonstration: `/invitation/?demo=wedding_romantic_v1`

`?code=` is read in every mode and validated with the same rule the mobile app
and `app-return.js` use (`^[A-Za-z0-9-]{1,20}$`). The "Reclamar pases" section
renders **only** when a valid-looking code is present; in demo mode it is an
explainer badged as a demonstration and claims nothing.

---

## Layout

```
invitation/
  index.html                     page shell, CSP, generic Open Graph metadata
  package.json                   marks js/**/*.js as ESM for Node's test runner
  css/base.css                   template-agnostic shell, states, a11y helpers
  js/
    main.js                      browser bootstrap: route → data → render
    route.js                     query parsing + mode resolution
    registry.js                  closed, statically-imported template registry
    config.js                    THE CONFIGURATION CONTRACT (version 1)
    demo-data.js                 bundled demonstration configurations
    renderer.js                  the shared render engine
    security.js                  sanitizing, URL + image validation, limits
    dom.js                       safe element construction (no innerHTML)
    paths.js                     base-path-independent URL resolution
    countdown.js                 countdown arithmetic (pure)
    calendar.js                  RFC 5545 .ics generation (pure)
    sections/                    one renderer per section + the section table
  templates/
    wedding-romantic/
      template.js                descriptor: identity, section order, stylesheet
      template.css               the visual layer, scoped to the theme class
  assets/
    og-invitation.jpg            generic, category-neutral link-preview card
    demo/wedding-romantic/*.svg  demonstration artwork (authored here)
```

**Adding a template** = a new directory under `templates/`, a static import in
`js/registry.js`, and nothing else. Section renderers are shared, so every
template inherits the same escaping, URL validation and image resolution.

---

## Deployment-path independence

The module is served from two roots:

- DEV `https://orbiventt.com/invitation/`
- PROD `https://orbiventt.com/invitation/`

Neither string appears in the module tree. Assets, stylesheets and templates are
resolved relative to `import.meta.url` (`js/paths.js`), and the page's own
relative URLs resolve through the single `<base>` tag that `devToProd()`
rewrites. The only absolute origins in the whole directory are the two Open
Graph tags in `index.html`, which crawlers require to be absolute — and those
are normalized by `DEV_SITE_ORIGIN` / `PROD_SITE_ORIGIN` in
`scripts/web-env.mjs`.

---

## Configuration contract — version 1

> **The full field-source matrix — every visible element, its config path, its
> editor control, its validation and whether it is organizer content or template
> UI copy — lives in [FIELDS.md](FIELDS.md).** That document is the authority on
> the boundary between the two; this section is the quick reference.

The object below is what the Milestone B editor will store in a JSONB column
and what `demo-data.js` already produces. Both go through
`config.normalizeConfig()`, which is the only way a configuration reaches the
renderer.

### Envelope

| Field | Required | Default | Notes |
|---|---|---|---|
| `contractVersion` | ✅ | — | must be exactly `1`; any other value is refused |
| `categoryKey` | ✅ | — | `wedding` |
| `templateKey` | ✅ | — | `wedding_romantic` |
| `templateVersion` | ✅ | — | positive integer; `{templateKey}_v{templateVersion}` is the registry id |
| `locale` | — | `es-MX` | BCP-47, used for date formatting |
| `timeZone` | — | `America/Mexico_City` | IANA zone; all instants are stored with an offset |
| `actions.calendar` | — | `true` | show "Agregar al calendario" |
| `actions.share` | — | `true` | show "Compartir invitación" |
| `actions.map` | — | `true` | show "Abrir ubicación" |

The template identity must match the descriptor the invitation is rendered with
(`registry.matchesConfig`), so a stored invitation can never be drawn by a
template it was not authored for.

### Sections

**Required.** If any of these is missing or unusable, `normalizeConfig()` returns
`ok:false` and the page shows a controlled error rather than a partial
invitation. These are the publish-blocking rules Milestone B/C must enforce in
the editor **before** an organizer can publish.

| Section | Required fields | Optional fields |
|---|---|---|
| `hero` | `partnerA`, `partnerB`, `date` | `eyebrow`, `location`, `image`, `imageAlt` |
| `message` | `body` | `heading`, `hosts` |
| `ceremony` | `startsAt`, `venueName` | `address`, `note`, `mapUrl` |

**Optional.** Rendered only when `enabled === true` **and** the section's own
required fields survive validation. A disabled, absent, invalid or throwing
optional section is skipped silently — it never breaks the page and never
leaves an empty frame.

| Section | Renders when | Optional fields |
|---|---|---|
| `countdown` | enabled | `targetAt` (defaults to `hero.date`), `completedLabel` |
| `reception` | enabled + `startsAt` + `venueName` | `address`, `note`, `mapUrl` |
| `dressCode` | enabled + (`description` **or** ≥1 `guidelines` entry) | `title`, `description`, `guidelines[]` |
| `gallery` | enabled + ≥1 resolvable image | `items[].alt` |
| `gifts` | enabled + ≥1 valid link **or** an `intro` | `intro`, `links[].note` |
| `closing` | enabled + `body` | `heading`, `signature` |

### Dress code

```ts
dressCode: {
  enabled: boolean,
  title?: string,        // names the dress code, e.g. "Formal", "Black tie"
  description?: string,  // the general explanation
  guidelines?: string[]  // concrete recommendations or restrictions, max 4
}
```

The section heading ("Código de vestimenta") is **template UI copy**, not a
stored field — the product does not offer to rename it.

`guidelines` belongs **entirely** to this section. It is not a top-level
section, it never renders outside the dress code, and the organizer-facing
editor must not call it "Notes" — the Spanish label is **"Indicaciones"** (or
"Recomendaciones de vestimenta").

`description` and `guidelines` are **independently sufficient**: either alone
renders the section, both render it, and only when neither has valid content is
the section treated as empty and omitted. Neither is required when the other is
present. `title` is not content on its own — a dress code carrying only a title
has nothing to tell a guest, so it does not keep the section alive.

Each guideline is trimmed and whitespace-collapsed, dropped if it is empty
(a blank row left in the editor never becomes an empty bullet), clamped to
160 characters, and rendered as an `<li>` inside a real `<ul>` through the safe
DOM helpers. The list marker is drawn in CSS on `::before`, so the element stays
a genuine list for assistive technology and the marker is never announced as
content. Items are a plain ordered array, so the future mobile editor can add,
edit, remove and reorder them individually with no contract change.

### Instants

Every date/time is an ISO 8601 string **with an explicit offset**
(`2027-04-17T17:00:00-06:00`). Anything unparseable is treated as absent — never
as "now", never as `NaN`.

### Image references

Images are **tagged**, never bare strings:

```js
{ source: 'demo',    path: 'wedding-romantic/hero.svg' }
{ source: 'storage', bucket: 'event-photos', path: '<uid>/<file>.jpg' }
```

`demo` resolves against the bundled asset directory. `storage` is shape-checked
today and **fails closed** (returns `null`) until Milestone B supplies a
resolver. Any other shape — a bare string, an absolute URL, a traversal, a
scheme — is rejected, so an invitation can never load a third-party image.

### Limits

Applied during normalization. Text over a limit is truncated; collections over a
limit are trimmed to the first N items.

| Limit | Value |
|---|---|
| Name (`partnerA`, `partnerB`) | 80 chars |
| Heading | 120 chars |
| Single line (venue, note, label, alt, link label) | 200 chars |
| Address | 300 chars |
| Paragraph (`message.body`, `closing.body`, `gifts.intro`, `dressCode.description`) | 1200 chars |
| `gallery.items` | 6 |
| `interludeImages` | 6 named slots |
| `gifts.links` | 6 |
| `dressCode.guidelines` | 4 items |
| One `dressCode.guidelines` entry | 160 chars |

A fully populated configuration lands around 6 KB of text plus image
references, so the locked **64 KB** JSONB ceiling is a safety net rather than a
constraint an organizer can reach with normal copy.

### Behavior on missing optional values

- Missing optional **string** → the element is not rendered at all (no empty
  paragraph, no stray margin).
- Missing optional **collection** → the sub-list is omitted; the section still
  renders if it has other content.
- Invalid **link** → dropped from the list. It is never rendered as a dead
  control.
- Invalid **image** → the item is dropped; if a gallery ends up with zero
  usable items the whole section is skipped.
- Image that fails to LOAD at runtime → the tile shows the template's quiet
  placeholder (`.is-failed`), never a broken-image icon.

---

## Security

| Control | Where |
|---|---|
| Organizer text becomes a text node, never markup | `dom.js` — no `innerHTML`/`outerHTML`/`insertAdjacentHTML` anywhere in the tree |
| Attribute allowlist (no `on*`, no `srcdoc`) | `dom.js` `ALLOWED_ATTRS` |
| Control characters stripped, lengths clamped | `security.sanitizeText` / `sanitizeParagraph` |
| External links: HTTPS only, no credentials, no other scheme | `security.safeExternalUrl` |
| Map links: HTTPS + host allowlist, or built from the address | `security.safeMapUrl` / `buildMapUrl` |
| Images: tagged references, no traversal, no scheme, no cross-origin | `security.resolveImage` / `safeAssetPath` |
| Template lookup: closed set, static imports, null-prototype map | `registry.js` |
| Section lookup: closed set, static imports, null-prototype map | `sections/index.js` |
| Query parameters parsed defensively, every value validated | `route.js` |
| `.ics` text escaped per RFC 5545 | `calendar.escapeIcsText` |
| No network reachable from this page | `index.html` CSP `connect-src 'none'` |
| No inline script | `index.html` CSP `script-src 'self'` (no `'unsafe-inline'`) |

No evaluator, no dynamic `import()`, no script URL and no import path derived
from input exists anywhere in the module tree.

---

## Tests

```
node --test scripts/__tests__/
```

`scripts/__tests__/invitation.test.mjs` exercises **the exact files the site
serves**, through a minimal DOM in `scripts/__tests__/dom-stub.mjs` whose
`innerHTML` setter throws — so a renderer that ever reaches for raw HTML fails
the suite rather than quietly adding an injection surface.
