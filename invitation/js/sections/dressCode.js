/* DRESS CODE — OPTIONAL.
 *
 * Three parts, in reading order: the dress code's name, the general
 * explanation, and the concrete guidelines. Deliberately text-only — no swatch
 * images, no icon set, no external asset of any kind — so the section costs
 * nothing to load and cannot half-render.
 *
 * `guidelines` is a real <ul>/<li>, not styled paragraphs: the count and the
 * boundaries between items are part of the meaning, and a screen reader should
 * announce "list, 3 items" rather than three sentences that happen to be
 * indented. The bullet is drawn in CSS on ::before, so the list marker costs no
 * asset and cannot be read out as content.
 *
 * Each element is omitted when its value is empty, so a dress code with only a
 * description and one with only guidelines both render cleanly — no empty
 * heading, no bullet-less list, no stray margin.
 */
import { el, paragraphs } from '../dom.js?v=20260821a';
import { section } from './shell.js?v=20260821a';

export default function renderDressCode(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const guidelines = data.guidelines.length
        ? el('ul', {
            class: 'inv-dress__guidelines',
            // Every item goes through `el`, which assigns textContent — so an
            // organizer's guideline can never become markup.
            children: data.guidelines.map((guideline) => el('li', {
                class: 'inv-dress__guideline',
                text: guideline,
                document: d,
            })),
            document: d,
        })
        : null;

    return section('dressCode', ctx.labels.dressCodeHeading, ctx, [
        data.title
            ? el('p', { class: 'inv-dress__title', text: data.title, document: d })
            : null,
        ...paragraphs(data.description, { class: 'inv-dress__description', document: d }),
        guidelines,
    ], { class: 'inv-dress' });
}
