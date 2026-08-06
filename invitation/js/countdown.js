/* COUNTDOWN — pure arithmetic, no DOM, no timers.
 *
 * Split out from the section renderer so the two states that actually matter —
 * "still counting" and "the date has passed" — are testable without a browser
 * and without waiting for real time to elapse.
 *
 * The completed state is a first-class outcome, not an edge case: an invitation
 * outlives its event, and a guest opening the link the next morning must see a
 * deliberate message rather than a negative or frozen counter.
 */

/** Unit definitions, largest first. Labels are the accessible names too. */
export const UNITS = [
    { key: 'days', label: 'días', singular: 'día' },
    { key: 'hours', label: 'horas', singular: 'hora' },
    { key: 'minutes', label: 'minutos', singular: 'minuto' },
    { key: 'seconds', label: 'segundos', singular: 'segundo' },
];

/**
 * Break the remaining time into whole units.
 *
 * @returns {?{done: boolean, days: number, hours: number, minutes: number,
 *             seconds: number, remainingMs: number}}
 *   null when either instant is unusable — the caller then skips the section
 *   rather than rendering zeros.
 */
export function countdownParts(nowMs, targetMs) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(targetMs)) return null;

    const remainingMs = targetMs - nowMs;
    if (remainingMs <= 0) {
        return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0, remainingMs: 0 };
    }

    const total = Math.floor(remainingMs / 1000);
    return {
        done: false,
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
        remainingMs,
    };
}

/**
 * A full sentence for assistive technology. The visual counter is a grid of
 * numbers, which a screen reader would otherwise announce as four bare digits
 * every second; this is what gets announced instead, at minute granularity.
 */
export function countdownLabel(parts, completedLabel) {
    if (!parts) return '';
    if (parts.done) return completedLabel || '¡Hoy es el día!';

    const spoken = UNITS
        .filter((unit) => unit.key !== 'seconds')
        .map((unit) => {
            const value = parts[unit.key];
            if (!value) return null;
            return value + ' ' + (value === 1 ? unit.singular : unit.label);
        })
        .filter(Boolean);

    if (spoken.length === 0) return 'Falta menos de un minuto.';
    return 'Faltan ' + spoken.join(', ') + '.';
}

/** Two-digit padding for the visual counter; days are never padded. */
export function padUnit(key, value) {
    const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    if (key === 'days') return String(n);
    return n < 10 ? '0' + n : String(n);
}
