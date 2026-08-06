/* RECLAMA TUS PASES — shell section, shown ONLY when the link carries a code.
 *
 * A pass-claim prompt on an invitation that carries no code would be a lie, so
 * the default is to render nothing at all. The section appears only when
 * `?code=` survived validation (`security.safeCode`).
 *
 * WHO OWNS WHAT. This card is the Digital Invitation's half of the guest
 * experience: it shows the Smart Invitation code, copies it, and opens
 * Orbiventt. The app owns EVERYTHING that decides — validity, pass counts,
 * already-claimed, exhausted, expired, revoked, consent, assignment. Nothing
 * here validates a code against the backend, nothing here claims, and a code
 * that later fails in the app never takes this page down with it.
 *
 * THE CODE IS VISIBLE ON PURPOSE. Possession of the code IS the invitation
 * credential in the product model — it already travels in the same chat message
 * as this link. What is still forbidden: logging it, sending it anywhere except
 * the clipboard and the app handoff, and storing it. There is no console call
 * and no persistence in this module, and a test asserts the first.
 *
 * MODES:
 *   demo       the Milestone A explainer, unchanged — badged as demonstration,
 *              claims nothing, offers no control.
 *   published  the real card.
 *   draft      nothing. The organizer's private rehearsal never offers a claim.
 *
 * The "Abrir Orbiventt" destination arrives PRE-RESOLVED in `ctx.handoff`
 * (main.js → app-return.js). When the resolver produced no usable destination —
 * the DEV mirror without a validated Expo Go return address — the automatic
 * button is simply absent and the copy path carries the guest, which is the
 * same fail-closed posture the event-preview page has.
 */
import { el, setText } from '../dom.js';
import { MODE } from '../route.js';
import { section } from './shell.js';

/**
 * The code as a guest should read it: XXXX-XXXX-XXXX for the canonical
 * 12-character form, verbatim otherwise. Mirrors the mobile app's
 * `formatInvitationCode`, so the code looks the same in the chat message, on
 * this card and in the app's field — and what COPY copies is exactly this
 * displayed form, which the backend normalizes anyway.
 */
export function displayCode(raw) {
    const normalized = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length !== 12) return String(raw);
    return normalized.replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * The allocation sentence, or null when there is nothing trustworthy to say.
 *
 * Built ONLY from the validated pass summary (`normalizePassSummary` — the
 * backend's own `seat_capacity` / `seats_remaining` for this exact slug+code
 * pair). Numbers, never names: no claimant, no label, no id. When the summary
 * is absent the card says nothing about quantity rather than guessing —
 * the app's claim flow remains the authority on what a claim will get.
 */
export function allocationLine(summary) {
    if (!summary) return null;
    const capacity = summary.seatCapacity;
    const remaining = summary.seatsRemaining;
    if (!Number.isInteger(capacity) || !Number.isInteger(remaining)) return null;
    if (capacity < 1 || remaining < 0 || remaining > capacity) return null;

    const people = capacity === 1
        ? 'Invitación para 1 persona.'
        : 'Invitación para ' + capacity + ' personas.';
    if (remaining === capacity) return people;
    // Some passes are already claimed — say what is actually left.
    return people + ' ' + (remaining === 1
        ? 'Queda 1 de ' + capacity + ' pases disponibles.'
        : 'Quedan ' + remaining + ' de ' + capacity + ' pases disponibles.');
}

function demoCard(code, ctx) {
    const d = ctx.document;
    return section('passes', ctx.labels.passesHeading, ctx, [
        el('p', {
            class: 'inv-passes__body',
            text: 'Este enlace incluye un código de invitación. En una invitación publicada, '
                + 'aquí aparecería el botón para reclamar tus pases dentro de Orbiventt.',
            document: d,
        }),
        el('p', {
            class: 'inv-passes__code',
            children: [
                el('span', { class: 'inv-sr-only', text: 'Código de invitación: ', document: d }),
                el('span', { class: 'inv-passes__code-value', text: code, document: d }),
            ],
            document: d,
        }),
        el('p', {
            class: 'inv-passes__note',
            text: 'Demostración: aquí no se reclama ningún pase.',
            document: d,
        }),
    ], { class: 'inv-passes is-demo' });
}

function copyButton(code, ctx, status) {
    const d = ctx.document;
    const button = el('button', {
        class: 'inv-btn inv-btn--ghost',
        attrs: { type: 'button', 'aria-label': 'Copiar código de invitación' },
        children: [el('span', { class: 'inv-btn__label', text: 'Copiar código', document: d })],
        document: d,
    });

    if (typeof button.addEventListener !== 'function') return button;

    button.addEventListener('click', () => {
        const nav = ctx.navigator;
        // ONLY the code. Never the slug, never a token, never the page URL —
        // sharing the whole invitation is the actions section's job.
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            Promise.resolve()
                .then(() => nav.clipboard.writeText(displayCode(code)))
                .then(() => setText(status, 'Código copiado'))
                .catch(() => setText(status, 'Mantén presionado el código para copiarlo.'));
            return;
        }
        // No Clipboard API (older embedded browsers): the code is selectable
        // text right above this button, and the guest is told so.
        setText(status, 'Mantén presionado el código para copiarlo.');
    });

    return button;
}

export default function renderPasses(_data, ctx) {
    const code = ctx.route && ctx.route.code;
    if (!code) return null;
    if (!ctx.route) return null;

    if (ctx.route.mode === MODE.DEMO) return demoCard(code, ctx);
    if (ctx.route.mode !== MODE.PUBLISHED) return null;

    const d = ctx.document;
    const handoff = ctx.handoff;

    // Announced (role=status) so "Código copiado" reaches a screen reader.
    const status = el('p', {
        class: 'inv-passes__status',
        attrs: { role: 'status', 'aria-live': 'polite' },
        document: d,
    });

    const openControl = handoff && handoff.open && handoff.href
        ? el('a', {
            class: 'inv-btn inv-btn--solid',
            attrs: { href: handoff.href },
            children: [el('span', { class: 'inv-btn__label', text: 'Abrir Orbiventt', document: d })],
            document: d,
        })
        : null;

    const allocation = allocationLine(ctx.passSummary);

    return section('passes', ctx.labels.passesHeading, ctx, [
        el('p', {
            class: 'inv-passes__body',
            text: 'Usa este código en Orbiventt para reclamar y asignar tus pases.',
            document: d,
        }),
        allocation
            ? el('p', { class: 'inv-passes__allocation', text: allocation, document: d })
            : null,
        el('p', {
            class: 'inv-passes__code',
            children: [
                el('span', { class: 'inv-sr-only', text: 'Código de invitación: ', document: d }),
                el('span', { class: 'inv-passes__code-value', text: displayCode(code), document: d }),
            ],
            document: d,
        }),
        el('div', {
            class: 'inv-passes__actions',
            children: [openControl, copyButton(code, ctx, status)],
            document: d,
        }),
        status,
        el('p', {
            class: 'inv-passes__note',
            // The note must describe the card that actually rendered. With the
            // button, the manual path is the fallback it names. WITHOUT the
            // button — the fail-closed DEV state, or any context with no
            // validated return address — nothing here opens Orbiventt, so
            // promising "si no se abre automáticamente" would be a lie about a
            // control that does not exist. The copy path IS the path then.
            text: openControl
                ? 'Si Orbiventt no se abre automáticamente, copia el código e ingrésalo '
                    + 'manualmente en la aplicación.'
                : 'Copia el código e ingrésalo manualmente en la aplicación Orbiventt '
                    + 'para reclamar tus pases.',
            document: d,
        }),
    ], { class: 'inv-passes' });
}
