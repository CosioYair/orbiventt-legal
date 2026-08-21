/* TEMPLATE DESCRIPTOR — wedding_classic_gold, version 1.
 *
 * Formal stationery: ivory, warm gold and a serif that behaves like engraving.
 * Where Romántica is soft and asymmetric, this one is SYMMETRICAL and ruled —
 * every section is centred inside a thin engraved frame, headings are small
 * caps over a double rule, and the ornament is drawn geometry (rings, laurel,
 * a diamond monogram) rather than a flourish.
 *
 * A descriptor is DATA. The rendering is the shared section renderers in
 * invitation/js/sections/; a template is a palette, a stylesheet and an order.
 * Image geometry, section order and shared UI copy come from the CATEGORY
 * (../placements.js), so an organizer switching design can never have a
 * photograph re-cropped or moved to a different part of the invitation.
 *
 * VERSIONING: `templateVersion` is part of the registry identity and is stored
 * on every invitation authored with it. A visual change that would alter an
 * already-published invitation ships as version 2 with its own directory.
 */
import { WEDDING_PLACEMENTS, WEDDING_SECTIONS, WEDDING_LABELS } from '../placements.js?v=20260821a';

export default {
    id: 'wedding_classic_gold_v1',
    categoryKey: 'wedding',
    templateKey: 'wedding_classic_gold',
    templateVersion: 1,
    contractVersion: 1,

    label: 'Clásica elegante',
    description: 'Marfil, dorado y ornamentos discretos inspirados en papelería formal.',

    stylesheet: 'wedding-classic-gold/template.css',

    /* The CATEGORY's geometry — never this template's. Sharing it is what makes
     * switching design unable to re-crop a photograph. */
    imagePlacements: WEDDING_PLACEMENTS,

    /* This design's OWN artwork, keyed. The KEY is the category's
     * (`hero-default`, mirrored by WEDDING_ASSET_KEYS on mobile); the FILE is
     * this template's. So a stored `{source:'template', assetKey:'hero-default'}`
     * keeps showing a hero when the organizer switches design — it simply
     * becomes this collection's artwork. Carries no couple, no date, no place
     * and no text, and is authored for this repository. Paths are relative to
     * invitation/templates/, like `stylesheet`. */
    assets: {
        'hero-default': 'wedding-classic-gold/hero-default.jpg',
    },

    /* Every rule in template.css is scoped under this class, so two templates
     * can never leak styles into each other. */
    themeClass: 'tpl-wedding-classic-gold',

    labels: WEDDING_LABELS,

    sections: WEDDING_SECTIONS,
};
