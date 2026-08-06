/* ADD TO CALENDAR — an RFC 5545 payload built entirely on the client.
 *
 * No service, no redirect to a third-party "add to calendar" host, and no data
 * about the event leaving the device: the .ics is assembled here and handed to
 * the browser as a download. That keeps a guest's interest in an event private
 * and keeps the page's `connect-src` closed.
 *
 * All organizer text passes through `escapeIcsText`, because an unescaped
 * newline or comma in a SUMMARY is not merely a formatting bug — it lets stored
 * text invent new iCalendar properties.
 */

/** RFC 5545 §3.3.11 — backslash, semicolon, comma and newline are structural. */
export function escapeIcsText(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n?|\n/g, '\\n');
}

/** RFC 5545 §3.1 — content lines are folded at 75 octets. */
export function foldLine(line) {
    if (line.length <= 75) return line;
    const parts = [line.slice(0, 75)];
    let rest = line.slice(75);
    while (rest.length > 74) {
        parts.push(' ' + rest.slice(0, 74));
        rest = rest.slice(74);
    }
    if (rest) parts.push(' ' + rest);
    return parts.join('\r\n');
}

/** UTC basic format: 20270417T230000Z. */
export function icsStamp(ms) {
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Build a single-event calendar.
 *
 * @returns {?string} the .ics body, or null when the instants are unusable.
 */
export function buildIcs(event) {
    const e = event || {};
    const start = icsStamp(e.startMs);
    const end = icsStamp(e.endMs);
    const stamp = icsStamp(Number.isFinite(e.stampMs) ? e.stampMs : e.startMs);
    if (!start || !end || !stamp) return null;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Orbiventt//Invitacion digital//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' + escapeIcsText(e.uid || 'orbiventt-invitation'),
        'DTSTAMP:' + stamp,
        'DTSTART:' + start,
        'DTEND:' + end,
        'SUMMARY:' + escapeIcsText(e.title),
    ];
    if (e.description) lines.push('DESCRIPTION:' + escapeIcsText(e.description));
    if (e.location) lines.push('LOCATION:' + escapeIcsText(e.location));
    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * The download target. A `data:` URL on an `<a download>` — no Blob, no object
 * URL to revoke, and nothing for the page's CSP to have to allow.
 */
export function icsDataUrl(ics) {
    if (typeof ics !== 'string' || ics === '') return null;
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
}

/** A filesystem-safe download name derived from the couple's names. */
export function icsFileName(title) {
    const base = String(title || 'invitacion')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return (base || 'invitacion') + '.ics';
}
