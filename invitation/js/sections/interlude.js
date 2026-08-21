/* INTERLUDE — a single photograph between two parts of the invitation.
 *
 * Not a section, and it must never look like one: no heading, no card, no
 * caption furniture. It is a full-bleed band the reader passes THROUGH on the
 * way from one part of the invitation to the next, which is why the gallery
 * grid is a separate thing with a separate cap.
 *
 * POSITION IS THE SLOT, NOT THE ORDER. Each of the six renderers below is bound
 * to one named slot at module load, and the template lists them at fixed points
 * in its section order. So `afterCountdown` renders immediately before the
 * ceremony whether or not there IS a countdown: an organizer who switched the
 * countdown off did not ask for their photograph to move somewhere else.
 *
 * ALTERNATION is derived from the slot's index in the closed list, not from how
 * many slots happen to be filled. Filling one more slot must not restyle the
 * ones already there.
 *
 * PERFORMANCE: intrinsic width/height on every image, so the band reserves its
 * geometry before a byte arrives and contributes no layout shift. All six are
 * below the fold, so all six are `loading="lazy"` and `decoding="async"`.
 *
 * FAILURE: an image that cannot load removes itself through an ADDED event
 * listener (never an inline `onerror`, which the page's CSP forbids), leaving
 * the band collapsed rather than a broken-icon hole mid-invitation.
 */
import { el } from '../dom.js?v=20260821a';
import { resolveImage } from '../security.js?v=20260821a';
import { framedArt } from '../framing.js?v=20260821a';
import { INTERLUDE_SLOTS } from '../config.js?v=20260821a';

/** Fallback intrinsic size, used only if a template declares no placement. */
const BAND_W = 1600;
const BAND_H = 900;

function renderInterlude(slot, index, ctx) {
    const d = ctx.document;
    const data = ctx.config && ctx.config.interludeImages
        ? ctx.config.interludeImages[slot]
        : null;
    if (!data || !data.image) return null;

    const src = resolveImage(data.image, {
        assetBase: ctx.assetBase,
        templateBase: ctx.templateBase,
        templateAssets: ctx.templateAssets,
        storageUrl: ctx.storageUrl,
    });
    if (!src) return null;

    // The template's own geometry, which is also what the mobile cropper framed
    // this photograph to — so the reserved box and the file agree exactly.
    const place = (ctx.placements && ctx.placements.interlude) || null;

    const art = framedArt({
        document: d,
        src,
        framing: data.image && data.image.framing,
        className: 'inv-interlude__img',
        attrs: {
            src,
            // ALT IS ACCESSIBILITY, NOT VISIBILITY. An empty description makes
            // the photograph decorative; it never makes it disappear, and the
            // filename and the storage path are never used to invent one.
            alt: data.alt || '',
            width: (place && place.width) || BAND_W,
            height: (place && place.height) || BAND_H,
            loading: 'lazy',
            decoding: 'async',
            'aria-hidden': data.alt ? null : 'true',
        },
    });

    const figure = el('figure', {
        class: 'inv-interlude',
        attrs: {
            'data-section': 'interlude',
            'data-slot': slot,
            // Even/odd drives the template's alternating composition. Derived
            // from the FIXED slot index, so a slot filled later never restyles
            // the ones already placed.
            'data-parity': index % 2 === 0 ? 'even' : 'odd',
        },
        children: [art.node],
        document: d,
    });

    if (typeof art.img.addEventListener === 'function') {
        art.img.addEventListener('error', () => {
            figure.setAttribute('class', 'inv-interlude is-failed');
            if (art.node.parentNode) art.node.parentNode.removeChild(art.node);
        }, { once: true });
    }

    return figure;
}

/**
 * One renderer per slot, built once at module load.
 *
 * A single renderer that read its slot from the section id would mean parsing
 * an id at render time; binding here keeps the section table a closed map of
 * literal ids to functions, with nothing derived from input.
 */
export const INTERLUDE_RENDERERS = INTERLUDE_SLOTS.map(
    (slot, index) => ({ slot, render: (_data, ctx) => renderInterlude(slot, index, ctx) }),
);

/** The section id a template lists for a slot: `interludeAfterMessage`. */
export function interludeSectionId(slot) {
    return 'interlude' + slot.charAt(0).toUpperCase() + slot.slice(1);
}
