/* THE ONLY PLACE THIS PAGE TALKS TO A SERVER.
 *
 * Three RPCs, a closed allowlist, nothing else — the same shape as
 * `check-in/js/backend.js`. All three answer to the EXISTING Smart
 * Invitation code; there is no invitation-creating surface here, because there
 * is no new invitation type (migrations 20261011200000 + 20261012120000).
 *
 *   guest_resolve_invitation(code)        what this code may see
 *   guest_respond(...)                    attend / decline / change the answer
 *   guest_get_passes(code, party)         this party's passes + signed QR payloads
 *
 * WHAT IS AND IS NOT A SECRET. `env.js` carries a PUBLISHABLE anon JWT; it
 * authenticates nothing here. The authorization is the CODE, verified inside
 * the database on every call. There is deliberately NO fallback project: a
 * deployment whose env.js did not load fails closed.
 *
 * ERROR SHAPE. The write RPC raises Spanish messages the guest is meant to
 * read ("Solo queda(n) 2 pase(s)…", "El evento ya está lleno."). PostgREST
 * delivers them as HTTP 400 with `{message}`; `callRpc` turns exactly that
 * into `{status:'error', message}` so the UI can show it verbatim. Every other
 * failure — unknown function, no configuration, network, other non-2xx, a body
 * that is not an object — is null, which the UI renders as one neutral state.
 */

/** RPCs this page may call. A closed set — `callRpc` refuses anything else. */
var RPCS = Object.create(null);
RPCS.guest_resolve_invitation = true;
RPCS.guest_respond = true;
RPCS.guest_get_passes = true;

/** Buckets an image on this page may come from (resolver payload only).
 *  `invitation-media` carries the published digital invitation's share
 *  thumbnail (`invitation_image`), which is the page's first image. */
var BUCKETS = Object.create(null);
BUCKETS['event-photos'] = true;
BUCKETS['invitation-media'] = true;
BUCKETS.avatars = true;

/** @returns {?{url: string, anon: string}} null when env.js did not load. */
export function backendConfig(env) {
    var source = env || (typeof window !== 'undefined' ? window.__ORB_ENV__ : null) || {};
    if (typeof source.supaUrl !== 'string' || !source.supaUrl) return null;
    if (typeof source.supaAnon !== 'string' || !source.supaAnon) return null;
    return { url: source.supaUrl, anon: source.supaAnon };
}

async function jsonObject(response) {
    try {
        var parsed = await response.json();
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

/**
 * Call one of the allowlisted RPCs.
 *
 * @returns {Promise<?object>} the parsed payload on 2xx; `{status:'error',
 *   message}` for a PostgREST 400 that carries a message; null otherwise.
 */
export async function callRpc(name, body, opts) {
    var options = opts || {};
    if (!Object.prototype.hasOwnProperty.call(RPCS, name)) return null;

    var config = backendConfig(options.env);
    if (!config) return null;

    var doFetch = options.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return null;

    var response;
    try {
        response = await doFetch(config.url + '/rest/v1/rpc/' + name, {
            method: 'POST',
            headers: {
                apikey: config.anon,
                Authorization: 'Bearer ' + config.anon,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body || {}),
        });
    } catch (_) {
        return null;
    }

    if (!response) return null;
    if (response.ok) return jsonObject(response);

    if (response.status === 400) {
        var failure = await jsonObject(response);
        if (failure && typeof failure.message === 'string' && failure.message) {
            return { status: 'error', message: failure.message };
        }
    }
    return null;
}

/** What this code may see: event, invitation, and this code's own parties. */
export function resolveInvitation(code, opts) {
    return callRpc('guest_resolve_invitation', { p_code: code }, opts);
}

/**
 * Attend, decline, or change an answer.
 *
 * @param {object} answer  {partyId, name, status, seats, companions, note}
 *   `seats` counts the responder; `companions` names positions 2..seats;
 *   `note` is sent only when declining. Nothing else — never an event id, never
 *   an invitation id: the code is the only authority the server accepts.
 */
export function respond(code, answer, opts) {
    var a = answer || {};
    var attending = a.status === 'attending';
    return callRpc('guest_respond', {
        p_code: code,
        p_party_id: a.partyId || null,
        p_party_name: a.name,
        p_status: a.status,
        p_seats: attending ? a.seats : 0,
        p_companions: attending ? (Array.isArray(a.companions) ? a.companions : []) : null,
        p_note: !attending && a.note ? a.note : null,
    }, opts);
}

/**
 * This party's passes, FRESH on every call. The server signs the QR payloads
 * on read and never stores them; this page never caches them either — the
 * section that shows them re-fetches each time it opens, so a QR toggle the
 * organizer flipped a second ago is what the guest sees.
 */
export function getPasses(code, partyId, opts) {
    return callRpc('guest_get_passes', { p_code: code, p_party_id: partyId }, opts);
}

/** A plain relative object path: no scheme, no traversal, no breakout chars. */
function safeStoragePath(path) {
    if (typeof path !== 'string' || path === '' || path.length > 512) return null;
    if (/[\x00-\x1f\x7f"'`<>\\]/.test(path)) return null;
    if (path.charAt(0) === '/' || path.indexOf('//') !== -1) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
    var parts = path.split('/');
    for (var i = 0; i < parts.length; i += 1) {
        if (parts[i] === '' || parts[i] === '.' || parts[i] === '..') return null;
    }
    return path;
}

/**
 * Build a resolver for Supabase Storage public URLs. FAILS CLOSED: the bucket
 * must be one of ours, the path must survive the checks above, and the
 * assembled URL's origin must equal the configured project — the same posture
 * as `invitation/js/backend.js`.
 */
export function storageUrlResolver(supaUrl) {
    if (typeof supaUrl !== 'string' || !supaUrl) return null;
    var origin;
    try {
        origin = new URL(supaUrl).origin;
    } catch (_) {
        return null;
    }
    return function storageUrl(bucket, path) {
        if (!Object.prototype.hasOwnProperty.call(BUCKETS, bucket)) return null;
        var safe = safeStoragePath(path);
        if (!safe) return null;
        try {
            var encoded = safe.split('/').map(encodeURIComponent).join('/');
            var url = new URL('/storage/v1/object/public/' + bucket + '/' + encoded, supaUrl);
            return url.origin === origin ? url.href : null;
        } catch (_) {
            return null;
        }
    };
}
