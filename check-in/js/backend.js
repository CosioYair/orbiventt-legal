/* THE ONLY PLACE THIS PAGE TALKS TO A SERVER.
 *
 * Two RPCs, a closed allowlist, nothing else — the same shape as
 * `invitation/js/backend.js`, for the same reason: "which endpoints can this
 * page contact" should be a list you can read, not a property you have to
 * trace through the code.
 *
 * WHAT IS AND IS NOT A SECRET
 * `env.js` carries a PUBLISHABLE anon JWT (role=anon). It is meant to ship in
 * client code and it authenticates NOTHING here — it merely reaches PostgREST.
 * The authorization is the SCANNER CAPABILITY, verified inside the database
 * transaction on every call. There is deliberately NO fallback project: a
 * deployment whose env.js did not load must fail closed rather than query the
 * wrong environment.
 *
 * The browser never decides anything. It cannot read a pass, cannot tell a
 * valid capability from a forged one, and cannot know whether a code has been
 * used. It asks, and it renders the answer.
 */

/** RPCs this page may call. A closed set — `callRpc` refuses anything else. */
var RPCS = Object.create(null);
RPCS.scanner_resolve_access = true;
RPCS.scanner_check_in = true;
RPCS.scanner_search_checkins = true;

/** @returns {?{url: string, anon: string}} null when env.js did not load. */
export function backendConfig(env) {
    var source = env || (typeof window !== 'undefined' ? window.__ORB_ENV__ : null) || {};
    if (typeof source.supaUrl !== 'string' || !source.supaUrl) return null;
    if (typeof source.supaAnon !== 'string' || !source.supaAnon) return null;
    return { url: source.supaUrl, anon: source.supaAnon };
}

/**
 * Call one of the allowlisted RPCs.
 *
 * @returns {Promise<?object>} the parsed payload, or null for ANY transport
 *   failure — unknown function, missing configuration, network error, non-2xx,
 *   or a body that is not an object. The caller turns null into the OFFLINE
 *   state and RETRIES WITH THE SAME NONCE, because a lost response is exactly
 *   the case where the write may already have committed.
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

    if (!response || !response.ok) return null;

    try {
        var parsed = await response.json();
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

/** Bootstrap: what this capability is allowed to see. */
export function resolveAccess(capability, opts) {
    return callRpc('scanner_resolve_access', { p_scanner_token: capability }, opts);
}

/**
 * The atomic check-in.
 *
 * `nonce` identifies ONE PHYSICAL SCAN ATTEMPT and is reused verbatim across
 * retries of that attempt. That is what lets the server answer CHECKED_IN a
 * second time when its first response was lost, instead of telling an operator
 * a guest already entered when the network simply dropped a packet.
 */
/**
 * Check-in HISTORY for the capability's own event — recorded entries only,
 * event-wide across every scanner of that event. The event scope is derived
 * server-side from the capability; nothing here could widen it. This is the
 * one read the door has beyond scanning, and it can only surface people who
 * were already physically admitted.
 */
export function searchCheckins(capability, query, limit, opts) {
    return callRpc(
        'scanner_search_checkins',
        { p_scanner_token: capability, p_query: query || null, p_limit: limit || 25 },
        opts,
    );
}

export function checkIn(capability, passToken, nonce, opts) {
    return callRpc(
        'scanner_check_in',
        { p_scanner_token: capability, p_pass_token: passToken, p_nonce: nonce },
        opts,
    );
}
