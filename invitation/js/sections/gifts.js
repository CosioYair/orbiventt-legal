/* GIFT REGISTRY — OPTIONAL.
 *
 * The only place an invitation sends a guest off-site, so it is the one that
 * has to be loudest about it: each entry is an explicit external button that
 * opens in a new tab, carries `rel="noopener noreferrer"`, and announces
 * "se abre en una pestaña nueva" to assistive technology.
 *
 * Links were validated during normalization — HTTPS only, no credentials, no
 * other scheme — and anything that failed was DROPPED rather than rendered as a
 * dead control. The maximum entry count is the contract's LIMITS.GIFT_LINKS.
 */
import { el, paragraphs } from '../dom.js';
import { section, externalButton } from './shell.js';

export default function renderGifts(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const list = data.links.length
        ? el('ul', {
            class: 'inv-gifts',
            children: data.links.map((link) => el('li', {
                class: 'inv-gifts__item',
                children: [
                    externalButton(link.url, link.label, ctx),
                    link.note
                        ? el('p', { class: 'inv-gifts__note', text: link.note, document: d })
                        : null,
                ],
                document: d,
            })),
            document: d,
        })
        : null;

    return section('gifts', ctx.labels.giftsHeading, ctx, [
        ...paragraphs(data.intro, { class: 'inv-gifts__intro', document: d }),
        list,
    ], { class: 'inv-gifts-section' });
}
