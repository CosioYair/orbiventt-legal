/* THE WEDDING CATEGORY'S IMAGE GEOMETRY — one definition, every template.
 *
 * WHY THIS IS SHARED RATHER THAN COPIED INTO EACH DESCRIPTOR.
 *
 * An organizer frames each photograph in the mobile cropper against the
 * template's declared placement, and the crop is stored as fractions of the
 * original. Switching template must therefore NOT change these numbers: if a
 * second template declared, say, a 3:2 interlude, every photograph already
 * framed at 16:9 would silently be re-cropped the moment the organizer chose
 * it — losing exactly the framing they had approved.
 *
 * So the geometry belongs to the CATEGORY, not to the template. Five wedding
 * templates differ in palette, type and ornament; they agree, by construction,
 * on what shape a photograph is. A test asserts every registered wedding
 * template resolves to this same object, and the mobile mirror
 * (`features/digitalInvitations/imagePlacements.ts`) is pinned to the same
 * numbers on its own side.
 */
export const WEDDING_PLACEMENTS = Object.freeze({
    hero: Object.freeze({
        /* 1080×1920 (9:16) — the phone's shape. The hero is full-bleed inside a
         * centred column capped at 46rem, so it is portrait on every viewport
         * and landscape on none; wider screens trim top and bottom, which is
         * what `trim` marks for the cropper's guides. */
        width: 1080,
        height: 1920,
        aspectRatio: 1080 / 1920,
        trim: Object.freeze([
            Object.freeze({ x: 0, y: 0, w: 1, h: 0.2, label: 'trim-top' }),
            Object.freeze({ x: 0, y: 0.8, w: 1, h: 0.2, label: 'trim-bottom' }),
        ]),
    }),
    gallery: Object.freeze({
        /* 4:5 exactly — every template's gallery tile declares the same ratio,
         * so there is nothing to trim and no guides to draw. */
        width: 800,
        height: 1000,
        aspectRatio: 4 / 5,
        trim: Object.freeze([]),
    }),
    interlude: Object.freeze({
        /* 16:9 for every band in every template. A template may vary the inset,
         * the corner radius or the ornament around a band — never its ratio. */
        width: 1600,
        height: 900,
        aspectRatio: 16 / 9,
        trim: Object.freeze([]),
    }),
});

/* The render order every wedding template uses.
 *
 * The six `interlude*` entries are the photograph anchors, and their positions
 * in this list are what "fixed slot" means: each renders exactly where it
 * appears regardless of what its neighbours do, so switching template never
 * moves a photograph to a different part of the invitation.
 *
 * A template that wanted a different order would export its own array — but it
 * must contain the same section ids, or a stored invitation would lose a
 * section by changing its dress. */
export const WEDDING_SECTIONS = Object.freeze([
    'hero',
    'message',
    'interludeAfterMessage',
    'countdown',
    'interludeAfterCountdown',
    'ceremony',
    'interludeAfterCeremony',
    'reception',
    'interludeAfterReception',
    'dressCode',
    'interludeAfterDressCode',
    'gallery',
    'gifts',
    'passes',
    'actions',
    'interludeBeforeClosing',
    'closing',
]);

/* TEMPLATE UI COPY shared by the wedding category.
 *
 * These are interface strings, never organizer content — the same on every
 * invitation a template draws (see invitation/FIELDS.md). A template may
 * override any of them by spreading this object and replacing a key, which is
 * how "Reclama tus pases" can stay constant while a template calls its gallery
 * something else. */
export const WEDDING_LABELS = Object.freeze({
    heroConjunction: '&',

    countdownHeading: 'Faltan',
    countdownCompleted: '¡Hoy es el día!',

    ceremonyHeading: 'Ceremonia',
    receptionHeading: 'Recepción',
    dressCodeHeading: 'Código de vestimenta',
    galleryHeading: 'Nuestra historia',
    giftsHeading: 'Mesa de regalos',
    passesHeading: 'Reclama tus pases',

    mapAction: 'Cómo llegar',
    calendarAction: 'Agregar al calendario',
    shareAction: 'Compartir invitación',
    locationAction: 'Abrir ubicación',
    externalHint: ' (se abre en una pestaña nueva)',
});
