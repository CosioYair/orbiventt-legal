/* THE EVENT'S ITINERARY ON THE WEB — read-only, by invitation only.
 *
 * `guest_resolve_invitation` returns `event.itinerary` for the ONE event the
 * code resolves to (migration 20261012210000): the organizer's activities, in
 * the order the app lists them. Nothing on this page can add, edit, delete,
 * reorder or complete an activity — those stay Orbiventt app capabilities —
 * and nothing here asks the server for anything: the list arrives with the
 * invitation, and this module only draws it.
 *
 * THE APP'S TIMELINE, TRANSLATED. The mobile itinerary screen renders a time
 * rail (HH:MM, a dot, a connector to the next activity) beside a card with
 * the title, the "start – end" range, a temporal chip (Próxima / En curso /
 * Finalizada), the place with a pin, the description, and "Abrir en Maps"
 * when the place can be opened. Activities are grouped under one heading per
 * calendar day ("MARTES 13 DE OCTUBRE", the year appended when it is not the
 * current one), ordered by start, then creation, then id. All of that is
 * ported here as the OBSERVABLE contract — the same groupings, labels, order
 * and state boundaries — adapted to a responsive page, not copied as code.
 *
 * TIME ZONE. The app renders every date in the viewer's device zone and
 * groups days the same way, so its itinerary never disagrees with the event
 * date above it. This page renders the event's date in `America/Mexico_City`
 * (its existing rule), so the itinerary uses the SAME zone for the same
 * reason: the day an activity lands on must match the day the page says the
 * event is. No timezone of its own, no reinterpretation of the stored instant.
 *
 * PURE. The builder takes the document as a seam and returns a node; the
 * status sync touches rows in place so the page never re-renders for a clock
 * tick. No innerHTML, no inline style: every attribute is a class, a number,
 * an ISO instant, or a Google Maps URL built from constants plus ONE encoded
 * query.
 */
import { el, setText } from './dom.js?v=20261012c';
import { lineIcon } from './gallery.js?v=20261012c';

/** The payload itself is capped server-side at 200; the page never exceeds it. */
export var ITEMS_MAX = 200;
/** Rows shown before "Ver todo el itinerario" — the RSVP action stays near. */
export var COLLAPSE_AT = 6;
/** The app's own limits (event_itinerary_items CHECKs), re-applied on arrival. */
export var TITLE_MAX = 120;
export var DESCRIPTION_MAX = 1000;
export var PLACE_MAX = 200;

var MIN_DURATION = 5;
var MAX_DURATION = 1440;
var DEFAULT_DURATION = 60;
var MINUTE_MS = 60000;
var LOCALE = 'es-MX';
var TIME_ZONE = 'America/Mexico_City';
var SOURCES = { none: true, event: true, custom: true };

/** The app's `ACTIVITY_STATUS_LABEL`. */
export var STATUS_LABEL = { upcoming: 'Próxima', ongoing: 'En curso', completed: 'Finalizada' };

export var ITINERARY_COPY = {
    heading: 'Itinerario',
    one: '1 actividad',
    many: function (n) { return String(n) + ' actividades'; },
    maps: 'Abrir en Maps',
    expand: function (n) { return 'Ver todo el itinerario · ' + String(n) + ' actividades'; },
};

/* Line icons (24-box, stroked): calendar for the heading, pin for a place,
 * map for the Maps action — the app's `calendar-outline` / `location-outline`
 * / `map-outline` glyphs, simplified. */
var CALENDAR_ICON = 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z';
var PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0';
var MAP_ICON = 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16';

/* ── sanitising + ordering ────────────────────────────────────────────────── */

/** Strip control characters (keep newlines), trim, clamp. '' when unusable. */
function clean(value, max) {
    if (typeof value !== 'string') return '';
    var s = value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
    return s.length > max ? s.slice(0, max) : s;
}

/** The app's `compareActivities`: start, then creation, then id. */
export function compareActivities(a, b) {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (a.createdMs !== b.createdMs) return a.createdMs - b.createdMs;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The activities the invitation resolved, as the page draws them: only
 * well-formed rows (an id, a title, a parsable start), deduplicated by id,
 * limits re-applied, coordinates kept only for a CUSTOM place, sorted in the
 * app's order whatever order they arrived in. [] for anything else — an older
 * server without the key simply has no itinerary to show.
 */
export function itineraryList(payload) {
    var event = payload && payload.event;
    var raw = event && Array.isArray(event.itinerary) ? event.itinerary : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < raw.length && out.length < ITEMS_MAX; i += 1) {
        var r = raw[i];
        if (!r || typeof r !== 'object') continue;
        var id = typeof r.id === 'string' ? r.id : '';
        var title = clean(r.title, TITLE_MAX);
        var start = Date.parse(typeof r.starts_at === 'string' ? r.starts_at : '');
        if (!id || !title || !Number.isFinite(start) || seen[id]) continue;
        seen[id] = true;

        var minutes = Number(r.duration_minutes);
        if (!Number.isFinite(minutes)) minutes = DEFAULT_DURATION;
        minutes = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(minutes)));

        var source = SOURCES[r.location_source] ? r.location_source : 'none';
        var lat = Number(r.latitude);
        var lng = Number(r.longitude);
        var coords = source === 'custom' && Number.isFinite(lat) && Number.isFinite(lng)
            && (lat !== 0 || lng !== 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        var created = Date.parse(typeof r.created_at === 'string' ? r.created_at : '');

        out.push({
            id: id,
            title: title,
            description: clean(r.description, DESCRIPTION_MAX) || null,
            startMs: start,
            endMs: start + minutes * MINUTE_MS,
            durationMinutes: minutes,
            locationSource: source,
            locationName: source === 'custom' ? (clean(r.location_name, PLACE_MAX) || null) : null,
            address: source === 'custom' ? (clean(r.address, PLACE_MAX) || null) : null,
            latitude: coords ? lat : null,
            longitude: coords ? lng : null,
            createdMs: Number.isFinite(created) ? created : 0,
        });
    }
    out.sort(compareActivities);
    return out;
}

/* ── time, days, status — the app's contract in the page's zone ──────────── */

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

/** `18:00` — 24-hour, like the app's `formatActivityTime`. '' when unusable. */
export function formatTime(ms) {
    if (!Number.isFinite(ms)) return '';
    // h23, not hour12:false — some engines print midnight as '24:00' with the latter.
    return fmt(ms, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** `YYYY-MM-DD` of an instant in the page's event zone (the app's `localDayKey`). */
export function dayKey(ms) {
    if (!Number.isFinite(ms)) return '';
    try {
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date(ms));
        var o = {};
        for (var i = 0; i < parts.length; i += 1) {
            if (parts[i].type !== 'literal') o[parts[i].type] = parts[i].value;
        }
        return o.year && o.month && o.day ? o.year + '-' + o.month + '-' + o.day : '';
    } catch (_) {
        return '';
    }
}

/**
 * `MARTES 13 DE OCTUBRE` — the app's `formatDayHeading`: weekday, day and
 * month, uppercased; the year appended whenever it is not the viewer's
 * current year, so a next-year trip or a New-Year crossing is never ambiguous.
 */
export function formatDayHeading(ms, nowMs) {
    if (!Number.isFinite(ms)) return '';
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var withYear = dayKey(ms).slice(0, 4) !== dayKey(now).slice(0, 4);
    var options = { weekday: 'long', day: 'numeric', month: 'long' };
    if (withYear) options.year = 'numeric';
    return fmt(ms, options).replace(/,\s*/g, ' ').toUpperCase();
}

/**
 * The app's `resolveActivityStatus`: `upcoming` before the start, `ongoing`
 * on `[start, end)`, `completed` from the derived end on. Never persisted.
 */
export function activityStatus(item, nowMs) {
    if (nowMs < item.startMs) return 'upcoming';
    if (nowMs < item.endMs) return 'ongoing';
    return 'completed';
}

/** The app's `groupActivitiesByDay`: `[{key, title, items}]`, chronological. */
export function groupByDay(items, nowMs) {
    var sorted = items.slice().sort(compareActivities);
    var days = [];
    var byKey = {};
    for (var i = 0; i < sorted.length; i += 1) {
        var key = dayKey(sorted[i].startMs) || 'invalid';
        var day = byKey[key];
        if (!day) {
            day = { key: key, title: formatDayHeading(sorted[i].startMs, nowMs), items: [] };
            byKey[key] = day;
            days.push(day);
        }
        day.items.push(sorted[i]);
    }
    return days;
}

/* ── places ───────────────────────────────────────────────────────────────── */

/**
 * The app's `placeOf`: a CUSTOM place shows what the organizer picked (name,
 * else address) and opens in Maps by coordinate, else by address; an
 * activity "at the event" shows the event's own address and reuses the
 * event's own Maps link (the page already gave the guest both); `none` shows
 * nothing. `{label, href}` or null.
 */
function placeOf(item, o) {
    var mapUrl = typeof o.mapUrl === 'function' ? o.mapUrl : function () { return null; };
    if (item.locationSource === 'custom') {
        var label = item.locationName || item.address;
        if (!label) return null;
        var target = item.latitude != null
            ? { latitude: item.latitude, longitude: item.longitude }
            : { address: item.address || item.locationName };
        return { label: label, href: mapUrl(target) };
    }
    if (item.locationSource === 'event') {
        if (!o.eventAddress) return null;
        return { label: o.eventAddress, href: o.eventMapUrl || null };
    }
    return null;
}

/* ── nodes ────────────────────────────────────────────────────────────────── */

function itemNode(item, index, isLast, nowMs, o) {
    var d = o.document;
    var status = activityStatus(item, nowMs);
    var place = placeOf(item, o);

    return el('li', {
        class: 'rsvp-itin__item',
        attrs: { 'data-index': String(index), 'data-state': status },
        children: [
            el('div', {
                class: 'rsvp-itin__rail',
                children: [
                    el('time', {
                        class: 'rsvp-itin__time',
                        attrs: { datetime: new Date(item.startMs).toISOString() },
                        text: formatTime(item.startMs),
                        document: d,
                    }),
                    el('span', { class: 'rsvp-itin__dot', attrs: { 'aria-hidden': 'true' }, document: d }),
                    isLast ? null : el('span', { class: 'rsvp-itin__line', attrs: { 'aria-hidden': 'true' }, document: d }),
                ],
                document: d,
            }),
            el('div', {
                class: 'rsvp-itin__body',
                children: [
                    el('p', { class: 'rsvp-itin__name', text: item.title, document: d }),
                    el('p', {
                        class: 'rsvp-itin__meta',
                        children: [
                            el('span', { class: 'rsvp-itin__range', text: formatTime(item.startMs) + ' – ' + formatTime(item.endMs), document: d }),
                            el('span', { class: 'rsvp-itin__chip', text: STATUS_LABEL[status], document: d }),
                        ],
                        document: d,
                    }),
                    place
                        ? el('p', {
                            class: 'rsvp-itin__place',
                            children: [lineIcon(PIN_ICON, d), el('span', { text: place.label, document: d })],
                            document: d,
                        })
                        : null,
                    item.description ? el('p', { class: 'rsvp-itin__desc', text: item.description, document: d }) : null,
                    place && place.href
                        ? el('a', {
                            class: 'rsvp-itin__maps',
                            attrs: { href: place.href, target: '_blank', rel: 'noopener noreferrer' },
                            children: [lineIcon(MAP_ICON, d), el('span', { text: ITINERARY_COPY.maps, document: d })],
                            document: d,
                        })
                        : null,
                ],
                document: d,
            }),
        ],
        document: d,
    });
}

/**
 * The itinerary section, or null when there is nothing to show.
 *
 *   items          from `itineraryList()`
 *   o.document     test seam
 *   o.now          epoch ms (the chips and the day headings' year)
 *   o.eventStartsAt the event's own start — a single itinerary day that IS the
 *                  event day needs no heading (the date sits right above);
 *                  several days, or a different day, always get headings
 *   o.eventAddress / o.eventMapUrl / o.mapUrl   for places (see `placeOf`)
 *
 * Past COLLAPSE_AT rows the rest wait behind "Ver todo el itinerario", so a
 * long programme never pushes the confirmation action out of reach; expanding
 * is a DOM toggle on this node, no re-render.
 */
export function itineraryNode(items, o) {
    var d = o.document;
    if (!items || !items.length) return null;
    var nowMs = Number.isFinite(o.now) ? o.now : Date.now();
    var days = groupByDay(items, nowMs);
    var eventDay = dayKey(Date.parse(o.eventStartsAt || ''));
    var showDays = days.length > 1 || (!!eventDay && days[0].key !== eventDay);
    var collapsed = items.length > COLLAPSE_AT;

    var blocks = [];
    var folded = [];
    var index = 0;
    for (var i = 0; i < days.length; i += 1) {
        var day = days[i];
        var heading = showDays && day.title ? el('h3', { class: 'rsvp-itin__day', text: day.title, document: d }) : null;
        if (heading && collapsed && index >= COLLAPSE_AT) folded.push(heading);
        var rows = [];
        for (var j = 0; j < day.items.length; j += 1) {
            var isLast = j === day.items.length - 1;
            var row = itemNode(day.items[j], index, isLast, nowMs, o);
            if (collapsed && index >= COLLAPSE_AT) {
                folded.push(row);
            } else if (collapsed && index === COLLAPSE_AT - 1 && !isLast) {
                // The last visible row: its connector would point at nothing.
                folded.push(row.querySelector('.rsvp-itin__line'));
            }
            rows.push(row);
            index += 1;
        }
        if (heading) blocks.push(heading);
        blocks.push(el('ol', { class: 'rsvp-itin__list', children: rows, document: d }));
    }
    for (var k = 0; k < folded.length; k += 1) if (folded[k]) folded[k].setAttribute('hidden', '');

    var expand = null;
    if (collapsed) {
        expand = el('button', {
            class: 'rsvp-btn rsvp-btn--ghost rsvp-itin__expand',
            attrs: { type: 'button', 'aria-expanded': 'false' },
            text: ITINERARY_COPY.expand(items.length),
            document: d,
        });
        expand.addEventListener('click', function () {
            for (var m = 0; m < folded.length; m += 1) if (folded[m]) folded[m].removeAttribute('hidden');
            expand.setAttribute('aria-expanded', 'true');
            expand.setAttribute('hidden', '');
        });
    }

    return el('section', {
        class: 'rsvp-itin',
        attrs: { 'aria-label': ITINERARY_COPY.heading },
        children: [
            el('h2', {
                class: 'rsvp-itin__title',
                children: [
                    lineIcon(CALENDAR_ICON, d, 'rsvp-icon rsvp-itin__icon'),
                    el('span', { text: ITINERARY_COPY.heading, document: d }),
                    el('span', {
                        class: 'rsvp-itin__count',
                        text: ' · ' + (items.length === 1 ? ITINERARY_COPY.one : ITINERARY_COPY.many(items.length)),
                        document: d,
                    }),
                ],
                document: d,
            }),
        ].concat(blocks, expand ? [expand] : []),
        document: d,
    });
}

/**
 * Bring the rendered rows' temporal state up to `nowMs` IN PLACE — the app's
 * 30-second chip refresh, without re-rendering a page a guest may be typing
 * on. `items` must be the same list the section was built from (`data-index`
 * is its position). Returns how many rows changed.
 */
export function syncItineraryStatus(root, items, nowMs) {
    if (!root || typeof root.querySelectorAll !== 'function' || !items || !items.length) return 0;
    var rows = root.querySelectorAll('.rsvp-itin__item');
    var changed = 0;
    for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var item = items[Number(row.getAttribute('data-index'))];
        if (!item) continue;
        var status = activityStatus(item, nowMs);
        if (row.getAttribute('data-state') === status) continue;
        row.setAttribute('data-state', status);
        var chip = row.querySelector('.rsvp-itin__chip');
        if (chip) setText(chip, STATUS_LABEL[status]);
        changed += 1;
    }
    return changed;
}
