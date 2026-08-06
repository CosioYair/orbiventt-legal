/* GALLERY — OPTIONAL.
 *
 * A responsive grid of the couple's images.
 *
 * PERFORMANCE: every tile declares its intrinsic width/height so the grid's
 * geometry is known before a single image byte arrives — the section reserves
 * its own space and contributes no layout shift. Everything here is below the
 * fold, so every image is `loading="lazy"` and `decoding="async"`.
 *
 * FAILURE: a tile whose image cannot load marks itself `is-failed` through an
 * ADDED EVENT LISTENER (never an inline `onerror` attribute, which the page's
 * CSP forbids and which would be organizer-adjacent markup). The template then
 * shows a quiet placeholder in its place, so one dead image never leaves a
 * broken-icon hole in an otherwise finished page.
 *
 * The item cap comes from the configuration contract (LIMITS.GALLERY_ITEMS) and
 * is applied during normalization, so this renderer draws whatever survived.
 */
import { el } from '../dom.js';
import { resolveImage } from '../security.js';
import { section } from './shell.js';

/** Fallback intrinsic size, used only if a template declares no placement. */
const TILE_W = 800;
const TILE_H = 1000;

export default function renderGallery(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const tiles = data.items
        .map((item, index) => {
            const src = resolveImage(item.image, {
                assetBase: ctx.assetBase,
                templateBase: ctx.templateBase,
                templateAssets: ctx.templateAssets,
                storageUrl: ctx.storageUrl,
            });
            if (!src) return null;

            // The template's own tile geometry — also what the mobile cropper
            // framed this photograph to.
            const place = (ctx.placements && ctx.placements.gallery) || null;

            const img = el('img', {
                class: 'inv-gallery__img',
                attrs: {
                    src,
                    // Accessibility, never visibility: an item with no
                    // description is decorative, not absent.
                    alt: item.alt || '',
                    width: (place && place.width) || TILE_W,
                    height: (place && place.height) || TILE_H,
                    loading: 'lazy',
                    decoding: 'async',
                    'aria-hidden': item.alt ? null : 'true',
                },
                document: d,
            });

            const tile = el('li', {
                class: 'inv-gallery__item',
                children: [img],
                document: d,
            });

            if (typeof img.addEventListener === 'function') {
                img.addEventListener('error', () => {
                    tile.setAttribute('class', 'inv-gallery__item is-failed');
                    if (img.parentNode) img.parentNode.removeChild(img);
                }, { once: true });
            }

            // A tiny stagger so the grid settles in rather than snapping. Purely
            // decorative and disabled outright under prefers-reduced-motion.
            tile.setAttribute('data-index', String(index % 6));
            return tile;
        })
        .filter(Boolean);

    if (tiles.length === 0) return null;

    return section('gallery', ctx.labels.galleryHeading, ctx, [
        el('ul', { class: 'inv-gallery', children: tiles, document: d }),
    ], { class: 'inv-gallery-section' });
}
