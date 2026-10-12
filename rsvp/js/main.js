/* CONFIRMAR ASISTENCIA — wiring only. Every decision lives beside this file:
 *
 *   session.js  where the code comes from, where it lives, when it dies
 *   backend.js  the three RPCs, closed allowlist, PostgREST 400 → message
 *   qr.js       the server's pass payload → an SVG
 *   gallery.js  the event's photos → a grid and the fullscreen viewer
 *   ui.js       the model → the page
 *
 * PRODUCT INVARIANT (locked): there is NO new invitation type. This page
 * answers an EXISTING Smart Invitation ("Enlace de invitación") by its
 * existing code. The code is the only authority the server accepts; this page
 * never sends an event id or an invitation id, never logs, never persists
 * anything beyond the code (and, on DEV, the app's return address) in
 * sessionStorage, and never writes the code into `document.title`, a meta tag
 * or any outgoing URL other than the app deep link resolved by app-return.js.
 *
 * FRESHNESS. Passes are fetched every time their section opens — never cached
 * — and the invitation is re-resolved whenever the tab becomes visible again,
 * so an organizer flipping QR access on while the guest's phone was locked is
 * reflected the moment the guest looks back at the page.
 */
import { captureCode, captureReturn, rememberCode, clearCode, normalizeCode } from './session.js?v=20261012c';
import { resolveInvitation, respond, getPasses, backendConfig, storageUrlResolver } from './backend.js?v=20261012c';
import { renderApp, COPY } from './ui.js?v=20261012c';
import { itineraryList, syncItineraryStatus } from './itinerary.js?v=20261012c';
import { photoList, viewerNode } from './gallery.js?v=20261012c';
import { clear } from './dom.js?v=20261012c';

var ENV = (typeof window !== 'undefined' && window.__ORB_ENV__) || {};
var RETURN = (typeof window !== 'undefined' && window.__ORB_APP_RETURN__) || null;
var LINKS = (typeof window !== 'undefined' && window.__ORB_APP_LINKS__) || null;
/** The vendored encoder (classic script, `window.qrcode`). Absent → no QR drawn. */
var QRCODE = (typeof window !== 'undefined' && typeof window.qrcode === 'function') ? window.qrcode : null;

var backend = backendConfig();
var storageUrl = backend ? storageUrlResolver(backend.url) : null;

var model = {
    phase: 'loading',
    code: null,
    /** The app's return address for THIS tab (DEV / Expo Go only); untrusted until app-return.js binds it. */
    appReturn: null,
    payload: null,
    view: 'idle',
    editing: null,
    managing: null,
    passes: null,
    result: null,
    entryError: null,
    retryable: false,
};

/** Monotonic ticket so a slow passes response never overwrites a newer one. */
var passesTicket = 0;
var refreshing = false;
/** The open photo viewer's controller, or null. */
var viewer = null;
/** The tile that opened the viewer, to return focus to. */
var viewerOpener = null;

function byId(id) { return document.getElementById(id); }

/** The store listing for THIS device — the muted promotion link's target. */
function storeUrl() {
    if (!LINKS || typeof LINKS.storeUrlFor !== 'function') return null;
    var platform = LINKS.detectPlatform(navigator.userAgent || '', 'ontouchend' in document);
    return LINKS.storeUrlFor(platform);
}

/**
 * The app handoff for the event this code answers — resolved EXCLUSIVELY by
 * app-return.js, exactly as the invitation's pass card does. Production gets
 * `vyvent://e/{id}?code=…`; the DEV mirror gets the Expo Go return address
 * the link carried (`#r=` / `?app_return=`), but only after app-return.js
 * has bound it to THIS event's route — otherwise `{open:false}` and the app
 * screen offers the store and the code instead.
 */
function handoff() {
    if (!RETURN || typeof RETURN.resolveAppHandoff !== 'function') return null;
    if (!model.payload || !model.payload.event || !model.payload.event.id) return null;
    return RETURN.resolveAppHandoff({
        env: ENV.env,
        appReturn: model.appReturn,
        kind: 'e',
        id: String(model.payload.event.id),
        isChat: false,
        code: model.code,
    });
}

function smartOpen(h) {
    if (!LINKS || typeof LINKS.smartOpen !== 'function') return null;
    return LINKS.smartOpen(h, { window: window, document: document, navigator: navigator });
}

function render(scrollTo) {
    var root = byId('rsvp-root');
    var h = handoff();
    clear(root);
    root.appendChild(renderApp(model, handlers, {
        document: document,
        storageUrl: storageUrl,
        storeUrl: storeUrl(),
        handoff: h,
        smartOpen: smartOpen(h),
        navigator: navigator,
        qrcode: QRCODE,
        now: Date.now(),
    }));
    var loading = byId('rsvp-loading');
    if (loading) loading.setAttribute('hidden', '');
    root.removeAttribute('hidden');

    if (scrollTo) {
        var target = root.querySelector(scrollTo);
        if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }
}

function revealDevBadge() {
    if (!ENV.devBadge) return;
    var badge = byId('envBadge');
    if (badge) badge.removeAttribute('hidden');
}

/** The same party, as the CURRENT payload describes it (or null when gone). */
function currentParty(party) {
    if (!party || !model.payload || !Array.isArray(model.payload.parties)) return null;
    var parties = model.payload.parties;
    for (var i = 0; i < parties.length; i += 1) {
        if (parties[i] && parties[i].id === party.id) return parties[i];
    }
    return null;
}

/* ── the photo viewer ─────────────────────────────────────────────────────── */

/**
 * Open the viewer on photo `index`. It mounts in its own root, outside the
 * page tree, so opening and closing never re-renders the page (and never
 * moves the guest's scroll position). Only the current payload's photos are
 * ever shown — the ones the invitation resolved — and nothing is fetched.
 */
function openViewer(index) {
    if (!model.payload) return;
    var photos = photoList(model.payload, storageUrl);
    if (!photos.length) return;
    closeViewer();
    var active = document.activeElement;
    viewerOpener = active && typeof active.focus === 'function' ? active : null;
    viewer = viewerNode(photos, index, closeViewer, { document: document });
    if (!viewer) return;
    var root = byId('rsvp-viewer-root');
    root.appendChild(viewer.node);
    root.removeAttribute('hidden');
    document.body.classList.add('rsvp-viewer-open');
    viewer.setIndex(index, true);
    viewer.focus();
}

function closeViewer() {
    if (!viewer) return;
    var root = byId('rsvp-viewer-root');
    clear(root);
    root.setAttribute('hidden', '');
    document.body.classList.remove('rsvp-viewer-open');
    viewer = null;
    if (viewerOpener && viewerOpener.isConnected) viewerOpener.focus();
    viewerOpener = null;
}

/* ── data ─────────────────────────────────────────────────────────────────── */

/** Resolve a code. `fromEntry` keeps failures on the entry form, inline. */
async function load(code, fromEntry) {
    model.phase = 'loading';
    render();

    var res = await resolveInvitation(code);
    var status = res && typeof res.status === 'string' ? res.status : null;

    if (status === 'ok') {
        model.code = code;
        model.payload = res;
        model.phase = 'ready';
        model.view = 'idle';
        model.editing = null;
        model.managing = null;
        model.passes = null;
        rememberCode(window, code);
        render();
        return;
    }

    if (fromEntry) {
        model.phase = 'enter-code';
        model.entryError = status === 'not_found' ? COPY.codeNotFound
            : status === 'rate_limited' ? COPY.rateLimited
                : COPY.codeOffline;
        render();
        return;
    }

    // Link arrival: ONE neutral answer. Only not_found is terminal — it kills
    // the stored code so a dead link cannot be reopened from this tab.
    if (status === 'not_found') clearCode(window);
    model.code = status === 'not_found' ? null : code;
    model.phase = 'unavailable';
    model.retryable = status !== 'not_found';
    render();
}

/**
 * Fetch THIS party's passes — fresh, every time. A response is applied only
 * if the section is still open for the same party and no newer request was
 * started since.
 */
async function fetchPasses(party) {
    passesTicket += 1;
    var ticket = passesTicket;
    // Opening the section always starts from nothing (onManage clears it); a
    // visibility refresh keeps the current list on screen until the fresh one
    // replaces it, so a QR does not blink away while the phone unlocks.
    if (!model.passes || model.passes.status !== 'ok') model.passes = { status: 'loading' };
    render();

    var res = await getPasses(model.code, party.id);
    if (ticket !== passesTicket || model.view !== 'passes' || !model.managing || model.managing.id !== party.id) return;

    if (res && res.status === 'ok') {
        model.passes = { status: 'ok', data: res };
    } else if (res && res.status === 'not_found') {
        model.passes = { status: 'error', message: COPY.passesGone, retryable: false };
    } else if (res && res.status === 'rate_limited') {
        model.passes = { status: 'error', message: COPY.rateLimited, retryable: true };
    } else {
        model.passes = { status: 'error', message: COPY.passesOffline, retryable: true };
    }
    render();
}

/**
 * Re-resolve the invitation silently (no loading state) so a change the
 * organizer made while this tab was hidden — QR access turned on, a pass
 * count edited, the invitation withdrawn — is reflected without a reload.
 * Skipped while a form is open: re-rendering would discard what the guest
 * is typing, and a submit re-resolves anyway. Skipped while the viewer is
 * open too: the photos on screen are the ones to keep looking at.
 */
async function refresh() {
    if (model.phase !== 'ready' || !model.code || refreshing) return;
    if (model.view === 'attend' || model.view === 'decline') return;
    if (viewer) return;
    refreshing = true;
    try {
        var res = await resolveInvitation(model.code);
        if (model.phase !== 'ready') return;
        if (res && res.status === 'ok') {
            model.payload = res;
            model.editing = currentParty(model.editing);
            model.managing = currentParty(model.managing);
            if (model.view === 'passes' && model.managing) {
                await fetchPasses(model.managing);
            } else {
                if (model.view === 'passes') model.view = 'idle';
                render();
            }
        } else if (res && res.status === 'not_found') {
            clearCode(window);
            model.code = null;
            model.phase = 'unavailable';
            model.retryable = false;
            render();
        }
        // rate_limited / transport failure: keep what is on screen.
    } finally {
        refreshing = false;
    }
}

var handlers = {
    onCode: function (raw) {
        var code = normalizeCode(raw);
        if (!code) {
            model.phase = 'enter-code';
            model.entryError = COPY.codeShape;
            render();
            return;
        }
        model.entryError = null;
        void load(code, true);
    },

    /** view: 'choose' (web path) | 'app' | 'attend' | 'decline'; party when changing an answer. */
    onChoose: function (view, party) {
        model.view = view;
        model.editing = party || null;
        model.managing = null;
        model.passes = null;
        model.result = null;
        render('.rsvp-answer');
    },

    /** "Administrar mis pases" — opens the section and fetches the passes afresh. */
    onManage: function (party) {
        model.view = 'passes';
        model.managing = party;
        model.editing = null;
        model.result = null;
        void fetchPasses(party);
        render('.rsvp-answer');
    },

    onPassesRetry: function () {
        if (model.view === 'passes' && model.managing) void fetchPasses(model.managing);
    },

    onCancel: function () {
        model.view = 'idle';
        model.editing = null;
        model.managing = null;
        model.passes = null;
        render('.rsvp-answer');
    },

    onRetry: function () {
        if (model.code) void load(model.code, false);
    },

    /** A gallery tile: open the viewer on that photo. */
    onPhoto: function (index) {
        openViewer(index);
    },

    /** @returns {Promise<{ok: boolean, message?: string}>} the form shows `message`. */
    onSubmit: async function (answer) {
        var res = await respond(model.code, answer);
        if (!res) return { ok: false, message: COPY.offline };
        if (res.status === 'error') return { ok: false, message: res.message };
        if (res.status === 'rate_limited') return { ok: false, message: COPY.rateLimited };
        if (res.status === 'not_found') {
            clearCode(window);
            model.code = null;
            model.phase = 'unavailable';
            model.retryable = false;
            render();
            return { ok: true };
        }

        // Re-resolve so the "Tu respuesta actual" cards and the seat numbers
        // are the server's, never a local guess.
        var fresh = await resolveInvitation(model.code);
        if (fresh && fresh.status === 'ok') model.payload = fresh;

        model.result = {
            status: answer.status,
            name: answer.name,
            seats: answer.seats,
            partyId: typeof res.party_id === 'string' ? res.party_id : (answer.partyId || null),
        };
        model.view = 'idle';
        model.editing = null;
        model.managing = null;
        model.passes = null;
        render('.rsvp-answer');
        return { ok: true };
    },
};

async function start() {
    revealDevBadge();

    // The return address first: captureCode() strips the address bar.
    model.appReturn = captureReturn(window);
    var code = captureCode(window);
    if (!code) {
        model.phase = 'enter-code';
        render();
        return;
    }
    await load(code, false);
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') void refresh();
});

/* The itinerary chips (Próxima / En curso / Finalizada) follow the clock the
 * way the app's itinerary screen does — a 30 s tick that touches ONLY the
 * rows in place. The page is never re-rendered for it: a guest mid-form
 * keeps every keystroke, and the viewer stays where it is. */
var ITINERARY_TICK_MS = 30000;
setInterval(function () {
    if (model.phase !== 'ready' || !model.payload) return;
    var root = byId('rsvp-root');
    if (root) syncItineraryStatus(root, itineraryList(model.payload), Date.now());
}, ITINERARY_TICK_MS);

start().catch(function () {
    model.phase = 'unavailable';
    model.retryable = !!model.code;
    render();
});
