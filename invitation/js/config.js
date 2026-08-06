/* THE INVITATION CONFIGURATION CONTRACT — version 1.
 *
 * This module is the boundary between "whatever was stored" and "what the
 * renderer is allowed to draw". Milestone A feeds it bundled demonstration
 * data; Milestone B will feed it a JSONB column written by the mobile editor.
 * NEITHER caller is trusted: the same normalization runs on both, so a demo
 * configuration and a saved one are provably the same kind of object.
 *
 * NORMALIZATION RULES
 *   • Every string is sanitized and clamped (see security.js LIMITS).
 *   • Every collection is clamped to its maximum item count.
 *   • Every URL is validated; a rejected one leaves the item without an action
 *     rather than removing the item.
 *   • Every image is a TAGGED reference, resolved by security.resolveImage.
 *   • A REQUIRED section that cannot be satisfied makes the whole configuration
 *     unusable — the page then shows a controlled error, never a half-drawn
 *     invitation.
 *   • An OPTIONAL section that is disabled, absent or invalid is simply not
 *     rendered. It never breaks the page and never leaves an empty frame.
 *
 * REQUIRED / OPTIONAL / DEFAULTS / LIMITS / PUBLISH-BLOCKING RULES are all
 * documented in invitation/README.md, which this file is the executable half of.
 *
 * SIZE: the locked storage ceiling is 64 KB of JSONB per invitation. The clamps
 * here bound a fully-populated configuration to roughly 6 KB of text plus image
 * references, so the ceiling is a safety net rather than a constraint an
 * organizer can reach by writing normal copy.
 */
import {
    LIMITS,
    sanitizeText,
    sanitizeParagraph,
    safeExternalUrl,
    safeAssetPath,
    resolveMapUrl,
} from './security.js';

/** The contract version this renderer understands. */
export const CONTRACT_VERSION = 1;

/** Sections that must be present and valid for an invitation to render. */
export const REQUIRED_SECTIONS = ['hero', 'message', 'ceremony'];

/** Sections an organizer may switch on or off. */
export const OPTIONAL_SECTIONS = [
    'countdown', 'reception', 'dressCode', 'gallery', 'gifts', 'closing',
];

/** Defaults applied when the stored configuration omits a value. */
export const DEFAULTS = {
    locale: 'es-MX',
    timeZone: 'America/Mexico_City',
    actions: { calendar: true, share: true, map: true },
};

/* ── primitives ─────────────────────────────────────────────────────────── */

/** Parse an ISO instant. Returns {iso, ms} or null — never NaN, never a guess. */
export function parseInstant(value) {
    if (typeof value !== 'string' || value.length > 40) return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return null;
    return { iso: new Date(ms).toISOString(), ms };
}

/**
 * A tagged image reference, fully validated HERE.
 *
 * The path is checked with the same `safeAssetPath` the resolver uses, so
 * normalization is the single gate: an unusable reference is gone before the
 * renderer ever sees it, and the item counts a caller reads off a normalized
 * configuration are the counts that will actually be drawn. (Resolution to a
 * URL still happens at render time, because only then is the deployment root
 * known.)
 */
function imageRef(value) {
    if (!value || typeof value !== 'object') return null;

    /* A template asset carries a KEY, never a path. Only its SHAPE is checked
     * here: whether the key names a real asset is a question about the template
     * descriptor, which `resolveImage` holds and this module does not. An
     * unknown key survives normalization and then resolves to nothing, which is
     * the same outcome as any other unusable image. */
    if (value.source === 'template') {
        if (typeof value.assetKey !== 'string' || !TEMPLATE_ASSET_KEY.test(value.assetKey)) {
            return null;
        }
        return { source: 'template', assetKey: value.assetKey };
    }

    if (value.source !== 'demo' && value.source !== 'storage') return null;
    if (!safeAssetPath(value.path)) return null;
    const ref = { source: value.source, path: value.path };
    if (value.source === 'storage') {
        if (typeof value.bucket !== 'string') return null;
        ref.bucket = value.bucket;
    }
    return ref;
}

/** Same bound the renderer's own key check uses. */
const TEMPLATE_ASSET_KEY = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/**
 * THE SIX PHOTOGRAPH POSITIONS, in the template's layout order.
 *
 * A closed list, so an unknown key in a stored document selects nothing rather
 * than becoming a seventh position the template has no anchor for.
 */
export const INTERLUDE_SLOTS = [
    'afterMessage',
    'afterCountdown',
    'afterCeremony',
    'afterReception',
    'afterDressCode',
    'beforeClosing',
];

/**
 * Normalize the distributed photographs.
 *
 * These are NOT a section: they have no heading, no enable switch and no
 * "incomplete" state. A slot either resolves to a usable image or is absent,
 * and an absent slot renders nothing at all — never a gap, never a placeholder.
 *
 * Position comes from the slot NAME, never from order, which is what keeps a
 * photograph where the organizer put it when a neighbouring section is switched
 * off.
 */
function interludeImages(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    for (const slot of INTERLUDE_SLOTS) {
        if (!Object.prototype.hasOwnProperty.call(raw, slot)) continue;
        const entry = raw[slot];
        if (!entry || typeof entry !== 'object') continue;
        const image = imageRef(entry.image);
        if (!image) continue;
        out[slot] = { image, alt: sanitizeText(entry.alt, LIMITS.LINE) };
    }
    return out;
}

/** True when an optional section is switched on. Absent means off. */
function isEnabled(raw) {
    return !!raw && typeof raw === 'object' && raw.enabled === true;
}

/**
 * A place: venue, address and a validated map target. Returns null unless at
 * least a venue name survived — an address-only place would render a "cómo
 * llegar" button pointing at nothing recognizable.
 */
function place(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const venueName = sanitizeText(raw.venueName, LIMITS.LINE);
    if (!venueName) return null;
    const address = sanitizeText(raw.address, LIMITS.ADDRESS);
    const out = {
        venueName,
        address,
        note: sanitizeText(raw.note, LIMITS.LINE),
        mapUrl: resolveMapUrl({ venueName, address, mapUrl: raw.mapUrl }),
    };
    const startsAt = parseInstant(raw.startsAt);
    if (startsAt) out.startsAt = startsAt;
    return out;
}

/* ── sections ───────────────────────────────────────────────────────────── */

const SECTION_NORMALIZERS = {
    /* REQUIRED. Needs both names and the wedding date; the image is optional and
     * the template falls back to its own visual treatment when it is missing.
     *
     * The ampersand between the names is NOT here: it is a decorative separator
     * the template draws, not something the couple wrote. See the `labels` block
     * in the template descriptor. */
    hero(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const partnerA = sanitizeText(raw.partnerA, LIMITS.NAME);
        const partnerB = sanitizeText(raw.partnerB, LIMITS.NAME);
        const date = parseInstant(raw.date);
        if (!partnerA || !partnerB || !date) return null;
        return {
            eyebrow: sanitizeText(raw.eyebrow, LIMITS.HEADING),
            partnerA,
            partnerB,
            date,
            location: sanitizeText(raw.location, LIMITS.LINE),
            image: imageRef(raw.image),
            imageAlt: sanitizeText(raw.imageAlt, LIMITS.LINE),
        };
    },

    /* REQUIRED. The invitation copy itself. */
    message(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const body = sanitizeParagraph(raw.body, LIMITS.PARAGRAPH);
        if (!body) return null;
        return {
            heading: sanitizeText(raw.heading, LIMITS.HEADING),
            body,
            hosts: sanitizeText(raw.hosts, LIMITS.LINE),
        };
    },

    /* REQUIRED. Date, time, venue, address and an open-map action.
     *
     * The heading "Ceremonia" is template UI copy, not a stored field: the
     * product does not offer to rename it, so storing it would be a default
     * masquerading as organizer content. */
    ceremony(raw) {
        const p = place(raw);
        if (!p || !p.startsAt) return null;
        return p;
    },

    /* OPTIONAL. A live countdown.
     *
     * `targetAt` ABSENT means "count down to the wedding" and falls back to the
     * hero date. `targetAt` PRESENT BUT UNPARSEABLE is a different thing: the
     * organizer meant a specific moment and we do not know which one. Counting
     * down to a date they did not choose would be worse than showing nothing,
     * so the section is skipped. */
    countdown(raw, ctx) {
        if (!isEnabled(raw)) return null;
        const explicit = raw.targetAt === undefined || raw.targetAt === null || raw.targetAt === ''
            ? null
            : parseInstant(raw.targetAt);
        if (explicit === null && raw.targetAt !== undefined && raw.targetAt !== null && raw.targetAt !== '') {
            return null;
        }
        const target = explicit || (ctx.hero && ctx.hero.date) || null;
        if (!target) return null;
        return {
            target,
            // '' means "use the template's wording". The completed message is
            // interface copy the couple MAY override, so the fallback lives in
            // the template, not here.
            completedLabel: sanitizeText(raw.completedLabel, LIMITS.LINE),
        };
    },

    /* OPTIONAL. Same shape as the ceremony; needs both a time and a venue to be
     * worth showing. Heading "Recepción" is template UI copy. */
    reception(raw) {
        if (!isEnabled(raw)) return null;
        const p = place(raw);
        if (!p || !p.startsAt) return null;
        return p;
    },

    /* OPTIONAL. The dress code: a short title, a general explanation, and a
     * list of concrete recommendations or restrictions. Text only — no swatch
     * images, no icon set, no external asset of any kind.
     *
     * `guidelines` belongs to THIS section and nowhere else. It is not a
     * top-level section, and the organizer-facing editor calls it
     * "Indicaciones", never "Notes".
     *
     * CONTENT RULE: `title` names the dress code ("Formal", "Black tie")
     * but is not content on its own — a section carrying only a title has
     * nothing to tell a guest. `description` and `guidelines` are each
     * INDEPENDENTLY sufficient: either alone renders the section, both render
     * it, neither omits it. Neither is required when the other is present. */
    dressCode(raw) {
        if (!isEnabled(raw)) return null;

        const description = sanitizeParagraph(raw.description, LIMITS.PARAGRAPH);
        const guidelines = Array.isArray(raw.guidelines)
            ? raw.guidelines
                // sanitizeText trims and collapses whitespace; the filter drops
                // anything that was empty to begin with or became empty here,
                // so a blank row left behind in the editor never renders as an
                // empty bullet. Individually clamped, then the list is capped.
                .map((g) => sanitizeText(g, LIMITS.GUIDELINE))
                .filter(Boolean)
                .slice(0, LIMITS.DRESS_CODE_GUIDELINES)
            : [];

        if (!description && guidelines.length === 0) return null;

        return {
            // The dress code's NAME ("Formal", "Black tie") — organizer
            // content, and distinct from the section heading, which is template
            // UI copy. It is not content on its own: a section carrying only a
            // name has nothing to tell a guest.
            title: sanitizeText(raw.title, LIMITS.LINE),
            description,
            guidelines,
        };
    },

    /* OPTIONAL. Items with an unusable image reference are dropped; the section
     * disappears only when nothing usable is left. */
    gallery(raw) {
        if (!isEnabled(raw)) return null;
        const items = (Array.isArray(raw.items) ? raw.items : [])
            .map((item) => {
                const image = imageRef(item && item.image);
                if (!image) return null;
                return { image, alt: sanitizeText(item.alt, LIMITS.LINE) };
            })
            .filter(Boolean)
            .slice(0, LIMITS.GALLERY_ITEMS);
        if (items.length === 0) return null;
        // Heading is template UI copy. Order is the organizer's array order and
        // is never re-sorted.
        return { items };
    },

    /* OPTIONAL. Links that fail validation are dropped, not rendered inert. */
    gifts(raw) {
        if (!isEnabled(raw)) return null;
        const links = (Array.isArray(raw.links) ? raw.links : [])
            .map((link) => {
                if (!link || typeof link !== 'object') return null;
                const label = sanitizeText(link.label, LIMITS.LINE);
                const url = safeExternalUrl(link.url);
                if (!label || !url) return null;
                return { label, url, note: sanitizeText(link.note, LIMITS.LINE) };
            })
            .filter(Boolean)
            .slice(0, LIMITS.GIFT_LINKS);
        const intro = sanitizeParagraph(raw.intro, LIMITS.PARAGRAPH);
        if (links.length === 0 && !intro) return null;
        // Heading is template UI copy. No registry brand exists anywhere
        // outside demo-data.js.
        return { intro, links };
    },

    /* OPTIONAL. The closing note. */
    closing(raw) {
        if (!isEnabled(raw)) return null;
        const body = sanitizeParagraph(raw.body, LIMITS.PARAGRAPH);
        if (!body) return null;
        return {
            heading: sanitizeText(raw.heading, LIMITS.HEADING),
            body,
            signature: sanitizeText(raw.signature, LIMITS.LINE),
        };
    },
};

/* ── entry point ────────────────────────────────────────────────────────── */

/**
 * Normalize a stored (or bundled) configuration.
 *
 * @returns {{ok: boolean, config: ?object, errors: string[], incomplete: string[]}}
 *   `ok:false` means a REQUIRED section is missing or unusable and the caller
 *   must show a controlled state. `errors` names what failed and `incomplete`
 *   names optional sections the organizer switched ON but left empty. Both feed
 *   the editor and the publish gate; neither is ever shown to a guest.
 */
export function normalizeConfig(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object') {
        return { ok: false, config: null, errors: ['config:not-an-object'], incomplete: [] };
    }

    if (raw.contractVersion !== CONTRACT_VERSION) {
        return { ok: false, config: null, errors: ['config:unsupported-version'], incomplete: [] };
    }

    const categoryKey = sanitizeText(raw.categoryKey, 40);
    const templateKey = sanitizeText(raw.templateKey, 60);
    const templateVersion = Number.isInteger(raw.templateVersion) && raw.templateVersion > 0
        ? raw.templateVersion
        : null;
    if (!categoryKey || !templateKey || !templateVersion) {
        return { ok: false, config: null, errors: ['config:missing-template-identity'], incomplete: [] };
    }

    const rawSections = raw.sections && typeof raw.sections === 'object' ? raw.sections : {};
    const sections = {};
    const ctx = {};

    for (const name of REQUIRED_SECTIONS) {
        const value = SECTION_NORMALIZERS[name](rawSections[name], ctx);
        if (!value) errors.push('section:' + name);
        sections[name] = value;
        ctx[name] = value;
    }

    /* Enabled-but-empty is a THIRD state, and conflating it with "off" is how an
     * organizer publishes a reception section that says nothing.
     *
     *   off              → not rendered, not a problem.
     *   on and valid     → rendered.
     *   on and empty     → not rendered (a guest must never see an empty frame),
     *                      but RECORDED here so the publish gate can refuse and
     *                      the editor can say which section needs attention.
     *
     * Drafts may sit in the third state indefinitely. Publication may not. */
    const incomplete = [];

    for (const name of OPTIONAL_SECTIONS) {
        let value = null;
        try {
            value = SECTION_NORMALIZERS[name](rawSections[name], ctx);
        } catch (_) {
            // An optional section can never take the page down with it.
            value = null;
        }
        if (!value && isEnabled(rawSections[name])) incomplete.push(name);
        sections[name] = value;
        ctx[name] = value;
    }

    if (errors.length > 0) return { ok: false, config: null, errors, incomplete };

    const rawActions = raw.actions && typeof raw.actions === 'object' ? raw.actions : {};
    const actions = {
        calendar: rawActions.calendar !== false && DEFAULTS.actions.calendar,
        share: rawActions.share !== false && DEFAULTS.actions.share,
        map: rawActions.map !== false && DEFAULTS.actions.map,
    };

    return {
        ok: true,
        errors: [],
        incomplete,
        config: {
            contractVersion: CONTRACT_VERSION,
            categoryKey,
            templateKey,
            templateVersion,
            locale: sanitizeText(raw.locale, 12) || DEFAULTS.locale,
            timeZone: sanitizeText(raw.timeZone, 60) || DEFAULTS.timeZone,
            sections,
            // A SIBLING of `sections`, deliberately: these photographs are not
            // a section and the renderer never gives them a heading.
            interludeImages: interludeImages(raw.interludeImages),
            actions,
        },
    };
}

/* ── presentation helpers ───────────────────────────────────────────────── */

function formatter(locale, options) {
    try {
        return new Intl.DateTimeFormat(locale, options);
    } catch (_) {
        try {
            return new Intl.DateTimeFormat(DEFAULTS.locale, options);
        } catch (__) {
            return null;
        }
    }
}

/** "sábado, 17 de abril de 2027" — never throws, '' when unformattable. */
export function formatLongDate(ms, locale, timeZone) {
    const f = formatter(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone,
    });
    try {
        return f ? f.format(new Date(ms)) : '';
    } catch (_) {
        return '';
    }
}

/** "17 · 04 · 2027" style short stamp for the hero. */
export function formatNumericDate(ms, locale, timeZone) {
    const f = formatter(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone });
    try {
        return f ? f.format(new Date(ms)) : '';
    } catch (_) {
        return '';
    }
}

/** "17:00 h" — never throws. */
export function formatTime(ms, locale, timeZone) {
    const f = formatter(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
    try {
        return f ? f.format(new Date(ms)) : '';
    } catch (_) {
        return '';
    }
}
