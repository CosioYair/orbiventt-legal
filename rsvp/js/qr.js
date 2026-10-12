/* THE PASS QR — the server's payload, drawn as geometry.
 *
 * `guest_get_passes` hands this page the EXACT string a door scanner expects
 * (`OVP1:<16>:<16>`, signed on read, never stored). This module turns that
 * string into an SVG and nothing else: it never assembles, alters, logs or
 * persists a payload, and it draws with the SAME parameters the mobile app
 * uses (`apps/mobile/src/lib/qr/encode.ts` + `QRCodeView.tsx`) so one pass is
 * one symbol regardless of which surface showed it:
 *
 *   · `qrcode-generator` 2.0.4, type 0 (smallest symbol that fits), ECC M
 *   · ALPHANUMERIC mode — the payload alphabet (0-9 A-Z ':') is inside it by
 *     construction, which is what keeps a 38-character payload at 25×25
 *   · a 4-module quiet zone on every side, pure black on pure white, no
 *     branding inside the symbol
 *
 * The encoder arrives as a parameter (`window.qrcode`, the vendored classic
 * script) so this module stays pure and testable. The SVG is built through
 * the allowlisted `svgEl()` builder: a white background rect and ONE path
 * whose `d` is composed of integers and the letters M h v z — no string from
 * anyone ever reaches an attribute. There is no innerHTML here and no
 * `createSvgTag`.
 */
import { svgEl } from './dom.js?v=20261012c';

/** Quiet zone required by the QR spec. Cropping it breaks decoders. */
export var QUIET_ZONE_MODULES = 4;

var ECC = 'M';

/** The QR alphanumeric charset: 0-9 A-Z space $ % * + - . / : */
var ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

/** The exact shape the scanner accepts — anything else is not a pass. */
export var PAYLOAD_SHAPE = /^OVP1:[0-9A-HJKMNP-TV-Z]{16}:[0-9A-HJKMNP-TV-Z]{16}$/;

export function isAlphanumeric(payload) {
    return typeof payload === 'string' && ALPHANUMERIC.test(payload);
}

/**
 * Encode a payload into a boolean module matrix.
 *
 * @param {string} payload   the server-issued pass payload
 * @param {function} factory the vendored `qrcode(typeNumber, ecc)` factory
 * @returns {?{size: number, modules: boolean[][]}} null when the payload
 *   cannot be a pass or the encoder is unavailable — callers render NOTHING
 *   rather than a symbol a scanner would misread.
 */
export function encodeQr(payload, factory) {
    if (typeof factory !== 'function') return null;
    if (typeof payload !== 'string' || !PAYLOAD_SHAPE.test(payload)) return null;
    try {
        var qr = factory(0, ECC);
        qr.addData(payload, isAlphanumeric(payload) ? 'Alphanumeric' : 'Byte');
        qr.make();
        var size = qr.getModuleCount();
        if (!Number.isInteger(size) || size < 21) return null;
        var modules = [];
        for (var row = 0; row < size; row += 1) {
            var line = [];
            for (var col = 0; col < size; col += 1) line.push(qr.isDark(row, col) === true);
            modules.push(line);
        }
        return { size: size, modules: modules };
    } catch (_) {
        return null;
    }
}

/**
 * The dark modules of a matrix as ONE path, run-length per row, offset by the
 * quiet zone. Integers and the letters M h v z only.
 */
export function matrixPath(matrix, offset) {
    var parts = [];
    for (var r = 0; r < matrix.size; r += 1) {
        var row = matrix.modules[r];
        var start = -1;
        for (var c = 0; c <= matrix.size; c += 1) {
            var dark = c < matrix.size && row[c] === true;
            if (dark && start === -1) start = c;
            if (!dark && start !== -1) {
                var len = c - start;
                parts.push('M' + (start + offset) + ' ' + (r + offset) + 'h' + len + 'v1h-' + len + 'z');
                start = -1;
            }
        }
    }
    return parts.join('');
}

/**
 * Draw a pass payload as an SVG node, or null when there is nothing safe to
 * draw. The viewBox is in module units (symbol + quiet zone), so the
 * stylesheet decides the on-screen size and the browser scales crisply.
 */
export function qrNode(payload, factory, d) {
    var matrix = encodeQr(payload, factory);
    if (!matrix) return null;
    var total = matrix.size + QUIET_ZONE_MODULES * 2;
    return svgEl('svg', {
        class: 'rsvp-qr',
        attrs: {
            viewBox: '0 0 ' + total + ' ' + total,
            role: 'img',
            'aria-label': 'Código QR de tu pase',
            'shape-rendering': 'crispEdges',
        },
        children: [
            svgEl('rect', { attrs: { x: 0, y: 0, width: total, height: total, fill: '#FFFFFF' }, document: d }),
            svgEl('path', { attrs: { d: matrixPath(matrix, QUIET_ZONE_MODULES), fill: '#000000' }, document: d }),
        ],
        document: d,
    });
}
