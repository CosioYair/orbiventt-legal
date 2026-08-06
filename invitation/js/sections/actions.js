/* AUTOMATIC ACTIONS — shell section.
 *
 * Three things a guest actually wants to do from a phone: put it in the
 * calendar, forward it to someone, and open the venue in maps. All three are
 * FUNCTIONAL here, not placeholders, and none of them contacts a server:
 *
 *   Add to calendar  an RFC 5545 payload built on the client and handed over as
 *                    a `data:` download. No third-party "add to calendar" host,
 *                    so a guest's interest in the event stays on their device.
 *   Share            `navigator.share()` where the platform has it, otherwise
 *                    the clipboard, otherwise an honest failure message. The
 *                    outcome is announced through a `role="status"` line rather
 *                    than a toast that a screen reader would miss.
 *   Open location    a link to the map URL the renderer already built and
 *                    validated for the ceremony.
 *
 * Each control is omitted entirely when its inputs are missing. There is never
 * a button that looks live and does nothing.
 */
import { el, setText } from '../dom.js';
import { buildIcs, icsDataUrl, icsFileName } from '../calendar.js';
import { section, externalButton } from './shell.js';

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

function shareControl(config, ctx, status) {
    if (!config.actions.share) return null;
    const d = ctx.document;

    const button = el('button', {
        class: 'inv-btn inv-btn--ghost',
        attrs: { type: 'button' },
        children: [el('span', { class: 'inv-btn__label', text: ctx.labels.shareAction, document: d })],
        document: d,
    });

    if (typeof button.addEventListener !== 'function') return button;

    button.addEventListener('click', () => {
        const nav = ctx.navigator;
        const url = ctx.pageUrl;
        const hero = config.sections.hero;
        const payload = {
            title: 'Invitación digital · Orbiventt',
            text: 'Invitación de ' + hero.partnerA + ' y ' + hero.partnerB,
            url,
        };

        if (nav && typeof nav.share === 'function') {
            Promise.resolve()
                .then(() => nav.share(payload))
                .then(() => setText(status, ''))
                // A cancelled share is a normal outcome, not an error worth
                // announcing — fall back only when sharing is unavailable.
                .catch(() => {});
            return;
        }

        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            Promise.resolve()
                .then(() => nav.clipboard.writeText(url))
                .then(() => setText(status, 'Enlace copiado.'))
                .catch(() => setText(status, 'No se pudo copiar el enlace.'));
            return;
        }

        setText(status, 'Copia el enlace desde la barra de direcciones para compartirlo.');
    });

    return button;
}

export default function renderActions(_data, ctx) {
    const config = ctx.config;
    if (!config) return null;
    const d = ctx.document;

    const status = el('p', {
        class: 'inv-actions__status',
        attrs: { role: 'status', 'aria-live': 'polite' },
        document: d,
    });

    const ceremony = config.sections.ceremony;
    const controls = [
        calendarControl(config, ctx),
        shareControl(config, ctx, status),
        config.actions.map && ceremony && ceremony.mapUrl
            ? externalButton(ceremony.mapUrl, ctx.labels.locationAction, ctx)
            : null,
    ].filter(Boolean);

    if (controls.length === 0) return null;

    return section('actions', '', ctx, [
        el('div', { class: 'inv-actions', children: controls, document: d }),
        status,
    ], { class: 'inv-actions-section' });
}
