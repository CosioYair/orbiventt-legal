/* THE SCANNER — wiring only. Every decision lives in a module beside this one
 * so it can be tested without a camera:
 *
 *   session.js  where the capability comes from and when it dies
 *   backend.js  the three RPCs, closed allowlist
 *   camera.js   getUserMedia lifecycle
 *   decode.js   BarcodeDetector / jsQR, plus the client-side scan gate
 *   ui.js       server status -> what the operator reads
 *   history.js  debounce / stale-guard / query normalization for Ingresos
 *
 * ── A SCANNER LINK IS NOT A ONE-TIME LINK (locked, 2026-08-20) ──────────────
 * Physical usage taught us the original wiring made the capability FEEL
 * consumable: `Cerrar scanner` forgot the authorization, and an offline
 * bootstrap dead-ended with no way forward. Neither reflected the product:
 * a capability is reusable until it EXPIRES or a manager REVOKES it. So now —
 *
 *   Cerrar scanner       = stop the camera, return home. NEVER forgets.
 *   reload               = restore from sessionStorage and continue.
 *   offline              = keep everything, offer Reintentar. NEVER forgets.
 *   QR_DISABLED /        = stop scanning, keep the authorization so the
 *   SCANNER_NOT_STARTED    operator can resume when organizer or clock allows.
 *   REVOKED / EXPIRED    = the ONLY states that clear the local capability.
 *
 * THE BROWSER DECIDES NOTHING. It cannot read a pass, cannot validate a
 * capability, and cannot know whether a code has been used. Every guard here —
 * shape checks, cooldown, single-flight, debounce — exists for battery and for
 * the operator's eyes. The one-time guarantee is a unique index in Postgres.
 */
import { captureCapability, clearCapability, newNonce } from './session.js?v=20260821a';
import { checkIn, resolveAccess, searchCheckins } from './backend.js?v=20260821a';
import { describeCameraError, startCamera, stopCamera } from './camera.js?v=20260821a';
import { createDecoder, createScanGate, isPassShape } from './decode.js?v=20260821a';
import {
    describeCounter, describeResult, describeHistoryRow, historyEmptyText,
    shouldStopCamera, isTerminalStatus,
} from './ui.js?v=20260821a';
import { createStaleGuard, debounce, normalizeQuery } from './history.js?v=20260821a';

var DECODE_INTERVAL_MS = 125; // ~8 decode attempts/second.
var SEARCH_DEBOUNCE_MS = 300;

var el = function (id) { return document.getElementById(id); };
var show = function (id) { el(id).hidden = false; };
var hide = function (id) { el(id).hidden = true; };
var setText = function (id, value) { el(id).textContent = value == null ? '' : String(value); };

var state = {
    capability: null,
    stream: null,
    decoder: null,
    gate: createScanGate(3000),
    loopTimer: null,
    /* The nonce for the CURRENT physical scan attempt. Reused across retries
     * of that attempt and only cleared once its outcome is resolved. */
    attemptNonce: null,
    attemptPayload: null,
    scanning: false,
    /* After a stop-camera result the Continue button goes HOME, not back to a
     * camera that was deliberately stopped. */
    resultGoesHome: false,
    /* The success auto-return timer. ONE cleanup path (clearResultTimer) is
     * shared by Continuar, Ingresos, Cerrar, terminal states and departure, so
     * a stale timer can never fire against a later scan's result. */
    resultTimer: null,
    /* The operator has scanned this visit — relabels the start button so a
     * stopped camera reads as resumable, not as starting over. */
    hasScanned: false,
    historyGuard: createStaleGuard(),
};

var PANELS = ['loading', 'bootstrap', 'scanner', 'historyPanel', 'fatal'];
function showPanel(id) {
    PANELS.forEach(function (p) { el(p).hidden = p !== id; });
}

/* ── Bootstrap ─────────────────────────────────────────────────────────────── */

async function boot() {
    state.capability = captureCapability(window);

    if (!state.capability) {
        return fatal('Enlace no válido', 'Abre el enlace de scanner que te compartieron.', false);
    }

    showPanel('loading');
    var result = await resolveAccess(state.capability);

    if (!result) {
        // OFFLINE IS NOT TERMINAL. The capability stays in sessionStorage and
        // in memory; the operator retries when the connection returns.
        return fatal('Sin conexión',
            'No pudimos verificar este acceso. Revisa tu conexión e inténtalo de nuevo.', true);
    }

    var status = String(result.status || '');
    if (status !== 'OK') {
        if (isTerminalStatus(status)) clearCapability(window);
        var described = describeResult(result);
        // Non-terminal refusals (not started, rate limited) keep the
        // authorization and stay retryable.
        return fatal(described.title, described.detail, !isTerminalStatus(status));
    }

    setText('eventName', result.event_name || 'Evento');
    setText('scannerLabel', result.scanner_label || '');
    setText('validUntil', result.valid_until ? 'Activo hasta ' + timeOf(result.valid_until) : '');
    updateCounter(result);
    setText('startBtn', state.hasScanned ? 'Reanudar scanner' : 'Iniciar scanner');

    if (result.qr_enabled === false) {
        setText('bootNote', 'El organizador todavía no activó el acceso con QR.');
    } else {
        setText('bootNote', '');
    }

    showPanel('bootstrap');
}

/** Return home WITHOUT re-resolving — used by Cerrar and by Volver. */
function goHome() {
    stopScanning();
    setText('startBtn', state.hasScanned ? 'Reanudar scanner' : 'Iniciar scanner');
    hide('result');
    showPanel('bootstrap');
}

function fatal(title, detail, retryable) {
    setText('fatalTitle', title);
    setText('fatalDetail', detail || '');
    el('fatalRetryBtn').hidden = !retryable;
    showPanel('fatal');
    stopScanning();
}

function timeOf(iso) {
    try {
        return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
}

function updateCounter(result) {
    var text = describeCounter(result);
    if (text) {
        setText('counter', text);
        el('counter').hidden = false;
    }
}

/* ── Camera ────────────────────────────────────────────────────────────────── */

async function beginScanning() {
    var video = el('video');
    try {
        var started = await startCamera(video, {});
        state.stream = started.stream;
    } catch (error) {
        // A camera problem is a CAMERA problem: the capability is untouched
        // and the operator retries from here.
        var described = describeCameraError(error);
        setText('cameraErrorTitle', described.title);
        setText('cameraErrorBody', described.body);
        show('cameraError');
        return;
    }

    hide('cameraError');
    hide('result');
    showPanel('scanner');

    state.decoder = await createDecoder({});
    state.scanning = true;
    tick();
}

function clearResultTimer() {
    if (state.resultTimer) {
        clearTimeout(state.resultTimer);
        state.resultTimer = null;
    }
}

function stopScanning() {
    state.scanning = false;
    clearResultTimer();
    if (state.loopTimer) { clearTimeout(state.loopTimer); state.loopTimer = null; }
    stopCamera(state.stream, el('video'));
    state.stream = null;
}

function tick() {
    if (!state.scanning) return;
    state.loopTimer = setTimeout(function () { void frame(); }, DECODE_INTERVAL_MS);
}

async function frame() {
    if (!state.scanning) return;
    var video = el('video');
    var w = video.videoWidth;
    var h = video.videoHeight;
    if (!w || !h) return tick();

    var payload = await state.decoder.decode(video, w, h);
    if (!payload || !isPassShape(payload)) return tick();
    if (!state.gate.accept(payload, Date.now())) return tick();

    // A NEW physical scan gets a NEW nonce. A retry of the SAME attempt keeps
    // the old one — that is what makes a lost response idempotent.
    state.attemptPayload = payload;
    state.attemptNonce = newNonce();
    await submit();
}

/* ── Submission ────────────────────────────────────────────────────────────── */

async function submit() {
    state.gate.begin();
    // Pause decoding while the result is on screen: the operator is reading,
    // and the code is still sitting in front of the lens.
    state.scanning = false;

    var result = await checkIn(state.capability, state.attemptPayload, state.attemptNonce);
    state.gate.end();
    state.hasScanned = true;
    render(result);
}

function render(result) {
    // A result replacing another must first cancel the old auto-return, or a
    // 3-second timer from the previous success could dismiss THIS card.
    clearResultTimer();
    var view = describeResult(result);
    var card = el('result');

    card.className = 'result result--' + view.tone;
    setText('resultTitle', view.title);
    setText('resultDetail', view.detail || '');

    var list = el('resultLines');
    list.innerHTML = '';
    view.lines.forEach(function (line) {
        var p = document.createElement('p');
        p.className = 'result__line';
        p.textContent = line;             // textContent, never innerHTML
        list.appendChild(p);
    });

    if (result) updateCounter(result);

    var status = result ? String(result.status || '') : '';
    var offline = !result;
    state.resultGoesHome = false;

    // OFFLINE keeps the attempt ALIVE: the write may have committed and only
    // the answer was lost, so Reintentar must resend the SAME nonce. The
    // capability is NEVER cleared for a network failure.
    el('retryBtn').hidden = !offline;
    el('continueBtn').hidden = offline;
    setText('continueBtn', 'Continuar');

    show('result');

    if (shouldStopCamera(status)) {
        stopScanning();
        if (isTerminalStatus(status)) {
            // REVOKED / EXPIRED — the only states allowed to forget.
            clearCapability(window);
            el('continueBtn').hidden = true;
            return;
        }
        // QR_DISABLED / SCANNER_INVALID: scanning stops, the AUTHORIZATION
        // survives. Volver returns home, where the operator can resume once
        // the organizer re-enables QR.
        state.resultGoesHome = true;
        setText('continueBtn', 'Volver');
        return;
    }

    if (!view.requiresContinue && view.autoDismissMs) {
        state.resultTimer = setTimeout(dismissResult, view.autoDismissMs);
    }
}

function dismissResult() {
    // IDEMPOTENT: Continuar then the timer (or a double tap) must not restart
    // scanning twice or touch the next result. Whoever dismisses first wins.
    clearResultTimer();
    if (el('result').hidden) return;
    hide('result');
    // This attempt is resolved. The next code scanned starts a new one.
    state.attemptNonce = null;
    state.attemptPayload = null;
    state.gate.reset();
    if (state.resultGoesHome) {
        state.resultGoesHome = false;
        goHome();
        return;
    }
    if (state.stream) {
        state.scanning = true;
        tick();
    }
}

/* ── Ingresos (history) ────────────────────────────────────────────────────── */

function openHistory() {
    stopScanning();
    hide('result');
    showPanel('historyPanel');
    el('historySearch').value = '';
    void loadHistory('');
}

async function loadHistory(query) {
    var ticket = state.historyGuard.begin();
    setText('historyStatus', 'Buscando…');
    el('historyResults').innerHTML = '';

    var result = await searchCheckins(state.capability, query || null, 25);

    // A response for a query the operator has already typed past is DROPPED.
    if (!state.historyGuard.isCurrent(ticket)) return;

    if (!result) {
        // Offline: nothing is forgotten; the operator types again or retries.
        setText('historyStatus', 'Sin conexión. Inténtalo de nuevo.');
        return;
    }
    var status = String(result.status || '');
    if (status !== 'OK') {
        if (isTerminalStatus(status)) {
            clearCapability(window);
            var described = describeResult(result);
            return fatal(described.title, described.detail, false);
        }
        setText('historyStatus', describeResult(result).detail || 'No disponible por ahora.');
        return;
    }

    setText('historyCounter', (result.event_checked_in || 0) + ' ingresos registrados');
    var rows = result.results || [];
    setText('historyStatus', rows.length === 0 ? historyEmptyText(!!query) : '');

    var list = el('historyResults');
    rows.forEach(function (row) {
        var view = describeHistoryRow(row);
        if (!view) return;
        var item = document.createElement('div');
        item.className = 'history-row' + (view.reverted ? ' history-row--reverted' : '');
        var title = document.createElement('p');
        title.className = 'history-row__title';
        title.textContent = view.title;   // textContent, never innerHTML
        item.appendChild(title);
        view.lines.forEach(function (line) {
            var p = document.createElement('p');
            p.className = 'history-row__line';
            p.textContent = line;
            item.appendChild(p);
        });
        list.appendChild(item);
    });
}

var searchDebounced = debounce(function (value) {
    var q = normalizeQuery(value);
    if (q === null) return;    // one character: wait for more, search nothing
    void loadHistory(q);
}, SEARCH_DEBOUNCE_MS);

/* ── Wiring ────────────────────────────────────────────────────────────────── */

function wire() {
    el('startBtn').addEventListener('click', function () { void beginScanning(); });
    el('retryCameraBtn').addEventListener('click', function () { void beginScanning(); });
    el('continueBtn').addEventListener('click', dismissResult);

    // Same nonce, deliberately: this is a retry of one attempt, not a new scan.
    el('retryBtn').addEventListener('click', function () { void submit(); });

    // Offline / not-started bootstrap failures re-resolve with the SAME
    // capability — nothing was forgotten.
    el('fatalRetryBtn').addEventListener('click', function () { void boot(); });

    // CERRAR = stop the camera and go home. The authorization SURVIVES: the
    // capability stays in sessionStorage and in memory, and Reanudar scanner
    // continues without the original URL. Only revocation or expiry forgets.
    el('closeBtn').addEventListener('click', goHome);

    el('historyBtn').addEventListener('click', openHistory);
    el('historyFromScanBtn').addEventListener('click', openHistory);
    // Escanear is an explicit user gesture, which is exactly what WebKit's
    // getUserMedia rules require to restart the camera.
    el('backToScanBtn').addEventListener('click', function () { void beginScanning(); });
    el('historySearch').addEventListener('input', function (event) {
        searchDebounced(event.target.value);
    });

    // DEPARTURE only — never `blur`, which fires for native UI the page is
    // still behind. A camera left running in a pocket is a battery and trust
    // problem. Departure stops the CAMERA; it never clears the capability.
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopScanning();
    });
    window.addEventListener('pagehide', function () { stopScanning(); });
}

wire();
void boot();
