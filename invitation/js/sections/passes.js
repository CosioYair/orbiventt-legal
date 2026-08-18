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
 *   draft      no CLAIM, ever — the organizer's private rehearsal never offers
 *              one. On the CUSTOM (Personalizada) template only, the draft
 *              renders a clearly-labelled EXAMPLE of the card instead
 *              (`draftExampleCard`): the custom page is design-then-passes
 *              inside ONE shell and nothing else, so a preview showing only
 *              the image told the organizer nothing about the layout their
 *              guests will actually open. The example is the real component
 *              with a placeholder code and no controls; wedding drafts keep
 *              rendering nothing here.
 *
 * The "Abrir Orbiventt" destination arrives PRE-RESOLVED in `ctx.handoff`
 * (main.js → app-return.js), and the device-specific way to REACH it arrives
 * alongside in `ctx.smartOpen` (main.js → app-store-links.js). One button owns
 * both outcomes — the app when it is installed, the correct store when it is
 * not — and there is deliberately no second "Descargar" control. When the
 * resolver produced no usable destination at all — the DEV mirror without a
 * validated Expo Go return address — the automatic button is simply absent and
 * the copy path carries the guest, which is the same fail-closed posture the
 * event-preview page has.
 */
import { el, setText } from '../dom.js?v=20260818b';
import { MODE } from '../route.js?v=20260818b';
import { section } from './shell.js?v=20260818b';

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

/** The placeholder the example card shows where a real code would sit.
 *  Deliberately NOT code-shaped: `X` is outside the code alphabet's visual
 *  register and reads as "your code goes here", so nobody can mistake the
 *  example for a claimable credential or try to type it into the app. */
export const EXAMPLE_CODE_PLACEHOLDER = 'XXXX-XXXX-XXXX';

/**
 * The DRAFT-ONLY example of the claim card, for the custom template.
 *
 * The real component's bones — same section id, same heading, same body and
 * code classes, so the template's own card styling draws it — with three
 * honest differences: a placeholder where the code sits, NO controls (nothing
 * to copy, nothing to open), and copy that says exactly when the real card
 * appears and what happens without a code. `is-example` gives it the sketchy
 * dashed frame, the same convention `is-demo` established.
 */
function draftExampleCard(ctx) {
    const d = ctx.document;
    return section('passes', ctx.labels.passesHeading, ctx, [
        el('p', {
            class: 'inv-passes__body',
            text: 'Así verán tus invitados sus pases cuando compartas el enlace '
                + 'con un código de invitación.',
            document: d,
        }),
        el('p', {
            class: 'inv-passes__code',
            children: [
                el('span', {
                    class: 'inv-passes__code-value',
                    text: EXAMPLE_CODE_PLACEHOLDER,
                    attrs: { 'aria-hidden': 'true' },
                    document: d,
                }),
                el('span', {
                    class: 'inv-sr-only',
                    text: 'Ejemplo del lugar donde aparecerá el código de invitación.',
                    document: d,
                }),
            ],
            document: d,
        }),
        el('p', {
            class: 'inv-passes__note',
            text: 'Ejemplo de la vista previa: aquí no se reclama ningún pase. '
                + 'Si compartes el enlace sin código, tus invitados verán '
                + 'directamente tu diseño.',
            document: d,
        }),
    ], { class: 'inv-passes is-example' });
}

/**
 * The ONE call to action — "Abrir Orbiventt" — which owns BOTH outcomes.
 *
 * There is deliberately no second button. A guest who has Orbiventt gets the
 * behavior this card has always had: the pre-resolved handoff href, carrying
 * the event route and the invitation code, opening the app straight into the
 * claim flow. A guest who does NOT have it reaches the right store instead of
 * reaching nothing, and never has to notice that two different things happened.
 *
 * WHICH href IS RENDERED is the whole mechanism. `ctx.smartOpen` (built by
 * main.js through `app-store-links.js`) has already decided what this device
 * needs — an Android intent URL that carries its own Play Store fallback, the
 * plain `vyvent://` scheme on iOS, or the store listing itself on a desktop
 * where no scheme can work. When it is null, the handoff href is used verbatim,
 * which is exactly the code that shipped before: the DEV mirror's Expo Go
 * address is never wrapped, and neither is a handoff this module could not
 * safely rewrite.
 *
 * `arm()` attaches the lifecycle guards that only iOS and the intent-refusing
 * embedded browsers actually need; it is a no-op for the desktop plan and is
 * absent entirely in the null case. Nothing here reads, copies or logs the
 * code — it travels inside the href it was handed, and nowhere else.
 */
function buildOpenControl(handoff, smartOpen, d) {
    if (!handoff || !handoff.open || !handoff.href) return null;

    const href = smartOpen && typeof smartOpen.href === 'string' && smartOpen.href
        ? smartOpen.href
        : handoff.href;

    const anchor = el('a', {
        class: 'inv-btn inv-btn--solid',
        attrs: { href },
        children: [el('span', { class: 'inv-btn__label', text: 'Abrir Orbiventt', document: d })],
        document: d,
    });

    if (smartOpen && typeof smartOpen.arm === 'function') smartOpen.arm(anchor);
    return anchor;
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
    /* DRAFT: never a claim. The custom template alone gets the labelled
     * example — its published page IS this card plus the design, so the
     * organizer's preview must show the complete layout. This branch runs
     * BEFORE the code check on purpose: a draft link that happens to carry a
     * code still renders the example, never the real card. */
    if (ctx.route && ctx.route.mode === MODE.DRAFT) {
        return ctx.template && ctx.template.categoryKey === 'custom'
            ? draftExampleCard(ctx)
            : null;
    }

    const code = ctx.route && ctx.route.code;
    if (!code) return null;

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

    const openControl = buildOpenControl(handoff, ctx.smartOpen, d);

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
