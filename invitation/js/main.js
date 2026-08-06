/* BROWSER BOOTSTRAP for /invitation/.
 *
 * Route → mode → data source → template → render, with a controlled state for
 * every path that does not end in a drawn invitation. There is no branch that
 * leaves the visitor looking at a blank page, and no branch that renders half
 * an invitation.
 *
 * MILESTONE A DATA BOUNDARY
 * The only data source wired here is `demoConfig()`, a bundled literal. The
 * draft and published routes are RECOGNIZED and answered with an explicit
 * unavailable state — they are not simulated. There is no `fetch`, no
 * `XMLHttpRequest`, no Supabase client and no mock network layer anywhere in
 * this module tree, so demo mode cannot contact a backend even by accident.
 *
 * `env.js` is loaded by the page for one reason only: the DEV badge. Its
 * Supabase fields are never read here.
 */
import { parseRoute, MODE } from './route.js';
import {
    resolveStored, RESULT, passSummaryRequest, normalizePassSummary,
} from './resolve.js';
import { resolveTemplate } from './registry.js';
import { normalizeConfig } from './config.js';
import { renderInvitation } from './renderer.js';
import { moduleBases, templateResourceUrl } from './paths.js';
import { setText, clear } from './dom.js';
import { callRpc, backendConfig, storageUrlResolver } from './backend.js';

/* Both roots are derived from this module's own URL, so the same bytes work
 * under /vyvent-legal/invitation/ and under /invitation/. */
const BASES = moduleBases(import.meta.url);

/** Copy for every controlled state. Guest-facing: no internal vocabulary. */
const STATES = {
    unknownTemplate: {
        title: 'Invitación no disponible',
        body: 'Este enlace no corresponde a ninguna invitación. Revisa que esté completo o '
            + 'pídeselo de nuevo a los anfitriones.',
    },
    /* THE ONE ANSWER FOR EVERY STORED-INVITATION FAILURE.
     *
     * Unknown slug, a draft, an unpublished invitation, a deleted one, a
     * moderated event, a template this build does not have, a configuration
     * that will not normalize, a network error. Deliberately says nothing about
     * which — a guest must not be able to learn from this page whether a
     * private invitation exists, and an organizer who unpublished theirs must
     * not have that fact announced to whoever still holds the link. */
    unavailable: {
        title: 'Esta invitación no está disponible',
        body: 'Revisa que el enlace esté completo o pídeselo de nuevo a los anfitriones.',
    },
    // A DRAFT whose required fields are not filled in yet. Distinct from
    // "failed" on purpose: nothing is broken, the invitation is simply not
    // finished, and the person looking at it is the organizer previewing their
    // own work. It names no field — the editor does that, with the real list.
    incompleteDraft: {
        title: 'Esta invitación aún está incompleta',
        body: 'Faltan datos por llenar antes de poder verla completa. Vuelve al editor '
            + 'en Orbiventt para terminarla.',
    },
    failed: {
        title: 'No se pudo mostrar la invitación',
        body: 'Ocurrió un problema al preparar esta invitación. Vuelve a cargar la página.',
    },
};

function byId(id) {
    return document.getElementById(id);
}

function showState(state) {
    const host = byId('invitation-state');
    if (!host) return;
    setText(byId('invitation-state-title'), state.title);
    setText(byId('invitation-state-body'), state.body);
    host.removeAttribute('hidden');
    const loading = byId('invitation-loading');
    if (loading) loading.setAttribute('hidden', '');
}

function hideLoading() {
    const loading = byId('invitation-loading');
    if (loading) loading.setAttribute('hidden', '');
}

/**
 * Attach the template stylesheet and resolve once it has settled.
 *
 * Rendering waits for this so the first paint of the invitation is already
 * styled — no flash of unstyled content and no layout shift as the CSS lands.
 * A stylesheet that fails resolves anyway: an unstyled invitation is a far
 * better outcome than a blank page, and the base stylesheet still applies.
 */
function loadTemplateStylesheet(href) {
    return new Promise((resolve) => {
        if (!href) { resolve(false); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        let settled = false;
        const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
        link.addEventListener('load', () => done(true), { once: true });
        link.addEventListener('error', () => done(false), { once: true });
        // A stylesheet from the same origin that has not answered in two
        // seconds is not going to; do not hold the page hostage to it.
        setTimeout(() => done(false), 2000);
        document.head.appendChild(link);
    });
}

function revealDevBadge() {
    const env = (typeof window !== 'undefined' && window.__ORB_ENV__) || {};
    if (!env.devBadge) return;
    const badge = byId('envBadge');
    if (badge) badge.removeAttribute('hidden');
}

/* DEMO DATA IS NOT IMPORTED AT THE TOP OF THIS FILE, AND THAT IS THE POINT.
 *
 * A real invitation must never be able to inherit a demonstration value — not
 * a couple's name, not a date, not a venue, not an image. A static import would
 * put the whole fictional wedding into the module graph of EVERY route, one
 * mistaken line away from a real draft.
 *
 * Loading it through a dynamic import with a LITERAL specifier, inside the demo
 * branch, makes the guarantee physical rather than disciplinary: on the draft
 * and published routes the browser never fetches `demo-data.js` at all. You can
 * watch that in the network panel, and a test asserts it.
 *
 * The specifier is a constant. There is still no import path anywhere in this
 * module tree that is derived from input. */
async function loadDemoConfig(demoId) {
    const module = await import('./demo-data.js');
    return module.demoConfig(demoId);
}

/**
 * Draw a normalized configuration. The ONE place a rendered invitation is
 * produced, whichever route asked for it — demo, draft or published all arrive
 * here with the same kind of object, so there is no second rendering path that
 * could drift from the one the couple approved.
 *
 * `storageUrl` is supplied only for stored invitations. In demo mode it is
 * absent, so a `{source:'storage'}` reference resolves to null rather than
 * quietly reaching for the network.
 */
async function paint(template, config, route, storageUrl, handoff, passSummary) {
    await loadTemplateStylesheet(templateResourceUrl(BASES.templates, template.stylesheet));
    document.documentElement.classList.add(template.themeClass);

    const result = renderInvitation({
        template,
        config,
        route,
        document,
        assetBase: BASES.assets,
        // The template's own artwork resolves against the templates root, the
        // same way its stylesheet does. Both roots come from this module's URL,
        // so they are correct under the DEV project path and the production
        // root with no environment-specific string anywhere.
        templateBase: BASES.templates,
        storageUrl,
        now: Date.now(),
        clock: () => Date.now(),
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
        navigator: typeof navigator !== 'undefined' ? navigator : null,
        pageUrl: window.location.href,
        handoff: handoff || null,
        passSummary: passSummary || null,
    });

    if (!result.ok || !result.node) { showState(STATES.failed); return false; }

    const root = byId('invitation-root');
    clear(root);
    root.appendChild(result.node);
    root.removeAttribute('hidden');
    hideLoading();
    return true;
}

/**
 * Render a STORED invitation — the draft and published routes.
 *
 * The decision of what to fetch and what every failure means lives in
 * `resolve.js`, which is DOM-free and asserted directly. This function is what
 * is left once that is factored out: paint the verdict.
 *
 * The payload arrives from the network and is trusted no further than the
 * bundled demo literal is: it goes through the same `normalizeConfig()`, the
 * same template registry and the same renderer. Nothing here merges, defaults
 * to, or falls back on demonstration data — `demo-data.js` is not even in this
 * function's module graph.
 */
async function renderStored(route, mode) {
    const resolved = await resolveStored(route, {
        callRpc,
        resolveTemplate,
        normalizeConfig,
    });

    if (resolved.result === RESULT.INCOMPLETE) {
        showState(STATES.incompleteDraft);
        return;
    }
    if (resolved.result !== RESULT.OK) {
        showState(STATES.unavailable);
        return;
    }

    const backend = backendConfig();
    const storageUrl = backend ? storageUrlResolver(backend.url) : null;

    // The app handoff for the pass-claim card — PUBLISHED mode only, and only
    // when the link carries a code. Draft previews are the organizer's private
    // rehearsal; they never offer a claim.
    const handoff = mode === MODE.PUBLISHED
        ? passHandoff(route, resolved.invitation && resolved.invitation.eventId)
        : null;

    // The card's pass count, from the one extra read the claim card is allowed
    // (`get_invitation_pass_summary`: published slug + exact code, counts out).
    // Every failure is null and the card simply omits the line — the page never
    // blocks, errors or guesses over a number that is decoration here and law
    // only inside the app's claim flow.
    const passSummary = await fetchPassSummary(route, mode);

    if (await paint(resolved.template, resolved.config, route, storageUrl, handoff, passSummary)) {
        document.body.setAttribute('data-mode', mode);
    }
}

async function fetchPassSummary(route, mode) {
    if (mode !== MODE.PUBLISHED) return null;
    const request = passSummaryRequest(route);
    if (!request) return null;
    try {
        return normalizePassSummary(await callRpc(request.rpc, request.params));
    } catch (_) {
        return null;
    }
}

/**
 * Resolve the "Abrir Orbiventt" destination for a pass-claim code.
 *
 * EVERYTHING here goes through `app-return.js` — the exact resolver the
 * event-preview page uses, loaded as the same classic script. This module never
 * concatenates an app scheme itself, so DEV and production behave as they
 * always have: production gets `vyvent://e/{eventId}?code=…`; the DEV mirror
 * gets a re-validated Expo Go return address or, failing that, NO automatic
 * button — never a `vyvent://` link that would open the production app against
 * the production database (the exact crossing `app-return.js` exists to
 * prevent).
 *
 * The route is `e/{eventId}` with the event id from the PUBLISHED PAYLOAD —
 * the server's answer for this slug, not anything the URL claimed. The app
 * independently re-verifies that the code belongs to that event on a trusted
 * backend surface before it opens the claim flow, so a hand-edited URL cannot
 * ride this handoff into another event's claim.
 */
function passHandoff(route, eventId) {
    if (!route || !route.code || !eventId) return null;
    const resolver = (typeof window !== 'undefined' && window.__ORB_APP_RETURN__) || null;
    if (!resolver || typeof resolver.resolveAppHandoff !== 'function') return null;
    const env = (typeof window !== 'undefined' && window.__ORB_ENV__ && window.__ORB_ENV__.env) || null;
    return resolver.resolveAppHandoff({
        env,
        appReturn: route.appReturn,
        kind: 'e',
        id: eventId,
        isChat: false,
        code: route.code,
    });
}

async function renderDemo(route) {
    const template = resolveTemplate(route.demoId);
    if (!template) { showState(STATES.unknownTemplate); return; }

    const raw = await loadDemoConfig(route.demoId);
    if (!raw) { showState(STATES.unknownTemplate); return; }

    const { ok, config } = normalizeConfig(raw);
    if (!ok) { showState(STATES.failed); return; }

    // No storageUrl resolver: in demo mode a `{source:'storage'}` reference
    // resolves to null rather than reaching for the network. Demo mode makes
    // ZERO backend requests, and that stays true by construction.
    if (await paint(template, config, route, null)) {
        document.body.setAttribute('data-mode', 'demo');
    }
}

async function start() {
    revealDevBadge();

    const route = parseRoute(window.location.search);

    if (route.mode === MODE.DEMO) {
        await renderDemo(route);
        return;
    }

    // DRAFT — the organizer previewing their own unpublished work. Requires
    // BOTH the invitation id and a token the backend can verify; a missing
    // token makes no request, because there is nothing a request could add.
    //
    // PUBLISHED — reachable by slug alone, because that is what publishing
    // means: no token, no account, no app. `?code=` additionally renders the
    // pass-claim card: the code is shown, copyable, and handed to the app,
    // which owns the whole redemption lifecycle. This page never claims.
    if (route.mode === MODE.DRAFT || route.mode === MODE.PUBLISHED) {
        await renderStored(route, route.mode);
        return;
    }

    // Nothing recognizable in the query: a bare `/invitation/`, a truncated
    // link, a mistyped one, or an `?i=` whose value the database could not have
    // stored. The SAME answer a resolvable-looking slug that does not resolve
    // gets — otherwise the difference between "malformed" and "not found" would
    // be readable off the page, and this is the one page where every dead end
    // must look identical.
    showState(STATES.unavailable);
}

start().catch(() => showState(STATES.failed));
