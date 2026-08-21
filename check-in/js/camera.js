/* CAMERA LIFECYCLE.
 *
 * ── Why `Iniciar scanner` is a requirement, not decoration ───────────────────
 * iOS WebKit grants `getUserMedia` only from a user gesture on a top-level
 * HTTPS document. Autostarting would fail on exactly the platform a borrowed
 * phone is most likely to be running, so the explicit button IS the mechanism.
 *
 * Audio is never requested: a door needs pictures, and asking for a microphone
 * would make the permission prompt look alarming for no benefit.
 *
 * The stream is stopped whenever the page goes away — DEPARTURE only
 * (`visibilitychange` → hidden, `pagehide`), never `blur`, which fires for
 * native UI the page is still behind. Leaving a camera running on a locked
 * phone in someone's pocket is both a battery and a trust problem.
 */

/** Rear camera preferred; `ideal` degrades instead of throwing on one-camera devices. */
export function cameraConstraints() {
    return {
        audio: false,
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
        },
    };
}

/** Human-readable, actionable reasons — a camera error must never be a dead end. */
export function describeCameraError(error) {
    var name = (error && error.name) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return {
            code: 'denied',
            title: 'Permiso de cámara denegado',
            body: 'Permite el acceso a la cámara en los ajustes de tu navegador y vuelve a intentarlo.',
        };
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return {
            code: 'missing',
            title: 'No encontramos una cámara',
            body: 'Este dispositivo no tiene una cámara disponible para el navegador.',
        };
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
        return {
            code: 'busy',
            title: 'La cámara no está disponible',
            body: 'Otra aplicación podría estar usándola. Ciérrala y vuelve a intentarlo.',
        };
    }
    return {
        code: 'error',
        title: 'No pudimos abrir la cámara',
        body: 'Vuelve a intentarlo.',
    };
}

/**
 * Open the camera and attach it to a <video>.
 *
 * @returns {Promise<{stream: MediaStream}>} rejects with the original error so
 *   the caller can map it through `describeCameraError`.
 */
export async function startCamera(video, deps) {
    var d = deps || {};
    var media = d.mediaDevices ||
        (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);
    if (!media || typeof media.getUserMedia !== 'function') {
        var err = new Error('getUserMedia unavailable');
        err.name = 'NotFoundError';
        throw err;
    }

    var stream = await media.getUserMedia(cameraConstraints());
    if (video) {
        video.srcObject = stream;
        // `playsInline` keeps iOS from taking the video fullscreen, which would
        // hide the whole scanner UI behind the native player.
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        try {
            await video.play();
        } catch (_) {
            /* Autoplay policies vary; the track is live either way. */
        }
    }
    return { stream: stream };
}

/** Release every track. Safe to call repeatedly. */
export function stopCamera(stream, video) {
    if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(function (track) {
            try { track.stop(); } catch (_) { /* already stopped */ }
        });
    }
    if (video) {
        try { video.srcObject = null; } catch (_) { /* detached */ }
    }
}
