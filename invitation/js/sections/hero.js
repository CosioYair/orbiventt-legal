/* HERO — REQUIRED.
 *
 * The entrance composition: who is getting married, when, and the first
 * impression the template is built around. The couple's names are the page's
 * single <h1>, so the document outline starts where a guest's attention does.
 *
 * The artwork is an ordinary <img> with explicit width/height, not a CSS
 * background: it gets an accessible name, the browser can size the box before
 * the bytes arrive (no layout shift), and a failure degrades to the template's
 * own gradient rather than an empty hole.
 */
import { el } from '../dom.js?v=20260821a';
import { resolveImage } from '../security.js?v=20260821a';
import { framedArt } from '../framing.js?v=20260821a';
import { formatLongDate } from '../config.js?v=20260821a';
import { timeEl } from './shell.js?v=20260821a';

export default function renderHero(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const artSrc = resolveImage(data.image, {
        assetBase: ctx.assetBase,
        templateBase: ctx.templateBase,
        templateAssets: ctx.templateAssets,
        storageUrl: ctx.storageUrl,
    });
    // The template's own hero geometry — also what the mobile cropper framed
    // this photograph to.
    const place = (ctx.placements && ctx.placements.hero) || null;

    const art = artSrc
        ? framedArt({
            document: d,
            src: artSrc,
            // The saved view window, when the organizer framed this photograph
            // with the advanced editor. Absent (legacy derivatives, template
            // artwork) the builder returns the exact plain <img> of old.
            framing: data.image && data.image.framing,
            className: 'inv-hero__art',
            attrs: {
                src: artSrc,
                // Accessibility, never visibility.
                alt: data.imageAlt || '',
                width: (place && place.width) || 1000,
                height: (place && place.height) || 1400,
                decoding: 'async',
                // Above the fold: never lazy, and never aria-hidden when it
                // carries a real description.
                'aria-hidden': data.imageAlt ? null : 'true',
            },
        }).node
        : null;

    const names = el('h1', {
        class: 'inv-hero__names',
        children: [
            el('span', { class: 'inv-hero__name', text: data.partnerA, document: d }),
            el('span', {
                class: 'inv-hero__amp',
                // Decorative separator drawn by the template, not something the
                // couple wrote.
                text: ctx.labels.heroConjunction || '&',
                attrs: { 'aria-hidden': 'true' },
                document: d,
            }),
            // The ampersand is decorative; this is what is announced instead,
            // so the heading reads "<first name> y <second name>" rather than
            // the two names run together.
            el('span', { class: 'inv-sr-only', text: ' y ', document: d }),
            el('span', { class: 'inv-hero__name', text: data.partnerB, document: d }),
        ],
        document: d,
    });

    const dateText = formatLongDate(data.date.ms, ctx.locale, ctx.timeZone);

    return el('header', {
        class: 'inv-hero',
        attrs: { 'data-section': 'hero' },
        children: [
            el('div', {
                class: 'inv-hero__media',
                children: [art, el('span', { class: 'inv-hero__veil', attrs: { 'aria-hidden': 'true' }, document: d })],
                document: d,
            }),
            el('div', {
                class: 'inv-hero__content',
                children: [
                    data.eyebrow
                        ? el('p', { class: 'inv-hero__eyebrow', text: data.eyebrow, document: d })
                        : null,
                    names,
                    el('span', { class: 'inv-hero__flourish', attrs: { 'aria-hidden': 'true' }, document: d }),
                    dateText
                        ? el('p', {
                            class: 'inv-hero__date',
                            children: [timeEl(data.date, dateText, ctx)],
                            document: d,
                        })
                        : null,
                    data.location
                        ? el('p', { class: 'inv-hero__place', text: data.location, document: d })
                        : null,
                ],
                document: d,
            }),
        ],
        document: d,
    });
}
