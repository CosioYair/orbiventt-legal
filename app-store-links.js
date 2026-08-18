/* APP DISTRIBUTION — the single place the store listings and the platform
 * decision live, and the one module that knows how to make "open the app" also
 * mean "get the app" when the app is not there.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * `app-return.js` answers ONE question: which URL opens Orbiventt for this
 * page. It has no opinion about what happens when nothing on the device
 * answers that URL — and until now nothing did, so a guest without Orbiventt
 * tapped the button and arrived nowhere. This module is the second half of that
 * decision, deliberately kept separate: the handoff stays a pure, testable
 * URL-resolution rule, and the browser-lifecycle machinery lives here.
 *
 * It is also the ONLY declaration of the store URLs anywhere on this site. Both
 * surfaces that offer the app — the event/profile landing page (404.html) and
 * the Digital Invitation's pass-claim card — read them from here, so the two can
 * never drift and neither can quietly hardcode a link.
 *
 * ── The three strategies, and why each platform gets the one it does ─────────
 *
 *   android-intent        `intent://…#Intent;…;S.browser_fallback_url=…;end`
 *       The browser itself resolves this: Orbiventt installed → the app opens;
 *       not installed → the browser navigates to the fallback URL. The decision
 *       is made by Android against the real package list, so there is NO
 *       installed-app guess and no race. This is the strongest mechanism
 *       available to us today and it is why Android needs no timer to be
 *       correct.
 *
 *   ios-scheme-fallback   `vyvent://…` + a lifecycle-guarded store fallback
 *       Safari has no intent:// equivalent, and Orbiventt has no Universal
 *       Links yet (no `associatedDomains` in the build, no
 *       apple-app-site-association hosted), so the custom scheme is the only
 *       thing that can open the app. A custom scheme fails SILENTLY, so the
 *       only signal that it worked is the page going away — hence the timer,
 *       and hence every guard in `arm()` below.
 *
 *   store-direct          the store listing, immediately
 *       Desktop. `vyvent://` means nothing there, so attempting it is a
 *       guaranteed dead end. The single CTA simply becomes the download.
 *
 * ── What it deliberately does NOT do ────────────────────────────────────────
 * It never touches the DEV mirror's Expo Go handoff. `smartOpen()` acts only on
 * a handoff whose `source` is `app-scheme` — the installed Orbiventt build. An
 * `exp://` address targets a DIFFERENT application, and sending that guest to
 * Orbiventt's store page would be a wrong answer dressed as a helpful one, so
 * the DEV path keeps exactly the behavior it has today.
 *
 * It carries no analytics, logs nothing, and reads nothing from the URL. The
 * invitation code travels inside the handoff href it was given and is never
 * inspected, copied out, or attached to the store URL.
 */
(function (root) {
    'use strict';

    /* ── The canonical listings ─────────────────────────────────────────────
     * Both verified live (2026-08-17) and both resolve to Orbiventt. These are
     * the same two URLs the mobile app's own store-update gate uses
     * (`mobile_release_policy`), and they are storefront-neutral: Apple and
     * Google redirect to the visitor's country automatically. */
    var STORE = {
        PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.vyvent.mobile',
        APP_STORE_URL: 'https://apps.apple.com/app/id6788249586',
    };

    /** The Android application id. Same value as `.well-known/assetlinks.json`
     *  and the mobile build's `android.package` — an intent URL naming the
     *  wrong package would silently fall through to the store on every device,
     *  including the ones that have Orbiventt. */
    var ANDROID_PACKAGE = 'com.vyvent.mobile';

    /** The scheme the installed build owns. The ONLY scheme this module will
     *  wrap: it is the only one whose package we know. */
    var APP_SCHEME = 'vyvent';

    /* How long iOS waits before deciding the app did not open. Long enough that
     * a slow device still wins the race, short enough that a guest without the
     * app is not left staring at a page that did nothing. */
    var FALLBACK_MS = 1500;

    /* RETIRED 2026-08-18, and the reason is worth keeping.
     *
     * This used to be a wall-clock slack: a timer firing more than
     * FALLBACK_MS + 800 ms late was read as "the tab was suspended while the
     * app was open, and the visitor has just come back", and the fallback was
     * cancelled. It was a PROXY for foreground departure, and the proxy was
     * wrong — the same lateness is produced by anything that blocks the run
     * loop without the page ever leaving the foreground, including the native
     * "la dirección no es válida" alert iOS shows when no app answers the
     * scheme. A guest who took more than 2.3 s to dismiss that alert had their
     * fallback cancelled by this line and was stranded.
     *
     * Departure is now measured directly (`everHidden`) instead of guessed
     * from a clock, so the proxy is gone rather than merely retuned. The
     * export is kept at 0 so anything reading it sees "no slack".
     */
    var SUSPEND_SLACK_MS = 0;

    /**
     * Which device is holding this page.
     *
     * @param {string} userAgent
     * @param {boolean} hasTouch  `'ontouchend' in document`
     * @returns {'ios'|'android'|'mac'|'desktop'}
     */
    function detectPlatform(userAgent, hasTouch) {
        var ua = typeof userAgent === 'string' ? userAgent : '';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        // iPadOS 13+ reports a desktop Safari user agent ("Macintosh"); the
        // touch probe is what still tells an iPad from a Mac. Same test the
        // landing page has always used.
        if (/Macintosh/i.test(ua) && hasTouch === true) return 'ios';
        if (/Android/i.test(ua)) return 'android';
        if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
        return 'desktop';
    }

    /**
     * The store listing for a platform. A Mac is treated as an iPhone owner's
     * desktop — the likeliest truth, and the only one of the two answers that
     * can possibly be right for them. Everything else gets Google Play.
     */
    function storeUrlFor(platform) {
        if (platform === 'ios' || platform === 'mac') return STORE.APP_STORE_URL;
        return STORE.PLAY_STORE_URL;
    }

    /** Only these two run an app; the other two are download surfaces. */
    function isMobilePlatform(platform) {
        return platform === 'ios' || platform === 'android';
    }

    /**
     * Rewrite an app-scheme URL as an Android intent URL carrying its own
     * browser fallback, or null when it cannot be done safely.
     *
     * Returning null is a real outcome, not an error path: the caller then
     * keeps the plain scheme link, which is exactly today's behavior. A
     * malformed intent URL would be worse than no intent URL at all.
     *
     * FAILS CLOSED on:
     *   • anything that is not `vyvent://…` — we only know this app's package;
     *   • a fragment — `#` starts the intent's own parameter block, so a href
     *     carrying one could inject or truncate the extras;
     *   • a `;` in the payload — the extras are `;`-delimited, same reasoning;
     *   • a fallback that is not an https URL.
     *
     * The fallback is percent-encoded because its own `:`/`/`/`?`/`=` would
     * otherwise be read as intent syntax.
     */
    function androidIntentUrl(href, fallbackUrl) {
        if (typeof href !== 'string' || typeof fallbackUrl !== 'string') return null;
        if (!/^https:\/\//.test(fallbackUrl)) return null;

        var parsed = /^([a-z][a-z0-9+.\-]*):\/\/([^#]*)$/i.exec(href);
        if (!parsed) return null;
        if (parsed[1].toLowerCase() !== APP_SCHEME) return null;

        var payload = parsed[2];
        if (payload === '' || payload.indexOf(';') !== -1) return null;

        return 'intent://' + payload + '#Intent'
            + ';scheme=' + APP_SCHEME
            + ';package=' + ANDROID_PACKAGE
            + ';S.browser_fallback_url=' + encodeURIComponent(fallbackUrl)
            + ';end';
    }

    /** `'ontouchend' in document`, defended against exotic embedded browsers. */
    function touchCapable(doc) {
        try {
            return !!doc && 'ontouchend' in doc;
        } catch (_) {
            return false;
        }
    }

    /**
     * Attach the store fallback to one control.
     *
     * Everything here exists because the ONLY evidence a custom scheme worked is
     * that this page stopped being in front of the visitor. So:
     *
     *   • ONE latch (`armed`) — a second tap while a fallback is pending does
     *     nothing at all. No second timer, no second listener, no second window.
     *   • The listeners and the timer are registered together and removed
     *     together by `disarm()`. There is no path that clears one and leaves
     *     the other.
     *   • ONLY foreground DEPARTURE cancels: `visibilitychange` with
     *     `document.hidden`, or `pagehide`. Those two mean another application
     *     really did take the screen.
     *   • `blur` is deliberately NOT a cancel signal. Losing keyboard focus is
     *     not leaving: Safari blurs the page for its own native UI, including
     *     the "la dirección no es válida" alert it shows when NOTHING answers
     *     the custom scheme. Treating that as a successful launch cancelled
     *     the fallback at the exact moment it was needed and stranded the
     *     guest at the error — the 2026-08-18 production incident.
     *   • Departure is REMEMBERED (`everHidden`), not inferred from a clock. A
     *     timer that runs late because the run loop was blocked is still a
     *     failed launch if the page never went away, so it still reaches the
     *     store; a timer that survives an actual departure never does.
     *   • A timer that fires while the document is hidden cancels — the visit
     *     is happening inside Orbiventt.
     *   • Navigation is wrapped: an embedded browser that refuses the scheme
     *     outright goes to the store immediately instead of hanging.
     *
     * @returns {Function} disarm — idempotent; also the test seam.
     */
    function arm(anchor, plan, env) {
        var noop = function () {};
        if (!anchor || typeof anchor.addEventListener !== 'function') return noop;
        if (!plan || !plan.storeUrl) return noop;
        // Desktop already points AT the store. There is nothing to fall back to
        // and nothing to wait for.
        if (plan.strategy === 'store-direct') return noop;

        var e = env || {};
        var win = e.window;
        var doc = e.document;
        if (!win || !doc) return noop;
        // No clock. The decision used to consult one; it now consults whether
        // the page actually left, which is the thing a clock was standing in
        // for. `env.now` is still accepted by callers and simply unused here.

        var armed = false;
        var timer = null;
        var bound = [];
        /* Did this page actually leave the foreground since the tap? This is
         * the ONLY thing that distinguishes "Orbiventt opened" from "nothing
         * answered and Safari put an alert on top of us", and it is recorded
         * rather than re-derived, because by the time a late timer runs the
         * page may already be visible again. */
        var everHidden = false;

        function disarm() {
            if (timer !== null) {
                try { win.clearTimeout(timer); } catch (_) { /* nothing to undo */ }
                timer = null;
            }
            for (var i = 0; i < bound.length; i++) {
                try { bound[i].target.removeEventListener(bound[i].type, bound[i].fn); } catch (_) {}
            }
            bound.length = 0;
            armed = false;
        }

        function bind(target, type, fn) {
            if (!target || typeof target.addEventListener !== 'function') return;
            target.addEventListener(type, fn);
            bound.push({ target: target, type: type, fn: fn });
        }

        function go(url) {
            try { win.location.href = url; return true; } catch (_) { return false; }
        }

        anchor.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (armed) return;                       // duplicate tap — already running
            armed = true;

            if (!go(plan.href)) {                    // the browser refused the scheme
                disarm();
                go(plan.storeUrl);
                return;
            }

            // DEPARTURE ONLY. `blur` is absent on purpose — see the header.
            bind(doc, 'visibilitychange', function () {
                if (doc.hidden) { everHidden = true; disarm(); }
            });
            bind(win, 'pagehide', function () { everHidden = true; disarm(); });

            timer = win.setTimeout(function () {
                timer = null;
                // The page left at some point, or is away right now: Orbiventt
                // has it. Never send a store on top of that.
                if (everHidden || doc.hidden) { disarm(); return; }
                // Still here, still in front. However late this is — the run
                // loop can be blocked for as long as it takes someone to
                // dismiss a native alert — the scheme found no handler, and the
                // store is the whole reason this timer exists.
                disarm();
                go(plan.storeUrl);
            }, FALLBACK_MS);
        });

        return disarm;
    }

    /**
     * The smart-open plan for a resolved app handoff, or null.
     *
     * Null means "there is nothing smart to do here" and the caller must use the
     * handoff exactly as it is — the DEV Expo Go path, a closed handoff, or an
     * href this module could not safely rewrite. Every null is today's behavior,
     * unchanged.
     *
     * @param {?object} handoff  `app-return.js` → {open, href, source, …}
     * @param {object} env  {window, document, navigator, platform?, now?}
     * @returns {?{strategy: string, href: string, storeUrl: string,
     *             platform: string, arm: Function}}
     */
    function smartOpen(handoff, env) {
        if (!handoff || handoff.open !== true) return null;
        if (typeof handoff.href !== 'string' || handoff.href === '') return null;
        // THE ONE GATE. `app-scheme` is the installed Orbiventt build; anything
        // else (`expo-go`) is a different application whose absence Orbiventt's
        // store listing does not fix.
        if (handoff.source !== 'app-scheme') return null;

        var e = env || {};
        var win = e.window || null;
        var doc = e.document || (win && win.document) || null;
        var nav = e.navigator || (win && win.navigator) || null;
        if (!win || !doc) return null;

        var platform = e.platform
            || detectPlatform(nav && nav.userAgent, touchCapable(doc));
        var storeUrl = storeUrlFor(platform);
        if (!storeUrl) return null;

        var strategy;
        var href;

        if (platform === 'android') {
            href = androidIntentUrl(handoff.href, storeUrl);
            // Unwrappable — keep the plain scheme link rather than emit a
            // half-built intent. The guest is no worse off than yesterday.
            if (!href) return null;
            strategy = 'android-intent';
        } else if (platform === 'ios') {
            href = handoff.href;
            strategy = 'ios-scheme-fallback';
        } else {
            // Desktop and macOS: no custom-scheme loop, no timer, no dead end.
            href = storeUrl;
            strategy = 'store-direct';
        }

        var plan = {
            strategy: strategy,
            href: href,
            storeUrl: storeUrl,
            platform: platform,
            arm: noopArm,
        };
        plan.arm = function (anchor) {
            return arm(anchor, plan, {
                window: win,
                document: doc,
                now: e.now,
            });
        };
        return plan;
    }

    function noopArm() { return function () {}; }

    var api = {
        STORE: STORE,
        ANDROID_PACKAGE: ANDROID_PACKAGE,
        APP_SCHEME: APP_SCHEME,
        FALLBACK_MS: FALLBACK_MS,
        SUSPEND_SLACK_MS: SUSPEND_SLACK_MS,
        detectPlatform: detectPlatform,
        storeUrlFor: storeUrlFor,
        isMobilePlatform: isMobilePlatform,
        androidIntentUrl: androidIntentUrl,
        smartOpen: smartOpen,
        // Exposed for the DEV validation harness, which drives the REAL
        // lifecycle against a deliberately unreachable target so a physical
        // device can prove the not-installed branch without uninstalling the
        // app. Page code should use `smartOpen(...).arm(anchor)` instead.
        arm: arm,
    };

    // Browser: a global, loaded as a classic script before the page's logic.
    // Node: a CommonJS export so `scripts/__tests__` exercises the exact file
    // the site serves — the same dual shape `app-return.js` uses.
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.__ORB_APP_LINKS__ = api;
})(typeof window !== 'undefined' ? window : null);
