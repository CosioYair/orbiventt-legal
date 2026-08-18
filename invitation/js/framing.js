/* ADVANCED PHOTO FRAMING — one engine for every design.
 *
 * A storage image reference may carry `framing` {x, y, w, h}: the VIEW WINDOW
 * of the photograph, as fractions of the image itself, that maps exactly onto
 * the slot. The mobile editor writes it; this module is the only place the web
 * reconstructs it. The mapping is the shared contract, identical to the mobile
 * preview (`FramedInvitationImage`):
 *
 *   foreground width  = slot ÷ w        →  width:  (100 / w)%
 *   foreground height = slot ÷ h        →  height: (100 / h)%
 *   foreground left   = −x / w · slot   →  left:   (−100 · x / w)%
 *   foreground top    = −y / h · slot   →  top:    (−100 · y / h)%
 *
 * Percentages of the SLOT, so the geometry is resolution-independent: the same
 * stored numbers produce the same composition on a 320 px phone and a desktop.
 * The window may extend PAST the image (negative x/y, x+w or y+h above 1) —
 * that is the zoom-out state, and the exposed slot area is filled by a
 * blurred, cover-scaled copy of the SAME image behind the sharp layer (the
 * `.inv-framed__bg` treatment in base.css). A window entirely inside [0,1] is
 * an ordinary crop and renders with no backdrop at all.
 *
 * A reference WITHOUT framing is the legacy shape — an already-cropped
 * derivative — and renders through the exact pre-existing code path: a plain
 * `<img>` the template's own CSS cover-fits. Published invitations from before
 * this feature cannot change appearance by construction.
 *
 * SECURITY. The window is validated here (finite numbers inside a hard sanity
 * ceiling) before any of it reaches a style attribute, and what is written is
 * rebuilt from those numbers — organizer input can contribute magnitudes only,
 * never text. Both layers reuse the already-resolved src, so framing can never
 * introduce a URL of its own.
 */
import { el } from './dom.js?v=20260818b';

/** Mirror of the mobile MAX_WINDOW_EXTENT / MAX_FRAMING_EXTENT ceiling. */
export const FRAMING_EXTENT = 32;

/** Rounding noise from a round-tripped transform must not summon a backdrop. */
const EDGE_EPSILON = 0.002;

/** A validated framing window, or null. Never throws. */
export function framingWindow(value) {
    if (!value || typeof value !== 'object') return null;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const x = num(value.x);
    const y = num(value.y);
    const w = num(value.w);
    const h = num(value.h);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)) return null;
    if (w <= 0 || h <= 0 || w > FRAMING_EXTENT || h > FRAMING_EXTENT) return null;
    if (Math.abs(x) > FRAMING_EXTENT || Math.abs(y) > FRAMING_EXTENT) return null;
    return { x, y, w, h };
}

/** True when part of the window lies outside the image — blur-fill territory. */
export function needsBackdrop(window) {
    const f = framingWindow(window);
    if (!f) return false;
    return (
        f.x < -EDGE_EPSILON
        || f.y < -EDGE_EPSILON
        || f.x + f.w > 1 + EDGE_EPSILON
        || f.y + f.h > 1 + EDGE_EPSILON
    );
}

/** The foreground geometry as slot percentages. Numbers, never strings. */
export function framedGeometry(window) {
    const f = framingWindow(window);
    if (!f) return null;
    return {
        widthPct: 100 / f.w,
        heightPct: 100 / f.h,
        leftPct: (-100 * f.x) / f.w,
        topPct: (-100 * f.y) / f.h,
    };
}

/**
 * Build the art element for an image slot.
 *
 * @param {object} opts
 *   document   {Document}
 *   src        {string}   the ALREADY-RESOLVED image URL (resolveImage output)
 *   framing    {?object}  the reference's framing window, if any
 *   className  {string}   the slot's own class ('inv-hero__art', …) — the
 *                         template CSS keeps sizing/clipping/radius through it
 *   attrs      {object}   allowlisted <img> attributes (alt, width, height,
 *                         loading, decoding, aria-hidden)
 *
 * @returns {{node: Element, img: Element}}
 *   `node` is what the section inserts; `img` is the SHARP image, for error
 *   listeners. Without a usable window the two are the same plain <img> the
 *   renderer has always produced.
 */
export function framedArt(opts) {
    const o = opts || {};
    const d = o.document;
    const geometry = framedGeometry(o.framing);

    if (!geometry) {
        const img = el('img', { class: o.className, attrs: o.attrs, document: d });
        return { node: img, img };
    }

    // The SAME source, cover-scaled and blurred by base.css. Decorative by
    // definition — the sharp layer carries the accessible name.
    const bg = needsBackdrop(o.framing)
        ? el('img', {
            class: 'inv-framed__bg',
            attrs: {
                src: o.attrs && o.attrs.src,
                alt: '',
                'aria-hidden': 'true',
                loading: o.attrs && o.attrs.loading,
                decoding: o.attrs && o.attrs.decoding,
            },
            document: d,
        })
        : null;

    const img = el('img', {
        class: 'inv-framed__fg',
        attrs: o.attrs,
        document: d,
    });

    // Geometry travels as a style attribute REBUILT from validated finite
    // numbers — the same direct-setAttribute pattern the renderer already uses
    // for its own computed data-* values. Nothing organizer-written is ever
    // concatenated into it.
    const styleText = 'width:' + geometry.widthPct + '%;'
        + 'height:' + geometry.heightPct + '%;'
        + 'left:' + geometry.leftPct + '%;'
        + 'top:' + geometry.topPct + '%;';
    img.setAttribute('style', styleText);

    const wrapper = el('div', {
        class: o.className + ' inv-framed',
        children: [bg, img],
        document: d,
    });
    return { node: wrapper, img };
}
