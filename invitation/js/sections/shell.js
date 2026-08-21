/* SHARED SECTION FURNITURE.
 *
 * Every section is built from the same frame so the document has one
 * predictable heading hierarchy (a single <h1> in the hero, an <h2> per
 * section) and one predictable landmark structure, regardless of which
 * template is dressing it. A template changes the CSS, never the semantics.
 */
import { el } from '../dom.js?v=20260821a';

/**
 * A titled section.
 *
 * @param {string} id        section identifier (also the `data-section` value)
 * @param {string} heading   visible heading; '' renders no heading at all
 * @param {object} ctx       render context (carries the document seam)
 * @param {Array}  children  content nodes
 * @param {object} [opts]    `class` — extra class on the <section>
 */
export function section(id, heading, ctx, children, opts) {
    const options = opts || {};
    const d = ctx.document;
    const headingId = 'inv-h-' + id;
    const content = [];

    if (heading) {
        content.push(el('h2', {
            class: 'inv-heading',
            text: heading,
            attrs: { id: headingId },
            document: d,
        }));
        content.push(el('span', { class: 'inv-rule', attrs: { 'aria-hidden': 'true' }, document: d }));
    }

    for (const child of children || []) if (child) content.push(child);

    return el('section', {
        class: 'inv-section inv-section--' + id + (options.class ? ' ' + options.class : ''),
        attrs: {
            'data-section': id,
            // Only label the section by a heading that actually exists.
            'aria-labelledby': heading ? headingId : null,
        },
        children: [el('div', { class: 'inv-section__inner', children: content, document: d })],
        document: d,
    });
}

/** A `<time>` element carrying the machine-readable instant. */
export function timeEl(instant, text, ctx, className) {
    return el('time', {
        class: className || null,
        text,
        attrs: { datetime: instant && instant.iso ? instant.iso : null },
        document: ctx.document,
    });
}

/**
 * A button-styled external link. `href` must already be validated. The
 * "opens in a new tab" hint is text, not a title attribute, so it is announced
 * rather than merely hoverable.
 */
export function externalButton(href, label, ctx, className) {
    const d = ctx.document;
    return el('a', {
        class: 'inv-btn ' + (className || 'inv-btn--ghost'),
        attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
        children: [
            el('span', { class: 'inv-btn__label', text: label, document: d }),
            el('span', { class: 'inv-btn__ext', text: '↗', attrs: { 'aria-hidden': 'true' }, document: d }),
            el('span', {
                class: 'inv-sr-only',
                text: ctx.labels.externalHint || ' (se abre en una pestaña nueva)',
                document: d,
            }),
        ],
        document: d,
    });
}
