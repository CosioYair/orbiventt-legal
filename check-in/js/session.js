/* THE SCANNER CAPABILITY — how it arrives, where it lives, when it dies.
 *
 * ── Why the FRAGMENT ─────────────────────────────────────────────────────────
 * `#s=…` is never sent in the HTTP request line. A live door credential
 * therefore cannot land in a GitHub Pages access log, a Cloudflare log, a
 * PostgREST log, or a `Referer` header on any outbound navigation. A query
 * string would put it in all four. This module REFUSES a capability supplied
 * as a query parameter, so a mistyped or maliciously reshaped link cannot
 * quietly downgrade the transport.
 *
 * ── Why sessionStorage ───────────────────────────────────────────────────────
 * Memory alone loses the capability on an accidental reload — unacceptable at a
 * door with a queue behind you. `localStorage` outlives the tab and would leave
 * a live capability sitting on a borrowed phone indefinitely. `sessionStorage`
 * survives reload, dies with the tab, and is same-origin only.
 *
 * The fragment is stripped from the visible URL with `history.replaceState`
 * once captured, so the secret is not sitting in the address bar of a phone
 * being held up in a crowd.
 *
 * NEVER logged, never sent to analytics, never placed in a DOM attribute.
 */

var STORAGE_KEY = 'orb.checkin.capability';

/** `OVS1.<16 base32>.<26 base32>` — the shape the database mints. */
var CAPABILITY_SHAPE = /^OVS1\.[0-9A-HJKMNP-TV-Z]{16}\.[0-9A-HJKMNP-TV-Z]{26}$/;

export function isCapabilityShape(value) {
    return typeof value === 'string' && CAPABILITY_SHAPE.test(value);
}

/**
 * Read `s=` from a fragment string. Returns null for anything malformed.
 * Shape validation here is a cheap courtesy so an obviously broken link fails
 * fast — the SERVER is what actually decides whether a capability is real.
 */
export function parseFragment(hash) {
    if (typeof hash !== 'string') return null;
    var raw = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    if (!raw) return null;

    var params;
    try {
        params = new URLSearchParams(raw);
    } catch (_) {
        return null;
    }
    var value = params.get('s');
    if (!value) return null;
    return isCapabilityShape(value) ? value : null;
}

/**
 * Capture the capability for this tab.
 *
 * Order matters: read the fragment, persist it, THEN strip it. Stripping first
 * would lose the credential if persistence threw (private mode, quota).
 */
export function captureCapability(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return null;

    var fromHash = parseFragment(w.location && w.location.hash);

    if (fromHash) {
        try {
            w.sessionStorage.setItem(STORAGE_KEY, fromHash);
        } catch (_) {
            /* Held in memory by the caller regardless. */
        }
        try {
            // Strip the secret from the visible address bar. Path only — never
            // re-append it as a query parameter.
            w.history.replaceState(null, '', w.location.pathname);
        } catch (_) {
            /* Cosmetic only; the capability is already captured. */
        }
        return fromHash;
    }

    // A reload after the fragment was stripped: recover from this tab.
    try {
        var stored = w.sessionStorage.getItem(STORAGE_KEY);
        return isCapabilityShape(stored) ? stored : null;
    } catch (_) {
        return null;
    }
}

/**
 * Forget the capability. Called by `Cerrar scanner` and automatically on every
 * TERMINAL authorization state — revoked or expired — because at that point the
 * link is dead and keeping it only risks it being reopened later.
 */
export function clearCapability(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return;
    try {
        w.sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {
        /* nothing to do */
    }
}

/** A fresh nonce per PHYSICAL scan attempt. Reused verbatim across retries. */
export function newNonce(cryptoImpl) {
    var c = cryptoImpl || (typeof crypto !== 'undefined' ? crypto : null);
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();

    // Fallback for browsers without randomUUID. Uses getRandomValues where
    // available; the nonce is an idempotency key, not a secret, so a
    // non-cryptographic last resort is acceptable rather than failing the door.
    var bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
    else for (var i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = [];
    for (var j = 0; j < 16; j += 1) hex.push((bytes[j] + 0x100).toString(16).slice(1));
    return (
        hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
        hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' +
        hex.slice(10, 16).join('')
    );
}

export { STORAGE_KEY };
