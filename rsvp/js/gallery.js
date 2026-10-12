/* THE EVENT'S PHOTOS ON THE WEB — read-only, by invitation only.
 *
 * `guest_resolve_invitation` returns `event.photos` for the ONE event the code
 * resolves to (migration 20261012180000): storage paths the public bucket
 * serves by path. Nothing on this page can upload, comment, react, delete or
 * edit — those stay Orbiventt app capabilities — and nothing here asks the
 * server for anything: the list arrives with the invitation, and the viewer
 * only draws it.
 *
 * TWO NODES, ONE LOOK. `galleryNode()` is the compact grid under the event
 * details; `viewerNode()` is the fullscreen viewer a tile opens. The viewer is
 * the mobile app's `PhotoViewer` translated to the web: black fullscreen,
 * the photo centred and never cropped (`object-fit: contain`), a round
 * close control top-left, "n / N" centred in the header, swipe to move
 * between photos (native horizontal scroll-snap, so it is the platform's own
 * gesture), small dots, and a bottom gradient bar. Arrow controls exist for
 * keyboards and pointers; Escape closes.
 *
 * PURE. Both builders take the document as a seam and return nodes; the viewer
 * returns a tiny controller so `main.js` can position it once it is in the
 * DOM. No innerHTML, no inline style: every image attribute is a URL the
 * resolver already vetted, every other value is a class or a number.
 */
import { el, svgEl, setText } from './dom.js?v=20261012c';

/** Tiles shown in the grid; the rest live behind the last tile's "+N". */
export var GRID_MAX = 6;
/** Dots stop being useful past this many photos; the counter carries on. */
export var DOTS_MAX = 12;
/** The payload itself is capped server-side at 60; the page never exceeds it. */
export var PHOTOS_MAX = 60;

var LOCALE = 'es-MX';
var TIME_ZONE = 'America/Mexico_City';

export var GALLERY_COPY = {
    heading: 'Galería',
    one: '1 foto',
    many: function (n) { return String(n) + ' fotos'; },
    open: 'Ver foto',
    close: 'Cerrar',
    prev: 'Foto anterior',
    next: 'Foto siguiente',
    failed: 'No pudimos cargar esta foto.',
    dialog: 'Fotos del evento',
};

/**
 * The photos this page may show, in the server's order, as `{url, at}`.
 * Falls back to the legacy `gallery_paths` strip when a payload predates
 * `event.photos`, so an older server and a newer page still agree.
 */
export function photoList(payload, resolve) {
    var r = typeof resolve === 'function' ? resolve : function () { return null; };
    var event = (payload && payload.event) || {};
    var rows = Array.isArray(event.photos) ? event.photos : null;
    var out = [];
    var seen = Object.create(null);
    if (rows) {
        for (var i = 0; i < rows.length && out.length < PHOTOS_MAX; i += 1) {
            var row = rows[i];
            if (!row || typeof row !== 'object') continue;
            var url = r('event-photos', row.path);
            if (!url || seen[url]) continue;
            seen[url] = true;
            var at = Date.parse(row.created_at || '');
            out.push({ url: url, at: Number.isFinite(at) ? at : null });
        }
        return out;
    }
    var paths = Array.isArray(event.gallery_paths) ? event.gallery_paths : [];
    for (var j = 0; j < paths.length && out.length < PHOTOS_MAX; j += 1) {
        var legacy = r('event-photos', paths[j]);
        if (!legacy || seen[legacy]) continue;
        seen[legacy] = true;
        out.push({ url: legacy, at: null });
    }
    return out;
}

/** "Galería · 7 fotos" */
export function galleryTitle(count) {
    return GALLERY_COPY.heading + ' · ' + (count === 1 ? GALLERY_COPY.one : GALLERY_COPY.many(count));
}

function fmtDate(ms) {
    try {
        return new Intl.DateTimeFormat(LOCALE, {
            timeZone: TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(ms));
    } catch (_) {
        return '';
    }
}

/* ── icons (constants only; see dom.js ALLOWED_SVG_ATTRS) ─────────────────── */

export function lineIcon(path, d, className) {
    return svgEl('svg', {
        class: className || 'rsvp-icon',
        attrs: { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
        children: [svgEl('path', { attrs: { d: path }, document: d })],
        document: d,
    });
}
var ICON_CLOSE = 'M6 6l12 12M18 6L6 18';
var ICON_PREV = 'M15 5l-7 7 7 7';
var ICON_NEXT = 'M9 5l7 7-7 7';
var ICON_PHOTOS = 'M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';

/* ── the grid ─────────────────────────────────────────────────────────────── */

/**
 * The compact gallery section: a title row and up to six square tiles; the
 * last tile says "+N" when more photos exist. Tapping a tile calls
 * `handlers.onPhoto(index)` with the index into `photos`. Null when empty.
 *
 * @param {Array<{url: string}>} photos   from `photoList()`
 * @param {object} handlers               {onPhoto}
 * @param {object} o                      {document, skipUrl?: the hero image, not repeated}
 */
export function galleryNode(photos, handlers, o) {
    var d = o.document;
    var list = Array.isArray(photos) ? photos : [];
    if (!list.length) return null;
    // The hero image (the event cover, when it is the page's first image) is
    // not repeated in the grid; the viewer still counts it, so tiles carry
    // their index into the FULL list.
    var visible = [];
    for (var v = 0; v < list.length; v += 1) {
        if (o.skipUrl && list[v].url === o.skipUrl) continue;
        visible.push({ photo: list[v], index: v });
    }
    if (!visible.length) return null;
    var tiles = [];
    var shown = Math.min(visible.length, GRID_MAX);
    for (var i = 0; i < shown; i += 1) {
        var more = i === shown - 1 && visible.length > shown ? visible.length - shown : 0;
        var tile = el('button', {
            class: 'rsvp-gallery__tile' + (more ? ' rsvp-gallery__tile--more' : ''),
            attrs: { type: 'button', 'aria-label': GALLERY_COPY.open + ' ' + (visible[i].index + 1) + ' de ' + list.length, 'data-index': String(visible[i].index) },
            children: [
                el('img', { attrs: { src: visible[i].photo.url, alt: '', loading: 'lazy', decoding: 'async' }, document: d }),
                more ? el('span', { class: 'rsvp-gallery__more', attrs: { 'aria-hidden': 'true' }, text: '+' + more, document: d }) : null,
            ],
            document: d,
        });
        if (typeof tile.addEventListener === 'function') {
            tile.addEventListener('click', (function (index) {
                return function () { if (handlers && typeof handlers.onPhoto === 'function') handlers.onPhoto(index); };
            }(visible[i].index)));
        }
        tiles.push(tile);
    }
    return el('section', {
        class: 'rsvp-gallery',
        attrs: { 'aria-label': GALLERY_COPY.dialog },
        children: [
            el('p', {
                class: 'rsvp-gallery__title',
                children: [lineIcon(ICON_PHOTOS, d, 'rsvp-icon rsvp-gallery__icon'), el('span', { text: galleryTitle(list.length), document: d })],
                document: d,
            }),
            el('div', { class: 'rsvp-gallery__grid', children: tiles, document: d }),
        ],
        document: d,
    });
}

/* ── the viewer ───────────────────────────────────────────────────────────── */

function clampIndex(i, n) {
    if (!Number.isInteger(i)) return 0;
    return Math.max(0, Math.min(i, n - 1));
}

function slideNode(photo, index, total, d) {
    var img = el('img', {
        class: 'rsvp-viewer__img',
        attrs: { src: photo.url, alt: 'Foto ' + (index + 1) + ' de ' + total, decoding: 'async', loading: index < 2 ? null : 'lazy' },
        document: d,
    });
    var failed = el('p', { class: 'rsvp-viewer__failed', attrs: { hidden: true }, text: GALLERY_COPY.failed, document: d });
    var slide = el('figure', {
        class: 'rsvp-viewer__slide',
        attrs: { 'data-index': String(index) },
        children: [img, failed],
        document: d,
    });
    if (typeof img.addEventListener === 'function') {
        img.addEventListener('error', function () {
            slide.classList.add('rsvp-viewer__slide--failed');
            img.setAttribute('hidden', '');
            failed.removeAttribute('hidden');
        });
    }
    return slide;
}

/**
 * Build the fullscreen viewer for `photos`, starting at `index`.
 *
 * @returns {?{node: Element, setIndex: function(number, boolean=): void, getIndex: function(): number, focus: function(): void}}
 *   `setIndex(i, instant)` moves the strip and updates the chrome;
 *   `main.js` calls it once right after mounting (the strip needs a layout
 *   to know its width) and the strip's own scroll events call it after a
 *   swipe. Null when there is nothing to show.
 */
export function viewerNode(photos, index, onClose, o) {
    var d = o.document;
    var list = Array.isArray(photos) ? photos : [];
    var n = list.length;
    if (!n) return null;
    var current = clampIndex(index, n);

    var counter = el('p', { class: 'rsvp-viewer__counter', attrs: { 'aria-live': 'polite' }, document: d });
    var closeBtn = el('button', {
        class: 'rsvp-viewer__close',
        attrs: { type: 'button', 'aria-label': GALLERY_COPY.close },
        children: [lineIcon(ICON_CLOSE, d)],
        document: d,
    });
    var prevBtn = el('button', {
        class: 'rsvp-viewer__nav rsvp-viewer__nav--prev',
        attrs: { type: 'button', 'aria-label': GALLERY_COPY.prev },
        children: [lineIcon(ICON_PREV, d)],
        document: d,
    });
    var nextBtn = el('button', {
        class: 'rsvp-viewer__nav rsvp-viewer__nav--next',
        attrs: { type: 'button', 'aria-label': GALLERY_COPY.next },
        children: [lineIcon(ICON_NEXT, d)],
        document: d,
    });

    var slides = [];
    for (var i = 0; i < n; i += 1) slides.push(slideNode(list[i], i, n, d));
    var track = el('div', { class: 'rsvp-viewer__track', children: slides, document: d });

    var dots = [];
    if (n > 1 && n <= DOTS_MAX) {
        for (var k = 0; k < n; k += 1) dots.push(el('span', { class: 'rsvp-viewer__dot', document: d }));
    }
    var dotsRow = dots.length ? el('div', { class: 'rsvp-viewer__dots', attrs: { 'aria-hidden': 'true' }, children: dots, document: d }) : null;
    var caption = el('p', { class: 'rsvp-viewer__caption', document: d });

    var node = el('div', {
        class: 'rsvp-viewer',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': GALLERY_COPY.dialog, tabindex: '-1', 'data-index': String(current) },
        children: [
            el('div', { class: 'rsvp-viewer__header', children: [closeBtn, counter, el('span', { class: 'rsvp-viewer__spacer', attrs: { 'aria-hidden': 'true' }, document: d })], document: d }),
            track,
            n > 1 ? prevBtn : null,
            n > 1 ? nextBtn : null,
            el('div', { class: 'rsvp-viewer__bar', children: [dotsRow, caption], document: d }),
        ],
        document: d,
    });

    var settling = false;

    function paint() {
        node.setAttribute('data-index', String(current));
        setText(counter, (current + 1) + ' / ' + n);
        var at = list[current].at;
        setText(caption, at ? 'Publicada el ' + fmtDate(at) : '');
        for (var j = 0; j < dots.length; j += 1) {
            dots[j].setAttribute('class', 'rsvp-viewer__dot' + (j === current ? ' rsvp-viewer__dot--active' : ''));
        }
        prevBtn.disabled = current <= 0;
        nextBtn.disabled = current >= n - 1;
    }

    function scrollTrack(instant) {
        var width = track.clientWidth || 0;
        if (!width) return;
        settling = true;
        var left = current * width;
        if (typeof track.scrollTo === 'function') {
            try {
                track.scrollTo({ left: left, behavior: instant ? 'auto' : 'smooth' });
            } catch (_) {
                track.scrollLeft = left;
            }
        } else {
            track.scrollLeft = left;
        }
        // The strip reports its own scroll events while it travels; ignore
        // them until it lands, so the counter never flickers mid-way.
        if (typeof setTimeout === 'function') setTimeout(function () { settling = false; }, instant ? 0 : 400);
        else settling = false;
    }

    function setIndex(i, instant) {
        var next = clampIndex(i, n);
        var moved = next !== current;
        current = next;
        paint();
        if (moved || instant) scrollTrack(instant === true);
    }

    function getIndex() { return current; }

    function onScroll() {
        if (settling) return;
        var width = track.clientWidth || 0;
        if (!width) return;
        var i = clampIndex(Math.round((track.scrollLeft || 0) / width), n);
        if (i !== current) { current = i; paint(); }
    }

    function close() { if (typeof onClose === 'function') onClose(); }

    if (typeof node.addEventListener === 'function') {
        closeBtn.addEventListener('click', close);
        prevBtn.addEventListener('click', function () { setIndex(current - 1); });
        nextBtn.addEventListener('click', function () { setIndex(current + 1); });
        track.addEventListener('scroll', onScroll);
        node.addEventListener('keydown', function (event) {
            var key = event && event.key;
            if (key === 'Escape') { if (typeof event.preventDefault === 'function') event.preventDefault(); close(); }
            else if (key === 'ArrowLeft') setIndex(current - 1);
            else if (key === 'ArrowRight') setIndex(current + 1);
        });
    }

    paint();

    return {
        node: node,
        setIndex: setIndex,
        getIndex: getIndex,
        focus: function () { if (typeof closeBtn.focus === 'function') closeBtn.focus(); },
    };
}
