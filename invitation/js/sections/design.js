/* THE CUSTOM DESIGN — the uploaded invitation image, rendered WHOLE.
 *
 * The organizer designed the entire invitation outside Orbiventt and uploaded
 * it as one finished image; that image is authoritative for every visual
 * detail, including information sitting right at its edges. So the one rule
 * this renderer exists to uphold:
 *
 *   THE FULL IMAGE IS ALWAYS VISIBLE. No crop, no `object-fit: cover`, no
 *   fixed-height container, no stretch. The <img> flows at the column's width
 *   and its height follows the image's own aspect ratio — portrait, square,
 *   story-tall or poster-wide all render complete.
 *
 * The stored `width`/`height` (the real pixel size of the stored object,
 * written by the mobile editor at upload time) become the img element's
 * intrinsic-size attributes, so the browser reserves the correct box before a
 * single byte arrives and the pass card above never shifts. When a document
 * predates them the image still renders complete — the box is simply sized on
 * load.
 *
 * Only a STORAGE reference ever reaches this section (the custom branch of
 * normalizeConfig refuses everything else), and it resolves through the same
 * `resolveImage` gate as every other image on the page — bucket allowlist,
 * path validation, project-origin pinning. Alt text is accessibility, never
 * visibility, exactly as everywhere else.
 */
import { el } from '../dom.js';
import { resolveImage } from '../security.js';
import { section } from './shell.js';

export default function renderDesign(data, ctx) {
    if (!data || !data.image) return null;

    const src = resolveImage(data.image, { storageUrl: ctx.storageUrl });
    if (!src) return null;

    const attrs = {
        src,
        alt: data.alt || '',
        decoding: 'async',
        // The design is the page's content — never lazy, and only hidden from
        // assistive tech when it carries no description.
        'aria-hidden': data.alt ? null : 'true',
    };
    if (Number.isInteger(data.width) && Number.isInteger(data.height)
        && data.width > 0 && data.height > 0) {
        attrs.width = data.width;
        attrs.height = data.height;
    }

    const img = el('img', { class: 'inv-design__img', attrs, document: ctx.document });

    /* THE CARD BACKDROP — the same photograph, blurred, BEHIND the invitation
     * card (2026-08-14 final correction). Two rules define it:
     *
     *   • the SHARP image occupies the card's full image area, flowing at the
     *     card's width with its own aspect ratio — never shrunk into a stage,
     *     never letterboxed, never showing blur bands inside its frame;
     *   • the BLUR is the outer component's atmosphere: an absolutely
     *     positioned layer the SHELL anchors (the article is its containing
     *     block), bleeding slightly past the card on every side and sitting
     *     at z-index −1 — behind the card's own surface, visible only as the
     *     soft aura around it. Document-anchored, never position: fixed, so
     *     it scrolls with the card and can never read as a detached page
     *     strip.
     *
     * Both layers carry the SAME resolved URL — one object, browser-cached,
     * zero extra requests, zero backend involvement. */
    const backdrop = el('div', {
        class: 'inv-design__backdrop',
        attrs: { 'aria-hidden': 'true' },
        document: ctx.document,
    });
    // The image address travels as a style attribute set DIRECTLY — the same
    // pattern the framing engine uses for its computed geometry (`el()`'s
    // attribute allowlist deliberately has no `style`). The value is the
    // ALREADY-RESOLVED src: it passed resolveImage's bucket/path/origin gate,
    // its charset survived safeAssetPath's DANGEROUS filter plus per-segment
    // percent-encoding, so no quote, backslash or control byte can exist in
    // it. Nothing organizer-written is concatenated here.
    backdrop.setAttribute('style', 'background-image:url("' + src + '")');

    // No heading: the uploaded design carries its own. The shell still gives
    // the section its landmark and `data-section` identity.
    return section('design', '', ctx, [backdrop, img], { class: 'inv-design' });
}
