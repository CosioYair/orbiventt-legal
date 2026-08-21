/* AUTOMATIC ACTIONS — shell section.
 *
 * ONE control: put the event in the calendar. It is FUNCTIONAL, not a
 * placeholder, and contacts no server — an RFC 5545 payload built on the
 * client and handed over as a `data:` download. No third-party "add to
 * calendar" host, so a guest's interest in the event stays on their device.
 *
 * "Compartir invitación" and "Abrir ubicación" were REMOVED from this section
 * by product decision (2026-08-16): a guest forwards the chat message that
 * brought them here, and the venue is reached through the place section's own
 * "Cómo llegar" link — the two page-bottom buttons duplicated both. The
 * stored `actions.share` / `actions.map` flags are still ACCEPTED by the
 * normalizer (existing documents carry them) but no longer render anything.
 *
 * The control is omitted entirely when its inputs are missing — and then the
 * whole section is, so no empty block ever reaches the page. There is never a
 * button that looks live and does nothing.
 */
import { el } from '../dom.js?v=20260821a';
import { buildIcs, icsDataUrl, icsFileName } from '../calendar.js?v=20260821a';
import { section } from './shell.js?v=20260821a';

/** A reception that runs late is the real end of the day; otherwise assume 5 h. */
const DEFAULT_DURATION_MS = 5 * 60 * 60 * 1000;

/**
 * Derive the calendar event from a normalized configuration. Pure — the whole
 * payload can be asserted in a test without a DOM.
 *
 * @returns {?object} `buildIcs` input, or null when there is nothing to add.
 */
export function calendarEventFromConfig(config) {
    if (!config || !config.sections) return null;
    const { hero, ceremony, reception } = config.sections;
    if (!hero || !ceremony || !ceremony.startsAt) return null;

    const startMs = ceremony.startsAt.ms;
    const lastMs = reception && reception.startsAt ? reception.startsAt.ms : startMs;
    const endMs = lastMs + DEFAULT_DURATION_MS;

    const title = 'Boda de ' + hero.partnerA + ' y ' + hero.partnerB;
    const location = [ceremony.venueName, ceremony.address].filter(Boolean).join(', ');

    return {
        // RFC 5545 only asks that a UID be globally unique; it does not have to
        // look like an address. Deliberately domain-free, so the module tree
        // contains no host literal that could drift between the two
        // deployments (the test suite asserts exactly that).
        uid: 'orbiventt-invitation-' + config.templateKey + '-' + startMs,
        title,
        description: config.sections.message ? config.sections.message.body : '',
        location,
        startMs,
        endMs,
        stampMs: startMs,
    };
}

function calendarControl(config, ctx) {
    if (!config.actions.calendar) return null;
    const event = calendarEventFromConfig(config);
    if (!event) return null;
    const href = icsDataUrl(buildIcs(event));
    if (!href) return null;

    return el('a', {
        class: 'inv-btn inv-btn--solid',
        attrs: { href, download: icsFileName(event.title) },
        children: [el('span', { class: 'inv-btn__label', text: ctx.labels.calendarAction, document: ctx.document })],
        document: ctx.document,
    });
}

export default function renderActions(_data, ctx) {
    const config = ctx.config;
    if (!config) return null;

    const control = calendarControl(config, ctx);
    if (!control) return null;

    return section('actions', '', ctx, [
        el('div', { class: 'inv-actions', children: [control], document: ctx.document }),
    ], { class: 'inv-actions-section' });
}
