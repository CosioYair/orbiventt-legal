/* RESULT PRESENTATION — the pure part, so the whole table is testable.
 *
 * Every string a door operator reads is decided HERE, from a server status and
 * the minimal fields that status is allowed to carry. Two rules run through it:
 *
 *   1. IDENTITY APPEARS ONLY ON THE TWO AUTHORIZED OUTCOMES. `CHECKED_IN` and
 *      `ALREADY_CHECKED_IN` may name the occupant; every failure — invalid,
 *      wrong event, disabled, expired, revoked, offline — names nobody. A
 *      failure that leaked a name would turn a scanner link into a guest-list
 *      oracle.
 *   2. SUCCESS AUTO-RETURNS; A CONFLICT DOES NOT. `PASE YA UTILIZADO` may mean
 *      someone is presenting a copied screenshot, so it waits for a human to
 *      press Continuar rather than scrolling past on its own. Success returns
 *      on its own after ~3 s — physical testing showed the original ~1.4 s was
 *      too fast to actually read the name and time — and Continuar is always
 *      offered so an operator in a hurry dismisses it immediately.
 */

/** Success dwell time. ~1.4 s was physically unreadable; 3 s is the contract. */
export var SUCCESS_DISMISS_MS = 3000;

/** Terminal authorization states — the capability is dead, stop and forget it. */
var TERMINAL = { SCANNER_REVOKED: true, SCANNER_EXPIRED: true };

/** States that must stop the camera (terminal, or the feature was switched off). */
var STOP_CAMERA = {
    SCANNER_REVOKED: true,
    SCANNER_EXPIRED: true,
    SCANNER_INVALID: true,
    QR_DISABLED: true,
};

export function isTerminalStatus(status) {
    return TERMINAL[status] === true;
}

export function shouldStopCamera(status) {
    return STOP_CAMERA[status] === true;
}

/**
 * Turn a server response into what the operator sees.
 *
 * @param {?object} result  the RPC payload, or null for a transport failure.
 * @returns {{tone,title,detail,lines,autoDismissMs,requiresContinue,identity}}
 */
export function describeResult(result) {
    // null === the request never completed. It may ALSO mean the write
    // committed and the answer was lost, which is why the caller retries with
    // the SAME nonce rather than treating this as a failed scan.
    if (!result || typeof result !== 'object') {
        return {
            tone: 'offline',
            title: 'Sin conexión',
            detail: 'Sin conexión. No se puede validar el acceso.',
            lines: [],
            autoDismissMs: null,
            requiresContinue: true,
            identity: false,
        };
    }

    var status = String(result.status || '');

    if (status === 'CHECKED_IN') {
        return {
            tone: 'ok',
            title: 'ACCESO REGISTRADO',
            detail: null,
            lines: identityLines(result),
            autoDismissMs: SUCCESS_DISMISS_MS,
            requiresContinue: false,
            identity: true,
        };
    }

    if (status === 'ALREADY_CHECKED_IN') {
        return {
            tone: 'warn',
            title: 'PASE YA UTILIZADO',
            detail: result.checked_in_at ? 'Registrado a las ' + timeOf(result.checked_in_at) : null,
            lines: identityLines(result),
            autoDismissMs: null,
            requiresContinue: true,
            identity: true,
        };
    }

    var messages = {
        WRONG_EVENT: ['error', 'OTRO EVENTO', 'Este pase pertenece a otro evento.'],
        INVALID_PASS: ['error', 'CÓDIGO NO VÁLIDO', 'Este código no es válido para esta entrada.'],
        PASS_NOT_ELIGIBLE: ['error', 'PASE NO VÁLIDO', 'Este pase ya no está activo.'],
        QR_DISABLED: ['error', 'ACCESO DESACTIVADO', 'El organizador desactivó el acceso con QR.'],
        SCANNER_NOT_STARTED: ['warn', 'ACCESO NO ACTIVO', 'Este acceso todavía no está activo.'],
        SCANNER_EXPIRED: ['error', 'ACCESO EXPIRADO', 'Este acceso ya no está autorizado.'],
        SCANNER_REVOKED: ['error', 'ACCESO REVOCADO', 'Este acceso ya no está autorizado.'],
        SCANNER_INVALID: ['error', 'ACCESO NO VÁLIDO', 'Este enlace de scanner no es válido.'],
        RATE_LIMITED: ['warn', 'DEMASIADOS INTENTOS', 'Espera un momento e inténtalo de nuevo.'],
        INVALID_REQUEST: ['error', 'INTENTO NO VÁLIDO', 'Vuelve a escanear el código.'],
    };
    var m = messages[status] || ['error', 'CÓDIGO NO VÁLIDO', 'Este código no es válido para esta entrada.'];

    var detail = m[2];
    if (status === 'SCANNER_NOT_STARTED' && result.valid_from) {
        detail += ' Comienza a las ' + timeOf(result.valid_from) + '.';
    }

    return {
        tone: m[0],
        title: m[1],
        detail: detail,
        // NO identity on any failure. Not a name, not a seat, not a holder.
        lines: [],
        autoDismissMs: null,
        requiresContinue: true,
        identity: false,
    };
}

/** The minimum a door needs to verify the person standing in front of it.
 *
 * WHO A COMPANION BELONGS TO IS ALWAYS EXPLICIT (locked, 2026-08-20). The
 * server marks the relationship with one field: `holder_label` is present on
 * EVERY companion pass — named or anonymous — and absent on the holder's own.
 *
 *   holder            Yair Cosio            · Pase 1 de 3 · Titular
 *   named companion   Aaron · Acompañante de Yair Cosio · Pase 2 de 3
 *   anonymous         Acompañante de Yair Cosio · Pase 3 de 3
 *
 * For an anonymous seat the relationship IS the identity line — never a bare
 * "Acompañante" floating without context, and never the awkward doubling of
 * "Acompañante" + "Acompañante de X". */
function identityLines(result) {
    var lines = [];
    var relationship = result.holder_label
        ? 'Acompañante de ' + String(result.holder_label)
        : null;

    if (result.occupant_label) {
        lines.push(String(result.occupant_label));
        if (relationship) lines.push(relationship);
    } else if (relationship) {
        lines.push(relationship);
    }

    if (result.seat_label) {
        // No holder_label ⇒ the holder's own pass ⇒ say so on the seat line.
        lines.push(relationship
            ? String(result.seat_label)
            : String(result.seat_label) + ' · Titular');
    }
    return lines;
}

function timeOf(iso) {
    try {
        return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

/**
 * One HISTORY row → what the operator reads in the Ingresos list.
 *
 * The same identity rules as scan results: a display label, a seat label, a
 * time and a scanner label — never an email, phone, username or id. A reverted
 * entry is SHOWN as reverted with both times, because "already admitted and
 * then undone" is exactly what a second operator needs to know; undoing it
 * stays a manager-only act inside Orbiventt, and no id is present to aim a
 * reversal at.
 */
export function describeHistoryRow(row) {
    if (!row || typeof row !== 'object') return null;

    // Same relationship rule as scan results: holder_label present ⇒ a
    // companion of that holder; absent ⇒ the holder's own pass (Titular).
    // This is what disambiguates two different holders each owning a Pase 9.
    var relationship = row.holder_label
        ? 'Acompañante de ' + String(row.holder_label)
        : null;
    var title = row.occupant_label
        ? String(row.occupant_label)
        : (relationship || 'Acompañante');
    var lines = [];
    if (row.occupant_label && relationship) lines.push(relationship);
    if (!relationship) lines.push('Titular');
    if (row.seat_label) lines.push(String(row.seat_label));

    var reverted = !!row.reverted_at;
    if (reverted) {
        lines.push('Check-in revertido');
        if (row.checked_in_at) lines.push('Ingreso original: ' + timeOf(row.checked_in_at));
        lines.push('Revertido: ' + timeOf(row.reverted_at));
    } else {
        var when = row.checked_in_at ? 'Ingresó ' + timeOf(row.checked_in_at) : '';
        var scanner = row.scanner_label ? String(row.scanner_label) : '';
        if (when || scanner) lines.push([when, scanner].filter(Boolean).join(' · '));
    }

    return { title: title, lines: lines, reverted: reverted };
}

/** Empty-state copy for the Ingresos view. */
export function historyEmptyText(hasQuery) {
    return hasQuery ? 'No se encontraron ingresos.' : 'Aún no hay ingresos registrados.';
}

/**
 * The entry counter.
 *
 * SERVER VALUES ONLY. Never a credential count (durable rows include suspended
 * history) and never the event's capacity (aspirational). Returns null when the
 * server did not supply both, so the UI omits it rather than inventing one.
 */
export function describeCounter(result) {
    if (!result || typeof result !== 'object') return null;
    var done = result.event_checked_in;
    var total = result.event_pass_total;
    if (typeof done !== 'number' || typeof total !== 'number') return null;
    return done + ' / ' + total + ' ingresos';
}
