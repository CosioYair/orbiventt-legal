/* TEMPLATE DESCRIPTOR — wedding_celestial, version 1.
 *
 * An evening wedding: midnight ground, warm ivory type and restrained antique
 * gold. THE ONLY DARK COLLECTION of the five, which makes it the only one whose
 * contrast budget runs light-on-dark — see the header of its stylesheet.
 *
 * The vocabulary is generic wedding stationery drawn from scratch: a gate arch,
 * a crescent, constellation hairlines and four-point sparks. It borrows NOTHING
 * from Orbiventt's own brand — no orbit mark, no logo, no product gradient, no
 * app-icon geometry — because this is a couple's invitation, not a promotional
 * page. A test enforces that isolation.
 *
 * A descriptor is DATA. The rendering is the shared section renderers in
 * invitation/js/sections/; a template is a palette, a stylesheet and an order.
 * Image geometry, section order and shared UI copy come from the CATEGORY
 * (../placements.js) — the very same frozen objects the other four use — so an
 * organizer switching design can never have a photograph re-cropped or moved to
 * a different part of the invitation.
 *
 * VERSIONING: `templateVersion` is part of the registry identity and is stored
 * on every invitation authored with it. A visual change that would alter an
 * already-published invitation ships as version 2 with its own directory.
 */
import { WEDDING_PLACEMENTS, WEDDING_SECTIONS, WEDDING_LABELS } from '../placements.js';

export default {
    id: 'wedding_celestial_v1',
    categoryKey: 'wedding',
    templateKey: 'wedding_celestial',
    templateVersion: 1,
    contractVersion: 1,

    label: 'Noche estelar',
    description: 'Azul profundo, destellos dorados y una atmósfera elegante para celebraciones nocturnas.',

    stylesheet: 'wedding-celestial/template.css',

    /* The CATEGORY's geometry — never this template's. Sharing the identical
     * frozen object is what makes switching design unable to re-crop. */
    imagePlacements: WEDDING_PLACEMENTS,

    /* This design's OWN artwork, keyed. The KEY is the category's
     * (`hero-default`, mirrored by WEDDING_ASSET_KEYS on mobile); the FILE is
     * this template's. A stored `{source:'template', assetKey:'hero-default'}`
     * therefore keeps showing a hero when the organizer switches design — it
     * simply becomes this collection's artwork. Carries no couple, no date, no
     * place, no text and no branding. Paths are relative to
     * invitation/templates/, like `stylesheet`. */
    assets: {
        'hero-default': 'wedding-celestial/hero-default.jpg',
    },

    themeClass: 'tpl-wedding-celestial',

    labels: WEDDING_LABELS,

    sections: WEDDING_SECTIONS,
};
