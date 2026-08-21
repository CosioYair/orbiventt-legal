/* ROUTE CONTRACT for /invitation/.
 *
 * One page serves every way an invitation can be reached. The mode is decided
 * ONLY by the query string, and every recognized parameter is validated before
 * it is handed on — an unparseable or hostile query resolves to a controlled
 * state, never to a partially-trusted one.
 *
 *   ?demo={registryId}                  bundled demonstration data. No database
 *                                       record, no authentication, no preview
 *                                       token, no network at all.
 *
 *   ?d={invitationId}&t={previewToken}  the ORGANIZER's private draft preview.
 *                                       Token-gated; renders any status.
 *
 *   ?i={slug}                           the PUBLISHED invitation. Anonymous,
 *                                       and resolvable only while the
 *                                       invitation is actually published.
 *
 *   ?i={slug}&code={smartInvitationCode} published + a pass-claim code. The
 *                                       PUBLISHED page renders the claim card
 *                                       for it: the code is displayed, copyable
 *                                       and handed to the Orbiventt app, which
 *                                       owns the entire redemption lifecycle.
 *                                       The web never redeems anything.
 *
 *   &app_return={expoGoUrl}             optional, DEV only: the Expo Go return
 *                                       address the app attached at share time.
 *                                       Carried for `app-return.js`, which
 *                                       re-validates it from scratch before the
 *                                       "Abrir Orbiventt" button will use it —
 *                                       exactly as the event-preview page does.
 *
 * The three data modes stay isolated: each reaches exactly one source, and no
 * mode can fall through to another's. Demo data is not even in the module graph
 * of the two stored routes.
 *
 * `demo` is NOT a way to reach stored data. It selects a registry key, and the
 * registry is a closed set of literals — see registry.js.
 */
import { safeCode, safeToken, safeSlug, safeAppReturn } from './security.js?v=20260821a';

export const MODE = {
    DEMO: 'demo',
    DRAFT: 'draft',
    PUBLISHED: 'published',
    NONE: 'none',
};

/** Registry identifiers are `{category}_{template}_v{n}` — a closed shape. */
const REGISTRY_ID = /^[a-z][a-z0-9_]{2,48}_v[0-9]{1,3}$/;

/**
 * Parse a query string into a route.
 *
 * @param {string} search  e.g. `location.search`
 * @returns {{mode: string, demoId: ?string, invitationId: ?string,
 *            previewToken: ?string, slug: ?string, code: ?string}}
 */
export function parseRoute(search) {
    const empty = {
        mode: MODE.NONE,
        demoId: null,
        invitationId: null,
        previewToken: null,
        slug: null,
        code: null,
        appReturn: null,
    };

    let params;
    try {
        params = new URLSearchParams(typeof search === 'string' ? search : '');
    } catch (_) {
        return empty;
    }

    const get = (name) => {
        try {
            const value = params.get(name);
            return typeof value === 'string' ? value : null;
        } catch (_) {
            return null;
        }
    };

    const code = safeCode(get('code'));
    const appReturn = safeAppReturn(get('app_return'));

    const demo = get('demo');
    if (demo !== null) {
        const demoId = typeof demo === 'string' && REGISTRY_ID.test(demo) ? demo : null;
        // An unrecognized `?demo=` value is still DEMO mode: the renderer must
        // answer "that template does not exist", not fall through to a route
        // the visitor never asked for.
        return { ...empty, mode: MODE.DEMO, demoId, code, appReturn };
    }

    const invitationId = safeToken(get('d'), 64);
    if (invitationId) {
        return {
            ...empty,
            mode: MODE.DRAFT,
            invitationId,
            previewToken: safeToken(get('t'), 128),
            code,
            appReturn,
        };
    }

    // The published slug is validated against the DATABASE's shape rule, not the
    // looser token rule: a value the database could not have stored resolves to
    // NONE, so it never becomes a request. See `safeSlug`.
    const slug = safeSlug(get('i'));
    if (slug) {
        return { ...empty, mode: MODE.PUBLISHED, slug, code, appReturn };
    }

    return { ...empty, code, appReturn };
}
