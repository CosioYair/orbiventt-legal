/* PLACE SECTIONS — ceremony (required) and reception (optional).
 *
 * Both answer the same four questions — when, where, what address, how do I get
 * there — so they share one renderer. The "cómo llegar" action uses a URL the
 * renderer BUILT from the sanitized venue and address (or an allowlisted link
 * the organizer supplied); organizer text can never influence its scheme, host
 * or path. When no usable target exists the button is simply absent — there is
 * no dead control.
 */
import { el } from '../dom.js?v=20260821a';
import { formatLongDate, formatTime } from '../config.js?v=20260821a';
import { section, timeEl, externalButton } from './shell.js?v=20260821a';

export function renderPlace(id, heading, data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const dateText = formatLongDate(data.startsAt.ms, ctx.locale, ctx.timeZone);
    const timeText = formatTime(data.startsAt.ms, ctx.locale, ctx.timeZone);
    const when = [dateText, timeText ? timeText + ' h' : ''].filter(Boolean).join(' · ');

    return section(id, heading, ctx, [
        when
            ? el('p', {
                class: 'inv-place__when',
                children: [timeEl(data.startsAt, when, ctx)],
                document: d,
            })
            : null,
        el('p', { class: 'inv-place__venue', text: data.venueName, document: d }),
        data.address
            ? el('p', { class: 'inv-place__address', text: data.address, document: d })
            : null,
        data.note
            ? el('p', { class: 'inv-place__note', text: data.note, document: d })
            : null,
        data.mapUrl
            ? el('p', {
                class: 'inv-place__actions',
                children: [externalButton(data.mapUrl, ctx.labels.mapAction, ctx)],
                document: d,
            })
            : null,
    ], { class: 'inv-place' });
}

/* Headings come from the template's `labels`, not from the config: the product
 * does not offer to rename "Ceremonia" or "Recepción", so storing them would be
 * a template default masquerading as organizer content. */
export function renderCeremony(data, ctx) {
    return renderPlace('ceremony', ctx.labels.ceremonyHeading, data, ctx);
}

export function renderReception(data, ctx) {
    return renderPlace('reception', ctx.labels.receptionHeading, data, ctx);
}
