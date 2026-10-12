/* WHAT THE GUEST SEES — every node this page draws, built from a plain model.
 *
 * PRODUCT INVARIANT (locked). This page answers an EXISTING Smart Invitation
 * ("Enlace de invitación") by its existing code. Nothing here creates, names
 * or implies a second kind of invitation: the copy says "tu invitación" and
 * "Confirmar asistencia", the seat numbers are the invitation's own pool, the
 * passes are the invitation's own passes, and the organizer sees the answer
 * in the same place as an app claim.
 *
 * PURE. `renderApp(model, handlers, opts)` takes the document as a seam and
 * returns one subtree; it never reads `window`, never fetches, never persists.
 * Every string a guest or another guest typed (party names, companions, a
 * decline note, the organizer's greeting) reaches the page as a TEXT NODE
 * through `dom.js` — there is no innerHTML anywhere in this tree, and the test
 * suite's DOM stub throws if one ever appears.
 *
 * TWO REAL PATHS, THEN ONE PRIMARY CONTROL PER SCREEN. A link with no answer
 * yet shows the event, its photos, the link warning and ONE deliberate
 * choice: "Confirmar desde la web" / "Prefiero usar Orbiventt". The app path
 * is the app's own one-tap handoff — `vyvent://e/{id}?code=…` through the
 * shared smart-open plan, or the DEV Expo Go return address — so Orbiventt
 * opens with the invitation already in hand; the code is only the FALLBACK
 * behind it. A link that already holds an answer shows the answer, the same
 * two paths ("Cambiar mi respuesta" / "Prefiero usar Orbiventt") and, centred
 * right under them, "Administrar mis pases" (primary once the organizer has
 * turned QR access on) — available from the first paint, no re-confirmation.
 *
 * THE LINK IS THE KEY. Possession of the link is what lets a guest see and
 * manage the household's answer and passes, so a warning box that cannot be
 * collapsed says so from the first visit, on the confirmation screen, and on
 * every return.
 */
import { el, setText, clear, paragraphs } from './dom.js?v=20261012c';
import { displayCode } from './session.js?v=20261012c';
import { qrNode } from './qr.js?v=20261012c';
import { photoList, galleryNode, lineIcon } from './gallery.js?v=20261012c';
import { itineraryList, itineraryNode } from './itinerary.js?v=20261012c';

export var LIMITS = {
    NAME: 80,
    NOTE: 500,
    TITLE: 200,
    LABEL: 120,
    GREETING: 2000,
    DESCRIPTION: 4000,
    ADDRESS: 300,
    ITEM: 120,
};

var LOCALE = 'es-MX';
var TIME_ZONE = 'America/Mexico_City';

/** Relative-day phrasing reaches this many days ahead (after tomorrow). */
var RELATIVE_DAY_HORIZON = 6;

/** The real app capabilities the app-benefits block may list. Closed. */
export var APP_CAPABILITIES = [
    'Chat del evento',
    'Compartir fotos',
    'Comentarios y reacciones',
    'Notificaciones',
    'Itinerario',
];

export var COPY = {
    offline: 'No pudimos enviar tu respuesta. Revisa tu conexión e inténtalo de nuevo.',
    rateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    nameRequired: 'Escribe tu nombre.',
    nameTooLong: 'Tu nombre debe tener máximo ' + LIMITS.NAME + ' caracteres.',
    companionTooLong: 'Cada nombre debe tener máximo ' + LIMITS.NAME + ' caracteres.',
    noteTooLong: 'El mensaje debe tener máximo ' + LIMITS.NOTE + ' caracteres.',
    noSeats: 'Esta invitación ya no tiene pases disponibles.',
    codeShape: 'Revisa el código: debe tener 12 letras o números.',
    codeNotFound: 'No encontramos una invitación con ese código.',
    codeOffline: 'No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.',
    warningTitle: 'Este enlace es tu llave',
    warningText: 'Con este enlace puedes ver y administrar tu invitación y tus pases. No lo compartas con nadie fuera de tu grupo.',
    qrReady: 'Tus pases con código QR están listos',
    qrDisabled: 'QR desactivado por el organizador',
    qrDisabledNote: 'Si el organizador activa el acceso con código QR, tus pases podrán escanearse automáticamente. Vuelve a abrir este mismo enlace para verlos.',
    passesLoading: 'Cargando tus pases…',
    passesOffline: 'No pudimos cargar tus pases. Revisa tu conexión e inténtalo de nuevo.',
    passesGone: 'No encontramos tus pases. Vuelve a abrir tu enlace de invitación.',
    passUnavailable: 'Este pase no está disponible por ahora.',
    benefitsLead: 'Con Orbiventt también puedes:',
    manage: 'Administrar mis pases',
    webPath: 'Confirmar desde la web',
    webPathHint: 'Sin cuenta, en un minuto.',
    changePath: 'Cambiar mi respuesta',
    changePathHint: 'Pases, acompañantes o mensaje.',
    appPath: 'Prefiero usar Orbiventt',
    appPathHintOpen: 'Se abre con tu invitación lista. Chat, fotos y más.',
    appPathHintClosed: 'Chat, fotos, notificaciones y más.',
    appLeadOpen: 'Orbiventt se abre con tu invitación lista para reclamar y asignar tus pases.',
    appLeadStore: 'Instala Orbiventt y abre tu invitación desde la app para reclamar tus pases.',
    appFallback: '¿No se abre? Ingresa este código en Orbiventt:',
    appOpen: 'Abrir Orbiventt',
    appStore: 'Descargar Orbiventt',
    bringTitle: 'Lo que te toca llevar',
    bringHint: 'Te lo asignó el organizador.',
};

/* ── pure helpers ─────────────────────────────────────────────────────────── */

/** Trim, strip control characters (keep newlines), clamp. '' when unusable. */
export function text(value, max) {
    if (typeof value !== 'string') return '';
    var cleaned = value
        .replace(/\r\n?/g, '\n')
        .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, '')
        .trim();
    return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

export function passesLabel(n) {
    return n === 1 ? '1 pase' : String(n) + ' pases';
}

/**
 * The most seats a party may confirm: what the invitation still has, plus
 * what this party already holds (changing an answer re-takes its own seats).
 */
export function maxSeatsFor(invitation, party) {
    var remaining = invitation && Number.isInteger(invitation.seats_remaining)
        ? Math.max(invitation.seats_remaining, 0)
        : 0;
    var own = party && party.rsvp_status === 'attending' && Number.isInteger(party.seats)
        ? Math.max(party.seats, 0)
        : 0;
    return remaining + own;
}

function fmt(ms, options) {
    try {
        var o = {};
        var keys = Object.keys(options);
        for (var i = 0; i < keys.length; i += 1) o[keys[i]] = options[keys[i]];
        o.timeZone = TIME_ZONE;
        return new Intl.DateTimeFormat(LOCALE, o).format(new Date(ms));
    } catch (_) {
        return '';
    }
}

var DATE_FMT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
var TIME_FMT = { hour: '2-digit', minute: '2-digit', hour12: false };

/** "sábado, 17 de abril de 2027 · 17:00 h – 22:00 h", or '' when unusable. */
export function formatWhen(startsAt, endsAt) {
    var start = Date.parse(startsAt || '');
    if (!Number.isFinite(start)) return '';
    var out = fmt(start, DATE_FMT) + ' · ' + fmt(start, TIME_FMT) + ' h';
    var end = Date.parse(endsAt || '');
    if (Number.isFinite(end) && end > start) {
        out += fmt(end, DATE_FMT) === fmt(start, DATE_FMT)
            ? ' – ' + fmt(end, TIME_FMT) + ' h'
            : ' – ' + fmt(end, DATE_FMT) + ' · ' + fmt(end, TIME_FMT) + ' h';
    }
    return out;
}

/** The calendar day of an instant IN THE EVENT'S TIME ZONE, as a UTC-midnight ms. */
function calendarDay(ms) {
    try {
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
        }).formatToParts(new Date(ms));
        var o = {};
        for (var i = 0; i < parts.length; i += 1) {
            if (parts[i].type !== 'literal') o[parts[i].type] = Number(parts[i].value);
        }
        var day = Date.UTC(o.year, o.month - 1, o.day);
        return Number.isFinite(day) ? day : NaN;
    } catch (_) {
        return NaN;
    }
}

/**
 * "Hoy" / "Mañana" / "Este martes" when the event starts within the next six
 * days (counted in America/Mexico_City calendar days, so a year boundary or a
 * late-night start never shifts the answer); null for anything further out
 * or already begun on an earlier day — the full date carries those.
 */
export function relativeDay(startsAt, nowMs) {
    var start = Date.parse(startsAt || '');
    if (!Number.isFinite(start)) return null;
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var a = calendarDay(start);
    var b = calendarDay(now);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    var days = Math.round((a - b) / 86400000);
    if (days < 0 || days > RELATIVE_DAY_HORIZON) return null;
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    var weekday = fmt(start, { weekday: 'long' });
    return weekday ? 'Este ' + weekday : null;
}

/**
 * The two date lines: a relative lead ("Este martes · 18:00 h") when the
 * event is near and not over, and the full date always. `{lead, full}`.
 */
export function whenLines(event, nowMs) {
    var e = event || {};
    var full = formatWhen(e.starts_at, e.ends_at);
    if (!full) return { lead: null, full: '' };
    var day = e.is_finished === true ? null : relativeDay(e.starts_at, nowMs);
    var lead = day ? day + ' · ' + fmt(Date.parse(e.starts_at), TIME_FMT) + ' h' : null;
    return { lead: lead, full: full };
}

/** Always Google Maps, built from constants plus ONE encoded query. */
export function mapUrl(event) {
    if (!event) return null;
    var lat = Number(event.latitude);
    var lng = Number(event.longitude);
    var query;
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        query = lat.toFixed(6) + ',' + lng.toFixed(6);
    } else {
        query = text(event.address, LIMITS.ADDRESS);
    }
    if (!query) return null;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

/** The one status banner, by priority; null when the invitation is live. */
export function bannerFor(payload) {
    var event = (payload && payload.event) || {};
    var invitation = (payload && payload.invitation) || {};
    if (event.is_cancelled === true) return { kind: 'cancelled', text: 'Este evento fue cancelado.' };
    if (event.is_finished === true) return { kind: 'finished', text: 'Este evento ya terminó.' };
    if (invitation.is_expired === true) return { kind: 'expired', text: 'Esta invitación ya no está activa.' };
    return null;
}

export function acceptsResponses(payload) {
    return !!(payload && payload.invitation && payload.invitation.accepting_responses === true);
}

/**
 * Whether a party may manage its passes: it is attending and the event is
 * still ahead. An EXPIRED invitation keeps this — the link stops taking
 * answers, but the passes it already granted are still the way in at the
 * door. Cancelled or finished events have no door.
 */
export function passesAllowed(payload, party) {
    if (!party || party.rsvp_status !== 'attending') return false;
    var event = (payload && payload.event) || {};
    return event.is_cancelled !== true && event.is_finished !== true;
}

/**
 * The page's FIRST image: the published digital invitation's own thumbnail
 * when there is one, else the event cover, else nothing.
 * @returns {?{url: string, kind: 'invitation'|'cover'}}
 */
export function firstImage(payload, resolve) {
    var r = typeof resolve === 'function' ? resolve : function () { return null; };
    var image = payload && payload.invitation_image;
    if (image && typeof image === 'object') {
        var url = r(image.bucket, image.path);
        if (url) return { url: url, kind: 'invitation' };
    }
    var event = (payload && payload.event) || {};
    var cover = r('event-photos', event.cover_path);
    return cover ? { url: cover, kind: 'cover' } : null;
}

function findParty(parties, party) {
    if (!party) return null;
    for (var i = 0; i < parties.length; i += 1) {
        if (parties[i] && parties[i].id === party.id) return parties[i];
    }
    return null;
}

/**
 * The app handoff this page may offer: `{href, arm}` when the shared resolver
 * opened it (production `vyvent://…`, or the DEV Expo Go return address),
 * null when closed. The smart-open plan's href wins when there is one (the
 * Android intent URL, the iOS guarded scheme); its `arm` wires the fallback.
 */
export function appHandoff(o) {
    var handoff = o && o.handoff;
    if (!handoff || handoff.open !== true || !handoff.href) return null;
    var plan = o.smartOpen;
    var href = plan && typeof plan.href === 'string' && plan.href ? plan.href : handoff.href;
    return { href: href, arm: plan && typeof plan.arm === 'function' ? plan.arm : null };
}

/* ── small builders ───────────────────────────────────────────────────────── */

function button(label, variant, onClick, d, attrs) {
    var a = attrs || {};
    a.type = 'button';
    var node = el('button', {
        class: 'rsvp-btn rsvp-btn--' + variant,
        attrs: a,
        text: label,
        document: d,
    });
    if (typeof onClick === 'function' && typeof node.addEventListener === 'function') {
        node.addEventListener('click', onClick);
    }
    return node;
}

function pathText(title, hint, d) {
    return el('span', {
        class: 'rsvp-path__text',
        children: [el('strong', { text: title, document: d }), el('span', { text: hint, document: d })],
        document: d,
    });
}

/** A tall two-line choice button: title + one-line hint. Never primary. */
function pathButton(title, hint, onClick, d) {
    var node = el('button', {
        class: 'rsvp-btn rsvp-btn--path',
        attrs: { type: 'button' },
        children: [pathText(title, hint, d)],
        document: d,
    });
    if (typeof node.addEventListener === 'function') node.addEventListener('click', onClick);
    return node;
}

function externalLink(href, label, d, className) {
    return el('a', {
        class: className || null,
        attrs: { href: href, target: '_blank', rel: 'noopener noreferrer' },
        text: label,
        document: d,
    });
}

function brand(d) {
    return el('p', { class: 'rsvp-brand', text: 'Orbiventt', document: d });
}

function errorLine(d) {
    return el('p', { class: 'rsvp-error', attrs: { role: 'alert' }, document: d });
}

function valueOf(input) {
    return input && typeof input.value === 'string' ? input.value : '';
}

var ICON_BASKET = 'M3 10h18M5 10l1.5 9h11L19 10M9 10l3-6 3 6';
var ICON_CHECK = 'M5 12l4 4L19 6';

/* ── controlled states ────────────────────────────────────────────────────── */

function loadingNode(d) {
    return el('div', {
        class: 'rsvp-loading',
        attrs: { role: 'status' },
        children: [
            el('span', { class: 'rsvp-loading__mark', attrs: { 'aria-hidden': 'true' }, document: d }),
            el('p', { class: 'rsvp-loading__text', text: 'Buscando tu invitación…', document: d }),
        ],
        document: d,
    });
}

/** THE ONE ANSWER for not_found, rate_limited and every transport failure. */
function unavailableNode(model, handlers, o) {
    var d = o.document;
    return el('section', {
        class: 'rsvp-state',
        attrs: { role: 'status' },
        children: [
            brand(d),
            el('h1', { text: 'Esta invitación no está disponible.', document: d }),
            el('p', {
                text: 'Revisa que el enlace esté completo o pídeselo de nuevo a quien te invitó.',
                document: d,
            }),
            model.retryable && handlers && handlers.onRetry
                ? button('Reintentar', 'ghost', handlers.onRetry, d)
                : null,
            o.storeUrl
                ? el('p', { class: 'rsvp-muted', children: [externalLink(o.storeUrl, 'Conoce Orbiventt', d)], document: d })
                : null,
        ],
        document: d,
    });
}

/** Manual entry, for a visit that carried no code. */
function codeEntryNode(model, handlers, o) {
    var d = o.document;
    var input = el('input', {
        attrs: {
            id: 'rsvp-code', type: 'text', inputmode: 'text', autocomplete: 'off',
            autocapitalize: 'characters', placeholder: 'XXXX-XXXX-XXXX', maxlength: '20',
            enterkeyhint: 'go', 'aria-describedby': 'rsvp-code-hint',
        },
        document: d,
    });
    var error = errorLine(d);
    setText(error, model.entryError || '');
    var submit = function () { handlers.onCode(valueOf(input)); };
    if (typeof input.addEventListener === 'function') {
        input.addEventListener('keydown', function (event) {
            if (event && event.key === 'Enter') {
                if (typeof event.preventDefault === 'function') event.preventDefault();
                submit();
            }
        });
    }
    return el('section', {
        class: 'rsvp-card rsvp-entry',
        children: [
            brand(d),
            el('h1', { text: '¿Tienes un código de invitación?', document: d }),
            el('p', {
                class: 'rsvp-muted',
                text: 'Escríbelo tal como aparece en tu invitación para confirmar tu asistencia.',
                document: d,
            }),
            el('div', {
                class: 'rsvp-field rsvp-code-input',
                children: [
                    el('label', { attrs: { for: 'rsvp-code' }, text: 'Código de invitación', document: d }),
                    input,
                    el('p', {
                        class: 'rsvp-hint', attrs: { id: 'rsvp-code-hint' },
                        text: '12 letras o números, por ejemplo ABCD-EFGH-IJKL.', document: d,
                    }),
                ],
                document: d,
            }),
            error,
            button('Continuar', 'primary', submit, d),
        ],
        document: d,
    });
}

/* ── the event ────────────────────────────────────────────────────────────── */

function eventCard(payload, handlers, o) {
    var d = o.document;
    var event = payload.event || {};
    var invitation = payload.invitation || {};
    var organizer = event.organizer || {};
    var resolve = typeof o.storageUrl === 'function' ? o.storageUrl : function () { return null; };

    var first = firstImage(payload, resolve);
    var avatarUrl = resolve('avatars', organizer.avatar_path);
    var organizerName = text(organizer.display_name, LIMITS.NAME);
    var when = whenLines(event, o.now);
    var address = text(event.address, LIMITS.ADDRESS);
    var map = mapUrl(event);
    var title = text(event.title, LIMITS.TITLE) || 'Evento';
    var label = text(invitation.label, LIMITS.LABEL);
    var greeting = text(invitation.greeting, LIMITS.GREETING);
    var description = text(event.description, LIMITS.DESCRIPTION);

    // The gallery: every photo the invitation may show, as a compact grid
    // that opens the viewer. The hero cover is not repeated as a tile.
    var photos = photoList(payload, resolve);
    var gallery = galleryNode(photos, handlers, {
        document: d,
        skipUrl: first && first.kind === 'cover' ? first.url : null,
    });

    // The itinerary: the organizer's activities for THIS event, read-only, in
    // the app's timeline language. Absent when the event has none.
    var itinerary = itineraryNode(itineraryList(payload), {
        document: d,
        now: o.now,
        eventStartsAt: event.starts_at,
        eventAddress: address,
        eventMapUrl: map,
        mapUrl: mapUrl,
    });

    var links = [];
    if (map) links.push(externalLink(map, 'Cómo llegar', d, 'rsvp-btn rsvp-btn--ghost'));

    return el('article', {
        class: 'rsvp-card rsvp-event',
        children: [
            first
                ? el('img', {
                    class: 'rsvp-event__cover rsvp-event__cover--' + first.kind,
                    attrs: { src: first.url, alt: '', decoding: 'async' },
                    document: d,
                })
                : null,
            el('div', {
                class: 'rsvp-event__body',
                children: [
                    organizerName
                        ? el('p', {
                            class: 'rsvp-event__host',
                            children: [
                                avatarUrl
                                    ? el('img', { class: 'rsvp-event__avatar', attrs: { src: avatarUrl, alt: '' }, document: d })
                                    : null,
                                el('span', { text: 'Te invita ' + organizerName, document: d }),
                            ],
                            document: d,
                        })
                        : null,
                    el('h1', { class: 'rsvp-event__title', text: title, document: d }),
                    label ? el('p', { class: 'rsvp-event__label', text: label, document: d }) : null,
                    greeting ? el('p', { class: 'rsvp-event__greeting', text: greeting, document: d }) : null,
                    when.full
                        ? el('p', {
                            class: 'rsvp-event__when',
                            children: [
                                when.lead ? el('strong', { class: 'rsvp-event__when-lead', text: when.lead, document: d }) : null,
                                el('time', {
                                    class: when.lead ? 'rsvp-event__when-full' : null,
                                    attrs: { datetime: String(event.starts_at || '') },
                                    text: when.full,
                                    document: d,
                                }),
                            ],
                            document: d,
                        })
                        : null,
                    address ? el('p', { class: 'rsvp-event__address', text: address, document: d }) : null,
                    links.length ? el('div', { class: 'rsvp-event__links', children: links, document: d }) : null,
                ].concat(
                    paragraphs(description, 'rsvp-event__desc', d),
                    gallery ? [gallery] : [],
                    itinerary ? [itinerary] : [],
                ),
                document: d,
            }),
        ],
        document: d,
    });
}

function bannerNode(payload, d) {
    var banner = bannerFor(payload);
    if (!banner) return null;
    return el('p', {
        class: 'rsvp-banner rsvp-banner--' + banner.kind,
        attrs: { role: 'status' },
        text: banner.text,
        document: d,
    });
}

/* ── the link warning + the app benefits ──────────────────────────────────── */

/** "Este enlace es tu llave" — prominent, never collapsible, rendered ONCE. */
function warningNode(d) {
    return el('aside', {
        class: 'rsvp-warning',
        attrs: { role: 'note' },
        children: [
            el('span', { class: 'rsvp-warning__icon', attrs: { 'aria-hidden': 'true' }, text: '!', document: d }),
            el('div', {
                class: 'rsvp-warning__body',
                children: [
                    el('p', { class: 'rsvp-warning__title', children: [el('strong', { text: COPY.warningTitle, document: d })], document: d }),
                    el('p', { class: 'rsvp-warning__text', text: COPY.warningText, document: d }),
                ],
                document: d,
            }),
        ],
        document: d,
    });
}

function benefitsList(d) {
    var items = [];
    for (var i = 0; i < APP_CAPABILITIES.length; i += 1) items.push(el('li', { text: APP_CAPABILITIES[i], document: d }));
    return el('ul', { class: 'rsvp-benefits', children: items, document: d });
}

/** The quiet, link-styled way into the app screen (store / code fallback). */
function appPathLink(handlers, d, label) {
    return button(label || COPY.appPath, 'link', function () { handlers.onChoose('app', null); }, d);
}

/**
 * THE APP PATH as a choice: Orbiventt's own icon, "Prefiero usar Orbiventt"
 * and a hint. When the shared handoff is open this IS the one-tap handoff —
 * an anchor carrying `vyvent://e/{id}?code=…` (or the DEV Expo Go address),
 * armed with the smart-open fallback — so the app opens with the invitation
 * already in hand. When it is closed (desktop, no return address on the DEV
 * mirror) it leads to the app screen, where the store and the code wait.
 * Styled as a path, never as the page's primary.
 */
function appPathControl(handlers, o) {
    var d = o.document;
    var open = appHandoff(o);
    var children = [
        el('img', { class: 'rsvp-path__icon', attrs: { src: 'favicon-96x96.png', alt: '', decoding: 'async' }, document: d }),
        pathText(COPY.appPath, open ? COPY.appPathHintOpen : COPY.appPathHintClosed, d),
    ];
    if (open) {
        var anchor = el('a', {
            class: 'rsvp-btn rsvp-btn--path rsvp-btn--path-app',
            attrs: { href: open.href, 'data-state': 'open' },
            children: children,
            document: d,
        });
        if (open.arm) open.arm(anchor);
        return anchor;
    }
    var node = el('button', {
        class: 'rsvp-btn rsvp-btn--path rsvp-btn--path-app',
        attrs: { type: 'button', 'data-state': 'closed' },
        children: children,
        document: d,
    });
    if (typeof node.addEventListener === 'function') node.addEventListener('click', function () { handlers.onChoose('app', null); });
    return node;
}

/** Under an OPEN app path: the manual route stays reachable, quietly. */
function appFallbackLink(handlers, o) {
    if (!appHandoff(o)) return null;
    return el('p', { class: 'rsvp-app-link', children: [appPathLink(handlers, o.document, 'Abrir con el código manualmente')], document: o.document });
}

/* ── the answer ───────────────────────────────────────────────────────────── */

/** No answer yet: ONE deliberate choice between two real paths. No primary. */
function pathChoiceCard(handlers, o) {
    var d = o.document;
    return el('section', {
        class: 'rsvp-card rsvp-prompt',
        children: [
            el('h2', { text: 'Confirmar asistencia', document: d }),
            el('p', { class: 'rsvp-muted', text: 'Elige cómo quieres responder a tu invitación.', document: d }),
            el('div', {
                class: 'rsvp-paths',
                children: [
                    pathButton(COPY.webPath, COPY.webPathHint, function () { handlers.onChoose('choose', null); }, d),
                    appPathControl(handlers, o),
                ],
                document: d,
            }),
            appFallbackLink(handlers, o),
        ],
        document: d,
    });
}

/**
 * "Abrir Orbiventt" — the same two-module contract as the invitation's pass
 * card: the destination arrives PRE-RESOLVED (`app-return.js`), the device
 * plan alongside (`app-store-links.js`). Null when the handoff is closed.
 */
function openControl(o, variant) {
    var open = appHandoff(o);
    if (!open) return null;
    var anchor = el('a', { class: 'rsvp-btn rsvp-btn--' + (variant || 'primary'), attrs: { href: open.href }, text: COPY.appOpen, document: o.document });
    if (open.arm) open.arm(anchor);
    return anchor;
}

/** "Descargar Orbiventt" — the store for THIS device, when known. */
function storeControl(o, variant) {
    if (!o.storeUrl) return null;
    return externalLink(o.storeUrl, COPY.appStore, o.document, 'rsvp-btn rsvp-btn--' + (variant || 'ghost'));
}

function copyButton(code, o, status) {
    var d = o.document;
    return button('Copiar código', 'ghost', function () {
        var nav = o.navigator;
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            Promise.resolve()
                .then(function () { return nav.clipboard.writeText(displayCode(code)); })
                .then(function () { setText(status, 'Código copiado'); })
                .catch(function () { setText(status, 'Mantén presionado el código para copiarlo.'); });
            return;
        }
        setText(status, 'Mantén presionado el código para copiarlo.');
    }, d, { 'aria-label': 'Copiar código de invitación' });
}

/**
 * The APP screen: the one-tap "Abrir Orbiventt" (or the store when the app is
 * not here), what the app adds, and — behind it, as the FALLBACK only — the
 * invitation code with "Copiar código". The code is visible on purpose:
 * possession of the code is the invitation credential in the product model,
 * and a guest whose phone did not hand off still needs it. Never the
 * headline, never the first control.
 */
function appCard(model, handlers, o) {
    var d = o.document;
    var status = el('p', { class: 'rsvp-status', attrs: { role: 'status', 'aria-live': 'polite' }, document: d });
    var open = openControl(o, 'primary');
    var store = open ? null : storeControl(o, 'primary');
    return el('section', {
        class: 'rsvp-card rsvp-app-path',
        attrs: { 'data-view': 'app' },
        children: [
            el('h2', { text: COPY.appPath, document: d }),
            el('p', { class: 'rsvp-muted', text: open ? COPY.appLeadOpen : COPY.appLeadStore, document: d }),
            benefitsList(d),
            open || store ? el('div', { class: 'rsvp-actions', children: [open || store], document: d }) : null,
            el('div', {
                class: 'rsvp-fallback',
                children: [
                    el('p', { class: 'rsvp-muted rsvp-fallback__lead', text: COPY.appFallback, document: d }),
                    // Selectable as ONE run (`user-select: all`), so nothing but
                    // the code itself sits inside this block.
                    el('p', { class: 'rsvp-code', attrs: { 'aria-label': 'Código de invitación' }, text: displayCode(model.code), document: d }),
                    copyButton(model.code, o, status),
                    status,
                ],
                document: d,
            }),
            button('Volver', 'quiet', handlers.onCancel, d),
        ],
        document: d,
    });
}

/** The WEB path's first screen — Sí / No — with what the app adds, inside. */
function choiceCard(model, handlers, d) {
    var party = model.editing;
    var max = maxSeatsFor(model.payload.invitation, party);
    var canAttend = max >= 1;
    var attend = button('Sí, asistiré', 'primary', function () {
        if (canAttend) handlers.onChoose('attend', party);
    }, d);
    attend.disabled = !canAttend;
    return el('section', {
        class: 'rsvp-card rsvp-choice-card',
        children: [
            el('h2', { text: party ? COPY.changePath : '¿Nos acompañas?', document: d }),
            party ? null : el('p', { class: 'rsvp-muted', text: 'Responde en un minuto. No necesitas una cuenta.', document: d }),
            canAttend ? null : el('p', { class: 'rsvp-hint', text: COPY.noSeats, document: d }),
            el('div', {
                class: 'rsvp-choice',
                children: [
                    attend,
                    button('No podré asistir', 'ghost', function () { handlers.onChoose('decline', party); }, d),
                ],
                document: d,
            }),
            party
                ? null
                : el('div', {
                    class: 'rsvp-benefits-block',
                    children: [
                        el('p', { class: 'rsvp-benefits-block__lead', text: COPY.benefitsLead, document: d }),
                        benefitsList(d),
                        appPathLink(handlers, d),
                    ],
                    document: d,
                }),
            button('Cancelar', 'quiet', handlers.onCancel, d),
        ],
        document: d,
    });
}

function nameField(party, d) {
    var input = el('input', {
        attrs: {
            id: 'rsvp-name', type: 'text', maxlength: String(LIMITS.NAME),
            autocomplete: 'name', autocapitalize: 'words', placeholder: 'Nombre y apellido',
        },
        document: d,
    });
    input.value = party ? text(party.party_name, LIMITS.NAME) : '';
    return {
        input: input,
        node: el('div', {
            class: 'rsvp-field',
            children: [el('label', { attrs: { for: 'rsvp-name' }, text: 'Tu nombre', document: d }), input],
            document: d,
        }),
    };
}

function validName(raw) {
    var name = text(raw, LIMITS.NAME + 1).replace(/\s+/g, ' ');
    if (!name) return { error: COPY.nameRequired };
    if (name.length > LIMITS.NAME) return { error: COPY.nameTooLong };
    return { name: name };
}

/** Wire Confirm/Cancel: disable while pending, show a returned message. */
function wireSubmit(confirm, cancel, error, handlers, answer) {
    confirm.disabled = true;
    cancel.disabled = true;
    setText(error, '');
    var release = function (message) {
        confirm.disabled = false;
        cancel.disabled = false;
        setText(error, message);
    };
    Promise.resolve()
        .then(function () { return handlers.onSubmit(answer); })
        .then(function (r) { if (r && r.ok === false) release(r.message || COPY.offline); })
        .catch(function () { release(COPY.offline); });
}

function attendForm(model, handlers, d) {
    var party = model.editing;
    var max = maxSeatsFor(model.payload.invitation, party);
    var seats = party && party.rsvp_status === 'attending' && Number.isInteger(party.seats) ? party.seats : 1;
    seats = Math.max(1, Math.min(seats, Math.max(max, 1)));

    var names = [];
    var given = party && Array.isArray(party.companions) ? party.companions : [];
    for (var g = 0; g < given.length; g += 1) {
        var pos = given[g] && Number.isInteger(given[g].position) ? given[g].position : null;
        if (pos !== null && pos >= 2) names[pos - 2] = text(given[g].name, LIMITS.NAME);
    }

    var name = nameField(party, d);
    var count = el('output', { attrs: { id: 'rsvp-seats', 'aria-live': 'polite' }, text: String(seats), document: d });
    var minus = el('button', { attrs: { type: 'button', 'aria-label': 'Menos pases' }, text: '−', document: d });
    var plus = el('button', { attrs: { type: 'button', 'aria-label': 'Más pases' }, text: '+', document: d });
    var companions = el('div', { class: 'rsvp-companions', document: d });
    var error = errorLine(d);

    function readNames() {
        var inputs = companions.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i += 1) names[i] = valueOf(inputs[i]);
    }
    function drawCompanions() {
        clear(companions);
        for (var i = 2; i <= seats; i += 1) {
            var id = 'rsvp-companion-' + i;
            var input = el('input', {
                attrs: { id: id, type: 'text', maxlength: String(LIMITS.NAME), autocomplete: 'off', autocapitalize: 'words', placeholder: 'Nombre (opcional)' },
                document: d,
            });
            input.value = names[i - 2] || '';
            companions.appendChild(el('div', {
                class: 'rsvp-field',
                children: [el('label', { attrs: { for: id }, text: 'Acompañante ' + i, document: d }), input],
                document: d,
            }));
        }
    }
    function sync() {
        setText(count, String(seats));
        minus.disabled = seats <= 1;
        plus.disabled = seats >= max;
    }
    minus.addEventListener('click', function () { readNames(); if (seats > 1) seats -= 1; drawCompanions(); sync(); });
    plus.addEventListener('click', function () { readNames(); if (seats < max) seats += 1; drawCompanions(); sync(); });
    drawCompanions();
    sync();

    var confirm = button('Confirmar', 'primary', null, d);
    var cancel = button('Cancelar', 'quiet', handlers.onCancel, d);
    confirm.addEventListener('click', function () {
        readNames();
        var checked = validName(valueOf(name.input));
        if (checked.error) { setText(error, checked.error); return; }
        var list = [];
        for (var i = 0; i < seats - 1; i += 1) {
            var companion = text(names[i] || '', LIMITS.NAME + 1).replace(/\s+/g, ' ');
            if (companion.length > LIMITS.NAME) { setText(error, COPY.companionTooLong); return; }
            list.push(companion);
        }
        wireSubmit(confirm, cancel, error, handlers, {
            partyId: party ? party.id : null,
            name: checked.name,
            status: 'attending',
            seats: seats,
            companions: list,
            note: null,
        });
    });

    return el('section', {
        class: 'rsvp-card rsvp-form',
        attrs: { 'data-view': 'attend' },
        children: [
            el('h2', { text: 'Sí, asistiré', document: d }),
            name.node,
            el('div', {
                class: 'rsvp-field',
                children: [
                    el('label', { attrs: { for: 'rsvp-seats' }, text: '¿Cuántas personas asistirán?', document: d }),
                    el('div', { class: 'rsvp-stepper', children: [minus, count, plus], document: d }),
                    el('p', { class: 'rsvp-hint', text: 'Tienes hasta ' + passesLabel(max) + '. Cuenta contigo.', document: d }),
                ],
                document: d,
            }),
            companions,
            error,
            el('div', { class: 'rsvp-actions', children: [confirm, cancel], document: d }),
        ],
        document: d,
    });
}

function declineForm(model, handlers, d) {
    var party = model.editing;
    var name = nameField(party, d);
    var note = el('textarea', {
        attrs: { id: 'rsvp-note', maxlength: String(LIMITS.NOTE), rows: '4', placeholder: 'Opcional' },
        document: d,
    });
    note.value = party ? text(party.decline_note, LIMITS.NOTE) : '';
    var counter = el('p', { class: 'rsvp-hint rsvp-counter', attrs: { 'aria-live': 'polite' }, document: d });
    var error = errorLine(d);
    function syncCounter() {
        var current = valueOf(note);
        if (current.length > LIMITS.NOTE) { note.value = current.slice(0, LIMITS.NOTE); current = note.value; }
        setText(counter, current.length + '/' + LIMITS.NOTE);
    }
    note.addEventListener('input', syncCounter);
    syncCounter();

    var send = button('Enviar respuesta', 'primary', null, d);
    var cancel = button('Cancelar', 'quiet', handlers.onCancel, d);
    send.addEventListener('click', function () {
        var checked = validName(valueOf(name.input));
        if (checked.error) { setText(error, checked.error); return; }
        var message = text(valueOf(note), LIMITS.NOTE + 1);
        if (message.length > LIMITS.NOTE) { setText(error, COPY.noteTooLong); return; }
        wireSubmit(send, cancel, error, handlers, {
            partyId: party ? party.id : null,
            name: checked.name,
            status: 'declined',
            seats: 0,
            companions: [],
            note: message || null,
        });
    });

    return el('section', {
        class: 'rsvp-card rsvp-form',
        attrs: { 'data-view': 'decline' },
        children: [
            el('h2', { text: 'No podré asistir', document: d }),
            name.node,
            el('div', {
                class: 'rsvp-field',
                children: [
                    el('label', { attrs: { for: 'rsvp-note' }, text: '¿Quieres dejarle un mensaje al organizador?', document: d }),
                    note,
                    counter,
                ],
                document: d,
            }),
            error,
            el('div', { class: 'rsvp-actions', children: [send, cancel], document: d }),
        ],
        document: d,
    });
}

/* ── the current answer + passes ──────────────────────────────────────────── */

function companionItems(party, d) {
    var companions = Array.isArray(party.companions) ? party.companions : [];
    var items = [];
    for (var i = 0; i < companions.length; i += 1) {
        var companionName = text(companions[i] && companions[i].name, LIMITS.NAME);
        if (companionName) items.push(el('li', { text: companionName, document: d }));
    }
    return items;
}

/** The party's answer lines, shared by the card and the passes section. */
function answerLines(party, d) {
    var attending = party.rsvp_status === 'attending';
    var seats = Number.isInteger(party.seats) ? party.seats : 0;
    var items = companionItems(party, d);
    var note = text(party.decline_note, LIMITS.NOTE);
    return [
        el('p', { class: 'rsvp-muted', text: 'Tu respuesta actual', document: d }),
        el('p', { class: 'rsvp-party__name', text: text(party.party_name, LIMITS.NAME), document: d }),
        el('p', {
            class: 'rsvp-party__status',
            text: attending ? 'Asistirás con ' + passesLabel(seats) + '.' : 'Indicaste que no asistirás.',
            document: d,
        }),
        attending && items.length ? el('ul', { children: items, document: d }) : null,
        !attending && note ? el('p', { class: 'rsvp-party__note', text: '“' + note + '”', document: d }) : null,
    ];
}

/**
 * "Lo que te toca llevar" — what the organizer assigned this party on the
 * event's checklist, as its own card: an icon plate, the title, one row per
 * item. Read-only here (claiming and editing live in the app); hidden when
 * nothing is assigned. Semantics unchanged: the server lists the items.
 */
function bringCard(party, d) {
    var assigned = Array.isArray(party.assigned_items) ? party.assigned_items : [];
    var items = [];
    for (var i = 0; i < assigned.length; i += 1) {
        var label = text(assigned[i] && assigned[i].label, LIMITS.ITEM);
        if (!label) continue;
        items.push(el('li', {
            class: 'rsvp-bring__item',
            children: [
                lineIcon(ICON_CHECK, d, 'rsvp-icon rsvp-bring__check'),
                el('span', { text: label, document: d }),
            ],
            document: d,
        }));
    }
    if (!items.length) return null;
    return el('section', {
        class: 'rsvp-bring',
        attrs: { 'aria-label': COPY.bringTitle },
        children: [
            el('div', {
                class: 'rsvp-bring__head',
                children: [
                    el('span', { class: 'rsvp-bring__plate', attrs: { 'aria-hidden': 'true' }, children: [lineIcon(ICON_BASKET, d, 'rsvp-icon')], document: d }),
                    el('div', {
                        children: [
                            el('p', { class: 'rsvp-bring__title', text: COPY.bringTitle, document: d }),
                            el('p', { class: 'rsvp-bring__hint', text: COPY.bringHint, document: d }),
                        ],
                        document: d,
                    }),
                ],
                document: d,
            }),
            el('ul', { class: 'rsvp-bring__list', children: items, document: d }),
        ],
        document: d,
    });
}

/** The centred "Administrar mis pases" — primary once QR access is on. */
function manageControl(party, payload, handlers, d) {
    var qrOn = !!(payload.event && payload.event.qr_enabled === true);
    return el('div', {
        class: 'rsvp-manage',
        children: [
            qrOn ? el('p', { class: 'rsvp-ready', text: COPY.qrReady, document: d }) : null,
            button(COPY.manage, qrOn ? 'primary' : 'ghost', function () { handlers.onManage(party); }, d, { 'data-state': qrOn ? 'qr-on' : 'qr-off' }),
        ],
        document: d,
    });
}

/**
 * "Tu respuesta actual" — one card per party under this code: the answer,
 * what to bring, the two paths ("Cambiar mi respuesta" / "Prefiero usar
 * Orbiventt") and, centred right under them, "Administrar mis pases".
 */
function partyCard(party, payload, accepting, handlers, o) {
    var d = o.document;
    var attending = party.rsvp_status === 'attending';
    var manageable = passesAllowed(payload, party);
    return el('article', {
        class: 'rsvp-card rsvp-party' + (attending ? '' : ' rsvp-party--declined'),
        children: answerLines(party, d).concat([
            attending ? bringCard(party, d) : null,
            accepting
                ? el('div', {
                    class: 'rsvp-paths',
                    children: [
                        pathButton(COPY.changePath, COPY.changePathHint, function () { handlers.onChoose('choose', party); }, d),
                        appPathControl(handlers, o),
                    ],
                    document: d,
                })
                : null,
            manageable ? manageControl(party, payload, handlers, d) : null,
        ]),
        document: d,
    });
}

var STATE_LABEL = { active: 'Activo', qr_disabled: 'QR desactivado', suspended: 'No disponible' };

function passCard(pass, index, total, holder, o) {
    var d = o.document;
    var pos = Number.isInteger(pass.pos) && pass.pos >= 1 ? pass.pos : index + 1;
    var occupant = text(pass.occupant_label, LIMITS.NAME);
    var kind = pass.occupant_kind === 'holder' ? 'Titular' : 'Acompañante';
    var who = pass.occupant_kind === 'holder' ? (occupant || holder) : occupant;
    var state = typeof pass.state === 'string' ? pass.state : 'unavailable';
    var qr = state === 'active' && typeof pass.payload === 'string' ? qrNode(pass.payload, o.qrcode, d) : null;
    var checkedIn = Date.parse(pass.checked_in_at || '');
    var badge = Number.isFinite(checkedIn)
        ? 'Ingresó · ' + fmt(checkedIn, TIME_FMT) + ' h'
        : (STATE_LABEL[state] || 'No disponible');
    var badgeKind = Number.isFinite(checkedIn) ? 'checked' : (state === 'active' ? 'active' : 'off');

    return el('article', {
        class: 'rsvp-pass',
        attrs: { 'data-state': state },
        children: [
            el('div', {
                class: 'rsvp-pass__head',
                children: [
                    el('span', { class: 'rsvp-pass__num', text: 'Pase ' + pos + ' de ' + total, document: d }),
                    el('span', { class: 'rsvp-pass__badge rsvp-pass__badge--' + badgeKind, text: badge, document: d }),
                ],
                document: d,
            }),
            el('p', {
                class: 'rsvp-pass__title',
                children: [
                    el('span', { class: 'rsvp-pass__kind', text: kind, document: d }),
                    el('strong', { class: 'rsvp-pass__who', text: who || '', document: d }),
                ],
                document: d,
            }),
            qr ? el('div', { class: 'rsvp-pass__qr', children: [qr], document: d }) : null,
            state === 'qr_disabled'
                ? el('p', { class: 'rsvp-pass__state', text: COPY.qrDisabled, document: d })
                : null,
            state !== 'qr_disabled' && !qr
                ? el('p', { class: 'rsvp-pass__state', text: COPY.passUnavailable, document: d })
                : null,
            Number.isFinite(checkedIn)
                ? el('p', { class: 'rsvp-pass__checkin', text: 'Ingreso registrado · ' + fmt(checkedIn, TIME_FMT) + ' h', document: d })
                : null,
        ],
        document: d,
    });
}

/**
 * "Administrar mis pases" for ONE party: its answer, the way to change it, and
 * its passes exactly as `guest_get_passes` returned them a moment ago. The
 * list is fetched every time this section opens and never cached.
 */
function passesSection(model, party, handlers, o) {
    var d = o.document;
    var accepting = acceptsResponses(model.payload);
    var passes = model.passes || { status: 'loading' };
    var list = el('div', { class: 'rsvp-passes__list', attrs: { 'aria-live': 'polite' }, document: d });

    if (passes.status === 'ok' && passes.data) {
        var data = passes.data;
        var rows = Array.isArray(data.passes) ? data.passes.filter(function (p) { return p && typeof p === 'object'; }) : [];
        rows.sort(function (a, b) { return (Number(a.pos) || 0) - (Number(b.pos) || 0); });
        var total = rows.length || (Number.isInteger(data.seats) ? data.seats : 0);
        var holder = text(data.holder_label, LIMITS.NAME) || text(party.party_name, LIMITS.NAME);
        if (data.qr_enabled !== true) {
            list.appendChild(el('p', { class: 'rsvp-passes__notice', text: COPY.qrDisabledNote, document: d }));
        }
        for (var i = 0; i < rows.length; i += 1) list.appendChild(passCard(rows[i], i, total, holder, o));
        if (!rows.length) list.appendChild(el('p', { class: 'rsvp-muted', text: COPY.passesGone, document: d }));
    } else if (passes.status === 'error') {
        var error = errorLine(d);
        setText(error, passes.message || COPY.passesOffline);
        list.appendChild(error);
        if (passes.retryable !== false) list.appendChild(button('Reintentar', 'ghost', handlers.onPassesRetry, d));
    } else {
        list.appendChild(el('p', { class: 'rsvp-muted', attrs: { role: 'status' }, text: COPY.passesLoading, document: d }));
    }

    return el('section', {
        class: 'rsvp-card rsvp-passes',
        attrs: { 'data-view': 'passes' },
        children: [el('h2', { text: COPY.manage, document: d })].concat(
            answerLines(party, d),
            [
                bringCard(party, d),
                accepting
                    ? button(COPY.changePath, 'ghost', function () { handlers.onChoose('choose', party); }, d)
                    : null,
                el('h3', { class: 'rsvp-passes__heading', text: 'Tus pases', document: d }),
                list,
                button('Cerrar', 'quiet', handlers.onCancel, d),
            ],
        ),
        document: d,
    });
}

/* ── results ──────────────────────────────────────────────────────────────── */

/** After a web confirmation: what the app adds, with the app as a SECONDARY suggestion. */
function promoCard(handlers, o) {
    var d = o.document;
    var open = openControl(o, 'ghost');
    return el('section', {
        class: 'rsvp-card rsvp-promo',
        children: [
            el('h3', { text: 'Vive el evento completo en Orbiventt', document: d }),
            el('p', { class: 'rsvp-muted', text: COPY.benefitsLead, document: d }),
            benefitsList(d),
            open || appPathLink(handlers, d),
        ],
        document: d,
    });
}

/** The party a fresh result belongs to, as the CURRENT payload describes it. */
function resultParty(model, parties) {
    var r = model.result || {};
    if (r.partyId) {
        var byId = findParty(parties, { id: r.partyId });
        if (byId) return byId;
    }
    for (var i = 0; i < parties.length; i += 1) {
        if (parties[i].rsvp_status === r.status && text(parties[i].party_name, LIMITS.NAME) === r.name) return parties[i];
    }
    return null;
}

function resultNodes(model, handlers, o, parties) {
    var d = o.document;
    var r = model.result;
    var organizer = text(model.payload.event && model.payload.event.organizer && model.payload.event.organizer.display_name, LIMITS.NAME)
        || 'el organizador';
    if (r.status === 'attending') {
        var party = resultParty(model, parties);
        var manageable = party && passesAllowed(model.payload, party);
        return [
            el('section', {
                class: 'rsvp-card rsvp-result rsvp-result--ok',
                attrs: { role: 'status' },
                children: [
                    el('h2', { text: '¡Listo, ' + r.name + '!', document: d }),
                    el('p', { text: 'Confirmaste ' + passesLabel(r.seats) + '.', document: d }),
                    manageable ? manageControl(party, model.payload, handlers, d) : null,
                ],
                document: d,
            }),
            promoCard(handlers, o),
            warningNode(d),
        ];
    }
    return [
        el('section', {
            class: 'rsvp-card rsvp-result rsvp-result--declined',
            attrs: { role: 'status' },
            children: [
                el('h2', { text: 'Gracias por responder.', document: d }),
                el('p', { text: 'Tu respuesta fue enviada a ' + organizer + '.', document: d }),
                o.storeUrl
                    ? el('p', { class: 'rsvp-muted', children: [externalLink(o.storeUrl, 'Conoce Orbiventt', d)], document: d })
                    : null,
            ],
            document: d,
        }),
    ];
}

function answerSection(model, handlers, o) {
    var d = o.document;
    var payload = model.payload;
    var parties = Array.isArray(payload.parties) ? payload.parties.filter(function (p) { return p && typeof p === 'object'; }) : [];
    var accepting = acceptsResponses(payload);
    var managing = findParty(parties, model.managing);
    var attendingResult = !!(model.result && model.result.status === 'attending');

    var view = typeof model.view === 'string' ? model.view : 'idle';
    if (view === 'passes') {
        if (!managing || !passesAllowed(payload, managing)) view = 'idle';
    } else if (!accepting) {
        view = 'idle';
    }

    var children = model.result ? resultNodes(model, handlers, o, parties) : [];
    var inFlow = view === 'choose' || view === 'attend' || view === 'decline';
    // The warning is drawn exactly ONCE: the attending result already carries
    // it; otherwise it leads the first visit's choice, the web path's
    // screens and every return visit. A first visit's app screen has no
    // link to protect yet; a return visit's does.
    var firstChoice = view === 'idle' && parties.length === 0 && accepting;
    if (!attendingResult && (parties.length > 0 || inFlow || firstChoice)) children.push(warningNode(d));

    if (view === 'attend') {
        children.push(attendForm(model, handlers, d));
    } else if (view === 'decline') {
        children.push(declineForm(model, handlers, d));
    } else if (view === 'choose') {
        children.push(choiceCard(model, handlers, d));
    } else if (view === 'passes') {
        children.push(passesSection(model, managing, handlers, o));
    } else {
        // A fresh ATTENDING result already shows the answer and its manage
        // action; the party cards return on the next paint.
        if (!attendingResult) {
            for (var i = 0; i < parties.length; i += 1) children.push(partyCard(parties[i], payload, accepting, handlers, o));
        }
        if (view === 'app') {
            children.push(appCard(model, handlers, o));
        } else if (parties.length === 0 && accepting) {
            children.push(pathChoiceCard(handlers, o));
        }
    }

    return el('section', { class: 'rsvp-answer', attrs: { 'data-view': view }, children: children, document: d });
}

/* ── entry point ──────────────────────────────────────────────────────────── */

/**
 * Draw the whole page for a model.
 *
 * @param {object} model   {phase, code, payload, view, editing, managing, passes, result, entryError, retryable}
 *   phase:   'loading' | 'unavailable' | 'enter-code' | 'ready'
 *   view:    'idle' | 'choose' | 'attend' | 'decline' | 'app' | 'passes'
 *   passes:  null | {status: 'loading' | 'ok' | 'error', data?, message?, retryable?}
 *   result:  null | {status, name, seats, partyId?}
 * @param {object} handlers {onCode, onChoose, onCancel, onSubmit, onRetry, onManage, onPassesRetry, onPhoto}
 * @param {object} opts    {document, storageUrl, storeUrl, handoff, smartOpen, navigator, qrcode, now}
 */
export function renderApp(model, handlers, opts) {
    var o = opts || {};
    var m = model || {};
    var h = handlers || {};
    var d = o.document;
    var children;

    if (m.phase === 'ready' && m.payload && m.payload.status === 'ok') {
        children = [eventCard(m.payload, h, o), bannerNode(m.payload, d), answerSection(m, h, o)];
    } else if (m.phase === 'enter-code') {
        children = [codeEntryNode(m, h, o)];
    } else if (m.phase === 'loading') {
        children = [loadingNode(d)];
    } else {
        children = [unavailableNode(m, h, o)];
    }

    return el('div', { class: 'rsvp-app', attrs: { 'data-state': m.phase || 'unavailable' }, children: children, document: d });
}
