/* QR DECODING — two paths, and iOS is not the fallback case.
 *
 * `BarcodeDetector` is a fast native decoder on Chrome for Android. It is
 * absent from the ENTIRE iOS platform: Safari and Chrome on iOS are both
 * WebKit, and WebKit does not implement it. Since a door operator is as likely
 * to be holding an iPhone as anything else, the jsQR path is a first-class
 * route, not a degraded one — which is why it is vendored rather than left to
 * a CDN this page's CSP would block anyway.
 *
 * Both paths return the SAME thing: the raw decoded string, or null. Nothing
 * here interprets a pass. The browser cannot tell a real code from a forged
 * one and never tries; it hands the string to the server and renders the
 * answer.
 */

/** Only the shapes this door cares about. Keeps a random QR out of the RPC. */
var PASS_SHAPE = /^OVP1:[0-9A-HJKMNP-TV-Z]{16}:[0-9A-HJKMNP-TV-Z]{16}$/;

export function isPassShape(value) {
    return typeof value === 'string' && PASS_SHAPE.test(value);
}

/**
 * Build the decoder this browser can actually use.
 *
 * @param {object} env  injectable globals, so the choice is testable without a
 *                      browser: `{ BarcodeDetector, jsQR, createCanvas }`.
 * @returns {Promise<{kind: string, decode: (video, w, h) => Promise<?string>}>}
 */
export async function createDecoder(env) {
    var e = env || {};
    var Detector = e.BarcodeDetector ||
        (typeof window !== 'undefined' ? window.BarcodeDetector : undefined);

    if (typeof Detector === 'function') {
        try {
            // Feature-DETECT rather than feature-assume: some builds expose the
            // constructor but support no formats, and a detector that can never
            // match would silently make the scanner useless.
            if (typeof Detector.getSupportedFormats === 'function') {
                var formats = await Detector.getSupportedFormats();
                if (!formats || formats.indexOf('qr_code') === -1) throw new Error('no qr_code');
            }
            var detector = new Detector({ formats: ['qr_code'] });
            return {
                kind: 'barcode-detector',
                decode: async function (video) {
                    try {
                        var found = await detector.detect(video);
                        if (found && found.length && found[0] && found[0].rawValue) {
                            return String(found[0].rawValue);
                        }
                    } catch (_) {
                        /* transient frame failure — the loop simply tries again */
                    }
                    return null;
                },
            };
        } catch (_) {
            /* fall through to jsQR */
        }
    }

    var jsQR = e.jsQR || (typeof window !== 'undefined' ? window.jsQR : undefined);
    if (typeof jsQR !== 'function') {
        return { kind: 'none', decode: async function () { return null; } };
    }

    var makeCanvas = e.createCanvas || function () {
        return document.createElement('canvas');
    };
    var canvas = makeCanvas();
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    return {
        kind: 'jsqr',
        decode: async function (video, width, height) {
            if (!ctx || !width || !height) return null;
            try {
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(video, 0, 0, width, height);
                var image = ctx.getImageData(0, 0, width, height);
                // `attemptBoth` handles codes shown on a screen, which may be
                // inverted relative to print.
                var result = jsQR(image.data, image.width, image.height, {
                    inversionAttempts: 'attemptBoth',
                });
                return result && result.data ? String(result.data) : null;
            } catch (_) {
                return null;
            }
        },
    };
}

/**
 * Same-payload cooldown + single-flight gate.
 *
 * PURELY UX AND BATTERY. A QR sitting in the camera frame decodes many times a
 * second; without this the page would fire dozens of identical requests for one
 * physical scan. It is NOT the one-time guarantee — that is
 * `event_pass_checkins_one_active`, a unique index in Postgres. If every guard
 * in this file failed simultaneously, the database would still admit exactly
 * one.
 */
export function createScanGate(cooldownMs) {
    var cooldown = typeof cooldownMs === 'number' ? cooldownMs : 3000;
    var lastPayload = null;
    var lastAt = 0;
    var inFlight = false;

    return {
        /** May this payload be sent right now? */
        accept: function (payload, now) {
            var t = typeof now === 'number' ? now : Date.now();
            if (inFlight) return false;
            if (payload === lastPayload && t - lastAt < cooldown) return false;
            lastPayload = payload;
            lastAt = t;
            return true;
        },
        begin: function () { inFlight = true; },
        end: function () { inFlight = false; },
        isBusy: function () { return inFlight; },
        /** After an operator dismisses a result, the same code may be re-tried. */
        reset: function () { lastPayload = null; lastAt = 0; inFlight = false; },
    };
}
