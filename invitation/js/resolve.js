/* RESOLVING A STORED INVITATION — the draft and published routes.
 *
 * Extracted from `main.js` so the whole decision can be executed under
 * `node --test` with a stub RPC: which endpoint a route may contact, with which
 * parameters, and what every failure resolves to. Those are the properties that
 * matter most on this page, and asserting them against the shipped file is
 * worth more than asserting them against a description of it.
 *
 * DOM-FREE and side-effect free. It fetches, it decides, it returns a verdict;
 * drawing is `main.js`'s job.
 *
 * ── THE CALL TABLE ──────────────────────────────────────────────────────────
 * A closed map from route mode to the ONE request that mode may make. It is
 * data, not branching, so "what can the published route contact" is a line you
 * read rather than a path you trace — and `callRpc` in backend.js independently
 * refuses anything outside its own allowlist, so both layers would have to be
 * wrong at once.
 *
 *   draft      get_invitation_draft     { p_invitation_id, p_token }
 *   published  get_published_invitation { p_slug }
 *
 * The published request carries NO token. It cannot: publishing is what makes an
 * invitation resolvable, and a token in a link meant to be forwarded to two
 * hundred guests would be a secret that is not one.
 *
 * ── ONE FAILURE, ONE ANSWER ─────────────────────────────────────────────────
 * Unknown slug, malformed slug, a draft, an unpublished invitation, a deleted
 * one, a moderated event, a template this build does not have, a configuration
 * that will not normalize, a network error: `unavailable`, every time. A guest
 * cannot learn from this page whether a private invitation exists.
 *
 * The single exception is the ORGANIZER's own draft that is merely unfinished —
 * `incomplete` — which is not an error and is only ever reachable by someone
 * holding the unforgeable preview token for that specific invitation.
 */
import { MODE } from './route.js?v=20260818b';

/** Verdicts. `ok` carries a template and a normalized config; the rest do not. */
export const RESULT = {
    OK: 'ok',
    UNAVAILABLE: 'unavailable',
    INCOMPLETE: 'incomplete',
};

/** The only shape an event id may have on its way into a deep-link route. */
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The closed call table. Returns null for a mode that reaches no backend. */
export function storedRequest(route) {
    if (!route) return null;

    if (route.mode === MODE.DRAFT) {
        // BOTH parts are required. A draft link without a token is answered
        // without a request, because there is nothing a request could add.
        if (!route.invitationId || !route.previewToken) return null;
        return {
            rpc: 'get_invitation_draft',
            params: { p_invitation_id: route.invitationId, p_token: route.previewToken },
        };
    }

    if (route.mode === MODE.PUBLISHED) {
        if (!route.slug) return null;
        return { rpc: 'get_published_invitation', params: { p_slug: route.slug } };
    }

    return null;
}

/**
 * The pass-summary request for a published route carrying a code, or null when
 * that request must not exist (any other mode, no code, no slug). Like
 * `storedRequest`, this is data: the ONE extra call the claim card may make.
 */
export function passSummaryRequest(route) {
    if (!route || route.mode !== MODE.PUBLISHED) return null;
    if (!route.slug || !route.code) return null;
    return {
        rpc: 'get_invitation_pass_summary',
        params: { p_slug: route.slug, p_code: route.code },
    };
}

/** Pass counts a card may render. Bounds mirror the database's own
 *  `seat_capacity between 1 and 1000` CHECK; anything outside them is a payload
 *  this backend could not have produced, and renders nothing. */
const MAX_SEATS = 1000;

/**
 * Validate a pass-summary payload into `{seatCapacity, seatsRemaining}`, or
 * null. Null means the card simply omits the allocation line — never a made-up
 * number, never an error a guest has to read.
 */
export function normalizePassSummary(payload) {
    if (!payload || typeof payload !== 'object' || payload.not_found) return null;
    const capacity = payload.seat_capacity;
    const remaining = payload.seats_remaining;
    if (!Number.isInteger(capacity) || !Number.isInteger(remaining)) return null;
    if (capacity < 1 || capacity > MAX_SEATS) return null;
    if (remaining < 0 || remaining > capacity) return null;
    return { seatCapacity: capacity, seatsRemaining: remaining };
}

/**
 * Fetch and validate a stored invitation.
 *
 * @param {object} route     from `parseRoute`
 * @param {object} deps      { callRpc, resolveTemplate, normalizeConfig }
 * @returns {Promise<{result: string, template?: object, config?: object,
 *                    invitation?: object}>}
 */
export async function resolveStored(route, deps) {
    const request = storedRequest(route);
    if (!request) return { result: RESULT.UNAVAILABLE };

    const payload = await deps.callRpc(request.rpc, request.params);
    if (!payload || payload.not_found || !payload.invitation) {
        return { result: RESULT.UNAVAILABLE };
    }

    const invitation = payload.invitation;

    // FAIL CLOSED on a template this build does not have. There is no "closest
    // match" and no default design: rendering somebody's wedding with a
    // template they did not choose is worse than not rendering it.
    const template = deps.resolveTemplate(
        String(invitation.templateKey) + '_v' + String(invitation.templateVersion),
    );
    if (!template) return { result: RESULT.UNAVAILABLE };

    const normalized = deps.normalizeConfig(invitation.config);
    if (!normalized || !normalized.ok) {
        // A DRAFT that will not normalize is simply unfinished, and the person
        // looking at it is its author. A PUBLISHED one that will not normalize
        // should have been stopped by the publish gate — so it is treated as
        // any other unavailable invitation rather than explained to a guest.
        return {
            result: route.mode === MODE.DRAFT ? RESULT.INCOMPLETE : RESULT.UNAVAILABLE,
        };
    }

    return {
        result: RESULT.OK,
        template,
        config: normalized.config,
        // Identity plus the invitation's EVENT ID — never the organizer id and
        // never the raw row. The event id exists for exactly one consumer: the
        // app handoff, whose deep-link route is `e/{eventId}` (the same shape
        // the event-preview page has always used, so this reveals nothing the
        // payload and those public URLs do not already carry). It is never
        // rendered as text. UUID-shaped or absent — a payload that names an
        // event the database could not have keyed simply loses its handoff.
        invitation: {
            categoryKey: invitation.categoryKey,
            templateKey: invitation.templateKey,
            templateVersion: invitation.templateVersion,
            eventId: EVENT_ID.test(String(invitation.eventId)) ? invitation.eventId : null,
        },
    };
}
