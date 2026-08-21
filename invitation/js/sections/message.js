/* MAIN INVITATION MESSAGE — REQUIRED.
 *
 * The short formal or romantic copy that does the actual inviting. Rendered as
 * one <p> per paragraph so the organizer's line breaks survive without a single
 * character of markup being generated from their text.
 */
import { el, paragraphs } from '../dom.js?v=20260821a';
import { section } from './shell.js?v=20260821a';

export default function renderMessage(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const body = paragraphs(data.body, { class: 'inv-message__body', document: d });

    return section('message', data.heading, ctx, [
        ...body,
        data.hosts
            ? el('p', { class: 'inv-message__hosts', text: data.hosts, document: d })
            : null,
    ], { class: 'inv-message' });
}
