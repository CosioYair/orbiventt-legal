/* FINAL MESSAGE — OPTIONAL.
 *
 * The closing note from the couple. It is the last thing on the page on
 * purpose: the template gives it a deliberate ending rather than letting the
 * document just stop after the last set of buttons.
 */
import { el, paragraphs } from '../dom.js?v=20260821a';
import { section } from './shell.js?v=20260821a';

export default function renderClosing(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    return section('closing', data.heading, ctx, [
        ...paragraphs(data.body, { class: 'inv-closing__body', document: d }),
        data.signature
            ? el('p', { class: 'inv-closing__signature', text: data.signature, document: d })
            : null,
        el('span', { class: 'inv-closing__flourish', attrs: { 'aria-hidden': 'true' }, document: d }),
    ], { class: 'inv-closing' });
}
