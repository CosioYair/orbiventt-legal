/* HISTORY SEARCH PLUMBING — the pure parts, extracted so they are testable
 * without a DOM or a network.
 *
 * A search box at a door is a hostile input source: an operator types fast on
 * a phone with a queue in front of them, and every keystroke must NOT become a
 * database call. Three small tools keep that true:
 *
 *   debounce      one trailing call per typing burst (~300 ms)
 *   staleGuard    a late response from an OLD query can never overwrite the
 *                 results of a newer one
 *   normalizeQuery collapse whitespace and refuse 1-character searches, which
 *                 would match half the history and help nobody
 */

/** Trailing-edge debounce. `cancel()` drops any pending call. */
export function debounce(fn, ms, timers) {
    // THE 2026-08-20 SEARCH BUG LIVED ON THIS LINE. The default used to be
    // `{ set: setTimeout, clear: clearTimeout }` — the HOST functions stored as
    // object methods. In a browser, `t.set(...)` then invokes setTimeout with
    // `this === t`, and WebIDL-bound globals throw `Illegal invocation` for
    // that. Every keystroke threw inside the input handler, so the search
    // callback never fired and Ingresos never filtered — while Node's timers,
    // which are not `this`-sensitive, let the whole test suite pass over it.
    // The wrappers below call the globals as FUNCTIONS, which both runtimes
    // accept, and a test now pins that no bare host reference can return here.
    var t = timers || {
        set: function (cb, delay) { return setTimeout(cb, delay); },
        clear: function (id) { clearTimeout(id); },
    };
    var pending = null;
    var wrapped = function () {
        var args = arguments;
        if (pending !== null) t.clear(pending);
        pending = t.set(function () {
            pending = null;
            fn.apply(null, args);
        }, ms);
    };
    wrapped.cancel = function () {
        if (pending !== null) t.clear(pending);
        pending = null;
    };
    return wrapped;
}

/**
 * Monotonic sequence: `begin()` mints a ticket, `isCurrent(ticket)` says
 * whether a response that just arrived still speaks for the latest query.
 */
export function createStaleGuard() {
    var seq = 0;
    return {
        begin: function () { seq += 1; return seq; },
        isCurrent: function (ticket) { return ticket === seq; },
    };
}

/**
 * Normalize an operator's query.
 *
 * @returns {?string} '' for "show recent", the cleaned query, or null for
 *   "do not search yet" (a single character).
 */
export function normalizeQuery(raw) {
    if (typeof raw !== 'string') return '';
    var q = raw.replace(/\s+/g, ' ').trim();
    if (q === '') return '';
    if (q.length < 2) return null;
    return q;
}
