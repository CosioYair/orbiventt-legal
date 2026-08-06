# Field-source matrix — `wedding_romantic_v1`

Every element the template can put on screen, and where its value comes from.

The rule this document exists to enforce:

> **No human-visible piece of organizer/event content may come from a hidden
> template default.** Every one has a configuration field, an explicitly
> documented event-derived source, or it is not rendered at all.

Two kinds of text appear on an invitation and they are governed differently:

| Kind | Who owns it | May have a built-in default |
|---|---|---|
| **Organizer content** — the couple, the date, the venues, the copy they wrote | the invitation `config` | ❌ never |
| **Template UI copy** — section headings, button labels, unit names | the template descriptor (`labels`) | ✅ that is what it is |

A guest cannot tell the two apart by looking. The difference is that changing
template UI copy is a code change that affects every invitation, while
organizer content is theirs alone.

---

## Demo isolation (load-bearing)

`demo-data.js` is reachable **only** from `?demo={registryId}`. It is loaded
through a dynamic `import()` with a literal specifier inside the demo branch, so
on the draft and published routes the file is **never fetched** — not merged,
not imported, not present. This is observable in the network panel, and asserted
by a test.

No draft or published invitation can therefore fall back to Valentina, Mateo,
17 April 2027, San Miguel de Allende, the SVG artwork, the registry links or any
other demonstration value. If a required field is missing the renderer shows a
controlled incomplete state; if an optional section has no valid content it is
omitted.

---

## Envelope

| Config path | Type | Req | Editor control | Validation | Kind |
|---|---|---|---|---|---|
| `contractVersion` | int | ✅ | none (system) | must equal `1` | technical |
| `categoryKey` | text | ✅ | category picker | `wedding` | technical |
| `templateKey` | text | ✅ | template picker | registry | technical |
| `templateVersion` | int | ✅ | none (system) | registry | technical |
| `locale` | text | — | none (system) | ≤12 chars, default `es-MX` | technical |
| `timeZone` | text | — | none (system) | ≤60 chars, default `America/Mexico_City` | technical |
| `actions.calendar` / `.share` / `.map` | bool | — | toggles | default `true` | technical |

---

## Hero — REQUIRED

| Visual element | Config path | Type | Req | Editor control | Validation / max | Prefill | Absent → | Kind |
|---|---|---|---|---|---|---|---|---|
| Eyebrow ("Nos casamos") | `sections.hero.eyebrow` | text | — | single line | 120 | — | element omitted | organizer |
| First name | `sections.hero.partnerA` | text | ✅ | single line | 80 | — | **config invalid** | organizer |
| Second name | `sections.hero.partnerB` | text | ✅ | single line | 80 | — | **config invalid** | organizer |
| Ampersand between names | *(none)* | — | — | — | — | — | — | **template UI copy** (`labels.heroConjunction`) |
| Date line | `sections.hero.date` | ISO instant | ✅ | date+time picker | parseable, offset required | **event `starts_at`** | **config invalid** | organizer |
| Date *formatting* | *(none)* | — | — | — | — | — | — | template (`Intl`, `locale`+`timeZone`) |
| Location line | `sections.hero.location` | text | — | single line | 200 | event location text | element omitted | organizer |
| Hero artwork | `sections.hero.image` | image ref | — | image picker (design / event / upload / none) | tagged ref | event cover photo | template gradient only | organizer |
| Hero image alt | `sections.hero.imageAlt` | text | — | single line | 200 | — | `alt=""` + `aria-hidden` | organizer |
| Flourish ornament | *(none)* | — | — | — | — | — | — | template (CSS) |

## Main message — REQUIRED

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Section heading | `sections.message.heading` | text | — | single line | 120 | heading omitted | organizer (design supports a custom one) |
| Body | `sections.message.body` | text | ✅ | multi-line | 1200, paragraph breaks kept | **config invalid** | organizer |
| Hosts / attribution | `sections.message.hosts` | text | — | single line | 200 | element omitted | organizer |

## Countdown — OPTIONAL

| Visual element | Config path | Type | Req | Editor control | Validation | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Enabled | `sections.countdown.enabled` | bool | — | toggle | `=== true` | section omitted | technical |
| Heading ("Faltan") | *(none)* | — | — | — | — | — | **template UI copy** |
| Target instant | `sections.countdown.targetAt` | ISO instant | — | date+time picker | parseable | **falls back to `hero.date`** (explicit) | organizer |
| Completed message | `sections.countdown.completedLabel` | text | — | single line | 200 | **template UI copy** default | organizer override |
| Unit values | *(derived)* | — | — | — | — | — | derived from `targetAt` |
| Unit labels (días/horas/…) | *(none)* | — | — | — | — | — | **template UI copy** |

An **unparseable** `targetAt` skips the section — it never falls back to the
hero date, and never to the demo date.

## Ceremony — REQUIRED

| Visual element | Config path | Type | Req | Editor control | Validation / max | Prefill | Absent → | Kind |
|---|---|---|---|---|---|---|---|---|
| Heading ("Ceremonia") | *(none)* | — | — | — | — | — | — | **template UI copy** |
| Date + time | `sections.ceremony.startsAt` | ISO instant | ✅ | date+time picker | parseable | **event `starts_at`** | **config invalid** | organizer |
| Venue name | `sections.ceremony.venueName` | text | ✅ | single line | 200 | event location name | **config invalid** | organizer |
| Address | `sections.ceremony.address` | text | — | multi-line | 300 | event address | element omitted | organizer |
| Note | `sections.ceremony.note` | text | — | single line | 200 | — | element omitted | organizer |
| "Cómo llegar" label | *(none)* | — | — | — | — | — | — | **template UI copy** |
| Map target | `sections.ceremony.mapUrl` | https URL | — | optional link field | host allowlist | — | **built from venue+address** | organizer, else derived |

## Reception — OPTIONAL

Identical shape to Ceremony. Heading "Recepción" is template UI copy.
Enabled but lacking `startsAt` **or** `venueName` ⇒ **incomplete**, section
omitted, and publishing is blocked while it is enabled-and-incomplete.

## Dress code — OPTIONAL

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Enabled | `sections.dressCode.enabled` | bool | — | toggle | `=== true` | section omitted | technical |
| Heading ("Código de vestimenta") | *(none)* | — | — | — | — | — | **template UI copy** |
| Dress-code name ("Formal · Etiqueta jardín") | `sections.dressCode.title` | text | — | single line | 200 | element omitted | organizer |
| Description | `sections.dressCode.description` | text | — | multi-line | 1200 | element omitted | organizer |
| Guidelines list | `sections.dressCode.guidelines` | text[] | — | add / edit / remove / reorder | **max 4**, each trimmed, non-empty, ≤160 | list omitted | organizer |

`description` and `guidelines` are **independently sufficient**. Neither alone is
required; if neither has valid content the section is omitted (and, if enabled,
publishing is blocked). Organizer-facing label for the list:
**"Indicaciones de vestimenta"** — never "Notes".

## Gallery — OPTIONAL

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Enabled | `sections.gallery.enabled` | bool | — | toggle | `=== true` | section omitted | technical |
| Heading ("Nuestra historia") | *(none)* | — | — | — | — | — | **template UI copy** |
| Images (ordered) | `sections.gallery.items[].image` | image ref | — | pick / remove / reorder | **max 6**, tagged ref | item dropped | organizer |
| Alt text | `sections.gallery.items[].alt` | text | — | single line | 200 | `alt=""` + `aria-hidden` | organizer |

Order is the array order — the renderer never re-sorts. The template renders no
captions, so the contract has no caption field.

The maximum is **6**, reduced from 12. Twelve tiles made the gallery a scroll of
its own and pushed the gifts and closing sections off the end of most phones.
Photographs meant to be read *through* the invitation belong in the six named
positions below, which are a different job with a different layout.

**Image reference source types** (`image.source`):

| Shape | Meaning |
|---|---|
| `{source:'storage', bucket:'event-photos', path}` | an existing **event** photo |
| `{source:'storage', bucket:'invitation-media', path}` | an image uploaded **for this invitation** |
| `{source:'template', assetKey}` | the **template's own artwork**, chosen explicitly |
| `{source:'demo', path}` | bundled demonstration art — **demo route only**, rejected everywhere else |

### `template` references

Stored as a **key**, never a path: `{source:'template', assetKey:'hero-default'}`.
The invitation already records which template and version authored it, so the
renderer resolves the key in **that template's** `assets` registry and nowhere
else. An unknown key resolves to nothing, exactly like any other unusable image.

The key is the security property. A path would be organizer-influenced input
arriving at a URL; a key can only ever select one of the entries a template
shipped, so nothing an organizer writes becomes a file reference, a module
specifier or a stylesheet. The lookup is an own-property check, so `__proto__`
and `constructor` select nothing.

Offered in the editor as **"Imagen del diseño"** beside "Del evento" and
"Subir nueva". It is **never a fallback**: an invitation with no hero image
renders the template's designed no-image treatment, and "Quitar" leaves it that
way rather than quietly restoring the artwork.

This is not `demo`, which stays forbidden in stored configurations. Template
artwork carries no couple, no date, no place and no text; demonstration content
sells one fictional wedding and may never become real invitation content.

## Photographs through the invitation — OPTIONAL

Six **named positions**, at `config.interludeImages` — a **sibling of
`sections`**, not one of them. They are not a section: no heading, no enable
switch, no "incomplete" state, and nothing about them appears in the publish
gate. The editor groups them under *"Fotos a lo largo de la invitación"*, which
is editor copy and never reaches the page.

| Slot | Renders at | Editor label |
|---|---|---|
| `afterMessage` | after the message | Después del mensaje |
| `afterCountdown` | immediately **before the ceremony** | Después de la cuenta regresiva |
| `afterCeremony` | between ceremony and reception | Después de la ceremonia |
| `afterReception` | between the reception and the dress code | Después de la recepción |
| `afterDressCode` | before the gallery/gifts part of the page | Después del código de vestimenta |
| `beforeClosing` | immediately before the closing message | Antes del mensaje final |

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Photograph | `interludeImages.<slot>.image` | image ref | — | pick / replace / remove | tagged ref | **slot renders nothing** | organizer |
| Alt text | `interludeImages.<slot>.alt` | text | — | single line | 200 | `alt=""` + `aria-hidden` | organizer |

**Position is the slot name, never array order.** Modelling these as a list
would tie each photograph's position to its index, so removing the second one
would move every later photograph into a different part of the invitation. A
slot holds a photograph or it holds nothing, and nothing else moves.

**A slot keeps its position when its neighbour is switched off.** The template
lists the six anchors at fixed points in its own section order, so
`afterCountdown` sits immediately before the ceremony whether or not there is a
countdown. An organizer who turned the countdown off did not ask for their
photograph to move.

A slot that is **present must carry an image** — an empty slot and an absent
slot must not be two different things. There is no drag-and-drop and no
reordering, because the position *is* the slot.

## Gift registry — OPTIONAL

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Enabled | `sections.gifts.enabled` | bool | — | toggle | `=== true` | section omitted | technical |
| Heading ("Mesa de regalos") | *(none)* | — | — | — | — | — | **template UI copy** |
| Intro | `sections.gifts.intro` | text | — | multi-line | 1200 | element omitted | organizer |
| Link label | `sections.gifts.links[].label` | text | — | single line | 200 | link dropped | organizer |
| Link URL | `sections.gifts.links[].url` | https URL | — | url field | **https only**, no credentials | link dropped | organizer |
| Link note | `sections.gifts.links[].note` | text | — | single line | 200 | element omitted | organizer |
| "↗ se abre en una pestaña nueva" | *(none)* | — | — | — | — | — | **template UI copy** |

**Max 6 links.** No registry brand is hard-coded anywhere outside `demo-data.js`.

## Final message — OPTIONAL

| Visual element | Config path | Type | Req | Editor control | Validation / max | Absent → | Kind |
|---|---|---|---|---|---|---|---|
| Enabled | `sections.closing.enabled` | bool | — | toggle | `=== true` | section omitted | technical |
| Heading | `sections.closing.heading` | text | — | single line | 120 | heading omitted | organizer |
| Body | `sections.closing.body` | text | ✅ *(when enabled)* | multi-line | 1200 | section omitted | organizer |
| Signature | `sections.closing.signature` | text | — | single line | 200 | element omitted | organizer |
| Flourish ornament | *(none)* | — | — | — | — | — | template (CSS) |

The approved template renders no closing image, so the contract has no field for
one.

## Reclamar pases — route-driven

Rendered **only** when the URL carries a valid `?code=`. Every string in it is
template UI copy; the only value shown is the code from the URL. It claims
nothing.

## Automatic actions — derived

| Action | Data source | Kind |
|---|---|---|
| Add to calendar | built client-side from `hero` + `ceremony` + `reception` | derived |
| Share invitation | the page URL + `hero` names | derived |
| Open location | `ceremony.mapUrl` (organizer link, else built from venue+address) | derived |

No duplicate content fields exist for these — they derive from configured
section data, as required.

---

## Required to PUBLISH

Exactly these, and nothing else:

1. `hero.partnerA`
2. `hero.partnerB`
3. `hero.date`
4. `message.body`
5. `ceremony.startsAt`
6. `ceremony.venueName`

Plus, for any optional section the organizer switched **on**, that section must
not be empty (see below). A hero image is **not** required — the template has a
designed treatment without one, so requiring it would be inventing a rule from
what the demo happens to show.

## Optional-section validity (section-aware)

An enabled section that is empty blocks publication. It is never filled in.

| Section | Enabled and valid when | Enabled and empty ⇒ |
|---|---|---|
| `countdown` | always (target falls back to `hero.date`) | n/a |
| `reception` | `startsAt` **and** `venueName` | `reception:incomplete` |
| `dressCode` | `description` **or** ≥1 guideline | `dressCode:empty` |
| `gallery` | ≥1 resolvable image | `gallery:empty` |
| `gifts` | ≥1 valid https link **or** an intro | `gifts:empty` |
| `closing` | `body` | `closing:empty` |

Drafts may be incomplete. Publication may not.
