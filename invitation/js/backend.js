/* THE ONLY PLACE THIS PAGE TALKS TO A SERVER.
 *
 * Demo mode never reaches this module. The draft and published routes reach
 * exactly one function each, and both go through the closed call table below —
 * so "which endpoints can this page contact" is a list you can read, not a
 * property you have to trace.
 *
 * WHAT IS AND IS NOT A SECRET
 * `env.js` carries a PUBLISHABLE anon JWT (role=anon). It is meant to ship in
 * client code. Every safety property comes from the backend: the RPCs are
 * SECURITY DEFINER, they return one identical `{not_found:true}` stub for every
 * failure, and a draft is unreachable without an unforgeable HMAC token. There
 * is deliberately NO fallback project here — a deployment whose env.js did not
 * load must fail closed rather than query the wrong environment.
 *
 * The response is NOT trusted either. It is a JSON document from the network,
 * so it goes through the same `normalizeConfig()` as bundled demo data before
 * anything is drawn. The renderer cannot tell the two apart, which is the whole
 * reason the demo was built on the production renderer.
 */

/** RPCs this page may call. A closed set: `callRpc` refuses anything else, so a
 *  future edit cannot turn a value into an endpoint.
 *  `get_invitation_pass_summary` is the claim card's pass count — read-only,
 *  answering only to the published slug + exact code pair, with the same
 *  uniform `{not_found}` stub as everything else (migration 20260803190000). */
const RPCS = Object.create(null);
RPCS.get_invitation_draft = true;
RPCS.get_published_invitation = true;
RPCS.get_invitation_pass_summary = true;

/** Buckets an invitation image may live in. Mirrors the database's
 *  `digital_invitations_known_buckets` constraint — an image from anywhere else
 *  is not ours to render. */
const BUCKETS = Object.create(null);
BUCKETS['event-photos'] = true;
BUCKETS['invitation-media'] = true;

/**
 * Read the deployment's backend configuration.
 * @returns {?{url: string, anon: string}} null when env.js did not load.
 */
export function backendConfig(env) {
    const source = env || (typeof window !== 'undefined' ? window.__ORB_ENV__ : null) || {};
    if (typeof source.supaUrl !== 'string' || !source.supaUrl) return null;
    if (typeof source.supaAnon !== 'string' || !source.supaAnon) return null;
    return { url: source.supaUrl, anon: source.supaAnon };
}

/**
 * Call one of the allowlisted RPCs.
 *
 * @returns {Promise<?object>} the parsed payload, or null for ANY failure —
 *   unknown function, missing configuration, network error, non-2xx, or a body
 *   that is not a JSON object. The caller turns null into the same controlled
 *   state it uses for "not found", so a server hiccup and a wrong token are
 *   indistinguishable to a visitor.
 */
export async function callRpc(name, body, opts) {
    const options = opts || {};
    if (!Object.prototype.hasOwnProperty.call(RPCS, name)) return null;

    const config = backendConfig(options.env);
    if (!config) return null;

    const doFetch = options.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return null;

    let response;
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
        const payload = await response.json();
        return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    } catch (_) {
        return null;
    }
}

/**
 * Build a resolver for Supabase Storage public URLs, for
 * `security.resolveImage`'s `storage` branch.
 *
 * FAILS CLOSED, and repeats the checks the caller already did rather than
 * trusting them: the bucket must be one of ours, the path must survive
 * percent-encoding segment by segment, and the assembled URL's origin must come
 * out exactly equal to the configured project. Same posture as `publicUrl` in
 * 404.html — an image URL is the one value on this page that gets written into
 * an attribute, so it is the one that must not be approximately right.
 */
export function storageUrlResolver(supaUrl) {
    if (typeof supaUrl !== 'string' || !supaUrl) return null;

    let origin;
    try {
        origin = new URL(supaUrl).origin;
    } catch (_) {
        return null;
    }

    return function storageUrl(bucket, path) {
        if (!Object.prototype.hasOwnProperty.call(BUCKETS, bucket)) return null;
        if (typeof path !== 'string' || path === '') return null;
        try {
            const encoded = path.split('/').map(encodeURIComponent).join('/');
            const url = new URL('/storage/v1/object/public/' + bucket + '/' + encoded, supaUrl);
            return url.origin === origin ? url.href : null;
        } catch (_) {
            return null;
        }
    };
}

/** The buckets an invitation image may name. Exported for the test suite. */
export function allowedBuckets() {
    return Object.keys(BUCKETS);
}
