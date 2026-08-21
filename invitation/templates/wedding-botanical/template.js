/* TEMPLATE DESCRIPTOR — wedding_botanical, version 1.
 *
 * A garden collection: warm cream, sage and eucalyptus line art. Where
 * Romántica is soft and Clásica elegante is symmetrical and ruled, this one is
 * ASYMMETRIC AND GROWN — headings sit slightly off-centre over a leaf-crossed
 * rule, sprigs interrupt the dividers rather than framing them, and the closing
 * carries a fine wreath.
 *
 * A descriptor is DATA. The rendering is the shared section renderers in
 * invitation/js/sections/; a template is a palette, a stylesheet and an order.
 * Image geometry, section order and shared UI copy come from the CATEGORY
 * (../placements.js) — the very same frozen objects the other two designs use —
 * so an organizer switching design can never have a photograph re-cropped or
 * moved to a different part of the invitation.
 *
 * VERSIONING: `templateVersion` is part of the registry identity and is stored
 * on every invitation authored with it. A visual change that would alter an
 * already-published invitation ships as version 2 with its own directory.
 */
import { WEDDING_PLACEMENTS, WEDDING_SECTIONS, WEDDING_LABELS } from '../placements.js?v=20260821a';

export default {
    id: 'wedding_botanical_v1',
    categoryKey: 'wedding',
    templateKey: 'wedding_botanical',
    templateVersion: 1,
    contractVersion: 1,

    label: 'Botánica',
    description: 'Tonos crema y verde salvia con detalles naturales y una composición orgánica.',

    stylesheet: 'wedding-botanical/template.css',

    /* The CATEGORY's geometry — never this template's. Sharing the identical
     * frozen object is what makes switching design unable to re-crop. */
    imagePlacements: WEDDING_PLACEMENTS,

    /* This design's OWN artwork, keyed. The KEY is the category's
     * (`hero-default`, mirrored by WEDDING_ASSET_KEYS on mobile); the FILE is
     * this template's. A stored `{source:'template', assetKey:'hero-default'}`
     * therefore keeps showing a hero when the organizer switches design — it
     * simply becomes this collection's artwork. Carries no couple, no date, no
     * place and no text. Paths are relative to invitation/templates/. */
    assets: {
        'hero-default': 'wedding-botanical/hero-default.jpg',
    },

    themeClass: 'tpl-wedding-botanical',

    labels: WEDDING_LABELS,

    sections: WEDDING_SECTIONS,
};
