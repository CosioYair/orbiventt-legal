/* APP HANDOFF — the single decision point for "Abrir en Orbiventt".
 *
 * Every page that offers to open the app asks this module for the URL, and
 * nothing else in the site is allowed to build one. It exists because the two
 * deployments hand off to two DIFFERENT things, and the difference is not
 * cosmetic:
 *
 *   PRODUCTION (orbiventt.com)      → vyvent://<route>
 *       The installed Orbiventt build owns the `vyvent:` scheme. This is the
 *       real, permanent handoff and it is UNCHANGED by this module.
 *
 *   DEVELOPMENT (vyvent-legal)      → exp://<metro-host>:<port>/--/<route>
 *       A DEV session usually runs inside Expo Go, which does NOT own
 *       `vyvent:`. Emitting `vyvent://` here does not open the DEV project —
 *       iOS routes it straight to the INSTALLED PRODUCTION APP, which then
 *       looks up a DEV event id in the production database and finds nothing.
 *       That silent cross-environment jump is the bug this module removes.
 *
 * The DEV target cannot be a constant: the Metro host is the developer's LAN
 * address (or a tunnel host) and changes per machine, per network, per session.
 * So the app itself computes its own return URL with `Linking.createURL()` at
 * share time and attaches it to the link as `?app_return=`. This module's job
 * is to decide whether that attached URL may be trusted.
 *
 * ── The parameter is attacker-controlled ────────────────────────────────────
 * `?app_return=` arrives in a URL, so anyone who can get a visitor to open a
 * link controls it completely. Handing it to `location = …` unchecked would be
 * a textbook open redirect into arbitrary schemes. Every rule in
 * `expoGoReturnUrl()` below exists to make that impossible, and the resulting
 * href is REBUILT from validated components — the caller's string is never
 * echoed back out.
 *
 * ── Why this file is shared, not DEV-only ───────────────────────────────────
 * `scripts/web-env.mjs` keeps both deployments byte-equivalent apart from
 * `env.js`; behavior is gated on the environment that `env.js` declares, never
 * on which copy of the code is running. Same pattern as the DEV badge: the
 * markup ships everywhere, only `env.js` can reveal it. Production therefore
 * ignores `?app_return=` entirely — it is not merely unused there, it is
 * unreachable, so this DEV affordance cannot weaken the production handoff.
 */
(function (root) {
    'use strict';

    /* The ONLY schemes a return URL may carry. Expo Go registers `exp:` (and
     * `exps:` for its TLS variant); nothing else is a development runtime.
     * Everything a redirect could be abused for — http:, https:, javascript:,
     * data:, blob:, or another app's custom scheme — fails this one check. */
    var EXPO_GO_SCHEMES = { 'exp:': true, 'exps:': true };

    /* The installed app's custom scheme. Production's handoff, verbatim as it
     * has always been built. Never used on the DEV deployment. */
    var APP_SCHEME = 'vyvent://';

    /* Invitation codes are normalized to 12 uppercase alphanumerics by the app
     * (migration 20260610120000); the bound is deliberately loose so a future
     * format still passes, and strict enough that the value can only ever be a
     * query-safe token. */
    var CODE_RE = /^[A-Za-z0-9-]{1,20}$/;

    /** The route this page represents, encoded exactly as the app expects it. */
    function routePath(kind, id, isChat) {
        if (kind !== 'e' && kind !== 'u' && kind !== 'p') return null;
        if (typeof id !== 'string' || id === '') return null;
        if (isChat && kind !== 'e') return null;
        return kind + '/' + encodeURIComponent(id) + (isChat ? '/chat' : '');
    }

    /** `?code=…` when a valid invitation code is present, else ''. */
    function codeQuery(code) {
        if (typeof code !== 'string' || !CODE_RE.test(code)) return '';
        return '?code=' + encodeURIComponent(code);
    }

    /* Percent-decode a path for COMPARISON only. Returns null when the path
     * contains a malformed escape, so a broken encoding can never compare equal
     * to anything. The decoded value is never emitted. */
    function decodePathForCompare(path) {
        try {
            return path.split('/').map(decodeURIComponent).join('/');
        } catch (_) {
            return null;
        }
    }

    /**
     * Validate an attacker-supplied `?app_return=` value and return a SAFE
     * href, or null. Null is the only other outcome — there is deliberately no
     * "best effort" branch that returns something slightly different from what
     * was asked for.
     *
     * A value survives only if ALL of the following hold:
     *   1. It is a non-empty string free of control characters, whitespace and
     *      any character that could break out of an attribute or a URL.
     *   2. It parses as an absolute URL.
     *   3. Its scheme is exactly `exp:` or `exps:`.
     *   4. It carries no embedded credentials (`exp://user:pass@host/…`), which
     *      exist only to make a hostile host look familiar.
     *   5. It has a host — Expo Go return URLs always name a Metro server. The
     *      host itself is intentionally NOT constrained: a LAN address, a
     *      localhost port and an `*.exp.direct` tunnel are all legitimate, and
     *      an allowlist here would silently break tunnel-mode development.
     *   6. It carries no query string and no fragment of its own. We append the
     *      invitation code ourselves, so anything already there is unexpected
     *      input rather than something to merge.
     *   7. Its path is EXACTLY `/--/<route>` for the route this page is
     *      rendering. This is the check that binds the return URL to the page:
     *      a link for event A can never carry a return URL that opens event B,
     *      a settings screen, or any other route.
     *
     * The href returned is assembled from the validated scheme, the validated
     * host and the route THIS PAGE computed — never from the raw input.
     */
    function expoGoReturnUrl(raw, kind, id, isChat) {
        var route = routePath(kind, id, isChat);
        if (!route) return null;
        if (typeof raw !== 'string' || raw === '') return null;
        // Rule 1 — reject control chars, spaces, quotes, angle brackets,
        // backticks and backslashes before the URL parser gets a chance to
        // normalize any of them away.
        if (/[\x00-\x20\x7f"'`<>\\]/.test(raw)) return null;

        var url;
        try {
            url = new URL(raw);                                   // Rule 2
        } catch (_) {
            return null;
        }

        if (!EXPO_GO_SCHEMES[String(url.protocol).toLowerCase()]) return null;  // Rule 3
        if (url.username || url.password) return null;                          // Rule 4
        if (!url.host) return null;                                             // Rule 5
        if (url.search || url.hash) return null;                                // Rule 6

        var expected = '/--/' + route;                                          // Rule 7
        var got = decodePathForCompare(url.pathname);
        if (got === null || got !== decodePathForCompare(expected)) return null;

        return String(url.protocol).toLowerCase() + '//' + url.host + expected;
    }

    /**
     * Resolve the app handoff for the route this page is rendering.
     *
     * @param {object} opts
     *   env       {string}  `window.__ORB_ENV__.env` — 'dev' on the mirror.
     *   appReturn {string}  raw `?app_return=` value (untrusted, may be absent).
     *   kind      {'e'|'u'|'p'}
     *   id        {string}  event id / user id / provider username.
     *   isChat    {boolean} the `/e/{id}/chat` sub-route.
     *   code      {string}  invitation code from `?code=` (optional).
     *
     * @returns {{open: boolean, href: string|null, source: string, reason: string|null}}
     *   `open:false` means DO NOT navigate anywhere. There is no third state
     *   and no fallback href: on the DEV deployment a failed validation must
     *   never degrade into `vyvent://`, because that opens the production app
     *   against the production database — the exact defect this replaces.
     */
    function resolveAppHandoff(opts) {
        opts = opts || {};
        var route = routePath(opts.kind, opts.id, opts.isChat === true);
        if (!route) return { open: false, href: null, source: 'none', reason: 'invalid-route' };

        var query = codeQuery(opts.code);

        // PRODUCTION (and any non-dev deployment): the custom scheme, exactly as
        // before. `app_return` is not read on this branch at all.
        if (opts.env !== 'dev') {
            return { open: true, href: APP_SCHEME + route + query, source: 'app-scheme', reason: null };
        }

        // DEVELOPMENT: only a return URL that proves it belongs to this page.
        var href = expoGoReturnUrl(opts.appReturn, opts.kind, opts.id, opts.isChat === true);
        if (!href) return { open: false, href: null, source: 'none', reason: 'expo-go-required' };
        return { open: true, href: href + query, source: 'expo-go', reason: null };
    }

    var api = {
        resolveAppHandoff: resolveAppHandoff,
        expoGoReturnUrl: expoGoReturnUrl,
        EXPO_GO_SCHEMES: EXPO_GO_SCHEMES,
    };

    // Browser: a global, loaded as a classic script before the page's inline
    // logic. Node: a CommonJS export so `scripts/__tests__` can exercise the
    // exact file the site serves — not a copy of it.
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.__ORB_APP_RETURN__ = api;
})(typeof window !== 'undefined' ? window : null);
